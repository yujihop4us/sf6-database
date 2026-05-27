-- ============================================================
-- SF6 Database: Pools seed + pool_identifier columns
-- Created: 2026-05-26
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================================
-- Purpose:
--   pool_identifier: phaseGroup.displayIdentifier から取得 (例: "A101")
--   winner_seed:     試合勝者の initialSeedNum (UPSET 検知用)
--   loser_seed:      試合敗者の initialSeedNum (UPSET 検知用)
-- ============================================================

ALTER TABLE tournament_sets
  ADD COLUMN IF NOT EXISTS pool_identifier TEXT,
  ADD COLUMN IF NOT EXISTS winner_seed     INTEGER,
  ADD COLUMN IF NOT EXISTS loser_seed      INTEGER;

-- pool × tournament でのフィルタリング / グループ化に使うインデックス
CREATE INDEX IF NOT EXISTS idx_ts_pool
  ON tournament_sets(tournament_id, pool_identifier);

-- seed での絞り込み (UPSET 検知クエリ用)
CREATE INDEX IF NOT EXISTS idx_ts_seeds
  ON tournament_sets(tournament_id, winner_seed, loser_seed)
  WHERE winner_seed IS NOT NULL AND loser_seed IS NOT NULL;
