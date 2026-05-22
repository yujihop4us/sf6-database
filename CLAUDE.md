# SF6 Database — Claude Code Instructions

## 技術スタック
Next.js (App Router) + Tailwind CSS + shadcn/ui + Supabase

## デザインシステム
- 背景: #0a0a0a（全体）、#1a1a2e（カード）
- アクセント: #00d4aa
- テキスト: #ffffff（メイン）、#9ca3af（サブ）

## コーディングルール
- App Router: src/app/ ディレクトリ
- Supabase クライアント: src/lib/supabase.ts
- 型定義: src/types/types.ts に集約
- キャラデータ: winner_character / loser_character 優先、
  なければ main_character フォールバック

## データ取得ルール
- start.gg 大会 → API から取得
- Liquipedia 大会 → API パース（30秒間隔、gzip必須）

## DB 設計の決定事項
- 賞金: tournament_entrants.prize_amount（新テーブル不要）
- 順位: tournament_entrants.placement
- キャラ: tournament_sets.winner_character / loser_character

## 参照ドキュメント
- PROGRESS.md → 進捗・フェーズ計画（Clover が管理）
- docs/player_bio_guide.md → 選手 Bio ライティングルール
- TASKS/phase1-tournament-page.md → Phase 1 実装指示書

## Supabase クライアントの使い分け
- `src/lib/supabase.ts` → anonキー。フロント・Server Component から使用
- `src/lib/supabase-server.ts` → service_role キー。管理スクリプト・API Route から使用
- scripts/ 内では dotenv + supabase-server.ts のパターンで統一

## スクリプト実行
- package.json に `"type": "module"` がないため、スクリプトは ESM 構文でも警告が出る
- 実行: `node --input-type=module` または `node scripts/xxx.js`（自動検出）
- 追加大会のセットインポート: `node scripts/import-sets.js <tournament-slug>`
- キャラ・賞金バックフィル: `node scripts/fetch-cc11-characters.js` / `node scripts/backfill-cc11-placements.js`

## 型定義の現状
- `src/types/types.ts` はまだ存在しない（目標は集約）
- 現在は各ページ配下に types.ts が分散（例: `src/app/tournament/[id]/types.ts`）

## ページ構成
- `/` → `src/app/page.tsx`（トップ）
- `/tournament/[id]` → Server Component + TournamentClient（worktree で開発中）
- `/live/[tournamentId]` → ライブ配信ダッシュボード
- API Routes: `src/app/api/` 以下

## docs/ ファイル
- `docs/player_bio_guide.md` → 選手 Bio 唯一の正式ガイド（v3.1・最新）。Bio 作成時は必ずこちらを参照
- `docs/player-bio-style-guide.md` → 旧版（v1.2）。参照不要

## ワークツリー運用
- 大会ページ (`/tournament/[id]`) は `.claude/worktrees/` で開発中
- 本体 `src/app/` にはまだマージされていない
- 新機能開発は worktree 内で行い、完成後に main へマージする

## 作業完了時
PROGRESS.md の「最新の作業ログ」セクションに今回の作業内容を追記すること。
