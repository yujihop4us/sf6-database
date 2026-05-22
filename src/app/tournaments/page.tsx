import { createClient } from '@supabase/supabase-js'
import TournamentsClient from './TournamentsClient'
import { getTournamentSeries, hasEwcQual, type TournamentSeries } from '@/app/page'

export const revalidate = 60

// Override DB entrant counts with real totals for large tournaments
const TOURNAMENT_REAL_STATS: Record<number, { numEntrants: number }> = {
  40: { numEntrants: 7683 }, // EVO Japan 2026
  34: { numEntrants: 4026 }, // EVO Japan 2025
}

export type TournamentRow = {
  id: number
  name: string
  startDate: string | null
  endDate: string | null
  location: string | null
  totalPrizeUsd: number | null
  isOnline: boolean
  format: string | null
  region: string | null
  entrantCount: number
  isLive: boolean
  series: TournamentSeries
  ewcQual: boolean
}

async function fetchTournaments(): Promise<TournamentRow[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data } = await supabase
    .from('tournaments')
    .select('id, name, start_date, end_date, location, total_prize_usd, is_online, format, region')
    .order('start_date', { ascending: false })
    .limit(100)

  if (!data) return []

  // Per-tournament HEAD counts — avoids the 1000-row default limit that
  // causes wildly wrong numbers for large tournaments like EVO Japan
  const countEntries = await Promise.all(
    data.map(async t => {
      const { count } = await supabase
        .from('tournament_entrants')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', t.id)
      return [t.id, count ?? 0] as [number, number]
    })
  )
  const countMap: Record<number, number> = Object.fromEntries(countEntries)

  type TRow = { start_date: string | null; end_date: string | null }
  function isLive(t: TRow): boolean {
    if (!t.start_date) return false
    const start = new Date(t.start_date).getTime()
    const end = t.end_date
      ? new Date(t.end_date).getTime()
      : start + 3 * 24 * 60 * 60 * 1000
    const nowMs = Date.now()
    return nowMs >= start && nowMs <= end
  }

  return data.map(t => {
    const series = getTournamentSeries(t.name)
    const override = TOURNAMENT_REAL_STATS[t.id]
    return {
      id: t.id,
      name: t.name,
      startDate: t.start_date ?? null,
      endDate: t.end_date ?? null,
      location: t.location ?? null,
      totalPrizeUsd: t.total_prize_usd ?? null,
      isOnline: t.is_online ?? false,
      format: t.format ?? null,
      region: t.region ?? null,
      entrantCount: override?.numEntrants ?? countMap[t.id] ?? 0,
      isLive: isLive(t),
      series,
      ewcQual: hasEwcQual(t.name, series),
    }
  })
}

export default async function TournamentsPage() {
  const tournaments = await fetchTournaments()
  return <TournamentsClient tournaments={tournaments} />
}
