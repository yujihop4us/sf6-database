'use client'

import { useState } from 'react'
import { V, cc } from './tokens'
import { CharPill } from './CharPill'

const BRACKET_ROUND_ORDER: Record<string, number> = {
  'Winners Round 1': 10, 'Winners Round 2': 11, 'Winners Round 3': 12,
  'Winners Round 4': 13, 'Winners Quarter-Final': 20, 'Winners Semi-Final': 30,
  'Winners Final': 40,
  'Losers Round 1': 50, 'Losers Round 2': 51, 'Losers Round 3': 52,
  'Losers Round 4': 53, 'Losers Round 5': 54, 'Losers Round 6': 55,
  'Losers Quarter-Final': 60, 'Losers Semi-Final': 70, 'Losers Final': 80,
  'Grand Final': 90, 'Grand Final Reset': 91,
}
function bracketRoundSort(round: string): number { return BRACKET_ROUND_ORDER[round] ?? 5 }

export function LiveBracket({
  matches, lastUpdated, onMatchClick,
}: {
  matches: any[]
  lastUpdated: string
  onMatchClick: (p1: string, p2: string) => void
}) {
  const [filter, setFilter] = useState<'all' | 'live' | 'completed' | 'upcoming'>('all')

  if (matches.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '60px 20px' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: V.surface2, border: `1px solid ${V.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>⌛</div>
        <div style={{ fontFamily: V.FD, fontSize: 13, fontWeight: 700, color: V.dim, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
          ブラケット情報を取得中...
        </div>
        <div style={{ fontFamily: V.FB, fontSize: 12, color: `${V.dim}99` }}>
          start.gg からデータを読み込んでいます
        </div>
      </div>
    )
  }

  const live      = matches.filter((m: any) => m.status === 'live')
  const completed = matches.filter((m: any) => m.status === 'completed')
  const upcoming  = matches.filter((m: any) => m.status === 'upcoming' || m.status === 'pending')
  const sortedC   = [...completed].sort((a, b) => bracketRoundSort(a.round) - bracketRoundSort(b.round))
  const sortedU   = [...upcoming].sort((a, b) => bracketRoundSort(a.round) - bracketRoundSort(b.round))

  const display = filter === 'live'      ? live
               : filter === 'completed'  ? sortedC
               : filter === 'upcoming'   ? sortedU
               : [...live, ...sortedC.slice(-30), ...sortedU.slice(0, 10)]

  const filterBtns = [
    { id: 'all' as const,       label: 'ALL',     count: matches.length },
    { id: 'live' as const,      label: '● LIVE',  count: live.length },
    { id: 'completed' as const, label: '完了',     count: completed.length },
    { id: 'upcoming' as const,  label: '次の試合', count: upcoming.length },
  ].filter(f => f.count > 0 || f.id === 'all')

  return (
    <div style={{ padding: '14px 0' }}>
      {/* フィルターバー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {filterBtns.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: filter === f.id ? V.surface3 : 'transparent',
              border: `1px solid ${filter === f.id ? V.border2 : V.border}`,
              borderRadius: 5, padding: '3px 10px', cursor: 'pointer',
              fontFamily: V.FD, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              color: filter === f.id ? (f.id === 'live' ? V.red : V.accent) : V.muted,
            }}>
              {f.label}{f.count > 0 ? <span style={{ opacity: 0.65 }}> ({f.count})</span> : null}
            </button>
          ))}
        </div>
        {lastUpdated && (
          <div style={{ fontFamily: V.FD, fontSize: 10, color: V.dim }}>更新: {lastUpdated}</div>
        )}
      </div>

      {/* 試合行 */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {display.map((m: any, i: number) => {
          const isLive = m.status === 'live'
          const isDone = m.status === 'completed'
          const canClick = m.player1 && m.player2 && m.player1 !== 'TBD' && m.player2 !== 'TBD'
          return (
            <div
              key={i}
              onClick={() => canClick && onMatchClick(m.player1, m.player2)}
              style={{
                padding: '10px 16px',
                borderBottom: `1px solid ${V.border}`,
                cursor: canClick ? 'pointer' : 'default',
                background: isLive ? 'rgba(255,77,106,0.05)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (canClick) (e.currentTarget as HTMLDivElement).style.background = V.surface2 }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isLive ? 'rgba(255,77,106,0.05)' : 'transparent' }}
            >
              {/* ラウンド + グループ + ステータス */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontFamily: V.FD, fontSize: 10, color: V.dim, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                  {m.round}
                </span>
                {m.group && (
                  <><span style={{ color: V.dim, fontSize: 10 }}>·</span>
                  <span style={{ fontFamily: V.FD, fontSize: 10, color: `${V.dim}88` }}>{m.group}</span></>
                )}
                {isLive && (
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span className="sf6live-dot" style={{ width: 5, height: 5 }} />
                    <span style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 800, color: V.red, letterSpacing: '0.1em' }}>LIVE</span>
                  </span>
                )}
              </div>

              {/* P1 – スコア – P2 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                  <span style={{
                    fontFamily: V.FD, fontSize: 14, fontWeight: 700, display: 'block',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    color: isDone ? (m.winner === m.player1 ? V.text : V.dim) : V.text,
                  }}>{m.player1 || 'TBD'}</span>
                </div>
                <div style={{
                  fontFamily: V.FD, fontSize: isDone ? 14 : 11, fontWeight: 900,
                  color: isDone ? V.text : V.dim,
                  minWidth: 38, textAlign: 'center', flexShrink: 0,
                  background: isDone ? V.surface2 : 'transparent',
                  border: isDone ? `1px solid ${V.border}` : 'none',
                  borderRadius: 4, padding: isDone ? '2px 6px' : '0',
                }}>{isDone ? m.score : 'VS'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontFamily: V.FD, fontSize: 14, fontWeight: 700, display: 'block',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    color: isDone ? (m.winner === m.player2 ? V.text : V.dim) : V.text,
                  }}>{m.player2 || 'TBD'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {display.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', fontFamily: V.FD, fontSize: 13, color: V.dim }}>
          該当する試合がありません
        </div>
      )}
    </div>
  )
}
