import { NextResponse } from 'next/server'

const STARTGG_API = 'https://api.start.gg/gql/alpha'
const CACHE_TTL = 60 * 1000

let cachedData: any = null
let lastFetch = 0

const QUERY = `
query EventSets($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    id
    name
    state
    numEntrants
    phases {
      id
      name
      state
      groupCount
      bracketType
    }
    sets(page: $page, perPage: $perPage, sortType: RECENT) {
      pageInfo {
        totalPages
        total
      }
      nodes {
        id
        fullRoundText
        state
        phaseGroup {
          id
          displayIdentifier
          phase {
            name
          }
        }
        slots {
          entrant {
            name
          }
          standing {
            stats {
              score {
                value
              }
            }
          }
        }
      }
    }
  }
}
`

async function fetchFromStartGG(eventId: number) {
  const token = process.env.STARTGG_API_TOKEN
  if (!token) {
    throw new Error('STARTGG_API_TOKEN not set')
  }

  const allSets: any[] = []
  let eventMeta: any = null
  let totalPages = 1

  for (let page = 1; page <= Math.min(totalPages, 5); page++) {
    const res = await fetch(STARTGG_API, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { eventId: eventId, page: page, perPage: 50 },
      }),
      cache: 'no-store',
    })

    const text = await res.text()
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error('Invalid JSON from start.gg: ' + text.substring(0, 200))
    }

    if (data.errors) {
      throw new Error('GraphQL error: ' + JSON.stringify(data.errors))
    }

    const event = data?.data?.event
    if (!event) {
      throw new Error('Event not found')
    }

    if (page === 1) {
      eventMeta = {
        id: event.id,
        name: event.name,
        state: event.state,
        numEntrants: event.numEntrants,
        phases: event.phases || [],
      }
      totalPages = event?.sets?.pageInfo?.totalPages || 0
    }

    const sets = event?.sets?.nodes || []
    allSets.push(...sets)

    if (totalPages === 0) break
  }

  const matches = allSets.map((set: any) => {
    const p1 = set.slots?.[0]?.entrant?.name || 'TBD'
    const p2 = set.slots?.[1]?.entrant?.name || 'TBD'
    const s1 = set.slots?.[0]?.standing?.stats?.score?.value ?? -1
    const s2 = set.slots?.[1]?.standing?.stats?.score?.value ?? -1

    let status: string = 'upcoming'
    if (set.state === 3) status = 'completed'
    else if (set.state === 2) status = 'live'

    const score = s1 >= 0 && s2 >= 0 ? s1 + '-' + s2 : ''
    const winner = status === 'completed' ? (s1 > s2 ? p1 : p2) : ''

    const phaseName = set.phaseGroup?.phase?.name || 'Unknown'
    const poolId = set.phaseGroup?.displayIdentifier || ''

    return {
      group: phaseName + (poolId ? ' - ' + poolId : ''),
      round: set.fullRoundText || 'Unknown',
      player1: p1,
      player2: p2,
      score,
      winner,
      status,
      maps: [],
    }
  })

  return {
    event: eventMeta,
    matches,
    lastUpdated: new Date().toISOString(),
    source: 'start.gg',
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = parseInt(searchParams.get('eventId') || '1554815')
  const forceFresh = searchParams.get('fresh') === '1'
  const now = Date.now()

  if (!forceFresh && cachedData && (now - lastFetch) < CACHE_TTL) {
    return NextResponse.json({ ...cachedData, cached: true })
  }

  try {
    const data = await fetchFromStartGG(eventId)
    cachedData = data
    lastFetch = now
    return NextResponse.json({ ...data, cached: false })
  } catch (error: any) {
    console.error('[start.gg] Error:', error.message)
    if (cachedData) {
      return NextResponse.json({ ...cachedData, cached: true, error: error.message })
    }
    return NextResponse.json({ error: error.message, matches: [], event: null }, { status: 500 })
  }
}
