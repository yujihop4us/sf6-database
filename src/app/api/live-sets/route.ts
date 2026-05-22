import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Legacy columns that always exist in tournament_sets
const LEGACY_SELECT =
  'id, round_text, display_score, winner_id, loser_id, winner_score, loser_score, phase_name, winner_character, loser_character, created_at'

// v2 columns added by 20260518_v2_pipeline.sql migration
const V2_SELECT =
  'id, round_text, full_round_text, display_score, winner_id, loser_id, winner_score, loser_score, phase_name, winner_character, loser_character, state, completed_at, updated_at_sg, started_at, stream_name, station_number, p1_name, p2_name, p1_player_id, p2_player_id, created_at'

function isSchemaError(msg: string) {
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('Could not find')
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tournamentId  = searchParams.get('tournamentId')
  const limit         = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
  const offset        = parseInt(searchParams.get('offset') ?? '0')
  const search        = searchParams.get('search') ?? ''
  // state フィルター (v2 のみ): "2" or "3" or "2,3"
  const stateParam    = searchParams.get('state') ?? ''
  const stateFilter   = stateParam ? stateParam.split(',').map(Number).filter(n => !isNaN(n)) : null

  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // ── search モード: players.handle で対象 ID を絞り込む ─────────────────────
  let winnerOrLoserIds: number[] | null = null

  if (search.length >= 1) {
    const { data: matched } = await supabase
      .from('players')
      .select('id')
      .ilike('handle', `%${search}%`)
      .limit(500)

    const ids = (matched ?? []).map(p => p.id as number)
    if (ids.length === 0) {
      return NextResponse.json({ sets: [], total: 0, hasMore: false })
    }
    winnerOrLoserIds = ids
  }

  // ── tournament_sets クエリ (v2 試行 → legacy フォールバック) ──────────────
  async function runQuery(useV2: boolean) {
    let q = supabase
      .from('tournament_sets')
      .select(useV2 ? V2_SELECT : LEGACY_SELECT, { count: 'estimated' })
      .eq('tournament_id', Number(tournamentId))
      .order(useV2 ? 'updated_at_sg' : 'created_at', { ascending: false, nullsFirst: false })

    if (winnerOrLoserIds !== null) {
      const joined = winnerOrLoserIds.join(',')
      q = q.or(`winner_id.in.(${joined}),loser_id.in.(${joined})`)
    }

    // state フィルターは v2 のみ (カラムが存在する場合)
    if (useV2 && stateFilter?.length) {
      q = q.in('state', stateFilter)
    }

    q = q.range(offset, offset + limit - 1)

    return q
  }

  let sets: any[] | null = null
  let count: number | null = null
  let usedV2 = true

  // v2 試行
  {
    const { data, error, count: c } = await runQuery(true)
    if (error && isSchemaError(error.message)) {
      // legacy にフォールバック
      usedV2 = false
      const { data: d2, error: e2, count: c2 } = await runQuery(false)
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      sets = d2
      count = c2
    } else if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      sets = data
      count = c
    }
  }

  if (!sets || sets.length === 0) {
    return NextResponse.json({ sets: [], total: count ?? 0, hasMore: false })
  }

  // ── winner_id / loser_id → players JOIN ───────────────────────────────────
  const playerIds = [...new Set(
    [...sets.map((s: any) => s.winner_id), ...sets.map((s: any) => s.loser_id)].filter(id => id != null)
  )] as number[]

  const { data: players } = await supabase
    .from('players')
    .select('id, handle, country_code, main_character')
    .in('id', playerIds)

  const pm = new Map((players ?? []).map(p => [p.id, p]))

  const enriched = sets.map((s: any) => ({
    id:               s.id,
    round_text:       (usedV2 ? s.full_round_text : null) ?? s.round_text,
    display_score:    s.display_score,
    phase_name:       s.phase_name,
    state:            usedV2 ? (s.state ?? null) : null,
    winner_id:        s.winner_id,
    loser_id:         s.loser_id,
    winner_score:     s.winner_score,
    loser_score:      s.loser_score,
    winner_character: s.winner_character,
    loser_character:  s.loser_character,
    stream_name:      usedV2 ? (s.stream_name     ?? null) : null,
    station_number:   usedV2 ? (s.station_number  ?? null) : null,
    p1_name:          usedV2 ? (s.p1_name          ?? null) : null,
    p2_name:          usedV2 ? (s.p2_name          ?? null) : null,
    p1_player_id:     usedV2 ? (s.p1_player_id     ?? null) : null,
    p2_player_id:     usedV2 ? (s.p2_player_id     ?? null) : null,
    completed_at:     usedV2 ? (s.completed_at     ?? null) : null,
    updated_at:       usedV2 ? (s.updated_at_sg    ?? s.created_at) : s.created_at,
    winner_handle:    pm.get(s.winner_id)?.handle       ?? null,
    winner_country:   pm.get(s.winner_id)?.country_code  ?? null,
    winner_main_char: pm.get(s.winner_id)?.main_character ?? null,
    loser_handle:     pm.get(s.loser_id)?.handle        ?? null,
    loser_country:    pm.get(s.loser_id)?.country_code   ?? null,
    loser_main_char:  pm.get(s.loser_id)?.main_character  ?? null,
  }))

  return NextResponse.json({
    sets:    enriched,
    total:   count ?? enriched.length,
    hasMore: enriched.length === limit,
  })
}
