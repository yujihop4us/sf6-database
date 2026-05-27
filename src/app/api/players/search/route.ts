import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { playerSearchVariants } from '@/lib/normalizePlayerName'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  const startggId = req.nextUrl.searchParams.get('startggId')

  // --- startgg player ID による直接検索 (最高優先度) ---
  if (startggId) {
    const id = parseInt(startggId, 10)
    if (!isNaN(id)) {
      const { data, error } = await supabase
        .from('players')
        .select('id, handle, country_code, main_character, team, profile_image_url')
        .contains('startgg_player_ids', [id])
        .limit(1)
      if (!error && data && data.length > 0) {
        return NextResponse.json({ players: data })
      }
    }
  }

  if (!q || q.length < 2) {
    return NextResponse.json({ players: [] })
  }

  // 正規化後のバリアント一覧 (スポンサータグ除去 + 表記揺れ)
  const variants = playerSearchVariants(q)

  // --- Pass 1: バリアントで完全一致 (ilike exact) を試みる ---
  for (const variant of variants) {
    if (variant.length < 2) continue
    const { data, error } = await supabase
      .from('players')
      .select('id, handle, country_code, main_character, team, profile_image_url')
      .ilike('handle', variant)
      .order('total_sf6_earnings_usd', { ascending: false, nullsFirst: false })
      .limit(5)
    if (!error && data && data.length > 0) {
      return NextResponse.json({ players: data })
    }
  }

  // --- Pass 2: 正規化後の名前で部分一致 (ilike %...%) ---
  const normalized = variants[0] // normalizePlayerName(q) の結果
  const { data: fuzzyData, error: fuzzyError } = await supabase
    .from('players')
    .select('id, handle, country_code, main_character, team, profile_image_url')
    .ilike('handle', `%${normalized}%`)
    .order('total_sf6_earnings_usd', { ascending: false, nullsFirst: false })
    .limit(20)

  if (fuzzyError) {
    return NextResponse.json({ error: fuzzyError.message }, { status: 500 })
  }

  // --- Pass 3: 元のクエリでも部分一致フォールバック (Pass2 が空のとき) ---
  if (!fuzzyData || fuzzyData.length === 0) {
    const { data: rawData, error: rawError } = await supabase
      .from('players')
      .select('id, handle, country_code, main_character, team, profile_image_url')
      .ilike('handle', `%${q.trim()}%`)
      .order('total_sf6_earnings_usd', { ascending: false, nullsFirst: false })
      .limit(20)
    if (rawError) {
      return NextResponse.json({ error: rawError.message }, { status: 500 })
    }
    return NextResponse.json({ players: rawData ?? [] })
  }

  return NextResponse.json({ players: fuzzyData })
}
