// scripts/import-tournament.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const STARTGG_API = 'https://api.start.gg/gql/alpha';
const TOKEN = process.env.STARTGG_TOKEN;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/import-tournament.js <start.gg-slug>');
  process.exit(1);
}

// ---------- GraphQL helpers ----------

async function gql(query, variables) {
  const res = await fetch(STARTGG_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 429) {
    console.log('⏳ Rate limited, waiting 60s...');
    await sleep(60000);
    return gql(query, variables);
  }
  const json = await res.json();
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors, null, 2));
  }
  return json;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- Step 1: Fetch tournament info ----------

async function fetchTournamentInfo() {
  console.log(`\n🔍 Fetching tournament: ${slug}`);
  const data = await gql(
    `query ($slug: String!) {
      tournament(slug: $slug) {
        id
        name
        startAt
        endAt
        venueAddress
        city
        countryCode
        isOnline
        events(filter: { videogameId: 43868 }) {
          id
          name
          numEntrants
        }
      }
    }`,
    { slug }
  );

  const t = data?.data?.tournament;
  if (!t) {
    console.error('❌ Tournament not found on start.gg');
    process.exit(1);
  }

  // SF6 イベントを優先順位付きで選択
const sf6Event = 
  // 1. CPT Premier を最優先
  t.events?.find(e => /cpt.*premier|premier.*cpt/i.test(e.name)) ||
  // 2. "street fighter 6" を含む最大参加者数のイベント
  t.events
    ?.filter(e => /street fighter 6/i.test(e.name) && !/team|itc|3v3/i.test(e.name))
    .sort((a, b) => (b.numEntrants || 0) - (a.numEntrants || 0))[0] ||
  // 3. フォールバック：最大参加者数のイベント
  t.events?.sort((a, b) => (b.numEntrants || 0) - (a.numEntrants || 0))[0];

if (!sf6Event) {
  console.error('❌ No SF6 event found in this tournament');
  console.log('Available events:', t.events);
  process.exit(1);
}

console.log(`   SF6 Event: ${sf6Event.name} (${sf6Event.numEntrants} entrants)`);


  console.log(`✅ Found: ${t.name}`);
  console.log(`   SF6 Event: ${sf6Event.name} (${sf6Event.numEntrants} entrants)`);
  console.log(`   Event ID: ${sf6Event.id}`);

  return {
    tournament: {
      startgg_tournament_id: t.id,
      name: t.name,
      slug: slug,
      start_date: t.startAt ? new Date(t.startAt * 1000).toISOString().split('T')[0] : null,
      end_date: t.endAt ? new Date(t.endAt * 1000).toISOString().split('T')[0] : null,
      location: t.city || null,
      country: t.countryCode || null,
      is_online: t.isOnline || false,
    },
    eventId: sf6Event.id,
    eventName: sf6Event.name,
    numEntrants: sf6Event.numEntrants,
  };
}

// ---------- Step 2: Upsert tournament in DB ----------

async function upsertTournament(info) {
  const { data: existing } = await supabase
    .from('tournaments')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) {
    console.log(`📝 Updating existing tournament (id=${existing.id})`);
    await supabase
      .from('tournaments')
      .update({
        ...info,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data: existingById } = await supabase
    .from('tournaments')
    .select('id')
    .eq('startgg_tournament_id', info.startgg_tournament_id)
    .maybeSingle();

  if (existingById) {
    console.log(`📝 Updating existing tournament by startgg ID (id=${existingById.id})`);
    await supabase
      .from('tournaments')
      .update({
        ...info,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingById.id);
    return existingById.id;
  }

  const { data: inserted, error } = await supabase
    .from('tournaments')
    .insert({
      ...info,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Failed to insert tournament:', error);
    process.exit(1);
  }

  console.log(`✅ Inserted new tournament (id=${inserted.id})`);
  return inserted.id;
}

// ---------- Step 3: Fetch entrants ----------

async function fetchEntrants(eventId) {
  console.log(`\n🔍 Fetching entrants...`);
  const allEntrants = [];
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
      { eventId, page, perPage }
    );

    const entrants = data?.data?.event?.entrants;
    if (!entrants?.nodes?.length) break;

    for (const ent of entrants.nodes) {
      const p = ent.participants?.[0];
      if (!p) continue;
      allEntrants.push({
        startgg_entrant_id: ent.id,
        seed: ent.initialSeedNum,
        placement: ent.standing?.placement || null,
        gamerTag: p.gamerTag,
        prefix: p.prefix || null,
        startgg_player_id: p.player?.id || null,
        user_slug: p.user?.slug || null,
      });
    }

    const totalPages = entrants.pageInfo?.totalPages || 1;
    console.log(`   Page ${page}/${totalPages} (${allEntrants.length} entrants so far)`);
    if (page >= totalPages) break;
    page++;
    await sleep(1500);
  }

  console.log(`✅ Total entrants fetched: ${allEntrants.length}`);
  return allEntrants;
}

// ---------- Step 4: Match entrants to players ----------

async function matchAndInsert(tournamentId, entrants) {
  // ★ 修正: 全プレイヤーをページネーションで取得（Supabase のデフォルト1000行制限を回避）
  let allPlayers = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id, handle, startgg_player_id, startgg_player_ids')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    allPlayers = allPlayers.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`📥 Loaded ${allPlayers.length} players from DB`);
  const players = allPlayers;

  // startgg_player_id → player のマップ
  const playerMap = new Map();
  for (const p of players) {
    if (p.startgg_player_ids && p.startgg_player_ids.length > 0) {
      for (const pid of p.startgg_player_ids) {
        playerMap.set(Number(pid), p);
      }
    } else if (p.startgg_player_id) {
      playerMap.set(Number(p.startgg_player_id), p);
    }
  }

  // gamerTag → player の逆引きマップ（大文字小文字無視）
  const handleMap = new Map();
  for (const p of players) {
    handleMap.set(p.handle.toLowerCase(), p);
  }

  // 既存エントラントの重複チェック
  const { data: existingEntrants } = await supabase
    .from('tournament_entrants')
    .select('player_id')
    .eq('tournament_id', tournamentId);

  const existingPlayerIds = new Set(
    (existingEntrants || []).map((e) => e.player_id)
  );

  const matched = [];
  const unmatched = [];
  const skipped = [];
  const autoMatchCandidates = [];
  const autoCreated = [];

  for (const ent of entrants) {
    let player = playerMap.get(ent.startgg_player_id);

    // ID でマッチしなかった場合
    if (!player) {
      const tagLower = (ent.gamerTag || '').toLowerCase();
      const candidate = handleMap.get(tagLower);

      if (candidate) {
        // gamerTag は一致するが ID が違う → 候補レポート & 既存プレイヤーとして扱う
        autoMatchCandidates.push({
          handle: candidate.handle,
          db_player_id: candidate.id,
          db_ids: candidate.startgg_player_ids,
          startgg_player_id: ent.startgg_player_id,
          gamerTag: ent.gamerTag,
          prefix: ent.prefix || '',
        });
        player = candidate;
      } else {
        // 完全に未知のプレイヤー → 自動追加
        const { data: newPlayer, error: insertErr } = await supabase
          .from('players')
          .insert({
            handle: ent.gamerTag,
            startgg_player_id: ent.startgg_player_id,
            startgg_player_ids: [String(ent.startgg_player_id)],
            team: ent.prefix || null,
          })
          .select('id, handle')
          .single();

        if (insertErr) {
          unmatched.push(ent);
          continue;
        }

        playerMap.set(ent.startgg_player_id, newPlayer);
        handleMap.set(newPlayer.handle.toLowerCase(), newPlayer);
        player = newPlayer;
        autoCreated.push({
          handle: newPlayer.handle,
          id: newPlayer.id,
          startgg_player_id: ent.startgg_player_id,
        });
      }
    }

    if (existingPlayerIds.has(player.id)) {
      skipped.push({ ...ent, db_handle: player.handle });
      continue;
    }
    if (matched.some((m) => m.player_id === player.id)) {
      skipped.push({ ...ent, db_handle: player.handle });
      continue;
    }

    matched.push({
      tournament_id: tournamentId,
      player_id: player.id,
      startgg_entrant_id: ent.startgg_entrant_id,
      seed: ent.seed,
      placement: ent.placement,
    });
  }

  // Batch insert
  if (matched.length > 0) {
    const { error } = await supabase
      .from('tournament_entrants')
      .upsert(matched, {
        onConflict: 'tournament_id,player_id',
        ignoreDuplicates: true,
      });

    if (error) {
      console.error('❌ Insert error:', error);
    } else {
      console.log(`\n✅ Inserted ${matched.length} entrants`);
    }
  }

  // Report
  if (skipped.length > 0) {
    console.log(`⏭️  Skipped ${skipped.length} (already in DB)`);
  }

  if (unmatched.length > 0) {
    console.log(
      `\n⚠️  ${unmatched.length} entrants NOT matched to players table:`
    );
    console.log('─'.repeat(60));
    for (const u of unmatched.slice(0, 30)) {
      console.log(
        `   ${u.prefix ? u.prefix + ' | ' : ''}${u.gamerTag}  (player_id: ${u.startgg_player_id})`
      );
    }
    if (unmatched.length > 30) {
      console.log(`   ... and ${unmatched.length - 30} more`);
    }
  }

  if (skipped.length > 0) {
    console.log(
      '⏭️  Skipped players:',
      skipped.map((s) => s.db_handle).join(', ')
    );
  }

  // Auto-match candidates report
  if (autoMatchCandidates.length > 0) {
    console.log(
      `\n🔗 Auto-match candidates (gamerTag matched handle but player_id differs):`
    );
    console.log('─'.repeat(60));
    const sqlLines = [];
    for (const c of autoMatchCandidates) {
      console.log(
        `   ${c.prefix ? c.prefix + ' | ' : ''}${c.gamerTag} → DB: "${c.handle}" (db_ids: [${c.db_ids}], new_id: ${c.startgg_player_id})`
      );
      sqlLines.push(
        `UPDATE players SET startgg_player_ids = array_append(startgg_player_ids, '${c.startgg_player_id}') WHERE handle = '${c.handle.replace(/'/g, "''")}';`
      );
    }
    console.log(`\n📋 Run this SQL to add missing IDs:\n`);
    for (const sql of sqlLines) {
      console.log(`   ${sql}`);
    }
    console.log('');
  }

  // Auto-created players report
  if (autoCreated.length > 0) {
    console.log(
      `\n🆕 Auto-created ${autoCreated.length} new players in DB:`
    );
    console.log('─'.repeat(60));
    for (const c of autoCreated) {
      console.log(
        `   ${c.handle} (player_id: ${c.startgg_player_id}, db_id: ${c.id})`
      );
    }
    console.log('');
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log(`📊 Summary for tournament_id = ${tournamentId}`);
  console.log(`   Matched & inserted: ${matched.length}`);
  console.log(`   Already existed:    ${skipped.length}`);
  console.log(`   Unmatched:          ${unmatched.length}`);
  console.log('═'.repeat(60));
}

// ---------- Main ----------

(async () => {
  try {
    const { tournament, eventId } = await fetchTournamentInfo();
    const tournamentId = await upsertTournament({
      ...tournament,
      startgg_event_id: eventId,
    });
    const entrants = await fetchEntrants(eventId);
    await matchAndInsert(tournamentId, entrants);
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
})();
