'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useLocale } from '@/lib/locale-context'
import { UI_TEXT } from '@/lib/i18n'
import SiteNavbar from '@/components/SiteNavbar'
import type { TournamentData, TournamentInfo, EntrantRow, SetRow } from './types'
import { getBracketSortOrder } from '@/lib/bracketOrder'

// ─── Design tokens (CSS vars defined in globals.css) ──────────────
const T = {
  bg:         'var(--sf6-bg)',
  nav:        'var(--sf6-nav)',
  hero:       'var(--sf6-hero)',
  card:       'var(--sf6-card)',
  surface:    'var(--sf6-surface)',
  surface2:   'var(--sf6-surface2)',
  surface3:   'var(--sf6-surface3)',
  border:     'var(--sf6-border)',
  border2:    'var(--sf6-border2)',
  accent:     'var(--sf6-accent)',
  accentDim:  'var(--sf6-accent-dim)',
  text:       'var(--sf6-text)',
  muted:      'var(--sf6-text-muted)',
  dim:        'var(--sf6-text-dim)',
  gold:       'var(--sf6-gold)',
  silver:     'var(--sf6-silver)',
  bronze:     'var(--sf6-bronze)',
  red:        'var(--sf6-red)',
  green:      'var(--sf6-green)',
  rowEven:    'var(--sf6-row-even)',
  rowHover:   'var(--sf6-row-hover)',
  fDisplay:   'var(--font-barlow-condensed, "Barlow Condensed", sans-serif)',
  fBody:      'var(--font-barlow, "Barlow", sans-serif)',
  fTitle:     'var(--font-archivo-black, "Archivo Black", sans-serif)',
} as const

const CHAR_COLORS: Record<string, string> = {
  "Akuma":    "#8b2fc9", "Cammy":    "#2e9e5b", "Chun-Li":  "#3d7ef5",
  "Dee Jay":  "#f5a623", "Dhalsim":  "#e85c2a", "Ed":       "#5c9ef5",
  "E.Honda":  "#e84848", "Guile":    "#4a90d9", "JP":       "#9b4dca",
  "Juri":     "#d43f8c", "Ken":      "#d45f00", "Kimberly": "#ff6b35",
  "Lily":     "#7ec850", "Luke":     "#c8a820", "M.Bison":  "#9b1a1a",
  "Manon":    "#c86490", "Marisa":   "#8b6914", "Rashid":   "#50c8c8",
  "Ryu":      "#e04040", "Terry":    "#c83232", "Zangief":  "#d43c3c",
  "A.K.I":   "#7bc87b", "Mai":       "#e85c7a", "Blanka":   "#3da840",
  "Blaze":    "#3db8d0",
}

const FLAG: Record<string, string> = {
  JP:'🇯🇵', US:'🇺🇸', KR:'🇰🇷', CN:'🇨🇳', TW:'🇹🇼', HK:'🇭🇰',
  FR:'🇫🇷', GB:'🇬🇧', DE:'🇩🇪', BR:'🇧🇷', CL:'🇨🇱', AR:'🇦🇷',
  AU:'🇦🇺', CA:'🇨🇦', NO:'🇳🇴', DO:'🇩🇴', AE:'🇦🇪', SA:'🇸🇦',
  NL:'🇳🇱', IT:'🇮🇹', ES:'🇪🇸', PK:'🇵🇰', PH:'🇵🇭', SG:'🇸🇬',
  MX:'🇲🇽', RU:'🇷🇺', SE:'🇸🇪', BE:'🇧🇪', CH:'🇨🇭', AT:'🇦🇹',
}
const flag = (code: string | null) => code ? (FLAG[code.toUpperCase()] ?? '🏳️') : '🏳️'

function charColor(name: string | null) {
  if (!name) return '#6b7280'
  return CHAR_COLORS[name] ?? '#6b7280'
}

function fmtPrize(usd: number | null): string {
  if (!usd) return '—'
  return '$' + usd.toLocaleString()
}

// ─── CPT Premier ──────────────────────────────────────────────────
// isCptPremier は tournament.cptEventType === 'premier' で動的に判定
// (page.tsx → DB の cpt_event_type カラムから取得)

// CPT Premier ポイント配分 (2025/2026 共通)
// 1st = Capcom Cup 出場権（ポイント値なし）
const CPT_PREMIER_POINTS: Record<number, number> = {
  2: 300, 3: 250, 4: 200,
  5: 150, 6: 150,
  7: 100, 8: 100,
  9: 50, 10: 50, 11: 50, 12: 50,
  13: 30, 14: 30, 15: 30, 16: 30,
  17: 20, 18: 20, 19: 20, 20: 20, 21: 20, 22: 20, 23: 20, 24: 20,
  25: 10, 26: 10, 27: 10, 28: 10, 29: 10, 30: 10, 31: 10, 32: 10,
}

// Prize distribution by tournament id → placement → USD amount
// Add future tournaments here as needed
const TOURNAMENT_PRIZE_MAP: Record<number, Record<number, number>> = {
  48: { // Combo Breaker 2026 — total $19,720
    1: 8094.20,
    2: 4984.80,
    3: 3032.80,
    4: 1861.60,
    5:  580.80,
    6:  580.80,
    7:  290.40,
    8:  290.40,
  },
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric' })
}

function effectivePlacement(e: EntrantRow): number | null {
  return e.placement ?? e.inferredPlacement
}

function placementLabel(p: number | null, inferred: boolean): string {
  if (!p) return '—'
  const suffix = inferred ? ' *' : ''
  if (p === 1) return '優勝' + suffix
  if (p === 2) return '準優勝' + suffix
  if (p <= 4)  return 'Top 4' + suffix
  if (p <= 8)  return 'Top 8' + suffix
  if (p <= 16) return 'Top 16' + suffix
  if (p <= 32) return 'Top 32' + suffix
  return `${p}位` + suffix
}

function placementColor(p: number | null): string {
  if (!p) return T.dim
  if (p === 1) return T.accent
  if (p === 2) return T.gold
  if (p <= 4)  return '#f5a623'
  if (p <= 8)  return '#60a5fa'
  return T.muted
}

// ─── Concept C design atoms ───────────────────────────────────────

/** SVG "CB" monogram — used as hero watermark when no logo is available */
function CBMark({ size = 200, opacity = 1 }: { size?: number; opacity?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ opacity, display: 'block' }}>
      <circle cx="100" cy="100" r="90" fill="none" stroke="#ffffff" strokeWidth={4} />
      <circle cx="100" cy="100" r="78" fill="none" stroke="#ffffff" strokeWidth={1.6} opacity={0.5} />
      <text
        x="100" y="106" textAnchor="middle" dominantBaseline="central"
        fontFamily="'Archivo Black', sans-serif" fontStyle="italic"
        fontSize="88" letterSpacing="-4" fill="#ffffff"
      >CB</text>
    </svg>
  )
}

/** Three diagonal accent stripes — top-right decorative element */
function Stripes({ style }: { style?: React.CSSProperties }) {
  const bar = (right: number, w: number, color: string, opa: number): React.CSSProperties => ({
    position: 'absolute', top: '-40%', height: '180%',
    right, width: w, background: color, opacity: opa, transform: 'rotate(22deg)',
  })
  return (
    <div style={{ position: 'absolute', pointerEvents: 'none', overflow: 'hidden', ...style }}>
      <div style={bar(-60, 18, T.accent, 0.50)} />
      <div style={bar(8,   6,  T.accent, 0.30)} />
      <div style={bar(48,  10, T.gold,   0.25)} />
    </div>
  )
}

/** Skewed stripe + Archivo Black italic section heading */
function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
      <span style={{
        width: 6, height: 26, flexShrink: 0, display: 'inline-block',
        background: T.accent, transform: 'skewX(-12deg)',
        boxShadow: '8px 0 0 -1px rgba(0,212,170,0.35), 16px 0 0 -2px rgba(245,200,66,0.3)',
      }} />
      <h2 style={{
        fontFamily: T.fTitle, fontStyle: 'italic', margin: 0,
        fontSize: 26, letterSpacing: '-0.01em', textTransform: 'uppercase',
        color: T.text,
      }}>{title}</h2>
      {sub && (
        <span style={{
          fontFamily: T.fDisplay, fontSize: 13, fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: T.dim, marginLeft: 'auto',
        }}>{sub}</span>
      )}
    </div>
  )
}

// ─── Shared UI atoms ──────────────────────────────────────────────

function CharPill({ name }: { name: string | null }) {
  const color = charColor(name)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: 'rgba(255,255,255,0.07)',
      border: `1px solid rgba(255,255,255,0.12)`,
      borderRadius: 4, padding: '2px 8px',
      fontFamily: T.fDisplay, fontSize: 12, fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      color, whiteSpace: 'nowrap',
    }}>
      {name ?? '—'}
    </span>
  )
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  const [displayed, setDisplayed] = useState(0)
  const [hovered, setHovered] = useState(false)
  const isNum = typeof value === 'number'

  useEffect(() => {
    if (!isNum) return
    const end = value as number
    const dur = 1000
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1)
      setDisplayed(Math.round((1 - Math.pow(1 - p, 3)) * end))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value, isNum])

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        border: `1px solid ${hovered ? 'rgba(0,212,170,0.35)' : T.border}`,
        borderRadius: 12, padding: '22px 28px',
        flex: '1 1 140px', minWidth: 140,
        transform: hovered ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow: hovered ? '0 4px 24px rgba(0,212,170,0.10)' : 'none',
      }}
    >
      <div style={{
        fontFamily: T.fDisplay, fontSize: 48, fontWeight: 900,
        lineHeight: 1, color: T.accent, letterSpacing: '-0.03em', marginBottom: 8,
      }}>
        {isNum ? displayed.toLocaleString() : value}
      </div>
      <div style={{
        fontFamily: T.fDisplay, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted,
      }}>
        {label}
      </div>
    </div>
  )
}


// ─── Hero ─────────────────────────────────────────────────────────

function HeroSection({ data }: { data: TournamentData }) {
  const { tournament, entrants, totalMatches } = data
  const displayEntrants = tournament.numEntrantsOverride ?? entrants.length
  const displayMatches  = tournament.totalSetsOverride  ?? totalMatches

  // Split on first word for 2-line title: "COMBO" / "BREAKER 2026"
  // Then detect trailing year for outline treatment on 2nd line
  const words     = tournament.name.split(' ')
  const line1     = words[0]                     // e.g. "COMBO" | "EVO" | "CAPCOM"
  const line2Rest = words.slice(1).join(' ')      // e.g. "BREAKER 2026" | "JAPAN 2026"
  const yearMatch = line2Rest.match(/\s(\d{4})$/)
  const line2Base = yearMatch ? line2Rest.slice(0, -5) : line2Rest   // "BREAKER"
  const nameYear  = yearMatch?.[1] ?? null                            // "2026"

  return (
    <div className="hero-banner" style={{
      position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(160deg, #0e1f24 0%, #080c10 62%)',
      padding: '36px 0 32px',          /* 上下を詰めてコンパクトに */
      borderBottom: `1px solid ${T.border}`,
    }}>
      {/* Scanline texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
      }} />

      {/* Diagonal accent stripes — top-right */}
      <Stripes style={{ top: 0, right: 0, bottom: 0, width: '42%', zIndex: 1 }} />

      {/* CBMark fallback watermark (no logo) */}
      {!tournament.logoUrl && (
        <div style={{ position: 'absolute', top: '50%', right: '8%', transform: 'translateY(-50%)', zIndex: 1, pointerEvents: 'none' }}>
          <CBMark size={140} opacity={0.05} />
        </div>
      )}

      {/* Left-to-right scrim */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: 'linear-gradient(to right, rgba(8,12,16,0.92) 0%, rgba(14,31,36,0.65) 55%, rgba(14,31,36,0.10) 100%)',
      }} />
      {/* Accent glow blob */}
      <div style={{
        position: 'absolute', top: -60, right: 100, width: 260, height: 260,
        background: 'radial-gradient(circle, rgba(0,212,170,0.15) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', zIndex: 2,
      }} />

      {/*
       * コンテンツブロック: TabBar・順位表と同じ maxWidth: 1200 に揃えて左端を統一
       * ロゴ透かしはコンテナ内 position: absolute で右端に配置
       */}
      <div className="hero-content" style={{ position: 'relative', zIndex: 3, maxWidth: 1400, margin: '0 auto', padding: '0 20px' }}>
        {/* Watermark logo — コンテナ右端に控えめに配置 */}
        {tournament.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="hero-logo" src={tournament.logoUrl} alt="" style={{
            position: 'absolute', right: 20, top: 0,
            height: 260, width: 'auto',
            opacity: 0.09, pointerEvents: 'none', userSelect: 'none',
            objectFit: 'contain',
          }} />
        )}
        {/* Status + badges row */}
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(0,0,0,0.5)', border: `1px solid ${T.border2}`,
            borderRadius: 20, padding: '4px 12px',
            fontFamily: T.fDisplay, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase', color: T.accent,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: T.red,
              display: 'inline-block', animation: 'sf6-pulse-dot 1.5s ease-in-out infinite',
            }} />
            CONCLUDED
          </span>
          {/* cptEventType ベースのイベントバッジ */}
          {tournament.cptEventType === 'premier' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.4)',
              borderRadius: 20, padding: '4px 12px',
              fontFamily: T.fDisplay, fontSize: 11, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase', color: T.gold,
            }}>★ CPT PREMIER</span>
          )}
          {tournament.cptEventType === 'capcom_cup' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(220,60,40,0.14)', border: '1px solid rgba(220,60,40,0.50)',
              borderRadius: 20, padding: '4px 12px',
              fontFamily: T.fDisplay, fontSize: 11, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ff7a60',
            }}>🏆 CAPCOM CUP</span>
          )}
          {tournament.cptEventType === 'ewc' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(124,58,237,0.14)', border: '1px solid rgba(124,58,237,0.50)',
              borderRadius: 20, padding: '4px 12px',
              fontFamily: T.fDisplay, fontSize: 11, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c4b5fd',
            }}>⚡ EWC</span>
          )}
          {tournament.cptEventType === 'road_to_ewc' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.30)',
              borderRadius: 20, padding: '4px 12px',
              fontFamily: T.fDisplay, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.10em', textTransform: 'uppercase', color: '#a78bfa',
            }}>ROAD TO EWC</span>
          )}
          {tournament.location && (
            <span style={{ fontFamily: T.fDisplay, fontSize: 12, color: T.muted, letterSpacing: '0.06em' }}>
              {tournament.location}
            </span>
          )}
        </div>

        {/* Title — バナー縮小に合わせてフォントサイズ削減 */}
        <h1 className="hero-title" style={{
          fontFamily: T.fTitle, fontStyle: 'italic', textTransform: 'uppercase',
          fontSize: 'clamp(42px, 6vw, 72px)',
          lineHeight: 0.96, letterSpacing: '-0.02em',
          color: T.text, margin: '0 0 12px',
          textShadow: '0 4px 20px rgba(0,0,0,0.55)',
        }}>
          <span style={{ display: 'block' }}>{line1}</span>
          <span style={{ display: 'block' }}>
            {line2Base}
            {nameYear && (
              <span style={{
                WebkitTextStroke: `2px ${T.accent}`,
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }}>{line2Base ? ` ${nameYear}` : nameYear}</span>
            )}
          </span>
        </h1>

        {/* Game pill */}
        <span style={{
          display: 'inline-block',
          background: T.accentDim, border: `1px solid ${T.border2}`,
          borderRadius: 5, padding: '3px 12px',
          fontFamily: T.fDisplay, fontSize: 12, fontWeight: 700,
          letterSpacing: '0.16em', color: T.accent, textTransform: 'uppercase',
        }}>Street Fighter 6</span>

        {/* Date */}
        {(tournament.startDate || tournament.endDate) && (
          <p style={{
            fontFamily: T.fDisplay, fontSize: 14, fontWeight: 500,
            color: T.muted, letterSpacing: '0.04em', margin: '10px 0 24px',
          }}>
            {fmtDate(tournament.startDate)}
            {tournament.endDate && tournament.endDate !== tournament.startDate && ` – ${fmtDate(tournament.endDate)}`}
          </p>
        )}

        {/* Stat boxes */}
        <div className="stats-row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <StatCard value={displayEntrants}                label={UI_TEXT.participants} />
          <StatCard value={displayMatches}                 label={UI_TEXT.totalMatches} />
          <StatCard value={fmtPrize(tournament.prizeUsd)} label={UI_TEXT.totalPrize} />
        </div>
      </div>
    </div>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────

type TabId = 'standings' | 'bracket' | 'chars'
const TABS: { id: TabId; label: string }[] = [
  { id: 'standings', label: UI_TEXT.standings },
  { id: 'bracket',   label: UI_TEXT.bracket },
  { id: 'chars',     label: UI_TEXT.charStats },
]

function TabBar({ active, setActive, counts }: {
  active: TabId
  setActive: (t: TabId) => void
  counts: Partial<Record<TabId, number>>
}) {
  return (
    <div style={{
      background: T.card, borderBottom: `1px solid ${T.border}`,
      position: 'sticky', top: 52, zIndex: 40,
    }}>
      <div className="tab-bar" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', display: 'flex' }}>
        {TABS.map(tab => {
          const on = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              style={{
                position: 'relative',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '16px 18px',
                fontFamily: on ? T.fTitle : T.fDisplay,
                fontStyle: on ? 'italic' : 'normal',
                fontSize: on ? 16 : 15,
                fontWeight: on ? 400 : 700,
                letterSpacing: on ? '0' : '0.08em',
                textTransform: 'uppercase',
                color: on ? T.text : T.muted,
                transition: 'color 0.15s',
                marginBottom: -1,
              }}
            >
              {tab.label}
              {on && (
                <span style={{
                  position: 'absolute', left: 14, right: 14, bottom: -1, height: 3,
                  background: T.accent, transform: 'skewX(-16deg)',
                  boxShadow: '0 0 10px rgba(0,212,170,0.5)',
                  display: 'block',
                }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── EWC badge ───────────────────────────────────────────────────

function EwcBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.55)',
      borderRadius: 20, padding: '2px 9px',
      fontFamily: 'var(--font-barlow-condensed, sans-serif)', fontSize: 11, fontWeight: 800,
      letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c4b5fd',
      whiteSpace: 'nowrap',
    }}>
      {UI_TEXT.ewcQualified}
    </span>
  )
}

function CcQualifiedBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--font-barlow-condensed, sans-serif)', fontSize: 11, fontWeight: 900,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: '#fbbf24',
      padding: '4px 10px', borderRadius: 6,
      background: 'rgba(234,179,8,0.12)',
      border: '1px solid rgba(234,179,8,0.40)',
      boxShadow: '0 0 8px rgba(234,179,8,0.15)',
      whiteSpace: 'nowrap',
    }}>
      🏆 {UI_TEXT.ccQualified}
    </span>
  )
}

// ─── Podium (Top 3 independent section) ──────────────────────────

interface PodiumEntry {
  rank: number
  handle: string
  countryCode: string | null
  char: string | null
  prize: string
  cptPts: number | null
  playerId: number | null
}

// ─── 対戦履歴パネル（ポディウム・順位表共通）────────────────────────

/** ラウンドの重要度スコア（高いほど決勝に近い） */
function roundPriority(s: SetRow): number {
  const rt = (s.roundText || s.inferredRoundLabel || '').toLowerCase()
  if (rt.includes('reset'))                             return 100
  if (s.isGrandFinal || rt.includes('grand final'))    return  99
  if (rt.includes('winners final'))                    return  90
  if (rt.includes('losers final'))                     return  89
  if (rt.includes('winners semi'))                     return  80
  if (rt.includes('losers semi'))                      return  79
  if (rt.includes('winners quarter'))                  return  70
  if (rt.includes('losers quarter'))                   return  69
  const lrM = rt.match(/losers round (\d+)/)
  if (lrM) return 60 + parseInt(lrM[1], 10)
  const wrM = rt.match(/winners round (\d+)/)
  if (wrM) return 50 + parseInt(wrM[1], 10)
  return s.id  // fallback: higher id = later in event
}

function MatchHistoryPanel({ playerId, sets }: { playerId: number; sets: SetRow[] }) {
  const playerSets = sets
    .filter(s => s.winnerId === playerId || s.loserId === playerId)
    .sort((a, b) => roundPriority(b) - roundPriority(a))

  if (playerSets.length === 0) {
    return (
      <div style={{ fontFamily: T.fBody, fontSize: 13, color: T.dim, padding: '4px 0' }}>
        対戦データなし
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {playerSets.map(s => {
        const win       = s.winnerId === playerId
        const oppHandle = win ? s.loserHandle  : s.winnerHandle
        const charUsed  = win ? s.winnerCharacter : s.loserCharacter
        const roundLabel = s.roundText || s.inferredRoundLabel || '?'
        const scoreW = win ? s.winnerScore : s.loserScore
        const scoreL = win ? s.loserScore  : s.winnerScore
        return (
          <div key={s.id} className="match-card" style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 12px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 6, gap: 12,
          }}>
            <span style={{
              fontFamily: T.fDisplay, fontSize: 11, fontWeight: 700,
              color: T.dim, letterSpacing: '0.06em',
              minWidth: 130, flexShrink: 0,
            }}>{roundLabel}</span>
            <span style={{ flex: 1, minWidth: 0, fontFamily: T.fDisplay, fontSize: 13 }}>
              <span style={{ fontWeight: 800, color: win ? '#4ade80' : '#f87171', marginRight: 6 }}>
                {win ? 'W' : 'L'}
              </span>
              <span style={{ color: T.muted }}>vs </span>
              <span style={{ color: T.text, fontWeight: 600 }}>{oppHandle}</span>
            </span>
            <span style={{
              fontFamily: T.fDisplay, fontWeight: 700, fontSize: 14,
              color: win ? '#4ade80' : T.text, flexShrink: 0,
            }}>{scoreW} – {scoreL}</span>
            {charUsed && (
              <span style={{
                fontFamily: T.fDisplay, fontSize: 11, color: T.dim,
                flexShrink: 0, minWidth: 60, textAlign: 'right',
              }}>{charUsed}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── ポディウムカード ──────────────────────────────────────────────

function PodiumChampion({
  p, ewcSpots, sets = [], expandedPlayerId, setExpandedPlayerId,
}: {
  p: PodiumEntry
  ewcSpots?: number | null
  sets?: SetRow[]
  expandedPlayerId: number | null
  setExpandedPlayerId: (id: number | null) => void
}) {
  const [hovered, setHovered] = useState(false)
  const showEwc  = ewcSpots != null && p.rank <= ewcSpots
  const isExpanded = p.playerId != null && expandedPlayerId === p.playerId
  const toggle = () => {
    if (!p.playerId) return
    setExpandedPlayerId(isExpanded ? null : p.playerId)
  }

  return (
    <div>
      <div
        className="podium-champion"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={toggle}
        style={{
          position: 'relative', overflow: 'hidden',
          borderRadius: isExpanded ? '12px 12px 0 0' : 12,
          border: '1px solid rgba(245,200,66,0.45)',
          background: 'linear-gradient(120deg, rgba(245,200,66,0.15) 0%, rgba(245,200,66,0.03) 46%, rgba(14,20,25,1) 78%)',
          padding: '22px 28px', display: 'flex', alignItems: 'center', gap: 26,
          cursor: p.playerId ? 'pointer' : 'default',
          transition: 'filter 0.15s, transform 0.15s',
          filter: hovered && p.playerId ? 'brightness(1.08)' : 'brightness(1)',
          transform: hovered && p.playerId ? 'scale(1.005)' : 'scale(1)',
        }}
      >
        <Stripes style={{ top: 0, right: 0, bottom: 0, width: '30%', zIndex: 0 }} />
        {/* Ghost rank numeral */}
        <div style={{
          position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none', zIndex: 0,
          fontFamily: T.fTitle, fontStyle: 'italic', fontSize: 170, lineHeight: 1,
          color: 'transparent', WebkitTextStroke: '2px rgba(245,200,66,0.16)',
        }}>1</div>
        {/* Expand indicator */}
        <div style={{
          position: 'absolute', top: 10, right: 14, zIndex: 2,
          fontFamily: T.fDisplay, fontSize: 12,
          color: 'rgba(255,255,255,0.35)',
        }}>{isExpanded ? '▲' : '▼'}</div>
        {/* Trophy */}
        <div style={{ position: 'relative', zIndex: 1, flexShrink: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>🏆</div>
          <div style={{ fontFamily: T.fDisplay, fontSize: 11, fontWeight: 800, letterSpacing: '0.2em', color: T.gold, marginTop: 6 }}>
            CHAMPION
          </div>
        </div>
        {/* Identity */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 28 }}>{flag(p.countryCode)}</span>
            {p.playerId
              ? <Link href={`/player/${p.playerId}`} onClick={e => e.stopPropagation()} style={{ textDecoration: 'none' }}>
                  <h3 className="podium-player-name podium-name-link" style={{
                    fontFamily: T.fTitle, fontStyle: 'italic', textTransform: 'uppercase',
                    fontSize: 44, color: T.gold, letterSpacing: '-0.01em', lineHeight: 0.96, margin: 0,
                  }}>{p.handle}</h3>
                </Link>
              : <h3 className="podium-player-name" style={{
                  fontFamily: T.fTitle, fontStyle: 'italic', textTransform: 'uppercase',
                  fontSize: 44, color: T.gold, letterSpacing: '-0.01em', lineHeight: 0.96, margin: 0,
                }}>{p.handle}</h3>
            }
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <CharPill name={p.char} />
          </div>
        </div>
        {/* Prize + badges */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'right', flexShrink: 0 }}>
          {p.prize && (
            <div className="podium-prize" style={{ fontFamily: T.fTitle, fontStyle: 'italic', fontSize: 32, color: T.gold, letterSpacing: '-0.01em', lineHeight: 1 }}>
              {p.prize}
            </div>
          )}
          {(p.cptPts !== null || showEwc) && (
            <div className="podium-badges" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 8 }}>
              {p.cptPts !== null && <CcQualifiedBadge />}
              {showEwc && <EwcBadge />}
            </div>
          )}
        </div>
      </div>
      {/* アコーディオン展開パネル */}
      {isExpanded && p.playerId && (
        <div className="match-history-panel" style={{
          background: 'rgba(255,255,255,0.025)',
          borderRadius: '0 0 12px 12px',
          padding: '12px 16px 16px',
          border: '1px solid rgba(245,200,66,0.25)',
          borderTop: 'none',
        }}>
          <MatchHistoryPanel playerId={p.playerId} sets={sets} />
        </div>
      )}
    </div>
  )
}

function PodiumRunner({
  p, ewcSpots, sets = [], expandedPlayerId, setExpandedPlayerId,
}: {
  p: PodiumEntry
  ewcSpots?: number | null
  sets?: SetRow[]
  expandedPlayerId: number | null
  setExpandedPlayerId: (id: number | null) => void
}) {
  const [hovered, setHovered] = useState(false)
  const isSilver   = p.rank === 2
  const medalColor = isSilver ? T.silver : T.bronze
  const medal      = isSilver ? '🥈' : '🥉'
  const showEwc    = ewcSpots != null && p.rank <= ewcSpots
  const isExpanded = p.playerId != null && expandedPlayerId === p.playerId
  const toggle = () => {
    if (!p.playerId) return
    setExpandedPlayerId(isExpanded ? null : p.playerId)
  }

  return (
    <div style={{ flex: '1 1 240px', minWidth: 0 }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={toggle}
        style={{
          position: 'relative', overflow: 'hidden',
          borderRadius: isExpanded ? '10px 10px 0 0' : 10,
          border: `1px solid ${medalColor}55`,
          background: isSilver
            ? 'linear-gradient(120deg, rgba(160,176,191,0.13) 0%, rgba(14,20,25,1) 62%)'
            : 'linear-gradient(120deg, rgba(205,140,82,0.13) 0%, rgba(14,20,25,1) 62%)',
          boxShadow: `inset 3px 0 0 ${medalColor}`,
          padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16,
          cursor: p.playerId ? 'pointer' : 'default',
          transition: 'filter 0.15s, transform 0.15s',
          filter: hovered && p.playerId ? 'brightness(1.08)' : 'brightness(1)',
          transform: hovered && p.playerId ? 'scale(1.005)' : 'scale(1)',
        }}
      >
        {/* Expand indicator */}
        <div style={{
          position: 'absolute', top: 8, right: 12, zIndex: 2,
          fontFamily: T.fDisplay, fontSize: 11,
          color: 'rgba(255,255,255,0.30)',
        }}>{isExpanded ? '▲' : '▼'}</div>
        {/* Outlined rank numeral */}
        <div style={{
          flexShrink: 0, fontFamily: T.fTitle, fontStyle: 'italic',
          fontSize: 44, lineHeight: 1,
          color: 'transparent', WebkitTextStroke: `2px ${medalColor}`,
        }}>{p.rank}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>{flag(p.countryCode)}</span>
            {p.playerId
              ? <Link href={`/player/${p.playerId}`} onClick={e => e.stopPropagation()} style={{ textDecoration: 'none' }}>
                  <span className="podium-player-name podium-name-link" style={{
                    fontFamily: T.fTitle, fontStyle: 'italic', textTransform: 'uppercase',
                    fontSize: 22, color: T.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'block',
                  }}>{p.handle}</span>
                </Link>
              : <span className="podium-player-name" style={{
                  fontFamily: T.fTitle, fontStyle: 'italic', textTransform: 'uppercase',
                  fontSize: 22, color: T.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.handle}</span>
            }
          </div>
          <div className="podium-badges" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <CharPill name={p.char} />
            {showEwc && <EwcBadge />}
            {p.prize && (
              <span className="podium-prize" style={{ fontFamily: T.fDisplay, fontSize: 14, fontWeight: 700, color: T.accent, letterSpacing: '0.02em' }}>
                {p.prize}
              </span>
            )}
            {p.cptPts != null && (
              <span style={{ fontFamily: T.fDisplay, fontSize: 12, fontWeight: 700, color: T.accent }}>
                {p.cptPts.toLocaleString()} PTS
              </span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 22, flexShrink: 0 }}>{medal}</div>
      </div>
      {/* アコーディオン展開パネル */}
      {isExpanded && p.playerId && (
        <div className="match-history-panel" style={{
          background: 'rgba(255,255,255,0.025)',
          borderRadius: '0 0 10px 10px',
          padding: '12px 16px 16px',
          border: `1px solid ${medalColor}33`,
          borderTop: 'none',
        }}>
          <MatchHistoryPanel playerId={p.playerId} sets={sets} />
        </div>
      )}
    </div>
  )
}

// ─── Standings ────────────────────────────────────────────────────

type SortKey = 'placement' | 'handle'

function StandingsTable({
  entrants,
  tournamentId,
  isCptPremier = false,
  ewcQualifyingSpots = null,
  sets = [],
}: {
  entrants: EntrantRow[]
  tournamentId: number
  isCptPremier?: boolean
  ewcQualifyingSpots?: number | null
  sets?: SetRow[]
}) {
  const [sortKey, setSortKey] = useState<SortKey>('placement')
  const [asc, setAsc] = useState(true)
  const [search, setSearch] = useState('')
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [expandedPlayerId, setExpandedPlayerId] = useState<number | null>(null)

  const prizeMap = TOURNAMENT_PRIZE_MAP[tournamentId] ?? {}

  // Build PodiumEntry for an entrant
  const toPodiumEntry = (e: EntrantRow): PodiumEntry => {
    const p   = e.player!
    const eff = effectivePlacement(e)!
    const rawPrize = eff ? (prizeMap[eff] ?? e.prizeAmount ?? null) : (e.prizeAmount ?? null)
    return {
      rank:        eff,
      handle:      p.handle,
      countryCode: p.countryCode,
      char:        p.usedCharacters ? p.usedCharacters.split('/')[0] : p.character,
      prize:       (rawPrize != null && rawPrize > 0) ? `$${Math.round(rawPrize).toLocaleString()}` : '',
      cptPts:      isCptPremier && eff === 1 ? 0 : (isCptPremier && eff ? CPT_PREMIER_POINTS[eff] ?? 0 : null),
      playerId:    p.id,
    }
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setAsc(a => !a)
    else { setSortKey(key); setAsc(key === 'placement') }
  }

  const hasAnyPlacement = entrants.some(e => e.placement !== null || e.inferredPlacement !== null)
  const isSearching     = search.trim() !== ''

  const allSorted = [...entrants]
    .filter(e => e.player && e.player.handle.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const p = a.player!, q = b.player!
      let diff = 0
      if (sortKey === 'placement') {
        diff = (effectivePlacement(a) ?? 9999) - (effectivePlacement(b) ?? 9999)
      } else if (sortKey === 'handle') diff = p.handle.localeCompare(q.handle)
      return asc ? diff : -diff
    })

  // Podium: Top 3 entries shown as independent cards (when not searching)
  const podiumEntrants = !isSearching
    ? allSorted.filter(e => {
        const eff = effectivePlacement(e)
        return eff !== null && eff <= 3
      })
    : []
  const podiumRanks = new Set(podiumEntrants.map(e => effectivePlacement(e)))

  // CPT Premier: show only CPT point range (top 32) — no toggle button
  const CPT_LIMIT = 32
  const cappedForCpt = isCptPremier && !isSearching
  const sorted = (() => {
    const base = isSearching ? allSorted : allSorted.filter(e => !podiumRanks.has(effectivePlacement(e)))
    return cappedForCpt
      ? base.filter(e => (effectivePlacement(e) ?? 9999) <= CPT_LIMIT)
      : base
  })()

  // 検索結果が1件になったら自動展開
  const prevSearchCount = React.useRef<number>(0)
  React.useEffect(() => {
    if (isSearching && allSorted.length === 1 && allSorted[0].player) {
      setExpandedPlayerId(allSorted[0].player.id)
    } else if (!isSearching) {
      setExpandedPlayerId(null)
    }
    prevSearchCount.current = allSorted.length
  }, [search, allSorted.length, isSearching])

  // 列数（colSpan用）: rank + player + flag + char + prize + EWC? + CPT? + expand
  const colCount = 5 + (ewcQualifyingSpots != null ? 1 : 0) + (isCptPremier ? 1 : 0) + 1

  const SortTh = ({ id, label, align = 'left' }: { id: SortKey; label: string; align?: string }) => (
    <th onClick={() => handleSort(id)} style={{
      padding: '11px 16px', textAlign: align as 'left' | 'center' | 'right',
      fontFamily: T.fDisplay, fontSize: 12, fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      color: sortKey === id ? T.accent : T.muted,
      background: T.card, cursor: 'pointer', userSelect: 'none',
      borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
    }}>
      {label}{sortKey === id ? (asc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  const StaticTh = ({ label, align = 'left' }: { label: string; align?: string }) => (
    <th style={{
      padding: '11px 16px', textAlign: align as 'left' | 'center' | 'right',
      fontFamily: T.fDisplay, fontSize: 12, fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted,
      background: T.card, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
    }}>{label}</th>
  )

  return (
    <div>
      {/* ── Podium: Top 3 independent cards ── */}
      {podiumEntrants.length > 0 && !isSearching && (
        <div className="podium-section" style={{ marginBottom: 28 }}>
          {(() => {
            const champ   = podiumEntrants.find(e => effectivePlacement(e) === 1)
            const runners = podiumEntrants.filter(e => effectivePlacement(e) !== 1)
                                          .sort((a, b) => (effectivePlacement(a) ?? 9) - (effectivePlacement(b) ?? 9))
            return (
              <>
                {champ && (
                  <PodiumChampion
                    p={toPodiumEntry(champ)}
                    ewcSpots={ewcQualifyingSpots}
                    sets={sets}
                    expandedPlayerId={expandedPlayerId}
                    setExpandedPlayerId={setExpandedPlayerId}
                  />
                )}
                {runners.length > 0 && (
                  <div className="podium-runners" style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                    {runners.map(e => (
                      <PodiumRunner
                        key={e.entrantId}
                        p={toPodiumEntry(e)}
                        ewcSpots={ewcQualifyingSpots}
                        sets={sets}
                        expandedPlayerId={expandedPlayerId}
                        setExpandedPlayerId={setExpandedPlayerId}
                      />
                    ))}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* ── Search + 4位以降 label ── */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        {!isSearching && podiumEntrants.length > 0 && (
          <span style={{
            fontFamily: T.fTitle, fontStyle: 'italic', textTransform: 'uppercase',
            fontSize: 16, color: T.text, letterSpacing: '-0.01em',
          }}>{UI_TEXT.fourthAndBelow}</span>
        )}
        <div style={{ marginLeft: 'auto' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={UI_TEXT.searchPlaceholder}
          style={{
            background: T.surface2, border: `1px solid ${T.border}`,
            borderRadius: 6, padding: '8px 14px', color: T.text,
            fontFamily: T.fBody, fontSize: 14, outline: 'none', width: 240,
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = T.border2)}
          onBlur={e => (e.target.style.borderColor = T.border)}
        />
        </div>
      </div>

      <div style={{ borderRadius: 10, border: `1px solid ${T.border}`, overflow: 'hidden', background: T.card }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="standings-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <SortTh id="placement" label={UI_TEXT.colRank}      align="center" />
                <SortTh id="handle"    label={UI_TEXT.colPlayer} />
                <StaticTh label={UI_TEXT.colFlag} />
                <StaticTh label={UI_TEXT.colCharacter} />
                <StaticTh label={UI_TEXT.colPrize}  align="right" />
                {ewcQualifyingSpots != null && <StaticTh label={UI_TEXT.colEwc} align="center" />}
                {isCptPremier && <StaticTh label={UI_TEXT.colCpt} align="center" />}
                <th style={{ width: 32, background: T.card, borderBottom: `1px solid ${T.border}` }} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => {
                const p = e.player!
                const isHovered = hoveredRow === i
                const isExpanded = expandedPlayerId === p.id
                const rowBg = isHovered ? T.rowHover : i % 2 === 0 ? 'transparent' : T.rowEven
                const eff = effectivePlacement(e)
                const isInferred = e.placement === null && e.inferredPlacement !== null
                const medal = eff === 1 ? '🥇' : eff === 2 ? '🥈' : eff === 3 ? '🥉' : null
                const cptPts = isCptPremier ? (eff === 1 ? null : (eff ? CPT_PREMIER_POINTS[eff] ?? 0 : 0)) : null
                const prizeAmt = eff ? (prizeMap[eff] ?? e.prizeAmount ?? null) : (e.prizeAmount ?? null)

                const isFirst = eff === 1
                return (
                  <React.Fragment key={e.entrantId}>
                    <tr
                      className="standings-row"
                      onMouseEnter={() => setHoveredRow(i)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onClick={() => setExpandedPlayerId(isExpanded ? null : p.id)}
                      style={{
                        background: isFirst
                          ? (isHovered ? 'rgba(0,212,170,0.10)' : 'rgba(0,212,170,0.05)')
                          : rowBg,
                        borderBottom: `1px solid ${isExpanded ? 'transparent' : isFirst ? 'rgba(0,212,170,0.18)' : T.border}`,
                        boxShadow: isFirst ? 'inset 4px 0 0 0 #00d4aa' : 'none',
                        transition: 'background 0.1s',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Rank */}
                      <td style={{ padding: '12px 16px', textAlign: 'center', width: 56 }}>
                        {medal
                          ? <span style={{ fontSize: 20 }}>{medal}</span>
                          : <span style={{
                              fontFamily: T.fDisplay, fontSize: 17, fontWeight: 700,
                              color: placementColor(eff),
                              opacity: isInferred ? 0.7 : 1,
                            }}>{eff ?? '—'}</span>
                        }
                      </td>
                      {/* Player */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: eff === 1 ? `${T.accent}22` : `${T.surface3}`,
                            border: `1px solid ${eff === 1 ? T.accent + '60' : T.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: T.fDisplay, fontSize: 13, fontWeight: 800,
                            color: eff === 1 ? T.accent : T.muted,
                          }}>
                            {p.handle.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <Link
                              href={`/player/${p.id}`}
                              onClick={ev => ev.stopPropagation()}
                              style={{ textDecoration: 'none' }}
                            >
                              <div style={{
                                fontFamily: T.fDisplay, fontSize: 17, fontWeight: 700,
                                color: '#60a5fa', letterSpacing: '0.01em',
                              }}>{p.handle}</div>
                            </Link>
                            {p.team && (
                              <div style={{ fontFamily: T.fBody, fontSize: 11, color: T.dim, marginTop: 1 }}>
                                {p.team}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Country flag */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 20, lineHeight: 1 }} title={p.countryCode ?? ''}>
                          {flag(p.countryCode)}
                        </span>
                      </td>
                      {/* Character */}
                      <td style={{ padding: '12px 16px' }}>
                        {p.usedCharacters
                          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {p.usedCharacters.split('/').map(c => <CharPill key={c} name={c} />)}
                            </div>
                          : <CharPill name={p.character} />
                        }
                      </td>
                      {/* Prize */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {prizeAmt != null && prizeAmt > 0 && (
                          <span style={{
                            fontFamily: T.fDisplay,
                            fontSize: isFirst ? 20 : 17,
                            fontWeight: 800,
                            color: T.accent,
                            letterSpacing: '-0.01em',
                          }}>
                            ${Math.round(prizeAmt).toLocaleString()}
                          </span>
                        )}
                      </td>
                      {/* EWC badge column */}
                      {ewcQualifyingSpots != null && (
                        <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {eff != null && eff <= ewcQualifyingSpots ? <EwcBadge /> : null}
                        </td>
                      )}
                      {/* CPT points */}
                      {isCptPremier && (
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {eff === 1 ? (
                            <CcQualifiedBadge />
                          ) : cptPts ? (
                            <span style={{
                              fontFamily: T.fDisplay, fontSize: 15, fontWeight: 700,
                              color: cptPts >= 100 ? T.gold : cptPts >= 50 ? '#60a5fa' : T.muted,
                            }}>
                              {cptPts}
                            </span>
                          ) : (
                            <span style={{ fontFamily: T.fDisplay, fontSize: 13, color: T.dim }}>—</span>
                          )}
                        </td>
                      )}
                      {/* Expand indicator */}
                      <td style={{ padding: '12px 8px', textAlign: 'center', width: 32, color: T.muted, fontSize: 11 }}>
                        {isExpanded ? '▲' : '▼'}
                      </td>
                    </tr>

                    {/* ── アコーディオン: 対戦履歴（共通コンポーネント使用）── */}
                    {isExpanded && (
                      <tr className="match-history-row">
                        <td
                          colSpan={colCount}
                          style={{
                            background: 'rgba(255,255,255,0.025)',
                            padding: '12px 16px 16px',
                            borderBottom: `1px solid ${T.border}`,
                          }}
                        >
                          <MatchHistoryPanel playerId={p.id} sets={sets} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary footer */}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: T.fDisplay, fontSize: 12, color: T.dim, letterSpacing: '0.06em' }}>
          {sorted.length} / {entrants.length} {UI_TEXT.playersDisplayed}
        </span>
        {!hasAnyPlacement && entrants.length > 0 && (
          <span style={{ fontFamily: T.fBody, fontSize: 11, color: T.dim }}>
            {UI_TEXT.estimatedPlacementNote}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Bracket view ────────────────────────────────────────────────

// ラウンドの表示順定義（ブラケット進行順）
// getBracketSortOrder は src/lib/bracketOrder.ts に移管済み

/**
 * 最終ブラケットフェーズを検出する。
 *
 * 戦略 (優先順):
 *   1. pool_identifier ベース:
 *      a. GF セットの pool_identifier → Top 8
 *      b. 残りのプールのうち最も高い maxId かつ小さいセット数のもの → Top 24
 *      （CB2026: VVX15=Top8, PX133=Top24）
 *
 *   2. フォールバック: 出現頻度フィルタ（GF/WF/LF/LSF を 1〜2 回のみ登場で特定）
 *
 * 戻り値は時系列順（先頭が早いフェーズ）: [Top 24, Top 8] or [Final Bracket]
 */
function detectFinalPhases(sets: SetRow[]): Array<{ name: string; sets: SetRow[] }> {
  // ── 戦略 1: pool_identifier ベース ───────────────────────────
  const gfSet = sets.find(s =>
    /grand final/i.test(s.roundText) && !/reset/i.test(s.roundText) && s.winnerId !== null
  )

  if (gfSet?.poolIdentifier) {
    const top8PoolId = gfSet.poolIdentifier
    const top8Sets   = sets.filter(s => s.poolIdentifier === top8PoolId)
    const top8MinId  = Math.min(...top8Sets.map(s => s.id))

    // Top 24 候補:
    //   ・Top 8 以外のプールで
    //   ・すべてのセット ID が top8MinId より小さい（= Top 8 よりも前に挿入）
    //   ・セット数が閾値以下（= 大会プールではない小さいブラケット）
    //   ・その中で最も高い maxId = Top 8 直前フェーズ
    const poolStats = new Map<string, { maxId: number; count: number; sets: SetRow[] }>()
    for (const s of sets) {
      if (!s.poolIdentifier || s.poolIdentifier === top8PoolId) continue
      if (s.id >= top8MinId) continue  // Top 8 以降に挿入されたセットは除外
      if (!poolStats.has(s.poolIdentifier)) {
        poolStats.set(s.poolIdentifier, { maxId: 0, count: 0, sets: [] })
      }
      const stat = poolStats.get(s.poolIdentifier)!
      stat.maxId = Math.max(stat.maxId, s.id)
      stat.count++
      stat.sets.push(s)
    }

    // 閾値: Top 8 セット数 × 3（または最低 25）以下のプールのみ候補とする
    const threshold = Math.max(top8Sets.length * 3, 25)
    const candidates = [...poolStats.entries()]
      .filter(([_, st]) => st.count <= threshold)
      .sort((a, b) => b[1].maxId - a[1].maxId)  // maxId 降順 = Top 8 直前が先頭

    const result: Array<{ name: string; sets: SetRow[] }> = []
    if (candidates.length > 0) {
      // 最も高い maxId のプール = Top 24（Top 8 の直前フェーズ）
      result.push({ name: 'Top 24', sets: candidates[0][1].sets })
    }
    result.push({ name: 'Top 8', sets: top8Sets })
    return result
  }

  // ── 戦略 2: 出現頻度フォールバック ───────────────────────────
  const roundCount: Record<string, number> = {}
  for (const s of sets) {
    if (s.roundText) roundCount[s.roundText] = (roundCount[s.roundText] ?? 0) + 1
  }
  const finalSets = sets.filter(s => {
    const score = getBracketSortOrder(s.roundText)
    return score <= 5 && (roundCount[s.roundText] ?? 99) <= 2
  })
  if (finalSets.length === 0) return [{ name: 'ブラケット', sets }]
  return [{ name: 'Final Bracket', sets: finalSets }]
}

function BracketMatchRow({ s, isGF }: { s: SetRow; isGF: boolean }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'stretch', gap: 0,
      background: isGF ? 'rgba(0,212,170,0.04)' : T.surface,
      border: `1px solid ${isGF ? T.border2 : T.border}`,
      borderRadius: 8, overflow: 'hidden',
      boxShadow: isGF ? 'var(--sf6-accent-glow)' : 'none',
    }}>
      {/* ── Winner (left) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        justifyContent: 'flex-end', padding: '10px 12px',
        background: isGF ? 'rgba(0,212,170,0.08)' : 'rgba(0,212,170,0.05)',
        borderRight: `2px solid rgba(0,212,170,0.25)`,
        minWidth: 0,
      }}>
        <div style={{ textAlign: 'right', minWidth: 0, flex: 1 }}>
          <Link href={s.winnerId ? `/player/${s.winnerId}` : '#'} style={{ textDecoration: 'none' }}>
            <div style={{
              fontFamily: T.fDisplay, fontSize: 15, fontWeight: 800,
              color: T.accent, letterSpacing: '0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{s.winnerHandle}</div>
          </Link>
          {s.winnerCharacter && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3 }}>
              <CharPill name={s.winnerCharacter} />
            </div>
          )}
        </div>
        <span style={{ fontSize: 15, flexShrink: 0 }}>{flag(s.winnerCountry)}</span>
        {/* 勝者バッジ */}
        <span style={{
          fontFamily: T.fDisplay, fontSize: 9, fontWeight: 900,
          letterSpacing: '0.14em', color: '#0a1a14',
          background: T.accent, borderRadius: 3, padding: '2px 6px',
          flexShrink: 0, lineHeight: 1.4,
        }}>WIN</span>
      </div>

      {/* ── Score ── */}
      <div style={{
        fontFamily: T.fDisplay, fontWeight: 900, lineHeight: 1,
        letterSpacing: '-0.02em', fontSize: 26, textAlign: 'center',
        padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 64, background: T.surface,
      }}>
        <span style={{ color: T.text }}>{s.winnerScore}</span>
        <span style={{ color: T.dim, margin: '0 3px', fontSize: 16 }}>–</span>
        <span style={{ color: T.dim }}>{s.loserScore}</span>
      </div>

      {/* ── Loser (right) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        justifyContent: 'flex-start', padding: '10px 12px',
        background: 'rgba(0,0,0,0.12)',
        borderLeft: `2px solid ${T.border}`,
        minWidth: 0, opacity: 0.7,
      }}>
        {/* 敗者バッジ */}
        <span style={{
          fontFamily: T.fDisplay, fontSize: 9, fontWeight: 800,
          letterSpacing: '0.12em', color: T.dim,
          background: T.surface3, border: `1px solid ${T.border}`,
          borderRadius: 3, padding: '2px 5px', flexShrink: 0, lineHeight: 1.4,
        }}>OUT</span>
        <span style={{ fontSize: 15, flexShrink: 0 }}>{flag(s.loserCountry)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Link href={s.loserId ? `/player/${s.loserId}` : '#'} style={{ textDecoration: 'none' }}>
            <div style={{
              fontFamily: T.fDisplay, fontSize: 15, fontWeight: 600,
              color: T.muted, letterSpacing: '0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textDecoration: 'line-through', textDecorationColor: `${T.muted}50`,
            }}>{s.loserHandle}</div>
          </Link>
          {s.loserCharacter && <div style={{ marginTop: 3 }}><CharPill name={s.loserCharacter} /></div>}
        </div>
      </div>
    </div>
  )
}

// ─── Timeline display constants ──────────────────────────────────

/**
 * Top 24 フェーズ（CB2026: PX133）タイムライン順
 * Rounds: WQF×4, LR1×8, LR2×4, LR3×4
 */
const TOP24_TIMELINE = [
  'Losers Round 1',          // LR1: 8 sets - losers bracket start (Round 3 losers)
  'Winners Quarter-Final',   // WQF: 4 sets - winners bracket
  'Losers Round 2',          // LR2: 4 sets - LR1 winners + WQF losers
  'Losers Round 3',          // LR3: 4 sets - losers continue
]

/**
 * Top 8 フェーズ（CB2026: VVX15）タイムライン順
 * Rounds: LR1×2, WSF×2, LQF×2, WF×1, LSF×1, LF×1, GF×1, GFR×0-1
 */
const TOP8_TIMELINE = [
  'Losers Round 1',          // LR1: Top 24 losers side drops here
  'Winners Semi-Final',      // WSF: 4 players → 2 advance, 2 drop to LQF
  'Losers Quarter-Final',    // LQF: LR1 winners vs WSF losers
  'Winners Final',           // WF: 2 WSF winners compete
  'Losers Semi-Final',       // LSF: LQF winners
  'Losers Final',            // LF: LSF winner vs WF loser
  'Grand Final',             // GF: WF winner vs LF winner
  'Grand Final Reset',       // GFR: if GF loser wins
]

/**
 * 汎用タイムライン順（フォールバック用）
 */
const TIMELINE_ORDER = [
  'Winners Round 1', 'Losers Round 1', 'Winners Round 2', 'Losers Round 2',
  'Winners Quarter-Final', 'Losers Round 3', 'Winners Semi-Final',
  'Losers Round 4', 'Losers Quarter-Final', 'Losers Round 5',
  'Winners Final', 'Losers Semi-Final', 'Losers Final',
  'Grand Final', 'Grand Final Reset',
]

const TOP24_FLOW_NOTES: Record<string, string> = {
  'Losers Round 1':        '← Round 3 losers drop in',
  'Winners Quarter-Final': 'Winners bracket quarterfinals',
  'Losers Round 2':        '← WQF losers drop here',
  'Losers Round 3':        '← LR2 winners continue',
}

const TOP8_FLOW_NOTES: Record<string, string> = {
  'Losers Round 1':       '← Top 24 losers side',
  'Losers Quarter-Final': '← WSF losers drop here',
  'Losers Semi-Final':    '← LQF winner advances',
  'Losers Final':         '← WF loser drops here',
}

const FLOW_NOTES: Record<string, string> = {
  'Losers Round 1':       '← WSF losers drop here',
  'Losers Round 2':       '← WR2/WQF losers drop here',
  'Losers Round 3':       '← WQF losers drop here',
  'Losers Round 4':       '← WSF losers drop here',
  'Losers Round 5':       '← WF losers drop here',
  'Losers Quarter-Final': '← LR1 winners advance',
  'Losers Semi-Final':    '← WF loser drops here',
  'Losers Final':         '← LSF winner vs WF/WSF loser',
}

function roundColor(rt: string): string {
  if (/grand final/i.test(rt)) return '#F59E0B'
  if (/winners/i.test(rt))     return '#3B82F6'
  if (/losers/i.test(rt))      return '#EF4444'
  return T.border
}

function roundIcon(rt: string): string {
  if (/grand final/i.test(rt)) return '🏆'
  if (/winners/i.test(rt))     return '🔵'
  if (/losers/i.test(rt))      return '🔴'
  return '⚪'
}

// ─── Section divider ─────────────────────────────────────────────

function SectionDivider({ label, isTop8 }: { label: string; isTop8: boolean }) {
  const color = isTop8 ? '#F59E0B' : '#6b7280'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      margin: `${isTop8 ? 32 : 0}px 0 4px`,
    }}>
      <div style={{ flex: 1, height: 1, background: `${color}40` }} />
      <span style={{
        fontFamily: T.fDisplay, fontSize: isTop8 ? 13 : 11, fontWeight: 800,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        color, padding: '2px 10px',
        border: `1px solid ${color}40`, borderRadius: 4,
        background: `${color}0a`,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: `${color}40` }} />
    </div>
  )
}

// ─── BracketView (Timeline + Phase-based) ────────────────────────

function BracketView({ sets }: { sets: SetRow[] }) {
  if (sets.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: T.dim, fontFamily: T.fDisplay }}>
        ブラケットデータなし
      </div>
    )
  }

  // 最終フェーズを検出: 2つ以上検出された場合はタイムライン統合表示
  // （例: Top 24 + Top 8）
  const finalPhases = detectFinalPhases(sets)
  if (finalPhases.length >= 2) {
    return <BracketTimeline sets={sets} />
  }

  // ── phase_name あり (CC11, EVO など): フェーズ切替 UI ─────────────
  const hasPhaseNames = sets.some(s => s.phase !== '')
  if (hasPhaseNames) {
    return <BracketViewPhased sets={sets} />
  }

  // ── phase_name なし・単一最終フェーズ: タイムライン表示 ───────────
  return <BracketTimeline sets={sets} />
}

// ─── Phase-based view (for tournaments with phase_name) ──────────

function BracketViewPhased({ sets }: { sets: SetRow[] }) {
  const phases = useMemo<Array<{ name: string; sets: SetRow[] }>>(() => {
    const phaseMap = new Map<string, SetRow[]>()
    for (const s of sets) {
      const ph = s.phase || 'その他'
      if (!phaseMap.has(ph)) phaseMap.set(ph, [])
      phaseMap.get(ph)!.push(s)
    }
    const phaseOrder = ['Pool', 'Group', 'Top 64', 'Top 32', 'Top 24', 'Top 16', 'Top 8', 'Top 4']
    return [...phaseMap.entries()]
      .sort(([a], [b]) => {
        const ai = phaseOrder.findIndex(p => a.toLowerCase().includes(p.toLowerCase()))
        const bi = phaseOrder.findIndex(p => b.toLowerCase().includes(p.toLowerCase()))
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
      })
      .map(([name, psets]) => ({ name, sets: psets }))
  }, [sets])

  const [activePhase, setActivePhase] = useState(
    () => phases[phases.length - 1]?.name ?? ''
  )

  const phaseSets = (phases.find(p => p.name === activePhase)?.sets ?? [])
    .filter(s => s.winnerId !== null || s.loserId !== null)

  const roundGroups = new Map<string, SetRow[]>()
  for (const s of phaseSets) {
    const r = s.roundText || '—'
    if (!roundGroups.has(r)) roundGroups.set(r, [])
    roundGroups.get(r)!.push(s)
  }
  for (const matches of roundGroups.values()) {
    matches.sort((a, b) => b.id - a.id)
  }
  const sortedRounds = [...roundGroups.entries()]
    .sort(([a], [b]) => getBracketSortOrder(a) - getBracketSortOrder(b))

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? T.accentDim : T.surface2,
    border: `1px solid ${active ? T.border2 : T.border}`,
    borderRadius: 6, padding: '4px 14px', cursor: 'pointer',
    fontFamily: T.fDisplay, fontSize: 12, fontWeight: 700,
    letterSpacing: '0.07em', textTransform: 'uppercase',
    color: active ? T.accent : T.muted,
    transition: 'all 0.1s',
  })

  return (
    <div>
      {phases.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {phases.map(ph => (
            <button key={ph.name} onClick={() => setActivePhase(ph.name)} style={btnStyle(activePhase === ph.name)}>
              {ph.name}
              <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.65, fontWeight: 600 }}>
                ({ph.sets.filter(s => s.winnerId !== null || s.loserId !== null).length})
              </span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {sortedRounds.map(([round, matches]) => {
          const isGF = /grand final/i.test(round)
          const color = roundColor(round)
          return (
            <div key={round}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 14 }}>{roundIcon(round)}</span>
                <div style={{
                  fontFamily: T.fDisplay, fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.16em', textTransform: 'uppercase',
                  color: isGF ? T.accent : T.dim,
                }}>{round}</div>
                <div style={{ flex: 1, height: 1, background: `${color}30` }} />
                <div style={{ fontFamily: T.fDisplay, fontSize: 10, color: T.dim }}>{matches.length}試合</div>
              </div>
              <div style={{ display: 'grid', gap: 6, gridTemplateColumns: matches.length > 2 ? '1fr 1fr' : '1fr' }}>
                {matches.map(s => <BracketMatchRow key={s.id} s={s} isGF={isGF} />)}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 16, fontFamily: T.fDisplay, fontSize: 11, color: T.dim, letterSpacing: '0.06em' }}>
        {phaseSets.length} 試合 · {activePhase}
      </div>
    </div>
  )
}

// ─── Timeline view (for final bracket phases like CB2026) ─────────

/** フェーズ名からタイムライン順とフロー注釈を取得 */
function getPhaseTimeline(phaseName: string): {
  order: string[]
  flowNotes: Record<string, string>
  label: string
  isTop8: boolean
} {
  if (phaseName === 'Top 24') {
    return { order: TOP24_TIMELINE, flowNotes: TOP24_FLOW_NOTES, label: 'TOP 24', isTop8: false }
  }
  if (phaseName === 'Top 8' || phaseName === 'Final Bracket') {
    return { order: TOP8_TIMELINE, flowNotes: TOP8_FLOW_NOTES, label: phaseName === 'Top 8' ? 'TOP 8' : 'FINAL BRACKET', isTop8: true }
  }
  return { order: TIMELINE_ORDER, flowNotes: FLOW_NOTES, label: phaseName.toUpperCase(), isTop8: true }
}

/** ラウンドエントリをタイムライン順にソート */
function sortRoundsByTimeline(
  roundGroups: Map<string, SetRow[]>,
  order: string[],
): Array<{ round: string; sets: SetRow[] }> {
  const entries: Array<{ round: string; sets: SetRow[]; tlIdx: number }> = []
  for (const [round, roundSets] of roundGroups) {
    const tlIdx = order.findIndex(r => r.toLowerCase() === round.toLowerCase())
    entries.push({ round, sets: roundSets, tlIdx })
  }
  return entries.sort((a, b) => {
    if (a.tlIdx < 0 && b.tlIdx < 0) return getBracketSortOrder(a.round) - getBracketSortOrder(b.round)
    if (a.tlIdx < 0) return -1
    if (b.tlIdx < 0) return  1
    return a.tlIdx - b.tlIdx
  })
}

function BracketTimeline({ sets }: { sets: SetRow[] }) {
  const phases = useMemo(() => detectFinalPhases(sets), [sets])

  const totalSets = phases.reduce(
    (acc, p) => acc + p.sets.filter(s => s.winnerId !== null || s.loserId !== null).length,
    0
  )

  if (totalSets === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: T.dim, fontFamily: T.fDisplay }}>
        最終ブラケットデータなし
      </div>
    )
  }

  return (
    <div>
      {phases.map((phase, phaseIdx) => {
        const phaseSets = phase.sets.filter(s => s.winnerId !== null || s.loserId !== null)
        if (phaseSets.length === 0) return null

        // ラウンドごとにグループ化（同ラウンド内は ID 降順）
        const roundGroups = new Map<string, SetRow[]>()
        for (const s of phaseSets) {
          const r = s.roundText || '—'
          if (!roundGroups.has(r)) roundGroups.set(r, [])
          roundGroups.get(r)!.push(s)
        }
        for (const matches of roundGroups.values()) {
          matches.sort((a, b) => b.id - a.id)
        }

        const { order, flowNotes, label, isTop8 } = getPhaseTimeline(phase.name)
        const sortedEntries = sortRoundsByTimeline(roundGroups, order)

        return (
          <div key={phase.name} style={{ marginTop: phaseIdx > 0 ? 32 : 0 }}>
            {/* フェーズセクションヘッダー */}
            <SectionDivider label={label} isTop8={isTop8} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
              {sortedEntries.map(({ round, sets: matches }) => {
                const isGF  = /grand final/i.test(round)
                const color = roundColor(round)
                const icon  = roundIcon(round)
                const note  = flowNotes[round]

                return (
                  <React.Fragment key={`${phase.name}-${round}`}>
                    <div style={{
                      borderLeft: `3px solid ${color}`,
                      paddingLeft: 14,
                      ...(isGF ? {
                        background: 'rgba(245,158,11,0.03)',
                        borderRadius: '0 8px 8px 0',
                        padding: '10px 10px 10px 14px',
                      } : {}),
                    }}>
                      {/* ラウンドヘッダー */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>
                        <div style={{
                          fontFamily: T.fDisplay, fontSize: 11, fontWeight: 800,
                          letterSpacing: '0.16em', textTransform: 'uppercase',
                          color: isGF ? '#F59E0B' : T.muted,
                          flex: 1,
                        }}>{round}</div>
                        <span style={{
                          fontFamily: T.fDisplay, fontSize: 10, fontWeight: 700,
                          color: T.dim, letterSpacing: '0.06em',
                          background: T.surface3, borderRadius: 4,
                          padding: '1px 7px', border: `1px solid ${T.border}`,
                        }}>{matches.length} sets</span>
                      </div>

                      {/* フロー注釈 */}
                      {note && (
                        <div style={{
                          fontFamily: T.fBody, fontSize: 11,
                          color: '#9CA3AF', fontStyle: 'italic',
                          marginBottom: 8, marginTop: -2,
                          letterSpacing: '0.01em',
                        }}>{note}</div>
                      )}

                      {/* マッチカード群 */}
                      <div style={{
                        display: 'grid', gap: 6,
                        gridTemplateColumns: matches.length > 2 ? '1fr 1fr' : '1fr',
                      }}>
                        {matches.map(s => <BracketMatchRow key={s.id} s={s} isGF={isGF} />)}
                      </div>
                    </div>
                  </React.Fragment>
                )
              })}
            </div>

            <div style={{ marginTop: 12, fontFamily: T.fDisplay, fontSize: 11, color: T.dim, letterSpacing: '0.06em' }}>
              {phaseSets.length} 試合 · {phase.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Match list ───────────────────────────────────────────────────

function WinBadge() {
  return (
    <span style={{
      background: T.accentDim, border: `1px solid ${T.border2}`,
      borderRadius: 4, padding: '1px 6px',
      fontFamily: T.fDisplay, fontSize: 9, fontWeight: 800,
      letterSpacing: '0.12em', color: T.accent,
    }}>WIN</span>
  )
}

function MatchCard({ s }: { s: SetRow }) {
  const [hov, setHov] = useState(false)
  const displayLabel = s.inferredRoundLabel ?? s.roundText
  const isGenericLabel = s.inferredRoundLabel !== null && s.roundText === s.phase

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: s.isGrandFinal
          ? (hov ? 'rgba(0,212,170,0.07)' : 'rgba(0,212,170,0.04)')
          : (hov ? T.surface2 : T.card),
        border: `1px solid ${s.isGrandFinal ? T.border2 : (hov ? T.border2 : T.border)}`,
        borderRadius: 10, padding: '16px 20px',
        transition: 'all 0.15s', cursor: 'pointer',
        boxShadow: s.isGrandFinal ? 'var(--sf6-accent-glow)' : 'none',
      }}
    >
      {/* Round label */}
      <div style={{
        fontFamily: T.fDisplay, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: s.isGrandFinal ? T.accent : T.dim,
        marginBottom: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {s.isGrandFinal && <span style={{ fontSize: 14 }}>🏆</span>}
          {displayLabel}
          {isGenericLabel && !s.isGrandFinal && (
            <span style={{ fontSize: 9, color: T.dim, fontWeight: 400, letterSpacing: 0 }}>(推定)</span>
          )}
        </span>
        {s.phase && !isGenericLabel && (
          <span style={{
            fontSize: 10, color: T.muted, background: T.surface3,
            border: `1px solid ${T.border}`, borderRadius: 4, padding: '1px 8px', flexShrink: 0,
          }}>{s.phase}</span>
        )}
      </div>

      {/* Match row: P1 — score — P2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
        {/* Winner (left) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 17 }}>{flag(s.winnerCountry)}</span>
            <Link href={s.winnerId ? `/player/${s.winnerId}` : '#'} style={{ textDecoration: 'none' }}>
              <span style={{
                fontFamily: T.fDisplay, fontSize: 19, fontWeight: 800,
                color: T.text, letterSpacing: '0.01em',
              }}>{s.winnerHandle}</span>
            </Link>
            <WinBadge />
          </div>
          <CharPill name={s.winnerCharacter} />
        </div>

        {/* Score */}
        <div style={{ textAlign: 'center', minWidth: 72 }}>
          <div style={{ fontFamily: T.fDisplay, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em', fontSize: 38 }}>
            <span style={{ color: T.text }}>{s.winnerScore}</span>
            <span style={{ color: T.dim, margin: '0 5px', fontSize: 24 }}>–</span>
            <span style={{ color: T.dim }}>{s.loserScore}</span>
          </div>
        </div>

        {/* Loser (right) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Link href={s.loserId ? `/player/${s.loserId}` : '#'} style={{ textDecoration: 'none' }}>
              <span style={{
                fontFamily: T.fDisplay, fontSize: 19, fontWeight: 800,
                color: T.muted, letterSpacing: '0.01em',
                textDecoration: 'line-through',
                textDecorationColor: `${T.muted}60`,
              }}>{s.loserHandle}</span>
            </Link>
            <span style={{ fontSize: 17 }}>{flag(s.loserCountry)}</span>
          </div>
          <CharPill name={s.loserCharacter} />
        </div>
      </div>
    </div>
  )
}

function MatchList({ sets }: { sets: SetRow[] }) {
  const phases = ['すべて', ...Array.from(new Set(sets.map(s => s.phase).filter(Boolean)))]
  const rounds  = ['すべて', ...Array.from(new Set(sets.map(s => s.roundText).filter(Boolean)))]
  const [phaseFilter, setPhaseFilter] = useState('すべて')
  const [roundFilter, setRoundFilter] = useState('すべて')

  const filtered = sets.filter(s =>
    (phaseFilter === 'すべて' || s.phase === phaseFilter) &&
    (roundFilter === 'すべて' || s.roundText === roundFilter)
  )

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? T.accentDim : T.surface2,
    border: `1px solid ${active ? T.border2 : T.border}`,
    borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
    fontFamily: T.fDisplay, fontSize: 12, fontWeight: 700,
    letterSpacing: '0.07em', textTransform: 'uppercase',
    color: active ? T.accent : T.muted,
    transition: 'all 0.1s',
  })

  return (
    <div>
      {/* Phase filter */}
      {phases.length > 2 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {phases.map(ph => (
            <button key={ph} onClick={() => { setPhaseFilter(ph); setRoundFilter('すべて') }}
              style={btnStyle(phaseFilter === ph)}>{ph}</button>
          ))}
        </div>
      )}

      {/* Round filter */}
      {rounds.length > 2 && phaseFilter !== 'すべて' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {rounds
            .filter(r => r === 'すべて' || sets.some(s => s.roundText === r && (phaseFilter === 'すべて' || s.phase === phaseFilter)))
            .map(r => (
              <button key={r} onClick={() => setRoundFilter(r)} style={btnStyle(roundFilter === r)}>{r}</button>
            ))}
        </div>
      )}

      <div style={{ marginBottom: 16, fontFamily: T.fDisplay, fontSize: 12, color: T.dim, letterSpacing: '0.06em' }}>
        {filtered.length} 試合
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.map(s => <MatchCard key={s.id} s={s} />)}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: T.dim, fontFamily: T.fDisplay }}>
          試合データなし
        </div>
      )}
    </div>
  )
}

// ─── Character stats (Top 24 scope) ──────────────────────────────

function CharStats({
  sets,
  entrants,
  tournament,
}: {
  sets: SetRow[]
  entrants: EntrantRow[]
  tournament: TournamentInfo
}) {
  // ── 集計対象セットを絞り込む ──────────────────────────────────
  const topPoolIds = [tournament.finalPoolIdentifier, tournament.top24PoolIdentifier]
    .filter((id): id is string => !!id)

  const isFiltered = topPoolIds.length > 0

  const scopeSets = isFiltered
    ? sets.filter(s => s.poolIdentifier && topPoolIds.includes(s.poolIdentifier))
    : sets

  // ── 出場したユニーク選手 ID を収集 ────────────────────────────
  const playerIds = new Set<number>()
  for (const s of scopeSets) {
    if (s.winnerId) playerIds.add(s.winnerId)
    if (s.loserId)  playerIds.add(s.loserId)
  }

  // ── 選手 ID → キャラ のマップ (entrants.player.character が第一優先) ──
  const playerCharMap = new Map<number, string>()
  for (const e of entrants) {
    if (e.player?.id && e.player.character) {
      playerCharMap.set(e.player.id, e.player.character)
    }
  }
  // フォールバック: セットの winner/loser character
  for (const s of scopeSets) {
    if (s.winnerId && !playerCharMap.has(s.winnerId) && s.winnerCharacter) {
      playerCharMap.set(s.winnerId, s.winnerCharacter)
    }
    if (s.loserId  && !playerCharMap.has(s.loserId)  && s.loserCharacter)  {
      playerCharMap.set(s.loserId, s.loserCharacter)
    }
  }

  // ── キャラ別使用人数を集計 (NULL キャラは除外) ────────────────
  const charCount: Record<string, number> = {}
  for (const pid of playerIds) {
    const char = playerCharMap.get(pid)
    if (char) charCount[char] = (charCount[char] ?? 0) + 1
  }

  const totalPlayers = Object.values(charCount).reduce((a, b) => a + b, 0)
  const stats = Object.entries(charCount)
    .map(([char, count]) => ({
      char,
      count,
      pct: totalPlayers > 0 ? Math.round((count / totalPlayers) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const maxCount = Math.max(...stats.map(c => c.count), 1)

  if (stats.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: T.dim, fontFamily: T.fDisplay }}>
        {isFiltered
          ? 'Top 24 ブラケットのキャラデータなし'
          : 'キャラデータなし（tournament_sets に main_character データが必要です）'}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{
          fontFamily: T.fDisplay, fontSize: 13, fontWeight: 800,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: T.accent,
        }}>
          {stats.length} キャラクター · {totalPlayers} 選手
        </div>
        {isFiltered && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {topPoolIds.map(pid => (
              <span key={pid} style={{
                fontFamily: T.fDisplay, fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: T.muted, background: T.surface3,
                border: `1px solid ${T.border}`, borderRadius: 4, padding: '2px 8px',
              }}>
                {pid === tournament.finalPoolIdentifier ? 'Top 8' : 'Top 24'} ({pid})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Chart rows */}
      <div style={{ display: 'grid', gap: 8 }}>
        {stats.map((c, i) => {
          const color = charColor(c.char)
          const barPct = (c.count / maxCount) * 100
          return (
            <div key={c.char} className="char-stat-row" style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: '14px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                {/* Rank */}
                <span style={{
                  fontFamily: T.fDisplay, fontSize: 13, fontWeight: 700, color: T.dim,
                  minWidth: 22, textAlign: 'right', flexShrink: 0,
                }}>{i + 1}</span>
                {/* Char pill */}
                <CharPill name={c.char} />
                {/* Spacer */}
                <div style={{ flex: 1 }} />
                {/* Count */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontFamily: T.fDisplay, fontSize: 24, fontWeight: 900,
                    color: T.text, lineHeight: 1, letterSpacing: '-0.02em',
                  }}>{c.count}</span>
                  <span style={{
                    fontFamily: T.fDisplay, fontSize: 11, fontWeight: 600,
                    color: T.dim, marginLeft: 4, letterSpacing: '0.06em',
                  }}>人</span>
                </div>
                {/* Percentage */}
                <div style={{
                  minWidth: 52, textAlign: 'right',
                }}>
                  <span style={{
                    fontFamily: T.fDisplay, fontSize: 17, fontWeight: 800,
                    color: c.pct >= 15 ? T.accent : T.muted,
                    letterSpacing: '-0.01em',
                  }}>{c.pct}%</span>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{
                height: 5, background: T.surface3, borderRadius: 4, overflow: 'hidden',
                marginLeft: 36,
              }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  width: `${barPct}%`,
                  background: `linear-gradient(90deg, ${color}99, ${color})`,
                  transition: 'width 0.9s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Footnote */}
      <div style={{
        marginTop: 18, fontFamily: T.fBody, fontSize: 11,
        color: T.dim, letterSpacing: '0.02em',
        borderTop: `1px solid ${T.border}`, paddingTop: 10,
      }}>
        ※ CPTポイント獲得圏内（Top 24）の選手が使用したキャラクターの分布
        {!isFiltered && ' · 全セット対象（pool_identifier 未設定）'}
      </div>
    </div>
  )
}

// ─── 404 / Error state ────────────────────────────────────────────

function NotFound() {
  return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontFamily: T.fDisplay, fontSize: 72, fontWeight: 900, color: T.dim }}>404</div>
      <div style={{ fontFamily: T.fDisplay, fontSize: 20, color: T.muted }}>大会が見つかりません</div>
      <a href="/" style={{
        fontFamily: T.fDisplay, fontSize: 14, fontWeight: 700,
        color: T.accent, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase',
        border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 20px',
        marginTop: 8,
      }}>← ホームへ</a>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────

export function TournamentClient({ data }: { data: TournamentData | null }) {
  const [activeTab, setActiveTab] = useState<TabId>('standings')

  if (!data) return <NotFound />

  const counts: Partial<Record<TabId, number>> = {
    standings: data.entrants.length,
    bracket:   data.sets.length,
  }

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: '100vh', fontFamily: T.fBody, fontSize: 15, lineHeight: 1.5 }}>
      <style>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: var(--sf6-bg); }
        ::-webkit-scrollbar-thumb { background: var(--sf6-surface3); border-radius: 3px; }
        input::placeholder { color: var(--sf6-text-dim); }
        * { box-sizing: border-box; }
        .match-history-row td { transition: padding 0.15s; }
        .match-card { transition: background 0.1s; }
        .match-card:hover { background: rgba(255,255,255,0.07) !important; }
        .podium-name-link:hover { text-decoration: underline; opacity: 0.9; }

        /* ── モバイルレスポンシブ (768px以下) ── */
        @media (max-width: 768px) {
          .hero-content {
            max-width: 100% !important;
            padding: 0 16px !important;
          }
          .hero-logo {
            display: none !important;
          }
          .hero-title {
            font-size: clamp(28px, 9vw, 42px) !important;
            line-height: 1.05 !important;
          }
          .stats-row {
            gap: 8px !important;
          }
          .tab-bar {
            padding: 0 12px !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            scrollbar-width: none !important;
          }
          .tab-bar::-webkit-scrollbar { display: none; }
          .main-content {
            padding: 20px 16px 80px !important;
          }
          /* ポディアム */
          .podium-champion {
            padding: 16px 18px !important;
            gap: 16px !important;
          }
          .podium-runners {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .podium-runners > * {
            flex: 1 1 auto !important;
            min-width: 0 !important;
          }
          /* 順位表: 768px → 順位(1)+選手(2)+国旗(3)+賞金(5)+CPT(7) の5列 */
          /* キャラクター列(4)を非表示 */
          .standings-table th:nth-child(4),
          .standings-table td:nth-child(4) { display: none !important; }
          /* EWC列(6)を非表示 — CPT列(7)は表示する */
          .standings-table th:nth-child(6),
          .standings-table td:nth-child(6) { display: none !important; }
          /* CPTポイント列(7)は小さめで表示 */
          .standings-table th:nth-child(7),
          .standings-table td:nth-child(7) {
            font-size: 12px !important;
            padding: 4px 6px !important;
          }
          .standings-table td,
          .standings-table th {
            padding: 8px 8px !important;
            font-size: 13px !important;
          }
          /* キャラ統計: 数値が重ならないよう調整 */
          .char-stat-row { padding: 10px 14px !important; }
          /* アコーディオン対戦履歴 */
          .match-history-row td { padding: 8px 10px !important; }
          .match-card {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 4px !important;
          }
          /* ポディウムカードのアコーディオンパネル */
          .match-history-panel {
            padding: 8px 10px !important;
            font-size: 12px !important;
          }
          .match-history-panel .match-card {
            font-size: 12px !important;
          }

          /* ── ポディアムカード ── */
          /* チャンピオンカード: 縦方向に再整理 */
          .podium-champion {
            flex-wrap: wrap !important;
            gap: 12px !important;
          }
          /* Prize + badges ブロック: 横幅いっぱいに伸ばして左揃えに */
          .podium-champion > div:last-child {
            flex: 1 1 100% !important;
            text-align: left !important;
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
            flex-wrap: wrap !important;
          }
          /* 選手名 */
          .podium-player-name {
            font-size: 28px !important;
          }
          /* 賞金額: 目立たせる・バッジより先に表示 */
          .podium-prize {
            font-size: 22px !important;
            font-weight: 700 !important;
            letter-spacing: 0.5px;
            margin-top: 4px;
            margin-bottom: 2px;
            display: block;
            order: 2;
            color: #4ade80 !important;
          }
          /* チャンピオンカードの賞金はさらに大きく */
          .podium-champion .podium-prize {
            font-size: 26px !important;
            margin-top: 8px;
            margin-bottom: 4px;
          }
          /* ランナーカードの賞金 */
          .podium-runners .podium-prize {
            font-size: 18px !important;
            font-weight: 700 !important;
            color: #4ade80 !important;
            margin-top: 4px;
          }
          /* バッジコンテナ: 賞金の後に表示 */
          .podium-badges {
            gap: 6px !important;
            margin-top: 4px !important;
            order: 3;
          }
          /* バッジ内の span（CcQualifiedBadge, EwcBadge） */
          .podium-badges > span {
            font-size: 10px !important;
            padding: 2px 6px !important;
          }
        }

        /* ── 小型スマホ (480px以下) ── */
        @media (max-width: 480px) {
          .hero-title {
            font-size: clamp(22px, 8vw, 32px) !important;
          }
          .stats-row > div {
            flex: 1 1 calc(50% - 4px) !important;
          }
          .standings-table td,
          .standings-table th {
            padding: 6px 6px !important;
            font-size: 12px !important;
          }
          /* 480px → 順位(1)+選手(2)+賞金(5)+CPT(7) の4列 */
          /* 国旗(3)も非表示 */
          .standings-table th:nth-child(3),
          .standings-table td:nth-child(3) { display: none !important; }
          /* キャラ(4)とEWC(6)は768pxルールから引き継ぎ非表示 */
          /* CPT(7)は表示維持 — フォントさらに小さく */
          .standings-table th:nth-child(7),
          .standings-table td:nth-child(7) {
            font-size: 11px !important;
            padding: 4px 4px !important;
          }
          .podium-champion {
            padding: 14px 14px !important;
            gap: 10px !important;
          }
          .podium-player-name { font-size: 22px !important; }
          .podium-prize       { font-size: 20px !important; font-weight: 700 !important; }
          .podium-champion .podium-prize { font-size: 22px !important; }
          .char-stat-row { padding: 8px 10px !important; }
        }
      `}</style>

      <SiteNavbar activePage="tournaments" breadcrumb={[{ label: '大会', href: '/tournaments' }, { label: data.tournament.name }]} />
      <HeroSection data={data} />
      <TabBar active={activeTab} setActive={setActiveTab} counts={counts} />

      <div className="main-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 32px 100px' }}>
        {activeTab === 'standings' && (
          <>
            <SectionHead title={UI_TEXT.sectionStandings} sub={`${data.entrants.length} ENTRANTS`} />
            <StandingsTable
              entrants={data.entrants}
              tournamentId={data.tournament.id}
              isCptPremier={data.tournament.cptEventType === 'premier'}
              ewcQualifyingSpots={data.tournament.ewcQualifyingSpots ?? null}
              sets={data.sets}
            />
          </>
        )}
        {activeTab === 'bracket' && (
          <>
            <SectionHead title={UI_TEXT.sectionBracket} sub={UI_TEXT.sectionBracketSub} />
            <BracketView sets={data.sets} />
          </>
        )}
        {activeTab === 'chars' && (
          <>
            <SectionHead title={UI_TEXT.sectionCharStats} sub={UI_TEXT.sectionCharSub} />
            <CharStats
              sets={data.sets}
              entrants={data.entrants}
              tournament={data.tournament}
            />
          </>
        )}
      </div>
    </div>
  )
}
