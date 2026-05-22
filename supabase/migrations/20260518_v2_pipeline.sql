-- ============================================================
-- SF6 Database: Match Data Pipeline v2
-- Created: 2026-05-18
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1) tournament_sets: v2 カラム追加
ALTER TABLE tournament_sets
  ADD COLUMN IF NOT EXISTS state           INTEGER     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at_sg   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stream_name     TEXT,
  ADD COLUMN IF NOT EXISTS station_number  INTEGER,
  ADD COLUMN IF NOT EXISTS characters      JSONB,
  ADD COLUMN IF NOT EXISTS full_round_text TEXT,
  ADD COLUMN IF NOT EXISTS p1_player_id    BIGINT,
  ADD COLUMN IF NOT EXISTS p2_player_id    BIGINT,
  ADD COLUMN IF NOT EXISTS p1_name         TEXT,
  ADD COLUMN IF NOT EXISTS p2_name         TEXT;

CREATE INDEX IF NOT EXISTS idx_ts_state
  ON tournament_sets(state);
CREATE INDEX IF NOT EXISTS idx_ts_updated_sg
  ON tournament_sets(updated_at_sg DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ts_p1p2
  ON tournament_sets(p1_player_id, p2_player_id);

-- 2) stream_queue_cache: 新規作成
CREATE TABLE IF NOT EXISTS stream_queue_cache (
  tournament_slug  TEXT        PRIMARY KEY,
  current_set      JSONB,
  next_sets        JSONB       DEFAULT '[]'::jsonb,
  stream_name      TEXT,
  stream_source    TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 3) h2h_records: startgg_set_id / characters 追加
ALTER TABLE h2h_records
  ADD COLUMN IF NOT EXISTS startgg_set_id TEXT,
  ADD COLUMN IF NOT EXISTS characters     JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_h2h_startgg_set
  ON h2h_records(startgg_set_id)
  WHERE startgg_set_id IS NOT NULL;
