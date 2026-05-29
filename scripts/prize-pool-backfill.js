import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
dotenv.config({ path: '/Users/yujisasaki/sf6-database/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Liquipedia プライズプール パーサー ─────────────────────────────────
const TOUR_SKIP = /\/fighters\/(Capcom_Cup|Esports_World_Cup|Evolution_Championship|Combo_Breaker|DreamHack|index\.php)/

async function fetchPrizePool(url) {
  await sleep(4000)
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'sf6-database/1.0 (https://github.com; data research)',
      'Accept-Encoding': 'gzip, deflate',
    }
  })
  if (!res.ok) { console.log(`  ⚠ HTTP ${res.status}`); return null }
  const html = await res.text()
  if (html.includes('Rate Limited') && html.includes('cloudflare')) {
    console.log('  ⚠ Cloudflare block!'); return null
  }

  // 総賞金
  const totalM = html.match(/\$([\d,]+)&#160;<abbr[^>]*>USD<\/abbr>[^<]*are spread/)
  const totalPrize = totalM ? parseInt(totalM[1].replace(/,/g,''),10) : 0

  const tableStart = html.indexOf('prizepooltable')
  if (tableStart < 0) return { totalPrize, entries: [] }
  const section = html.slice(tableStart, tableStart + 120000)
  const rows = section.split('class="csstable-widget-row ')

  const entries = []
  for (const row of rows.slice(1)) {
    const rangeM  = row.match(/(\d+)[–\-](\d+)(?:st|nd|rd|th|\s*<)/)
    const placeM  = row.match(/(\d+)(?:st|nd|rd|th)/)
    const amtM    = row.match(/\$([\d,]+)/)
    if (!placeM && !rangeM) continue
    const placement = rangeM ? parseInt(rangeM[1],10) : parseInt(placeM[1],10)
    const prize = amtM ? parseInt(amtM[1].replace(/,/g,''),10) : 0

    const teamSection = row.includes('prizepooltable-col-team')
      ? row.split('prizepooltable-col-team').slice(1).join('')
      : row
    const links = [...teamSection.matchAll(/href="\/fighters\/([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    const players = links
      .filter(([,href]) => !TOUR_SKIP.test(`/fighters/${href}`))
      .map(([,href,name]) => ({ href, name: name.trim() }))
      .filter(p => p.name && p.name !== 'edit')

    if (players.length) entries.push({ placement, prize, players })
  }
  return { totalPrize, entries }
}

// ── DB マッチング & 更新 ─────────────────────────────────────────────
async function updatePrizes(tournamentId, liquipediaUrl) {
  console.log(`\nFetching ${liquipediaUrl}...`)
  const data = await fetchPrizePool(liquipediaUrl)
  if (!data) return { updated: 0, skipped: 0 }

  const { totalPrize, entries } = data
  console.log(`  prize_pool: $${totalPrize.toLocaleString()}, entries: ${entries.length} tiers`)

  if (!entries.length) return { updated: 0, skipped: 0 }

  // tournaments.prize_pool 更新
  const { data: t } = await supabase.from('tournaments').select('prize_pool').eq('id', tournamentId).single()
  if (!t?.prize_pool && totalPrize > 0) {
    await supabase.from('tournaments').update({ prize_pool: totalPrize }).eq('id', tournamentId)
    console.log(`  ✅ prize_pool → $${totalPrize.toLocaleString()}`)
  }

  // entrant lookup
  const { data: entrants } = await supabase
    .from('tournament_entrants')
    .select('id, player_id, prize_amount, players(handle)')
    .eq('tournament_id', tournamentId)
  if (!entrants?.length) return { updated: 0, skipped: 0 }

  // handle map (lowercase + underscore variants)
  const entrantMap = new Map()
  for (const e of entrants) {
    const h = e.players?.handle
    if (!h) continue
    entrantMap.set(h.toLowerCase(), e)
    entrantMap.set(h.toLowerCase().replace(/\s+/g,'_'), e)
    entrantMap.set(h.toLowerCase().replace(/_/g,' '), e)
  }

  let updated = 0, skipped = 0
  for (const { placement, prize, players } of entries) {
    for (const { href, name } of players) {
      const hrefDecoded = href.replace(/_/g,' ')
      let entrant = entrantMap.get(name.toLowerCase())
        ?? entrantMap.get(name.toLowerCase().replace(/\s+/g,'_'))
        ?? entrantMap.get(hrefDecoded.toLowerCase())
        ?? entrantMap.get(href.toLowerCase())
      if (!entrant) { skipped++; continue }
      if (entrant.prize_amount === prize) { skipped++; continue }

      await supabase.from('tournament_entrants')
        .update({ prize_amount: prize })
        .eq('id', entrant.id)
      updated++
      console.log(`  ✅ ${name}: placement=${placement} → $${prize.toLocaleString()}`)
    }
  }
  return { updated, skipped }
}

// ── メイン ──────────────────────────────────────────────────────────────
const TOURNAMENTS = [
  { id: 48, name: 'CB2026',     url: 'https://liquipedia.net/fighters/Combo_Breaker/2026/SF6' },
  { id: 40, name: 'EvoJP2026',  url: 'https://liquipedia.net/fighters/Evolution_Championship_Series/2026/Japan/SF6' },
  { id: 47, name: 'DH Atlanta', url: 'https://liquipedia.net/fighters/DreamHack/2026/Atlanta/SF6' },
  { id: 12, name: 'Evo2025',    url: 'https://liquipedia.net/fighters/Evolution_Championship_Series/2025/SF6' },
  { id: 21, name: 'CB2025',     url: 'https://liquipedia.net/fighters/Combo_Breaker/2025/SF6' },
  { id: 34, name: 'EvoJP2025',  url: 'https://liquipedia.net/fighters/Evolution_Championship_Series/2025/Japan/SF6' },
  { id: 5,  name: 'EWC2025',    url: 'https://liquipedia.net/fighters/Esports_World_Cup/2025/SF6' },
  { id: 37, name: 'CC X',       url: 'https://liquipedia.net/fighters/Capcom_Cup/10' },
  { id: 9,  name: 'CC12',       url: 'https://liquipedia.net/fighters/Capcom_Cup/12' },
]

const summary = []
for (const t of TOURNAMENTS) {
  const { updated, skipped } = await updatePrizes(t.id, t.url)
  summary.push({ ...t, updated, skipped })
  if (t !== TOURNAMENTS.at(-1)) { console.log(`  ⏳ 10s wait...`); await sleep(10000) }
}

console.log('\n\n════════════ 結果サマリー ════════════')
for (const s of summary) {
  console.log(`[${String(s.id).padStart(2)}] ${s.name.padEnd(12)} updated=${s.updated} skipped=${s.skipped}`)
}

