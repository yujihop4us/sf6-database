import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 1. players テーブルの Hinao, Xiao Hai 等を確認
const { data: players } = await supabase
  .from('players')
  .select('id, handle')
  .or('handle.ilike.%xiao%,handle.ilike.%hinao%,handle.ilike.%ひなお%,handle.ilike.%kobayan%,handle.ilike.%fuudo%,handle.ilike.%oilking%,handle.ilike.%micky%,handle.ilike.%vxbao%')
console.log('Target players in DB:', players)

// 2. tournament_sets のカラム確認
const { data: sampleSet } = await supabase
  .from('tournament_sets')
  .select('*')
  .eq('tournament_id', 48)
  .limit(1)
console.log('\ntournament_sets columns:', sampleSet?.[0] ? Object.keys(sampleSet[0]) : 'no data (try different tournament_id)')

// tournament_id=48がなければ最新を試す
if (!sampleSet?.[0]) {
  const { data: anySet } = await supabase
    .from('tournament_sets')
    .select('*')
    .limit(1)
  console.log('Any set columns:', anySet?.[0] ? Object.keys(anySet[0]) : 'no data')
  console.log('Any set sample:', anySet?.[0])
}

// 3. players テーブルのカラム一覧確認
const { data: playerSample } = await supabase
  .from('players')
  .select('*')
  .limit(1)
console.log('\nplayers columns:', playerSample?.[0] ? Object.keys(playerSample[0]) : 'no data')
console.log('players sample:', playerSample?.[0])

// Top 8 sets for CB2026 (tournament_id=48)
const { data: top8sets } = await supabase
  .from('tournament_sets')
  .select('id, round_text, winner_id, loser_id')
  .eq('tournament_id', 48)
  .ilike('round_text', '%Top 8%')
  .order('id', { ascending: true })
console.log('\nTop 8 sets:')
top8sets?.forEach(s => console.log(`  "${s.round_text}" winner=${s.winner_id} loser=${s.loser_id}`))

const ids = [...new Set(top8sets?.flatMap(s => [s.winner_id, s.loser_id]).filter(Boolean) || [])]
if (ids.length > 0) {
  const { data: top8Players } = await supabase
    .from('players')
    .select('id, handle')
    .in('id', ids)
  console.log('Top 8 player handles:', top8Players)
}
