require('dotenv').config({ path: '.env.local' });

const STARTGG_API = 'https://api.start.gg/gql/alpha';
const TOKEN = process.env.STARTGG_TOKEN;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function gqlQuery(query, variables) {
  const res = await fetch(STARTGG_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    body: JSON.stringify({ query, variables })
  });
  if (res.status === 429) {
    console.log('Rate limited, waiting 60s...');
    await sleep(60000);
    return gqlQuery(query, variables);
  }
  return res.json();
}

async function getPlayerFromSlug(handle, slug) {
  const data = await gqlQuery(`
    query UserPlayer($slug: String!) {
      user(slug: $slug) { player { id gamerTag } }
    }
  `, { slug });
  const player = data?.data?.user?.player;
  if (player) {
    console.log(`✅ ${handle}: player.id = ${player.id} (${player.gamerTag})`);
    console.log(`   UPDATE players SET startgg_player_id = ${player.id} WHERE handle = '${handle}';`);
  } else {
    console.log(`❌ ${handle}: not found via slug ${slug}`);
  }
}

async function searchInTournament(handle, tournamentSlug, searchTag) {
  const data = await gqlQuery(`
    query TournamentEntrants($slug: String!, $page: Int!) {
      tournament(slug: $slug) {
        events {
          entrants(query: { page: $page, perPage: 50 }) {
            nodes {
              name
              participants {
                gamerTag
                player { id gamerTag }
                user { slug }
              }
            }
          }
        }
      }
    }
  `, { slug: tournamentSlug, page: 1 });
  
  const events = data?.data?.tournament?.events;
  if (!events) { console.log(`❌ ${handle}: tournament ${tournamentSlug} not found`); return; }
  
  for (const event of events) {
    for (const entrant of (event.entrants?.nodes || [])) {
      const tag = entrant.participants?.[0]?.gamerTag?.toLowerCase() || '';
      const name = entrant.name?.toLowerCase() || '';
      if (tag.includes(searchTag.toLowerCase()) || name.includes(searchTag.toLowerCase())) {
        const p = entrant.participants[0];
        console.log(`✅ ${handle}: player.id = ${p.player?.id} (${p.gamerTag}, slug: ${p.user?.slug})`);
        console.log(`   UPDATE players SET startgg_player_id = ${p.player?.id} WHERE handle = '${handle}';`);
        return;
      }
    }
  }
  console.log(`❌ ${handle}: "${searchTag}" not found in ${tournamentSlug}`);
}

async function main() {
  console.log('=== Fetching remaining 5 player IDs ===\n');

  // 3 players with known user slugs
  await getPlayerFromSlug('Dual Kevin', '88d3f20e');
  await sleep(1500);
  await getPlayerFromSlug('Travis Styles', '609ec843');
  await sleep(1500);
  await getPlayerFromSlug('Rainpro', '2ab0ced8');
  await sleep(1500);

  // 2 players via tournament search
  await searchInTournament('NL', 'spiritzero-x-world-warrior-2024-south-korea-5', 'NL');
  await sleep(1500);
  await searchInTournament('JabhiM', 'get-washed-world-warrior-2025-south-africa-final', 'JabhiM');

  console.log('\n=== Done ===');
}

main();
