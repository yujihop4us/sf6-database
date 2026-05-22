'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { use } from 'react'
import SiteNavbar from '@/components/SiteNavbar'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Player {
  id: number
  handle: string
  country_code?: string
  main_character?: string
  team?: string
  total_sf6_earnings_usd?: number
  profile_image_url?: string
}

interface SetData {
  id: number
  tournament_id: number
  round_text: string
  winner_id: number
  loser_id: number
  winner_score: number
  loser_score: number
  display_score: string
  tournament_name: string
  tournament_date: string
}

interface H2HData {
  player1: Player
  player2: Player
  summary: { player1_wins: number; player2_wins: number; total_sets: number }
  sets: SetData[]
}

// ── Design tokens ─────────────────────────────────────────────────────────────
// ダークネイビー背景 + エメラルドグリーン + マゼンタ(P1) / ブルー(P2) の固定サイドカラー

const V = {
  bg:        '#080c14',
  surface:   '#0d1520',
  surface2:  '#111d2e',
  surface3:  '#162135',
  border:    'rgba(255,255,255,0.07)',
  border2:   'rgba(16,185,129,0.25)',
  accent:    '#10b981',           // エメラルドグリーン
  accentDim: 'rgba(16,185,129,0.12)',
  text:      '#f1f5f9',
  muted:     '#94a3b8',
  dim:       '#475569',
  red:       '#ff4d6a',
  gold:      '#f5c842',
  P1:        '#ec4899',           // マゼンタ — P1 固定カラー
  P2:        '#3b82f6',           // ブルー   — P2 固定カラー
  FD:        "'Barlow Condensed', sans-serif",
  FB:        "'Barlow', sans-serif",
} as const

// キャラ固有カラー（CharPill 専用）
const CHAR_COLORS: Record<string, string> = {
  'Akuma':'#8b2fc9','Cammy':'#2e9e5b','Chun-Li':'#3d7ef5',
  'Dee Jay':'#f5a623','Ed':'#4a7fd4','Guile':'#4a90d9',
  'JP':'#9b4dca','Juri':'#d43f8c','Ken':'#d45f00',
  'Luke':'#c8a820','M.Bison':'#9b1a1a','Manon':'#c86490',
  'Marisa':'#8b6914','Rashid':'#50c8c8','Ryu':'#e04040',
  'Blanka':'#3da840','Dhalsim':'#e85c2a','E. Honda':'#e84848',
  'Kimberly':'#ff6b35','Lily':'#7ec850','Zangief':'#d43c3c',
  'Jamie':'#d48820','Terry':'#c83232','Mai':'#e85c7a','Elena':'#30b040',
  'A.K.I':'#7bc87b',
}

function cc(char?: string | null) { return (char && CHAR_COLORS[char]) || '#556677' }

function codeToFlag(code?: string | null): string {
  if (!code || code.length < 2) return '🏳'
  return code.toUpperCase().slice(0, 2).split('').map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join('')
}

// ── CharPill ──────────────────────────────────────────────────────────────────

function CharPill({ name, size = 12 }: { name?: string | null; size?: number }) {
  const color = cc(name)
  if (!name) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: 'rgba(0,0,0,0.45)', border: `1px solid ${color}55`,
      borderRadius: 4, padding: '2px 9px',
      fontFamily: V.FD, fontSize: size, fontWeight: 700,
      letterSpacing: '0.07em', textTransform: 'uppercase' as const, color,
    }}>{name}</span>
  )
}

// ── PlayerBand ────────────────────────────────────────────────────────────────

function PlayerBand({
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

// ── DbSet 型 ──────────────────────────────────────────────────────────────────

interface DbSet {
  id:               number
  round_text:       string | null
  display_score:    string | null
  phase_name:       string | null
  winner_id:        number | null
  loser_id:         number | null
  winner_score:     number | null
  loser_score:      number | null
  winner_character: string | null
  loser_character:  string | null
  created_at:       string
  winner_handle:    string | null
  winner_country:   string | null
  winner_main_char: string | null
  loser_handle:     string | null
  loser_country:    string | null
  loser_main_char:  string | null
}

// ── LiveSetsTable — DB の tournament_sets をリスト表示 ────────────────────────

function LiveSetsTable({
  tournamentId,
  dbTournamentId,
  onMatchClick,
}: {
  tournamentId: string
  dbTournamentId?: number   // Supabase numeric ID。設定されていればこちらを優先
  onMatchClick: (p1: string, p2: string) => void
}) {
  const [sets,          setSets]          = useState<DbSet[]>([])
  const [total,         setTotal]         = useState(0)
  const [searchQuery,   setSearchQuery]   = useState('')    // 入力値 (生)
  const [debouncedSearch, setDebouncedSearch] = useState('')  // 300ms debounce後
  const [loading,       setLoading]       = useState(false)
  const [lastUpdated,   setLastUpdated]   = useState('')

  // ── 300ms debounce ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // ── fetch (debouncedSearch が変わるたびに再実行) ──────────────────────────
  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      if (!tournamentId) return
      setLoading(true)
      try {
        const effectiveTournamentId = dbTournamentId != null ? String(dbTournamentId) : tournamentId
        const params = new URLSearchParams({ tournamentId: effectiveTournamentId, limit: '100' })
        if (debouncedSearch.length >= 1) params.set('search', debouncedSearch)
        const res  = await fetch(`/api/live-sets?${params}`)
        const data = await res.json()
        if (!cancelled) {
          setSets(data.sets ?? [])
          setTotal(data.total ?? 0)
          setLastUpdated(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
        }
      } catch (e) {
        console.error('[LiveSetsTable]', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    doFetch()

    // 検索中はポーリング停止、通常時は 30s ポーリング
    if (!debouncedSearch) {
      const id = setInterval(doFetch, 30_000)
      return () => { cancelled = true; clearInterval(id) }
    }
    return () => { cancelled = true }
  }, [tournamentId, debouncedSearch])

  // ── ローディング / 空状態 ─────────────────────────────────────────────────
  if (!loading && sets.length === 0 && !debouncedSearch) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%', padding: '40px 20px' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: V.surface2, border: `1px solid ${V.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>⌛</div>
        <div style={{ fontFamily: V.FD, fontSize: 13, fontWeight: 700, color: V.dim, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
          セットデータ取得中...
        </div>
        <div style={{ fontFamily: V.FB, fontSize: 12, color: `${V.dim}99` }}>
          live-fetch.js が start.gg からデータを取り込み中です
        </div>
      </div>
    )
  }

  // ── 本体: flex column で高さ全使い ───────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── ヘッダー (固定) ── */}
      <div style={{
        padding: '8px 14px', flexShrink: 0,
        borderBottom: `1px solid ${V.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
        background: V.surface,
      }}>
        {/* 件数バッジ */}
        <div style={{
          fontFamily: V.FD, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase' as const,
          color: loading ? V.dim : V.accent,
          background: loading ? V.surface3 : V.accentDim,
          border: `1px solid ${loading ? V.border : V.border2}`,
          borderRadius: 4, padding: '2px 8px', flexShrink: 0,
          transition: 'color 0.2s, background 0.2s',
        }}>
          {loading ? '…' : debouncedSearch
            ? `${sets.length} 件 / 全件検索`
            : `最新 ${sets.length} SETS`}
        </div>

        {/* 検索フィールド */}
        <div style={{ position: 'relative', flex: 1 }}>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke={debouncedSearch ? V.accent : V.dim} strokeWidth="2.5"
            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', transition: 'stroke 0.15s' }}
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="選手名で全件検索（サーバー検索）..."
            style={{
              width: '100%', background: V.surface2,
              border: `1px solid ${debouncedSearch ? V.accent + '60' : V.border}`,
              borderRadius: 6, padding: '5px 30px 5px 26px',
              color: V.text, fontFamily: V.FB, fontSize: 12, outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = V.accent)}
            onBlur={e  => (e.target.style.borderColor = debouncedSearch ? V.accent + '60' : V.border)}
          />
          {/* クリアボタン */}
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: V.dim, fontSize: 14, lineHeight: 1, padding: '0 2px',
              }}
            >✕</button>
          )}
        </div>

        {/* 更新時刻 */}
        {lastUpdated && !loading && (
          <div style={{ fontFamily: V.FD, fontSize: 10, color: V.dim, flexShrink: 0 }}>
            {lastUpdated}
          </div>
        )}
      </div>

      {/* ── スクロール可能なセットリスト ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* 検索結果なし */}
        {!loading && sets.length === 0 && debouncedSearch && (
          <div style={{ textAlign: 'center', padding: '40px 20px', fontFamily: V.FD, fontSize: 13, color: V.dim }}>
            「{debouncedSearch}」に一致する選手が見つかりません
          </div>
        )}

        {/* セット行 */}
        {sets.map(s => {
          const wHandle  = s.winner_handle ?? '?'
          const lHandle  = s.loser_handle  ?? '?'
          const canClick = !!(s.winner_handle && s.loser_handle)
          const wScore   = s.winner_score ?? 0
          const lScore   = s.loser_score  ?? 0
          const time     = s.created_at
            ? new Date(s.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
            : ''

          return (
            <div
              key={s.id}
              onClick={() => canClick && onMatchClick(wHandle, lHandle)}
              style={{
                padding: '7px 14px',
                borderBottom: `1px solid ${V.border}`,
                cursor: canClick ? 'pointer' : 'default',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (canClick) (e.currentTarget as HTMLDivElement).style.background = V.surface2 }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              {/* フェーズ · ラウンド · 時刻 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                {s.phase_name && (
                  <span style={{ fontFamily: V.FD, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: V.dim }}>
                    {s.phase_name}
                  </span>
                )}
                {s.phase_name && s.round_text && <span style={{ color: `${V.dim}88`, fontSize: 9 }}>·</span>}
                {s.round_text && (
                  <span style={{ fontFamily: V.FD, fontSize: 9, color: `${V.dim}99`, letterSpacing: '0.05em' }}>
                    {s.round_text}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontFamily: V.FD, fontSize: 9, color: `${V.dim}77` }}>{time}</span>
              </div>

              {/* 勝者 ─ スコア ─ 敗者 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* 勝者 */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', minWidth: 0, overflow: 'hidden' }}>
                  {s.winner_character && <CharPill name={s.winner_character} size={10} />}
                  {s.winner_id ? (
                    <a href={`/player/${s.winner_id}`} onClick={e => e.stopPropagation()} style={{
                      fontFamily: V.FD, fontSize: 14, fontWeight: 800, color: V.accent,
                      textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    }}>{wHandle}</a>
                  ) : (
                    <span style={{ fontFamily: V.FD, fontSize: 14, fontWeight: 800, color: V.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{wHandle}</span>
                  )}
                  {s.winner_country && <span style={{ fontSize: 12, flexShrink: 0 }}>{codeToFlag(s.winner_country)}</span>}
                </div>

                {/* スコア */}
                <div style={{
                  fontFamily: V.FD, fontSize: 14, fontWeight: 900, letterSpacing: '-0.02em',
                  color: V.text, background: V.surface2, border: `1px solid ${V.border}`,
                  borderRadius: 4, padding: '1px 7px', flexShrink: 0, minWidth: 38, textAlign: 'center',
                }}>{wScore}–{lScore}</div>

                {/* 敗者 */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-start', minWidth: 0, overflow: 'hidden' }}>
                  {s.loser_country && <span style={{ fontSize: 12, flexShrink: 0 }}>{codeToFlag(s.loser_country)}</span>}
                  {s.loser_id ? (
                    <a href={`/player/${s.loser_id}`} onClick={e => e.stopPropagation()} style={{
                      fontFamily: V.FD, fontSize: 14, fontWeight: 700, color: V.dim,
                      textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    }}>{lHandle}</a>
                  ) : (
                    <span style={{ fontFamily: V.FD, fontSize: 14, fontWeight: 700, color: V.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{lHandle}</span>
                  )}
                  {s.loser_character && <CharPill name={s.loser_character} size={10} />}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── LiveBracket ───────────────────────────────────────────────────────────────

const BRACKET_ROUND_ORDER: Record<string, number> = {
  'Winners Round 1': 10, 'Winners Round 2': 11, 'Winners Round 3': 12,
  'Winners Round 4': 13, 'Winners Quarter-Final': 20, 'Winners Semi-Final': 30,
  'Winners Final': 40,
  'Losers Round 1': 50, 'Losers Round 2': 51, 'Losers Round 3': 52,
  'Losers Round 4': 53, 'Losers Round 5': 54, 'Losers Round 6': 55,
  'Losers Quarter-Final': 60, 'Losers Semi-Final': 70, 'Losers Final': 80,
  'Grand Final': 90, 'Grand Final Reset': 91,
}
function bracketRoundSort(round: string): number { return BRACKET_ROUND_ORDER[round] ?? 5 }

function LiveBracket({
  matches, lastUpdated, onMatchClick,
}: {
  matches: any[]
  lastUpdated: string
  onMatchClick: (p1: string, p2: string) => void
}) {
  const [filter, setFilter] = useState<'all' | 'live' | 'completed' | 'upcoming'>('all')

  if (matches.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '60px 20px' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: V.surface2, border: `1px solid ${V.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>⌛</div>
        <div style={{ fontFamily: V.FD, fontSize: 13, fontWeight: 700, color: V.dim, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
          ブラケット情報を取得中...
        </div>
        <div style={{ fontFamily: V.FB, fontSize: 12, color: `${V.dim}99` }}>
          start.gg からデータを読み込んでいます
        </div>
      </div>
    )
  }

  const live      = matches.filter((m: any) => m.status === 'live')
  const completed = matches.filter((m: any) => m.status === 'completed')
  const upcoming  = matches.filter((m: any) => m.status === 'upcoming' || m.status === 'pending')
  const sortedC   = [...completed].sort((a, b) => bracketRoundSort(a.round) - bracketRoundSort(b.round))
  const sortedU   = [...upcoming].sort((a, b) => bracketRoundSort(a.round) - bracketRoundSort(b.round))

  const display = filter === 'live'      ? live
               : filter === 'completed'  ? sortedC
               : filter === 'upcoming'   ? sortedU
               : [...live, ...sortedC.slice(-30), ...sortedU.slice(0, 10)]

  const filterBtns = [
    { id: 'all' as const,       label: 'ALL',     count: matches.length },
    { id: 'live' as const,      label: '● LIVE',  count: live.length },
    { id: 'completed' as const, label: '完了',     count: completed.length },
    { id: 'upcoming' as const,  label: '次の試合', count: upcoming.length },
  ].filter(f => f.count > 0 || f.id === 'all')

  return (
    <div style={{ padding: '14px 0' }}>
      {/* フィルターバー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {filterBtns.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: filter === f.id ? V.surface3 : 'transparent',
              border: `1px solid ${filter === f.id ? V.border2 : V.border}`,
              borderRadius: 5, padding: '3px 10px', cursor: 'pointer',
              fontFamily: V.FD, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              color: filter === f.id ? (f.id === 'live' ? V.red : V.accent) : V.muted,
            }}>
              {f.label}{f.count > 0 ? <span style={{ opacity: 0.65 }}> ({f.count})</span> : null}
            </button>
          ))}
        </div>
        {lastUpdated && (
          <div style={{ fontFamily: V.FD, fontSize: 10, color: V.dim }}>更新: {lastUpdated}</div>
        )}
      </div>

      {/* 試合行 */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {display.map((m: any, i: number) => {
          const isLive = m.status === 'live'
          const isDone = m.status === 'completed'
          const canClick = m.player1 && m.player2 && m.player1 !== 'TBD' && m.player2 !== 'TBD'
          return (
            <div
              key={i}
              onClick={() => canClick && onMatchClick(m.player1, m.player2)}
              style={{
                padding: '10px 16px',
                borderBottom: `1px solid ${V.border}`,
                cursor: canClick ? 'pointer' : 'default',
                background: isLive ? 'rgba(255,77,106,0.05)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (canClick) (e.currentTarget as HTMLDivElement).style.background = V.surface2 }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isLive ? 'rgba(255,77,106,0.05)' : 'transparent' }}
            >
              {/* ラウンド + グループ + ステータス */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontFamily: V.FD, fontSize: 10, color: V.dim, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                  {m.round}
                </span>
                {m.group && (
                  <><span style={{ color: V.dim, fontSize: 10 }}>·</span>
                  <span style={{ fontFamily: V.FD, fontSize: 10, color: `${V.dim}88` }}>{m.group}</span></>
                )}
                {isLive && (
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span className="sf6live-dot" style={{ width: 5, height: 5 }} />
                    <span style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 800, color: V.red, letterSpacing: '0.1em' }}>LIVE</span>
                  </span>
                )}
              </div>

              {/* P1 – スコア – P2 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                  <span style={{
                    fontFamily: V.FD, fontSize: 14, fontWeight: 700, display: 'block',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    color: isDone ? (m.winner === m.player1 ? V.text : V.dim) : V.text,
                  }}>{m.player1 || 'TBD'}</span>
                </div>
                <div style={{
                  fontFamily: V.FD, fontSize: isDone ? 14 : 11, fontWeight: 900,
                  color: isDone ? V.text : V.dim,
                  minWidth: 38, textAlign: 'center', flexShrink: 0,
                  background: isDone ? V.surface2 : 'transparent',
                  border: isDone ? `1px solid ${V.border}` : 'none',
                  borderRadius: 4, padding: isDone ? '2px 6px' : '0',
                }}>{isDone ? m.score : 'VS'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontFamily: V.FD, fontSize: 14, fontWeight: 700, display: 'block',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    color: isDone ? (m.winner === m.player2 ? V.text : V.dim) : V.text,
                  }}>{m.player2 || 'TBD'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {display.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', fontFamily: V.FD, fontSize: 13, color: V.dim }}>
          該当する試合がありません
        </div>
      )}
    </div>
  )
}

// ── StreamCenter ──────────────────────────────────────────────────────────────

function StreamCenter({
  score, centerTab, setCenterTab,
  hasStream, streamPlatform, streamChannel,
  twitchChannels,
  isStreamLive, streamInfo,
  player1, player2, h2hData,
  tournamentId, dbTournamentId, tournamentSlug, startggMatches, configName, cc12LastUpdated,
  ewcQualifier, ewcSlots, cptPremier,
  locationLabel,
  timezone, streamStartTime, startDate, endDate,
  onMatchClick, onStreamQueueMatch,
}: {
  score: { p1: number; p2: number }
  centerTab: 'stream' | 'bracket'
  setCenterTab: (t: 'stream' | 'bracket') => void
  hasStream: boolean
  streamPlatform: string | null
  streamChannel: string | null
  twitchChannels?: { name: string; channel: string }[]
  isStreamLive: boolean
  streamInfo: { title: string; viewerCount: number; gameName: string }
  player1: Player | null
  player2: Player | null
  h2hData: H2HData | null
  tournamentId: string
  dbTournamentId?: number
  tournamentSlug?: string
  startggMatches: any[]
  configName: string
  cc12LastUpdated: string
  ewcQualifier?: boolean
  ewcSlots?: number
  cptPremier?: boolean
  locationLabel?: string
  timezone: string
  streamStartTime?: string
  startDate?: string
  endDate?: string
  onMatchClick: (p1: string, p2: string) => void
  onStreamQueueMatch?: (p1Handle: string, p2Handle: string, p1PlayerId?: number, p2PlayerId?: number) => void
}) {
  // マルチチャンネル: 選択中のチャンネルインデックス
  const [activeChanIdx, setActiveChanIdx] = useState(0)
  // アクティブストリームチャンネル (複数設定時は選択, 単一時は streamChannel)
  const activeStreamChannel = (twitchChannels && twitchChannels.length > 0)
    ? (twitchChannels[activeChanIdx]?.channel ?? streamChannel)
    : streamChannel

  // ── 現地時間 + DAY インジケーター ─────────────────────────────────────────
  const [venueTime, setVenueTime] = useState('')
  const [dayLabel, setDayLabel] = useState('')

  useEffect(() => {
    const tz = timezone || 'UTC'
    const update = () => {
      const now = new Date()
      // 現地時刻
      const timeParts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
      }).formatToParts(now)
      const tzAbbr = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, timeZoneName: 'short',
      }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? ''
      const timeStr = timeParts.map(p => p.value).join('').trim()
      const prefix = locationLabel ? `${locationLabel} — ` : ''
      setVenueTime(`${prefix}${timeStr} ${tzAbbr}`)

      // DAY X / Y 計算
      if (startDate && endDate) {
        const start = new Date(startDate + 'T00:00:00')
        const end   = new Date(endDate   + 'T23:59:59')
        const total = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
        if (now < start) {
          const d = Math.ceil((start.getTime() - now.getTime()) / 86400000)
          setDayLabel(`STARTS IN ${d}D`)
        } else if (now > end) {
          setDayLabel('COMPLETED')
        } else {
          const day = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1
          setDayLabel(`DAY ${day} / ${total}`)
        }
      } else {
        setDayLabel('')
      }
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [timezone, startDate, endDate])

  // ── カウントダウン (配信開始前) ───────────────────────────────────────────
  const [countdown, setCountdown] = useState('')
  // streamStartTime が未来なら最初からカウントダウン表示（iframeのチラつき防止）
  const [showStream, setShowStream] = useState(() => {
    if (!streamStartTime) return true
    return new Date(streamStartTime).getTime() <= Date.now()
  })

  useEffect(() => {
    if (!streamStartTime) { setShowStream(true); return }
    const target = new Date(streamStartTime).getTime()
    const update = () => {
      const diff = target - Date.now()
      if (diff <= 0) { setShowStream(true); setCountdown(''); return }
      setShowStream(false)
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000)  / 60000)
      const s = Math.floor((diff % 60000)    / 1000)
      const parts = d > 0
        ? [`${d}D`, String(h).padStart(2,'0'), String(m).padStart(2,'0'), String(s).padStart(2,'0')]
        : [String(h).padStart(2,'0'), String(m).padStart(2,'0'), String(s).padStart(2,'0')]
      setCountdown(parts.join(' : '))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [streamStartTime])

  // ── streamQueue 自動検出 (10秒ポーリング) ────────────────────────────────
  const [streamQueueActive, setStreamQueueActive] = useState(false)
  useEffect(() => {
    if (!tournamentSlug) return
    let autoMode = true  // 手動上書き中はスキップ
    const poll = async () => {
      if (!autoMode) return
      try {
        const res  = await fetch(`/api/stream-queue/${tournamentSlug}`)
        const data = await res.json()
        if (data.currentSet && !data.isStale) {
          setStreamQueueActive(true)
          const { p1PlayerId, p2PlayerId, p1GamerTag, p2GamerTag, p1Name, p2Name } = data.currentSet
          const p1h = p1GamerTag || p1Name || ''
          const p2h = p2GamerTag || p2Name || ''
          if (p1h && p2h && onStreamQueueMatch) {
            onStreamQueueMatch(p1h, p2h, p1PlayerId, p2PlayerId)
          }
        } else {
          setStreamQueueActive(false)
        }
      } catch { /* ネットワークエラーは無視 */ }
    }
    poll()
    const id = setInterval(poll, 10_000)
    return () => clearInterval(id)
  }, [tournamentSlug, onStreamQueueMatch])

  // H2H バーは P1/P2 固定カラーで統一（キャラカラーではなく）
  const p1color = V.P1   // マゼンタ
  const p2color = V.P2   // ブルー

  const summary  = h2hData?.summary
  const total    = summary ? (summary.player1_wins + summary.player2_wins) : 0

  const recent10 = (h2hData?.sets ?? []).slice(-10).map(s => {
    if (!player1 || !player2) return null
    if (s.winner_id === player1.id) return 'p1'
    if (s.winner_id === player2.id) return 'p2'
    return null
  }).filter(Boolean) as ('p1' | 'p2')[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
      {/* ラウンド帯 + タブ */}
      <div style={{
        background: V.surface2, border: `1px solid ${V.border}`,
        borderRadius: '10px 10px 0 0', padding: '0 20px',
        display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', minHeight: 46,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
          <div style={{
            fontFamily: V.FD, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase' as const,
            color: V.accent,
          }}>{configName}</div>
          {/* EWC バッジ */}
          {ewcQualifier && (
            <span style={{
              fontFamily: V.FD, fontSize: 10, fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.45)',
              borderRadius: 4, padding: '2px 7px', color: '#f5c842',
              whiteSpace: 'nowrap' as const,
            }}>🏆 EWC {ewcSlots && `×${ewcSlots}`}</span>
          )}
          {/* CPT Premier バッジ */}
          {cptPremier && (
            <span style={{
              fontFamily: V.FD, fontSize: 10, fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              background: 'rgba(16,185,129,0.12)', border: `1px solid ${V.accent}55`,
              borderRadius: 4, padding: '2px 7px', color: V.accent,
              whiteSpace: 'nowrap' as const,
            }}>CPT PREMIER</span>
          )}
          {/* DAY インジケーター */}
          {dayLabel && (
            <span style={{
              fontFamily: V.FD, fontSize: 10, fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              background: dayLabel.startsWith('DAY') ? 'rgba(16,185,129,0.12)'
                        : dayLabel === 'COMPLETED'   ? 'rgba(100,120,140,0.15)'
                        : 'rgba(100,120,140,0.1)',
              border: `1px solid ${dayLabel.startsWith('DAY') ? V.accent + '44' : V.border}`,
              borderRadius: 4, padding: '2px 7px',
              color: dayLabel.startsWith('DAY') ? V.accent : V.muted,
              whiteSpace: 'nowrap' as const,
            }}>{dayLabel}</span>
          )}
          {/* streamQueue 自動検出バッジ */}
          {streamQueueActive && (
            <span style={{
              fontFamily: V.FD, fontSize: 9, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase' as const,
              background: 'rgba(0,212,170,0.15)', border: `1px solid ${V.accent}55`,
              borderRadius: 4, padding: '2px 7px', color: V.accent,
              whiteSpace: 'nowrap' as const, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%', background: V.accent,
                display: 'inline-block', animation: 'sf6-pulse-dot 1.2s ease-in-out infinite',
              }} />
              AUTO
            </span>
          )}
          {/* 現地時刻 */}
          {venueTime && (
            <div style={{ fontFamily: V.FD, fontSize: 12, fontWeight: 600, color: V.dim, letterSpacing: '0.04em' }}>
              {venueTime}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {[
            ...(hasStream ? [{ id: 'stream' as const, label: '▶ STREAM' }] : []),
            { id: 'bracket' as const, label: 'BRACKET' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setCenterTab(tab.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 16px',
              fontFamily: V.FD, fontSize: 12, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              color: centerTab === tab.id ? V.accent : V.muted,
              borderBottom: centerTab === tab.id ? `2px solid ${V.accent}` : '2px solid transparent',
              transition: 'color 0.15s',
            }}>{tab.label}</button>
          ))}
        </div>
      </div>

      {/* ブラケットタブ: 配信画面と同じ aspect-ratio で高さ固定 */}
      {centerTab === 'bracket' && (
        <div style={{
          border: `1px solid ${V.border}`, borderTop: 'none',
          borderRadius: '0 0 10px 10px', background: V.surface,
          aspectRatio: '16/9', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <LiveSetsTable
            tournamentId={tournamentId}
            dbTournamentId={dbTournamentId}
            onMatchClick={onMatchClick}
          />
        </div>
      )}

      {/* ストリームタブ */}
      {centerTab === 'stream' && (
        <>
          {/* ── チャンネル選択バー (複数チャンネル設定時) ── */}
          {twitchChannels && twitchChannels.length > 1 && (
            <div style={{
              display: 'flex', gap: 4, flexWrap: 'wrap' as const,
              padding: '8px 14px',
              background: V.surface2,
              border: `1px solid ${V.border}`, borderTop: 'none',
            }}>
              {twitchChannels.map((ch, i) => (
                <button
                  key={ch.channel}
                  onClick={() => setActiveChanIdx(i)}
                  style={{
                    background: activeChanIdx === i ? V.surface3 : 'transparent',
                    border: `1px solid ${activeChanIdx === i ? V.accent + '55' : V.border}`,
                    borderRadius: 5, padding: '4px 12px', cursor: 'pointer',
                    fontFamily: V.FD, fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.07em',
                    color: activeChanIdx === i ? V.accent : V.muted,
                    transition: 'color 0.15s, background 0.15s',
                  }}
                >{ch.name}</button>
              ))}
            </div>
          )}

          {/* ストリーム埋め込み */}
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '16/9',
            background: V.surface2,
            border: `1px solid ${V.border}`, borderTop: 'none',
            overflow: 'hidden',
          }}>
            {/* カラーティント */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(160deg, ${p1color}0a 0%, ${V.bg} 50%, ${p2color}0a 100%)`,
            }} />

            {(showStream && hasStream && activeStreamChannel) ? (
              <iframe
                key={activeStreamChannel}
                src={
                  streamPlatform === 'twitch'
                    ? `https://player.twitch.tv/?channel=${activeStreamChannel}&parent=sf6-database.vercel.app&parent=localhost`
                    : `https://www.youtube.com/embed/${activeStreamChannel}?autoplay=1`
                }
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                allowFullScreen
                allow="autoplay; encrypted-media"
              />
            ) : (
              <CountdownDisplay
                countdown={countdown}
                streamStartTime={streamStartTime}
                configName={configName}
                streamChannel={activeStreamChannel}
              />
            )}

            {/* LIVE バッジ */}
            {isStreamLive && (
              <div style={{
                position: 'absolute', top: 12, left: 12,
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,77,106,0.9)', borderRadius: 4, padding: '4px 10px',
                fontFamily: V.FD, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#fff',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                LIVE
              </div>
            )}
            {isStreamLive && streamInfo.viewerCount > 0 && (
              <div style={{
                position: 'absolute', top: 12, right: 12,
                background: 'rgba(8,12,20,0.88)', border: `1px solid ${V.border}`,
                borderRadius: 4, padding: '4px 10px',
                fontFamily: V.FD, fontSize: 12, fontWeight: 700, color: V.muted,
              }}>👁 {streamInfo.viewerCount.toLocaleString()}</div>
            )}

          </div>

          {/* H2H バー */}
          <div style={{
            background: V.surface, border: `1px solid ${V.border}`,
            borderTop: 'none', borderRadius: '0 0 10px 10px',
            padding: '14px 20px',
          }}>
            {summary && total > 0 ? (
              <>
                {/* 勝敗数 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: V.FD, fontSize: 20, fontWeight: 900, color: p1color }}>{summary.player1_wins}</span>
                    <span style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: V.dim, textTransform: 'uppercase' }}>勝</span>
                  </div>
                  <div style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: V.dim }}>
                    通算 H2H · {total}戦
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: V.dim, textTransform: 'uppercase' }}>勝</span>
                    <span style={{ fontFamily: V.FD, fontSize: 20, fontWeight: 900, color: p2color }}>{summary.player2_wins}</span>
                  </div>
                </div>

                {/* セグメントバー: マゼンタ(P1) / ブルー(P2) */}
                <div style={{ height: 8, display: 'flex', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{
                    width: `${Math.round(summary.player1_wins / total * 100)}%`,
                    background: `linear-gradient(90deg, ${p1color}cc, ${p1color})`,
                    transition: 'width 1s ease',
                  }} />
                  <div style={{ flex: 1, background: `linear-gradient(90deg, ${p2color}, ${p2color}cc)` }} />
                </div>

                {/* 直近10試合カラーブロック */}
                {recent10.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontFamily: V.FD, fontSize: 10, color: V.dim, letterSpacing: '0.08em', marginRight: 4, flexShrink: 0 }}>
                      直近{recent10.length}試合
                    </span>
                    {recent10.map((r, i) => (
                      <div key={i} style={{
                        width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                        background: r === 'p1' ? p1color : p2color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: V.FD, fontSize: 10, fontWeight: 900, color: '#fff',
                        boxShadow: r === 'p1' ? `0 0 6px ${p1color}60` : `0 0 6px ${p2color}60`,
                      }}>
                        {r === 'p1'
                          ? (player1?.handle?.charAt(0) ?? 'P')
                          : (player2?.handle?.charAt(0) ?? 'P')}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontFamily: V.FD, fontSize: 12, color: V.dim, textAlign: 'center', padding: '4px 0' }}>
                {player1 && player2 ? 'H2H データ読み込み中...' : '選手を選択して H2H を表示'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── LiveChat ──────────────────────────────────────────────────────────────────

const INIT_CHAT = [
  { id: 1, user: 'sf6_fan',    color: '#10b981', msg: '試合開始！' },
  { id: 2, user: 'evo_viewer', color: '#3b82f6', msg: '今日の試合楽しみ' },
  { id: 3, user: 'hadouken',   color: '#f5a623', msg: '選手を選択してH2Hを確認しよう' },
  { id: 4, user: 'capcom_pro', color: '#2e9e5b', msg: 'ブラケット確認中' },
  { id: 5, user: 'tokyoFC',    color: '#ec4899', msg: 'よろしくお願いします！' },
]

function LiveChat({
  twitchChatChannels,
  fillHeight = false,
}: {
  twitchChatChannels?: string[]
  fillHeight?: boolean
}) {
  const [selectedIdx, setSelectedIdx]   = useState(0)
  const [messages, setMessages]         = useState(INIT_CHAT)
  const [input, setInput]               = useState('')
  const bottomRef                       = useRef<HTMLDivElement>(null)
  const idRef                           = useRef(6)

  // ── Twitch chat iframe mode ──────────────────────────────────────────────
  if (twitchChatChannels && twitchChatChannels.length > 0) {
    const channel = twitchChatChannels[selectedIdx] ?? twitchChatChannels[0]
    return (
      // fillHeight=true: 親の flex-fill に合わせて伸縮。false: 固定 420px (後方互換)
      <div style={{
        display: 'flex', flexDirection: 'column',
        ...(fillHeight ? { flex: 1, minHeight: 0 } : { height: 420 }),
      }}>
        {/* チャンネル切り替え (複数ある場合) */}
        {twitchChatChannels.length > 1 && (
          <div style={{
            display: 'flex', gap: 4, padding: '6px 10px',
            borderBottom: `1px solid ${V.border}`, background: V.surface2,
            flexWrap: 'wrap' as const, flexShrink: 0,
          }}>
            {twitchChatChannels.map((ch, i) => (
              <button key={ch} onClick={() => setSelectedIdx(i)} style={{
                background: selectedIdx === i ? V.surface3 : 'transparent',
                border: `1px solid ${selectedIdx === i ? V.accent + '50' : V.border}`,
                borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                fontFamily: V.FD, fontSize: 11, fontWeight: 700,
                color: selectedIdx === i ? V.accent : V.muted,
              }}>{ch}</button>
            ))}
          </div>
        )}
        <iframe
          key={channel}
          src={`https://www.twitch.tv/embed/${channel}/chat?parent=localhost&parent=sf6-database.vercel.app&darkpopout`}
          style={{ flex: 1, border: 'none', width: '100%', minHeight: 0 }}
          title={`Twitch chat: ${channel}`}
          allowFullScreen
        />
      </div>
    )
  }

  // ── Fallback: モックチャット ──────────────────────────────────────────────
  useEffect(() => {
    if (bottomRef.current?.parentElement) {
      bottomRef.current.parentElement.scrollTop = bottomRef.current.parentElement.scrollHeight
    }
  }, [messages])

  const send = () => {
    if (!input.trim()) return
    const now  = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setMessages(prev => [...prev.slice(-40), {
      id: idRef.current++, user: 'あなた', color: V.accent,
      msg: input.trim(), time, isMe: true,
    } as any])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 260 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.map((m: any) => (
          <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontFamily: V.FD, fontSize: 12, fontWeight: 700, color: m.color, flexShrink: 0, minWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user}</span>
            <span style={{ fontFamily: V.FB, fontSize: 13, color: m.isMe ? V.accent : V.text, lineHeight: 1.4 }}>{m.msg}</span>
            {m.time && <span style={{ marginLeft: 'auto', fontFamily: V.FD, fontSize: 10, color: V.dim, flexShrink: 0 }}>{m.time}</span>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ borderTop: `1px solid ${V.border}`, padding: '10px 14px', display: 'flex', gap: 8 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="コメントを入力..."
          style={{
            flex: 1, background: V.surface3, border: `1px solid ${V.border}`,
            borderRadius: 6, padding: '7px 12px',
            color: V.text, fontFamily: V.FB, fontSize: 13, outline: 'none',
          }}
        />
        <button onClick={send} style={{
          background: V.accent, border: 'none', borderRadius: 6,
          padding: '7px 14px', cursor: 'pointer',
          fontFamily: V.FD, fontSize: 12, fontWeight: 800,
          letterSpacing: '0.06em', color: '#000',
        }}>送信</button>
      </div>
    </div>
  )
}

// ── shortenRound — ラウンド名を短縮表示 ──────────────────────────────────────
// "Round 1 - B113 — Winners Quarter-Final" → "WQF"
// "Round 1 - B133 — Losers Round 1"        → "LR1"

function shortenRound(roundText: string): string {
  // " — " で分割してラウンド部分のみ取り出す
  const parts = roundText.split(' — ')
  const round = (parts.length > 1 ? parts[parts.length - 1] : roundText).trim()

  const ABBREV: Record<string, string> = {
    'Grand Final Reset':   'GFR',
    'Grand Final':         'GF',
    'Winners Final':       'WF',
    'Winners Semi-Final':  'WSF',
    'Winners Quarter-Final': 'WQF',
    'Losers Final':        'LF',
    'Losers Semi-Final':   'LSF',
    'Losers Quarter-Final': 'LQF',
  }
  if (ABBREV[round]) return ABBREV[round]

  const wr = round.match(/^Winners Round (\d+)$/)
  if (wr) return `WR${wr[1]}`

  const lr = round.match(/^Losers Round (\d+)$/)
  if (lr) return `LR${lr[1]}`

  const r = round.match(/^Round (\d+)$/)
  if (r) return `R${r[1]}`

  // それ以外は先頭 12 文字で打ち切り
  return round.length > 12 ? round.slice(0, 12) + '…' : round
}

// ── SidePanelLeft — Twitch チャット表示 ────────────────────────────────────────

function SidePanelLeft({
  twitchChatChannels,
}: {
  player1: Player | null
  player2: Player | null
  twitchChatChannels?: string[]
}) {
  return (
    <div style={{
      background: V.surface, border: `1px solid ${V.border}`, borderRadius: 10,
      overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      {/* ヘッダー */}
      <div style={{
        background: V.surface2, borderBottom: `1px solid ${V.border}`,
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: V.FD, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase' as const,
          color: V.accent,
        }}>💬 LIVE CHAT</div>
      </div>
      {/* チャット本体: flex-fill で残り高さを全て使う */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <LiveChat twitchChatChannels={twitchChatChannels} fillHeight />
      </div>
    </div>
  )
}

// ── CountdownDisplay — 配信前カウントダウンオーバーレイ ────────────────────────

function CountdownDisplay({
  countdown, streamStartTime, configName, streamChannel,
}: {
  countdown: string
  streamStartTime?: string
  configName: string
  streamChannel: string | null
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(160deg, #050810 0%, #0a0e1a 60%, #060c18 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 18,
    }}>
      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(16,185,129,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      {/* Glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400, height: 200,
        background: `radial-gradient(ellipse, ${V.accent}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* 大会名 */}
      <div style={{
        position: 'relative',
        fontFamily: V.FD, fontSize: 12, fontWeight: 700,
        letterSpacing: '0.22em', textTransform: 'uppercase' as const,
        color: 'rgba(255,255,255,0.35)',
      }}>{configName}</div>

      {/* カウントダウン or Coming Soon */}
      <div style={{ position: 'relative', textAlign: 'center' }}>
        {countdown ? (
          <>
            <div style={{
              fontFamily: V.FD, fontSize: 11, fontWeight: 600,
              letterSpacing: '0.18em', textTransform: 'uppercase' as const,
              color: 'rgba(255,255,255,0.25)', marginBottom: 8,
            }}>配信開始まで</div>
            <div style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 'clamp(26px, 4.5vw, 50px)', fontWeight: 700,
              color: '#ffffff', letterSpacing: '0.08em',
              textShadow: `0 0 32px ${V.accent}55`,
            }}>{countdown}</div>
          </>
        ) : streamStartTime ? (
          <div style={{ fontFamily: V.FD, fontSize: 18, fontWeight: 700, color: V.accent, letterSpacing: '0.08em' }}>
            配信開始間近...
          </div>
        ) : (
          <div style={{ fontFamily: V.FD, fontSize: 15, color: V.muted, letterSpacing: '0.1em' }}>
            配信開始時刻 — COMING SOON
          </div>
        )}
      </div>

      {/* チャンネルリンク */}
      {streamChannel && (
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{
            fontFamily: V.FD, fontSize: 10, color: 'rgba(255,255,255,0.22)',
            letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: 5,
          }}>配信チャンネル</div>
          <a href={`https://twitch.tv/${streamChannel}`} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: V.FD, fontSize: 13, fontWeight: 700, color: V.accent, letterSpacing: '0.06em', textDecoration: 'none' }}>
            twitch.tv/{streamChannel}
          </a>
        </div>
      )}
    </div>
  )
}

// ── FeaturedMatchesPanel ─────────────────────────────────────────────────────

function FeaturedMatchesPanel({
  matches,
  mode,
  onMatchClick,
}: {
  matches: any[]
  mode: 'live' | 'latest' | 'recent'
  onMatchClick: (p1: string, p2: string) => void
}) {
  // 上位 10 件をそのまま表示（2列×5行グリッド）
  const display = matches.slice(0, 10)

  return (
    <div style={{
      background: V.surface, border: `1px solid ${V.border}`, borderRadius: 10,
      overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      {/* ヘッダー */}
      <div style={{
        background: V.surface2, borderBottom: `1px solid ${V.border}`,
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontFamily: V.FD, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: mode === 'latest' ? V.gold : V.accent }}>
          {mode === 'live' ? '🔥 Featured Matches' : mode === 'latest' ? '⚡ Latest Results' : '📋 Recent Matches'}
        </div>
        {display.length > 0 && (
          <div style={{ fontFamily: V.FD, fontSize: 11, color: V.dim }}>
            H2H を確認
          </div>
        )}
      </div>

      {/* 2列カードグリッド: overflow-y でスクロール可 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' as const, padding: '10px 10px 8px' }}>
      {display.length === 0 ? (
        <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: V.surface2, border: `1px solid ${V.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: V.FD, fontSize: 20, color: V.dim,
          }}>🔥</div>
          <div style={{ fontFamily: V.FD, fontSize: 12, color: V.dim, textAlign: 'center', lineHeight: 1.5 }}>
            試合情報なし<br/>
            <span style={{ fontSize: 11, color: `${V.dim}99` }}>大会開始後に更新されます</span>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        }}>
          {display.map((m, i) => {
            const canClick = m.player1_handle !== 'TBD' && m.player2_handle !== 'TBD'
            const isLive   = m.status === 'live'
            return (
              <div key={i}
                onClick={() => canClick && onMatchClick(m.player1_handle, m.player2_handle)}
                style={{
                  background: isLive ? `rgba(16,185,129,0.07)` : V.surface2,
                  border: `1px solid ${isLive ? V.border2 : V.border}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  cursor: canClick ? 'pointer' : 'default',
                  transition: 'background 0.12s, border-color 0.12s',
                  minWidth: 0,
                }}
                onMouseEnter={e => { if (canClick) {
                  (e.currentTarget as HTMLElement).style.background = V.surface3
                  ;(e.currentTarget as HTMLElement).style.borderColor = `rgba(16,185,129,0.4)`
                }}}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = isLive ? `rgba(16,185,129,0.07)` : V.surface2
                  ;(e.currentTarget as HTMLElement).style.borderColor = isLive ? V.border2 : V.border
                }}
              >
                {/* 上段: ラウンド + スコア */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    {isLive && <span className="sf6live-dot" style={{ width: 5, height: 5, flexShrink: 0 }} />}
                    <span style={{
                      fontFamily: V.FD, fontSize: 13, fontWeight: 700,
                      letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                      color: isLive ? V.accent : V.dim,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    }}>{shortenRound(m.round_text || '')}</span>
                  </div>
                  {m.score && (
                    <span style={{
                      fontFamily: V.FD, fontSize: 14, fontWeight: 700,
                      color: V.muted, flexShrink: 0, letterSpacing: '0.04em',
                    }}>{(m.score as string).replace('-', ' - ')}</span>
                  )}
                </div>
                {/* 下段: P1 vs P2 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <span style={{
                    flex: 1, minWidth: 0,
                    fontFamily: V.FD, fontSize: 14,
                    fontWeight: m.winner_is_p1 === true ? 900 : 600,
                    color: m.winner_is_p1 === true  ? V.accent
                         : m.winner_is_p1 === false ? V.dim
                         : V.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    textAlign: 'right' as const,
                  }}>{m.player1_handle}</span>
                  <span style={{
                    fontFamily: V.FD, fontSize: 12, fontWeight: 700, color: V.dim,
                    flexShrink: 0,
                  }}>vs</span>
                  <span style={{
                    flex: 1, minWidth: 0,
                    fontFamily: V.FD, fontSize: 14,
                    fontWeight: m.winner_is_p1 === false ? 900 : 600,
                    color: m.winner_is_p1 === false ? V.accent
                         : m.winner_is_p1 === true  ? V.dim
                         : V.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    textAlign: 'left' as const,
                  }}>{m.player2_handle}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>{/* /カードグリッド */}
    </div>
  )
}

// ── NextMatchesPanel ──────────────────────────────────────────────────────────

function NextMatchesPanel({ matches }: { matches: any[] }) {
  return (
    <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* ヘッダー */}
      <div style={{
        background: V.surface2, borderBottom: `1px solid ${V.border}`,
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontFamily: V.FD, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: V.accent }}>
          次の試合
        </div>
        {matches.length > 0 && (
          <div style={{ fontFamily: V.FD, fontSize: 11, color: V.dim }}>
            {matches.length}試合
          </div>
        )}
      </div>

      {matches.length === 0 ? (
        /* データなし */
        <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: V.surface2, border: `1px solid ${V.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: V.FD, fontSize: 20, color: V.dim,
          }}>⏱</div>
          <div style={{ fontFamily: V.FD, fontSize: 12, color: V.dim, textAlign: 'center', lineHeight: 1.5 }}>
            試合情報なし<br />
            <span style={{ fontSize: 11, color: `${V.dim}99` }}>大会開始後に更新されます</span>
          </div>
        </div>
      ) : (
        matches.map((m, i) => (
          <div
            key={i}
            className="sf6live-next-row"
            style={{
              padding: '12px 16px',
              borderBottom: i < matches.length - 1 ? `1px solid ${V.border}` : 'none',
              cursor: 'pointer', transition: 'background 0.1s',
            }}
          >
            {/* ラウンド + ステータス */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <div style={{
                fontFamily: V.FD, fontSize: 10, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: V.dim,
              }}>{m.round_text}</div>
              {m.status === 'live' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="sf6live-dot" style={{ width: 5, height: 5 }} />
                  <span style={{ fontFamily: V.FD, fontSize: 10, fontWeight: 800, color: V.red, letterSpacing: '0.1em' }}>LIVE</span>
                </div>
              )}
            </div>

            {/* P1 vs P2 カード */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* P1 */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', minWidth: 0 }}>
                <span style={{ fontFamily: V.FD, fontSize: 14, fontWeight: 700, color: V.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.player1_handle}
                </span>
                {m.player1_char && <CharPill name={m.player1_char} size={10} />}
                {m.player1_country && <span style={{ fontSize: 13 }}>{codeToFlag(m.player1_country)}</span>}
              </div>

              {/* VS */}
              <div style={{
                fontFamily: V.FD, fontSize: 11, fontWeight: 900,
                color: V.dim, letterSpacing: '0.06em', flexShrink: 0,
                padding: '2px 8px', background: V.surface2,
                borderRadius: 4, border: `1px solid ${V.border}`,
              }}>VS</div>

              {/* P2 */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-start', minWidth: 0 }}>
                {m.player2_country && <span style={{ fontSize: 13 }}>{codeToFlag(m.player2_country)}</span>}
                {m.player2_char && <CharPill name={m.player2_char} size={10} />}
                <span style={{ fontFamily: V.FD, fontSize: 14, fontWeight: 700, color: V.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.player2_handle}
                </span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ── SearchModal ───────────────────────────────────────────────────────────────

function SearchModal({
  searchSide, searchQuery, setSearchQuery,
  searchResults, onSelect, onClose,
}: {
  searchSide: 'p1' | 'p2' | null
  searchQuery: string
  setSearchQuery: (q: string) => void
  searchResults: Player[]
  onSelect: (p: Player) => void
  onClose: () => void
}) {
  const sideColor = searchSide === 'p1' ? V.P1 : V.P2
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 80,
    }}>
      <div style={{
        background: V.surface2, border: `1px solid ${sideColor}35`,
        borderRadius: 12, width: '100%', maxWidth: 420, padding: 20, margin: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: sideColor,
              boxShadow: `0 0 8px ${sideColor}`,
            }} />
            <span style={{ fontFamily: V.FD, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: sideColor }}>
              {searchSide === 'p1' ? 'P1 選択' : 'P2 選択'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.muted, fontSize: 18 }}>✕</button>
        </div>
        <input
          type="text" autoFocus
          placeholder="選手名を検索..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', background: V.surface3, border: `1px solid ${V.border}`,
            borderRadius: 8, padding: '10px 14px',
            color: V.text, fontFamily: V.FB, fontSize: 14, outline: 'none', marginBottom: 10,
          }}
        />
        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {searchResults.map(p => (
            <button key={p.id} onClick={() => onSelect(p)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px', borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer', textAlign: 'left',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = V.surface3)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: `${sideColor}20`, border: `1px solid ${sideColor}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: V.FD, fontSize: 14, fontWeight: 700, color: sideColor, flexShrink: 0,
              }}>{p.handle.charAt(0)}</div>
              <div>
                <div style={{ fontFamily: V.FD, fontSize: 14, fontWeight: 700, color: V.text }}>{p.handle}</div>
                <div style={{ fontFamily: V.FD, fontSize: 11, color: V.muted }}>
                  {p.country_code && `${codeToFlag(p.country_code)} `}{p.main_character ?? ''}{p.team ? ` · ${p.team}` : ''}
                </div>
              </div>
            </button>
          ))}
          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <p style={{ textAlign: 'center', color: V.dim, fontFamily: V.FD, fontSize: 13, padding: '16px 0' }}>見つかりませんでした</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LivePage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params)

  const [player1, setPlayer1]           = useState<Player | null>(null)
  const [player2, setPlayer2]           = useState<Player | null>(null)
  const [h2hData, setH2hData]           = useState<H2HData | null>(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<Player[]>([])
  const [searchSide, setSearchSide]     = useState<'p1' | 'p2' | null>(null)
  const [showSearch, setShowSearch]     = useState(false)
  const [score, setScore]               = useState({ p1: 0, p2: 0 })
  // clock は StreamCenter 内で timezone ベースに計算するため削除
  const [isStreamLive, setIsStreamLive] = useState(false)
  const [streamInfo, setStreamInfo]     = useState({ title: '', viewerCount: 0, gameName: '' })
  const [centerTab, setCenterTab]       = useState<'stream' | 'bracket'>('stream')
  const [cc12Matches, setCc12Matches]   = useState<any[]>([])
  const [cc12LastUpdated, setCc12LastUpdated] = useState('')
  const [startggMatches, setStartggMatches] = useState<any[]>([])
  const [autoDetected, setAutoDetected] = useState(false)
  const autoDetectKeyRef = useRef<string>('')

  // ── 大会設定 ────────────────────────────────────────────────────────────────
  const tournamentConfig: Record<string, {
    name: string
    streamPlatform: 'twitch' | 'youtube' | null
    streamChannel: string | null
    twitchChannels?: { name: string; channel: string }[]
    twitchChatChannels?: string[]
    startggEventId?: number
    startDate?: string
    endDate?: string
    dbTournamentId?: number   // Supabase tournaments.id (slug-keyed configs用)
    ewcQualifier?: boolean    // EWC 出場権がかかっているか
    ewcSlots?: number         // EWC 出場枠数
    cptPremier?: boolean      // CPT Premier 大会か
    locationLabel?: string    // 都市名表示 (e.g. "Atlanta, GA")
    timezone: string          // IANA timezone (e.g. "America/New_York")
    streamStartTime?: string  // 配信開始予定時刻 ISO 8601
    totalDays: number         // 大会日数
    phases: any[]
    results: any[]
  }> = {
    '9': {
      name: 'Capcom Cup 12',
      streamPlatform: null, streamChannel: null,
      startDate: '2026-03-11', endDate: '2026-03-15',
      timezone: 'Asia/Tokyo', totalDays: 4,
      phases: [
        { name: 'Phase 1', format: 'GSL (Double Elim) — FT3', groups: [
          { name: 'Group A', players: [{ name: 'Xiao Hai' }, { name: 'Blaz' }, { name: 'HotDog29' }, { name: 'Juicyjoe' }], matches: [
            { player1: 'Xiao Hai', player2: 'Juicyjoe', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'Blaz', player2: 'HotDog29', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
          ] },
          { name: 'Group B', players: [{ name: 'Kawano' }, { name: 'Fuudo' }, { name: 'EndingWalker' }, { name: 'Bravery' }], matches: [
            { player1: 'Kawano', player2: 'EndingWalker', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'Fuudo', player2: 'Bravery', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
          ] },
          { name: 'Group C', players: [{ name: 'Big Bird' }, { name: 'DakCorgi' }, { name: 'YHC-Mochi' }, { name: 'MenaRD' }], matches: [
            { player1: 'Big Bird', player2: 'YHC-Mochi', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'DakCorgi', player2: 'MenaRD', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
          ] },
          { name: 'Group D', players: [{ name: 'NL' }, { name: 'Sahara' }, { name: 'shaka22' }, { name: 'JabhiM' }], matches: [
            { player1: 'Sahara', player2: 'shaka22', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'NL', player2: 'JabhiM', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
          ] },
          { name: 'Group E', players: [{ name: 'YONANGEL' }, { name: 'Dual Kevin' }, { name: 'Caba' }, { name: 'pugera' }], matches: [
            { player1: 'YONANGEL', player2: 'Caba', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'Dual Kevin', player2: 'pugera', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
          ] },
          { name: 'Group F', players: [{ name: 'kincho' }, { name: 'Momochi' }, { name: 'Angry Bird' }, { name: 'Tashi' }], matches: [
            { player1: 'kincho', player2: 'Angry Bird', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'Momochi', player2: 'Tashi', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
          ] },
          { name: 'Group G', players: [{ name: 'gachikun' }, { name: 'Kobayan' }, { name: 'Vxbao' }, { name: 'NotPedro' }], matches: [
            { player1: 'gachikun', player2: 'Vxbao', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'Kobayan', player2: 'NotPedro', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
          ] },
          { name: 'Group H', players: [{ name: 'Leshar' }, { name: 'Ryukichi' }, { name: 'LUGABO' }, { name: 'Travis Styles' }], matches: [
            { player1: 'Leshar', player2: 'LUGABO', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'Ryukichi', player2: 'Travis Styles', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
          ] },
          { name: 'Group I', players: [{ name: 'Higuchi' }, { name: 'ARMAKOF' }, { name: 'Tokido' }, { name: 'Xerna' }], matches: [
            { player1: 'Higuchi', player2: 'Tokido', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'ARMAKOF', player2: 'Xerna', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
          ] },
          { name: 'Group J', players: [{ name: 'Rainpro' }, { name: 'Chris T' }, { name: 'Lexx' }, { name: 'Micky' }], matches: [
            { player1: 'Rainpro', player2: 'Lexx', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'Chris T', player2: 'Micky', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
          ] },
          { name: 'Group K', players: [{ name: 'Kilzyou' }, { name: 'NuckleDu' }, { name: 'Hinao' }, { name: 'lllRaihanlll' }], matches: [
            { player1: 'Kilzyou', player2: 'Hinao', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'NuckleDu', player2: 'lllRaihanlll', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
          ] },
          { name: 'Group L', players: [{ name: 'JAK' }, { name: 'Itabashi Zangief' }, { name: 'Deiver' }, { name: 'Jiewa' }], matches: [
            { player1: 'JAK', player2: 'Deiver', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'Itabashi Zangief', player2: 'Jiewa', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
            { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
          ] },
        ] },
        { name: 'Phase 2', format: 'Round Robin — FT3', groups: [
          { name: 'Group 1', players: [{ name: 'TBD' }, { name: 'TBD' }, { name: 'TBD' }], matches: [] },
          { name: 'Group 2', players: [{ name: 'TBD' }, { name: 'TBD' }, { name: 'TBD' }], matches: [] },
          { name: 'Group 3', players: [{ name: 'TBD' }, { name: 'TBD' }, { name: 'TBD' }], matches: [] },
          { name: 'Group 4', players: [{ name: 'TBD' }, { name: 'TBD' }, { name: 'TBD' }], matches: [] },
        ] },
        { name: 'Phase 3', format: 'Single Elim — FT5', groups: [
          { name: 'Top 16', players: Array(16).fill({ name: 'TBD' }), matches: [] },
        ] },
      ],
      results: [],
    },
    'dreamhack-birmingham': {
      name: 'DreamHack Birmingham 2026',
      streamPlatform: 'twitch', streamChannel: 'dreamhackfighters',
      startDate: '2026-03-27', endDate: '2026-03-29',
      timezone: 'Europe/London', totalDays: 2,
      startggEventId: 1554815,
      phases: [
        { name: 'Pools', format: 'Double Elimination Pools', groups: [{ name: 'Pool 1', players: Array(32).fill({ name: 'TBD' }), matches: [] }] },
        { name: 'Top 32', format: 'Double Elimination', groups: [{ name: 'Main Bracket', players: Array(32).fill({ name: 'TBD' }), matches: [] }] },
      ],
      results: [],
    },
    '40': {
      name: 'EVO Japan 2026',
      streamPlatform: 'twitch', streamChannel: 'evo',
      twitchChannels: [
        { name: 'EVO (EN)',          channel: 'evo' },
        { name: 'EVO Japan 1 (JP)', channel: 'evojapan01' },
        { name: 'EVO Japan 2 (JP)', channel: 'evojapan02' },
        { name: 'EVO Japan 3 (JP)', channel: 'evojapan03' },
        { name: 'EVO Japan 4 (JP)', channel: 'evojapan04' },
      ],
      twitchChatChannels: ['evo', 'evojapan01', 'evojapan02', 'evojapan03', 'evojapan04'],
      startDate: '2026-05-01', endDate: '2026-05-03',
      timezone: 'Asia/Tokyo', totalDays: 3,
      startggEventId: 1516510, dbTournamentId: 40,
      cptPremier: true,
      phases: [
        { name: 'Round 1', format: 'Double Elimination Pools', groups: [{ name: 'Pools', players: Array(32).fill({ name: 'TBD' }), matches: [] }] },
        { name: 'Finals', format: 'Double Elimination', groups: [{ name: 'Top 8', players: Array(8).fill({ name: 'TBD' }), matches: [] }] },
      ],
      results: [],
    },

    // ── Road to EWC: DreamHack Atlanta 2026 ──────────────────────────────
    'dh-atlanta-2026': {
      name: 'Road to EWC: DreamHack Atlanta 2026',
      streamPlatform: 'twitch', streamChannel: 'ewc_plus_en2',
      twitchChannels: [
        { name: 'EWC EN2 (メイン)',  channel: 'ewc_plus_en2' },
        { name: 'EWC EN (サブ)',     channel: 'ewc_plus_en' },
      ],
      twitchChatChannels: ['ewc_plus_en2', 'ewc_plus_en'],
      startDate: '2026-05-15', endDate: '2026-05-17',
      timezone: 'America/New_York', locationLabel: 'Atlanta, GA',
      totalDays: 3,
      streamStartTime: '2026-05-16T10:00:00-04:00',
      startggEventId: 1600986, dbTournamentId: 47,
      ewcQualifier: true, ewcSlots: 2,
      cptPremier: false,
      phases: [
        { name: 'Pools',  format: 'Double Elimination', groups: [{ name: 'Pools', players: [], matches: [] }] },
        { name: 'Top 32', format: 'Double Elimination', groups: [{ name: 'Top 32', players: [], matches: [] }] },
        { name: 'Top 8',  format: 'Double Elimination Ft5', groups: [{ name: 'Top 8', players: [], matches: [] }] },
      ],
      results: [],
    },

    // ── COMBO BREAKER 2026 ────────────────────────────────────────────────
    'combo-breaker-2026': {
      name: 'COMBO BREAKER 2026',
      streamPlatform: 'twitch', streamChannel: 'capcomfighters',
      twitchChannels: [
        { name: 'Capcom Fighters (メイン)', channel: 'capcomfighters' },
      ],
      twitchChatChannels: ['capcomfighters'],
      startDate: '2026-05-22', endDate: '2026-05-24',
      timezone: 'America/Chicago', locationLabel: 'Schaumburg, IL',
      totalDays: 3,
      streamStartTime: '2026-05-22T10:00:00-05:00',
      startggEventId: 1528962, dbTournamentId: 48,
      ewcQualifier: true, ewcSlots: 2,
      cptPremier: true,
      phases: [
        { name: 'Round 1', format: 'Double Elimination Pools', groups: [{ name: 'Round 1', players: [], matches: [] }] },
        { name: 'Round 2', format: 'Double Elimination',       groups: [{ name: 'Round 2', players: [], matches: [] }] },
        { name: 'Round 3', format: 'Double Elimination',       groups: [{ name: 'Round 3', players: [], matches: [] }] },
        { name: 'Top 24',  format: 'Double Elimination',       groups: [{ name: 'Top 24',  players: [], matches: [] }] },
        { name: 'Top 8',   format: 'Double Elimination Ft5',   groups: [{ name: 'Top 8',   players: [], matches: [] }] },
      ],
      results: [],
    },
  }

  // tournamentId が数値文字列 ("48") の場合、dbTournamentId でフォールバック検索
  const configKey: string = tournamentConfig[tournamentId]
    ? tournamentId
    : (Object.entries(tournamentConfig).find(([, c]) => c.dbTournamentId === Number(tournamentId))?.[0] ?? tournamentId)

  const config = tournamentConfig[configKey] ?? {
    name: 'Tournament', streamPlatform: 'twitch' as const, streamChannel: 'capcomfighters',
    endDate: '', phases: [], results: [], timezone: 'UTC' as const, totalDays: 1,
  }

  // stream-queue API 用スラッグ: 数値 ID の場合でも slug キーを取得
  const effectiveTournamentSlug: string | undefined = isNaN(Number(tournamentId))
    ? tournamentId
    : (configKey && isNaN(Number(configKey)) ? configKey : undefined)
  const hasStream      = !!config.streamPlatform && !!config.streamChannel
  const streamPlatform = config.streamPlatform
  const streamChannel  = config.streamChannel

  // クロックは StreamCenter 内で timezone ベースに計算

  // ── Twitch ポーリング (30秒) ──────────────────────────────────────────────
  useEffect(() => {
    if (!config.streamChannel || config.streamPlatform !== 'twitch') return
    const check = async () => {
      try {
        const res  = await fetch('/api/twitch?channel=' + config.streamChannel)
        const data = await res.json()
        setIsStreamLive(data.isLive || false)
        if (data.isLive) setStreamInfo({ title: data.title || '', viewerCount: data.viewerCount || 0, gameName: data.gameName || '' })
      } catch (e) { console.error('[Twitch]', e) }
    }
    check()
    const id = setInterval(check, 30000)
    return () => clearInterval(id)
  }, [config.streamChannel, config.streamPlatform])

  // ── H2H フェッチ ─────────────────────────────────────────────────────────
  const fetchH2H = useCallback(async (p1Id: number, p2Id: number) => {
    const res  = await fetch(`/api/head-to-head?p1=${p1Id}&p2=${p2Id}`)
    const data = await res.json()
    setH2hData(data)
  }, [])
  useEffect(() => {
    if (player1 && player2) fetchH2H(player1.id, player2.id)
    else setH2hData(null)
  }, [player1, player2, fetchH2H])

  // ── 選手検索 (300ms デバウンス) ──────────────────────────────────────────
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      const res  = await fetch(`/api/players/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setSearchResults(data.players || [])
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // ── CC12 Liquipedia ポーリング (60秒) ────────────────────────────────────
  useEffect(() => {
    if (hasStream) return
    const fetch_ = async () => {
      try {
        const res  = await fetch('/api/cc12/results?fresh=1')
        const data = await res.json()
        if (data.matches) { setCc12Matches(data.matches); setCc12LastUpdated(data.lastUpdated || '') }
      } catch (e) { console.error('[CC12]', e) }
    }
    fetch_()
    const id = setInterval(fetch_, 60000)
    return () => clearInterval(id)
  }, [hasStream])

  // ── start.gg ポーリング (30秒) ────────────────────────────────────────────
  useEffect(() => {
    if (!config.startggEventId) return
    const ended = config.endDate && new Date() > new Date(config.endDate + 'T23:59:59')
    const fetch_ = async () => {
      try {
        const res  = await fetch('/api/startgg?eventId=' + config.startggEventId + '&fresh=1')
        const data = await res.json()
        if (data.matches) setStartggMatches(data.matches)
        if (data.lastUpdated) setCc12LastUpdated(data.lastUpdated)
      } catch (e) { console.error('[startgg]', e) }
    }
    fetch_()
    if (!ended) { const id = setInterval(fetch_, 15000); return () => clearInterval(id) }
  }, [config.startggEventId, hasStream, searchQuery])

  // ── mergedPhases ──────────────────────────────────────────────────────────
  // start.gg フェーズ名とコンフィグフェーズ名が一致しない場合（例: "Round 1" vs "Pools"）の
  // フォールバック: 全 startggMatches を最初のフェーズに割り当て
  const startggMatchesAssigned = (() => {
    if (!config.startggEventId || startggMatches.length === 0 || config.phases.length === 0) return false
    const anyMatch = config.phases.some((ph: any) =>
      startggMatches.some((m: any) => (m.group || '').startsWith(ph.name) || (m.group || '').includes(ph.name))
    )
    return !anyMatch  // true = フェーズ名が全く一致しない → フォールバックが必要
  })()

  const mergedPhases = config.phases.map((phase: any, phaseIdx: number) => {
    if (config.startggEventId && startggMatches.length > 0) {
      const pm = startggMatches.filter((m: any) => (m.group || '').startsWith(phase.name) || (m.group || '').includes(phase.name))
      // フェーズ名不一致フォールバック: 最初のフェーズに全セットを割り当て
      const src = pm.length > 0 ? pm
        : (config.phases.length === 1 ? startggMatches
          : (startggMatchesAssigned && phaseIdx === 0 ? startggMatches : []))
      if (src.length > 0) {
        const groups: Record<string, any[]> = {}
        src.forEach((m: any) => { const g = m.group || phase.name; groups[g] = groups[g] || []; groups[g].push(m) })
        return {
          ...phase, groups: Object.entries(groups).map(([gn, ms]: [string, any[]]) => ({
            name: gn,
            players: [...new Set(ms.flatMap((m: any) => [m.player1, m.player2]).filter((p: string) => p && p !== 'TBD'))].map((p: string) => ({ name: p })),
            matches: ms.map((m: any) => ({ player1: m.player1, player2: m.player2, player1_handle: m.player1_handle, player2_handle: m.player2_handle, score: m.score, winner: m.winner, round: m.round, date: '', status: m.status })),
          })),
        }
      }
      return phase
    }
    const pm = cc12Matches.filter((m: any) => {
      if (phase.name === 'Phase 1') return m.group.startsWith('Group ') && !m.group.startsWith('P2')
      if (phase.name === 'Phase 2') return m.group.startsWith('P2 ')
      if (phase.name === 'Phase 3') return m.group.startsWith('P3 ')
      return false
    })
    if (pm.length === 0) return phase
    if (phase.name === 'Phase 2') {
      const g2: Record<string, any[]> = {}
      pm.forEach((m: any) => { const n = m.group.replace('P2 ', ''); g2[n] = g2[n] || []; g2[n].push(m) })
      return { ...phase, groups: Object.entries(g2).map(([n, ms]: [string, any[]]) => ({ name: n, players: [...new Set(ms.flatMap((m: any) => [m.player1, m.player2]))].map((p: string) => ({ name: p })), matches: ms.map((m: any) => ({ player1: m.player1, player2: m.player2, score: m.score, winner: m.winner, round: m.round, date: '', status: m.status })) })) }
    }
    if (phase.name === 'Phase 3') {
      const players = [...new Set(pm.flatMap((m: any) => [m.player1, m.player2]).filter(Boolean))]
      return { ...phase, groups: [{ name: 'Top 16 Bracket', players: players.map((p: string) => ({ name: p })), matches: pm.map((m: any) => ({ player1: m.player1, player2: m.player2, score: m.score, winner: m.winner, round: m.round, date: '', status: m.status })) }] }
    }
    return {
      ...phase, groups: phase.groups.map((g: any) => {
        const gm = pm.filter((m: any) => m.group === g.name)
        return gm.length === 0 ? g : { ...g, matches: gm.map((m: any) => ({ player1: m.player1, player2: m.player2, round: m.round, date: m.date || '', score: m.score || '', winner: m.winner || '', status: m.status, maps: m.maps || [] })) }
      }),
    }
  })

  // ── upNextMatches + featuredMode ─────────────────────────────────────────
  // 'live'   : state=2 セットあり → Featured Matches
  // 'latest' : state=2 なし + 直近5分以内に完了したセットあり → Latest Results
  // 'recent' : それ以外 → Recent Matches (従来フォールバック)
  const { upNextMatches, featuredMode } = (() => {
    const nowTs = Date.now() / 1000
    const LATEST_WINDOW = 300  // 5分

    // start.gg winner (entrant name) から handle を抽出
    const extractH = (name: string) =>
      name?.includes(' | ') ? name.split(' | ').slice(1).join(' | ').trim() : (name || '')

    // startggMatches から直接収集 (mergedPhases より新鮮)
    const toEntry = (m: any, groupName?: string) => {
      const p1h = m.player1_handle || m.player1 || ''
      const p2h = m.player2_handle || m.player2 || ''
      // winner は entrant name 形式 → handle に変換して比較
      const winnerH = extractH(m.winner || '')
      const winner_is_p1: boolean | null =
        m.status === 'completed' && winnerH
          ? winnerH.toLowerCase() === p1h.toLowerCase()
            ? true
            : winnerH.toLowerCase() === p2h.toLowerCase()
              ? false
              : null   // handle 一致なし
          : null
      return {
        round_text:      (groupName || m.group || '') + ' — ' + (m.round || ''),
        player1_handle:  p1h,
        player2_handle:  p2h,
        score:           m.score ?? '',         // "2-0" 形式
        winner_is_p1,                           // true=p1勝, false=p2勝, null=未確定
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

    // 1. mergedPhases から live/completed を収集
    const live: any[] = []
    const completedPhase: any[] = []
    mergedPhases.forEach((ph: any) => {
      (ph.groups || []).forEach((g: any) => {
        (g.matches || []).forEach((m: any) => {
          if (!validMatch(m)) return
          const entry = toEntry(m, g.name)
          if (m.status === 'live' || m.status === 'upcoming') live.push(entry)
          else if (m.status === 'completed') completedPhase.push(entry)
        })
      })
    })

    // 2. state=2 があれば Featured Matches
    if (live.length > 0) {
      live.sort((a, b) => (a.status === 'live' ? -1 : b.status === 'live' ? 1 : 0))
      return { upNextMatches: live.slice(0, 8), featuredMode: 'live' as const }
    }

    // 3. startggMatches から completedAt 付きで直近5分の Latest Results を検索
    //    mergedPhases 経由だと completedAt が消えるため startggMatches を直接参照
    const latestResults = startggMatches
      .filter((m: any) =>
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

    // 4. フォールバック: phase 経由の直近完了セット
    if (completedPhase.length > 0) {
      return { upNextMatches: completedPhase.slice(0, 8), featuredMode: 'recent' as const }
    }

    // 5. 最終フォールバック: startggMatches 直接参照
    const fallback = startggMatches.filter(validMatch).slice(0, 8).map(m => toEntry(m))
    return { upNextMatches: fallback, featuredMode: 'recent' as const }
  })()

  // ── ヘルパー ──────────────────────────────────────────────────────────────
  const selectPlayer = (p: Player) => {
    if (searchSide === 'p1') setPlayer1(p); else setPlayer2(p)
    setShowSearch(false); setSearchQuery(''); setSearchResults([]); setSearchSide(null)
  }
  const openSearch = (side: 'p1' | 'p2') => { setSearchSide(side); setShowSearch(true); setSearchQuery('') }
  const handleMatchClick = async (p1n: string, p2n: string) => {
    // "TEAM | Handle" 形式をクリーニング — start.gg entrant name には
    // チームプレフィックスが入るが DB の handle はプレフィックスなし
    const stripTeam = (n: string) =>
      n.includes(' | ') ? n.split(' | ').slice(1).join(' | ').trim() : n

    const find = async (rawName: string, side: 'p1' | 'p2') => {
      const name = stripTeam(rawName)
      try {
        const res  = await fetch('/api/players/search?q=' + encodeURIComponent(name))
        const data = await res.json()
        const found =
          // 完全一致を優先
          (data.players || []).find((p: Player) => p.handle.toLowerCase() === name.toLowerCase()) ||
          // フォールバック: 元の名前でも試す (team prefix 込み)
          (rawName !== name
            ? (data.players || []).find((p: Player) => p.handle.toLowerCase() === rawName.toLowerCase())
            : null) ||
          (data.players || [])[0]
        if (found) { if (side === 'p1') setPlayer1(found); else setPlayer2(found) }
      } catch (e) { console.error(e) }
    }
    find(p1n, 'p1'); find(p2n, 'p2')
  }

  // ── start.gg 自動検知 ────────────────────────────────────────────────────
  // 優先順位:
  //   1. state=2 (in-progress) セット → Featured Matches として自動検知
  //   2. state=2 なし + autoDetected=true → 直近5分の Latest Result を使用
  // - 手動モード (__manual__) 中は自動上書きしない
  useEffect(() => {
    if (!config.startggEventId || startggMatches.length === 0) return

    // 手動モード中は何もしない
    if (autoDetectKeyRef.current === '__manual__') return

    const nowTs = Date.now() / 1000

    // ── Branch 1: state=2 (live) セット優先 ──────────────────────────────
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
      setScore({ p1: 0, p2: 0 })
      handleMatchClick(p1, p2)
      return
    }

    // ── Branch 2: latest results (completedAt < 300s) ─────────────────────
    // Pools など 1→3 直接遷移する大会向け。
    // autoDetected の状態に関わらず autoDetectKey で重複制御する。
    const latestSet = startggMatches.find((m: any) =>
      m.status === 'completed' &&
      m.completedAt != null &&
      (nowTs - m.completedAt) < 300 &&
      (m.player1_handle || m.player1) !== 'TBD' &&
      (m.player2_handle || m.player2) !== 'TBD'
    )

    console.log('[AUTO]', {
      autoDetectKey:   autoDetectKeyRef.current,
      autoDetected,
      featuredMode,
      latestMatch:     upNextMatches?.[0] ?? null,
      currentP1:       player1?.handle ?? null,
      currentP2:       player2?.handle ?? null,
      latestSetFound:  latestSet
        ? `${latestSet.player1_handle}|${latestSet.player2_handle} (completedAt-${Math.round(nowTs - latestSet.completedAt)}s ago)`
        : null,
    })

    if (!latestSet) return

    const p1 = latestSet.player1_handle || latestSet.player1 || ''
    const p2 = latestSet.player2_handle || latestSet.player2 || ''
    if (!p1 || !p2) return

    const key = `${p1}|${p2}`
    if (autoDetectKeyRef.current === key) return   // 同じセットは再トリガーしない

    console.log('[AUTO] Branch2 latest result detected', { p1, p2, key })
    autoDetectKeyRef.current = key
    setAutoDetected(true)   // ← AUTO バッジを点灯
    setScore({ p1: 0, p2: 0 })
    handleMatchClick(p1, p2)
  }, [startggMatches, config.startggEventId])

  // ── レンダー ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: V.bg, color: V.text, fontFamily: V.FB,
      height: '100dvh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${V.bg}; }
        ::-webkit-scrollbar-thumb { background: ${V.surface3}; border-radius: 3px; }
        @keyframes sf6live-pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .sf6live-dot {
          width: 8px; height: 8px; border-radius: 50%; background: ${V.red};
          animation: sf6live-pulse 1.2s ease-in-out infinite;
          display: inline-block; flex-shrink: 0;
        }
        .sf6live-next-row:hover { background: ${V.surface2} !important; }
        .sf6live-dot-green {
          width: 8px; height: 8px; border-radius: 50%; background: ${V.accent};
          animation: sf6live-pulse 1.2s ease-in-out infinite;
          display: inline-block; flex-shrink: 0;
        }
        button { font-family: inherit; }
        input  { font-family: inherit; }
      `}</style>

      {/* 選手検索モーダル */}
      {showSearch && (
        <SearchModal
          searchSide={searchSide} searchQuery={searchQuery}
          setSearchQuery={setSearchQuery} searchResults={searchResults}
          onSelect={selectPlayer} onClose={() => setShowSearch(false)}
        />
      )}

      {/* ナビバー: ● LIVE + 大会名 を右端に表示 */}
      <SiteNavbar activePage="live" isLive={isStreamLive} breadcrumb={[{ label: config.name }]} />

      {/* メインコンテンツ: navbar の下に残り全高さを使う */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        padding: '10px 16px 12px', maxWidth: 1600, margin: '0 auto', width: '100%',
        display: 'flex', flexDirection: 'column', gap: 10,
        boxSizing: 'border-box' as const,
      }}>

        {/* ── AUTO バッジ (緑点滅) — 自動検知モード中のみ表示 ── */}
        {autoDetected && (
          <div style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 8,
            background: `${V.accent}0d`, border: `1px solid ${V.accent}30`,
            borderRadius: 8, padding: '7px 12px',
          }}>
            <span className="sf6live-dot-green" style={{ width: 7, height: 7 }} />
            <span style={{
              fontFamily: V.FD, fontSize: 11, fontWeight: 800,
              letterSpacing: '0.14em', textTransform: 'uppercase' as const,
              color: V.accent,
            }}>AUTO</span>
            <span style={{ fontFamily: V.FB, fontSize: 11, color: V.muted }}>
              start.gg の進行中セットを自動検知中 — P1 / P2 を自動更新しています
            </span>
            <button
              onClick={() => {
                setAutoDetected(false)
                // 手動モードに移行: 次の state=2 検知でも上書きしない
                autoDetectKeyRef.current = '__manual__'
              }}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                cursor: 'pointer', color: V.dim, fontSize: 13, padding: '0 4px',
                lineHeight: 1,
              }}
              title="自動検知を無効化"
            >✕</button>
          </div>
        )}

        {/* ── 3カラム フェイスオフ レイアウト ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr 220px',
          gap: 0, borderRadius: 12, overflow: 'hidden',
          border: `1px solid ${V.border}`,
          flexShrink: 0,
        }}>
          <PlayerBand
            player={player1} score={score.p1} side="left"
            isWinning={score.p1 > score.p2}
            onSelectPlayer={() => openSearch('p1')}
            scoreState={score}
            onScoreChange={d => setScore(s => ({ ...s, p1: Math.max(0, s.p1 + d) }))}
          />
          <StreamCenter
            score={score}
            centerTab={centerTab} setCenterTab={setCenterTab}
            hasStream={hasStream}
            streamPlatform={streamPlatform} streamChannel={streamChannel}
            twitchChannels={config.twitchChannels}
            isStreamLive={isStreamLive} streamInfo={streamInfo}
            player1={player1} player2={player2} h2hData={h2hData}
            tournamentId={tournamentId}
            dbTournamentId={config.dbTournamentId}
            startggMatches={startggMatches} configName={config.name}
            cc12LastUpdated={cc12LastUpdated} onMatchClick={handleMatchClick}
            ewcQualifier={config.ewcQualifier}
            ewcSlots={config.ewcSlots}
            cptPremier={config.cptPremier}
            locationLabel={config.locationLabel}
            timezone={config.timezone ?? 'UTC'}
            streamStartTime={config.streamStartTime}
            startDate={config.startDate}
            endDate={config.endDate}
            tournamentSlug={effectiveTournamentSlug}
            onStreamQueueMatch={(p1h, p2h) => handleMatchClick(p1h, p2h)}
          />
          <PlayerBand
            player={player2} score={score.p2} side="right"
            isWinning={score.p2 > score.p1}
            onSelectPlayer={() => openSearch('p2')}
            scoreState={score}
            onScoreChange={d => setScore(s => ({ ...s, p2: Math.max(0, s.p2 + d) }))}
          />
        </div>

        {/* ── セカンダリ: チャット + Featured Matches ── */}
        <div style={{
          flex: 1, minHeight: 0,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        }}>
          <SidePanelLeft
            player1={player1} player2={player2}
            twitchChatChannels={config.twitchChatChannels}
          />
          <FeaturedMatchesPanel
            matches={upNextMatches}
            mode={featuredMode}
            onMatchClick={(p1, p2) => {
              setAutoDetected(false)
              autoDetectKeyRef.current = '__manual__'
              handleMatchClick(p1, p2)
            }}
          />
        </div>

      </div>
    </div>
  )
}
