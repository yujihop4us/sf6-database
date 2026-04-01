require('dotenv').config({ path: '.env.local' });

const STARTGG_API = 'https://api.start.gg/gql/alpha';
const TOKEN = process.env.STARTGG_TOKEN;

async function fetchEntrants(tournamentSlug, eventSlug, page = 1) {
  const query = `
    query TournamentEntrants($slug: String!, $eventSlug: String!, $page: Int!) {
      tournament(slug: $slug) {
        name
        events(filter: { slug: $eventSlug }) {
          entrants(query: { page: $page, perPage: 20 }) {
            pageInfo { totalPages }
            nodes {
              name
              participants {
                gamerTag
                prefix
                player { id gamerTag }
                user { slug }
              }
            }
          }
        }
      }
    }
  `;
  const res = await fetch(STARTGG_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      query,
      variables: {
        slug: tournamentSlug,
        eventSlug: `tournament/${tournamentSlug}/event/${eventSlug}`,
        page
      }
    })
  });
  if (res.status === 429) {
    console.log('Rate limited, waiting 60s...');
    await new Promise(r => setTimeout(r, 60000));
    return fetchEntrants(tournamentSlug, eventSlug, page);
  }
  return res.json();
}

async function main() {
  // SA East Final (8 entrants) - Deiver won this to qualify for CC12
  const tournaments = [
    { slug: 'de-la-calle-world-warrior-2025-sa-east-final', event: 'street-fighter-6' },
    // Fallback: SA East individual events
    { slug: 'de-la-calle-world-warrior-2025-sa-east-2', event: 'street-fighter-6' },
    { slug: 'de-la-calle-world-warrior-2025-sa-east-4', event: 'street-fighter-6' },
  ];

  for (const t of tournaments) {
    console.log(`\n--- Searching ${t.slug} ---`);
    try {
      const data = await fetchEntrants(t.slug, t.event, 1);
      const events = data?.data?.tournament?.events;
      if (!events || events.length === 0) {
        console.log('No events found');
        continue;
      }
      const entrants = events[0].entrants;
      const totalPages = entrants.pageInfo.totalPages;
      
      let allEntrants = [...entrants.nodes];
      for (let p = 2; p <= Math.min(totalPages, 10); p++) {
        await new Promise(r => setTimeout(r, 1500));
        const pageData = await fetchEntrants(t.slug, t.event, p);
        const moreNodes = pageData?.data?.tournament?.events?.[0]?.entrants?.nodes;
        if (moreNodes) allEntrants.push(...moreNodes);
      }

      for (const e of allEntrants) {
        const tag = e.participants?.[0]?.gamerTag?.toLowerCase() || '';
        const name = e.name?.toLowerCase() || '';
        if (tag.includes('deiver') || name.includes('deiver')) {
          const p = e.participants[0];
          console.log(`\n✅ FOUND: ${e.name}`);
          console.log(`   gamerTag: ${p.gamerTag}`);
          console.log(`   prefix: ${p.prefix}`);
          console.log(`   player.id: ${p.player?.id}`);
          console.log(`   user.slug: ${p.user?.slug}`);
          console.log(`\nSQL:`);
          console.log(`UPDATE players SET startgg_player_id = ${p.player?.id} WHERE handle = 'Deiver';`);
          return;
        }
      }
      console.log('Deiver not found in this tournament');
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log('\n❌ Deiver not found in any searched tournament');
}

main();
