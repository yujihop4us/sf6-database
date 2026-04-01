import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOURNAMENT_ID = 3; // EWC 2024

const sets = [
  // ===== FIRST PHASE (40 sets) =====
  // Group A
  { winner: 'gachikun', loser: 'Ryukichi', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group A' },
  { winner: 'NL', loser: 'Punk', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group A' },
  { winner: 'Ryukichi', loser: 'Punk', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group A' },
  { winner: 'gachikun', loser: 'NL', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group A' },
  { winner: 'Ryukichi', loser: 'NL', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group A' },
  // Group B
  { winner: 'Lexx', loser: 'Problem-X', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group B' },
  { winner: 'Angry Bird', loser: 'Rainpro', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group B' },
  { winner: 'Problem-X', loser: 'Rainpro', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group B' },
  { winner: 'Angry Bird', loser: 'Lexx', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group B' },
  { winner: 'Problem-X', loser: 'Lexx', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group B' },
  // Group C
  { winner: 'Phenom', loser: 'Kakeru', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group C' },
  { winner: 'NoahTheProdigy', loser: 'Itabashi Zangief', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group C' },
  { winner: 'Kakeru', loser: 'Itabashi Zangief', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group C' },
  { winner: 'NoahTheProdigy', loser: 'Phenom', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group C' },
  { winner: 'Kakeru', loser: 'Phenom', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group C' },
  // Group D
  { winner: 'Zhen', loser: 'MenaRD', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group D' },
  { winner: 'Xiao Hai', loser: 'Dual Kevin', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group D' },
  { winner: 'Dual Kevin', loser: 'MenaRD', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group D' },
  { winner: 'Xiao Hai', loser: 'Zhen', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group D' },
  { winner: 'Dual Kevin', loser: 'Zhen', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group D' },
  // Group E
  { winner: 'Vxbao', loser: 'Chris Wong', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group E' },
  { winner: 'Hikaru', loser: 'DCQ', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group E' },
  { winner: 'Chris Wong', loser: 'DCQ', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group E' },
  { winner: 'Hikaru', loser: 'Vxbao', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group E' },
  { winner: 'Chris Wong', loser: 'Vxbao', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group E' },
  // Group F
  { winner: 'Tachikawa', loser: 'Oil King', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group F' },
  { winner: 'Kawano', loser: 'Nephew', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group F' },
  { winner: 'Nephew', loser: 'Oil King', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group F' },
  { winner: 'Kawano', loser: 'Tachikawa', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group F' },
  { winner: 'Tachikawa', loser: 'Nephew', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group F' },
  // Group G
  { winner: 'Tokido', loser: 'NuckleDu', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group G' },
  { winner: 'Leshar', loser: 'Bonchan', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group G' },
  { winner: 'Bonchan', loser: 'NuckleDu', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group G' },
  { winner: 'Leshar', loser: 'Tokido', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group G' },
  { winner: 'Bonchan', loser: 'Tokido', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group G' },
  // Group H
  { winner: 'Higuchi', loser: 'moke', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group H' },
  { winner: 'pugera', loser: 'Big Bird', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group H' },
  { winner: 'moke', loser: 'Big Bird', winner_score: 3, loser_score: 0, phase: 'Phase 1 Group H' },
  { winner: 'Higuchi', loser: 'pugera', winner_score: 3, loser_score: 2, phase: 'Phase 1 Group H' },
  { winner: 'moke', loser: 'pugera', winner_score: 3, loser_score: 1, phase: 'Phase 1 Group H' },

  // ===== SECOND PHASE (20 sets) =====
  // Group A
  { winner: 'Angry Bird', loser: 'Kakeru', winner_score: 3, loser_score: 1, phase: 'Phase 2 Group A' },
  { winner: 'gachikun', loser: 'Dual Kevin', winner_score: 3, loser_score: 1, phase: 'Phase 2 Group A' },
  { winner: 'Kakeru', loser: 'Dual Kevin', winner_score: 3, loser_score: 0, phase: 'Phase 2 Group A' },
  { winner: 'Angry Bird', loser: 'gachikun', winner_score: 3, loser_score: 1, phase: 'Phase 2 Group A' },
  { winner: 'gachikun', loser: 'Kakeru', winner_score: 3, loser_score: 0, phase: 'Phase 2 Group A' },
  // Group B
  { winner: 'Ryukichi', loser: 'Xiao Hai', winner_score: 3, loser_score: 1, phase: 'Phase 2 Group B' },
  { winner: 'NoahTheProdigy', loser: 'Problem-X', winner_score: 3, loser_score: 0, phase: 'Phase 2 Group B' },
  { winner: 'Xiao Hai', loser: 'Problem-X', winner_score: 3, loser_score: 2, phase: 'Phase 2 Group B' },
  { winner: 'Ryukichi', loser: 'NoahTheProdigy', winner_score: 3, loser_score: 1, phase: 'Phase 2 Group B' },
  { winner: 'Xiao Hai', loser: 'NoahTheProdigy', winner_score: 3, loser_score: 2, phase: 'Phase 2 Group B' },
  // Group C
  { winner: 'Hikaru', loser: 'moke', winner_score: 3, loser_score: 1, phase: 'Phase 2 Group C' },
  { winner: 'Kawano', loser: 'Bonchan', winner_score: 3, loser_score: 2, phase: 'Phase 2 Group C' },
  { winner: 'Bonchan', loser: 'moke', winner_score: 3, loser_score: 0, phase: 'Phase 2 Group C' },
  { winner: 'Hikaru', loser: 'Kawano', winner_score: 3, loser_score: 1, phase: 'Phase 2 Group C' },
  { winner: 'Kawano', loser: 'Bonchan', winner_score: 3, loser_score: 2, phase: 'Phase 2 Group C' },
  // Group D
  { winner: 'Higuchi', loser: 'Chris Wong', winner_score: 3, loser_score: 2, phase: 'Phase 2 Group D' },
  { winner: 'Leshar', loser: 'Tachikawa', winner_score: 3, loser_score: 0, phase: 'Phase 2 Group D' },
  { winner: 'Tachikawa', loser: 'Chris Wong', winner_score: 3, loser_score: 0, phase: 'Phase 2 Group D' },
  { winner: 'Higuchi', loser: 'Leshar', winner_score: 3, loser_score: 0, phase: 'Phase 2 Group D' },
  { winner: 'Tachikawa', loser: 'Leshar', winner_score: 3, loser_score: 1, phase: 'Phase 2 Group D' },

  // ===== THIRD PHASE (7 sets) =====
  { winner: 'Tachikawa', loser: 'Angry Bird', winner_score: 5, loser_score: 1, phase: 'Phase 3' },
  { winner: 'Kawano', loser: 'Ryukichi', winner_score: 5, loser_score: 4, phase: 'Phase 3' },
  { winner: 'Xiao Hai', loser: 'Hikaru', winner_score: 5, loser_score: 4, phase: 'Phase 3' },
  { winner: 'gachikun', loser: 'Higuchi', winner_score: 5, loser_score: 1, phase: 'Phase 3' },
  { winner: 'Kawano', loser: 'Tachikawa', winner_score: 5, loser_score: 4, phase: 'Phase 3' },
  { winner: 'Xiao Hai', loser: 'gachikun', winner_score: 5, loser_score: 3, phase: 'Phase 3' },
  { winner: 'Xiao Hai', loser: 'Kawano', winner_score: 5, loser_score: 2, phase: 'Phase 3' },
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
      startgg_set_id: 30000000 + i,
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
