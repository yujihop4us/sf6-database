import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOURNAMENT_ID = 4;
const ID_OFFSET = 50000000;

// Hardcoded player map (handle used in sets → DB id)
const playerMap = {
  "MenaRD": 8,
  "Latif": 2957,
  "Phenom": 16,
  "Otani": 2786,
  "Nephew": 59,
  "Xian": 824,
  "Mister Crimson": 363,
  "Wess211": 25322,
  "Punk": 7,
  "Zhen": 352,
  "KUDO": 939,
  "Mono": 1933,
  "Kilzyou": 53,
  "VegaPatch": 25323,
  "AngryBird": 6,
  "MOV": 862,
  "Problem X": 58,
  "JabhiM": 52,
  "Big Bird": 10,
  "NuckleDu": 17,
  "Kakeru": 1,
  "Valmaster": 358,
  "Vxbao": 19,
  "NL": 11,
  "Oil King": 356,
  "DCQ": 14,
  "EndingWalker": 56,
  "Takamura": 357,
  "Daigo": 65,
  "The4philzz": 25324,
  "Luffy": 370,
  "HotDog29": 39,
};

const sets = [
  // ===== GROUP A (12 sets) =====
  // Day 1
  { winner: "MenaRD", loser: "Latif", ws: 2, ls: 0, phase: "Group A", round: "Day 1" },
  { winner: "Phenom", loser: "Otani", ws: 2, ls: 0, phase: "Group A", round: "Day 1" },
  { winner: "Latif", loser: "Otani", ws: 2, ls: 1, phase: "Group A", round: "Day 1" },
  { winner: "MenaRD", loser: "Phenom", ws: 2, ls: 1, phase: "Group A", round: "Day 1" },
  { winner: "Phenom", loser: "Latif", ws: 2, ls: 1, phase: "Group A", round: "Day 1" },
  { winner: "MenaRD", loser: "Otani", ws: 2, ls: 1, phase: "Group A", round: "Day 1" },
  // Day 2
  { winner: "MenaRD", loser: "Otani", ws: 2, ls: 1, phase: "Group A", round: "Day 2" },
  { winner: "Phenom", loser: "Latif", ws: 2, ls: 0, phase: "Group A", round: "Day 2" },
  { winner: "MenaRD", loser: "Phenom", ws: 2, ls: 0, phase: "Group A", round: "Day 2" },
  { winner: "Otani", loser: "Latif", ws: 2, ls: 1, phase: "Group A", round: "Day 2" },
  // Day 3
  { winner: "Phenom", loser: "Otani", ws: 2, ls: 1, phase: "Group A", round: "Day 3" },
  { winner: "MenaRD", loser: "Latif", ws: 2, ls: 0, phase: "Group A", round: "Day 3" },

  // ===== GROUP B (12 sets) =====
  // Day 1
  { winner: "Xian", loser: "Nephew", ws: 2, ls: 0, phase: "Group B", round: "Day 1" },
  { winner: "Mister Crimson", loser: "Wess211", ws: 2, ls: 0, phase: "Group B", round: "Day 1" },
  { winner: "Xian", loser: "Wess211", ws: 2, ls: 1, phase: "Group B", round: "Day 1" },
  { winner: "Nephew", loser: "Mister Crimson", ws: 2, ls: 1, phase: "Group B", round: "Day 1" },
  { winner: "Mister Crimson", loser: "Xian", ws: 2, ls: 1, phase: "Group B", round: "Day 1" },
  { winner: "Nephew", loser: "Wess211", ws: 2, ls: 0, phase: "Group B", round: "Day 1" },
  // Day 2
  { winner: "Wess211", loser: "Nephew", ws: 2, ls: 1, phase: "Group B", round: "Day 2" },
  { winner: "Xian", loser: "Mister Crimson", ws: 2, ls: 1, phase: "Group B", round: "Day 2" },
  { winner: "Nephew", loser: "Mister Crimson", ws: 2, ls: 1, phase: "Group B", round: "Day 2" },
  { winner: "Xian", loser: "Wess211", ws: 2, ls: 0, phase: "Group B", round: "Day 2" },
  { winner: "Mister Crimson", loser: "Wess211", ws: 2, ls: 1, phase: "Group B", round: "Day 2" },
  { winner: "Nephew", loser: "Xian", ws: 2, ls: 0, phase: "Group B", round: "Day 2" },

  // ===== GROUP C (12 sets) =====
  // Day 1
  { winner: "Zhen", loser: "Punk", ws: 2, ls: 0, phase: "Group C", round: "Day 1" },
  { winner: "Mono", loser: "KUDO", ws: 2, ls: 1, phase: "Group C", round: "Day 1" },
  { winner: "Zhen", loser: "Mono", ws: 2, ls: 1, phase: "Group C", round: "Day 1" },
  { winner: "Punk", loser: "KUDO", ws: 2, ls: 1, phase: "Group C", round: "Day 1" },
  { winner: "KUDO", loser: "Zhen", ws: 2, ls: 1, phase: "Group C", round: "Day 1" },
  { winner: "Mono", loser: "Punk", ws: 2, ls: 1, phase: "Group C", round: "Day 1" },
  // Day 2
  { winner: "Punk", loser: "Mono", ws: 2, ls: 0, phase: "Group C", round: "Day 2" },
  { winner: "Zhen", loser: "KUDO", ws: 2, ls: 1, phase: "Group C", round: "Day 2" },
  { winner: "Punk", loser: "KUDO", ws: 2, ls: 1, phase: "Group C", round: "Day 2" },
  { winner: "Zhen", loser: "Mono", ws: 2, ls: 1, phase: "Group C", round: "Day 2" },
  { winner: "KUDO", loser: "Mono", ws: 2, ls: 0, phase: "Group C", round: "Day 2" },
  { winner: "Zhen", loser: "Punk", ws: 2, ls: 0, phase: "Group C", round: "Day 2" },

  // ===== GROUP D (12 sets) =====
  // Day 1
  { winner: "VegaPatch", loser: "Kilzyou", ws: 2, ls: 1, phase: "Group D", round: "Day 1" },
  { winner: "AngryBird", loser: "MOV", ws: 2, ls: 1, phase: "Group D", round: "Day 1" },
  { winner: "VegaPatch", loser: "MOV", ws: 2, ls: 0, phase: "Group D", round: "Day 1" },
  { winner: "AngryBird", loser: "Kilzyou", ws: 2, ls: 0, phase: "Group D", round: "Day 1" },
  { winner: "AngryBird", loser: "VegaPatch", ws: 2, ls: 0, phase: "Group D", round: "Day 1" },
  { winner: "Kilzyou", loser: "MOV", ws: 2, ls: 0, phase: "Group D", round: "Day 1" },
  // Day 2
  { winner: "MOV", loser: "Kilzyou", ws: 2, ls: 0, phase: "Group D", round: "Day 2" },
  { winner: "VegaPatch", loser: "AngryBird", ws: 2, ls: 0, phase: "Group D", round: "Day 2" },
  { winner: "Kilzyou", loser: "AngryBird", ws: 2, ls: 0, phase: "Group D", round: "Day 2" },
  { winner: "MOV", loser: "VegaPatch", ws: 2, ls: 1, phase: "Group D", round: "Day 2" },
  // Day 3
  { winner: "AngryBird", loser: "MOV", ws: 2, ls: 1, phase: "Group D", round: "Day 3" },
  { winner: "Kilzyou", loser: "VegaPatch", ws: 2, ls: 0, phase: "Group D", round: "Day 3" },

  // ===== GROUP E (12 sets) =====
  // Day 1
  { winner: "Problem X", loser: "JabhiM", ws: 2, ls: 1, phase: "Group E", round: "Day 1" },
  { winner: "Big Bird", loser: "NuckleDu", ws: 2, ls: 1, phase: "Group E", round: "Day 1" },
  { winner: "NuckleDu", loser: "JabhiM", ws: 2, ls: 1, phase: "Group E", round: "Day 1" },
  { winner: "Big Bird", loser: "Problem X", ws: 2, ls: 0, phase: "Group E", round: "Day 1" },
  { winner: "Big Bird", loser: "JabhiM", ws: 2, ls: 0, phase: "Group E", round: "Day 1" },
  { winner: "NuckleDu", loser: "Problem X", ws: 2, ls: 0, phase: "Group E", round: "Day 1" },
  // Day 2
  { winner: "NuckleDu", loser: "Problem X", ws: 2, ls: 1, phase: "Group E", round: "Day 2" },
  { winner: "Big Bird", loser: "JabhiM", ws: 2, ls: 0, phase: "Group E", round: "Day 2" },
  { winner: "Big Bird", loser: "Problem X", ws: 2, ls: 0, phase: "Group E", round: "Day 2" },
  { winner: "NuckleDu", loser: "JabhiM", ws: 2, ls: 0, phase: "Group E", round: "Day 2" },
  // Day 3
  { winner: "NuckleDu", loser: "Big Bird", ws: 2, ls: 0, phase: "Group E", round: "Day 3" },
  { winner: "Problem X", loser: "JabhiM", ws: 2, ls: 1, phase: "Group E", round: "Day 3" },

  // ===== GROUP F (12 sets) =====
  // Day 1
  { winner: "Kakeru", loser: "Valmaster", ws: 2, ls: 0, phase: "Group F", round: "Day 1" },
  { winner: "NL", loser: "Vxbao", ws: 2, ls: 1, phase: "Group F", round: "Day 1" },
  { winner: "Valmaster", loser: "NL", ws: 2, ls: 1, phase: "Group F", round: "Day 1" },
  { winner: "Vxbao", loser: "Kakeru", ws: 2, ls: 0, phase: "Group F", round: "Day 1" },
  { winner: "Vxbao", loser: "Valmaster", ws: 2, ls: 0, phase: "Group F", round: "Day 1" },
  { winner: "Kakeru", loser: "NL", ws: 2, ls: 1, phase: "Group F", round: "Day 1" },
  // Day 2
  { winner: "Kakeru", loser: "NL", ws: 2, ls: 1, phase: "Group F", round: "Day 2" },
  { winner: "Valmaster", loser: "Vxbao", ws: 2, ls: 0, phase: "Group F", round: "Day 2" },
  { winner: "Vxbao", loser: "Kakeru", ws: 2, ls: 0, phase: "Group F", round: "Day 2" },
  { winner: "Valmaster", loser: "NL", ws: 2, ls: 1, phase: "Group F", round: "Day 2" },
  // Day 3
  { winner: "NL", loser: "Vxbao", ws: 2, ls: 1, phase: "Group F", round: "Day 3" },
  { winner: "Kakeru", loser: "Valmaster", ws: 2, ls: 1, phase: "Group F", round: "Day 3" },

  // ===== GROUP G (12 sets) =====
  // Day 1
  { winner: "DCQ", loser: "Oil King", ws: 2, ls: 0, phase: "Group G", round: "Day 1" },
  { winner: "Takamura", loser: "EndingWalker", ws: 2, ls: 0, phase: "Group G", round: "Day 1" },
  // Day 2
  { winner: "DCQ", loser: "Takamura", ws: 2, ls: 0, phase: "Group G", round: "Day 2" },
  { winner: "EndingWalker", loser: "Oil King", ws: 2, ls: 0, phase: "Group G", round: "Day 2" },
  { winner: "DCQ", loser: "EndingWalker", ws: 2, ls: 0, phase: "Group G", round: "Day 2" },
  { winner: "Takamura", loser: "Oil King", ws: 2, ls: 0, phase: "Group G", round: "Day 2" },
  { winner: "Takamura", loser: "Oil King", ws: 2, ls: 0, phase: "Group G", round: "Day 2" },
  { winner: "EndingWalker", loser: "DCQ", ws: 2, ls: 1, phase: "Group G", round: "Day 2" },
  // Day 3
  { winner: "Oil King", loser: "EndingWalker", ws: 2, ls: 1, phase: "Group G", round: "Day 3" },
  { winner: "DCQ", loser: "Takamura", ws: 2, ls: 0, phase: "Group G", round: "Day 3" },
  { winner: "EndingWalker", loser: "Takamura", ws: 2, ls: 1, phase: "Group G", round: "Day 3" },
  { winner: "Oil King", loser: "DCQ", ws: 2, ls: 1, phase: "Group G", round: "Day 3" },

  // ===== GROUP H (12 sets) =====
  // Day 1
  { winner: "Daigo", loser: "The4philzz", ws: 2, ls: 0, phase: "Group H", round: "Day 1" },
  { winner: "HotDog29", loser: "Luffy", ws: 2, ls: 0, phase: "Group H", round: "Day 1" },
  // Day 2
  { winner: "HotDog29", loser: "The4philzz", ws: 2, ls: 0, phase: "Group H", round: "Day 2" },
  { winner: "Daigo", loser: "Luffy", ws: 2, ls: 1, phase: "Group H", round: "Day 2" },
  { winner: "The4philzz", loser: "Luffy", ws: 2, ls: 0, phase: "Group H", round: "Day 2" },
  { winner: "Daigo", loser: "HotDog29", ws: 2, ls: 1, phase: "Group H", round: "Day 2" },
  { winner: "Daigo", loser: "HotDog29", ws: 2, ls: 0, phase: "Group H", round: "Day 2" },
  { winner: "The4philzz", loser: "Luffy", ws: 2, ls: 1, phase: "Group H", round: "Day 2" },
  // Day 3
  { winner: "Daigo", loser: "Luffy", ws: 2, ls: 1, phase: "Group H", round: "Day 3" },
  { winner: "The4philzz", loser: "HotDog29", ws: 2, ls: 0, phase: "Group H", round: "Day 3" },
  { winner: "Luffy", loser: "HotDog29", ws: 2, ls: 0, phase: "Group H", round: "Day 3" },
  { winner: "The4philzz", loser: "Daigo", ws: 2, ls: 0, phase: "Group H", round: "Day 3" },

  // ===== PLAYOFFS - UPPER BRACKET (15 sets) =====
  // UBR1
  { winner: "MenaRD", loser: "Punk", ws: 3, ls: 0, phase: "Playoffs", round: "UBR1" },
  { winner: "Xian", loser: "The4philzz", ws: 3, ls: 0, phase: "Playoffs", round: "UBR1" },
  { winner: "Kakeru", loser: "Daigo", ws: 3, ls: 1, phase: "Playoffs", round: "UBR1" },
  { winner: "Zhen", loser: "Vxbao", ws: 3, ls: 1, phase: "Playoffs", round: "UBR1" },
  { winner: "NuckleDu", loser: "Takamura", ws: 3, ls: 0, phase: "Playoffs", round: "UBR1" },
  { winner: "DCQ", loser: "Phenom", ws: 3, ls: 2, phase: "Playoffs", round: "UBR1" },
  { winner: "AngryBird", loser: "Nephew", ws: 3, ls: 1, phase: "Playoffs", round: "UBR1" },
  { winner: "Kilzyou", loser: "Big Bird", ws: 3, ls: 0, phase: "Playoffs", round: "UBR1" },
  // UBQF
  { winner: "MenaRD", loser: "Xian", ws: 3, ls: 2, phase: "Playoffs", round: "UBQF" },
  { winner: "Kakeru", loser: "Vxbao", ws: 3, ls: 1, phase: "Playoffs", round: "UBQF" },
  { winner: "DCQ", loser: "NuckleDu", ws: 3, ls: 0, phase: "Playoffs", round: "UBQF" },
  { winner: "AngryBird", loser: "Kilzyou", ws: 3, ls: 2, phase: "Playoffs", round: "UBQF" },
  // UBSF
  { winner: "Kakeru", loser: "MenaRD", ws: 3, ls: 2, phase: "Playoffs", round: "UBSF" },
  { winner: "AngryBird", loser: "DCQ", ws: 3, ls: 0, phase: "Playoffs", round: "UBSF" },
  // UBF
  { winner: "Kakeru", loser: "AngryBird", ws: 3, ls: 0, phase: "Playoffs", round: "UBF" },

  // ===== PLAYOFFS - LOWER BRACKET (13 sets) =====
  // LBR1
  { winner: "Punk", loser: "The4philzz", ws: 3, ls: 0, phase: "Playoffs", round: "LBR1" },
  { winner: "Daigo", loser: "Zhen", ws: 3, ls: 0, phase: "Playoffs", round: "LBR1" },
  { winner: "Takamura", loser: "Phenom", ws: 3, ls: 2, phase: "Playoffs", round: "LBR1" },
  { winner: "Big Bird", loser: "Nephew", ws: 3, ls: 0, phase: "Playoffs", round: "LBR1" },
  // LBR2
  { winner: "Punk", loser: "Kilzyou", ws: 3, ls: 1, phase: "Playoffs", round: "LBR2" },
  { winner: "NuckleDu", loser: "Daigo", ws: 3, ls: 2, phase: "Playoffs", round: "LBR2" },
  { winner: "Big Bird", loser: "Xian", ws: 3, ls: 2, phase: "Playoffs", round: "LBR2" },
  { winner: "Vxbao", loser: "Takamura", ws: 3, ls: 1, phase: "Playoffs", round: "LBR2" },
  // LBQF
  { winner: "Punk", loser: "NuckleDu", ws: 3, ls: 0, phase: "Playoffs", round: "LBQF" },
  { winner: "Big Bird", loser: "Vxbao", ws: 3, ls: 0, phase: "Playoffs", round: "LBQF" },
  // LBSF
  { winner: "Punk", loser: "MenaRD", ws: 3, ls: 2, phase: "Playoffs", round: "LBSF" },
  { winner: "Big Bird", loser: "DCQ", ws: 3, ls: 0, phase: "Playoffs", round: "LBSF" },
  // LBF
  { winner: "Punk", loser: "Big Bird", ws: 3, ls: 0, phase: "Playoffs", round: "LBF" },

  // ===== GRAND FINALS (2 sets) =====
  { winner: "AngryBird", loser: "Kakeru", ws: 3, ls: 1, phase: "Playoffs", round: "Grand Final" },
  { winner: "Kakeru", loser: "AngryBird", ws: 3, ls: 0, phase: "Playoffs", round: "Grand Final Reset" },
];

async function main() {
  // Load all players for verification
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id, handle");
  if (pErr) { console.error(pErr); return; }
  console.log(`Loaded ${players.length} players`);

  const rows = [];
  const notFound = [];

  sets.forEach((s, i) => {
    const wId = playerMap[s.winner];
    const lId = playerMap[s.loser];
    if (!wId) notFound.push(s.winner);
    if (!lId) notFound.push(s.loser);
    if (!wId || !lId) return;

    rows.push({
      tournament_id: TOURNAMENT_ID,
      startgg_set_id: ID_OFFSET + i,
      round_text: s.round,
      phase_name: s.phase,
      winner_id: wId,
      loser_id: lId,
      winner_score: s.ws,
      loser_score: s.ls,
      display_score: `${s.winner} ${s.ws} - ${s.ls} ${s.loser}`,
    });
  });

  if (notFound.length > 0) {
    console.log("Not found in playerMap:", [...new Set(notFound)]);
  }

  // Batch upsert
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("tournament_sets")
      .upsert(batch, { onConflict: "tournament_id,startgg_set_id" });
    if (error) { console.error("Upsert error:", error); return; }
    inserted += batch.length;
  }
  console.log(`Inserted ${inserted} sets for tournament ID ${TOURNAMENT_ID}`);
}

main();
