# SF6 Database — Progress Log

## フェーズ計画

- Phase 1: 大会ページ `/tournament/[id]` — ✅ **本体マージ済み・ISR(60s)有効**
- Phase 2: 選手ページ `/player/[id]` — ✅ **実装済み・ISR(60s)有効**
- Phase 3: ライブ配信ダッシュボード `/live/[tournamentId]` — 実装済み

---

## 進行中

- **EVO Japan 2026 (id=40) ライブ取得** — `live-fetch.js --watch` 稼働中 (PID: 57670) ✅ 累計 650+ sets
- **EVO Japan 2026 ライブページ** — BRACKETタブ DB表示・マルチチャンネルSTREAM実装済み ✅

---

## 最新の作業ログ

### 2026-05-29 — Liquipedia Cron バックフィル実装

**対象:** `src/lib/liquipedia-backfill.ts`, `src/app/api/cron/backfill/route.ts`, `vercel.json`, `supabase/migrations/20260529_backfill_tracking.sql`

#### 実装内容

**`src/lib/liquipedia-backfill.ts`** — 共有モジュール
- `fetchLiquipediaHtml(url)`: 4秒待機 + 429/Cloudflare検出
- `fetchPlayerFromLiquipedia(handle)`: country_code + main_character（選手ページのinfobox）
- `fetchTournamentPrizePool(url)`: csstable-widget-row をパースし placement→賞金テーブルを返す
- `getBackfillTargets(supabase, opts)`: placement 昇順で欠損プレイヤー（最大8名）+ prize_pool未取得の大会（1件）

**`src/app/api/cron/backfill/route.ts`** — Cron API
- `Authorization: Bearer CRON_SECRET` で認証
- 1実行: 大会賞金1件 + 選手8名処理
- 429で即停止、`stopped_reason` を返す
- 4分タイムアウト保護
- 更新: `tournament_entrants.prize_amount`, `tournaments.prize_pool`, `players.country_code`, `players.main_character`, `players.liquipedia_checked_at`

**`vercel.json`** — `0 */6 * * *`（6時間ごと）

**Migration**: `players.liquipedia_checked_at` 追加、11大会の `tournaments.liquipedia_url` 設定

#### ローカルテスト結果
```json
{
  "processed_players": 8,
  "updated_players": 5,
  "processed_tournaments": 1,
  "updated_prize_entries": 14,
  "remaining_players": 246,
  "remaining_tournaments": 2,
  "elapsed_ms": 46079
}
```
- DH Atlanta 2026: prize_pool = $50,000、14エントリに賞金設定
- 選手5名更新: Kite→MX, Daigo→FR, Shine→Kimberly, etc.

#### テスト方法
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/backfill
```

---

### 2026-05-29 — Step 2 HTMLパーサー修正（Liquipedia match-popup方式）

**対象:** `scripts/post-tournament-update.js`

#### 問題と解決

**旧パーサー**: `data-player/character` 属性、`class="race"` など複数パターン → 全大会で0選手  
**原因**: Liquipedia SF6の実際のHTML構造は bracket popup 形式

**実際の構造（全大会共通）:**
```html
match-info-header-opponent-left → href="/fighters/Slug">Handle</a>  ← 左プレイヤー
match-info-header-winner        → href="/fighters/Slug">Handle</a>  ← 右プレイヤー
brkts-popup-body-element-thumbs → "CharName&#160;<img"              ← 左キャラ
brkts-popup-body-element-thumbs → "<img...X_SF6_icon...>&#160;CharName" ← 右キャラ
```

**新実装**: `match-info-header-opponent-left` 出現位置でHTMLを分割し、各マッチブロックで選手+キャラを抽出。複数ゲームの最頻出キャラを main character として採用。DB検索はテキスト → URL decoded href の順でフォールバック。

**`LIQUIPEDIA_CHAR_NORMALIZE` 更新**: `A.K.I.` → `Aki`（DB canonical 名に統一）

#### キャラデータ更新結果（全大会）

| 大会 | Sets | Char% | 選手 main_char |
|------|------|-------|----------------|
| CC11 | 142 | **100%** ✅ | 46/46 |
| CC X | 143 | **92%** | 41/42 |
| EWC 2024 | 67 | **91%** | 24/24 |
| EWC 2025 | 88 | **94%** | 36/36 |
| CB2026 | 4391 | 0% | 53/492 |
| EvoJP2026 | 1376 | 2% | 19/436 |
| DH Atlanta | 242 | 17% | 42/89 |
| Evo2025 | 1580 | 3% | 48/459 |
| CB2025 | 1269 | 5% | 35/445 |
| EvoJP2025 | 1328 | 4% | 28/426 |

小規模大会 (CC/EWC): 91-100% ✅  
大規模大会: Liquipedia は Top 32 のみ記録のため 0-17%（今後 start.gg Step 1 で補完予定）

#### 注目データ
- Xiao Hai: M.Bison → **Mai**（CB2026でスイッチ確認）
- Vxbao: M.Bison → **Mai**（同上）

---

### 2026-05-29 — post-tournament-update 改善 + 大会データ一括処理（CB2026）

**対象:** `scripts/post-tournament-update.js`, `scripts/backfill-main-characters.js`, `supabase/migrations/`

#### 実施内容

**1. players.main_character バックフィル**
- 新スクリプト `scripts/backfill-main-characters.js` 作成
- 最新大会優先ロジック: 大会 start_date 降順で最頻出キャラを選択
- CC11 データから 48 選手の `main_character` を更新

**2. players テーブル migration**
- `supabase/migrations/20260531_player_char_tournament.sql`: `main_character_tournament_id` カラム追加
  - どの大会のデータで main_character を設定したかを追跡

**3. tournament_meta 一括 migration**
- `supabase/migrations/20260531_tournament_meta_bulk.sql`: 6大会の `cpt_event_type`, `ewc_qualifying_spots`, `logo_url` 設定
- `supabase/migrations/20260530_ewc_qualifying_spots.sql`: CB2026 の `ewc_qualifying_spots=2` 設定

**4. CB2026 post-tournament-update 実行**
- `--skip-step1 --liquipedia-url` オプション追加（start.gg API スキップ：2900セット×760ms≒74分を回避）
- Step 2（Liquipedia ブラケット）: 0選手抽出（ページ形式が異なる or 未記入）
- Step 4（country_code）: 12名更新（Problem-X→GB, iDom→US, K-Brad→US など）
  - IP レート制限でブロック → 処理中断

**5. post-tournament-update.js 改善（commit 9bce109）**
- `fetchText`: Cloudflare レート制限ページ検出 + 指数バックオフ（60/120/240s）
- Step 2: 4種類の追加 HTMLパターン + 0選手時デバッグ出力
- Step 4: `--step4-limit` オプション（デフォルト100名）+ 連続失敗時60s一時停止
- `backfill-characters.js`: PostgREST 1000行上限を回避するページネーション

#### キャラデータ状況
- CC11 のみ 99% カバー（start.gg から取得済み）
- その他全大会: 0%（Liquipedia スクレイプ待ち）

#### country_code 状況
- EWC系（小規模）: 73-94%
- CC11/CC X: 52-60%
- 大規模オープン大会（Evo, CB, EvoJP）: 2-9%

### 2026-05-29 — Step 4 対象選手選択ロジック修正 + 全大会 country_code 一括更新

**対象:** `scripts/post-tournament-update.js`

#### 問題と修正

**Step 4 が全 entrant にリクエスト送信 → Cloudflare IP ブロックの原因**

新ロジック（大会規模別に3戦略）:
- **Strategy C** (≤50名): 全 entrant を `tournament_entrants` から取得
- **Strategy A** (大規模 + placement あり): `placement ORDER BY ASC LIMIT 30`
- **Strategy B** (大規模 + placement なし): `final_pool_identifier` + `top24_pool_identifier` で sets フィルタ（CB2026 → pool=VVX15,PX133）

**Step 2 も top-phase フィルタを適用**: `tournaments.final_pool_identifier` / `top24_pool_identifier` を自動検出し、そのフェーズのセットのみ winner_character を更新

**`--step4-limit` デフォルト変更**: 100 → 30

#### country_code 更新結果（全 10 大会）

| 大会 | 更新前 | 更新後 | 追加 |
|------|--------|--------|------|
| CB2026 | 64/712 (9%) | 75/712 (11%) | +11 |
| EvoJP2026 | 10/657 (2%) | 19/657 (3%) | +9 |
| DH Atlanta | 34/121 (28%) | 48/121 (40%) | +14 |
| Evo2025 | 31/659 (5%) | 43/659 (7%) | +12 |
| CB2025 | 34/573 (6%) | 40/573 (7%) | +6 |
| EvoJP2025 | 19/649 (3%) | 32/649 (5%) | +13 |
| CC11 | 29/48 (60%) | 42/48 (88%) | +13 |
| CC X | 25/48 (52%) | 41/48 (85%) | +16 |
| EWC 2024 | 30/32 (94%) | 32/32 (100%) ✅ | +2 |
| EWC 2025 | 35/48 (73%) | 45/48 (94%) | +10 |

#### Step 2 (Liquipedia キャラスクレイプ) 状況
- 全大会で 0 選手抽出 — `brkts-bracket-wrapper` は存在するが character データなし
- CC11/CC X は group-table 形式（`brkts-opponent-hover`）で bracket とは別構造
- 今後: Liquipedia WikiTable の別セクションにキャラデータがある可能性あり

---

### 2026-05-28 — 順位表修正 + CPT ポイント + 賞金表示 + 参加者数修正

**対象:** `src/app/tournament/[id]/page.tsx`, `src/app/tournament/[id]/TournamentClient.tsx`

#### 修正内容

**1. inferPlacements 書き直し（pool_identifier ベース）**
- Path A: `pool_identifier` が利用可能な場合（CB2026 以降）
  - GF の `pool_identifier` で Top 8（VVX15）を特定
  - `top8MinId` フィルタで Top 24（PX133）を特定（再インポート高IDセット除外）
  - `assignLosers()` : losers ラウンドを namedDepth 降順でソートし rank 割り当て
  - Top 8: 3rd–8th, Top 24: 9th–24th を正確に割り当て
  - 残り: phase_name 深さ（Round 3 > Round 2 > Round 1）でグループタイ
- Path B: `pool_identifier = null` の旧トーナメントは従来のクラスター方式を維持
- 動作確認: CB2026 全1–24位が Liquipedia 結果と完全一致

**2. CPT Premier ポイント追加（TournamentClient.tsx）**
- `CPT_PREMIER_IDS`（tournament id の Set）と `CPT_PREMIER_POINTS`（順位→ポイント対応表）を定義
- StandingsTable に `isCptPremier` prop 追加
- CPT Premier 大会は: 32位以内のみデフォルト表示、CPT ポイント列追加、1位に「🏆 CC出場権」バッジ
- 「全選手を表示」ボタンで 33位以降を展開可能

**3. 賞金総額 DB 更新**
- `UPDATE tournaments SET total_prize_usd = 19720 WHERE id = 48` → $19,720 表示

**4. 参加者数修正**
- TOURNAMENT_REAL_STATS に `48: { numEntrants: 1452, totalSets: 1361 }` 追加
- Supabase anon キーの 1000行上限を回避し正確な 1452 を表示

---

### 2026-05-28 — Top 24 データ backfill + タイムライン 2フェーズ表示

**対象:** `scripts/import-sets.js`, `src/app/tournament/[id]/TournamentClient.tsx`

#### 問題
- CB2026 の Top 24 ブラケット（start.gg phase名: "Top 24"）のセット結果が DB に未登録
- 15 セットの Top 24 ブラケット構造は存在するが `winner_id = NULL`（backfill 未実施）

#### 調査で判明した CB2026 フェーズ構造（start.gg）
```
Round 1 (27 pools, A103-D134 etc.)
Round 2 (8 pools, J104-L123)
Round 3 (2 pools: NA133×16sets, OA133×16sets)
Top 24  (1 pool:  PX133×20sets) ← phase_name="Top 24", pool_identifier="PX133"
Top 8   (1 pool:  VVX15×11sets) ← phase_name="Top 8",  pool_identifier="VVX15"
```
- PX133 ラウンド: WQF×4, LR1×8, LR2×4, LR3×4
- VVX15 ラウンド: LR1×2, WSF×2, LQF×2, WF×1, LSF×1, LF×1, GF×1, GFR×1

#### 実装

**`scripts/import-sets.js` 改修**
- `allSets.push()` に `pool_identifier: group.displayIdentifier` を追加
- 今後のインポートで pool_identifier が保存されるよう修正
- `node scripts/import-sets.js combo-breaker-2026` 実行 → 1361 sets upsert 完了

**`detectFinalPhases()` 改修**
- `top8MinId` フィルタ追加: `s.id >= top8MinId` のセットを候補から除外
  - 再インポートで高 ID を持つ通常プールセットの誤検出を防止
- Top 24 検出: `id < top8MinId` のセットのみで maxId 最大の小プールを選択
  - CB2026: PX133 (maxId=26547) > OA133 (26495) > NA133 (26478) → PX133 ✓

**新定数追加**
- `TOP24_TIMELINE`: LR1 → WQF → LR2 → LR3
- `TOP8_TIMELINE`: LR1 → WSF → LQF → WF → LSF → LF → GF → GFR
- `TOP24_FLOW_NOTES`, `TOP8_FLOW_NOTES`: フェーズ別フロー注釈

**`BracketTimeline` 改修**
- 複数フェーズを個別レンダリング: 各フェーズに SectionDivider + タイムライン
- `getPhaseTimeline(phaseName)` でフェーズ別の order/flowNotes/label/isTop8 を取得
- `sortRoundsByTimeline(roundGroups, order)` をユーティリティ関数に分離

**`BracketView` ルーティング更新**
- `detectFinalPhases().length >= 2` のとき BracketTimeline を優先使用
- CB2026: Top 24 + Top 8 の 2フェーズ → BracketTimeline で統合表示

#### 表示結果（CB2026）
```
───────────── TOP 24 ─────────────
🔴 LOSERS ROUND 1       ← Round 3 losers drop in      (8 sets)
🔵 WINNERS QUARTER-FINAL                               (4 sets)
🔴 LOSERS ROUND 2       ← WQF losers drop here        (4 sets)
🔴 LOSERS ROUND 3       ← LR2 winners continue        (4 sets)

━━━━━━━━━ 🏆 TOP 8 ━━━━━━━━━
🔴 LOSERS ROUND 1       ← Top 24 losers side          (2 sets)
🔵 WINNERS SEMI-FINAL                                  (2 sets)
🔴 LOSERS QUARTER-FINAL ← WSF losers drop here        (2 sets)
🔵 WINNERS FINAL                                       (1 set)
🔴 LOSERS SEMI-FINAL    ← LQF winner advances         (1 set)
🔴 LOSERS FINAL         ← WF loser drops here         (1 set)
🏆 GRAND FINAL                                         (1 set)
🏆 GRAND FINAL RESET                                   (1 set)
```

---

### 2026-05-27 — ブラケットタブ: タイムライン表示リニューアル

**対象:** `src/app/tournament/[id]/TournamentClient.tsx`

#### 実装

**`BracketTimeline`** — phase_name=null 大会（CB2026）向け新コンポーネント

- `detectFinalPhases()` で Top 8 (5 sets) + Top 24 (20 sets) を統合
- フェーズ切替ボタン不要（全体を1タイムラインで表示）
- `TIMELINE_ORDER` (10 ラウンド) で大会進行の時系列順にソート
- 不明ラウンドは Top 24 先頭に `getBracketSortOrder` 昇順で配置

**カラーコーディング + セクション区切り**
- Winners ラウンド: 左ボーダー `#3B82F6`（青）＋🔵
- Losers ラウンド: 左ボーダー `#EF4444`（赤）＋🔴
- Grand Final: 左ボーダー `#F59E0B`（金）＋🏆＋背景強調
- `SectionDivider`: 「━ TOP 24 ━」「━ TOP 8 ━」全幅区切り線

**`FLOW_NOTES`** — Losers ラウンドのフロー注釈
- Losers Round 3: `← WQF losers drop here`
- Losers Round 4: `← WSF losers drop here`
- Losers Quarter-Final: `← Previous round losers`
- Losers Semi-Final: `← WF loser drops here`
- Losers Final: `← LSF winner vs WF loser`

**`BracketViewPhased`** — phase_name あり大会（CC11, EVO）向けに旧 UI を分離・維持

#### CB2026 実測結果
```
━━━ TOP 24 ━━━
🔵 Winners Quarter-Final (6)
🔴 Losers Round 3 (2)       ← WQF losers drop here
🔵 Winners Semi-Final (5)
🔴 Losers Round 4 (4)       ← WSF losers drop here
🔴 Losers Quarter-Final (3) ← Previous round losers

━━━ TOP 8 ━━━
🔵 Winners Final (1)
🔴 Losers Semi-Final (1)    ← WF loser drops here
🔴 Losers Final (1)         ← LSF winner vs WF loser
🏆 Grand Final (1)
🏆 Grand Final Reset (1)
```

#### コミット
`62df858` feat(bracket): timeline view with Winners/Losers color coding and flow notes

---

### 2026-05-27 — ブラケットタブ: プールセット除外 + Top 8/Top 24 フェーズ自動検出

**対象:** `src/app/tournament/[id]/TournamentClient.tsx`

#### 問題
- CB2026（`phase_name = null`）ではブラケットタブに全 2900+ sets（プールセット含む）が表示されていた
- pool sets と bracket sets の ID が混在しており、単純な ID 範囲フィルタでは分離不可

#### 実装

**`detectFinalPhases(sets: SetRow[])`** — 新規関数（`BracketView` 上部に追加）

1. **Top 8 検出**: `getBracketSortOrder(roundText) ≤ 5` かつ出現数 ≤ 2 → GF/GF Reset/WF/LF/LSF だけが該当
   - プール WSF は全体で 30+ 回出現 → 除外
   - CB2026 結果: id 26574–26578 の 5 sets のみ ✓
2. **Top 24 検出**: Top 8 最大ID直上の最初の密集クラスター
   - `SEARCH_GAP = 800`, `CLUSTER_GAP = 300`
   - CB2026: Top 8 (id 26578) から gap=87 → id 26665–27603 の 20 sets ✓
   - WQF(6), WSF(5), LR4(4), LQF(3), LR3(2)

**`BracketView`** 改修
- `hasPhaseNames = sets.some(s => s.phase !== '')` で分岐
  - `true`（CC11, EVO など）: 既存の phase_name ベース分類
  - `false`（CB2026）: `detectFinalPhases()` でクラスター検出
- `useMemo` で phases を安定化
- フェーズボタンにセット数バッジ表示
- デフォルト選択: 最後のフェーズ（最も深い = Top 8）

#### コミット
`dd5cad7` fix(bracket): show only Top 8/Top 24 sets using cluster detection, exclude pool phases

---

### 2026-05-27 — キャラ・国情報の構造的問題修正 + バックフィルスクリプト群

**対象:** `scripts/backfill-characters.js` (NEW), `scripts/update-player-profiles.js` (NEW), `scripts/live-fetch-v2.js`

#### 調査結果
- CB2026 は `import-sets.js` で初回インポート → `winner_character` は最初から null（バックフィルによる上書きではない）
- CC11 (141/142) は無傷
- `legacyRow` に `winner_character: null` を明示してupsertすると、ライブポーリングで入ったキャラデータを消す危険があった → `hasGames` フラグで修正済み (`adbcd70`)

#### 実装

**`scripts/backfill-characters.js`**
- start.gg `set(id) { games { selections } }` API からキャラクターを補完
- 78 req/batch → 62s 待機 (rate limit 安全マージン)
- オプション: `--tournament-id=48`, `--dry-run`, `--limit=N`, `--resume`
- エラーログ: `scripts/backfill-errors-t{id}.json` に保存 → `--resume` で再試行

**`scripts/update-player-profiles.js`**
- `--char-only`: `tournament_sets.winner_character` 集計 → `players.main_character` を最多使用キャラで更新
- `--country-only`: start.gg `player.user.location.country` → ISO2 コード → `players.country_code`
- オプション: `--tournament-id=N`, `--dry-run`, `--limit=N`
- 国名→ISO2 マッピング 50 ヶ国対応

**`scripts/live-fetch-v2.js`**
- `--with-characters` オプション追加
- `initial-fetch` 完了後に `charBackfill()` を自動実行（ワンコマンドで全データ補完）

#### 使い方
```bash
# CB2026 キャラバックフィル（約37分）
node scripts/backfill-characters.js --tournament-id=48

# CB2026 出場選手の main_character / country_code 更新
node scripts/update-player-profiles.js --tournament-id=48

# 次回大会: 1コマンドでインポート＋キャラ補完
node scripts/live-fetch-v2.js \
  --tournament-id=X --event-id=X --tournament-slug=X --db-tournament-id=X \
  --initial-fetch --with-characters
```

#### コミット
`adbcd70` fix(live-fetch-v2): protect winner/loser_character from null overwrite
`3330232` feat: character backfill + player profile updater + auto-char option

---

### 2026-05-26 — Pools Dashboard: pool_identifier / seed / UPSET 検知実装

**対象:** `supabase/migrations/20260526_pools_seed.sql` (NEW), `scripts/live-fetch-v2.js`, `src/app/api/pools-dashboard/route.ts`

#### 問題
- `/api/pools-dashboard` の feed に pool 番号が表示されない（`pool: ''` ハードコード）
- UPSET 検知ができない（`seed: null` ハードコード）

#### 原因
- `tournament_sets` に `pool_identifier`, `winner_seed`, `loser_seed` カラムがなかった
- `live-fetch-v2.js` の GQL クエリに `phaseGroup.displayIdentifier` と `initialSeedNum` がなかった

#### 実装

1. **マイグレーション** (`20260526_pools_seed.sql`)
   - `pool_identifier TEXT` — phaseGroup.displayIdentifier (例: "A101")
   - `winner_seed INTEGER` — 試合勝者の initialSeedNum
   - `loser_seed INTEGER` — 試合敗者の initialSeedNum
   - インデックス: `idx_ts_pool`, `idx_ts_seeds`
   - ※ `player1/2_seed` でなく `winner/loser_seed` を採用（UPSET 検知でのマッピング不要）

2. **`live-fetch-v2.js`**
   - `Q_SETS_UPDATED`, `Q_SETS_ALL`: `phaseGroup { displayIdentifier }` と `initialSeedNum` を追加
   - `upsertSet()` v2Row: `pool_identifier`, `winner_seed`, `loser_seed` を追記

3. **`/api/pools-dashboard`**
   - `SetRow` 型に新カラム追加
   - Supabase クエリで新カラム取得
   - 軽量 pool-stats クエリを追加（全 sets の pool_identifier + winner_id → per-pool 進捗計算）
   - `base.pool` = `s.pool_identifier ?? ''` に修正（`'POOL A101'` として表示）
   - `players[].seed` = `winner_seed` / `loser_seed` に修正
   - **UPSET 検知**: `wSeed > lSeed && (wSeed - lSeed) >= 20` → `type: 'UPSET', priority: 'HIGH'`
     - UPSET 時も qualified[] には追加（qualified 選手の場合 → メッセージに "→ TOP CUT!" を付加）
     - UPSET が qualified イベントを上書き（feed 上では UPSET 単独で表示）
   - `qualified[].seed` = `wSeed`（実際の seed を表示）
   - Pool progress: `pool_identifier` データがある場合は per-pool PoolProgress[] を構築、なければ単一 "Pools" にフォールバック
   - sort: UPSET=4（最高優先度）

4. **`PoolsDashboard.tsx`**: 変更なし
   - UPSET 表示、seed バッジ、UPSET フィルタータブ、pool 表示は実装済みだったため

#### CB2026 バックフィル手順
既存データ（pool/seed が null）を埋めるには：
```
node scripts/live-fetch-v2.js \
  --tournament-id=865009 --event-id=1528962 \
  --tournament-slug=combo-breaker-2026 \
  --db-tournament-id=48 --initial-fetch
```

#### コミット
`f548b24` feat(pools): add pool_identifier and seed to tournament_sets, enable UPSET detection

---

### 2026-05-27 — CB2026 バックフィル完了 + live-fetch-v2 legacyRow 修正

**対象:** `scripts/live-fetch-v2.js`, Supabase (tournament_sets, tournament_id=48)

#### 問題
- `20260526_pools_seed.sql` マイグレーション適用後にバックフィルを実行したが、
  `pool_identifier` / `winner_seed` / `loser_seed` が DB に書き込まれなかった
- 原因: この3カラムが `v2Row` に入っており、`20260518_v2_pipeline.sql` が未適用のため
  v2 fallback が発動し `legacyRow` のみで upsert → pool/seed がスキップ

#### 修正
- `scripts/live-fetch-v2.js`: `pool_identifier`, `winner_seed`, `loser_seed` を
  `v2Row` から `legacyRow`（常に書き込む）へ移動
- `v2Row` は引き続き `20260518_v2_pipeline.sql` 適用後のみ有効な state/timestamps 等のみ

#### バックフィル結果（CB2026, tournament_id=48）
- **2903 sets** インポート完了（0 errors）
- `with_pool: 2825`, `with_seed: 2825` (プール以外の sets は pool_identifier=null)
- Unique pools: **27プール** (A103〜I104 系)
- `/api/pools-dashboard?tournamentId=48` 結果:
  - feed: 150件 / UPSET: 48件 / QUALIFIED: 2件
  - withPool: 149件 / withSeed: 149件
  - pools: 27エントリ (全プール 100% 完了)

#### コミット
`9ade8ec` fix(live-fetch-v2): move pool_identifier/winner_seed/loser_seed to legacyRow

---

### 2026-05-26 — リアルタイムゲームスコア表示（H2H StreamCenter）

**対象:** `src/app/api/startgg/route.ts`, `src/hooks/useStartggPolling.ts`, `src/hooks/useAutoDetect.ts`, `src/components/live/StreamCenter.tsx`, `src/app/live/[tournamentId]/page.tsx`

#### 実装内容
1. **`/api/startgg`**: `Q_LIVE_SETS` に `games { winnerId orderNum }` を追加
   - `mapSet()` で `liveScore { p1, p2 }` を算出（state=2/6 のみ）
   - games 配列が空（TO 未入力）の場合は `liveScore = null`

2. **`useStartggPolling`**: live セット検出時にポーリング間隔を短縮
   - `match.status === 'live'` が存在する場合: 15s → 10s
   - live セットなし時: 15s に戻す

3. **`useAutoDetect`**: `liveScore` を返り値に追加
   - ポーリング毎に live セットの `liveScore` を追跡（key 重複除外とは独立した effect）
   - 同一選手ペアでもスコアが更新される

4. **`StreamCenter`**: `liveScore` prop を受け取り H2H バーに表示
   - H2H 勝敗バーの上に `GAME  2 - 1` 形式でスコアを大きく表示
   - リード中の数字を accent 緑でハイライト
   - スコア変化時に `sc-score-pulse` アニメーション（0.35s）
   - `liveScore === null` 時は非表示

5. **`page.tsx`**: `useAutoDetect` から `liveScore` を取得し H2H の `StreamCenter` へ渡す

#### コミット
`a0df7c7` feat(live): real-time game score display in H2H StreamCenter

---

### 2026-05-26 — LiveStandings コンポーネント実装（H2H モード確定順位表示）

**対象:** `src/components/live/LiveStandings.tsx` (NEW), `src/app/live/[tournamentId]/page.tsx`

#### 実装内容
1. **`src/components/live/LiveStandings.tsx`** 新規作成
   - **UP NEXT セクション**: live/upcoming マッチを最大2件表示（クリックで H2H 自動設定）
   - **確定順位セクション**: 完了した Losers ブラケットセットから順位を自動計算
   - ダブルエリミネーション順位ルール: GF winner=1st / GF loser=2nd / LF=3rd / LSF=4th / LQF=5th / LR3=7th / LR2=9th / LR1=13th
   - 金/銀/銅バッジカラーリング (1st: #FFD700 / 2nd: #C0C0C0 / 3rd: #CD7F32)
   - champion 行はアクセントカラー + トロフィー絵文字
   - データなし時の空状態表示
   - `normalizePlayerName` による表示名正規化
   - `shortenRound` による round 略称表示
   - `winnerSide()` でパイプ区切りスポンサータグ込み winner 文字列を解析

2. **`src/app/live/[tournamentId]/page.tsx`** 更新
   - H2H モードの右下パネルで `FeaturedMatchesPanel` → `LiveStandings` に置き換え
   - `startggMatches` + `upNextMatches` を渡す
   - POOLS モードは変更なし（`FeaturedMatchesPanel` 継続使用）

#### コミット
`8878444` feat(live): add LiveStandings component with UP NEXT and real-time placements

---

### 2026-05-26 — 選手名正規化（スポンサータグ除去 + 表記揺れ対応）

**対象:** `src/lib/normalizePlayerName.ts`, `src/app/api/players/search/route.ts`, `src/app/api/startgg/route.ts`, `src/hooks/useAutoDetect.ts`, `src/components/live/FeaturedMatchesPanel.tsx`, `src/app/live/[tournamentId]/page.tsx`

#### 問題
CB2026 の H2H が表示されない: start.gg のハンドルが `"REJECT ひなお"` や `"FALCONS | Xiaohai"` で、DB の `players.handle` と一致しなかった。

#### 実装内容
1. **`src/lib/normalizePlayerName.ts`** 新規作成
   - `normalizePlayerName(raw)`: スポンサータグ除去（パイプ区切り / 既知タグ + スペース）
   - `playerSearchVariants(raw)`: CamelCase 分割含む複数バリアント生成（例: `OilKing` → `Oil King`）

2. **`src/app/api/players/search/route.ts`** 更新
   - 3段階検索: (1) バリアント完全一致 → (2) 正規化後の部分一致 → (3) 元クエリ部分一致
   - `?startggId=` パラメータ追加: `startgg_player_ids` 配列による直接 ID 検索

3. **`src/app/api/startgg/route.ts`** 更新
   - GraphQL クエリに `player { id }` を追加
   - `player1_startggId` / `player2_startggId` をマッチデータに含める

4. **`src/hooks/useAutoDetect.ts`** 更新
   - `onNewPlayers` コールバックに startgg player ID を追加渡し

5. **`src/app/live/[tournamentId]/page.tsx`** 更新
   - `handleMatchClick` が startgg ID を受け取り、検索 API に渡す
   - `normalizePlayerName` による handle 照合

6. **`src/components/live/FeaturedMatchesPanel.tsx`** 更新
   - `onMatchClick` 型に startgg ID 引数を追加

#### テスト結果 (scripts/test-normalize.js)
| 入力 | 正規化後 | DB検索結果 |
|------|----------|------------|
| `REJECT ひなお` | `ひなお` | `REJECT ひなお` (id=25790) |
| `FALCONS \| Xiaohai` | `Xiaohai` | Fuzzy → DB未登録 |
| `SR NuckleDu` | `NuckleDu` | `NuckleDu` (id=17) |
| `Saishunkan Kobayan` | `Kobayan` | `Kobayan` (id=30) |
| `T1 OilKing` | `OilKing` → CamelSplit `Oil King` | `Oil King` (id=356) |
| `EndingWalker` | `EndingWalker` | `EndingWalker` (id=56) |

#### コミット
`bedff99` feat: player name normalization

---

### 2026-05-26 — inferPlacements() 順位計算ロジック全面修正

**対象:** `src/app/tournament/[id]/page.tsx`

#### 問題
CB2026 (tournament_id=48) の大会結果ページで Top 8 順位が正しく表示されなかった。  
Micky・Vxbao が 7th になるべきところ 575th と誤計算されていた。

#### 原因
旧ロジック（BFS による位相的深さ伝播）の問題:
1. `round_text` が同じラウンド名（例: `Losers Round 1`）がプールフェーズと Top 8 フェーズの両方に存在する多フェーズ大会で、深さの計算が混線
2. BFS で `Losers Round 1` の depth が 89（LSF-2 相当）に誤算され、`Losers Quarter-Final`（depth=80）より深くなってしまう
3. Top 8 の `Losers Round 1`（Winners QF から落ちた選手が参加する後半ラウンド）と、同名の早いラウンドが同一クラスターに統合され区別不能

#### 修正（クラスター最大セット ID による順位付け）
`inferPlacements()` を全面書き直し:
- **固定ラウンド** (`Losers Final`, `Losers Semi-Final`): `depth × 10_000_000` の大きなスコアで常に上位
- **その他** (`Losers Quarter-Final`, `Losers Round N`): セット ID の近接性（CLUSTER_GAP=20）でクラスタリング
- グループのソートキー = **そのクラスター内の最大セット ID**（降順）
- 後のセット = より最終ブラケットに近い = 上位順位

#### 確認（EventHubs 正解と一致）
```
1st: Xiao Hai  2nd: Hinao  3rd: Jr.  4th: Kobayan
5th: Fuudo, Oil King (tie)  7th: Micky, Vxbao (tie)
```

- `npm run build` — ✅ エラーなし
- `git push origin main` — ✅ コミット b77ce73

---

### 2026-05-26 — CB2026 (id=48) Xiao Hai 表示バグ修正

**対象:** `src/app/tournament/[id]/page.tsx`

#### 原因
2つのバグが重なっていた:

1. **entrantsクエリの limit=200**: CB2026 は 1448 entrants あり、Xiao Hai の entrant レコード (id=40909) が 200件に含まれなかった
2. **inferPlacements() の Grand Final 検出バグ**: CB2026 は全 set の `phase_name=NULL`。sets を ID 降順 `.limit(300)` で取得すると最終レコードが id=26578 (Winners Final) になり、実際の Grand Final (id=26577, Xiao Hai勝利) より後ろに並ぶため、champion として25790が誤検出されていた

#### 修正
- `entrantsクエリ`: `.limit(200)` → `.limit(2000)`
- `setsクエリ`: `.limit(300)` → `.limit(2000)`
- `inferPlacements()`: 最後の set ではなく `round_text` に "Grand Final" を含む set を優先して champion を判定するよう修正 ("Reset" は除外)

#### 確認
- `npm run build` — ✅ エラーなし
- `curl http://localhost:3000/tournament/48 | grep Xiao Hai` — ✅ 9件ヒット (standings + sets)
- Xiao Hai が `color:var(--sf6-accent)` (1位カラー) で 1位 * として表示されることを確認

---

### 2026-05-26 — page.tsx リファクタリング (Phase 1-3)

**対象:** `src/app/live/[tournamentId]/page.tsx` (2716行 → 391行) + 新規ファイル群

#### Phase 1: カスタムフック抽出
- `src/app/live/[tournamentId]/tournamentConfig.ts` — 大会設定 (`TOURNAMENT_CONFIG`, `resolveTournamentConfig`)
- `src/hooks/usePoolsDashboard.ts` — pools-dashboard ポーリング + displayMode 管理
- `src/hooks/useStartggPolling.ts` — startgg/CC12 ポーリング + mergedPhases / upNextMatches 計算
- `src/hooks/useAutoDetect.ts` — live/latest セット自動検知 (manual-mode ガード付き)

#### Phase 2: 小コンポーネント抽出
`src/components/live/` に以下を新規作成:
- `tokens.ts` — デザイントークン・共有型 (V, CHAR_COLORS, Player, SetData, H2HData 等)
- `CharPill.tsx`, `PlayerBand.tsx`, `LiveSetsTable.tsx`, `LiveBracket.tsx`
- `FeaturedMatchesPanel.tsx` (NextMatchesPanel 含む), `SearchModal.tsx`

page.tsx: 2226行 → 1154行 (-48%)

#### Phase 3: 残り大型コンポーネント抽出
- `StreamCenter.tsx` (~290行), `LiveChat.tsx`, `SidePanelLeft.tsx`, `CountdownDisplay.tsx`

page.tsx: 1154行 → **391行** (元 2716行から **-86%**)

**タグ:** `v0.6.0-refactor`

---

### 2026-05-23 — Pools Dashboard API: Supabase 移行

**対象:** `src/app/api/pools-dashboard/route.ts`, `src/app/live/[tournamentId]/page.tsx`

#### 変更内容

**1. /api/pools-dashboard を Supabase ベースに全面書き換え**
- 問題: start.gg API の `perPage=25` 制限により 1,568件中25件しか取得できず、QUALIFIED=0 / UPSET=9 件しか表示されなかった
- 解決: `tournament_sets` テーブルを直接クエリ (バッチ 1000件×複数回) → 1,482件の completed セットを全件解析
- パラメータ変更: `?eventId=` → `?tournamentId=` (Supabase DB の numeric ID)
- プレイヤー名は `players` テーブルと JOIN (winner_id / loser_id → players.handle)
- **qualifying ラウンド自動検出**: 各ブラケットサイドで `round_text` をランク付けし、最深ラウンドを qualifying final と判定
  - 現在: Winners Semi-Final = QUALIFIED_W、Losers Quarter-Final = QUALIFIED_L
  - tournament が進行して "Winners Final" が現れると自動的に切り替わる
- feed イベント内訳: QUALIFIED_W(42件) / QUALIFIED_L(42件) / ELIMINATED(111件) / MARQUEE_RESULT(23件)
- キャッシュ TTL: 15秒 → 30秒

**2. page.tsx polls ポーリング更新**
- `config.startggEventId` → `config.dbTournamentId` を使用
- `isPoolsPhase` 判定: phase 名比較 → round_text キーワード (winners/losers/round) 検出に変更

---

### 2026-05-22 — Pools Dashboard デザイン実装 (pools.html ハンドオフ)

**対象:** `src/components/live/PoolsDashboard.tsx` (新規), `src/app/live/[tournamentId]/page.tsx`

#### 変更内容

**1. PoolsDashboard コンポーネント新規作成 (`src/components/live/PoolsDashboard.tsx`)**
- デザインハンドオフ (`pools.html`) を元に右レール全体を実装
- **HighlightCard**: UPSET / MARQUEE 系イベントをトップに大きく表示、glow-pulse アニメーション (red/gold)
- **TabbedPanel**: FEED / QUALIFIED / PROGRESS の3タブ
  - FEED タブ: 全件 / UPSET / QUAL / MARQUEE のサブフィルター、優先度別カードサイズ
  - QUALIFIED タブ: 2カラムグリッド、Winners=緑 / Losers=金のサイドバー、新規選手でバッジ通知
  - PROGRESS タブ: SVG サークル進捗、プールドットグリッド、統計セル (完了数・進行中・UPSETS 等)
- デザイントークンは `pools.html` CSS 変数準拠: bg `#0a0a0f` / accent `#00ffb3` / red `#ff3c3c` / gold `#ffc832`
- 全選手名は `/player/[handle]` へリンク (`Link` コンポーネント)
- CSS keyframes は DOM 挿入 (冪等) で Next.js SSR と共存

**2. StreamToast コンポーネント追加**
- UPSET / MARQUEE イベント発生時に配信映像下部にスライドインするトースト
- `pd-toast-flash` アニメーション (5秒で自動フェードアウト)
- PoolsDashboard の `onToast` コールバック → page.tsx → StreamCenter の `streamToast` prop で連携

**3. page.tsx リファクタリング**
- インライン `PoolsDashboard` 関数を削除し、`@/components/live/PoolsDashboard` からインポートに切替
- `streamToast` / `streamToastTimer` state を追加
- StreamCenter に `streamToast` prop を追加、pools モード時のみ渡す

---

### 2026-05-20 — トップページ: 最新結果修正 + upcoming 並び順 + シリーズバッジ

**対象:** `src/app/page.tsx`, `src/app/HomeClient.tsx`

#### 変更内容

**1. 最新結果セクション — EVO Japan 2026 を表示**
- 従来: `tournament_entrants` を一括取得 → Supabase デフォルト 1000行上限に当たり、EVO Japan (401件) の entrantCount が 0 として扱われていた
- 修正: 各大会ごとに `{ count: 'exact', head: true }` の HEAD リクエスト (Promise.all) でカウント取得 → 正確な件数を反映
- Road to EWC 系大会 (series = ROAD_TO_EWC) は `recentTournament` 選択から除外
- 結果: EVO Japan 2026 (Yamaguchi 優勝) が最新結果として表示

**2. Upcoming 大会 — 開催日が近い順に並び替え**
- DB クエリは `start_date DESC` だったため、upcoming がそのまま「遠い順」になっていた
- `upcoming` 配列に `.sort()` を追加して昇順 (最近 → 遠い) に修正
- 現在の表示順: Combo Breaker → Blink Respawn → EVO 2026 → BAM → EWC 2026 → CEO → EVO France

**3. 大会シリーズバッジ追加 (page.tsx + HomeClient.tsx)**
- `TournamentSeries` 型 (`EWC | CPT_PREMIER | ROAD_TO_EWC | CPT_FINALS | OTHER`) を新設
- `getTournamentSeries(name)` 関数: 大会名から自動分類（名前パターンマッチング）
- `HomeTournament` に `series` フィールド追加
- `SERIES_CONFIG` でバッジ色定義:
  - CPT PREMIER: `#00d4aa`（緑）
  - EWC: `#ff9500`（オレンジ）
  - ROAD TO EWC: `#4a9eff`（青）
  - CPT FINALS: `#f5c842`（金）
- `SeriesBadge` コンポーネントを Upcoming カードに追加

---

### 2026-05-16 — Live Page UI Improvements (カウントダウン / 現地時間 / Featured Matches)

**対象:** `src/app/live/[tournamentId]/page.tsx`, `src/app/api/players/tiers/route.ts`

#### 変更内容

**1. 配信前カウントダウン (`CountdownDisplay` コンポーネント)**
- `streamStartTime` (ISO 8601) を `tournamentConfig` に追加
- 配信開始前: ダーク背景 + グリッド + "DD : HH : MM : SS" カウントダウン表示
- カウントダウン 0 → Twitch 埋め込みに自動切替（リロード不要）
- `streamStartTime` 未設定 → "COMING SOON" プレースホルダー
- チャンネル名リンク (twitch.tv/ewc) 表示
- DH Atlanta に `streamStartTime: '2026-05-16T10:00:00-04:00'` を設定

**2. 現地時間 + DAY インジケーター**
- `clock` state/effect を削除（経過時間カウンター廃止）
- `timezone` フィールドを config に追加（IANA 形式、全 config に設定）
- StreamCenter 内で `Intl.DateTimeFormat` により現地時刻をリアルタイム計算
- DAY ラベル: 「STARTS IN 3D」→「DAY 2 / 3」→「COMPLETED」と自動遷移
- ヘッダーに DAY バッジ（開催中は緑、COMPLETED はグレー）+ 時刻を表示

**3. Featured Matches パネル (`FeaturedMatchesPanel`)**
- `NextMatchesPanel`（次の1試合）を `FeaturedMatchesPanel`（上位5試合）に置換
- 新 API: `GET /api/players/tiers?handles=Punk,Kilzyou` → `{ handle: tier }` を返す
- スコアリング: Tier S=100, A=70, B=40, C=20。S/A ペアはスコア×1.5
- Tier バッジ（金=S, 緑=A, 青=B）付きで試合カードを表示
- タップで既存の H2HOverlay を展開

**tournamentConfig 型拡張:**
- `timezone: string` (IANA, required)
- `streamStartTime?: string` (ISO 8601, オプション)
- `totalDays: number` (大会日数)

**動作確認:**
- `tsc --noEmit` → 0 エラー ✅
- `npm run build` → 成功 ✅

---

### 2026-05-15 — DreamHack Atlanta & Combo Breaker ライブページ セットアップ

**対象:** `src/app/live/[tournamentId]/page.tsx`, `scripts/import-sets.js`

#### 変更内容

**1. 大会 DB インポート**
- `import-tournament.js road-to-ewc-dreamhack-atlanta` → **tournament_id = 47**, event_id = 1600986
- `import-tournament.js combo-breaker-2026` → **tournament_id = 48**, event_id = 1528962
- `import-sets.js` のバグ修正: `.eq('startgg_slug', slug)` → `.eq('slug', slug)`

**2. tournamentConfig 型拡張**
- `dbTournamentId?: number` — スラッグキー設定時に使う Supabase の numeric ID
- `ewcQualifier?: boolean` — EWC 出場権大会か
- `ewcSlots?: number` — EWC 出場枠数
- `cptPremier?: boolean` — CPT Premier 大会か

**3. 新設 config エントリ**
- `'dh-atlanta-2026'` — Road to EWC: DreamHack Atlanta 2026 (id=47, EWC×2, Twitch: ewc/dreamhackfighters)
- `'combo-breaker-2026'` — COMBO BREAKER 2026 (id=48, EWC×2 + CPT Premier, Twitch: capcomfighters)
- `'40'` (EVO Japan) に `dbTournamentId: 40, cptPremier: true` を追加

**4. LiveSetsTable — dbTournamentId 対応**
- `dbTournamentId?: number` prop 追加
- fetch 時に `dbTournamentId` が設定されていれば数値 ID を API に渡す（slug では NaN になるため）

**5. StreamCenter ヘッダー — EWC / CPT バッジ追加**
- `ewcQualifier=true` → 金バッジ「🏆 EWC ×N」
- `cptPremier=true` → 緑バッジ「CPT PREMIER」

**live-fetch コマンド (DH Atlanta 開始時に手動起動):**
```bash
node scripts/live-fetch.js \
  --tournament-id=47 \
  --slug="road-to-ewc-dreamhack-atlanta/event/street-fighter-6-at-road-to-ewc-dh-atlanta" \
  --watch --interval=90
```

**ライブページ URL:**
- DH Atlanta: http://localhost:3000/live/dh-atlanta-2026
- Combo Breaker: http://localhost:3000/live/combo-breaker-2026

**動作確認:**
- `tsc --noEmit` → 0 エラー ✅
- `npm run build` → 成功 ✅

---

### 2026-05-15 — 選手ページ デザイン統一 (Tier 未設定選手対応)

**対象:** `src/app/player/[id]/page.tsx`, `src/app/player/[id]/PlayerClient.tsx`

#### 変更内容

**1. 賞金表示 — SUM フォールバック (page.tsx)**
- `total_sf6_earnings_usd` が null/0 の場合、`tournament_entrants.prize_amount` を SUM して代替
- それも 0 なら `null` を格納 → クライアント側で「—」表示
- `entrantsRaw` フェッチを `player` オブジェクト構築前に移動して同一パスで算出

**2. アバター追加 (HeroSection)**
- `profile_image_url` がある場合: `<img>` で表示
- `null` の場合: ハンドル先頭文字のイニシャルサークルを表示 (112×112px, heroBlue ボーダー)

**3. メインキャラ — 「不明」フォールバック**
- `CharPill` コンポーネントの `if (!name) return null` ガードを削除
- `null` 時は「不明」テキストをグレーピルで表示
- `HeroSection` の `{player.mainCharacter && <CharPill ...>}` を `<CharPill name={player.mainCharacter} />` に変更

**4. 賞金カード — 常時表示**
- `{totalPrize > 0 && (...)}` を条件なしで常時表示に変更
- データなし時は数字を「—」(D.dim カラー) で表示

**5. データなし空状態**
- `H2HSection`: `return null` → 「データなし」カードに変更 (section/SectionHeading を維持)
- `CharUsageSection`: `return null` → 「データなし」カードに変更
- `ResultsSection`: results 件数 0 時に `<tr>` で「データなし」行を表示

**動作確認:**
- `tsc --noEmit` → 0 エラー ✅

---

### 2026-05-02 — EVO Japan Day 2 — BRACKET 表示域固定 + サーバーサイド検索

**対象:** `src/app/live/[tournamentId]/page.tsx`, `src/app/api/live-sets/route.ts`

#### 変更内容

**1. BRACKET タブ — 表示域固定**
- コンテナを `minHeight: 420` → `aspectRatio: '16/9', overflow: 'hidden'` に変更
- STREAM タブの配信 iframe と同じアスペクト比で高さが自動同期
- `LiveSetsTable` 内を `display:flex, flexDirection:column, height:100%` に変更
  - ヘッダー（件数バッジ + 検索バー）: `flexShrink: 0` で固定
  - セット一覧: `flex: 1, overflowY: auto` でスクロール可能
- 「もっと見る」ボタンを削除（スクロール方式に変更）

**2. サーバーサイド検索**
- `/api/live-sets` に `search` クエリパラメータを追加
  - `players.handle ILIKE '%search%'` で一致プレイヤー ID を取得（上限 500 件）
  - `tournament_sets WHERE winner_id IN ids OR loser_id IN ids` でフィルタ
  - 全 DB セット（現時点 650+件）から検索可能
- デフォルト limit を 1000 → 100 に変更（表示域固定に合わせて）
- `LiveSetsTable` の fetch ロジック変更
  - 入力後 300ms debounce → `?search=xxx` でサーバー検索
  - 検索中はポーリング停止、検索空欄時は 30s ポーリング継続
  - 検索フィールドにクリア（✕）ボタン追加
  - バッジ表示: 通常時「最新 N SETS」、検索時「N 件 / 全件検索」

**動作確認:**
- `search=REJECT` → 3件ヒット（REJECT ひなお の全試合）✅
- `search=Yellow` → 5件ヒット ✅
- 通常フェッチ: 100件返却、total: 650 ✅
- `tsc --noEmit` → 0 エラー、`npm run build` → 成功 ✅

---

### 2026-05-01 — EVO Japan 2026 Day 1 — BRACKET DB表示・マルチチャンネルSTREAM実装

**対象:** `src/app/live/[tournamentId]/page.tsx`, `src/app/api/live-sets/route.ts`

#### Step 0: データ取り込み確認
- `live-fetch.js --watch` を起動 (tournament_id=40, interval=120s)
- 初回フェッチで 572 sets を INSERT、継続ポーリングで累計 650 sets 取り込み済み
- `BRIEFING_TOURNAMENT_ARCHITECTURE.md` をリポジトリに追加

#### Step 1: BRACKET タブ — DB セット表示 (`LiveSetsTable` コンポーネント)
- **新規 API**: `src/app/api/live-sets/route.ts`
  - `tournament_sets` から `created_at DESC` で最大 1000 件取得
  - `winner_id / loser_id` → `players` テーブル JOIN して handle/country_code/main_character を付与
  - クエリパラメータ: `tournamentId` (必須), `limit`, `offset`
- **新規コンポーネント**: `LiveSetsTable`
  - 30 秒ポーリングで DB から最新セットを取得・表示
  - 選手名でクライアントサイドフィルタ (検索バー)
  - 勝者名: アクセントカラー + `/player/[id]` リンク
  - 敗者名: グレーアウト + `/player/[id]` リンク
  - フェーズ名 + ラウンド名 + 完了時刻を各行に表示
  - 「もっと見る」ボタンで 100 件ずつ追加表示
  - データ未取得時: ローディング表示
- BRACKET タブは `LiveSetsTable` のみ表示（DB セット優先）

#### Step 2: STREAM タブ — マルチチャンネル Twitch プレーヤー
- config 型に `twitchChannels?: { name: string; channel: string }[]` を追加
- `StreamCenter` に `twitchChannels` prop + `activeChanIdx` state 追加
- EVO Japan 5 チャンネル: EVO(EN), evojapan01〜04(JP)
- チャンネル選択バー（タブ形式）→ `key={activeChannel}` で iframe をリマウント

#### Step 3: CHAT タブ — Twitch チャット 5チャンネル対応
- `twitchChatChannels` を 5 チャンネルに更新: `['evo', 'evojapan01', ..., 'evojapan04']`
- 既存 `LiveChat` コンポーネントで切り替えボタンが自動生成

#### EVO Japan '40' config 更新まとめ
- `streamChannel: 'evo'` (メインチャンネル)
- `twitchChannels: [5チャンネル]` (STREAM タブ切り替え)
- `twitchChatChannels: [5チャンネル]` (CHAT タブ切り替え)

#### ビルド結果
- `npx tsc --noEmit` → 0 エラー
- `npm run build` → Compiled successfully
- `/api/live-sets` ルート追加確認
- `curl /api/live-sets?tournamentId=40` → `total: 650, hasMore: true` ✅

---

### 2026-04-30 — ライブページ BRACKET タブ修正 + Twitch チャット連携

**対象:** `src/app/live/[tournamentId]/page.tsx`

#### 変更内容

1. **BRACKET タブ修正 — `LiveBracket` コンポーネント追加**
   - `TournamentDashboard` を削除し、`startggMatches` を直接レンダリングする `LiveBracket` コンポーネントを実装
   - フィルターボタン（ALL / ● LIVE / 完了 / 次の試合）でマッチを絞り込み可能
   - データ未取得時はローディング表示（「ブラケット情報を取得中...」）
   - 試合行をクリックすると P1/P2 に自動セット → H2H 更新
   - ラウンド順ソート（`BRACKET_ROUND_ORDER`）、ライブ試合は赤ハイライト
   - `StreamCenter` の `mergedPhases` prop を `startggMatches` に変更

2. **Twitch チャット連携 — `LiveChat` + `SidePanelLeft` 更新**
   - `LiveChat` に `twitchChatChannels?: string[]` prop を追加
   - チャンネルが指定された場合は Twitch chat iframe を埋め込む
     - URL: `https://www.twitch.tv/embed/{channel}/chat?parent=localhost&parent=sf6-database.vercel.app&darkpopout`
   - 複数チャンネルの場合はボタンで切り替え可能
   - チャンネルなしの場合は従来のモックチャットにフォールバック
   - `SidePanelLeft` に `twitchChatChannels?` prop を追加し `LiveChat` へ渡す

3. **EVO Japan 2026 (id=40) config 更新**
   - `streamChannel: 'capcomfighters'` に修正（従来は 'evo'）
   - `twitchChatChannels: ['capcomfighters', 'evo', 'evo2']` を追加（3チャンネル切り替え対応）

---

### 2026-04-30 — Tier S/A 選手キャラクターデータ修正（Liquipedia + tournament_sets 照合）

**対象:** players テーブルの Tier S/A 選手（合計 97 件）  
**更新:** 18 件 / 0 件失敗

#### 調査方法
1. `tournament_sets` の有効キャラ名表記を取得（22 キャラ、`Aki`/`M.Bison` 等の正規表記を確認）
2. 全 Tier S/A 選手の `main_character` と実際の `tournament_sets` 使用キャラを照合
3. 不一致・不正キャラの選手を Liquipedia で確認（`https://liquipedia.net/fighters/[名前]`）

#### 更新内訳

**セットデータ根拠（5件以上の一致）:**
| 選手 | 旧 | 新 | 根拠 |
|---|---|---|---|
| Kakeru | Rashid | JP | sets JP×8 |
| HotDog29 | Dhalsim | M.Bison | sets M.Bison×5 |
| Deiver | Dee Jay | Ed | sets Ed×5 |
| Oil King | Terry | Rashid | sets Rashid×5 |
| Kusanagi | Terry | Ryu | sets Ryu×5 |
| Shuto | Ryu | Akuma | sets Akuma×8 |

**Liquipedia + sets 照合:**
| 選手 | 旧 | 新 | 根拠 |
|---|---|---|---|
| Xiao Hai | Mai | M.Bison | Liquipedia + sets M.Bison×3 |
| NuckleDu | Mai | Guile | Liquipedia + sets Guile×3 |
| Vxbao | JP | M.Bison | Liquipedia confirmed |
| Bonchan | Sagat | Akuma | Sagat は SF4 のみ、Liquipedia SF6=Akuma |
| DakCorgi | C. Viper | Cammy | C.Viper は SF6 に不存在、Liquipedia=Cammy/Mai |
| Xerna | C. Viper | Mai | Liquipedia confirmed |
| Kazunoko | C. Viper | Cammy | C.Viper は SF6 に不存在、2024実績=Cammy |

**表記統一（tournament_sets 準拠）:**
| 選手 | 旧 | 新 |
|---|---|---|
| Hikaru | A.K.I. | Aki |
| Problem-X, Nemo, Yanai, Zhen | M. Bison | M.Bison |

**変更不要（DB 正確）:** Angry Bird(Akuma), MenaRD(Blanka), Kilzyou(Mai), Daigo(Akuma)

**事後確認:** SF6 外キャラ残存 0 件 ✅

---

### 2026-04-30 — 選手ページ404調査・修正（/players 一覧ページ新規作成）

**原因:**
- SiteNavbar の「選手」ナビリンクが `/players` (複数形) を指しているが、ルートが存在しなかった
- `/player/[id]` (単数形) は全件正常動作
- `tournament_sets.winner_id / loser_id` は全525件、`tournament_entrants.player_id` は全904件が `players.id` と一致しており、リンク先のIDに問題なし

**修正内容:**
- `src/app/players/page.tsx` — Server Component（ISR 5分）を新規作成
  - `total_sf6_earnings_usd > 0` の上位50選手をデフォルト表示（賞金ランキング）
- `src/app/players/PlayersClient.tsx` — クライアント一覧ページを新規作成
  - `/api/players/search` を使った全22,554人対象のリアルタイム検索（300ms デバウンス）
  - プレイヤーカード: 国旗・選手名・キャラ・チーム・賞金総額

**ビルド結果:** `/players` ルート（5m Revalidate）が新規追加、型エラーなし

---

### 2026-04-29 — ライブページ UI 第2リデザイン（スクリーンショット指摘対応）

**実施内容:**

#### SiteNavbar (`/src/components/SiteNavbar.tsx`) — ナビ構成をデザイン準拠に変更
- ナビリンクを **大会 / 選手 / キャラ / 統計** の4項目に変更（Home・ライブ を削除、キャラ・統計 を追加）
- ロゴアクセントカラーを `#00d4aa` → `#10b981`（エメラルドグリーン）に変更
- ライブページ時: 右端に `● LIVE` バッジ + 大会名 を表示（ストリームがLiveなら赤点滅、未配信はグレー）
- 言語トグルのアクティブ色も `#10b981` に統一

#### ライブページ (`/live/[tournamentId]`) — デザイン差異6点を全修正
1. **デザイントークン更新**: bg=`#080c14`（ダークネイビー）, accent=`#10b981`（エメラルド）, `P1=#ec4899`（マゼンタ）, `P2=#3b82f6`（ブルー）
2. **PlayerBand 強化**: `P1/P2` 固定サイドカラー（マゼンタ/ブルー）・国旗+選手名(30px太字)・CharPill・チーム名・キャラウォーターマーク・スコアピップ(丸3つ)
3. **グリッド拡幅**: `170px → 220px` に変更してプレイヤーカード情報を余裕を持って表示
4. **H2H バー**: P1=マゼンタ / P2=ブルー の固定2色バーに統一（キャラカラー依存から脱却）
5. **NextMatchesPanel**: P1 vs P2 カード形式（国旗+選手名+CharPill のバランスレイアウト）、データなし時はアイコン付きプレースホルダー
6. **検索モーダル**: P1/P2 のサイドカラーに対応したボーダーカラーに変更

**ビルド結果:** `npm run build` → Compiled successfully, 全11ルート型エラーなし

---

### 2026-04-29 — ライブページ UI 完全リデザイン（live.html 準拠）

**実施内容:**

#### ライブページ (`/live/[tournamentId]`) — live.html に忠実な全面リライト
- `src/app/live/[tournamentId]/page.tsx` を live.html デザインに完全準拠して全面書き直し
- **全データ取得ロジック・ポーリング（Twitch 30秒 / CC12 60秒 / start.gg 30秒）は完全維持**
- デザイントークン完全適用: `--bg:#080c10`, `--surface:#0e1419`, `--surface2:#131c24`, `--surface3:#1a2530`, `--accent:#00d4aa`, `--red:#ff4d6a`, `--gold:#f5c842`, Barlow Condensed / Barlow フォント
- レイアウト: `3カラム (170px 1fr 170px)` 面対面グリッド + セカンダリ `1fr 1fr` 2カラム
- **PlayerBand**: キャラカラーグラデーション背景・縦書き名前ウォーターマーク・80px スコア・P1/P2バッジ・CharPill・エッジアクセントバー
- **StreamCenter**: ラウンド帯 + カウントアップクロック / STREAM・BRACKET タブ / 16:9 配信エリア / スコアオーバーレイ / H2H バー（最近10試合カラースクエア付き）
- **LiveChat**: インライン実装（モック初期メッセージ + メッセージ入力・送信）
- **PollContent**: インライン実装（プレイヤー名動的連動 + 1.8秒間隔ライブ票数シミュレーション）
- **SidePanelLeft**: LIVE POLL / チャット タブ切り替えパネル
- **NextMatchesPanel**: CharPill 付き次の試合リスト（ホバーエフェクト CSS クラス）
- `tournamentConfig['40']` 追加: EVO Japan 2026 (Twitch: evofighters, 2026-05-01〜05-03)
- CSS reset (`box-sizing:border-box; margin:0; padding:0`) 適用
- `SiteNavbar activePage="live" isLive={isStreamLive}` に統一

**npm run build: ✓ 成功（TypeScript エラーなし）**

---

### 2026-04-29 — ナビ統一・大会ページ LIVE セクション・ライブページ改善

**実施内容:**

#### SiteNavbar 全ページ統一
- `nav_players` リンクを SiteNavbar に追加（ホーム・大会・ライブ・選手の4項目）
- `isLive?: boolean` prop 追加: ライブ中は ライブ リンクを赤 + 点滅ドット + "LIVE" バッジで強調
- `HomeClient` → `isLive={!!data.liveTournament}` を渡すよう更新
- `TournamentClient` の独自 `Navbar` 関数を削除 → `SiteNavbar activePage="tournaments" breadcrumb=[大会 > 大会名]` に統一
- ライブページの独自 `<nav>` を削除 → `SiteNavbar activePage="live" isLive={isStreamLive}` に統一

#### 大会ページ (`/tournaments`) — LIVE セクション追加
- 現在ライブ中の大会を一覧最上部に "LIVE" セクションとして Feature 表示（赤枠カード・点滅ドット・`/live/[id]` リンク）
- Upcoming セクションはリンクなしの情報カードのみに変更
- Past テーブルはクリックで `/tournament/[id]` に移動（従来通り）
- LIVE セクションが存在する場合、SiteNavbar の ライブ アイテムも強調表示

#### ライブページ (`/live/[tournamentId]`) — EVO Japan 2026 追加・比率修正
- `tournamentConfig['40']` 追加: EVO Japan 2026 (Twitch: evofighters, 5/1〜5/3)
- `PlayerBand` の `minHeight: 380` → `height: '100%'` に変更してグリッド高さに合わせる
- PlayerBand 幅を 170px → 200px に拡大してデザイン比率を改善
- ブラケットタブの最小高さを `minHeight: 420 → 560` に調整（stream 16:9 と高さ揃え）
- スコアリセットボタンをナビバーからコンテンツ上部の独立行に移動

**npm run build: ✓ 成功**

---

### 2026-04-29 — ライブページ UI リデザイン + 選手ページ 404 修正

**実施内容:**

#### ライブページ (`/live/[tournamentId]`) — UI リデザイン
- `src/app/live/[tournamentId]/page.tsx` を live.html デザインに合わせて全面 UI 更新
- **全データ取得ロジック・ポーリング（30秒/60秒）はそのまま維持**
- 新レイアウト:
  - 3カラム面対面グリッド: `PlayerBand (170px) | StreamCenter (1fr) | PlayerBand (170px)`
  - `PlayerBand`: キャラカラーグラデーション背景 / 縦書き選手名ウォーターマーク / 80px スコア（+/- ボタン）/ CharPill
  - `StreamCenter`: ラウンド帯 + STREAM / BRACKET タブ / 16:9 配信エリア（iframe or プレースホルダー）/ スコアオーバーレイ / H2H バー
  - セカンダリ行: LIVE POLL / チャット タブパネル + 次の試合リスト
- デザイントークン: `--bg:#080c10`, `--accent:#00d4aa`, Barlow Condensed
- スコアリセットボタンをナビバーに追加
- `npm run build` 成功確認

#### 選手ページ 404 修正
- 原因: `players` テーブルのカラム名が `name` ではなく `real_name`
- 修正: `.select()` の `name` → `real_name`、フィールドアクセスも対応
- 確認: `curl http://localhost:3000/player/1` → "Kakeru" が返ることを確認

---

### 2026-04-29 — 選手ページ・大会一覧・TOPページ・i18n 実装完了

**実施内容:**
- `src/lib/i18n.ts` — JA/EN 翻訳辞書（全ページ共通）
- `src/lib/locale-context.tsx` — LocaleProvider + useLocale() hook
- `src/app/layout.tsx` — LocaleProvider で全ページをラップ
- `src/app/player/[id]/page.tsx` — 選手ページ Server Component（ISR revalidate=60）
- `src/app/player/[id]/PlayerClient.tsx` — 選手ページ Client Component（デザイン完全実装）
- `src/app/tournaments/page.tsx` — 大会一覧 Server Component（ISR revalidate=60）
- `src/app/tournaments/TournamentsClient.tsx` — 大会一覧 Client Component
- `src/app/page.tsx` — TOPページ Server Component（ISR revalidate=60、既存 live ページから置換）
- `src/app/HomeClient.tsx` — TOPページ Client Component
- `src/components/SiteNavbar.tsx` — 共通ナビバー（Home / Tournaments / Live + JA/EN トグル）
- `src/app/tournament/[id]/TournamentClient.tsx` — 選手名に `/player/[id]` リンク追加、JA/EN トグル追加

**選手ページ機能（player.html デザイン準拠）:**
| セクション | 内容 |
|---|---|
| Hero | 選手名（大フォント）/ 国旗 / チーム / 使用キャラ / 総獲得賞金 / 主要タイトルstrip |
| ジャンプナビ | プロフィール / 大会戦績 / H2H / 使用キャラ（スクロール追従・アクティブ検出）|
| Bio | locale に応じて bio（JA）/ bio_en（EN）切り替え、両方 null なら非表示 |
| 大会戦績 | 降順テーブル（大会名リンク付き）/ Placement 色分け / 賞金 / 使用キャラ |
| H2H | W/L バーグラフ、対戦相手名クリックで相手選手ページへ |
| 使用キャラ | 頻度バー（set 数ベース）|

**データ取得:**
- `players` テーブル: `bio`（JA）/ `bio_en`（EN）カラム使用
- `tournament_entrants`: player_id で絞り込み
- `tournament_sets`: winner_id / loser_id で絞り込み → H2H・キャラ使用頻度を JS で計算

**TOPページ:**
- ライブ大会バナー（is_live 判定: start_date〜end_date+3日間）
- 最近の結果 Top 3（直近完了大会の placement 1-3）
- 開催予定大会カード一覧（upcoming）
- 過去大会一覧（compact テーブル、10件、「すべて見る」で /tournaments へ）

**npm run build 結果:**
```
Route (app)           Revalidate
○ /                        1m
○ /tournaments             1m
ƒ /player/[id]
ƒ /tournament/[id]
✓ build succeeded
```

### 2026-04-28 — ブラケットページ worktree マージ完了

**実施内容:**
- `src/app/tournament/[id]/` (3ファイル) を worktree から本体にコピー
- `export const revalidate = 60` を追加（ISR: 60秒ごとに再生成）
- 関連ファイルの TypeScript エラー修正（下記）
- `npm run build` 成功を確認

**マージしたファイル:**
| ファイル | 変更内容 |
|---|---|
| `src/app/tournament/[id]/page.tsx` | 新規（ISR revalidate = 60 追加） |
| `src/app/tournament/[id]/TournamentClient.tsx` | 新規（843行・UI全体） |
| `src/app/tournament/[id]/types.ts` | 新規（型定義） |
| `src/app/globals.css` | SF6 デザイントークン追記（CSS変数 + アニメーション） |
| `src/app/layout.tsx` | Barlow / Barlow_Condensed フォント追加 |

**修正したビルドエラー（既存ファイルの不整合）:**
| ファイル | 修正内容 |
|---|---|
| `tsconfig.json` | `target: ES2017 → ES2019`（`/s` regex flag 対応） |
| `src/app/live/[tournamentId]/page.tsx` | 型定義に `endDate?: string` 追加 |
| `src/components/TournamentDashboard.tsx` | 型定義に `defaultTab?: 'groups' \| 'results'` 追加 |
| `src/components/ChatEmbed.tsx` | `channel` prop を `string \| null` に対応 |
| `src/app/tournament/[id]/page.tsx` | Supabase `.order()` の `nullsLast → nullsFirst: false` |

**リアルタイム更新の仕組み:**
- `export const revalidate = 60` → ISR: 次のリクエスト時に最大 60 秒遅延で最新データを返す
- `live-fetch.js --watch` でセットが INSERT されると次の ISR サイクル（最大 60 秒後）でブラケットページに反映
- 即時反映が必要な場合は On-Demand Revalidation（`revalidatePath`）を将来追加可

**worktree について:**
- worktree `cool-dewdney-e22375` (branch: `claude/cool-dewdney-e22375`) は削除するか継続使用するか要確認

**アクセス確認:**
- `/tournament/39` — DreamHack Birmingham 2026（125 entrants / 249 sets）
- `/tournament/40` — EVO Japan 2026（entrant / set 0件でも 404 にならない）

---

### 2026-04-28 — live-fetch.js 作成（リアルタイム差分取得スクリプト）

**実施内容:**
- `scripts/live-fetch.js` を新規作成

**機能:**
- `--tournament-id=N` と `--slug=<slug>` を引数で受け取る汎用設計（ハードコードなし）
- start.gg API からフェーズグループ単位で完了済み set を取得 (`completedAt != null`)
- DB 上の `startgg_set_id` と照合して新規 set のみ INSERT（差分検出）
- 新規プレイヤーが出現した場合は `players` と `tournament_entrants` に自動追加
- `--watch` フラグで常駐ポーリングモード（デフォルト 120 秒間隔、`--interval=N` で変更可）
- `--dry-run` フラグで DB 書き込みなしのテスト実行
- rate limit / ネットワークエラーはログ出力してリトライ（クラッシュしない）
- Ctrl+C で graceful shutdown（セッション累計 INSERT 数を表示）

**slug 形式の対応:**
- `tournament-slug` → トーナメント検索して SF6 イベントを自動選択
- `tournament-slug/event/event-slug` → イベント直接指定

**テスト実行結果:**
| テストケース | 結果 |
|---|---|
| DH Birmingham 2026 (id=39) `--dry-run` | start.gg: 249 sets、DB 既存: 249 → 差分 0 ✅ |
| EVO Japan 2026 (id=40) `--dry-run` | start.gg: 0 completed sets（大会前）→ 差分 0 ✅ |

**稼働手順（5/1 大会当日）:**
```bash
node scripts/live-fetch.js \
  --tournament-id=40 \
  --slug=evo-japan-2026-presented-by-levtech/event/evo-japan-2026-street-fighter-6 \
  --watch --interval=120
```

**注意:**
- EVO Japan は 7681 entrants のため初回フェーズ取得に rate limit が発生しやすい（自動リトライで回復）
- ポーリング間隔は 120 秒推奨（フェーズグループ数 × API コールを考慮）
- 大会終了後は手動で Ctrl+C 停止

---

### 2026-04-28 — 8大会 INSERT + DreamHack Birmingham 2026 データ取得完了

**実施内容:**
- `tournaments` テーブルに 8大会を INSERT (id=39〜46)
- DreamHack Birmingham 2026 の entrants/sets を start.gg から取得
- `scripts/fetch-dh-birmingham-2026.js` を新規作成
- `update-all-prize-data.js` に id=39 の config を追加し prize_amount を設定

**INSERT した大会一覧:**
| id | 大会名 | start_date | total_prize_usd |
|----|--------|-----------|-----------------|
| 39 | DreamHack Birmingham 2026 | 2026-03-28 | $50,000 |
| 40 | EVO Japan 2026 | 2026-05-01 | $44,960 (¥7,166,000) |
| 41 | DreamHack Atlanta 2026 | 2026-05-15 | $50,000 |
| 42 | COMBO BREAKER 2026 | 2026-05-22 | NULL |
| 43 | Blink Respawn 2026 | 2026-06-05 | NULL |
| 44 | Battle Arena Melbourne 16 | 2026-07-10 | NULL |
| 45 | CEO 2026 | 2026-08-14 | NULL |
| 46 | EVO France 2026 | 2026-10-09 | NULL |

**DreamHack Birmingham 2026 (id=39):**
- 125 entrants, 249 sets (Pools × 8 + Top 32 + Top 8)
- placements: start.gg から自動取得済み
- Top 8: Gachikun(1) / Micky(2) / GO1(3) / Kobayan(4) / HotDog29・Yuto(5) / DCQ・xiaohai(7)
- prize_amount: Top 16 × 16件設定済み
- 注意: `xiaohai` は id=25590 で新規作成（既存の Xiaohai と同一人物かは要確認）
- gamerTag マッチ候補（startgg_player_id 更新が必要な可能性）:
  Flawlessdeku(db=10209, sg=563470) / Prince(db=9418, sg=284030) / Sultan(db=17016, sg=4750713) /
  Nomad(db=20193, sg=5233673) / Kami(db=20646, sg=5231642)

---

### 2026-04-28 — Gamers8 2023 / EWC 2025 placement & prize_amount バックフィル完了

**実施内容:**
- `scripts/backfill-placements.js` に id=4 (Gamers8 2023), id=5 (EWC 2025) の config を追加
- `manualPlacements` フィールドをサポート追加（欠損 set・3位決定戦対応）

**技術的注意点:**
- Gamers8 2023: LBF（player 6 vs player 7）の set が DB に欠損 → `manualPlacements: { 7: 3 }` で対応
- EWC 2025: Phase 3 は 16人シングルエリミ（R1×8 + QF×4 + SF×2 + 3位決定戦×1 + GF×1 = 16 sets）
  - 3位決定戦の勝者（player 13）は lastWin > lastLoss になるため algorithm が検出できず `manualPlacements: { 13: 3 }` で対応

**DB更新結果:**
| 大会 | placement 更新件数 | prize_amount 更新件数 |
|------|-------------------|----------------------|
| Gamers8 2023 (id=4) | 32件 | 32件（backfill と同時設定） |
| EWC 2025 (id=5) | 48件 | 48件（backfill と同時設定） |

**EWC 2025 配置詳細:**
- Phase 3: 1st〜16th (R1敗者=9th/13th, QF敗者=5th, SF敗者=3rd/4th, GF敗者=2nd)
- Phase 2 2位→17th ($7,500), 3位→21st ($5,000)
- Phase 1 3位→25th ($2,500), 4位→37th（賞金なし）

---

### 2026-04-28 — 全大会 prize data 一括更新完了

**実施内容:**
- `scripts/update-all-prize-data.js` を新規作成
  - `node scripts/update-all-prize-data.js [--dry-run] [--id=<id>]` で実行
  - Esports Earnings / Liquipedia のデータで全大会を更新
  - 対象: id=4,5,9,11,12,21,23,25,30,31,32,33,34,35,36,37,38
  - id=2(CC11), id=3(EWC 2024), id=7(Evo 2024) は `backfill-placements.js` 済みのためスキップ
  - id=10(EVO 2026) は未開催のためスキップ

**DB更新結果:**
| 大会 | total_prize_usd 更新 | prize_amount 更新件数 |
|------|---------------------|----------------------|
| Gamers8 2023 (id=4) | ✓ 既正 $1,000,000 | placement 未設定 → 0件 |
| EWC 2025 (id=5) | ✓ 既正 $1,000,000 | placement 未設定 → 0件 |
| Capcom Cup 12 (id=9) | $1,282,000 → **$1,297,000** | placement 未設定 → 0件 |
| EWC 2026 (id=11) | ✓ 既正 $1,000,000 | skipPrizeAmount=true |
| Evo 2025 (id=12) | null → $42,420 | 6件 |
| COMBO BREAKER 2025 (id=21) | null → $18,440 | 8件 |
| BLINK RESPAWN 2025 (id=23) | null → $16,700 | 6件 |
| Evo France 2025 (id=25) | null → $30,149 | 8件 |
| CCC 2024 (id=30) | null → $8,230 | 4件 (1〜4位のみ) |
| UFA 2024 (id=31) | null → $11,085 | 8件 |
| ECT 2024 (id=32) | null → $11,410 | 13件 |
| CPT Super Premier Singapore 2024 (id=33) | null → $18,400 | 8件 |
| EVO Japan 2025 (id=34) | null → $24,075 | 0件 (既設定) |
| CEO 2025 (id=35) | null → $13,570 | 8件 |
| UFA 2025 (id=36) | null → $10,942 | 8件 |
| CAPCOM CUP X (id=37) | null → $1,734,000 | 32件 |
| Evo 2023 (id=38) | null → $70,600 | 1件 |

**未解決:**
- Gamers8 2023 (id=4) と EWC 2025 (id=5) は `placement` が全件 null → `prize_amount` 未設定のまま

---

### 2026-04-27 — placement / prize_amount バックフィル完了

**実施内容:**
- `scripts/backfill-placements.js` を新規作成（汎用スクリプト）
  - `node scripts/backfill-placements.js <tournament-id> [--dry-run]` で実行
  - 設定済みID: 2 (CC11), 3 (EWC 2024), 7 (Evo 2024)
  - グループステージ: wins + game-score differential でランク決定
  - ブラケット: lastLossSetIdx DESC ソート + bracketRoundsコンフィグで tied placement を正確に割当

**DB更新結果:**
| 大会 | 更新件数 | 内容 |
|------|---------|------|
| Capcom Cup 11 (id=2) | 48件 | placement + prize_amount 両方設定 |
| Esports World Cup 2024 (id=3) | 32件 | placement + prize_amount 両方設定 |
| Evo 2024 (id=7) | 5件 | prize_amount のみ（placement は start.gg から既設定） |

**CC11 Top 16 ブラケット結果（確認済み）:**
- 1位: Kawano (player 1) $1,000,000
- 2位: Kakeru (player 12) $100,000
- 3位: player 13 $50,000
- 4位: player 6 $20,000
- 5位 (tied): players 354, 57 $10,000
- 7位 (tied): players 822, 24 $5,000

**参考スクリプト:** `scripts/backfill-cc11-placements.js` (旧版、CC11専用) も残存。新版に移行済み。

---

### 以前の作業

- `scripts/fetch-cc11-characters.js`: Liquipedia fighters wiki から CC11 全試合のキャラデータ取得・DB書込
  - 142/142 マッチ更新完了 (2026-04-26頃)
- `tournament_sets` テーブルに `winner_character`, `loser_character` カラムを追加 (Supabase Dashboard)
- worktree `/tournament/[id]` ページ実装中:
  - グループステージのラウンドラベルを修正 (グランドファイナル誤表示を修正)
  - 勝者側キャラ表示の幅伸び問題を修正
  - 順位表にトーナメントで実際に使用したキャラ表示 (usedCharacters)
- `CLAUDE.md` を新規作成（プロジェクト全体の運用ルール）
