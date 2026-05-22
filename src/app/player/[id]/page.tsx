import { createClient } from '@supabase/supabase-js'
import { PlayerClient } from './PlayerClient'

export const revalidate = 60

// ── Types ─────────────────────────────────────────────────────────

export type PlayerInfo = {
  id: number
  handle: string
  name: string | null
  countryCode: string | null
  mainCharacter: string | null
  team: string | null
  imageUrl: string | null
  bioJa: string | null
  bioEn: string | null
  totalEarnings: number | null
}

export type TournamentResult = {
  tournamentId: number
  tournamentName: string
  startDate: string | null
  placement: number | null
  prizeAmount: number | null
  character: string | null   // most-used character in this tournament
  totalPrizeUsd: number | null
}

export type H2HEntry = {
  opponentId: number
  opponentHandle: string
  opponentCountryCode: string | null
  wins: number
  losses: number
}

export type CharUsage = {
  char: string
  count: number
}

export type Achievement = {
  year: string
  event: string
  resultJa: string
  resultEn: string
  champion: boolean
}

export type PlayerPageData = {
  player: PlayerInfo
  results: TournamentResult[]
  h2h: H2HEntry[]
  charUsage: CharUsage[]
  achievements: Achievement[]
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtPlacementEn(p: number): string {
  if (p === 1) return 'Champion'
  if (p === 2) return 'Runner-up'
  if (p === 3) return '3rd Place'
  const tiers = [4, 5, 7, 9, 13, 17, 25, 33]
  for (let i = 0; i < tiers.length - 1; i++) {
    if (p >= tiers[i] && p < tiers[i + 1]) return `Top ${tiers[i + 1]}`
  }
  return `${p}th`
}

function fmtPlacementJa(p: number): string {
  if (p === 1) return '優勝'
  if (p === 2) return '準優勝'
  if (p === 3) return '3位'
  const tiers = [4, 5, 7, 9, 13, 17, 25, 33]
  for (let i = 0; i < tiers.length - 1; i++) {
    if (p >= tiers[i] && p < tiers[i + 1]) return `Top ${tiers[i + 1]}`
  }
  return `${p}位`
}

// ── Data fetching ─────────────────────────────────────────────────

async function fetchPlayerData(id: string): Promise<PlayerPageData | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const numericId = parseInt(id, 10)
  if (isNaN(numericId)) return null

  // 1. Player basic info
  const { data: playerRaw, error: pErr } = await supabase
    .from('players')
    .select('id, handle, real_name, country_code, main_character, team, profile_image_url, bio, bio_en, total_sf6_earnings_usd')
    .eq('id', numericId)
    .single()

  if (pErr || !playerRaw) return null

  // 2. Tournament results (fetched before player construction for earnings fallback)
  const { data: entrantsRaw } = await supabase
    .from('tournament_entrants')
    .select('placement, prize_amount, tournaments(id, name, start_date, total_prize_usd)')
    .eq('player_id', numericId)
    .order('tournament_id', { ascending: false })
    .limit(100)

  // Earnings: prefer total_sf6_earnings_usd; fallback to SUM(prize_amount); null if both are 0
  const dbEarnings = (playerRaw as { total_sf6_earnings_usd?: number | null }).total_sf6_earnings_usd ?? null
  type EntrantForEarnings = { prize_amount: number | null }
  const sumEarnings = ((entrantsRaw ?? []) as unknown as EntrantForEarnings[])
    .reduce((acc, e) => acc + (e.prize_amount ?? 0), 0)
  const totalEarnings: number | null =
    (dbEarnings != null && dbEarnings > 0) ? dbEarnings
    : sumEarnings > 0 ? sumEarnings
    : null

  const player: PlayerInfo = {
    id: playerRaw.id,
    handle: playerRaw.handle,
    name: (playerRaw as { real_name?: string | null }).real_name ?? null,
    countryCode: playerRaw.country_code ?? null,
    mainCharacter: playerRaw.main_character ?? null,
    team: playerRaw.team ?? null,
    imageUrl: playerRaw.profile_image_url ?? null,
    bioJa: (playerRaw as { bio?: string | null }).bio ?? null,
    bioEn: (playerRaw as { bio_en?: string | null }).bio_en ?? null,
    totalEarnings,
  }

  // 3. All sets for this player
  const { data: setsRaw } = await supabase
    .from('tournament_sets')
    .select('winner_id, loser_id, winner_character, loser_character, tournament_id')
    .or(`winner_id.eq.${numericId},loser_id.eq.${numericId}`)
    .limit(3000)

  type SetRecord = {
    winner_id: number | null
    loser_id: number | null
    winner_character: string | null
    loser_character: string | null
    tournament_id: number | null
  }
  const sets = (setsRaw ?? []) as SetRecord[]

  // Compute character per tournament
  const charPerTournament: Record<number, Record<string, number>> = {}
  const charAllFreq: Record<string, number> = {}
  for (const s of sets) {
    const isWinner = s.winner_id === numericId
    const char = isWinner ? s.winner_character : s.loser_character
    const tId = s.tournament_id
    if (char) {
      charAllFreq[char] = (charAllFreq[char] ?? 0) + 1
      if (tId) {
        charPerTournament[tId] ??= {}
        charPerTournament[tId][char] = (charPerTournament[tId][char] ?? 0) + 1
      }
    }
  }
  const mainCharPerTournament: Record<number, string> = {}
  for (const [tId, freq] of Object.entries(charPerTournament)) {
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
    if (top) mainCharPerTournament[Number(tId)] = top[0]
  }

  // H2H computation
  const h2hMap: Record<number, { wins: number; losses: number }> = {}
  for (const s of sets) {
    if (s.winner_id === numericId && s.loser_id) {
      h2hMap[s.loser_id] ??= { wins: 0, losses: 0 }
      h2hMap[s.loser_id].wins++
    } else if (s.loser_id === numericId && s.winner_id) {
      h2hMap[s.winner_id] ??= { wins: 0, losses: 0 }
      h2hMap[s.winner_id].losses++
    }
  }

  // Top 5 H2H opponents by total sets
  const topOpponentIds = Object.entries(h2hMap)
    .sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses))
    .slice(0, 5)
    .map(([id]) => Number(id))

  let h2h: H2HEntry[] = []
  if (topOpponentIds.length > 0) {
    const { data: opponents } = await supabase
      .from('players')
      .select('id, handle, country_code')
      .in('id', topOpponentIds)

    h2h = (opponents ?? []).map((opp: { id: number; handle: string; country_code: string | null }) => ({
      opponentId: opp.id,
      opponentHandle: opp.handle,
      opponentCountryCode: opp.country_code ?? null,
      wins: h2hMap[opp.id]?.wins ?? 0,
      losses: h2hMap[opp.id]?.losses ?? 0,
    })).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
  }

  // Build tournament results
  type EntrantRaw = {
    placement: number | null
    prize_amount: number | null
    tournaments: { id: number; name: string; start_date: string | null; total_prize_usd: number | null } | null
  }
  const results: TournamentResult[] = ((entrantsRaw ?? []) as unknown as EntrantRaw[])
    .filter(e => e.tournaments != null)
    .map(e => ({
      tournamentId: e.tournaments!.id,
      tournamentName: e.tournaments!.name,
      startDate: e.tournaments!.start_date ?? null,
      placement: e.placement ?? null,
      prizeAmount: e.prize_amount ?? null,
      character: mainCharPerTournament[e.tournaments!.id] ?? player.mainCharacter,
      totalPrizeUsd: e.tournaments!.total_prize_usd ?? null,
    }))
    .sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0
      if (!a.startDate) return 1
      if (!b.startDate) return -1
      return b.startDate.localeCompare(a.startDate)
    })

  // Character usage overall
  const charUsage: CharUsage[] = Object.entries(charAllFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([char, count]) => ({ char, count }))

  // Achievements: placement <= 8
  const achievements: Achievement[] = results
    .filter(r => r.placement != null && r.placement <= 8 && r.startDate)
    .slice(0, 6)
    .map(r => ({
      year: r.startDate!.slice(0, 4),
      event: r.tournamentName,
      resultJa: fmtPlacementJa(r.placement!),
      resultEn: fmtPlacementEn(r.placement!),
      champion: r.placement === 1,
    }))

  return { player, results, h2h, charUsage, achievements }
}

// ── Page component ────────────────────────────────────────────────

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await fetchPlayerData(id)
  return <PlayerClient data={data} />
}
