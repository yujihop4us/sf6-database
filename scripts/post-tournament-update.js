/**
 * post-tournament-update.js — 大会終了後の一括プロフィール更新スクリプト
 *
 * 使い方:
 *   node scripts/post-tournament-update.js --tournament-id=48 --slug=combo-breaker-2026
 *   node scripts/post-tournament-update.js --tournament-id=48 --slug=combo-breaker-2026 --dry-run
 *   node scripts/post-tournament-update.js --tournament-id=48 --slug=combo-breaker-2026 --step=1
 *
 * 処理フロー:
 *   Step 1: start.gg games API からキャラクターバックフィル
 *   Step 2: キャラ充填率が低い場合 → Liquipedia ブラケットページからスクレイプ
 *   Step 3: players.main_character を tournament_sets の使用キャラから更新
 *   Step 4: country_code が未設定の選手を Liquipedia 選手ページから補完
 *
 * オプション:
 *   --tournament-id=<id>   DB の tournament_id（必須）
 *   --slug=<slug>          start.gg のトーナメントスラッグ（例: combo-breaker-2026）
 *   --step=<n>             特定ステップのみ実行（1-4）
 *   --dry-run              DB 書き込みなし（確認のみ）
 *   --top-phases           final phase の poolIdentifier（カンマ区切り, 例: PX133,VVX15）
 *   --char-threshold=50    Step 2 移行しきい値（充填率 %）
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { gunzipSync } from 'zlib'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const STARTGG_TOKEN = process.env.STARTGG_TOKEN || process.env.STARTGG_API_TOKEN
const STARTGG_API   = 'https://api.start.gg/gql/alpha'
const LIQUIPEDIA_BASE = 'https://liquipedia.net/fighters'

// ── SF6 キャラクター ID → 名前 ──────────────────────────────────────────────
const SF6_CHAR_MAP = {
  2271: 'Blanka',    2272: 'Cammy',    2273: 'Chun-Li',  2274: 'Dee Jay',
  2275: 'Dhalsim',  2276: 'E. Honda', 2277: 'Guile',    2278: 'Jamie',
  2279: 'JP',       2280: 'Juri',     2281: 'Ken',      2282: 'Kimberly',
  2283: 'Lily',     2284: 'Luke',     2285: 'Manon',    2286: 'Marisa',
  2287: 'Ryu',      2288: 'Zangief',  2314: 'Rashid',   2342: 'A.K.I.',
  2442: 'Ed',       2495: 'Akuma',    2506: 'M.Bison',  2596: 'Terry',
  2616: 'Mai',      2699: 'Elena',    2745: 'Sagat',    2798: 'C. Viper',
  2946: 'Alex',     3014: 'Ingrid',
}

// ── Liquipedia キャラ名正規化 ─────────────────────────────────────────────
const LIQUIPEDIA_CHAR_NORMALIZE = {
  'M. Bison': 'M.Bison', 'M.Bison': 'M.Bison',
  'A.K.I': 'A.K.I.', 'AKI': 'A.K.I.',
  'E. Honda': 'E.Honda', 'Honda': 'E.Honda',
  'Dee Jay': 'Dee Jay', 'DeeJay': 'Dee Jay',
  'Chun Li': 'Chun-Li', 'Chun-Li': 'Chun-Li',
}
function normalizeChar(name) {
  if (!name) return null
  const trimmed = name.trim()
  return LIQUIPEDIA_CHAR_NORMALIZE[trimmed] ?? trimmed
}

// ── 国コード → ISO 2文字 ─────────────────────────────────────────────────
const COUNTRY_NAME_MAP = {
  'Japan': 'JP', 'United States': 'US', 'USA': 'US', 'China': 'CN',
  'Taiwan': 'TW', 'Hong Kong': 'HK', 'South Korea': 'KR', 'Korea': 'KR',
  'France': 'FR', 'Germany': 'DE', 'United Kingdom': 'GB', 'Brazil': 'BR',
  'Chile': 'CL', 'Argentina': 'AR', 'Mexico': 'MX', 'Dominican Republic': 'DO',
  'Norway': 'NO', 'Sweden': 'SE', 'Netherlands': 'NL', 'Belgium': 'BE',
  'Switzerland': 'CH', 'Australia': 'AU', 'Canada': 'CA', 'Singapore': 'SG',
  'Philippines': 'PH', 'Pakistan': 'PK', 'United Arab Emirates': 'AE',
  'Saudi Arabia': 'SA', 'Russia': 'RU', 'Italy': 'IT', 'Spain': 'ES',
}

// ── ユーティリティ ────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

function parseArgs() {
  const args = {}
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/)
    if (m) args[m[1]] = m[2] ?? true
  }
  return args
}

// ── HTTP helper (gzip 対応) ──────────────────────────────────────────────────
async function fetchText(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept-Encoding': 'gzip, deflate',
          'User-Agent': 'sf6-database/1.0 (https://github.com; data research)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      })
      if (res.status === 429 || res.status === 503) {
        const wait = (i + 1) * 4_000
        console.log(`  ⏳ Rate limited (${res.status}), waiting ${wait / 1000}s...`)
        await sleep(wait)
        continue
      }
      if (!res.ok) {
        console.log(`  ⚠️  HTTP ${res.status} for ${url}`)
        return null
      }
      // gzip は fetch が自動展開（Node.js 18+）
      return await res.text()
    } catch (err) {
      if (i === retries - 1) console.error(`  Fetch error: ${err.message}`)
      await sleep(2_000)
    }
  }
  return null
}

// ── start.gg GraphQL ──────────────────────────────────────────────────────
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
        console.error('  GQL error:', msg)
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

const Q_SET_GAMES = `
query SetGames($setId: ID!) {
  set(id: $setId) {
    winnerId
    slots { entrant { id } }
    games {
      winnerId
      selections {
        entrant { id }
        selectionValue
      }
    }
  }
}`

function charNameFromGames(games, entrantId) {
  if (!games?.length || entrantId == null) return null
  const entIdStr = String(entrantId)
  const counts = {}
  for (const g of games) {
    const sel = g.selections?.find(s => String(s.entrant?.id) === entIdStr)
    if (!sel?.selectionValue) continue
    const name = SF6_CHAR_MAP[sel.selectionValue]
    if (name) counts[name] = (counts[name] || 0) + 1
  }
  const entries = Object.entries(counts)
  if (!entries.length) return null
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

// ── Step 1: start.gg character backfill ──────────────────────────────────
async function step1_startggChars(tournamentId, dryRun) {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║  Step 1: start.gg games API — キャラクターバックフィル     ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  if (!STARTGG_TOKEN) {
    console.log('  ⚠️  STARTGG_TOKEN が未設定のためスキップ')
    return { filled: 0, total: 0 }
  }

  // null キャラのセットを取得
  const PAGE_SIZE = 1000
  let allSets = []
  let from = 0
  while (true) {
    const { data: page, error } = await supabase
      .from('tournament_sets')
      .select('id, startgg_set_id, winner_entrant_id, loser_entrant_id, winner_id, loser_id')
      .eq('tournament_id', tournamentId)
      .is('winner_character', null)
      .not('startgg_set_id', 'is', null)
      .not('winner_entrant_id', 'is', null)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)

    if (error) { console.error('  DB error:', error.message); break }
    if (!page?.length) break
    allSets = allSets.concat(page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  console.log(`  対象セット: ${allSets.length} 件（winner_character = null）`)
  if (!allSets.length) { console.log('  → 全セット設定済み'); return { filled: 0, total: 0 } }

  const RATE_BATCH = 78
  const RATE_PAUSE = 62_000
  const INTERVAL   = 760
  let filled = 0, reqCount = 0

  for (let i = 0; i < allSets.length; i++) {
    const set = allSets[i]
    if (reqCount > 0 && reqCount % RATE_BATCH === 0) {
      console.log(`  ⏸  Rate limit pause (${reqCount} reqs)...`)
      await sleep(RATE_PAUSE)
    }

    const data = await gql(Q_SET_GAMES, { setId: String(set.startgg_set_id) })
    reqCount++
    await sleep(INTERVAL)

    const games = data?.set?.games
    if (!games?.length) continue

    const winnerChar = charNameFromGames(games, set.winner_entrant_id)
    const loserChar  = charNameFromGames(games, set.loser_entrant_id)

    if (!winnerChar && !loserChar) continue

    if (!dryRun) {
      const patch = {}
      if (winnerChar) patch.winner_character = winnerChar
      if (loserChar)  patch.loser_character  = loserChar
      await supabase.from('tournament_sets').update(patch).eq('id', set.id)
    }

    filled++
    if (filled % 50 === 0) {
      const pct = Math.round((filled / allSets.length) * 100)
      console.log(`  [${pct}%] ${filled}/${allSets.length} sets filled...`)
    }
  }

  const fillRate = allSets.length > 0 ? Math.round((filled / allSets.length) * 100) : 100
  console.log(`\n  ✅ 完了: ${filled}/${allSets.length} セット (${fillRate}%)`)
  return { filled, total: allSets.length, fillRate }
}

// ── Step 2: Liquipedia ブラケットスクレイプ ──────────────────────────────
async function step2_liquipediaBracket(tournamentId, slug, dryRun) {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║  Step 2: Liquipedia ブラケットページからキャラ取得          ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  // Liquipedia URL を試みる候補
  const candidates = [
    `${LIQUIPEDIA_BASE}/${slug}/SF6/Bracket`,
    `${LIQUIPEDIA_BASE}/${slug.replace(/-/g, '_')}/SF6/Bracket`,
  ]

  let html = null
  let usedUrl = null
  for (const url of candidates) {
    console.log(`  Trying: ${url}`)
    html = await fetchText(url)
    if (html && html.includes('brkts-')) { usedUrl = url; break }
    await sleep(2_000)
  }

  if (!html) {
    console.log('  ❌ Liquipedia ブラケットページが見つかりません')
    return {}
  }
  console.log(`  ✅ 取得: ${usedUrl}`)

  // ブラケットページからプレイヤー名とキャラを抽出
  // パターン: <span class="name">PlayerName</span> + <span class="character">CharName</span>
  const playerCharMap = {}

  // パターン1: data-player と data-character 属性
  const attrPattern = /data-(?:player|name)="([^"]+)"[^>]*data-character="([^"]+)"/gi
  let m
  while ((m = attrPattern.exec(html)) !== null) {
    const player = m[1].trim()
    const char   = normalizeChar(m[2])
    if (player && char) playerCharMap[player] = char
  }

  // パターン2: テキスト "PlayerName\nCharacterName" 形式
  // WikiTable: 連続するテキストノードからパース
  const textPattern = /class="[^"]*name[^"]*">([^<]+)<\/[^>]+>[\s\S]{0,200}?class="[^"]*character[^"]*">([^<]+)</gi
  while ((m = textPattern.exec(html)) !== null) {
    const player = m[1].trim()
    const char   = normalizeChar(m[2].trim())
    if (player && char && !playerCharMap[player]) playerCharMap[player] = char
  }

  console.log(`  抽出: ${Object.keys(playerCharMap).length} 選手`)

  if (!Object.keys(playerCharMap).length) {
    console.log('  ℹ️  キャラデータが取れませんでした（ページ形式が異なる可能性）')
    return {}
  }

  // DB の選手と照合して winner_character / loser_character を更新
  const updatedSets = []
  for (const [playerHandle, charName] of Object.entries(playerCharMap)) {
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .ilike('handle', playerHandle)
      .limit(1)
      .single()

    if (!player) continue

    // このプレイヤーが使用したセットに character を設定
    const { data: sets } = await supabase
      .from('tournament_sets')
      .select('id, winner_id, loser_id, winner_character, loser_character')
      .eq('tournament_id', tournamentId)
      .or(`winner_id.eq.${player.id},loser_id.eq.${player.id}`)
      .is('winner_character', null)
      .limit(100)

    for (const s of sets ?? []) {
      const patch = {}
      if (s.winner_id === player.id && !s.winner_character) patch.winner_character = charName
      if (s.loser_id  === player.id && !s.loser_character)  patch.loser_character  = charName

      if (Object.keys(patch).length) {
        if (!dryRun) await supabase.from('tournament_sets').update(patch).eq('id', s.id)
        updatedSets.push(s.id)
      }
    }
  }

  console.log(`  ✅ ${updatedSets.length} セットを更新`)
  return playerCharMap
}

// ── Step 3: main_character を tournament_sets の使用キャラから更新 ────────
async function step3_updateMainCharacters(tournamentId, dryRun) {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║  Step 3: players.main_character を使用キャラから補完        ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  // このトーナメントで使用キャラが記録されているセットからプレイヤー別集計
  const { data: sets } = await supabase
    .from('tournament_sets')
    .select('winner_id, loser_id, winner_character, loser_character')
    .eq('tournament_id', tournamentId)
    .not('winner_id', 'is', null)
    .limit(5000)

  const playerCharFreq = {}
  for (const s of sets ?? []) {
    if (s.winner_id && s.winner_character) {
      playerCharFreq[s.winner_id] = playerCharFreq[s.winner_id] || {}
      playerCharFreq[s.winner_id][s.winner_character] = (playerCharFreq[s.winner_id][s.winner_character] || 0) + 1
    }
    if (s.loser_id && s.loser_character) {
      playerCharFreq[s.loser_id] = playerCharFreq[s.loser_id] || {}
      playerCharFreq[s.loser_id][s.loser_character] = (playerCharFreq[s.loser_id][s.loser_character] || 0) + 1
    }
  }

  let updated = 0
  for (const [pidStr, freq] of Object.entries(playerCharFreq)) {
    const pid = Number(pidStr)
    const topChar = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]

    const { data: player } = await supabase
      .from('players')
      .select('id, handle, main_character')
      .eq('id', pid)
      .single()

    if (!player || player.main_character) continue  // 既に設定済みはスキップ

    if (!dryRun) {
      await supabase.from('players').update({ main_character: topChar }).eq('id', pid)
    }
    console.log(`  ✅ id=${pid} ${player.handle} → main_character=${topChar}`)
    updated++
  }

  console.log(`\n  完了: ${updated} 件更新`)
  return updated
}

// ── Step 4: Liquipedia 選手ページから country_code 補完 ─────────────────
async function step4_liquipediaCountries(tournamentId, topPhaseIdentifiers, dryRun) {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║  Step 4: Liquipedia 選手ページから country_code 補完        ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  // country_code が未設定の選手を取得（対象フェーズの選手に限定）
  let query = supabase
    .from('tournament_sets')
    .select('winner_id, loser_id')
    .eq('tournament_id', tournamentId)
    .not('winner_id', 'is', null)

  if (topPhaseIdentifiers?.length) {
    query = query.in('pool_identifier', topPhaseIdentifiers)
  }

  const { data: sets } = await query.limit(1000)

  const playerIds = [...new Set([
    ...(sets ?? []).map(s => s.winner_id),
    ...(sets ?? []).map(s => s.loser_id),
  ].filter(Boolean))]

  const { data: players } = await supabase
    .from('players')
    .select('id, handle, country_code')
    .in('id', playerIds)
    .is('country_code', null)

  if (!players?.length) {
    console.log('  ✅ 全選手の country_code が設定済み')
    return 0
  }

  console.log(`  country_code 未設定: ${players.length} 名`)

  let updated = 0
  for (const player of players) {
    // Liquipedia 選手ページ: https://liquipedia.net/fighters/PlayerName
    const encodedName = encodeURIComponent(player.handle.replace(/ /g, '_'))
    const url = `${LIQUIPEDIA_BASE}/${encodedName}`

    console.log(`  Fetching ${player.handle}...`)
    const html = await fetchText(url)
    await sleep(2_000)  // Liquipedia: 1 req/2s

    if (!html) { console.log(`    → skipped (fetch failed)`); continue }

    // "Nationality:" または "Country:" フィールドを抽出
    const natPatterns = [
      /Nationality.*?<a[^>]+>([^<]+)<\/a>/i,
      /Country.*?<a[^>]+>([^<]+)<\/a>/i,
      /<td[^>]*>Nationality<\/td>[\s\S]{0,200}?<td[^>]*>([^<]+)</i,
    ]

    let countryCode = null
    for (const pat of natPatterns) {
      const m = html.match(pat)
      if (m) {
        const countryName = m[1].trim()
        countryCode = COUNTRY_NAME_MAP[countryName]
        if (countryCode) break
        // ISO 2文字コードが直接書かれている場合
        if (/^[A-Z]{2}$/.test(countryName)) { countryCode = countryName; break }
      }
    }

    if (!countryCode) {
      console.log(`    → not found (${player.handle})`)
      continue
    }

    if (!dryRun) {
      await supabase.from('players').update({ country_code: countryCode }).eq('id', player.id)
    }
    console.log(`    ✅ ${player.handle} → ${countryCode}`)
    updated++
  }

  console.log(`\n  完了: ${updated} 件更新`)
  return updated
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const argv = parseArgs()

  const tournamentId = Number(argv['tournament-id'])
  const slug         = argv['slug'] || ''
  const dryRun       = !!argv['dry-run']
  const stepOnly     = argv['step'] ? Number(argv['step']) : null
  const charThreshold = Number(argv['char-threshold'] ?? 50)
  const topPhases    = argv['top-phases']?.split(',') ?? []

  if (!tournamentId) {
    console.error('Usage: node scripts/post-tournament-update.js --tournament-id=<id> --slug=<slug>')
    console.error('  例: node scripts/post-tournament-update.js --tournament-id=48 --slug=combo-breaker-2026')
    process.exit(1)
  }

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║          post-tournament-update — 大会後プロフィール一括更新          ║
╚══════════════════════════════════════════════════════════════════╝
  tournament_id : ${tournamentId}
  slug          : ${slug || '(未指定)'}
  dry-run       : ${dryRun}
  step          : ${stepOnly ?? '全ステップ'}
  char-threshold: ${charThreshold}%
  top-phases    : ${topPhases.join(',') || '(自動検出)'}
`)

  const shouldRun = n => stepOnly === null || stepOnly === n

  // ─ Step 1: start.gg キャラバックフィル ──────────────────────────────
  let fillRate = 100
  if (shouldRun(1)) {
    if (!STARTGG_TOKEN) {
      console.log('⚠️  STARTGG_TOKEN 未設定 — Step 1 スキップ')
    } else {
      const result = await step1_startggChars(tournamentId, dryRun)
      fillRate = result.fillRate ?? 100
    }
  }

  // ─ Step 2: 充填率が低ければ Liquipedia ブラケットスクレイプ ─────────
  if (shouldRun(2)) {
    if (fillRate < charThreshold || stepOnly === 2) {
      if (!slug) {
        console.log('\n⚠️  --slug が未指定のため Step 2 スキップ')
      } else {
        await step2_liquipediaBracket(tournamentId, slug, dryRun)
      }
    } else {
      console.log(`\n[Step 2] 充填率 ${fillRate}% ≥ ${charThreshold}% → Liquipedia スクレイプ不要`)
    }
  }

  // ─ Step 3: main_character 補完 ──────────────────────────────────────
  if (shouldRun(3)) {
    await step3_updateMainCharacters(tournamentId, dryRun)
  }

  // ─ Step 4: Liquipedia country_code 補完 ────────────────────────────
  if (shouldRun(4)) {
    if (!slug) {
      console.log('\n⚠️  --slug が未指定のため Step 4 スキップ')
    } else {
      await step4_liquipediaCountries(tournamentId, topPhases, dryRun)
    }
  }

  console.log('\n✨ post-tournament-update 完了\n')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
