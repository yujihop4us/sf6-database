/**
 * update-all-prize-data.js
 *
 * Updates total_prize_usd in the tournaments table and prize_amount in
 * tournament_entrants for all configured tournaments.
 *
 * Already handled by backfill-placements.js (skip):
 *   id=2  Capcom Cup 11
 *   id=3  EWC 2024
 *   id=7  Evo 2024
 *
 * Not yet held (skip entirely):
 *   id=10 EVO 2026
 *
 * Usage:
 *   node scripts/update-all-prize-data.js [--dry-run] [--id=<id>]
 *
 *   --dry-run     Preview changes without writing to DB
 *   --id=<id>     Process only the specified tournament ID
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── Tournament Configurations ─────────────────────────────────────────────────
//
// totalPrize      : correct value for tournaments.total_prize_usd
// skipPrizeAmount : if true, don't update tournament_entrants.prize_amount
//                   (use for future/unplayed tournaments)
// prizePool       : { range: [min, max], prize: amount }
//                   placement not in any range → prize_amount = null
//
// All tournaments here use skipPlacement=true (placements already in DB).
// Prize amounts are sourced from Esports Earnings (priority) or Liquipedia.

const CONFIGS = {

  // ── id=4 Gamers8 2023 ──────────────────────────────────────────────────────
  // total_prize_usd already $1,000,000 — confirm only
  // Source: esportsearnings.com/tournaments/63239
  4: {
    name: 'Gamers8 2023',
    totalPrize: 1_000_000,
    skipPrizeAmount: false,
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

  // ── id=38 Evo 2023 ─────────────────────────────────────────────────────────
  // total_prize_usd: null → $70,600
  // Source: esportsearnings.com/tournaments/63329
  38: {
    name: 'Evo 2023',
    totalPrize: 70_600,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1,  1],  prize: 20_000 },
      { range: [2,  2],  prize: 15_000 },
      { range: [3,  3],  prize: 10_000 },
      { range: [4,  4],  prize:  7_000 },
      { range: [5,  6],  prize:  4_000 },
      { range: [7,  8],  prize:  2_000 },
      { range: [9,  12], prize:  1_000 },
      { range: [13, 16], prize:    650 },
    ],
  },

  // ── id=37 CAPCOM CUP X ─────────────────────────────────────────────────────
  // total_prize_usd: null → $1,734,000
  // Source: esportsearnings.com/tournaments/67103
  37: {
    name: 'CAPCOM CUP X',
    totalPrize: 1_734_000,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1,  1],  prize: 1_000_000 },
      { range: [2,  2],  prize:   300_000 },
      { range: [3,  3],  prize:   200_000 },
      { range: [4,  4],  prize:   100_000 },
      { range: [5,  6],  prize:    10_000 },
      { range: [7,  8],  prize:     7_000 },
      { range: [9,  12], prize:     5_000 },
      { range: [13, 16], prize:     4_000 },
      { range: [17, 24], prize:     2_000 },
      { range: [25, 48], prize:     2_000 },
    ],
  },

  // ── id=30 Cream City Convergence 2024 ──────────────────────────────────────
  // total_prize_usd: null → $8,230 (Esports Earnings total)
  // prize_amount: top-4 only (Liquipedia confirmed); 5th+ = null
  // Note: Esports Earnings $8,230 vs Liquipedia $5,200 (pre-pot-bonus) discrepancy;
  //       using EE for total, Liquipedia confirmed amounts for entrants.
  // Source: esportsearnings.com/tournaments/69695, Liquipedia CCC/2024/SF6
  30: {
    name: 'Cream City Convergence 2024',
    totalPrize: 8_230,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1, 1], prize: 2_000 },
      { range: [2, 2], prize: 1_500 },
      { range: [3, 3], prize: 1_000 },
      { range: [4, 4], prize:   700 },
      // 5th+ : no confirmed prize data
    ],
  },

  // ── id=31 Ultimate Fighting Arena 2024 ─────────────────────────────────────
  // total_prize_usd: null → $11,085 (€10,000 ≈ $11,085)
  // Distribution estimated via Combo Breaker ratios (42/24/14/8/4/4/2/2%)
  // Source: Liquipedia Ultimate_Fighting_Arena/2024/SF6
  31: {
    name: 'Ultimate Fighting Arena 2024',
    totalPrize: 11_085,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1, 1], prize: 4_656 },
      { range: [2, 2], prize: 2_660 },
      { range: [3, 3], prize: 1_552 },
      { range: [4, 4], prize:   887 },
      { range: [5, 6], prize:   443 },
      { range: [7, 8], prize:   222 },
    ],
  },

  // ── id=32 East Coast Throwdown 2024 ────────────────────────────────────────
  // total_prize_usd: null → $11,410
  // Exact per-place amounts listed on Liquipedia
  // Source: Liquipedia East_Coast_Throwdown/2024/SF6
  32: {
    name: 'East Coast Throwdown 2024',
    totalPrize: 11_410,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1, 1], prize: 5_105.00 },
      { range: [2, 2], prize: 2_742.00 },
      { range: [3, 3], prize: 1_807.30 },
      { range: [4, 4], prize: 1_134.70 },
      { range: [5, 6], prize:   186.30 },
      { range: [7, 8], prize:   124.20 },
    ],
  },

  // ── id=33 CPT 2024 Super Premier Singapore ─────────────────────────────────
  // total_prize_usd: null → $18,400 (includes CPT pot bonus)
  // Source: esportsearnings.com/tournaments/70464, Liquipedia CPT/2024/Super_Premier/Singapore
  33: {
    name: 'CPT 2024 Super Premier Singapore',
    totalPrize: 18_400,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1, 1], prize: 10_000 },
      { range: [2, 2], prize:  3_000 },
      { range: [3, 3], prize:  2_000 },
      { range: [4, 4], prize:  1_200 },
      { range: [5, 6], prize:    600 },
      { range: [7, 8], prize:    500 },
    ],
  },

  // ── id=34 EVO Japan 2025 ───────────────────────────────────────────────────
  // total_prize_usd: null → $24,075 (¥3,500,000)
  // Source: Liquipedia Evolution_Championship_Series/2025/Japan/SF6
  34: {
    name: 'EVO Japan 2025',
    totalPrize: 24_075,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1, 1], prize: 12_038 },
      { range: [2, 2], prize:  4_815 },
      { range: [3, 3], prize:  2_408 },
      { range: [4, 4], prize:  1_445 },
      { range: [5, 6], prize:    978 },
      { range: [7, 8], prize:    489 },
    ],
  },

  // ── id=21 COMBO BREAKER 2025 ───────────────────────────────────────────────
  // total_prize_usd: null → $18,440
  // Distribution: official CB ratios (42/24/14/8/4/4/2/2%)
  // Source: Liquipedia Combo_Breaker/2025/SF6, combobreaker.org
  21: {
    name: 'COMBO BREAKER 2025',
    totalPrize: 18_440,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1, 1], prize: 7_745 },
      { range: [2, 2], prize: 4_426 },
      { range: [3, 3], prize: 2_582 },
      { range: [4, 4], prize: 1_475 },
      { range: [5, 6], prize:   738 },
      { range: [7, 8], prize:   369 },
    ],
  },

  // ── id=35 CEO 2025 ─────────────────────────────────────────────────────────
  // total_prize_usd: null → $13,570
  // Distribution: CB ratios (42/24/14/8/4/4/2/2%)
  // Source: Liquipedia Community_Effort_Orlando/2025/SF6
  35: {
    name: 'CEO 2025',
    totalPrize: 13_570,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1, 1], prize: 5_699 },
      { range: [2, 2], prize: 3_257 },
      { range: [3, 3], prize: 1_900 },
      { range: [4, 4], prize: 1_086 },
      { range: [5, 6], prize:   543 },
      { range: [7, 8], prize:   271 },
    ],
  },

  // ── id=23 BLINK RESPAWN 2025 ───────────────────────────────────────────────
  // total_prize_usd: null → $16,700
  // Distribution: CB ratios (42/24/14/8/4/4/2/2%)
  // Source: Liquipedia Blink_Respawn/2025/SF6
  23: {
    name: 'BLINK RESPAWN 2025',
    totalPrize: 16_700,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1, 1], prize: 7_014 },
      { range: [2, 2], prize: 4_008 },
      { range: [3, 3], prize: 2_338 },
      { range: [4, 4], prize: 1_336 },
      { range: [5, 6], prize:   668 },
      { range: [7, 8], prize:   334 },
    ],
  },

  // ── id=12 Evo 2025 ─────────────────────────────────────────────────────────
  // total_prize_usd: null → $42,420
  // Source: Liquipedia Evolution_Championship_Series/2025/SF6
  12: {
    name: 'Evo 2025',
    totalPrize: 42_420,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1, 1], prize: 16_968 },
      { range: [2, 2], prize:  8_484 },
      { range: [3, 3], prize:  6_363 },
      { range: [4, 4], prize:  4_242 },
      { range: [5, 6], prize:  2_545 },
      { range: [7, 8], prize:    636 },
    ],
  },

  // ── id=5 EWC 2025 ──────────────────────────────────────────────────────────
  // total_prize_usd already $1,000,000 — confirm only
  // Source: esportsworldcup.com/en/competitions/street-fighter6
  5: {
    name: 'EWC 2025',
    totalPrize: 1_000_000,
    skipPrizeAmount: false,
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

  // ── id=36 UFA 2025 ─────────────────────────────────────────────────────────
  // total_prize_usd: null → $10,942 (€9,324)
  // Distribution: CB ratios (42/24/14/8/4/4/2/2%)
  // Source: Liquipedia Ultimate_Fighting_Arena/2025/SF6
  36: {
    name: 'UFA 2025',
    totalPrize: 10_942,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1, 1], prize: 4_596 },
      { range: [2, 2], prize: 2_626 },
      { range: [3, 3], prize: 1_532 },
      { range: [4, 4], prize:   875 },
      { range: [5, 6], prize:   438 },
      { range: [7, 8], prize:   219 },
    ],
  },

  // ── id=25 Evo France 2025 ──────────────────────────────────────────────────
  // total_prize_usd: null → $30,149 (€25,950)
  // Source: Liquipedia Evolution_Championship_Series/2025/France/SF6
  25: {
    name: 'Evo France 2025',
    totalPrize: 30_149,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1, 1], prize: 10_689 },
      { range: [2, 2], prize:  5_344 },
      { range: [3, 3], prize:  4_008 },
      { range: [4, 4], prize:  2_672 },
      { range: [5, 6], prize:  1_603 },
      { range: [7, 8], prize:    475 },
    ],
  },

  // ── id=9 Capcom Cup 12 ─────────────────────────────────────────────────────
  // total_prize_usd: $1,282,000 → $1,297,000 (corrected per Esports Earnings)
  // Source: esportsearnings.com/tournaments/73982
  9: {
    name: 'Capcom Cup 12',
    totalPrize: 1_297_000,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1,  1],  prize: 1_000_000 },
      { range: [2,  2],  prize:   100_000 },
      { range: [3,  3],  prize:    50_000 },
      { range: [4,  4],  prize:    20_000 },
      { range: [5,  8],  prize:    10_000 },
      { range: [9,  16], prize:     4_000 },
      { range: [17, 24], prize:     2_000 },
      { range: [25, 32], prize:     1_750 },
      { range: [37, 44], prize:     1_500 },
    ],
  },

  // ── id=11 EWC 2026 ─────────────────────────────────────────────────────────
  // total_prize_usd already $1,000,000 — confirm only
  // skipPrizeAmount=true: not yet held, no placement data
  11: {
    name: 'EWC 2026',
    totalPrize: 1_000_000,
    skipPrizeAmount: true,
    prizePool: [],
  },

  // ── id=39 DreamHack Birmingham 2026 ───────────────────────────────────────
  // total_prize_usd already $50,000 — confirm only
  // Source: Liquipedia DreamHack/2026/Birmingham/SF6
  // Note: Esports Earnings records $20,000 (open bracket portion only) — Liquipedia adopted
  39: {
    name: 'DreamHack Birmingham 2026',
    totalPrize: 50_000,
    skipPrizeAmount: false,
    prizePool: [
      { range: [1,  1],  prize: 15_000 },
      { range: [2,  2],  prize:  7_500 },
      { range: [3,  3],  prize:  5_000 },
      { range: [4,  4],  prize:  3_500 },
      { range: [5,  6],  prize:  2_500 },
      { range: [7,  8],  prize:  2_000 },
      { range: [9,  12], prize:  1_500 },
      { range: [13, 16], prize:  1_000 },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function prizeForPlacement(prizePool, placement) {
  if (placement === null || placement === undefined) return null;
  const row = prizePool.find(r => placement >= r.range[0] && placement <= r.range[1]);
  return row?.prize ?? null;
}

// ── Process one tournament ────────────────────────────────────────────────────

async function processTournament(tournamentId, config, dryRun) {
  const BAR = '═'.repeat(58);
  console.log(`\n${BAR}`);
  console.log(` ${config.name}  (id=${tournamentId})`);
  console.log(BAR);

  // 1. Update total_prize_usd ─────────────────────────────────────────────────
  const { data: tourney, error: tErr } = await supabase
    .from('tournaments')
    .select('id, total_prize_usd')
    .eq('id', tournamentId)
    .single();

  if (tErr) {
    console.log(`  ⚠️  tournament fetch error: ${tErr.message}`);
    return;
  }

  const currentTotal = tourney.total_prize_usd;
  if (currentTotal !== config.totalPrize) {
    console.log(`  💰 total_prize_usd: ${currentTotal ?? 'null'} → $${config.totalPrize.toLocaleString()}`);
    if (!dryRun) {
      const { error } = await supabase
        .from('tournaments')
        .update({ total_prize_usd: config.totalPrize })
        .eq('id', tournamentId);
      if (error) console.log(`  ⚠️  tournament update error: ${error.message}`);
      else       console.log(`  ✅ total_prize_usd updated`);
    }
  } else {
    console.log(`  ✓  total_prize_usd already correct ($${config.totalPrize.toLocaleString()})`);
  }

  // 2. Update prize_amount in tournament_entrants ─────────────────────────────
  if (config.skipPrizeAmount) {
    console.log(`  ℹ️  skipPrizeAmount=true — entrant updates skipped`);
    return;
  }

  if (config.prizePool.length === 0) {
    console.log(`  ℹ️  No prizePool configured — entrant updates skipped`);
    return;
  }

  const { data: entrants, error: eErr } = await supabase
    .from('tournament_entrants')
    .select('id, player_id, placement, prize_amount')
    .eq('tournament_id', tournamentId);

  if (eErr) {
    console.log(`  ⚠️  entrant fetch error: ${eErr.message}`);
    return;
  }

  if (!entrants || entrants.length === 0) {
    console.log(`  ℹ️  No entrants found — skipped`);
    return;
  }

  console.log(`  📋 Loaded ${entrants.length} entrants`);

  const updates = [];
  let noPlacement = 0;

  for (const e of entrants) {
    if (e.placement === null || e.placement === undefined) {
      noPlacement++;
      continue;
    }
    const newPrize = prizeForPlacement(config.prizePool, e.placement);
    if (e.prize_amount !== newPrize) {
      updates.push({
        id:       e.id,
        placement: e.placement,
        oldPrize: e.prize_amount,
        newPrize,
      });
    }
  }

  if (noPlacement > 0) console.log(`  ⚠️  ${noPlacement} entrants have no placement (skipped)`);
  console.log(`  📊 Updates needed: ${updates.length}`);

  if (updates.length === 0) {
    console.log(`  ✓  prize_amount already correct for all entrants`);
    return;
  }

  if (dryRun) {
    const preview = updates.slice(0, 12);
    for (const u of preview) {
      const from = u.oldPrize !== null ? `$${u.oldPrize.toLocaleString()}` : 'null';
      const to   = u.newPrize !== null ? `$${u.newPrize.toLocaleString()}` : 'null';
      console.log(`  [dry] entrant ${u.id}  place=${u.placement}  ${from} → ${to}`);
    }
    if (updates.length > 12) console.log(`  ... and ${updates.length - 12} more`);
    return;
  }

  let updated = 0, errors = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from('tournament_entrants')
      .update({ prize_amount: u.newPrize })
      .eq('id', u.id);
    if (error) { console.log(`  ⚠️  entrant ${u.id}: ${error.message}`); errors++; }
    else updated++;
  }
  console.log(`  ✅ Updated ${updated} entrants. Errors: ${errors}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2);
  const DRY_RUN = args.includes('--dry-run');
  const idArg   = args.find(a => a.startsWith('--id='));
  const targetId = idArg ? parseInt(idArg.split('=')[1], 10) : null;

  const HEADER = '════════════════════════════════════════════════════════════';
  console.log(HEADER);
  console.log(' Prize Data Bulk Update');
  if (DRY_RUN)  console.log(' MODE: --dry-run (no DB writes)');
  if (targetId) console.log(` Target: id=${targetId} only`);
  console.log(HEADER);

  const ids = targetId
    ? [targetId]
    : Object.keys(CONFIGS).map(Number).sort((a, b) => a - b);

  for (const id of ids) {
    const config = CONFIGS[id];
    if (!config) {
      console.log(`\n⚠️  No config found for id=${id} — skipped`);
      continue;
    }
    await processTournament(id, config, DRY_RUN);
  }

  console.log(`\n${HEADER}`);
  console.log(` All done!`);
  console.log(HEADER);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
