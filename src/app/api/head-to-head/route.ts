import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const p1 = req.nextUrl.searchParams.get('p1')
  const p2 = req.nextUrl.searchParams.get('p2')

  if (!p1 || !p2) {
    return NextResponse.json({ error: 'p1 and p2 required' }, { status: 400 })
  }

  const id1 = parseInt(p1)
  const id2 = parseInt(p2)

  // Get all sets between these two players
  const { data: sets, error } = await supabase
    .from('tournament_sets')
    .select(`
      id,
      tournament_id,
      round_text,
      phase_name,
      winner_id,
      loser_id,
      winner_score,
      loser_score,
      display_score,
      created_at
    `)
    .or(
      `and(winner_id.eq.${id1},loser_id.eq.${id2}),and(winner_id.eq.${id2},loser_id.eq.${id1})`
    )
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get tournament names for context
  const tournamentIds = [...new Set(sets.map(s => s.tournament_id))]
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, start_date')
    .in('id', tournamentIds)

  const tournamentMap = Object.fromEntries(
    (tournaments || []).map(t => [t.id, t])
  )

  // Calculate summary
  const p1Wins = sets.filter(s => s.winner_id === id1).length
  const p2Wins = sets.filter(s => s.winner_id === id2).length

  // Get player info
  const { data: playerData } = await supabase
    .from('players')
    .select('id, handle, country_code, main_character, team, total_sf6_earnings_usd, profile_image_url')
    .in('id', [id1, id2])

  const player1 = playerData?.find(p => p.id === id1)
  const player2 = playerData?.find(p => p.id === id2)

  // Enrich sets with tournament info
  const enrichedSets = sets.map(s => ({
    ...s,
    tournament_name: tournamentMap[s.tournament_id]?.name || 'Unknown',
    tournament_date: tournamentMap[s.tournament_id]?.start_date || null,
  }))

  return NextResponse.json({
    player1,
    player2,
    summary: {
      player1_wins: p1Wins,
      player2_wins: p2Wins,
      total_sets: sets.length,
    },
    sets: enrichedSets,
  })
}
