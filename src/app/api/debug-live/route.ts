import { NextResponse } from 'next/server'
import { isTournamentLive } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startDate = '2026-06-05'
  const endDate   = '2026-06-07'
  const nowMs     = Date.now()
  const startMs   = new Date(startDate).getTime()
  const baseEnd   = new Date(endDate + 'T23:59:59Z').getTime()
  const endMs     = baseEnd + 24 * 60 * 60 * 1000

  return NextResponse.json({
    now:            new Date(nowMs).toISOString(),
    start:          new Date(startMs).toISOString(),
    baseEnd:        new Date(baseEnd).toISOString(),
    endPlusBuf:     new Date(endMs).toISOString(),
    nowGteStart:    nowMs >= startMs,
    nowLteEnd:      nowMs <= endMs,
    isLive:         isTournamentLive(startDate, endDate),
  })
}
