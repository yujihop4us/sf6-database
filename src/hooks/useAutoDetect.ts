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
 * @param startggMatches  /api/startgg または /api/liquipedia/results から取得した試合リスト
 * @param enabled         自動検知を有効にするか
 * @param onNewPlayers    新しい選手ペアが検出されたときのコールバック
 * @param scheduleFallback
 *   完了時刻を持たないソース (Liquipedia) 向け。live/直近完了で決まらない場合に
 *   試合予定時刻から「今の試合」を推定する
 */
export function useAutoDetect(
  startggMatches: any[],
  enabled: boolean,
  onNewPlayers: (p1: string, p2: string, p1StartggId?: number | null, p2StartggId?: number | null) => void,
  scheduleFallback = false,
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
    if (!enabled) return
    const liveSet = startggMatches.find((m: any) => m.status === 'live')
    setLiveScore(liveSet?.liveScore ?? null)
  }, [startggMatches, enabled])

  // ── 自動検知: 選手ペア変更時のみ onNewPlayers を呼び出す ───────────────────
  useEffect(() => {
    if (!enabled || startggMatches.length === 0) return
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

    if (!latestSet) {
      // ── Branch 3: 予定時刻から「今の試合」を推定 ─────────────────────────
      // Liquipedia は編集者が結果を入れるまで live/completed にならず、
      // 完了時刻も持たない（completedAt は予定時刻）。そのため Branch1/2 では
      // 何も検出できない。開始済みで最も新しい試合、無ければ直近の予定試合を使う
      if (!scheduleFallback) return

      const named = startggMatches.filter((m: any) => {
        const a = m.player1_handle || m.player1 || ''
        const b = m.player2_handle || m.player2 || ''
        return m.scheduledAt && a && b && a !== 'TBD' && b !== 'TBD'
      })
      if (named.length === 0) return

      const sorted  = [...named].sort((a, b) => a.scheduledAt - b.scheduledAt)
      const started = sorted.filter((m: any) => m.scheduledAt <= nowTs)
      const pick    = started.length ? started[started.length - 1] : sorted[0]

      const sp1 = pick.player1_handle || pick.player1 || ''
      const sp2 = pick.player2_handle || pick.player2 || ''
      const skey = `${sp1}|${sp2}`
      if (autoDetectKeyRef.current === skey) return

      console.log('[AUTO] Branch3 schedule fallback', { sp1, sp2, skey })
      autoDetectKeyRef.current = skey
      setAutoDetected(true)
      onNewPlayersRef.current(sp1, sp2, pick.player1_startggId ?? null, pick.player2_startggId ?? null)
      return
    }

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
  }, [startggMatches, enabled, scheduleFallback])

  return {
    autoDetected,
    liveScore,
    setManualMode: () => {
      autoDetectKeyRef.current = '__manual__'
      setAutoDetected(false)
    },
  }
}
