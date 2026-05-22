/**
 * backfill-placements.js
 *
 * Computes placement and prize_amount for tournament entrants from set data.
 *
 * Usage: node scripts/backfill-placements.js <tournament-id> [--dry-run]
 *
 * Supported IDs:
 *   2 - Capcom Cup 11           (group stage + double-elim Top 16)
 *   3 - Esports World Cup 2024  (multi-group stage + single-elim Phase 3)
 *   4 - Gamers8 2023            (group stage + double-elim Playoffs)
 *   5 - Esports World Cup 2025  (multi-group stage + single-elim Phase 3 w/ 3rd-place match)
 *   7 - Evo 2024                (placements already in DB; prize_amount only)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── Tournament Configurations ─────────────────────────────────────────────────

const CONFIGS = {
  // Capcom Cup 11
  2: {
    name: 'Capcom Cup 11',
    skipPlacement: false,
    groupPhases: [
      {
        groups: ['Group A','Group B','Group C','Group D','Group E','Group F','Group G','Group H'],
        advance: 2,
        // 0-indexed rank → placement for non-advancing players
        rankPlacement: { 2: 17, 3: 25, 4: 33, 5: 41 },
      },
    ],
    bracketPhase: 'Top 16',
    // bracketRounds: groups of eliminated players (best → worst), sorted by lastLossSetIdx DESC
    // CC11 uses a DE format where WB Final loser plays LB champion before Grand Final
    bracketRounds: [
      { playerCount: 1, placement: 2  }, // GF loser
      { playerCount: 1, placement: 3  }, // GF prelim loser (WB finalist)
      { playerCount: 1, placement: 4  }, // LB Final loser
      { playerCount: 2, placement: 5  }, // LB SF losers
      { playerCount: 2, placement: 7  }, // LB QF losers
      { playerCount: 4, placement: 9  }, // LB R2 losers
      { playerCount: 4, placement: 13 }, // LB R1 losers
    ],
    prizePool: [
      { range: [1,  1],  prize: 1_000_000 },
      { range: [2,  2],  prize:   100_000 },
      { range: [3,  3],  prize:    50_000 },
      { range: [4,  4],  prize:    20_000 },
      { range: [5,  6],  prize:    10_000 },
      { range: [7,  8],  prize:     5_000 },
      { range: [9,  12], prize:     4_000 },
      { range: [13, 16], prize:     3_000 },
      { range: [17, 24], prize:     2_000 },
      { range: [25, 32], prize:     1_750 },
      { range: [33, 40], prize:     1_500 },
      { range: [41, 48], prize:     1_500 },
    ],
  },

  // Esports World Cup 2024 (SF6)
  3: {
    name: 'Esports World Cup 2024 (SF6)',
    skipPlacement: false,
    groupPhases: [
      {
        groups: ['Phase 1 Group A','Phase 1 Group B','Phase 1 Group C','Phase 1 Group D',
                 'Phase 1 Group E','Phase 1 Group F','Phase 1 Group G','Phase 1 Group H'],
        advance: 2,
        rankPlacement: { 2: 17, 3: 25 },
      },
      {
        groups: ['Phase 2 Group A','Phase 2 Group B','Phase 2 Group C','Phase 2 Group D'],
        advance: 2,
        rankPlacement: { 2: 9, 3: 13 },
      },
    ],
    bracketPhase: 'Phase 3',
    // Single-elim 8-player bracket: QF(4 sets) + SF(2 sets) + GF(1 set)
    bracketRounds: [
      { playerCount: 1, placement: 2 }, // GF loser
      { playerCount: 2, placement: 3 }, // SF losers
      { playerCount: 4, placement: 5 }, // QF losers
    ],
    prizePool: [
      { range: [1,  1],  prize: 300_000 },
      { range: [2,  2],  prize: 140_000 },
      { range: [3,  4],  prize:  75_000 },
      { range: [5,  8],  prize:  45_000 },
      { range: [9,  12], prize:  20_000 },
      { range: [13, 16], prize:  12_500 },
      { range: [17, 24], prize:   7_500 },
      { range: [25, 32], prize:   5_000 },
    ],
  },

  // Gamers8 2023
  // Format: 8 groups (4 players each, double round-robin) → 16-player double-elim Playoffs
  // NOTE: The LBF set (player 6 vs player 7) is missing from the DB.
  //       Player 7 (LBF loser = 3rd) is assigned via manualPlacements.
  4: {
    name: 'Gamers8 2023',
    skipPlacement: false,
    groupPhases: [
      {
        groups: ['Group A','Group B','Group C','Group D','Group E','Group F','Group G','Group H'],
        advance: 2,
        rankPlacement: { 2: 17, 3: 25 },
      },
    ],
    bracketPhase: 'Playoffs',
    // 16-player DE. GF went to bracket reset (2 sets).
    // LBF set (player 6 beats player 7) is absent from DB → player 7 handled via manualPlacements.
    // bracketRounds covers everyone except player 7 (3rd), skipping placement 3.
    bracketRounds: [
      { playerCount: 1, placement: 2  }, // GF loser (lastLossSetIdx highest)
      { playerCount: 1, placement: 4  }, // LBSF loser — placement 3 is manual
      { playerCount: 2, placement: 5  }, // LBQF losers
      { playerCount: 2, placement: 7  }, // LBR3 losers
      { playerCount: 4, placement: 9  }, // LBR2 losers
      { playerCount: 4, placement: 13 }, // LBR1 losers
    ],
    // player 7: won LBF in data (lastWin > lastLoss) so algorithm misses them; set manually
    manualPlacements: { 7: 3 },
    prizePool: [
      { range: [1,  1],  prize: 400_000 },
      { range: [2,  2],  prize: 200_000 },
      { range: [3,  3],  prize: 100_000 },
      { range: [4,  4],  prize:  80_000 },
      { range: [5,  6],  prize:  50_000 },
      { range: [7,  8],  prize:  30_000 },
      { range: [9,  12], prize:  10_000 },
      { range: [13, 16], prize:   5_000 },
    ],
  },

  // Esports World Cup 2025 (SF6)
  // Format: Phase 1 (12 groups × 4 players, GSL) → Phase 2 (4 groups × 3 players, RR)
  //         → Phase 3 (16-player single-elim with 3rd-place match, 16 sets total)
  // NOTE: Phase 3 has a 3rd-place match. The 3rd-place match WINNER (player 13) ends
  //       with lastWin > lastLoss so the algorithm won't detect them as eliminated.
  //       Player 13 is assigned via manualPlacements.
  5: {
    name: 'Esports World Cup 2025 (SF6)',
    skipPlacement: false,
    groupPhases: [
      {
        groups: ['Phase 1 Group A','Phase 1 Group B','Phase 1 Group C','Phase 1 Group D',
                 'Phase 1 Group E','Phase 1 Group F','Phase 1 Group G','Phase 1 Group H',
                 'Phase 1 Group I','Phase 1 Group J','Phase 1 Group K','Phase 1 Group L'],
        advance: 2, // rank 0 → Phase 3, rank 1 → Phase 2, rank 2-3 → eliminated
        rankPlacement: { 2: 25, 3: 37 },
      },
      {
        groups: ['Phase 2 Group A','Phase 2 Group B','Phase 2 Group C','Phase 2 Group D'],
        advance: 1, // rank 0 → Phase 3, rank 1-2 → eliminated
        rankPlacement: { 1: 17, 2: 21 },
      },
    ],
    bracketPhase: 'Phase 3',
    // 16-player single-elim: R1(8) + QF(4) + SF(2) + 3rd-place(1) + GF(1) = 16 sets
    // bracketRounds covers everyone except 3rd-place match winner (manual).
    bracketRounds: [
      { playerCount: 1, placement: 2  }, // GF loser
      // placement 3 = 3rd-place match winner → manualPlacements
      { playerCount: 1, placement: 4  }, // 3rd-place match loser (lastLoss = 3rd-place set)
      { playerCount: 4, placement: 5  }, // QF losers
      { playerCount: 4, placement: 9  }, // R1 losers (higher lastLossSetIdx group)
      { playerCount: 4, placement: 13 }, // R1 losers (lower lastLossSetIdx group)
    ],
    // player 13: won 3rd-place match (lastWin > lastLoss) so algorithm misses them
    manualPlacements: { 13: 3 },
    prizePool: [
      { range: [1,  1],  prize: 250_000 },
      { range: [2,  2],  prize: 130_000 },
      { range: [3,  4],  prize:  75_000 },
      { range: [5,  8],  prize:  45_000 },
      { range: [9,  12], prize:  20_000 },
      { range: [13, 16], prize:  12_500 },
      { range: [17, 20], prize:   7_500 },
      { range: [21, 24], prize:   5_000 },
      { range: [25, 36], prize:   2_500 },
    ],
  },

  // Evo 2024 — placements already populated via start.gg; prize_amount only
  7: {
    name: 'Evo 2024',
    skipPlacement: true,
    groupPhases: [],
    bracketPhase: null,
    bracketRounds: [],
    prizePool: [
      { range: [1, 1], prize: 12_000 },
      { range: [2, 2], prize:  6_000 },
      { range: [3, 3], prize:  4_500 },
      { range: [4, 4], prize:  3_000 },
      { range: [5, 6], prize:  1_800 },
      { range: [7, 8], prize:    450 },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function prizeForPlacement(prizePool, placement) {
  const row = prizePool.find(r => placement >= r.range[0] && placement <= r.range[1]);
  return row?.prize ?? null;
}

// Sort players within a group by wins desc, then game-score-differential desc
function computeGroupRankings(groupSets) {
  const wins     = {};
  const gameDiff = {};
  const players  = new Set();

  for (const s of groupSets) {
    if (!s.winner_id || !s.loser_id) continue;
    players.add(s.winner_id);
    players.add(s.loser_id);
    wins[s.winner_id] = (wins[s.winner_id] ?? 0) + 1;
    wins[s.loser_id]  = (wins[s.loser_id]  ?? 0);
    const wScore = s.winner_score ?? 2;
    const lScore = s.loser_score  ?? 0;
    gameDiff[s.winner_id] = (gameDiff[s.winner_id] ?? 0) + (wScore - lScore);
    gameDiff[s.loser_id]  = (gameDiff[s.loser_id]  ?? 0) - (wScore - lScore);
  }

  return [...players].sort((a, b) => {
    const wDiff = (wins[b] ?? 0) - (wins[a] ?? 0);
    if (wDiff !== 0) return wDiff;
    return (gameDiff[b] ?? 0) - (gameDiff[a] ?? 0);
  });
}

// Assign placements from bracket sets using bracketRounds config.
// Works for both single-elim and double-elim (any format).
// Strategy: sort all permanently eliminated players by lastLossSetIdx DESC,
// then assign placements in groups as specified by bracketRounds.
function computeBracketPlacements(bracketSets, bracketRounds) {
  if (!bracketSets.length) return new Map();
  const sorted = [...bracketSets].sort((a, b) => a.id - b.id);

  const lastWinSetIdx  = {};
  const lastLossSetIdx = {};

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (s.winner_id) lastWinSetIdx[s.winner_id]  = i;
    if (s.loser_id)  lastLossSetIdx[s.loser_id]  = i;
  }

  const allPlayers = [...new Set([
    ...sorted.map(s => s.winner_id).filter(Boolean),
    ...sorted.map(s => s.loser_id).filter(Boolean),
  ])];

  const champion = sorted[sorted.length - 1].winner_id;
  const placements = new Map();
  if (champion) placements.set(champion, 1);

  // Permanently eliminated: their last loss came after (or without) their last win
  const eliminated = allPlayers
    .filter(pid => pid !== champion)
    .filter(pid => (lastLossSetIdx[pid] ?? -1) > (lastWinSetIdx[pid] ?? -1))
    .sort((a, b) => (lastLossSetIdx[b] ?? 0) - (lastLossSetIdx[a] ?? 0));

  let pos = 0;
  for (const round of bracketRounds) {
    const group = eliminated.slice(pos, pos + round.playerCount);
    for (const pid of group) placements.set(pid, round.placement);
    pos += round.playerCount;
  }

  return placements;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args        = process.argv.slice(2);
  const tourneyArg  = args.find(a => /^\d+$/.test(a));
  const DRY_RUN     = args.includes('--dry-run');

  if (!tourneyArg) {
    console.error('Usage: node scripts/backfill-placements.js <tournament-id> [--dry-run]');
    console.error('Supported IDs: 2 (CC11), 3 (EWC 2024), 4 (Gamers8 2023), 5 (EWC 2025), 7 (Evo 2024)');
    process.exit(1);
  }

  const TOURNAMENT_ID = parseInt(tourneyArg, 10);
  const config = CONFIGS[TOURNAMENT_ID];
  if (!config) {
    console.error(`No config for tournament ${TOURNAMENT_ID}. Add it to CONFIGS first.`);
    process.exit(1);
  }

  console.log('════════════════════════════════════════════════');
  console.log(` Placement & Prize Backfill`);
  console.log(` Tournament: ${config.name} (id=${TOURNAMENT_ID})`);
  if (DRY_RUN) console.log(' MODE: --dry-run (no DB writes)');
  console.log('════════════════════════════════════════════════\n');

  // Load sets
  const { data: sets, error: sErr } = await supabase
    .from('tournament_sets')
    .select('id, phase_name, winner_id, loser_id, winner_score, loser_score')
    .eq('tournament_id', TOURNAMENT_ID);
  if (sErr) throw new Error(sErr.message);
  console.log(`📋 Loaded ${sets.length} sets`);

  // Load entrants
  const { data: entrants, error: eErr } = await supabase
    .from('tournament_entrants')
    .select('id, player_id, placement, prize_amount')
    .eq('tournament_id', TOURNAMENT_ID);
  if (eErr) throw new Error(eErr.message);
  console.log(`📋 Loaded ${entrants.length} entrants\n`);

  const entrantByPlayer = new Map(entrants.map(e => [e.player_id, e]));
  const finalPlacements = new Map(); // player_id → placement

  if (!config.skipPlacement) {
    // ── Group stages ──────────────────────────────────────────────
    for (const phase of config.groupPhases) {
      console.log(`\n── ${phase.groups[0].replace(/ Group .$/, '')} (${phase.groups.length} groups) ──`);

      for (const group of phase.groups) {
        const groupSets = sets.filter(s => s.phase_name === group);
        const ranked    = computeGroupRankings(groupSets);

        process.stdout.write(`  ${group}: `);
        for (let i = 0; i < ranked.length; i++) {
          const pid       = ranked[i];
          const placement = phase.rankPlacement[i];
          if (placement !== undefined) {
            finalPlacements.set(pid, placement);
            process.stdout.write(`[rank${i+1}→P${placement}:p${pid}] `);
          } else {
            process.stdout.write(`[rank${i+1}→advances:p${pid}] `);
          }
        }
        console.log();
      }
    }

    // ── Bracket ───────────────────────────────────────────────────
    if (config.bracketPhase) {
      const bracketSets = sets.filter(s => s.phase_name === config.bracketPhase);
      console.log(`\n── Bracket: ${config.bracketPhase} (${bracketSets.length} sets) ──`);

      const bracketMap = computeBracketPlacements(bracketSets, config.bracketRounds);

      for (const [pid, place] of [...bracketMap.entries()].sort((a, b) => a[1] - b[1])) {
        finalPlacements.set(pid, place);
        console.log(`  ${place}位: player ${pid}  ($${prizeForPlacement(config.prizePool, place)?.toLocaleString() ?? '—'})`);
      }
    }

    // ── Manual overrides (missing sets, 3rd-place match winners, etc.) ──────
    if (config.manualPlacements) {
      console.log('\n── Manual placements ──');
      for (const [pidStr, place] of Object.entries(config.manualPlacements)) {
        const pid = parseInt(pidStr, 10);
        finalPlacements.set(pid, place);
        console.log(`  ${place}位: player ${pid} (manual)  ($${prizeForPlacement(config.prizePool, place)?.toLocaleString() ?? '—'})`);
      }
    }

    console.log(`\n📊 Placements computed: ${finalPlacements.size}`);

  } else {
    // prize_only mode: use existing placements from DB
    console.log('ℹ️  skipPlacement=true — using existing placement values from DB');
    for (const e of entrants) {
      if (e.placement !== null) finalPlacements.set(e.player_id, e.placement);
    }
    console.log(`📊 Placements loaded from DB: ${finalPlacements.size}`);
  }

  // ── Build updates ─────────────────────────────────────────────────────────
  const updates = [];
  let noEntrant = 0;

  for (const [playerId, placement] of finalPlacements) {
    const entrant = entrantByPlayer.get(playerId);
    if (!entrant) { noEntrant++; continue; }
    const prize = prizeForPlacement(config.prizePool, placement);
    const needsPlacement = !config.skipPlacement && entrant.placement !== placement;
    const needsPrize     = entrant.prize_amount !== prize;
    if (needsPlacement || needsPrize) {
      updates.push({
        id:          entrant.id,
        placement:   config.skipPlacement ? entrant.placement : placement,
        prize_amount: prize,
      });
    }
  }

  console.log(`\n  Updates needed: ${updates.length}`);
  if (noEntrant > 0) console.log(`  ⚠️  Players not in entrants: ${noEntrant}`);

  if (DRY_RUN) {
    console.log('\n[dry-run] Sample (up to 10):');
    updates.slice(0, 10).forEach(u =>
      console.log(`  entrant ${u.id}: placement=${u.placement}, prize=$${u.prize_amount?.toLocaleString() ?? null}`)
    );
    console.log(`\nRun without --dry-run to apply ${updates.length} updates.`);
    return;
  }

  if (updates.length === 0) {
    console.log('\n✅ Nothing to update.');
    return;
  }

  // ── Apply updates ─────────────────────────────────────────────────────────
  console.log('\n💾 Applying updates…');
  let updated = 0, errors = 0;

  for (const u of updates) {
    const patch = { prize_amount: u.prize_amount };
    if (!config.skipPlacement) patch.placement = u.placement;

    const { error } = await supabase
      .from('tournament_entrants')
      .update(patch)
      .eq('id', u.id);

    if (error) { console.log(`  ⚠️  entrant ${u.id}: ${error.message}`); errors++; }
    else updated++;
  }

  console.log(`\n✅ Done! Updated ${updated} entrants. Errors: ${errors}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
