'use client'

interface StreamEmbedProps {
  platform: 'twitch' | 'youtube' | null
  channel?: string
  parentDomain?: string
}

export default function StreamEmbed({ platform, channel, parentDomain = 'sf6-database.vercel.app' }: StreamEmbedProps) {
  if (!platform || !channel) {
    return (
      <div className="w-full h-full bg-zinc-900 rounded-lg flex items-center justify-center">
        <p className="text-zinc-500 text-lg">No stream available</p>
      </div>
    )
  }

  const src = platform === 'twitch'
    ? `https://player.twitch.tv/?channel=${channel}&parent=${parentDomain}&parent=localhost`
    : `https://www.youtube.com/embed/${channel}?autoplay=1`

  return (
    <iframe
      src={src}
      className="w-full h-full"
      allowFullScreen
      allow="autoplay; encrypted-media"
    />
  )
}
