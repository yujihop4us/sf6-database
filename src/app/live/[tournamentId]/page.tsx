'use client'

import { useState, useEffect, useCallback } from 'react'
import { use } from 'react'
import StreamEmbed from '@/components/StreamEmbed'
import PlayerCard from '@/components/PlayerCard'
import MatchHistory from '@/components/MatchHistory'
import PollWidget from '@/components/PollWidget'
import BracketUpNext from '@/components/BracketUpNext'
import ChatEmbed from '@/components/ChatEmbed'
import TournamentDashboard from '@/components/TournamentDashboard'

interface Player {
  id: number
  handle: string
  country_code?: string
  main_character?: string
  team?: string
  total_sf6_earnings_usd?: number
  profile_image_url?: string
}

interface SetData {
  id: number
  tournament_id: number
  round_text: string
  phase_name: string
  winner_id: number
  loser_id: number
  winner_score: number
  loser_score: number
  display_score: string
  tournament_name: string
  tournament_date: string
}

interface H2HData {
  player1: Player
  player2: Player
  summary: { player1_wins: number; player2_wins: number; total_sets: number }
  sets: SetData[]
}

export default function LivePage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params)

  const [player1, setPlayer1] = useState<Player | null>(null)
  const [player2, setPlayer2] = useState<Player | null>(null)
  const [h2hData, setH2hData] = useState<H2HData | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Player[]>([])
  const [searchSide, setSearchSide] = useState<'p1' | 'p2' | null>(null)
  const [showSearch, setShowSearch] = useState(false)

  const [streamWidth, setStreamWidth] = useState(800)
  const [streamHeight, setStreamHeight] = useState(450)
  const [isStreamLive, setIsStreamLive] = useState(false)
  const [streamInfo, setStreamInfo] = useState<{ title: string; viewerCount: number; gameName: string }>({ title: '', viewerCount: 0, gameName: '' })
  const [activeMainTab, setActiveMainTab] = useState<'live' | 'groups' | 'results'>('live')


  useEffect(() => {
    const calc = () => {
      const maxH = window.innerHeight * 0.55
      const maxW = window.innerWidth * 0.60
      const wFromH = maxH * 16 / 9
      if (wFromH <= maxW) {
        setStreamWidth(Math.floor(wFromH))
        setStreamHeight(Math.floor(maxH))
      } else {
        setStreamWidth(Math.floor(maxW))
        setStreamHeight(Math.floor(maxW * 9 / 16))
      }
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  // Tournament config — per tournamentId
  const tournamentConfig: Record<string, {
    name: string
    streamPlatform: 'twitch' | 'youtube' | null
    streamChannel: string | null
    startggEventId?: number
    startDate?: string
    phases: any[]
    results: any[]
  }> = {
    '9': {
      name: 'Capcom Cup 12',
      streamPlatform: null,  // PPV — no stream
      startDate: '2026-03-11',
      endDate: '2026-03-15',  // Stop polling after this date
      streamChannel: null,
      phases: [
        {
          name: 'Phase 1',
          format: 'GSL (Double Elim) — FT3',
          groups: [
            { name: 'Group A', players: [{ name: 'Xiao Hai', country: '🇨🇳' }, { name: 'Blaz', country: '🇨🇱' }, { name: 'HotDog29', country: '🇭🇰' }, { name: 'Juicyjoe', country: '🇸🇪' }], matches: [
              { player1: 'Xiao Hai', player2: 'Juicyjoe', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'Blaz', player2: 'HotDog29', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
            ]},
            { name: 'Group B', players: [{ name: 'Kawano', country: '🇯🇵' }, { name: 'Fuudo', country: '🇯🇵' }, { name: 'EndingWalker', country: '🇬🇧' }, { name: 'Bravery', country: '🇸🇬' }], matches: [
              { player1: 'Kawano', player2: 'EndingWalker', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'Fuudo', player2: 'Bravery', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
            ]},
            { name: 'Group C', players: [{ name: 'Big Bird', country: '🇦🇪' }, { name: 'DakCorgi', country: '🇰🇷' }, { name: 'YHC-Mochi', country: '🇯🇵' }, { name: 'MenaRD', country: '🇩🇴' }], matches: [
              { player1: 'Big Bird', player2: 'YHC-Mochi', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'DakCorgi', player2: 'MenaRD', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
            ]},
            { name: 'Group D', players: [{ name: 'NL', country: '🇰🇷' }, { name: 'Sahara', country: '🇯🇵' }, { name: 'shaka22', country: '🇦🇷' }, { name: 'JabhiM', country: '🇿🇦' }], matches: [
              { player1: 'Sahara', player2: 'shaka22', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'NL', player2: 'JabhiM', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
            ]},
            { name: 'Group E', players: [{ name: 'YONANGEL', country: '🇩🇪' }, { name: 'Dual Kevin', country: '🇺🇸' }, { name: 'Caba', country: '🇩🇴' }, { name: 'pugera', country: '🇯🇵' }], matches: [
              { player1: 'YONANGEL', player2: 'Caba', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'Dual Kevin', player2: 'pugera', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
            ]},
            { name: 'Group F', players: [{ name: 'kincho', country: '🇯🇵' }, { name: 'Momochi', country: '🇯🇵' }, { name: 'Angry Bird', country: '🇦🇪' }, { name: 'Tashi', country: '🇻🇪' }], matches: [
              { player1: 'kincho', player2: 'Angry Bird', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'Momochi', player2: 'Tashi', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
            ]},
            { name: 'Group G', players: [{ name: 'gachikun', country: '🇯🇵' }, { name: 'Kobayan', country: '🇯🇵' }, { name: 'Vxbao', country: '🇨🇳' }, { name: 'NotPedro', country: '🇧🇷' }], matches: [
              { player1: 'gachikun', player2: 'Vxbao', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'Kobayan', player2: 'NotPedro', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
            ]},
            { name: 'Group H', players: [{ name: 'Leshar', country: '🇰🇷' }, { name: 'Ryukichi', country: '🇯🇵' }, { name: 'LUGABO', country: '🇲🇽' }, { name: 'Travis Styles', country: '🇦🇺' }], matches: [
              { player1: 'Leshar', player2: 'LUGABO', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'Ryukichi', player2: 'Travis Styles', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
            ]},
            { name: 'Group I', players: [{ name: 'Higuchi', country: '🇯🇵' }, { name: 'ARMAKOF', country: '🇵🇦' }, { name: 'Tokido', country: '🇯🇵' }, { name: 'Xerna', country: '🇳🇱' }], matches: [
              { player1: 'Higuchi', player2: 'Tokido', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'ARMAKOF', player2: 'Xerna', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
            ]},
            { name: 'Group J', players: [{ name: 'Rainpro', country: '🇭🇰' }, { name: 'Chris T', country: '🇺🇸' }, { name: 'Lexx', country: '🇺🇸' }, { name: 'Micky', country: '🇭🇰' }], matches: [
              { player1: 'Rainpro', player2: 'Lexx', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'Chris T', player2: 'Micky', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
            ]},
            { name: 'Group K', players: [{ name: 'Kilzyou', country: '🇫🇷' }, { name: 'NuckleDu', country: '🇺🇸' }, { name: 'Hinao', country: '🇯🇵' }, { name: 'lllRaihanlll', country: '🇧🇩' }], matches: [
              { player1: 'Kilzyou', player2: 'Hinao', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'NuckleDu', player2: 'lllRaihanlll', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
            ]},
            { name: 'Group L', players: [{ name: 'JAK', country: '🇺🇸' }, { name: 'Itabashi Zangief', country: '🇯🇵' }, { name: 'Deiver', country: '🇨🇱' }, { name: 'Jiewa', country: '🇨🇳' }], matches: [
              { player1: 'JAK', player2: 'Deiver', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'Itabashi Zangief', player2: 'Jiewa', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
              { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
            ]},
          ],
        },
        {
          name: 'Phase 2',
          format: 'Round Robin — FT3',
          groups: [
            { name: 'Group 1', players: [{ name: 'TBD' }, { name: 'TBD' }, { name: 'TBD' }], matches: [] },
            { name: 'Group 2', players: [{ name: 'TBD' }, { name: 'TBD' }, { name: 'TBD' }], matches: [] },
            { name: 'Group 3', players: [{ name: 'TBD' }, { name: 'TBD' }, { name: 'TBD' }], matches: [] },
            { name: 'Group 4', players: [{ name: 'TBD' }, { name: 'TBD' }, { name: 'TBD' }], matches: [] },
          ],
        },
        {
          name: 'Phase 3',
          format: 'Single Elim — FT5',
          groups: [
            { name: 'Top 16', players: Array(16).fill({ name: 'TBD' }), matches: [] },
          ],
        },
      ],
      results: [],
    },
    // DreamHack Birmingham 2026 - Road to EWC
    'dreamhack-birmingham': {
      name: 'DreamHack Birmingham 2026',
      streamPlatform: 'twitch' as const,
      streamChannel: 'dreamhackfighters',
      startDate: '2026-03-27',
      endDate: '2026-03-29',
      startggEventId: 1554815,
      phases: [
        {
          name: 'Pools',
          format: 'Double Elimination Pools',
          groups: [
            { name: 'Pool 1', players: Array(32).fill({ name: 'TBD' }), matches: [] },
          ],
        },
        {
          name: 'Top 32',
          format: 'Double Elimination',
          groups: [
            { name: 'Main Bracket', players: Array(32).fill({ name: 'TBD' }), matches: [] },
          ],
        },
      ],
      results: [],
    },
  }

  const config = tournamentConfig[tournamentId] || {
    name: 'Tournament',
    streamPlatform: 'twitch' as const,
    streamChannel: 'capcomfighters',
    endDate: '',
    phases: [],
    results: [],
  }

  const hasStream = !!config.streamPlatform && !!config.streamChannel
  const streamPlatform = config.streamPlatform
  const streamChannel = config.streamChannel
  // Poll Twitch stream status
  useEffect(() => {
    if (!config.streamChannel || config.streamPlatform !== 'twitch') return

    const checkStream = async () => {
      try {
        const res = await fetch('/api/twitch?channel=' + config.streamChannel)
        const data = await res.json()
        setIsStreamLive(data.isLive || false)
        if (data.isLive) {
          setStreamInfo({ title: data.title || '', viewerCount: data.viewerCount || 0, gameName: data.gameName || '' })
        }
      } catch (e) {
        console.error('[Twitch] Status check error:', e)
      }
    }

    checkStream()
    const interval = setInterval(checkStream, 30000) // Check every 30s
    return () => clearInterval(interval)
  }, [config.streamChannel, config.streamPlatform])

  const fetchH2H = useCallback(async (p1Id: number, p2Id: number) => {
    const res = await fetch(`/api/head-to-head?p1=${p1Id}&p2=${p2Id}`)
    const data = await res.json()
    setH2hData(data)
  }, [])

  useEffect(() => {
    if (player1 && player2) {
      fetchH2H(player1.id, player2.id)
    } else {
      setH2hData(null)
    }
  }, [player1, player2, fetchH2H])

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setSearchResults(data.players || [])
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  // Live results polling (CC12 uses Liquipedia, others use start.gg)
  const [cc12Matches, setCc12Matches] = useState<any[]>([])
  const [cc12LastUpdated, setCc12LastUpdated] = useState('')
  const [startggMatches, setStartggMatches] = useState<any[]>([])
  const [startggEvent, setStartggEvent] = useState<any>(null)

  useEffect(() => {
    if (hasStream) return // Only poll when in dashboard mode

    const tournamentEnded = config.endDate && new Date() > new Date(config.endDate)

    const fetchResults = async () => {
      try {
        const res = await fetch('/api/cc12/results?fresh=1')
        const data = await res.json()
        if (data.matches) {
          setCc12Matches(data.matches)
          setCc12LastUpdated(data.lastUpdated || '')
          console.log(`[CC12] Fetched ${data.matches.length} matches, ${data.matches.filter((m: any) => m.status === 'completed').length} completed`)
        }
      } catch (e) {
        console.error('[CC12] Poll error:', e)
      }
    }

    fetchResults() // Initial fetch
    const interval = setInterval(fetchResults, 60 * 1000) // Every 1 min during tournament
    return () => clearInterval(interval)
  }, [hasStream])

  // Merge API results into dashboard config — all phases

  // Start.gg polling for DreamHack and other start.gg tournaments
  useEffect(() => {
    if (!config.startggEventId) return
    if (hasStream && !searchQuery) return // Only poll when in dashboard mode or no stream

    const tournamentEnded = config.endDate && new Date() > new Date(config.endDate + 'T23:59:59')

    const fetchStartGG = async () => {
      try {
        const res = await fetch('/api/startgg?eventId=' + config.startggEventId + '&fresh=1')
        const data = await res.json()
        if (data.matches) {
          setStartggMatches(data.matches)
        }
        if (data.event) {
          setStartggEvent(data.event)
        }
        if (data.lastUpdated) {
          setCc12LastUpdated(data.lastUpdated)
        }
      } catch (err) {
        console.error('[start.gg] Fetch error:', err)
      }
    }

    fetchStartGG()

    if (!tournamentEnded) {
      const interval = setInterval(fetchStartGG, 30000) // Poll every 30s
      return () => clearInterval(interval)
    }
  }, [config.startggEventId, hasStream, searchQuery])

    const mergedPhases = config.phases.map((phase: any) => {
    // For start.gg tournaments, build phases from startggMatches
    if (config.startggEventId && startggMatches.length > 0) {
      // Group matches by phase name from start.gg
      const phaseMatches = startggMatches.filter((m: any) => {
        const group = m.group || ''
        // Match phase name from start.gg (e.g., "Pools - A1", "Top 32 - 1")
        return group.startsWith(phase.name) || group.includes(phase.name)
      })

      if (phaseMatches.length === 0) {
        // Try matching all matches if only one phase
        if (config.phases.length === 1) {
          const allMatches = startggMatches
          if (allMatches.length > 0) {
            const groups: Record<string, any[]> = {}
            allMatches.forEach((m: any) => {
              const gName = m.group || 'Main Bracket'
              if (!groups[gName]) groups[gName] = []
              groups[gName].push(m)
            })
            const newGroups = Object.entries(groups).map(([gName, matches]: [string, any[]]) => {
              const players = [...new Set(matches.flatMap((m: any) => [m.player1, m.player2]).filter((p: string) => p && p !== 'TBD'))]
              return {
                name: gName,
                players: players.map((p: string) => ({ name: p })),
                matches: matches.map((m: any) => ({
                  player1: m.player1, player2: m.player2, score: m.score,
                  winner: m.winner, round: m.round, date: '', status: m.status,
                })),
              }
            })
            return { ...phase, groups: newGroups }
          }
        }
        return phase
      }

      // Build groups from start.gg phase matches
      const groups: Record<string, any[]> = {}
      phaseMatches.forEach((m: any) => {
        const gName = m.group || phase.name
        if (!groups[gName]) groups[gName] = []
        groups[gName].push(m)
      })

      const newGroups = Object.entries(groups).map(([gName, matches]: [string, any[]]) => {
        const players = [...new Set(matches.flatMap((m: any) => [m.player1, m.player2]).filter((p: string) => p && p !== 'TBD'))]
        return {
          name: gName,
          players: players.map((p: string) => ({ name: p })),
          matches: matches.map((m: any) => ({
            player1: m.player1, player2: m.player2, score: m.score,
            winner: m.winner, round: m.round, date: '', status: m.status,
          })),
        }
      })

      return { ...phase, groups: newGroups }
    }

    // CC12: Determine which API matches belong to this phase
    let phasePrefix = ''
    if (phase.name === 'Phase 1') phasePrefix = 'Group '
    else if (phase.name === 'Phase 2') phasePrefix = 'P2 Group '
    else if (phase.name === 'Phase 3') phasePrefix = 'P3 '

    const phaseMatches = cc12Matches.filter((m: any) => {
      if (phase.name === 'Phase 1') return m.group.startsWith('Group ') && !m.group.startsWith('P2')
      if (phase.name === 'Phase 2') return m.group.startsWith('P2 ')
      if (phase.name === 'Phase 3') return m.group.startsWith('P3 ')
      return false
    })

    if (phaseMatches.length === 0) return phase

    if (phase.name === 'Phase 2') {
      // Rebuild Phase 2 groups from API data
      const p2Groups: Record<string, any[]> = {}
      phaseMatches.forEach((m: any) => {
        const gName = m.group.replace('P2 ', '')
        if (!p2Groups[gName]) p2Groups[gName] = []
        p2Groups[gName].push(m)
      })

      const newGroups = Object.entries(p2Groups).map(([gName, matches]: [string, any[]]) => {
        const players = [...new Set(matches.flatMap((m: any) => [m.player1, m.player2]))]
        return {
          name: gName,
          players: players.map((p: string) => ({ name: p })),
          matches: matches.map((m: any) => ({
            player1: m.player1,
            player2: m.player2,
            score: m.score,
            winner: m.winner,
            round: m.round,
            date: '',
            status: m.status,
          })),
        }
      })

      return { ...phase, groups: newGroups }
    }

    if (phase.name === 'Phase 3') {
      // Rebuild Phase 3 bracket from API data
      const players = [...new Set(phaseMatches.flatMap((m: any) => [m.player1, m.player2]).filter(Boolean))]
      return {
        ...phase,
        groups: [{
          name: 'Top 16 Bracket',
          players: players.map((p: string) => ({ name: p })),
          matches: phaseMatches.map((m: any) => ({
            player1: m.player1,
            player2: m.player2,
            score: m.score,
            winner: m.winner,
            round: m.round,
            date: '',
            status: m.status,
          })),
        }],
      }
    }

    // Phase 1: use API data directly when available
    return {
      ...phase,
      groups: phase.groups.map((group: any) => {
        const groupMatches = phaseMatches.filter((m: any) => m.group === group.name)
        if (groupMatches.length === 0) return group

        // Replace matches entirely with API data when available
        const apiMatchList = groupMatches.map((am: any) => ({
          player1: am.player1,
          player2: am.player2,
          round: am.round,
          date: am.date || '',
          score: am.score || '',
          winner: am.winner || '',
          status: am.status,
          maps: am.maps || [],
        }))

        return { ...group, matches: apiMatchList.length > 0 ? apiMatchList : group.matches }
      }),
    }
  })

  const selectPlayer = (player: Player) => {
    if (searchSide === 'p1') setPlayer1(player)
    else setPlayer2(player)
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
    setSearchSide(null)
  }

  const openSearch = (side: 'p1' | 'p2') => {
    setSearchSide(side)
    setShowSearch(true)
    setSearchQuery('')
  }

  // Build upNext from merged phases — show upcoming and live matches
  const upNextMatches = (() => {
    const allMatches: any[] = []
    mergedPhases.forEach((phase: any) => {
      (phase.groups || []).forEach((group: any) => {
        (group.matches || []).forEach((m: any) => {
          if (m.status === 'live' || m.status === 'upcoming') {
            allMatches.push({
              round_text: group.name + ' - ' + (m.round || ''),
              player1_handle: m.player1 || 'TBD',
              player2_handle: m.player2 || 'TBD',
              status: m.status as 'live' | 'upcoming',
            })
          }
        })
      })
    })
    // Live matches first, then upcoming, max 8
    allMatches.sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1
      if (a.status !== 'live' && b.status === 'live') return 1
      return 0
    })
    return allMatches.slice(0, 8)
  })()

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0a0f] text-white flex flex-col">
      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center pt-20">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-4 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-400">
                Select {searchSide === 'p1' ? 'Player 1' : 'Player 2'}
              </h3>
              <button
                onClick={() => setShowSearch(false)}
                className="text-zinc-500 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              autoFocus
              placeholder="Search player..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 mb-3"
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {searchResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectPlayer(p)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
                    {p.handle.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{p.handle}</p>
                    <p className="text-xs text-zinc-500">
                      {p.country_code && `${p.country_code} • `}{p.team || ''}
                    </p>
                  </div>
                </button>
              ))}
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="text-center text-zinc-500 text-sm py-4">No players found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 bg-zinc-900/50 border-b border-zinc-800">
        <h1 className="text-base font-bold tracking-tight">
          SF6 <span className="text-yellow-400">Database</span>
        </h1>
        <div className="flex items-center gap-3">
          {(() => {
            const now = new Date()
            const start = config.startDate ? new Date(config.startDate + 'T00:00:00') : null
            const end = config.endDate ? new Date(config.endDate + 'T23:59:59') : null
            const isDuringTournament = start && end && now >= start && now <= end

            if (isStreamLive) {
              return (
                <a
                  href={'/live/' + tournamentId}
                  className="flex items-center gap-2 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] text-red-400 uppercase tracking-wide font-bold">LIVE</span>
                  <span className="text-[10px] text-zinc-300 font-medium">{config.name}</span>
                  {streamInfo.viewerCount > 0 && (
                    <span className="text-[10px] text-zinc-500">{streamInfo.viewerCount.toLocaleString()} viewers</span>
                  )}
                </a>
              )
            }

            if (isDuringTournament) {
              return (
                <a
                  href={'/live/' + tournamentId}
                  className="flex items-center gap-2 px-2 py-0.5 rounded bg-zinc-800/50 border border-zinc-700/30 hover:bg-zinc-700/30 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium">{config.name}</span>
                </a>
              )
            }

            return null
          })()}
        </div>
      </header>

      {/* Top Row: P1 | Stream | P2 */}
      <div className="flex-shrink-0 flex items-stretch" style={{ height: `${streamHeight}px` }}>
        {/* P1 Sidebar */}
        <div className={`hidden lg:flex h-full flex-col border-r border-zinc-800 bg-zinc-950/50 overflow-y-auto min-w-0 ${hasStream ? 'flex-1' : 'w-44 flex-shrink-0'}`}>
          <button
            onClick={() => openSearch('p1')}
            className="m-2 px-2 py-1 text-[11px] bg-blue-500/20 border border-blue-500/30 rounded text-blue-400 hover:bg-blue-500/30 transition-colors flex-shrink-0"
          >
            {player1 ? 'Change P1' : 'Select P1'}
          </button>
          <PlayerCard player={player1} side="p1" />
        </div>

        {/* Center: Tabbed — Live / Groups / Results */}
        <div className={hasStream ? "flex-shrink-0 h-full flex flex-col" : "flex-1 h-full min-w-0 flex flex-col"} style={hasStream ? { width: streamWidth + 'px' } : undefined}>
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-2 py-1 bg-zinc-900/60 border-b border-zinc-800 flex-shrink-0">
            {hasStream && (
              <button
                onClick={() => setActiveMainTab('live')}
                className={'px-3 py-1 text-xs rounded transition-colors ' + (
                  activeMainTab === 'live'
                    ? 'bg-red-500/20 text-red-400 font-bold'
                    : 'text-zinc-500 hover:text-white'
                )}
              >
                Live
              </button>
            )}
            <button
              onClick={() => setActiveMainTab('groups')}
              className={'px-3 py-1 text-xs rounded transition-colors ' + (
                activeMainTab === 'groups'
                  ? 'bg-yellow-400/20 text-yellow-400 font-bold'
                  : 'text-zinc-500 hover:text-white'
              )}
            >
              Groups
            </button>
            <button
              onClick={() => setActiveMainTab('results')}
              className={'px-3 py-1 text-xs rounded transition-colors ' + (
                activeMainTab === 'results'
                  ? 'bg-yellow-400/20 text-yellow-400 font-bold'
                  : 'text-zinc-500 hover:text-white'
              )}
            >
              Results
            </button>
          </div>
          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeMainTab === 'live' && hasStream && (
              <iframe
                src={
                  streamPlatform === 'twitch'
                    ? 'https://player.twitch.tv/?channel=' + streamChannel + '&parent=sf6-database.vercel.app&parent=localhost'
                    : 'https://www.youtube.com/embed/' + streamChannel + '?autoplay=1'
                }
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; encrypted-media"
              />
            )}
            {(activeMainTab === 'groups' || (!hasStream && activeMainTab === 'live')) && (
              <TournamentDashboard
                tournamentName={config.name}
                phases={mergedPhases}
                results={config.results}
                lastUpdated={cc12LastUpdated || ''}
                onMatchClick={(p1Name: string, p2Name: string) => {
                    const findAndSet = async (name: string, side: 'p1' | 'p2') => {
                      try {
                        const res = await fetch('/api/players/search?q=' + encodeURIComponent(name))
                        const data = await res.json()
                        const found = (data.players || []).find((p: Player) =>
                          p.handle.toLowerCase() === name.toLowerCase()
                        ) || (data.players || [])[0]
                        if (found) {
                          if (side === 'p1') setPlayer1(found)
                          else setPlayer2(found)
                        }
                      } catch (e) { console.error(e) }
                    }
                    findAndSet(p1Name, 'p1')
                    findAndSet(p2Name, 'p2')
                  }}
              />
            )}
            {activeMainTab === 'results' && (
              <TournamentDashboard
                tournamentName={config.name}
                phases={mergedPhases}
                results={config.results}
                lastUpdated={cc12LastUpdated || ''}
                defaultTab="results"
                onMatchClick={(p1Name: string, p2Name: string) => {
                    const findAndSet = async (name: string, side: 'p1' | 'p2') => {
                      try {
                        const res = await fetch('/api/players/search?q=' + encodeURIComponent(name))
                        const data = await res.json()
                        const found = (data.players || []).find((p: Player) =>
                          p.handle.toLowerCase() === name.toLowerCase()
                        ) || (data.players || [])[0]
                        if (found) {
                          if (side === 'p1') setPlayer1(found)
                          else setPlayer2(found)
                        }
                      } catch (e) { console.error(e) }
                    }
                    findAndSet(p1Name, 'p1')
                    findAndSet(p2Name, 'p2')
                  }}
              />
            )}
          </div>
        </div>

        {/* P2 Sidebar */}
        <div className={`hidden lg:flex h-full flex-col border-l border-zinc-800 bg-zinc-950/50 overflow-y-auto min-w-0 ${hasStream ? 'flex-1' : 'w-44 flex-shrink-0'}`}>
          <button
            onClick={() => openSearch('p2')}
            className="m-2 px-2 py-1 text-[11px] bg-orange-500/20 border border-orange-500/30 rounded text-orange-400 hover:bg-orange-500/30 transition-colors flex-shrink-0"
          >
            {player2 ? 'Change P2' : 'Select P2'}
          </button>
          <PlayerCard player={player2} side="p2" />
        </div>
      </div>

      {/* Mobile player select */}
      <div className="lg:hidden flex-shrink-0 flex gap-2 px-2 py-1.5 bg-zinc-950">
        <button
          onClick={() => openSearch('p1')}
          className="flex-1 py-1.5 text-xs bg-blue-500/20 border border-blue-500/30 rounded text-blue-400"
        >
          {player1?.handle || 'Select P1'}
        </button>
        <button
          onClick={() => openSearch('p2')}
          className="flex-1 py-1.5 text-xs bg-orange-500/20 border border-orange-500/30 rounded text-orange-400"
        >
          {player2?.handle || 'Select P2'}
        </button>
      </div>

      {/* Middle Row: H2H — full width */}
      <div className="flex-shrink-0 px-2 py-1.5">
        <MatchHistory
          player1Id={player1?.id || null}
          player2Id={player2?.id || null}
          player1Handle={player1?.handle || ''}
          player2Handle={player2?.handle || ''}
          summary={h2hData?.summary || null}
          sets={h2hData?.sets || []}
        />
      </div>

      {/* Bottom Row — conditional on stream mode */}
      {hasStream ? (
        <div className="flex-1 flex min-h-0 px-2 pb-1 gap-2">
          {/* Left: Chat */}
          <div className="basis-1/2 min-w-0 min-h-0">
            <ChatEmbed platform={streamPlatform} channel={streamChannel} />
          </div>
          {/* Right: Tabbed panel — UpNext / Groups / Results */}
          <div className="basis-1/2 min-w-0 min-h-0 flex flex-col gap-1">
            <div className="flex-shrink-0">
              <PollWidget
                player1Handle={player1?.handle || ''}
                player2Handle={player2?.handle || ''}
                player1Id={player1?.id || null}
                player2Id={player2?.id || null}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <BracketUpNext matches={upNextMatches} tournamentName={config.name} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 px-2 pb-1">
          <PollWidget
            player1Handle={player1?.handle || ''}
            player2Handle={player2?.handle || ''}
            player1Id={player1?.id || null}
            player2Id={player2?.id || null}
          />
        </div>
      )}
    </div>
  )
}
