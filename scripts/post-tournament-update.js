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
 *   --liquipedia-url=<url> Step 2 で使用する Liquipedia URL を直接指定
 *                          （例: https://liquipedia.net/fighters/Combo_Breaker/2026/SF6）
 *                          省略時は --slug から自動生成
 *   --skip-step1           Step 1（start.gg API）をスキップして Step 2 から開始
 *                          キャラデータが start.gg にない大会で時間節約
 *   --step4-limit=<n>      Step 4 で処理する選手数の上限（デフォルト: 30）
 *                          大規模大会では placement 上位か top-phase の選手のみ対象
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
        // Liquipedia が厳しいレート制限を課している: 指数バックオフで長く待機
        const wait = Math.pow(2, i + 1) * 30_000  // 60s, 120s, 240s
        console.log(`  ⏳ Rate limited (${res.status}), waiting ${wait / 1000}s...`)
        await sleep(wait)
        continue
      }
      if (!res.ok) {
        console.log(`  ⚠️  HTTP ${res.status} for ${url}`)
        return null
      }
      const text = await res.text()
      // Cloudflare/Liquipedia のレート制限ページを検出
      if (text.includes('Rate Limited') && text.includes('cloudflare')) {
        const wait = Math.pow(2, i + 1) * 30_000
        console.log(`  ⏳ Cloudflare rate limit page, waiting ${wait / 1000}s...`)
        await sleep(wait)
        continue
      }
      return text
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
async function step2_liquipediaBracket(tournamentId, slug, dryRun, overrideUrl = null, topPhases = []) {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║  Step 2: Liquipedia ブラケットページからキャラ取得          ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  // URL 候補リスト: --liquipedia-url を最優先、次に slug から自動生成
  const slugCandidates = slug ? [
    `${LIQUIPEDIA_BASE}/${slug}/SF6/Bracket`,
    `${LIQUIPEDIA_BASE}/${slug.replace(/-/g, '_')}/SF6/Bracket`,
    // トップレベルページ（brkts- が含まれる場合あり）
    `${LIQUIPEDIA_BASE}/${slug.replace(/-/g, '_')}/SF6`,
    `${LIQUIPEDIA_BASE}/${slug.replace(/-/g, '_')}`,
  ] : []
  const candidates = overrideUrl
    ? [overrideUrl, ...slugCandidates]
    : slugCandidates

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
  const playerCharMap = {}
  let m

  // パターン1: data-player/data-name + data-character 属性（同一要素）
  const attrPattern1 = /data-(?:player|name)="([^"]+)"[^>]*data-character="([^"]+)"/gi
  while ((m = attrPattern1.exec(html)) !== null) {
    const player = m[1].trim()
    const char   = normalizeChar(m[2])
    if (player && char) playerCharMap[player] = char
  }

  // パターン1b: data-character が先に来る場合
  const attrPattern1b = /data-character="([^"]+)"[^>]*data-(?:player|name)="([^"]+)"/gi
  while ((m = attrPattern1b.exec(html)) !== null) {
    const char   = normalizeChar(m[1])
    const player = m[2].trim()
    if (player && char && !playerCharMap[player]) playerCharMap[player] = char
  }

  // パターン2: CSS class name + character（最大500文字以内）
  const textPattern = /class="[^"]*(?:brkts-opponent-)?name[^"]*">([^<]+)<\/[^>]+>[\s\S]{0,500}?class="[^"]*character[^"]*">([^<]+)</gi
  while ((m = textPattern.exec(html)) !== null) {
    const player = m[1].trim()
    const char   = normalizeChar(m[2].trim())
    if (player && char && !playerCharMap[player]) playerCharMap[player] = char
  }

  // パターン3: brkts-popup-body (試合詳細ポップアップ形式)
  // <div class="brkts-popup-body-game"> ... <img alt="CharName"> ... >PlayerName<
  const popupPattern = /<div[^>]*brkts-popup-body-game[^>]*>[\s\S]{0,600}?<img[^>]+alt="([^"]+)"[\s\S]{0,400}?brkts-popup-body-player[^>]*>([\s\S]{0,200}?)<\//gi
  while ((m = popupPattern.exec(html)) !== null) {
    const char   = normalizeChar(m[1])
    const player = m[2].replace(/<[^>]+>/g, '').trim()
    if (player && char && !playerCharMap[player]) playerCharMap[player] = char
  }

  // パターン4: WikiTable の行 — "| Player || Character" 形式（wikitext が残っている場合）
  const wikiPattern = /\|\s*([A-Za-z0-9\-_. ]+?)\s*\|\|\s*(Ryu|Ken|Luke|Kimberly|Chun-Li|Guile|Zangief|Manon|Marisa|JP|Dee Jay|Dhalsim|Blanka|E\.? Honda|Jamie|Lily|Cammy|Juri|Rashid|A\.K\.I\.?|Ed|Akuma|M\.?Bison|Terry|Mai|Elena|Sagat|C\. Viper|Alex|Ingrid)/gi
  while ((m = wikiPattern.exec(html)) !== null) {
    const player = m[1].trim()
    const char   = normalizeChar(m[2])
    if (player && char && !playerCharMap[player]) playerCharMap[player] = char
  }

  console.log(`  抽出: ${Object.keys(playerCharMap).length} 選手`)

  if (!Object.keys(playerCharMap).length) {
    console.log('  ℹ️  キャラデータが取れませんでした（ページ形式が異なる可能性）')
    // デバッグ: HTML の先頭500文字と brkts- 周辺を表示
    const brktsIdx = html.indexOf('brkts-')
    if (brktsIdx >= 0) {
      console.log(`  📋 HTML snippet (brkts- 周辺 @${brktsIdx}):`)
      console.log('  ' + html.slice(Math.max(0, brktsIdx - 50), brktsIdx + 300).replace(/\s+/g, ' '))
    } else {
      console.log('  📋 HTML先頭500文字:', html.slice(0, 500).replace(/\s+/g, ' '))
    }
    return {}
  }

  // Top-phase pool_identifier を自動検出（--top-phases 未指定時）
  let resolvedTopPhases = topPhases.length ? topPhases : []
  if (!resolvedTopPhases.length) {
    const { data: tourney } = await supabase
      .from('tournaments')
      .select('final_pool_identifier, top24_pool_identifier')
      .eq('id', tournamentId)
      .single()
    resolvedTopPhases = [
      tourney?.final_pool_identifier,
      tourney?.top24_pool_identifier,
    ].filter(Boolean)
  }
  if (resolvedTopPhases.length) {
    console.log(`  📌 Top-phase フィルタ: pool=[${resolvedTopPhases.join(',')}]`)
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

    // このプレイヤーが使用したセットに character を設定（top phase のみ）
    let setQuery = supabase
      .from('tournament_sets')
      .select('id, winner_id, loser_id, winner_character, loser_character')
      .eq('tournament_id', tournamentId)
      .or(`winner_id.eq.${player.id},loser_id.eq.${player.id}`)
      .is('winner_character', null)
      .limit(100)
    if (resolvedTopPhases.length) setQuery = setQuery.in('pool_identifier', resolvedTopPhases)
    const { data: sets } = await setQuery

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
  console.log('║  Step 3: players.main_character を使用キャラから更新        ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  // 今回の大会の start_date を取得
  const { data: thisTourney } = await supabase
    .from('tournaments')
    .select('id, name, start_date')
    .eq('id', tournamentId)
    .single()
  if (!thisTourney) {
    console.log('  ⚠ 大会情報が見つかりません')
    return 0
  }
  const thisDate = thisTourney.start_date ?? '1900-01-01'
  console.log(`  対象大会: ${thisTourney.name} (${thisDate})`)

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

  const playerIds = Object.keys(playerCharFreq).map(Number)
  if (playerIds.length === 0) {
    console.log('  キャラデータなし — スキップ')
    return 0
  }

  // プレイヤーの現在の main_character + main_character_tournament_id を一括取得
  const { data: playersRaw } = await supabase
    .from('players')
    .select('id, handle, main_character, main_character_tournament_id')
    .in('id', playerIds)
  const playerMap = new Map((playersRaw ?? []).map(p => [p.id, p]))

  // 既存 tournament_id の start_date を取得
  const existingTourneyIds = [
    ...new Set((playersRaw ?? []).map(p => p.main_character_tournament_id).filter(Boolean))
  ]
  const existingDateMap = new Map()
  if (existingTourneyIds.length > 0) {
    const { data: existingTourneys } = await supabase
      .from('tournaments')
      .select('id, start_date')
      .in('id', existingTourneyIds)
    for (const t of existingTourneys ?? []) existingDateMap.set(t.id, t.start_date ?? '1900-01-01')
  }

  let updated = 0, skipped = 0
  for (const [pidStr, freq] of Object.entries(playerCharFreq)) {
    const pid = Number(pidStr)
    const topChar = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]
    const player = playerMap.get(pid)
    if (!player) continue

    // 既存の main_character_tournament_id がある場合: その大会の start_date と比較
    if (player.main_character_tournament_id) {
      const existingDate = existingDateMap.get(player.main_character_tournament_id) ?? '1900-01-01'
      if (thisDate <= existingDate) {
        // 既存の方が新しいか同一 → スキップ
        skipped++
        continue
      }
    }

    if (!dryRun) {
      await supabase.from('players').update({
        main_character: topChar,
        main_character_tournament_id: tournamentId,
      }).eq('id', pid)
    }
    const prev = player.main_character ? ` (旧: ${player.main_character})` : ''
    console.log(`  ✅ id=${pid} ${player.handle} → ${topChar}${prev}`)
    updated++
  }

  console.log(`\n  完了: ${updated} 件更新, ${skipped} 件スキップ（既存の方が新しい大会）`)
  return updated
}

// ── Step 4: Liquipedia 選手ページから country_code 補完 ─────────────────
async function step4_liquipediaCountries(tournamentId, topPhaseIdentifiers, dryRun, limit = 30) {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║  Step 4: Liquipedia 選手ページから country_code 補完        ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  // ─ 対象選手の決定 ─────────────────────────────────────────────────────────
  // 戦略: 大会規模に応じて異なるアプローチを使用
  //   小規模（≤50名）: 全entrant
  //   大規模 + placement あり: placement 順 上位 limit 名
  //   大規模 + placement なし: top-phase pool_identifier でフィルタ

  const { count: totalEntrants } = await supabase
    .from('tournament_entrants')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  const isSmall = (totalEntrants ?? 0) <= 50
  let playerIds = []
  let strategyDesc = ''

  if (isSmall) {
    // ── 小規模大会: 全entrant ────────────────────────────────────────────
    const { data: entrants } = await supabase
      .from('tournament_entrants')
      .select('player_id')
      .eq('tournament_id', tournamentId)
    playerIds = (entrants ?? []).map(e => e.player_id).filter(Boolean)
    strategyDesc = `小規模大会（計 ${totalEntrants} 名、全員対象）`
  } else {
    // ── 大規模大会: placement or pool_identifier で上位のみ ──────────────
    const { count: placedCount } = await supabase
      .from('tournament_entrants')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .not('placement', 'is', null)

    if ((placedCount ?? 0) > 0) {
      // Strategy A: placement データあり → 上位 limit 名
      const { data: entrants } = await supabase
        .from('tournament_entrants')
        .select('player_id, placement')
        .eq('tournament_id', tournamentId)
        .not('placement', 'is', null)
        .order('placement', { ascending: true })
        .limit(limit)
      playerIds = (entrants ?? []).map(e => e.player_id).filter(Boolean)
      strategyDesc = `placement 上位 ${playerIds.length} 名（全 ${totalEntrants} 名中）`
    } else {
      // Strategy B: placement なし → tournament の top-phase pool_identifier
      const { data: tourney } = await supabase
        .from('tournaments')
        .select('final_pool_identifier, top24_pool_identifier')
        .eq('id', tournamentId)
        .single()
      const autoPhases = [
        tourney?.final_pool_identifier,
        tourney?.top24_pool_identifier,
      ].filter(Boolean)
      const phases = [...new Set([...(topPhaseIdentifiers ?? []), ...autoPhases])]

      let setQuery = supabase
        .from('tournament_sets')
        .select('winner_id, loser_id')
        .eq('tournament_id', tournamentId)
        .not('winner_id', 'is', null)
      if (phases.length) setQuery = setQuery.in('pool_identifier', phases)

      const { data: sets } = await setQuery.limit(500)
      playerIds = [...new Set([
        ...(sets ?? []).map(s => s.winner_id),
        ...(sets ?? []).map(s => s.loser_id),
      ].filter(Boolean))]
      strategyDesc = `pool=[${phases.join(',') || '全て'}]: ${playerIds.length} 名`
    }
  }

  if (!playerIds.length) {
    console.log('  ⚠️  対象選手が見つかりません')
    return 0
  }

  // country_code 未設定の選手に絞る
  const { data: players } = await supabase
    .from('players')
    .select('id, handle, country_code')
    .in('id', playerIds)
    .is('country_code', null)

  if (!players?.length) {
    console.log(`  ✅ 全選手の country_code が設定済み（${strategyDesc}）`)
    return 0
  }

  console.log(`  対象: ${strategyDesc}`)
  console.log(`  country_code 未設定: ${players.length} 名`)
  const targets = players  // 全員処理（戦略で絞り込み済み）

  let updated = 0
  let consecutiveRateLimits = 0
  for (const player of targets) {
    // Liquipedia 選手ページ: https://liquipedia.net/fighters/PlayerName
    const encodedName = encodeURIComponent(player.handle.replace(/ /g, '_'))
    const url = `${LIQUIPEDIA_BASE}/${encodedName}`

    console.log(`  Fetching ${player.handle}...`)
    const html = await fetchText(url)
    await sleep(3_000)  // Liquipedia: 1 req/3s (余裕を持たせる)

    if (!html) {
      consecutiveRateLimits++
      console.log(`    → skipped (fetch failed)`)
      // 連続で失敗が続いたら長めに待機
      if (consecutiveRateLimits >= 3) {
        console.log(`  ⏸  連続失敗 ${consecutiveRateLimits} 回 — 60s 待機...`)
        await sleep(60_000)
        consecutiveRateLimits = 0
      }
      continue
    }
    consecutiveRateLimits = 0

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

  console.log(`\n  完了: ${updated} 件更新（処理: ${targets.length} 名）`)
  return updated
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const argv = parseArgs()

  const tournamentId    = Number(argv['tournament-id'])
  const slug            = argv['slug'] || ''
  const dryRun          = !!argv['dry-run']
  const stepOnly        = argv['step'] ? Number(argv['step']) : null
  const charThreshold   = Number(argv['char-threshold'] ?? 50)
  const topPhases       = argv['top-phases']?.split(',') ?? []
  const liquipediaUrl   = argv['liquipedia-url'] || null   // Step 2 用 Liquipedia URL 直接指定
  const skipStep1       = !!argv['skip-step1']             // Step 1 をスキップして Step 2 から開始
  const step4Limit      = Number(argv['step4-limit'] ?? 30)  // Step 4: 大規模大会での上限（小規模は全員）

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
  skip-step1    : ${skipStep1}
  char-threshold: ${charThreshold}%
  top-phases    : ${topPhases.join(',') || '(自動検出)'}
  liquipedia-url: ${liquipediaUrl || '(slugから自動生成)'}
  step4-limit   : ${step4Limit}
`)

  const shouldRun = n => stepOnly === null || stepOnly === n

  // ─ Step 1: start.gg キャラバックフィル ──────────────────────────────
  let fillRate = 100
  if (shouldRun(1) && !skipStep1) {
    if (!STARTGG_TOKEN) {
      console.log('⚠️  STARTGG_TOKEN 未設定 — Step 1 スキップ')
    } else {
      const result = await step1_startggChars(tournamentId, dryRun)
      fillRate = result.fillRate ?? 100
    }
  } else if (skipStep1) {
    console.log('\n[Step 1] --skip-step1 指定 → スキップ（Step 2 へ）')
    fillRate = 0  // Step 2 を強制実行
  }

  // ─ Step 2: 充填率が低ければ Liquipedia ブラケットスクレイプ ─────────
  if (shouldRun(2)) {
    if (fillRate < charThreshold || stepOnly === 2) {
      if (!liquipediaUrl && !slug) {
        console.log('\n⚠️  --liquipedia-url も --slug も未指定のため Step 2 スキップ')
      } else {
        await step2_liquipediaBracket(tournamentId, slug, dryRun, liquipediaUrl, topPhases)
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
      await step4_liquipediaCountries(tournamentId, topPhases, dryRun, step4Limit)
    }
  }

  console.log('\n✨ post-tournament-update 完了\n')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
