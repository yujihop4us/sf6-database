# SF6 Stats — アーキテクチャ

## 技術スタック
- **フレームワーク**: Next.js (App Router)
- **ホスティング**: Vercel (Hobby Plan)
- **データベース**: Supabase (PostgreSQL)
- **データソース**: start.gg API, Liquipedia
- **配信**: Twitch Embed API

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx                      # トップページ
│   ├── tournament/[id]/page.tsx      # 大会結果ページ
│   ├── tournaments/page.tsx          # 大会一覧
│   ├── player/[id]/page.tsx          # 選手個別ページ
│   ├── live/[tournamentId]/
│   │   ├── page.tsx                  # 配信ページ（メイン）
│   │   └── tournamentConfig.ts       # 大会別設定
│   └── api/
│       ├── live-sets/                # ライブ試合データAPI
│       └── pools-dashboard/          # Pools進捗API
├── components/
│   ├── live/
│   │   ├── StreamCenter.tsx          # 配信+H2Hバー+ティッカー
│   │   ├── PlayerBand.tsx            # 左右選手パネル
│   │   ├── LiveStandings.tsx         # 順位表+UP NEXT
│   │   ├── LiveSetsTable.tsx         # 試合一覧（BRACKETタブ）
│   │   ├── PoolsDashboard.tsx        # Pools進捗ダッシュボード
│   │   └── SidePanelLeft.tsx         # チャットパネル
│   ├── tournament/
│   │   └── TournamentClient.tsx      # 大会結果クライアント
│   ├── home/HomeClient.tsx           # トップページクライアント
│   └── SiteNavbar.tsx                # グローバルナビ
├── hooks/
│   └── usePoolsDashboard.ts          # Pools/H2Hモード自動判定
├── lib/
│   └── utils.ts                      # isTournamentLive等ユーティリティ
└── scripts/
    ├── live-fetch-v2.js              # start.ggからセット取込
    ├── post-tournament-update.js     # キャラ・国旗バックフィル
    └── import-sets.js               # エントラント取込
```

## 配信ページ（/live/[tournamentId]）

### 2モード
- **H2Hモード**: PlayerBand(左) + StreamCenter(中央) + PlayerBand(右) の3カラム
- **Poolsモード**: StreamCenter(左上) + Chat(左下) + PoolsDashboard(右) の2カラム

### モード自動切替（usePoolsDashboard）
- start.gg APIから現在フェーズを取得（15秒ポーリング）
- currentPhase に "winners"/"losers"/"round" → Poolsモード
- "Top 24"/"Top 8" 等 → H2Hモード
- 大会終了後（endDate + 24h経過）→ 強制H2H、ポーリング停止

### モバイルレイアウト（≤768px）
- 配信+H2Hバー: 上部固定（flex-shrink:0）
- 下部コンテンツ: スクロール可能（flex:1, overflow-y:auto）
- PlayerBand/Chat: 非表示
- 100dvhでビューポート固定

### デモモード（/live/demo）
- tournamentConfig に isDemo:true
- モックデータ: DEMO_H2H, DEMO_POOLS_DATA, DEMO_SETS, DEMO_STARTGG_MATCHES
- H2H/Poolsの手動切替ボタンあり（本番はAUTOのみ）

## データフロー

### 大会データ取込
1. `live-fetch-v2.js` → start.gg GraphQL → tournament_sets テーブル
2. `post-tournament-update.js` → Liquipedia/start.gg → キャラ・国旗補填
3. `import-sets.js` → tournament_entrants テーブル

### リアルタイム更新（配信中）
1. `useStartggPolling` (page.tsx) → /api/live-sets → LiveStandings/LiveSetsTable
2. `useAutoDetect` → 進行中セットのP1/P2を自動検出 → H2Hバー表示
3. `usePoolsDashboard` → /api/pools-dashboard → モード自動切替

## slug規則
- 形式: `{大会名}-{年}` (例: `combo-breaker-2026`, `blink-respawn-2026`)
- 旧数値ID → SLUG_REDIRECTS で正規slugにリダイレクト
- デモ: `demo`

## デプロイ
- GitHub push → Vercel自動デプロイ（現在切断中）
- 手動: `npx vercel --prod --yes`
- Cron: 毎日2AM（Hobby Plan制限）
