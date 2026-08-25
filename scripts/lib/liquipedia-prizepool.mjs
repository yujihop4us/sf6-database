/**
 * liquipedia-prizepool.mjs — Liquipedia の賞金表から賞金とサーキットポイントを取得
 *
 * 賞金とポイントは**同じ表**に入っているため一度に取る。
 *
 * 取得方法の注意:
 *   Liquipedia は生 HTML の直接取得を 403 で拒否する。必ず MediaWiki API
 *   (action=parse) を規約準拠の User-Agent で叩くこと。レートは 1req/2s を厳守。
 *
 * circuit（cpt2026 / ewc2026 等）は日付から推測しない。
 *   Capcom Cup 12 は 2026年3月開催だが CPT2025 シーズンの決勝であり暦年では誤る。
 *   賞金表テンプレートの `points=<circuit>` を唯一の根拠にする。
 */

const API = 'https://liquipedia.net/fighters/api.php'
const UA = 'SF6Database/1.0 (https://sf6-database.vercel.app; sf6database@proton.me)'
const REQUEST_DELAY_MS = 2500   // 1req/2s 規約に余裕を持たせる

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** Liquipedia URL または ページ名 → ページ名 */
export function toPageTitle(urlOrTitle) {
  const m = String(urlOrTitle).match(/^https?:\/\/liquipedia\.net\/fighters\/(.+?)\/?$/)
  return decodeURIComponent(m ? m[1] : urlOrTitle)
}

/**
 * 同一ページの重複取得を防ぐキャッシュ。
 * 1大会あたり wikitext / text / 親ページ探索で複数回叩くため、
 * これが無いと全大会一括実行でレート制限に触れる。
 */
const cache = new Map()

async function apiParse(page, prop) {
  const key = `${page}::${prop}`
  if (cache.has(key)) return cache.get(key)

  const url = `${API}?action=parse&page=${encodeURIComponent(page)}&prop=${prop}&format=json`

  // 429 は即中断せず待って再試行する。ただし繰り返すと恒久 ban の警告があるため
  // 試行回数を絞り、待ち時間は長めに取る
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(REQUEST_DELAY_MS)
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' },
    })

    if (res.status === 429 || res.status === 503) {
      if (attempt === 2) throw new Error('RATE_LIMITED')
      await sleep(30_000 * (attempt + 1))   // 30s, 60s
      continue
    }
    if (!res.ok) { cache.set(key, null); return null }

    const json = await res.json()
    if (json?.error) { cache.set(key, null); return null }

    const out = prop === 'text' ? json?.parse?.text?.['*'] : json?.parse?.wikitext?.['*']
    cache.set(key, out ?? null)
    return out ?? null
  }
  return null
}

const strip = s =>
  String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&#45;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

/** "5-8" → [5,6,7,8] / "3" → [3] */
function expandPlaces(placeText) {
  const t = placeText.replace(/(st|nd|rd|th)/gi, '').trim()
  const range = t.match(/^(\d+)\s*[-–—]\s*(\d+)$/)
  if (range) {
    const out = []
    for (let i = +range[1]; i <= +range[2]; i++) out.push(i)
    return out
  }
  const single = t.match(/^(\d+)$/)
  return single ? [+single[1]] : []
}

const toNum = s => {
  const t = strip(s).replace(/[$,]/g, '')
  return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null
}

/**
 * 大会の賞金表を取得する。
 * @returns {{ circuit: string|null, entries: Array<{place:number, name:string, usd:number|null, points:number|null, qualifiesTo:string|null}> }}
 */
export async function fetchPrizePool(urlOrTitle) {
  let page = toPageTitle(urlOrTitle)

  // liquipedia_url にはキャラ取得用にサブページ（/Bracket, /First_Phase 等）が
  // 入っていることがある。賞金表は本ページにしか無いので親へ遡って探す。
  // 1req/2s 制限があるため遡りは2段までに留める。
  for (let depth = 0; depth < 2; depth++) {
    const probe = await apiParse(page, 'text')
    if (probe && probe.includes('prizepooltable')) break
    const parent = page.replace(/\/[^/]+$/, '')
    if (!parent || parent === page) break
    page = parent
  }

  // circuit は日付から推測しない。
  // 第一根拠は賞金表テンプレートの `points=<circuit>`。
  // ポイント付与のない大会（Capcom Cup 等）はそこに無いため infobox の
  // `|circuit=` から補う。CC12 は 2026年3月開催だが circuit=Capcom Pro Tour 2025。
  const wikitext = await apiParse(page, 'wikitext')
  let circuit = wikitext?.match(/\{\{SoloPrizePool[^}]*?\|points=([a-z0-9]+)/i)?.[1] ?? null
  if (!circuit && wikitext) {
    const raw = wikitext.match(/\|circuit=([^\n|]+)/)?.[1]?.trim()
    const year = raw?.match(/(20\d{2})/)?.[1]
    if (raw && year) {
      if (/capcom pro tour/i.test(raw))      circuit = `cpt${year}`
      else if (/esports world cup/i.test(raw)) circuit = `ewc${year}`
    }
  }

  const html = await apiParse(page, 'text')
  if (!html) return { circuit, entries: [], error: 'ページ取得失敗' }

  const start = html.indexOf('prizepooltable')
  if (start < 0) return { circuit, entries: [], error: '賞金表なし' }
  const end = html.indexOf('</table>', start)
  const table = html.slice(start, end < 0 ? undefined : end)

  // ヘッダから列位置を特定（大会ごとに Qualifies To の有無などが変わるため）
  const headRow = table.slice(0, table.indexOf('</tr>'))
  const headers = [...headRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => strip(m[1]))
  const usdCol    = headers.findIndex(h => /USD|\$/.test(h))
  const pointsCol = headers.findIndex(h => /Points/i.test(h))
  const qualCol   = headers.findIndex(h => /Qualifies/i.test(h))

  const entries = []
  // タイ順位（5-8 等）は rowspan で先頭行にしか値が無く、続く行は選手名のみになる。
  // そのため place / usd / points / qualifies はすべて引き継ぐ必要がある。
  let curPlaces = []
  let curIdx = 0
  let curUsd = null
  let curPoints = null
  let curQual = null

  for (const rowHtml of table.split(/<tr/).slice(1)) {
    if (/<th[^>]*>/.test(rowHtml) && !/<td[^>]*>/.test(rowHtml)) continue   // ヘッダ行

    const placeCell = rowHtml.match(/prizepooltable-place[^>]*>([\s\S]*?)<\/t[dh]>/)
    if (placeCell) {
      const p = expandPlaces(strip(placeCell[1]))
      if (p.length) {
        // 新しい tier に入ったら値を捨てる。
        // 引き継ぎは tier 内だけで有効。跨いで残すと「賞金なし・ポイントのみ」の
        // 下位層（CEO の 9-12 位など）に上位層の賞金が漏れる
        curPlaces = p
        curIdx = 0
        curUsd = null
        curPoints = null
        curQual = null
      }
    }
    if (!curPlaces.length) continue

    const cellText = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => strip(m[1]))

    // 選手名: opponent ブロックの name クラス
    const nameM = rowHtml.match(/class="[^"]*name[^"]*"[^>]*>\s*(?:<a[^>]*>)?([^<]{1,60})/)
    if (!nameM) continue
    const name = strip(nameM[1])
    if (!name) continue

    // 値セルを持つ行（tier の先頭）でのみ更新し、以降の行は引き継ぐ。
    // 列番号ではなく値の形で拾う（Qualifies To 列の有無が大会ごとに違うため）
    const usdCell = cellText.find(c => c.startsWith('$'))
    if (usdCell) curUsd = toNum(usdCell)

    if (pointsCol >= 0) {
      // ポイントは最終列。"1,000" のようにカンマ区切りで入ることがある
      const last = cellText[cellText.length - 1]
      if (last && /^[\d,]+$/.test(last)) curPoints = parseInt(last.replace(/,/g, ''), 10)
    }

    const qualCell = cellText.find(c => /Capcom Cup|Esports World Cup/i.test(c))
    if (qualCell) curQual = qualCell

    const place = curPlaces[curIdx] ?? curPlaces[curPlaces.length - 1]
    curIdx++
    entries.push({ place, name, usd: curUsd, points: curPoints, qualifiesTo: curQual })
  }

  return { circuit, entries }
}
