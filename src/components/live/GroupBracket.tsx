'use client'

import { useState, useMemo } from 'react'
import { V } from './tokens'

/**
 * トーナメント表（ブラケット図）。
 *
 * Liquipedia 由来の matches（matchKey / group を持つ）から実際の進行構造を描画する。
 *
 * ── GSL 8人ダブルイリミネーション (Bracket/8-2Q-U-4L2D-2Q) ──
 * 独立した4人GSL×2ハーフで構成される。各ハーフから2名ずつ、計4名が通過。
 *
 *   R1M1 ┐
 *        ├→ R2M1(勝者戦) ─勝→ 通過
 *   R1M2 ┘        └敗┐
 *     └敗→ R1M5(敗者戦) ─勝→ R2M3(進出決定戦) ─勝→ 通過
 *
 * ハーフA: R1M1,R1M2 → R2M1 / R1M5 → R2M3
 * ハーフB: R1M3,R1M4 → R2M2 / R1M6 → R2M4
 *
 * この対応は EWC2025 (4人版 Bracket/4-1Q-U-2L1D-1Q) の確定済みデータで
 * 構造を検証し、EWC2026 の試合時刻の依存順とも一致することを確認済み。
 */

const CARD_W = 168
const CARD_H = 62
const COL_GAP = 52
const COL_X = [0, CARD_W + COL_GAP, (CARD_W + COL_GAP) * 2]

// ハーフ内の縦位置
const Y_OPEN_1 = 0
const Y_OPEN_2 = 88
const Y_WINNERS = 44
const Y_ELIM = 176
const Y_DECIDER = 110
const HALF_H = Y_ELIM + CARD_H + 8

interface BracketMatch {
  group?: string
  round?: string
  matchKey?: string
  player1?: string
  player2?: string
  score?: string
  winner?: string
  status?: string
  scheduledAt?: number | null
  liveScore?: { p1: number; p2: number } | null
}

/** GSL 8人ブラケットの2ハーフ構成 */
const GSL_HALVES = [
  { label: 'ハーフ 1', opening: ['R1M1', 'R1M2'], winners: 'R2M1', elim: 'R1M5', decider: 'R2M3' },
  { label: 'ハーフ 2', opening: ['R1M3', 'R1M4'], winners: 'R2M2', elim: 'R1M6', decider: 'R2M4' },
]

/** 決勝ブラケット（シングルエリミ 8人）の接続 */
const SE_FEEDS: Record<string, string[]> = {
  R2M1: ['R1M1', 'R1M2'],
  R2M2: ['R1M3', 'R1M4'],
  R3M1: ['R2M1', 'R2M2'],
}
const SE_COLS = [['R1M1', 'R1M2', 'R1M3', 'R1M4'], ['R2M1', 'R2M2'], ['R3M1']]
const SE_LABELS: Record<string, string> = {
  R1M1: '準々決勝', R1M2: '準々決勝', R1M3: '準々決勝', R1M4: '準々決勝',
  R2M1: '準決勝',   R2M2: '準決勝',   R3M1: '決勝',
}

function fmtTime(ts: number | null | undefined): string {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleTimeString('ja-JP', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
  })
}

// ── 1試合ぶんのカード ────────────────────────────────────────────────────────
function MatchCard({
  m, x, y, label, onClick,
}: {
  m: BracketMatch | undefined
  x: number; y: number
  /** ラウンド名。列見出しの代わりにカード自身へ表示する */
  label: string
  onClick: (p1: string, p2: string) => void
}) {
  const isDone = m?.status === 'completed'
  const isLive = m?.status === 'live'
  const p1 = m?.player1 || 'TBD'
  const p2 = m?.player2 || 'TBD'
  const canClick = p1 !== 'TBD' && p2 !== 'TBD'
  const [s1, s2] = (m?.score || '').split('-')
  const live = m?.liveScore

  const row = (name: string, score: string | undefined, isWinner: boolean) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      height: 22, padding: '0 8px',
      background: isDone && isWinner ? V.accentDim : 'transparent',
    }}>
      <span style={{
        flex: 1, minWidth: 0,
        fontFamily: V.FD, fontSize: 12,
        fontWeight: isDone && isWinner ? 800 : 600,
        color: name === 'TBD' ? V.dim : isDone ? (isWinner ? V.text : V.muted) : V.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{name}</span>
      <span style={{
        flexShrink: 0, minWidth: 12, textAlign: 'center',
        fontFamily: V.FD, fontSize: 12, fontWeight: 900,
        color: isDone ? (isWinner ? V.accent : V.dim) : V.dim,
      }}>{score || '–'}</span>
    </div>
  )

  return (
    <div
      onClick={() => canClick && onClick(p1, p2)}
      title={m?.round}
      style={{
        position: 'absolute', left: x, top: y,
        width: CARD_W, height: CARD_H,
        border: `1px solid ${isLive ? V.red : V.border}`,
        borderRadius: 6, overflow: 'hidden', background: V.surface2,
        cursor: canClick ? 'pointer' : 'default',
        boxShadow: isLive ? `0 0 0 2px ${V.red}44` : 'none',
        zIndex: 2,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 16, padding: '0 8px', background: V.surface3,
        borderBottom: `1px solid ${V.border}`,
        fontFamily: V.FD, fontSize: 9, letterSpacing: '0.06em', color: V.dim,
      }}>
        <span style={{ display: 'flex', gap: 5, minWidth: 0 }}>
          <span style={{ fontWeight: 800, color: V.muted }}>{label}</span>
          <span>{fmtTime(m?.scheduledAt)}</span>
        </span>
        {isLive && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: V.red, fontWeight: 800 }}>
            <span className="sf6live-dot" style={{ width: 5, height: 5 }} />LIVE
          </span>
        )}
        {isDone && <span style={{ color: V.accent, fontWeight: 800 }}>済</span>}
      </div>
      {row(p1, live ? String(live.p1) : s1, m?.winner === m?.player1)}
      <div style={{ height: 1, background: V.border }} />
      {row(p2, live ? String(live.p2) : s2, m?.winner === m?.player2)}
    </div>
  )
}

// ── 接続線 ───────────────────────────────────────────────────────────────────
type Line = { from: [number, number]; to: [number, number]; kind: 'win' | 'lose' }

/** 直角の折れ線パス（右→中間で縦→右） */
function elbow(from: [number, number], to: [number, number]): string {
  const midX = from[0] + (to[0] - from[0]) / 2
  return `M ${from[0]} ${from[1]} H ${midX} V ${to[1]} H ${to[0]}`
}

function Connectors({ lines, width, height }: { lines: Line[]; width: number; height: number }) {
  return (
    <svg width={width} height={height} style={{
      position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 1,
    }}>
      {lines.map((l, i) => (
        <path
          key={i}
          d={elbow(l.from, l.to)}
          fill="none"
          stroke={l.kind === 'win' ? V.accent : V.red}
          strokeOpacity={l.kind === 'win' ? 0.5 : 0.32}
          strokeWidth={1.5}
          strokeDasharray={l.kind === 'lose' ? '4 3' : undefined}
        />
      ))}
    </svg>
  )
}

// 通過バッジ
function QualifyTag({ x, y }: { x: number; y: number }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, zIndex: 2,
      fontFamily: V.FD, fontSize: 10, fontWeight: 800,
      letterSpacing: '0.1em', color: V.accent,
      background: V.accentDim, border: `1px solid ${V.border2}`,
      borderRadius: 4, padding: '3px 8px', whiteSpace: 'nowrap',
    }}>✓ 通過</div>
  )
}

// ── GSL ハーフ（4人GSL）1つぶん ──────────────────────────────────────────────
function GslHalf({
  half, byKey, onMatchClick,
}: {
  half: typeof GSL_HALVES[number]
  byKey: Map<string, BracketMatch>
  onMatchClick: (p1: string, p2: string) => void
}) {
  const rightOf = (x: number) => x + CARD_W
  const midY = (y: number) => y + CARD_H / 2

  const lines: Line[] = [
    // 1回戦の勝者 → 勝者戦
    { from: [rightOf(COL_X[0]), midY(Y_OPEN_1)], to: [COL_X[1], midY(Y_WINNERS)], kind: 'win' },
    { from: [rightOf(COL_X[0]), midY(Y_OPEN_2)], to: [COL_X[1], midY(Y_WINNERS)], kind: 'win' },
    // 1回戦の敗者 → 敗者戦
    { from: [rightOf(COL_X[0]), midY(Y_OPEN_1)], to: [COL_X[1], midY(Y_ELIM)], kind: 'lose' },
    { from: [rightOf(COL_X[0]), midY(Y_OPEN_2)], to: [COL_X[1], midY(Y_ELIM)], kind: 'lose' },
    // 勝者戦の敗者 → 進出決定戦 / 敗者戦の勝者 → 進出決定戦
    { from: [rightOf(COL_X[1]), midY(Y_WINNERS)], to: [COL_X[2], midY(Y_DECIDER)], kind: 'lose' },
    { from: [rightOf(COL_X[1]), midY(Y_ELIM)],    to: [COL_X[2], midY(Y_DECIDER)], kind: 'win' },
    // 勝者戦の勝者 → 通過
    { from: [rightOf(COL_X[1]), midY(Y_WINNERS)], to: [rightOf(COL_X[1]) + 30, Y_WINNERS - 7], kind: 'win' },
  ]

  const width = COL_X[2] + CARD_W + 74
  return (
    <div style={{ position: 'relative', width, height: HALF_H, flexShrink: 0 }}>
      <Connectors lines={lines} width={width} height={HALF_H} />
      <MatchCard m={byKey.get(half.opening[0])} x={COL_X[0]} y={Y_OPEN_1}  label="1回戦"     onClick={onMatchClick} />
      <MatchCard m={byKey.get(half.opening[1])} x={COL_X[0]} y={Y_OPEN_2}  label="1回戦"     onClick={onMatchClick} />
      <MatchCard m={byKey.get(half.winners)}    x={COL_X[1]} y={Y_WINNERS} label="勝者戦"     onClick={onMatchClick} />
      <MatchCard m={byKey.get(half.elim)}       x={COL_X[1]} y={Y_ELIM}    label="敗者戦"     onClick={onMatchClick} />
      <MatchCard m={byKey.get(half.decider)}    x={COL_X[2]} y={Y_DECIDER} label="進出決定戦" onClick={onMatchClick} />
      {/* 勝者戦の勝者と進出決定戦の勝者が通過 */}
      <QualifyTag x={rightOf(COL_X[1]) + 30} y={Y_WINNERS - 18} />
      <QualifyTag x={rightOf(COL_X[2]) + 8}  y={midY(Y_DECIDER) - 11} />
    </div>
  )
}

// ── 本体 ────────────────────────────────────────────────────────────────────
export function GroupBracket({
  matches, onMatchClick,
}: {
  matches: BracketMatch[]
  onMatchClick: (p1: string, p2: string) => void
}) {
  const groups = useMemo(() => {
    const seen: string[] = []
    for (const m of matches) {
      const g = m.group || ''
      if (g && !seen.includes(g)) seen.push(g)
    }
    return seen
  }, [matches])

  const [active, setActive] = useState<string | null>(null)
  const current = active && groups.includes(active) ? active : groups[0]

  const byKey = useMemo(() => {
    const map = new Map<string, BracketMatch>()
    for (const m of matches) {
      if ((m.group || '') === current && m.matchKey) map.set(m.matchKey, m)
    }
    return map
  }, [matches, current])

  // GSL(10試合) か シングルエリミ(7試合) かを構成で判定
  const isGsl = byKey.has('R1M5') && byKey.has('R2M3')

  if (groups.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10, padding: 30,
      }}>
        <div style={{ fontSize: 22 }}>⌛</div>
        <div style={{ fontFamily: V.FD, fontSize: 13, fontWeight: 700, color: V.dim, letterSpacing: '0.1em' }}>
          ブラケット情報を取得中...
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* グループ切替 + 凡例 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
        flexShrink: 0, borderBottom: `1px solid ${V.border}`, overflowX: 'auto',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {groups.map(g => (
            <button key={g} onClick={() => setActive(g)} style={{
              background: current === g ? V.surface3 : 'transparent',
              border: `1px solid ${current === g ? V.border2 : V.border}`,
              borderRadius: 5, padding: '3px 10px', cursor: 'pointer', flexShrink: 0,
              fontFamily: V.FD, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.06em', whiteSpace: 'nowrap',
              color: current === g ? V.accent : V.muted,
            }}>{g}</button>
          ))}
        </div>
        <div style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: V.FD, fontSize: 9, color: V.dim, whiteSpace: 'nowrap',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={V.accent} strokeOpacity="0.5" strokeWidth="1.5" /></svg>
            勝者
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={V.red} strokeOpacity="0.32" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
            敗者
          </span>
        </div>
      </div>

      {/* ブラケット本体 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 14px' }}>
        {isGsl ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {GSL_HALVES.map(h => (
              <div key={h.label}>
                <div style={{
                  fontFamily: V.FD, fontSize: 9, fontWeight: 800, letterSpacing: '0.16em',
                  color: V.dim, textTransform: 'uppercase', marginBottom: 6,
                }}>{h.label}</div>
                <GslHalf half={h} byKey={byKey} onMatchClick={onMatchClick} />
              </div>
            ))}
          </div>
        ) : (
          <SingleElim byKey={byKey} onMatchClick={onMatchClick} />
        )}
      </div>
    </div>
  )
}

// ── シングルエリミ（決勝ブラケット） ─────────────────────────────────────────
function SingleElim({
  byKey, onMatchClick,
}: {
  byKey: Map<string, BracketMatch>
  onMatchClick: (p1: string, p2: string) => void
}) {
  const SP = 88                        // 1回戦カードの間隔
  const pos = new Map<string, [number, number]>()
  SE_COLS.forEach((col, ci) => {
    col.forEach((key, ri) => {
      // 各ラウンドは前ラウンド2試合の中点に配置する
      const step = SP * Math.pow(2, ci)
      const y = step * ri + (step - CARD_H) / 2 - (SP - CARD_H) / 2
      pos.set(key, [COL_X[ci], y])
    })
  })

  const lines: Line[] = []
  for (const [target, sources] of Object.entries(SE_FEEDS)) {
    const tp = pos.get(target)
    if (!tp) continue
    for (const s of sources) {
      const sp = pos.get(s)
      if (!sp) continue
      lines.push({
        from: [sp[0] + CARD_W, sp[1] + CARD_H / 2],
        to:   [tp[0], tp[1] + CARD_H / 2],
        kind: 'win',
      })
    }
  }

  const width  = COL_X[2] + CARD_W + 20
  const height = SP * 4
  return (
    <div style={{ position: 'relative', width, height }}>
      <Connectors lines={lines} width={width} height={height} />
      {[...pos.entries()].map(([key, [x, y]]) => (
        <MatchCard key={key} m={byKey.get(key)} x={x} y={y}
          label={SE_LABELS[key] ?? ''} onClick={onMatchClick} />
      ))}
    </div>
  )
}
