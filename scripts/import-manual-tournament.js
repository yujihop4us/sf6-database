import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


const tournaments = {
  4: [ // Gamers8 2023
    'MenaRD','Phenom','Otani','Latif','Nephew','Mister Crimson','Xian','Wess211',
    'Punk','Zhen','KUDO','Mono','AngryBird','Kilzyou','MOV','VegaPatch',
    'Big Bird','NuckleDu','Problem X','JabhiM','Kakeru','Vxbao','NL','Valmaster',
    'DCQ','Takamura','EndingWalker','Oil King','Daigo Umehara','HotDog29','Luffy','The4philzz'
  ],
  2: [ // Capcom Cup 11
    'Takamura','Phenom','Salvatore','HotDog29','Itabashi Zangief','Punk',
    'NoahTheProdigy','NL','JB','GranTODAKAI','S4ltyKiD','Si Anik',
    'Kakeru','Tokido','Dual Kevin','JabhiM','GGHalibel','Zangief_bolado',
    'Blaz','Vxbao','broski','Bravery','iDom','Armperor',
    'Fuudo','Mister Crimson','MenaRD','ChrisCCH','Limestone','Deiver',
    'Leshar','Xian','Big Bird','JAK','Oil King','Uriel Velorio',
    'Xiaohai','Juicyjoe','NuckleDu','Kilzyou','Nephew','Caba',
    'Lexx','AngryBird','Sole','Juninho-ras','Shuto','Kusanagi'
  ],
  3: [ // EWC 2024
    'gachikun','Ryukichi','Punk','NL','AngryBird','Problem X','Lexx','Rainpro',
    'NoahTheProdigy','Kakeru','Phenom','Itabashi Zangief','Xiao Hai','Dual Kevin',
    'Zhen','MenaRD','Hikaru','Chris Wong','Vxbao','DCQ','Kawano','Tachikawa',
    'Oil King','Nephew','Leshar','Bonchan','NuckleDu','Tokido','Higuchi','moke',
    'Big Bird','pugera'
  ],
  5: [ // EWC 2025
    'AngryBird','NoahTheProdigy','Latif','NARIKUN',
    'MenaRD','Kawano','Riddles','Momochi',
    'EndingWalker','Big Bird','Dual Kevin','Shuto',
    'Zhen','matsu56','Juicyjoe','Psycho',
    'Xiaohai','Punk','Tachikawa','Kakeru',
    'Torimeshi','moke','gachikun','Jr.',
    'YHC-Mochi','Tokido','Hikaru','Nephew',
    'Blaz','GO1','Craime','Phenom',
    'Itabashi Zangief','NL','Hurricane','Shine',
    'Leshar','Higuchi','Kintyo','Veggey',
    'Fuudo','DCQ','Ryukichi','Kusanagi',
    'Bonchan','pugera','vWsym','Micky'
  ],
};

async function importManual() {
  // Load all players
  let allPlayers = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id, handle')
      .range(from, from + pageSize - 1);
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

  for (const [tid, handles] of Object.entries(tournaments)) {
    const tournamentId = Number(tid);
    console.log(`\n🏆 Tournament ID: ${tournamentId} (${handles.length} players)`);
    
    let inserted = 0, skipped = 0, notFound = [];

    for (const handle of handles) {
      const player = handleMap.get(handle.toLowerCase());
      if (!player) {
        notFound.push(handle);
        continue;
      }

      const { error } = await supabase
        .from('tournament_entrants')
        .upsert(
          { tournament_id: tournamentId, player_id: player.id },
          { onConflict: 'tournament_id,player_id' }
        );

      if (error) {
        console.log(`   ⚠️ Error for ${handle}: ${error.message}`);
        skipped++;
      } else {
        inserted++;
      }
    }

    console.log(`   ✅ Inserted: ${inserted}, Skipped: ${skipped}`);
    if (notFound.length > 0) {
      console.log(`   ❌ Not found in DB: ${notFound.join(', ')}`);
    }
  }
}

importManual().catch(console.error);
