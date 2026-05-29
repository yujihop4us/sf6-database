/**
 * backfill-characters.js — start.gg games データからキャラクター情報をバックフィル
 *
 * 使い方:
 *   node scripts/backfill-characters.js --tournament-id=48
 *   node scripts/backfill-characters.js --tournament-id=48 --dry-run
 *   node scripts/backfill-characters.js --tournament-id=48 --limit=100
 *   node scripts/backfill-characters.js --tournament-id=48 --resume    # エラーログから再試行
 *
 * Rate limit: start.gg は 80 req/min。80件ごとに 62 秒待機。
 * CB2026 (2903 sets) の場合: 約 37 分。
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, existsSync, readFileSync } from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const STARTGG_TOKEN = process.env.STARTGG_TOKEN || process.env.STARTGG_API_TOKEN
const STARTGG_API   = 'https://api.start.gg/gql/alpha'

// ── SF6 キャラクター ID → 名前マッピング ────────────────────────────────────
const SF6_CHAR_MAP = {
  2271: 'Blanka',
  2272: 'Cammy',
  2273: 'Chun-Li',
  2274: 'Dee Jay',
  2275: 'Dhalsim',
  2276: 'E. Honda',
  2277: 'Guile',
  2278: 'Jamie',
  2279: 'JP',
  2280: 'Juri',
  2281: 'Ken',
  2282: 'Kimberly',
  2283: 'Lily',
  2284: 'Luke',
  2285: 'Manon',
  2286: 'Marisa',
  2287: 'Ryu',
  2288: 'Zangief',
  2314: 'Rashid',
  2342: 'A.K.I.',
  2442: 'Ed',
  2495: 'Akuma',
  2506: 'M.Bison',
  2596: 'Terry',
  2616: 'Mai',
  2699: 'Elena',
  2745: 'Sagat',
  2798: 'C. Viper',
  2946: 'Alex',
  3014: 'Ingrid',
}

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
const DB_TOURNAMENT_ID = Number(argv['tournament-id'])
const DRY_RUN  = !!argv['dry-run']
const LIMIT    = argv['limit'] ? Number(argv['limit']) : null
const RESUME   = !!argv['resume']

if (!DB_TOURNAMENT_ID) {
  console.error('Usage: node scripts/backfill-characters.js --tournament-id=<id>')
  process.exit(1)
}
if (!STARTGG_TOKEN) {
  console.error('Error: STARTGG_TOKEN or STARTGG_API_TOKEN env var required')
  process.exit(1)
}

// ── Rate limit 設定 ──────────────────────────────────────────────────────────
const RATE_LIMIT_BATCH   = 78   // 80 req/min の安全マージン
const RATE_LIMIT_PAUSE   = 62_000  // 62 秒
const REQUEST_INTERVAL   = 760     // ~79 req/min

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
        console.log(`  ⏳ Rate limited (429), waiting ${wait / 1000}s...`)
        await sleep(wait)
        continue
      }
      const json = await res.json()
      if (json.errors) {
        const msg = json.errors[0]?.message ?? 'unknown'
        if (msg.includes('complexity') || msg.includes('Timeout') || msg.includes('503')) {
          console.log(`  ⏳ API error (${msg.slice(0, 60)}), retry ${i + 1}/${retries}...`)
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

// ── GraphQL クエリ ───────────────────────────────────────────────────────────
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

// ── キャラクター解析 ─────────────────────────────────────────────────────────
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

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║       SF6 Character Backfill — start.gg games API         ║
╚════════════════════════════════════════════════════════════╝
  tournament_id : ${DB_TOURNAMENT_ID}
  dry-run       : ${DRY_RUN}
  limit         : ${LIMIT ?? 'none'}
  resume        : ${RESUME}
`)

  // ── エラーログファイルパス ──
  const errorLogPath = `scripts/backfill-errors-t${DB_TOURNAMENT_ID}.json`

  // resume モード: 前回エラーのセット ID のみ再試行
  let targetSetIds = null
  if (RESUME && existsSync(errorLogPath)) {
    const prev = JSON.parse(readFileSync(errorLogPath, 'utf8'))
    targetSetIds = new Set(prev.map(e => e.id))
    console.log(`[RESUME] ${targetSetIds.size} sets from previous error log\n`)
  }

  // ── DB からセット取得 (ページネーション対応: PostgREST 1000行上限回避) ──
  console.log('[INFO] Loading sets with null winner_character...')
  const PAGE_SIZE = 1000
  let allSets = []
  let from = 0
  while (true) {
    const { data: page, error } = await supabase
      .from('tournament_sets')
      .select('id, startgg_set_id, winner_entrant_id, loser_entrant_id, round_text')
      .eq('tournament_id', DB_TOURNAMENT_ID)
      .is('winner_character', null)
      .not('startgg_set_id', 'is', null)
      .not('winner_entrant_id', 'is', null)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    allSets = allSets.concat(page ?? [])
    if (!page || page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  let sets = allSets
  if (targetSetIds) sets = sets.filter(s => targetSetIds.has(s.id))
  if (LIMIT) sets = sets.slice(0, LIMIT)

  console.log(`[INFO] ${sets.length} sets to process\n`)
  if (!sets.length) { console.log('Nothing to do.'); return }

  // ETA 計算
  const etaMin = Math.ceil((sets.length / RATE_LIMIT_BATCH) * (RATE_LIMIT_PAUSE / 60_000 + 1))
  console.log(`[INFO] Estimated time: ~${etaMin} minutes (${RATE_LIMIT_BATCH} req/batch)\n`)

  let processed = 0, updated = 0, noData = 0, errors = 0
  const errorLog = []
  let reqCount = 0
  const total = sets.length

  for (const set of sets) {
    // バッチ境界でポーズ
    if (reqCount > 0 && reqCount % RATE_LIMIT_BATCH === 0) {
      console.log(`\n[RATE LIMIT] ${reqCount} requests sent — pausing ${RATE_LIMIT_PAUSE / 1000}s...`)
      await sleep(RATE_LIMIT_PAUSE)
    }

    const data = await gql(Q_SET_GAMES, { setId: String(set.startgg_set_id) })
    reqCount++
    processed++

    if (!data) {
      errors++
      errorLog.push({ id: set.id, startgg_set_id: set.startgg_set_id, reason: 'gql_failed' })
      await sleep(REQUEST_INTERVAL)
      continue
    }

    const games = data.set?.games
    if (!games?.length) {
      noData++
      await sleep(REQUEST_INTERVAL)
      if (processed % 200 === 0 || processed === total) {
        const pct = (processed / total * 100).toFixed(1)
        console.log(`[CHAR] ${processed}/${total} (${pct}%) — updated=${updated} noData=${noData} errors=${errors}`)
      }
      continue
    }

    const winnerChar = charNameFromGames(games, set.winner_entrant_id)
    const loserChar  = charNameFromGames(games, set.loser_entrant_id)

    if (!winnerChar && !loserChar) {
      noData++
    } else if (DRY_RUN) {
      updated++
      if (updated <= 5) {
        console.log(`[dry-run] id=${set.id} round=${set.round_text}: winner=${winnerChar ?? '-'} loser=${loserChar ?? '-'}`)
      }
    } else {
      const { error: upErr } = await supabase
        .from('tournament_sets')
        .update({
          winner_character: winnerChar ?? null,
          loser_character:  loserChar  ?? null,
        })
        .eq('id', set.id)

      if (upErr) {
        console.error(`  ⚠️  id=${set.id}: ${upErr.message}`)
        errors++
        errorLog.push({ id: set.id, startgg_set_id: set.startgg_set_id, reason: upErr.message })
      } else {
        updated++
      }
    }

    if (processed % 100 === 0 || processed === total) {
      const pct = (processed / total * 100).toFixed(1)
      console.log(`[CHAR] ${processed}/${total} (${pct}%) — updated=${updated} noData=${noData} errors=${errors}`)
    }

    await sleep(REQUEST_INTERVAL)
  }

  // エラーログ保存
  if (errorLog.length > 0) {
    writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2))
    console.log(`\n[ERROR LOG] ${errorLog.length} failures saved → ${errorLogPath}`)
    console.log(`  Re-run with --resume to retry failures.`)
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Done!                                                     ║
╚════════════════════════════════════════════════════════════╝
  processed : ${processed}
  updated   : ${updated} sets with character data
  no data   : ${noData} sets (start.gg has no game records)
  errors    : ${errors}
${DRY_RUN ? '\n  [dry-run — no DB writes applied]' : ''}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
