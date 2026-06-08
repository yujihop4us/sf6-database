import { createClient } from '@supabase/supabase-js'
import TournamentsClient from './TournamentsClient'
import { getTournamentSeries, hasEwcQual, type TournamentSeries } from '@/app/page'
import { isTournamentLive } from '@/lib/utils'

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
  /** ライブページURL用スラッグ */
  startggSlug: string | null
}

async function fetchTournaments(): Promise<TournamentRow[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data } = await supabase
    .from('tournaments')
    .select('id, name, start_date, end_date, location, total_prize_usd, is_online, format, region, startgg_slug')
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
      isLive: isTournamentLive(t.start_date, t.end_date),
      series,
      ewcQual: hasEwcQual(t.name, series),
      startggSlug: (t as { startgg_slug?: string | null }).startgg_slug ?? null,
    }
  })
}

export default async function TournamentsPage() {
  const tournaments = await fetchTournaments()
  return <TournamentsClient tournaments={tournaments} />
}
