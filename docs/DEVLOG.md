# SF6 Stats — 開発ログ

## 2026-06-09

### 実装・修正
- H2Hバー大幅リデザイン: ⚔アイコン（金色パルスアニメ）、HEAD TO HEAD ラベル、N戦カウント（ゴールド）
- 勝ち越し側ハイライト: 勝数26px ゴールド+グロウ / 負け越し20px 白 / 同点22px
- H2Hバー縦幅圧縮: ~123px → ~78px（選手名+勝数の1行化、カラーブロック削除）
- H2H選手名フォントサイズ: 12px → 16px + font-weight 600
- PC版H2Hバー消失バグ修正: h2h-faceoff の overflow:hidden → visible、PlayerBandに個別角丸移動
- デモモード充実化:
  - DEMO_POOLS_DATA追加（Pool A完了/B進行中/C未開始、feed 5件、qualified 3選手）
  - SidePanelLeft に isDemo prop追加 → デモ時プレースホルダー表示
  - デモ時 hasStream=true に変更（Twitchオフライン画面表示）
  - FeaturedMatchesPanel デッドインポート削除
- 本番モード切替: 手動トグル廃止（デモのみ残す）、AUTO専用化
- 終了大会の強制H2Hモード: usePoolsDashboard に endDate判定追加、ポーリング停止
- slug統一: '9'→'capcom-cup-12'、'40'→'evo-japan-2026'、SLUG_REDIRECTS追加
- Poolsモードのモバイルレイアウト修正: gridTemplateRows解除、HighlightCard被り修正、チャット非表示、PoolsDashboardスクロール可

### 過去の実装（〜2026-06-08）
- 全11大会のページ表示統一（ロゴ、バッジ、賞金、CPTポイント、EWC出場権）
- モバイル対応（ハンバーガーメニュー、順位表レスポンシブ、$0非表示）
- 対戦結果アコーディオン（順位表＋ポディウムカード）
- Cron自動バックフィル（国旗・キャラ・賞金を6時間→毎日2AMに変更）
- 大会配信ページ（/live/[tournamentId]）基盤実装
- H2Hティッカー（横スクロール過去対戦、速度調整済み）
- モバイル配信ページ: 配信+H2H上部固定、下部スクロール（flex layout、100dvh）
- isTournamentLive ユーティリティ関数（UTC+24hバッファ）
- LIVEバナー/リンク（ナビバー、トップページ、大会結果ページ）
- Blink Respawn 2026: DB登録、628セット取込、Top8結果（優勝MenaRD）
- Vercel手動デプロイ対応（npx vercel --prod --yes）

## 2026-06-26 — EVO 2026 Day 1 対応・レイアウト改善

### 変更内容
- PC版: `max-height: calc(100vh - 320px)` を stream-player-wrapper に追加（配信エリアの高さ制限）
- PC版: `live-content-wrapper` に `max-width: 1440px` を設定（ワイドスクリーンで両サイド帯）
- モバイル: STANDINGS / CHAT タブ切替を実装（mobileTab state）
- Pools モード: `isPoolsPhase` 判定に `pools` と `unknown` を追加
- Pools API: `currentPhase` フォールバックを `Unknown` → `Pools`（プール設定存在時）に改善
- Navbar: compact モード追加（ライブページ専用、高さ 52px → 36px）
- PlayerBand: レスポンシブ化（minmax(160px, 15vw)、中画面 minmax(120px, 12vw)）

### 発生した問題と解決方法
- 問題: PC版ワイドスクリーンで下部コンテンツが見切れる
  - 原因: 16:9 aspect-ratio が幅に応じて高さを無制限に拡大
  - 解決: stream-player-wrapper に max-height を設定、live-content-wrapper に max-width: 1440px

- 問題: モバイルでチャットが非表示
  - 原因: `live-chat-panel { display: none }` がモバイル全体に適用
  - 解決: タブ切替 UI を追加し、CHAT タブ選択時のみチャットを表示

- 問題: EVO 2026 が Pools モードにならない
  - 原因: API が `currentPhase: "Unknown"` を返し、hook の判定条件に未対応
  - 解決: API フォールバックを "Pools" に変更 + hook に unknown/pools 条件追加

### 未解決の課題
- スマホ実機と Chrome DevTools で表示が異なる（実機を正とする）
- Vercel キャッシュにより変更が即座に反映されない場合がある

## 2026-07-02 — モバイル/PC レイアウト検証と修正・モード切替のデータ駆動化

### 変更内容
- `usePoolsDashboard.ts`: endDate超過でも直近24h以内にイベントがあればライブ扱いでポーリング継続（延長・日程ズレ対応）。終了確定時は1回フェッチ後にポーリング自動停止
- `page.tsx`: タブ用ラッパー div に flex 設定を追加（PC: グリッドセル全高、モバイル: 残り全高）→ モバイルCHATタブのチャットが165pxしかなかった問題を解消
- `page.tsx`: stream-player-wrapper の max-height を `calc(100vh - 320px)` → `calc(100vh - 460px)` に修正（実測: navbar 36 + toggle 33 + ラウンドバー48 + H2Hバー114 + secondary 200 + gap ≈ 453px）
- `page.tsx` + `StreamCenter.tsx`: channel-selector の hover CSS を StreamCenter から page.tsx グローバルへ移動、`@media (hover: hover)` ガード付き（タッチ端末では常時表示）
- `page.tsx`: デモデータの pool ラベル `'Pool A'` → `'A'`（「POOL Pool A」の重複表示を解消）

### 発生した問題と解決方法
- 問題: PC 800px高で h2h-secondary が162px見切れ
  - 原因: max-height のオフセット320pxが実際の周辺要素合計(453px)より小さい
  - 解決: 実測値ベースで460pxに変更。Preview検証で見切れゼロを確認

- 問題: モバイルCHATタブでチャットが165pxしか表示されない
  - 原因: タブ実装時のラッパー div が plain block でflex設定なし
  - 解決: `.h2h-secondary > div` にflex column + flex:1 を設定（PC/モバイル両方）

- 問題: channel-selector の hover CSS が無効
  - 原因: クラスは poolsMode 側 return、style は H2H 側 return に配置されていた
  - 解決: page.tsx グローバルCSSに移動。hover 不可のタッチ端末で操作不能にならないよう `@media (hover: hover)` でガード

- 問題: EVO 2026 が H2H 固定でモード切替しない
  - 原因: endDate(6/28)+24h 超過による設計通りの動作（大会は実際に終了、newestEventTs は 6/29 03:25 UTC）。live-fetch の取込は過去セットのバックフィルだった
  - 解決: 仕様通りだが、今後の延長・日程ズレに備えて newestEventTs ベースのライブ判定を追加

### 未解決の課題
- EVO 2026 のDB取込が 194/2117 と不完全（start.gg には約4820完了セットあり）→ `--initial-fetch` での全量バックフィルを検討
- Twitch チャンネル capcomfighters が現在オフライン（外部要因）

## 2026-07-02 — EVO 2026 大会結果の反映

### 変更内容
- `node scripts/import-tournament.js evo-2026`: エントラント 2404人 + 順位(placement)を投入（優勝 MenaRD, 2位 yukari, 3位 Kilzyou）
- `node scripts/import-sets.js evo-2026`: 完了セット 1557件を追加取込（Pools全Round + Top 24 + Top 8）。DB完了セット数 194 → 1518
- `node scripts/backfill-characters.js --tournament-id=10`: キャラクターデータのバックフィルをバックグラウンド実行中（約41分、Pool戦は start.gg 側にデータがなく noData になるケースが多い見込み）
- `src/app/tournament/[id]/page.tsx`: tournament_sets 取得クエリに `.not('winner_id', 'is', null)` を追加し、entrants と同じページネーションパターン（1000件ずつ）で全件取得するよう修正

### 発生した問題と解決方法
- 問題: `/tournament/10` の「総試合数」が 999〜1000 で実際の完了セット数(1518)と乖離
  - 原因: Supabase/PostgREST の `db-max-rows` が 1000 に設定されており、`.range(0, 2999)` で3000件要求しても実際は1000件で打ち切られていた。EVO2026は全3404行（未消化のブラケット枠含む）あり、winner_id フィルタもなかったため一部の完了セットが取得範囲外になっていた
  - 影響範囲: EVO2026だけでなく、完了セット数が1000件を超える全大会（例: Combo Breaker 2026 の2900件）に共通の潜在バグ。CB2026は `TOURNAMENT_REAL_STATS` の手動オーバーライドで表示上は隠れていた
  - 解決: entrants 取得と同じ「1000件ずつ range ループ」パターンに変更 + `winner_id IS NOT NULL` フィルタ追加

### 未解決の課題
- 賞金総額（total_prize_usd）が null のまま。Liquipedia への直近アクセスでレート制限（Rate Limited、IPブロック）を受けており、解除まで自動スクレイピングは見送り。手動で数値が分かれば `tournaments.total_prize_usd` と `tournament_entrants.prize_amount` を投入予定
- キャラクターバックフィルは Pool 戦の多くで `noData`（start.gg にキャラ選択データが存在しない）になる可能性が高い。Top 24/Top 8 はライブ中のポーリングで既に取得済み

## 2026-07-12 — BAM 16 (Battle Arena Melbourne) ライブパーサー起動

### 変更内容
- start.gg で BAM 16 の SF6 メインイベントを検索・特定（tournament id: 868670, event id: 1540814, CPT Premier, 230エントラント）
- `tournaments` テーブル (id=44) を更新: startgg_slug/tournament_id/event_id, slug='bam-16', is_active=true
- `node scripts/import-tournament.js bam-16-battle-arena-melbourne-16`: エントラント230人を投入
- `tournamentConfig.ts` に `'bam-16'` エントリを新規追加（配信: capcomfighters メイン + couchwarriors サブ、タイムゾーン Australia/Melbourne）
- `node scripts/live-fetch-v2.js --tournament-id=868670 --event-id=1540814 --tournament-slug=bam-16 --db-tournament-id=44 --initial-fetch` をバックグラウンド起動（PID管理、60秒間隔ポーリング）

### 発生した問題と解決方法
- 問題: import-tournament.js 実行後、DB の `slug` カラムが start.gg の長いスラッグ（bam-16-battle-arena-melbourne-16）に上書きされた
  - 原因: スクリプトは常に `argv[2]`（=渡したstart.ggスラッグ）を `tournaments.slug` に書き込む仕様
  - 解決: 実行後に手動で `slug='bam-16'` に戻し、tournamentConfig.ts のキーと一致させた

### 未解決の課題
- EVO 2026 の古い live-fetch-v2.js プロセス（PID 74295）がまだバックグラウンドで動作中。大会終了済みのため停止して問題ないが未整理
- BAM 16 の賞金プール情報は未取得

### 追記 (同日) — H2H切替バグの修正 + Feed停滞の原因判明
- 問題: Top 8開催中のはずが Pools/H2H 自動切替が「Pools」のままで H2H に切り替わらない
  - 原因: `pools-dashboard/route.ts` の currentPhase 判定が「pool_identifier が非nullならPoolsフェーズ」という単純な heuristic だった。BAM16 は Top 32 ブラケットも phaseGroup を1つ持つため `pool_identifier='1'` が付き、誤って Pools 扱いされていた（EVO2026はTop24/Top8のpool_identifierがnullだったため偶然動いていた）
  - 解決: `route.ts` に `getPoolsPhaseIdentifiers()` を追加。start.gg の `event.phases{name phaseGroups{displayIdentifier}}` を取得し、フェーズ名に "pool" を含むフェーズ配下の displayIdentifier 集合のみを「本物のPools」と判定するよう変更（30分キャッシュ、取得失敗時は旧heuristicにフォールバック）
- 問題: Feedが更新されていないように見える
  - 調査: start.gg 側を直接確認したところ、直近の完了セット更新は 2026-07-11T11:58:12 UTC（現在時刻から約17.5時間前）。Top 8 は `state=ACTIVE` だが完了セット0件 — 大会側の結果報告自体が止まっている状態で、こちらのポーリング（PID 8789, エラーなしで正常稼働中）は正しく「更新なし」を検知していただけだった。バグではなく、大会運営側のstart.gg報告待ち

## 2026-07-20 — EWC 2026 LCQ 事前セットアップ

### 変更内容
- start.gg で EWC 2026 LCQ を特定（tournament id: 919272, event id: 1640093, パリ 7/24-26, 269エントラント時点）。EWC本大会（DB id=11, リヤド 7/28-31）とは別大会
- `tournaments` テーブルに新規行を作成（id=49, slug='ewc-2026-lcq'）
- `node scripts/import-tournament.js esports-world-cup-2026-street-fighter-6-lcq`: エントラント268人を先行投入（ブラケット未生成のため placement は全員null）
- `tournamentConfig.ts` に `'ewc-2026-lcq'` エントリを追加。配信チャンネルは大会側未発表のため EWC公式チャンネル(ewc_plus_en2/ewc_plus_en)を暫定設定

### 未解決の課題
- live-fetch-v2.js は未起動（start.gg 側でブラケット(`phases`)が未生成のため、開始直前〜開始後に `--initial-fetch` 付きで起動する）
- 配信チャンネルが正式発表されたら `streamChannel`/`twitchChannels` を要更新
- エントラント数は登録期間中のため今後変動する見込み。大会直前に再度 import-tournament.js で更新推奨

## 2026-07-26 — EWC 2026 LCQ 本番稼働 + 確定順位のズレ修正

### 変更内容
- `tournamentConfig.ts`: フェーズ構成を実ブラケットに合わせ修正（想定 Pools→Top32→Top8 → 実際は **Pools→Top 64→Top 16→Top 8**）
- `import-sets.js` で完了済みセット442件を取込、`live-fetch-v2.js` を起動（db-tournament-id=49）
- `tournamentConfig.ts`: 配信チャンネルを `ewc_plus_en2`（誤）→ `ewc_plus_en`（start.gg 登録の正チャンネル）に修正
- `SLUG_REDIRECTS` に生slug→短slugのマッピングを追加
- `api/startgg/route.ts`: `Q_STANDINGS` を追加し、レスポンスに `standings` を含めるよう変更
- `useStartggPolling.ts`: `startggStandings` を返すよう拡張
- `LiveStandings.tsx`: start.gg 公式 standings を優先使用。`ordinal()` ヘルパー追加。敗退ラウンド表示用に `eliminatedRound` Map を追加

### 発生した問題と解決方法
- 問題1: トップページから大会リンクを踏むと config が解決されない
  - 原因: `HomeClient.tsx` のリンクが `startgg_slug`（生slug）を使う一方、`tournamentConfig.ts` のキーは短い `slug`。両者が不一致
  - 解決: 既存の `SLUG_REDIRECTS` に `esports-world-cup-2026-street-fighter-6-lcq → ewc-2026-lcq` を追加。同じ問題があった BAM16 も併せて追加
- 問題2: 確定順位が実際とズレる
  - 原因: `LiveStandings.tsx` の `roundToPlacementLabel()` がラウンド名のみで順位を推測していた。本大会は4フェーズ構成で **各フェーズが同じラウンド名を持つ**ため、Top 64 の "Losers Quarter-Final" 敗者が「5位」と誤表示された
  - 解決: start.gg 公式 `standings` を取得して正とする実装に変更。ラウンド名推測は standings 取得失敗時のフォールバックとして残置。本番で 5th/7th/9th/13th/17th/25th/33rd/49th が start.gg と完全一致することを確認
- 問題3: 配信が常にオフライン表示
  - 原因: 暫定設定していた `ewc_plus_en2` は別チャンネル（正しくは `ewc_plus_en`、フォロワー76K）
  - 解決: start.gg の `tournament.streams` から正チャンネルを取得して修正。なお確認時点で配信自体も休止中だった（Day1終了後）
- 注意: `import-sets.js` は start.gg 用と DB 用で同じ slug 引数を使うため、短slugに変更済みのDB行では動かない。一時的に生slugへ戻して実行し、完了後に短slugへ復元した

### 未解決の課題
- `import-tournament.js` / `import-sets.js` の slug 二重利用問題（毎回 slug の手動復元が必要）→ `--startgg-slug` と `--db-slug` を分離するのが望ましい
- EWC LCQ の通過枠数（`ewcSlots`）が未設定（大会発表待ち）

## 2026-07-26 — 順位の確定/未確定表示 + ライブページのレイアウト再設計

### 変更内容
- `api/startgg/route.ts`: standings クエリに `isFinal` を追加。レスポンスの各 standing に `isFinal` を含める
- `useStartggPolling.ts`: `StartggStanding` に `isFinal` を追加
- `LiveStandings.tsx`: 順位を「未確定」「確定順位」の2セクションに分割。`StandingRow` を切り出し、未確定行は左に緑ボーダー＋破線区切り＋「未確定」ラベルで区別
- `live/[tournamentId]/page.tsx`: ページを 100dvh 固定から**スクロール可能**に変更（インラインの `height`/`overflow` も併せて修正）。配信+H2Hでファーストビューを構成し、順位表/チャットはその下へ。スクロールヒントボタン（`.scroll-hint`）を追加

### 発生した問題と解決方法
- 問題1: 確定した順位と、まだ試合が残っていて変動しうる順位が区別できない
  - 原因: start.gg の standings は**まだ敗退していない選手にも暫定 placement を付ける**（Top 8 進出者8名が全員 5th/7th として掲載されていた）
  - 解決: start.gg の `Standing.isFinal` フィールドを使用。未完了セットから独自に生存者を割り出した結果と完全一致することを検証した上で採用
- 問題2: 当初「試合中」ラベルを付けたが不正確だった
  - 原因: MOCCHI(33位)のように、未完了セットに登場しないのに `isFinal=false` の選手が存在する
  - 解決: ラベルを「未確定」、見出しを「未確定 — 今後変動する可能性あり」に変更し、実態と一致させた
- 問題3: モバイルでチャット表示域が極端に狭い / PCで配信画面が狭い
  - 原因: `.live-page` が `height:100dvh; overflow:hidden` で全要素を1画面に押し込んでいた。PC版は配信の高さ上限が `calc(100vh - 460px)` と、順位表用に200pxを差し引いていた
  - 解決: ページスクロールを解禁。配信の高さ上限を `calc(100dvh - 265px)` に拡大し、`.stream-and-h2h-sticky` に `min-height: calc(100dvh - 105px)` を与えてファーストビューを配信+H2Hで構成。順位表/チャットは `height: min(78vh,760px)`（モバイルは `min-height:78dvh`）で下に配置。モバイルのタブバーは `position:sticky` で常時操作可能に
  - 検証: 1440x900 / 1024x768 / 375x812 で実測。ヒーローがビューポートを占有し、横スクロールなし、モバイルのチャットiframeが 357x630（従来比で大幅拡大）

### 未解決の課題
- インラインスタイルとCSSクラスの二重管理が依然として残る（`.h2h-secondary` 等）。将来的に整理したい

### 追記 (同日) — Twitch が画面外で停止する問題への対応

#### 検証結果（重要）
Twitch 埋め込みプレーヤーの挙動を実測（配信中チャンネルで Twitch Embed JS API の
`isPaused()` / `getCurrentTime()` を1秒間隔サンプリング）:

- **ビューポート外に出た瞬間に `paused=true` になり、2秒後に `time` が 0 にリセット**
- 90秒以上経過しても停止したまま
- **スクロールで戻しても自動再開しない**（`paused=true`, `time=0` のまま。手動で再生ボタンが必要）
- `position: sticky` で画面内に留めた場合は **15.1秒分の再生が途切れず継続**、一度も停止せず

→ 前項の「ページスクロール解禁」により、下へスクロールすると配信が止まる不具合が発生していた

#### 変更内容
- `.stream-and-h2h-sticky` を `position: sticky; top: 0` に変更（PC・モバイル両方）
- PC: ヒーロー高さを約68vh に抑制（`max-height: calc(68vh - 250px)`）。画面いっぱいだと
  sticky 固定時に下の順位表/チャットを覗く隙間が無くなるため
- モバイル: タブバーの `position: sticky` を撤回（配信の sticky と top:0 で競合するため）

#### 発生した問題と解決方法
- 問題: sticky を指定しても効かない（PC: `top:-300`, モバイル: `top:-220`）
  - 原因1(PC): `.live-page` のインラインに `overflowX: 'hidden'` を付けていた。
    overflow を指定するとスクロールコンテナが生成され、子の `position:sticky` が
    viewport 基準で機能しなくなる
  - 原因2(モバイル): モバイル用CSSに既存の `.stream-and-h2h-sticky { position: relative !important }`
    があり、後方に書いた同名ルールより**ソース順で後**にあったため上書きされていた
  - 解決: `overflow: visible` に変更し、既存のモバイルルール自体を sticky に書き換えて重複を解消
- 検証: 1440x900 / 375x812 の両方で、最下部までスクロールしても配信が完全に画面内
  （PC: top=47/bottom=409、モバイル: top=94/bottom=306）であることを本番で確認

### 追記 (同日) — PC版をミニプレーヤー方式に変更（YouTube移行は見送り）

#### 背景
前項の sticky 方式は、PC でヒーローを 68vh に抑える必要があり配信画面が小さくなる
という副作用があった。「ミニプレーヤーが成立するなら Twitch のまま、駄目なら YouTube へ」
という判断のため、成立可否を実測で検証した。

#### 検証結果
- CSS のみで iframe を fixed 化・縮小した場合、**iframe の reload は 0回**、
  同一 DOM ノード・src 不変を維持（`load` イベント計測）
- ミニ化後も iframe は完全にビューポート内に残る
- 既に実証済みの「ビューポート内なら再生継続」と合わせ、**ミニプレーヤーは成立**
- → YouTube への移行は不要と判断

重要: iframe を DOM から移動（再parent化）したり src を変えると再読込され再生が止まる。
必ず**同一ノードのまま CSS だけで**切り替えること。

#### 変更内容
- PC: ヒーローを再びフルサイズに戻す（`min-height: calc(100dvh - 105px)`,
  配信 `max-height: calc(100dvh - 265px)`）。sticky は解除
- `.live-page.mini-player` 時に配信 iframe だけを右下に fixed (336x189) 化。
  `.stream-player-wrapper` は通常フローに残すためレイアウトが崩れず、
  ページ高さが変わらないのでスクロール位置の振動も起きない
- 元の配信枠には `::after` で「▶ ミニプレーヤーで再生中」を表示
- `StreamCenter.tsx`: 配信 iframe のインラインスタイルを `.stream-iframe` クラスへ移動
  （インラインは CSS クラスより優先されミニ化の上書きができないため）
- モバイルは従来通り sticky（ミニ化は無効）

#### 発生した問題と解決方法
- 問題: ミニ化の閾値を「下端が画面上部に迫ったら」にしていたため、
  スクロール途中で配信が大きく画面外に出る区間があり、そこで Twitch が停止し得た
  - 解決: 配信枠の**可視率**で判定する方式に変更（ミニ化 <0.55 / 解除 >0.8 の
    ヒステリシス）。これにより全スクロール位置で iframe の可視率が
    **0.82 を下回らない**ことを本番で確認
- 検証: 本番 1440x900 で y=0→300→450→721→300→0 を往復し、
  切替の振動なし・最小可視率 0.82 を確認。モバイル(375x812)は sticky 維持・可視率1.00

## 2026-07-27 — EWC 2026 LCQ 終了後のデータ補完 + 動作検証

### パーサーの稼働状況（検証結果）
大会終了時点で `live-fetch-v2.js` のプロセスとログが消失しており、途中で停止していた。
start.gg と DB を突き合わせた結果、以下の取りこぼしを検出:

| 項目 | start.gg | DB(補完前) | 差分 |
|---|---|---|---|
| 完了セット | 536 | 484 | -52 |
| 順位 | 確定済 | 0件 | 全欠落 |
| エントラント | 269 | 268 | -1 |

補完後はいずれも start.gg と完全一致（セット536 / 順位269 / エントラント269）。

### 変更内容
- `import-sets.js` 再実行 → 536セット全件を取得（Both matched: 536, Unmatched: 0）
- 重複プレイヤー5件を正規レコードへ統合（下記「発生した問題」参照）
- start.gg standings から `startgg_entrant_id` 照合で順位269件をバックフィル
- `tournaments` に `logo_url` / `stream_url` を設定、`is_active=false`
- `api/startgg/route.ts`: `event.state === 'COMPLETED'` なら standings を全て確定扱いにする

### 発生した問題と解決方法
- 問題1: `import-tournament.js` が既存エントラントの placement を更新しない
  - 原因: 既存行は「Skipped」として飛ばされ、新規挿入分にしか placement が入らない
  - 解決: `startgg_entrant_id` をキーに standings から直接 UPDATE するバックフィルを実行
    （名前照合ではなく ID 照合なので確実。269件全て一致、DBに無い entrant は0件）
- 問題2: 同一人物が重複プレイヤーとして5件挿入された
  - 原因: `import-tournament.js` は gamerTag が一致しても start.gg の player_id が
    異なると別人として新規作成する（Darklight/DarkLight, PaLu/palu, Raph, Darksword, Shiro/shiro）
  - 解決: ①該当セットの winner_id/loser_id を正規プレイヤーへ付け替え
    ②正規プレイヤーの `startgg_player_ids` に新しい start.gg ID を追加（今後の再発防止）
    ③重複した tournament_entrants 行を削除
    ④参照が残っていないことを確認してから重複プレイヤー行を削除
- 問題3: 大会終了後も1名(MOCCHI)が「未確定」表示のままだった
  - 原因: start.gg が COMPLETED 後も一部エントラントの `isFinal` を false のまま残す
  - 解決: `event.state === 'COMPLETED'` なら全て確定扱いに。本番で isFinal=false が0件になることを確認

### 検証結果（正常と確認したもの）
- セットのスコア整合性: 不整合0件。Top 8 ブラケットも start.gg と完全一致
- 勝者ありでスコアなしの140件は全て `display_score="DQ"`（DQは game score を持たないため正常）
- 勝者なし59行は未消化/不戦のプレースホルダ（`totalMatches` からは除外され536と正しく表示）
- 大会ページ: 参加者数269 / 総試合数536 / 順位表・ブラケット・キャラ統計タブすべて正常
- ライブページ順位表: 1st🏆Dual Kevin / 2nd Hibiki(GF) / 3rd moke(LF) … と正しく表示

### 未解決の課題
- **キャラクターデータは取得不可**: `backfill-characters.js` 完走結果は
  `processed: 536 / updated: 0 / noData: 536 / errors: 0`。
  start.gg に直接クエリしても `games` フィールドが null で、主催者がキャラ選択を
  記録していないことを確認済み。パイプラインの不具合ではない。
  大会ページのキャラ統計は `players.main_character` 由来で動作している（22キャラ・54選手）
- `total_prize_usd` は未設定（start.gg に賞金情報なし。Liquipedia は以前レート制限を受けたため未取得）
- `import-tournament.js` / `import-sets.js` の slug 二重利用問題は未解消（毎回手動復元が必要）
- 次回大会では `live-fetch-v2.js` の死活監視が必要（今回は無警告で停止していた）

### 追記 — EWC 通過枠の設定

- LCQ の EWC本戦への通過枠は **上位6名**（ユーザー確認）
- `tournaments.ewc_qualifying_spots = 6` を設定、`tournamentConfig.ts` の `ewcSlots: 6` も更新
- 5位が2名タイ（Itabashi Zangief / Lexx）のため、上位6名がちょうど Lexx までで切れる。
  判定ロジック `placement <= ewcQualifyingSpots`（`TournamentClient.tsx:1151`）が
  タイをそのまま正しく扱うため特別な処理は不要だった
- 通過者: Dual Kevin(1) / Hibiki(2) / moke(3) / Xian(4) / Itabashi Zangief(5) / Lexx(5)
- 本番で `EWC QUALIFIED` バッジがちょうど6個、7位(dible / inaba)には付かないことを確認

## 2026-07-29 — EWC 2026 本戦の準備（Liquipedia を一次ソース化）

### 変更内容
- `api/liquipedia/results/route.ts` を新規作成。Liquipedia のブラケット wikitext を
  `/api/startgg` と同じ matches 形状に変換する汎用パーサー
- `useStartggPolling.ts`: `liquipediaTournament` を追加。startggEventId が無い大会は
  Liquipedia から取得する（ポーリング間隔は 60s / live時 30s と長めに設定）
- `tournamentConfig.ts`: `forceDisplayMode` と `liquipediaTournament` を型に追加し、
  `'ewc-2026'` エントリを追加（H2H固定・EN/JP配信）
- `usePoolsDashboard.ts`: `forceDisplayMode` 指定時はフェーズ名による自動切替を行わない
- `TournamentClient.tsx`: ハードコードだった `CONCLUDED` バッジを
  UPCOMING / LIVE / CONCLUDED の出し分けに修正
- DB: `tournaments` id=11 を修正、`tournament_entrants` に32名を投入

### 発生した問題と解決方法
- 問題1: 本戦が start.gg に存在しない
  - 調査: slug 直指定4パターン・国+日付検索いずれもヒットせず、Liquipedia の
    infobox も `startgg=` が空。**start.gg 不使用**を確認
  - 解決: Liquipedia API (`action=parse&prop=wikitext`) を一次ソースにした。
    既存の CC12 実装と同じ User-Agent を使用。以前 429 を受けたのは生HTML
    スクレイピングが原因で、API 経由なら問題ないことを確認
- 問題2: **DB の大会情報が誤っていた**
  - `location: Riyadh, SA` / `2026-07-28〜31` → 正しくは **Paris, FR / 2026-07-29〜08-01**
  - EWC 2025（リヤド開催）の情報が引き継がれていたと思われる。Liquipedia の
    infobox に合わせて修正
- 問題3: パーサーが16件しか取得できない
  - 原因: 後続ラウンドは対戦相手が未確定で `opponent1={{SoloOpponent||...}}` と空欄。
    `if (!p1 && !p2) continue` でスキップしていた
  - 解決: TBD として取り込むよう変更 → 67件（40+20+7）に。下流の LiveStandings 等は
    元から TBD を除外する実装なので影響なし
- 問題4: 参加者数タイルが 0 と表示される
  - 調査: `visibilityState: hidden` で `requestAnimationFrame` が発火せず、
    カウントアップ演出が動かないだけだった（rAF 発火0回を実測）。実ユーザーには32と表示される。
    **不具合ではない**ため修正せず

### 追記 (同日) — BRACKET タブをトーナメント表に

- `GroupBracket.tsx` を新規作成。ラウンドを列、試合をカードとして配置する
  トーナメント表を描画（グループ切替タブ付き）
- `api/liquipedia/results`: 配置に必要な `matchKey` (R1M1 等) を出力に追加
- `StreamCenter.tsx`: BRACKET タブで `matchKey` を持つ試合（= Liquipedia由来）が
  あればトーナメント表、無ければ従来の `LiveSetsTable` を表示

構造の対応（GSL 8人・上位4名通過）:
| wikitext | 表示列 | 区分 |
|---|---|---|
| R1M1–R1M4 (Upper Bracket Quarterfinals) | 1回戦 | 勝者側 |
| R2M1–R2M2 (Upper Bracket Semifinals) | 勝者戦 | 勝者側 |
| R1M5–R1M6 (Lower Bracket Quarterfinals) | 敗者戦 | 敗者側 |
| R2M3–R2M4 (Lower Bracket Semifinal) | 進出決定戦 | 敗者側 |

決勝ブラケット(`Bracket/8`)は 準々決勝 → 準決勝 → 決勝 の3列。
未知のラウンド名は出現順に列を割り当てるフォールバックを実装済み。

注: 既存の `LiveBracket.tsx` は試合の**リスト**表示で、どこからも使われていない
（今回のトーナメント表とは別物）。整理候補。

### 追記 (同日) — ブラケットの進行線を正確に描画

初版は列を並べただけで、接続線が「16pxの短い横棒」しかなく、
どの試合の勝者/敗者がどこへ進むかが表現できていなかったため作り直した。

#### 接続構造の確定（推測せず実データで検証）
1. `Template:Bracket/8-2Q-U-4L2D-2Q` は存在せず、テンプレ定義からは取得不可
2. EWC2025 が4人版 `Bracket/4-1Q-U-2L1D-1Q` を使用しており、**確定済みの
   Group A** で構造を実証:
   - R1M1=Latif vs NoahTheProdigy / R1M2=NARIKUN vs AngryBird
   - R2M1(勝者戦)=NoahTheProdigy vs AngryBird → R1M1・R1M2の勝者
   - R1M3(敗者戦)=Latif vs NARIKUN → R1M1・R1M2の敗者
   - R2M2(決定戦)=NoahTheProdigy vs Latif → R2M1敗者 + R1M3勝者
3. EWC2026(8人版)は**独立した4人GSL×2ハーフ**。試合時刻の依存順が裏付け:
   - ハーフA: R1M1(16:30),R1M2(16:45) → R2M1(17:25) → R1M5(17:55) → R2M3(18:25)
   - ハーフB: R1M3(16:00),R1M4(16:15) → R2M2(17:10) → R1M6(17:40) → R2M4(18:10)

#### 変更内容
- カードを絶対配置し、SVG で直角の折れ線（elbow）を描画する方式に変更
- **勝者=緑の実線 / 敗者=赤の破線**で色分けし、右上に凡例を表示
- 各カードのヘッダーにラウンド名（1回戦 / 勝者戦 / 敗者戦 / 進出決定戦）を表示。
  1列に勝者戦と敗者戦が混在するため列見出しではなくカード側に持たせた
- 勝者戦の勝者・進出決定戦の勝者に「✓ 通過」バッジと接続線を追加（計4名＝上位4名通過と一致）
- 決勝ブラケットはシングルエリミとして 準々決勝→準決勝→決勝 を描画。
  各ラウンドを前ラウンド2試合の中点に配置（準決勝 y=44,220 / 決勝 y=132 と数学的に一致）

### 追記 (同日) — 開始までのカウントダウン

#### 問題
トップページが「開催中(LIVE)」と表示していたが、実際にはまだ初戦前だった。
`isTournamentLive()` は **start_date の 00:00 UTC** から開催中と判定するため、
初戦が同日 11:00 UTC の場合、約11時間ものあいだ誤って LIVE 表示になる。

#### 変更内容
- `api/liquipedia/results`: `startsAt`（最速の試合）と
  `nextMatchAt`（まだ完了していない最速の試合）を返すよう追加。
  大会は日をまたぐため、単なる開始時刻ではなく「次の試合」を持つのが実用的
- `components/StartCountdown.tsx` を新規作成（`useNextMatchCountdown` フック + バッジUI）。
  1秒ごとに更新し、60秒ごとに次の試合を取り直す
- `HomeClient.tsx`: 次の試合が未来なら LIVE バッジの代わりにカウントダウンを表示。
  DBの大会IDから `TOURNAMENT_CONFIG` を逆引きして Liquipedia 大会キーを解決する
- `live/[tournamentId]/page.tsx`: ヘッダー行にカウントダウンを追加。
  併せて、モード切替行の表示条件が `startggEventId` 前提だったため
  `liquipediaTournament` でも表示されるよう修正
- 同ヘッダーの `Phase: Unknown`（データ未取得時の無意味な表示）を非表示化

検証: 本番のトップ/ライブ両ページで「開始まで 43分 03秒 (7/29 20:00)」を確認。
実際の初戦は 2026-07-29 13:00 CEST（日本時間 20:00）。

### 追記 (同日) — BRACKET タブでも配信を止めない

#### 問題
`StreamCenter.tsx` が `{centerTab === 'stream' && (...)}` で配信ブロックごと
アンマウントしていた。iframe が DOM から消えるため BRACKET を開くたびに
Twitch の再生が完全に止まり、STREAM に戻しても停止状態から手動再生が必要だった。

#### 変更内容
- 配信ブロックを常時マウントに変更（チャンネル選択バーだけは STREAM タブ限定のまま）
- `centerTab === 'bracket'` のとき `.live-page` に `bracket-mini` を付与
- CSS で配信枠を畳み（`height/min-height/max-height/padding-bottom: 0`）、
  iframe だけをスクロール時と同じミニプレーヤー（PC 336x189 / モバイル 168x95）へ退避
- **DOM 移動も src 変更もせず CSS のみ**で切り替えるため再読込が起きない

#### 発生した問題と解決方法
- 問題1: ミニ化 CSS が効かず iframe が 0x0 になる
  - 原因: 計測時のブラウザが `innerWidth: 0` になっており、
    `@media (max-width: 768px)` の `position: absolute !important` が適用されていた
  - 解決: ビューポートを正しく設定して再検証。併せてモバイル用にも
    `!important` 付きのミニプレーヤー規則を追加（モバイルでも再生継続が必要なため）
- 問題2: モバイルで配信枠の跡地に大きな黒い余白が残る
  - 原因: モバイルCSSが `padding-bottom: 56.25%` で16:9を作っており、
    `height: 0` だけでは潰れない
  - 解決: `padding-bottom: 0 !important` を追加

検証: PC(1440x900)・モバイル(375x812) の双方で STREAM↔BRACKET を往復し、
**iframe 再読込 0回 / 同一ノード維持 / 常に画面内**を本番で確認。

### 追記 (同日) — H2H 自動検知が動作しない問題

#### 原因（2つ重なっていた）
1. `useAutoDetect(matches, eventId, ...)` の第2引数が `config.startggEventId` で、
   EWC本戦は start.gg を使わないため `undefined` → `if (!eventId) return` で
   **自動検知が丸ごと無効**になっていた
2. 仮に有効でも検出できない。Liquipedia は編集者が結果を入れるまで
   `live`/`completed` にならず、`completedAt` も実際の完了時刻ではなく**予定時刻**を
   入れているため、Branch1(live) も Branch2(直近5分の完了) も発火しない

#### 変更内容
- `useAutoDetect` の第2引数を `eventId: number | undefined` → `enabled: boolean` に変更。
  start.gg / Liquipedia どちらのソースでも有効化できるようにした
- 第4引数 `scheduleFallback` を追加し、**Branch 3: 予定時刻からの推定**を実装。
  開始時刻を過ぎた試合のうち最新のもの（無ければ直近の予定試合）を「今の試合」とする。
  start.gg 大会では従来どおり無効なので既存挙動に影響なし
- AUTO バナーの文言がソース非依存になるよう修正（従来は "start.gg" 固定）

検証: 本番で P1=Fuudo / P2=moke が自動選択され、H2H（1戦・過去対戦 BLINK RESPAWN 2025）
まで表示されることを確認。Liquipedia 上で開始済みの試合は 13:15 の Fuudo vs moke のみで、
推定結果と一致している。

### 追記 (同日) — UP NEXT が実際の進行順にならない問題

#### 症状
EWC のように「グループ順ではなく進行に応じて対戦順が決まる」大会で、
UP NEXT に Daigo vs Itabashi Zangief がずっと固定表示されていた。

#### 原因（2段構え）
1. `mergedPhases` は `if (startggEventId && ...)` の中でしか試合を持たない。
   Liquipedia 由来の大会は条件を満たさず**空**になる
2. そのため UP NEXT は最終フォールバック
   `startggMatches.filter(validMatch).slice(0, 8)` に落ちており、
   **API のフェーズ記載順そのまま**の先頭8件を出していた。
   Group AA の R1M1 は開始前から選手が確定しているため、
   実際の進行と無関係に常に先頭に来ていた

#### 変更内容
- フォールバック経路を進行状況ベースに変更。
  **進行中 → 予定時刻の早い順**で並べ、未消化が無ければ直近の結果を出す
- `toEntry` に `scheduledAt` を追加し、`mergedPhases` 経由の経路も同じ基準でソート
- `LiveStandings`: UP NEXT の各行に開始予定時刻を表示（進行順が動的なため
  「いつの試合か」が分からないと判断できない）
- `LiveStandings`: **「✔ 直近の結果」セクションを追加**（直近3件）。
  ユーザー要望どおり結果も併せて見えるようにした
- `NAME_MAP` に `'Chris Tatarian' → 'Chris T'` を追加
  （参加者表は ChrisT、ブラケット内は Chris Tatarian と表記が揺れていた）

検証(本番): UP NEXT が `20:15 Blaz vs gachikun` / `20:30 Booce vs Dual Kevin` と
実際の進行順になり、直近の結果に `Leshar 2-3 Xian` 等が表示されることを確認。
H2H も進行に追従して自動更新される。

### 未解決の課題
- **選手2名を新規/別名で解決**: `Shigematsu`(JP/Blanka) はDB未登録のため新規作成(id=27678)。
  `Booce_Lee` は既存 `Booce`(id=68, US/Terry, Liquipedia URL一致) にマッピング
- Liquipedia は**手動編集依存**のため反映が遅れる可能性がある。start.gg のような
  リアルタイム性は期待できない
- キャラクター情報は wikitext の `{{Chars|}}` が現時点で全て空。試合進行に伴い
  埋まる想定だが、埋まらない場合はキャラ統計が出ない
- 3位決定戦がコメントには存在するが Match ブロックが未定義（進行後に追加される可能性）

## 2026-08-17 — CEO 2026 データ整備 + 使用キャラ反映の全体修正

### CEO 2026 の取り込み
- DB(id=45) を start.gg と一致させた: エントラント1111 / セット2225 / 順位全件 / 賞金
- 賞金は start.gg に総額記載が無いため Liquipedia の確定額($16,250, 上位8名のみ)を採用。
  Liquipedia のキャラ記載が start.gg standings と一致することを検証した上で適用
- `end_date` を 08-16 → **08-17**(start.gg の実値)に修正。config の totalDays も 3→4

### 発見・修正したバグ（いずれも他大会にも影響する共通不具合）

#### 1. `import-sets.js` — 大規模大会でプールがサイレント欠落
- 症状: CEO2026 で 2225 セット中 1023 件しか取れず、Round1 の 64 プール中 25 プールで打ち切られていた
- 原因: `phaseGroups { nodes }` にページネーション指定が無く、start.gg 側が既定 25 件に切り詰めていた。
  **エラーも警告も出ず次フェーズへ進む**ため気付きにくい
- 修正: `phaseGroups(query: { page: 1, perPage: 100 })` + `pageInfo` を取得し、
  100 件を超える場合は警告を出すようにした

#### 2. `backfill-main-characters.js` — Supabase 1000件上限で集計が不完全
- 症状: 1189 件あるキャラ付きセットのうち 1000 件しか読めておらず、
  Evo 2026 / Blink Respawn 2026 の一部が集計から欠落（対象選手 257名しか見えていなかった）
- 原因: `.limit(100000)` は PostgREST の `db-max-rows=1000` により無効
- 修正: `.range()` によるページネーションに変更 → 1189件・305名を正しく集計

#### 3. `post-tournament-update.js` Step2 — Liquipedia が 403
- 症状: Liquipedia フォールバックが全 URL 候補で HTTP 403 になり機能していなかった
- 原因: generic な User-Agent で**生 HTML を直接取得**しており規約違反でブロックされていた
- 修正: liquipedia.net の URL を **MediaWiki API (`action=parse&prop=text`)** 呼び出しに変換し、
  規約準拠の User-Agent を使用。返る HTML は同じレンダリング結果のため後段の解析はそのまま動作

### 使用キャラが古いままだった問題（ユーザー指摘: ときどが Ken 表示）
- 直接原因: `backfill-main-characters.js` が大会後に実行されていなかった。
  ときどは Blink Respawn 2026(2026-06-05) で JP×8 のデータが**既にDBにあった**のに
  `main_character` は EWC2025(2025-08-20) の Ken のままだった
- 根本原因: **直近大会のキャラ充填率がほぼ 0%**
  （CEO2026 0/2225, EWC2026 0/66, EWC LCQ 0/595, BAM16 0/458, Evo2026 11/3404, CB2026 17/4391）。
  start.gg が games データを持たない大会が増えており、start.gg 依存では埋まらない
- 対応:
  1. 上記バグ2を修正のうえ `backfill-main-characters.js` を実行 → **238名を更新**
  2. Liquipedia には CEO2026 のキャラが 198 件あることを確認し、バグ3を修正して Step2 を実行
     → CEO2026 のキャラ **0 → 156 セット**
  3. 再度 main_character を再計算 → CEO2026 が最新出典として採用され、
     Top8 全員が Liquipedia 記載と一致（ときど=JP, Booce=Terry, Micky=Mai, kingsvega=Blanka 等）
- 検証: 本番の選手ページで ときど が **JP** 表示になることを確認

### 未解決の課題
- **運用フローが手動**: 大会終了後に `post-tournament-update.js` を実行する運用が徹底されておらず、
  今回の「キャラが古い」問題の直接原因になった。大会終了検知→自動実行の仕組みが望ましい
- start.gg のキャラ充填率低下は継続する見込み。Liquipedia フォールバックを標準手順にすべき
- CEO2026 のキャラは Top48 ブラケット分のみ(156/2225)。プール戦は Liquipedia にも無い
- CEO2026 で `winner_id` 未解決が 45 セット（1113名規模のため名寄せ漏れ）
- Liquipedia 側のキャラ表記 5 名が DB 未マッチ（Step2 実行時）

## 既知の問題
- Vercel GitHub自動デプロイが切断中 → 手動で npx vercel --prod --yes が必要
- 選手名フォントサイズ変更（16px）が反映されていない可能性 → デプロイ確認待ち
- キャラデータ充填率: Blink Respawn 64%、他大会も一部未充填

## 残タスク
- [ ] デモモード動作確認の仕上げ（BRACKETタブ、モード切替の安定性）
- [ ] 大会配信ページのデザイン仕上げ（v0.devプロトタイプ）
- [ ] 次のCPT大会の登録・準備
- [ ] Liquipediaソースの大会取込（EWC本大会等）
- [ ] CPTポイント対象者（Top24等）データ取得ロジック
- [ ] EWC出場権判定・表示の自動化
- [ ] players.main_character の継続バックフィル
- [ ] アルファ版公開準備
