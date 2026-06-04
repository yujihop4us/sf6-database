'use client'

import { V } from './tokens'
import { normalizePlayerName } from '@/lib/normalizePlayerName'
import { shortenRound } from './FeaturedMatchesPanel'

// ── Double-elim: round name → confirmed placement label ──────────────────────
function roundToPlacementLabel(round: string): string | null {
  if (round.includes('Grand Final'))    return '2nd'  // GF loser
  if (round === 'Losers Final')         return '3rd'
  if (round === 'Losers Semi-Final')    return '4th'
  if (round === 'Losers Quarter-Final') return '5th'
  if (round === 'Losers Round 3')       return '7th'
  if (round === 'Losers Round 2')       return '9th'
  if (round === 'Losers Round 1')       return '13th'
  return null
}

function placementStyle(label: string | null): { color: string; bg: string } {
  if (label === '1st') return { color: '#FFD700', bg: 'rgba(255,215,0,0.13)' }
  if (label === '2nd') return { color: '#C0C0C0', bg: 'rgba(192,192,192,0.10)' }
  if (label === '3rd') return { color: '#CD7F32', bg: 'rgba(205,127,50,0.11)' }
  return { color: V.muted, bg: 'transparent' }
}

// Determine which side won: compare raw winner string against raw player handles
function winnerSide(
  winnerRaw: string,
  p1raw: string, p2raw: string,
): 'p1' | 'p2' | null {
  if (!winnerRaw) return null
  // strip team prefix ("FALCONS | Xiaohai" → "Xiaohai")
  const w = winnerRaw.includes(' | ')
    ? winnerRaw.split(' | ').slice(1).join(' | ').trim()
    : winnerRaw.trim()
  const wl = w.toLowerCase()
  if (wl === p1raw.toLowerCase() || wl === normalizePlayerName(p1raw).toLowerCase()) return 'p1'
  if (wl === p2raw.toLowerCase() || wl === normalizePlayerName(p2raw).toLowerCase()) return 'p2'
  return null
}

interface StandingEntry {
  placement: string | null
  player: string
  round: string
  completedAt: number | null
  isChampion?: boolean
}

const PLACEMENT_ORDER: Record<string, number> = {
  '1st': 1, '2nd': 2, '3rd': 3, '4th': 4,
  '5th': 5, '7th': 7, '9th': 9, '13th': 13,
}

// ── Component ────────────────────────────────────────────────────────────────

export function LiveStandings({
  startggMatches,
  upNextMatches,
  onMatchClick,
}: {
  startggMatches: any[]
  upNextMatches:  any[]
  onMatchClick: (
    p1: string, p2: string,
    p1StartggId?: number | null,
    p2StartggId?: number | null,
  ) => void
}) {

  // ── UP NEXT: live or upcoming matches ───────────────────────────────────────
  const upNext = upNextMatches
    .filter(m => m.status === 'upcoming' || m.status === 'live')
    .slice(0, 2)

  // ── STANDINGS: scan completed sets for confirmed placements ─────────────────
  const standings: StandingEntry[] = []
  const seenPlayers = new Set<string>()

  const completedSorted = [...startggMatches]
    .filter(m => m.status === 'completed')
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  for (const m of completedSorted) {
    const round  = (m.round || '').trim()
    const p1raw  = m.player1_handle || m.player1 || ''
    const p2raw  = m.player2_handle || m.player2 || ''
    const p1h    = normalizePlayerName(p1raw)
    const p2h    = normalizePlayerName(p2raw)
    if (!p1h || !p2h || p1h === 'TBD' || p2h === 'TBD') continue

    const isGF     = round.includes('Grand Final')
    const isLosers = round.startsWith('Losers') || isGF
    if (!isLosers) continue

    const ws       = winnerSide(m.winner || '', p1raw, p2raw)
    const winnerH  = ws === 'p1' ? p1h : ws === 'p2' ? p2h : null
    const loserH   = ws === 'p1' ? p2h : ws === 'p2' ? p1h : null

    // GF winner → 1st (confirmed champion)
    if (isGF && winnerH && !seenPlayers.has(winnerH.toLowerCase())) {
      standings.push({
        placement:   '1st',
        player:      winnerH,
        round,
        completedAt: m.completedAt ?? null,
        isChampion:  true,
      })
      seenPlayers.add(winnerH.toLowerCase())
    }

    // Loser → confirmed eliminated at this placement
    if (loserH && !seenPlayers.has(loserH.toLowerCase())) {
      const placement = isGF ? '2nd' : roundToPlacementLabel(round)
      standings.push({
        placement,
        player:      loserH,
        round,
        completedAt: m.completedAt ?? null,
      })
      seenPlayers.add(loserH.toLowerCase())
    }
  }

  // Sort by placement priority
  standings.sort((a, b) => {
    const pa = a.placement ? (PLACEMENT_ORDER[a.placement] ?? 99) : 99
    const pb = b.placement ? (PLACEMENT_ORDER[b.placement] ?? 99) : 99
    return pa - pb
  })

  const hasUpNext    = upNext.length > 0
  const hasStandings = standings.length > 0

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="live-standings" style={{
      background: V.surface, border: `1px solid ${V.border}`, borderRadius: 10,
      overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>

      {/* ヘッダー */}
      <div style={{
        background: V.surface2, borderBottom: `1px solid ${V.border}`,
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: V.FD, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase' as const,
          color: V.accent,
        }}>🏆 STANDINGS</div>
        {hasUpNext && (
          <div style={{
            fontFamily: V.FD, fontSize: 10, color: V.dim,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span className="sf6live-dot" style={{ width: 5, height: 5 }} />
            進行中
          </div>
        )}
      </div>

      {/* スクロール可能コンテンツ */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' as const }}>

        {/* ── UP NEXT ─────────────────────────────────────────────────────── */}
        {hasUpNext && (
          <>
            <div style={{
              padding: '8px 14px 3px',
              fontFamily: V.FD, fontSize: 9, fontWeight: 800,
              letterSpacing: '0.16em', textTransform: 'uppercase' as const,
              color: V.dim,
            }}>⏭ UP NEXT</div>

            {upNext.map((m, i) => {
              const isLive   = m.status === 'live'
              const canClick = m.player1_handle !== 'TBD' && m.player2_handle !== 'TBD'
              const p1       = normalizePlayerName(m.player1_handle || '')
              const p2       = normalizePlayerName(m.player2_handle || '')
              return (
                <div
                  key={i}
                  onClick={() =>
                    canClick && onMatchClick(
                      m.player1_handle, m.player2_handle,
                      m.player1_startggId ?? null,
                      m.player2_startggId ?? null,
                    )
                  }
                  style={{
                    padding: '7px 14px',
                    cursor: canClick ? 'pointer' : 'default',
                    background: isLive ? 'rgba(16,185,129,0.06)' : 'transparent',
                    borderBottom: `1px solid ${V.border}`,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (canClick) (e.currentTarget as HTMLElement).style.background = V.surface2 }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isLive ? 'rgba(16,185,129,0.06)' : 'transparent' }}
                >
                  {/* ラウンド名 */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4,
                  }}>
                    {isLive && <span className="sf6live-dot" style={{ width: 5, height: 5 }} />}
                    <span style={{
                      fontFamily: V.FD, fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                      color: isLive ? V.accent : V.dim,
                    }}>{shortenRound(m.round_text || '')}</span>
                  </div>
                  {/* P1 vs P2 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      flex: 1, textAlign: 'right' as const,
                      fontFamily: V.FD, fontSize: 14, fontWeight: 700,
                      color: V.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    }}>{p1}</span>
                    <span style={{
                      fontFamily: V.FD, fontSize: 10, fontWeight: 700,
                      color: V.dim, flexShrink: 0,
                      padding: '1px 5px', background: V.surface2,
                      borderRadius: 3, border: `1px solid ${V.border}`,
                    }}>VS</span>
                    <span style={{
                      flex: 1, textAlign: 'left' as const,
                      fontFamily: V.FD, fontSize: 14, fontWeight: 700,
                      color: V.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    }}>{p2}</span>
                  </div>
                </div>
              )
            })}

            {/* UP NEXT と STANDINGS の区切り */}
            {hasStandings && (
              <div style={{ height: 4, background: V.surface2 }} />
            )}
          </>
        )}

        {/* ── STANDINGS ───────────────────────────────────────────────────── */}
        {hasStandings ? (
          <>
            <div style={{
              padding: '8px 14px 3px',
              fontFamily: V.FD, fontSize: 9, fontWeight: 800,
              letterSpacing: '0.16em', textTransform: 'uppercase' as const,
              color: V.dim,
            }}>🏅 確定順位</div>

            {standings.map((entry, i) => {
              const { color: pColor, bg: pBg } = placementStyle(entry.placement)
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 14px',
                  background: pBg,
                  borderBottom: i < standings.length - 1 ? `1px solid ${V.border}` : 'none',
                }}>
                  {/* 順位バッジ */}
                  <div style={{
                    width: 36, flexShrink: 0,
                    fontFamily: V.FD, fontSize: 13, fontWeight: 900,
                    letterSpacing: '0.04em', textAlign: 'center' as const,
                    color: pColor,
                  }}>
                    {entry.placement ?? '—'}
                  </div>

                  {/* 選手名 */}
                  <div style={{
                    flex: 1, minWidth: 0,
                    fontFamily: V.FD, fontSize: 14, fontWeight: 700,
                    color: entry.isChampion ? V.accent : V.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                  }}>
                    {entry.isChampion && (
                      <span style={{ marginRight: 4, fontSize: 12 }}>🏆</span>
                    )}
                    {entry.player}
                  </div>

                  {/* ラウンド略称 */}
                  <div style={{
                    flexShrink: 0,
                    fontFamily: V.FD, fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.06em', color: V.dim,
                  }}>
                    {shortenRound(entry.round)}
                  </div>
                </div>
              )
            })}
          </>
        ) : (
          /* データなし (UP NEXT もない場合のみ表示) */
          !hasUpNext && (
            <div style={{
              padding: '32px 16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: V.surface2, border: `1px solid ${V.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, color: V.dim,
              }}>🏆</div>
              <div style={{
                fontFamily: V.FD, fontSize: 12, color: V.dim,
                textAlign: 'center', lineHeight: 1.5,
              }}>
                順位データなし<br/>
                <span style={{ fontSize: 11, color: `${V.dim}99` }}>
                  Top 24 以降に更新されます
                </span>
              </div>
            </div>
          )
        )}

      </div>
    </div>
  )
}
