// scripts/fetch-final-7.js
// 残り7名の player ID を、出場が確認されている大会のエントラントから取得
require('dotenv').config({ path: '.env.local' });

const ENDPOINT = 'https://api.start.gg/gql/alpha';
const TOKEN = process.env.STARTGG_TOKEN;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gqlQuery(query, variables) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  if (res.status === 429) {
    console.log('⏳ Rate limited. 60秒待機...');
    await sleep(60000);
    return gqlQuery(query, variables);
  }
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

// === Step A: Hinao は slug 判明済み ===
// cab11166

// === 残り選手と、出場確認済みの大会 ===
const targets = [
  {
    handle: 'Hinao',
    userSlug: 'cab11166'  // "RC ひなお" として登録
  },
  {
    handle: 'Chris T',
    // WNF World Warrior US/CAN West 1 で "QAD | ChrisT" として1位
    tournamentSlug: 'wnf-world-warrior-2025-us-can-west-1',
    searchTag: 'ChrisT'
  },
  {
    handle: 'YONANGEL',
    // WW Germany 3 で優勝
    tournamentSlug: 'saltmine-league-world-warrior-2025-germany-3',
    searchTag: 'YONANGEL'
  },
  {
    handle: 'DakCorgi',
    // Fighters Spirit 2023 で "vicinalcorgi" として優勝
    tournamentSlug: 'fighters-spirit-2023',
    searchTag: 'vicinalcorgi'
  },
  {
    handle: 'Deiver',
    // Capcom Cup 11 参加 → CC X の LCQ にいるかも、
    // WW SA East で出場
    tournamentSlug: 'evo-2025',
    searchTag: 'Deiver'
  },
  {
    handle: 'Jiewa',
    // EVO Japan 2025 に参加
    tournamentSlug: 'evo-japan-2025-presented-by-levtech',
    searchTag: 'Jiewa'
  },
  {
    handle: 'lllRaihanlll',
    // WW Asia South 3 で優勝
    tournamentSlug: 'fighters-dojo-world-warrior-2025-asia-south-3',
    searchTag: 'lllRaihanlll'
  }
];

// User slug から Player ID を取得
async function getPlayerFromUserSlug(slug) {
  const query = `
    query UserPlayer($slug: String!) {
      user(slug: $slug) {
        player { id gamerTag }
      }
    }
  `;
  const data = await gqlQuery(query, { slug });
  return data.data?.user?.player;
}

// 大会のエントラントから特定の選手を検索
async function searchInTournament(tournamentSlug, searchTag) {
  const query = `
    query SearchEntrant($slug: String!, $search: String!) {
      tournament(slug: $slug) {
        participants(query: {
          filter: {
            search: {
              fieldsToSearch: ["gamerTag"],
              searchString: $search
            }
          }
        }) {
          nodes {
            gamerTag
            prefix
            player { id gamerTag }
            user { slug }
          }
        }
      }
    }
  `;
  const data = await gqlQuery(query, { slug: tournamentSlug, search: searchTag });
  const nodes = data.data?.tournament?.participants?.nodes || [];
  return nodes.length > 0 ? nodes[0] : null;
}

async function main() {
  console.log('🚀 最終7名の start.gg Player ID 取得\n');

  for (const target of targets) {
    if (target.userSlug) {
      // slug が既知の場合
      try {
        const player = await getPlayerFromUserSlug(target.userSlug);
        if (player) {
          console.log(`UPDATE players SET startgg_player_id = ${player.id} WHERE handle = '${target.handle}';`);
        } else {
          console.log(`  ❌ ${target.handle} (slug: ${target.userSlug}) → Player データなし`);
        }
      } catch (err) {
        console.log(`  ❌ ${target.handle}: ${err.message}`);
      }
    } else {
      // 大会エントラントから検索
      try {
        console.log(`  🔎 ${target.handle} → ${target.tournamentSlug} から検索中...`);
        const result = await searchInTournament(target.tournamentSlug, target.searchTag);
        if (result?.player?.id) {
          const safeHandle = target.handle.replace(/'/g, "''");
          console.log(`UPDATE players SET startgg_player_id = ${result.player.id} WHERE handle = '${safeHandle}';`);
          console.log(`  -- (found as: ${result.prefix || ''}${result.gamerTag}, user: ${result.user?.slug || 'N/A'})`);
        } else {
          console.log(`  ❌ ${target.handle} → ${target.tournamentSlug} に該当なし`);
        }
      } catch (err) {
        console.log(`  ❌ ${target.handle}: ${err.message}`);
      }
    }
    await sleep(1500);
  }

  console.log('\n✅ 完了！SQLをSupabaseで実行してください');
}

main().catch(err => { console.error('❌', err); process.exit(1); });
