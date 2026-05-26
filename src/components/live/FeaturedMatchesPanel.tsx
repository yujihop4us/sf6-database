'use client'

import { V } from './tokens'
import { CharPill } from './CharPill'
import { codeToFlag } from './tokens'

// ── shortenRound — ラウンド名を短縮表示 ──────────────────────────────────────
// "Round 1 - B113 — Winners Quarter-Final" → "WQF"
// "Round 1 - B133 — Losers Round 1"        → "LR1"

export function shortenRound(roundText: string): string {
  // " — " で分割してラウンド部分のみ取り出す
  const parts = roundText.split(' — ')
  const round = (parts.length > 1 ? parts[parts.length - 1] : roundText).trim()

  const ABBREV: Record<string, string> = {
    'Grand Final Reset':   'GFR',
    'Grand Final':         'GF',
    'Winners Final':       'WF',
    'Winners Semi-Final':  'WSF',
    'Winners Quarter-Final': 'WQF',
    'Losers Final':        'LF',
    'Losers Semi-Final':   'LSF',
    'Losers Quarter-Final': 'LQF',
  }
  if (ABBREV[round]) return ABBREV[round]

  const wr = round.match(/^Winners Round (\d+)$/)
  if (wr) return `WR${wr[1]}`

  const lr = round.match(/^Losers Round (\d+)$/)
  if (lr) return `LR${lr[1]}`

  const r = round.match(/^Round (\d+)$/)
  if (r) return `R${r[1]}`

  // それ以外は先頭 12 文字で打ち切り
  return round.length > 12 ? round.slice(0, 12) + '…' : round
}

export function FeaturedMatchesPanel({
  matches,
  mode,
  onMatchClick,
}: {
  matches: any[]
  mode: 'live' | 'latest' | 'recent'
  onMatchClick: (p1: string, p2: string) => void
}) {
  // 上位 10 件をそのまま表示（2列×5行グリッド）
  const display = matches.slice(0, 10)

  return (
    <div style={{
      background: V.surface, border: `1px solid ${V.border}`, borderRadius: 10,
      overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      {/* ヘッダー */}
      <div style={{
        background: V.surface2, borderBottom: `1px solid ${V.border}`,
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontFamily: V.FD, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: mode === 'latest' ? V.gold : V.accent }}>
          {mode === 'live' ? '🔥 Featured Matches' : mode === 'latest' ? '⚡ Latest Results' : '📋 Recent Matches'}
        </div>
        {display.length > 0 && (
          <div style={{ fontFamily: V.FD, fontSize: 11, color: V.dim }}>
            H2H を確認
          </div>
        )}
      </div>

      {/* 2列カードグリッド: overflow-y でスクロール可 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' as const, padding: '10px 10px 8px' }}>
      {display.length === 0 ? (
        <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: V.surface2, border: `1px solid ${V.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: V.FD, fontSize: 20, color: V.dim,
          }}>🔥</div>
          <div style={{ fontFamily: V.FD, fontSize: 12, color: V.dim, textAlign: 'center', lineHeight: 1.5 }}>
            試合情報なし<br/>
            <span style={{ fontSize: 11, color: `${V.dim}99` }}>大会開始後に更新されます</span>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        }}>
          {display.map((m, i) => {
            const canClick = m.player1_handle !== 'TBD' && m.player2_handle !== 'TBD'
            const isLive   = m.status === 'live'
            return (
              <div key={i}
                onClick={() => canClick && onMatchClick(m.player1_handle, m.player2_handle)}
                style={{
                  background: isLive ? `rgba(16,185,129,0.07)` : V.surface2,
                  border: `1px solid ${isLive ? V.border2 : V.border}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  cursor: canClick ? 'pointer' : 'default',
                  transition: 'background 0.12s, border-color 0.12s',
                  minWidth: 0,
                }}
                onMouseEnter={e => { if (canClick) {
                  (e.currentTarget as HTMLElement).style.background = V.surface3
                  ;(e.currentTarget as HTMLElement).style.borderColor = `rgba(16,185,129,0.4)`
                }}}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = isLive ? `rgba(16,185,129,0.07)` : V.surface2
                  ;(e.currentTarget as HTMLElement).style.borderColor = isLive ? V.border2 : V.border
                }}
              >
                {/* 上段: ラウンド + スコア */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    {isLive && <span className="sf6live-dot" style={{ width: 5, height: 5, flexShrink: 0 }} />}
                    <span style={{
                      fontFamily: V.FD, fontSize: 13, fontWeight: 700,
                      letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                      color: isLive ? V.accent : V.dim,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    }}>{shortenRound(m.round_text || '')}</span>
                  </div>
                  {m.score && (
                    <span style={{
                      fontFamily: V.FD, fontSize: 14, fontWeight: 700,
                      color: V.muted, flexShrink: 0, letterSpacing: '0.04em',
                    }}>{(m.score as string).replace('-', ' - ')}</span>
                  )}
                </div>
                {/* 下段: P1 vs P2 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <span style={{
                    flex: 1, minWidth: 0,
                    fontFamily: V.FD, fontSize: 14,
                    fontWeight: m.winner_is_p1 === true ? 900 : 600,
                    color: m.winner_is_p1 === true  ? V.accent
                         : m.winner_is_p1 === false ? V.dim
                         : V.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    textAlign: 'right' as const,
                  }}>{m.player1_handle}</span>
                  <span style={{
                    fontFamily: V.FD, fontSize: 12, fontWeight: 700, color: V.dim,
                    flexShrink: 0,
                  }}>vs</span>
                  <span style={{
                    flex: 1, minWidth: 0,
                    fontFamily: V.FD, fontSize: 14,
                    fontWeight: m.winner_is_p1 === false ? 900 : 600,
                    color: m.winner_is_p1 === false ? V.accent
                         : m.winner_is_p1 === true  ? V.dim
                         : V.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    textAlign: 'left' as const,
                  }}>{m.player2_handle}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>{/* /カードグリッド */}
    </div>
  )
}

// ── NextMatchesPanel ──────────────────────────────────────────────────────────

export function NextMatchesPanel({ matches }: { matches: any[] }) {
  return (
    <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* ヘッダー */}
      <div style={{
        background: V.surface2, borderBottom: `1px solid ${V.border}`,
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontFamily: V.FD, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: V.accent }}>
          次の試合
        </div>
        {matches.length > 0 && (
          <div style={{ fontFamily: V.FD, fontSize: 11, color: V.dim }}>
            {matches.length}試合
          </div>
        )}
      </div>

      {matches.length === 0 ? (
        /* データなし */
        <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: V.surface2, border: `1px solid ${V.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: V.FD, fontSize: 20, color: V.dim,
          }}>⏱</div>
          <div style={{ fontFamily: V.FD, fontSize: 12, color: V.dim, textAlign: 'center', lineHeight: 1.5 }}>
            試合情報なし<br />
            <span style={{ fontSize: 11, color: `${V.dim}99` }}>大会開始後に更新されます</span>
          </div>
        </div>
      ) : (
        matches.map((m, i) => (
          <div
            key={i}
            className="sf6live-next-row"
            style={{
              padding: '12px 16px',
              borderBottom: i < matches.length - 1 ? `1px solid ${V.border}` : 'none',
              cursor: 'pointer', transition: 'background 0.1s',
            }}
          >
            {/* ラウンド + ステータス */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <div style={{
                fontFamily: V.FD, fontSize: 10, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: V.dim,
              }}>{m.round_text}</div>
              {m.status === 'live' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="sf6live-dot" style={{ width: 5, height: 5 }} />
                  <span style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 800, color: V.red, letterSpacing: '0.1em' }}>LIVE</span>
                </div>
              )}
            </div>

            {/* P1 vs P2 カード */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* P1 */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', minWidth: 0 }}>
                <span style={{ fontFamily: V.FD, fontSize: 14, fontWeight: 700, color: V.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.player1_handle}
                </span>
                {m.player1_char && <CharPill name={m.player1_char} size={10} />}
                {m.player1_country && <span style={{ fontSize: 13 }}>{codeToFlag(m.player1_country)}</span>}
              </div>

              {/* VS */}
              <div style={{
                fontFamily: V.FD, fontSize: 11, fontWeight: 900,
                color: V.dim, letterSpacing: '0.06em', flexShrink: 0,
                padding: '2px 8px', background: V.surface2,
                borderRadius: 4, border: `1px solid ${V.border}`,
              }}>VS</div>

              {/* P2 */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-start', minWidth: 0 }}>
                {m.player2_country && <span style={{ fontSize: 13 }}>{codeToFlag(m.player2_country)}</span>}
                {m.player2_char && <CharPill name={m.player2_char} size={10} />}
                <span style={{ fontFamily: V.FD, fontSize: 14, fontWeight: 700, color: V.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.player2_handle}
                </span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
