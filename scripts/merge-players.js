/**
 * merge-players.js — 同一人物の重複 players レコードを1つに統合する
 *
 * start.gg アカウントが複数ある選手は取り込み時に別レコードが作られ、
 * 戦績・H2H が分散する（例: Hinao id=27 / REJECT ひなお id=25790）。
 * drop 側を参照する全行を keep 側に付け替え、start.gg ID を keep に集約してから drop を削除する。
 *
 * 安全策:
 *   - 既定は dry-run（件数表示のみ）。--apply で実行
 *   - 一意制約に衝突する行（同じ大会に両方が出ている等）があれば何もせず中止
 *   - 全更新を1つの DO ブロック（＝1トランザクション）で実行。付け替え漏れがあれば players の FK で DELETE が失敗し全体が戻る
 *
 * 使い方:
 *   node scripts/merge-players.js --keep=27 --drop=25790           # dry-run
 *   node scripts/merge-players.js --keep=27 --drop=25790 --apply
 *
 * SQL は Supabase Management API 経由（SUPABASE_ACCESS_TOKEN が必要）。
 * supabase-js ではトランザクションが張れないため。
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)
const KEEP = Number(args.keep)
const DROP = Number(args.drop)
const APPLY = !!args.apply

/**
 * players を参照する列。[テーブル, 列, 一意制約の列（その列を含む場合）]
 * FK のある列に加え、FK 無しで player id を持つ列（tournament_sets.p1/p2_player_id, h2h_records）も含める。
 * 新しい参照列を追加したらここにも追加すること。漏れていれば FK のある列は DELETE 失敗で検出される
 */
const REFS = [
  ['tournament_entrants', 'player_id', ['tournament_id', 'player_id']],
  ['tournament_sets', 'winner_id'],
  ['tournament_sets', 'loser_id'],
  ['tournament_sets', 'p1_player_id'],
  ['tournament_sets', 'p2_player_id'],
  ['cpt_points', 'player_id', ['player_id', 'tournament_id', 'circuit']],
  ['h2h_records', 'p1_id'],
  ['h2h_records', 'p2_id'],
  ['h2h_records', 'winner_id'],
  ['sets', 'player1_id'],
  ['sets', 'player2_id'],
  ['sets', 'winner_id'],
  ['live_matches', 'player1_id'],
  ['live_matches', 'player2_id'],
  ['head_to_head', 'player_a_id', ['player_a_id', 'player_b_id']],
  ['head_to_head', 'player_b_id', ['player_a_id', 'player_b_id']],
  ['player_tournament_results', 'player_id', ['player_id', 'tournament_id']],
  ['player_characters', 'player_id', ['player_id', 'character_id']],
  ['player_social_links', 'player_id', ['player_id', 'platform']],
  ['player_biography', 'player_id', ['player_id']],
  ['player_career_timeline', 'player_id'],
  ['team_history', 'player_id'],
  ['poll_votes', 'voted_player_id'],
]

async function sql(query) {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const body = await res.json()
  if (!res.ok || !Array.isArray(body)) throw new Error(body.message ?? JSON.stringify(body))
  return body
}

async function main() {
  if (!Number.isInteger(KEEP) || !Number.isInteger(DROP) || KEEP === DROP) {
    throw new Error('--keep=<id> --drop=<id> を別々の整数で指定してください')
  }
  if (!process.env.SUPABASE_ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN が未設定です')

  const players = await sql(
    `select id, handle, startgg_player_ids from players where id in (${KEEP}, ${DROP}) order by id = ${DROP}`,
  )
  if (players.length !== 2) throw new Error(`players が2件見つかりません: ${JSON.stringify(players)}`)
  const [keep, drop] = players
  console.log(`keep: id=${keep.id} ${keep.handle} startgg=${JSON.stringify(keep.startgg_player_ids)}`)
  console.log(`drop: id=${drop.id} ${drop.handle} startgg=${JSON.stringify(drop.startgg_player_ids)}`)

  // 件数と一意制約の衝突を1クエリで調べる
  const checks = REFS.map(([table, col, unique]) => {
    const others = (unique ?? []).filter(c => c !== col)
    const conflict = unique
      ? `(select count(*) from ${table} d where d.${col} = ${DROP} and exists (
           select 1 from ${table} k where k.${col} = ${KEEP}${others.map(c => ` and k.${c} is not distinct from d.${c}`).join('')}))`
      : '0'
    return `select '${table}.${col}' as ref,
      (select count(*) from ${table} where ${col} = ${DROP})::int as rows,
      ${conflict}::int as conflicts`
  })
  const counts = await sql(checks.join('\nunion all\n'))
  console.log('\n付け替え対象:')
  for (const c of counts) {
    if (c.rows || c.conflicts) console.log(`  ${c.ref.padEnd(34)} ${String(c.rows).padStart(5)} 行${c.conflicts ? `  ⚠ 衝突 ${c.conflicts}` : ''}`)
  }
  const conflicts = counts.filter(c => c.conflicts > 0)
  if (conflicts.length) {
    throw new Error(`一意制約に衝突する行があるため中止: ${conflicts.map(c => c.ref).join(', ')}（手動で解消してください）`)
  }

  if (!APPLY) {
    console.log('\n(dry-run) --apply で実行します')
    return
  }

  // drop の行を削除前に出力しておく（復元用）
  const [backup] = await sql(`select to_jsonb(p) as row from players p where id = ${DROP}`)
  console.log(`\n削除する players 行（復元用）:\n${JSON.stringify(backup.row)}`)

  // DO ブロックは単一文なので、途中で失敗すれば全体がロールバックされる
  await sql(`
    do $$ begin
    ${REFS.map(([table, col]) => `update ${table} set ${col} = ${KEEP} where ${col} = ${DROP};`).join('\n    ')}
    update players set startgg_player_ids = (
      select array_agg(distinct x order by x) from unnest(
        coalesce((select startgg_player_ids from players where id = ${KEEP}), '{}')
        || coalesce((select startgg_player_ids from players where id = ${DROP}), '{}')
      ) x
    ) where id = ${KEEP};
    delete from players where id = ${DROP};
    end $$;
  `)

  const [after] = await sql(
    `select (select count(*) from players where id = ${DROP})::int as dropped_left,
            (select startgg_player_ids from players where id = ${KEEP}) as startgg_player_ids`,
  )
  if (after.dropped_left) throw new Error('drop 側の players 行が残っています')
  console.log(`\n✅ 統合完了: id=${DROP} → id=${KEEP}  startgg=${JSON.stringify(after.startgg_player_ids)}`)
}

main().catch(e => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
