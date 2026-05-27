/**
 * live-fetch-v2.js — Match Data Pipeline v2
 *
 * Layer 1: streamQueue polling (30s) → stream_queue_cache
 * Layer 2: event.sets + updatedAfter diff (60s) → tournament_sets + h2h_records
 *
 * Usage:
 *   node scripts/live-fetch-v2.js \
 *     --tournament-id=865009 \
 *     --event-id=1528962 \
 *     --tournament-slug="combo-breaker-2026" \
 *     --db-tournament-id=48 \
 *     [--stream-interval=30] \
 *     [--sets-interval=60] \
 *     [--initial-fetch] \
 *     [--with-characters]   # initial-fetch 後にキャラバックフィルを自動実行
 *
 * 前提: supabase/migrations/20260518_v2_pipeline.sql を Supabase Dashboard で実行済み。
 *       未適用の場合は既存カラムのみで動作（v2 列は書き込みスキップ）。
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

// ── Config ────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const STARTGG_TOKEN = process.env.STARTGG_TOKEN || process.env.STARTGG_API_TOKEN
const STARTGG_API   = 'https://api.start.gg/gql/alpha'

// ── SF6 キャラクター ID → 名前マッピング ──────────────────────────────────────
// start.gg videogame ID 43868 (Street Fighter 6)

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
  2506: 'M.Bison',   // DB 表記に合わせてスペースなし
  2596: 'Terry',
  2616: 'Mai',
  2699: 'Elena',
  2745: 'Sagat',
  2798: 'C. Viper',
  2946: 'Alex',
  3014: 'Ingrid',
}

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs() {
  const args = {}
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/)
    if (m) args[m[1]] = m[2] ?? true
  }
  return args
}

const argv = parseArgs()
const STARTGG_TOURNAMENT_ID = Number(argv['tournament-id'])
const STARTGG_EVENT_ID      = Number(argv['event-id'])
const TOURNAMENT_SLUG       = String(argv['tournament-slug'] ?? '')
const DB_TOURNAMENT_ID      = Number(argv['db-tournament-id'])
const STREAM_INTERVAL       = Number(argv['stream-interval'] ?? 30) * 1000
const SETS_INTERVAL         = Number(argv['sets-interval']   ?? 60) * 1000
const DO_INITIAL_FETCH      = !!argv['initial-fetch']
const WITH_CHARACTERS       = !!argv['with-characters']  // initial-fetch 後にキャラ補完

if (!STARTGG_TOURNAMENT_ID || !STARTGG_EVENT_ID || !TOURNAMENT_SLUG || !DB_TOURNAMENT_ID) {
  console.error('Usage: node scripts/live-fetch-v2.js --tournament-id=X --event-id=X --tournament-slug=X --db-tournament-id=X')
  process.exit(1)
}

console.log(`
╔════════════════════════════════════════════════════════════╗
║          SF6 Live Fetch v2 — Match Data Pipeline           ║
╚════════════════════════════════════════════════════════════╝
  start.gg tournament : ${STARTGG_TOURNAMENT_ID}
  start.gg event      : ${STARTGG_EVENT_ID}
  tournament slug     : ${TOURNAMENT_SLUG}
  DB tournament id    : ${DB_TOURNAMENT_ID}
  stream interval     : ${STREAM_INTERVAL / 1000}s
  sets interval       : ${SETS_INTERVAL / 1000}s
  initial fetch       : ${DO_INITIAL_FETCH}
`)

// ── State ─────────────────────────────────────────────────────────────────────

let lastPollTimestamp = Math.floor(Date.now() / 1000) - 300  // 5分前から
const knownSets = new Map()   // setId → { state, updatedAt }
let playerCache = new Map()   // startgg_player_id → db player_id
let v2MigrationApplied = true // 楽観的に true → 最初の失敗で false に切り替え
let cycle = 0

// ── GraphQL helper ────────────────────────────────────────────────────────────

async function gql(query, variables, retries = 4) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(STARTGG_API, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${STARTGG_TOKEN}`,
      },
      body: JSON.stringify({ query, variables }),
    })
    if (res.status === 429) {
      const wait = Math.pow(2, i + 1) * 1000
      console.log(`  ⏳ Rate limited, waiting ${wait / 1000}s…`)
      await sleep(wait)
      continue
    }
    let json
    try {
      json = await res.json()
    } catch {
      // start.gg が HTML を返した (ストリームが非アクティブ等)
      return null
    }
    if (json.errors?.length) {
      if (json.errors[0].message?.includes('complexity')) {
        await sleep(Math.pow(2, i + 1) * 1000)
        continue
      }
      console.error('  GQL error:', json.errors[0].message)
      return null
    }
    return json.data
  }
  return null
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── GraphQL queries ───────────────────────────────────────────────────────────

const Q_STREAM_QUEUE = `
query StreamQueue($tournamentId: ID!) {
  streamQueue(tournamentId: $tournamentId) {
    stream { streamName streamSource }
    sets {
      id state completedAt startedAt fullRoundText round displayScore totalGames
      slots {
        entrant {
          id name
          participants { gamerTag player { id } }
        }
        standing { placement stats { score { value } } }
      }
      games {
        orderNum winnerId
        selections { entrant { id } selectionValue }
      }
    }
  }
}`

const Q_SETS_UPDATED = `
query EventSetsUpdated($eventId: ID!, $page: Int!, $perPage: Int!, $updatedAfter: Timestamp!) {
  event(id: $eventId) {
    sets(
      page: $page perPage: $perPage
      sortType: RECENT
      filters: { updatedAfter: $updatedAfter }
    ) {
      pageInfo { total totalPages }
      nodes {
        id state completedAt updatedAt startedAt
        fullRoundText round winnerId displayScore totalGames
        phaseGroup { displayIdentifier }
        slots {
          entrant {
            id name initialSeedNum
            participants { gamerTag player { id } }
          }
          standing { placement stats { score { value } } }
        }
        stream { streamName }
        station { number }
        games {
          orderNum winnerId
          selections { entrant { id } selectionValue }
        }
      }
    }
  }
}`

// initial-fetch 用: games は含めない (complexity limit 対策)
// キャラクターは Q_SETS_UPDATED の差分ポーリングで補完される
// phaseGroup.displayIdentifier と initialSeedNum は pool/seed 集計に必要
const Q_SETS_ALL = `
query EventSetsAll($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    sets(
      page: $page perPage: $perPage
      sortType: STANDARD
      filters: { hideEmpty: true }
    ) {
      pageInfo { total totalPages }
      nodes {
        id state fullRoundText round displayScore winnerId
        completedAt updatedAt startedAt
        phaseGroup { displayIdentifier }
        slots {
          entrant {
            id name initialSeedNum
            participants { gamerTag player { id } }
          }
          standing { placement stats { score { value } } }
        }
      }
    }
  }
}`

// ── Character helpers ─────────────────────────────────────────────────────────

/**
 * 指定 entrant が使用したキャラクター名を最多使用から返す
 * @param {Array} games - start.gg games 配列
 * @param {string|number|null} entrantId - entrant.id
 * @returns {string|null}
 */
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

/**
 * games 配列を JSONB 形式に変換 (characters カラム用)
 */
function extractCharacters(games) {
  if (!games?.length) return null
  return games.map(g => ({
    gameNum:    g.orderNum,
    winnerId:   g.winnerId,
    selections: (g.selections || []).map(s => ({
      entrantId:    s.entrant?.id ?? null,
      characterId:  s.selectionValue ?? null,
      characterName: s.selectionValue ? (SF6_CHAR_MAP[s.selectionValue] ?? null) : null,
    })),
  }))
}

/**
 * streamQueue キャッシュ用にセットを整形
 */
function formatSetForCache(set) {
  const s0 = set.slots?.[0]
  const s1 = set.slots?.[1]
  return {
    setId:         Number(set.id),
    state:         set.state,
    fullRoundText: set.fullRoundText,
    round:         set.round,
    displayScore:  set.displayScore,
    p1Name:        s0?.entrant?.name  || null,
    p2Name:        s1?.entrant?.name  || null,
    p1GamerTag:    s0?.entrant?.participants?.[0]?.gamerTag || null,
    p2GamerTag:    s1?.entrant?.participants?.[0]?.gamerTag || null,
    p1PlayerId:    s0?.entrant?.participants?.[0]?.player?.id || null,
    p2PlayerId:    s1?.entrant?.participants?.[0]?.player?.id || null,
    p1EntrantId:   s0?.entrant?.id   || null,
    p2EntrantId:   s1?.entrant?.id   || null,
    p1Score:       s0?.standing?.stats?.score?.value ?? null,
    p2Score:       s1?.standing?.stats?.score?.value ?? null,
    completedAt:   set.completedAt,
    characters:    extractCharacters(set.games),
  }
}

// ── Player cache ──────────────────────────────────────────────────────────────

async function loadPlayerCache() {
  let all = [], from = 0
  while (true) {
    const { data } = await supabase
      .from('players')
      .select('id, startgg_player_id, startgg_player_ids')
      .range(from, from + 999)
    all = all.concat(data || [])
    if (!data || data.length < 1000) break
    from += 1000
  }
  for (const p of all) {
    if (p.startgg_player_id) playerCache.set(String(p.startgg_player_id), p.id)
    if (p.startgg_player_ids) for (const pid of p.startgg_player_ids) playerCache.set(String(pid), p.id)
  }
  console.log(`[INIT] Player cache loaded: ${playerCache.size} entries`)
}

async function resolveInternalPlayerId(startggPlayerId, slot) {
  const strId = String(startggPlayerId)
  if (playerCache.has(strId)) return playerCache.get(strId)

  // DB に問い合わせ
  const { data } = await supabase
    .from('players')
    .select('id')
    .eq('startgg_player_id', Number(startggPlayerId))
    .maybeSingle()
  if (data) { playerCache.set(strId, data.id); return data.id }

  // 新規プレーヤー自動作成
  const gamerTag = slot?.entrant?.participants?.[0]?.gamerTag || 'Unknown'
  const { data: np, error } = await supabase
    .from('players')
    .insert({ startgg_player_id: Number(startggPlayerId), handle: gamerTag })
    .select('id')
    .single()
  if (error) { console.error(`[PLAYER] Auto-create failed for ${gamerTag}:`, error.message); return null }
  console.log(`[PLAYER] Auto-created: ${gamerTag} (db_id: ${np.id})`)
  playerCache.set(strId, np.id)
  return np.id
}

// ── Supabase upsert ───────────────────────────────────────────────────────────

/**
 * tournament_sets へ upsert
 *
 * - startgg_set_id は BIGINT なので Number() で渡す
 * - winner/loser は set.winnerId で判定して既存スキーマに合わせる
 * - winner_character / loser_character はゲームデータから抽出
 * - v2 カラム（state, completed_at 等）は migration 適用後のみ書き込む
 *   未適用時は legacyRow のみで fallback し、一度だけ警告を出す
 */
async function upsertSet(set) {
  const s0 = set.slots?.[0]
  const s1 = set.slots?.[1]
  const winnerEntrantId = set.winnerId != null ? String(set.winnerId) : null

  // winner/loser slot 判定
  const isS0Winner = !!winnerEntrantId && !!s0?.entrant && String(s0.entrant.id) === winnerEntrantId
  const winnerSlot = winnerEntrantId ? (isS0Winner ? s0 : s1) : null
  const loserSlot  = winnerEntrantId ? (isS0Winner ? s1 : s0) : null

  // start.gg player ID → DB player ID (キャッシュのみ参照)
  const wPid     = winnerSlot?.entrant?.participants?.[0]?.player?.id
  const lPid     = loserSlot?.entrant?.participants?.[0]?.player?.id
  const winnerDbId = wPid ? (playerCache.get(String(wPid)) ?? null) : null
  const loserDbId  = lPid ? (playerCache.get(String(lPid)) ?? null) : null

  // p1/p2 は slot 順固定（v2 カラム用）
  const p0pid = s0?.entrant?.participants?.[0]?.player?.id
  const p1pid = s1?.entrant?.participants?.[0]?.player?.id

  // キャラクター (既存カラム: 文字列名)
  // set.games が取得できた場合のみ書き込む（null で既存データを上書きしない）
  const winnerChar = charNameFromGames(set.games, winnerSlot?.entrant?.id)
  const loserChar  = charNameFromGames(set.games, loserSlot?.entrant?.id)
  const hasGames   = Array.isArray(set.games) && set.games.length > 0

  // ── 既存スキーマカラム (常に書き込む) ──
  const legacyRow = {
    startgg_set_id:    Number(set.id),          // BIGINT — Number() 必須
    tournament_id:     DB_TOURNAMENT_ID,
    round_text:        set.fullRoundText ?? null,
    display_score:     set.displayScore  ?? null,
    winner_id:         winnerDbId,
    loser_id:          loserDbId,
    winner_score:      winnerSlot?.standing?.stats?.score?.value ?? null,
    loser_score:       loserSlot?.standing?.stats?.score?.value  ?? null,
    winner_entrant_id: winnerSlot?.entrant?.id ? Number(winnerSlot.entrant.id) : null,
    loser_entrant_id:  loserSlot?.entrant?.id  ? Number(loserSlot.entrant.id)  : null,
    // games が取得できた時のみ書き込む（未取得時は既存 character を保護）
    ...(hasGames && { winner_character: winnerChar, loser_character: loserChar }),
    // 20260526 migration: pools_seed (legacyRow に昇格 — 常に書き込む)
    pool_identifier: set.phaseGroup?.displayIdentifier ?? null,
    winner_seed:     winnerSlot?.entrant?.initialSeedNum ?? null,
    loser_seed:      loserSlot?.entrant?.initialSeedNum  ?? null,
  }

  // ── v2 追加カラム (20260518_v2_pipeline migration 適用後のみ有効) ──
  const v2Row = {
    state:           set.state    ?? null,
    full_round_text: set.fullRoundText ?? null,
    completed_at:    set.completedAt ? new Date(set.completedAt  * 1000).toISOString() : null,
    updated_at_sg:   set.updatedAt   ? new Date(set.updatedAt    * 1000).toISOString() : null,
    started_at:      set.startedAt   ? new Date(set.startedAt    * 1000).toISOString() : null,
    stream_name:     set.stream?.streamName  ?? null,
    station_number:  set.station?.number     ?? null,
    characters:      extractCharacters(set.games),
    p1_player_id:    p0pid ? (playerCache.get(String(p0pid)) ?? null) : null,
    p2_player_id:    p1pid ? (playerCache.get(String(p1pid)) ?? null) : null,
    p1_name:         s0?.entrant?.name ?? null,
    p2_name:         s1?.entrant?.name ?? null,
  }

  const fullRow = v2MigrationApplied ? { ...legacyRow, ...v2Row } : legacyRow

  const { error } = await supabase
    .from('tournament_sets')
    .upsert(fullRow, { onConflict: 'tournament_id,startgg_set_id' })

  if (error) {
    // v2 カラムが未マイグレーション — PostgREST は "schema cache" エラーで返す
    const isV2Missing =
      error.message.includes('schema cache') ||
      error.message.includes('Could not find') ||
      (error.message.includes('column') && error.message.includes('does not exist'))

    if (isV2Missing) {
      if (v2MigrationApplied) {
        v2MigrationApplied = false
        console.warn(
          '\n⚠️  v2 migration not applied — falling back to legacy columns only.\n' +
          '   Run supabase/migrations/20260518_v2_pipeline.sql in Supabase Dashboard to enable v2.\n'
        )
      }
      // legacy カラムのみで再 upsert
      const { error: e2 } = await supabase
        .from('tournament_sets')
        .upsert(legacyRow, { onConflict: 'tournament_id,startgg_set_id' })
      if (e2) console.error(`[UPSERT] set ${set.id} (legacy):`, e2.message)
    } else {
      console.error(`[UPSERT] set ${set.id}:`, error.message)
    }
  }
}

/**
 * h2h_records へ upsert（完了セットのみ呼ぶ）
 * startgg_set_id UNIQUE が未マイグレーションの場合はスキップ
 */
async function upsertH2H(set) {
  const s0 = set.slots?.[0]
  const s1 = set.slots?.[1]
  const p0pid = s0?.entrant?.participants?.[0]?.player?.id
  const p1pid = s1?.entrant?.participants?.[0]?.player?.id
  if (!p0pid || !p1pid) return

  const p0db = await resolveInternalPlayerId(p0pid, s0)
  const p1db = await resolveInternalPlayerId(p1pid, s1)
  if (!p0db || !p1db) return

  const winnerEntrantId = set.winnerId != null ? String(set.winnerId) : null
  const isS0Winner = !!winnerEntrantId && !!s0?.entrant && String(s0.entrant.id) === winnerEntrantId
  const winnerDbId = isS0Winner ? p0db : p1db

  const record = {
    p1_id:         p0db,
    p2_id:         p1db,
    p1_score:      s0?.standing?.stats?.score?.value ?? 0,
    p2_score:      s1?.standing?.stats?.score?.value ?? 0,
    winner_id:     winnerDbId,
    tournament_id: DB_TOURNAMENT_ID,
    round_text:    set.fullRoundText ?? null,
    completed_at:  set.completedAt
      ? new Date(set.completedAt * 1000).toISOString()
      : new Date().toISOString(),
    // v2 カラム (migration 適用後に有効)
    startgg_set_id: String(Number(set.id)),  // h2h_records では TEXT
    characters:     extractCharacters(set.games),
  }

  const { error } = await supabase
    .from('h2h_records')
    .upsert(record, { onConflict: 'startgg_set_id' })

  if (error) {
    // startgg_set_id UNIQUE 制約が未マイグレーション (onConflict 失敗) または列が存在しない場合
    const isH2Vv2Missing =
      error.message.includes('startgg_set_id') ||
      error.message.includes('does not exist') ||
      error.message.includes('schema cache') ||
      error.message.includes('Could not find') ||
      error.message.includes('no unique or exclusion constraint')
    if (isH2Vv2Missing) {
      const { error: e2 } = await supabase.from('h2h_records').insert({
        p1_id: record.p1_id, p2_id: record.p2_id,
        p1_score: record.p1_score, p2_score: record.p2_score,
        winner_id: record.winner_id, tournament_id: record.tournament_id,
        round_text: record.round_text, completed_at: record.completed_at,
      })
      if (e2 && !e2.message.includes('duplicate')) {
        console.error('[H2H] Insert fallback error:', e2.message)
      }
    } else {
      console.error('[H2H] Error:', error.message)
    }
  }
}

// ── Layer 1: streamQueue polling ──────────────────────────────────────────────

async function pollStreamQueue() {
  try {
    const data = await gql(Q_STREAM_QUEUE, { tournamentId: STARTGG_TOURNAMENT_ID })
    const queues = data?.streamQueue || []

    if (queues.length === 0) {
      await supabase.from('stream_queue_cache').upsert({
        tournament_slug: TOURNAMENT_SLUG,
        current_set: null, next_sets: [],
        stream_name: null, stream_source: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tournament_slug' })
      return
    }

    for (const queue of queues) {
      const sets = queue.sets || []
      const currentSet = sets[0] ? formatSetForCache(sets[0]) : null
      const nextSets   = sets.slice(1, 6).map(formatSetForCache)

      const { error } = await supabase.from('stream_queue_cache').upsert({
        tournament_slug: TOURNAMENT_SLUG,
        current_set:     currentSet,
        next_sets:       nextSets,
        stream_name:     queue.stream?.streamName  || null,
        stream_source:   queue.stream?.streamSource || null,
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'tournament_slug' })

      if (error) {
        // stream_queue_cache テーブルが未作成の場合
        if (error.message.includes('does not exist') || error.message.includes('not found')) {
          console.warn('[STREAM] stream_queue_cache テーブルが存在しません。migration を実行してください。')
          return
        }
        console.error('[STREAM] upsert error:', error.message)
      }

      if (currentSet) {
        console.log(`[STREAM] ON AIR: ${currentSet.p1Name} vs ${currentSet.p2Name} — ${currentSet.fullRoundText}`)
      }
      if (nextSets.length > 0) {
        console.log(`[STREAM] NEXT:   ${nextSets.slice(0, 3).map(s => `${s.p1Name} vs ${s.p2Name}`).join(' | ')}`)
      }
    }
  } catch (err) {
    console.error('[STREAM] Error:', err.message)
  }
}

// ── Layer 2: diff set polling ─────────────────────────────────────────────────

async function pollUpdatedSets() {
  const newTimestamp = Math.floor(Date.now() / 1000)
  let page = 1, updatedCount = 0, completedCount = 0

  try {
    while (true) {
      const data = await gql(Q_SETS_UPDATED, {
        eventId:      STARTGG_EVENT_ID,
        page,
        perPage:      50,
        updatedAfter: lastPollTimestamp,
      })
      if (!data) break

      const { pageInfo, nodes: sets } = data.event?.sets ?? {}
      if (!sets?.length) break

      for (const set of sets) {
        const prev = knownSets.get(set.id)
        const isNewCompletion = set.state === 3 && prev?.state !== 3

        await upsertSet(set)
        updatedCount++

        if (isNewCompletion) {
          await upsertH2H(set)
          completedCount++
          const s0 = set.slots?.[0]
          const s1 = set.slots?.[1]
          const p1 = s0?.entrant?.name ?? '?'
          const p2 = s1?.entrant?.name ?? '?'
          console.log(`[DONE]  ${set.displayScore || '?-?'} | ${set.fullRoundText} | ${p1} vs ${p2}`)
        }
        knownSets.set(set.id, { state: set.state, updatedAt: set.updatedAt })
      }

      if (page >= (pageInfo?.totalPages || 1)) break
      page++
      await sleep(800)
    }

    lastPollTimestamp = newTimestamp
    if (updatedCount > 0) {
      const ts = new Date().toLocaleTimeString('en-US', { hour12: false })
      console.log(`[${ts}] +${updatedCount} updated (${completedCount} completed)`)
    }
  } catch (err) {
    console.error('[POLL] Error:', err.message)
    // lastPollTimestamp は更新しない → 次回リトライで同期
  }
}

// ── Initial full fetch ────────────────────────────────────────────────────────

async function initialFetch() {
  console.log('[INIT] Starting full set fetch…')
  let page = 1, totalPages = 1, total = 0, completed = 0, errors = 0

  while (page <= totalPages) {
    const data = await gql(Q_SETS_ALL, { eventId: STARTGG_EVENT_ID, page, perPage: 25 })
    if (!data) { console.error('[INIT] GQL failed, aborting'); break }

    const { pageInfo, nodes: sets } = data.event?.sets ?? {}
    if (!sets?.length) break
    totalPages = pageInfo?.totalPages || 1

    for (const set of sets) {
      await upsertSet(set)
      knownSets.set(set.id, { state: set.state, updatedAt: set.updatedAt })
      total++
      if (set.state === 3) {
        await upsertH2H(set)
        completed++
      }
    }

    console.log(`[INIT] Page ${page}/${totalPages} — ${total} sets (${completed} completed, ${errors} errors)`)
    page++
    if (page <= totalPages) await sleep(800)
  }

  console.log(`\n[INIT] Done — ${total} sets imported (${completed} completed)`)
}

// ── Character backfill (--with-characters) ────────────────────────────────────
// initial-fetch 後にキャラクターデータが null のセットを start.gg games API で補完

const Q_SET_GAMES_INLINE = `
query SetGames($setId: ID!) {
  set(id: $setId) {
    games {
      winnerId
      selections {
        entrant { id }
        selectionValue
      }
    }
  }
}`

const CHAR_RATE_BATCH  = 78     // 80 req/min の安全マージン
const CHAR_RATE_PAUSE  = 62_000 // バッチ間の待機 ms
const CHAR_REQ_WAIT    = 760    // リクエスト間の待機 ms

async function charBackfill() {
  console.log('\n[CHAR] Starting character backfill (--with-characters)...')

  // winner_character が null のセットを取得
  const { data: sets, error } = await supabase
    .from('tournament_sets')
    .select('id, startgg_set_id, winner_entrant_id, loser_entrant_id')
    .eq('tournament_id', DB_TOURNAMENT_ID)
    .is('winner_character', null)
    .not('startgg_set_id', 'is', null)
    .not('winner_entrant_id', 'is', null)
    .order('id')
    .limit(20000)

  if (error) { console.error('[CHAR] DB error:', error.message); return }
  if (!sets?.length) { console.log('[CHAR] No sets need character data.'); return }

  const total = sets.length
  const etaMin = Math.ceil((total / CHAR_RATE_BATCH) * (CHAR_RATE_PAUSE / 60_000 + 1))
  console.log(`[CHAR] ${total} sets — ETA ~${etaMin} min\n`)

  let processed = 0, updated = 0, noData = 0, errors = 0, reqCount = 0

  for (const set of sets) {
    if (reqCount > 0 && reqCount % CHAR_RATE_BATCH === 0) {
      console.log(`\n[CHAR RATE LIMIT] ${reqCount} requests — pausing ${CHAR_RATE_PAUSE / 1000}s...`)
      await sleep(CHAR_RATE_PAUSE)
    }

    const data = await gql(Q_SET_GAMES_INLINE, { setId: String(set.startgg_set_id) })
    reqCount++
    processed++

    const games = data?.set?.games
    if (!games?.length) { noData++; await sleep(CHAR_REQ_WAIT); continue }

    const winnerChar = charNameFromGames(games, set.winner_entrant_id)
    const loserChar  = charNameFromGames(games, set.loser_entrant_id)

    if (!winnerChar && !loserChar) {
      noData++
    } else {
      const { error: upErr } = await supabase
        .from('tournament_sets')
        .update({ winner_character: winnerChar ?? null, loser_character: loserChar ?? null })
        .eq('id', set.id)
      if (upErr) { errors++; console.error(`[CHAR] id=${set.id}: ${upErr.message}`) }
      else updated++
    }

    if (processed % 200 === 0 || processed === total) {
      const pct = (processed / total * 100).toFixed(1)
      console.log(`[CHAR] ${processed}/${total} (${pct}%) — updated=${updated} noData=${noData} errors=${errors}`)
    }

    await sleep(CHAR_REQ_WAIT)
  }

  console.log(`\n[CHAR] Done — updated=${updated} noData=${noData} errors=${errors}`)
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function main() {
  await loadPlayerCache()

  if (DO_INITIAL_FETCH) await initialFetch()
  if (DO_INITIAL_FETCH && WITH_CHARACTERS) await charBackfill()

  // stream queue タイマー
  const streamTimer = setInterval(async () => {
    await pollStreamQueue()
  }, STREAM_INTERVAL)

  // diff sets タイマー
  const setsTimer = setInterval(async () => {
    cycle++
    await pollUpdatedSets()
  }, SETS_INTERVAL)

  // 初回即時実行
  await pollStreamQueue()
  await pollUpdatedSets()

  console.log(`\n✅ Polling started (stream: ${STREAM_INTERVAL/1000}s | sets: ${SETS_INTERVAL/1000}s)\n`)

  // グレースフルシャットダウン
  process.on('SIGINT', () => {
    clearInterval(streamTimer)
    clearInterval(setsTimer)
    console.log('\n👋 Stopped.')
    process.exit(0)
  })
}

main().catch(e => { console.error(e); process.exit(1) })
