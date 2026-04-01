import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STARTGG_API = 'https://api.start.gg/gql/alpha';
const STARTGG_TOKEN = process.env.STARTGG_TOKEN;

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/import-sets.js <tournament-slug>');
  process.exit(1);
}

// ── GraphQL helper ──
async function gql(query, variables, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(STARTGG_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${STARTGG_TOKEN}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429) {
      const wait = Math.pow(2, i + 1) * 1000;
      console.log(`   ⏳ Rate limited, waiting ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const json = await res.json();
    if (json.errors) {
      console.error('GraphQL errors:', json.errors);
      if (json.errors[0]?.message?.includes('complexity')) {
        const wait = Math.pow(2, i + 1) * 1000;
        console.log(`   ⏳ Complexity limit, waiting ${wait / 1000}s...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return null;
    }
    return json.data;
  }
  return null;
}

// ── Step 1: Get tournament & event info ──
async function getTournamentInfo() {
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
    { slug: `tournament/${slug}` }
  );
  return data?.tournament;
}

// ── Step 2: Get event phases ──
async function getEventPhases(eventId) {
  const data = await gql(
    `query ($eventId: ID!) {
      event(id: $eventId) {
        phases {
          id
          name
          phaseGroups {
            nodes {
              id
              displayIdentifier
            }
          }
        }
      }
    }`,
    { eventId }
  );
  return data?.event?.phases || [];
}

// ── Step 3: Get sets in a phase group ──
async function getPhaseGroupSets(phaseGroupId, page = 1) {
  const data = await gql(
    `query ($pgId: ID!, $page: Int!) {
      phaseGroup(id: $pgId) {
        sets(page: $page, perPage: 40, sortType: STANDARD) {
          pageInfo {
            total
            totalPages
          }
          nodes {
            id
            fullRoundText
            displayScore
            winnerId
            slots {
              entrant {
                id
                participants {
                  player { id }
                }
              }
              standing {
                placement
                stats {
                  score { value }
                }
              }
            }
          }
        }
      }
    }`,
    { pgId: phaseGroupId, page }
  );
  return data?.phaseGroup?.sets;
}

// ── Step 4: Load players from DB ──
async function loadPlayers() {
  let all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data } = await supabase
      .from('players')
      .select('id, handle, startgg_player_id, startgg_player_ids')
      .range(from, from + pageSize - 1);
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// ── Main ──
async function main() {
  console.log(`\n🔍 Fetching tournament: ${slug}`);
  const t = getTournamentInfo ? await getTournamentInfo() : null;
  if (!t) { console.error('❌ Tournament not found'); process.exit(1); }
  console.log(`✅ Found: ${t.name}`);

  // Select SF6 event (same logic as import-tournament.js)
  const sf6Event =
    t.events?.find((e) => /cpt.*premier|premier.*cpt/i.test(e.name)) ||
    t.events
      ?.filter((e) => /street fighter 6/i.test(e.name) && !/team|itc|3v3/i.test(e.name))
      .sort((a, b) => (b.numEntrants || 0) - (a.numEntrants || 0))[0] ||
    t.events?.sort((a, b) => (b.numEntrants || 0) - (a.numEntrants || 0))[0];

  if (!sf6Event) { console.error('❌ No SF6 event found'); process.exit(1); }
  console.log(`   SF6 Event: ${sf6Event.name} (${sf6Event.numEntrants} entrants)`);

  // Get tournament_id from DB
  const { data: dbTournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('startgg_slug', slug)
    .single();

  if (!dbTournament) {
    console.error('❌ Tournament not found in DB. Run import-tournament.js first.');
    process.exit(1);
  }
  const tournamentId = dbTournament.id;
  console.log(`   DB tournament_id: ${tournamentId}`);

  // Load players & build map
  const players = await loadPlayers();
  console.log(`📥 Loaded ${players.length} players`);
  const playerMap = new Map();
  for (const p of players) {
    if (p.startgg_player_id) playerMap.set(String(p.startgg_player_id), p);
    if (p.startgg_player_ids) {
      for (const pid of p.startgg_player_ids) {
        playerMap.set(String(pid), p);
      }
    }
  }

  // Get phases & phase groups
  const phases = await getEventPhases(sf6Event.id);
  console.log(`   Found ${phases.length} phases`);

  let allSets = [];

  for (const phase of phases) {
    console.log(`\n📋 Phase: ${phase.name}`);
    const groups = phase.phaseGroups?.nodes || [];

    for (const group of groups) {
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const setsData = await getPhaseGroupSets(group.id, page);
        if (!setsData) break;

        totalPages = setsData.pageInfo?.totalPages || 1;
        const sets = setsData.nodes || [];

        for (const set of sets) {
          if (!set.winnerId || !set.slots || set.slots.length < 2) continue;

          const slot0 = set.slots[0];
          const slot1 = set.slots[1];
          if (!slot0?.entrant || !slot1?.entrant) continue;

          const winnerSlot = slot0.entrant.id === set.winnerId ? slot0 : slot1;
          const loserSlot = slot0.entrant.id === set.winnerId ? slot1 : slot0;

          const winnerPlayerId = winnerSlot.entrant?.participants?.[0]?.player?.id;
          const loserPlayerId = loserSlot.entrant?.participants?.[0]?.player?.id;

          const winnerDb = playerMap.get(String(winnerPlayerId));
          const loserDb = playerMap.get(String(loserPlayerId));

          const winnerScore = winnerSlot.standing?.stats?.score?.value ?? null;
          const loserScore = loserSlot.standing?.stats?.score?.value ?? null;

          allSets.push({
            tournament_id: tournamentId,
            startgg_set_id: set.id,
            round_text: set.fullRoundText || null,
            display_score: set.displayScore || null,
            winner_id: winnerDb?.id || null,
            loser_id: loserDb?.id || null,
            winner_score: winnerScore,
            loser_score: loserScore,
            winner_entrant_id: winnerSlot.entrant.id,
            loser_entrant_id: loserSlot.entrant.id,
            phase_name: phase.name,
          });
        }

        console.log(`   Pool ${group.displayIdentifier} page ${page}/${totalPages} (${sets.length} sets)`);
        page++;
        await new Promise((r) => setTimeout(r, 1500)); // rate limit delay
      }
    }
  }

  console.log(`\n✅ Total sets fetched: ${allSets.length}`);

  // Batch upsert
  const batchSize = 200;
  let inserted = 0;
  for (let i = 0; i < allSets.length; i += batchSize) {
    const batch = allSets.slice(i, i + batchSize);
    const { error } = await supabase
      .from('tournament_sets')
      .upsert(batch, { onConflict: 'tournament_id,startgg_set_id' });
    if (error) {
      console.error(`   ⚠️ Batch error: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  // Stats
  const matched = allSets.filter((s) => s.winner_id && s.loser_id).length;
  const partial = allSets.filter((s) => (s.winner_id || s.loser_id) && !(s.winner_id && s.loser_id)).length;
  const unmatched = allSets.filter((s) => !s.winner_id && !s.loser_id).length;

  console.log(`\n════════════════════════════════════════════════════════════`);
  console.log(`📊 Summary for tournament_id = ${tournamentId}`);
  console.log(`   Total sets:      ${allSets.length}`);
  console.log(`   Inserted/updated: ${inserted}`);
  console.log(`   Both matched:    ${matched}`);
  console.log(`   Partial match:   ${partial}`);
  console.log(`   Unmatched:       ${unmatched}`);
  console.log(`════════════════════════════════════════════════════════════`);
}

main().catch(console.error);
