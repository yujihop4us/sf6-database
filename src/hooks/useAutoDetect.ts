'use client'

import { useState, useEffect, useRef } from 'react'

export interface UseAutoDetectReturn {
  autoDetected:  boolean
  /** AUTO バッジ ✕ ボタンや手動操作時に呼ぶ。以降の自動上書きを止める */
  setManualMode: () => void
  /** start.gg games データから算出したリアルタイムゲームスコア。データなし時は null */
  liveScore: { p1: number; p2: number } | null
}

/**
 * start.gg の進行中 / 直近完了セットを監視し、
 * 新しいマッチが検出されたら onNewPlayers(p1, p2) を呼び出す。
 *
 * @param startggMatches  /api/startgg から取得した試合リスト
 * @param eventId         start.gg event ID (undefined の場合は無効)
 * @param onNewPlayers    新しい選手ペアが検出されたときのコールバック
 */
export function useAutoDetect(
  startggMatches: any[],
  eventId: number | undefined,
  onNewPlayers: (p1: string, p2: string, p1StartggId?: number | null, p2StartggId?: number | null) => void,
): UseAutoDetectReturn {
  const [autoDetected,  setAutoDetected]  = useState(false)
  const [liveScore, setLiveScore] = useState<{ p1: number; p2: number } | null>(null)
  const autoDetectKeyRef = useRef<string>('')

  // onNewPlayers が毎レンダーで新しい参照になっても stale closure にならないよう ref 経由で呼ぶ
  const onNewPlayersRef = useRef(onNewPlayers)
  useEffect(() => { onNewPlayersRef.current = onNewPlayers }, [onNewPlayers])

  // ── liveScore: ポーリング毎に live セットのゲームスコアを更新 ─────────────
  // autoDetectKey に依存しないため別 effect で追跡
  useEffect(() => {
    if (!eventId) return
    const liveSet = startggMatches.find((m: any) => m.status === 'live')
    setLiveScore(liveSet?.liveScore ?? null)
  }, [startggMatches, eventId])

  // ── 自動検知: 選手ペア変更時のみ onNewPlayers を呼び出す ───────────────────
  useEffect(() => {
    if (!eventId || startggMatches.length === 0) return
    if (autoDetectKeyRef.current === '__manual__') return

    const nowTs = Date.now() / 1000

    // ── Branch 1: state=2 (in-progress / live) セット優先 ──────────────────
    const liveSet = startggMatches.find((m: any) => m.status === 'live')
    if (liveSet) {
      const p1 = liveSet.player1_handle || liveSet.player1 || ''
      const p2 = liveSet.player2_handle || liveSet.player2 || ''
      if (!p1 || !p2 || p1 === 'TBD' || p2 === 'TBD') return

      const key = `${p1}|${p2}`
      if (autoDetectKeyRef.current === key) return

      console.log('[AUTO] Branch1 live set detected', { p1, p2, key })
      autoDetectKeyRef.current = key
      setAutoDetected(true)
      onNewPlayersRef.current(p1, p2, liveSet.player1_startggId ?? null, liveSet.player2_startggId ?? null)
      return
    }

    // ── Branch 2: 直近5分以内の completedAt を持つセット ──────────────────
    const latestSet = startggMatches.find((m: any) =>
      m.status === 'completed' &&
      m.completedAt != null &&
      (nowTs - m.completedAt) < 300 &&
      (m.player1_handle || m.player1) !== 'TBD' &&
      (m.player2_handle || m.player2) !== 'TBD'
    )

    console.log('[AUTO]', {
      autoDetectKey: autoDetectKeyRef.current,
      autoDetected,
      latestSetFound: latestSet
        ? `${latestSet.player1_handle}|${latestSet.player2_handle} (${Math.round(nowTs - latestSet.completedAt)}s ago)`
        : null,
    })

    if (!latestSet) return

    const p1 = latestSet.player1_handle || latestSet.player1 || ''
    const p2 = latestSet.player2_handle || latestSet.player2 || ''
    if (!p1 || !p2) return

    const key = `${p1}|${p2}`
    if (autoDetectKeyRef.current === key) return

    console.log('[AUTO] Branch2 latest result detected', { p1, p2, key })
    autoDetectKeyRef.current = key
    setAutoDetected(true)
    onNewPlayersRef.current(p1, p2, latestSet.player1_startggId ?? null, latestSet.player2_startggId ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startggMatches, eventId])

  return {
    autoDetected,
    liveScore,
    setManualMode: () => {
      autoDetectKeyRef.current = '__manual__'
      setAutoDetected(false)
    },
  }
}
