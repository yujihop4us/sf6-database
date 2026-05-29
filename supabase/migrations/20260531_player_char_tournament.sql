-- players テーブルに main_character の出典大会IDを記録するカラムを追加
-- 新しい大会のデータで main_character を上書きする際に使用
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS main_character_tournament_id INTEGER
    REFERENCES tournaments(id) ON DELETE SET NULL;
