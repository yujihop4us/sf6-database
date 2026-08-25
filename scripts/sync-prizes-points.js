/**
 * sync-prizes-points.js — Liquipedia の賞金表から賞金とサーキットポイントを同期
 *
 * 賞金とポイントは同じ表にあるため一度に取り込む。
 *   tournament_entrants.prize_amount ← 賞金
 *   tournaments.total_prize_usd      ← 賞金合計
 *   cpt_points                       ← サーキットポイント（CPT / EWC）
 *
 * placement 確定後に実行すること（順位と突き合わせてタイ層を解決するため）。
 *
 * 使い方:
 *   node scripts/sync-prizes-points.js --tournament-id=45
 *   node scripts/sync-prizes-points.js --tournament-id=45 --dry-run
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { fetchPrizePool } from './lib/liquipedia-prizepool.mjs'
import { buildPlayerIndex } from './lib/player-aliases.mjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)
const DRY_RUN = !!args['dry-run']
const TID = args['tournament-id'] ? parseInt(args['tournament-id'], 10) : null

/**
 * 大会の賞金・ポイントを同期する。finalize-tournaments.js からも呼べるよう関数で公開。
 * @returns {{prizeUpdated:number, pointsUpserted:number, totalPrize:number, unmatched:string[], circuit:string|null, skipped?:string}}
 */
export async function syncPrizesAndPoints(tournament, { dryRun = false } = {}) {
  const result = {
    prizeUpdated: 0, pointsUpserted: 0, placementUpdated: 0, totalPrize: 0,
    unmatched: [], circuit: null, skipped: null,
  }

  if (!tournament.liquipedia_url) {
    result.skipped = 'liquipedia_url 未設定'
    return result
  }

  const pool = await fetchPrizePool(tournament.liquipedia_url)
  result.circuit = pool.circuit
  if (pool.error || !pool.entries.length) {
    result.skipped = pool.error ?? '賞金表が空'
    return result
  }

  const idx = await buildPlayerIndex(supabase)

  // 大会のエントラント（placement 付き）を取得
  let ents = []
  // ↓ 取得後に「この賞金表が本当にこの大会のものか」を検証する（下の SAFETY 参照）
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('tournament_entrants')
      .select('id, player_id, placement, prize_amount')
      .eq('tournament_id', tournament.id)
      .range(from, from + 999)
    if (!data?.length) break
    ents = ents.concat(data)
    if (data.length < 1000) break
  }
  const byPlayer = new Map(ents.map(e => [e.player_id, e]))

  // ── SAFETY: 賞金表がこの大会のものか検証 ────────────────────────────────
  // liquipedia_url は大会間で共有されていることがある。
  // 実例: EWC 2026 の LCQ(id=49) と本戦(id=11) が同じ URL を指しており、
  // 素朴に適用すると LCQ の選手に本戦の $1,000,000 が書き込まれる。
  // 賞金表の選手がこの大会のエントラントとほとんど一致しない場合は適用しない。
  const matched = pool.entries.filter(e => {
    const p = idx.find(e.name)
    return p && byPlayer.has(p.id)
  }).length
  const matchRate = pool.entries.length ? matched / pool.entries.length : 0
  if (matchRate < 0.5) {
    result.skipped =
      `賞金表がこの大会と一致しない（照合率 ${Math.round(matchRate * 100)}%）。` +
      `liquipedia_url が別大会を指している可能性`
    return result
  }

  const pointRows = []

  for (const e of pool.entries) {
    const player = idx.find(e.name)
    if (!player) { result.unmatched.push(e.name); continue }

    const ent = byPlayer.get(player.id)
    // エントラント行が無い＝取り込み漏れ。賞金だけ入れる先が無いので記録して次へ
    if (!ent) { result.unmatched.push(`${e.name}(entrant無)`); continue }

    // 順位。start.gg を持たない大会（Capcom Cup / EWC 本戦）は
    // standings から順位を引けないため、賞金表の順位で補完する。
    // 既に入っている順位は上書きしない（start.gg 由来のほうが精度が高い）
    if (ent.placement == null && e.place != null) {
      if (!dryRun) {
        const { error } = await supabase
          .from('tournament_entrants')
          .update({ placement: e.place })
          .eq('id', ent.id)
        if (!error) result.placementUpdated++
      } else {
        result.placementUpdated++
      }
    }

    // 賞金
    if (e.usd != null && ent.prize_amount !== e.usd) {
      if (!dryRun) {
        const { error } = await supabase
          .from('tournament_entrants')
          .update({ prize_amount: e.usd })
          .eq('id', ent.id)
        if (error) { result.unmatched.push(`${e.name}(${error.message})`); continue }
      }
      result.prizeUpdated++
    }

    // ポイント（circuit が判明していて points がある場合のみ）
    if (pool.circuit && e.points != null) {
      pointRows.push({
        player_id: player.id,
        tournament_id: tournament.id,
        circuit: pool.circuit,
        points: e.points,
        placement: e.place,
      })
    }
  }

  result.totalPrize = pool.entries.reduce((a, e) => a + (e.usd ?? 0), 0)

  if (pointRows.length && !dryRun) {
    // unique(player_id, tournament_id, circuit) により再実行しても重複しない
    const { error } = await supabase
      .from('cpt_points')
      .upsert(pointRows, { onConflict: 'player_id,tournament_id,circuit' })
    if (error) throw new Error(`cpt_points upsert 失敗: ${error.message}`)
  }
  result.pointsUpserted = pointRows.length

  // 大会の賞金総額
  if (result.totalPrize > 0 && tournament.total_prize_usd !== result.totalPrize && !dryRun) {
    await supabase
      .from('tournaments')
      .update({ total_prize_usd: result.totalPrize })
      .eq('id', tournament.id)
  }

  return result
}

// ── 単体実行 ────────────────────────────────────────────────────────────────

async function main() {
  if (!TID) { console.error('--tournament-id=<id> が必要です'); process.exit(1) }

  const { data: t, error } = await supabase
    .from('tournaments')
    .select('id, name, liquipedia_url, total_prize_usd')
    .eq('id', TID)
    .single()
  if (error || !t) { console.error('大会取得失敗:', error?.message); process.exit(1) }

  console.log(`\n[${t.id}] ${t.name}${DRY_RUN ? '  (DRY-RUN)' : ''}`)
  const r = await syncPrizesAndPoints(t, { dryRun: DRY_RUN })

  if (r.skipped) { console.log(`  ⏭ スキップ: ${r.skipped}`); return }
  console.log(`  circuit    : ${r.circuit ?? '—'}`)
  console.log(`  賞金更新   : ${r.prizeUpdated} 件`)
  if (r.placementUpdated) console.log(`  順位補完   : ${r.placementUpdated} 件`)
  console.log(`  ポイント   : ${r.pointsUpserted} 件`)
  console.log(`  賞金合計   : $${r.totalPrize.toLocaleString()}`)
  if (r.unmatched.length) {
    console.log(`  ⚠ 未マッチ ${r.unmatched.length} 件: ${r.unmatched.slice(0, 12).join(', ')}${r.unmatched.length > 12 ? ' …' : ''}`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(e); process.exit(1) })
}
