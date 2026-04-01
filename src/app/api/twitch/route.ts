import { NextResponse } from 'next/server'

let appAccessToken: string | null = null
let tokenExpiry = 0

async function getAppToken(): Promise<string> {
  const now = Date.now()
  if (appAccessToken && now < tokenExpiry) {
    return appAccessToken
  }

  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Missing Twitch credentials')
  }

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to get Twitch token: ' + res.status)
  }

  const data = await res.json()
  appAccessToken = data.access_token
  tokenExpiry = now + (data.expires_in - 60) * 1000
  return appAccessToken!
}

// Cache stream status for 30 seconds
let streamCache: Record<string, { isLive: boolean; title: string; viewerCount: number; gameName: string; checkedAt: number }> = {}
const STREAM_CACHE_TTL = 30 * 1000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const channel = searchParams.get('channel')

  if (!channel) {
    return NextResponse.json({ error: 'channel parameter required' }, { status: 400 })
  }

  const now = Date.now()
  const cached = streamCache[channel]
  if (cached && (now - cached.checkedAt) < STREAM_CACHE_TTL) {
    return NextResponse.json({ ...cached, cached: true })
  }

  try {
    const token = await getAppToken()
    const clientId = process.env.TWITCH_CLIENT_ID!

    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': clientId,
        },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      throw new Error('Twitch API error: ' + res.status)
    }

    const data = await res.json()
    const stream = data.data?.[0]

    const result = {
      isLive: !!stream,
      title: stream?.title || '',
      viewerCount: stream?.viewer_count || 0,
      gameName: stream?.game_name || '',
      checkedAt: now,
    }

    streamCache[channel] = result
    return NextResponse.json({ ...result, cached: false })
  } catch (error: any) {
    console.error('[Twitch] Error:', error.message)
    if (cached) {
      return NextResponse.json({ ...cached, cached: true, error: error.message })
    }
    return NextResponse.json({ error: error.message, isLive: false }, { status: 500 })
  }
}
