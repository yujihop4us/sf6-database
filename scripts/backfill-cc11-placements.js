/**
 * backfill-cc11-placements.js
 *
 * Computes placement and prize_amount for all CC11 entrants from set data
 * and writes them back to tournament_entrants.
 *
 * CC11 format:
 *   Group Stage: 8 groups × 6 players, round-robin (FT2)
 *     - 1st in group → Winners side of Top 16
 *     - 2nd in group → Losers side of Top 16
 *     - 3rd → placement 17 ($2,000)
 *     - 4th → placement 25 ($1,750)
 *     - 5th → placement 33 ($1,500)
 *     - 6th → placement 41 ($1,500)
 *   Finals: Top 16, double-elimination (FT3)
 *     - Placements 1–16 inferred from bracket set order
 *
 * Prize pool (USD):
 *   1st: 1,000,000 / 2nd: 100,000 / 3rd: 50,000 / 4th: 20,000
 *   5–6: 10,000 / 7–8: 5,000 / 9–12: 4,000 / 13–16: 3,000
 *   17–24: 2,000 / 25–32: 1,750 / 33–40: 1,500 / 41–48: 1,500
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const TOURNAMENT_ID = 2;

// ── Prize pool ────────────────────────────────────────────────────
const PRIZE_POOL = [
  { places: [1],           prize: 1_000_000 },
  { places: [2],           prize:   100_000 },
  { places: [3],           prize:    50_000 },
  { places: [4],           prize:    20_000 },
  { places: [5, 6],        prize:    10_000 },
  { places: [7, 8],        prize:     5_000 },
  { places: [9,10,11,12],  prize:     4_000 },
  { places: [13,14,15,16], prize:     3_000 },
  { places: Array.from({length: 8}, (_,i) => 17+i), prize: 2_000 },
  { places: Array.from({length: 8}, (_,i) => 25+i), prize: 1_750 },
  { places: Array.from({length: 8}, (_,i) => 33+i), prize: 1_500 },
  { places: Array.from({length: 8}, (_,i) => 41+i), prize: 1_500 },
];

function prizeForPlacement(p) {
  const row = PRIZE_POOL.find(r => r.places.includes(p));
  return row?.prize ?? null;
}

// ── Group stage: compute rankings within each group ───────────────
function computeGroupRankings(groupSets) {
  // groupSets: all sets in one group phase
  const wins    = {};
  const gameDiff = {};
  const players = new Set();

  for (const s of groupSets) {
    if (!s.winner_id || !s.loser_id) continue;
    players.add(s.winner_id);
    players.add(s.loser_id);
    wins[s.winner_id]    = (wins[s.winner_id] ?? 0) + 1;
    wins[s.loser_id]     = (wins[s.loser_id]  ?? 0);
    // game score differential (winner - loser within each set)
    const wScore = s.winner_score ?? 2;
    const lScore = s.loser_score  ?? 0;
    gameDiff[s.winner_id] = (gameDiff[s.winner_id] ?? 0) + (wScore - lScore);
    gameDiff[s.loser_id]  = (gameDiff[s.loser_id]  ?? 0) - (wScore - lScore);
  }

  // Sort by wins desc, then game diff desc
  return [...players].sort((a, b) => {
    const wDiff = (wins[b] ?? 0) - (wins[a] ?? 0);
    if (wDiff !== 0) return wDiff;
    return (gameDiff[b] ?? 0) - (gameDiff[a] ?? 0);
  });
}

// ── Bracket: infer placements 1–16 from Top 16 sets ──────────────
function inferBracketPlacements(bracketSets) {
  if (bracketSets.length === 0) return new Map();

  const sorted = [...bracketSets].sort((a, b) => a.id - b.id);

  const losses = {};
  const lastLossId = {};

  for (const s of sorted) {
    if (s.loser_id) {
      losses[s.loser_id]  = (losses[s.loser_id]  ?? 0) + 1;
      lastLossId[s.loser_id] = s.id;
    }
  }

  const maxLosses = Math.max(...Object.values(losses), 1);

  const allPlayers = [...new Set([
    ...sorted.map(s => s.winner_id).filter(Boolean),
    ...sorted.map(s => s.loser_id).filter(Boolean),
  ])];

  // Grand Final is the last set
  const gf = sorted[sorted.length - 1];
  const champion   = gf?.winner_id;
  const runnerUp   = gf?.loser_id;

  const placementMap = new Map();
  if (champion) placementMap.set(champion, 1);
  if (runnerUp) placementMap.set(runnerUp, 2);

  // Everyone else sorted by when they were eliminated (later = better placement)
  const eliminated = allPlayers
    .filter(pid => !placementMap.has(pid))
    .sort((a, b) => {
      const aL = losses[a] ?? 0;
      const bL = losses[b] ?? 0;
      if (aL !== bL) return aL - bL; // fewer losses = better
      return (lastLossId[b] ?? 0) - (lastLossId[a] ?? 0); // later loss = better
    });

  let rank = 3;
  for (const pid of eliminated) {
    placementMap.set(pid, rank++);
  }

  return placementMap;
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const DRY_RUN = process.argv.includes('--dry-run');

  console.log('════════════════════════════════════════════════');
  console.log(' CC11 Placement & Prize Backfill');
  if (DRY_RUN) console.log(' MODE: --dry-run (no DB writes)');
  console.log('════════════════════════════════════════════════\n');

  // Load sets
  const { data: sets, error: sErr } = await supabase
    .from('tournament_sets')
    .select('id, phase_name, winner_id, loser_id, winner_score, loser_score')
    .eq('tournament_id', TOURNAMENT_ID);
  if (sErr) throw new Error(sErr.message);
  console.log(`📋 Loaded ${sets.length} sets`);

  // Load entrants (player_id → entrant_id)
  const { data: entrants, error: eErr } = await supabase
    .from('tournament_entrants')
    .select('id, player_id, placement, prize_amount')
    .eq('tournament_id', TOURNAMENT_ID);
  if (eErr) throw new Error(eErr.message);
  console.log(`📋 Loaded ${entrants.length} entrants\n`);

  const entrantByPlayer = new Map(entrants.map(e => [e.player_id, e]));

  const finalPlacements = new Map(); // player_id → placement

  // ── Group Stage ──
  const GROUPS = ['Group A','Group B','Group C','Group D','Group E','Group F','Group G','Group H'];

  // Group rank → placement range start
  // Ranks 0,1 (1st,2nd) advance to Top 16 — handled by bracket
  const GROUP_PLACEMENT = { 2: 17, 3: 25, 4: 33, 5: 41 }; // 0-indexed rank

  let advancedPlayers = new Set();

  for (const group of GROUPS) {
    const groupSets = sets.filter(s => s.phase_name === group);
    const ranked = computeGroupRankings(groupSets);

    console.log(`${group}: ${ranked.length} players`);

    for (let i = 0; i < ranked.length; i++) {
      const pid = ranked[i];
      if (i <= 1) {
        // Top 2 advance to bracket — placement determined by bracket
        advancedPlayers.add(pid);
        console.log(`  Rank ${i+1} (advances): player ${pid}`);
      } else {
        const placement = GROUP_PLACEMENT[i];
        finalPlacements.set(pid, placement);
        console.log(`  Rank ${i+1} → placement ${placement} ($${prizeForPlacement(placement)?.toLocaleString()}): player ${pid}`);
      }
    }
  }

  // ── Top 16 Bracket ──
  const bracketSets = sets.filter(s => s.phase_name === 'Top 16');
  const bracketPlacements = inferBracketPlacements(bracketSets);

  console.log('\n🏆 Bracket placements (Top 16):');
  for (const [pid, place] of [...bracketPlacements.entries()].sort((a,b) => a[1]-b[1])) {
    finalPlacements.set(pid, place);
    console.log(`  ${place}位: player ${pid} ($${prizeForPlacement(place)?.toLocaleString()})`);
  }

  // ── Build updates ──
  console.log('\n📊 Building updates...');
  const updates = [];
  let noEntrant = 0;

  for (const [playerId, placement] of finalPlacements) {
    const entrant = entrantByPlayer.get(playerId);
    if (!entrant) { noEntrant++; continue; }
    const prize = prizeForPlacement(placement);
    updates.push({ id: entrant.id, placement, prize_amount: prize });
  }

  console.log(`  Updates to apply: ${updates.length}`);
  console.log(`  Players not in entrants: ${noEntrant}`);

  if (DRY_RUN) {
    console.log('\n[dry-run] Sample:');
    updates.slice(0, 8).forEach(u =>
      console.log(`  entrant ${u.id}: placement=${u.placement}, prize=$${u.prize_amount?.toLocaleString()}`)
    );
    console.log('\nRemove --dry-run to apply.');
    return;
  }

  // ── Apply ──
  console.log('\n💾 Applying updates...');
  let updated = 0, errors = 0;

  for (const u of updates) {
    const { error } = await supabase
      .from('tournament_entrants')
      .update({ placement: u.placement, prize_amount: u.prize_amount })
      .eq('id', u.id);
    if (error) { console.log(`  ⚠️  entrant ${u.id}: ${error.message}`); errors++; }
    else updated++;
  }

  console.log(`\n✅ Done! Updated ${updated} entrants. Errors: ${errors}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
