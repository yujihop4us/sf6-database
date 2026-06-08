import { createClient } from '@supabase/supabase-js'
import HomeClient from './HomeClient'

export const revalidate = 60

export type TournamentSeries = 'EWC' | 'CPT_PREMIER' | 'ROAD_TO_EWC' | 'CPT_FINALS' | 'OTHER'

export function getTournamentSeries(name: string): TournamentSeries {
  const n = name.toLowerCase()
  if (n.includes('road to ewc') || n.includes('dreamhack')) return 'ROAD_TO_EWC'
  if (n.includes('esports world cup')) return 'EWC'
  if (n.includes('capcom cup')) return 'CPT_FINALS'
  const premierKeywords = [
    'evo japan', 'evo 20', 'evo france', 'combo breaker', 'blink respawn',
    'battle arena melbourne', 'ceo 20', 'ultimate fighting arena',
  ]
  if (premierKeywords.some(kw => n.includes(kw))) return 'CPT_PREMIER'
  return 'OTHER'
}

// Returns true for tournaments that grant EWC 2026 qualification spots.
// Includes Road to EWC events AND CPT Premier events with concurrent EWC qualifier stops:
//   - Combo Breaker (concurrent: DreamHack Schaumburg)
//   - EVO main (concurrent: Road to EWC TBD stop) — excludes EVO Japan / EVO France
export function hasEwcQual(name: string, series: TournamentSeries): boolean {
  if (series === 'ROAD_TO_EWC') return true
  const n = name.toLowerCase()
  if (n.includes('combo breaker')) return true
  if (n.startsWith('evo 20') || n.startsWith('evo2')) return true  // main EVO only
  return false
}

export type HomeTournament = {
  id: number
  name: string
  startDate: string | null
  endDate: string | null
  location: string | null
  totalPrizeUsd: number | null
  isOnline: boolean
  isLive: boolean
  entrantCount: number
  series: TournamentSeries
  ewcQual: boolean
  /** ライブページURL用スラッグ */
  startggSlug: string | null
}

export type RecentResult = {
  tournamentId: number
  tournamentName: string
  placement: number
  playerId: number
  playerHandle: string
  playerCountryCode: string | null
  playerCharacter: string | null
  prizeAmount: number | null
}

export type HomeData = {
  liveTournament: HomeTournament | null
  upcoming: HomeTournament[]
  past: HomeTournament[]
  recentResults: RecentResult[]
}

async function fetchHomeData(): Promise<HomeData> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const now = new Date().toISOString()

  // All tournaments
  const { data: tournsRaw } = await supabase
    .from('tournaments')
    .select('id, name, start_date, end_date, location, total_prize_usd, is_online, startgg_slug')
    .order('start_date', { ascending: false })
    .limit(60)

  const tourns = (tournsRaw ?? []) as {
    id: number; name: string; start_date: string | null; end_date: string | null
    location: string | null; total_prize_usd: number | null; is_online: boolean | null
    startgg_slug: string | null
  }[]

  // Entrant counts — use HEAD requests per tournament to avoid the 1000-row default limit
  const countEntries = await Promise.all(
    tourns.map(async t => {
      const { count } = await supabase
        .from('tournament_entrants')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', t.id)
      return [t.id, count ?? 0] as [number, number]
    })
  )
  const countMap: Record<number, number> = Object.fromEntries(countEntries)

  function isLive(t: typeof tourns[0]): boolean {
    if (!t.start_date) return false
    const start = new Date(t.start_date).getTime()
    const end = t.end_date
      ? new Date(t.end_date).getTime()
      : start + 3 * 24 * 60 * 60 * 1000
    const nowMs = Date.now()
    return nowMs >= start && nowMs <= end
  }

  const mapped: HomeTournament[] = tourns.map(t => {
    const series = getTournamentSeries(t.name)
    return {
      id: t.id,
      name: t.name,
      startDate: t.start_date ?? null,
      endDate: t.end_date ?? null,
      location: t.location ?? null,
      totalPrizeUsd: t.total_prize_usd ?? null,
      isOnline: t.is_online ?? false,
      isLive: isLive(t),
      entrantCount: countMap[t.id] ?? 0,
      series,
      ewcQual: hasEwcQual(t.name, series),
      startggSlug: t.startgg_slug ?? null,
    }
  })

  const nowMs = Date.now()
  const liveTournament = mapped.find(t => t.isLive) ?? null
  // Sort upcoming ascending (closest first)
  const upcoming = mapped
    .filter(t => t.startDate && new Date(t.startDate).getTime() > nowMs)
    .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())
  const past = mapped.filter(t => !t.startDate || new Date(t.startDate).getTime() <= nowMs)

  // Most recent major completed tournament (skip Road to EWC qualifiers)
  const recentTournament =
    past.find(t => t.entrantCount > 0 && t.series !== 'ROAD_TO_EWC') ??
    past.find(t => t.entrantCount > 0)
  let recentResults: RecentResult[] = []

  if (recentTournament) {
    const { data: entrantsRaw } = await supabase
      .from('tournament_entrants')
      .select('placement, prize_amount, players(id, handle, country_code, main_character)')
      .eq('tournament_id', recentTournament.id)
      .not('placement', 'is', null)
      .order('placement', { ascending: true })
      .limit(3)

    type EntrantRaw = {
      placement: number | null
      prize_amount: number | null
      players: { id: number; handle: string; country_code: string | null; main_character: string | null } | null
    }

    recentResults = ((entrantsRaw ?? []) as unknown as EntrantRaw[])
      .filter(e => e.players && e.placement != null)
      .map(e => ({
        tournamentId: recentTournament.id,
        tournamentName: recentTournament.name,
        placement: e.placement!,
        playerId: e.players!.id,
        playerHandle: e.players!.handle,
        playerCountryCode: e.players!.country_code ?? null,
        playerCharacter: e.players!.main_character ?? null,
        prizeAmount: e.prize_amount ?? null,
      }))
  }

  return { liveTournament, upcoming, past, recentResults }
}

export default async function HomePage() {
  const data = await fetchHomeData()
  return <HomeClient data={data} />
}
