'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/lib/locale-context'

const fDisplay = 'var(--font-barlow-condensed, "Barlow Condensed", sans-serif)'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface SiteNavbarProps {
  breadcrumb?: BreadcrumbItem[]
  activePage?: 'home' | 'tournaments' | 'live' | 'players' | 'characters' | 'stats'
  isLive?: boolean
}

export default function SiteNavbar({ breadcrumb, activePage, isLive = false }: SiteNavbarProps) {
  const { lang, setLang, t } = useLocale()
  const pathname = usePathname()

  // 大会 / 選手 / キャラ / 統計 — ライブはナビリンクではなく右端バッジで表示
  const navLinks = [
    { key: 'tournaments' as const, label: t.nav_tournaments, href: '/tournaments' },
    { key: 'players'     as const, label: t.nav_players,     href: '/players' },
    { key: 'characters'  as const, label: 'キャラ',           href: '/characters' },
    { key: 'stats'       as const, label: '統計',             href: '/stats' },
  ]

  const currentPage = activePage ?? (
    pathname === '/' ? 'home' :
    pathname.startsWith('/tournaments') ? 'tournaments' :
    pathname.startsWith('/live')        ? 'live' :
    pathname.startsWith('/player')      ? 'players' :
    pathname.startsWith('/character')   ? 'characters' :
    pathname.startsWith('/stats')       ? 'stats' :
    undefined
  )

  const onLivePage = currentPage === 'live'

  return (
    <>
      <style>{`
        @keyframes nav-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        .nav-live-dot-anim { animation: nav-pulse 1.2s ease-in-out infinite; }
      `}</style>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,12,20,0.97)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 24px', display: 'flex', alignItems: 'center', gap: 20, height: 52,
      }}>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, background: '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: fDisplay, fontWeight: 900, fontSize: 13, color: '#000',
            letterSpacing: '-0.04em',
          }}>SF6</div>
          <span style={{
            fontFamily: fDisplay, fontWeight: 700, fontSize: 16,
            letterSpacing: '0.05em', color: '#edf2f7', textTransform: 'uppercase',
          }}>SF6 STATS</span>
        </Link>

        {/* Nav links: 大会 / 選手 / キャラ / 統計 */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {navLinks.map(link => {
            const isActive = currentPage === link.key
            return (
              <Link key={link.key} href={link.href} style={{
                fontFamily: fDisplay, fontSize: 13, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: isActive ? '#10b981' : '#8ba3b4',
                textDecoration: 'none',
                padding: '14px 10px',
                borderBottom: `2px solid ${isActive ? '#10b981' : 'transparent'}`,
                transition: 'color 0.15s',
              }}>
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>

          {/* ライブページ: ● LIVE バッジ + 大会名 */}
          {onLivePage && breadcrumb && breadcrumb.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: isLive ? 'rgba(255,77,106,0.15)' : 'rgba(71,85,105,0.25)',
                border: `1px solid ${isLive ? 'rgba(255,77,106,0.45)' : 'rgba(71,85,105,0.35)'}`,
                borderRadius: 6, padding: '4px 10px',
              }}>
                <span
                  className={isLive ? 'nav-live-dot-anim' : undefined}
                  style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: isLive ? '#ff4d6a' : '#475569',
                    display: 'inline-block', flexShrink: 0,
                  }}
                />
                <span style={{
                  fontFamily: fDisplay, fontSize: 11, fontWeight: 800,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: isLive ? '#ff4d6a' : '#64748b',
                }}>LIVE</span>
              </div>
              <span style={{
                fontFamily: fDisplay, fontSize: 13, fontWeight: 700,
                color: '#e2e8f0', letterSpacing: '0.03em',
              }}>{breadcrumb[0].label}</span>
            </div>
          )}

          {/* 非ライブページ: 通常ブレッドクラム */}
          {!onLivePage && breadcrumb && breadcrumb.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: fDisplay, fontSize: 12, color: '#8ba3b4',
            }}>
              {breadcrumb.map((item, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && <span style={{ color: '#4a6070' }}>›</span>}
                  {item.href
                    ? <Link href={item.href} style={{ color: '#8ba3b4', textDecoration: 'none' }}>{item.label}</Link>
                    : <span style={{ color: '#edf2f7' }}>{item.label}</span>}
                </span>
              ))}
            </div>
          )}

          {/* JA/EN toggle */}
          <div style={{
            display: 'flex', alignItems: 'center',
            background: '#131c24', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 6, padding: 2, gap: 2,
          }}>
            {(['ja', 'en'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                background: lang === l ? '#10b981' : 'transparent',
                border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                fontFamily: fDisplay, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: lang === l ? '#000' : '#8ba3b4',
                transition: 'background 0.15s, color 0.15s',
              }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </nav>
    </>
  )
}
