import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOURNAMENT_ID = 5; // EWC 2025

const sets = [
  // ===== PHASE 1 (60 sets) =====
  // Group A
  { winner: 'NoahTheProdigy', loser: 'Latif', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group A' },
  { winner: 'Angry Bird', loser: 'NARIKUN', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group A' },
  { winner: 'Angry Bird', loser: 'NoahTheProdigy', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group A' },
  { winner: 'Latif', loser: 'NARIKUN', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group A' },
  { winner: 'NoahTheProdigy', loser: 'Latif', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group A' },
  // Group B
  { winner: 'MenaRD', loser: 'Riddles', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group B' },
  { winner: 'Kawano', loser: 'Momochi', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group B' },
  { winner: 'MenaRD', loser: 'Kawano', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group B' },
  { winner: 'Momochi', loser: 'Riddles', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group B' },
  { winner: 'Kawano', loser: 'Momochi', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group B' },
  // Group C
  { winner: 'EndingWalker', loser: 'Shuto', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group C' },
  { winner: 'Dual Kevin', loser: 'Big Bird', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group C' },
  { winner: 'EndingWalker', loser: 'Dual Kevin', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group C' },
  { winner: 'Big Bird', loser: 'Shuto', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group C' },
  { winner: 'Big Bird', loser: 'Dual Kevin', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group C' },
  // Group D
  { winner: 'matsu56', loser: 'Juicyjoe', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group D' },
  { winner: 'Zhen', loser: 'Psycho', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group D' },
  { winner: 'Zhen', loser: 'matsu56', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group D' },
  { winner: 'Juicyjoe', loser: 'Psycho', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group D' },
  { winner: 'matsu56', loser: 'Juicyjoe', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group D' },
  // Group E
  { winner: 'Kakeru', loser: 'Tachikawa', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group E' },
  { winner: 'Xiaohai', loser: 'Punk', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group E' },
  { winner: 'Xiaohai', loser: 'Kakeru', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group E' },
  { winner: 'Punk', loser: 'Tachikawa', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group E' },
  // Kakeru DQ → Punk wins (skip this set or use 0-0)
  { winner: 'Punk', loser: 'Kakeru', winner_score: 0, loser_score: 0, phase: 'Phase 1 Group E' },
  // Group F
  { winner: 'Torimeshi', loser: 'Jr.', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group F' },
  { winner: 'Gachikun', loser: 'moke', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group F' },
  { winner: 'Torimeshi', loser: 'Gachikun', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group F' },
  { winner: 'moke', loser: 'Jr.', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group F' },
  { winner: 'moke', loser: 'Gachikun', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group F' },
  // Group G
  { winner: 'Tokido', loser: 'Hikaru', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group G' },
  { winner: 'YHC-Mochi', loser: 'Nephew', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group G' },
  { winner: 'YHC-Mochi', loser: 'Tokido', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group G' },
  { winner: 'Nephew', loser: 'Hikaru', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group G' },
  { winner: 'Tokido', loser: 'Nephew', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group G' },
  // Group H
  { winner: 'Blaz', loser: 'GO1', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group H' },
  { winner: 'Craime', loser: 'Phenom', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group H' },
  { winner: 'Blaz', loser: 'Craime', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group H' },
  { winner: 'GO1', loser: 'Phenom', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group H' },
  { winner: 'GO1', loser: 'Craime', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group H' },
  // Group I
  { winner: 'NL', loser: 'Hurricane', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group I' },
  { winner: 'Itabashi Zangief', loser: 'Shine', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group I' },
  { winner: 'Itabashi Zangief', loser: 'NL', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group I' },
  { winner: 'Shine', loser: 'Hurricane', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group I' },
  { winner: 'NL', loser: 'Shine', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group I' },
  // Group J
  { winner: 'Leshar', loser: 'kincho', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group J' },
  { winner: 'Higuchi', loser: 'Veggey', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group J' },
  { winner: 'Leshar', loser: 'Higuchi', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group J' },
  { winner: 'kincho', loser: 'Veggey', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group J' },
  { winner: 'Higuchi', loser: 'kincho', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group J' },
  // Group K
  { winner: 'DCQ', loser: 'Ryukichi', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group K' },
  { winner: 'Fuudo', loser: 'Kusanagi', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group K' },
  { winner: 'Fuudo', loser: 'DCQ', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group K' },
  { winner: 'Kusanagi', loser: 'Ryukichi', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group K' },
  { winner: 'DCQ', loser: 'Kusanagi', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group K' },
  // Group L
  { winner: 'Micky', loser: 'vWsym', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group L' },
  { winner: 'Bonchan', loser: 'pugera', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group L' },
  { winner: 'Bonchan', loser: 'Micky', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group L' },
  { winner: 'pugera', loser: 'vWsym', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group L' },
  { winner: 'pugera', loser: 'Micky', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group L' },

  // ===== PHASE 2 (12 sets) =====
  // Group A
  { winner: 'Big Bird', loser: 'NoahTheProdigy', winner_score: 3, loser_score: 0, phase: 'Phase 2 Group A' },
  { winner: 'Kawano', loser: 'Big Bird', winner_score: 3, loser_score: 1, phase: 'Phase 2 Group A' },
  { winner: 'Kawano', loser: 'NoahTheProdigy', winner_score: 3, loser_score: 0, phase: 'Phase 2 Group A' },
  // Group B
  { winner: 'matsu56', loser: 'moke', winner_score: 3, loser_score: 1, phase: 'Phase 2 Group B' },
  { winner: 'Punk', loser: 'moke', winner_score: 3, loser_score: 1, phase: 'Phase 2 Group B' },
  { winner: 'matsu56', loser: 'Punk', winner_score: 3, loser_score: 1, phase: 'Phase 2 Group B' },
  // Group C
  { winner: 'NL', loser: 'Tokido', winner_score: 3, loser_score: 1, phase: 'Phase 2 Group C' },
  { winner: 'GO1', loser: 'NL', winner_score: 3, loser_score: 2, phase: 'Phase 2 Group C' },
  { winner: 'GO1', loser: 'Tokido', winner_score: 3, loser_score: 2, phase: 'Phase 2 Group C' },
  // Group D
  { winner: 'Higuchi', loser: 'pugera', winner_score: 3, loser_score: 0, phase: 'Phase 2 Group D' },
  { winner: 'pugera', loser: 'DCQ', winner_score: 3, loser_score: 2, phase: 'Phase 2 Group D' },
  { winner: 'Higuchi', loser: 'DCQ', winner_score: 3, loser_score: 2, phase: 'Phase 2 Group D' },

  // ===== PHASE 3 (17 sets) =====
  // Round 1
  { winner: 'Angry Bird', loser: 'Higuchi', winner_score: 5, loser_score: 2, phase: 'Phase 3' },
  { winner: 'EndingWalker', loser: 'MenaRD', winner_score: 5, loser_score: 0, phase: 'Phase 3' },
  { winner: 'GO1', loser: 'Zhen', winner_score: 5, loser_score: 2, phase: 'Phase 3' },
  { winner: 'Xiaohai', loser: 'Torimeshi', winner_score: 5, loser_score: 2, phase: 'Phase 3' },
  { winner: 'YHC-Mochi', loser: 'matsu56', winner_score: 5, loser_score: 2, phase: 'Phase 3' },
  { winner: 'Blaz', loser: 'Itabashi Zangief', winner_score: 5, loser_score: 0, phase: 'Phase 3' },
  { winner: 'Leshar', loser: 'Kawano', winner_score: 5, loser_score: 0, phase: 'Phase 3' },
  { winner: 'Fuudo', loser: 'Bonchan', winner_score: 5, loser_score: 1, phase: 'Phase 3' },
  // QF
  { winner: 'Angry Bird', loser: 'EndingWalker', winner_score: 5, loser_score: 2, phase: 'Phase 3' },
  { winner: 'Xiaohai', loser: 'GO1', winner_score: 5, loser_score: 2, phase: 'Phase 3' },
  { winner: 'Blaz', loser: 'YHC-Mochi', winner_score: 5, loser_score: 1, phase: 'Phase 3' },
  { winner: 'Leshar', loser: 'Fuudo', winner_score: 5, loser_score: 4, phase: 'Phase 3' },
  // SF
  { winner: 'Xiaohai', loser: 'Angry Bird', winner_score: 5, loser_score: 1, phase: 'Phase 3' },
  { winner: 'Blaz', loser: 'Leshar', winner_score: 5, loser_score: 3, phase: 'Phase 3' },
  // 3rd place
  { winner: 'Leshar', loser: 'Angry Bird', winner_score: 5, loser_score: 4, phase: 'Phase 3' },
  // Final
  { winner: 'Xiaohai', loser: 'Blaz', winner_score: 5, loser_score: 4, phase: 'Phase 3' },
];

async function importManualSets() {
  let allPlayers = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from('players').select('id, handle').range(from, from + pageSize - 1);
    if (error) throw error;
    allPlayers = allPlayers.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`📥 Loaded ${allPlayers.length} players`);

  const handleMap = new Map();
  for (const p of allPlayers) {
    handleMap.set(p.handle.toLowerCase(), p);
  }

  let inserted = 0, notFound = [];
  const rows = [];

  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    const winner = handleMap.get(s.winner.toLowerCase());
    const loser = handleMap.get(s.loser.toLowerCase());

    if (!winner) { notFound.push(s.winner); continue; }
    if (!loser) { notFound.push(s.loser); continue; }

    rows.push({
      tournament_id: TOURNAMENT_ID,
      startgg_set_id: 40000000 + i,
      round_text: s.phase,
      display_score: `${s.winner} ${s.winner_score} - ${s.loser_score} ${s.loser}`,
      winner_id: winner.id,
      loser_id: loser.id,
      winner_score: s.winner_score,
      loser_score: s.loser_score,
      phase_name: s.phase,
    });
  }

  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabase.from('tournament_sets')
      .upsert(batch, { onConflict: 'tournament_id,startgg_set_id' });
    if (error) {
      console.error('❌ Upsert error:', error.message);
    } else {
      inserted += batch.length;
    }
  }

  const uniqueNotFound = [...new Set(notFound)];
  console.log(`\n✅ Tournament ID ${TOURNAMENT_ID}: ${inserted} sets inserted`);
  if (uniqueNotFound.length) {
    console.log(`❌ Not found in DB: ${uniqueNotFound.join(', ')}`);
  }
}

importManualSets().catch(console.error);
