'use client'

interface UpNextMatch {
  round_text: string
  player1_handle: string
  player2_handle: string
  status: 'live' | 'upcoming' | 'completed'
}

interface BracketUpNextProps {
  matches: UpNextMatch[]
  tournamentName: string
}

export default function BracketUpNext({ matches, tournamentName }: BracketUpNextProps) {
  return (
    <div className="h-full bg-zinc-900/80 rounded-lg p-4 overflow-y-auto">
      <h3 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
        {tournamentName}
      </h3>

      <div className="space-y-2">
        {matches.map((match, i) => (
          <div
            key={i}
            className={`flex items-center justify-between px-3 py-2 rounded text-sm ${
              match.status === 'live'
                ? 'bg-red-500/10 border border-red-500/30'
                : match.status === 'upcoming'
                ? 'bg-zinc-800/50'
                : 'bg-zinc-800/30 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2">
              {match.status === 'live' && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              <span className="text-zinc-400 text-xs">{match.round_text}</span>
            </div>
            <span className="text-white font-medium text-xs">
              {match.player1_handle} vs {match.player2_handle}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
