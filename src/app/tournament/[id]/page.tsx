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
    .limit(200)

  // Sets with basic fields — join player data separately
  const { data: setsRaw } = await supabase
    .from('tournament_sets')
    .select('id, round_text, phase_name, display_score, winner_score, loser_score, winner_id, loser_id, winner_character, loser_character')
    .eq('tournament_id', numericId)
    .order('id', { ascending: false })
    .limit(300)

  // Collect all player IDs from sets and fetch them
  const setList = (setsRaw ?? []) as {
    id: number; round_text: string | null; phase_name: string | null
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
  // Strategy: analyse playoff phase (last/largest phase by set count).
  // - 0 losses in playoff = champion (rank 1)
  // - Lost only to champion in the final match = runner-up (rank 2)
  // - Track elimination order (by set ID) to assign 3rd, 4th, etc.
  function inferPlacements(
    sets: typeof setList,
    entrantPlayerIds: number[],
  ): Map<number, number> {
    if (sets.length === 0) return new Map()

    // Group by phase; pick the "playoff" phase = largest set count
    const phaseGroups = new Map<string, typeof setList>()
    for (const s of sets) {
      const ph = s.phase_name ?? ''
      if (!phaseGroups.has(ph)) phaseGroups.set(ph, [])
      phaseGroups.get(ph)!.push(s)
    }
    let playoffSets = sets
    let maxCount = 0
    for (const [, psets] of phaseGroups) {
      if (psets.length > maxCount) { maxCount = psets.length; playoffSets = psets }
    }

    // Sort playoff sets by ID (chronological)
    const sorted = [...playoffSets].sort((a, b) => a.id - b.id)

    // Track losses per player within playoff
    const playoffLosses: Record<number, number> = {}
    const playoffWins:   Record<number, number> = {}
    // Track when each player was last eliminated (set ID of their final loss)
    const lastLossSetId: Record<number, number> = {}

    for (const s of sorted) {
      if (s.winner_id) playoffWins[s.winner_id] = (playoffWins[s.winner_id] ?? 0) + 1
      if (s.loser_id) {
        playoffLosses[s.loser_id] = (playoffLosses[s.loser_id] ?? 0) + 1
        lastLossSetId[s.loser_id] = s.id
      }
    }

    // Determine max losses before elimination (1 = single elim, 2 = double elim)
    const maxLosses = Math.max(...Object.values(playoffLosses), 1)

    // Champion = player who never reached maxLosses (0 losses or fewest)
    const allPlayers = [...new Set([
      ...sorted.map(s => s.winner_id).filter((x): x is number => x !== null),
      ...sorted.map(s => s.loser_id).filter((x): x is number => x !== null),
    ])]

    // Sort by elimination: uneliminated first, then by set ID of last loss (descending = last to lose)
    const playoffElimOrder = allPlayers
      .filter(pid => (playoffLosses[pid] ?? 0) >= maxLosses || pid === allPlayers.find(p => (playoffLosses[p] ?? 0) < maxLosses))
      .sort((a, b) => {
        const aLosses = playoffLosses[a] ?? 0
        const bLosses = playoffLosses[b] ?? 0
        if (aLosses < bLosses) return -1  // fewer losses = better placement
        if (aLosses > bLosses) return 1
        return (lastLossSetId[b] ?? 0) - (lastLossSetId[a] ?? 0)  // later elimination = better
      })

    // Grand final participants
    const lastSet = sorted[sorted.length - 1]
    const gfWinner = lastSet?.winner_id
    const gfLoser  = lastSet?.loser_id

    const placementMap = new Map<number, number>()
    if (gfWinner) placementMap.set(gfWinner, 1)
    if (gfLoser)  placementMap.set(gfLoser,  2)

    // Remaining: assign 3, 4, 5+ based on elimination order
    let rank = 3
    for (const pid of playoffElimOrder) {
      if (!placementMap.has(pid)) {
        placementMap.set(pid, rank)
        rank++
      }
    }

    // Fill any entrants not in playoff
    for (const pid of entrantPlayerIds) {
      if (!placementMap.has(pid)) {
        placementMap.set(pid, rank++)
      }
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

  const sets = [...setList].sort((a, b) => b.id - a.id).map(s => {
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
