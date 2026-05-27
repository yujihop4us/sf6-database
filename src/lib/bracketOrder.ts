/**
 * bracketOrder.ts — ダブルエリミネーション ブラケット表示順ユーティリティ
 *
 * getBracketSortOrder(roundText) の返り値が小さいほど上（重要なラウンド）に表示する。
 *
 * 表示順:
 *   0   Grand Final Reset
 *   1   Grand Final
 *   2   Winners Final
 *   3   Losers Final
 *   4   Winners Semi-Final
 *   5   Losers Semi-Final
 *   6   Winners Quarter-Final
 *   7   Losers Quarter-Final
 *   8   Losers Round N  (N が大きいほど小さい数値 = 上)   8 + (50 - N)
 *  60   Winners Round N (N が大きいほど小さい数値)        60 + (50 - N)
 *  99   その他 / 不明
 */

export function getBracketSortOrder(roundText: string): number {
  const rt = roundText.trim()

  // ─── Grand Final ───────────────────────────────────────────
  if (/grand final reset/i.test(rt))  return 0
  if (/grand final/i.test(rt))        return 1

  // ─── Winners bracket (named) ───────────────────────────────
  if (/winners final/i.test(rt))        return 2
  if (/winners semi.?final/i.test(rt))  return 4
  if (/winners quarter.?final/i.test(rt)) return 6

  // ─── Losers bracket (named) ────────────────────────────────
  if (/losers final/i.test(rt))         return 3
  if (/losers semi.?final/i.test(rt))   return 5
  if (/losers quarter.?final/i.test(rt)) return 7

  // ─── Losers Round N ────────────────────────────────────────
  // N が大きいほど上に来る (例: Losers Round 5 → 8 + (50-5) = 53)
  const lrMatch = rt.match(/losers round\s+(\d+)/i)
  if (lrMatch) {
    const n = parseInt(lrMatch[1], 10)
    return 8 + Math.max(0, 50 - n)
  }

  // ─── Winners Round N ───────────────────────────────────────
  // Winners QF 相当以下。N が大きいほど上 (例: Winners Round 3 → 60 + (50-3) = 107)
  const wrMatch = rt.match(/winners round\s+(\d+)/i)
  if (wrMatch) {
    const n = parseInt(wrMatch[1], 10)
    return 60 + Math.max(0, 50 - n)
  }

  return 99
}

/**
 * getBracketRoundLabel — 表示用短縮ラベル（ヘッダー等）
 */
export function getBracketRoundLabel(roundText: string): string {
  const rt = roundText.trim()
  if (/grand final reset/i.test(rt)) return 'Grand Final Reset'
  if (/grand final/i.test(rt))       return 'Grand Final'
  if (/winners final/i.test(rt))     return 'Winners Final'
  if (/losers final/i.test(rt))      return 'Losers Final'
  if (/winners semi.?final/i.test(rt)) return 'Winners Semi-Final'
  if (/losers semi.?final/i.test(rt))  return 'Losers Semi-Final'
  if (/winners quarter.?final/i.test(rt)) return 'Winners Quarter-Final'
  if (/losers quarter.?final/i.test(rt))  return 'Losers Quarter-Final'
  return rt
}
