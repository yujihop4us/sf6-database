import { NextResponse } from 'next/server'

const STARTGG_API = 'https://api.start.gg/gql/alpha'
const CACHE_TTL = 15 * 1000

// eventId ごとにキャッシュを保持（グローバル単一キャッシュだと別イベントのデータが混入する）
const cache = new Map<number, { data: any; ts: number }>()

// ── GQL queries ───────────────────────────────────────────────────────────────

// Event metadata のみ (sets なし — complexity 節約)
const Q_EVENT_META = `
query EventMeta($eventId: ID!) {
  event(id: $eventId) {
    id name state numEntrants
    phases { id name state groupCount bracketType }
  }
}`

// Recent completed sets — phases を含まず complexity を最小化
// perPage: 20 で complexity ~400 (CB2026 規模でも安全)
const Q_RECENT_SETS = `
query EventSetsRecent($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    sets(page: $page, perPage: $perPage, sortType: RECENT) {
      pageInfo { totalPages }
      nodes {
        id fullRoundText state completedAt displayScore
        phaseGroup { displayIdentifier phase { name } }
        slots {
          entrant {
            id name initialSeedNum
            participants { gamerTag player { id } }
          }
          standing { stats { score { value } } }
        }
      }
    }
  }
}`

// Live / called sets のみ (state 2 or 6)
// perPage: 20 で十分 (同時進行セットは通常10件以下)
// games フィールド: winnerId で各ゲームの勝者を取得 (live score 算出用)
const Q_LIVE_SETS = `
query EventSetsLive($eventId: ID!, $perPage: Int!) {
  event(id: $eventId) {
    sets(page: 1, perPage: $perPage, sortType: STANDARD
         filters: { state: [2, 6] }) {
      nodes {
        id fullRoundText state completedAt displayScore
        phaseGroup { displayIdentifier phase { name } }
        slots {
          entrant {
            id name initialSeedNum
            participants { gamerTag player { id } }
          }
          standing { stats { score { value } } }
        }
        games { winnerId orderNum }
      }
    }
  }
}`

// ── ヘルパー ───────────────────────────────────────────────────────────────────

async function gqlFetch(query: string, variables: Record<string, unknown>) {
  const token = process.env.STARTGG_API_TOKEN || process.env.STARTGG_TOKEN
  if (!token) throw new Error('STARTGG_API_TOKEN not set')

  const res = await fetch(STARTGG_API, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  const text = await res.text()
  let data: any
  try { data = JSON.parse(text) } catch {
    throw new Error('Non-JSON from start.gg: ' + text.substring(0, 200))
  }
  if (data.errors) {
    const msg = data.errors[0]?.message ?? JSON.stringify(data.errors)
    throw new Error('GQL: ' + msg)
  }
  return data?.data
}

// "TEAM | Handle" → "Handle" (gamerTag 優先)
function extractHandle(entrantName: string, gamerTag?: string | null): string {
  if (gamerTag) return gamerTag
  if (entrantName.includes(' | ')) {
    return entrantName.split(' | ').slice(1).join(' | ').trim()
  }
  return entrantName
}

function mapSet(set: any) {
  const s0 = set.slots?.[0]
  const s1 = set.slots?.[1]
  const p1name = s0?.entrant?.name || 'TBD'
  const p2name = s1?.entrant?.name || 'TBD'
  const p1gt   = s0?.entrant?.participants?.[0]?.gamerTag || null
  const p2gt   = s1?.entrant?.participants?.[0]?.gamerTag || null
  // start.gg player ID (DB の startgg_player_ids と照合するため)
  const p1StartggId = s0?.entrant?.participants?.[0]?.player?.id ?? null
  const p2StartggId = s1?.entrant?.participants?.[0]?.player?.id ?? null

  const s1v = s0?.standing?.stats?.score?.value ?? -1
  const s2v = s1?.standing?.stats?.score?.value ?? -1
  const score = s1v >= 0 && s2v >= 0 ? `${s1v}-${s2v}` : ''

  let status = 'upcoming'
  if      (set.state === 3) status = 'completed'
  else if (set.state === 2) status = 'live'
  else if (set.state === 6) status = 'live'   // CALLED も live 扱い

  const winner    = status === 'completed' ? (s1v > s2v ? p1name : p2name) : ''
  const phaseName = set.phaseGroup?.phase?.name || 'Unknown'
  const poolId    = set.phaseGroup?.displayIdentifier || ''

  // ── liveScore: games データから各選手のゲーム勝数を算出 (state=2/6 のみ) ──
  let liveScore: { p1: number; p2: number } | null = null
  if ((set.state === 2 || set.state === 6) && Array.isArray(set.games) && set.games.length > 0) {
    const p1eid = s0?.entrant?.id ?? null
    const p2eid = s1?.entrant?.id ?? null
    if (p1eid && p2eid) {
      let p1wins = 0, p2wins = 0
      for (const g of set.games) {
        if (g.winnerId === p1eid) p1wins++
        else if (g.winnerId === p2eid) p2wins++
      }
      liveScore = { p1: p1wins, p2: p2wins }
    }
  }

  return {
    group:            phaseName + (poolId ? ' - ' + poolId : ''),
    phase:            phaseName,
    pool:             poolId,
    round:            set.fullRoundText || 'Unknown',
    player1:          p1name,
    player2:          p2name,
    player1_handle:      extractHandle(p1name, p1gt),
    player2_handle:      extractHandle(p2name, p2gt),
    player1_startggId:   p1StartggId,
    player2_startggId:   p2StartggId,
    player1_entrantId:   s0?.entrant?.id ?? null,
    player2_entrantId:   s1?.entrant?.id ?? null,
    player1_seed:     s0?.entrant?.initialSeedNum ?? null,
    player2_seed:     s1?.entrant?.initialSeedNum ?? null,
    displayScore:     set.displayScore ?? null,
    score, winner, status,
    completedAt:      set.completedAt ?? null,
    liveScore,
    maps: [],
  }
}

// ── Main fetch ────────────────────────────────────────────────────────────────

async function fetchFromStartGG(eventId: number) {
  // 1. Event metadata (phases 込み、sets なし → complexity 低い)
  const metaData = await gqlFetch(Q_EVENT_META, { eventId })
  const event = metaData?.event
  if (!event) throw new Error('Event not found')

  const eventMeta = {
    id: event.id, name: event.name,
    state: event.state, numEntrants: event.numEntrants,
    phases: event.phases || [],
  }

  // 2. Live / called sets を優先取得 (通常 0〜10 件)
  let liveSets: any[] = []
  try {
    const ld = await gqlFetch(Q_LIVE_SETS, { eventId, perPage: 20 })
    liveSets = ld?.event?.sets?.nodes || []
  } catch { /* live セット取得失敗は無視 */ }

  // 3. Recent completed sets (perPage: 20 で complexity 安全圏)
  const recentSets: any[] = []
  try {
    const rd = await gqlFetch(Q_RECENT_SETS, { eventId, page: 1, perPage: 20 })
    recentSets.push(...(rd?.event?.sets?.nodes || []))
  } catch { /* recent 取得失敗は無視 */ }

  // 4. マージ (live 優先、重複除去)
  const seen = new Set<string>()
  const merged: any[] = []
  for (const s of [...liveSets, ...recentSets]) {
    if (seen.has(String(s.id))) continue
    seen.add(String(s.id))
    merged.push(s)
  }

  return {
    event:       eventMeta,
    matches:     merged.map(mapSet),
    lastUpdated: new Date().toISOString(),
    source:      'start.gg',
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId    = parseInt(searchParams.get('eventId') || '0')
  const forceFresh = searchParams.get('fresh') === '1'
  const now        = Date.now()

  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
  }

  const cached = cache.get(eventId)
  if (!forceFresh && cached && (now - cached.ts) < CACHE_TTL) {
    return NextResponse.json({ ...cached.data, cached: true })
  }

  try {
    const data = await fetchFromStartGG(eventId)
    cache.set(eventId, { data, ts: now })
    return NextResponse.json({ ...data, cached: false })
  } catch (error: any) {
    console.error('[start.gg]', error.message)
    const stale = cache.get(eventId)
    if (stale) {
      return NextResponse.json({ ...stale.data, cached: true, error: error.message })
    }
    return NextResponse.json({ error: error.message, matches: [], event: null }, { status: 500 })
  }
}
