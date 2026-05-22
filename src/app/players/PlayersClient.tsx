'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import SiteNavbar from '@/components/SiteNavbar'
import { useLocale } from '@/lib/locale-context'

// ── Design tokens ──────────────────────────────────────────────────────────────
const D = {
  bg:        '#080c14',
  surface:   '#0d1520',
  surface2:  '#111d2e',
  surface3:  '#162135',
  border:    'rgba(255,255,255,0.07)',
  accent:    '#10b981',
  accentDim: 'rgba(16,185,129,0.10)',
  text:      '#f1f5f9',
  muted:     '#94a3b8',
  dim:       '#475569',
  gold:      '#f5c842',
  silver:    '#a8bcc8',
  bronze:    '#cd8c52',
  FD:        "var(--font-barlow-condensed, 'Barlow Condensed', sans-serif)",
  FB:        "var(--font-barlow, 'Barlow', sans-serif)",
} as const

const CHAR_COLORS: Record<string, string> = {
  'Akuma':'#8b2fc9','Cammy':'#2e9e5b','Chun-Li':'#3d7ef5',
  'Dee Jay':'#f5a623','Ed':'#4a7fd4','Guile':'#4a90d9',
  'JP':'#9b4dca','Juri':'#d43f8c','Ken':'#d45f00',
  'Luke':'#c8a820','M.Bison':'#9b1a1a','Manon':'#c86490',
  'Marisa':'#8b6914','Rashid':'#50c8c8','Ryu':'#e04040',
  'Blanka':'#3da840','Dhalsim':'#e85c2a','E. Honda':'#e84848',
  'Kimberly':'#ff6b35','Lily':'#7ec850','Zangief':'#d43c3c',
  'Jamie':'#d48820','Terry':'#c83232','Mai':'#e85c7a','Elena':'#30b040',
  'A.K.I':'#7bc87b',
}

function charColor(name: string | null) {
  return (name && CHAR_COLORS[name]) || '#556677'
}

function codeToFlag(code?: string | null): string {
  if (!code || code.length < 2) return '🏳'
  return code.toUpperCase().slice(0, 2).split('').map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join('')
}

function fmtEarnings(usd: number | null): string {
  if (!usd || usd <= 0) return '—'
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`
  if (usd >= 1_000)     return `$${Math.round(usd / 1_000)}K`
  return `$${usd.toLocaleString()}`
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PlayerRow {
  id: number
  handle: string
  country_code: string | null
  main_character: string | null
  team: string | null
  total_sf6_earnings_usd: number | null
}

// ── Player card ────────────────────────────────────────────────────────────────
function PlayerCard({ player, rank }: { player: PlayerRow; rank?: number }) {
  const color  = charColor(player.main_character)
  const flag   = codeToFlag(player.country_code)
  const rankColor = rank === 1 ? D.gold : rank === 2 ? D.silver : rank === 3 ? D.bronze : D.muted

  return (
    <Link href={`/player/${player.id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: D.surface,
          border: `1px solid ${D.border}`,
          borderRadius: 10,
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = `${color}50`
          ;(e.currentTarget as HTMLDivElement).style.background = D.surface2
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = D.border
          ;(e.currentTarget as HTMLDivElement).style.background = D.surface
        }}
      >
        {/* Left edge accent */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
        }} />

        {/* Rank badge */}
        {rank && (
          <div style={{
            fontFamily: D.FD, fontSize: 13, fontWeight: 900,
            color: rankColor, minWidth: 28, textAlign: 'center', flexShrink: 0,
          }}>#{rank}</div>
        )}

        {/* Avatar placeholder */}
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: `${color}20`, border: `2px solid ${color}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: D.FD, fontSize: 17, fontWeight: 900, color,
          flexShrink: 0,
        }}>
          {player.handle.charAt(0).toUpperCase()}
        </div>

        {/* Player info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{flag}</span>
            <span style={{
              fontFamily: D.FD, fontSize: 18, fontWeight: 800,
              color: D.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{player.handle}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            {player.main_character && (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                background: `${color}18`, border: `1px solid ${color}40`,
                borderRadius: 4, padding: '1px 8px',
                fontFamily: D.FD, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase' as const, color,
              }}>{player.main_character}</span>
            )}
            {player.team && (
              <span style={{
                fontFamily: D.FD, fontSize: 11, color: D.dim,
                letterSpacing: '0.04em', textTransform: 'uppercase' as const,
              }}>{player.team}</span>
            )}
          </div>
        </div>

        {/* Earnings */}
        {player.total_sf6_earnings_usd != null && player.total_sf6_earnings_usd > 0 && (
          <div style={{
            textAlign: 'right', flexShrink: 0,
          }}>
            <div style={{
              fontFamily: D.FD, fontSize: 16, fontWeight: 900,
              color: D.gold, letterSpacing: '0.02em',
            }}>{fmtEarnings(player.total_sf6_earnings_usd)}</div>
            <div style={{
              fontFamily: D.FD, fontSize: 10, color: D.dim,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginTop: 1,
            }}>賞金総額</div>
          </div>
        )}
      </div>
    </Link>
  )
}

// ── Main client component ──────────────────────────────────────────────────────
export default function PlayersClient({ initialPlayers }: { initialPlayers: PlayerRow[] }) {
  const { lang } = useLocale()
  const [query, setQuery]           = useState('')
  const [searchResults, setSearchResults] = useState<PlayerRow[]>([])
  const [isSearching, setIsSearching]     = useState(false)
  const [searched, setSearched]           = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setSearchResults([])
      setSearched(false)
      return
    }
    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/players/search?q=${encodeURIComponent(query)}&limit=50`)
        const data = await res.json()
        setSearchResults(data.players ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
        setSearched(true)
      }
    }, 300)
  }, [query])

  const showSearch = query.length >= 2
  const displayList = showSearch ? searchResults : initialPlayers

  return (
    <div style={{ background: D.bg, color: D.text, minHeight: '100vh', fontFamily: D.FB }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${D.bg}; }
        ::-webkit-scrollbar-thumb { background: ${D.surface3}; border-radius: 3px; }
      `}</style>

      <SiteNavbar activePage="players" />

      <div style={{ padding: '32px 24px 80px', maxWidth: 900, margin: '0 auto' }}>

        {/* ── ヘッダー ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontFamily: D.FD, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.16em', textTransform: 'uppercase' as const,
            color: D.accent, marginBottom: 8,
          }}>PLAYERS</div>
          <h1 style={{
            fontFamily: D.FD, fontSize: 36, fontWeight: 900,
            letterSpacing: '-0.01em', color: D.text, lineHeight: 1,
          }}>
            {lang === 'ja' ? '選手一覧' : 'Player Rankings'}
          </h1>
          <p style={{ fontFamily: D.FB, fontSize: 14, color: D.muted, marginTop: 8 }}>
            {lang === 'ja'
              ? 'SF6 プロ選手を検索・閲覧できます'
              : 'Search and browse SF6 professional players'}
          </p>
        </div>

        {/* ── 検索バー ── */}
        <div style={{ position: 'relative', marginBottom: 28 }}>
          <div style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: D.dim, pointerEvents: 'none',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={lang === 'ja' ? '選手名を検索（例: Tokido, Kawano）' : 'Search players (e.g. Tokido, Kawano)'}
            style={{
              width: '100%',
              background: D.surface2, border: `1px solid ${D.border}`,
              borderRadius: 10, padding: '12px 14px 12px 42px',
              color: D.text, fontFamily: D.FB, fontSize: 15, outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = D.accent)}
            onBlur={e => (e.target.style.borderColor = D.border)}
          />
          {isSearching && (
            <div style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              fontFamily: D.FD, fontSize: 11, color: D.muted,
            }}>検索中...</div>
          )}
        </div>

        {/* ── 件数ラベル ── */}
        <div style={{
          fontFamily: D.FD, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase' as const,
          color: D.dim, marginBottom: 14,
        }}>
          {showSearch
            ? (searched
                ? (searchResults.length > 0
                    ? `${searchResults.length} 件の検索結果`
                    : '見つかりませんでした')
                : '検索中...')
            : `賞金ランキング TOP ${initialPlayers.length}`}
        </div>

        {/* ── プレイヤーカード一覧 ── */}
        {displayList.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayList.map((player, i) => (
              <PlayerCard
                key={player.id}
                player={player}
                rank={!showSearch ? i + 1 : undefined}
              />
            ))}
          </div>
        ) : (
          searched && query.length >= 2 && (
            <div style={{
              textAlign: 'center', padding: '60px 0',
              fontFamily: D.FD, fontSize: 16, color: D.dim,
            }}>
              「{query}」に一致する選手が見つかりませんでした
            </div>
          )
        )}

        {/* ── フッター注記 ── */}
        {!showSearch && (
          <div style={{
            marginTop: 24, padding: '14px 18px',
            background: D.surface, border: `1px solid ${D.border}`,
            borderRadius: 8,
            fontFamily: D.FD, fontSize: 12, color: D.dim,
          }}>
            {lang === 'ja'
              ? '上記は賞金データがある選手のみ表示しています。全22,000人以上の選手は検索からアクセスできます。'
              : 'Showing only players with prize data. All 22,000+ players are accessible via search.'}
          </div>
        )}
      </div>
    </div>
  )
}
