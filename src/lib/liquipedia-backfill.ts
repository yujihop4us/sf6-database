/**
 * liquipedia-backfill.ts
 *
 * Liquipedia から選手データ（country_code / main_character）と
 * 大会賞金データを取得するユーティリティ。
 *
 * /api/cron/backfill から呼ばれる。
 * post-tournament-update.js の Step 2/4 ロジックを TypeScript 化したもの。
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ── 定数 ────────────────────────────────────────────────────────────────────

export const LIQUIPEDIA_BASE = 'https://liquipedia.net/fighters'
const REQUEST_DELAY_MS = 4_000   // Liquipedia: 1 req / 4s
const FETCH_TIMEOUT_MS = 15_000

// ── 国名 → ISO 2文字コード ────────────────────────────────────────────────

const COUNTRY_NAME_MAP: Record<string, string> = {
  'Japan': 'JP', 'United States': 'US', 'USA': 'US', 'China': 'CN',
  'Taiwan': 'TW', 'Hong Kong': 'HK', 'South Korea': 'KR', 'Korea': 'KR',
  'France': 'FR', 'Germany': 'DE', 'United Kingdom': 'GB', 'Brazil': 'BR',
  'Chile': 'CL', 'Argentina': 'AR', 'Mexico': 'MX', 'Dominican Republic': 'DO',
  'Norway': 'NO', 'Sweden': 'SE', 'Netherlands': 'NL', 'Belgium': 'BE',
  'Switzerland': 'CH', 'Australia': 'AU', 'Canada': 'CA', 'Singapore': 'SG',
  'Philippines': 'PH', 'Pakistan': 'PK', 'United Arab Emirates': 'AE',
  'Saudi Arabia': 'SA', 'Russia': 'RU', 'Italy': 'IT', 'Spain': 'ES',
  'Algeria': 'DZ', 'Morocco': 'MA', 'Tunisia': 'TN', 'Egypt': 'EG',
  'Portugal': 'PT', 'Poland': 'PL', 'Czech Republic': 'CZ', 'Romania': 'RO',
  'Denmark': 'DK', 'Finland': 'FI', 'Greece': 'GR', 'Hungary': 'HU',
  'Indonesia': 'ID', 'Malaysia': 'MY', 'Thailand': 'TH', 'Vietnam': 'VN',
  'New Zealand': 'NZ', 'Colombia': 'CO', 'Peru': 'PE', 'Venezuela': 'VE',
  'Bolivia': 'BO', 'Ecuador': 'EC', 'Uruguay': 'UY', 'Paraguay': 'PY',
  'Costa Rica': 'CR', 'Guatemala': 'GT', 'Honduras': 'HN', 'El Salvador': 'SV',
  'Nicaragua': 'NI', 'Panama': 'PA', 'Cuba': 'CU', 'Puerto Rico': 'PR',
  'Jamaica': 'JM', 'Trinidad and Tobago': 'TT', 'Barbados': 'BB',
}

// ── キャラ名正規化（DB canonical 名に合わせる）────────────────────────────

const CHAR_NORMALIZE: Record<string, string> = {
  'M. Bison': 'M.Bison',   'M.Bison':  'M.Bison',
  'A.K.I.':   'Aki',       'A.K.I':    'Aki',       'AKI': 'Aki',
  'E. Honda': 'E.Honda',   'Honda':    'E.Honda',
  'Dee Jay':  'Dee Jay',   'DeeJay':   'Dee Jay',
  'Chun Li':  'Chun-Li',   'Chun-Li':  'Chun-Li',
  'C. Viper': 'C. Viper',
}

function normalizeChar(name: string): string {
  const t = name.trim()
  return CHAR_NORMALIZE[t] ?? t
}

// ── 低レベル HTTP ────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Liquipedia ページを取得。
 * レートリミット (429) は null を返し呼び出し元に伝搬させる。
 */
export async function fetchLiquipediaHtml(url: string): Promise<{
  html: string | null
  rateLimited: boolean
}> {
  await sleep(REQUEST_DELAY_MS)   // 常に待ってから送信

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'sf6-database/1.0 (https://github.com; data research)',
        'Accept-Encoding': 'gzip, deflate',
        'Accept': 'text/html',
      },
    })
    clearTimeout(timer)

    if (res.status === 429 || res.status === 503) return { html: null, rateLimited: true }
    if (res.status === 404) return { html: null, rateLimited: false }
    if (!res.ok) return { html: null, rateLimited: false }

    const text = await res.text()
    if (text.includes('Rate Limited') && text.includes('cloudflare')) {
      return { html: null, rateLimited: true }
    }
    return { html: text, rateLimited: false }
  } catch {
    return { html: null, rateLimited: false }
  }
}

// ── 選手個別ページ ────────────────────────────────────────────────────────

export interface PlayerLiquipediaData {
  countryCode?: string
  mainCharacter?: string
  rateLimited: boolean
}

/**
 * Liquipedia の選手ページから country_code と main_character を取得。
 * 4秒のレートリミット待機を内包。
 * 429 / 404 / ネットワークエラーは rateLimited フラグで通知。
 */
export async function fetchPlayerFromLiquipedia(
  gamerTag: string
): Promise<PlayerLiquipediaData> {
  // ハンドル → Liquipedia URL slug（スペースを _ に）
  const slug = encodeURIComponent(gamerTag.replace(/ /g, '_'))
  const url = `${LIQUIPEDIA_BASE}/${slug}`

  const { html, rateLimited } = await fetchLiquipediaHtml(url)
  if (!html) return { rateLimited }

  // ── country_code ──────────────────────────────────────────────────────────
  let countryCode: string | undefined
  const natPatterns = [
    /Nationality[^<]*<\/[^>]+>[\s\S]{0,100}?<a[^>]+>([^<]+)<\/a>/i,
    /Country[^<]*<\/[^>]+>[\s\S]{0,100}?<a[^>]+>([^<]+)<\/a>/i,
    /<td[^>]*>Nationality<\/td>[\s\S]{0,300}?<td[^>]*>([^<]+)</i,
    // flag img title attribute
    /<span class="flag"><img[^>]+title="([^"]+)"/i,
  ]
  for (const pat of natPatterns) {
    const m = html.match(pat)
    if (!m) continue
    const name = m[1].trim()
    const code = COUNTRY_NAME_MAP[name] ?? (/^[A-Z]{2}$/.test(name) ? name : undefined)
    if (code) { countryCode = code; break }
  }

  // ── main_character（選手ページのインフォボックス）────────────────────────
  let mainCharacter: string | undefined
  // <span class="race"><img alt="CharName"> in infobox section
  const raceM = html.match(/<table[^>]*infobox[^>]*>[\s\S]{0,3000}?<span class="race"><img alt="([^"]+)"/)
  if (raceM) {
    mainCharacter = normalizeChar(raceM[1])
  }
  // Fallback: "Character" table row with text
  if (!mainCharacter) {
    const charRowM = html.match(/<b>Characters?<\/b>[\s\S]{0,400}?<a[^>]+title="([^"]+)"/)
    if (charRowM) mainCharacter = normalizeChar(charRowM[1])
  }

  return { countryCode, mainCharacter, rateLimited: false }
}

// ── 大会賞金テーブル ──────────────────────────────────────────────────────

export interface PrizeEntry {
  placement: number        // 1, 2, 3, 4, 9, ... (タイ時は最上位の順位)
  prizeAmount: number      // USD 金額
  playerNames: string[]    // 表示名（Liquipedia link text）
  playerHrefs: string[]    // /fighters/<slug>
}

/**
 * Liquipedia の大会ページから Prize Pool テーブルをパース。
 * 1-based placement と USD 賞金額を返す。
 */
export async function fetchTournamentPrizePool(
  liquipediaUrl: string
): Promise<{ entries: PrizeEntry[]; totalPrize: number; rateLimited: boolean }> {
  const { html, rateLimited } = await fetchLiquipediaHtml(liquipediaUrl)
  if (!html) return { entries: [], totalPrize: 0, rateLimited }

  // 総賞金額を取得（テーブルヘッダー直前の "X USD are spread..." テキスト）
  const totalM = html.match(/\$([\d,]+)&#160;<abbr[^>]*>USD<\/abbr>[^<]*are spread/)
  const totalPrize = totalM ? parseInt(totalM[1].replace(/,/g, ''), 10) : 0

  // prizepooltable セクションを取り出す
  const tableStart = html.indexOf('prizepooltable')
  if (tableStart < 0) return { entries: [], totalPrize, rateLimited: false }
  const tableSection = html.slice(tableStart, tableStart + 80_000)

  // 行単位で分割（csstable-widget-row で区切る）
  const rowChunks = tableSection.split('class="csstable-widget-row ')

  const entries: PrizeEntry[] = []
  const tournamentUrlPatterns = [
    /\/fighters\/Capcom_Cup/,
    /\/fighters\/Esports_World_Cup/,
    /\/fighters\/Evolution_Championship_Series/,
    /\/fighters\/Combo_Breaker/,
    /\/fighters\/DreamHack/,
    /\/fighters\/index\.php/,
  ]

  for (const row of rowChunks.slice(1)) {
    const placeM = row.match(/(\d+)(?:st|nd|rd|th)/)
    const amtM   = row.match(/\$([\d,]+)/)
    if (!placeM || !amtM) continue

    const placement  = parseInt(placeM[1], 10)
    const prizeAmount = parseInt(amtM[1].replace(/,/g, ''), 10)

    // player 列（prizepooltable-col-team 以降）
    const teamSection = row.includes('prizepooltable-col-team')
      ? row.split('prizepooltable-col-team').slice(1).join('')
      : row

    const links = [...teamSection.matchAll(/href="\/fighters\/([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    const playerLinks = links.filter(([, href]) =>
      !tournamentUrlPatterns.some(p => p.test(`/fighters/${href}`))
    )

    if (playerLinks.length === 0) continue

    entries.push({
      placement,
      prizeAmount,
      playerNames: playerLinks.map(([, , name]) => name.trim()).filter(n => n && n !== 'edit'),
      playerHrefs: playerLinks.map(([, href]) => href),
    })
  }

  return { entries, totalPrize, rateLimited: false }
}

// ── バックフィルターゲット取得 ─────────────────────────────────────────────

export interface BackfillPlayer {
  id: number
  handle: string
  countryCode: string | null
  mainCharacter: string | null
  liquipediaCheckedAt: string | null
  bestPlacement: number | null
}

export interface BackfillTournament {
  id: number
  name: string
  liquipediaUrl: string
  prizePool: number | null
}

export interface BackfillTargets {
  players: BackfillPlayer[]
  tournaments: BackfillTournament[]
  totalPendingPlayers: number
  totalPendingTournaments: number
}

/**
 * バックフィル対象の選手と大会を優先度順で返す。
 *
 * 選手の優先度:
 *   1. invitational 大会（CC/EWC, entrant数 ≤ 50）のプレイヤー
 *   2. placement ≤ 25 のプレイヤー
 *   3. placement ≤ 48 のプレイヤー
 *
 * 大会: liquipedia_url あり & (prize_pool NULL OR entrants に prize_amount NULL が多い)
 */
export async function getBackfillTargets(
  supabase: SupabaseClient,
  options: { playerBatch?: number; tournamentBatch?: number } = {}
): Promise<BackfillTargets> {
  const { playerBatch = 8, tournamentBatch = 1 } = options

  // ── 選手バックフィルターゲット ────────────────────────────────────────────
  // placement 上位のentrantsを取得（優先度: 小→大）
  const { data: entrants } = await supabase
    .from('tournament_entrants')
    .select('player_id, placement, tournament_id')
    .not('player_id', 'is', null)
    .not('placement', 'is', null)
    .lte('placement', 48)
    .order('placement', { ascending: true })
    .limit(2000)

  // player_id → 最良 placement のマップ
  const bestPlacement = new Map<number, number>()
  for (const e of entrants ?? []) {
    const cur = bestPlacement.get(e.player_id)
    if (cur === undefined || e.placement < cur) bestPlacement.set(e.player_id, e.placement)
  }

  const playerIds = [...bestPlacement.keys()]

  // 欠損データのある選手をすべて取得
  const { data: players } = await supabase
    .from('players')
    .select('id, handle, country_code, main_character, liquipedia_checked_at')
    .in('id', playerIds)
    .or('country_code.is.null,main_character.is.null')
    .is('liquipedia_checked_at', null)

  // 優先度順にソート（placement 昇順）
  const sorted = (players ?? [])
    .map(p => ({
      id: p.id,
      handle: p.handle as string,
      countryCode: p.country_code as string | null,
      mainCharacter: p.main_character as string | null,
      liquipediaCheckedAt: p.liquipedia_checked_at as string | null,
      bestPlacement: bestPlacement.get(p.id) ?? null,
    }))
    .sort((a, b) => (a.bestPlacement ?? 999) - (b.bestPlacement ?? 999))

  const totalPendingPlayers = sorted.length
  const targetPlayers = sorted.slice(0, playerBatch)

  // ── 大会賞金バックフィルターゲット ────────────────────────────────────────
  // prize_pool が NULL の大会（liquipedia_url あり）
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, liquipedia_url, prize_pool')
    .not('liquipedia_url', 'is', null)
    .is('prize_pool', null)
    .order('start_date', { ascending: false })
    .limit(tournamentBatch * 3)   // 多めに取って prize_amount も確認

  // tournament_entrants に prize_amount が入っている大会をフィルタ
  const pendingTournaments: BackfillTournament[] = []
  for (const t of tournaments ?? []) {
    if (pendingTournaments.length >= tournamentBatch) break
    const { count } = await supabase
      .from('tournament_entrants')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', t.id)
      .not('placement', 'is', null)
    if ((count ?? 0) > 0) {
      pendingTournaments.push({
        id: t.id,
        name: t.name as string,
        liquipediaUrl: t.liquipedia_url as string,
        prizePool: t.prize_pool as number | null,
      })
    }
  }

  return {
    players: targetPlayers,
    tournaments: pendingTournaments,
    totalPendingPlayers,
    totalPendingTournaments: (tournaments ?? []).length,
  }
}
