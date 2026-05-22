/**
 * live-fetch.js
 *
 * 大会中に start.gg API からセットデータを定期ポーリングし、DB に差分 INSERT する。
 *
 * Usage:
 *   node scripts/live-fetch.js --tournament-id=40 --slug=<slug> [--watch] [--interval=120] [--dry-run]
 *
 * --slug は以下のどちらでも可:
 *   "evo-japan-2026-presented-by-levtech"
 *     → トーナメントスラッグ（SF6 イベントを自動選択）
 *   "evo-japan-2026-presented-by-levtech/event/evo-japan-2026-street-fighter-6"
 *     → イベントパスを直接指定
 *
 * 例:
 *   node scripts/live-fetch.js \
 *     --tournament-id=40 \
 *     --slug=evo-japan-2026-presented-by-levtech/event/evo-japan-2026-street-fighter-6 \
 *     --watch --interval=120
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const STARTGG_API   = 'https://api.start.gg/gql/alpha';
const STARTGG_TOKEN = process.env.STARTGG_TOKEN;

// ── 引数パース ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);

  const getArg = (key) => {
    const match = args.find(a => a.startsWith(`--${key}=`));
    return match ? match.split('=').slice(1).join('=') : null;
  };
  const hasFlag = (key) => args.includes(`--${key}`);

  const tournamentId = getArg('tournament-id') ? parseInt(getArg('tournament-id'), 10) : null;
  const slug         = getArg('slug');
  const watchMode    = hasFlag('watch');
  const interval     = getArg('interval') ? parseInt(getArg('interval'), 10) : 120;
  const dryRun       = hasFlag('dry-run');

  if (!tournamentId || isNaN(tournamentId)) {
    console.error('❌ --tournament-id=N が必要です');
    printUsage();
    process.exit(1);
  }
  if (!slug) {
    console.error('❌ --slug=<slug> が必要です');
    printUsage();
    process.exit(1);
  }
  if (interval < 10) {
    console.error('❌ --interval は 10 秒以上にしてください（start.gg レートリミット対策）');
    process.exit(1);
  }

  return { tournamentId, slug, watchMode, interval, dryRun };
}

function printUsage() {
  console.error(
    'Usage: node scripts/live-fetch.js' +
    ' --tournament-id=N --slug=<slug>' +
    ' [--watch] [--interval=120] [--dry-run]',
  );
}

// ── GraphQL ヘルパー ──────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gql(query, variables, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(STARTGG_API, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${STARTGG_TOKEN}`,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (res.status === 429) {
        const wait = Math.pow(2, i + 1) * 1500;
        console.log(`   ⏳ Rate limited — ${wait / 1000}s 待機…`);
        await sleep(wait);
        continue;
      }

      const json = await res.json();
      if (json.errors) {
        const msg = json.errors[0]?.message || '';
        if (msg.includes('complexity') || msg.includes('rate')) {
          const wait = Math.pow(2, i + 1) * 1500;
          console.log(`   ⏳ API 制限 (${msg.slice(0, 50)}) — ${wait / 1000}s 待機…`);
          await sleep(wait);
          continue;
        }
        console.error('   ⚠️ GraphQL エラー:', msg);
        return null;
      }
      return json.data;

    } catch (err) {
      const wait = Math.pow(2, i + 1) * 1000;
      console.error(`   ⚠️ ネットワークエラー (${err.message}) — retry ${i + 1}/${retries}`);
      if (i < retries - 1) await sleep(wait);
    }
  }
  return null;
}

// ── Step 1: start.gg イベント解決 ─────────────────────────────────────────────

async function resolveEvent(slug) {
  // "/event/" を含む場合はイベント直接クエリを試みる
  if (slug.includes('/event/')) {
    const data = await gql(
      `query ($slug: String!) {
        event(slug: $slug) {
          id
          name
          numEntrants
          tournament { id name }
        }
      }`,
      { slug: `tournament/${slug}` },
    );
    const ev = data?.event;
    if (ev) {
      console.log(`✅ イベント: "${ev.name}" (${ev.numEntrants} entrants)`);
      console.log(`   大会: "${ev.tournament.name}"`);
      return {
        eventId:             ev.id,
        eventName:           ev.name,
        tournamentName:      ev.tournament.name,
        startggTournamentId: ev.tournament.id,
      };
    }
    // フォールバック: /event/ 以前の部分をトーナメントスラッグとして使用
    const tournamentSlug = slug.split('/event/')[0];
    console.log(`   ⚠️ イベント直接クエリ失敗 → トーナメントスラッグ "${tournamentSlug}" で再試行`);
    return resolveEventFromTournament(tournamentSlug);
  }

  return resolveEventFromTournament(slug);
}

async function resolveEventFromTournament(tournamentSlug) {
  const data = await gql(
    `query ($slug: String!) {
      tournament(slug: $slug) {
        id
        name
        events {
          id
          name
          numEntrants
          videogame { id }
        }
      }
    }`,
    { slug: `tournament/${tournamentSlug}` },
  );
  const t = data?.tournament;
  if (!t) throw new Error(`トーナメントが見つかりません: ${tournamentSlug}`);
  console.log(`✅ トーナメント: "${t.name}"`);

  // SF6 イベントを優先度順に選択（import-tournament.js と同じロジック）
  const sf6Event =
    t.events?.find(e => /cpt.*premier|premier.*cpt/i.test(e.name)) ||
    t.events
      ?.filter(e => /street fighter 6/i.test(e.name) && !/team|itc|3v3/i.test(e.name))
      .sort((a, b) => (b.numEntrants || 0) - (a.numEntrants || 0))[0] ||
    t.events?.sort((a, b) => (b.numEntrants || 0) - (a.numEntrants || 0))[0];

  if (!sf6Event) throw new Error('SF6 イベントが見つかりません');
  console.log(`   イベント: "${sf6Event.name}" (${sf6Event.numEntrants} entrants, id=${sf6Event.id})`);

  return {
    eventId:             sf6Event.id,
    eventName:           sf6Event.name,
    tournamentName:      t.name,
    startggTournamentId: t.id,
  };
}

// ── Step 2: DB から既存 set ID を読み込む ──────────────────────────────────────

async function loadExistingSetIds(tournamentId) {
  const ids = new Set();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('tournament_sets')
      .select('startgg_set_id')
      .eq('tournament_id', tournamentId)
      .range(from, from + 999);
    if (error) {
      console.error('⚠️ DB エラー (既存 set 読み込み):', error.message);
      break;
    }
    for (const row of (data || [])) ids.add(String(row.startgg_set_id));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return ids;
}

// ── Step 3: DB から全プレイヤーを読み込む ──────────────────────────────────────

async function loadPlayers() {
  let all = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from('players')
      .select('id, handle, startgg_player_id, startgg_player_ids')
      .range(from, from + 999);
    all = all.concat(data || []);
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  const playerMap = new Map(); // startgg_player_id (string) → player row
  const handleMap = new Map(); // handle.toLowerCase() → player row

  for (const p of all) {
    if (p.startgg_player_ids) p.startgg_player_ids.forEach(id => playerMap.set(String(id), p));
    if (p.startgg_player_id)  playerMap.set(String(p.startgg_player_id), p);
    handleMap.set(p.handle.toLowerCase(), p);
  }

  return { playerMap, handleMap, count: all.length };
}

// ── Step 4: start.gg から完了済み set を取得 ──────────────────────────────────
// updatedAfter = null なら全件取得、Unix秒を渡せば差分取得

// ── Step 4a: イベントのフェーズ一覧を取得 ────────────────────────────────────

async function fetchEventPhases(eventId) {
  const data = await gql(
    `query ($eventId: ID!) {
      event(id: $eventId) {
        phases {
          id
          name
          phaseGroups { nodes { id displayIdentifier } }
        }
      }
    }`,
    { eventId },
  );
  return data?.event?.phases || [];
}

// ── Step 4b: フェーズグループ単位でセットを取得（実績あり・複雑度が低い）────────

async function fetchCompletedSets(eventId, _updatedAfterUnused = null) {
  // event-level sets API は complexity が高すぎるため phaseGroup 単位でフェッチする。
  // _updatedAfterUnused は将来の拡張用に引数だけ残す（existingIds で差分検出するため不要）。
  const phases = await fetchEventPhases(eventId);
  if (phases.length === 0) {
    console.log('   ⚠️ フェーズが見つかりません（大会未開始の可能性）');
    return [];
  }

  const allSets = [];

  for (const phase of phases) {
    for (const group of (phase.phaseGroups?.nodes || [])) {
      let page = 1, totalPages = 1;

      while (page <= totalPages) {
        const data = await gql(
          `query ($pgId: ID!, $page: Int!) {
            phaseGroup(id: $pgId) {
              sets(page: $page, perPage: 40, sortType: STANDARD) {
                pageInfo { totalPages }
                nodes {
                  id
                  fullRoundText
                  displayScore
                  winnerId
                  completedAt
                  slots {
                    entrant {
                      id
                      participants {
                        gamerTag
                        prefix
                        player { id }
                      }
                    }
                    standing { stats { score { value } } }
                  }
                }
              }
            }
          }`,
          { pgId: group.id, page },
        );

        const setsData = data?.phaseGroup?.sets;
        if (!setsData) break;
        totalPages = setsData.pageInfo?.totalPages || 1;

        for (const set of (setsData.nodes || [])) {
          // 未完了セット（completedAt が null）はスキップ
          if (!set.completedAt || !set.winnerId) continue;
          if (!set.slots || set.slots.length < 2) continue;
          if (!set.slots[0]?.entrant || !set.slots[1]?.entrant) continue;
          // phase_name をセットに付与
          set._phaseName = phase.name;
          allSets.push(set);
        }

        page++;
        if (page <= totalPages) await sleep(1200); // レートリミット対策
      }
    }
  }

  return allSets;
}

// ── Step 5: 新規 set を DB に INSERT ──────────────────────────────────────────

async function processNewSets({
  rawSets, existingIds, playerMap, handleMap, tournamentId, dryRun,
}) {
  // 既存 ID で絞り込む（差分のみ）
  const newSets = rawSets.filter(s => !existingIds.has(String(s.id)));
  if (newSets.length === 0) return { inserted: 0, dryCount: 0, newPlayers: 0, candidates: [] };

  const toInsert     = [];
  let   newPlayers   = 0;
  const candidates   = [];  // gamerTag マッチ候補

  // プレイヤー解決ヘルパー
  const resolvePlayer = async (slot) => {
    const p = slot.entrant?.participants?.[0];
    if (!p) return null;
    const sgId = p.player?.id ? String(p.player.id) : null;

    // 1. startgg_player_id / startgg_player_ids で照合
    if (sgId) {
      const found = playerMap.get(sgId);
      if (found) return found;
    }

    // 2. gamerTag (case-insensitive) フォールバック
    const tagLower = (p.gamerTag || '').toLowerCase();
    const candidate = handleMap.get(tagLower);
    if (candidate) {
      candidates.push({
        handle:    candidate.handle,
        db_id:     candidate.id,
        new_sgid:  sgId,
      });
      return candidate;
    }

    // 3. 新規プレイヤー自動作成
    if (dryRun) {
      console.log(`   [dry-run] プレイヤー新規作成: ${p.gamerTag} (sg_id=${sgId})`);
      return null;
    }

    const { data: np, error } = await supabase.from('players').insert({
      handle:              p.gamerTag,
      startgg_player_id:  p.player?.id || null,
      startgg_player_ids: sgId ? [sgId] : [],
      team:               p.prefix || null,
    }).select('id, handle').single();

    if (error) {
      console.error(`   ⚠️ プレイヤー作成失敗 (${p.gamerTag}): ${error.message}`);
      return null;
    }
    if (np) {
      if (sgId) playerMap.set(sgId, np);
      handleMap.set(np.handle.toLowerCase(), np);
      newPlayers++;
      console.log(`   🆕 新規プレイヤー: ${np.handle} (db_id=${np.id})`);

      // tournament_entrants にも追加
      await supabase.from('tournament_entrants').upsert({
        tournament_id:      tournamentId,
        player_id:          np.id,
        startgg_entrant_id: slot.entrant.id,
        seed:               null,
        placement:          null,
      }, { onConflict: 'tournament_id,player_id', ignoreDuplicates: true });

      return np;
    }
    return null;
  };

  for (const set of newSets) {
    const slot0 = set.slots[0];
    const slot1 = set.slots[1];
    const winnerSlot = slot0.entrant.id === set.winnerId ? slot0 : slot1;
    const loserSlot  = slot0.entrant.id === set.winnerId ? slot1 : slot0;

    const winner = await resolvePlayer(winnerSlot);
    const loser  = await resolvePlayer(loserSlot);

    toInsert.push({
      tournament_id:      tournamentId,
      startgg_set_id:     set.id,
      phase_name:         set._phaseName                    || null,
      round_text:         set.fullRoundText                 || null,
      display_score:      set.displayScore                  || null,
      winner_id:          winner?.id                        || null,
      loser_id:           loser?.id                         || null,
      winner_score:       winnerSlot.standing?.stats?.score?.value ?? null,
      loser_score:        loserSlot.standing?.stats?.score?.value  ?? null,
      winner_entrant_id:  winnerSlot.entrant.id,
      loser_entrant_id:   loserSlot.entrant.id,
    });
  }

  if (dryRun) {
    return { inserted: 0, dryCount: toInsert.length, newPlayers, candidates };
  }

  // バッチ upsert
  let inserted = 0;
  const batchSize = 100;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const { error } = await supabase.from('tournament_sets')
      .upsert(batch, { onConflict: 'tournament_id,startgg_set_id' });
    if (error) {
      console.error(`   ⚠️ INSERT エラー: ${error.message}`);
    } else {
      inserted += batch.length;
      // メモリ上の既存 ID セットを更新（次サイクルで重複回避）
      for (const s of batch) existingIds.add(String(s.startgg_set_id));
    }
  }

  return { inserted, dryCount: 0, newPlayers, candidates };
}

// ── タイムスタンプ文字列 ───────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleTimeString('ja-JP', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── メイン ────────────────────────────────────────────────────────────────────

async function main() {
  const { tournamentId, slug, watchMode, interval, dryRun } = parseArgs();

  console.log('════════════════════════════════════════════════════════════');
  console.log(' live-fetch.js — start.gg ライブ差分取得');
  console.log(`  tournament_id  : ${tournamentId}`);
  console.log(`  slug           : ${slug}`);
  console.log(`  モード         : ${watchMode ? `--watch  (間隔 ${interval}s)` : '単発実行'}`);
  if (dryRun) console.log('  ⚠  DRY RUN — DB 書き込みなし');
  console.log('════════════════════════════════════════════════════════════\n');

  // ── イベント解決
  let eventInfo;
  try {
    eventInfo = await resolveEvent(slug);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  // ── DB の startgg_tournament_id / startgg_event_id を更新
  if (!dryRun) {
    const { error } = await supabase.from('tournaments').update({
      startgg_tournament_id: eventInfo.startggTournamentId,
      startgg_event_id:      eventInfo.eventId,
    }).eq('id', tournamentId);
    if (error) {
      console.error('⚠️ startgg ID 更新失敗:', error.message);
    } else {
      console.log('✓ DB: startgg_tournament_id / startgg_event_id 更新');
    }
  }

  // ── 初期データ読み込み
  console.log('\n📥 DB から既存データ読み込み中…');
  const existingIds = await loadExistingSetIds(tournamentId);
  const { playerMap, handleMap, count: playerCount } = await loadPlayers();
  console.log(`   既存 set IDs : ${existingIds.size} 件`);
  console.log(`   players      : ${playerCount} 件\n`);

  // updatedAfter カーソル（Unix 秒）
  // null = 全件取得、値を設定 = 以降の差分のみ取得
  let updatedAfter  = null;
  let cycleCount    = 0;
  let totalInserted = 0; // 今セッションで INSERT した件数

  // ── ポーリングサイクル
  async function runCycle() {
    cycleCount++;
    const cycleStartSec = Math.floor(Date.now() / 1000);

    try {
      const rawSets = await fetchCompletedSets(eventInfo.eventId, updatedAfter);

      const { inserted, dryCount, newPlayers, candidates } = await processNewSets({
        rawSets,
        existingIds,
        playerMap,
        handleMap,
        tournamentId,
        dryRun,
      });

      const count = dryRun ? dryCount : inserted;
      totalInserted += count;

      // ログ出力
      const prefix = dryRun ? '[dry-run] ' : '';

      if (count > 0) {
        console.log(
          `[${ts()}] ${prefix}+${count} sets` +
          (watchMode ? `  (累計: ${totalInserted})` : '') +
          (newPlayers > 0 ? `  🆕 新規 ${newPlayers} players` : '') +
          `  (start.gg 完了済み: ${rawSets.length} sets)`,
        );
        if (candidates.length > 0) {
          console.log('   🔗 gamerTag マッチ候補 (手動確認推奨):');
          candidates.forEach(c =>
            console.log(`      ${c.handle}  (db_id=${c.db_id}, new_sg_id=${c.new_sgid})`),
          );
        }
      } else if (cycleCount === 1) {
        // 初回サイクルは変化なしでも必ず出力
        console.log(
          `[${ts()}] ${prefix}差分なし` +
          ` (start.gg 完了済み: ${rawSets.length} sets、DB 既存: ${existingIds.size} sets)`,
        );
      } else if (watchMode && cycleCount % 5 === 0) {
        // --watch 中は 5 サイクルに 1 回だけ「変化なし」を表示
        console.log(`[${ts()}] 変化なし  (cycle ${cycleCount})`);
      }

      // カーソルを進める（次サイクルはこれ以降の差分のみ取得）
      updatedAfter = cycleStartSec;

    } catch (err) {
      console.error(`[${ts()}] ⚠️ サイクルエラー: ${err.message}`);
      // クラッシュさせない — 次サイクルで再試行
    }
  }

  // ── 初回実行
  await runCycle();

  if (!watchMode) {
    console.log('\n✅ 完了（単発実行）');
    return;
  }

  // ── --watch モード
  console.log(`\n👁  --watch モード開始  間隔: ${interval}s  Ctrl+C で停止\n`);

  let shuttingDown = false;
  let timer        = null;

  const scheduleNext = () => {
    timer = setTimeout(async () => {
      if (shuttingDown) return;
      await runCycle();
      if (!shuttingDown) scheduleNext();
    }, interval * 1000);
  };

  scheduleNext();

  process.on('SIGINT', () => {
    shuttingDown = true;
    if (timer) clearTimeout(timer);
    console.log(`\n[${ts()}] 🛑 Graceful shutdown — セッション合計 +${totalInserted} sets`);
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
