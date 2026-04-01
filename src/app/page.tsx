'use client'

import { useState, useEffect, useCallback } from 'react'
import { use } from 'react'
import StreamEmbed from '@/components/StreamEmbed'
import PlayerCard from '@/components/PlayerCard'
import MatchHistory from '@/components/MatchHistory'
import PollWidget from '@/components/PollWidget'
import BracketUpNext from '@/components/BracketUpNext'
import ChatEmbed from '@/components/ChatEmbed'

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

  useEffect(() => {
    const calc = () => {
      const h = window.innerHeight * 0.5
      const w16by9 = Math.floor(h * 16 / 9)
      const maxW = Math.floor(window.innerWidth * 0.6)
      setStreamWidth(Math.min(w16by9, maxW))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  const streamPlatform: 'twitch' | 'youtube' = 'twitch'
  const streamChannel = 'capcomfighters'

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

  const upNextMatches = [
    { round_text: 'Group A', player1_handle: 'Xiaohai', player2_handle: 'Juicyjoe', status: 'upcoming' as const },
    { round_text: 'Group A', player1_handle: 'Blaz', player2_handle: 'HotDog29', status: 'upcoming' as const },
    { round_text: 'Group B', player1_handle: 'Kawano', player2_handle: 'EndingWalker', status: 'upcoming' as const },
  ]

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
          <span className="text-[10px] text-red-400 uppercase tracking-wide font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Live
          </span>
        </div>
      </header>

            {/* Top Row: P1 | Stream | P2 */}
            <div className="flex-shrink-0 flex items-stretch" style={{ height: '50vh' }}>
        {/* P1 Sidebar */}
        <div className="hidden lg:flex flex-1 h-full flex-col border-r border-zinc-800 bg-zinc-950/50 overflow-y-auto min-w-0">
          <button
            onClick={() => openSearch('p1')}
            className="m-2 px-2 py-1 text-[11px] bg-blue-500/20 border border-blue-500/30 rounded text-blue-400 hover:bg-blue-500/30 transition-colors flex-shrink-0"
          >
            {player1 ? 'Change P1' : 'Select P1'}
          </button>
          <PlayerCard player={player1} side="p1" />
        </div>

        {/* Stream — 16:9 fixed, JS calculated */}
        <div
          className="flex-shrink-0 h-full bg-black overflow-hidden"
          style={{ width: `${streamWidth}px` }}
        >
          <iframe
            src={
              streamPlatform === 'twitch'
                ? `https://player.twitch.tv/?channel=${streamChannel}&parent=sf6-database.vercel.app&parent=localhost`
                : `https://www.youtube.com/embed/${streamChannel}?autoplay=1`
            }
            className="w-full h-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media"
          />
        </div>

        {/* P2 Sidebar */}
        <div className="hidden lg:flex flex-1 h-full flex-col border-l border-zinc-800 bg-zinc-950/50 overflow-y-auto min-w-0">
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

      {/* Middle Row: H2H */}
      <div className="flex-shrink-0 px-2 py-1">
        <MatchHistory
          player1Id={player1?.id || null}
          player2Id={player2?.id || null}
          player1Handle={player1?.handle || ''}
          player2Handle={player2?.handle || ''}
          summary={h2hData?.summary || null}
          sets={h2hData?.sets || []}
        />
      </div>

      {/* Bottom Row: Chat | Poll | Up Next */}
      <div className="flex-1 flex min-h-0 px-2 pb-2 gap-2">
        <div className="flex-1 min-h-0">
          <ChatEmbed platform={streamPlatform} channel={streamChannel} />
        </div>
        <div className="w-48 flex-shrink-0 hidden md:block min-h-0">
          <PollWidget
            player1Handle={player1?.handle || ''}
            player2Handle={player2?.handle || ''}
            player1Id={player1?.id || null}
            player2Id={player2?.id || null}
          />
        </div>
        <div className="flex-1 min-h-0">
          <BracketUpNext matches={upNextMatches} tournamentName="Capcom Cup 12" />
        </div>
      </div>
    </div>
  )
}
