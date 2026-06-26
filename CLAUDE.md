# SF6 Stats — Claude Code プロジェクト指示

## 開発ログルール（必須）
すべての作業完了時に `docs/DEVLOG.md` へ以下を追記すること：

### フォーマット
```markdown
## YYYY-MM-DD — 作業タイトル

### 変更内容
- 変更したファイルと内容の要約

### 発生した問題と解決方法
- 問題: （何が起きたか）
- 原因: （なぜ起きたか）
- 解決: （何をしたか）

### 未解決の課題
- （残っている問題があれば記載）
```

## コミットルール
- コミットメッセージは変更理由を明記（例: `fix: pools mode not activating due to Unknown phase fallback`）
- 1つの論理的変更ごとにコミット

## CSS 変更時の注意
- インラインスタイルは CSS クラスより優先度が高い — 重複に注意
- `!important` を使う前にインラインスタイルの削除を検討
- PC / モバイル / 中画面（769-1280px）の3パターンで確認

## デプロイ後の確認
- Vercel キャッシュ: `?v=N` 付きURLで確認
- 実機とDevToolsの表示は異なる場合がある — 実機を正とする

## ファイル構成メモ
- `src/app/live/[tournamentId]/page.tsx` — ライブページ本体（レイアウト・CSS）
- `src/components/live/StreamCenter.tsx` — 配信プレーヤー・H2Hバー
- `src/hooks/usePoolsDashboard.ts` — Pools モード判定・ポーリング
- `src/app/api/pools-dashboard/route.ts` — Pools API
- `src/app/live/[tournamentId]/tournamentConfig.ts` — 大会設定
- `docs/DEVLOG.md` — 開発ログ
- `docs/ARCHITECTURE.md` — アーキテクチャ概要
