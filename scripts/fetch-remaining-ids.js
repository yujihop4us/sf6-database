// scripts/fetch-remaining-ids.js
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

// Google検索で見つかった User Slug 一覧
const knownSlugs = {
  'Momochi':            '7b2d35d2',
  'NuckleDu':           '71b98b1d',
  'Itabashi Zangief':   'c46d6f76',
  'Xiaohai':            '0ad5900f',
  'Blaz':               '37844e8a',
  'HotDog29':           'e9050ed0',
  'YHC-Mochi':          '390dfda2',
  'Sahara':             'a0062bed',
  'pugera':             '9594efe4',
  'kincho':             'c5bc27ca',
  'AngryBird':          '3471a2f7',
  'Kobayan':            'ef64257e',
  'Higuchi':            'fee94c73',
  'Ryukichi':           '9f36f82b',
  'Chris T':            null,         // slug未特定 → 大会検索で取得
  'Vxbao':              '50096866',
  'Kilzyou':            'dcd53ca7',
  'Lexx':               'ec4d302b',
  'Micky':              '09e5dcc1',
  'Tashi':              'd8ef8e97',
  'NotPedro':           '9beebe73',
  'LUGABO':             '9242d9e3',
  'ARMAKOF':            'fe2246d9',
  'Xerna':              '91a47593',
  'JAK':                'ca35d13c',
  'YONANGEL':           null,         // slug未特定
  'Hinao':              null,         // ひなお表記、大会検索で取得
  'DakCorgi':           null,         // slug未特定
  'Deiver':             null,         // slug未特定
  'Jiewa':              null,         // slug未特定
  'lllRaihanlll':       null,         // slug未特定
};

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

async function main() {
  console.log('🚀 残り選手の start.gg Player ID 取得開始\n');

  for (const [handle, slug] of Object.entries(knownSlugs)) {
    if (!slug) {
      console.log(`  ⏭️  ${handle} → slug未特定、手動確認が必要`);
      continue;
    }

    try {
      const data = await gqlQuery(query, { slug });
      const player = data.data?.user?.player;
      if (player) {
        console.log(`UPDATE players SET startgg_player_id = ${player.id} WHERE handle = '${handle.replace(/'/g, "''")}';`);
      } else {
        console.log(`  ❌ ${handle} (slug: ${slug}) → Player データなし`);
      }
    } catch (err) {
      console.log(`  ❌ ${handle}: ${err.message}`);
    }

    await sleep(1500);
  }

  console.log('\n-- slug未特定の選手:');
  console.log('-- Chris T: start.gg上の表記が "ChrisT" か "Chris_Tatarian" の可能性');
  console.log('-- YONANGEL: WW Germany 大会のエントラントから取得可能');
  console.log('-- Hinao: "RC ひなお" 表記、FightClub VI Chengdu のエントラントから取得可能');
  console.log('-- DakCorgi: Fighters Spirit 2023 or WW South Korea から取得可能');
  console.log('-- Deiver: WW South America East から取得可能');
  console.log('-- Jiewa: CPT Asia or FightClub IV から取得可能');
  console.log('-- lllRaihanlll: WW Asia South から取得可能');

  console.log('\n✅ 上記SQLをSupabaseで実行してください');
}

main().catch(err => { console.error('❌', err); process.exit(1); });
