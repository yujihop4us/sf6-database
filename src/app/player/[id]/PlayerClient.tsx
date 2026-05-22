'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import SiteNavbar from '@/components/SiteNavbar'
import { useLocale } from '@/lib/locale-context'
import type { PlayerPageData, TournamentResult, H2HEntry, CharUsage, Achievement } from './page'

// ── Design tokens ─────────────────────────────────────────────────
const D = {
  bg:       '#080c10',
  surface:  '#0e1419',
  surface2: '#131c24',
  surface3: '#1a2530',
  border:   'rgba(255,255,255,0.07)',
  border2:  'rgba(0,212,170,0.25)',
  accent:   '#00d4aa',
  accentDim:'rgba(0,212,170,0.1)',
  text:     '#edf2f7',
  muted:    '#8ba3b4',
  dim:      '#4a6070',
  gold:     '#f5c842',
  silver:   '#a8bcc8',
  bronze:   '#cd8c52',
  red:      '#ff4d6a',
  fDisplay: 'var(--font-barlow-condensed, "Barlow Condensed", sans-serif)',
  fBody:    'var(--font-barlow, "Barlow", sans-serif)',
}

const CHAR_COLORS: Record<string, string> = {
  "Akuma":"#8b2fc9","Cammy":"#2e9e5b","Chun-Li":"#3d7ef5",
  "Dee Jay":"#f5a623","Dhalsim":"#e85c2a","Ed":"#5c9ef5",
  "E.Honda":"#e84848","Guile":"#4a90d9","JP":"#9b4dca",
  "Juri":"#d43f8c","Ken":"#d45f00","Kimberly":"#ff6b35",
  "Lily":"#7ec850","Luke":"#c8a820","M.Bison":"#9b1a1a",
  "Manon":"#c86490","Marisa":"#8b6914","Rashid":"#50c8c8",
  "Ryu":"#e04040","Terry":"#c83232","Zangief":"#d43c3c",
  "A.K.I":"#7bc87b","Mai":"#e85c7a","Blanka":"#3da840",
}

const FLAG: Record<string, string> = {
  JP:'🇯🇵', US:'🇺🇸', KR:'🇰🇷', CN:'🇨🇳', TW:'🇹🇼', HK:'🇭🇰',
  FR:'🇫🇷', GB:'🇬🇧', DE:'🇩🇪', BR:'🇧🇷', CL:'🇨🇱', AR:'🇦🇷',
  AU:'🇦🇺', CA:'🇨🇦', NO:'🇳🇴', DO:'🇩🇴', AE:'🇦🇪', SA:'🇸🇦',
  NL:'🇳🇱', IT:'🇮🇹', ES:'🇪🇸', PK:'🇵🇰', PH:'🇵🇭', SG:'🇸🇬',
  MX:'🇲🇽', RU:'🇷🇺', SE:'🇸🇪', BE:'🇧🇪', CH:'🇨🇭', AT:'🇦🇹',
}
const flag = (code: string | null) => code ? (FLAG[code.toUpperCase()] ?? '🏳️') : '🏳️'
const charColor = (name: string | null) => name ? (CHAR_COLORS[name] ?? '#556') : '#556'

// ── Helpers ───────────────────────────────────────────────────────

function fmtPrize(usd: number | null): string {
  if (!usd || usd <= 0) return '—'
  return '$' + usd.toLocaleString()
}

function fmtDate(d: string | null, lang: string): string {
  if (!d) return ''
  const date = new Date(d)
  if (lang === 'ja') {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

function placementColor(p: number | null): string {
  if (!p) return D.dim
  if (p === 1) return D.gold
  if (p === 2) return D.silver
  if (p === 3) return D.bronze
  return D.muted
}

function fmtPlacement(p: number | null, lang: string): string {
  if (!p) return '—'
  if (lang === 'ja') {
    if (p === 1) return '優勝'
    if (p === 2) return '準優勝'
    if (p === 3) return '3位'
    const tiers = [4,5,7,9,13,17,25,33]
    for (let i = 0; i < tiers.length - 1; i++) {
      if (p >= tiers[i] && p < tiers[i+1]) return `Top ${tiers[i+1]}`
    }
    return `${p}位`
  } else {
    if (p === 1) return '1st'
    if (p === 2) return '2nd'
    if (p === 3) return '3rd'
    const tiers = [4,5,7,9,13,17,25,33]
    for (let i = 0; i < tiers.length - 1; i++) {
      if (p >= tiers[i] && p < tiers[i+1]) return `Top ${tiers[i+1]}`
    }
    return `${p}th`
  }
}

// ── UI atoms ──────────────────────────────────────────────────────

function CharPill({ name, size = 12 }: { name: string | null; size?: number }) {
  const display = name ?? '不明'
  const color = charColor(name) // null → '#556'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: `${color}18`, border: `1px solid ${color}40`,
      borderRadius: 4, padding: '2px 9px',
      fontFamily: D.fDisplay, fontSize: size, fontWeight: 600,
      letterSpacing: '0.05em', color,
      whiteSpace: 'nowrap',
    }}>{display}</span>
  )
}

function SectionHeading({ id, label }: { id: string; label: string }) {
  return (
    <div id={id} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: D.fDisplay, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.18em', textTransform: 'uppercase',
      color: D.accent, marginBottom: 18, paddingTop: 4,
    }}>
      <span style={{ width: 22, height: 2, background: D.accent, display: 'inline-block', borderRadius: 2, flexShrink: 0 }} />
      {label}
    </div>
  )
}

// ── Active section tracker ────────────────────────────────────────

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const handle = () => {
      let found = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top < 130) found = id
      }
      setActive(found)
    }
    window.addEventListener('scroll', handle, { passive: true })
    return () => window.removeEventListener('scroll', handle)
  }, [ids])
  return active
}

// ── Hero ──────────────────────────────────────────────────────────

function HeroSection({ data }: { data: PlayerPageData }) {
  const { lang, t } = useLocale()
  const { player, achievements } = data
  const charCol = charColor(player.mainCharacter)
  const heroBlue = '#068fc1'

  const totalPrize = player.totalEarnings

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: `linear-gradient(155deg, ${heroBlue}cc 0%, ${charCol}44 35%, ${heroBlue}18 60%, ${D.bg} 100%)`,
      borderBottom: `1px solid ${D.border}`,
      padding: '52px 32px 48px',
    }}>
      {/* Scanline */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)',
      }} />
      {/* Glow */}
      <div style={{
        position: 'absolute', top: -100, right: 40, width: 480, height: 480,
        background: `radial-gradient(circle, ${heroBlue}22 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      {/* Watermark */}
      <div style={{
        position: 'absolute', bottom: -16, right: -4,
        fontFamily: D.fDisplay, fontWeight: 900, fontSize: 180, lineHeight: 1,
        color: `${charCol}0c`, userSelect: 'none', pointerEvents: 'none',
        letterSpacing: '-0.04em', whiteSpace: 'nowrap',
      }}>{player.handle.toUpperCase()}</div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 36 }}>
          {/* Avatar */}
          <div style={{
            width: 112, height: 112, borderRadius: '50%', flexShrink: 0,
            border: `2px solid ${heroBlue}50`, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: player.imageUrl ? 'transparent' : `${heroBlue}22`,
          }}>
            {player.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.imageUrl} alt={player.handle}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{
                fontFamily: D.fDisplay, fontSize: 48, fontWeight: 900,
                color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1,
              }}>
                {player.handle[0].toUpperCase()}
              </span>
            )}
          </div>

          {/* Identity */}
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            {/* Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22 }}>{flag(player.countryCode)}</span>
              <span style={{
                fontFamily: D.fDisplay, fontSize: 13, fontWeight: 600,
                letterSpacing: '0.08em', color: D.muted,
              }}>{player.countryCode ?? ''}</span>
              {player.team && (
                <>
                  <span style={{ color: D.dim }}>·</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: `${charCol}18`, border: `1px solid ${charCol}40`,
                    borderRadius: 20, padding: '3px 13px',
                    fontFamily: D.fDisplay, fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase', color: charCol,
                  }}>{player.team}</span>
                </>
              )}
            </div>
            {/* Name */}
            <h1 style={{
              fontFamily: D.fDisplay, fontWeight: 900, fontSize: 84,
              lineHeight: 0.9, letterSpacing: '-0.03em', color: '#ffffff',
              marginBottom: 12, textShadow: `0 2px 40px ${heroBlue}55`,
            }}>{player.handle}</h1>
            {player.name && (
              <div style={{
                fontFamily: D.fDisplay, fontSize: 17, fontWeight: 500,
                color: D.muted, letterSpacing: '0.03em', marginBottom: 20,
              }}>{player.name}</div>
            )}
            <CharPill name={player.mainCharacter} size={14} />
          </div>

          {/* Prize stat — always shown; "—" when no data */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              background: 'rgba(0,0,0,0.38)', border: `1px solid ${heroBlue}30`,
              borderRadius: 10, padding: '22px 32px', textAlign: 'center',
            }}>
              <div style={{
                fontFamily: D.fDisplay, fontWeight: 900,
                fontSize: 44, lineHeight: 1, letterSpacing: '-0.02em',
                color: totalPrize ? D.gold : D.dim, marginBottom: 6,
              }}>
                {totalPrize ? `$${totalPrize.toLocaleString()}` : '—'}
              </div>
              <div style={{
                fontFamily: D.fDisplay, fontSize: 12, fontWeight: 600,
                letterSpacing: '0.12em', textTransform: 'uppercase', color: D.muted,
              }}>{t.stat_prize}</div>
            </div>
          </div>
        </div>

        {/* Achievements strip */}
        {achievements.length > 0 && (
          <div>
            <div style={{
              fontFamily: D.fDisplay, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)', marginBottom: 12,
            }}>{t.achievement_label}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {achievements.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(0,0,0,0.40)', border: `1px solid ${D.border}`,
                  borderRadius: 8, padding: '10px 16px',
                }}>
                  <div style={{
                    width: 3, borderRadius: 2, alignSelf: 'stretch', flexShrink: 0,
                    background: a.champion ? D.gold : 'rgba(255,255,255,0.2)',
                  }} />
                  <div>
                    <div style={{
                      fontFamily: D.fDisplay, fontSize: 15, fontWeight: 800,
                      color: a.champion ? D.gold : D.text, letterSpacing: '0.01em', lineHeight: 1.1,
                    }}>{lang === 'ja' ? a.resultJa : a.resultEn}</div>
                    <div style={{
                      fontFamily: D.fDisplay, fontSize: 11, fontWeight: 600,
                      color: D.muted, letterSpacing: '0.04em', marginTop: 2,
                    }}>{a.year} {a.event}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Jump nav ──────────────────────────────────────────────────────

type SectionId = 'sec-bio' | 'sec-results' | 'sec-h2h' | 'sec-chars'

function JumpNav({ hasBio, activeSection }: { hasBio: boolean; activeSection: string }) {
  const { t } = useLocale()

  const sections: { id: SectionId; label: string }[] = [
    ...(hasBio ? [{ id: 'sec-bio' as const, label: t.sec_bio }] : []),
    { id: 'sec-results', label: t.sec_results },
    { id: 'sec-h2h', label: t.sec_h2h },
    { id: 'sec-chars', label: t.sec_chars },
  ]

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 110
    window.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <div style={{
      position: 'sticky', top: 52, zIndex: 40,
      background: 'rgba(14,20,25,0.97)', backdropFilter: 'blur(10px)',
      borderBottom: `1px solid ${D.border}`,
      padding: '0 32px', display: 'flex', gap: 0, overflowX: 'auto',
    }}>
      {sections.map(s => (
        <button key={s.id}
          onClick={() => scrollTo(s.id)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: D.fDisplay, fontSize: 14, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            padding: '14px 20px',
            borderBottom: `2px solid ${activeSection === s.id ? D.accent : 'transparent'}`,
            color: activeSection === s.id ? D.accent : D.muted,
            whiteSpace: 'nowrap',
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >{s.label}</button>
      ))}
    </div>
  )
}

// ── Bio ───────────────────────────────────────────────────────────

function BioSection({ player }: { player: PlayerPageData['player'] }) {
  const { lang, t } = useLocale()
  const text = lang === 'ja' ? (player.bioJa ?? player.bioEn) : (player.bioEn ?? player.bioJa)
  if (!text) return null
  return (
    <section>
      <SectionHeading id="sec-bio" label={t.sec_bio} />
      <div style={{
        background: D.surface, border: `1px solid ${D.border}`,
        borderRadius: 10, padding: '28px 32px',
      }}>
        {text.split('\n\n').map((para, i, arr) => (
          <p key={i} style={{
            fontFamily: D.fBody, fontSize: 15, lineHeight: 1.8,
            color: D.muted, marginBottom: i < arr.length - 1 ? 16 : 0,
          }}>{para}</p>
        ))}
      </div>
    </section>
  )
}

// ── Tournament results ────────────────────────────────────────────

function ResultsSection({ results }: { results: TournamentResult[] }) {
  const { lang, t } = useLocale()

  return (
    <section>
      <SectionHeading id="sec-results" label={t.sec_results} />
      <div style={{ border: `1px solid ${D.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 540 }}>
            <thead>
              <tr style={{ background: D.surface2 }}>
                {[t.col_tournament, t.col_date, t.col_placement, t.col_prize, t.col_char].map(h => (
                  <th key={h} style={{
                    padding: '11px 16px', textAlign: 'left',
                    fontFamily: D.fDisplay, fontSize: 12, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: D.muted, borderBottom: `1px solid ${D.border}`, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && (
                <tr>
                  <td colSpan={5} style={{
                    padding: '40px 16px', textAlign: 'center',
                    fontFamily: D.fDisplay, fontSize: 14, fontWeight: 600,
                    letterSpacing: '0.1em', color: D.dim,
                  }}>データなし</td>
                </tr>
              )}
              {results.map((row, i) => {
                const pc = placementColor(row.placement)
                return (
                  <tr key={`${row.tournamentId}-${i}`} style={{
                    background: i % 2 === 0 ? D.surface : 'rgba(13,19,24,0.7)',
                    borderBottom: `1px solid ${D.border}`,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = D.surface3)}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? D.surface : 'rgba(13,19,24,0.7)')}
                  >
                    <td style={{ padding: '13px 16px' }}>
                      <Link href={`/tournament/${row.tournamentId}`} style={{ textDecoration: 'none' }}>
                        <span style={{
                          fontFamily: D.fDisplay, fontSize: 16, fontWeight: 700,
                          color: D.text, letterSpacing: '0.01em',
                        }}>{row.tournamentName}</span>
                      </Link>
                    </td>
                    <td style={{
                      padding: '13px 16px', fontFamily: D.fDisplay,
                      fontSize: 13, color: D.muted, whiteSpace: 'nowrap',
                    }}>
                      {fmtDate(row.startDate, lang)}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {row.placement != null && row.placement <= 3 && (
                          <span style={{ fontSize: 15 }}>
                            {row.placement === 1 ? '🥇' : row.placement === 2 ? '🥈' : '🥉'}
                          </span>
                        )}
                        <span style={{
                          fontFamily: D.fDisplay, fontSize: 16, fontWeight: 800,
                          color: pc, letterSpacing: '0.01em',
                        }}>{fmtPlacement(row.placement, lang)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        fontFamily: D.fDisplay, fontSize: 16, fontWeight: 700,
                        color: (row.prizeAmount ?? 0) >= 10000 ? D.gold : D.muted,
                      }}>{fmtPrize(row.prizeAmount)}</span>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <CharPill name={row.character} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// ── H2H ──────────────────────────────────────────────────────────

function H2HSection({ player, h2h }: { player: PlayerPageData['player']; h2h: H2HEntry[] }) {
  const { t } = useLocale()
  const mainColor = charColor(player.mainCharacter)

  if (h2h.length === 0) {
    return (
      <section>
        <SectionHeading id="sec-h2h" label={t.h2h_subtitle} />
        <div style={{
          background: D.surface, border: `1px solid ${D.border}`,
          borderRadius: 10, padding: '40px 24px', textAlign: 'center',
          fontFamily: D.fDisplay, fontSize: 14, fontWeight: 600,
          letterSpacing: '0.1em', color: D.dim,
        }}>データなし</div>
      </section>
    )
  }

  return (
    <section>
      <SectionHeading id="sec-h2h" label={t.h2h_subtitle} />
      <div style={{ display: 'grid', gap: 10 }}>
        {h2h.map(opp => {
          const total = opp.wins + opp.losses
          const winPct = total > 0 ? Math.round((opp.wins / total) * 100) : 0
          const ahead = opp.wins > opp.losses
          const even = opp.wins === opp.losses
          return (
            <div key={opp.opponentId} style={{
              background: D.surface, border: `1px solid ${D.border}`,
              borderRadius: 10, padding: '18px 24px',
              display: 'grid', gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center', gap: 20,
            }}>
              {/* Player (left) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{flag(player.countryCode)}</span>
                  <span style={{
                    fontFamily: D.fDisplay, fontSize: 18, fontWeight: 800,
                    color: D.text, letterSpacing: '0.01em',
                  }}>{player.handle}</span>
                </div>
                <div style={{
                  fontFamily: D.fDisplay, fontWeight: 900,
                  fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em',
                  color: ahead ? mainColor : even ? D.muted : D.dim,
                }}>
                  {opp.wins}
                  <span style={{ fontSize: 13, fontWeight: 600, color: D.dim, marginLeft: 5 }}>{t.wins_label}</span>
                </div>
              </div>

              {/* Center bar */}
              <div style={{ minWidth: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  fontSize: 11, fontFamily: D.fDisplay, fontWeight: 600,
                  letterSpacing: '0.1em', color: D.dim, textTransform: 'uppercase',
                }}>
                  {winPct}% — {total}{t.wins_label}
                </div>
                <div style={{ display: 'flex', width: '100%', gap: 3, alignItems: 'center', height: 7 }}>
                  {opp.wins > 0 && (
                    <div style={{
                      flex: opp.wins, height: '100%', borderRadius: '3px 0 0 3px',
                      background: `linear-gradient(90deg, ${mainColor}77, ${mainColor})`,
                    }} />
                  )}
                  {opp.losses > 0 && (
                    <div style={{
                      flex: opp.losses, height: '100%', borderRadius: opp.wins > 0 ? '0 3px 3px 0' : '3px',
                      background: D.surface3,
                    }} />
                  )}
                </div>
              </div>

              {/* Opponent (right) */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, justifyContent: 'flex-end' }}>
                  <Link href={`/player/${opp.opponentId}`} style={{ textDecoration: 'none' }}>
                    <span style={{
                      fontFamily: D.fDisplay, fontSize: 18, fontWeight: 800,
                      color: D.text, letterSpacing: '0.01em',
                    }}>{opp.opponentHandle}</span>
                  </Link>
                  <span style={{ fontSize: 18 }}>{flag(opp.opponentCountryCode)}</span>
                </div>
                <div style={{
                  fontFamily: D.fDisplay, fontWeight: 900,
                  fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em',
                  color: !ahead && !even ? D.red : D.dim,
                }}>
                  {opp.losses}
                  <span style={{ fontSize: 13, fontWeight: 600, color: D.dim, marginLeft: 5 }}>{t.losses_label}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Character usage ───────────────────────────────────────────────

function CharUsageSection({ charUsage }: { charUsage: CharUsage[] }) {
  const { t } = useLocale()
  if (charUsage.length === 0) {
    return (
      <section>
        <SectionHeading id="sec-chars" label={t.char_subtitle} />
        <div style={{
          background: D.surface, border: `1px solid ${D.border}`,
          borderRadius: 10, padding: '40px 24px', textAlign: 'center',
          fontFamily: D.fDisplay, fontSize: 14, fontWeight: 600,
          letterSpacing: '0.1em', color: D.dim,
        }}>データなし</div>
      </section>
    )
  }
  const maxCount = Math.max(...charUsage.map(c => c.count))

  return (
    <section>
      <SectionHeading id="sec-chars" label={t.char_subtitle} />
      <div style={{ display: 'grid', gap: 10 }}>
        {charUsage.slice(0, 8).map((cu, i) => {
          const color = charColor(cu.char)
          const pct = Math.round((cu.count / maxCount) * 100)
          return (
            <div key={cu.char} style={{
              background: D.surface, border: `1px solid ${D.border}`,
              borderRadius: 10, padding: '18px 22px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                <CharPill name={cu.char} size={13} />
                {i === 0 && (
                  <span style={{
                    fontFamily: D.fDisplay, fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    background: `${color}18`, border: `1px solid ${color}40`,
                    borderRadius: 4, padding: '2px 8px', color,
                  }}>MAIN</span>
                )}
                <div style={{ marginLeft: 'auto' }}>
                  <span style={{
                    fontFamily: D.fDisplay, fontSize: 28, fontWeight: 900,
                    color: D.text, lineHeight: 1,
                  }}>{cu.count}</span>
                  <span style={{
                    fontFamily: D.fDisplay, fontSize: 12, color: D.dim,
                    marginLeft: 7, textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>sets</span>
                </div>
              </div>
              <div style={{ height: 5, background: D.surface3, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3, width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}77, ${color})`,
                  transition: 'width 1.2s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── 404 ───────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div style={{ background: D.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontFamily: D.fDisplay, fontSize: 72, fontWeight: 900, color: D.dim }}>404</div>
      <div style={{ fontFamily: D.fDisplay, fontSize: 20, color: D.muted }}>選手が見つかりません</div>
      <Link href="/" style={{
        fontFamily: D.fDisplay, fontSize: 14, fontWeight: 700,
        color: D.accent, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase',
        border: `1px solid rgba(0,212,170,0.25)`, borderRadius: 6, padding: '8px 20px', marginTop: 8,
      }}>← ホームへ</Link>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

export function PlayerClient({ data }: { data: PlayerPageData | null }) {
  const hasBio = !!(data?.player.bioJa || data?.player.bioEn)

  const sectionIds = [
    ...(hasBio ? ['sec-bio'] : []),
    'sec-results', 'sec-h2h', 'sec-chars',
  ]
  const activeSection = useActiveSection(sectionIds)

  if (!data) return <NotFound />
  const { player } = data

  return (
    <div style={{
      background: D.bg, color: D.text, minHeight: '100vh',
      fontFamily: D.fBody, fontSize: 15, lineHeight: 1.6,
    }}>
      <style>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${D.bg}; }
        ::-webkit-scrollbar-thumb { background: ${D.surface3}; border-radius: 3px; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-padding-top: 108px; }
      `}</style>

      <SiteNavbar
        activePage="players"
        breadcrumb={[
          { label: '選手', href: '/' },
          { label: player.handle },
        ]}
      />

      <HeroSection data={data} />
      <JumpNav hasBio={hasBio} activeSection={activeSection} />

      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '40px 24px 100px',
        display: 'flex', flexDirection: 'column', gap: 56,
      }}>
        {hasBio && <BioSection player={player} />}
        <ResultsSection results={data.results} />
        <H2HSection player={player} h2h={data.h2h} />
        <CharUsageSection charUsage={data.charUsage} />
      </div>
    </div>
  )
}
