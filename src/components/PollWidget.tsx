'use client'

import { useState } from 'react'

interface PollWidgetProps {
  player1Handle: string
  player2Handle: string
  player1Id: number | null
  player2Id: number | null
}

export default function PollWidget({ player1Handle, player2Handle, player1Id, player2Id }: PollWidgetProps) {
  const [voted, setVoted] = useState<number | null>(null)
  const [p1Votes, setP1Votes] = useState(0)
  const [p2Votes, setP2Votes] = useState(0)

  if (!player1Id || !player2Id) {
    return (
      <div className="h-full bg-zinc-900/80 rounded-lg flex items-center justify-center">
        <p className="text-zinc-600 text-xs">Poll available when players selected</p>
      </div>
    )
  }

  const total = p1Votes + p2Votes
  const p1Pct = total > 0 ? Math.round((p1Votes / total) * 100) : 50
  const p2Pct = total > 0 ? 100 - p1Pct : 50

  const handleVote = (playerId: number) => {
    if (voted) return
    setVoted(playerId)
    if (playerId === player1Id) setP1Votes(v => v + 1)
    else setP2Votes(v => v + 1)
  }

  return (
    <div className="h-full bg-zinc-900/80 rounded-lg p-3 flex flex-col justify-center">
      <h3 className="text-center text-lg uppercase tracking-widest text-yellow-400 font-bold mb-2">
        Who wins?
      </h3>

      {!voted ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleVote(player1Id)}
            className="w-full py-2 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-400 font-bold text-sm hover:bg-blue-500/30 transition-colors"
          >
            {player1Handle}
          </button>
          <button
            onClick={() => handleVote(player2Id)}
            className="w-full py-2 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-400 font-bold text-sm hover:bg-orange-500/30 transition-colors"
          >
            {player2Handle}
          </button>
        </div>
      ) : (
        <div>
          <div className="flex w-full h-6 rounded-full overflow-hidden bg-zinc-800 mb-2">
            <div
              className="bg-blue-500 flex items-center justify-center text-[10px] font-bold transition-all duration-700"
              style={{ width: `${p1Pct}%` }}
            >
              {p1Pct}%
            </div>
            <div
              className="bg-orange-500 flex items-center justify-center text-[10px] font-bold transition-all duration-700"
              style={{ width: `${p2Pct}%` }}
            >
              {p2Pct}%
            </div>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-blue-400">{player1Handle}</span>
            <span className="text-zinc-500">{total} votes</span>
            <span className="text-orange-400">{player2Handle}</span>
          </div>
        </div>
      )}
    </div>
  )
}
