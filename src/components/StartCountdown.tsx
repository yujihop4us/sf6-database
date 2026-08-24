'use client'

import { useState, useEffect } from 'react'

/**
 * 大会開始（次の試合）までのカウントダウン。
 *
 * 開催期間を日付だけで判定すると初日の 00:00 から「開催中」になってしまい、
 * 実際の試合開始まで数時間ある状態でも LIVE 扱いになる。
 * Liquipedia の試合スケジュールから「まだ終わっていない最速の試合」を取得して
 * 実際の開始までの残り時間を表示する。
 */

export interface CountdownParts {
  days: number; hours: number; minutes: number; seconds: number
}

function diffParts(targetMs: number): CountdownParts | null {
  const ms = targetMs - Date.now()
  if (ms <= 0) return null
  const s = Math.floor(ms / 1000)
  return {
    days:    Math.floor(s / 86400),
    hours:   Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
}

/** 残り時間を「1日 2時間 3分」「9時間 31分 05秒」のように整形 */
export function formatCountdown(p: CountdownParts): string {
  if (p.days > 0)  return `${p.days}日 ${p.hours}時間 ${p.minutes}分`
  if (p.hours > 0) return `${p.hours}時間 ${p.minutes}分 ${String(p.seconds).padStart(2, '0')}秒`
  return `${p.minutes}分 ${String(p.seconds).padStart(2, '0')}秒`
}

/**
 * Liquipedia 由来の大会について、次の試合開始までの残り時間を返す。
 * 開始済み（次の試合が無い/過去）の場合は null。
 */
export function useNextMatchCountdown(liquipediaTournament?: string): {
  targetMs: number | null
  parts: CountdownParts | null
} {
  const [targetMs, setTargetMs] = useState<number | null>(null)
  const [parts, setParts] = useState<CountdownParts | null>(null)

  useEffect(() => {
    if (!liquipediaTournament) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/liquipedia/results?tournament=' + liquipediaTournament)
        const data = await res.json()
        if (cancelled) return
        setTargetMs(data?.nextMatchAt ? data.nextMatchAt * 1000 : null)
      } catch { /* 取得失敗時はカウントダウンを出さない */ }
    }
    load()
    // 試合が進むと「次の試合」が変わるので定期的に取り直す
    const id = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [liquipediaTournament])

  useEffect(() => {
    if (!targetMs) { setParts(null); return }
    const tick = () => setParts(diffParts(targetMs))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetMs])

  return { targetMs, parts }
}

/** 開始までのバッジ表示 */
export function StartCountdown({
  liquipediaTournament, compact = false,
}: {
  liquipediaTournament?: string
  compact?: boolean
}) {
  const { targetMs, parts } = useNextMatchCountdown(liquipediaTournament)
  if (!targetMs || !parts) return null

  const local = new Date(targetMs).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: compact ? 6 : 8,
      background: 'rgba(245,200,66,0.12)',
      border: '1px solid rgba(245,200,66,0.35)',
      borderRadius: 20, padding: compact ? '3px 10px' : '5px 14px',
      fontFamily: 'var(--font-barlow-condensed, "Barlow Condensed", sans-serif)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        fontSize: compact ? 9 : 10, fontWeight: 800, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: '#f5c842',
      }}>開始まで</span>
      <span style={{
        fontSize: compact ? 12 : 14, fontWeight: 900, letterSpacing: '0.04em',
        color: '#f5c842', fontVariantNumeric: 'tabular-nums',
      }}>{formatCountdown(parts)}</span>
      {!compact && (
        <span style={{ fontSize: 11, color: 'rgba(245,200,66,0.65)' }}>({local})</span>
      )}
    </span>
  )
}
