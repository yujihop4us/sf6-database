-- ============================================================
-- SF6 Database: Tournament metadata columns
-- Created: 2026-05-28
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================================
-- Purpose:
--   logo_url:              大会ロゴ画像 URL（ヒーローバナー背景に薄く表示）
--   prize_pool:            賞金総額 USD
--   cpt_event_type:        'premier' | 'world_warrior' | NULL
--   final_pool_identifier: Top 8 ブラケットの pool_identifier (例: 'VVX15')
--   top24_pool_identifier: Top 24 ブラケットの pool_identifier (例: 'PX133')
-- ============================================================

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS logo_url              TEXT,
  ADD COLUMN IF NOT EXISTS prize_pool            DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS cpt_event_type        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS final_pool_identifier VARCHAR(50),
  ADD COLUMN IF NOT EXISTS top24_pool_identifier VARCHAR(50);

-- CB2026 (id=48) データ
UPDATE tournaments SET
  logo_url              = 'https://images.start.gg/images/tournament/865009/image-90c9ca5c83b44e166923f4864c43d731.jpg',
  prize_pool            = 19720.00,
  cpt_event_type        = 'premier',
  final_pool_identifier = 'VVX15',
  top24_pool_identifier = 'PX133'
WHERE id = 48;

-- ロゴURLをローカルパスに更新（public/images/tournaments/ にキャッシュ済み）
UPDATE tournaments SET logo_url = '/images/tournaments/cb2026.jpg' WHERE id = 48;
