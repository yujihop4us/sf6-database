'use client'

import { useState, useEffect } from 'react'

export type FeaturedMode = 'live' | 'latest' | 'recent'

export interface UseStartggPollingInput {
  startggEventId?: number
  /** start.gg を使わない大会で Liquipedia から取得する場合の大会キー */
  liquipediaTournament?: string
  endDate?: string
  phases: any[]
  hasStream: boolean
  searchQuery: string
}

export interface StartggStanding {
  placement: number
  /** false = まだ試合が残っており順位が変動しうる暫定順位 */
  isFinal:   boolean
  player:    string
  entrantId: number | null
  startggId: number | null
}

export interface UseStartggPollingReturn {
  startggMatches:  any[]
  startggStandings: StartggStanding[]
  cc12Matches:     any[]
  cc12LastUpdated: string
  mergedPhases:    any[]
  upNextMatches:   any[]
  featuredMode:    FeaturedMode
}

export function useStartggPolling({
  startggEventId,
  liquipediaTournament,
  endDate,
  phases,
  hasStream,
  searchQuery,
}: UseStartggPollingInput): UseStartggPollingReturn {
  const [startggMatches,  setStartggMatches]  = useState<any[]>([])
  const [startggStandings, setStartggStandings] = useState<StartggStanding[]>([])
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

  // ── 試合データのポーリング ────────────────────────────────────────────
  // start.gg 優先。start.gg を使わない大会 (EWC本戦など) は Liquipedia から取得する。
  // どちらも /api/startgg と同じ matches 形状を返すため以降の処理は共通
  useEffect(() => {
    if (!startggEventId && !liquipediaTournament) return
    const url = startggEventId
      ? '/api/startgg?eventId=' + startggEventId + '&fresh=1'
      : '/api/liquipedia/results?tournament=' + liquipediaTournament
    const ended = endDate && new Date() > new Date(endDate + 'T23:59:59')
    const fetchStartgg = async () => {
      try {
        const res  = await fetch(url)
        const data = await res.json()
        if (data.matches) {
          setStartggMatches(data.matches)
          // live セットがある場合はポーリングを短縮。
          // Liquipedia は編集反映が遅く、かつレート制限があるため長めに取る
          const hasLive = data.matches.some((m: any) => m.status === 'live')
          if (startggEventId) setPollInterval(hasLive ? 10_000 : 15_000)
          else                setPollInterval(hasLive ? 30_000 : 60_000)
        }
        if (Array.isArray(data.standings)) setStartggStandings(data.standings)
        if (data.lastUpdated) setCc12LastUpdated(data.lastUpdated)
      } catch (e) { console.error('[matches]', e) }
    }
    fetchStartgg()
    if (!ended) {
      const id = setInterval(fetchStartgg, pollInterval)
      return () => clearInterval(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startggEventId, liquipediaTournament, hasStream, searchQuery, pollInterval])

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
        // 予定時刻。UP NEXT を「本当に次の試合」順に並べるために使う
        scheduledAt:     m.scheduledAt ?? null,
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
      // 進行中を最優先、その後は予定時刻の早い順。
      // EWC のように「グループ順ではなく進行に応じて順番が決まる」大会では、
      // フェーズ走査順のまま先頭を出すと選手が確定済みの試合（例: Group AA の
      // Daigo vs Itabashi）が実際の進行と無関係にずっと表示されてしまう
      live.sort((a, b) => {
        const aLive = a.status === 'live' ? 0 : 1
        const bLive = b.status === 'live' ? 0 : 1
        if (aLive !== bLive) return aLive - bLive
        const at = a.scheduledAt ?? Number.MAX_SAFE_INTEGER
        const bt = b.scheduledAt ?? Number.MAX_SAFE_INTEGER
        return at - bt
      })
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

    // ── フォールバック ────────────────────────────────────────────────────
    // mergedPhases は startggEventId がある大会でしか試合を持たない。
    // Liquipedia 由来の大会 (EWC本戦など) はここに来るため、
    // API のフェーズ記載順そのままではなく進行状況で並べ替える。
    // これをしないと選手が確定済みの先頭の試合が実際の進行と無関係に固定表示される
    const usable = startggMatches.filter(validMatch)

    const pendingByTime = usable
      .filter((m: any) => m.status === 'live' || m.status === 'upcoming')
      .sort((a: any, b: any) => {
        const aLive = a.status === 'live' ? 0 : 1
        const bLive = b.status === 'live' ? 0 : 1
        if (aLive !== bLive) return aLive - bLive
        return (a.scheduledAt ?? Number.MAX_SAFE_INTEGER) - (b.scheduledAt ?? Number.MAX_SAFE_INTEGER)
      })

    if (pendingByTime.length > 0) {
      return {
        upNextMatches: pendingByTime.slice(0, 8).map(m => toEntry(m)),
        featuredMode: 'live' as const,
      }
    }

    // 未消化が無ければ直近の結果（予定時刻の新しい順）
    const recent = usable
      .filter((m: any) => m.status === 'completed')
      .sort((a: any, b: any) => (b.scheduledAt ?? 0) - (a.scheduledAt ?? 0))
    return {
      upNextMatches: recent.slice(0, 8).map(m => toEntry(m)),
      featuredMode: 'recent' as const,
    }
  })()

  return { startggMatches, startggStandings, cc12Matches, cc12LastUpdated, mergedPhases, upNextMatches, featuredMode }
}
