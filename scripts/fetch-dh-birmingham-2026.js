/**
 * fetch-dh-birmingham-2026.js
 *
 * DreamHack Birmingham 2026 の entrants と sets を start.gg から取得して DB に INSERT する。
 *
 * Usage: node scripts/fetch-dh-birmingham-2026.js [--dry-run]
 *
 * DB tournament_id = 39
 * start.gg slug    = road-to-ewc-26-dreamhack-birmingham
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const STARTGG_API   = 'https://api.start.gg/gql/alpha';
const STARTGG_TOKEN = process.env.STARTGG_TOKEN;

const TOURNAMENT_ID  = 39;
const TOURNAMENT_SLUG = 'road-to-ewc-26-dreamhack-birmingham';

const DRY_RUN = process.argv.includes('--dry-run');

// ── GraphQL helper ────────────────────────────────────────────────────────────

async function gql(query, variables, retries = 4) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(STARTGG_API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${STARTGG_TOKEN}` },
      body:    JSON.stringify({ query, variables }),
    });
    if (res.status === 429) {
      const wait = Math.pow(2, i + 1) * 1000;
      console.log(`   ⏳ Rate limited, waiting ${wait / 1000}s…`);
      await sleep(wait);
      continue;
    }
    const json = await res.json();
    if (json.errors) {
      console.error('GraphQL errors:', json.errors);
      if (json.errors[0]?.message?.includes('complexity')) {
        const wait = Math.pow(2, i + 1) * 1000;
        console.log(`   ⏳ Complexity limit, waiting ${wait / 1000}s…`);
        await sleep(wait);
        continue;
      }
      return null;
    }
    return json.data;
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Step 1: Discover event ID ─────────────────────────────────────────────────

async function getEventId() {
  const data = await gql(
    `query ($slug: String!) {
      tournament(slug: $slug) {
        id
        name
        events {
          id
          name
          numEntrants
          videogame { id }
        }
      }
    }`,
    { slug: `tournament/${TOURNAMENT_SLUG}` },
  );
  const t = data?.tournament;
  if (!t) throw new Error('Tournament not found on start.gg');
  console.log(`✅ Found tournament: ${t.name}`);

  // SF6 event selection (same priority as import-tournament.js)
  const sf6Event =
    t.events?.find(e => /cpt.*premier|premier.*cpt/i.test(e.name)) ||
    t.events
      ?.filter(e => /street fighter 6/i.test(e.name) && !/team|itc|3v3/i.test(e.name))
      .sort((a, b) => (b.numEntrants || 0) - (a.numEntrants || 0))[0] ||
    t.events?.sort((a, b) => (b.numEntrants || 0) - (a.numEntrants || 0))[0];

  if (!sf6Event) throw new Error('No SF6 event found');
  console.log(`   SF6 Event: "${sf6Event.name}" (${sf6Event.numEntrants} entrants, id=${sf6Event.id})`);
  return { eventId: sf6Event.id, numEntrants: sf6Event.numEntrants, startggTournamentId: t.id };
}

// ── Step 2: Fetch entrants from start.gg ─────────────────────────────────────

async function fetchEntrants(eventId) {
  console.log('\n🔍 Fetching entrants…');
  const all = [];
  let page = 1;
  const perPage = 60;

  while (true) {
    const data = await gql(
      `query ($eventId: ID!, $page: Int!, $perPage: Int!) {
        event(id: $eventId) {
          entrants(query: { page: $page, perPage: $perPage }) {
            pageInfo { totalPages }
            nodes {
              id
              initialSeedNum
              standing { placement }
              participants {
                gamerTag
                prefix
                player { id }
                user { slug }
              }
            }
          }
        }
      }`,
      { eventId, page, perPage },
    );

    const entrants = data?.event?.entrants;
    if (!entrants?.nodes?.length) break;

    for (const ent of entrants.nodes) {
      const p = ent.participants?.[0];
      if (!p) continue;
      all.push({
        startgg_entrant_id: ent.id,
        seed:               ent.initialSeedNum,
        placement:          ent.standing?.placement || null,
        gamerTag:           p.gamerTag,
        prefix:             p.prefix || null,
        startgg_player_id:  p.player?.id || null,
      });
    }

    const totalPages = entrants.pageInfo?.totalPages || 1;
    console.log(`   Page ${page}/${totalPages}  (${all.length} entrants so far)`);
    if (page >= totalPages) break;
    page++;
    await sleep(1500);
  }

  console.log(`✅ Total entrants fetched: ${all.length}`);
  return all;
}

// ── Step 3: Match entrants to DB players & insert tournament_entrants ─────────

async function upsertEntrants(entrants) {
  // Load all players with pagination
  let allPlayers = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('players')
      .select('id, handle, startgg_player_id, startgg_player_ids')
      .range(from, from + 999);
    allPlayers = allPlayers.concat(data || []);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  console.log(`📥 Loaded ${allPlayers.length} players from DB`);

  // Build lookup maps
  const playerMap  = new Map();
  const handleMap  = new Map();
  for (const p of allPlayers) {
    if (p.startgg_player_ids) p.startgg_player_ids.forEach(id => playerMap.set(String(id), p));
    if (p.startgg_player_id)  playerMap.set(String(p.startgg_player_id), p);
    handleMap.set(p.handle.toLowerCase(), p);
  }

  const toInsert   = [];
  const autoCreated = [];
  const candidates  = [];

  for (const ent of entrants) {
    let player = playerMap.get(String(ent.startgg_player_id));

    if (!player) {
      const tagLower = (ent.gamerTag || '').toLowerCase();
      const candidate = handleMap.get(tagLower);
      if (candidate) {
        candidates.push({ handle: candidate.handle, db_id: candidate.id, new_sgid: ent.startgg_player_id });
        player = candidate;
      } else {
        // Auto-create new player
        if (!DRY_RUN) {
          const { data: np } = await supabase.from('players').insert({
            handle:              ent.gamerTag,
            startgg_player_id:  ent.startgg_player_id,
            startgg_player_ids: [String(ent.startgg_player_id)],
            team:               ent.prefix || null,
          }).select('id, handle').single();
          if (np) {
            playerMap.set(String(ent.startgg_player_id), np);
            handleMap.set(np.handle.toLowerCase(), np);
            player = np;
            autoCreated.push({ handle: np.handle, id: np.id });
          }
        } else {
          console.log(`   [dry-run] Would create player: ${ent.gamerTag} (sg_id=${ent.startgg_player_id})`);
          continue;
        }
      }
    }

    if (!player) continue;
    if (toInsert.some(r => r.player_id === player.id)) continue;

    toInsert.push({
      tournament_id:      TOURNAMENT_ID,
      player_id:          player.id,
      startgg_entrant_id: ent.startgg_entrant_id,
      seed:               ent.seed,
      placement:          ent.placement,
    });
  }

  if (candidates.length > 0) {
    console.log(`\n🔗 gamerTag マッチ候補 (ID 更新が必要な場合):`)
    candidates.forEach(c => console.log(`   ${c.handle} (db_id=${c.db_id}, new_sg_id=${c.new_sgid})`));
  }
  if (autoCreated.length > 0) {
    console.log(`\n🆕 Auto-created ${autoCreated.length} new players`);
    autoCreated.forEach(c => console.log(`   id=${c.id}  ${c.handle}`));
  }

  console.log(`\n📊 tournament_entrants: ${toInsert.length} 件挿入予定`);
  if (DRY_RUN) { console.log('[dry-run] Skip insert.'); return; }

  const { error } = await supabase.from('tournament_entrants')
    .upsert(toInsert, { onConflict: 'tournament_id,player_id', ignoreDuplicates: true });
  if (error) console.error('⚠️ Insert error:', error.message);
  else console.log(`✅ Inserted ${toInsert.length} entrants`);
}

// ── Step 4: Fetch sets from start.gg ─────────────────────────────────────────

async function fetchSets(eventId) {
  console.log('\n🔍 Fetching phases…');
  const phaseData = await gql(
    `query ($eventId: ID!) {
      event(id: $eventId) {
        phases {
          id
          name
          phaseGroups { nodes { id displayIdentifier } }
        }
      }
    }`,
    { eventId },
  );
  const phases = phaseData?.event?.phases || [];
  console.log(`   Found ${phases.length} phases`);

  // Load player map for set matching
  let allPlayers = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('players')
      .select('id, startgg_player_id, startgg_player_ids')
      .range(from, from + 999);
    allPlayers = allPlayers.concat(data || []);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  const playerMap = new Map();
  for (const p of allPlayers) {
    if (p.startgg_player_ids) p.startgg_player_ids.forEach(id => playerMap.set(String(id), p));
    if (p.startgg_player_id)  playerMap.set(String(p.startgg_player_id), p);
  }

  const allSets = [];

  for (const phase of phases) {
    console.log(`\n📋 Phase: ${phase.name}`);
    for (const group of (phase.phaseGroups?.nodes || [])) {
      let page = 1, totalPages = 1;
      while (page <= totalPages) {
        const data = await gql(
          `query ($pgId: ID!, $page: Int!) {
            phaseGroup(id: $pgId) {
              sets(page: $page, perPage: 40, sortType: STANDARD) {
                pageInfo { total totalPages }
                nodes {
                  id
                  fullRoundText
                  displayScore
                  winnerId
                  slots {
                    entrant {
                      id
                      participants { player { id } }
                    }
                    standing { placement stats { score { value } } }
                  }
                }
              }
            }
          }`,
          { pgId: group.id, page },
        );
        const setsData = data?.phaseGroup?.sets;
        if (!setsData) break;
        totalPages = setsData.pageInfo?.totalPages || 1;

        for (const set of (setsData.nodes || [])) {
          if (!set.winnerId || !set.slots || set.slots.length < 2) continue;
          const slot0 = set.slots[0];
          const slot1 = set.slots[1];
          if (!slot0?.entrant || !slot1?.entrant) continue;

          const winnerSlot = slot0.entrant.id === set.winnerId ? slot0 : slot1;
          const loserSlot  = slot0.entrant.id === set.winnerId ? slot1 : slot0;

          const wPid = winnerSlot.entrant?.participants?.[0]?.player?.id;
          const lPid = loserSlot.entrant?.participants?.[0]?.player?.id;

          allSets.push({
            tournament_id:      TOURNAMENT_ID,
            startgg_set_id:     set.id,
            phase_name:         phase.name,
            round_text:         set.fullRoundText || null,
            display_score:      set.displayScore  || null,
            winner_id:          playerMap.get(String(wPid))?.id || null,
            loser_id:           playerMap.get(String(lPid))?.id  || null,
            winner_score:       winnerSlot.standing?.stats?.score?.value ?? null,
            loser_score:        loserSlot.standing?.stats?.score?.value  ?? null,
            winner_entrant_id:  winnerSlot.entrant.id,
            loser_entrant_id:   loserSlot.entrant.id,
          });
        }

        console.log(`   Pool ${group.displayIdentifier} page ${page}/${totalPages}`);
        page++;
        await sleep(1500);
      }
    }
  }

  console.log(`\n✅ Total sets fetched: ${allSets.length}`);
  return allSets;
}

// ── Step 5: Upsert sets ───────────────────────────────────────────────────────

async function upsertSets(sets) {
  const matched   = sets.filter(s => s.winner_id && s.loser_id).length;
  const partial   = sets.filter(s => (s.winner_id || s.loser_id) && !(s.winner_id && s.loser_id)).length;
  const unmatched = sets.filter(s => !s.winner_id && !s.loser_id).length;

  console.log(`\n📊 Sets: ${sets.length} total  (both=${matched}, partial=${partial}, none=${unmatched})`);
  if (DRY_RUN) { console.log('[dry-run] Skip upsert.'); return; }

  let inserted = 0;
  const batchSize = 200;
  for (let i = 0; i < sets.length; i += batchSize) {
    const { error } = await supabase.from('tournament_sets')
      .upsert(sets.slice(i, i + batchSize), { onConflict: 'tournament_id,startgg_set_id' });
    if (error) console.error(`   ⚠️ Batch error: ${error.message}`);
    else inserted += Math.min(batchSize, sets.length - i);
  }
  console.log(`✅ Upserted ${inserted} sets`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('════════════════════════════════════════════════');
  console.log(' DreamHack Birmingham 2026 — fetch & import');
  console.log(` tournament_id = ${TOURNAMENT_ID}`);
  if (DRY_RUN) console.log(' MODE: --dry-run (no DB writes)');
  console.log('════════════════════════════════════════════════\n');

  const { eventId, startggTournamentId } = await getEventId();

  // Update DB with startgg IDs
  if (!DRY_RUN) {
    await supabase.from('tournaments').update({
      startgg_tournament_id: startggTournamentId,
      startgg_event_id:      eventId,
    }).eq('id', TOURNAMENT_ID);
    console.log(`   ✓ Updated startgg_tournament_id / startgg_event_id`);
  }

  // Entrants
  const entrants = await fetchEntrants(eventId);
  await upsertEntrants(entrants);

  // Sets
  const sets = await fetchSets(eventId);
  await upsertSets(sets);

  console.log('\n🎉 Done!');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
