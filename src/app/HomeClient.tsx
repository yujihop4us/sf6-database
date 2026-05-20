'use client'

import Link from 'next/link'
import SiteNavbar from '@/components/SiteNavbar'
import { useLocale } from '@/lib/locale-context'
import type { HomeData, HomeTournament, RecentResult, TournamentSeries } from './page'

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
  silver:   '#a8bcc8',
  bronze:   '#cd8c52',
  red:      '#ff4d6a',
  fDisplay: 'var(--font-barlow-condensed, "Barlow Condensed", sans-serif)',
  fBody:    'var(--font-barlow, "Barlow", sans-serif)',
}

const FLAG: Record<string, string> = {
  JP:'🇯🇵', US:'🇺🇸', KR:'🇰🇷', CN:'🇨🇳', TW:'🇹🇼', HK:'🇭🇰',
  FR:'🇫🇷', GB:'🇬🇧', DE:'🇩🇪', BR:'🇧🇷', CL:'🇨🇱', AR:'🇦🇷',
  AU:'🇦🇺', CA:'🇨🇦', NO:'🇳🇴', DO:'🇩🇴', AE:'🇦🇪', SA:'🇸🇦',
  NL:'🇳🇱', IT:'🇮🇹', ES:'🇪🇸', PK:'🇵🇰', PH:'🇵🇭', SG:'🇸🇬',
  MX:'🇲🇽', RU:'🇷🇺', SE:'🇸🇪',
}
const flag = (code: string | null) => code ? (FLAG[code.toUpperCase()] ?? '🏳️') : '🏳️'

const CHAR_COLORS: Record<string, string> = {
  "Akuma":"#8b2fc9","Cammy":"#2e9e5b","Chun-Li":"#3d7ef5",
  "Dee Jay":"#f5a623","Ed":"#5c9ef5","Guile":"#4a90d9",
  "JP":"#9b4dca","Juri":"#d43f8c","Ken":"#d45f00",
  "Kimberly":"#ff6b35","Lily":"#7ec850","Luke":"#c8a820",
  "M.Bison":"#9b1a1a","Manon":"#c86490","Marisa":"#8b6914",
  "Rashid":"#50c8c8","Ryu":"#e04040","Terry":"#c83232","Zangief":"#d43c3c",
  "A.K.I":"#7bc87b","Mai":"#e85c7a","Blanka":"#3da840",
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
  if (!usd) return ''
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`
  return `$${usd.toLocaleString()}`
}

function placementColor(p: number): string {
  if (p === 1) return D.gold
  if (p === 2) return D.silver
  if (p === 3) return D.bronze
  return D.muted
}

function fmtPlacement(p: number, lang: string): string {
  if (lang === 'ja') {
    if (p === 1) return '優勝'
    if (p === 2) return '準優勝'
    if (p === 3) return '3位'
  } else {
    if (p === 1) return '1st'
    if (p === 2) return '2nd'
    if (p === 3) return '3rd'
  }
  return `${p}`
}

// ── Live Banner ───────────────────────────────────────────────────

function LiveBanner({ tournament }: { tournament: HomeTournament }) {
  const { t } = useLocale()
  return (
    <div style={{
      background: `linear-gradient(135deg, rgba(255,77,106,0.15) 0%, rgba(0,212,170,0.1) 100%)`,
      border: `1px solid rgba(255,77,106,0.4)`,
      borderRadius: 12, padding: '20px 28px',
      display: 'flex', alignItems: 'center', gap: 24,
      flexWrap: 'wrap', marginBottom: 48,
    }}>
      {/* Live badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: D.red, display: 'inline-block' }}
          className="sf6-pulse-dot" />
        <span style={{
          fontFamily: D.fDisplay, fontSize: 12, fontWeight: 700,
          letterSpacing: '0.16em', textTransform: 'uppercase', color: D.red,
        }}>{t.home_live}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: D.fDisplay, fontSize: 22, fontWeight: 800,
          color: D.text, letterSpacing: '0.01em',
        }}>{tournament.name}</div>
        {tournament.location && (
          <div style={{ fontFamily: D.fDisplay, fontSize: 13, color: D.muted, marginTop: 2 }}>
            {tournament.location}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
        <Link href={`/live/${tournament.id}`} style={{
          fontFamily: D.fDisplay, fontSize: 13, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: '#000', background: D.red, textDecoration: 'none',
          borderRadius: 6, padding: '8px 18px',
        }}>{t.home_watch}</Link>
        <Link href={`/tournament/${tournament.id}`} style={{
          fontFamily: D.fDisplay, fontSize: 13, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: D.accent, background: `${D.accent}18`,
          border: `1px solid ${D.border2}`, textDecoration: 'none',
          borderRadius: 6, padding: '8px 18px',
        }}>{t.home_goto}</Link>
      </div>
    </div>
  )
}

// ── Upcoming cards ────────────────────────────────────────────────

function UpcomingSection({ upcoming }: { upcoming: HomeTournament[] }) {
  const { lang, t } = useLocale()
  return (
    <section style={{ marginBottom: 56 }}>
      <SectionLabel label={t.home_upcoming} />
      {upcoming.length === 0 ? (
        <div style={{ fontFamily: D.fDisplay, fontSize: 14, color: D.dim }}>{t.home_no_upcoming}</div>
      ) : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {upcoming.slice(0, 6).map(t2 => (
            <Link key={t2.id} href={`/tournament/${t2.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: D.surface, border: `1px solid ${D.border}`,
                borderRadius: 10, padding: '20px 24px',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = D.border2)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = D.border)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <SeriesBadge series={t2.series} />
                    <span style={{
                      fontFamily: D.fDisplay, fontSize: 9, fontWeight: 700,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: D.muted, background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${D.border}`, borderRadius: 4, padding: '2px 7px',
                    }}>{t.status_upcoming}</span>
                  </div>
                  {t2.totalPrizeUsd && (
                    <span style={{ fontFamily: D.fDisplay, fontSize: 13, fontWeight: 700, color: D.gold, flexShrink: 0 }}>
                      {fmtPrize(t2.totalPrizeUsd)}
                    </span>
                  )}
                </div>
                <div style={{
                  fontFamily: D.fDisplay, fontSize: 18, fontWeight: 800,
                  color: D.text, lineHeight: 1.2, marginBottom: 8,
                }}>{t2.name}</div>
                <div style={{ fontFamily: D.fDisplay, fontSize: 13, color: D.muted }}>
                  {fmtDate(t2.startDate, lang)}
                  {t2.location && ` · ${t2.location}`}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Recent results ────────────────────────────────────────────────

function RecentSection({ results }: { results: RecentResult[] }) {
  const { lang, t } = useLocale()
  if (results.length === 0) return null

  const tournamentName = results[0]?.tournamentName ?? ''

  return (
    <section style={{ marginBottom: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 22, height: 2, background: D.accent, display: 'inline-block', borderRadius: 2 }} />
          <span style={{
            fontFamily: D.fDisplay, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase', color: D.accent,
          }}>{t.home_recent}</span>
        </div>
        <Link href={`/tournament/${results[0]?.tournamentId}`} style={{
          fontFamily: D.fDisplay, fontSize: 12, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: D.muted, textDecoration: 'none',
        }}>{tournamentName} →</Link>
      </div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {results.map(r => {
          const charColor = r.playerCharacter ? (CHAR_COLORS[r.playerCharacter] ?? '#556') : '#556'
          const pc = placementColor(r.placement)
          return (
            <Link key={r.playerId} href={`/player/${r.playerId}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: D.surface, border: `1px solid ${r.placement === 1 ? `${D.gold}40` : D.border}`,
                borderRadius: 10, padding: '20px 24px',
                display: 'flex', alignItems: 'center', gap: 16,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = D.border2)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = r.placement === 1 ? `${D.gold}40` : D.border)}>
                {/* Placement */}
                <div style={{
                  fontFamily: D.fDisplay, fontWeight: 900, fontSize: 40, lineHeight: 1,
                  color: pc, letterSpacing: '-0.02em', flexShrink: 0, minWidth: 48, textAlign: 'center',
                }}>
                  {r.placement === 1 ? '🥇' : r.placement === 2 ? '🥈' : '🥉'}
                </div>
                {/* Player info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{flag(r.playerCountryCode)}</span>
                    <span style={{
                      fontFamily: D.fDisplay, fontSize: 20, fontWeight: 800,
                      color: D.text, letterSpacing: '0.01em',
                    }}>{r.playerHandle}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontFamily: D.fDisplay, fontSize: 12, fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: pc,
                    }}>{fmtPlacement(r.placement, lang)}</span>
                    {r.playerCharacter && (
                      <span style={{
                        fontFamily: D.fDisplay, fontSize: 11, fontWeight: 600,
                        letterSpacing: '0.05em', textTransform: 'uppercase',
                        color: charColor,
                        background: `${charColor}18`, border: `1px solid ${charColor}40`,
                        borderRadius: 3, padding: '1px 7px',
                      }}>{r.playerCharacter}</span>
                    )}
                    {r.prizeAmount && (
                      <span style={{ fontFamily: D.fDisplay, fontSize: 12, color: D.gold }}>
                        {fmtPrize(r.prizeAmount)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

// ── Past tournaments (compact) ────────────────────────────────────

function PastSection({ past }: { past: HomeTournament[] }) {
  const { lang, t } = useLocale()
  const toShow = past.slice(0, 10)

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 22, height: 2, background: D.accent, display: 'inline-block', borderRadius: 2 }} />
          <span style={{
            fontFamily: D.fDisplay, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase', color: D.accent,
          }}>{t.home_past}</span>
        </div>
        <Link href="/tournaments" style={{
          fontFamily: D.fDisplay, fontSize: 12, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: D.muted, textDecoration: 'none',
        }}>{t.home_view_all} →</Link>
      </div>
      <div style={{ border: `1px solid ${D.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {toShow.map((tournament, i) => (
          <Link key={tournament.id} href={`/tournament/${tournament.id}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 20,
              padding: '14px 20px',
              background: i % 2 === 0 ? D.surface : 'rgba(13,19,24,0.7)',
              borderBottom: i < toShow.length - 1 ? `1px solid ${D.border}` : 'none',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = D.surface3)}
            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? D.surface : 'rgba(13,19,24,0.7)')}>
              {tournament.isLive && (
                <span style={{
                  fontFamily: D.fDisplay, fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.1em', background: D.red,
                  borderRadius: 3, padding: '2px 6px', color: '#fff', flexShrink: 0,
                }}>LIVE</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontFamily: D.fDisplay, fontSize: 16, fontWeight: 700,
                  color: D.text, letterSpacing: '0.01em',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'block',
                }}>{tournament.name}</span>
              </div>
              <div style={{ fontFamily: D.fDisplay, fontSize: 13, color: D.muted, flexShrink: 0, whiteSpace: 'nowrap' }}>
                {fmtDate(tournament.startDate, lang)}
              </div>
              {tournament.totalPrizeUsd && (
                <div style={{
                  fontFamily: D.fDisplay, fontSize: 13, fontWeight: 700,
                  color: tournament.totalPrizeUsd >= 100000 ? D.gold : D.muted,
                  flexShrink: 0, minWidth: 60, textAlign: 'right',
                }}>{fmtPrize(tournament.totalPrizeUsd)}</div>
              )}
              {tournament.entrantCount > 0 && (
                <div style={{ fontFamily: D.fDisplay, fontSize: 13, color: D.dim, flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
                  {tournament.entrantCount}人
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

const SERIES_CONFIG: Record<TournamentSeries, { label: string; color: string }> = {
  EWC:         { label: 'EWC',         color: '#ff9500' },
  CPT_PREMIER: { label: 'CPT PREMIER', color: '#00d4aa' },
  ROAD_TO_EWC: { label: 'ROAD TO EWC', color: '#4a9eff' },
  CPT_FINALS:  { label: 'CPT FINALS',  color: '#f5c842' },
  OTHER:       { label: '',            color: '#8ba3b4' },
}

function SeriesBadge({ series }: { series: TournamentSeries }) {
  const cfg = SERIES_CONFIG[series]
  if (!cfg.label) return null
  return (
    <span style={{
      fontFamily: D.fDisplay, fontSize: 9, fontWeight: 700,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      color: cfg.color,
      background: `${cfg.color}18`,
      border: `1px solid ${cfg.color}40`,
      borderRadius: 4, padding: '2px 7px',
      flexShrink: 0,
    }}>{cfg.label}</span>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
    }}>
      <span style={{ width: 22, height: 2, background: D.accent, display: 'inline-block', borderRadius: 2 }} />
      <span style={{
        fontFamily: D.fDisplay, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase', color: D.accent,
      }}>{label}</span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────

export default function HomeClient({ data }: { data: HomeData }) {
  const { t } = useLocale()

  return (
    <div style={{ background: D.bg, color: D.text, minHeight: '100vh', fontFamily: D.fBody }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes sf6-pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .sf6-pulse-dot { animation: sf6-pulse-dot 1.5s ease-in-out infinite; }
      `}</style>

      <SiteNavbar activePage="home" isLive={!!data.liveTournament} />

      {/* Site Hero */}
      <div style={{
        background: `linear-gradient(150deg, #0f3040 0%, #0e1419 40%, ${D.bg} 80%)`,
        borderBottom: `1px solid ${D.border}`,
        padding: '56px 32px 52px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
        }} />
        <div style={{
          position: 'absolute', top: -80, right: 60, width: 360, height: 360,
          background: 'radial-gradient(circle, rgba(0,212,170,0.07) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            fontFamily: D.fDisplay, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: D.accent, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ width: 22, height: 2, background: D.accent, display: 'inline-block', borderRadius: 2 }} />
            Street Fighter 6 Esports
          </div>
          <h1 style={{
            fontFamily: D.fDisplay, fontWeight: 900, fontSize: 72,
            letterSpacing: '-0.02em', lineHeight: 0.95, color: '#ffffff',
            marginBottom: 20,
          }}>SF6 STATS</h1>
          <p style={{
            fontFamily: D.fDisplay, fontSize: 18, color: D.muted,
            maxWidth: 480, lineHeight: 1.5,
          }}>
            {t.nav_tournaments} · {t.nav_players} · Head-to-Head
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 100px' }}>
        {/* Live banner */}
        {data.liveTournament && <LiveBanner tournament={data.liveTournament} />}

        {/* Recent results */}
        <RecentSection results={data.recentResults} />

        {/* Upcoming */}
        <UpcomingSection upcoming={data.upcoming} />

        {/* Past */}
        <PastSection past={data.past} />
      </div>
    </div>
  )
}
