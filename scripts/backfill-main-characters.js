/**
 * backfill-main-characters.js
 *
 * players.main_character を tournament_sets のキャラデータからバックフィルする。
 *
 * ロジック:
 *   1. tournament_sets から winner_character / loser_character を全件取得
 *      （tournaments.start_date を JOIN してソート用に使用）
 *   2. 各選手について「大会ごとの使用キャラ頻度」を集計
 *   3. 最新の start_date の大会を優先して最頻出キャラを選択
 *      → その大会にキャラデータがなければ次に新しい大会へフォールバック
 *   4. players.main_character + main_character_tournament_id を UPDATE
 *      （既存値より新しい大会のデータがある場合のみ上書き）
 *
 * 実行:
 *   node scripts/backfill-main-characters.js [--dry-run]
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const dryRun = process.argv.includes('--dry-run')

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  backfill-main-characters.js                                 ║')
  console.log(`║  mode: ${dryRun ? 'DRY-RUN (no writes)               ' : 'LIVE (will UPDATE players)           '} ║`)
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  // ── 1. 全セット（キャラあり）+ 大会の start_date を取得 ─────────────────────
  console.log('→ tournament_sets からキャラデータを取得中...')
  const { data: setsRaw, error: sErr } = await supabase
    .from('tournament_sets')
    .select('winner_id, loser_id, winner_character, loser_character, tournament_id')
    .or('winner_character.not.is.null,loser_character.not.is.null')
    .limit(100000)

  if (sErr) { console.error('sets 取得エラー:', sErr.message); process.exit(1) }
  console.log(`  → ${setsRaw.length} セット（キャラあり）`)

  // 大会 start_date マップを取得
  const tournamentIds = [...new Set(setsRaw.map(s => s.tournament_id))]
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, start_date')
    .in('id', tournamentIds)

  const tourneyDateMap = new Map(tournaments.map(t => [t.id, t.start_date]))
  const tourneyNameMap = new Map(tournaments.map(t => [t.id, t.name]))

  console.log(`  → キャラデータあり大会: ${tournaments.length} 件`)
  for (const t of [...tournaments].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))) {
    const count = setsRaw.filter(s => s.tournament_id === t.id).length
    console.log(`     [${t.id}] ${t.name} (${t.start_date}) — ${count} セット`)
  }

  // ── 2. 選手ごとに「大会→キャラ頻度」を集計 ──────────────────────────────────
  // playerTourneyCharFreq: Map<playerId, Map<tournamentId, Map<charName, count>>>
  const playerTourneyCharFreq = new Map()

  for (const s of setsRaw) {
    const pairs = [
      { pid: s.winner_id, char: s.winner_character },
      { pid: s.loser_id,  char: s.loser_character  },
    ]
    for (const { pid, char } of pairs) {
      if (!pid || !char) continue
      if (!playerTourneyCharFreq.has(pid)) playerTourneyCharFreq.set(pid, new Map())
      const tourneyMap = playerTourneyCharFreq.get(pid)
      if (!tourneyMap.has(s.tournament_id)) tourneyMap.set(s.tournament_id, new Map())
      const charMap = tourneyMap.get(s.tournament_id)
      charMap.set(char, (charMap.get(char) ?? 0) + 1)
    }
  }

  console.log(`\n→ キャラデータが存在する選手数: ${playerTourneyCharFreq.size}`)

  // ── 3. 各選手の「最優先キャラ」を決定 ──────────────────────────────────────
  // 最新の大会（start_date 降順）を優先して最頻出キャラを選択
  const playerBestChar = new Map() // Map<playerId, { char, tournamentId, date }>

  for (const [pid, tourneyMap] of playerTourneyCharFreq) {
    // 大会を start_date 降順でソート
    const sortedTourneys = [...tourneyMap.keys()]
      .map(tid => ({ tid, date: tourneyDateMap.get(tid) ?? '1900-01-01' }))
      .sort((a, b) => b.date.localeCompare(a.date))

    for (const { tid, date } of sortedTourneys) {
      const charMap = tourneyMap.get(tid)
      if (!charMap || charMap.size === 0) continue

      // 最頻出キャラ
      const topChar = [...charMap.entries()].sort((a, b) => b[1] - a[1])[0][0]
      playerBestChar.set(pid, { char: topChar, tournamentId: tid, date })
      break // 最新の大会でキャラが見つかったら終了
    }
  }

  // ── 4. 現在の players 情報を取得 ────────────────────────────────────────────
  const playerIds = [...playerBestChar.keys()]
  const { data: playersRaw } = await supabase
    .from('players')
    .select('id, handle, main_character, main_character_tournament_id')
    .in('id', playerIds)

  const playerMap = new Map(playersRaw.map(p => [p.id, p]))

  // main_character_tournament_id から現在の大会の start_date を取得
  const existingTourneyIds = [...new Set(
    playersRaw.map(p => p.main_character_tournament_id).filter(Boolean)
  )]
  const existingDateMap = new Map()
  if (existingTourneyIds.length > 0) {
    const { data: existingTourneys } = await supabase
      .from('tournaments')
      .select('id, start_date')
      .in('id', existingTourneyIds)
    for (const t of existingTourneys ?? []) existingDateMap.set(t.id, t.start_date)
  }

  // ── 5. UPDATE ───────────────────────────────────────────────────────────────
  console.log('\n→ players.main_character を更新中...')
  let updatedCount = 0
  let skippedSameData = 0
  let skippedOlderData = 0
  const samples = []

  for (const [pid, best] of playerBestChar) {
    const player = playerMap.get(pid)
    if (!player) continue

    // 既存値との比較
    if (player.main_character_tournament_id) {
      const existingDate = existingDateMap.get(player.main_character_tournament_id) ?? '1900-01-01'
      if (best.date <= existingDate) {
        // 既存の大会の方が新しいか同じ → スキップ
        skippedOlderData++
        continue
      }
    }
    // 同じ値への上書きはスキップ（main_character_tournament_id が null の場合も更新）
    if (player.main_character === best.char && player.main_character_tournament_id === best.tournamentId) {
      skippedSameData++
      continue
    }

    const tourneyName = tourneyNameMap.get(best.tournamentId) ?? `id=${best.tournamentId}`
    if (!dryRun) {
      const { error } = await supabase
        .from('players')
        .update({
          main_character: best.char,
          main_character_tournament_id: best.tournamentId,
        })
        .eq('id', pid)
      if (error) {
        console.error(`  ⚠ id=${pid} ${player.handle} update error: ${error.message}`)
        continue
      }
    }

    updatedCount++
    if (samples.length < 5) {
      samples.push({ pid, handle: player.handle, char: best.char, tourney: tourneyName, date: best.date })
    }
  }

  // ── 6. 結果表示 ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  更新: ${updatedCount} 件`)
  console.log(`  スキップ (既存の方が新しい大会): ${skippedOlderData} 件`)
  console.log(`  スキップ (同一データ): ${skippedSameData} 件`)
  console.log('─'.repeat(60))
  if (samples.length > 0) {
    console.log('\n  更新例（最大5件）:')
    for (const s of samples) {
      console.log(`  ✅ id=${s.pid} ${s.handle.padEnd(20)} → ${s.char.padEnd(12)} (${s.tourney}, ${s.date})`)
    }
  }
  if (dryRun) console.log('\n  ⚠ DRY-RUN モード: 実際の書き込みは行われていません')
  console.log('\n完了\n')
}

main().catch(e => { console.error(e); process.exit(1) })
