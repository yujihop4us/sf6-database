'use client'

interface ChatEmbedProps {
  platform: 'twitch' | 'youtube' | null
  channel?: string
  parentDomain?: string
}

export default function ChatEmbed({ platform, channel, parentDomain = 'sf6-database.vercel.app' }: ChatEmbedProps) {
  if (!platform || !channel) {
    return (
      <div className="h-full bg-zinc-900 rounded-lg flex items-center justify-center">
        <p className="text-zinc-500 text-sm">No chat available</p>
      </div>
    )
  }

  const src = platform === 'twitch'
    ? `https://www.twitch.tv/embed/${channel}/chat?parent=${parentDomain}&parent=localhost&darkpopout`
    : `https://www.youtube.com/live_chat?v=${channel}&embed_domain=${parentDomain}`

  return (
    <iframe
      src={src}
      className="w-full h-full rounded-lg"
    />
  )
}
