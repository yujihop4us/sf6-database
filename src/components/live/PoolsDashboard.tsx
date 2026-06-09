'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ── Design tokens (pools.html CSS variables) ──────────────────────────────────

const V = {
  bg:        '#0a0a0f',
  surface:   '#12121a',
  surface2:  '#1a1a24',
  surface3:  '#22222e',
  border:    'rgba(255,255,255,0.06)',
  border2:   'rgba(255,255,255,0.12)',
  accent:    '#00ffb3',
  accentDim: 'rgba(0,255,179,0.10)',
  red:       '#ff3c3c',
  redDim:    'rgba(255,60,60,0.10)',
  gold:      '#ffc832',
  goldDim:   'rgba(255,200,50,0.10)',
  text:      '#e0e0e0',
  muted:     '#888',
  dim:       '#555',
  FD:        "'Barlow Condensed', sans-serif",
  FB:        "'Barlow', sans-serif",
} as const

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiFeedEvent {
  type: 'UPSET' | 'QUALIFIED_W' | 'QUALIFIED_L' | 'ELIMINATED' | 'MARQUEE_RESULT'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  timestamp: number
  pool: string
  phase: string
  round: string
  message: string
  players: { name: string; handle: string; seed: number | null }[]
  score: string
}

interface ApiQualifiedPlayer {
  name: string
  handle: string
  seed: number | null
  side: 'winners' | 'losers'
  pool: string
  phase: string
}

interface ApiPoolProgress {
  id: string
  phase: string
  completed: number
  total: number
  percent: number
}

export interface PoolsData {
  currentPhase: string
  overallProgress: Record<string, { completed: number; total: number; percent: number }>
  feed: ApiFeedEvent[]
  qualified: ApiQualifiedPlayer[]
  pools: ApiPoolProgress[]
  lastUpdated?: string
  setsAnalyzed?: number
  newestEventTs?: number  // 最新イベントの UNIX タイム
}

export interface ToastEvent {
  kind: 'UPSET' | 'MARQUEE'
  p1: string
  p1seed: number | null
  p2: string
  p2seed: number | null
  s1: number
  s2: number
  pool: string
  round: string
  timestamp?: number  // アニメーション再起動用（新イベント到着時に key を変える）
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseScore(score: string): [number, number] {
  const parts = score.split('-').map(Number)
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]]
  }
  return [0, 0]
}

function fmtTimestamp(ts: number): string {
  const d = new Date(ts * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function extractQualifierHandle(message: string): string {
  // "✅ WinnerHandle → Top Cut (Winners) [Pool X]"
  return message.replace('✅ ', '').split(' → ')[0].trim()
}

// ── CSS keyframes injected once ───────────────────────────────────────────────

function usePoolsStyles() {
  useEffect(() => {
    const id = 'pools-dashboard-styles'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes pd-slide-in {
        from { opacity:0; transform:translateY(-6px); }
        to   { opacity:1; transform:translateY(0); }
      }
      @keyframes pd-fade-swap {
        from { opacity:0; transform:scale(0.97); }
        to   { opacity:1; transform:scale(1); }
      }
      @keyframes pd-glow-pulse-red {
        0%,100% { box-shadow:0 0 18px rgba(255,60,60,0.22); }
        50%     { box-shadow:0 0 30px rgba(255,60,60,0.45); }
      }
      @keyframes pd-glow-pulse-gold {
        0%,100% { box-shadow:0 0 18px rgba(255,200,50,0.20); }
        50%     { box-shadow:0 0 30px rgba(255,200,50,0.40); }
      }
      @keyframes pd-flash-in {
        0%   { background:rgba(0,255,179,0.22); }
        100% { background:transparent; }
      }
      @keyframes pd-badge-pop {
        0%   { transform:scale(0); }
        60%  { transform:scale(1.25); }
        100% { transform:scale(1); }
      }
      @keyframes pd-badge-pulse {
        0%,100% { box-shadow:0 0 0 0 rgba(255,60,60,0.6); }
        100%    { box-shadow:0 0 0 6px rgba(255,60,60,0); }
      }
      @keyframes pd-toast-flash {
        0%   { transform:translateY(60px); opacity:0; }
        6%   { transform:translateY(0);    opacity:1; }
        94%  { transform:translateY(0);    opacity:1; }
        100% { transform:translateY(60px); opacity:0; }
      }
      .pd-plink {
        color: #e0e0e0;
        text-decoration: none;
        font-weight: 700;
        font-family: 'Barlow Condensed', sans-serif;
        letter-spacing: 0.01em;
        border-bottom: 1px solid transparent;
        transition: color 0.1s, border-color 0.1s;
        cursor: pointer;
      }
      .pd-plink:hover { color: #00ffb3; border-bottom-color: rgba(0,255,179,0.4); }
      .pd-plink.dim   { color: #888; font-weight: 600; }
      .pd-plink.dim:hover { color: #00ffb3; }
      .pd-qualified-row:hover { background: rgba(255,255,255,0.03); }
    `
    document.head.appendChild(style)
    return () => { document.getElementById(id)?.remove() }
  }, [])
}

// ── PlayerLink ────────────────────────────────────────────────────────────────

function PlayerLink({ handle, dim, prefix }: { handle: string; dim?: boolean; prefix?: string }) {
  return (
    <Link href={`/player/${encodeURIComponent(handle)}`} className={`pd-plink${dim ? ' dim' : ''}`}>
      {prefix && <span style={{ color: V.dim, fontSize: '0.85em', marginRight: 3, fontWeight: 600 }}>{prefix}</span>}
      {handle}
    </Link>
  )
}

// ── HighlightCard ─────────────────────────────────────────────────────────────

function HighlightCard({ event }: { event: ToastEvent | null }) {
  if (!event) return null
  const isUpset = event.kind === 'UPSET'
  const color   = isUpset ? V.red : V.gold
  const glowSoft = isUpset ? 'rgba(255,60,60,0.18)' : 'rgba(255,200,50,0.18)'
  const glowHard = isUpset ? 'rgba(255,60,60,0.35)' : 'rgba(255,200,50,0.30)'
  const icon     = isUpset ? '🔥' : '⚔️'
  // timestamp が変わるたびに React がノードを再マウント → animation が最初から再生される
  const animKey  = `${event.kind}-${event.timestamp ?? event.p1}`

  return (
    <div
      key={animKey}
      className="highlight-card"
      style={{
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, ${glowSoft} 0%, rgba(0,0,0,0) 60%), ${V.surface}`,
        border: `1px solid ${color}`,
        borderRadius: 8,
        padding: '14px 16px',
        animation: `pd-fade-swap 0.45s ease-out, ${isUpset ? 'pd-glow-pulse-red' : 'pd-glow-pulse-gold'} 3.2s ease-in-out infinite 0.45s`,
        flexShrink: 0,
      }}
    >
      {/* Decorative oversized icon */}
      <div style={{
        position: 'absolute', right: -14, top: -22,
        fontSize: 96, opacity: 0.08,
        pointerEvents: 'none', userSelect: 'none',
        transform: 'rotate(-8deg)',
      }}>{icon}</div>

      {/* Header */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
        <span style={{
          fontFamily: V.FD, fontSize: 12, fontWeight: 900,
          letterSpacing: '0.18em', color,
          background: isUpset ? 'rgba(255,60,60,0.18)' : 'rgba(255,200,50,0.18)',
          border: `1px solid ${color}66`,
          borderRadius: 3, padding: '2px 8px',
        }}>{isUpset ? 'UPSET' : 'MARQUEE'}</span>
        <span style={{ flex: 1 }} />
        <span style={{
          fontFamily: V.FD, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.08em', color: V.muted,
        }}>
          POOL {event.pool}
        </span>
      </div>

      {/* Body */}
      {isUpset ? (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              {event.p1seed != null && (
                <span style={{ fontFamily: V.FD, fontSize: 11, fontWeight: 800, color, letterSpacing: '0.06em' }}>
                  #{event.p1seed}
                </span>
              )}
              <PlayerLink handle={event.p1} />
            </div>
            <div style={{
              fontFamily: V.FD, fontSize: 10, fontWeight: 800,
              letterSpacing: '0.14em', color: V.muted, margin: '5px 0',
            }}>↓ DEFEATED</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {event.p2seed != null && (
                <span style={{ fontFamily: V.FD, fontSize: 11, fontWeight: 700, color: V.dim, letterSpacing: '0.06em' }}>
                  #{event.p2seed}
                </span>
              )}
              <PlayerLink handle={event.p2} dim />
            </div>
          </div>
          <div style={{
            fontFamily: V.FD, fontSize: 42, fontWeight: 900,
            color, letterSpacing: '-0.03em', lineHeight: 1, flexShrink: 0,
            textShadow: `0 0 18px ${glowHard}`,
          }}>{event.s1}–{event.s2}</div>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <PlayerLink handle={event.p1} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PlayerLink handle={event.p2} />
              </div>
            </div>
            <div style={{
              fontFamily: V.FD, fontSize: 38, fontWeight: 900,
              color, letterSpacing: '-0.03em', lineHeight: 1, flexShrink: 0,
              textShadow: `0 0 18px ${glowHard}`,
            }}>{event.s1}–{event.s2}</div>
          </div>
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: `1px solid ${color}33`,
            fontFamily: V.FD, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.12em', color, opacity: 0.95,
          }}>★ {event.round || 'FEATURED MATCH'}</div>
        </div>
      )}
    </div>
  )
}

// ── FeedCard ──────────────────────────────────────────────────────────────────

type FeedKind = 'UPSET' | 'QUALIFIED' | 'MARQUEE' | 'RESULT'

interface DisplayEvent {
  kind: FeedKind
  p1?: string
  p1seed?: number | null
  p2?: string
  p2seed?: number | null
  p?: string   // for QUALIFIED
  side?: 'W' | 'L'  // for QUALIFIED
  s1?: number
  s2?: number
  pool: string
  round?: string
  time: string
  isBig: boolean
}

const FEED_META: Record<FeedKind, { icon: string; label: string; color: string; bg: string }> = {
  UPSET:     { icon: '🔥', label: 'UPSET',     color: 'var(--pd-red,#ff3c3c)',   bg: 'rgba(255,60,60,0.10)'    },
  QUALIFIED: { icon: '✅', label: 'QUALIFIED', color: 'var(--pd-acc,#00ffb3)',   bg: 'rgba(0,255,179,0.10)'    },
  MARQUEE:   { icon: '⚔️', label: 'MARQUEE',   color: 'var(--pd-gold,#ffc832)',  bg: 'rgba(255,200,50,0.10)'   },
  RESULT:    { icon: '·',  label: 'RESULT',    color: '#888',                    bg: 'transparent'             },
}

function FeedCard({ e }: { e: DisplayEvent }) {
  const m       = FEED_META[e.kind]
  const isBig   = e.isBig
  const isResult = e.kind === 'RESULT'
  const sideBorderExtra = isBig
    ? e.kind === 'UPSET'
      ? 'rgba(255,60,60,0.28)'
      : e.kind === 'MARQUEE'
        ? 'rgba(255,200,50,0.28)'
        : V.border
    : 'none'

  let body: React.ReactNode = null
  if (e.kind === 'UPSET') {
    body = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 14, lineHeight: 1.5 }}>
        {e.p1 && <PlayerLink handle={e.p1} prefix={e.p1seed != null ? `#${e.p1seed}` : undefined} />}
        <span style={{ color: V.muted, fontSize: 12 }}>def.</span>
        {e.p2 && <PlayerLink handle={e.p2} dim prefix={e.p2seed != null ? `#${e.p2seed}` : undefined} />}
        <span style={{ marginLeft: 'auto', fontFamily: V.FD, fontSize: 18, fontWeight: 900, color: V.red, letterSpacing: '-0.02em' }}>
          {e.s1}–{e.s2}
        </span>
      </div>
    )
  } else if (e.kind === 'QUALIFIED') {
    const sideColor = e.side === 'W' ? V.accent : V.gold
    body = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        {e.p && <PlayerLink handle={e.p} />}
        <span style={{ color: V.muted, fontSize: 12 }}>→</span>
        <span style={{
          fontFamily: V.FD, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: sideColor,
        }}>
          {e.side === 'W' ? 'Winners 抜け' : 'Losers 抜け'}
        </span>
      </div>
    )
  } else if (e.kind === 'MARQUEE') {
    body = (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 15, fontWeight: 700 }}>
          {e.p1 && <PlayerLink handle={e.p1} />}
          <span style={{ fontFamily: V.FD, fontSize: 18, fontWeight: 900, color: V.gold, letterSpacing: '-0.02em' }}>
            {e.s1}–{e.s2}
          </span>
          {e.p2 && <PlayerLink handle={e.p2} />}
        </div>
        <div style={{ fontFamily: V.FD, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: V.gold, opacity: 0.85 }}>
          Pool {e.pool} · {e.round}
        </div>
      </div>
    )
  } else {
    // RESULT
    body = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: V.muted }}>
        {e.p1 && <PlayerLink handle={e.p1} />}
        <span style={{ fontFamily: V.FD, fontSize: 12, fontWeight: 700, color: V.text }}>{e.s1}–{e.s2}</span>
        {e.p2 && <PlayerLink handle={e.p2} dim />}
      </div>
    )
  }

  return (
    <div style={{
      padding:      isBig ? '11px 13px' : (isResult ? '7px 13px' : '9px 13px'),
      background:   m.bg,
      borderLeft:   `3px solid ${m.color}`,
      borderTop:    isBig ? `1px solid ${sideBorderExtra}` : 'none',
      borderRight:  isBig ? `1px solid ${sideBorderExtra}` : 'none',
      borderBottom: isBig ? `1px solid ${sideBorderExtra}` : `1px solid ${V.border}`,
      borderRadius: isBig ? 6 : 0,
      margin:       isBig ? '6px 6px' : 0,
      animation:    'pd-slide-in 0.3s ease-out',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isResult ? 0 : 6 }}>
        <span style={{ fontSize: isBig ? 15 : 12, lineHeight: 1 }}>{m.icon}</span>
        {!isResult && (
          <span style={{
            fontFamily: V.FD, fontSize: 10, fontWeight: 800,
            letterSpacing: '0.14em', color: m.color,
          }}>{m.label}</span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{
          fontFamily: V.FD, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.08em', color: V.dim,
        }}>POOL {e.pool} · {e.time}</span>
      </div>
      {!isResult && body}
      {isResult && <div style={{ marginTop: 3 }}>{body}</div>}
    </div>
  )
}

// ── FeedTab ───────────────────────────────────────────────────────────────────

type FeedFilter = 'ALL' | 'UPSET' | 'QUALIFIED' | 'MARQUEE'

function FeedTab({ events }: { events: DisplayEvent[] }) {
  const [filter, setFilter] = useState<FeedFilter>('ALL')

  const tabs: { id: FeedFilter; label: string; color: string }[] = [
    { id: 'ALL',       label: 'ALL',    color: V.text   },
    { id: 'UPSET',     label: 'UPSET',  color: V.red    },
    { id: 'QUALIFIED', label: 'QUAL',   color: V.accent },
    { id: 'MARQUEE',   label: 'MARQUEE',color: V.gold   },
  ]

  const shown = filter === 'ALL'
    ? events
    : events.filter(e => e.kind === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Sub-filter bar */}
      <div style={{
        flexShrink: 0, padding: '0 14px',
        background: V.surface,
        borderBottom: `1px solid ${V.border}`,
        display: 'flex', alignItems: 'center', gap: 0,
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '7px 10px',
            fontFamily: V.FD, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em',
            color: filter === t.id ? t.color : V.muted,
            borderBottom: filter === t.id ? `2px solid ${t.color}` : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s',
          }}>{t.label}</button>
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: V.red, display: 'inline-block', opacity: 0.8 }} />
          <span style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: V.dim }}>
            {events.length}件
          </span>
        </span>
      </div>
      {/* Event list */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {shown.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: V.dim, fontFamily: V.FD, fontSize: 12 }}>
            該当するイベントはありません
          </div>
        ) : shown.map((e, i) => (
          <FeedCard key={`${e.kind}-${e.pool}-${e.time}-${i}`} e={e} />
        ))}
      </div>
    </div>
  )
}

// ── QualifiedRow ──────────────────────────────────────────────────────────────

function QualifiedRow({ q, flash }: { q: ApiQualifiedPlayer; flash: boolean }) {
  const color = q.side === 'winners' ? V.accent : V.gold
  return (
    <Link
      href={`/player/${encodeURIComponent(q.handle)}`}
      className="pd-qualified-row"
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '6px 9px',
        borderLeft: `3px solid ${color}`,
        background: flash ? 'rgba(0,255,179,0.18)' : 'transparent',
        textDecoration: 'none', cursor: 'pointer',
        animation: flash ? 'pd-flash-in 1.6s ease-out' : 'none',
        transition: 'background 0.12s',
        minWidth: 0,
      }}
    >
      {q.seed != null && (
        <span style={{
          fontFamily: V.FD, fontSize: 10, fontWeight: 700,
          color: V.dim, flexShrink: 0, minWidth: 24,
        }}>#{q.seed}</span>
      )}
      <span style={{
        fontFamily: V.FD, fontSize: 13, fontWeight: 700,
        color: V.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1, minWidth: 0,
      }}>{q.handle}</span>
      <span style={{
        fontFamily: V.FD, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
        color, flexShrink: 0,
      }}>{q.side === 'winners' ? 'W' : 'L'}</span>
    </Link>
  )
}

// ── QualifiedTab ──────────────────────────────────────────────────────────────

type QualTab = 'ALL' | 'W' | 'L'

function QualifiedTab({ qualified, flashIds }: { qualified: ApiQualifiedPlayer[]; flashIds: string[] }) {
  const [tab, setTab] = useState<QualTab>('ALL')
  const winners = qualified.filter(q => q.side === 'winners')
  const losers  = qualified.filter(q => q.side === 'losers')
  const shown   = tab === 'ALL' ? qualified : tab === 'W' ? winners : losers

  const tabs: { id: QualTab; label: string; color: string }[] = [
    { id: 'ALL', label: `ALL ${qualified.length}`,   color: V.text   },
    { id: 'W',   label: `Winners ${winners.length}`, color: V.accent },
    { id: 'L',   label: `Losers ${losers.length}`,   color: V.gold   },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Sub-filter bar */}
      <div style={{
        flexShrink: 0, padding: '0 14px',
        background: V.surface,
        borderBottom: `1px solid ${V.border}`,
        display: 'flex', alignItems: 'center', gap: 0,
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '7px 10px',
            fontFamily: V.FD, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em',
            color: tab === t.id ? t.color : V.muted,
            borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s',
          }}>{t.label}</button>
        ))}
      </div>
      {/* Player grid */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '6px 0' }}>
        {shown.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: V.dim, fontFamily: V.FD, fontSize: 12 }}>
            抜け選手なし
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '3px 8px',
            padding: '0 4px',
          }}>
            {shown.map(q => (
              <QualifiedRow key={`${q.side}-${q.name}`} q={q} flash={flashIds.includes(q.name)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── CircleProgress ────────────────────────────────────────────────────────────

function CircleProgress({ pct, size = 88, stroke = 8 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={V.surface3} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={V.accent} strokeWidth={stroke}
              strokeDasharray={`${dash} ${c}`} strokeDashoffset={c / 4} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s ease', filter: 'drop-shadow(0 0 6px rgba(0,255,179,0.4))' }} />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle"
            fontFamily={V.FD} fontSize={size * 0.28} fontWeight="900"
            fill={V.accent} letterSpacing="-0.04em">
        {pct}%
      </text>
    </svg>
  )
}

// ── PoolDot ───────────────────────────────────────────────────────────────────

function PoolDot({ pool }: { pool: ApiPoolProgress }) {
  const [hov, setHov] = useState(false)
  const state = pool.percent === 100 ? 'done' : pool.percent > 0 ? 'active' : 'pending'
  const bg = state === 'done'
    ? V.accent
    : state === 'active'
      ? `linear-gradient(to top, rgba(0,255,179,0.35) ${pool.percent}%, ${V.surface3} ${pool.percent}%)`
      : V.surface3
  const border = state === 'done'
    ? V.accent
    : state === 'active'
      ? 'rgba(0,255,179,0.45)'
      : V.border

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative',
        aspectRatio: '1/1',
        borderRadius: 3,
        background: bg,
        border: `1px solid ${border}`,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.12s',
        transform: hov ? 'scale(1.15)' : 'none',
        zIndex: hov ? 5 : 1,
      }}
    >
      {hov && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          background: V.surface3, border: `1px solid ${V.border2}`,
          borderRadius: 4, padding: '4px 7px', whiteSpace: 'nowrap',
          fontFamily: V.FD, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.06em', color: V.text,
          zIndex: 10, pointerEvents: 'none',
          boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
        }}>
          {pool.id} · {state === 'done' ? '完了' : state === 'active' ? `${pool.percent}%` : '未開始'}
        </div>
      )}
    </div>
  )
}

// ── StatCell ──────────────────────────────────────────────────────────────────

function StatCell({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{
      background: V.surface2, border: `1px solid ${V.border}`,
      borderRadius: 6, padding: '10px 12px',
    }}>
      <div style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: V.muted }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 3 }}>
        <span style={{ fontFamily: V.FD, fontSize: 22, fontWeight: 900, color, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value}
        </span>
        {sub && <span style={{ fontFamily: V.FD, fontSize: 11, fontWeight: 600, color: V.dim }}>{sub}</span>}
      </div>
    </div>
  )
}

// ── ProgressTab ───────────────────────────────────────────────────────────────

function ProgressTab({
  data,
}: {
  data: PoolsData
}) {
  const { pools, qualified, feed, overallProgress, currentPhase, setsAnalyzed } = data

  // Overall progress from overallProgress map (first/current phase)
  const phases = Object.entries(overallProgress)
  const mainPhaseEntry = phases.find(([k]) => k === currentPhase) ?? phases[0]
  const overallPct  = mainPhaseEntry ? mainPhaseEntry[1].percent : 0
  const setsDone    = mainPhaseEntry ? mainPhaseEntry[1].completed : 0
  const setsTotal   = mainPhaseEntry ? mainPhaseEntry[1].total    : (setsAnalyzed ?? 0)

  const doneCount    = pools.filter(p => p.percent === 100).length
  const activeCount  = pools.filter(p => p.percent > 0 && p.percent < 100).length
  const pendingCount = pools.filter(p => p.percent === 0).length
  const upsetCount   = feed.filter(e => e.type === 'UPSET').length

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px' }}>
      {/* Hero: circle + sets count */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px', background: V.surface2, border: `1px solid ${V.border}`,
        borderRadius: 8, marginBottom: 14,
      }}>
        <CircleProgress pct={overallPct} size={88} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: V.muted }}>
            {currentPhase.toUpperCase()} · POOLS
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <span style={{ fontFamily: V.FD, fontSize: 28, fontWeight: 900, color: V.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {setsDone.toLocaleString()}
            </span>
            <span style={{ fontFamily: V.FD, fontSize: 14, fontWeight: 700, color: V.dim }}>
              / {setsTotal.toLocaleString()}
            </span>
          </div>
          <div style={{ fontFamily: V.FB, fontSize: 11, color: V.muted, marginTop: 4 }}>
            sets (this page)
          </div>
        </div>
      </div>

      {/* Stat cells */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <StatCell label="プール完了"  value={`${doneCount}`}    sub={`/ ${pools.length}`}   color={V.accent} />
        <StatCell label="進行中"      value={activeCount}        sub="pools"                 color={V.gold}   />
        <StatCell label="抜け選手"    value={qualified.length}   sub="名"                    color={V.accent} />
        <StatCell label="UPSETS"      value={upsetCount}         sub="件"                    color={V.red}    />
      </div>

      {/* Pool dots */}
      {pools.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: V.FD, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: V.muted }}>
              プール一覧
            </span>
            <div style={{ display: 'flex', gap: 10, fontFamily: V.FD, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: V.dim }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: V.accent, display: 'inline-block' }} />DONE
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(0,255,179,0.4)', display: 'inline-block' }} />ACTIVE
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: V.surface3, display: 'inline-block' }} />PEND
              </span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
            {pools.map(p => <PoolDot key={p.id} pool={p} />)}
          </div>
          <div style={{ marginTop: 8, fontFamily: V.FD, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: V.dim }}>
            {doneCount} done · {activeCount} active · {pendingCount} pending
          </div>
        </div>
      )}

      {/* All phases progress bars */}
      {phases.length > 1 && (
        <div style={{
          padding: '12px 14px',
          background: V.surface2,
          border: `1px solid ${V.border}`,
          borderRadius: 8,
        }}>
          <div style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: V.muted, marginBottom: 10 }}>
            フェーズ進捗
          </div>
          {phases.map(([phase, prog]) => (
            <div key={phase} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: V.FD, fontSize: 11, fontWeight: 700, color: V.text }}>{phase}</span>
                <span style={{ fontFamily: V.FD, fontSize: 11, fontWeight: 700, color: prog.percent === 100 ? V.accent : V.gold }}>
                  {prog.percent}%
                </span>
              </div>
              <div style={{ height: 6, background: V.surface3, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${prog.percent}%`, height: '100%', borderRadius: 3,
                  background: prog.percent === 100 ? V.dim : V.accent,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TabbedPanel ───────────────────────────────────────────────────────────────

type PrimaryTab = 'FEED' | 'QUALIFIED' | 'PROGRESS'

function TabbedPanel({
  data,
  displayEvents,
  flashIds,
}: {
  data: PoolsData
  displayEvents: DisplayEvent[]
  flashIds: string[]
}) {
  const [activeTab, setActiveTab] = useState<PrimaryTab>('FEED')
  const [unseenQualified, setUnseenQualified] = useState(0)
  const activeTabRef = useRef(activeTab)
  const prevQualifiedCount = useRef(data.qualified.length)

  useEffect(() => { activeTabRef.current = activeTab }, [activeTab])
  useEffect(() => {
    if (activeTab === 'QUALIFIED') setUnseenQualified(0)
  }, [activeTab])

  // Badge: bump on new qualified players
  useEffect(() => {
    const newCount = data.qualified.length
    const diff = newCount - prevQualifiedCount.current
    if (diff > 0 && activeTabRef.current !== 'QUALIFIED') {
      setUnseenQualified(c => c + diff)
    }
    prevQualifiedCount.current = newCount
  }, [data.qualified.length])

  const tabs: { id: PrimaryTab; label: string; icon: string; badge?: number }[] = [
    { id: 'FEED',      label: 'FEED',      icon: '⚡' },
    { id: 'QUALIFIED', label: 'QUALIFIED', icon: '🏆', badge: unseenQualified },
    { id: 'PROGRESS',  label: 'PROGRESS',  icon: '📊' },
  ]

  return (
    <div style={{
      background: V.surface,
      border: `1px solid ${V.border}`,
      borderRadius: 8,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
      flex: 1,
    }}>
      {/* Primary tabs + live indicator */}
      <div style={{
        display: 'flex',
        background: V.surface2,
        borderBottom: `1px solid ${V.border}`,
        flexShrink: 0,
        alignItems: 'stretch',
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '11px 8px 10px',
              fontFamily: V.FD,
              fontSize: 12, fontWeight: 800,
              letterSpacing: '0.14em',
              color: activeTab === t.id ? V.accent : V.muted,
              borderBottom: activeTab === t.id ? `2px solid ${V.accent}` : '2px solid transparent',
              marginBottom: -1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: 7,
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>{t.icon}</span>
            <span>{t.label}</span>
            {t.badge != null && t.badge > 0 && (
              <span key={`badge-${t.badge}`} style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 18, height: 18, padding: '0 5px',
                background: V.red, borderRadius: 9,
                fontFamily: V.FD, fontSize: 10, fontWeight: 800, letterSpacing: 0, color: '#fff',
                animation: 'pd-badge-pop 0.3s ease-out, pd-badge-pulse 1.4s ease-out infinite',
              }}>{t.badge}</span>
            )}
          </button>
        ))}
        {/* LIVE indicator + sets count */}
        {data.lastUpdated && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '0 10px', flexShrink: 0,
            borderLeft: `1px solid ${V.border}`,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: V.accent,
              boxShadow: `0 0 6px ${V.accent}`,
              animation: 'pd-badge-pulse 1.4s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: V.FD, fontSize: 9, fontWeight: 700,
              letterSpacing: '0.1em', color: V.dim,
              lineHeight: 1,
            }}>
              {new Date(data.lastUpdated).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'FEED'      && <FeedTab events={displayEvents} />}
      {activeTab === 'QUALIFIED' && <QualifiedTab qualified={data.qualified} flashIds={flashIds} />}
      {activeTab === 'PROGRESS'  && <ProgressTab data={data} />}
    </div>
  )
}

// ── Data conversion ───────────────────────────────────────────────────────────

function apiToDisplayEvents(feed: ApiFeedEvent[]): DisplayEvent[] {
  return feed.map(ev => {
    const [s1, s2] = parseScore(ev.score)
    const time = fmtTimestamp(ev.timestamp)

    if (ev.type === 'UPSET') {
      // Determine winner from score: if s1 > s2, players[0] won
      const winnerIdx = s1 > s2 ? 0 : 1
      const loserIdx  = winnerIdx === 0 ? 1 : 0
      const p1 = ev.players[winnerIdx]
      const p2 = ev.players[loserIdx]
      return {
        kind: 'UPSET' as FeedKind,
        p1: p1?.handle || '',
        p1seed: p1?.seed ?? null,
        p2: p2?.handle || '',
        p2seed: p2?.seed ?? null,
        s1: Math.max(s1, s2),  // winner score first
        s2: Math.min(s1, s2),
        pool: ev.pool,
        round: ev.round,
        time,
        isBig: true,
      }
    }

    if (ev.type === 'QUALIFIED_W' || ev.type === 'QUALIFIED_L') {
      const qualifier = extractQualifierHandle(ev.message)
      return {
        kind: 'QUALIFIED' as FeedKind,
        p: qualifier || ev.players[0]?.handle || '',
        side: ev.type === 'QUALIFIED_W' ? 'W' : 'L',
        pool: ev.pool,
        round: ev.round,
        time,
        isBig: false,
      }
    }

    if (ev.type === 'MARQUEE_RESULT') {
      const winnerIdx = s1 > s2 ? 0 : 1
      const loserIdx  = winnerIdx === 0 ? 1 : 0
      return {
        kind: 'MARQUEE' as FeedKind,
        p1: ev.players[winnerIdx]?.handle || '',
        p2: ev.players[loserIdx]?.handle || '',
        s1: Math.max(s1, s2),
        s2: Math.min(s1, s2),
        pool: ev.pool,
        round: ev.round,
        time,
        isBig: true,
      }
    }

    // ELIMINATED → RESULT
    const p1 = ev.players[0]
    const p2 = ev.players[1]
    return {
      kind: 'RESULT' as FeedKind,
      p1: s1 > s2 ? p1?.handle : p2?.handle,
      p2: s1 > s2 ? p2?.handle : p1?.handle,
      s1: Math.max(s1, s2),
      s2: Math.min(s1, s2),
      pool: ev.pool,
      round: ev.round,
      time,
      isBig: false,
    }
  })
}

function apiToToastEvent(ev: ApiFeedEvent): ToastEvent | null {
  if (ev.type !== 'UPSET' && ev.type !== 'MARQUEE_RESULT') return null
  const [s1, s2] = parseScore(ev.score)
  const winnerIdx = s1 > s2 ? 0 : 1
  const loserIdx  = winnerIdx === 0 ? 1 : 0
  return {
    kind: ev.type === 'UPSET' ? 'UPSET' : 'MARQUEE',
    p1: ev.players[winnerIdx]?.handle || '',
    p1seed: ev.players[winnerIdx]?.seed ?? null,
    p2: ev.players[loserIdx]?.handle || '',
    p2seed: ev.players[loserIdx]?.seed ?? null,
    s1: Math.max(s1, s2),
    s2: Math.min(s1, s2),
    pool: ev.pool,
    round: ev.round,
    timestamp: ev.timestamp,
  }
}

// ── PoolsDashboard (right rail) ───────────────────────────────────────────────

export function PoolsDashboard({
  data,
  onToast,
}: {
  data: PoolsData | null
  onToast?: (event: ToastEvent | null) => void
}) {
  // re-render 確認ログ — 数字が変われば props が正しく更新されている
  console.log('[PD] render', data?.feed?.length, 'feed /', data?.qualified?.length, 'qual /', data?.setsAnalyzed, 'sets')

  usePoolsStyles()

  // Highlight card: latest UPSET or MARQUEE
  const [highlightEvent, setHighlightEvent] = useState<ToastEvent | null>(null)
  // "timestamp::type::player0" で同一イベントへの再発火を防ぐ
  const prevHighlightKey = useRef<string>('')

  // Flash IDs for qualified rows
  const [flashIds, setFlashIds] = useState<string[]>([])
  const prevQualifiedNames = useRef<Set<string>>(new Set())

  // Convert API feed to display events
  const displayEvents: DisplayEvent[] = data ? apiToDisplayEvents(data.feed) : []

  // Derived highlight: most recent UPSET or MARQUEE_RESULT in feed
  // feed は created_at DESC なので先頭のものが最新
  useEffect(() => {
    if (!data) return
    // UPSET / MARQUEE_RESULT の中で最も新しいもの（feed はすでに timestamp DESC）
    const bigEvent = data.feed.find(e => e.type === 'UPSET' || e.type === 'MARQUEE_RESULT')
    if (!bigEvent) return

    // 同一イベントへの再発火を防止（timestamp + type + player0 handle で識別）
    const key = `${bigEvent.timestamp}::${bigEvent.type}::${bigEvent.players[0]?.handle ?? ''}`
    if (key === prevHighlightKey.current) return
    prevHighlightKey.current = key

    const toast = apiToToastEvent(bigEvent)
    if (toast) {
      setHighlightEvent(toast)
      onToast?.(toast)
    }
  // feed 内の最新 UPSET/MARQUEE の timestamp を watch — feed[0] ではなく専用フィールドで比較
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.feed])

  // Flash new qualified players
  useEffect(() => {
    if (!data) return
    const currentNames = new Set(data.qualified.map(q => q.name))
    const newNames = [...currentNames].filter(n => !prevQualifiedNames.current.has(n))
    if (newNames.length > 0) {
      setFlashIds(newNames)
      setTimeout(() => setFlashIds([]), 1700)
    }
    prevQualifiedNames.current = currentNames
  }, [data?.qualified])

  if (!data) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', gap: 12,
      }}>
        <div style={{
          background: V.surface, border: `1px solid ${V.border}`, borderRadius: 8,
          padding: '14px 16px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: V.FD, fontSize: 12, color: V.dim, letterSpacing: '0.1em',
        }}>
          プールデータ取得中...
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      gap: 12,
      height: '100%',
      minHeight: 0,
    }}>
      {/* Highlight card (top, auto height) */}
      <HighlightCard event={highlightEvent} />

      {/* Tabbed panel (fills remaining) */}
      <TabbedPanel
        data={data}
        displayEvents={displayEvents}
        flashIds={flashIds}
      />
    </div>
  )
}

// ── StreamToast (rendered inside stream area) ─────────────────────────────────

export function StreamToast({ event }: { event: ToastEvent | null }) {
  if (!event) return null
  const isUpset = event.kind === 'UPSET'
  const color   = isUpset ? '#ff3c3c' : '#ffc832'
  const icon    = isUpset ? '🔥' : '⚔️'

  let body: React.ReactNode
  if (isUpset) {
    body = (
      <>
        <span style={{ color, fontWeight: 900, fontSize: 14, letterSpacing: '0.14em' }}>UPSET!</span>
        <span style={{ color: '#e0e0e0', fontWeight: 800, fontSize: 15 }}>
          {event.p1seed != null ? `#${event.p1seed} ` : ''}{event.p1}
        </span>
        <span style={{ color: '#888', fontSize: 13 }}>defeated</span>
        <span style={{ color: '#888', fontWeight: 700, fontSize: 14, textDecoration: 'line-through', textDecorationColor: '#555' }}>
          {event.p2seed != null ? `#${event.p2seed} ` : ''}{event.p2}
        </span>
        <span style={{ marginLeft: 'auto', color, fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {event.s1}–{event.s2}
        </span>
      </>
    )
  } else {
    body = (
      <>
        <span style={{ color, fontWeight: 900, fontSize: 14, letterSpacing: '0.14em' }}>MARQUEE</span>
        <span style={{ color: '#e0e0e0', fontWeight: 800, fontSize: 15 }}>{event.p1}</span>
        <span style={{ color, fontWeight: 900, fontSize: 18, letterSpacing: '-0.02em' }}>{event.s1}–{event.s2}</span>
        <span style={{ color: '#e0e0e0', fontWeight: 800, fontSize: 15 }}>{event.p2}</span>
        {event.round && (
          <span style={{ marginLeft: 'auto', color, fontSize: 12, letterSpacing: '0.1em', fontWeight: 700 }}>
            {event.round}
          </span>
        )}
      </>
    )
  }

  return (
    <div
      key={`${event.kind}-${event.p1}-${event.s1}`}
      style={{
        position: 'absolute',
        left: 14, right: 14, bottom: 14,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderLeft: `4px solid ${color}`,
        borderRadius: 6,
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: "'Barlow Condensed', sans-serif",
        animation: 'pd-toast-flash 5s ease-out forwards',
        pointerEvents: 'none',
        zIndex: 10,
        boxShadow: `0 6px 20px rgba(0,0,0,0.6), 0 0 18px ${isUpset ? 'rgba(255,60,60,0.25)' : 'rgba(255,200,50,0.25)'}`,
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      {body}
    </div>
  )
}
