import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 大会が「LIVE中」かどうかを判定する。
 *
 * - start_date 当日の UTC 00:00:00 以降から
 * - end_date の「翌日」23:59:59 UTC まで true を返す
 *   （大会の遅延・延長に対応した +24h バッファ）
 *
 * 例: end_date = '2026-06-07'
 *   → 2026-06-08T23:59:59Z まで LIVE = true
 *   → JST では 2026-06-09 08:59:59 まで
 */
export function isTournamentLive(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): boolean {
  if (!startDate) return false
  const nowMs = Date.now()
  const startMs = new Date(startDate).getTime()
  const baseEnd = endDate
    ? new Date(endDate + 'T23:59:59Z').getTime()
    : startMs + 3 * 24 * 60 * 60 * 1000
  // +24h バッファ（大会遅延対応）
  const endMs = baseEnd + 24 * 60 * 60 * 1000
  return nowMs >= startMs && nowMs <= endMs
}
