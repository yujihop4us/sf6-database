'use client'

import { useState, useEffect } from 'react'
import { V, CHAR_COLORS, cc, codeToFlag } from './tokens'
import { CharPill } from './CharPill'

// ── デモ用モックセット ────────────────────────────────────────────────────────
const DEMO_SETS: DbSet[] = [
  { id: 1, round_text: 'Grand Final',       phase_name: 'Top 8', display_score: null, winner_id: null, loser_id: null, winner_score: null,  loser_score: null,  winner_character: 'Cammy', loser_character: 'Mai',    created_at: new Date(Date.now()-300000).toISOString(),  winner_handle: null,       winner_country: null, winner_main_char: null, loser_handle: null,     loser_country: null, loser_main_char: null },
  { id: 2, round_text: 'Winners Final',     phase_name: 'Top 8', display_score: '3-0', winner_id: null, loser_id: null, winner_score: 3,    loser_score: 0,     winner_character: 'Mai',   loser_character: 'Blanka', created_at: new Date(Date.now()-1800000).toISOString(), winner_handle: 'XiaoHai', winner_country: 'CN', winner_main_char: 'Mai',    loser_handle: 'MenaRD',  loser_country: 'DO', loser_main_char: 'Blanka' },
  { id: 3, round_text: 'Losers Final',      phase_name: 'Top 8', display_score: '3-2', winner_id: null, loser_id: null, winner_score: 3,    loser_score: 2,     winner_character: 'Cammy', loser_character: 'Blanka', created_at: new Date(Date.now()-3600000).toISOString(), winner_handle: 'Punk',    winner_country: 'US', winner_main_char: 'Cammy',  loser_handle: 'MenaRD',  loser_country: 'DO', loser_main_char: 'Blanka' },
  { id: 4, round_text: 'Winners Semi-Final',phase_name: 'Top 8', display_score: '3-1', winner_id: null, loser_id: null, winner_score: 3,    loser_score: 1,     winner_character: 'Cammy', loser_character: 'Ken',    created_at: new Date(Date.now()-5400000).toISOString(), winner_handle: 'Punk',    winner_country: 'US', winner_main_char: 'Cammy',  loser_handle: 'Tokido',  loser_country: 'JP', loser_main_char: 'Ken' },
  { id: 5, round_text: 'Winners Semi-Final',phase_name: 'Top 8', display_score: '3-0', winner_id: null, loser_id: null, winner_score: 3,    loser_score: 0,     winner_character: 'Mai',   loser_character: 'Guile',  created_at: new Date(Date.now()-6000000).toISOString(), winner_handle: 'XiaoHai', winner_country: 'CN', winner_main_char: 'Mai',    loser_handle: 'Higuchi', loser_country: 'JP', loser_main_char: 'Guile' },
]

export interface DbSet {
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

export function LiveSetsTable({
  tournamentId,
  dbTournamentId,
  onMatchClick,
  isDemo,
}: {
  tournamentId: string
  dbTournamentId?: number   // Supabase numeric ID。設定されていればこちらを優先
  onMatchClick: (p1: string, p2: string) => void
  /** デモモード: APIフェッチなしでモックデータを表示 */
  isDemo?: boolean
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

  // ── デモモード: モックデータをそのまま表示 ───────────────────────────────
  useEffect(() => {
    if (!isDemo) return
    setSets(DEMO_SETS)
    setTotal(DEMO_SETS.length)
    setLoading(false)
  }, [isDemo])

  // ── fetch (debouncedSearch が変わるたびに再実行) ──────────────────────────
  useEffect(() => {
    if (isDemo) return   // デモ時はAPIを叩かない
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
  }, [isDemo, tournamentId, dbTournamentId, debouncedSearch])

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
