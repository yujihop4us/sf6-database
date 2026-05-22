import { createClient } from '@supabase/supabase-js'
import PlayersClient from './PlayersClient'
import type { PlayerRow } from './PlayersClient'

export const revalidate = 300  // 5分キャッシュ

async function fetchTopPlayers(): Promise<PlayerRow[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data } = await supabase
    .from('players')
    .select('id, handle, country_code, main_character, team, total_sf6_earnings_usd')
    .gt('total_sf6_earnings_usd', 0)
    .order('total_sf6_earnings_usd', { ascending: false })
    .limit(50)

  return (data ?? []) as PlayerRow[]
}

export default async function PlayersPage() {
  const players = await fetchTopPlayers()
  return <PlayersClient initialPlayers={players} />
}
