import { NextResponse } from 'next/server'

/**
 * Liquipedia のブラケット wikitext を start.gg API (/api/startgg) と同じ
 * matches 形状に変換して返す。
 *
 * EWC本戦のように start.gg を使わない大会向け。Liquipedia が唯一の一次ソース。
 *
 * ページ名はクライアントから受け取らずサーバ側の allowlist で解決する
 * （任意ページを代理取得させないため）。
 */

const LIQUIPEDIA_API = 'https://liquipedia.net/fighters/api.php'
const UA = 'SF6Database/1.0 (https://sf6-database.vercel.app; sf6database@proton.me)'

// Liquipedia の parse アクションは 1req/2s 制限。ページ間はこの間隔を空ける
const REQUEST_SPACING_MS = 2100
const CACHE_TTL = 60 * 1000

// 大会 slug → Liquipedia ページ（フェーズ順）
const PAGE_SETS: Record<string, { page: string; phase: string }[]> = {
  'ewc-2026': [
    { page: 'Esports_World_Cup/2026/SF6/First_Phase',  phase: 'Group Stage 1' },
    { page: 'Esports_World_Cup/2026/SF6/Second_Phase', phase: 'Group Stage 2' },
    { page: 'Esports_World_Cup/2026/SF6/Third_Phase',  phase: 'Finals' },
  ],
}

// Liquipedia 表記 → DB の handle
const NAME_MAP: Record<string, string> = {
  'Xiaohai':         'Xiao Hai',
  'AngryBird':       'Angry Bird',
  'Booce_Lee':       'Booce',
  'ChrisT':          'Chris T',
  // 参加者表では ChrisT、ブラケット内では Chris Tatarian と表記が揺れている
  'Chris Tatarian':  'Chris T',
}

function normalizeName(name: string): string {
  const n = name.trim()
  return NAME_MAP[n] ?? n
}

const cache = new Map<string, { data: any; ts: number }>()

// ── wikitext ヘルパー ─────────────────────────────────────────────────────────

/** `{{` から対応する `}}` までを切り出す */
function extractBraceBlock(text: string, startIdx: number): string {
  let depth = 0
  let started = false
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === '{' && text[i + 1] === '{') { depth++; i++; started = true }
    else if (text[i] === '}' && text[i + 1] === '}') {
      depth--; i++
      if (started && depth === 0) return text.substring(startIdx, i + 1)
    }
  }
  return text.substring(startIdx)
}

/** "July 30, 2026 - 16:30 {{Abbr/CEST}}" → unix秒 */
function parseLiquipediaDate(raw: string | null): number | null {
  if (!raw) return null
  const m = raw.match(/([A-Z][a-z]+ \d{1,2}, \d{4})(?:\s*-\s*(\d{1,2}):(\d{2}))?/)
  if (!m) return null
  // CEST/CET は UTC+2/+1。Abbr から判定し、無ければ CEST 扱い
  const tz = /CEST/.test(raw) ? 2 : /\bCET\b/.test(raw) ? 1 : 2
  const base = Date.parse(`${m[1]} UTC`)
  if (Number.isNaN(base)) return null
  const h = m[2] ? parseInt(m[2], 10) : 0
  const min = m[3] ? parseInt(m[3], 10) : 0
  return Math.floor((base + (h - tz) * 3600_000 + min * 60_000) / 1000)
}

interface ParsedMatch {
  group: string; phase: string; pool: string; round: string
  /** wikitext 上のマッチキー (R1M1 等)。ブラケット図の配置に使う */
  matchKey: string
  player1: string; player2: string
  player1_handle: string; player2_handle: string
  player1_startggId: null; player2_startggId: null
  player1_seed: null; player2_seed: null
  displayScore: string | null
  score: string; winner: string
  status: 'completed' | 'live' | 'upcoming'
  completedAt: number | null
  scheduledAt: number | null
  liveScore: { p1: number; p2: number } | null
  maps: { p1char: string; p2char: string; winner: string }[]
}

/** 1ページ分の wikitext を解析 */
function parsePage(wikitext: string, phase: string): ParsedMatch[] {
  const out: ParsedMatch[] = []

  // セクション見出し（=== Group AA === 等）で区切り、直近の見出しをグループ名とする
  const sectionRe = /^={2,4}\s*([^=\n]+?)\s*={2,4}\s*$/gm
  const sections: { name: string; start: number }[] = []
  let sm: RegExpExecArray | null
  while ((sm = sectionRe.exec(wikitext)) !== null) {
    sections.push({ name: sm[1].trim(), start: sm.index })
  }
  const sectionAt = (idx: number) => {
    let name = phase
    for (const s of sections) { if (s.start <= idx) name = s.name; else break }
    return name
  }

  // 直近の HTML コメントをラウンド名として使う（例: <!-- Upper Bracket Quarterfinals -->）
  const commentRe = /<!--\s*([^>]*?)\s*-->/g
  const comments: { text: string; start: number }[] = []
  let cm: RegExpExecArray | null
  while ((cm = commentRe.exec(wikitext)) !== null) {
    const t = cm[1].trim()
    if (t && t.length < 60 && !t.includes('|')) comments.push({ text: t, start: cm.index })
  }
  const commentAt = (idx: number) => {
    let name: string | null = null
    for (const c of comments) { if (c.start <= idx) name = c.text; else break }
    return name
  }

  const matchRe = /\|([A-Z0-9]+M\d+)=\{\{Match/g
  let mm: RegExpExecArray | null
  const roundCounter = new Map<string, number>()

  while ((mm = matchRe.exec(wikitext)) !== null) {
    const key = mm[1]
    const blockStart = wikitext.indexOf('{{Match', mm.index)
    const block = extractBraceBlock(wikitext, blockStart)

    // 対戦者（score 付き）
    const opps: Record<string, { name: string; score: string }> = {}
    const oppRe = /\|opponent(\d)=\{\{SoloOpponent\|([^|}]*)((?:\|[^}]*?)?)\}\}/g
    let om: RegExpExecArray | null
    while ((om = oppRe.exec(block)) !== null) {
      const rest = om[3] || ''
      const sc = rest.match(/\|score=([^|}\s]*)/)
      opps[om[1]] = { name: om[2].trim(), score: sc ? sc[1].trim() : '' }
    }
    // 後続ラウンドは対戦相手が未確定（opponent が空欄）で、進行に応じて埋まる。
    // スケジュールとして表示したいので TBD 扱いで取り込む
    const p1 = opps['1']?.name || 'TBD'
    const p2 = opps['2']?.name || 'TBD'

    // ゲーム単位（キャラ・勝者）
    const maps: ParsedMatch['maps'] = []
    let p1Wins = 0, p2Wins = 0
    const mapRe = /\{\{Map([\s\S]*?)\}\}\s*(?=\||\}\})/g
    let gm: RegExpExecArray | null
    while ((gm = mapRe.exec(block)) !== null) {
      const body = gm[1]
      const w = body.match(/\|winner=(\d*)/)?.[1] ?? ''
      const c1 = body.match(/\|o1p1=\{\{Chars\|([^}|]*)/)?.[1]?.trim() ?? ''
      const c2 = body.match(/\|o2p1=\{\{Chars\|([^}|]*)/)?.[1]?.trim() ?? ''
      if (w || c1 || c2) {
        maps.push({ p1char: c1, p2char: c2, winner: w })
        if (w === '1') p1Wins++
        else if (w === '2') p2Wins++
      }
    }

    // opponent の score があればそちらを優先（Liquipedia は確定時に埋める）
    const s1raw = opps['1']?.score ?? ''
    const s2raw = opps['2']?.score ?? ''
    const s1 = /^\d+$/.test(s1raw) ? parseInt(s1raw, 10) : p1Wins
    const s2 = /^\d+$/.test(s2raw) ? parseInt(s2raw, 10) : p2Wins

    const bestof = parseInt(block.match(/\|bestof=(\d+)/)?.[1] ?? '5', 10)
    const needed = Math.ceil(bestof / 2)
    const scheduledAt = parseLiquipediaDate(block.match(/\|date=([^\n|]+)/)?.[1] ?? null)

    let status: ParsedMatch['status'] = 'upcoming'
    let winner = ''
    if (s1 >= needed || s2 >= needed) {
      status = 'completed'
      winner = s1 > s2 ? p1 : p2
    } else if (s1 > 0 || s2 > 0) {
      status = 'live'
    }

    const roundBase = commentAt(mm.index) ?? key
    const groupName = sectionAt(mm.index)
    const rkey = `${groupName}//${roundBase}`
    const n = (roundCounter.get(rkey) ?? 0) + 1
    roundCounter.set(rkey, n)
    // 同一ラウンドに複数試合がある場合のみ連番を付ける
    const round = roundBase

    out.push({
      group: groupName, phase, pool: groupName, round, matchKey: key,
      player1: normalizeName(p1), player2: normalizeName(p2),
      player1_handle: normalizeName(p1), player2_handle: normalizeName(p2),
      player1_startggId: null, player2_startggId: null,
      player1_seed: null, player2_seed: null,
      displayScore: status === 'upcoming' ? null : `${s1}-${s2}`,
      score: status === 'upcoming' ? '' : `${s1}-${s2}`,
      winner: normalizeName(winner),
      status,
      completedAt: status === 'completed' ? scheduledAt : null,
      scheduledAt,
      liveScore: status === 'live' ? { p1: s1, p2: s2 } : null,
      maps,
    })
  }

  return out
}

async function fetchPage(page: string): Promise<string> {
  const url = `${LIQUIPEDIA_API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json`
  const resp = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip' },
    cache: 'no-store',
  })
  if (resp.status === 429) throw new Error('RATE_LIMITED')
  if (!resp.ok) throw new Error(`Liquipedia ${resp.status}`)
  const json = await resp.json()
  if (json?.error) throw new Error(`Liquipedia: ${json.error.code}`)
  return json?.parse?.wikitext?.['*'] ?? ''
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tournament = searchParams.get('tournament') ?? ''
  const pages = PAGE_SETS[tournament]

  if (!pages) {
    return NextResponse.json({ error: 'unknown tournament', matches: [] }, { status: 400 })
  }

  const cached = cache.get(tournament)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ...cached.data, cached: true })
  }

  try {
    const matches: ParsedMatch[] = []
    for (let i = 0; i < pages.length; i++) {
      if (i > 0) await sleep(REQUEST_SPACING_MS)   // Liquipedia のレート制限を尊重
      const wt = await fetchPage(pages[i].page)
      matches.push(...parsePage(wt, pages[i].phase))
    }

    // 開始/次の試合の時刻。大会は日付をまたぐため「まだ終わっていない最速の試合」を
    // 次の試合とする。日付だけでは開催中判定がズレる（初日00:00〜開催中になってしまう）
    const times = matches.filter(m => m.scheduledAt).map(m => m.scheduledAt as number)
    const pending = matches
      .filter(m => m.scheduledAt && m.status !== 'completed')
      .map(m => m.scheduledAt as number)

    const data = {
      matches,
      event: { name: tournament, state: 'ACTIVE', numEntrants: null, phases: [] },
      standings: [],
      startsAt:    times.length   ? Math.min(...times)   : null,
      nextMatchAt: pending.length ? Math.min(...pending) : null,
      lastUpdated: new Date().toISOString(),
      source: 'liquipedia',
    }
    cache.set(tournament, { data, ts: Date.now() })
    return NextResponse.json({ ...data, cached: false })
  } catch (e: any) {
    console.error('[liquipedia]', e.message)
    // 取得失敗時は古いキャッシュを返す（429 対策）
    const stale = cache.get(tournament)
    if (stale) return NextResponse.json({ ...stale.data, cached: true, error: e.message })
    return NextResponse.json({ error: e.message, matches: [] }, { status: 500 })
  }
}
