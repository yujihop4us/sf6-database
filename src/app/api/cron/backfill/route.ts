/**
 * /api/cron/backfill
 *
 * Vercel Cron (6時間ごと) から呼ばれる Liquipedia バックフィル。
 * 1回の実行で:
 *   - 大会賞金テーブル: 1大会分を取得・更新
 *   - 選手データ: 最大8名の country_code / main_character を補完
 *
 * 認証: Authorization: Bearer <CRON_SECRET>
 * Vercel Cron は自動でこのヘッダーを付与する。
 * ローカルテスト: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/backfill
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import {
  fetchPlayerFromLiquipedia,
  fetchTournamentPrizePool,
  getBackfillTargets,
  type BackfillPlayer,
} from '@/lib/liquipedia-backfill'

export const dynamic  = 'force-dynamic'
export const maxDuration = 300   // 5 分（Vercel Pro の上限）

// ── 認証 ────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

// ── メイン ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const startedAt = Date.now()

  const result = {
    processed_players: 0,
    updated_players: 0,
    processed_tournaments: 0,
    updated_prize_entries: 0,
    remaining_players: 0,
    remaining_tournaments: 0,
    stopped_reason: undefined as string | undefined,
    elapsed_ms: 0,
  }

  // ── ターゲット取得 ─────────────────────────────────────────────────────────
  const { players, tournaments, totalPendingPlayers, totalPendingTournaments } =
    await getBackfillTargets(supabase, { playerBatch: 8, tournamentBatch: 1 })

  result.remaining_players    = totalPendingPlayers
  result.remaining_tournaments = totalPendingTournaments

  // ── 大会賞金バックフィル（1大会） ─────────────────────────────────────────
  for (const tournament of tournaments) {
    console.log(`[cron/backfill] 大会賞金取得: ${tournament.name} (${tournament.liquipediaUrl})`)

    const { entries, totalPrize, rateLimited } =
      await fetchTournamentPrizePool(tournament.liquipediaUrl)

    if (rateLimited) {
      result.stopped_reason = 'rate_limited_tournament'
      break
    }

    result.processed_tournaments++

    if (entries.length === 0) {
      console.log(`  → 賞金データなし（スキップ）`)
      // liquipedia_url があってもデータがない大会は prize_pool = 0 でマーク
      continue
    }

    // tournaments.prize_pool を更新
    if (totalPrize > 0) {
      await supabase
        .from('tournaments')
        .update({ prize_pool: totalPrize })
        .eq('id', tournament.id)
      console.log(`  → prize_pool: $${totalPrize.toLocaleString()}`)
    }

    // 各 entry の選手名 → player_id → tournament_entrants.prize_amount 更新
    let entriesUpdated = 0
    for (const entry of entries) {
      for (let i = 0; i < entry.playerNames.length; i++) {
        const name = entry.playerNames[i]
        const href = entry.playerHrefs[i]
        const hrefDecoded = href.replace(/_/g, ' ')

        // DB 上の player を検索（text → href decoded の順）
        let playerId: number | null = null
        for (const handle of [name, hrefDecoded]) {
          const { data } = await supabase
            .from('players')
            .select('id')
            .ilike('handle', handle)
            .limit(1)
            .single()
          if (data) { playerId = data.id; break }
        }
        if (!playerId) continue

        // tournament_entrants を更新（placement が近い行を対象）
        const minPlace = entry.placement
        const maxPlace = entry.placement + entry.playerNames.length - 1

        const { data: entrants } = await supabase
          .from('tournament_entrants')
          .select('id, prize_amount')
          .eq('tournament_id', tournament.id)
          .eq('player_id', playerId)
          .limit(1)

        if (!entrants?.length) continue
        const entrant = entrants[0]

        if (entrant.prize_amount !== entry.prizeAmount) {
          await supabase
            .from('tournament_entrants')
            .update({ prize_amount: entry.prizeAmount })
            .eq('id', entrant.id)
          entriesUpdated++
          console.log(`  ✅ ${name}: placement ${minPlace}-${maxPlace} → $${entry.prizeAmount.toLocaleString()}`)
        }
      }
    }

    result.updated_prize_entries += entriesUpdated
    console.log(`  完了: ${entriesUpdated} エントリ更新`)
  }

  // 残り時間チェック（120秒以上残っていれば選手バックフィルへ）
  if (result.stopped_reason) {
    result.elapsed_ms = Date.now() - startedAt
    return NextResponse.json(result)
  }

  // ── 選手データバックフィル ─────────────────────────────────────────────────
  for (const player of players) {
    // 制限時間チェック（4分経過したら停止）
    if (Date.now() - startedAt > 4 * 60 * 1_000) {
      result.stopped_reason = 'time_limit'
      break
    }

    console.log(`[cron/backfill] 選手: ${player.handle} (id=${player.id}, placement=${player.bestPlacement})`)
    result.processed_players++

    const data = await fetchPlayerFromLiquipedia(player.handle)

    // 429 / レート制限 → 即停止
    if (data.rateLimited) {
      result.stopped_reason = 'rate_limited_player'
      // liquipedia_checked_at は更新しない（次回再試行させる）
      break
    }

    const updates: Record<string, unknown> = {
      liquipedia_checked_at: new Date().toISOString(),
    }

    if (data.countryCode && !player.countryCode) {
      updates.country_code = data.countryCode
      console.log(`  ✅ country_code: ${data.countryCode}`)
    }

    if (data.mainCharacter && !player.mainCharacter) {
      updates.main_character = data.mainCharacter
      // main_character を選手ページから設定する場合、tournament_id は null のまま
      console.log(`  ✅ main_character: ${data.mainCharacter}`)
    }

    const didUpdate =
      (data.countryCode && !player.countryCode) ||
      (data.mainCharacter && !player.mainCharacter)

    if (didUpdate) result.updated_players++

    if (!data.countryCode && !data.mainCharacter) {
      console.log(`  → データなし（Liquipedia ページなし）`)
    }

    await supabase.from('players').update(updates).eq('id', player.id)
  }

  // 残数更新
  result.remaining_players    = Math.max(0, totalPendingPlayers - result.processed_players)
  result.remaining_tournaments = Math.max(0, totalPendingTournaments - result.processed_tournaments)
  result.elapsed_ms = Date.now() - startedAt

  console.log(`[cron/backfill] 完了: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
}
