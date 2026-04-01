import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

let cachedData: any = null
let lastFetch = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 min (tournament is over)
const FILE_CACHE_PATH = join(process.cwd(), '.cc12-cache.json')

function loadFileCache(): any {
  try {
    if (existsSync(FILE_CACHE_PATH)) {
      const raw = readFileSync(FILE_CACHE_PATH, 'utf-8')
      const data = JSON.parse(raw)
      console.log('[CC12] Loaded from file cache:', data.matches?.length, 'matches')
      return data
    }
  } catch (e: any) {
    console.error('[CC12] File cache read error:', e.message)
  }
  return null
}

function saveFileCache(data: any) {
  try {
    writeFileSync(FILE_CACHE_PATH, JSON.stringify(data))
    console.log('[CC12] Saved to file cache:', data.matches?.length, 'matches')
  } catch (e: any) {
    console.error('[CC12] File cache write error:', e.message)
  }
}

interface MatchResult {
  group: string
  round: string
  player1: string
  player2: string
  score: string
  winner: string
  status: 'completed' | 'live' | 'upcoming'
  maps: { p1char: string; p2char: string; score1: string; score2: string; winner: string }[]
}

// Liquipedia name → DB handle mapping
const NAME_MAP: Record<string, string> = {
  'Xiaohai': 'Xiao Hai',
  'Chris Tatarian': 'Chris T',
  'Angry Bird': 'Angry Bird',
}

function normalizeName(name: string): string {
  return NAME_MAP[name] || name
}


const ROUND_LABELS: Record<string, string> = {
  'R1M1': 'Opening Match 1',
  'R1M2': 'Opening Match 2',
  'R2M1': 'Winners Match',
  'R1M3': 'Elimination Match',
  'R2M2': 'Decider Match',
}

const GROUP_LABELS = ['A','B','C','D','E','F','G','H','I','J','K','L']

async function fetchFromLiquipedia(): Promise<{
  matches: MatchResult[]
  lastUpdated: string
  source: string
}> {
  const url = 'https://liquipedia.net/fighters/api.php?action=parse&page=Capcom_Cup/12/First_Phase&prop=wikitext&format=json'

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'SF6Database/1.0 (https://sf6-database.vercel.app; sf6database@proton.me)',
      'Accept-Encoding': 'gzip',
    },
  })

  if (!resp.ok) {
    if (resp.status === 429) {
      console.warn('[CC12] Rate limited (429), will retry...')
      throw new Error('RATE_LIMITED')
    }
    throw new Error(`Liquipedia API error: ${resp.status}`)
  }

  const data = await resp.json()
  const wikitext: string = data?.parse?.wikitext?.['*'] || ''

  const matches: MatchResult[] = []

  // Split by Group sections
  for (let gi = 0; gi < GROUP_LABELS.length; gi++) {
    const groupLabel = GROUP_LABELS[gi]
    const sectionHeader = `===Group ${groupLabel}===`
    const nextHeader = gi < GROUP_LABELS.length - 1 ? `===Group ${GROUP_LABELS[gi + 1]}===` : null

    const startIdx = wikitext.indexOf(sectionHeader)
    if (startIdx === -1) continue

    const endIdx = nextHeader ? wikitext.indexOf(nextHeader, startIdx) : wikitext.length
    const groupText = wikitext.substring(startIdx, endIdx)

    // Find each match block: R1M1, R1M2, R2M1, R1M3, R2M2
    for (const [roundKey, roundLabel] of Object.entries(ROUND_LABELS)) {
      const matchStart = groupText.indexOf(`|${roundKey}={{Match`)
      if (matchStart === -1) continue

      // Extract the match block (find matching closing braces)
      let depth = 0
      let blockEnd = matchStart
      let foundStart = false
      for (let i = matchStart; i < groupText.length; i++) {
        if (groupText[i] === '{' && groupText[i + 1] === '{') {
          depth++
          i++
          foundStart = true
        } else if (groupText[i] === '}' && groupText[i + 1] === '}') {
          depth--
          i++
          if (foundStart && depth === 0) {
            blockEnd = i + 1
            break
          }
        }
      }

      const block = groupText.substring(matchStart, blockEnd)

      // Extract opponents
      const oppRegex = /\|opponent(\d)=\{\{SoloOpponent\|([^|}]*)/g
      const opponents: Record<string, string> = {}
      let oppMatch
      while ((oppMatch = oppRegex.exec(block)) !== null) {
        opponents[oppMatch[1]] = oppMatch[2].trim()
      }

      const p1 = opponents['1'] || ''
      const p2 = opponents['2'] || ''

      // Extract map results
      const mapRegex = /\{\{Map\|.*?score1=(\d*)\|score2=(\d*)\|winner=(\d*)/g
      const maps: MatchResult['maps'] = []
      let p1Wins = 0
      let p2Wins = 0
      let mapMatch
      while ((mapMatch = mapRegex.exec(block)) !== null) {
        const s1 = mapMatch[1]
        const s2 = mapMatch[2]
        const w = mapMatch[3]
        if (s1 || s2 || w) {
          maps.push({ p1char: '', p2char: '', score1: s1, score2: s2, winner: normalizeName(w) })
          if (w === '1') p1Wins++
          else if (w === '2') p2Wins++
        }
      }

      // Determine match status and score
      let status: 'completed' | 'upcoming' = 'upcoming'
      let score = ''
      let winner = ''

      if (p1Wins > 0 || p2Wins > 0) {
        status = 'completed'
        score = `${p1Wins}-${p2Wins}`
        winner = p1Wins > p2Wins ? p1 : p2
      }

      if (p1 || p2) {
        matches.push({
          group: `Group ${groupLabel}`,
          round: roundLabel,
          player1: normalizeName(p1),
          player2: normalizeName(p2),
          score,
          winner,
          status,
          maps,
        })
      }
    }
  }

  return {
    matches,
    lastUpdated: new Date().toISOString(),
    source: 'liquipedia:Capcom_Cup/12/First_Phase',
  }
}

async function fetchPhase2(): Promise<MatchResult[]> {
  const url = 'https://liquipedia.net/fighters/api.php?action=parse&page=Capcom_Cup/12/Second_Phase&prop=wikitext&format=json'

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'SF6Database/1.0 (https://sf6-database.vercel.app; sf6database@proton.me)',
      'Accept-Encoding': 'gzip',
    },
  })

  if (!resp.ok) return []

  const data = await resp.json()
  const wikitext: string = data?.parse?.wikitext?.['*'] || ''

  const matches: MatchResult[] = []
  const groupLabels = ['A', 'B', 'C', 'D']

  for (let gi = 0; gi < groupLabels.length; gi++) {
    const groupLabel = groupLabels[gi]
    const sectionHeader = '===Group ' + groupLabel + '==='
    const nextHeader = gi < groupLabels.length - 1 ? '===Group ' + groupLabels[gi + 1] + '===' : null

    const startIdx = wikitext.indexOf(sectionHeader)
    if (startIdx === -1) continue

    const endIdx = nextHeader ? wikitext.indexOf(nextHeader, startIdx) : wikitext.length
    const groupText = wikitext.substring(startIdx, endIdx)

    // Find each match: |M1=, |M2=, |M3=
    const matchKeys = ['M1', 'M2', 'M3']
    for (let mi = 0; mi < matchKeys.length; mi++) {
      const key = matchKeys[mi]
      const matchStart = groupText.indexOf('|' + key + '={{Match')
      if (matchStart === -1) continue

      // Extract block with brace matching
      let depth = 0
      let blockEnd = matchStart
      let foundStart = false
      for (let i = matchStart; i < groupText.length; i++) {
        if (groupText[i] === '{' && i + 1 < groupText.length && groupText[i + 1] === '{') {
          depth++
          i++
          foundStart = true
        } else if (groupText[i] === '}' && i + 1 < groupText.length && groupText[i + 1] === '}') {
          depth--
          i++
          if (foundStart && depth === 0) {
            blockEnd = i + 1
            break
          }
        }
      }

      const block = groupText.substring(matchStart, blockEnd)

      // Extract opponents with score
      const oppRegex = /\|opponent(\d)=\{\{SoloOpponent\|([^|}]+)\|flag=[^|]*\|score=(\d+)\}\}/g
      const opponents: Record<string, { name: string; score: string }> = {}
      let oppMatch
      while ((oppMatch = oppRegex.exec(block)) !== null) {
        opponents[oppMatch[1]] = { name: oppMatch[2].trim(), score: oppMatch[3] }
      }

      // Fallback: try without score
      if (!opponents['1'] || !opponents['2']) {
        const oppRegex2 = /\|opponent(\d)=\{\{SoloOpponent\|([^|}]*)/g
        let oppMatch2
        while ((oppMatch2 = oppRegex2.exec(block)) !== null) {
          if (!opponents[oppMatch2[1]]) {
            opponents[oppMatch2[1]] = { name: oppMatch2[2].trim(), score: '' }
          }
        }
      }

      const p1 = opponents['1']?.name || ''
      const p2 = opponents['2']?.name || ''
      const s1 = opponents['1']?.score || ''
      const s2 = opponents['2']?.score || ''

      if (!p1 || !p2) continue

      // Extract map results for character data
      const mapRegex = /\{\{Map[^}]*?o1p1=\{\{Chars\|([^}]*)\}\}\|o2p1=\{\{Chars\|([^}]*)\}\}[^}]*?score1=(\d*)\|score2=(\d*)\|winner=(\d*)/g
      const maps: MatchResult['maps'] = []
      let mapMatch
      while ((mapMatch = mapRegex.exec(block)) !== null) {
        maps.push({
          p1char: mapMatch[1] || '',
          p2char: mapMatch[2] || '',
          score1: mapMatch[3] || '',
          score2: mapMatch[4] || '',
          winner: normalizeName(mapMatch[5] || ''),
        })
      }

      let status: 'completed' | 'upcoming' = 'upcoming'
      let score = ''
      let winner = ''

      if (s1 && s2) {
        status = 'completed'
        score = s1 + '-' + s2
        winner = parseInt(s1) > parseInt(s2) ? p1 : p2
      }

      matches.push({
        group: 'P2 Group ' + groupLabel,
        round: 'Round Robin ' + (mi + 1),
        player1: normalizeName(p1),
        player2: normalizeName(p2),
        score,
        winner,
        status,
        maps,
      })
    }
  }

  return matches
}

async function fetchPhase3(): Promise<MatchResult[]> {
  const url = 'https://liquipedia.net/fighters/api.php?action=parse&page=Capcom_Cup/12/Third_Phase&prop=wikitext&format=json'

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'SF6Database/1.0 (https://sf6-database.vercel.app; sf6database@proton.me)',
      'Accept-Encoding': 'gzip',
    },
  })

  if (!resp.ok) return []

  const data = await resp.json()
  const wikitext: string = data?.parse?.wikitext?.['*'] || ''

  const matches: MatchResult[] = []

  const roundLabels: Record<string, string> = {
    'R1M1': 'Round of 16 - Match 1', 'R1M2': 'Round of 16 - Match 2',
    'R1M3': 'Round of 16 - Match 3', 'R1M4': 'Round of 16 - Match 4',
    'R1M5': 'Round of 16 - Match 5', 'R1M6': 'Round of 16 - Match 6',
    'R1M7': 'Round of 16 - Match 7', 'R1M8': 'Round of 16 - Match 8',
    'R2M1': 'Quarter Final 1', 'R2M2': 'Quarter Final 2',
    'R2M3': 'Quarter Final 3', 'R2M4': 'Quarter Final 4',
    'R3M1': 'Semi Final 1', 'R3M2': 'Semi Final 2',
    'R4M1': 'Grand Final',
  }

  for (const [roundKey, roundLabel] of Object.entries(roundLabels)) {
    const matchStart = wikitext.indexOf('|' + roundKey + '={{Match')
    if (matchStart === -1) continue

    let depth = 0
    let blockEnd = matchStart
    let foundStart = false
    for (let i = matchStart; i < wikitext.length; i++) {
      if (wikitext[i] === '{' && i + 1 < wikitext.length && wikitext[i + 1] === '{') {
        depth++
        i++
        foundStart = true
      } else if (wikitext[i] === '}' && i + 1 < wikitext.length && wikitext[i + 1] === '}') {
        depth--
        i++
        if (foundStart && depth === 0) {
          blockEnd = i + 1
          break
        }
      }
    }

    const block = wikitext.substring(matchStart, blockEnd)

    // Try with score first (Phase 3 uses |score=N in opponent)
    const oppWithScore = /\|opponent(\d)=\{\{SoloOpponent\|([^|}]+)\|flag=[^|]*\|score=(\d+)\}\}/g
    const opponents: Record<string, { name: string; score: string }> = {}
    let oppMatch
    while ((oppMatch = oppWithScore.exec(block)) !== null) {
      opponents[oppMatch[1]] = { name: oppMatch[2].trim(), score: oppMatch[3] }
    }

    // Fallback without score
    if (!opponents['1'] || !opponents['2']) {
      const oppNoScore = /\|opponent(\d)=\{\{SoloOpponent\|([^|}]+)/g
      let oppMatch2
      while ((oppMatch2 = oppNoScore.exec(block)) !== null) {
        if (!opponents[oppMatch2[1]]) {
          opponents[oppMatch2[1]] = { name: oppMatch2[2].trim(), score: '' }
        }
      }
    }

    const p1 = opponents['1']?.name || ''
    const p2 = opponents['2']?.name || ''
    const s1 = opponents['1']?.score || ''
    const s2 = opponents['2']?.score || ''

    // Keep matches even if players are TBD for bracket display

    // Map results
    const mapRegex = /score1=(\d+)\|score2=(\d+)\|winner=(\d+)/g
    const maps: MatchResult['maps'] = []
    let p1Wins = 0, p2Wins = 0
    let mapMatch
    while ((mapMatch = mapRegex.exec(block)) !== null) {
      if (mapMatch[1] && mapMatch[2] && mapMatch[3]) {
        maps.push({ p1char: '', p2char: '', score1: mapMatch[1], score2: mapMatch[2], winner: normalizeName(mapMatch[3]) })
        if (mapMatch[3] === '1') p1Wins++
        else if (mapMatch[3] === '2') p2Wins++
      }
    }

    let status: 'completed' | 'upcoming' = 'upcoming'
    let score = ''
    let winner = ''

    if (s1 && s2) {
      status = 'completed'
      score = s1 + '-' + s2
      winner = parseInt(s1) > parseInt(s2) ? p1 : p2
    } else if (p1Wins > 0 || p2Wins > 0) {
      status = 'completed'
      score = p1Wins + '-' + p2Wins
      winner = p1Wins > p2Wins ? p1 : p2
    }

    matches.push({
      group: 'P3 Top 16',
      round: roundLabel,
      player1: normalizeName(p1 || 'TBD'),
      player2: normalizeName(p2 || 'TBD'),
      score,
      winner,
      status,
      maps,
    })
  }

  return matches
}

export async function GET(request: Request) {
  const now = Date.now()
  const { searchParams } = new URL(request.url)
  const forceFresh = searchParams.get('fresh') === '1'

  // 1. Memory cache (fastest)
  if (!forceFresh && cachedData && (now - lastFetch) < CACHE_TTL) {
    return NextResponse.json({ ...cachedData, cached: true, source: 'memory', cacheAge: Math.floor((now - lastFetch) / 1000) })
  }

  // 2. File cache (survives server restart)
  if (!forceFresh) {
    const fileData = loadFileCache()
    if (fileData && fileData.matches?.length > 0) {
      cachedData = fileData
      lastFetch = now
      return NextResponse.json({ ...fileData, cached: true, source: 'file-cache' })
    }
  }

  // 3. Fetch from Liquipedia (only if no cache available or forced fresh)
  try {
    const [phase1Data, phase2Matches, phase3Matches] = await Promise.all([
      fetchFromLiquipedia(),
      fetchPhase2(),
      fetchPhase3(),
    ])
    const data = {
      matches: [...phase1Data.matches, ...phase2Matches, ...phase3Matches],
      lastUpdated: phase1Data.lastUpdated,
      source: 'liquipedia',
    }
    cachedData = data
    lastFetch = now
    saveFileCache(data)

    // Log completed matches to Supabase
    const completed = data.matches.filter((m: MatchResult) => m.status === 'completed')
    if (completed.length > 0) {
      try {
        for (const m of completed) {
          await supabaseAdmin
            .from('cc12_match_log')
            .upsert({
              group_name: m.group,
              round: m.round,
              player1: normalizeName(m.player1),
              player2: normalizeName(m.player2),
              score: m.score,
              winner: normalizeName(m.winner),
              status: m.status,
              maps: m.maps,
              fetched_at: new Date().toISOString(),
            }, {
              onConflict: 'group_name,round,player1,player2',
            })
        }
        console.log('[CC12] Logged ' + completed.length + ' completed matches to Supabase')
      } catch (dbError: any) {
        console.error('[CC12] DB log error:', dbError.message)
      }
    }

    return NextResponse.json({ ...data, cached: false, source: 'liquipedia', logged: completed.length })
  } catch (error: any) {
    console.error('[CC12] Fetch error:', error.message)

    // Fallback: memory cache
    if (cachedData) {
      return NextResponse.json({ ...cachedData, cached: true, stale: true, source: 'memory-stale' })
    }

    // Fallback: file cache (last resort)
    const fileData = loadFileCache()
    if (fileData && fileData.matches?.length > 0) {
      cachedData = fileData
      lastFetch = now
      return NextResponse.json({ ...fileData, cached: true, stale: true, source: 'file-cache-stale' })
    }

    return NextResponse.json({ error: 'Failed to fetch', message: error.message, matches: [] }, { status: 500 })
  }
}
