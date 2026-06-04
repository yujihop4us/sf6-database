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

  // ── liveScore 変更時のパルスアニメーション ────────────────────────────────
  // key を変えることで CSS animation を再トリガー
  const prevScoreRef = useRef<string>('')
  const [scoreAnimKey, setScoreAnimKey] = useState(0)
  const scoreStr = liveScore ? `${liveScore.p1}-${liveScore.p2}` : ''
  useEffect(() => {
    if (scoreStr && scoreStr !== prevScoreRef.current) {
      prevScoreRef.current = scoreStr
      setScoreAnimKey(k => k + 1)
    }
  }, [scoreStr])

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

          {/* H2H バー */}
          <div className="h2h-score-bar" style={{
            background: V.surface, border: `1px solid ${V.border}`,
            borderTop: 'none', borderRadius: '0 0 10px 10px',
            padding: '14px 20px',
          }}>
            {/* ── リアルタイムゲームスコア (liveScore がある場合のみ表示) ── */}
            {liveScore !== null && (
              <>
                <style>{`
                  @keyframes sc-score-pulse {
                    0%   { transform: scale(1.22); opacity: 0.6; }
                    60%  { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(1);    opacity: 1; }
                  }
                  .sc-score-pulse { animation: sc-score-pulse 0.35s ease-out; }
                `}</style>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 0, marginBottom: 14,
                }}>
                  {/* ゲームスコアブロック */}
                  <div
                    key={scoreAnimKey}
                    className="sc-score-pulse"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: V.surface2, border: `1px solid ${V.border2}`,
                      borderRadius: 10, padding: '6px 18px',
                    }}
                  >
                    {/* ラベル */}
                    <div style={{
                      fontFamily: V.FD, fontSize: 9, fontWeight: 800,
                      letterSpacing: '0.18em', textTransform: 'uppercase' as const,
                      color: V.dim, marginRight: 10,
                    }}>GAME</div>

                    {/* P1 score */}
                    <span style={{
                      fontFamily: V.FD, fontSize: 32, fontWeight: 900,
                      lineHeight: 1,
                      color: liveScore.p1 > liveScore.p2 ? V.accent
                           : liveScore.p1 === liveScore.p2 ? V.text
                           : V.dim,
                      minWidth: 22, textAlign: 'center' as const,
                    }}>{liveScore.p1}</span>

                    <span style={{
                      fontFamily: V.FD, fontSize: 20, fontWeight: 700,
                      color: V.dim, margin: '0 6px', lineHeight: 1,
                    }}>-</span>

                    {/* P2 score */}
                    <span style={{
                      fontFamily: V.FD, fontSize: 32, fontWeight: 900,
                      lineHeight: 1,
                      color: liveScore.p2 > liveScore.p1 ? V.accent
                           : liveScore.p2 === liveScore.p1 ? V.text
                           : V.dim,
                      minWidth: 22, textAlign: 'center' as const,
                    }}>{liveScore.p2}</span>
                  </div>
                </div>
              </>
            )}

            {summary && total > 0 ? (
              <>
                {/* 勝敗数 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: V.FD, fontSize: 20, fontWeight: 900, color: p1color }}>{summary.player1_wins}</span>
                    <span style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: V.dim, textTransform: 'uppercase' }}>勝</span>
                  </div>
                  <div style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: V.dim }}>
                    通算 H2H · {total}戦
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: V.dim, textTransform: 'uppercase' }}>勝</span>
                    <span style={{ fontFamily: V.FD, fontSize: 20, fontWeight: 900, color: p2color }}>{summary.player2_wins}</span>
                  </div>
                </div>

                {/* セグメントバー: マゼンタ(P1) / ブルー(P2) */}
                <div style={{ height: 8, display: 'flex', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{
                    width: `${Math.round(summary.player1_wins / total * 100)}%`,
                    background: `linear-gradient(90deg, ${p1color}cc, ${p1color})`,
                    transition: 'width 1s ease',
                  }} />
                  <div style={{ flex: 1, background: `linear-gradient(90deg, ${p2color}, ${p2color}cc)` }} />
                </div>

                {/* 直近10試合カラーブロック */}
                {recent10.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontFamily: V.FD, fontSize: 10, color: V.dim, letterSpacing: '0.08em', marginRight: 4, flexShrink: 0 }}>
                      直近{recent10.length}試合
                    </span>
                    {recent10.map((r, i) => (
                      <div key={i} style={{
                        width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                        background: r === 'p1' ? p1color : p2color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: V.FD, fontSize: 10, fontWeight: 900, color: '#fff',
                        boxShadow: r === 'p1' ? `0 0 6px ${p1color}60` : `0 0 6px ${p2color}60`,
                      }}>
                        {r === 'p1'
                          ? (player1?.handle?.charAt(0) ?? 'P')
                          : (player2?.handle?.charAt(0) ?? 'P')}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontFamily: V.FD, fontSize: 12, color: V.dim, textAlign: 'center', padding: '4px 0' }}>
                {player1 && player2 ? 'H2H データ読み込み中...' : '選手を選択して H2H を表示'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
