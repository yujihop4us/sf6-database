# SF6 STATS — 大会アーキテクチャ ブリーフィング
# 最終版: 2026-05-01

---

## 1. プロジェクトのビジョン

SF6 STATSは「選手のストーリーを伝えるサイト」である。
リアルタイムのスコア追跡サイトではない。
選手のバックストーリー、キャラクター性、選手間の因縁や物語を
視聴者に届けることで、大会観戦をより深く楽しめるようにする。

全ての機能設計・UI判断はこのビジョンに基づく。
「この機能はストーリーを伝えるか？」が常に判断基準。

---

## 2. スコープ: 全大会共通アーキテクチャ

このドキュメントで定義する機能と設計方針は、特定の大会に限らず
SF6 STATSがカバーする全ての大会に適用する。

- 初回の実装・検証: EVO Japan 2026（2026-05-01〜03、進行中）
- 本格運用開始: 次回以降の大会（CPT Super Premier、Topanga等）
- 設計原則: 全て大会非依存（tournament-agnostic）

EVO Japan 2026はライブ中の動作検証を兼ねる。
完璧を目指さず、できる範囲で段階的に適用し、
実装と検証を並行して進める。

---

## 3. 大会規模の参考値

| 大会                | エントリー数  | フェーズ数       |
|---------------------|-------------|----------------|
| CC11                | 48人        | グループ + Top16 |
| CC12                | 48人        | グループ + Top16 |
| CPT Super Premier   | 128〜256人  | Pools + Top32   |
| Topanga Championship| 16〜32人    | 総当たり + Top8  |
| EVO 2025 (Las Vegas)| 〜5,000人   | Pools多段 + Top8 |
| EVO Japan 2026      | 7,681人     | 6フェーズ(※)    |

※ EVO Japan 2026 SF6フェーズ構成（start.gg）:
  - Round 1: 512 pools（〜7,681人）
  - Round 2: 128 brackets（〜2,048人）
  - Round 3: 32 brackets（〜512人）
  - Round 4: 8 brackets（〜128人）
  - Semifinals: 1 bracket（Top 32相当）
  - Finals: 1 bracket（Top 8）

---

## 4. 既存の資産

- Supabase 選手DB: Tier S/A全選手のbio（日英）完了
- H2H検索機能: 実装済み・稼働中
- PlayerCardコンポーネント: 実装済み
- CC12トーナメントページ: ハードコード + /api/cc12/results ポーリング
- start.gg API連携: DreamHack Birminghamテンプレートで検証済み
- tournamentConfig['40']: EVO Japan 2026エントリー追加済み
- ライブページ（/live/[tournamentId]）: 基本シェル存在
  - Twitch埋め込み、LIVE POLL、選手選択UI
- 技術スタック: Next.js (App Router) / Supabase / start.gg API / Tailwind CSS

---

## 5. DB移行: tournamentConfig → Supabase

現在ハードコードされているtournamentConfigをDB化する。
新大会追加時にコードを触らなくて済むようにする。

### tournaments テーブル
| カラム              | 型        | 説明                                    |
|--------------------|-----------|-----------------------------------------|
| id                 | serial PK | 内部ID                                   |
| name               | text      | 大会名（例: "EVO Japan 2026"）             |
| slug               | text      | URLスラッグ（例: "evo-japan-2026"）         |
| start_date         | date      | 開始日                                    |
| end_date           | date      | 終了日                                    |
| location           | text      | 開催地                                    |
| entrant_count      | int       | エントリー数                               |
| startgg_event_id   | text      | start.gg のイベントID                      |
| startgg_slug       | text      | start.gg のトーナメントスラッグ              |
| stream_url         | text      | 配信URL（Twitch/YouTube）                  |
| stream_type        | text      | "twitch" / "youtube"                      |
| status             | text      | "upcoming" / "live" / "completed"          |
| bracket_threshold  | jsonb     | 表示モード閾値の上書き（任意）               |
| created_at         | timestamp | 作成日時                                   |

### tournament_phases テーブル
| カラム              | 型        | 説明                                    |
|--------------------|-----------|-----------------------------------------|
| id                 | serial PK | 内部ID                                   |
| tournament_id      | int FK    | tournaments.id                            |
| name               | text      | フェーズ名（例: "Round 1", "Finals"）       |
| phase_order        | int       | 表示順序                                   |
| phase_type         | text      | "pools" / "bracket" / "round_robin"       |
| startgg_phase_id   | text      | start.gg のフェーズID                      |
| bracket_count      | int       | このフェーズ内のブラケット数                 |
| entrant_count      | int       | このフェーズの参加者数                       |
| display_mode       | text      | "tree" / "table" / "search"（自動 or 手動）|
| status             | text      | "upcoming" / "active" / "completed"        |

### tournament_matches テーブル
| カラム              | 型        | 説明                                    |
|--------------------|-----------|-----------------------------------------|
| id                 | serial PK | 内部ID                                   |
| tournament_id      | int FK    | tournaments.id                            |
| phase_id           | int FK    | tournament_phases.id                      |
| round              | int       | ラウンド番号                               |
| round_name         | text      | 表示名（例: "Winners Semifinal"）           |
| player1_id         | int FK    | players.id（nullable: 未登録選手の場合）     |
| player1_tag        | text      | 選手タグ（start.ggから取得、常に保持）        |
| player1_seed       | int       | シード番号                                 |
| player2_id         | int FK    | players.id（nullable）                     |
| player2_tag        | text      | 選手タグ                                   |
| player2_seed       | int       | シード番号                                 |
| score1             | int       | P1スコア                                   |
| score2             | int       | P2スコア                                   |
| winner_id          | int FK    | players.id（nullable）                     |
| upset_factor       | int       | abs(勝者シード - 敗者シード)。大きいほど番狂わせ |
| is_upset           | boolean   | upset_factorが閾値以上ならtrue              |
| startgg_set_id     | text      | start.gg のセットID                        |
| completed_at       | timestamp | 試合完了日時                               |
| created_at         | timestamp | 作成日時                                   |

### インデックス
- tournament_matches: (tournament_id, phase_id)
- tournament_matches: (player1_id), (player2_id), (winner_id)
- tournament_matches: (tournament_id, is_upset) WHERE is_upset = true
- tournament_matches: (startgg_set_id) UNIQUE

---

## 6. Progressive Bracket — 大会規模に応じた自動スケーリング

### 表示モード閾値（デフォルト）

| 大会規模         | ブラケット表示方式                              | 対象例                |
|----------------|------------------------------------------|----------------------|
| 〜64人          | 全フェーズ ビジュアルブラケットツリー              | CC11, CC12            |
| 65〜256人       | Top 32〜 ブラケットツリー / 前段テーブル          | SFL決勝, Topanga      |
| 257〜1024人     | Top 8/32 ブラケットツリー / 前段テーブル+検索     | 中規模Premier         |
| 1025人〜        | Top 8/32 ブラケットツリー / 前段は検索ベースのみ   | EVO, EVO Japan       |

この閾値はtournamentsテーブルのbracket_thresholdで大会ごとに上書き可能。

### 各表示モードの仕様

**tree（ビジュアルブラケットツリー）**
- CC11/CC12で実装済みの形式
- Winners / Losers を左右または上下に分割
- 各試合ノードに選手名、スコア、キャラアイコン
- 対戦カードはクリッカブル（→ H2Hオーバーレイ）
- 選手名はクリッカブル（→ PlayerBioオーバーレイ）
- アップセット試合にはバッジ表示
- 同門/同国対決にはフラグ表示

**table（テーブル表示）**
- ブロックごとにグルーピング
- 各試合を行として表示（P1 vs P2、スコア、勝者ハイライト）
- ブロックヘッダーをクリック → 個別ブラケット展開
- 選手名・対戦カードのクリック動作はtreeと同一

**search（検索ベース）**
- 選手名入力フィールド（インクリメンタルサーチ）
- 検索結果: その選手のPool情報、現在ステータス、戦績一覧
- 「次の対戦相手」表示（対戦相手のプロフィールカード付き）
- 「Pool抜けまでの残り試合数」表示
- 選手名・対戦カードのクリック動作はtreeと同一

### 全モード共通インタラクション
- 選手名タップ → PlayerBioOverlay
- 対戦カードタップ → H2HOverlay
- アップセット → バッジ表示
- 同門/同国対決 → フラグ表示
- ジャーニーマップへの導線

---

## 7. ストーリー機能 — 汎用コンポーネント一覧

全て大会非依存。入力はstart.gg APIデータ + Supabase選手データ。

### 7-1. PlayerBioOverlay（即時着手）
- トリガー: ブラケット/テーブル/検索結果上の選手名タップ
- Supabase登録選手（Tier S/A）: フルバイオ、キャラ、チーム、国旗、ランク、写真
- 未登録選手: start.ggから取得（名前、国、シード、使用キャラ）
- 「この選手のジャーニーを見る」リンク → JourneyMap
- 既存PlayerCardコンポーネントを拡張して実装

### 7-2. H2HOverlay（即時着手）
- トリガー: 対戦カード（2選手間）タップ
- 既存H2H機能を呼び出し、オーバーレイとして表示
- 表示内容: 通算成績、直近の試合リスト、勝率バー
- 両選手がSupabase登録済みの場合のみ完全データ表示
- 片方が未登録の場合: 「データなし — 初対戦の可能性」と表示
- **最大の差別化ポイント: start.ggにもLiquipediaにもない**

### 7-3. JourneyMap（即時着手）
- 選手の「この大会での道のり」を自動生成
- データソース: tournament_matchesテーブル（start.gg APIから取り込み）
- 表示形式: タイムライン風の縦リスト
  - 各行: ラウンド名 / 対戦相手（名前+キャラ）/ スコア / W or L
  - 負けた試合はハイライト（Losers落ちポイント）
  - 対戦相手名はクリッカブル → PlayerBioOverlay
- 表示場所: PlayerBioOverlay内タブ or 専用モーダル
- 全てstart.gg APIデータから自動生成。手動入力不要。

### 7-4. UpsetTracker（高優先度）
- 番狂わせをリアルタイムで自動検出・表示
- 計算: tournament_matches.upset_factor = abs(勝者シード - 敗者シード)
- 閾値: upset_factor >= 大会エントリー数の10%（調整可能）
- 表示: ライブページ内の専用セクション or サイドパネル
  - 「今日の番狂わせ」タイムライン（新しい順）
  - 各行: 勝者名(シード) def. 敗者名(シード) / スコア / フェーズ
  - 勝者・敗者ともにクリッカブル → PlayerBioOverlay
- SNSシェアボタン（将来）

### 7-5. RivalryFlag（高優先度）
- 同門対決（同チーム）/ 同国対決の自動検出
- データソース: Supabase players テーブルの team, nationality カラム
- 対戦カード確定時に自動判定
- ブラケット/テーブル上の該当試合に視覚的バッジ
  - 同門: チームロゴ + "同門対決" ラベル
  - 同国: 国旗 + "同国対決" ラベル
- H2HOverlay内でも表示

### 7-6. CharacterDistribution（時間があれば）
- 各フェーズでのキャラ使用率推移
- Pools → Top 128 → Top 32 → Top 8 での分布変化を可視化
- 既存「キャラ」タブと連携
- 棒グラフ or サンキーダイアグラム

### 7-7. LiveRating（時間があれば）
- 大会内Elo変動のリアルタイム計算
- 「最もレーティングを上げた選手」ランキング
- 次回大会以降に持ち越し可

---

## 8. ライブページのデザイン修正

現状のライブページはデザインカンプと大きく乖離している。
以下の差分を修正する。

### Player Band（左右パネル）
- デザイン: #シード / 選手名 / キャラ名 / チーム名 / キャラウォーターマーク背景 / 大きなスコア数字
- 現状: 「P1選択」「P2選択」ボタンのみ
- 修正: 選手選択後にデザイン通りの情報を表示。バンド幅170px。
  選手未選択時も「P1選択」は残すが、デザインのカラー・レイアウトに合わせる

### Stream Center
- デザイン: LIVEバッジ / 視聴者数 / タイトル（"グランドファイナル - EVO 2025"） / 経過時間 / スコア表示 / H2Hバー / 直近10試合カラースクエア
- 現状: Twitch埋め込みのみ
- 修正: 全要素を実装。H2Hバーと10試合スクエアは選手選択後に表示。

### LIVE POLL
- デザイン: 選手名 / 国旗 / パーセンテージバー（緑/紫グラデーション） / 投票ボタン（緑/紫）
- 現状: P1/P2汎用名、カラーなし
- 修正: 選手選択と連動。カラーはデザイン準拠。

### 次の試合パネル
- デザイン: 時刻 / 国旗 / 選手名 / キャラバッジ × 3試合
- 現状: 「試合情報なし」
- 修正: start.gg APIまたは手動入力で次の配信試合を表示

### カラーテーマ（グローバル）
- デザイン: ダークネイビー背景 / 緑アクセント(#00ffb3系) / 紫サブアクセント / グロー効果
- 現状: 色味が薄くフラット。他のページも含め崩れている可能性
- 修正: Tailwind設定 or CSS変数を確認し、デザインカンプの色に統一
- **注意: ライブページだけでなく全ページの色味を確認すること**

---

## 9. 作業順序と進め方

### Phase 1: EVO Japan 2026 ライブ検証（5/1〜5/3）
できる範囲で段階的に適用。完璧は目指さない。

1. ライブページのカラー・レイアウトをデザインに近づける
2. start.gg API からEVO Japan SF6の結果データ取得を確認
3. Progressive Bracket の Top 8 ブラケットツリーを実装
4. 選手タップ → PlayerBioOverlay を接続（既存データ活用）
5. 対戦カードタップ → H2HOverlay を接続（既存機能活用）

### Phase 2: アーキテクチャ整備（EVO Japan 後）
1. tournamentConfig → Supabase DB移行
2. tournament_matches テーブル作成 + start.gg APIからの自動取り込み
3. Progressive Bracket の全モード（tree/table/search）実装
4. JourneyMap 自動生成
5. UpsetTracker
6. Pools検索UI

### Phase 3: ストーリー機能拡充
1. RivalryFlag（同門/同国対決）
2. CharacterDistribution（キャラ分布変動）
3. LiveRating（大会内レーティング）
4. SNSシェア機能

### Phase 4: 本格運用
- 次の大規模大会で全機能をライブ稼働
- フィードバック収集 → 改善サイクル

---

## 10. 成功の定義

- ブラケット上で選手をタップしたら、その選手のストーリーが分かる
- 対戦カードをタップしたら、2人の因縁が分かる
- 初めてSF6の大会を見る人が「この試合、見なきゃ」と思える
- 他のどのサイト（start.gg, Liquipedia, eventhubs）にもない体験
- 大会規模が48人でも7,681人でも、同じ品質の体験を提供できる
