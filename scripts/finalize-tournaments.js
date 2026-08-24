/**
 * finalize-tournaments.js — 大会終了後の確定処理を自動で行う
 *
 * GitHub Actions から日次で呼ばれる想定。手動実行も可。
 *
 * 設計方針:
 *   - **冪等**: 何度実行しても安全。差分がある箇所だけ処理する
 *   - **検証駆動**: start.gg を正として DB との差分を検出し、埋めてから再検証する
 *   - **状態列を持たない**: DDL 不要。毎回 start.gg と突き合わせるので取りこぼしが自然に治る
 *
 * これまで手動運用で起きた欠落（いずれも無警告）を防ぐのが目的:
 *   - live-fetch-v2.js の停止による セット/順位 の欠落
 *   - import-sets.js の phaseGroups 切り詰めによる大量欠落
 *   - import-tournament.js が既存行の placement を更新しない問題
 *   - post-tournament-update.js / cron の Liquipedia 403
 *   - backfill-main-characters.js の未実行
 *
 * 使い方:
 *   node scripts/finalize-tournaments.js                 # 直近14日に終了した大会
 *   node scripts/finalize-tournaments.js --days=30
 *   node scripts/finalize-tournaments.js --tournament-id=45
 *   node scripts/finalize-tournaments.js --dry-run       # 検出のみ（書き込みなし）
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
const STARTGG_TOKEN = process.env.STARTGG_API_TOKEN || process.env.STARTGG_TOKEN
const STARTGG_API = 'https://api.start.gg/gql/alpha'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)
const DRY_RUN = !!args['dry-run']
const DAYS = parseInt(args.days ?? '14', 10)
const ONLY_ID = args['tournament-id'] ? parseInt(args['tournament-id'], 10) : null

const sleep = ms => new Promise(r => setTimeout(r, ms))
const PAGE = 1000

// ── start.gg ────────────────────────────────────────────────────────────────

async function gql(query, variables, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(STARTGG_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${STARTGG_TOKEN}`,
        },
        body: JSON.stringify({ query, variables }),
      })
      if (res.status === 429) { await sleep(5000 * (i + 1)); continue }
      const json = await res.json()
      if (json.errors) throw new Error(json.errors[0]?.message ?? 'GQL error')
      return json.data
    } catch (e) {
      if (i === retries - 1) throw e
      await sleep(2000 * (i + 1))
    }
  }
}

/** start.gg 側の正データ（完了セット数・エントラント数・standings） */
async function fetchStartggTruth(eventId) {
  const meta = await gql(
    `query($e: ID!) {
      event(id: $e) {
        state numEntrants
        sets(page: 1, perPage: 1, filters: { state: [3] }) { pageInfo { total } }
      }
    }`,
    { e: eventId },
  )
  const ev = meta?.event
  if (!ev) return null

  const standings = []
  for (let page = 1; ; page++) {
    const d = await gql(
      `query($e: ID!, $p: Int!) {
        event(id: $e) {
          standings(query: { page: $p, perPage: 100 }) {
            nodes { placement entrant { id } }
          }
        }
      }`,
      { e: eventId, p: page },
    )
    const nodes = d?.event?.standings?.nodes ?? []
    if (!nodes.length) break
    standings.push(...nodes.filter(n => n.placement != null && n.entrant))
    if (nodes.length < 100) break
    await sleep(600)
  }

  return {
    state: ev.state,
    numEntrants: ev.numEntrants,
    completedSets: ev.sets?.pageInfo?.total ?? 0,
    standings,
  }
}

// ── DB 側の現状 ──────────────────────────────────────────────────────────────

async function fetchDbState(tid) {
  const countOf = async (table, apply) => {
    let q = supabase.from(table).select('*', { count: 'exact', head: true }).eq('tournament_id', tid)
    if (apply) q = apply(q)
    const { count } = await q
    return count ?? 0
  }
  return {
    sets:        await countOf('tournament_sets'),
    setsWithWin: await countOf('tournament_sets', q => q.not('winner_id', 'is', null)),
    chars:       await countOf('tournament_sets', q => q.not('winner_character', 'is', null)),
    entrants:    await countOf('tournament_entrants'),
    placements:  await countOf('tournament_entrants', q => q.not('placement', 'is', null)),
    prizes:      await countOf('tournament_entrants', q => q.not('prize_amount', 'is', null)),
  }
}

// ── 修復ステップ ─────────────────────────────────────────────────────────────

function runScript(file, scriptArgs) {
  console.log(`   $ node scripts/${file} ${scriptArgs.join(' ')}`)
  try {
    const out = execFileSync('node', [`scripts/${file}`, ...scriptArgs], {
      encoding: 'utf-8',
      timeout: 45 * 60 * 1000,
      maxBuffer: 64 * 1024 * 1024,
    })
    return { ok: true, out }
  } catch (e) {
    return { ok: false, out: (e.stdout ?? '') + (e.stderr ?? e.message) }
  }
}

/**
 * placement を start.gg standings から直接埋める。
 * import-tournament.js は既存 entrant 行の placement を更新しないため、
 * これが無いと「エントラントはいるのに順位が全部 null」になる（EWC LCQ / CEO で発生）
 */
async function syncPlacements(tid, standings) {
  let ents = []
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from('tournament_entrants')
      .select('id, startgg_entrant_id, placement')
      .eq('tournament_id', tid)
      .range(from, from + PAGE - 1)
    if (!data?.length) break
    ents = ents.concat(data)
    if (data.length < PAGE) break
  }
  const byEid = new Map(
    ents.filter(e => e.startgg_entrant_id).map(e => [String(e.startgg_entrant_id), e]),
  )

  let updated = 0, unmatched = 0
  for (const s of standings) {
    const e = byEid.get(String(s.entrant.id))
    if (!e) { unmatched++; continue }
    if (e.placement === s.placement) continue
    if (DRY_RUN) { updated++; continue }
    const { error } = await supabase
      .from('tournament_entrants')
      .update({ placement: s.placement })
      .eq('id', e.id)
    if (!error) updated++
  }
  return { updated, unmatched }
}

// ── メイン ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  finalize-tournaments — 大会終了後の確定処理                ║')
  console.log(`║  mode: ${DRY_RUN ? 'DRY-RUN (検出のみ)          ' : 'LIVE                        '}                        ║`)
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // 対象大会の選定
  let q = supabase
    .from('tournaments')
    .select('id, name, slug, startgg_slug, startgg_event_id, liquipedia_url, end_date, total_prize_usd')
    .not('startgg_event_id', 'is', null)

  if (ONLY_ID) {
    q = q.eq('id', ONLY_ID)
  } else {
    const since = new Date(Date.now() - DAYS * 86400_000).toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    q = q.gte('end_date', since).lte('end_date', today)
  }
  const { data: targets, error } = await q.order('end_date', { ascending: false })
  if (error) { console.error('大会取得エラー:', error.message); process.exit(1) }

  if (!targets?.length) {
    console.log(`対象大会なし（直近${DAYS}日に終了した start.gg 大会）`)
    report([])
    return
  }
  console.log(`対象: ${targets.length} 大会\n`)

  const results = []

  for (const t of targets) {
    console.log(`──────── [${t.id}] ${t.name} (終了 ${t.end_date}) ────────`)
    const r = { id: t.id, name: t.name, actions: [], gaps: [], notes: [], error: null }

    try {
      const truth = await fetchStartggTruth(t.startgg_event_id)
      if (!truth) { r.error = 'start.gg イベント取得失敗'; results.push(r); continue }

      let db = await fetchDbState(t.id)
      console.log(`  start.gg: sets=${truth.completedSets} entrants=${truth.numEntrants} state=${truth.state}`)
      console.log(`  DB      : sets=${db.setsWithWin} entrants=${db.entrants} placement=${db.placements} chars=${db.chars} prize=${db.prizes}`)

      if (truth.state !== 'COMPLETED') {
        console.log('  ⏭ まだ完了していないためスキップ')
        r.actions.push('skipped (not completed)')
        results.push(r)
        continue
      }

      // ── 1. セット同期 ────────────────────────────────────────────────
      // 「行そのものが足りない」かどうかで判定する。
      // winner_id が null なのは選手の名寄せ失敗であって取り込み漏れではないため、
      // ここで混同すると毎回 import-sets が無駄に走る
      if (db.sets < truth.completedSets) {
        const missing = truth.completedSets - db.sets
        console.log(`  ▸ セット不足 ${missing} 件 → import-sets`)
        r.actions.push(`sets: ${db.sets} → 同期実行 (不足${missing})`)
        if (!DRY_RUN) {
          const slug = t.slug ?? t.startgg_slug
          const res = runScript('import-sets.js', [slug])
          if (!res.ok) console.log('    ⚠ import-sets 失敗')
        }
      }

      // ── 2. 順位同期 ──────────────────────────────────────────────────
      if (truth.standings.length) {
        const p = await syncPlacements(t.id, truth.standings)
        if (p.updated) {
          console.log(`  ▸ 順位を ${p.updated} 件更新（未一致 ${p.unmatched}）`)
          r.actions.push(`placement: ${p.updated}件更新`)
        }
        if (p.unmatched) r.notes.push(`start.gg 側にのみ存在する entrant ${p.unmatched}件`)
      }

      // ── 3. キャラ（start.gg → Liquipedia フォールバック）────────────
      // 「1件も無い」ときだけ取りに行く。部分的に取れている場合は
      // それが取得元の持つ全量なので、毎日走らせても増えない（無駄な再実行を避ける）
      db = await fetchDbState(t.id)
      if (db.chars === 0) {
        if (t.liquipedia_url) {
          console.log('  ▸ キャラ 0件 → Liquipedia から取得')
          r.actions.push('chars: Liquipedia から取得')
          if (!DRY_RUN) {
            runScript('post-tournament-update.js', [
              `--tournament-id=${t.id}`,
              `--slug=${t.slug ?? t.startgg_slug}`,
              '--step=2',
              `--liquipedia-url=${t.liquipedia_url}`,
            ])
          }
        } else {
          r.notes.push('キャラ0件・liquipedia_url 未設定')
        }
      }

      // ── 4. 賞金 ──────────────────────────────────────────────────────
      db = await fetchDbState(t.id)
      if (db.prizes === 0) {
        r.notes.push('賞金未設定')
      }

      // 再検証
      db = await fetchDbState(t.id)
      if (db.sets < truth.completedSets) {
        r.gaps.push(`セット不足 ${truth.completedSets - db.sets}件`)
      }
      if (db.placements < db.entrants) {
        r.gaps.push(`順位欠落 ${db.entrants - db.placements}件`)
      }
      // 名寄せ失敗は取り込み漏れとは別問題。参考情報として残す
      const unresolved = db.sets - db.setsWithWin
      if (unresolved > 0) r.notes.push(`勝者の名寄せ未解決 ${unresolved}件`)
      r.final = db
      r.truth = truth
    } catch (e) {
      r.error = e.message
      console.error('  ❌', e.message)
    }
    results.push(r)
    console.log('')
  }

  // ── 5. main_character 再計算（全大会共通なので最後に1回）────────────
  const didWork = results.some(r => r.actions.some(a => a.includes('同期') || a.includes('取得')))
  if (didWork && !DRY_RUN) {
    console.log('▸ players.main_character を再計算')
    runScript('backfill-main-characters.js', [])
  }

  report(results)

  // 未解決ギャップがあれば異常終了 → GitHub Actions が通知を送る
  const unresolved = results.filter(r => r.error || r.gaps.length)
  if (unresolved.length) {
    console.log(`\n⚠ 未解決あり: ${unresolved.length} 大会`)
    process.exit(1)
  }
  console.log('\n✅ すべて同期済み')
}

// ── レポート出力（GitHub Actions のジョブサマリに出す）──────────────────────

function report(results) {
  const lines = []
  lines.push('## 大会データ同期レポート', '')
  if (!results.length) {
    lines.push('対象大会はありませんでした。')
  } else {
    lines.push('| 大会 | セット | 順位 | キャラ | 賞金 | 状態 |')
    lines.push('|---|---|---|---|---|---|')
    for (const r of results) {
      const f = r.final, t = r.truth
      const sets = f && t ? `${f.sets}/${t.completedSets}` : '—'
      const pl   = f ? `${f.placements}/${f.entrants}` : '—'
      const ch   = f ? String(f.chars) : '—'
      const pz   = f ? String(f.prizes) : '—'
      const st = r.error
        ? `❌ ${r.error}`
        : r.gaps.length
          ? `⚠ ${r.gaps.join(' / ')}`
          : r.notes.length ? `✅（参考: ${r.notes.join(' / ')}）` : '✅'
      lines.push(`| ${r.name} | ${sets} | ${pl} | ${ch} | ${pz} | ${st} |`)
    }
    const acted = results.filter(r => r.actions.length)
    if (acted.length) {
      lines.push('', '### 実行した処理', '')
      for (const r of acted) lines.push(`- **${r.name}**: ${r.actions.join(' / ')}`)
    }
  }
  const text = lines.join('\n')
  console.log('\n' + text)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
