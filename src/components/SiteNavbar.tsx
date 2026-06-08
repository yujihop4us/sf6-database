'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
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
  /** 開催中大会のライブページスラッグ。設定時はナビにLIVEリンクを表示 */
  liveSlug?: string | null
}

export default function SiteNavbar({ breadcrumb, activePage, isLive = false, liveSlug }: SiteNavbarProps) {
  const { lang, setLang, t } = useLocale()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  // ルート遷移でメニューを閉じる
  useEffect(() => { setMenuOpen(false) }, [pathname])

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

        /* PC: 通常表示 */
        .nav-hamburger { display: none; }
        .nav-mobile-menu { display: none; }

        /* モバイル (768px以下) */
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .nav-lang-toggle { display: none !important; }
          .nav-breadcrumb { display: none !important; }
          .nav-hamburger {
            display: flex !important;
            align-items: center; justify-content: center;
            background: none; border: none; cursor: pointer;
            color: #8ba3b4; padding: 8px;
            margin-left: auto;
          }
          .nav-mobile-menu {
            display: block !important;
            position: fixed; top: 52px; left: 0; right: 0;
            background: rgba(8, 12, 20, 0.98);
            border-bottom: 1px solid rgba(255,255,255,0.1);
            z-index: 100;
            padding: 8px 0;
          }
          .nav-mobile-menu a, .nav-mobile-menu button {
            display: block; width: 100%; text-align: left;
            padding: 14px 24px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            background: none; cursor: pointer;
          }
          .nav-mobile-lang {
            display: flex !important;
            gap: 8px; padding: 14px 24px;
          }
        }
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

        {/* PC Nav links */}
        <div className="nav-links" style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
          {/* 🔴 LIVE リンク: 開催中かつライブページ以外で表示 */}
          {liveSlug && !onLivePage && (
            <Link href={`/live/${liveSlug}`} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: fDisplay, fontSize: 13, fontWeight: 800,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: '#ef4444', textDecoration: 'none',
              padding: '14px 10px',
              borderBottom: '2px solid transparent',
            }}>
              <span className="nav-live-dot-anim" style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#ef4444', display: 'inline-block', flexShrink: 0,
              }} />
              LIVE
            </Link>
          )}
        </div>

        {/* Right side (PC) */}
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
            <div className="nav-breadcrumb" style={{
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

          {/* JA/EN toggle (PC) */}
          <div className="nav-lang-toggle" style={{
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

          {/* ハンバーガーボタン (モバイルのみ表示) */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'}
            aria-expanded={menuOpen}
          >
            {menuOpen
              ? /* × アイコン */
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="4" x2="18" y2="18"/><line x1="18" y1="4" x2="4" y2="18"/>
                </svg>
              : /* ☰ アイコン */
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="19" y2="6"/><line x1="3" y1="11" x2="19" y2="11"/><line x1="3" y1="16" x2="19" y2="16"/>
                </svg>
            }
          </button>
        </div>
      </nav>

      {/* モバイルドロップダウンメニュー */}
      {menuOpen && (
        <>
          {/* オーバーレイ (メニュー外タップで閉じる) */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99, top: 52 }}
            onClick={() => setMenuOpen(false)}
          />
          <div className="nav-mobile-menu">
            {/* ナビリンク */}
            {navLinks.map(link => {
              const isActive = currentPage === link.key
              return (
                <Link
                  key={link.key}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    fontFamily: fDisplay, fontSize: 15, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: isActive ? '#10b981' : '#cbd5e1',
                    textDecoration: 'none',
                  }}
                >
                  {link.label}
                </Link>
              )
            })}
            {/* 🔴 LIVE リンク（モバイル） */}
            {liveSlug && !onLivePage && (
              <Link
                href={`/live/${liveSlug}`}
                onClick={() => setMenuOpen(false)}
                style={{
                  fontFamily: fDisplay, fontSize: 15, fontWeight: 800,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: '#ef4444', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <span className="nav-live-dot-anim" style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#ef4444', display: 'inline-block', flexShrink: 0,
                }} />
                LIVE配信を見る
              </Link>
            )}
            {/* JA/EN 切替 */}
            <div className="nav-mobile-lang">
              {(['ja', 'en'] as const).map(l => (
                <button key={l} onClick={() => { setLang(l); setMenuOpen(false) }} style={{
                  background: lang === l ? '#10b981' : '#1e293b',
                  border: `1px solid ${lang === l ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 6, padding: '8px 20px', cursor: 'pointer',
                  fontFamily: fDisplay, fontSize: 13, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: lang === l ? '#000' : '#8ba3b4',
                }}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
