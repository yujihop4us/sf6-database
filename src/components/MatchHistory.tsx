'use client'

interface SetData {
  id: number
  tournament_id: number
  round_text: string
  phase_name: string
  winner_id: number
  loser_id: number
  winner_score: number
  loser_score: number
  display_score: string
  tournament_name: string
  tournament_date: string
}

interface MatchHistoryProps {
  player1Id: number | null
  player2Id: number | null
  player1Handle: string
  player2Handle: string
  summary: {
    player1_wins: number
    player2_wins: number
    total_sets: number
  } | null
  sets: SetData[]
}

export default function MatchHistory({ player1Id, player2Id, player1Handle, player2Handle, summary, sets }: MatchHistoryProps) {
  if (!player1Id || !player2Id || !summary) {
    return (
      <div className="w-full bg-zinc-900/80 rounded-lg px-4 py-2 text-center">
        <p className="text-zinc-500 text-sm">Select two players to see head-to-head history</p>
      </div>
    )
  }

  if (summary.total_sets === 0) {
    return (
      <div className="w-full bg-zinc-900/80 rounded-lg px-4 py-2 text-center">
        <p className="text-zinc-400 text-sm">No recorded matches between {player1Handle} and {player2Handle}</p>
      </div>
    )
  }

  const p1Pct = Math.round((summary.player1_wins / summary.total_sets) * 100)
  const p2Pct = 100 - p1Pct

  // Build ticker items
  const tickerItems = sets.map((set) => {
    const p1Won = set.winner_id === player1Id
    const winnerHandle = p1Won ? player1Handle : player2Handle
    const winnerScore = set.winner_score
    const loserScore = set.loser_score
    const tournamentShort = set.tournament_name
      .replace(' (SF6)', '')
      .replace('Street Fighter 6', 'SF6')
    return `${tournamentShort} ${set.round_text}: ${winnerHandle} ${winnerScore}-${loserScore}`
  })

  // Duplicate for seamless loop
  const tickerText = tickerItems.join('   ●   ')
  const fullTicker = `${tickerText}   ●   ${tickerText}`

  // Animation duration based on content length
  const duration = Math.max(tickerItems.length * 6, 15)

  return (
    <div className="w-full bg-zinc-900/80 rounded-lg px-4 py-2">
      {/* Compact Summary Row — symmetric layout */}
      <div className="flex items-center mb-1.5">
        {/* P1 side — fixed width, right-aligned */}
        <div className="w-40 flex items-center justify-end gap-2 flex-shrink-0">
          <span className="text-blue-400 font-bold text-lg truncate">{player1Handle}</span>
          <span className="text-blue-400 font-bold text-2xl">{summary.player1_wins}</span>
        </div>
        {/* Center bar */}
        <div className="relative flex-1 mx-3">
          <div className="flex w-full h-4 rounded-full overflow-hidden bg-zinc-800">
            <div
              className="bg-blue-500 transition-all duration-500"
              style={{ width: `${p1Pct}%` }}
            />
            <div
              className="bg-orange-500 transition-all duration-500"
              style={{ width: `${p2Pct}%` }}
            />
          </div>
          <span className="absolute inset-0 flex items-center justify-center" style={{ top: '-8px' }}>
            <span className="bg-zinc-900 border border-zinc-600 px-6 py-1 rounded-full text-sm font-bold uppercase tracking-widest text-white shadow-lg">
              Match Record
            </span>
          </span>
        </div>
        {/* P2 side — fixed width, left-aligned */}
        <div className="w-40 flex items-center justify-start gap-2 flex-shrink-0">
          <span className="text-orange-400 font-bold text-2xl">{summary.player2_wins}</span>
          <span className="text-orange-400 font-bold text-lg truncate">{player2Handle}</span>
        </div>
        <span className="text-zinc-500 text-xs ml-1 flex-shrink-0">({summary.total_sets})</span>
      </div>

      {/* Ticker */}
      <div className="overflow-hidden relative">
        <div
          className="whitespace-nowrap inline-block animate-ticker text-xs text-zinc-400"
          style={{
            animationDuration: `${duration}s`,
          }}
        >
          {sets.map((set, i) => {
            const p1Won = set.winner_id === player1Id
            const winnerHandle = p1Won ? player1Handle : player2Handle
            const colorClass = p1Won ? 'text-blue-400' : 'text-orange-400'
            const tournamentShort = set.tournament_name
              .replace(' (SF6)', '')
              .replace('Street Fighter 6', 'SF6')
            return (
              <span key={`a-${set.id}`} className="mr-6">
                <span className="text-zinc-500">{tournamentShort}</span>
                {' '}
                <span className="text-zinc-600">{set.round_text}</span>
                {' '}
                <span className={`font-semibold ${colorClass}`}>
                  {winnerHandle} {set.winner_score}-{set.loser_score}
                </span>
                <span className="text-zinc-700 mx-3">●</span>
              </span>
            )
          })}
          {/* Duplicate for seamless loop */}
          {sets.map((set, i) => {
            const p1Won = set.winner_id === player1Id
            const winnerHandle = p1Won ? player1Handle : player2Handle
            const colorClass = p1Won ? 'text-blue-400' : 'text-orange-400'
            const tournamentShort = set.tournament_name
              .replace(' (SF6)', '')
              .replace('Street Fighter 6', 'SF6')
            return (
              <span key={`b-${set.id}`} className="mr-6">
                <span className="text-zinc-500">{tournamentShort}</span>
                {' '}
                <span className="text-zinc-600">{set.round_text}</span>
                {' '}
                <span className={`font-semibold ${colorClass}`}>
                  {winnerHandle} {set.winner_score}-{set.loser_score}
                </span>
                <span className="text-zinc-700 mx-3">●</span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
