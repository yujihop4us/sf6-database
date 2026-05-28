import { createClient } from '@supabase/supabase-js'
import { TournamentClient } from './TournamentClient'
import type { TournamentData } from './types'

// ISR: 60 秒ごとに再生成（大会中にリアルタイムでデータが追加されても反映される）
export const revalidate = 60

type PlayerRow = {
  id: number
  handle: string
  country_code: string | null
  main_character: string | null
  team: string | null
  profile_image_url: string | null
}

// start.gg の実際の参加者数・試合数（DB の追跡数とは別）
const TOURNAMENT_REAL_STATS: Record<number, { numEntrants: number; totalSets: number }> = {
  40: { numEntrants: 7683, totalSets: 15364 },  // EVO Japan 2026
  34: { numEntrants: 4026, totalSets: 8049  },  // EVO Japan 2025
}

async function fetchTournamentData(id: string): Promise<TournamentData | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const numericId = parseInt(id, 10)
  if (isNaN(numericId)) return null

  // Tournament info
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, name, start_date, end_date, location, total_prize_usd, is_online, format, region')
    .eq('id', numericId)
    .single()

  if (tErr || !tournament) return null

  // Entrants with player info
  const { data: entrantsRaw } = await supabase
    .from('tournament_entrants')
    .select('id, placement, seed, prize_amount, players(id, handle, country_code, main_character, team, profile_image_url)')
    .eq('tournament_id', numericId)
    .order('placement', { nullsFirst: false })
    .limit(2000)

  // Sets with basic fields — join player data separately
  const { data: setsRaw } = await supabase
    .from('tournament_sets')
    .select('id, round_text, phase_name, pool_identifier, display_score, winner_score, loser_score, winner_id, loser_id, winner_character, loser_character')
    .eq('tournament_id', numericId)
    .order('id', { ascending: false })
    .limit(2000)

  // Collect all player IDs from sets and fetch them
  const setList = (setsRaw ?? []) as {
    id: number; round_text: string | null; phase_name: string | null; pool_identifier: string | null
    display_score: string | null; winner_score: number | null; loser_score: number | null
    winner_id: number | null; loser_id: number | null
    winner_character: string | null; loser_character: string | null
  }[]

  const playerIds = [...new Set([
    ...setList.map(s => s.winner_id).filter((x): x is number => x !== null),
    ...setList.map(s => s.loser_id).filter((x): x is number => x !== null),
  ])]

  const playerMap = new Map<number, PlayerRow>()
  if (playerIds.length > 0) {
    const { data: players } = await supabase
      .from('players')
      .select('id, handle, country_code, main_character, team, profile_image_url')
      .in('id', playerIds)
    for (const p of (players ?? []) as PlayerRow[]) {
      playerMap.set(p.id, p)
    }
  }

  // Compute W/L per player (all sets)
  const winsMap: Record<number, number> = {}
  const lossesMap: Record<number, number> = {}
  for (const s of setList) {
    if (s.winner_id) winsMap[s.winner_id] = (winsMap[s.winner_id] ?? 0) + 1
    if (s.loser_id)  lossesMap[s.loser_id] = (lossesMap[s.loser_id] ?? 0) + 1
  }

  // Compute used characters per player from set data (frequency-sorted)
  const charFreqMap: Record<number, Record<string, number>> = {}
  for (const s of setList) {
    if (s.winner_id && s.winner_character) {
      charFreqMap[s.winner_id] ??= {}
      charFreqMap[s.winner_id][s.winner_character] = (charFreqMap[s.winner_id][s.winner_character] ?? 0) + 1
    }
    if (s.loser_id && s.loser_character) {
      charFreqMap[s.loser_id] ??= {}
      charFreqMap[s.loser_id][s.loser_character] = (charFreqMap[s.loser_id][s.loser_character] ?? 0) + 1
    }
  }
  const usedCharsMap: Record<number, string> = {}
  for (const [pid, freq] of Object.entries(charFreqMap)) {
    usedCharsMap[Number(pid)] = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c)
      .join('/')
  }

  // ── Infer placement from sets when DB placement is null ──────────
  // Strategy for double-elimination brackets:
  //   1st = Grand Final winner
  //   2nd = Grand Final loser
  //   3rd+ = losers bracket, ranked by when the set occurred
  //
  // Ranking approach:
  //   - "Losers Final" and "Losers Semi-Final" are unique rounds (fixed).
  //     They rank above all numbered / quarter-final rounds.
  //   - All other losers rounds (Losers Quarter-Final, Losers Round N) are
  //     grouped by (round_text, cluster).  A cluster = sets of the same
  //     round_text whose IDs are within CLUSTER_GAP of each other.
  //   - Groups are sorted by their maximum set ID descending.
  //     Later sets (higher ID) = deeper in the bracket = better placement.
  //   - Players eliminated in the same cluster share the same placement (tie).
  //
  // This handles multi-phase formats (e.g. pools → Top 8) where the same
  // round_text string appears in multiple bracket phases, because each phase
  // produces a distinct cluster of set IDs.
  function inferPlacements(
    sets: typeof setList,
    entrantPlayerIds: number[],
  ): Map<number, number> {
    if (sets.length === 0) return new Map()

    // Helpers ─────────────────────────────────────────────────────────────
    function isLosersRound(rt: string | null): boolean {
      return /losers/i.test(rt ?? '')
    }
    function isGFRound(rt: string | null): boolean {
      return /grand final/i.test(rt ?? '')
    }
    // Returns a depth value for losers rounds.
    // Losers Final=100, Losers Semi-Final=90, Losers Quarter-Final=80,
    // Losers Round N = 60+N.  Returns null for non-losers rounds.
    function namedDepth(rt: string | null): number | null {
      if (/losers final$/i.test(rt ?? ''))          return 100
      if (/losers semi.?final/i.test(rt ?? ''))     return 90
      if (/losers quarter.?final/i.test(rt ?? ''))  return 80
      const m = (rt ?? '').match(/losers round (\d+)/i)
      if (m) return 60 + parseInt(m[1], 10)
      return null
    }
    // "Fixed" named rounds appear exactly once in the final bracket
    // (Losers Final, Losers Semi-Final).  They don't need clustering.
    function isFixedNamedRound(rt: string | null): boolean {
      return /losers final$/i.test(rt ?? '') ||
             /losers semi.?final/i.test(rt ?? '')
    }

    // Sort all completed sets by ID (ascending = chronological)
    const sorted = [...sets]
      .filter(s => s.winner_id !== null || s.loser_id !== null)
      .sort((a, b) => a.id - b.id)

    // ── 1st & 2nd: Grand Final ──────────────────────────────────────
    const gfSets = sorted.filter(s => isGFRound(s.round_text))
    // Prefer Grand Final Reset (played after main GF) when it has a winner.
    const gfReset = [...gfSets].reverse().find(
      s => /reset/i.test(s.round_text ?? '') && s.winner_id !== null,
    )
    const gfMain = [...gfSets].reverse().find(
      s => !/reset/i.test(s.round_text ?? '') && s.winner_id !== null,
    )
    const gfFinal  = gfReset ?? gfMain
    const gfWinner = gfFinal?.winner_id ?? null
    const gfLoser  = gfFinal?.loser_id  ?? null

    const placementMap = new Map<number, number>()
    if (gfWinner) placementMap.set(gfWinner, 1)
    if (gfLoser)  placementMap.set(gfLoser,  2)

    // ── 3rd+: losers bracket ────────────────────────────────────────
    // Step 1: For each player, find their FINAL losers-side loss.
    //   Priority: deeper named round beats shallower; named beats numbered;
    //   among numbered rounds, later set ID wins.
    const finalLossRound: Record<number, string | null> = {}  // round_text
    const finalLossSetId: Record<number, number>        = {}  // set ID

    for (const s of sorted) {
      if (!isLosersRound(s.round_text) || s.loser_id === null) continue
      const pid      = s.loser_id
      const depth    = namedDepth(s.round_text)
      const prevDepth = namedDepth(finalLossRound[pid] ?? null)

      if (prevDepth === null && depth !== null) {
        // Named beats unnamed
        finalLossRound[pid] = s.round_text
        finalLossSetId[pid] = s.id
      } else if (prevDepth !== null && depth !== null) {
        // Both named: take deeper
        if (depth > prevDepth) {
          finalLossRound[pid] = s.round_text
          finalLossSetId[pid] = s.id
        }
      } else if (prevDepth === null && depth === null) {
        // Both numbered: take higher set ID
        if (s.id > (finalLossSetId[pid] ?? -1)) {
          finalLossRound[pid] = s.round_text
          finalLossSetId[pid] = s.id
        }
      }
      // Named prevDepth + unnamed current → skip (named is always better)
    }

    // Step 2: Build clusters for non-fixed losers rounds.
    //   A cluster = consecutive set IDs (gap ≤ CLUSTER_GAP) with the same
    //   round_text.  Each cluster represents one "wave" of that round in a
    //   phase.  We store sorted IDs per round_text to detect clusters.
    const CLUSTER_GAP = 20
    const roundIdMap = new Map<string, number[]>()
    for (const s of sorted) {
      const rt = s.round_text ?? ''
      if (!isLosersRound(rt) || isFixedNamedRound(rt)) continue
      if (!roundIdMap.has(rt)) roundIdMap.set(rt, [])
      roundIdMap.get(rt)!.push(s.id)
    }

    // Given a round_text and a setId, return the max setId in the same cluster.
    function getClusterMaxId(rt: string, setId: number): number {
      const ids = roundIdMap.get(rt) ?? [setId]
      let clusterStart = 0
      for (let i = 1; i <= ids.length; i++) {
        const atEnd = i === ids.length || ids[i] - ids[i - 1] > CLUSTER_GAP
        if (atEnd) {
          if (ids[clusterStart] <= setId && setId <= ids[i - 1]) return ids[i - 1]
          clusterStart = i
        }
      }
      return setId
    }

    // Also need cluster min for grouping players into the same tie group.
    function getClusterMinId(rt: string, setId: number): number {
      const ids = roundIdMap.get(rt) ?? [setId]
      let clusterStart = 0
      for (let i = 1; i <= ids.length; i++) {
        const atEnd = i === ids.length || ids[i] - ids[i - 1] > CLUSTER_GAP
        if (atEnd) {
          if (ids[clusterStart] <= setId && setId <= ids[i - 1]) return ids[clusterStart]
          clusterStart = i
        }
      }
      return setId
    }

    // Step 3: Assign a group key and a sort score to each player.
    //   Group key = (round_text, cluster_min)  → same key = same placement (tie).
    //   Sort score = cluster max setId for non-fixed rounds,
    //                depth × 10_000_000 for fixed named rounds (LF/LSF) so they
    //                always rank above any numbered/QF round.
    const playerGroupKey:   Record<number, string> = {}
    const groupSortScore:   Record<string, number> = {}

    for (const pid of Object.keys(finalLossRound).map(Number)) {
      if (placementMap.has(pid)) continue
      const rt  = finalLossRound[pid] ?? ''
      const sid = finalLossSetId[pid] ?? 0

      let gk: string
      let score: number

      if (isFixedNamedRound(rt)) {
        // Losers Final or Losers Semi-Final: unique across the bracket
        const d = namedDepth(rt) ?? 0
        gk    = `fixed:${d}`
        score = d * 10_000_000  // e.g. LF → 1 000 000 000, LSF → 900 000 000
      } else {
        // LQF or Losers Round N: cluster by proximity
        const clMin = getClusterMinId(rt, sid)
        const clMax = getClusterMaxId(rt, sid)
        gk    = `${rt}:${clMin}`
        score = clMax
      }

      playerGroupKey[pid] = gk
      if (groupSortScore[gk] === undefined || score > groupSortScore[gk]) {
        groupSortScore[gk] = score
      }
    }

    // Step 4: Build groups and sort by sort score descending.
    const groups = new Map<string, number[]>()
    for (const pid of Object.keys(finalLossRound).map(Number)) {
      if (placementMap.has(pid)) continue
      const gk = playerGroupKey[pid]
      if (!groups.has(gk)) groups.set(gk, [])
      groups.get(gk)!.push(pid)
    }

    const sortedGroupKeys = [...groups.keys()]
      .sort((a, b) => groupSortScore[b] - groupSortScore[a])

    let rank = 3
    for (const gk of sortedGroupKeys) {
      const group = groups.get(gk)!
      for (const pid of group) placementMap.set(pid, rank)
      rank += group.length
    }

    // Fill remaining entrants (those with no losers sets recorded)
    for (const pid of entrantPlayerIds) {
      if (!placementMap.has(pid)) placementMap.set(pid, rank++)
    }

    return placementMap
  }

  // ── Infer round labels when all sets in a phase share the same generic label ──
  // Detects: Grand Final, Semi-Final, Quarter-Final by bracket position
  function inferRoundLabel(
    setId: number,
    phaseSetsSorted: typeof setList, // sorted by id ASC
    phaseName: string,
  ): { label: string | null; isGrandFinal: boolean } {
    const n = phaseSetsSorted.length
    if (n === 0) return { label: null, isGrandFinal: false }

    const idx = phaseSetsSorted.findIndex(s => s.id === setId)
    if (idx < 0) return { label: null, isGrandFinal: false }

    // Classify phase type to determine label prefix
    const phLower = phaseName.toLowerCase()
    const isGroupPhase = /\bgroup\b/.test(phLower) || /\bgroups\b/.test(phLower)
    const isPoolPhase  = /\bpool\b/.test(phLower)  || /\bpools\b/.test(phLower)

    // Build prefix: group phases use phaseName (e.g. "Group A"), pool phases use "Pool"
    // Top-level playoff phases use no prefix (グランドファイナル etc.)
    const prefix = isGroupPhase ? phaseName
                 : isPoolPhase  ? 'Pool'
                 : null

    const distFromEnd = n - 1 - idx

    if (distFromEnd === 0) {
      if (prefix) return { label: `${prefix} ファイナル`, isGrandFinal: false }
      return { label: 'グランドファイナル', isGrandFinal: true }
    }
    if (distFromEnd === 1) return { label: prefix ? `${prefix} セミファイナル` : 'ファイナル', isGrandFinal: false }
    if (distFromEnd <= 3) return { label: prefix ? `${prefix} クォーターファイナル` : 'セミファイナル', isGrandFinal: false }
    if (distFromEnd <= 7) return { label: null, isGrandFinal: false }
    return { label: null, isGrandFinal: false }
  }

  // Group sets by phase (ASC by id = chronological)
  const phaseSetMap = new Map<string, typeof setList>()
  for (const s of [...setList].sort((a, b) => a.id - b.id)) {
    const ph = s.phase_name ?? ''
    if (!phaseSetMap.has(ph)) phaseSetMap.set(ph, [])
    phaseSetMap.get(ph)!.push(s)
  }

  // Detect which phases have a single generic label (all round_text === phase_name)
  const genericPhases = new Set<string>()
  for (const [ph, psets] of phaseSetMap) {
    if (psets.length > 1 && psets.every(s => s.round_text === s.phase_name || s.round_text === ph)) {
      genericPhases.add(ph)
    }
  }

  const entrantPlayerIds = (entrantsRaw ?? []).map((e: { players: unknown }) => {
    const p = e.players as PlayerRow | null
    return p?.id ?? 0
  }).filter(id => id !== 0)

  const allPlacementsNull = (entrantsRaw ?? []).every((e: { placement: number | null }) => e.placement === null)
  const inferredPlacementMap = allPlacementsNull
    ? inferPlacements(setList, entrantPlayerIds)
    : new Map<number, number>()

  const entrants = (entrantsRaw ?? []).map((e: {
    id: number; placement: number | null; seed: number | null; prize_amount: number | null
    players: unknown
  }) => {
    const p = e.players as PlayerRow | null
    return {
      entrantId:         e.id,
      placement:         e.placement,
      inferredPlacement: p ? (inferredPlacementMap.get(p.id) ?? null) : null,
      seed:              e.seed,
      prizeAmount:       e.prize_amount,
      player: p ? {
        id:          p.id,
        handle:      p.handle,
        countryCode:      p.country_code,
        character:        p.main_character,
        usedCharacters:   usedCharsMap[p.id] ?? null,
        team:             p.team,
        imageUrl:         p.profile_image_url,
        wins:             winsMap[p.id] ?? 0,
        losses:           lossesMap[p.id] ?? 0,
      } : null,
    }
  }).filter(e => e.player && !e.player.handle.startsWith('Bye'))

  const sets = [...setList]
    // 両プレイヤー未確定のプレースホルダーセットを除外
    .filter(s => s.winner_id !== null || s.loser_id !== null)
    .sort((a, b) => b.id - a.id).map(s => {
    const w = s.winner_id ? playerMap.get(s.winner_id) ?? null : null
    const l = s.loser_id  ? playerMap.get(s.loser_id)  ?? null : null
    const ph = s.phase_name ?? ''
    const phaseSorted = phaseSetMap.get(ph) ?? []
    const { label: inferredLabel, isGrandFinal } = genericPhases.has(ph)
      ? inferRoundLabel(s.id, phaseSorted, ph)
      : { label: null, isGrandFinal: false }

    return {
      id:                 s.id,
      roundText:          s.round_text    ?? '',
      phase:              s.phase_name    ?? '',
      poolIdentifier:     s.pool_identifier ?? null,
      displayScore:       s.display_score ?? '',
      winnerScore:        s.winner_score  ?? 0,
      loserScore:         s.loser_score   ?? 0,
      winnerId:           s.winner_id,
      loserId:            s.loser_id,
      winnerHandle:       w?.handle           ?? '?',
      winnerCountry:      w?.country_code     ?? null,
      winnerCharacter:    s.winner_character ?? w?.main_character ?? null,
      loserHandle:        l?.handle           ?? '?',
      loserCountry:       l?.country_code     ?? null,
      loserCharacter:     s.loser_character  ?? l?.main_character ?? null,
      inferredRoundLabel: inferredLabel,
      isGrandFinal,
    }
  })

  return {
    tournament: {
      id:        tournament.id,
      name:      tournament.name,
      startDate: tournament.start_date,
      endDate:   tournament.end_date,
      location:  tournament.location ?? '',
      prizeUsd:  tournament.total_prize_usd,
      isOnline:  tournament.is_online ?? false,
      format:    tournament.format ?? null,
      region:    tournament.region ?? null,
      numEntrantsOverride: TOURNAMENT_REAL_STATS[numericId]?.numEntrants,
      totalSetsOverride:   TOURNAMENT_REAL_STATS[numericId]?.totalSets,
    },
    entrants,
    sets,
    totalMatches: sets.length,
  }
}

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await fetchTournamentData(id)
  return <TournamentClient data={data} />
}
