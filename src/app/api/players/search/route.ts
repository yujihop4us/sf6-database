import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  const tournament = req.nextUrl.searchParams.get('tournament')

  if (!q || q.length < 2) {
    return NextResponse.json({ players: [] })
  }

  let query = supabase
    .from('players')
    .select('id, handle, country_code, main_character, team, profile_image_url')
    .ilike('handle', `%${q}%`)
    .order('total_sf6_earnings_usd', { ascending: false, nullsFirst: false })
    .limit(20)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ players: data })
}
