'use client'

import { useState, useEffect } from 'react'

export type FeaturedMode = 'live' | 'latest' | 'recent'

export interface UseStartggPollingInput {
  startggEventId?: number
  endDate?: string
  phases: any[]
  hasStream: boolean
  searchQuery: string
}

export interface UseStartggPollingReturn {
  startggMatches:  any[]
  cc12Matches:     any[]
  cc12LastUpdated: string
  mergedPhases:    any[]
  upNextMatches:   any[]
  featuredMode:    FeaturedMode
}

export function useStartggPolling({
  startggEventId,
  endDate,
  phases,
  hasStream,
  searchQuery,
}: UseStartggPollingInput): UseStartggPollingReturn {
  const [startggMatches,  setStartggMatches]  = useState<any[]>([])
  const [cc12Matches,     setCc12Matches]     = useState<any[]>([])
  const [cc12LastUpdated, setCc12LastUpdated] = useState('')
  // live セット検出時は 10s、通常は 15s ポーリング
  const [pollInterval, setPollInterval] = useState(15_000)

  // ── CC12 Liquipedia ポーリング (60秒) ────────────────────────────────────
  useEffect(() => {
    if (hasStream) return
    const fetchCC12 = async () => {
      try {
        const res  = await fetch('/api/cc12/results?fresh=1')
        const data = await res.json()
        if (data.matches) {
          setCc12Matches(data.matches)
          setCc12LastUpdated(data.lastUpdated || '')
        }
      } catch (e) { console.error('[CC12]', e) }
    }
    fetchCC12()
    const id = setInterval(fetchCC12, 60000)
    return () => clearInterval(id)
  }, [hasStream])

  // ── start.gg ポーリング (live セット検出時 10s / 通常 15s) ─────────────
  useEffect(() => {
    if (!startggEventId) return
    const ended = endDate && new Date() > new Date(endDate + 'T23:59:59')
    const fetchStartgg = async () => {
      try {
        const res  = await fetch('/api/startgg?eventId=' + startggEventId + '&fresh=1')
        const data = await res.json()
        if (data.matches) {
          setStartggMatches(data.matches)
          // live セットがある場合はポーリングを 10s に短縮
          const hasLive = data.matches.some((m: any) => m.status === 'live')
          setPollInterval(hasLive ? 10_000 : 15_000)
        }
        if (data.lastUpdated) setCc12LastUpdated(data.lastUpdated)
      } catch (e) { console.error('[startgg]', e) }
    }
    fetchStartgg()
    if (!ended) {
      const id = setInterval(fetchStartgg, pollInterval)
      return () => clearInterval(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startggEventId, hasStream, searchQuery, pollInterval])

  // ── mergedPhases ──────────────────────────────────────────────────────────
  // フェーズ名が一致しない場合のフォールバック判定
  const startggMatchesAssigned = (() => {
    if (!startggEventId || startggMatches.length === 0 || phases.length === 0) return false
    const anyMatch = phases.some((ph: any) =>
      startggMatches.some((m: any) =>
        (m.group || '').startsWith(ph.name) || (m.group || '').includes(ph.name)
      )
    )
    return !anyMatch
  })()

  const mergedPhases = phases.map((phase: any, phaseIdx: number) => {
    if (startggEventId && startggMatches.length > 0) {
      const pm = startggMatches.filter((m: any) =>
        (m.group || '').startsWith(phase.name) || (m.group || '').includes(phase.name)
      )
      const src = pm.length > 0 ? pm
        : (phases.length === 1 ? startggMatches
          : (startggMatchesAssigned && phaseIdx === 0 ? startggMatches : []))
      if (src.length > 0) {
        const groups: Record<string, any[]> = {}
        src.forEach((m: any) => {
          const g = m.group || phase.name
          groups[g] = groups[g] || []
          groups[g].push(m)
        })
        return {
          ...phase,
          groups: Object.entries(groups).map(([gn, ms]: [string, any[]]) => ({
            name: gn,
            players: [...new Set(
              ms.flatMap((m: any) => [m.player1, m.player2])
                .filter((p: string) => p && p !== 'TBD')
            )].map((p: string) => ({ name: p })),
            matches: ms.map((m: any) => ({
              player1: m.player1, player2: m.player2,
              player1_handle: m.player1_handle, player2_handle: m.player2_handle,
              score: m.score, winner: m.winner,
              round: m.round, date: '', status: m.status,
            })),
          })),
        }
      }
      return phase
    }
    // CC12 Liquipedia フォールバック
    const pm = cc12Matches.filter((m: any) => {
      if (phase.name === 'Phase 1') return m.group.startsWith('Group ') && !m.group.startsWith('P2')
      if (phase.name === 'Phase 2') return m.group.startsWith('P2 ')
      if (phase.name === 'Phase 3') return m.group.startsWith('P3 ')
      return false
    })
    if (pm.length === 0) return phase
    if (phase.name === 'Phase 2') {
      const g2: Record<string, any[]> = {}
      pm.forEach((m: any) => {
        const n = m.group.replace('P2 ', '')
        g2[n] = g2[n] || []
        g2[n].push(m)
      })
      return {
        ...phase,
        groups: Object.entries(g2).map(([n, ms]: [string, any[]]) => ({
          name: n,
          players: [...new Set(ms.flatMap((m: any) => [m.player1, m.player2]))].map((p: string) => ({ name: p })),
          matches: ms.map((m: any) => ({
            player1: m.player1, player2: m.player2,
            score: m.score, winner: m.winner,
            round: m.round, date: '', status: m.status,
          })),
        })),
      }
    }
    if (phase.name === 'Phase 3') {
      const players = [...new Set(pm.flatMap((m: any) => [m.player1, m.player2]).filter(Boolean))]
      return {
        ...phase,
        groups: [{ name: 'Top 16 Bracket', players: players.map((p: string) => ({ name: p })), matches: pm.map((m: any) => ({ player1: m.player1, player2: m.player2, score: m.score, winner: m.winner, round: m.round, date: '', status: m.status })) }],
      }
    }
    return {
      ...phase,
      groups: phase.groups.map((g: any) => {
        const gm = pm.filter((m: any) => m.group === g.name)
        return gm.length === 0 ? g : {
          ...g,
          matches: gm.map((m: any) => ({
            player1: m.player1, player2: m.player2,
            round: m.round, date: m.date || '',
            score: m.score || '', winner: m.winner || '',
            status: m.status, maps: m.maps || [],
          })),
        }
      }),
    }
  })

  // ── upNextMatches + featuredMode ──────────────────────────────────────────
  const { upNextMatches, featuredMode } = (() => {
    const nowTs = Date.now() / 1000
    const LATEST_WINDOW = 300

    const extractH = (name: string) =>
      name?.includes(' | ') ? name.split(' | ').slice(1).join(' | ').trim() : (name || '')

    const toEntry = (m: any, groupName?: string) => {
      const p1h = m.player1_handle || m.player1 || ''
      const p2h = m.player2_handle || m.player2 || ''
      const winnerH = extractH(m.winner || '')
      const winner_is_p1: boolean | null =
        m.status === 'completed' && winnerH
          ? winnerH.toLowerCase() === p1h.toLowerCase()
            ? true
            : winnerH.toLowerCase() === p2h.toLowerCase()
              ? false
              : null
          : null
      return {
        round_text:      (groupName || m.group || '') + ' — ' + (m.round || ''),
        player1_handle:  p1h,
        player2_handle:  p2h,
        score:           m.score ?? '',
        winner_is_p1,
        player1_char:    null,
        player2_char:    null,
        player1_country: null,
        player2_country: null,
        status:          m.status,
        completedAt:     m.completedAt ?? null,
      }
    }

    const validMatch = (m: any) => {
      const p1h = m.player1_handle || m.player1 || 'TBD'
      const p2h = m.player2_handle || m.player2 || 'TBD'
      return p1h !== 'TBD' && p2h !== 'TBD'
    }

    const live: any[] = []
    const completedPhase: any[] = []
    mergedPhases.forEach((ph: any) => {
      ;(ph.groups || []).forEach((g: any) => {
        ;(g.matches || []).forEach((m: any) => {
          if (!validMatch(m)) return
          const entry = toEntry(m, g.name)
          if (m.status === 'live' || m.status === 'upcoming') live.push(entry)
          else if (m.status === 'completed') completedPhase.push(entry)
        })
      })
    })

    if (live.length > 0) {
      live.sort((a, b) => (a.status === 'live' ? -1 : b.status === 'live' ? 1 : 0))
      return { upNextMatches: live.slice(0, 8), featuredMode: 'live' as const }
    }

    const latestResults = startggMatches.filter((m: any) =>
      m.status === 'completed' &&
      m.completedAt != null &&
      (nowTs - m.completedAt) < LATEST_WINDOW &&
      validMatch(m)
    )
    if (latestResults.length > 0) {
      return {
        upNextMatches: latestResults.slice(0, 8).map(m => toEntry(m)),
        featuredMode: 'latest' as const,
      }
    }

    if (completedPhase.length > 0) {
      return { upNextMatches: completedPhase.slice(0, 8), featuredMode: 'recent' as const }
    }

    const fallback = startggMatches.filter(validMatch).slice(0, 8).map(m => toEntry(m))
    return { upNextMatches: fallback, featuredMode: 'recent' as const }
  })()

  return { startggMatches, cc12Matches, cc12LastUpdated, mergedPhases, upNextMatches, featuredMode }
}
