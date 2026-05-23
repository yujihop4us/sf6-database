import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const STARTGG_API = 'https://api.start.gg/gql/alpha'

// ── GQL: completed sets with seed + pool info ─────────────────────────────────
// perPage 25 で complexity ~600 — CB2026/EVO 規模でも安全圏
const Q_POOLS_SETS = `
query PoolsSets($eventId: ID!, $page: Int!) {
  event(id: $eventId) {
    sets(page: $page, perPage: 25, sortType: RECENT, filters: { state: [3] }) {
      pageInfo { totalPages }
      nodes {
        id fullRoundText state completedAt displayScore
        phaseGroup { displayIdentifier phase { name } }
        slots {
          entrant {
            id name initialSeedNum
            participants { gamerTag }
          }
          standing { stats { score { value } } }
        }
      }
    }
  }
}`

// ── Types ─────────────────────────────────────────────────────────────────────

type FeedPriority = 'HIGH' | 'MEDIUM' | 'LOW'

interface FeedEvent {
  type: 'UPSET' | 'QUALIFIED_W' | 'QUALIFIED_L' | 'ELIMINATED' | 'MARQUEE_RESULT'
  priority: FeedPriority
  timestamp: number
  pool: string
  phase: string
  round: string
  message: string
  players: { name: string; handle: string; seed: number | null }[]
  score: string
}

interface PoolProgress {
  id: string
  phase: string
  completed: number
  total: number
  percent: number
}

interface QualifiedPlayer {
  name: string
  handle: string
  seed: number | null
  side: 'winners' | 'losers'
  pool: string
  phase: string
}

// ── ヘルパー ───────────────────────────────────────────────────────────────────

function extractHandle(name: string, gamerTag?: string | null): string {
  if (gamerTag) return gamerTag
  if (name.includes(' | ')) return name.split(' | ').slice(1).join(' | ').trim()
  return name
}

function isUpset(
  winnerSeed: number | null,
  loserSeed: number | null,
): boolean {
  if (winnerSeed == null || loserSeed == null) return false
  // 高シード番号（下位）が低シード番号（上位）に勝った = upset
  return winnerSeed > loserSeed && (winnerSeed - loserSeed) >= 20
}

// "Winners Final", "Losers Final" 等のパターン判定
function matchesFinal(text: string, side: 'winners' | 'losers'): boolean {
  const t = text.toLowerCase()
  if (side === 'winners') return t.includes('winners final') || t.includes('winners finals')
  return t.includes('losers final') || t.includes('losers finals')
}

function isLosersBracket(text: string): boolean {
  return text.toLowerCase().startsWith('losers')
}

// ── Feed generation ───────────────────────────────────────────────────────────

function buildFeedEvents(sets: any[]): FeedEvent[] {
  const events: FeedEvent[] = []

  for (const set of sets) {
    if (set.state !== 3) continue  // completed のみ

    const s0 = set.slots?.[0]
    const s1 = set.slots?.[1]
    if (!s0?.entrant || !s1?.entrant) continue

    const p1name   = s0.entrant.name || 'TBD'
    const p2name   = s1.entrant.name || 'TBD'
    const p1handle = extractHandle(p1name, s0.entrant.participants?.[0]?.gamerTag)
    const p2handle = extractHandle(p2name, s1.entrant.participants?.[0]?.gamerTag)
    const p1seed   = s0.entrant.initialSeedNum ?? null
    const p2seed   = s1.entrant.initialSeedNum ?? null

    const sv1 = s0.standing?.stats?.score?.value ?? -1
    const sv2 = s1.standing?.stats?.score?.value ?? -1
    const score = sv1 >= 0 && sv2 >= 0 ? `${sv1}-${sv2}` : (set.displayScore ?? '')

    const winnerName   = sv1 > sv2 ? p1name   : p2name
    const loserName    = sv1 > sv2 ? p2name   : p1name
    const winnerHandle = sv1 > sv2 ? p1handle : p2handle
    const loserHandle  = sv1 > sv2 ? p2handle : p1handle
    const winnerSeed   = sv1 > sv2 ? p1seed   : p2seed
    const loserSeed    = sv1 > sv2 ? p2seed   : p1seed

    const pool     = set.phaseGroup?.displayIdentifier || ''
    const phase    = set.phaseGroup?.phase?.name || ''
    const round    = set.fullRoundText || ''
    const ts       = set.completedAt ?? Math.floor(Date.now() / 1000)

    const base = {
      pool, phase, round, timestamp: ts,
      score,
      players: [
        { name: p1name, handle: p1handle, seed: p1seed },
        { name: p2name, handle: p2handle, seed: p2seed },
      ],
    }

    // ── QUALIFIED_W ──────────────────────────────────────────────────────────
    if (matchesFinal(round, 'winners')) {
      events.push({
        ...base,
        type: 'QUALIFIED_W',
        priority: 'HIGH',
        message: `✅ ${winnerHandle} → Top Cut (Winners) [Pool ${pool}]`,
      })
      continue
    }

    // ── QUALIFIED_L ──────────────────────────────────────────────────────────
    if (matchesFinal(round, 'losers')) {
      events.push({
        ...base,
        type: 'QUALIFIED_L',
        priority: 'MEDIUM',
        message: `✅ ${winnerHandle} → Top Cut (Losers) [Pool ${pool}]`,
      })
      continue
    }

    // ── UPSET ────────────────────────────────────────────────────────────────
    if (isUpset(winnerSeed, loserSeed)) {
      events.push({
        ...base,
        type: 'UPSET',
        priority: 'HIGH',
        message: `🔥 UPSET! #${winnerSeed} ${winnerHandle} def. #${loserSeed} ${loserHandle} ${score}`,
      })
      continue
    }

    // ── ELIMINATED (seed <= 32 の選手のみ) ───────────────────────────────────
    if (isLosersBracket(round)) {
      const notableSeed = loserSeed != null && loserSeed <= 32
      if (notableSeed) {
        events.push({
          ...base,
          type: 'ELIMINATED',
          priority: 'LOW',
          message: `❌ #${loserSeed} ${loserHandle} eliminated [Pool ${pool}]`,
        })
        continue
      }
    }

    // ── MARQUEE_RESULT (両者 seed <= 32) ─────────────────────────────────────
    if (p1seed != null && p1seed <= 32 && p2seed != null && p2seed <= 32) {
      events.push({
        ...base,
        type: 'MARQUEE_RESULT',
        priority: 'MEDIUM',
        message: `⚔️ #${p1seed} ${p1handle} vs #${p2seed} ${p2handle} → ${winnerHandle} wins ${score}`,
      })
    }
  }

  // 新しい順（completedAt 降順）
  return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100)
}

// ── Pool progress ─────────────────────────────────────────────────────────────

function buildPoolProgress(sets: any[]): PoolProgress[] {
  // phaseGroup ごとに completed/total を集計
  // total は同じプールの全セット数は取れないため、
  // このレスポンスに含まれるセット数から推定
  const map = new Map<string, { phase: string; completed: number; total: number }>()

  for (const set of sets) {
    const poolId = set.phaseGroup?.displayIdentifier || 'Unknown'
    const phase  = set.phaseGroup?.phase?.name || 'Unknown'
    const key    = `${phase}::${poolId}`

    const entry = map.get(key) ?? { phase, completed: 0, total: 0 }
    entry.total += 1
    if (set.state === 3) entry.completed += 1
    map.set(key, entry)
  }

  return Array.from(map.entries())
    .map(([key, v]) => {
      const [, poolId] = key.split('::')
      return {
        id:        poolId,
        phase:     v.phase,
        completed: v.completed,
        total:     v.total,
        percent:   v.total > 0 ? Math.round(v.completed / v.total * 100) : 0,
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

// ── Qualified players ─────────────────────────────────────────────────────────

function buildQualified(sets: any[]): QualifiedPlayer[] {
  const seen = new Set<string>()
  const result: QualifiedPlayer[] = []

  for (const set of sets) {
    if (set.state !== 3) continue

    const round = set.fullRoundText || ''
    const isWFinal = matchesFinal(round, 'winners')
    const isLFinal = matchesFinal(round, 'losers')
    if (!isWFinal && !isLFinal) continue

    const s0 = set.slots?.[0]
    const s1 = set.slots?.[1]
    if (!s0?.entrant || !s1?.entrant) continue

    const sv1 = s0.standing?.stats?.score?.value ?? -1
    const sv2 = s1.standing?.stats?.score?.value ?? -1
    const winnerSlot = sv1 > sv2 ? s0 : s1

    const name   = winnerSlot.entrant.name || ''
    const handle = extractHandle(name, winnerSlot.entrant.participants?.[0]?.gamerTag)
    const key    = `${isWFinal ? 'W' : 'L'}::${name}`
    if (seen.has(key)) continue
    seen.add(key)

    result.push({
      name,
      handle,
      seed:  winnerSlot.entrant.initialSeedNum ?? null,
      side:  isWFinal ? 'winners' : 'losers',
      pool:  set.phaseGroup?.displayIdentifier || '',
      phase: set.phaseGroup?.phase?.name || '',
    })
  }

  return result.sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999))
}

// ── Main fetch ────────────────────────────────────────────────────────────────

async function fetchPoolsData(eventId: number) {
  const token = process.env.STARTGG_API_TOKEN || process.env.STARTGG_TOKEN
  if (!token) throw new Error('STARTGG_API_TOKEN not set')

  // Page 1 のみ取得 (perPage=25, 最新25セット)
  // EVO規模でも速報目的なら page 1 で十分
  const res = await fetch(STARTGG_API, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: Q_POOLS_SETS,
      variables: { eventId, page: 1 },
    }),
    cache: 'no-store',
  })

  const text = await res.text()
  let data: any
  try { data = JSON.parse(text) } catch {
    throw new Error('Non-JSON from start.gg: ' + text.slice(0, 200))
  }
  if (data.errors) throw new Error('GQL: ' + (data.errors[0]?.message ?? JSON.stringify(data.errors)))

  const sets: any[] = data?.data?.event?.sets?.nodes ?? []

  // 現在フェーズ: 最新 completed セットの phase.name
  const latestCompleted = sets.find((s: any) => s.state === 3)
  const currentPhase = latestCompleted?.phaseGroup?.phase?.name ?? 'Unknown'

  // Pool ごとのセット数概算 (今回取得分から)
  // overall progress: フェーズ単位で集計
  const phaseProgress: Record<string, { completed: number; total: number }> = {}
  for (const set of sets) {
    const phase = set.phaseGroup?.phase?.name || 'Unknown'
    if (!phaseProgress[phase]) phaseProgress[phase] = { completed: 0, total: 0 }
    phaseProgress[phase].total += 1
    if (set.state === 3) phaseProgress[phase].completed += 1
  }

  const overallProgress: Record<string, { completed: number; total: number; percent: number }> = {}
  for (const [phase, v] of Object.entries(phaseProgress)) {
    overallProgress[phase] = {
      ...v,
      percent: v.total > 0 ? Math.round(v.completed / v.total * 100) : 0,
    }
  }

  return {
    currentPhase,
    overallProgress,
    feed:      buildFeedEvents(sets),
    qualified: buildQualified(sets),
    pools:     buildPoolProgress(sets),
    lastUpdated: new Date().toISOString(),
    setsAnalyzed: sets.length,
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

// シンプルなメモリキャッシュ (15秒)
const cache = new Map<number, { data: any; ts: number }>()
const CACHE_TTL = 15 * 1000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = parseInt(searchParams.get('eventId') || '0')
  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
  }

  const now = Date.now()
  const cached = cache.get(eventId)
  if (cached && (now - cached.ts) < CACHE_TTL) {
    return NextResponse.json({ ...cached.data, cached: true })
  }

  try {
    const data = await fetchPoolsData(eventId)
    cache.set(eventId, { data, ts: now })
    return NextResponse.json({ ...data, cached: false })
  } catch (error: any) {
    console.error('[pools-dashboard]', error.message)
    const stale = cache.get(eventId)
    if (stale) return NextResponse.json({ ...stale.data, cached: true, error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
