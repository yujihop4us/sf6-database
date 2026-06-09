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
