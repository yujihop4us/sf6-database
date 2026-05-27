/**
 * update-player-profiles.js — players テーブルの main_character / country_code を自動更新
 *
 * 使い方:
 *   node scripts/update-player-profiles.js              # 全欠損選手を更新
 *   node scripts/update-player-profiles.js --char-only  # main_character のみ（DB内集計）
 *   node scripts/update-player-profiles.js --country-only # country_code のみ（start.gg API）
 *   node scripts/update-player-profiles.js --dry-run    # DB書き込みなし
 *   node scripts/update-player-profiles.js --tournament-id=48  # 特定大会の出場選手のみ
 *   node scripts/update-player-profiles.js --limit=100  # テスト用上限
 *
 * 処理:
 *   1. main_character: tournament_sets の winner_character を集計 → 最多使用キャラを設定
 *   2. country_code:   start.gg player profile API → player.user.location.country をISO変換
 *
 * Rate limit: start.gg 80 req/min。country_only 時のみ適用。
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const STARTGG_TOKEN = process.env.STARTGG_TOKEN || process.env.STARTGG_API_TOKEN
const STARTGG_API   = 'https://api.start.gg/gql/alpha'

// ── Arg parsing ──────────────────────────────────────────────────────────────
function parseArgs() {
  const args = {}
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/)
    if (m) args[m[1]] = m[2] ?? true
  }
  return args
}

const argv = parseArgs()
const DRY_RUN      = !!argv['dry-run']
const CHAR_ONLY    = !!argv['char-only']
const COUNTRY_ONLY = !!argv['country-only']
const LIMIT        = argv['limit'] ? Number(argv['limit']) : null
const TOURNAMENT_ID = argv['tournament-id'] ? Number(argv['tournament-id']) : null
const DO_CHAR      = !COUNTRY_ONLY
const DO_COUNTRY   = !CHAR_ONLY

// ── 国名 → ISO 2 コード マッピング ──────────────────────────────────────────
const COUNTRY_TO_ISO2 = {
  'United States':              'US', 'USA':             'US', 'United States of America': 'US',
  'Japan':                      'JP',
  'China':                      'CN',
  'South Korea':                'KR', 'Korea, Republic of': 'KR',
  'Taiwan':                     'TW', 'Taiwan, Province of China': 'TW',
  'Hong Kong':                  'HK', 'Hong Kong SAR':   'HK',
  'France':                     'FR',
  'United Kingdom':             'GB', 'UK':              'GB', 'England': 'GB',
  'Germany':                    'DE',
  'Spain':                      'ES',
  'Italy':                      'IT',
  'Netherlands':                'NL',
  'Belgium':                    'BE',
  'Sweden':                     'SE',
  'Norway':                     'NO',
  'Denmark':                    'DK',
  'Finland':                    'FI',
  'Switzerland':                'CH',
  'Austria':                    'AT',
  'Portugal':                   'PT',
  'Canada':                     'CA',
  'Mexico':                     'MX',
  'Brazil':                     'BR',
  'Argentina':                  'AR',
  'Chile':                      'CL',
  'Colombia':                   'CO',
  'Peru':                       'PE',
  'Venezuela':                  'VE',
  'Australia':                  'AU',
  'New Zealand':                'NZ',
  'Singapore':                  'SG',
  'Malaysia':                   'MY',
  'Thailand':                   'TH',
  'Indonesia':                  'ID',
  'Philippines':                'PH',
  'Vietnam':                    'VN',
  'India':                      'IN',
  'Pakistan':                   'PK',
  'Saudi Arabia':               'SA',
  'United Arab Emirates':       'AE', 'UAE': 'AE',
  'Egypt':                      'EG',
  'Morocco':                    'MA',
  'South Africa':               'ZA',
  'Nigeria':                    'NG',
  'Russia':                     'RU',
  'Ukraine':                    'UA',
  'Poland':                     'PL',
  'Czech Republic':             'CZ', 'Czechia': 'CZ',
  'Hungary':                    'HU',
  'Romania':                    'RO',
  'Greece':                     'GR',
  'Turkey':                     'TR',
  'Israel':                     'IL',
}

function countryToISO2(raw) {
  if (!raw) return null
  const trimmed = raw.trim()
  return COUNTRY_TO_ISO2[trimmed] ?? null
}

// ── Rate limit ───────────────────────────────────────────────────────────────
const RATE_LIMIT_BATCH = 78
const RATE_LIMIT_PAUSE = 62_000
const REQUEST_INTERVAL = 760

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── GraphQL helper ───────────────────────────────────────────────────────────
async function gql(query, variables, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(STARTGG_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${STARTGG_TOKEN}`,
        },
        body: JSON.stringify({ query, variables }),
      })
      if (res.status === 429) {
        const wait = (i + 1) * 30_000
        console.log(`  ⏳ Rate limited, waiting ${wait / 1000}s...`)
        await sleep(wait)
        continue
      }
      const json = await res.json()
      if (json.errors) {
        const msg = json.errors[0]?.message ?? 'unknown'
        if (msg.includes('complexity') || msg.includes('Timeout')) {
          await sleep((i + 1) * 5_000)
          continue
        }
        return null
      }
      return json.data
    } catch (err) {
      if (i === retries - 1) console.error('  Fetch error:', err.message)
      await sleep(2_000)
    }
  }
  return null
}

const Q_PLAYER_LOCATION = `
query PlayerLocation($playerId: ID!) {
  player(id: $playerId) {
    id
    gamerTag
    user {
      location {
        country
      }
    }
  }
}`

// ── Part 1: main_character (DB集計) ─────────────────────────────────────────

async function computeMainCharacters(playerIds) {
  console.log('[CHAR] Computing main_character from tournament_sets...')

  // 対象選手の winner_character 集計を全大会から取得
  const charMap = new Map()   // player_id → { char → count }

  // バッチで取得（PostgREST の IN 制限対策）
  const BATCH = 100
  for (let i = 0; i < playerIds.length; i += BATCH) {
    const batch = playerIds.slice(i, i + BATCH)
    const { data: sets } = await supabase
      .from('tournament_sets')
      .select('winner_id, winner_character')
      .in('winner_id', batch)
      .not('winner_character', 'is', null)

    for (const s of sets ?? []) {
      if (!s.winner_id || !s.winner_character) continue
      if (!charMap.has(s.winner_id)) charMap.set(s.winner_id, {})
      const m = charMap.get(s.winner_id)
      m[s.winner_character] = (m[s.winner_character] ?? 0) + 1
    }
  }

  console.log(`[CHAR] ${charMap.size} players have set-based character data`)

  // 最多使用キャラを選択
  const updates = []
  for (const [playerId, freq] of charMap) {
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
    if (top) updates.push({ id: playerId, main_character: top[0], wins: top[1] })
  }

  return updates
}

// ── Part 2: country_code (start.gg API) ─────────────────────────────────────

async function fetchCountryCodes(players) {
  console.log(`\n[COUNTRY] Fetching country_code from start.gg for ${players.length} players...`)
  if (!STARTGG_TOKEN) {
    console.warn('  ⚠️  STARTGG_TOKEN not set — skipping country update')
    return []
  }

  const updates = []
  let reqCount = 0

  for (let i = 0; i < players.length; i++) {
    const p = players[i]
    const sgId = p.startgg_player_id
    if (!sgId) continue

    // Rate limit pause
    if (reqCount > 0 && reqCount % RATE_LIMIT_BATCH === 0) {
      console.log(`\n[RATE LIMIT] ${reqCount} requests — pausing ${RATE_LIMIT_PAUSE / 1000}s...`)
      await sleep(RATE_LIMIT_PAUSE)
    }

    const data = await gql(Q_PLAYER_LOCATION, { playerId: String(sgId) })
    reqCount++

    const country = data?.player?.user?.location?.country
    const iso2 = countryToISO2(country)

    if (iso2) {
      updates.push({ id: p.id, country_code: iso2 })
      if (updates.length <= 5) {
        console.log(`  [sample] id=${p.id} handle=${p.handle}: "${country}" → ${iso2}`)
      }
    }

    if ((i + 1) % 100 === 0 || i + 1 === players.length) {
      console.log(`[COUNTRY] ${i + 1}/${players.length} processed — found=${updates.length}`)
    }

    await sleep(REQUEST_INTERVAL)
  }

  return updates
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║        SF6 Player Profile Updater                          ║
╚════════════════════════════════════════════════════════════╝
  mode          : ${CHAR_ONLY ? 'char-only' : COUNTRY_ONLY ? 'country-only' : 'both'}
  tournament_id : ${TOURNAMENT_ID ?? 'all'}
  dry-run       : ${DRY_RUN}
  limit         : ${LIMIT ?? 'none'}
`)

  // ── 更新対象選手を取得 ──
  let playerQuery = supabase
    .from('players')
    .select('id, handle, main_character, country_code, startgg_player_id')
    .not('startgg_player_id', 'is', null)

  if (DO_CHAR && DO_COUNTRY) {
    playerQuery = playerQuery.or('main_character.is.null,country_code.is.null')
  } else if (DO_CHAR) {
    playerQuery = playerQuery.is('main_character', null)
  } else {
    playerQuery = playerQuery.is('country_code', null)
  }

  // 特定大会の出場選手に絞り込む
  if (TOURNAMENT_ID) {
    const { data: entrants } = await supabase
      .from('tournament_entrants')
      .select('player_id')
      .eq('tournament_id', TOURNAMENT_ID)
    const ids = [...new Set(entrants?.map(e => e.player_id).filter(Boolean))]
    console.log(`[INFO] Filtering to ${ids.length} entrants of tournament_id=${TOURNAMENT_ID}`)
    playerQuery = playerQuery.in('id', ids)
  }

  const { data: allPlayers, error } = await playerQuery.limit(LIMIT ?? 30000)
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  let players = allPlayers ?? []
  console.log(`[INFO] ${players.length} players to process\n`)
  if (!players.length) { console.log('Nothing to do.'); return }

  const playerIds = players.map(p => p.id)

  let charUpdated = 0, countryUpdated = 0, errors = 0

  // ── Part 1: main_character ──
  if (DO_CHAR) {
    const needChar = players.filter(p => !p.main_character)
    const needCharIds = needChar.map(p => p.id)
    console.log(`[CHAR] ${needChar.length} players need main_character`)

    if (needCharIds.length) {
      const charUpdates = await computeMainCharacters(needCharIds)
      console.log(`[CHAR] ${charUpdates.length} players have computable main_character`)

      if (!DRY_RUN) {
        for (const u of charUpdates) {
          const { error: upErr } = await supabase
            .from('players')
            .update({ main_character: u.main_character })
            .eq('id', u.id)
          if (upErr) { errors++; console.error(`  ⚠️  id=${u.id}: ${upErr.message}`) }
          else charUpdated++
        }
        console.log(`[CHAR] ✅ Updated ${charUpdated} players`)
      } else {
        console.log(`[dry-run] Would update ${charUpdates.length} main_character values`)
        charUpdates.slice(0, 5).forEach(u =>
          console.log(`  id=${u.id}: main_character="${u.main_character}" (${u.wins} wins)`)
        )
        charUpdated = charUpdates.length
      }
    }
  }

  // ── Part 2: country_code ──
  if (DO_COUNTRY) {
    const needCountry = players.filter(p => !p.country_code)
    console.log(`\n[COUNTRY] ${needCountry.length} players need country_code`)

    if (needCountry.length) {
      const countryUpdates = await fetchCountryCodes(needCountry)
      console.log(`[COUNTRY] ${countryUpdates.length} country codes resolved`)

      if (!DRY_RUN) {
        for (const u of countryUpdates) {
          const { error: upErr } = await supabase
            .from('players')
            .update({ country_code: u.country_code })
            .eq('id', u.id)
          if (upErr) { errors++; console.error(`  ⚠️  id=${u.id}: ${upErr.message}`) }
          else countryUpdated++
        }
        console.log(`[COUNTRY] ✅ Updated ${countryUpdated} players`)
      } else {
        console.log(`[dry-run] Would update ${countryUpdates.length} country_code values`)
        countryUpdates.slice(0, 5).forEach(u =>
          console.log(`  id=${u.id}: country_code="${u.country_code}"`)
        )
        countryUpdated = countryUpdates.length
      }
    }
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Done!                                                     ║
╚════════════════════════════════════════════════════════════╝
  main_character updated : ${charUpdated}
  country_code updated   : ${countryUpdated}
  errors                 : ${errors}
${DRY_RUN ? '\n  [dry-run — no DB writes applied]' : ''}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
