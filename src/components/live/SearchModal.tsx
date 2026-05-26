'use client'

import { V, codeToFlag, Player } from './tokens'

export function SearchModal({
  searchSide, searchQuery, setSearchQuery,
  searchResults, onSelect, onClose,
}: {
  searchSide: 'p1' | 'p2' | null
  searchQuery: string
  setSearchQuery: (q: string) => void
  searchResults: Player[]
  onSelect: (p: Player) => void
  onClose: () => void
}) {
  const sideColor = searchSide === 'p1' ? V.P1 : V.P2
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 80,
    }}>
      <div style={{
        background: V.surface2, border: `1px solid ${sideColor}35`,
        borderRadius: 12, width: '100%', maxWidth: 420, padding: 20, margin: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: sideColor,
              boxShadow: `0 0 8px ${sideColor}`,
            }} />
            <span style={{ fontFamily: V.FD, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: sideColor }}>
              {searchSide === 'p1' ? 'P1 選択' : 'P2 選択'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.muted, fontSize: 18 }}>✕</button>
        </div>
        <input
          type="text" autoFocus
          placeholder="選手名を検索..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', background: V.surface3, border: `1px solid ${V.border}`,
            borderRadius: 8, padding: '10px 14px',
            color: V.text, fontFamily: V.FB, fontSize: 14, outline: 'none', marginBottom: 10,
          }}
        />
        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {searchResults.map(p => (
            <button key={p.id} onClick={() => onSelect(p)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px', borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer', textAlign: 'left',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = V.surface3)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: `${sideColor}20`, border: `1px solid ${sideColor}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: V.FD, fontSize: 14, fontWeight: 700, color: sideColor, flexShrink: 0,
              }}>{p.handle.charAt(0)}</div>
              <div>
                <div style={{ fontFamily: V.FD, fontSize: 14, fontWeight: 700, color: V.text }}>{p.handle}</div>
                <div style={{ fontFamily: V.FD, fontSize: 11, color: V.muted }}>
                  {p.country_code && `${codeToFlag(p.country_code)} `}{p.main_character ?? ''}{p.team ? ` · ${p.team}` : ''}
                </div>
              </div>
            </button>
          ))}
          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <p style={{ textAlign: 'center', color: V.dim, fontFamily: V.FD, fontSize: 13, padding: '16px 0' }}>見つかりませんでした</p>
          )}
        </div>
      </div>
    </div>
  )
}
