'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import SiteNavbar from '@/components/SiteNavbar'
import { PoolsDashboard, type PoolsData, type ToastEvent } from '@/components/live/PoolsDashboard'
import { resolveTournamentConfig, SLUG_REDIRECTS } from './tournamentConfig'
import { usePoolsDashboard } from '@/hooks/usePoolsDashboard'
import { useStartggPolling }  from '@/hooks/useStartggPolling'
import { useAutoDetect }      from '@/hooks/useAutoDetect'
import { V, type Player, type H2HData } from '@/components/live/tokens'
import { StartCountdown } from '@/components/StartCountdown'
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
    { type: 'QUALIFIED_W', priority: 'HIGH',   timestamp: now() - 300,  pool: 'A', phase: 'Round Robin Pools', round: 'Final Round',  message: 'XiaoHai が Pool A を首位通過 (5-0)',  players: [{ name: 'XiaoHai', handle: 'XiaoHai', seed: 2  }], score: '3-0' },
    { type: 'UPSET',       priority: 'HIGH',   timestamp: now() - 900,  pool: 'B', phase: 'Round Robin Pools', round: 'Round 4',      message: 'Riddles が Higuchi を撃破',            players: [{ name: 'Riddles', handle: 'Riddles',  seed: 8  }, { name: 'Higuchi', handle: 'Higuchi', seed: 3 }], score: '3-2' },
    { type: 'QUALIFIED_W', priority: 'MEDIUM', timestamp: now() - 1800, pool: 'A', phase: 'Round Robin Pools', round: 'Round 5',      message: 'Punk が Pool A 2位で通過 (4-1)',      players: [{ name: 'Punk',    handle: 'Punk',    seed: 1  }], score: '3-1' },
    { type: 'ELIMINATED',  priority: 'MEDIUM', timestamp: now() - 2700, pool: 'A', phase: 'Round Robin Pools', round: 'Round 4',      message: 'Kobayan が敗退',                       players: [{ name: 'Kobayan', handle: 'Kobayan', seed: 24 }], score: '0-3' },
    { type: 'MARQUEE_RESULT', priority: 'HIGH', timestamp: now() - 3600, pool: 'A', phase: 'Round Robin Pools', round: 'Round 3',    message: 'Punk vs MenaRD — 激戦の末Punkが制す', players: [{ name: 'Punk', handle: 'Punk', seed: 1 }, { name: 'MenaRD', handle: 'MenaRD', seed: 5 }], score: '3-2' },
  ],
  qualified: [
    { name: 'XiaoHai', handle: 'XiaoHai', seed: 2,  side: 'winners', pool: 'A', phase: 'Round Robin Pools' },
    { name: 'Punk',    handle: 'Punk',    seed: 1,  side: 'winners', pool: 'A', phase: 'Round Robin Pools' },
    { name: 'MenaRD',  handle: 'MenaRD',  seed: 5,  side: 'losers',  pool: 'A', phase: 'Round Robin Pools' },
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
  const [mobileTab, setMobileTab]       = useState<'standings' | 'chat'>('standings')
  // 順位表/チャットはファーストビューの下 — スクロールヒントから飛べるようにする
  const secondaryRef = useRef<HTMLDivElement>(null)
  // 配信が画面外に出そうになったらミニプレーヤー化（PCのみ）。
  // Twitch はビューポート外に出ると再生を停止し自動再開しないため、
  // スクロール中も必ず画面内に残す必要がある
  const [miniPlayer, setMiniPlayer] = useState(false)

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
  } = usePoolsDashboard(
    isDemo ? undefined : config.dbTournamentId,
    isDemo ? undefined : config.endDate,
    isDemo ? undefined : config.forceDisplayMode,
  )

  const {
    startggMatches: realStartggMatches, startggStandings, cc12Matches, cc12LastUpdated,
    mergedPhases, upNextMatches: realUpNextMatches, featuredMode,
  } = useStartggPolling({
    startggEventId: isDemo ? undefined : config.startggEventId,
    liquipediaTournament: isDemo ? undefined : config.liquipediaTournament,
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
    // start.gg / Liquipedia どちらのソースでも自動検知を有効にする
    isDemo ? false : !!(config.startggEventId || config.liquipediaTournament),
    (p1, p2, p1Id, p2Id) => { setScore({ p1: 0, p2: 0 }); handleMatchClick(p1, p2, p1Id, p2Id) },
    // Liquipedia は完了時刻を持たないため予定時刻からの推定を許可する
    !isDemo && !config.startggEventId && !!config.liquipediaTournament,
  )

  // ── ミニプレーヤー切替 (PCのみ / モバイルは sticky で対応済み) ──────────
  useEffect(() => {
    const MOBILE_BP = 768
    const update = () => {
      if (window.innerWidth <= MOBILE_BP) { setMiniPlayer(false); return }
      const wrapper = document.querySelector('.stream-and-h2h-sticky .stream-player-wrapper')
      if (!wrapper) return
      const r = wrapper.getBoundingClientRect()
      if (r.height === 0) return
      // 配信枠(ミニ化中はプレースホルダ)の可視率で判定する。
      // 完全に画面外へ出てからでは Twitch 側が再生を止めてしまうため、
      // まだ十分見えているうちにミニ化する。閾値に差を付けて振動を防ぐ
      const visible = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0))
      const ratio = visible / r.height
      setMiniPlayer(prev => (prev ? ratio < 0.8 : ratio < 0.55))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  // ── レンダー ──────────────────────────────────────────────────────────────
  return (
    <div className={`live-page${miniPlayer ? ' mini-player' : ''}${centerTab === 'bracket' ? ' bracket-mini' : ''}`} style={{
      background: V.bg, color: V.text, fontFamily: V.FB,
      // 配信+H2H を sticky 固定し、順位表/チャットは下へスクロールして参照する。
      // overflow を指定するとスクロールコンテナが生まれ、子の position:sticky が
      // viewport 基準で効かなくなるため visible のままにする
      minHeight: '100dvh', overflow: 'visible',
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

        /* 順位表 / チャット: ファーストビューの下に配置される。
           以前は viewport 内に押し込むため 200px しか確保できずチャットが
           極端に狭かった。ページスクロールを解禁したので実用的な高さを与える */
        .h2h-secondary {
          height: min(78vh, 760px);
          min-height: 420px !important;
          scroll-margin-top: 8px;
        }

        /* タブ用ラッパー div: 中身のパネルをセル全高に引き伸ばす */
        .h2h-secondary > div {
          display: flex;
          flex-direction: column;
          min-height: 0;
          min-width: 0;
        }
        .h2h-secondary > div > * {
          flex: 1;
          min-height: 0;
        }

        /* PC: 配信エリアの高さ上限。
           配信 + H2H だけでファーストビューが成立するよう、secondary(順位表/チャット)
           分の高さは差し引かない。secondary は下にスクロールして参照する。
           実測内訳: navbar 36 + toggle 33 + ラウンドバー 48 + H2Hバー 114 + gap/padding 22 ≈ 253px */
        /* PC: 配信エリアの高さ上限。順位表/チャット分は差し引かない
           （それらはスクロールして参照する）。
           内訳: navbar 36 + toggle 33 + ラウンドバー 48 + H2Hバー 114 + gap/padding 22 ≈ 253px */
        .stream-and-h2h-sticky .stream-player-wrapper {
          max-height: calc(100dvh - 265px);
          min-height: 300px;
        }

        /* ── ミニプレーヤー ───────────────────────────────────────────────
           スクロールで配信が画面外に出そうになったら、iframe だけを
           右下に固定して再生を継続させる。
           ポイント: iframe を DOM から移動させず CSS だけで fixed 化する。
           DOM 移動や src 変更を行うと iframe が再読込され再生が止まる
           （実測: CSS のみの fixed 化では reload 0回・同一ノード維持）。
           また .stream-player-wrapper 自体は通常フローに残すことで
           レイアウトが崩れず、スクロール位置の振動も起きない */
        /* 配信 iframe の基準スタイル。
           以前は StreamCenter 側のインラインスタイルだったが、インラインは
           CSS クラスより優先されミニ化の上書きができないためクラス化した */
        .stream-iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          max-height: 100%;
          border: none;
        }

        /* BRACKET タブ表示中は配信枠を畳んでミニプレーヤー化する。
           iframe をアンマウントすると再生が止まり戻しても再開しないため、
           DOM には残したまま CSS だけで退避させる */
        .live-page.bracket-mini .stream-player-wrapper {
          height: 0 !important;
          min-height: 0 !important;
          max-height: 0 !important;
          /* モバイルは padding-bottom で 16:9 を作っているため合わせて潰す */
          padding-bottom: 0 !important;
          border: none !important;
        }

        .live-page.mini-player .stream-and-h2h-sticky .stream-player-wrapper .stream-iframe,
        .live-page.bracket-mini .stream-player-wrapper .stream-iframe {
          position: fixed;
          inset: auto;
          max-height: none;
          right: 18px;
          bottom: 18px;
          width: 336px;
          height: 189px;
          z-index: 200;
          border-radius: 10px;
          box-shadow: 0 12px 34px rgba(0,0,0,0.65);
          border: 1px solid ${V.border2};
        }
        /* ミニ化中、元の配信枠には代替表示を出す */
        .live-page.mini-player .stream-and-h2h-sticky .stream-player-wrapper::after {
          content: '▶ ミニプレーヤーで再生中';
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: ${V.surface};
          border: 1px dashed ${V.border2};
          border-radius: 8px;
          font-family: ${V.FD}; font-size: 12px; font-weight: 700;
          letter-spacing: 0.1em; color: ${V.dim};
        }

        /* PC: ファーストビューを配信+H2Hで埋める（配信は最大サイズを維持）。
           下へスクロールすると配信はミニプレーヤー化して画面内に residual する。
           Twitch は埋め込みが画面外に出ると再生を停止し、戻しても自動再開しない
           （実測: 画面外で paused=true / time=0 にリセット）ため、
           スクロール中も必ずビューポート内に残す必要がある */
        .stream-and-h2h-sticky {
          min-height: calc(100dvh - 105px);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        /* 下にコンテンツがあることを示すスクロールヒント */
        .scroll-hint {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          flex-shrink: 0;
          margin-top: -2px;
          padding: 6px 0 2px;
          background: none; border: none; width: 100%;
          cursor: pointer;
          font-family: ${V.FD}; font-size: 10px; font-weight: 800;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: ${V.dim};
          transition: color 0.2s;
        }
        .scroll-hint:hover { color: ${V.accent}; }
        .scroll-hint span:last-child {
          animation: sf6live-bounce 1.8s ease-in-out infinite;
        }
        @keyframes sf6live-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.55; }
          50%      { transform: translateY(3px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .scroll-hint span:last-child { animation: none; }
        }

        /* モバイルタブバー: PCでは非表示 */
        .mobile-tab-bar {
          display: none;
        }

        /* コンテンツ最大幅: 1440px中央配置（それ以上は左右に暗い帯） */
        .live-content-wrapper {
          max-width: 1440px;
          margin: 0 auto;
          width: 100%;
        }

        /* チャンネルセレクター: hover可能なデバイスのみホバー表示化
           タッチ端末では常時表示（hoverが無いと操作不能になるため） */
        @media (hover: hover) {
          .channel-selector {
            opacity: 0;
            transition: opacity 0.3s ease;
          }
          .stream-player-wrapper:hover .channel-selector,
          .channel-selector:hover,
          .channel-selector:focus-within {
            opacity: 1;
          }
        }

        /* Pools モード: PC デフォルトレイアウト */
        .pools-layout {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 380px;
          gap: 12px;
        }
        .pools-layout .stream-container {
          display: grid;
          grid-template-rows: 1.8fr 1fr;
          gap: 12px;
          min-height: 0;
          overflow: hidden;
        }

        @media (max-width: 768px) {
          /* ===== ページ全体 =====
             以前は 100dvh 固定 + overflow:hidden で、配信・H2H・チャットを
             すべて1画面に押し込んでいたためチャットが極端に狭かった。
             ページ自体を下に伸ばしてスクロールできるようにする */
          .live-page {
            min-height: 100dvh !important;
            overflow: visible !important;
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
            overflow: visible !important;
            padding: 0 !important;
          }

          /* モバイルは配信を大きく使う (縦画面なので 16:9 でも高さを食わない) */
          .stream-and-h2h-sticky .stream-player-wrapper {
            max-height: none !important;
            min-height: 0 !important;
          }
          .scroll-hint { display: none !important; }

          /* ===== 固定エリア: 配信 + H2Hバー =====
             sticky で画面上部に固定し続ける。Twitch はビューポート外に出ると
             再生を停止し、戻しても自動再開しないため必須 */
          .stream-and-h2h-sticky {
            position: sticky !important;
            top: 0 !important;
            flex-shrink: 0 !important;
            z-index: 50 !important;
            background: #0a0c14 !important;
            width: 100% !important;
            min-height: 0 !important;
            display: block !important;
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
          /* BRACKET タブ表示中はモバイルでもミニプレーヤーで再生を継続する。
             上の !important ルールを打ち消す必要があるため同じく !important */
          .live-page.bracket-mini .stream-player-wrapper {
            padding-bottom: 0 !important;
            height: 0 !important;
            min-height: 0 !important;
          }
          .live-page.bracket-mini .stream-player-wrapper .stream-iframe {
            position: fixed !important;
            top: auto !important;
            left: auto !important;
            right: 8px !important;
            bottom: 8px !important;
            width: 168px !important;
            height: 95px !important;
            z-index: 200 !important;
            border-radius: 8px !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.7) !important;
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

          /* ===== 順位表 / チャット =====
             内側スクロールをやめ、ページのフローに乗せて下に伸ばす。
             チャットが十分な高さを持てるよう viewport 基準で確保する */
          .h2h-secondary {
            flex: none !important;
            overflow: visible !important;
            display: flex !important;
            flex-direction: column !important;
            grid-template-columns: unset !important;
            gap: 0 !important;
            padding: 8px !important;
            min-height: 78dvh !important;
          }

          /* タブバー: 配信(sticky)と干渉するため固定はしない */
          .mobile-tab-bar {
            display: flex !important;
            flex-shrink: 0;
            background: #0f1923 !important;
          }

          /* タブ非アクティブ時は非表示 */
          .mobile-panel-hidden {
            display: none !important;
          }

          /* アクティブパネルのラッパーは残り全高を使う */
          .h2h-secondary > div {
            flex: 1 !important;
            min-height: 0 !important;
          }

          /* チャットパネル: タブで制御するため常に非表示上書きを解除 */
          .h2h-secondary .live-chat-panel {
            display: flex !important;
            flex: 1 !important;
            min-height: 0 !important;
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
      <div className="live-content-wrapper" style={{
        flex: 1, minHeight: 0, overflow: 'visible',
        padding: '10px 16px 12px',
        display: 'flex', flexDirection: 'column', gap: 10,
        boxSizing: 'border-box' as const,
      }}>

        {/* ── モード切替トグル / カウントダウン ── */}
        {(config.startggEventId || config.liquipediaTournament || isDemo) && (
          <div className="mode-toggle" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            {/* 開始前は次の試合までのカウントダウンを表示 */}
            {!isDemo && config.liquipediaTournament && (
              <StartCountdown liquipediaTournament={config.liquipediaTournament} />
            )}
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
                {/* Unknown は「まだデータが無い」だけなので出さない */}
                {poolsData && poolsData.currentPhase && poolsData.currentPhase !== 'Unknown'
                  ? `Phase: ${poolsData.currentPhase}`
                  : ''}
              </span>
            )}
          </div>
        )}

        {displayMode === 'pools' ? (

          /* ══════════════════════════════════════════════════════════
             POOLS モード: 2カラム (配信+チャット 左 / PoolsDashboard 右)
             PlayerBand・H2Hバーは非表示。右パネルが画面上から下まで全高さ
          ══════════════════════════════════════════════════════════ */
          <div className="pools-layout">
            {/* 左カラム: 配信映像(上) + チャット(下) */}
            <div className="stream-container">
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
                  {config.startggEventId
                    ? 'start.gg の進行中セットを自動検知中'
                    : 'Liquipedia の試合スケジュールから自動検知中'} — P1 / P2 を自動更新しています
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

            {/* 下に順位表/チャットがあることを示す (PCのみ) */}
            <button
              className="scroll-hint"
              onClick={() => secondaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              aria-label="順位表とチャットへスクロール"
            >
              <span>STANDINGS ・ CHAT</span>
              <span aria-hidden="true">▼</span>
            </button>

            {/* モバイルタブバー */}
            <div className="mobile-tab-bar" style={{
              display: 'none', // PC では非表示; mobile CSS で flex に上書き
              background: '#0f1923',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              {(['standings', 'chat'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setMobileTab(tab)}
                  style={{
                    flex: 1, padding: '8px 0',
                    background: mobileTab === tab ? 'rgba(0,212,170,0.1)' : 'transparent',
                    border: 'none',
                    borderBottom: mobileTab === tab ? '2px solid #00d4aa' : '2px solid transparent',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-barlow-condensed, "Barlow Condensed", sans-serif)',
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const,
                    color: mobileTab === tab ? '#00d4aa' : '#9ca3af',
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                >
                  {tab === 'standings' ? 'STANDINGS' : 'CHAT'}
                </button>
              ))}
            </div>

            {/* セカンダリ: 順位表 / チャット (ファーストビューの下) */}
            <div className="h2h-secondary" ref={secondaryRef} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>

              <div className={mobileTab !== 'chat' ? 'mobile-panel-hidden' : undefined}>
                <SidePanelLeft
                  player1={player1} player2={player2}
                  twitchChatChannels={config.twitchChatChannels}
                  isDemo={isDemo}
                />
              </div>
              <div className={mobileTab !== 'standings' ? 'mobile-panel-hidden' : undefined}>
                <LiveStandings
                  startggMatches={startggMatches}
                  startggStandings={startggStandings}
                  upNextMatches={upNextMatches}
                  onMatchClick={(p1, p2, p1Id, p2Id) => {
                    setManualMode()
                    handleMatchClick(p1, p2, p1Id, p2Id)
                  }}
                />
              </div>
            </div>
          </>

        )}

      </div>
    </div>
  )
}
