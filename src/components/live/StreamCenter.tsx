'use client'

import { useState, useEffect, useRef } from 'react'
import { StreamToast, type ToastEvent } from './PoolsDashboard'
import { V, type Player, type H2HData } from './tokens'
import { LiveSetsTable } from './LiveSetsTable'
import { CountdownDisplay } from './CountdownDisplay'

export function StreamCenter({
  score, centerTab, setCenterTab,
  hasStream, streamPlatform, streamChannel,
  twitchChannels,
  isStreamLive, streamInfo,
  player1, player2, h2hData,
  tournamentId, dbTournamentId, tournamentSlug, startggMatches, configName, cc12LastUpdated,
  ewcQualifier, ewcSlots, cptPremier,
  locationLabel,
  timezone, streamStartTime, startDate, endDate,
  onMatchClick, onStreamQueueMatch,
  streamToast,
  poolsMode,
  liveScore = null,
  isDemo,
}: {
  score: { p1: number; p2: number }
  centerTab: 'stream' | 'bracket'
  setCenterTab: (t: 'stream' | 'bracket') => void
  hasStream: boolean
  streamPlatform: string | null
  streamChannel: string | null
  twitchChannels?: { name: string; channel: string }[]
  isStreamLive: boolean
  streamInfo: { title: string; viewerCount: number; gameName: string }
  player1: Player | null
  player2: Player | null
  h2hData: H2HData | null
  tournamentId: string
  dbTournamentId?: number
  tournamentSlug?: string
  startggMatches: any[]
  configName: string
  cc12LastUpdated: string
  ewcQualifier?: boolean
  ewcSlots?: number
  cptPremier?: boolean
  locationLabel?: string
  timezone: string
  streamStartTime?: string
  startDate?: string
  endDate?: string
  onMatchClick: (p1: string, p2: string) => void
  onStreamQueueMatch?: (p1Handle: string, p2Handle: string, p1PlayerId?: number, p2PlayerId?: number) => void
  streamToast?: ToastEvent | null
  poolsMode?: boolean
  /** start.gg games データから算出したリアルタイムゲームスコア */
  liveScore?: { p1: number; p2: number } | null
  /** デモモード: APIを呼ばずモックデータを表示 */
  isDemo?: boolean
}) {
  // マルチチャンネル: 選択中のチャンネルインデックス
  const [activeChanIdx, setActiveChanIdx] = useState(0)
  // アクティブストリームチャンネル (複数設定時は選択, 単一時は streamChannel)
  const activeStreamChannel = (twitchChannels && twitchChannels.length > 0)
    ? (twitchChannels[activeChanIdx]?.channel ?? streamChannel)
    : streamChannel

  // ── 現地時間 + DAY インジケーター ─────────────────────────────────────────
  const [venueTime, setVenueTime] = useState('')
  const [dayLabel, setDayLabel] = useState('')

  useEffect(() => {
    const tz = timezone || 'UTC'
    const update = () => {
      const now = new Date()
      // 現地時刻
      const timeParts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
      }).formatToParts(now)
      const tzAbbr = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, timeZoneName: 'short',
      }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? ''
      const timeStr = timeParts.map(p => p.value).join('').trim()
      const prefix = locationLabel ? `${locationLabel} — ` : ''
      setVenueTime(`${prefix}${timeStr} ${tzAbbr}`)

      // DAY X / Y 計算
      if (startDate && endDate) {
        const start = new Date(startDate + 'T00:00:00')
        const end   = new Date(endDate   + 'T23:59:59')
        const total = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
        if (now < start) {
          const d = Math.ceil((start.getTime() - now.getTime()) / 86400000)
          setDayLabel(`STARTS IN ${d}D`)
        } else if (now > end) {
          setDayLabel('COMPLETED')
        } else {
          const day = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1
          setDayLabel(`DAY ${day} / ${total}`)
        }
      } else {
        setDayLabel('')
      }
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [timezone, startDate, endDate, locationLabel])

  // ── カウントダウン (配信開始前) ───────────────────────────────────────────
  const [countdown, setCountdown] = useState('')
  // streamStartTime が未来なら最初からカウントダウン表示（iframeのチラつき防止）
  const [showStream, setShowStream] = useState(() => {
    if (!streamStartTime) return true
    return new Date(streamStartTime).getTime() <= Date.now()
  })

  useEffect(() => {
    if (!streamStartTime) { setShowStream(true); return }
    const target = new Date(streamStartTime).getTime()
    const update = () => {
      const diff = target - Date.now()
      if (diff <= 0) { setShowStream(true); setCountdown(''); return }
      setShowStream(false)
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000)  / 60000)
      const s = Math.floor((diff % 60000)    / 1000)
      const parts = d > 0
        ? [`${d}D`, String(h).padStart(2,'0'), String(m).padStart(2,'0'), String(s).padStart(2,'0')]
        : [String(h).padStart(2,'0'), String(m).padStart(2,'0'), String(s).padStart(2,'0')]
      setCountdown(parts.join(' : '))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [streamStartTime])

  // ── streamQueue 自動検出 (10秒ポーリング) ────────────────────────────────
  const [streamQueueActive, setStreamQueueActive] = useState(false)
  useEffect(() => {
    if (!tournamentSlug) return
    let autoMode = true  // 手動上書き中はスキップ
    const poll = async () => {
      if (!autoMode) return
      try {
        const res  = await fetch(`/api/stream-queue/${tournamentSlug}`)
        const data = await res.json()
        if (data.currentSet && !data.isStale) {
          setStreamQueueActive(true)
          const { p1PlayerId, p2PlayerId, p1GamerTag, p2GamerTag, p1Name, p2Name } = data.currentSet
          const p1h = p1GamerTag || p1Name || ''
          const p2h = p2GamerTag || p2Name || ''
          if (p1h && p2h && onStreamQueueMatch) {
            onStreamQueueMatch(p1h, p2h, p1PlayerId, p2PlayerId)
          }
        } else {
          setStreamQueueActive(false)
        }
      } catch { /* ネットワークエラーは無視 */ }
    }
    poll()
    const id = setInterval(poll, 10_000)
    return () => clearInterval(id)
  }, [tournamentSlug, onStreamQueueMatch])

  // liveScore は将来の拡張用に prop として保持（現在 H2H バーでは非表示）
  void liveScore

  // H2H バーは P1/P2 固定カラーで統一（キャラカラーではなく）
  const p1color = V.P1   // マゼンタ
  const p2color = V.P2   // ブルー

  const summary  = h2hData?.summary
  const total    = summary ? (summary.player1_wins + summary.player2_wins) : 0

  const recent10 = (h2hData?.sets ?? []).slice(-10).map(s => {
    if (!player1 || !player2) return null
    if (s.winner_id === player1.id) return 'p1'
    if (s.winner_id === player2.id) return 'p2'
    return null
  }).filter(Boolean) as ('p1' | 'p2')[]

  // ── Pools モード: PlayerBand / H2H バーなし、配信のみフルハイト ─────────────
  if (poolsMode) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', minHeight: 0,
        overflow: 'hidden',
      }}>
        <div className="stream-player-wrapper" style={{
          aspectRatio: '16/9',
          height: '100%', width: 'auto',
          maxWidth: '100%', maxHeight: '100%',
          position: 'relative',
          background: V.surface2, border: `1px solid ${V.border}`,
          borderRadius: 8, overflow: 'hidden', flexShrink: 0,
        }}>
          {/* チャンネル選択バー */}
          {twitchChannels && twitchChannels.length > 1 && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4,
              display: 'flex', gap: 4, flexWrap: 'wrap' as const,
              padding: '6px 10px',
              background: 'rgba(8,12,20,0.85)', backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}>
              {twitchChannels.map((ch, i) => (
                <button
                  key={ch.channel}
                  onClick={() => setActiveChanIdx(i)}
                  style={{
                    background: activeChanIdx === i ? V.surface3 : 'transparent',
                    border: `1px solid ${activeChanIdx === i ? V.accent + '55' : V.border}`,
                    borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                    fontFamily: V.FD, fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.07em',
                    color: activeChanIdx === i ? V.accent : V.muted,
                  }}
                >{ch.name}</button>
              ))}
            </div>
          )}
          {/* ストリーム本体 */}
          {(showStream && hasStream && activeStreamChannel) ? (
            <iframe
              key={activeStreamChannel}
              src={
                streamPlatform === 'twitch'
                  ? `https://player.twitch.tv/?channel=${activeStreamChannel}&parent=sf6-database.vercel.app&parent=localhost`
                  : `https://www.youtube.com/embed/${activeStreamChannel}?autoplay=1`
              }
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', maxHeight: '100%', border: 'none' }}
              allowFullScreen
              allow="autoplay; encrypted-media"
            />
          ) : (
            <CountdownDisplay
              countdown={countdown}
              streamStartTime={streamStartTime}
              configName={configName}
              streamChannel={activeStreamChannel}
            />
          )}
          {/* LIVE バッジ */}
          {isStreamLive && (
            <div style={{
              position: 'absolute', top: 12, left: 12, zIndex: 5,
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,77,106,0.9)', borderRadius: 4, padding: '4px 10px',
              fontFamily: V.FD, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#fff',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
              LIVE
            </div>
          )}
          {isStreamLive && streamInfo.viewerCount > 0 && (
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 5,
              background: 'rgba(8,12,20,0.88)', border: `1px solid ${V.border}`,
              borderRadius: 4, padding: '4px 10px',
              fontFamily: V.FD, fontSize: 12, fontWeight: 700, color: V.muted,
            }}>👁 {streamInfo.viewerCount.toLocaleString()}</div>
          )}
          {/* Pools トースト */}
          {streamToast && <StreamToast event={streamToast} />}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
      {/* ラウンド帯 + タブ */}
      <div style={{
        background: V.surface2, border: `1px solid ${V.border}`,
        borderRadius: '10px 10px 0 0', padding: '0 20px',
        display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', minHeight: 46,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
          <div style={{
            fontFamily: V.FD, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase' as const,
            color: V.accent,
          }}>{configName}</div>
          {/* EWC バッジ */}
          {ewcQualifier && (
            <span style={{
              fontFamily: V.FD, fontSize: 10, fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.45)',
              borderRadius: 4, padding: '2px 7px', color: '#f5c842',
              whiteSpace: 'nowrap' as const,
            }}>🏆 EWC {ewcSlots && `×${ewcSlots}`}</span>
          )}
          {/* CPT Premier バッジ */}
          {cptPremier && (
            <span style={{
              fontFamily: V.FD, fontSize: 10, fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              background: 'rgba(16,185,129,0.12)', border: `1px solid ${V.accent}55`,
              borderRadius: 4, padding: '2px 7px', color: V.accent,
              whiteSpace: 'nowrap' as const,
            }}>CPT PREMIER</span>
          )}
          {/* DAY インジケーター */}
          {dayLabel && (
            <span style={{
              fontFamily: V.FD, fontSize: 10, fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              background: dayLabel.startsWith('DAY') ? 'rgba(16,185,129,0.12)'
                        : dayLabel === 'COMPLETED'   ? 'rgba(100,120,140,0.15)'
                        : 'rgba(100,120,140,0.1)',
              border: `1px solid ${dayLabel.startsWith('DAY') ? V.accent + '44' : V.border}`,
              borderRadius: 4, padding: '2px 7px',
              color: dayLabel.startsWith('DAY') ? V.accent : V.muted,
              whiteSpace: 'nowrap' as const,
            }}>{dayLabel}</span>
          )}
          {/* streamQueue 自動検出バッジ */}
          {streamQueueActive && (
            <span style={{
              fontFamily: V.FD, fontSize: 9, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase' as const,
              background: 'rgba(0,212,170,0.15)', border: `1px solid ${V.accent}55`,
              borderRadius: 4, padding: '2px 7px', color: V.accent,
              whiteSpace: 'nowrap' as const, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%', background: V.accent,
                display: 'inline-block', animation: 'sf6-pulse-dot 1.2s ease-in-out infinite',
              }} />
              AUTO
            </span>
          )}
          {/* 現地時刻 */}
          {venueTime && (
            <div style={{ fontFamily: V.FD, fontSize: 12, fontWeight: 600, color: V.dim, letterSpacing: '0.04em' }}>
              {venueTime}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {[
            ...(hasStream ? [{ id: 'stream' as const, label: '▶ STREAM' }] : []),
            { id: 'bracket' as const, label: 'BRACKET' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setCenterTab(tab.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 16px',
              fontFamily: V.FD, fontSize: 12, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              color: centerTab === tab.id ? V.accent : V.muted,
              borderBottom: centerTab === tab.id ? `2px solid ${V.accent}` : '2px solid transparent',
              transition: 'color 0.15s',
            }}>{tab.label}</button>
          ))}
        </div>
      </div>

      {/* ブラケットタブ: 配信画面と同じ aspect-ratio で高さ固定 */}
      {centerTab === 'bracket' && (
        <div style={{
          border: `1px solid ${V.border}`, borderTop: 'none',
          borderRadius: '0 0 10px 10px', background: V.surface,
          aspectRatio: '16/9', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <LiveSetsTable
            tournamentId={tournamentId}
            dbTournamentId={dbTournamentId}
            onMatchClick={onMatchClick}
            isDemo={isDemo}
          />
        </div>
      )}

      {/* ストリームタブ */}
      {centerTab === 'stream' && (
        <>
          {/* ── チャンネル選択バー (複数チャンネル設定時) ── */}
          {twitchChannels && twitchChannels.length > 1 && (
            <div style={{
              display: 'flex', gap: 4, flexWrap: 'wrap' as const,
              padding: '8px 14px',
              background: V.surface2,
              border: `1px solid ${V.border}`, borderTop: 'none',
            }}>
              {twitchChannels.map((ch, i) => (
                <button
                  key={ch.channel}
                  onClick={() => setActiveChanIdx(i)}
                  style={{
                    background: activeChanIdx === i ? V.surface3 : 'transparent',
                    border: `1px solid ${activeChanIdx === i ? V.accent + '55' : V.border}`,
                    borderRadius: 5, padding: '4px 12px', cursor: 'pointer',
                    fontFamily: V.FD, fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.07em',
                    color: activeChanIdx === i ? V.accent : V.muted,
                    transition: 'color 0.15s, background 0.15s',
                  }}
                >{ch.name}</button>
              ))}
            </div>
          )}

          {/* ストリーム埋め込み */}
          <div className="stream-player-wrapper" style={{
            position: 'relative', width: '100%', aspectRatio: '16/9',
            background: V.surface2,
            border: `1px solid ${V.border}`, borderTop: 'none',
            overflow: 'hidden',
          }}>
            {/* カラーティント */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(160deg, ${p1color}0a 0%, ${V.bg} 50%, ${p2color}0a 100%)`,
            }} />

            {(showStream && hasStream && activeStreamChannel) ? (
              <iframe
                key={activeStreamChannel}
                src={
                  streamPlatform === 'twitch'
                    ? `https://player.twitch.tv/?channel=${activeStreamChannel}&parent=sf6-database.vercel.app&parent=localhost`
                    : `https://www.youtube.com/embed/${activeStreamChannel}?autoplay=1`
                }
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                allowFullScreen
                allow="autoplay; encrypted-media"
              />
            ) : (
              <CountdownDisplay
                countdown={countdown}
                streamStartTime={streamStartTime}
                configName={configName}
                streamChannel={activeStreamChannel}
              />
            )}

            {/* LIVE バッジ */}
            {isStreamLive && (
              <div style={{
                position: 'absolute', top: 12, left: 12,
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,77,106,0.9)', borderRadius: 4, padding: '4px 10px',
                fontFamily: V.FD, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#fff',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                LIVE
              </div>
            )}
            {isStreamLive && streamInfo.viewerCount > 0 && (
              <div style={{
                position: 'absolute', top: 12, right: 12,
                background: 'rgba(8,12,20,0.88)', border: `1px solid ${V.border}`,
                borderRadius: 4, padding: '4px 10px',
                fontFamily: V.FD, fontSize: 12, fontWeight: 700, color: V.muted,
              }}>👁 {streamInfo.viewerCount.toLocaleString()}</div>
            )}

            {/* Pools toast overlay */}
            {streamToast && <StreamToast event={streamToast} />}

          </div>

          {/* ── H2H バー (1行コンパクト) ── */}
          <style>{`
            /* ===== H2H バー ===== */
            .h2h-score-bar {
              background: linear-gradient(90deg,
                rgba(99,102,241,0.08) 0%,
                rgba(251,191,36,0.06) 50%,
                rgba(239,68,68,0.08) 100%
              ) !important;
              border-top: none !important;
              border-bottom: 1px solid rgba(251,191,36,0.18) !important;
            }

            /* 勝敗エリア — 1行横並び */
            .h2h-wins-left {
              display: flex; flex-direction: row;
              align-items: center; justify-content: flex-end;
              gap: 6px; min-width: auto;
            }
            .h2h-wins-right {
              display: flex; flex-direction: row;
              align-items: center; justify-content: flex-start;
              gap: 6px; min-width: auto;
            }
            .h2h-player-name {
              font-family: var(--font-barlow-condensed,"Barlow Condensed",sans-serif);
              font-size: 14px; font-weight: 500;
              color: rgba(255,255,255,0.55);
              overflow: hidden; text-overflow: ellipsis;
              white-space: nowrap; max-width: 110px;
              margin-bottom: 0;
            }
            .h2h-win-count {
              font-family: var(--font-barlow-condensed,"Barlow Condensed",sans-serif);
              font-size: 20px; font-weight: 800;
              color: #ffffff; line-height: 1;
              transition: all 0.3s ease;
            }
            /* 勝ち越し — ゴールド＋グロウ */
            .h2h-wins-leading .h2h-win-count {
              font-size: 26px; color: #fbbf24;
              text-shadow: 0 0 8px rgba(251,191,36,0.55), 0 0 18px rgba(251,191,36,0.3);
            }
            .h2h-wins-leading .h2h-player-name { color: #fcd34d; font-weight: 700; }
            /* タイ */
            .h2h-wins-tied .h2h-win-count { font-size: 22px; color: #e2e8f0; }

            /* 中央バッジ — 縦3段（⚔ / HEAD TO HEAD / N戦） */
            .h2h-center-badge {
              display: flex; flex-direction: column;
              align-items: center; gap: 0px;
              padding: 2px 20px;
            }
            @keyframes vsGlow {
              from { filter: drop-shadow(0 0 4px rgba(251,191,36,0.4)); transform: scale(1); }
              to   { filter: drop-shadow(0 0 12px rgba(251,191,36,0.9)) drop-shadow(0 0 22px rgba(251,191,36,0.35)); transform: scale(1.12); }
            }
            .h2h-vs-icon {
              font-size: 22px; line-height: 1;
              animation: vsGlow 2s ease-in-out infinite alternate;
              display: inline-block;
            }
            .h2h-label {
              font-family: var(--font-barlow-condensed,"Barlow Condensed",sans-serif);
              font-size: 11px; font-weight: 800; letter-spacing: 4px;
              text-transform: uppercase; color: rgba(255,255,255,0.7);
              white-space: nowrap; line-height: 1; margin-top: 1px;
            }
            .h2h-match-count {
              font-family: var(--font-barlow-condensed,"Barlow Condensed",sans-serif);
              font-size: 13px; font-weight: 700; color: #fbbf24;
              line-height: 1; margin-top: 2px;
            }

            /* セグメントバー */
            .h2h-seg-bar {
              height: 4px; display: flex; border-radius: 2px; overflow: hidden; width: 100%;
            }

            /* モバイル 768px */
            @media (max-width: 768px) {
              .h2h-win-count { font-size: 16px !important; }
              .h2h-wins-leading .h2h-win-count { font-size: 20px !important; }
              .h2h-wins-tied .h2h-win-count { font-size: 18px !important; }
              .h2h-player-name { font-size: 12px !important; max-width: 80px !important; }
              .h2h-center-badge { flex-direction: column !important; gap: 0px !important; padding: 2px 12px !important; }
              .h2h-vs-icon { font-size: 16px !important; }
              .h2h-label { font-size: 8px !important; letter-spacing: 2.5px !important; }
              .h2h-match-count { font-size: 11px !important; }
            }
            /* モバイル 480px */
            @media (max-width: 480px) {
              .h2h-win-count { font-size: 14px !important; }
              .h2h-wins-leading .h2h-win-count { font-size: 18px !important; }
              .h2h-center-badge { padding: 2px 8px !important; }
              .h2h-vs-icon { font-size: 14px !important; }
              .h2h-label { font-size: 7px !important; letter-spacing: 2px !important; display: block !important; }
              .h2h-match-count { font-size: 10px !important; }
              .h2h-player-name { font-size: 11px !important; max-width: 60px !important; }
            }

            /* ティッカー */
            @keyframes h2hTickerScroll {
              0%   { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .h2h-ticker-track {
              animation: h2hTickerScroll ${Math.max(30, (h2hData?.sets?.length ?? 5) * 8)}s linear infinite;
            }
            .h2h-ticker-track:hover { animation-play-state: paused; }
          `}</style>
          <div className="h2h-score-bar" style={{
            border: `1px solid ${V.border}`,
            borderRadius: total > 0 ? '0' : '0 0 10px 10px',
            padding: '6px 16px',
          }}>
            {total > 0 ? (
              (() => {
                const p1w = summary!.player1_wins
                const p2w = summary!.player2_wins
                const p1Leading = p1w > p2w
                const p2Leading = p2w > p1w
                const tied      = p1w === p2w
                return (
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center', gap: 8,
                  }}>
                    {/* P1: 名前 → 勝数 */}
                    <div className={`h2h-wins-left${p1Leading ? ' h2h-wins-leading' : ''}${tied ? ' h2h-wins-tied' : ''}`}>
                      <span className="h2h-player-name">{player1?.handle ?? 'P1'}</span>
                      <span className="h2h-win-count">{p1w}</span>
                    </div>
                    {/* 中央バッジ: ⚔ HEAD TO HEAD 5戦 */}
                    <div className="h2h-center-badge">
                      <span className="h2h-vs-icon">⚔</span>
                      <span className="h2h-label">HEAD TO HEAD</span>
                      <span className="h2h-match-count">{total}戦</span>
                    </div>
                    {/* P2: 勝数 → 名前 */}
                    <div className={`h2h-wins-right${p2Leading ? ' h2h-wins-leading' : ''}${tied ? ' h2h-wins-tied' : ''}`}>
                      <span className="h2h-win-count">{p2w}</span>
                      <span className="h2h-player-name">{player2?.handle ?? 'P2'}</span>
                    </div>
                  </div>
                )
              })()
            ) : (
              <div style={{ fontFamily: V.FD, fontSize: 12, color: V.dim, textAlign: 'center', padding: '2px 0' }}>
                {player1 && player2 ? 'H2H データ読み込み中...' : '選手を選択して H2H を表示'}
              </div>
            )}
          </div>

          {/* セグメントバー（カラーブロックは削除して1段に圧縮） */}
          {total > 0 && (
            <div style={{
              background: V.surface, border: `1px solid ${V.border}`, borderTop: 'none',
              borderRadius: h2hData?.sets && h2hData.sets.length > 0 && player1 && player2 ? '0' : '0 0 10px 10px',
              padding: '5px 16px 6px',
            }}>
              <div className="h2h-seg-bar">
                <div style={{
                  width: `${Math.round(summary!.player1_wins / total * 100)}%`,
                  background: `linear-gradient(90deg, ${p1color}cc, ${p1color})`,
                  transition: 'width 1s ease',
                }} />
                <div style={{ flex: 1, background: `linear-gradient(90deg, ${p2color}, ${p2color}cc)` }} />
              </div>
            </div>
          )}

          {/* ── H2H ティッカー ── */}
          {h2hData?.sets && h2hData.sets.length > 0 && player1 && player2 && (
            <div className="h2h-ticker-container" style={{
              overflow: 'hidden', whiteSpace: 'nowrap',
              background: 'rgba(0,0,0,0.4)',
              border: `1px solid ${V.border}`, borderTop: 'none',
              borderRadius: '0 0 10px 10px',
              height: 32, display: 'flex', alignItems: 'center',
              position: 'relative',
            }}>
              {/* スクロールトラック（2回繰り返してシームレスループ） */}
              <div className="h2h-ticker-track" style={{
                display: 'inline-flex', alignItems: 'center',
                gap: 60, paddingLeft: 16,
              }}>
                {[...[...h2hData.sets].reverse(), ...[...h2hData.sets].reverse()].map((set, i) => {
                  const isP1win = set.winner_id === player1.id
                  const p1score = isP1win ? set.winner_score : set.loser_score
                  const p2score = isP1win ? set.loser_score  : set.winner_score
                  return (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontFamily: V.FD, fontSize: 12, color: '#9ca3af' }}>{set.tournament_name}</span>
                      <span style={{ color: '#6b7280', fontSize: 11 }}>·</span>
                      <span style={{ fontFamily: V.FD, fontSize: 11, color: '#9ca3af' }}>{set.round_text}</span>
                      <span style={{ color: '#6b7280', margin: '0 3px', fontSize: 12 }}>▸</span>
                      <span style={{ fontFamily: V.FD, fontSize: 13, fontWeight: isP1win ? 800 : 400, color: isP1win ? '#4ade80' : '#d1d5db' }}>{player1.handle}</span>
                      <span style={{ fontFamily: V.FD, fontSize: 13, fontWeight: 700, color: '#ffffff', margin: '0 2px' }}>{p1score}–{p2score}</span>
                      <span style={{ fontFamily: V.FD, fontSize: 13, fontWeight: isP1win ? 400 : 800, color: isP1win ? '#d1d5db' : '#4ade80' }}>{player2.handle}</span>
                      <span style={{ fontFamily: V.FD, fontSize: 9, color: `${V.dim}66`, marginLeft: 2 }}>{set.tournament_date}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
