'use client'

import { useState, useEffect, useRef } from 'react'
import type { PoolsData, ToastEvent } from '@/components/live/PoolsDashboard'

export interface UsePoolsDashboardReturn {
  poolsData:             PoolsData | null
  displayMode:           'h2h' | 'pools'
  setDisplayMode:        (mode: 'h2h' | 'pools') => void
  displayModeManual:     boolean
  setDisplayModeManual:  (manual: boolean) => void
  streamToast:           ToastEvent | null
  setStreamToast:        (toast: ToastEvent | null) => void
  streamToastTimer:      React.MutableRefObject<ReturnType<typeof setTimeout> | null>
}

export function usePoolsDashboard(dbTournamentId: number | undefined): UsePoolsDashboardReturn {
  const [poolsData,            setPoolsData]           = useState<PoolsData | null>(null)
  const [displayMode,          setDisplayMode]          = useState<'h2h' | 'pools'>('h2h')
  const [displayModeManual,    setDisplayModeManual]    = useState(false)
  const [streamToast,          setStreamToast]          = useState<ToastEvent | null>(null)
  const streamToastTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ref 経由で最新値を参照 — deps に含めると手動切替ごとにインターバルがリセットされる
  const displayModeManualRef = useRef(displayModeManual)
  useEffect(() => { displayModeManualRef.current = displayModeManual }, [displayModeManual])

  useEffect(() => {
    if (!dbTournamentId) return
    const url = '/api/pools-dashboard?tournamentId=' + dbTournamentId

    const fetchData = async () => {
      console.log('[POOLS] fetching...', new Date().toISOString())
      try {
        const res  = await fetch(url)
        const data = await res.json()
        if (!data.error) {
          const feedCount      = data.feed?.length ?? 0
          const qualifiedCount = data.qualified?.length ?? 0
          const newestTs       = data.feed?.[0]?.timestamp
          const newestHuman    = newestTs
            ? new Date(newestTs * 1000).toISOString().slice(11, 19)
            : 'none'
          console.log('[POOLS] response:', {
            feedCount, qualifiedCount,
            phase: data.currentPhase,
            newestEvent: newestHuman,
            setsAnalyzed: data.setsAnalyzed,
            cached: data.cached,
          })
          console.log('[POOLS] setState', feedCount, qualifiedCount)
          setPoolsData(data)

          // 手動切替していない場合のみ自動判定
          if (!displayModeManualRef.current) {
            const phase = (data.currentPhase ?? '').toLowerCase()
            const isPoolsPhase = phase.includes('winners') || phase.includes('losers') || phase.includes('round')
            setDisplayMode(isPoolsPhase ? 'pools' : 'h2h')
          }
        } else {
          console.warn('[POOLS] API error:', data.error)
        }
      } catch (e) {
        console.error('[POOLS] fetch failed:', e)
      }
    }

    fetchData()
    const id = setInterval(fetchData, 15000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbTournamentId])

  return {
    poolsData,
    displayMode,    setDisplayMode,
    displayModeManual, setDisplayModeManual,
    streamToast,    setStreamToast,
    streamToastTimer,
  }
}
