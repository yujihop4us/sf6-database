import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tournamentSlug: string }> },
) {
  const { tournamentSlug } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data, error } = await supabase
    .from('stream_queue_cache')
    .select('*')
    .eq('tournament_slug', tournamentSlug)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ currentSet: null, nextSets: [], stream: null, isStale: true })
  }

  // 5 分以上更新なし → stale
  const isStale = Date.now() - new Date(data.updated_at).getTime() > 5 * 60 * 1000

  return NextResponse.json({
    currentSet: isStale ? null : data.current_set,
    nextSets:   isStale ? []   : (data.next_sets ?? []),
    stream: {
      name:   data.stream_name,
      source: data.stream_source,
    },
    updatedAt: data.updated_at,
    isStale,
  })
}
