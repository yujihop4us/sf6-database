'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLocale } from '@/lib/locale-context'
import SiteNavbar from '@/components/SiteNavbar'
import type { TournamentData, EntrantRow, SetRow } from './types'
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

// ─── Shared UI atoms ──────────────────────────────────────────────

function CharPill({ name }: { name: string | null }) {
  const color = charColor(name)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: `${color}18`, border: `1px solid ${color}40`,
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
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 10, padding: '20px 24px',
      flex: '1 1 130px', minWidth: 130,
      transition: 'border-color 0.2s',
    }}
    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,212,170,0.25)')}
    onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
    >
      <div style={{
        fontFamily: T.fDisplay, fontSize: 40, fontWeight: 900,
        lineHeight: 1, color: T.accent, letterSpacing: '-0.02em', marginBottom: 6,
      }}>
        {isNum ? displayed.toLocaleString() : value}
      </div>
      <div style={{
        fontFamily: T.fDisplay, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted,
      }}>
        {label}
      </div>
    </div>
  )
}


// ─── Hero ─────────────────────────────────────────────────────────

function HeroSection({ data }: { data: TournamentData }) {
  const { tournament, entrants, totalMatches } = data
  const countries = new Set(entrants.map(e => e.player?.countryCode).filter(Boolean))
  // 実際の参加者数・試合数（start.gg 正式値があればそちらを優先）
  const displayEntrants = tournament.numEntrantsOverride ?? entrants.length
  const displayMatches  = tournament.totalSetsOverride  ?? totalMatches

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: `linear-gradient(150deg, #0f3040 0%, ${T.hero} 40%, ${T.bg} 80%)`,
      padding: '56px 32px 52px',
      borderBottom: `1px solid ${T.border}`,
    }}>
      {/* Scanline texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
      }} />
      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: -80, right: 60, width: 360, height: 360,
        background: 'radial-gradient(circle, rgba(0,212,170,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
        {/* Status badge */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(0,0,0,0.5)', border: `1px solid ${T.border2}`,
            borderRadius: 20, padding: '4px 14px',
            fontFamily: T.fDisplay, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: T.accent,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: T.red,
              display: 'inline-block', animation: 'sf6-pulse-dot 1.5s ease-in-out infinite',
            }} />
            CONCLUDED
          </span>
          {tournament.location && (
            <span style={{ fontFamily: T.fDisplay, fontSize: 12, color: T.muted, letterSpacing: '0.05em' }}>
              {tournament.location}
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap', marginBottom: 8 }}>
          <h1 style={{
            fontFamily: T.fDisplay, fontWeight: 900, fontSize: 'clamp(52px, 8vw, 80px)',
            lineHeight: 1, letterSpacing: '-0.03em', color: T.text, margin: 0,
          }}>
            {tournament.name}
          </h1>
          <span style={{
            fontFamily: T.fDisplay, fontWeight: 600, fontSize: 22,
            color: T.accent, letterSpacing: '0.04em',
          }}>
            Street Fighter 6
          </span>
        </div>

        {/* Date */}
        {(tournament.startDate || tournament.endDate) && (
          <p style={{
            fontFamily: T.fDisplay, fontSize: 15, fontWeight: 500,
            color: T.muted, letterSpacing: '0.04em', marginBottom: 40,
          }}>
            {fmtDate(tournament.startDate)}
            {tournament.endDate && tournament.endDate !== tournament.startDate && ` – ${fmtDate(tournament.endDate)}`}
          </p>
        )}

        {/* Stat boxes */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatCard value={displayEntrants} label="参加者数" />
          <StatCard value={displayMatches}  label="総試合数" />
          <StatCard value={countries.size}                   label="出場国数" />
          <StatCard value={fmtPrize(tournament.prizeUsd)}    label="総賞金額" />
        </div>
      </div>
    </div>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────

type TabId = 'standings' | 'bracket' | 'chars'
const TABS: { id: TabId; label: string }[] = [
  { id: 'standings', label: '順位表' },
  { id: 'bracket',   label: 'ブラケット' },
  { id: 'chars',     label: 'キャラ統計' },
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
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', display: 'flex' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActive(tab.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '16px 22px',
            fontFamily: T.fDisplay, fontSize: 15, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: active === tab.id ? T.accent : T.muted,
            borderBottom: `2px solid ${active === tab.id ? T.accent : 'transparent'}`,
            transition: 'color 0.15s, border-color 0.15s',
            marginBottom: -1,
          }}>
            {tab.label}
            {(counts[tab.id] ?? 0) > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 11, color: active === tab.id ? T.accent : T.dim,
                fontWeight: 600,
              }}>
                ({counts[tab.id]})
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Standings ────────────────────────────────────────────────────

type SortKey = 'placement' | 'handle' | 'wins' | 'losses'

function StandingsTable({ entrants }: { entrants: EntrantRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('placement')
  const [asc, setAsc] = useState(true)
  const [search, setSearch] = useState('')
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setAsc(a => !a)
    else { setSortKey(key); setAsc(key === 'placement') }
  }

  const hasAnyPlacement = entrants.some(e => e.placement !== null || e.inferredPlacement !== null)

  const sorted = [...entrants]
    .filter(e => e.player && e.player.handle.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const p = a.player!, q = b.player!
      let diff = 0
      if (sortKey === 'placement') {
        diff = (effectivePlacement(a) ?? 9999) - (effectivePlacement(b) ?? 9999)
      } else if (sortKey === 'handle') diff = p.handle.localeCompare(q.handle)
      else if (sortKey === 'wins')   diff = p.wins - q.wins
      else if (sortKey === 'losses') diff = p.losses - q.losses
      return asc ? diff : -diff
    })

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
      <div style={{ marginBottom: 16 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="選手名で検索..."
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

      <div style={{ borderRadius: 10, border: `1px solid ${T.border}`, overflow: 'hidden', background: T.card }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <SortTh id="placement" label="順位"   align="center" />
                <SortTh id="handle"    label="選手名" />
                <StaticTh label="国籍" />
                <StaticTh label="使用キャラ" />
                <SortTh id="wins"   label="W" align="center" />
                <SortTh id="losses" label="L" align="center" />
                <StaticTh label="入賞"    align="center" />
                <StaticTh label="賞金"    align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => {
                const p = e.player!
                const isHovered = hoveredRow === i
                const rowBg = isHovered ? T.rowHover : i % 2 === 0 ? 'transparent' : T.rowEven
                const eff = effectivePlacement(e)
                const isInferred = e.placement === null && e.inferredPlacement !== null
                const medal = eff === 1 ? '🥇' : eff === 2 ? '🥈' : eff === 3 ? '🥉' : null

                return (
                  <tr
                    key={e.entrantId}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      background: rowBg,
                      borderBottom: `1px solid ${T.border}`,
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
                          <Link href={`/player/${p.id}`} style={{ textDecoration: 'none' }}>
                            <div style={{
                              fontFamily: T.fDisplay, fontSize: 17, fontWeight: 700,
                              color: eff === 1 ? T.accent : T.text, letterSpacing: '0.01em',
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
                    {/* Country */}
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
                    {/* W */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ fontFamily: T.fDisplay, fontSize: 17, fontWeight: 700, color: T.green }}>
                        {p.wins}
                      </span>
                    </td>
                    {/* L */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ fontFamily: T.fDisplay, fontSize: 17, fontWeight: 700, color: T.red }}>
                        {p.losses}
                      </span>
                    </td>
                    {/* Placement label */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        title={isInferred ? 'セットデータから推定 (*)' : undefined}
                        style={{
                          fontFamily: T.fDisplay, fontSize: 12, fontWeight: 700,
                          letterSpacing: '0.06em', textTransform: 'uppercase',
                          color: placementColor(eff),
                          padding: '2px 8px', borderRadius: 4,
                          background: `${placementColor(eff)}18`,
                          border: `1px solid ${placementColor(eff)}40`,
                          opacity: isInferred ? 0.8 : 1,
                          cursor: isInferred ? 'help' : 'default',
                        }}>
                        {placementLabel(eff, isInferred)}
                      </span>
                    </td>
                    {/* Prize */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{ fontFamily: T.fDisplay, fontSize: 14, fontWeight: 600, color: T.muted }}>
                        {fmtPrize(e.prizeAmount)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: T.fDisplay, fontSize: 12, color: T.dim, letterSpacing: '0.06em' }}>
          {sorted.length} / {entrants.length} 選手
        </span>
        {!hasAnyPlacement && entrants.length > 0 && (
          <span style={{ fontFamily: T.fBody, fontSize: 11, color: T.dim }}>
            * 順位はセットデータから推定（DBに正式な順位データなし）
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Bracket view ────────────────────────────────────────────────

// ラウンドの表示順定義（ブラケット進行順）
// getBracketSortOrder は src/lib/bracketOrder.ts に移管済み

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

function BracketView({ sets }: { sets: SetRow[] }) {
  // 全フェーズ（Pools → Top 32 → Top 8 の順）
  const allPhases = Array.from(new Set(sets.map(s => s.phase).filter(Boolean)))
  // フェーズをブラケット進行順にソート（Top 8 が最後）
  const phaseOrder = ['Pools', 'Pool', 'Group', 'Top 64', 'Top 32', 'Top 16', 'Top 8', 'Top 4']
  const sortedPhases = [...allPhases].sort((a, b) => {
    const ai = phaseOrder.findIndex(p => a.toLowerCase().includes(p.toLowerCase()))
    const bi = phaseOrder.findIndex(p => b.toLowerCase().includes(p.toLowerCase()))
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
  })

  const [activePhase, setActivePhase] = useState(
    sortedPhases.find(p => p.toLowerCase().includes('top 8') || p.toLowerCase().includes('top 4')) ?? sortedPhases[sortedPhases.length - 1] ?? ''
  )

  // 選択フェーズのセットをラウンド順に整理
  // 両プレイヤー未確定のプレースホルダーセットを除外（page.tsx でも除外済みだが防御的に）
  const phaseSets = sets.filter(s =>
    s.phase === activePhase &&
    (s.winnerId !== null || s.loserId !== null)
  )
  const roundGroups = new Map<string, SetRow[]>()
  for (const s of phaseSets) {
    const r = s.roundText || '—'
    if (!roundGroups.has(r)) roundGroups.set(r, [])
    roundGroups.get(r)!.push(s)
  }
  // 同ラウンド内は ID 降順（最新のセット＝より深いブラケット位置が上）
  for (const matches of roundGroups.values()) {
    matches.sort((a, b) => b.id - a.id)
  }
  // ラウンドを getBracketSortOrder で昇順ソート（値が小さい＝重要なラウンドが上）
  // グループ内が 0 件のラウンドは自動的に含まれないため別途除外不要
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

  if (sets.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: T.dim, fontFamily: T.fDisplay }}>
        ブラケットデータなし
      </div>
    )
  }

  return (
    <div>
      {/* フェーズ選択 */}
      {sortedPhases.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {sortedPhases.map(ph => (
            <button key={ph} onClick={() => setActivePhase(ph)} style={btnStyle(activePhase === ph)}>
              {ph}
            </button>
          ))}
        </div>
      )}

      {/* ラウンドごとのマッチ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {sortedRounds.map(([round, matches]) => {
          const isGrandFinal = round === 'Grand Final' || round === 'Grand Final Reset'
          return (
            <div key={round}>
              {/* ラウンドヘッダー */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
              }}>
                {isGrandFinal && <span style={{ fontSize: 18 }}>🏆</span>}
                <div style={{
                  fontFamily: T.fDisplay, fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.16em', textTransform: 'uppercase',
                  color: isGrandFinal ? T.accent : T.dim,
                }}>{round}</div>
                <div style={{
                  flex: 1, height: 1,
                  background: isGrandFinal ? `${T.accent}30` : T.border,
                }} />
                <div style={{
                  fontFamily: T.fDisplay, fontSize: 10, color: T.dim,
                }}>{matches.length}試合</div>
              </div>

              {/* マッチカード群 */}
              <div style={{ display: 'grid', gap: 6, gridTemplateColumns: matches.length > 2 ? '1fr 1fr' : '1fr' }}>
                {matches.map(s => (
                  <BracketMatchRow key={s.id} s={s} isGF={isGrandFinal} />
                ))}
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

// ─── Character stats ──────────────────────────────────────────────

function CharStats({ sets }: { sets: SetRow[] }) {
  // Compute character usage and win rates from real set data
  const charMap: Record<string, { uses: number; wins: number }> = {}

  for (const s of sets) {
    if (s.winnerCharacter) {
      if (!charMap[s.winnerCharacter]) charMap[s.winnerCharacter] = { uses: 0, wins: 0 }
      charMap[s.winnerCharacter].uses++
      charMap[s.winnerCharacter].wins++
    }
    if (s.loserCharacter) {
      if (!charMap[s.loserCharacter]) charMap[s.loserCharacter] = { uses: 0, wins: 0 }
      charMap[s.loserCharacter].uses++
    }
  }

  const stats = Object.entries(charMap)
    .map(([char, { uses, wins }]) => ({
      char, uses, winrate: uses > 0 ? Math.round((wins / uses) * 1000) / 10 : 0,
    }))
    .filter(c => c.uses >= 3)
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 16)

  const maxUses = Math.max(...stats.map(c => c.uses), 1)

  if (stats.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: T.dim, fontFamily: T.fDisplay }}>
        キャラデータなし（tournament_sets に main_character データが必要です）
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {stats.map((c, i) => {
        const color = charColor(c.char)
        return (
          <div key={c.char} style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 10, padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
              <span style={{
                fontFamily: T.fDisplay, fontSize: 14, fontWeight: 700, color: T.dim,
                minWidth: 24, textAlign: 'center',
              }}>{i + 1}</span>
              <CharPill name={c.char} />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 28 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: T.fDisplay, fontSize: 26, fontWeight: 800, color: T.text, lineHeight: 1 }}>
                    {c.uses.toLocaleString()}
                  </div>
                  <div style={{ fontFamily: T.fDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase' }}>
                    使用数
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontFamily: T.fDisplay, fontSize: 26, fontWeight: 800, lineHeight: 1,
                    color: c.winrate >= 52 ? T.green : c.winrate >= 50 ? T.text : T.muted,
                  }}>
                    {c.winrate}%
                  </div>
                  <div style={{ fontFamily: T.fDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase' }}>
                    勝率
                  </div>
                </div>
              </div>
            </div>
            <div style={{ height: 4, background: T.surface3, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${(c.uses / maxUses) * 100}%`,
                background: `linear-gradient(90deg, ${color}bb, ${color})`,
                transition: 'width 0.8s ease',
              }} />
            </div>
          </div>
        )
      })}
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
      `}</style>

      <SiteNavbar activePage="tournaments" breadcrumb={[{ label: '大会', href: '/tournaments' }, { label: data.tournament.name }]} />
      <HeroSection data={data} />
      <TabBar active={activeTab} setActive={setActiveTab} counts={counts} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 32px 100px' }}>
        {activeTab === 'standings' && <StandingsTable entrants={data.entrants} />}
        {activeTab === 'bracket'   && <BracketView sets={data.sets} />}
        {activeTab === 'chars'     && <CharStats sets={data.sets} />}
      </div>
    </div>
  )
}
