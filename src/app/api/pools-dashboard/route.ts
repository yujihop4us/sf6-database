import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// ── Supabase ──────────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key)
}

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

// DB row shape (only the columns we actually need)
interface SetRow {
  id: number
  round_text: string
  display_score: string | null
  winner_id: number | null
  loser_id: number | null
  winner_score: number | null
  loser_score: number | null
  winner_character: string | null
  loser_character: string | null
  created_at: string
}

// ── Round ranking ─────────────────────────────────────────────────────────────
// Higher number = deeper in the bracket (later round = closer to qualifying)

function roundRank(rt: string): number {
  const t = rt.toLowerCase()
  const base = t.startsWith('winners') ? 1000 : 0
  // Grand Final
  if (t.includes('grand final')) return base + 700
  // Final (not semi/quarter)
  if (/\bfinals?\b/.test(t) && !t.includes('semi') && !t.includes('quarter')) return base + 600
  // Semi-Final
  if (t.includes('semi')) return base + 500
  // Quarter-Final
  if (t.includes('quarter')) return base + 400
  // Numbered Round
  const m = t.match(/round\s+(\d+)/)
  if (m) return base + parseInt(m[1]) * 10
  return base
}

function isWinnersBracket(rt: string): boolean {
  return rt.toLowerCase().startsWith('winners')
}

function isLosersBracket(rt: string): boolean {
  return rt.toLowerCase().startsWith('losers')
}

// ── Handle extraction from display_score ──────────────────────────────────────
// display_score format: "CLE | Greil 2 - Green Hayato 0"
// extracts "Greil" and "Green Hayato" style names; prefer DB player handle

function parseDisplayScore(
  score: string | null,
  winnerScore: number | null,
  loserScore: number | null,
): { p1name: string; p2name: string; scoreStr: string } {
  const scoreStr =
    winnerScore != null && loserScore != null
      ? `${winnerScore}-${loserScore}`
      : score ?? ''

  if (!score) return { p1name: 'P1', p2name: 'P2', scoreStr }

  // "CLE | Greil 2 - Green Hayato 0"  →  split on " N - " to get names
  // More reliably: split on score numbers
  // Pattern: <name> <digits> - <name> <digits>
  const m = score.match(/^(.+?)\s+\d+\s*-\s*(.+?)\s+\d+$/)
  if (m) return { p1name: m[1].trim(), p2name: m[2].trim(), scoreStr }

  const parts = score.split(' - ')
  if (parts.length >= 2) {
    return { p1name: parts[0].trim(), p2name: parts[1].trim(), scoreStr }
  }
  return { p1name: 'P1', p2name: 'P2', scoreStr }
}

// strip team prefix: "CLE | Greil" → "Greil"
function cleanHandle(raw: string): string {
  if (raw.includes(' | ')) return raw.split(' | ').slice(1).join(' | ').trim()
  return raw.trim()
}

// ── Main data builder ─────────────────────────────────────────────────────────

async function fetchPoolsData(tournamentId: number) {
  const supabase = getSupabase()

  // 1. Fetch ALL completed sets (winner_id IS NOT NULL)
  // Supabase default limit is 1000 — use range to get all
  let allSets: SetRow[] = []
  let from = 0
  const batchSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('tournament_sets')
      .select(
        'id, round_text, display_score, winner_id, loser_id, winner_score, loser_score, winner_character, loser_character, created_at',
      )
      .eq('tournament_id', tournamentId)
      .not('winner_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1)

    if (error) throw new Error('Supabase error: ' + error.message)
    if (!data || data.length === 0) break

    allSets = allSets.concat(data as SetRow[])
    if (data.length < batchSize) break
    from += batchSize
  }

  // 2. Fetch total set count (completed + in-progress) for progress %
  const { count: totalCount } = await supabase
    .from('tournament_sets')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  // 3. Collect unique player IDs and resolve handles
  const playerIds = new Set<number>()
  for (const s of allSets) {
    if (s.winner_id) playerIds.add(s.winner_id)
    if (s.loser_id) playerIds.add(s.loser_id)
  }

  const handleMap = new Map<number, string>()
  if (playerIds.size > 0) {
    const ids = Array.from(playerIds)
    // Batch in groups of 500 (PostgREST URL length limit)
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500)
      const { data: players } = await supabase
        .from('players')
        .select('id, handle')
        .in('id', batch)
      if (players) {
        for (const p of players) {
          handleMap.set(p.id, p.handle ?? String(p.id))
        }
      }
    }
  }

  // 4. Determine the "qualifying" round for each bracket side
  // The deepest (highest-ranked) round = qualifying final
  const winnerRoundRanks = new Map<string, number>()
  const loserRoundRanks  = new Map<string, number>()

  for (const s of allSets) {
    const rt = s.round_text
    const rank = roundRank(rt)
    if (isWinnersBracket(rt)) {
      const cur = winnerRoundRanks.get(rt) ?? rank
      winnerRoundRanks.set(rt, Math.max(cur, rank))
    } else if (isLosersBracket(rt)) {
      const cur = loserRoundRanks.get(rt) ?? rank
      loserRoundRanks.set(rt, Math.max(cur, rank))
    }
  }

  const topWinnersRound = winnerRoundRanks.size > 0
    ? [...winnerRoundRanks.entries()].reduce((a, b) => (a[1] > b[1] ? a : b))[0]
    : null

  const topLosersRound = loserRoundRanks.size > 0
    ? [...loserRoundRanks.entries()].reduce((a, b) => (a[1] > b[1] ? a : b))[0]
    : null

  // 5. Build feed events, qualified list
  const feedEvents: FeedEvent[] = []
  const qualified: QualifiedPlayer[] = []
  const qualifiedSet = new Set<string>()  // deduplicate by "side::playerId"

  for (const s of allSets) {
    const rt          = s.round_text
    const winnerId    = s.winner_id!
    const loserId     = s.loser_id!
    const winnerHandle = handleMap.get(winnerId) ?? String(winnerId)
    const loserHandle  = handleMap.get(loserId) ?? String(loserId)
    const wScore      = s.winner_score ?? 0
    const lScore      = s.loser_score ?? 0
    const scoreStr    = `${wScore}-${lScore}`
    const ts          = Math.floor(new Date(s.created_at).getTime() / 1000)

    const base = {
      pool:      '',
      phase:     'Pools',
      round:     rt,
      timestamp: ts,
      score:     scoreStr,
      players: [
        { name: winnerHandle, handle: winnerHandle, seed: null },
        { name: loserHandle,  handle: loserHandle,  seed: null },
      ],
    }

    // ── QUALIFIED_W ──────────────────────────────────────────────────────────
    if (topWinnersRound && rt === topWinnersRound) {
      const key = `W::${winnerId}`
      if (!qualifiedSet.has(key)) {
        qualifiedSet.add(key)
        qualified.push({
          name:   winnerHandle,
          handle: winnerHandle,
          seed:   null,
          side:   'winners',
          pool:   '',
          phase:  'Pools',
        })
      }
      feedEvents.push({
        ...base,
        type:     'QUALIFIED_W',
        priority: 'HIGH',
        message:  `✅ ${winnerHandle} → Top Cut (Winners)`,
      })
      continue
    }

    // ── QUALIFIED_L ──────────────────────────────────────────────────────────
    if (topLosersRound && rt === topLosersRound) {
      const key = `L::${winnerId}`
      if (!qualifiedSet.has(key)) {
        qualifiedSet.add(key)
        qualified.push({
          name:   winnerHandle,
          handle: winnerHandle,
          seed:   null,
          side:   'losers',
          pool:   '',
          phase:  'Pools',
        })
      }
      // Loser of the LB final = ELIMINATED
      feedEvents.push({
        ...base,
        type:     'QUALIFIED_L',
        priority: 'MEDIUM',
        message:  `✅ ${winnerHandle} → Top Cut (Losers)`,
      })
      continue
    }

    // ── ELIMINATED (lost in any Losers match) ────────────────────────────────
    if (isLosersBracket(rt)) {
      feedEvents.push({
        ...base,
        type:     'ELIMINATED',
        priority: 'LOW',
        message:  `❌ ${loserHandle} eliminated in ${rt}`,
      })
      continue
    }

    // ── RESULT (won in Winners bracket non-final) ─────────────────────────────
    // Only add for semi-final/quarter-final (notable rounds)
    if (isWinnersBracket(rt) && roundRank(rt) >= 1400) {
      feedEvents.push({
        ...base,
        type:     'MARQUEE_RESULT',
        priority: 'MEDIUM',
        message:  `⚔️ ${winnerHandle} def. ${loserHandle} ${scoreStr} in ${rt}`,
      })
    }
  }

  // Sort feed by timestamp desc (created_at はバッチ挿入時刻なので同秒内は round_text でセカンダリソート)
  feedEvents.sort((a, b) => {
    if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp
    // 同一秒内: QUALIFIED > MARQUEE > ELIMINATED の優先度で見せる
    const typePrio: Record<string, number> = { QUALIFIED_W: 3, QUALIFIED_L: 3, MARQUEE_RESULT: 2, UPSET: 2, ELIMINATED: 1 }
    return (typePrio[b.type] ?? 0) - (typePrio[a.type] ?? 0)
  })
  const feed = feedEvents.slice(0, 150)

  // Sort qualified: winners first, then losers
  qualified.sort((a, b) => {
    if (a.side !== b.side) return a.side === 'winners' ? -1 : 1
    return a.handle.localeCompare(b.handle)
  })

  // 6. Pool progress (single "Pools" phase since phase_name is null)
  const completed = allSets.length
  const total     = totalCount ?? completed
  const percent   = total > 0 ? Math.round(completed / total * 100) : 0

  const pools: PoolProgress[] = [
    { id: 'Pools', phase: 'Pools', completed, total, percent },
  ]

  const overallProgress: Record<string, { completed: number; total: number; percent: number }> = {
    Pools: { completed, total, percent },
  }

  // 7. Current phase = the most recent round_text
  const currentPhase = allSets.length > 0 ? allSets[0].round_text : 'Unknown'

  const newestEventTs = feed.length > 0 ? feed[0].timestamp : null

  return {
    currentPhase,
    overallProgress,
    feed,
    qualified,
    pools,
    lastUpdated:     new Date().toISOString(),
    setsAnalyzed:    allSets.length,
    topWinnersRound,
    topLosersRound,
    newestEventTs,   // 最新イベントの UNIX タイム (クライアント side での変更検知用)
  }
}

// ── Memory cache (15 seconds) ─────────────────────────────────────────────────

const cache = new Map<number, { data: any; ts: number }>()
const CACHE_TTL = 15 * 1000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tournamentId = parseInt(searchParams.get('tournamentId') || '0')
  if (!tournamentId) {
    return NextResponse.json(
      { error: 'tournamentId is required (e.g. ?tournamentId=48)' },
      { status: 400 },
    )
  }

  const now    = Date.now()
  const cached = cache.get(tournamentId)
  if (cached && now - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ...cached.data, cached: true })
  }

  try {
    const data = await fetchPoolsData(tournamentId)
    cache.set(tournamentId, { data, ts: now })
    return NextResponse.json({ ...data, cached: false })
  } catch (error: any) {
    console.error('[pools-dashboard]', error.message)
    const stale = cache.get(tournamentId)
    if (stale) return NextResponse.json({ ...stale.data, cached: true, staleError: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
