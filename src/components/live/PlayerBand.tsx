'use client'

import { V, cc, codeToFlag, Player } from './tokens'
import { CharPill } from './CharPill'

export function PlayerBand({
  player, score, side, isWinning, onSelectPlayer, scoreState, onScoreChange,
}: {
  player: Player | null
  score: number
  side: 'left' | 'right'
  isWinning: boolean
  onSelectPlayer: () => void
  scoreState: { p1: number; p2: number }
  onScoreChange: (delta: number) => void
}) {
  const isLeft  = side === 'left'
  const sideColor = isLeft ? V.P1 : V.P2   // 固定: マゼンタ or ブルー
  const charColor = cc(player?.main_character)
  const flag      = codeToFlag(player?.country_code)

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: isLeft
        ? `linear-gradient(to right, ${sideColor}28 0%, ${sideColor}0a 55%, transparent 100%)`
        : `linear-gradient(to left,  ${sideColor}28 0%, ${sideColor}0a 55%, transparent 100%)`,
      display: 'flex', flexDirection: 'column',
      alignItems: isLeft ? 'flex-start' : 'flex-end',
      justifyContent: 'space-between',
      padding: '22px 18px',
      borderRight: isLeft  ? `1px solid ${sideColor}35` : 'none',
      borderLeft:  !isLeft ? `1px solid ${sideColor}35` : 'none',
      minWidth: 0,
    }}>
      {/* 左端 / 右端のアクセントバー */}
      <div style={{
        position: 'absolute',
        ...(isLeft ? { left: 0 } : { right: 0 }),
        top: 0, bottom: 0, width: 3,
        background: `linear-gradient(180deg, transparent 0%, ${sideColor} 50%, transparent 100%)`,
      }} />

      {/* 選手名ウォーターマーク（縦書き・端寄せ） */}
      {player?.handle && (
        <div style={{
          position: 'absolute',
          top: '50%', bottom: 'auto',
          transform: 'translateY(-50%)',
          ...(isLeft ? { left: 0 } : { right: 0 }),
          overflow: 'hidden',
          pointerEvents: 'none', userSelect: 'none',
          zIndex: 0,
          fontFamily: V.FD, fontWeight: 900,
          fontSize: 90, lineHeight: 1,
          color: '#ffffff', opacity: 0.05,
          whiteSpace: 'nowrap',
          letterSpacing: '0.02em',
          textTransform: 'uppercase' as const,
          writingMode: (isLeft ? 'vertical-rl' : 'vertical-lr') as any,
        }}>{player.handle}</div>
      )}

      {/* ── 上部: プレイヤー情報 ── */}
      <div style={{ position: 'relative', textAlign: isLeft ? 'left' : 'right', width: '100%' }}>
        {player ? (
          <>
            {/* P1 / P2 バッジ */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: `${sideColor}22`, border: `1px solid ${sideColor}45`,
              borderRadius: 4, padding: '3px 10px', marginBottom: 12,
              fontFamily: V.FD, fontSize: 11, fontWeight: 800,
              letterSpacing: '0.14em', textTransform: 'uppercase' as const,
              color: sideColor,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: sideColor, display: 'inline-block' }} />
              {isLeft ? 'P1' : 'P2'}
            </div>

            {/* 国旗 + 選手名 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              flexDirection: isLeft ? 'row' : 'row-reverse',
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{flag}</span>
              <div style={{
                fontFamily: V.FD, fontSize: 30, fontWeight: 900,
                letterSpacing: '-0.02em', lineHeight: 1, color: V.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{player.handle}</div>
            </div>

            {/* キャラクターピル */}
            <div style={{ marginBottom: 6 }}>
              <CharPill name={player.main_character} size={13} />
            </div>

            {/* チーム名 */}
            {player.team && (
              <div style={{
                fontFamily: V.FD, fontSize: 11, fontWeight: 600,
                letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                color: `${sideColor}aa`, marginBottom: 10,
              }}>{player.team}</div>
            )}

            {/* 変更ボタン */}
            <button onClick={onSelectPlayer} style={{
              background: 'transparent', border: `1px solid ${V.border}`,
              borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
              fontFamily: V.FD, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              color: V.muted,
            }}>変更</button>
          </>
        ) : (
          /* 未選択プレースホルダー */
          <button onClick={onSelectPlayer} style={{
            background: `${sideColor}16`, border: `1px solid ${sideColor}38`,
            borderRadius: 8, padding: '14px 0', cursor: 'pointer',
            fontFamily: V.FD, fontSize: 15, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase' as const,
            color: sideColor, width: '100%', textAlign: 'center',
          }}>
            {isLeft ? '+ P1 選択' : 'P2 選択 +'}
          </button>
        )}
      </div>

      {/* ── 中央: スコア ── */}
      <div style={{ position: 'relative', width: '100%' }}>
        <div style={{
          fontFamily: V.FD, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase' as const,
          color: V.dim, marginBottom: 4,
          textAlign: isLeft ? 'left' : 'right',
        }}>GAMES</div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          justifyContent: isLeft ? 'flex-start' : 'flex-end',
        }}>
          {/* P2側は左に +/- ボタン */}
          {!isLeft && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <button onClick={() => onScoreChange(1)} style={{
                width: 18, height: 18, borderRadius: 3,
                border: `1px solid ${sideColor}40`,
                background: `${sideColor}16`, cursor: 'pointer',
                color: sideColor, fontWeight: 900, fontSize: 11,
                lineHeight: 1, padding: 0, fontFamily: V.FD,
              }}>+</button>
              <button onClick={() => onScoreChange(-1)} style={{
                width: 18, height: 18, borderRadius: 3,
                border: `1px solid ${V.red}30`,
                background: 'rgba(255,77,106,0.08)', cursor: 'pointer',
                color: V.red, fontWeight: 900, fontSize: 11,
                lineHeight: 1, padding: 0, fontFamily: V.FD,
              }}>−</button>
            </div>
          )}

          {/* スコア大数字 */}
          <div
            onClick={() => onScoreChange(1)}
            onContextMenu={e => { e.preventDefault(); onScoreChange(-1) }}
            title="クリック: +1 / 右クリック: -1"
            style={{
              fontFamily: V.FD, fontSize: 76, fontWeight: 900,
              lineHeight: 1, letterSpacing: '-0.05em',
              color: isWinning ? sideColor : V.dim,
              textShadow: isWinning ? `0 0 40px ${sideColor}55` : 'none',
              transition: 'color 0.35s, text-shadow 0.35s',
              cursor: 'pointer', userSelect: 'none',
            }}>{score}</div>

          {/* P1側は右に +/- ボタン */}
          {isLeft && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 6 }}>
              <button onClick={() => onScoreChange(1)} style={{
                width: 18, height: 18, borderRadius: 3,
                border: `1px solid ${sideColor}40`,
                background: `${sideColor}16`, cursor: 'pointer',
                color: sideColor, fontWeight: 900, fontSize: 11,
                lineHeight: 1, padding: 0, fontFamily: V.FD,
              }}>+</button>
              <button onClick={() => onScoreChange(-1)} style={{
                width: 18, height: 18, borderRadius: 3,
                border: `1px solid ${V.red}30`,
                background: 'rgba(255,77,106,0.08)', cursor: 'pointer',
                color: V.red, fontWeight: 900, fontSize: 11,
                lineHeight: 1, padding: 0, fontFamily: V.FD,
              }}>−</button>
            </div>
          )}
        </div>

        {/* スコアピップ(丸インジケーター) */}
        <div style={{
          display: 'flex', gap: 6, marginTop: 8,
          justifyContent: isLeft ? 'flex-start' : 'flex-end',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: '50%',
              background: i < score ? sideColor : V.surface3,
              border: `1px solid ${i < score ? sideColor : V.dim}`,
              boxShadow: i < score ? `0 0 8px ${sideColor}80` : 'none',
              transition: 'background 0.3s, box-shadow 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* 下部スペーサー */}
      <div />
    </div>
  )
}
