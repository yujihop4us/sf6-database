-- EWC出場権枠数カラムを追加
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS ewc_qualifying_spots INTEGER;

-- Combo Breaker 2026: XiaoHai（1位）・Hinao（2位）がEWC出場権獲得
UPDATE tournaments SET ewc_qualifying_spots = 2 WHERE id = 48;
