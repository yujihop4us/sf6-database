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
import { syncPrizesAndPoints } from './sync-prizes-points.js'
import { computeTierChanges } from './update-player-tiers.js'

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
const ALL = !!args.all
/** Tier 更新は影響が広いため既定で行わない。明示的に --with-tiers を渡したときのみ */
const WITH_TIERS = !!args['with-tiers']

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

  // 対象大会の選定。
  // start.gg 系と Liquipedia 系の両方を扱う。
  // Capcom Cup / EWC 本戦は startgg_event_id が null（Liquipedia のみ）であり、
  // Tier・ポイントの根拠となる最重要大会がまさにそこに含まれるため除外してはならない。
  let q = supabase
    .from('tournaments')
    .select('id, name, slug, startgg_slug, startgg_event_id, liquipedia_url, end_date, total_prize_usd, cpt_event_type')
    .or('startgg_event_id.not.is.null,liquipedia_url.not.is.null')

  if (ONLY_ID) {
    q = q.eq('id', ONLY_ID)
  } else if (!ALL) {
    const since = new Date(Date.now() - DAYS * 86400_000).toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    q = q.gte('end_date', since).lte('end_date', today)
  } else {
    // --all: 未開催の大会は対象外
    q = q.lte('end_date', new Date().toISOString().slice(0, 10))
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
    const r = { id: t.id, name: t.name, actions: [], gaps: [], notes: [], error: null, points: 0, bioCandidates: [] }

    try {
      // start.gg を持たない大会（Capcom Cup / EWC 本戦）は Liquipedia が唯一のソース。
      // 手編集のため機械的な件数照合ができず、セットの自動補完もできない。
      // 欠落は gaps として通知し、人が判断する。
      const isLiquipediaOnly = !t.startgg_event_id
      const truth = isLiquipediaOnly ? null : await fetchStartggTruth(t.startgg_event_id)
      if (!isLiquipediaOnly && !truth) {
        r.error = 'start.gg イベント取得失敗'; results.push(r); continue
      }

      let db = await fetchDbState(t.id)
      if (truth) {
        console.log(`  start.gg: sets=${truth.completedSets} entrants=${truth.numEntrants} state=${truth.state}`)
      } else {
        console.log('  source  : Liquipedia のみ（start.gg 無し）')
      }
      console.log(`  DB      : sets=${db.setsWithWin} entrants=${db.entrants} placement=${db.placements} chars=${db.chars} prize=${db.prizes}`)

      if (truth && truth.state !== 'COMPLETED') {
        console.log('  ⏭ まだ完了していないためスキップ')
        r.actions.push('skipped (not completed)')
        results.push(r)
        continue
      }

      // Liquipedia のみの大会は機械的な件数照合ができない。
      // 順位欠落は末尾の共通チェックで拾うため、ここではセット/エントラントのみ見る
      if (isLiquipediaOnly) {
        if (db.sets === 0)     r.gaps.push('セット0件（Liquipedia から手動取込が必要）')
        if (db.entrants === 0) r.gaps.push('エントラント0件')
      }

      // ── 1. セット同期 ────────────────────────────────────────────────
      // 「行そのものが足りない」かどうかで判定する。
      // winner_id が null なのは選手の名寄せ失敗であって取り込み漏れではないため、
      // ここで混同すると毎回 import-sets が無駄に走る
      if (truth && db.sets < truth.completedSets) {
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
      if (truth && truth.standings.length) {
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

      // ── 4. 賞金 + サーキットポイント ─────────────────────────────────
      // placement 確定後でないとタイ層を解決できないため、必ずここで実行する
      if (t.liquipedia_url) {
        try {
          const pr = await syncPrizesAndPoints(t, { dryRun: DRY_RUN })
          if (pr.skipped) {
            r.notes.push(`賞金: ${pr.skipped}`)
          } else {
            if (pr.prizeUpdated)  r.actions.push(`賞金: ${pr.prizeUpdated}件更新`)
            if (pr.pointsUpserted) r.actions.push(`ポイント(${pr.circuit}): ${pr.pointsUpserted}件`)
            r.points = pr.pointsUpserted
            if (pr.unmatched.length) {
              r.notes.push(`賞金表の未マッチ ${pr.unmatched.length}件: ${pr.unmatched.slice(0, 5).join(', ')}`)
            }
          }
        } catch (e) {
          // cpt_points 未作成やレート制限はここで拾い、他の大会の処理は続行する
          r.notes.push(`賞金/ポイント同期失敗: ${e.message}`)
        }
      } else {
        db = await fetchDbState(t.id)
        if (db.prizes === 0) r.notes.push('賞金未設定（liquipedia_url なし）')
      }

      // ── 5. Bio 見直しキュー ──────────────────────────────────────────
      // 高額賞金大会の Top 3 は注目度が上がるため、Bio を人が見直す候補に挙げる。
      // 自動書き換えはしない（人物記述を無検証で更新するのは品質リスク）
      if (['capcom_cup', 'ewc'].includes(t.cpt_event_type)) {
        const { count: entCount } = await supabase
          .from('tournament_entrants').select('*', { count: 'exact', head: true }).eq('tournament_id', t.id)
        if (entCount > 0 && entCount <= 64) {
          const { data: top3 } = await supabase
            .from('tournament_entrants')
            .select('placement, players(id, handle)')
            .eq('tournament_id', t.id)
            .lte('placement', 3)
            .order('placement')
          r.bioCandidates = (top3 ?? []).map(x => ({
            placement: x.placement,
            id: x.players?.id,
            handle: x.players?.handle,
          }))
        }
      }

      // 再検証
      db = await fetchDbState(t.id)
      if (truth && db.sets < truth.completedSets) {
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

  // ── Tier 昇格（--with-tiers 指定時のみ）────────────────────────────────
  // 既定で走らせない。100人規模で tier が変わりうるため、
  // 内容を人が確認してから適用する運用にする
  let tierSummary = null
  if (WITH_TIERS) {
    const { changes } = await computeTierChanges()
    tierSummary = { total: changes.length, toA: changes.filter(c => c.to === 'A').length }
    if (DRY_RUN) {
      console.log(`▸ Tier 昇格候補: ${changes.length} 名（DRY-RUN のため未適用）`)
    } else {
      console.log(`▸ Tier 昇格を適用: ${changes.length} 名`)
      runScript('update-player-tiers.js', [])
    }
  }

  report(results, tierSummary)

  // 未解決ギャップがあれば異常終了 → GitHub Actions が通知を送る
  const unresolved = results.filter(r => r.error || r.gaps.length)
  if (unresolved.length) {
    console.log(`\n⚠ 未解決あり: ${unresolved.length} 大会`)
    process.exit(1)
  }
  console.log('\n✅ すべて同期済み')
}

// ── レポート出力（GitHub Actions のジョブサマリに出す）──────────────────────

function report(results, tierSummary) {
  const lines = []
  lines.push('## 大会データ同期レポート', '')
  if (!results.length) {
    lines.push('対象大会はありませんでした。')
  } else {
    lines.push('| 大会 | セット | 順位 | キャラ | 賞金 | pts | 状態 |')
    lines.push('|---|---|---|---|---|---|---|')
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
      lines.push(`| ${r.name} | ${sets} | ${pl} | ${ch} | ${pz} | ${r.points || '—'} | ${st} |`)
    }
    const acted = results.filter(r => r.actions.length)
    if (acted.length) {
      lines.push('', '### 実行した処理', '')
      for (const r of acted) lines.push(`- **${r.name}**: ${r.actions.join(' / ')}`)
    }

    const bio = results.filter(r => r.bioCandidates?.length)
    if (bio.length) {
      lines.push('', '### Bio 見直し候補（高額賞金大会の Top 3）', '')
      lines.push('注目度が上がるため、選手ページの Bio を人が確認・更新することを推奨します。', '')
      for (const r of bio) {
        for (const c of r.bioCandidates) {
          lines.push(`- ${c.placement}位 **${c.handle}** — ${r.name} — https://sf6-database.vercel.app/player/${c.id}`)
        }
      }
    }

    if (tierSummary) {
      lines.push('', `### Tier`, '', `昇格候補 ${tierSummary.total} 名（うち A: ${tierSummary.toA} 名）`)
    }
  }
  const text = lines.join('\n')
  console.log('\n' + text)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
