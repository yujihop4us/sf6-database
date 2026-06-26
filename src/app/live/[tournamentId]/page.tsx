'use client'

import { useState, useEffect, useCallback } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import SiteNavbar from '@/components/SiteNavbar'
import { PoolsDashboard, type PoolsData, type ToastEvent } from '@/components/live/PoolsDashboard'
import { resolveTournamentConfig, SLUG_REDIRECTS } from './tournamentConfig'
import { usePoolsDashboard } from '@/hooks/usePoolsDashboard'
import { useStartggPolling }  from '@/hooks/useStartggPolling'
import { useAutoDetect }      from '@/hooks/useAutoDetect'
import { V, type Player, type H2HData } from '@/components/live/tokens'
import { PlayerBand } from '@/components/live/PlayerBand'
import { LiveStandings } from '@/components/live/LiveStandings'
import { SearchModal } from '@/components/live/SearchModal'
import { StreamCenter, H2HBars } from '@/components/live/StreamCenter'
import { SidePanelLeft } from '@/components/live/SidePanelLeft'
import { normalizePlayerName } from '@/lib/normalizePlayerName'

// ── Demo mock data ─────────────────────────────────────────────────────────────

const now = () => Date.now() / 1000

const DEMO_PLAYER1: Player = { id: 9001, handle: 'Punk',    country_code: 'US', main_character: 'Cammy' }
const DEMO_PLAYER2: Player = { id: 9002, handle: 'XiaoHai', country_code: 'CN', main_character: 'Mai'   }

const DEMO_H2H: H2HData = {
  player1: DEMO_PLAYER1,
  player2: DEMO_PLAYER2,
  summary: { player1_wins: 3, player2_wins: 2, total_sets: 5 },
  sets: [
    { id: 1, tournament_id: 48, round_text: 'Winners Final',      winner_id: 9001, loser_id: 9002, winner_score: 3, loser_score: 1, display_score: 'Punk 3-1 XiaoHai', tournament_name: 'COMBO BREAKER 2026',  tournament_date: '2026-05' },
    { id: 2, tournament_id: 40, round_text: 'Winners Semi-Final', winner_id: 9002, loser_id: 9001, winner_score: 3, loser_score: 2, display_score: 'XiaoHai 3-2 Punk', tournament_name: 'EVO Japan 2026',       tournament_date: '2026-05' },
    { id: 3, tournament_id: 9,  round_text: 'Grand Final',        winner_id: 9001, loser_id: 9002, winner_score: 3, loser_score: 2, display_score: 'Punk 3-2 XiaoHai', tournament_name: 'Capcom Cup 12',        tournament_date: '2026-03' },
    { id: 4, tournament_id: 36, round_text: 'Losers Final',       winner_id: 9002, loser_id: 9001, winner_score: 3, loser_score: 0, display_score: 'XiaoHai 3-0 Punk', tournament_name: 'UFA 2025',             tournament_date: '2025-09' },
    { id: 5, tournament_id: 25, round_text: 'Losers Semi-Final',  winner_id: 9001, loser_id: 9002, winner_score: 3, loser_score: 1, display_score: 'Punk 3-1 XiaoHai', tournament_name: 'Evo France 2025',      tournament_date: '2025-10' },
  ],
}

const DEMO_STARTGG_MATCHES = [
  // 進行中
  { id: 'm001', status: 'live',      round: 'Grand Final',         round_text: 'Grand Final',         player1_handle: 'XiaoHai', player2_handle: 'Punk',     score: '2-1', winner_is_p1: null,  winner: null,      completedAt: null,           player1_startggId: null, player2_startggId: null },
  // 完了セット (standings 計算用 — Losers 側から埋める)
  { id: 'm002', status: 'completed', round: 'Losers Final',        round_text: 'Losers Final',        player1_handle: 'Punk',    player2_handle: 'MenaRD',   score: '3-2', winner_is_p1: true,  winner: 'Punk',    completedAt: now() - 1800,   player1_startggId: null, player2_startggId: null },
  { id: 'm003', status: 'completed', round: 'Winners Final',       round_text: 'Winners Final',       player1_handle: 'XiaoHai', player2_handle: 'Tokido',   score: '3-0', winner_is_p1: true,  winner: 'XiaoHai', completedAt: now() - 3600,   player1_startggId: null, player2_startggId: null },
  { id: 'm004', status: 'completed', round: 'Losers Semi-Final',   round_text: 'Losers Semi-Final',   player1_handle: 'Punk',    player2_handle: 'Higuchi',  score: '3-1', winner_is_p1: true,  winner: 'Punk',    completedAt: now() - 5400,   player1_startggId: null, player2_startggId: null },
  { id: 'm005', status: 'completed', round: 'Losers Semi-Final',   round_text: 'Losers Semi-Final',   player1_handle: 'MenaRD',  player2_handle: 'Riddles',  score: '3-2', winner_is_p1: true,  winner: 'MenaRD',  completedAt: now() - 4800,   player1_startggId: null, player2_startggId: null },
  { id: 'm006', status: 'completed', round: 'Winners Semi-Final',  round_text: 'Winners Semi-Final',  player1_handle: 'XiaoHai', player2_handle: 'MenaRD',   score: '3-1', winner_is_p1: true,  winner: 'XiaoHai', completedAt: now() - 7200,   player1_startggId: null, player2_startggId: null },
  { id: 'm007', status: 'completed', round: 'Winners Semi-Final',  round_text: 'Winners Semi-Final',  player1_handle: 'Tokido',  player2_handle: 'Punk',     score: '2-3', winner_is_p1: false, winner: 'Punk',    completedAt: now() - 6600,   player1_startggId: null, player2_startggId: null },
  { id: 'm008', status: 'completed', round: 'Losers Quarter-Final',round_text: 'Losers Quarter-Final',player1_handle: 'Higuchi', player2_handle: 'Tokido',   score: '2-3', winner_is_p1: false, winner: 'Tokido',  completedAt: now() - 9000,   player1_startggId: null, player2_startggId: null },
  { id: 'm009', status: 'completed', round: 'Losers Quarter-Final',round_text: 'Losers Quarter-Final',player1_handle: 'Riddles', player2_handle: 'NuckleDu', score: '2-0', winner_is_p1: true,  winner: 'Riddles', completedAt: now() - 8400,   player1_startggId: null, player2_startggId: null },
  { id: 'm010', status: 'completed', round: 'Losers Quarter-Final',round_text: 'Losers Quarter-Final',player1_handle: 'MenaRD',  player2_handle: 'Nephew',   score: '3-1', winner_is_p1: true,  winner: 'MenaRD',  completedAt: now() - 7800,   player1_startggId: null, player2_startggId: null },
  { id: 'm011', status: 'completed', round: 'Losers Quarter-Final',round_text: 'Losers Quarter-Final',player1_handle: 'Punk',    player2_handle: 'Phenom',   score: '3-0', winner_is_p1: true,  winner: 'Punk',    completedAt: now() - 7000,   player1_startggId: null, player2_startggId: null },
]

const DEMO_UP_NEXT = [
  { status: 'live',     round: 'Grand Final',       round_text: 'Grand Final',       player1_handle: 'XiaoHai', player2_handle: 'Punk',    score: '2-1' },
  { status: 'upcoming', round: 'Grand Final Reset',  round_text: 'Grand Final Reset', player1_handle: 'XiaoHai', player2_handle: 'Punk',    score: null },
]

const DEMO_POOLS_DATA: PoolsData = {
  currentPhase: 'Round Robin Pools',
  overallProgress: {
    'Round Robin Pools': { completed: 15, total: 24, percent: 63 },
  },
  feed: [
    { type: 'QUALIFIED_W', priority: 'HIGH',   timestamp: now() - 300,  pool: 'Pool A', phase: 'Round Robin Pools', round: 'Final Round',  message: 'XiaoHai が Pool A を首位通過 (5-0)',  players: [{ name: 'XiaoHai', handle: 'XiaoHai', seed: 2  }], score: '3-0' },
    { type: 'UPSET',       priority: 'HIGH',   timestamp: now() - 900,  pool: 'Pool B', phase: 'Round Robin Pools', round: 'Round 4',      message: 'Riddles が Higuchi を撃破',            players: [{ name: 'Riddles', handle: 'Riddles',  seed: 8  }, { name: 'Higuchi', handle: 'Higuchi', seed: 3 }], score: '3-2' },
    { type: 'QUALIFIED_W', priority: 'MEDIUM', timestamp: now() - 1800, pool: 'Pool A', phase: 'Round Robin Pools', round: 'Round 5',      message: 'Punk が Pool A 2位で通過 (4-1)',      players: [{ name: 'Punk',    handle: 'Punk',    seed: 1  }], score: '3-1' },
    { type: 'ELIMINATED',  priority: 'MEDIUM', timestamp: now() - 2700, pool: 'Pool A', phase: 'Round Robin Pools', round: 'Round 4',      message: 'Kobayan が敗退',                       players: [{ name: 'Kobayan', handle: 'Kobayan', seed: 24 }], score: '0-3' },
    { type: 'MARQUEE_RESULT', priority: 'HIGH', timestamp: now() - 3600, pool: 'Pool A', phase: 'Round Robin Pools', round: 'Round 3',    message: 'Punk vs MenaRD — 激戦の末Punkが制す', players: [{ name: 'Punk', handle: 'Punk', seed: 1 }, { name: 'MenaRD', handle: 'MenaRD', seed: 5 }], score: '3-2' },
  ],
  qualified: [
    { name: 'XiaoHai', handle: 'XiaoHai', seed: 2,  side: 'winners', pool: 'Pool A', phase: 'Round Robin Pools' },
    { name: 'Punk',    handle: 'Punk',    seed: 1,  side: 'winners', pool: 'Pool A', phase: 'Round Robin Pools' },
    { name: 'MenaRD',  handle: 'MenaRD',  seed: 5,  side: 'losers',  pool: 'Pool A', phase: 'Round Robin Pools' },
  ],
  pools: [
    { id: 'pool-a', phase: 'Round Robin Pools', completed: 10, total: 10, percent: 100 },
    { id: 'pool-b', phase: 'Round Robin Pools', completed: 5,  total: 10, percent: 50  },
    { id: 'pool-c', phase: 'Round Robin Pools', completed: 0,  total: 10, percent: 0   },
  ],
  lastUpdated: new Date().toISOString(),
  setsAnalyzed: 15,
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LivePage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params)
  const router = useRouter()

  // 旧キー（数値ID等）を正規slugにリダイレクト
  useEffect(() => {
    const slug = SLUG_REDIRECTS[tournamentId]
    if (slug) router.replace(`/live/${slug}`)
  }, [tournamentId, router])

  const [player1, setPlayer1]           = useState<Player | null>(null)
  const [player2, setPlayer2]           = useState<Player | null>(null)
  const [h2hData, setH2hData]           = useState<H2HData | null>(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<Player[]>([])
  const [searchSide, setSearchSide]     = useState<'p1' | 'p2' | null>(null)
  const [showSearch, setShowSearch]     = useState(false)
  const [score, setScore]               = useState({ p1: 0, p2: 0 })
  // clock は StreamCenter 内で timezone ベースに計算するため削除
  const [isStreamLive, setIsStreamLive] = useState(false)
  const [streamInfo, setStreamInfo]     = useState({ title: '', viewerCount: 0, gameName: '' })
  const [centerTab, setCenterTab]       = useState<'stream' | 'bracket'>('stream')

  // ── 大会設定 (tournamentConfig.ts から) ──────────────────────────────────
  // リダイレクト対象なら何も描画しない
  if (SLUG_REDIRECTS[tournamentId]) return null

  const { config, configKey } = resolveTournamentConfig(tournamentId)
  const isDemo = config.isDemo === true

  // stream-queue API 用スラッグ: 数値 ID の場合でも slug キーを取得
  const effectiveTournamentSlug: string | undefined = isNaN(Number(tournamentId))
    ? tournamentId
    : (configKey && isNaN(Number(configKey)) ? configKey : undefined)
  const hasStream      = isDemo ? true : (!!config.streamPlatform && !!config.streamChannel)
  const streamPlatform = config.streamPlatform
  const streamChannel  = config.streamChannel

  // ── フック: pools-dashboard / startgg ポーリング ─────────────────────────
  // デモモード時は undefined を渡してAPIコールを抑止
  const {
    poolsData, displayMode, setDisplayMode,
    displayModeManual, setDisplayModeManual,
    streamToast, setStreamToast, streamToastTimer,
  } = usePoolsDashboard(isDemo ? undefined : config.dbTournamentId, isDemo ? undefined : config.endDate)

  const {
    startggMatches: realStartggMatches, cc12Matches, cc12LastUpdated,
    mergedPhases, upNextMatches: realUpNextMatches, featuredMode,
  } = useStartggPolling({
    startggEventId: isDemo ? undefined : config.startggEventId,
    endDate: config.endDate,
    phases: config.phases,
    hasStream: isDemo ? false : hasStream,
    searchQuery,
  })

  // デモモードではモックデータを使用
  const startggMatches = isDemo ? DEMO_STARTGG_MATCHES : realStartggMatches
  const upNextMatches  = isDemo ? DEMO_UP_NEXT         : realUpNextMatches

  // クロックは StreamCenter 内で timezone ベースに計算

  // ── Twitch ポーリング (30秒) — デモ時はスキップ ──────────────────────────
  useEffect(() => {
    if (isDemo || !config.streamChannel || config.streamPlatform !== 'twitch') return
    const check = async () => {
      try {
        const res  = await fetch('/api/twitch?channel=' + config.streamChannel)
        const data = await res.json()
        setIsStreamLive(data.isLive || false)
        if (data.isLive) setStreamInfo({ title: data.title || '', viewerCount: data.viewerCount || 0, gameName: data.gameName || '' })
      } catch (e) { console.error('[Twitch]', e) }
    }
    check()
    const id = setInterval(check, 30000)
    return () => clearInterval(id)
  }, [isDemo, config.streamChannel, config.streamPlatform])

  // ── デモモード: 初期選手・H2H・スコアをマウント時にセット ─────────────────
  useEffect(() => {
    if (!isDemo) return
    setPlayer1(DEMO_PLAYER1)
    setPlayer2(DEMO_PLAYER2)
    setH2hData(DEMO_H2H)
    setScore({ p1: 2, p2: 1 })
    setIsStreamLive(true)
    setStreamInfo({ title: 'SF6 Grand Finals — DEMO', viewerCount: 12345, gameName: 'Street Fighter 6' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  // ── H2H フェッチ (デモ時はスキップ) ─────────────────────────────────────
  const fetchH2H = useCallback(async (p1Id: number, p2Id: number) => {
    const res  = await fetch(`/api/head-to-head?p1=${p1Id}&p2=${p2Id}`)
    const data = await res.json()
    setH2hData(data)
  }, [])
  useEffect(() => {
    if (isDemo) return
    if (player1 && player2) fetchH2H(player1.id, player2.id)
    else setH2hData(null)
  }, [isDemo, player1, player2, fetchH2H])

  // ── 選手検索 (300ms デバウンス) ──────────────────────────────────────────
  useEffect(() => {
    if (isDemo || searchQuery.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      const res  = await fetch(`/api/players/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setSearchResults(data.players || [])
    }, 300)
    return () => clearTimeout(t)
  }, [isDemo, searchQuery])


  // ── ヘルパー ──────────────────────────────────────────────────────────────
  const selectPlayer = (p: Player) => {
    if (searchSide === 'p1') setPlayer1(p); else setPlayer2(p)
    setShowSearch(false); setSearchQuery(''); setSearchResults([]); setSearchSide(null)
  }
  const openSearch = (side: 'p1' | 'p2') => { setSearchSide(side); setShowSearch(true); setSearchQuery('') }
  const handleMatchClick = async (
    p1n: string, p2n: string,
    p1StartggId?: number | null, p2StartggId?: number | null,
  ) => {
    const find = async (rawName: string, side: 'p1' | 'p2', startggId?: number | null) => {
      // スポンサータグ除去 + 表記揺れ対応は normalizePlayerName に委譲
      const normalized = normalizePlayerName(rawName)
      try {
        // startgg player ID がある場合は ID での直接検索を優先
        let url = '/api/players/search?q=' + encodeURIComponent(rawName)
        if (startggId) url += '&startggId=' + startggId
        const res  = await fetch(url)
        const data = await res.json()
        const players: Player[] = data.players || []
        const found =
          // 完全一致を優先 (正規化後)
          players.find(p => p.handle.toLowerCase() === normalized.toLowerCase()) ||
          // 完全一致 (元の名前)
          players.find(p => p.handle.toLowerCase() === rawName.toLowerCase()) ||
          // 先頭候補をフォールバック
          players[0]
        if (found) { if (side === 'p1') setPlayer1(found); else setPlayer2(found) }
      } catch (e) { console.error(e) }
    }
    find(p1n, 'p1', p1StartggId); find(p2n, 'p2', p2StartggId)
  }

  // ── start.gg 自動検知 (デモ時は無効) ─────────────────────────────────────
  const { autoDetected, liveScore, setManualMode } = useAutoDetect(
    isDemo ? [] : startggMatches,
    isDemo ? undefined : config.startggEventId,
    (p1, p2, p1Id, p2Id) => { setScore({ p1: 0, p2: 0 }); handleMatchClick(p1, p2, p1Id, p2Id) },
  )

  // ── レンダー ──────────────────────────────────────────────────────────────
  return (
    <div className="live-page" style={{
      background: V.bg, color: V.text, fontFamily: V.FB,
      height: '100dvh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${V.bg}; }
        ::-webkit-scrollbar-thumb { background: ${V.surface3}; border-radius: 3px; }
        @keyframes sf6live-pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .sf6live-dot {
          width: 8px; height: 8px; border-radius: 50%; background: ${V.red};
          animation: sf6live-pulse 1.2s ease-in-out infinite;
          display: inline-block; flex-shrink: 0;
        }
        .sf6live-next-row:hover { background: ${V.surface2} !important; }
        .sf6live-dot-green {
          width: 8px; height: 8px; border-radius: 50%; background: ${V.accent};
          animation: sf6live-pulse 1.2s ease-in-out infinite;
          display: inline-block; flex-shrink: 0;
        }
        button { font-family: inherit; }
        input  { font-family: inherit; }

        /* ============================================
           MOBILE RESPONSIVE - LIVE PAGE  ≤768px
           ============================================ */

        /* PC default */
        .h2h-score-compact { display: none; }

        /* PC版: 配信+H2Hの高さ制御 */

        /* stream-and-h2h-sticky: 縮小不可・フル幅 */
        .stream-and-h2h-sticky {
          width: 100%;
          flex-shrink: 0 !important;
        }

        /* 中画面 (769px〜1280px): PlayerBand をさらに縮小 */
        @media (min-width: 769px) and (max-width: 1280px) {
          .h2h-faceoff {
            grid-template-columns: minmax(120px, 12vw) 1fr minmax(120px, 12vw) !important;
          }
        }

        /* h2h-secondary に最小高さを確保 */
        .h2h-secondary {
          min-height: 200px !important;
        }

        @media (max-width: 768px) {
          /* ===== ページ全体: 100dvh固定 + flex縦積み ===== */
          .live-page {
            height: 100dvh !important;
            overflow: hidden !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: column !important;
          }
          /* 内側コンテナ（mode-toggle + コンテンツ）もflex縦積み */
          .live-page > div:last-child {
            display: flex !important;
            flex-direction: column !important;
            flex: 1 !important;
            min-height: 0 !important;
            overflow: hidden !important;
            padding: 0 !important;
          }

          /* ===== 固定エリア: 配信 + H2Hバー ===== */
          .stream-and-h2h-sticky {
            position: relative !important;
            flex-shrink: 0 !important;
            z-index: 50 !important;
            background: #0a0c14 !important;
            width: 100% !important;
          }

          /* 配信プレイヤー 16:9 フル幅 */
          .stream-container {
            position: relative !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            grid-template-rows: unset !important;
          }
          .stream-player-wrapper {
            width: 100% !important;
            height: 0 !important;
            padding-bottom: 56.25% !important;
            position: relative !important;
            min-height: unset !important;
            max-height: unset !important;
            aspect-ratio: unset !important;
          }
          .stream-player-wrapper iframe {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            border: none !important;
          }

          /* ===== H2H スコアバー（VS レイアウト） ===== */
          .h2h-score-bar {
            padding: 6px 10px !important;
            border-radius: 0 !important;
            flex-shrink: 0 !important;
          }

          /* H2H 3カラム → 1カラム */
          .h2h-faceoff {
            display: flex !important;
            flex-direction: column !important;
            grid-template-columns: unset !important;
            overflow: visible !important;
            border: none !important;
            border-radius: 0 !important;
            gap: 0 !important;
          }

          /* PlayerBand 非表示 */
          .player-band {
            display: none !important;
          }

          /* ===== スクロールエリア: flex:1 + overflow-y:auto ===== */
          .h2h-secondary {
            flex: 1 !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            display: flex !important;
            flex-direction: column !important;
            grid-template-columns: unset !important;
            gap: 0 !important;
            padding: 8px !important;
            min-height: 0 !important;
          }

          /* チャットパネル非表示 */
          .live-chat-panel {
            display: none !important;
          }

          /* 順位表フル幅 */
          .live-standings {
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
          }

          /* ===== Pools モード ===== */
          .pools-layout {
            display: flex !important;
            flex-direction: column !important;
            grid-template-columns: unset !important;
            flex: 1 !important;
            height: 100% !important;
            min-height: 0 !important;
            overflow: hidden !important;
            gap: 0 !important;
            padding: 0 !important;
          }

          /* 配信+チャットの親gridを縦積みに */
          .pools-layout > div:first-child {
            display: flex !important;
            flex-direction: column !important;
            grid-template-rows: unset !important;
            flex-shrink: 0 !important;
          }

          /* 配信エリア 16:9 固定 */
          .pools-layout .stream-container {
            width: 100% !important;
            flex-shrink: 0 !important;
          }
          .pools-layout .stream-player-wrapper {
            position: relative !important;
            width: 100% !important;
            padding-bottom: 56.25% !important;
            height: 0 !important;
          }
          .pools-layout .stream-player-wrapper iframe {
            position: absolute !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important; height: 100% !important;
          }

          /* チャットパネルはモバイルで非表示 */
          .pools-layout .live-chat-panel {
            display: none !important;
          }

          /* PoolsDashboard をスクロール可能エリアに */
          .pools-layout > div:last-child {
            flex: 1 !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            min-height: 0 !important;
            width: 100% !important;
          }

          /* HighlightCard の位置を正常化 */
          .highlight-card {
            position: relative !important;
            width: 100% !important;
            margin: 0 !important;
          }

          /* ===== モード切替トグル ===== */
          .mode-toggle {
            padding: 4px 8px !important;
            gap: 4px !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
          }
          .mode-toggle button {
            padding: 5px 10px !important;
            font-size: 11px !important;
            border-radius: 6px !important;
          }
        }

        /* モバイル: ティッカー調整 */
        @media (max-width: 768px) {
          .h2h-ticker-container {
            height: 24px !important;
          }
          .h2h-seg-bar { height: 3px !important; }
        }

        @media (max-width: 480px) {
          .mode-toggle button {
            padding: 4px 8px !important;
            font-size: 10px !important;
          }
        }
      `}</style>

      {/* 選手検索モーダル */}
      {showSearch && (
        <SearchModal
          searchSide={searchSide} searchQuery={searchQuery}
          setSearchQuery={setSearchQuery} searchResults={searchResults}
          onSelect={selectPlayer} onClose={() => setShowSearch(false)}
        />
      )}

      {/* ナビバー: ● LIVE + 大会名 を右端に表示 */}
      <SiteNavbar compact activePage="live" isLive={isStreamLive} breadcrumb={[{ label: config.name }]} />

      {/* デモバナー */}
      {isDemo && (
        <div style={{
          flexShrink: 0,
          background: 'linear-gradient(90deg, #7c3aed, #9333ea)',
          color: '#fff', textAlign: 'center',
          padding: '5px 12px', fontSize: 11, fontFamily: V.FD,
          fontWeight: 700, letterSpacing: '0.12em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>🎮</span>
          DEMO MODE — モックデータで表示中。実際の大会ではありません。
          <span style={{ fontSize: 14 }}>🎮</span>
        </div>
      )}

      {/* メインコンテンツ: navbar の下に残り全高さを使う */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        padding: '10px 16px 12px', maxWidth: 1600, margin: '0 auto', width: '100%',
        display: 'flex', flexDirection: 'column', gap: 10,
        boxSizing: 'border-box' as const,
      }}>

        {/* ── モード切替トグル ── */}
        {(config.startggEventId || isDemo) && (
          <div className="mode-toggle" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            {/* モード切替: デモのみ手動切替可、本番はAUTOのみ */}
            {isDemo ? (
              <>
                <span style={{ fontFamily: V.FD, fontSize: 10, color: V.dim, letterSpacing: '0.08em' }}>
                  DEMO MODE
                </span>
                {(['h2h', 'pools'] as const).map(mode => (
                  <button key={mode} onClick={() => { setDisplayMode(mode); setDisplayModeManual(true) }} style={{
                    background: displayMode === mode ? V.surface3 : 'transparent',
                    border: `1px solid ${displayMode === mode ? V.border2 : V.border}`,
                    borderRadius: 5, padding: '3px 10px', cursor: 'pointer',
                    fontFamily: V.FD, fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                    color: displayMode === mode ? V.accent : V.dim,
                  }}>
                    {mode === 'h2h' ? '📺 H2H' : '📊 POOLS'}
                  </button>
                ))}
              </>
            ) : (
              <span style={{ fontFamily: V.FD, fontSize: 10, color: V.dim, letterSpacing: '0.08em' }}>
                {poolsData ? `Phase: ${poolsData.currentPhase}` : ''}
              </span>
            )}
          </div>
        )}

        {displayMode === 'pools' ? (

          /* ══════════════════════════════════════════════════════════
             POOLS モード: 2カラム (配信+チャット 左 / PoolsDashboard 右)
             PlayerBand・H2Hバーは非表示。右パネルが画面上から下まで全高さ
          ══════════════════════════════════════════════════════════ */
          <div className="pools-layout" style={{
            flex: 1, minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 380px',
            gap: 12,
          }}>
            {/* 左カラム: 配信映像(上) + チャット(下) */}
            <div className="stream-container" style={{
              display: 'grid',
              gridTemplateRows: '1.8fr 1fr',
              gap: 12,
              minHeight: 0,
              overflow: 'hidden',
            }}>
              <StreamCenter
                score={score}
                centerTab={centerTab} setCenterTab={setCenterTab}
                hasStream={hasStream}
                streamPlatform={streamPlatform} streamChannel={streamChannel}
                twitchChannels={config.twitchChannels}
                isStreamLive={isStreamLive} streamInfo={streamInfo}
                player1={player1} player2={player2} h2hData={h2hData}
                tournamentId={tournamentId}
                dbTournamentId={config.dbTournamentId}
                startggMatches={startggMatches} configName={config.name}
                cc12LastUpdated={cc12LastUpdated} onMatchClick={handleMatchClick}
                ewcQualifier={config.ewcQualifier}
                ewcSlots={config.ewcSlots}
                cptPremier={config.cptPremier}
                locationLabel={config.locationLabel}
                timezone={config.timezone ?? 'UTC'}
                streamStartTime={config.streamStartTime}
                startDate={config.startDate}
                endDate={config.endDate}
                tournamentSlug={effectiveTournamentSlug}
                onStreamQueueMatch={(p1h, p2h, p1Id, p2Id) => handleMatchClick(p1h, p2h, p1Id, p2Id)}
                streamToast={streamToast}
                poolsMode={true}
                isDemo={isDemo}
              />
              <SidePanelLeft
                player1={player1} player2={player2}
                twitchChatChannels={config.twitchChatChannels}
                isDemo={isDemo}
              />
            </div>

            {/* 右カラム: PoolsDashboard 全高さ */}
            <PoolsDashboard
              data={isDemo ? DEMO_POOLS_DATA : poolsData}
              onToast={(ev) => {
                setStreamToast(ev)
                if (streamToastTimer.current) clearTimeout(streamToastTimer.current)
                if (ev) {
                  streamToastTimer.current = setTimeout(() => setStreamToast(null), 5000)
                }
              }}
            />
          </div>

        ) : (

          /* ══════════════════════════════════════════════════════════
             H2H モード: 従来レイアウト (変更なし)
          ══════════════════════════════════════════════════════════ */
          <>
            {/* AUTO バッジ (緑点滅) — 自動検知モード中のみ表示 */}
            {autoDetected && (
              <div style={{
                flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 8,
                background: `${V.accent}0d`, border: `1px solid ${V.accent}30`,
                borderRadius: 8, padding: '7px 12px',
              }}>
                <span className="sf6live-dot-green" style={{ width: 7, height: 7 }} />
                <span style={{
                  fontFamily: V.FD, fontSize: 11, fontWeight: 800,
                  letterSpacing: '0.14em', textTransform: 'uppercase' as const,
                  color: V.accent,
                }}>AUTO</span>
                <span style={{ fontFamily: V.FB, fontSize: 11, color: V.muted }}>
                  start.gg の進行中セットを自動検知中 — P1 / P2 を自動更新しています
                </span>
                <button
                  onClick={() => setManualMode()}
                  style={{
                    marginLeft: 'auto', background: 'none', border: 'none',
                    cursor: 'pointer', color: V.dim, fontSize: 13, padding: '0 4px',
                    lineHeight: 1,
                  }}
                  title="自動検知を無効化"
                >✕</button>
              </div>
            )}

            {/* 配信 + H2Hバー: モバイルで sticky 固定 */}
            <div className="stream-and-h2h-sticky">
            {/* 3カラム フェイスオフ */}
            <div className="h2h-faceoff" style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(160px, 15vw) 1fr minmax(160px, 15vw)',
              gap: 0, borderRadius: '12px 12px 0 0', overflow: 'hidden',
              border: `1px solid ${V.border}`,
              flexShrink: 0,
            }}>
              <PlayerBand
                player={player1} score={score.p1} side="left"
                isWinning={score.p1 > score.p2}
                onSelectPlayer={() => openSearch('p1')}
                scoreState={score}
                onScoreChange={d => setScore(s => ({ ...s, p1: Math.max(0, s.p1 + d) }))}
              />
              <StreamCenter
                score={score}
                centerTab={centerTab} setCenterTab={setCenterTab}
                hasStream={hasStream}
                streamPlatform={streamPlatform} streamChannel={streamChannel}
                twitchChannels={config.twitchChannels}
                isStreamLive={isStreamLive} streamInfo={streamInfo}
                player1={player1} player2={player2} h2hData={h2hData}
                tournamentId={tournamentId}
                dbTournamentId={config.dbTournamentId}
                startggMatches={startggMatches} configName={config.name}
                cc12LastUpdated={cc12LastUpdated} onMatchClick={handleMatchClick}
                ewcQualifier={config.ewcQualifier}
                ewcSlots={config.ewcSlots}
                cptPremier={config.cptPremier}
                locationLabel={config.locationLabel}
                timezone={config.timezone ?? 'UTC'}
                streamStartTime={config.streamStartTime}
                startDate={config.startDate}
                endDate={config.endDate}
                tournamentSlug={effectiveTournamentSlug}
                onStreamQueueMatch={(p1h, p2h, p1Id, p2Id) => handleMatchClick(p1h, p2h, p1Id, p2Id)}
                streamToast={null}
                liveScore={isDemo ? { p1: 2, p2: 1 } : liveScore}
                isDemo={isDemo}
              />
              <PlayerBand
                player={player2} score={score.p2} side="right"
                isWinning={score.p2 > score.p1}
                onSelectPlayer={() => openSearch('p2')}
                scoreState={score}
                onScoreChange={d => setScore(s => ({ ...s, p2: Math.max(0, s.p2 + d) }))}
              />
            </div>
            <H2HBars player1={player1} player2={player2} h2hData={h2hData} />
            </div>{/* /stream-and-h2h-sticky */}

            {/* セカンダリ: H2H */}
            <div className="h2h-secondary" style={{
              flex: 1, minHeight: 0,
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>

              <SidePanelLeft
                player1={player1} player2={player2}
                twitchChatChannels={config.twitchChatChannels}
                isDemo={isDemo}
              />
              <LiveStandings
                startggMatches={startggMatches}
                upNextMatches={upNextMatches}
                onMatchClick={(p1, p2, p1Id, p2Id) => {
                  setManualMode()
                  handleMatchClick(p1, p2, p1Id, p2Id)
                }}
              />
            </div>
          </>

        )}

      </div>
    </div>
  )
}
