/**
 * live-capture.js — 開催中の大会を自動検出してライブ取得を1サイクル実行する
 *
 * GitHub Actions から定期実行される想定。
 *
 * 従来は live-fetch-v2.js をローカルPCで常駐させていたが、
 * 無警告で停止して EWC LCQ の52セットと全順位が欠落した。
 * PC 非依存にし、止まっても次の実行で自然に追いつくようにする。
 *
 * 状態はプロセスに持たず tournament_sets から復元するため、
 * 実行間隔が空いても取りこぼさない（updatedAfter で差分取得）。
 *
 * 使い方:
 *   node scripts/live-capture.js
 *   node scripts/live-capture.js --dry-run   # 対象の検出のみ
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'child_process'
import { appendFileSync } from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const DRY_RUN = process.argv.includes('--dry-run')

/** 大会終了後もしばらくは結果が確定していくため、終了翌日まで対象に含める */
const GRACE_DAYS_AFTER_END = 1

async function main() {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const graceStr = new Date(today.getTime() - GRACE_DAYS_AFTER_END * 86400_000)
    .toISOString().slice(0, 10)

  // 開催中（または終了直後）で start.gg を持つ大会
  const { data: targets, error } = await supabase
    .from('tournaments')
    .select('id, name, slug, startgg_slug, startgg_tournament_id, startgg_event_id, start_date, end_date')
    .not('startgg_event_id', 'is', null)
    .not('startgg_tournament_id', 'is', null)
    .lte('start_date', todayStr)
    .gte('end_date', graceStr)

  if (error) { console.error('大会取得エラー:', error.message); process.exit(1) }

  const lines = ['## ライブ取得', '']

  if (!targets?.length) {
    console.log('開催中の大会はありません')
    lines.push('開催中の大会はありませんでした。')
    report(lines)
    return
  }

  console.log(`開催中: ${targets.length} 大会\n`)
  let failed = 0

  for (const t of targets) {
    console.log(`──── [${t.id}] ${t.name} (${t.start_date}〜${t.end_date}) ────`)

    const before = await countSets(t.id)

    if (DRY_RUN) {
      console.log(`  (dry-run) 現在 ${before} セット`)
      lines.push(`- **${t.name}**: ${before} セット（dry-run）`)
      continue
    }

    try {
      execFileSync('node', [
        'scripts/live-fetch-v2.js',
        `--tournament-id=${t.startgg_tournament_id}`,
        `--event-id=${t.startgg_event_id}`,
        `--tournament-slug=${t.slug ?? t.startgg_slug}`,
        `--db-tournament-id=${t.id}`,
        '--once',
      ], { encoding: 'utf-8', stdio: 'inherit', timeout: 20 * 60 * 1000 })

      const after = await countSets(t.id)
      const diff = after - before
      console.log(`  → ${before} → ${after} セット (${diff >= 0 ? '+' : ''}${diff})`)
      lines.push(`- **${t.name}**: ${before} → ${after} セット（${diff >= 0 ? '+' : ''}${diff}）`)
    } catch (e) {
      failed++
      console.error(`  ❌ 失敗: ${e.message}`)
      lines.push(`- **${t.name}**: ❌ 失敗 — ${e.message}`)
    }
  }

  report(lines)
  // 失敗を黙って見逃さない（通知を出すため異常終了させる）
  if (failed) process.exit(1)
}

async function countSets(tid) {
  const { count } = await supabase
    .from('tournament_sets')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tid)
  return count ?? 0
}

function report(lines) {
  const text = lines.join('\n')
  console.log('\n' + text)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
