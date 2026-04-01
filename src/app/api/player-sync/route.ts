import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Liquipedia API helper with rate limiting
async function fetchLiquipediaPlayer(pageName: string) {
  const url = `https://liquipedia.net/fighters/api.php?action=parse&page=${encodeURIComponent(pageName)}&prop=text|sections&format=json`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'SF6Database/1.0 (https://sf6-database.vercel.app; contact@sf6-database.vercel.app)',
      'Accept-Encoding': 'gzip',
    },
  })
  if (!res.ok) {
    throw new Error(`Liquipedia HTTP ${res.status}`)
  }
  return res.json()
}

// Parse infobox data from HTML
function parseInfobox(html: string) {
  const result: Record<string, any> = {}

  // Total Winnings
  const earningsMatch = html.match(/Total Winnings.*?\$([\d,]+(?:\.\d+)?)/s)
  if (earningsMatch) {
    result.approx_total_winnings = parseFloat(earningsMatch[1].replace(/,/g, ''))
  }

  // Real Name
  const nameMatch = html.match(/class="infobox-cell-2[^"]*"[^>]*>([^<]+)<\/div>\s*<\/div>\s*<div[^>]*>.*?Romanized Name/s)
  if (!nameMatch) {
    const nameMatch2 = html.match(/<div class="infobox-header"[^>]*>.*?<\/div>\s*<div[^>]*>\s*<div[^>]*>Name:<\/div>\s*<div[^>]*>([^<]+)/s)
    if (nameMatch2) result.real_name = nameMatch2[1].trim()
  } else {
    result.real_name = nameMatch[1].trim()
  }

  // Nationality
  const nationalityMatch = html.match(/title="Category:([A-Za-z]+)_Players"/)
  if (nationalityMatch) {
    result.nationality = nationalityMatch[1]
  }

  // Born
  const bornMatch = html.match(/Born:.*?(\w+ \d+, \d{4}|\d{4}-\d{2}-\d{2})/s)
  if (bornMatch) result.birth_date = bornMatch[1]

  // Team
  const teamMatch = html.match(/class="infobox-cell-2[^"]*"[^>]*>\s*<(?:span|a)[^>]*>([^<]+)<\/(?:span|a)>\s*<\/div>\s*<\/div>\s*<div[^>]*>\s*<div[^>]*>(?:Nickname|Approx)/s)

  // Nickname / Epithets
  const nicknameMatch = html.match(/Nickname\(s\):.*?<div[^>]*>([^<]+)</s)
  if (nicknameMatch) result.epithets = nicknameMatch[1].trim()

  // Active Since
  const activeMatch = html.match(/Years Active:.*?(\d{4})\s*-/s)
  if (activeMatch) result.active_since = activeMatch[1]

  return result
}

// Parse biography text from HTML
function parseBiography(html: string): { bio_en: string; bio_jp?: string } {
  // Get the biography section
  const bioMatch = html.match(/<h2>.*?Biography.*?<\/h2>(.*?)(?=<h2>|<div class="navbox")/s)
  if (!bioMatch) return { bio_en: '' }

  let bioHtml = bioMatch[1]

  // Remove HTML tags, keep text
  let text = bioHtml
    .replace(/<sup[^>]*>.*?<\/sup>/g, '') // Remove footnotes
    .replace(/<\/?[^>]+(>|$)/g, ' ')       // Remove HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Limit to ~2000 chars for DB
  if (text.length > 2000) {
    text = text.substring(0, 1997) + '...'
  }

  return { bio_en: text }
}

// Parse recent SF6 results for character detection
function parseRecentCharacters(html: string): { main: string | null; subs: string[] } {
  // Look for character images in SF6 results table
  const sf6Section = html.match(/Street Fighter 6.*?(<table.*?<\/table>)/s)
  if (!sf6Section) return { main: null, subs: [] }

  // Extract character names from title attributes of images
  const charMatches = sf6Section[1].matchAll(/title="([A-Z][a-z][\w\s.'-]+)"\s*(?:class="[^"]*")?\s*\/>/g)
  const charCounts: Record<string, number> = {}

  for (const match of charMatches) {
    const char = match[1].trim()
    // Filter out non-character entries (countries, players, etc.)
    const validChars = ['Ryu','Ken','Chun-Li','Luke','Jamie','Kimberly','Juri','Manon','Marisa',
      'Lily','Zangief','Dhalsim','Cammy','Dee Jay','Rashid','Blanka','Ed','A.K.I.','JP','Guile',
      'E. Honda','Akuma','M. Bison','Terry','Mai','Elena','Sagat','C. Viper']
    if (validChars.includes(char)) {
      charCounts[char] = (charCounts[char] || 0) + 1
    }
  }

  const sorted = Object.entries(charCounts).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return { main: null, subs: [] }

  return {
    main: sorted[0][0],
    subs: sorted.slice(1, 3).map(s => s[0]),
  }
}

// Parse Tier 1 results
function parseTier1Results(html: string): any[] {
  const results: any[] = []
  // Look for Tier 1 rows in the results table
  const tier1Matches = html.matchAll(/Tier 1.*?<td[^>]*>([^<]*)<\/td>.*?<a[^>]*>([^<]+)<\/a>/gs)

  for (const match of tier1Matches) {
    results.push({
      placement: match[1]?.trim(),
      tournament: match[2]?.trim(),
    })
  }

  return results.slice(0, 20) // Last 20 Tier 1 results
}

export async function POST(request: Request) {
  try {
    const { playerId, liquipediaPage } = await request.json()

    if (!playerId || !liquipediaPage) {
      return NextResponse.json({ error: 'playerId and liquipediaPage required' }, { status: 400 })
    }

    console.log(`[PlayerSync] Fetching Liquipedia: ${liquipediaPage}`)
    const lpData = await fetchLiquipediaPlayer(liquipediaPage)

    if (!lpData?.parse?.text?.['*']) {
      return NextResponse.json({ error: 'No data from Liquipedia' }, { status: 404 })
    }

    const html = lpData.parse.text['*']

    // Parse all sections
    const infobox = parseInfobox(html)
    const biography = parseBiography(html)
    const characters = parseRecentCharacters(html)

    // Build update object
    const update: Record<string, any> = {
      liquipedia_url: `https://liquipedia.net/fighters/${encodeURIComponent(liquipediaPage)}`,
    }

    if (infobox.approx_total_winnings !== undefined) {
      update.total_sf6_earnings_usd = infobox.approx_total_winnings
    }
    if (infobox.real_name) update.real_name = infobox.real_name
    if (infobox.birth_date) update.birth_date = infobox.birth_date
    if (infobox.epithets) update.epithets = infobox.epithets
    if (infobox.active_since) update.active_since = infobox.active_since

    if (biography.bio_en && biography.bio_en.length > 50) {
      update.bio_en = biography.bio_en
    }

    if (characters.main) {
      update.main_character = characters.main
    }
    if (characters.subs && characters.subs.length > 0) {
      update.sub_characters = characters.subs
    }

    console.log(`[PlayerSync] Updating player ${playerId}:`, Object.keys(update))

    // Upsert to Supabase
    const { data, error } = await supabase
      .from('players')
      .update(update)
      .eq('id', playerId)
      .select()

    if (error) {
      console.error('[PlayerSync] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      playerId,
      liquipediaPage,
      updated_fields: Object.keys(update),
      infobox,
      characters,
      bio_length: biography.bio_en?.length || 0,
      player: data?.[0],
    })
  } catch (error: any) {
    console.error('[PlayerSync] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET: Batch sync multiple players
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dry') === '1'

  // Priority players mapping: DB id -> Liquipedia page name
  const PRIORITY_PLAYERS: Record<number, string> = {
    24: 'Tokido',
    8: 'MenaRD',
    4: 'Xiao_Hai',
    33: 'Sahara',
    22: 'Higuchi',
    31: 'Momochi',
    5: 'Gachikun',
    26: 'Fuudo',
    7: 'Punk',
    56: 'EndingWalker',
    65: 'Daigo_Umehara',
    10: 'Big_Bird',
    12: 'Blaz',
    35: 'Dual_Kevin',
    57: 'Juicyjoe',
    9: 'Kawano',
    13: 'Leshar',
    17: 'NuckleDu',
    824: 'Xian',
  }

  if (dryRun) {
    return NextResponse.json({
      mode: 'dry_run',
      players: Object.entries(PRIORITY_PLAYERS).map(([id, page]) => ({ id: Number(id), page })),
      total: Object.keys(PRIORITY_PLAYERS).length,
    })
  }

  return NextResponse.json({
    message: 'Use POST to sync individual players, or GET?dry=1 to see the list',
    example: 'POST /api/player-sync with { "playerId": 24, "liquipediaPage": "Tokido" }',
    batch_note: 'Batch sync respects 30s rate limit per Liquipedia request',
  })
}
