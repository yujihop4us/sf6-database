'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { use } from 'react'
import SiteNavbar from '@/components/SiteNavbar'
import { PoolsDashboard, StreamToast, type PoolsData, type ToastEvent } from '@/components/live/PoolsDashboard'
import { resolveTournamentConfig } from './tournamentConfig'
import { usePoolsDashboard } from '@/hooks/usePoolsDashboard'
import { useStartggPolling }  from '@/hooks/useStartggPolling'
import { useAutoDetect }      from '@/hooks/useAutoDetect'
import { V, cc, codeToFlag, type Player, type SetData, type H2HData } from '@/components/live/tokens'
import { CharPill } from '@/components/live/CharPill'
import { PlayerBand } from '@/components/live/PlayerBand'
import { LiveSetsTable } from '@/components/live/LiveSetsTable'
import { LiveBracket } from '@/components/live/LiveBracket'
import { FeaturedMatchesPanel, NextMatchesPanel } from '@/components/live/FeaturedMatchesPanel'
import { SearchModal } from '@/components/live/SearchModal'

// ── StreamCenter ──────────────────────────────────────────────────────────────

function StreamCenter({
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
  }, [timezone, startDate, endDate])

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
        <div style={{
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
          <div style={{
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
          <div style={{
            background: V.surface, border: `1px solid ${V.border}`,
            borderTop: 'none', borderRadius: '0 0 10px 10px',
            padding: '14px 20px',
          }}>
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

// ── LiveChat ──────────────────────────────────────────────────────────────────

const INIT_CHAT = [
  { id: 1, user: 'sf6_fan',    color: '#10b981', msg: '試合開始！' },
  { id: 2, user: 'evo_viewer', color: '#3b82f6', msg: '今日の試合楽しみ' },
  { id: 3, user: 'hadouken',   color: '#f5a623', msg: '選手を選択してH2Hを確認しよう' },
  { id: 4, user: 'capcom_pro', color: '#2e9e5b', msg: 'ブラケット確認中' },
  { id: 5, user: 'tokyoFC',    color: '#ec4899', msg: 'よろしくお願いします！' },
]

function LiveChat({
  twitchChatChannels,
  fillHeight = false,
}: {
  twitchChatChannels?: string[]
  fillHeight?: boolean
}) {
  const [selectedIdx, setSelectedIdx]   = useState(0)
  const [messages, setMessages]         = useState(INIT_CHAT)
  const [input, setInput]               = useState('')
  const bottomRef                       = useRef<HTMLDivElement>(null)
  const idRef                           = useRef(6)

  // ── Twitch chat iframe mode ──────────────────────────────────────────────
  if (twitchChatChannels && twitchChatChannels.length > 0) {
    const channel = twitchChatChannels[selectedIdx] ?? twitchChatChannels[0]
    return (
      // fillHeight=true: 親の flex-fill に合わせて伸縮。false: 固定 420px (後方互換)
      <div style={{
        display: 'flex', flexDirection: 'column',
        ...(fillHeight ? { flex: 1, minHeight: 0 } : { height: 420 }),
      }}>
        {/* チャンネル切り替え (複数ある場合) */}
        {twitchChatChannels.length > 1 && (
          <div style={{
            display: 'flex', gap: 4, padding: '6px 10px',
            borderBottom: `1px solid ${V.border}`, background: V.surface2,
            flexWrap: 'wrap' as const, flexShrink: 0,
          }}>
            {twitchChatChannels.map((ch, i) => (
              <button key={ch} onClick={() => setSelectedIdx(i)} style={{
                background: selectedIdx === i ? V.surface3 : 'transparent',
                border: `1px solid ${selectedIdx === i ? V.accent + '50' : V.border}`,
                borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                fontFamily: V.FD, fontSize: 11, fontWeight: 700,
                color: selectedIdx === i ? V.accent : V.muted,
              }}>{ch}</button>
            ))}
          </div>
        )}
        {/* iframe を overflow:hidden でラップしてチャット入力欄を隠す
            Twitch の darkpopout では:
              下部 ~52px = chat input box (display-only では不要)
              上部 ~1px  = border
            ランキング・お知らせは Twitch 側 UI のため公式パラメータでは非表示不可。
            もし上部バナーが邪魔な場合は marginTop: -56 + height calc を追加 */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
          <iframe
            key={channel}
            src={`https://www.twitch.tv/embed/${channel}/chat?parent=localhost&parent=sf6-database.vercel.app&darkpopout`}
            style={{
              border: 'none', width: '100%',
              // 親より 52px 背高く stretch → 下部の chat input が clipping で隠れる
              height: 'calc(100% + 52px)',
              display: 'block',
            }}
            title={`Twitch chat: ${channel}`}
            allowFullScreen
          />
        </div>
      </div>
    )
  }

  // ── Fallback: モックチャット ──────────────────────────────────────────────
  useEffect(() => {
    if (bottomRef.current?.parentElement) {
      bottomRef.current.parentElement.scrollTop = bottomRef.current.parentElement.scrollHeight
    }
  }, [messages])

  const send = () => {
    if (!input.trim()) return
    const now  = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setMessages(prev => [...prev.slice(-40), {
      id: idRef.current++, user: 'あなた', color: V.accent,
      msg: input.trim(), time, isMe: true,
    } as any])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 260 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.map((m: any) => (
          <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontFamily: V.FD, fontSize: 12, fontWeight: 700, color: m.color, flexShrink: 0, minWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user}</span>
            <span style={{ fontFamily: V.FB, fontSize: 13, color: m.isMe ? V.accent : V.text, lineHeight: 1.4 }}>{m.msg}</span>
            {m.time && <span style={{ marginLeft: 'auto', fontFamily: V.FD, fontSize: 10, color: V.dim, flexShrink: 0 }}>{m.time}</span>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ borderTop: `1px solid ${V.border}`, padding: '10px 14px', display: 'flex', gap: 8 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="コメントを入力..."
          style={{
            flex: 1, background: V.surface3, border: `1px solid ${V.border}`,
            borderRadius: 6, padding: '7px 12px',
            color: V.text, fontFamily: V.FB, fontSize: 13, outline: 'none',
          }}
        />
        <button onClick={send} style={{
          background: V.accent, border: 'none', borderRadius: 6,
          padding: '7px 14px', cursor: 'pointer',
          fontFamily: V.FD, fontSize: 12, fontWeight: 800,
          letterSpacing: '0.06em', color: '#000',
        }}>送信</button>
      </div>
    </div>
  )
}


// ── SidePanelLeft — Twitch チャット表示 ────────────────────────────────────────

function SidePanelLeft({
  twitchChatChannels,
}: {
  player1: Player | null
  player2: Player | null
  twitchChatChannels?: string[]
}) {
  return (
    <div style={{
      background: V.surface, border: `1px solid ${V.border}`, borderRadius: 10,
      overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      {/* ヘッダー */}
      <div style={{
        background: V.surface2, borderBottom: `1px solid ${V.border}`,
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: V.FD, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase' as const,
          color: V.accent,
        }}>💬 LIVE CHAT</div>
      </div>
      {/* チャット本体: flex-fill で残り高さを全て使う */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <LiveChat twitchChatChannels={twitchChatChannels} fillHeight />
      </div>
    </div>
  )
}

// ── CountdownDisplay — 配信前カウントダウンオーバーレイ ────────────────────────

function CountdownDisplay({
  countdown, streamStartTime, configName, streamChannel,
}: {
  countdown: string
  streamStartTime?: string
  configName: string
  streamChannel: string | null
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(160deg, #050810 0%, #0a0e1a 60%, #060c18 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 18,
    }}>
      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(16,185,129,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      {/* Glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400, height: 200,
        background: `radial-gradient(ellipse, ${V.accent}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* 大会名 */}
      <div style={{
        position: 'relative',
        fontFamily: V.FD, fontSize: 12, fontWeight: 700,
        letterSpacing: '0.22em', textTransform: 'uppercase' as const,
        color: 'rgba(255,255,255,0.35)',
      }}>{configName}</div>

      {/* カウントダウン or Coming Soon */}
      <div style={{ position: 'relative', textAlign: 'center' }}>
        {countdown ? (
          <>
            <div style={{
              fontFamily: V.FD, fontSize: 11, fontWeight: 600,
              letterSpacing: '0.18em', textTransform: 'uppercase' as const,
              color: 'rgba(255,255,255,0.25)', marginBottom: 8,
            }}>配信開始まで</div>
            <div style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 'clamp(26px, 4.5vw, 50px)', fontWeight: 700,
              color: '#ffffff', letterSpacing: '0.08em',
              textShadow: `0 0 32px ${V.accent}55`,
            }}>{countdown}</div>
          </>
        ) : streamStartTime ? (
          <div style={{ fontFamily: V.FD, fontSize: 18, fontWeight: 700, color: V.accent, letterSpacing: '0.08em' }}>
            配信開始間近...
          </div>
        ) : (
          <div style={{ fontFamily: V.FD, fontSize: 15, color: V.muted, letterSpacing: '0.1em' }}>
            配信開始時刻 — COMING SOON
          </div>
        )}
      </div>

      {/* チャンネルリンク */}
      {streamChannel && (
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{
            fontFamily: V.FD, fontSize: 10, color: 'rgba(255,255,255,0.22)',
            letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: 5,
          }}>配信チャンネル</div>
          <a href={`https://twitch.tv/${streamChannel}`} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: V.FD, fontSize: 13, fontWeight: 700, color: V.accent, letterSpacing: '0.06em', textDecoration: 'none' }}>
            twitch.tv/{streamChannel}
          </a>
        </div>
      )}
    </div>
  )
}


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
  const handleMatchClick = async (p1n: string, p2n: string) => {
    // "TEAM | Handle" 形式をクリーニング — start.gg entrant name には
    // チームプレフィックスが入るが DB の handle はプレフィックスなし
    const stripTeam = (n: string) =>
      n.includes(' | ') ? n.split(' | ').slice(1).join(' | ').trim() : n

    const find = async (rawName: string, side: 'p1' | 'p2') => {
      const name = stripTeam(rawName)
      try {
        const res  = await fetch('/api/players/search?q=' + encodeURIComponent(name))
        const data = await res.json()
        const found =
          // 完全一致を優先
          (data.players || []).find((p: Player) => p.handle.toLowerCase() === name.toLowerCase()) ||
          // フォールバック: 元の名前でも試す (team prefix 込み)
          (rawName !== name
            ? (data.players || []).find((p: Player) => p.handle.toLowerCase() === rawName.toLowerCase())
            : null) ||
          (data.players || [])[0]
        if (found) { if (side === 'p1') setPlayer1(found); else setPlayer2(found) }
      } catch (e) { console.error(e) }
    }
    find(p1n, 'p1'); find(p2n, 'p2')
  }

  // ── start.gg 自動検知 ────────────────────────────────────────────────────
  const { autoDetected, setManualMode } = useAutoDetect(
    startggMatches,
    config.startggEventId,
    (p1, p2) => { setScore({ p1: 0, p2: 0 }); handleMatchClick(p1, p2) },
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
                onStreamQueueMatch={(p1h, p2h) => handleMatchClick(p1h, p2h)}
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
                onStreamQueueMatch={(p1h, p2h) => handleMatchClick(p1h, p2h)}
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
              <FeaturedMatchesPanel
                matches={upNextMatches}
                mode={featuredMode}
                onMatchClick={(p1, p2) => {
                  setManualMode()
                  handleMatchClick(p1, p2)
                }}
              />
            </div>
          </>

        )}

      </div>
    </div>
  )
}
