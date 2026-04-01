'use client'

import { useState } from 'react'

interface Player {
  name: string
  country?: string
  character?: string
}

interface Match {
  player1: string
  player2: string
  score?: string
  winner?: string
  round: string
  date: string
  status: 'upcoming' | 'live' | 'completed'
}

interface Group {
  name: string
  players: Player[]
  matches: Match[]
}

interface Phase {
  name: string
  format: string
  groups: Group[]
}

interface ResultEntry {
  time: string
  group: string
  round: string
  winner: string
  loser: string
  score: string
}

interface TournamentDashboardProps {
  tournamentName: string
  phases: Phase[]
  results: ResultEntry[]
  onMatchClick?: (player1: string, player2: string) => void
  lastUpdated?: string
}

export default function TournamentDashboard({ tournamentName, phases, results, onMatchClick, lastUpdated }: TournamentDashboardProps) {
  const [activePhase, setActivePhase] = useState(0)
  const [activeTab, setActiveTab] = useState<'groups' | 'results'>('groups')
  const [activeGroup, setActiveGroup] = useState(0)

  const phase = phases[activePhase]

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950/80 rounded-lg overflow-hidden">
      {/* Top bar: Tournament name + Phase selector */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 font-bold text-sm">{tournamentName}</span>
            {lastUpdated && (
              <span className="text-zinc-600 text-[9px]">
                Updated: {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
          <span className="text-zinc-600 text-xs">|</span>
          {phases.map((p, i) => (
            <button
              key={i}
              onClick={() => { setActivePhase(i); setActiveGroup(0) }}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                activePhase === i
                  ? 'bg-yellow-400/20 text-yellow-400 font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              activeTab === 'groups'
                ? 'bg-zinc-700 text-white font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Groups
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              activeTab === 'results'
                ? 'bg-zinc-700 text-white font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Results
          </button>
        </div>
      </div>

      {activeTab === 'groups' ? (
        <>
          {/* Group tabs */}
          <div className="flex flex-wrap px-2 pt-1.5 gap-1 border-b border-zinc-800/50 pb-1.5">
            {phase?.groups.map((g, i) => (
              <button
                key={i}
                onClick={() => setActiveGroup(i)}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                  activeGroup === i
                    ? 'bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30'
                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          {/* Group content: GSL bracket */}
          <div className="flex-1 overflow-y-auto p-3">
            {phase?.groups[activeGroup] && (
              phase.format?.includes('Single Elim') ? (
                <SingleElimBracket group={phase.groups[activeGroup]} onMatchClick={onMatchClick} />
              ) : (
                <GSLBracket group={phase.groups[activeGroup]} onMatchClick={onMatchClick} />
              )
            )}
          </div>
        </>
      ) : (
        /* Results feed — built from all phases' completed matches */
        <div className="flex-1 overflow-y-auto p-3">
          <ResultsFeed phases={phases} onMatchClick={onMatchClick} />
        </div>
      )}
    </div>
  )
}



/* Timeline feed of completed matches across all phases */
function ResultsFeed({ phases, onMatchClick }: { phases: Phase[]; onMatchClick?: (p1: string, p2: string) => void }) {
  // Collect all completed matches from all phases and groups
  const completedMatches: { phase: string; group: string; round: string; player1: string; player2: string; score: string; winner: string; maps: any[] }[] = []

  phases.forEach(phase => {
    phase.groups.forEach(group => {
      group.matches.forEach(match => {
        if (match.status === 'completed' && match.winner) {
          completedMatches.push({
            phase: phase.name,
            group: group.name,
            round: match.round,
            player1: match.player1,
            player2: match.player2,
            score: match.score || '',
            winner: match.winner,
            maps: (match as any).maps || [],
          })
        }
      })
    })
  })

  // Sort: Phase 3 first, then Phase 2, then Phase 1 (newest results on top)
  const phaseOrder: Record<string, number> = { 'Phase 3': 0, 'Phase 2': 1, 'Phase 1': 2 }
  completedMatches.sort((a, b) => (phaseOrder[a.phase] ?? 99) - (phaseOrder[b.phase] ?? 99))

  if (completedMatches.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500 text-sm">No results yet</p>
      </div>
    )
  }

  function phaseTagClassName(phase: string): string {
    if (phase === 'Phase 3') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    if (phase === 'Phase 2') return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    return 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30'
  }

  // Group by phase for section headers
  let currentPhase = ''

  return (
    <div className="space-y-1">
      {completedMatches.map((m, i) => {
        const showHeader = m.phase !== currentPhase
        currentPhase = m.phase
        const loser = m.winner === m.player1 ? m.player2 : m.player1
        const isClickable = !!(onMatchClick && m.player1 && m.player2)

        return (
          <div key={i}>
            {showHeader && (
              <div className="flex items-center gap-2 py-2 mt-2 first:mt-0">
                <span className={"text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border " + phaseTagClassName(m.phase)}>
                  {m.phase}
                </span>
                <div className="flex-1 border-t border-zinc-800" />
              </div>
            )}
            <div
              className={"flex items-center gap-2 px-3 py-2 bg-zinc-900/60 rounded border border-zinc-800/50 hover:border-zinc-700/60 transition-colors" + (isClickable ? " cursor-pointer" : "")}
              onClick={() => isClickable && onMatchClick!(m.player1, m.player2)}
            >
              <span className="text-zinc-600 text-[10px] w-20 flex-shrink-0 truncate">{m.group}</span>
              <span className="text-zinc-500 text-[10px] w-28 flex-shrink-0 truncate">{m.round}</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className={"text-xs font-bold truncate " + (m.winner === m.player1 ? "text-green-400" : "text-zinc-400")}>{m.player1}</span>
                <span className="text-yellow-400 text-xs font-bold flex-shrink-0">{m.score}</span>
                <span className={"text-xs font-bold truncate " + (m.winner === m.player2 ? "text-green-400" : "text-zinc-400")}>{m.player2}</span>
              </div>
              <span className="text-[9px] text-zinc-600 flex-shrink-0">W: {m.winner}</span>
            </div>
          </div>
        )
      })}
      <div className="text-center py-4 text-zinc-600 text-[10px]">
        {completedMatches.length} completed matches
      </div>
    </div>
  )
}

/* Single-elimination bracket visualization — full tournament tree with connector lines */
function SingleElimBracket({ group, onMatchClick }: { group: { name: string; players: { name: string }[]; matches: any[] }; onMatchClick?: (p1: string, p2: string) => void }) {
  const matches = group.matches || []
  console.log('[SingleElimBracket] group:', group.name, 'matches:', matches.length, 'rounds:', matches.map((m: any) => m.round))
  // Normalize round names for grouping
  function getRoundKey(round: string): string {
    if (round.startsWith('Round of 16')) return 'Round of 16'
    if (round.startsWith('Quarter Final') || round.startsWith('Quarter-Final')) return 'Quarter-Finals'
    if (round.startsWith('Semi Final') || round.startsWith('Semi-Final')) return 'Semi-Finals'
    if (round.startsWith('Grand Final')) return 'Grand Final'
    return round
  }

  const roundMap: Record<string, any[]> = {}
  for (const m of matches) {
    const key = getRoundKey(m.round || 'Unknown')
    if (!roundMap[key]) roundMap[key] = []
    roundMap[key].push(m)
  }

  const roundOrder = [
    { key: 'Round of 16', label: 'ROUND OF 16', expected: 8 },
    { key: 'Quarter-Finals', label: 'QUARTER-FINALS', expected: 4 },
    { key: 'Semi-Finals', label: 'SEMI-FINALS', expected: 2 },
    { key: 'Grand Final', label: 'GRAND FINAL', expected: 1 },
  ]

  const activeRounds = roundOrder.filter(r => (roundMap[r.key] || []).length > 0 || matches.length > 0)

  const CARD_H = 64
  const BASE_GAP = 12
  const ROUND_COL_W = 200
  const CONNECTOR_W = 40
  const LABEL_H = 32

  const firstRoundCount = activeRounds[0]?.expected || 8
  const totalHeight = firstRoundCount * CARD_H + (firstRoundCount - 1) * BASE_GAP + LABEL_H

  function getCardPositions(roundIndex: number, count: number): number[] {
    if (roundIndex <= 0 || count <= 0) {
      const positions: number[] = []
      const c = Math.max(count, 1)
      for (let i = 0; i < c; i++) {
        positions.push(LABEL_H + i * (CARD_H + BASE_GAP))
      }
      return positions
    }
    const parentCount = Math.min(count * 2, firstRoundCount)
    const parentPositions = getCardPositions(roundIndex - 1, parentCount)
    const positions: number[] = []
    for (let i = 0; i < count; i++) {
      const topIdx = i * 2
      const bottomIdx = i * 2 + 1
      if (topIdx < parentPositions.length && bottomIdx < parentPositions.length) {
        const top = parentPositions[topIdx]
        const bottom = parentPositions[bottomIdx]
        positions.push((top + bottom + CARD_H) / 2 - CARD_H / 2)
      } else if (topIdx < parentPositions.length) {
        positions.push(parentPositions[topIdx])
      } else {
        positions.push(LABEL_H + i * (CARD_H + BASE_GAP))
      }
    }
    return positions
  }

  function cardClassName(isCompleted: boolean, isClickable: boolean): string {
    let cls = 'absolute rounded border transition-colors'
    if (isCompleted) {
      cls += ' border-yellow-500/40 bg-zinc-800/80'
    } else {
      cls += ' border-zinc-700/50 bg-zinc-900/60'
    }
    if (isClickable) {
      cls += ' cursor-pointer hover:border-yellow-500/60'
    }
    return cls
  }

  function playerClassName(isCompleted: boolean, isWinner: boolean): string {
    let cls = 'flex justify-between items-center'
    if (isCompleted && isWinner) {
      cls += ' text-yellow-400 font-bold'
    } else {
      cls += ' text-zinc-300'
    }
    return cls
  }

  function champContainerClassName(champion: string | null): string {
    let cls = 'rounded-lg border-2 px-6 flex items-center justify-center'
    if (champion) {
      cls += ' border-yellow-400 bg-gradient-to-r from-yellow-500/20 via-amber-500/15 to-yellow-500/20 shadow-lg shadow-yellow-500/10'
    } else {
      cls += ' border-zinc-700/50 bg-zinc-900/40'
    }
    return cls
  }

  function champTextClassName(champion: string | null): string {
    let cls = 'font-extrabold'
    if (champion) {
      cls += ' text-yellow-300 text-lg'
    } else {
      cls += ' text-zinc-600 text-sm'
    }
    return cls
  }

  return (
    <div className="relative overflow-x-auto overflow-y-auto" style={{ minHeight: totalHeight + 20 }}>
      <div className="relative flex" style={{ minWidth: activeRounds.length * (ROUND_COL_W + CONNECTOR_W) - CONNECTOR_W }}>
        {activeRounds.map((round, ri) => {
          const roundMatches = roundMap[round.key] || []
          const count = round.expected
          const positions = getCardPositions(ri, count)
          const nextPositions = ri < activeRounds.length - 1 ? getCardPositions(ri + 1, Math.ceil(count / 2)) : []

          return (
            <div key={round.key} className="flex-shrink-0 flex">
              <div className="relative" style={{ width: ROUND_COL_W, height: totalHeight }}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-center py-2">
                  {round.label}
                </div>
                {Array.from({ length: count }).map((_, mi) => {
                  const m = roundMatches[mi]
                  const top = positions[mi]
                  const p1 = m?.player1 || 'TBD'
                  const p2 = m?.player2 || 'TBD'
                  const isCompleted = m?.status === 'completed'
                  const winner = m?.winner || ''
                  const score = m?.score || ''
                  const isClickable = !!(onMatchClick && p1 !== 'TBD' && p2 !== 'TBD')

                  return (
                    <div
                      key={mi}
                      className={cardClassName(isCompleted, isClickable)}
                      style={{ top, left: 8, right: 8, height: CARD_H }}
                      onClick={() => isClickable && onMatchClick!(p1, p2)}
                    >
                      <div className="h-full flex flex-col justify-center px-2 text-xs">
                        <div className={playerClassName(isCompleted, winner === p1)}>
                          <span className="truncate">{p1}</span>
                          {isCompleted && <span className="text-[10px] ml-1">{score.split('-')[0]}</span>}
                        </div>
                        <div className="border-t border-zinc-700/30 my-0.5" />
                        <div className={playerClassName(isCompleted, winner === p2)}>
                          <span className="truncate">{p2}</span>
                          {isCompleted && <span className="text-[10px] ml-1">{score.split('-')[1]}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {ri < activeRounds.length - 1 && (
                <svg className="flex-shrink-0" width={CONNECTOR_W} height={totalHeight} style={{ overflow: 'visible' }}>
                  {Array.from({ length: count }).map((_, mi) => {
                    const y = positions[mi] + CARD_H / 2
                    const nextIdx = Math.floor(mi / 2)
                    const nextY = nextPositions[nextIdx] ? nextPositions[nextIdx] + CARD_H / 2 : y
                    const midX = CONNECTOR_W / 2

                    return (
                      <g key={mi}>
                        <line x1={0} y1={y} x2={midX} y2={y} stroke="#52525b" strokeWidth={1} />
                        <line x1={midX} y1={y} x2={midX} y2={nextY} stroke="#52525b" strokeWidth={1} />
                        {mi % 2 === 0 && (
                          <line x1={midX} y1={nextY} x2={CONNECTOR_W} y2={nextY} stroke="#52525b" strokeWidth={1} />
                        )}
                      </g>
                    )
                  })}
                </svg>
              )}
            </div>
          )
        })}

        {(() => {
          const gf = roundMap['Grand Final']?.[0]
          const champion = gf?.status === 'completed' ? gf.winner : null
          const lastRoundIdx = activeRounds.length - 1
          const lastPositions = getCardPositions(lastRoundIdx, 1)
          const champTop = lastPositions[0] || totalHeight / 2 - 32

          return (
            <div className="flex-shrink-0 flex items-start" style={{ paddingTop: champTop }}>
              <svg className="flex-shrink-0" width={CONNECTOR_W} height={CARD_H} style={{ overflow: 'visible' }}>
                <line x1={0} y1={CARD_H / 2} x2={CONNECTOR_W} y2={CARD_H / 2} stroke={champion ? '#eab308' : '#52525b'} strokeWidth={champion ? 2 : 1} />
              </svg>
              <div className={champContainerClassName(champion)} style={{ height: CARD_H, minWidth: 120 }}>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-widest text-yellow-500/70 mb-1">{"\u{1F3C6}"} Champion</div>
                  <div className={champTextClassName(champion)}>
                    {champion || 'TBD'}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

function BracketPlayerRow({ name, score, isWinner, isLoser, hasBorder }: {
  name: string; score: string; isWinner: boolean; isLoser: boolean; hasBorder: boolean
}) {
  const isTBD = !name || name === 'TBD'
  return (
    <div className={`flex items-center justify-between px-2 py-1 ${
      hasBorder ? 'border-b border-zinc-800/40' : ''
    } ${isWinner ? 'bg-green-500/8' : ''}`}>
      <span className={`text-[11px] font-bold truncate ${
        isTBD ? 'text-zinc-700 italic' :
        isWinner ? 'text-green-400' :
        isLoser ? 'text-red-400/40' :
        'text-white'
      }`} style={{ fontSize: '10px' }}>
        {isTBD ? 'TBD' : name}
      </span>
      {score && (
        <span className={`text-[10px] font-bold ml-1 flex-shrink-0 ${
          isWinner ? 'text-green-400' : 'text-zinc-600'
        }`}>
          {score}
        </span>
      )}
    </div>
  )
}

/* GSL-style double elimination bracket visualization */
function GSLBracket({ group, onMatchClick }: { group: Group; onMatchClick?: (p1: string, p2: string) => void }) {
  const players = group.players
  const matches = group.matches

  // GSL bracket: Opening Match 1, Opening Match 2, Winners Match, Elimination Match, Decider Match
  const opening1 = matches.find(m => m.round === 'Opening Match 1')
  const opening2 = matches.find(m => m.round === 'Opening Match 2')
  const winnersMatch = matches.find(m => m.round === 'Winners Match')
  const eliminationMatch = matches.find(m => m.round === 'Elimination Match')
  const deciderMatch = matches.find(m => m.round === 'Decider Match')

  const allMatches = [
    { label: 'Opening Match 1', match: opening1 || matches[0] },
    { label: 'Opening Match 2', match: opening2 || matches[1] },
    { label: 'Winners Match', match: winnersMatch || matches[2] },
    { label: 'Elimination Match', match: eliminationMatch || matches[3] },
    { label: 'Decider Match', match: deciderMatch || matches[4] },
  ]

  return (
    <div className="space-y-3">
      {/* Players with advancement status */}
      <div className="flex gap-2 mb-3">
        {players.map((p, i) => {
          // Check if this is a round-robin group (Phase 2 style)
          const isRoundRobin = matches.some(m => m.round?.includes('Round Robin'))
          
          // For round-robin: calculate wins per player
          let rrWins: Record<string, number> = {}
          let rrAllDone = false
          if (isRoundRobin) {
            const completedRR = matches.filter(m => m.status === 'completed')
            rrAllDone = completedRR.length === matches.length && matches.length > 0
            completedRR.forEach(m => {
              if (m.winner) rrWins[m.winner] = (rrWins[m.winner] || 0) + 1
            })
          }

          // Determine player status from match results
          const winnersWinner = winnersMatch?.status === 'completed' ? winnersMatch.winner : null
          const deciderWinner = deciderMatch?.status === 'completed' ? deciderMatch.winner : null
          const eliminationLoser = eliminationMatch?.status === 'completed'
            ? (eliminationMatch.winner === eliminationMatch.player1 ? eliminationMatch.player2 : eliminationMatch.player1)
            : null
          const deciderLoser = deciderMatch?.status === 'completed'
            ? (deciderMatch.winner === deciderMatch.player1 ? deciderMatch.player2 : deciderMatch.player1)
            : null

          let status = ''
          let statusClass = ''
          let borderClass = 'border-zinc-800/50'
          
          if (isRoundRobin && rrAllDone) {
            // Round-robin: most wins = advances to Phase 3, rest eliminated
            const sortedPlayers = Object.entries(rrWins).sort((a, b) => b[1] - a[1])
            const topPlayer = sortedPlayers[0]?.[0]
            const myWins = rrWins[p.name] || 0
            if (p.name === topPlayer) {
              status = '1st'
              statusClass = 'bg-green-500/30 text-green-300 border-green-400/50 font-extrabold'
              borderClass = 'border-green-400/60 bg-green-500/5'
            } else {
              status = 'Out'
              statusClass = 'bg-red-500/10 text-red-400/60 border-red-500/20'
              borderClass = 'border-red-500/30'
            }
          } else if (!isRoundRobin) {
            // GSL bracket logic
            if (winnersWinner && p.name === winnersWinner) {
              status = '1st'
              statusClass = 'bg-green-500/30 text-green-300 border-green-400/50 font-extrabold'
              borderClass = 'border-green-400/60 bg-green-500/5'
            } else if (deciderWinner && p.name === deciderWinner) {
              status = '2nd'
              statusClass = 'bg-orange-500/20 text-orange-400 border-orange-500/30'
              borderClass = 'border-orange-500/40'
            } else if (eliminationLoser && p.name === eliminationLoser) {
              status = 'Out'
              statusClass = 'bg-red-500/10 text-red-400/60 border-red-500/20'
              borderClass = 'border-red-500/30'
            } else if (deciderLoser && p.name === deciderLoser) {
              status = 'Out'
              statusClass = 'bg-red-500/10 text-red-400/60 border-red-500/20'
              borderClass = 'border-red-500/30'
            }
          }

          return (
            <div key={i} className={"flex-1 bg-zinc-900/60 rounded px-2 py-1.5 border text-center relative " + borderClass}>
              <span className={"text-xs font-bold " + (status === 'Out' ? 'text-zinc-600 line-through' : 'text-white')}>{p.name}</span>
              {p.country && <span className="text-zinc-500 text-[10px] ml-1">{p.country}</span>}
              {status && (
                <span className={"ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded border " + statusClass}>
                  {status === '1st' ? (isRoundRobin ? '\u2605 1st \u2192 Phase 3 (' + (rrWins[p.name] || 0) + 'W)' : '\u2605 1st \u2192 Phase 3') : status === '2nd' ? '2nd \u2192 Phase 2' : 'Eliminated'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Matches */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {/* Left column: Opening matches */}
        <div className="space-y-2">
          {allMatches.slice(0, 2).map(({ label, match }, i) => (
            <MatchCard key={i} label={label} match={match} onMatchClick={onMatchClick} />
          ))}
        </div>
        {/* Right column: Winners → Elimination → Decider */}
        <div className="space-y-2">
          {allMatches.slice(2).map(({ label, match }, i) => (
            <MatchCard key={i} label={label} match={match} onMatchClick={onMatchClick} />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-2 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500/60" /> Advances (Phase 3)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500/60" /> Advances (Phase 2)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500/60" /> Eliminated
        </span>
      </div>
    </div>
  )
}

function MatchCard({ label, match, onMatchClick }: { label: string; match?: Match; onMatchClick?: (p1: string, p2: string) => void }) {
  if (!match) return null

  const statusColor = match.status === 'live' ? 'border-red-500/50 bg-red-500/5' :
                      match.status === 'completed' ? 'border-zinc-700 bg-zinc-900/40' :
                      'border-zinc-800 bg-zinc-900/60'

  const isLive = match.status === 'live'

  return (
    <div
      className={`rounded border px-2.5 py-1.5 ${statusColor} ${onMatchClick && match.player1 !== 'TBD' && match.player2 !== 'TBD' ? 'cursor-pointer hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-colors' : ''}`}
      onClick={() => {
        if (onMatchClick && match && match.player1 !== 'TBD' && match.player2 !== 'TBD') {
          onMatchClick(match.player1, match.player2)
        }
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</span>
        {isLive && (
          <span className="text-[9px] text-red-400 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
        )}
        {match.status === 'upcoming' && (
          <span className="text-[9px] text-zinc-600">{match.date}</span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold ${match.winner === match.player1 ? 'text-green-400' : match.status === 'completed' ? 'text-red-400/60' : 'text-white'}`}>
          {match.player1 || 'TBD'}
        </span>
        {match.score ? (
          <span className="text-yellow-400 text-xs font-bold mx-2">{match.score}</span>
        ) : (
          <span className="text-zinc-600 text-xs mx-2">vs</span>
        )}
        <span className={`text-xs font-bold ${match.winner === match.player2 ? 'text-green-400' : match.status === 'completed' ? 'text-red-400/60' : 'text-white'}`}>
          {match.player2 || 'TBD'}
        </span>
      </div>
    </div>
  )
}
