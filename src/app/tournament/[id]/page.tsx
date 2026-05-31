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
  48: { numEntrants: 1452, totalSets: 1361  },  // Combo Breaker 2026
}

// 大会メタデータ（DB migration 適用前のフォールバック兼ソース）
// Migration: supabase/migrations/20260528_tournament_meta.sql
const TOURNAMENT_META: Record<number, {
  logoUrl: string | null
  cptEventType: string | null
  finalPoolIdentifier: string | null
  top24PoolIdentifier: string | null
  ewcQualifyingSpots?: number | null
}> = {
  48: {
    logoUrl:              '/images/tournaments/cb2026.jpg',  // ローカルキャッシュ
    cptEventType:         'premier',
    finalPoolIdentifier:  'VVX15',
    top24PoolIdentifier:  'PX133',
    ewcQualifyingSpots:   2,  // XiaoHai（1位）・Hinao（2位）
  },
}

async function fetchTournamentData(id: string): Promise<TournamentData | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const numericId = parseInt(id, 10)
  if (isNaN(numericId)) return null

  // Tournament info (stable columns)
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, name, start_date, end_date, location, total_prize_usd, is_online, format, region')
    .eq('id', numericId)
    .single()

  if (tErr || !tournament) return null

  // Extended meta columns (added by 20260528_tournament_meta.sql migration)
  // Falls back to compile-time constants if migration not yet applied
  const { data: tMeta, error: tMetaErr } = await supabase
    .from('tournaments')
    .select('logo_url, cpt_event_type, final_pool_identifier, top24_pool_identifier, ewc_qualifying_spots')
    .eq('id', numericId)
    .single()
  const meta    = (!tMetaErr && tMeta) ? tMeta : null
  const metaFb  = TOURNAMENT_META[numericId] ?? null

  // Entrants with player info — ページネーションで全件取得
  // Supabase Anon キーはデフォルト1000行制限があるため、1000行ずつ取得してマージ
  // CB2026は1448エントランス、EvoJP2025は7037エントランスなど大規模大会に対応
  type EntrantRaw = {
    id: number; placement: number | null; seed: number | null; prize_amount: number | null
    players: unknown
  }
  const PAGE_SIZE = 1000
  let entrantsRaw: EntrantRaw[] = []
  {
    let from = 0
    while (true) {
      const { data: page } = await supabase
        .from('tournament_entrants')
        .select('id, placement, seed, prize_amount, players(id, handle, country_code, main_character, team, profile_image_url)')
        .eq('tournament_id', numericId)
        .order('placement', { nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1)
      if (!page?.length) break
      entrantsRaw = entrantsRaw.concat(page as EntrantRaw[])
      if (page.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  // Sets with basic fields — join player data separately
  // inferPlacements (Path A) には top-phase の GF セットが必要。
  // id DESC で取得し上位2000件に加え、pool_identifier あり上位を優先取得。
  // CB2026(4391セット)でも VVX15 GF(id~26576)はcutoff(23444)より大きいので含まれる。
  const { data: setsRaw } = await supabase
    .from('tournament_sets')
    .select('id, round_text, phase_name, pool_identifier, display_score, winner_score, loser_score, winner_id, loser_id, winner_character, loser_character')
    .eq('tournament_id', numericId)
    .order('id', { ascending: false })
    .range(0, 2999)

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
  //   1st = Grand Final winner, 2nd = Grand Final loser
  //   3rd+ = assigned by losers-bracket round depth (deepest = best)
  //
  // When pool_identifier is available (post 2026 imports), phases are identified
  // precisely by pool_identifier (e.g. VVX15 = Top 8, PX133 = Top 24).
  // This avoids the re-imported-high-ID problem that broke the old cluster logic.
  //
  // Falls back to original cluster-based logic for older tournaments without
  // pool_identifier data.
  function inferPlacements(
    sets: typeof setList,
    entrantPlayerIds: number[],
  ): Map<number, number> {
    if (sets.length === 0) return new Map()

    // Shared helper: named depth for losers-bracket rounds.
    // Losers Final=100, Losers Semi-Final=90, Losers Quarter-Final=80,
    // Losers Round N = 60+N.  Returns null for non-losers / non-named rounds.
    function namedDepth(rt: string | null): number | null {
      if (/losers final$/i.test(rt ?? ''))          return 100
      if (/losers semi.?final/i.test(rt ?? ''))     return 90
      if (/losers quarter.?final/i.test(rt ?? ''))  return 80
      const m = (rt ?? '').match(/losers round (\d+)/i)
      if (m) return 60 + parseInt(m[1], 10)
      return null
    }

    const placementMap = new Map<number, number>()
    const completed = [...sets]
      .filter(s => s.winner_id !== null || s.loser_id !== null)
      .sort((a, b) => a.id - b.id)

    // ── 1st & 2nd: Grand Final ──────────────────────────────────────
    const gfAll = completed.filter(s => /grand final/i.test(s.round_text ?? ''))
    const gfFinal =
      [...gfAll].reverse().find(s => /reset/i.test(s.round_text ?? '') && s.winner_id !== null) ??
      [...gfAll].reverse().find(s => !/reset/i.test(s.round_text ?? '') && s.winner_id !== null)
    if (!gfFinal) return placementMap
    if (gfFinal.winner_id) placementMap.set(gfFinal.winner_id, 1)
    if (gfFinal.loser_id)  placementMap.set(gfFinal.loser_id,  2)

    // ════════════════════════════════════════════════════════════════
    // PATH A: pool_identifier available → precise phase detection
    // ════════════════════════════════════════════════════════════════
    const top8PoolId = gfFinal.pool_identifier
    if (top8PoolId !== null) {
      const top8Sets  = completed.filter(s => s.pool_identifier === top8PoolId)
      const top8MinId = top8Sets.length > 0 ? Math.min(...top8Sets.map(s => s.id)) : Infinity

      // Find penultimate phase (Top 24): small pool with highest maxId,
      // excluding re-imported sets with id ≥ top8MinId.
      const poolStats = new Map<string, { maxId: number; count: number }>()
      for (const s of completed) {
        if (!s.pool_identifier || s.pool_identifier === top8PoolId || s.id >= top8MinId) continue
        const st = poolStats.get(s.pool_identifier)
        if (!st) poolStats.set(s.pool_identifier, { maxId: s.id, count: 1 })
        else { st.maxId = Math.max(st.maxId, s.id); st.count++ }
      }
      const threshold   = Math.max(top8Sets.length * 3, 25)
      const top24Entry  = [...poolStats.entries()]
        .filter(([, st]) => st.count <= threshold)
        .sort((a, b) => b[1].maxId - a[1].maxId)[0]
      const top24PoolId = top24Entry?.[0] ?? null
      const top24Sets   = top24PoolId ? completed.filter(s => s.pool_identifier === top24PoolId) : []

      // Assign placements from losers-bracket rounds of a phase.
      // Rounds sorted deepest-first → deepest losers are best-placed.
      function assignLosers(phaseSets: typeof setList, startRank: number): number {
        const byRound = new Map<string, Set<number>>()
        for (const s of phaseSets) {
          if (!s.loser_id || placementMap.has(s.loser_id)) continue
          if (!/losers/i.test(s.round_text ?? '')) continue  // winners-bracket: not eliminated
          const rt = s.round_text ?? ''
          if (!byRound.has(rt)) byRound.set(rt, new Set())
          byRound.get(rt)!.add(s.loser_id)
        }
        const sortedRounds = [...byRound.entries()]
          .sort((a, b) => (namedDepth(b[0]) ?? 0) - (namedDepth(a[0]) ?? 0))
        let rank = startRank
        for (const [, players] of sortedRounds) {
          for (const pid of players) {
            if (!placementMap.has(pid)) placementMap.set(pid, rank)
          }
          rank += players.size
        }
        return rank
      }

      // Top 8 → 3rd–8th; Top 24 → 9th–24th
      let nextRank = assignLosers(top8Sets, 3)
      if (top24Sets.length > 0) nextRank = assignLosers(top24Sets, nextRank)

      // Remaining pool players: rank by phase depth
      // (Round 3 > Round 2 > Round 1 > generic pools)
      const PHASE_DEPTH: Record<string, number> = { 'Round 3': 30, 'Round 2': 20, 'Round 1': 10 }
      const playerBest = new Map<number, { depth: number; maxId: number }>()
      for (const s of completed) {
        if (s.pool_identifier === top8PoolId || s.pool_identifier === top24PoolId) continue
        const depth = PHASE_DEPTH[s.phase_name ?? ''] ?? 5
        for (const pid of [s.winner_id, s.loser_id] as (number | null)[]) {
          if (!pid || placementMap.has(pid)) continue
          const cur = playerBest.get(pid)
          if (!cur || depth > cur.depth || (depth === cur.depth && s.id > cur.maxId)) {
            playerBest.set(pid, { depth, maxId: s.id })
          }
        }
      }
      // Group ties by phase depth, assign placements depth-descending
      const remaining = entrantPlayerIds.filter(pid => !placementMap.has(pid))
      const depthGroups = new Map<number, number[]>()
      for (const pid of remaining) {
        const d = playerBest.get(pid)?.depth ?? 0
        if (!depthGroups.has(d)) depthGroups.set(d, [])
        depthGroups.get(d)!.push(pid)
      }
      for (const d of [...depthGroups.keys()].sort((a, b) => b - a)) {
        const group = depthGroups.get(d)!
        for (const pid of group) placementMap.set(pid, nextRank)
        nextRank += group.length
      }
      return placementMap
    }

    // ════════════════════════════════════════════════════════════════
    // PATH B: no pool_identifier → original cluster-based fallback
    // (for older tournaments imported before pool_identifier was saved)
    // ════════════════════════════════════════════════════════════════
    function isLosersRound(rt: string | null): boolean { return /losers/i.test(rt ?? '') }
    function isFixedNamedRound(rt: string | null): boolean {
      return /losers final$/i.test(rt ?? '') || /losers semi.?final/i.test(rt ?? '')
    }

    const finalLossRound: Record<number, string | null> = {}
    const finalLossSetId: Record<number, number>        = {}
    for (const s of completed) {
      if (!isLosersRound(s.round_text) || s.loser_id === null) continue
      const pid       = s.loser_id
      const depth     = namedDepth(s.round_text)
      const prevDepth = namedDepth(finalLossRound[pid] ?? null)
      if (prevDepth === null && depth !== null) {
        finalLossRound[pid] = s.round_text; finalLossSetId[pid] = s.id
      } else if (prevDepth !== null && depth !== null && depth > prevDepth) {
        finalLossRound[pid] = s.round_text; finalLossSetId[pid] = s.id
      } else if (prevDepth === null && depth === null && s.id > (finalLossSetId[pid] ?? -1)) {
        finalLossRound[pid] = s.round_text; finalLossSetId[pid] = s.id
      }
    }

    const CLUSTER_GAP = 20
    const roundIdMap = new Map<string, number[]>()
    for (const s of completed) {
      const rt = s.round_text ?? ''
      if (!isLosersRound(rt) || isFixedNamedRound(rt)) continue
      if (!roundIdMap.has(rt)) roundIdMap.set(rt, [])
      roundIdMap.get(rt)!.push(s.id)
    }
    function getClusterBound(rt: string, setId: number, wantMax: boolean): number {
      const ids = roundIdMap.get(rt) ?? [setId]
      let clusterStart = 0
      for (let i = 1; i <= ids.length; i++) {
        const atEnd = i === ids.length || ids[i] - ids[i - 1] > CLUSTER_GAP
        if (atEnd) {
          if (ids[clusterStart] <= setId && setId <= ids[i - 1])
            return wantMax ? ids[i - 1] : ids[clusterStart]
          clusterStart = i
        }
      }
      return setId
    }

    const playerGroupKey:  Record<number, string> = {}
    const groupSortScore:  Record<string, number> = {}
    for (const pid of Object.keys(finalLossRound).map(Number)) {
      if (placementMap.has(pid)) continue
      const rt  = finalLossRound[pid] ?? ''
      const sid = finalLossSetId[pid] ?? 0
      let gk: string; let score: number
      if (isFixedNamedRound(rt)) {
        const d = namedDepth(rt) ?? 0
        gk = `fixed:${d}`; score = d * 10_000_000
      } else {
        gk    = `${rt}:${getClusterBound(rt, sid, false)}`
        score = getClusterBound(rt, sid, true)
      }
      playerGroupKey[pid] = gk
      if (groupSortScore[gk] === undefined || score > groupSortScore[gk]) groupSortScore[gk] = score
    }

    const groups = new Map<string, number[]>()
    for (const pid of Object.keys(finalLossRound).map(Number)) {
      if (placementMap.has(pid)) continue
      const gk = playerGroupKey[pid]
      if (!groups.has(gk)) groups.set(gk, [])
      groups.get(gk)!.push(pid)
    }
    let rank = 3
    for (const gk of [...groups.keys()].sort((a, b) => groupSortScore[b] - groupSortScore[a])) {
      const group = groups.get(gk)!
      for (const pid of group) placementMap.set(pid, rank)
      rank += group.length
    }
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
      // Meta columns: DB value → compile-time constant fallback
      logoUrl:             meta?.logo_url             ?? metaFb?.logoUrl             ?? null,
      cptEventType:        meta?.cpt_event_type       ?? metaFb?.cptEventType        ?? null,
      finalPoolIdentifier: meta?.final_pool_identifier ?? metaFb?.finalPoolIdentifier ?? null,
      top24PoolIdentifier: meta?.top24_pool_identifier ?? metaFb?.top24PoolIdentifier ?? null,
      ewcQualifyingSpots:  (meta as { ewc_qualifying_spots?: number | null } | null)?.ewc_qualifying_spots ?? metaFb?.ewcQualifyingSpots ?? null,
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
