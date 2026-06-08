'use client'

import Link from 'next/link'
import SiteNavbar from '@/components/SiteNavbar'
import { useLocale } from '@/lib/locale-context'
import type { TournamentRow } from './page'

const D = {
  bg:       '#080c10',
  surface:  '#0e1419',
  surface2: '#131c24',
  surface3: '#1a2530',
  border:   'rgba(255,255,255,0.07)',
  border2:  'rgba(0,212,170,0.25)',
  accent:   '#00d4aa',
  text:     '#edf2f7',
  muted:    '#8ba3b4',
  dim:      '#4a6070',
  gold:     '#f5c842',
  red:      '#ff4d6a',
  green:    '#4ade80',
  fDisplay: 'var(--font-barlow-condensed, "Barlow Condensed", sans-serif)',
  fBody:    'var(--font-barlow, "Barlow", sans-serif)',
}

function getStatus(t: TournamentRow): 'live' | 'upcoming' | 'completed' {
  if (!t.startDate) return 'completed'
  const now = Date.now()
  const start = new Date(t.startDate).getTime()
  const end = t.endDate ? new Date(t.endDate).getTime() : start + 3 * 24 * 60 * 60 * 1000
  if (now >= start && now <= end) return 'live'
  if (now < start) return 'upcoming'
  return 'completed'
}

function fmtDate(d: string | null, lang: string): string {
  if (!d) return ''
  const date = new Date(d)
  if (lang === 'ja') {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtPrize(usd: number | null): string {
  if (!usd) return '—'
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`
  return `$${usd.toLocaleString()}`
}

function SeriesBadge({ series, ewcQual }: { series: TournamentRow['series']; ewcQual: boolean }) {
  if (series === 'EWC') {
    return (
      <span style={{
        fontFamily: D.fDisplay, fontSize: 10, fontWeight: 800,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        background: 'rgba(245,200,66,0.15)', border: '1px solid rgba(245,200,66,0.45)',
        borderRadius: 4, padding: '2px 7px', color: '#f5c842', whiteSpace: 'nowrap',
      }}>EWC</span>
    )
  }
  if (series === 'CPT_FINALS') {
    return (
      <span style={{
        fontFamily: D.fDisplay, fontSize: 10, fontWeight: 800,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        background: 'rgba(255,77,106,0.15)', border: '1px solid rgba(255,77,106,0.45)',
        borderRadius: 4, padding: '2px 7px', color: D.red, whiteSpace: 'nowrap',
      }}>CPT FINALS</span>
    )
  }
  if (series === 'CPT_PREMIER') {
    return (
      <span style={{
        fontFamily: D.fDisplay, fontSize: 10, fontWeight: 800,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.35)',
        borderRadius: 4, padding: '2px 7px', color: D.accent, whiteSpace: 'nowrap',
      }}>CPT PREMIER</span>
    )
  }
  if (series === 'ROAD_TO_EWC') {
    return (
      <span style={{
        fontFamily: D.fDisplay, fontSize: 10, fontWeight: 800,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        background: 'rgba(147,112,219,0.15)', border: '1px solid rgba(147,112,219,0.4)',
        borderRadius: 4, padding: '2px 7px', color: '#a78bfa', whiteSpace: 'nowrap',
      }}>ROAD TO EWC</span>
    )
  }
  // OTHER — show EWC Qual badge only if applicable
  if (ewcQual) {
    return (
      <span style={{
        fontFamily: D.fDisplay, fontSize: 10, fontWeight: 800,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.35)',
        borderRadius: 4, padding: '2px 7px', color: '#f5c842', whiteSpace: 'nowrap',
      }}>EWC QUAL</span>
    )
  }
  return null
}

export default function TournamentsClient({ tournaments }: { tournaments: TournamentRow[] }) {
  const { lang, t } = useLocale()

  const live     = tournaments.filter(tr => getStatus(tr) === 'live')
  // Sort upcoming ascending — closest event first
  const upcoming = tournaments
    .filter(tr => getStatus(tr) === 'upcoming')
    .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())
  const past     = tournaments.filter(tr => getStatus(tr) === 'completed')

  return (
    <div style={{ background: D.bg, color: D.text, minHeight: '100vh', fontFamily: D.fBody }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .live-dot { animation: pulse-dot 1.2s ease-in-out infinite; }
      `}</style>

      <SiteNavbar activePage="tournaments" isLive={live.length > 0} liveSlug={live[0]?.startggSlug ?? null} />

      {/* Hero */}
      <div style={{
        background: `linear-gradient(150deg, #0f3040 0%, #0e1419 40%, ${D.bg} 80%)`,
        borderBottom: `1px solid ${D.border}`,
        padding: '48px 32px 40px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            fontFamily: D.fDisplay, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: D.accent, marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ width: 22, height: 2, background: D.accent, display: 'inline-block', borderRadius: 2 }} />
            SF6 STATS
          </div>
          <h1 style={{
            fontFamily: D.fDisplay, fontWeight: 900, fontSize: 56,
            letterSpacing: '-0.02em', lineHeight: 1, color: D.text, marginBottom: 12,
          }}>{t.tlist_title}</h1>
          <div style={{ fontFamily: D.fDisplay, fontSize: 16, color: D.muted }}>
            {tournaments.length}大会 · SF6 CPT + Major
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 100px' }}>

        {/* ── LIVE section ── */}
        {live.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <div style={{
              fontFamily: D.fDisplay, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              color: D.red, marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: D.red, display: 'inline-block' }} />
              {t.status_live}
            </div>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
              {live.map(tournament => (
                <Link key={tournament.id} href={`/live/${tournament.startggSlug ?? tournament.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'rgba(255,77,106,0.06)',
                    border: `1px solid rgba(255,77,106,0.35)`,
                    borderRadius: 12, padding: '22px 26px',
                    transition: 'border-color 0.15s, background 0.15s',
                    boxShadow: '0 0 24px rgba(255,77,106,0.08)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,77,106,0.65)'
                    e.currentTarget.style.background = 'rgba(255,77,106,0.1)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,77,106,0.35)'
                    e.currentTarget.style.background = 'rgba(255,77,106,0.06)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: D.red, display: 'inline-block' }} />
                        <span style={{
                          fontFamily: D.fDisplay, fontSize: 11, fontWeight: 800,
                          letterSpacing: '0.14em', textTransform: 'uppercase', color: D.red,
                        }}>LIVE NOW</span>
                      </div>
                      {tournament.totalPrizeUsd && (
                        <span style={{ fontFamily: D.fDisplay, fontSize: 14, fontWeight: 700, color: D.gold }}>
                          {fmtPrize(tournament.totalPrizeUsd)}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontFamily: D.fDisplay, fontSize: 24, fontWeight: 900,
                      color: D.text, letterSpacing: '0.01em', marginBottom: 8, lineHeight: 1.2,
                    }}>{tournament.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontFamily: D.fDisplay, fontSize: 13, color: D.muted }}>
                        {fmtDate(tournament.startDate, lang)}
                        {tournament.location && ` · ${tournament.location}`}
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'rgba(255,77,106,0.15)', border: '1px solid rgba(255,77,106,0.4)',
                        borderRadius: 6, padding: '5px 12px',
                        fontFamily: D.fDisplay, fontSize: 12, fontWeight: 700,
                        letterSpacing: '0.08em', color: D.red,
                      }}>
                        ▶ 視聴する
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Upcoming (sorted ascending — closest first) ── */}
        {upcoming.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <div style={{
              fontFamily: D.fDisplay, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              color: D.accent, marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ width: 22, height: 2, background: D.accent, display: 'inline-block', borderRadius: 2 }} />
              {t.home_upcoming}
            </div>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
              {upcoming.map(tournament => (
                <div key={tournament.id} style={{
                  background: D.surface, border: `1px solid ${D.border}`,
                  borderRadius: 10, padding: '20px 24px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: D.fDisplay, fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.12em', textTransform: 'uppercase',
                        background: `${D.accent}18`, border: `1px solid ${D.accent}40`,
                        borderRadius: 4, padding: '2px 8px', color: D.accent,
                      }}>{t.status_upcoming}</span>
                      <SeriesBadge series={tournament.series} ewcQual={tournament.ewcQual} />
                    </div>
                    {tournament.totalPrizeUsd && (
                      <span style={{ fontFamily: D.fDisplay, fontSize: 14, fontWeight: 700, color: D.gold }}>
                        {fmtPrize(tournament.totalPrizeUsd)}
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontFamily: D.fDisplay, fontSize: 20, fontWeight: 800,
                    color: D.text, letterSpacing: '0.01em', marginBottom: 8, lineHeight: 1.2,
                  }}>{tournament.name}</div>
                  <div style={{ fontFamily: D.fDisplay, fontSize: 13, color: D.muted }}>
                    {fmtDate(tournament.startDate, lang)}
                    {tournament.location && ` · ${tournament.location}`}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Past tournaments table */}
        <section>
          <div style={{
            fontFamily: D.fDisplay, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: D.accent, marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ width: 22, height: 2, background: D.accent, display: 'inline-block', borderRadius: 2 }} />
            {t.home_past}
          </div>

          <div style={{ border: `1px solid ${D.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ background: D.surface2 }}>
                    {[t.col_tournament, t.col_date2, t.col_location, t.col_entrants, t.col_prizepool].map(h => (
                      <th key={h} style={{
                        padding: '11px 16px', textAlign: 'left',
                        fontFamily: D.fDisplay, fontSize: 12, fontWeight: 700,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: D.muted, borderBottom: `1px solid ${D.border}`,
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {past.map((tournament, i) => (
                    <tr key={tournament.id}
                      style={{
                        background: i % 2 === 0 ? D.surface : 'rgba(13,19,24,0.7)',
                        borderBottom: `1px solid ${D.border}`,
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = D.surface3)}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? D.surface : 'rgba(13,19,24,0.7)')}
                      onClick={() => { window.location.href = `/tournament/${tournament.id}` }}
                    >
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            fontFamily: D.fDisplay, fontSize: 16, fontWeight: 700,
                            color: D.text, letterSpacing: '0.01em',
                          }}>{tournament.name}</span>
                          <SeriesBadge series={tournament.series} ewcQual={tournament.ewcQual} />
                        </div>
                      </td>
                      <td style={{
                        padding: '13px 16px', fontFamily: D.fDisplay,
                        fontSize: 13, color: D.muted, whiteSpace: 'nowrap',
                      }}>
                        {fmtDate(tournament.startDate, lang)}
                      </td>
                      <td style={{
                        padding: '13px 16px', fontFamily: D.fDisplay,
                        fontSize: 13, color: D.muted,
                      }}>
                        {tournament.location ?? '—'}
                      </td>
                      <td style={{
                        padding: '13px 16px', fontFamily: D.fDisplay,
                        fontSize: 14, fontWeight: 700, color: D.text, textAlign: 'right',
                      }}>
                        {tournament.entrantCount > 0 ? tournament.entrantCount.toLocaleString() : '—'}
                      </td>
                      <td style={{
                        padding: '13px 16px', fontFamily: D.fDisplay,
                        fontSize: 14, fontWeight: 700,
                        color: (tournament.totalPrizeUsd ?? 0) >= 100000 ? D.gold : D.muted,
                      }}>
                        {fmtPrize(tournament.totalPrizeUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
