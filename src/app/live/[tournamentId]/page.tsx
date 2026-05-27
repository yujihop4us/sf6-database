'use client'

import { useState, useEffect, useCallback } from 'react'
import { use } from 'react'
import SiteNavbar from '@/components/SiteNavbar'
import { PoolsDashboard, type PoolsData, type ToastEvent } from '@/components/live/PoolsDashboard'
import { resolveTournamentConfig } from './tournamentConfig'
import { usePoolsDashboard } from '@/hooks/usePoolsDashboard'
import { useStartggPolling }  from '@/hooks/useStartggPolling'
import { useAutoDetect }      from '@/hooks/useAutoDetect'
import { V, type Player, type H2HData } from '@/components/live/tokens'
import { PlayerBand } from '@/components/live/PlayerBand'
import { FeaturedMatchesPanel } from '@/components/live/FeaturedMatchesPanel'
import { LiveStandings } from '@/components/live/LiveStandings'
import { SearchModal } from '@/components/live/SearchModal'
import { StreamCenter } from '@/components/live/StreamCenter'
import { SidePanelLeft } from '@/components/live/SidePanelLeft'
import { normalizePlayerName } from '@/lib/normalizePlayerName'

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LivePage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params)

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
  const { config, configKey } = resolveTournamentConfig(tournamentId)

  // stream-queue API 用スラッグ: 数値 ID の場合でも slug キーを取得
  const effectiveTournamentSlug: string | undefined = isNaN(Number(tournamentId))
    ? tournamentId
    : (configKey && isNaN(Number(configKey)) ? configKey : undefined)
  const hasStream      = !!config.streamPlatform && !!config.streamChannel
  const streamPlatform = config.streamPlatform
  const streamChannel  = config.streamChannel

  // ── フック: pools-dashboard / startgg ポーリング ─────────────────────────
  const {
    poolsData, displayMode, setDisplayMode,
    displayModeManual, setDisplayModeManual,
    streamToast, setStreamToast, streamToastTimer,
  } = usePoolsDashboard(config.dbTournamentId)

  const {
    startggMatches, cc12Matches, cc12LastUpdated,
    mergedPhases, upNextMatches, featuredMode,
  } = useStartggPolling({
    startggEventId: config.startggEventId,
    endDate: config.endDate,
    phases: config.phases,
    hasStream,
    searchQuery,
  })

  // クロックは StreamCenter 内で timezone ベースに計算

  // ── Twitch ポーリング (30秒) ──────────────────────────────────────────────
  useEffect(() => {
    if (!config.streamChannel || config.streamPlatform !== 'twitch') return
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
  }, [config.streamChannel, config.streamPlatform])

  // ── H2H フェッチ ─────────────────────────────────────────────────────────
  const fetchH2H = useCallback(async (p1Id: number, p2Id: number) => {
    const res  = await fetch(`/api/head-to-head?p1=${p1Id}&p2=${p2Id}`)
    const data = await res.json()
    setH2hData(data)
  }, [])
  useEffect(() => {
    if (player1 && player2) fetchH2H(player1.id, player2.id)
    else setH2hData(null)
  }, [player1, player2, fetchH2H])

  // ── 選手検索 (300ms デバウンス) ──────────────────────────────────────────
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      const res  = await fetch(`/api/players/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setSearchResults(data.players || [])
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])


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

  // ── start.gg 自動検知 ────────────────────────────────────────────────────
  const { autoDetected, setManualMode } = useAutoDetect(
    startggMatches,
    config.startggEventId,
    (p1, p2, p1Id, p2Id) => { setScore({ p1: 0, p2: 0 }); handleMatchClick(p1, p2, p1Id, p2Id) },
  )

  // ── レンダー ──────────────────────────────────────────────────────────────
  return (
    <div style={{
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
      <SiteNavbar activePage="live" isLive={isStreamLive} breadcrumb={[{ label: config.name }]} />

      {/* メインコンテンツ: navbar の下に残り全高さを使う */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        padding: '10px 16px 12px', maxWidth: 1600, margin: '0 auto', width: '100%',
        display: 'flex', flexDirection: 'column', gap: 10,
        boxSizing: 'border-box' as const,
      }}>

        {/* ── モード切替トグル ── */}
        {config.startggEventId && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            <span style={{ fontFamily: V.FD, fontSize: 10, color: V.dim, letterSpacing: '0.08em' }}>
              {poolsData ? `Phase: ${poolsData.currentPhase}` : ''}
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
            {displayModeManual && (
              <button onClick={() => setDisplayModeManual(false)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: V.dim, fontSize: 11, padding: '0 4px',
              }} title="自動判定に戻す">AUTO</button>
            )}
          </div>
        )}

        {displayMode === 'pools' ? (

          /* ══════════════════════════════════════════════════════════
             POOLS モード: 2カラム (配信+チャット 左 / PoolsDashboard 右)
             PlayerBand・H2Hバーは非表示。右パネルが画面上から下まで全高さ
          ══════════════════════════════════════════════════════════ */
          <div style={{
            flex: 1, minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 380px',
            gap: 12,
          }}>
            {/* 左カラム: 配信映像(上) + チャット(下) */}
            <div style={{
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
              />
              <SidePanelLeft
                player1={player1} player2={player2}
                twitchChatChannels={config.twitchChatChannels}
              />
            </div>

            {/* 右カラム: PoolsDashboard 全高さ */}
            <PoolsDashboard
              data={poolsData}
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

            {/* 3カラム フェイスオフ */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '220px 1fr 220px',
              gap: 0, borderRadius: 12, overflow: 'hidden',
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
              />
              <PlayerBand
                player={player2} score={score.p2} side="right"
                isWinning={score.p2 > score.p1}
                onSelectPlayer={() => openSearch('p2')}
                scoreState={score}
                onScoreChange={d => setScore(s => ({ ...s, p2: Math.max(0, s.p2 + d) }))}
              />
            </div>

            {/* セカンダリ: H2H */}
            <div style={{
              flex: 1, minHeight: 0,
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>
              <SidePanelLeft
                player1={player1} player2={player2}
                twitchChatChannels={config.twitchChatChannels}
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
