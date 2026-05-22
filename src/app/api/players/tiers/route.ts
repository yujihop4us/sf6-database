import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// GET /api/players/tiers?handles=Punk,Kilzyou,Riddles
// Returns: { [handle]: "S" | "A" | "B" | "C" | null }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('handles') ?? ''
  const handles = raw.split(',').map(h => h.trim()).filter(Boolean)

  if (handles.length === 0) {
    return NextResponse.json({})
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data } = await supabase
    .from('players')
    .select('handle, tier')
    .in('handle', handles)

  const result: Record<string, string | null> = {}
  for (const p of (data ?? [])) {
    result[p.handle] = p.tier ?? null
  }

  return NextResponse.json(result)
}
