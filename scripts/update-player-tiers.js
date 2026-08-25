/**
 * update-player-tiers.js — 高額賞金大会の実績から players.tier を昇格する
 *
 * ルール（ユーザー確定 2026-08-24）:
 *   - 対象大会に出場        → null もしくは B 未満なら B
 *   - 対象大会で Top 8      → B / null なら A
 *   - S は絶対に触らない（S への自動昇格も行わない。ユーザーの個別指示時のみ手動）
 *   - **昇格のみ。降格は一切しない**
 *
 * 対象大会の定義:
 *   cpt_event_type IN ('capcom_cup','ewc') かつ entrants <= 64
 *   ※ cpt_event_type だけで絞ると EWC の LCQ（269人のオープン予選）を巻き込み、
 *     予選参加者全員が B に昇格する事故になるため人数条件が必須。
 *
 * 使い方:
 *   node scripts/update-player-tiers.js --dry-run   # 変更内容の全リストを出す
 *   node scripts/update-player-tiers.js             # 適用
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const DRY_RUN = process.argv.includes('--dry-run')
/**
 * 昇格の上限。--max-tier=B を渡すと Top 8 実績があっても B 止まりにする。
 * A への昇格は影響が大きいため、ユーザーが個別に承認するまで抑えられるようにする。
 */
const MAX_TIER = process.argv.find(a => a.startsWith('--max-tier='))?.split('=')[1] ?? null

const MAX_ENTRANTS_FOR_MAIN_EVENT = 64
const TOP_N_FOR_A = 8

/** 高いほど上位。S は自動処理の対象外なので比較にのみ使う */
const RANK = { B: 1, A: 2, S: 3 }

/** 昇格のみを許す。現在値が同等以上なら null を返す */
function promote(current, target) {
  if (current === 'S') return null              // S は不可侵
  const cur = RANK[current] ?? 0
  return RANK[target] > cur ? target : null
}

export async function computeTierChanges({ maxTier = null } = {}) {
  // 対象大会を特定
  const { data: cands } = await supabase
    .from('tournaments')
    .select('id, name, cpt_event_type, start_date')
    .in('cpt_event_type', ['capcom_cup', 'ewc'])
    .order('start_date')

  const targets = []
  for (const t of cands ?? []) {
    const { count } = await supabase
      .from('tournament_entrants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', t.id)
    if (count > 0 && count <= MAX_ENTRANTS_FOR_MAIN_EVENT) targets.push({ ...t, entrants: count })
  }

  // 出場者と最高成績を集約
  const best = new Map()   // player_id → { placement, tournament }
  for (const t of targets) {
    let rows = []
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from('tournament_entrants')
        .select('player_id, placement')
        .eq('tournament_id', t.id)
        .range(from, from + 999)
      if (!data?.length) break
      rows = rows.concat(data)
      if (data.length < 1000) break
    }
    for (const r of rows) {
      if (!r.player_id) continue
      const prev = best.get(r.player_id)
      const pl = r.placement ?? 9999
      if (!prev || pl < prev.placement) best.set(r.player_id, { placement: pl, tournament: t.name })
    }
  }

  // 現在の tier
  const ids = [...best.keys()]
  const players = new Map()
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await supabase
      .from('players')
      .select('id, handle, tier')
      .in('id', ids.slice(i, i + 500))
    for (const p of data ?? []) players.set(p.id, p)
  }

  const changes = []
  for (const [pid, info] of best) {
    const p = players.get(pid)
    if (!p) continue
    let want = info.placement <= TOP_N_FOR_A ? 'A' : 'B'
    // 上限が指定されていれば切り下げる（A 昇格の保留用）
    if (maxTier && RANK[want] > RANK[maxTier]) want = maxTier
    const next = promote(p.tier, want)
    if (next) {
      changes.push({
        id: pid, handle: p.handle, from: p.tier, to: next,
        placement: info.placement === 9999 ? null : info.placement,
        tournament: info.tournament,
      })
    }
  }

  return { targets, changes, evaluated: best.size }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║  update-player-tiers — 高額賞金大会の実績から Tier 昇格    ║')
  console.log(`║  mode: ${DRY_RUN ? 'DRY-RUN (書き込みなし)      ' : 'LIVE                        '}                      ║`)
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  const { targets, changes, evaluated } = await computeTierChanges({ maxTier: MAX_TIER })

  console.log('対象大会:')
  targets.forEach(t => console.log(`  id=${String(t.id).padStart(3)} ${t.name.slice(0, 40).padEnd(40)} ${t.entrants}人`))
  console.log(`\n評価した選手: ${evaluated} 名 / 昇格対象: ${changes.length} 名`)
  if (MAX_TIER) console.log(`（--max-tier=${MAX_TIER} のため ${MAX_TIER} 止まりに制限）`)
  console.log('')

  const toA = changes.filter(c => c.to === 'A')
  const toB = changes.filter(c => c.to === 'B')

  if (toA.length) {
    console.log(`── A へ昇格 (Top ${TOP_N_FOR_A} 実績) : ${toA.length} 名 ──`)
    toA.forEach(c => console.log(`  ${(c.from ?? 'null').padEnd(4)} → A  ${c.handle.padEnd(18)} ${c.placement}位 (${c.tournament.slice(0, 30)})`))
  }
  if (toB.length) {
    console.log(`\n── B へ昇格 (出場実績) : ${toB.length} 名 ──`)
    toB.forEach(c => console.log(`  ${(c.from ?? 'null').padEnd(4)} → B  ${c.handle.padEnd(18)} ${c.placement ?? '—'}位 (${c.tournament.slice(0, 30)})`))
  }

  if (DRY_RUN) {
    console.log('\n⚠ DRY-RUN のため書き込んでいません。内容を確認のうえ再実行してください。')
    return
  }

  let ok = 0
  for (const c of changes) {
    const { error } = await supabase.from('players').update({ tier: c.to }).eq('id', c.id)
    if (!error) ok++
    else console.error(`  ❌ ${c.handle}: ${error.message}`)
  }
  console.log(`\n✅ ${ok} / ${changes.length} 名を更新`)

  // S が動いていないことを検証（安全確認）
  const { count: sCount } = await supabase
    .from('players').select('*', { count: 'exact', head: true }).eq('tier', 'S')
  console.log(`   S ランク: ${sCount} 名（自動処理では変更されない）`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(e); process.exit(1) })
}
