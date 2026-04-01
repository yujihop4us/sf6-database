'use client'

interface Player {
  id: number
  handle: string
  country_code?: string
  main_character?: string
  team?: string
  total_sf6_earnings_usd?: number
  profile_image_url?: string
}

interface PlayerCardProps {
  player: Player | null
  side: 'p1' | 'p2'
}

const countryFlag = (code?: string) => {
  if (!code) return ''
  return code
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('')
}

export default function PlayerCard({ player, side }: PlayerCardProps) {
  if (!player) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-zinc-600 text-sm">Select player</p>
      </div>
    )
  }

  const accentColor = side === 'p1' ? 'border-blue-500' : 'border-orange-500'
  const accentBg = side === 'p1' ? 'bg-blue-500/10' : 'bg-orange-500/10'
  const accentText = side === 'p1' ? 'text-blue-400' : 'text-orange-400'
  const align = side === 'p1' ? 'text-left' : 'text-right'
  const flexDir = side === 'p1' ? 'items-start' : 'items-end'

  return (
    <div className={`h-full flex flex-col ${flexDir} justify-start p-4 gap-3 border-t-2 ${accentColor} ${accentBg}`}>
      {/* Player image placeholder */}
      <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center overflow-hidden">
        {player.profile_image_url ? (
          <img src={player.profile_image_url} alt={player.handle} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl font-bold text-zinc-500">
            {player.handle.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Handle */}
      <h2 className={`text-xl font-bold text-white ${align}`}>
        {player.handle}
      </h2>

      {/* Team */}
      {player.team && (
        <p className={`text-xs text-zinc-400 ${align}`}>{player.team}</p>
      )}

      {/* Country */}
      {player.country_code && (
        <p className={`text-sm ${align}`}>
          {countryFlag(player.country_code)}{' '}
          <span className="text-zinc-400">{player.country_code}</span>
        </p>
      )}

      {/* Main character */}
      {player.main_character && (
        <div className={`${align}`}>
          <span className="text-xs text-zinc-500 uppercase tracking-wide">Main</span>
          <p className={`text-sm font-semibold ${accentText}`}>{player.main_character}</p>
        </div>
      )}

      {/* Earnings */}
      {player.total_sf6_earnings_usd && (
        <div className={`${align}`}>
          <span className="text-xs text-zinc-500 uppercase tracking-wide">Earnings</span>
          <p className="text-sm font-bold text-yellow-400">
            ${Number(player.total_sf6_earnings_usd).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}
