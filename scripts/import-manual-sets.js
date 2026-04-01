import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CC11 sets data (tournament_id = 2)
const TOURNAMENT_ID = 2;

const sets = [
  // ===== GROUP A (15 sets) =====
  // Day 1
  { winner: 'Takamura', loser: 'Phenom', winner_score: 2, loser_score: 1, phase: 'Group A' },
  { winner: 'Salvatore', loser: 'HotDog29', winner_score: 2, loser_score: 0, phase: 'Group A' },
  { winner: 'Punk', loser: 'Itabashi Zangief', winner_score: 2, loser_score: 0, phase: 'Group A' },
  { winner: 'Phenom', loser: 'HotDog29', winner_score: 2, loser_score: 0, phase: 'Group A' },
  { winner: 'Takamura', loser: 'Itabashi Zangief', winner_score: 2, loser_score: 0, phase: 'Group A' },
  // Day 2
  { winner: 'Salvatore', loser: 'Punk', winner_score: 2, loser_score: 0, phase: 'Group A' },
  { winner: 'HotDog29', loser: 'Itabashi Zangief', winner_score: 2, loser_score: 1, phase: 'Group A' },
  { winner: 'Phenom', loser: 'Salvatore', winner_score: 2, loser_score: 1, phase: 'Group A' },
  { winner: 'Punk', loser: 'Takamura', winner_score: 2, loser_score: 1, phase: 'Group A' },
  { winner: 'Itabashi Zangief', loser: 'Phenom', winner_score: 2, loser_score: 1, phase: 'Group A' },
  // Day 3
  { winner: 'HotDog29', loser: 'Punk', winner_score: 2, loser_score: 1, phase: 'Group A' },
  { winner: 'Takamura', loser: 'Salvatore', winner_score: 2, loser_score: 0, phase: 'Group A' },
  { winner: 'Phenom', loser: 'Punk', winner_score: 2, loser_score: 0, phase: 'Group A' },
  { winner: 'Itabashi Zangief', loser: 'Salvatore', winner_score: 2, loser_score: 1, phase: 'Group A' },
  { winner: 'Takamura', loser: 'HotDog29', winner_score: 2, loser_score: 0, phase: 'Group A' },

  // ===== GROUP B (15 sets) =====
  // Day 1
  { winner: 'Si Anik', loser: 'S4ltyKiD', winner_score: 2, loser_score: 1, phase: 'Group B' },
  { winner: 'NL', loser: 'GranTODAKAI', winner_score: 2, loser_score: 0, phase: 'Group B' },
  { winner: 'NoahTheProdigy', loser: 'JB', winner_score: 2, loser_score: 0, phase: 'Group B' },
  { winner: 'S4ltyKiD', loser: 'NL', winner_score: 2, loser_score: 1, phase: 'Group B' },
  { winner: 'JB', loser: 'Si Anik', winner_score: 2, loser_score: 0, phase: 'Group B' },
  // Day 2
  { winner: 'GranTODAKAI', loser: 'NoahTheProdigy', winner_score: 2, loser_score: 0, phase: 'Group B' },
  { winner: 'NL', loser: 'JB', winner_score: 2, loser_score: 0, phase: 'Group B' },
  { winner: 'GranTODAKAI', loser: 'S4ltyKiD', winner_score: 2, loser_score: 1, phase: 'Group B' },
  { winner: 'NoahTheProdigy', loser: 'Si Anik', winner_score: 2, loser_score: 0, phase: 'Group B' },
  { winner: 'JB', loser: 'S4ltyKiD', winner_score: 2, loser_score: 0, phase: 'Group B' },
  // Day 3
  { winner: 'NoahTheProdigy', loser: 'NL', winner_score: 2, loser_score: 1, phase: 'Group B' },
  { winner: 'GranTODAKAI', loser: 'Si Anik', winner_score: 2, loser_score: 1, phase: 'Group B' },
  { winner: 'NoahTheProdigy', loser: 'S4ltyKiD', winner_score: 2, loser_score: 0, phase: 'Group B' },
  { winner: 'JB', loser: 'GranTODAKAI', winner_score: 2, loser_score: 1, phase: 'Group B' },
  { winner: 'NL', loser: 'Si Anik', winner_score: 2, loser_score: 0, phase: 'Group B' },

  // ===== GROUP C (15 sets) =====
  // Day 1
  { winner: 'JabhiM', loser: 'GGHalibel', winner_score: 2, loser_score: 1, phase: 'Group C' },
  { winner: 'Kakeru', loser: 'Zangief_bolado', winner_score: 2, loser_score: 0, phase: 'Group C' },
  { winner: 'Tokido', loser: 'Dual Kevin', winner_score: 2, loser_score: 1, phase: 'Group C' },
  { winner: 'Kakeru', loser: 'GGHalibel', winner_score: 2, loser_score: 0, phase: 'Group C' },
  { winner: 'Dual Kevin', loser: 'JabhiM', winner_score: 2, loser_score: 1, phase: 'Group C' },
  // Day 2
  { winner: 'Zangief_bolado', loser: 'Tokido', winner_score: 2, loser_score: 1, phase: 'Group C' },
  { winner: 'Kakeru', loser: 'Dual Kevin', winner_score: 2, loser_score: 1, phase: 'Group C' },
  { winner: 'GGHalibel', loser: 'Zangief_bolado', winner_score: 2, loser_score: 0, phase: 'Group C' },
  { winner: 'JabhiM', loser: 'Tokido', winner_score: 2, loser_score: 0, phase: 'Group C' },
  { winner: 'Dual Kevin', loser: 'GGHalibel', winner_score: 2, loser_score: 0, phase: 'Group C' },
  // Day 3
  { winner: 'Tokido', loser: 'Kakeru', winner_score: 2, loser_score: 1, phase: 'Group C' },
  { winner: 'Zangief_bolado', loser: 'JabhiM', winner_score: 2, loser_score: 1, phase: 'Group C' },
  { winner: 'Tokido', loser: 'GGHalibel', winner_score: 2, loser_score: 0, phase: 'Group C' },
  { winner: 'Zangief_bolado', loser: 'Dual Kevin', winner_score: 2, loser_score: 0, phase: 'Group C' },
  { winner: 'Kakeru', loser: 'JabhiM', winner_score: 2, loser_score: 0, phase: 'Group C' },

  // ===== GROUP D (15 sets) =====
  // Day 1
  { winner: 'broski', loser: 'Bravery', winner_score: 2, loser_score: 1, phase: 'Group D' },
  { winner: 'Blaz', loser: 'Vxbao', winner_score: 2, loser_score: 1, phase: 'Group D' },
  { winner: 'Armperor', loser: 'iDom', winner_score: 2, loser_score: 1, phase: 'Group D' },
  { winner: 'broski', loser: 'Vxbao', winner_score: 2, loser_score: 0, phase: 'Group D' },
  { winner: 'Bravery', loser: 'iDom', winner_score: 2, loser_score: 1, phase: 'Group D' },
  // Day 2
  { winner: 'Blaz', loser: 'Armperor', winner_score: 2, loser_score: 1, phase: 'Group D' },
  { winner: 'Vxbao', loser: 'iDom', winner_score: 2, loser_score: 0, phase: 'Group D' },
  { winner: 'Blaz', loser: 'broski', winner_score: 2, loser_score: 1, phase: 'Group D' },
  { winner: 'Bravery', loser: 'Armperor', winner_score: 2, loser_score: 1, phase: 'Group D' },
  { winner: 'iDom', loser: 'broski', winner_score: 2, loser_score: 1, phase: 'Group D' },
  // Day 3
  { winner: 'Vxbao', loser: 'Armperor', winner_score: 2, loser_score: 0, phase: 'Group D' },
  { winner: 'Blaz', loser: 'Bravery', winner_score: 2, loser_score: 0, phase: 'Group D' },
  { winner: 'broski', loser: 'Armperor', winner_score: 2, loser_score: 0, phase: 'Group D' },
  { winner: 'Blaz', loser: 'iDom', winner_score: 2, loser_score: 0, phase: 'Group D' },
  { winner: 'Vxbao', loser: 'Bravery', winner_score: 2, loser_score: 0, phase: 'Group D' },

  // ===== GROUP E (15 sets) =====
  // Day 1
  { winner: 'Mister Crimson', loser: 'Deiver', winner_score: 2, loser_score: 0, phase: 'Group E' },
  { winner: 'Fuudo', loser: 'Limestone', winner_score: 2, loser_score: 0, phase: 'Group E' },
  { winner: 'MenaRD', loser: 'ChrisCCH', winner_score: 2, loser_score: 0, phase: 'Group E' },
  { winner: 'Fuudo', loser: 'Mister Crimson', winner_score: 2, loser_score: 0, phase: 'Group E' },
  { winner: 'Deiver', loser: 'ChrisCCH', winner_score: 2, loser_score: 1, phase: 'Group E' },
  // Day 2
  { winner: 'Limestone', loser: 'MenaRD', winner_score: 2, loser_score: 1, phase: 'Group E' },
  { winner: 'Fuudo', loser: 'ChrisCCH', winner_score: 2, loser_score: 1, phase: 'Group E' },
  { winner: 'Mister Crimson', loser: 'Limestone', winner_score: 2, loser_score: 1, phase: 'Group E' },
  { winner: 'MenaRD', loser: 'Deiver', winner_score: 2, loser_score: 0, phase: 'Group E' },
  { winner: 'ChrisCCH', loser: 'Mister Crimson', winner_score: 2, loser_score: 1, phase: 'Group E' },
  // Day 3
  { winner: 'Fuudo', loser: 'Deiver', winner_score: 2, loser_score: 0, phase: 'Group E' },
  { winner: 'ChrisCCH', loser: 'Limestone', winner_score: 2, loser_score: 1, phase: 'Group E' },
  { winner: 'MenaRD', loser: 'Mister Crimson', winner_score: 2, loser_score: 0, phase: 'Group E' },
  { winner: 'Limestone', loser: 'Deiver', winner_score: 2, loser_score: 0, phase: 'Group E' },
  { winner: 'Fuudo', loser: 'MenaRD', winner_score: 2, loser_score: 0, phase: 'Group E' },

  // ===== GROUP F (15 sets) =====
  // Day 1
  { winner: 'Big Bird', loser: 'Oil King', winner_score: 2, loser_score: 0, phase: 'Group F' },
  { winner: 'Xian', loser: 'Uriel Velorio', winner_score: 2, loser_score: 0, phase: 'Group F' },
  { winner: 'JAK', loser: 'Leshar', winner_score: 2, loser_score: 0, phase: 'Group F' },
  { winner: 'Xian', loser: 'Big Bird', winner_score: 2, loser_score: 1, phase: 'Group F' },
  { winner: 'Oil King', loser: 'JAK', winner_score: 2, loser_score: 1, phase: 'Group F' },
  // Day 2
  { winner: 'Leshar', loser: 'Uriel Velorio', winner_score: 2, loser_score: 0, phase: 'Group F' },
  { winner: 'Xian', loser: 'JAK', winner_score: 2, loser_score: 0, phase: 'Group F' },
  { winner: 'Big Bird', loser: 'Uriel Velorio', winner_score: 2, loser_score: 1, phase: 'Group F' },
  { winner: 'Leshar', loser: 'Oil King', winner_score: 2, loser_score: 0, phase: 'Group F' },
  { winner: 'Big Bird', loser: 'JAK', winner_score: 2, loser_score: 1, phase: 'Group F' },
  // Day 3
  { winner: 'Leshar', loser: 'Xian', winner_score: 2, loser_score: 0, phase: 'Group F' },
  { winner: 'Oil King', loser: 'Uriel Velorio', winner_score: 2, loser_score: 0, phase: 'Group F' },
  { winner: 'Leshar', loser: 'Big Bird', winner_score: 2, loser_score: 0, phase: 'Group F' },
  { winner: 'JAK', loser: 'Uriel Velorio', winner_score: 2, loser_score: 1, phase: 'Group F' },
  { winner: 'Xian', loser: 'Oil King', winner_score: 2, loser_score: 0, phase: 'Group F' },

  // ===== GROUP G (15 sets) =====
  // Day 1
  { winner: 'Juicyjoe', loser: 'Kilzyou', winner_score: 2, loser_score: 1, phase: 'Group G' },
  { winner: 'Xiaohai', loser: 'Caba', winner_score: 2, loser_score: 1, phase: 'Group G' },
  { winner: 'NuckleDu', loser: 'Nephew', winner_score: 2, loser_score: 0, phase: 'Group G' },
  { winner: 'Xiaohai', loser: 'Juicyjoe', winner_score: 2, loser_score: 1, phase: 'Group G' },
  { winner: 'NuckleDu', loser: 'Kilzyou', winner_score: 2, loser_score: 1, phase: 'Group G' },
  // Day 2
  { winner: 'Caba', loser: 'Nephew', winner_score: 2, loser_score: 1, phase: 'Group G' },
  { winner: 'Xiaohai', loser: 'NuckleDu', winner_score: 2, loser_score: 1, phase: 'Group G' },
  { winner: 'Juicyjoe', loser: 'Caba', winner_score: 2, loser_score: 1, phase: 'Group G' },
  { winner: 'Nephew', loser: 'Kilzyou', winner_score: 2, loser_score: 1, phase: 'Group G' },
  { winner: 'Juicyjoe', loser: 'NuckleDu', winner_score: 2, loser_score: 0, phase: 'Group G' },
  // Day 3
  { winner: 'Nephew', loser: 'Xiaohai', winner_score: 2, loser_score: 1, phase: 'Group G' },
  { winner: 'Kilzyou', loser: 'Caba', winner_score: 2, loser_score: 1, phase: 'Group G' },
  { winner: 'Juicyjoe', loser: 'Nephew', winner_score: 2, loser_score: 1, phase: 'Group G' },
  { winner: 'Caba', loser: 'NuckleDu', winner_score: 2, loser_score: 1, phase: 'Group G' },
  { winner: 'Kilzyou', loser: 'Xiaohai', winner_score: 2, loser_score: 0, phase: 'Group G' },

  // ===== GROUP H (15 sets) =====
  // Day 1
  { winner: 'Shuto', loser: 'Angry Bird', winner_score: 2, loser_score: 1, phase: 'Group H' },
  { winner: 'Lexx', loser: 'Sole', winner_score: 2, loser_score: 0, phase: 'Group H' },
  { winner: 'Shuto', loser: 'Kusanagi', winner_score: 2, loser_score: 1, phase: 'Group H' },
  { winner: 'JUNINHO-RAS', loser: 'Sole', winner_score: 2, loser_score: 1, phase: 'Group H' },
  { winner: 'Angry Bird', loser: 'Lexx', winner_score: 2, loser_score: 0, phase: 'Group H' },
  // Day 2
  { winner: 'Shuto', loser: 'Lexx', winner_score: 2, loser_score: 1, phase: 'Group H' },
  { winner: 'Angry Bird', loser: 'Kusanagi', winner_score: 2, loser_score: 0, phase: 'Group H' },
  { winner: 'JUNINHO-RAS', loser: 'Lexx', winner_score: 2, loser_score: 1, phase: 'Group H' },
  { winner: 'Sole', loser: 'Shuto', winner_score: 2, loser_score: 1, phase: 'Group H' },
  { winner: 'JUNINHO-RAS', loser: 'Kusanagi', winner_score: 2, loser_score: 0, phase: 'Group H' },
  // Day 3
  { winner: 'Angry Bird', loser: 'Sole', winner_score: 2, loser_score: 0, phase: 'Group H' },
  { winner: 'Shuto', loser: 'JUNINHO-RAS', winner_score: 2, loser_score: 0, phase: 'Group H' },
  { winner: 'Lexx', loser: 'Kusanagi', winner_score: 2, loser_score: 1, phase: 'Group H' },
  { winner: 'Angry Bird', loser: 'JUNINHO-RAS', winner_score: 2, loser_score: 0, phase: 'Group H' },
  { winner: 'Sole', loser: 'Kusanagi', winner_score: 2, loser_score: 0, phase: 'Group H' },

  // ===== TOP 16 BRACKET (23 sets) =====
  // Winners QF
  { winner: 'NoahTheProdigy', loser: 'Takamura', winner_score: 3, loser_score: 1, phase: 'Top 16' },
  { winner: 'Kakeru', loser: 'Blaz', winner_score: 3, loser_score: 0, phase: 'Top 16' },
  { winner: 'Leshar', loser: 'Fuudo', winner_score: 3, loser_score: 2, phase: 'Top 16' },
  { winner: 'Juicyjoe', loser: 'Angry Bird', winner_score: 3, loser_score: 2, phase: 'Top 16' },
  // Winners SF
  { winner: 'Kakeru', loser: 'NoahTheProdigy', winner_score: 3, loser_score: 0, phase: 'Top 16' },
  { winner: 'Leshar', loser: 'Juicyjoe', winner_score: 3, loser_score: 0, phase: 'Top 16' },
  // Winners Final
  { winner: 'Kakeru', loser: 'Leshar', winner_score: 3, loser_score: 0, phase: 'Top 16' },
  // Losers R1
  { winner: 'NL', loser: 'Phenom', winner_score: 3, loser_score: 2, phase: 'Top 16' },
  { winner: 'Tokido', loser: 'broski', winner_score: 3, loser_score: 1, phase: 'Top 16' },
  { winner: 'Xian', loser: 'MenaRD', winner_score: 3, loser_score: 2, phase: 'Top 16' },
  { winner: 'Shuto', loser: 'Xiaohai', winner_score: 3, loser_score: 1, phase: 'Top 16' },
  // Losers R2
  { winner: 'Angry Bird', loser: 'NL', winner_score: 3, loser_score: 2, phase: 'Top 16' },
  { winner: 'Tokido', loser: 'Fuudo', winner_score: 3, loser_score: 2, phase: 'Top 16' },
  { winner: 'Blaz', loser: 'Xian', winner_score: 3, loser_score: 0, phase: 'Top 16' },
  { winner: 'Shuto', loser: 'Takamura', winner_score: 3, loser_score: 2, phase: 'Top 16' },
  // Losers R3
  { winner: 'Angry Bird', loser: 'Tokido', winner_score: 3, loser_score: 1, phase: 'Top 16' },
  { winner: 'Blaz', loser: 'Shuto', winner_score: 3, loser_score: 2, phase: 'Top 16' },
  // Losers QF
  { winner: 'Angry Bird', loser: 'Juicyjoe', winner_score: 3, loser_score: 1, phase: 'Top 16' },
  { winner: 'Blaz', loser: 'NoahTheProdigy', winner_score: 3, loser_score: 0, phase: 'Top 16' },
  // Losers SF
  { winner: 'Blaz', loser: 'Angry Bird', winner_score: 3, loser_score: 0, phase: 'Top 16' },
  // Losers Final
  { winner: 'Blaz', loser: 'Leshar', winner_score: 3, loser_score: 0, phase: 'Top 16' },
  // Grand Final
  { winner: 'Kakeru', loser: 'Blaz', winner_score: 3, loser_score: 1, phase: 'Top 16' },
  // Note: GF was 1 set (Kakeru from winners side)
];

async function importManualSets() {
  // Load all players
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
      startgg_set_id: 20000000 + i, // manual unique ID
      round_text: s.phase,
      display_score: `${s.winner} ${s.winner_score} - ${s.loser_score} ${s.loser}`,
      winner_id: winner.id,
      loser_id: loser.id,
      winner_score: s.winner_score,
      loser_score: s.loser_score,
      phase_name: s.phase,
    });
  }

  // Batch upsert
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
