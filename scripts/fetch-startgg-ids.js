// scripts/fetch-startgg-ids.js
// CC X のエントラント + 個別検索で CC12 全48選手の start.gg player ID を取得

require('dotenv').config({ path: '.env.local' });

const ENDPOINT = 'https://api.start.gg/gql/alpha';
const TOKEN = process.env.STARTGG_TOKEN;

if (!TOKEN) {
  console.error('❌ STARTGG_TOKEN が .env に設定されていません');
  process.exit(1);
}

// CC12 出場48選手のハンドル名一覧
const CC12_PLAYERS = [
  'Xiaohai', 'Juicyjoe', 'Blaz', 'HotDog29',
  'Kawano', 'EndingWalker', 'Fuudo', 'Bravery',
  'Big Bird', 'YHC-Mochi', 'DakCorgi', 'MenaRD',
  'Sahara', 'shaka22', 'NL', 'JabhiM',
  'YONANGEL', 'Caba', 'Dual Kevin', 'pugera',
  'kincho', 'AngryBird', 'Momochi', 'Tashi',
  'gachikun', 'Vxbao', 'Kobayan', 'NotPedro',
  'Leshar', 'LUGABO', 'Ryukichi', 'Travis Styles',
  'Higuchi', 'Tokido', 'ARMAKOF', 'Xerna',
  'Rainpro', 'Lexx', 'Chris T', 'Micky',
  'Kilzyou', 'Hinao', 'NuckleDu', 'lllRaihanlll',
  'JAK', 'Deiver', 'Itabashi Zangief', 'Jiewa'
];

// ハンドル名の揺れに対応するマッピング（start.gg上の表記 → CC12ハンドル）
const NAME_ALIASES = {
  'bigbird': 'Big Bird',
  'big bird': 'Big Bird',
  'xiao hai': 'Xiaohai',
  'xiaohai': 'Xiaohai',
  'yhc-mochi': 'YHC-Mochi',
  'yhc mochi': 'YHC-Mochi',
  'itabashi zangief': 'Itabashi Zangief',
  'itazan': 'Itabashi Zangief',
  'ending walker': 'EndingWalker',
  'endingwalker': 'EndingWalker',
  'chris t': 'Chris T',
  'christatarian': 'Chris T',
  'nuckleDu': 'NuckleDu',
  'nuckledu': 'NuckleDu',
  'dual kevin': 'Dual Kevin',
  'dualkevin': 'Dual Kevin',
  'travis styles': 'Travis Styles',
  'angrybird': 'AngryBird',
  'angry bird': 'AngryBird',
  'hotdog29': 'HotDog29',
  'lllraihanlll': 'lllRaihanlll',
};

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

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// Step 1: CC X のエントラントから player ID を取得
// ========================================
async function fetchCCXEntrants() {
  console.log('\n📡 Step 1: CC X のエントラントを取得中...\n');

  const query = `
    query CCXEntrants($slug: String!, $page: Int!, $perPage: Int!) {
      tournament(slug: $slug) {
        id
        name
        events {
          id
          name
          entrants(query: { page: $page, perPage: $perPage }) {
            pageInfo {
              totalPages
              total
            }
            nodes {
              id
              name
              participants {
                gamerTag
                prefix
                player {
                  id
                  gamerTag
                }
                user {
                  slug
                }
              }
            }
          }
        }
      }
    }
  `;

  const results = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await gqlQuery(query, {
      slug: 'capcom-cup-x',
      page: page,
      perPage: 50
    });

    const tournament = data.data?.tournament;
    if (!tournament) {
      console.log('❌ CC X のトーナメントが見つかりません');
      break;
    }

    for (const event of tournament.events) {
      const entrants = event.entrants;
      totalPages = entrants.pageInfo.totalPages;

      for (const entrant of entrants.nodes) {
        for (const participant of entrant.participants) {
          results.push({
            gamerTag: participant.gamerTag,
            prefix: participant.prefix || '',
            playerId: participant.player?.id || null,
            playerGamerTag: participant.player?.gamerTag || '',
            userSlug: participant.user?.slug || ''
          });
        }
      }
    }

    console.log(`  ページ ${page}/${totalPages} 取得完了 (累計: ${results.length}名)`);
    page++;
    await sleep(1500);
  }

  return results;
}

// ========================================
// Step 2: CC12 選手とマッチング
// ========================================
function matchPlayers(ccxEntrants) {
  console.log('\n🔍 Step 2: CC12 選手とマッチング中...\n');

  const matched = {};
  const unmatched = [];

  for (const handle of CC12_PLAYERS) {
    const handleLower = handle.toLowerCase();

    // エントラントの中から一致を探す
    const found = ccxEntrants.find(e => {
      const tag = (e.gamerTag || '').toLowerCase();
      const playerTag = (e.playerGamerTag || '').toLowerCase();
      return tag === handleLower || playerTag === handleLower;
    });

    if (found && found.playerId) {
      matched[handle] = {
        playerId: found.playerId,
        userSlug: found.userSlug,
        gamerTag: found.gamerTag
      };
      console.log(`  ✅ ${handle} → player_id: ${found.playerId}, user: ${found.userSlug}`);
    } else {
      // エイリアスで再検索
      const alias = Object.entries(NAME_ALIASES).find(([k, v]) => v === handle);
      if (alias) {
        const aliasFound = ccxEntrants.find(e => {
          const tag = (e.gamerTag || '').toLowerCase();
          return tag === alias[0];
        });
        if (aliasFound && aliasFound.playerId) {
          matched[handle] = {
            playerId: aliasFound.playerId,
            userSlug: aliasFound.userSlug,
            gamerTag: aliasFound.gamerTag
          };
          console.log(`  ✅ ${handle} (alias: ${alias[0]}) → player_id: ${aliasFound.playerId}`);
          continue;
        }
      }
      unmatched.push(handle);
      console.log(`  ❓ ${handle} → CC X に該当なし`);
    }
  }

  return { matched, unmatched };
}

// ========================================
// Step 3: 未マッチの選手を CPT 2025 Premier 大会から検索
// ========================================
async function searchUnmatchedFromTournaments(unmatchedHandles) {
  if (unmatchedHandles.length === 0) return {};

  console.log(`\n📡 Step 3: 未マッチ ${unmatchedHandles.length}名 を他大会から検索中...\n`);

  // CPT 2025 の主要大会スラッグ
  const tournamentSlugs = [
    'evo-2025',
    'ultimate-fighting-arena-2025',
    'evolution-championship-series-france-2025',
    'esports-world-cup-2025'
  ];

  const found = {};

  for (const slug of tournamentSlugs) {
    if (unmatchedHandles.length === Object.keys(found).length) break;

    console.log(`  🔎 ${slug} を検索中...`);

    const query = `
      query TournamentEntrants($slug: String!, $page: Int!, $perPage: Int!) {
        tournament(slug: $slug) {
          id
          name
          events(filter: { videogameId: [43868] }) {
            entrants(query: { page: $page, perPage: $perPage }) {
              pageInfo { totalPages total }
              nodes {
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
    `;

    try {
      // 最初の数ページだけ検索（大規模大会は数百ページある）
      for (let page = 1; page <= 5; page++) {
        const data = await gqlQuery(query, { slug, page, perPage: 50 });
        const tournament = data.data?.tournament;
        if (!tournament) break;

        for (const event of tournament.events || []) {
          for (const entrant of event.entrants?.nodes || []) {
            for (const p of entrant.participants || []) {
              const tag = (p.gamerTag || '').toLowerCase();
              const stillNeeded = unmatchedHandles.filter(h => !found[h]);

              for (const handle of stillNeeded) {
                if (tag === handle.toLowerCase() && p.player?.id) {
                  found[handle] = {
                    playerId: p.player.id,
                    userSlug: p.user?.slug || '',
                    gamerTag: p.gamerTag
                  };
                  console.log(`    ✅ ${handle} → player_id: ${p.player.id} (from ${slug})`);
                }
              }
            }
          }
        }

        await sleep(1500);
      }
    } catch (err) {
      console.log(`    ⚠️ ${slug} の取得に失敗: ${err.message}`);
    }
  }

  return found;
}

// ========================================
// Step 4: 既知の User Slug から直接取得
// ========================================
async function fetchFromKnownSlugs(unmatchedHandles) {
  if (unmatchedHandles.length === 0) return {};

  console.log(`\n📡 Step 4: 既知 User Slug から player ID を取得中...\n`);

  // Google検索で見つかった既知の User Slug
  const knownSlugs = {
    'Tokido': 'a4c7c2d4',
    'gachikun': '7fc0306f',
    'MenaRD': '31a13177',
    'Punk': '1b9e2ed9'
  };

  const found = {};

  for (const handle of unmatchedHandles) {
    const slug = knownSlugs[handle];
    if (!slug) continue;

    const query = `
      query UserPlayer($slug: String!) {
        user(slug: $slug) {
          player {
            id
            gamerTag
          }
        }
      }
    `;

    try {
      const data = await gqlQuery(query, { slug });
      const player = data.data?.user?.player;
      if (player) {
        found[handle] = {
          playerId: player.id,
          userSlug: slug,
          gamerTag: player.gamerTag
        };
        console.log(`  ✅ ${handle} → player_id: ${player.id} (from user slug)`);
      }
    } catch (err) {
      console.log(`  ⚠️ ${handle}: ${err.message}`);
    }

    await sleep(1500);
  }

  return found;
}

// ========================================
// Step 5: SQL 出力
// ========================================
function generateSQL(allMatched) {
  console.log('\n\n========================================');
  console.log('📋 SQL UPDATE ステートメント');
  console.log('========================================\n');

  const statements = [];

  for (const [handle, info] of Object.entries(allMatched)) {
    // シングルクォートをエスケープ
    const safeHandle = handle.replace(/'/g, "''");
    const stmt = `UPDATE players SET startgg_player_id = ${info.playerId} WHERE handle = '${safeHandle}';`;
    statements.push(stmt);
    console.log(stmt);
  }

  console.log(`\n-- 合計: ${statements.length} / 48 選手の紐付け完了`);

  // 未紐付けの選手を表示
  const unmatchedFinal = CC12_PLAYERS.filter(h => !allMatched[h]);
  if (unmatchedFinal.length > 0) {
    console.log(`\n-- ⚠️ 未紐付け (${unmatchedFinal.length}名):`);
    unmatchedFinal.forEach(h => console.log(`--   ${h}`));
    console.log('-- → これらは手動で start.gg プロフィールを検索して追加してください');
  }

  return statements.join('\n');
}

// ========================================
// メイン実行
// ========================================
async function main() {
  console.log('🚀 start.gg Player ID 収集スクリプト開始');
  console.log(`   対象: CC12 出場 ${CC12_PLAYERS.length}名\n`);

  // Step 1: CC X から取得
  const ccxEntrants = await fetchCCXEntrants();
  console.log(`\n  CC X エントラント: ${ccxEntrants.length}名 取得`);

  // Step 2: マッチング
  const { matched, unmatched } = matchPlayers(ccxEntrants);
  console.log(`\n  マッチ: ${Object.keys(matched).length}名 / 未マッチ: ${unmatched.length}名`);

  // Step 3: 他大会から検索
  const fromTournaments = await searchUnmatchedFromTournaments(unmatched);
  const stillUnmatched = unmatched.filter(h => !fromTournaments[h]);

  // Step 4: 既知 Slug から取得
  const fromSlugs = await fetchFromKnownSlugs(stillUnmatched);

  // 全結果を統合
  const allMatched = { ...matched, ...fromTournaments, ...fromSlugs };

  // Step 5: SQL 出力
  generateSQL(allMatched);

  console.log('\n✅ 完了！上記の SQL を Supabase SQL Editor に貼り付けて実行してください。');
}

main().catch(err => {
  console.error('❌ エラー:', err);
  process.exit(1);
});
