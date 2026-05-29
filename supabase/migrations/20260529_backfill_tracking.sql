-- Backfill tracking columns
-- players: Liquipedia 確認済みタイムスタンプ（重複リクエスト防止）
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS liquipedia_checked_at TIMESTAMPTZ;

-- tournaments: Liquipedia URL（バックフィル用）
-- カラムは既に存在するが、念のため
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS liquipedia_url TEXT;

-- 各大会の Liquipedia URL を設定
UPDATE tournaments SET liquipedia_url = 'https://liquipedia.net/fighters/Combo_Breaker/2026/SF6'                       WHERE id = 48 AND liquipedia_url IS NULL;
UPDATE tournaments SET liquipedia_url = 'https://liquipedia.net/fighters/Evolution_Championship_Series/2026/Japan/SF6' WHERE id = 40 AND liquipedia_url IS NULL;
UPDATE tournaments SET liquipedia_url = 'https://liquipedia.net/fighters/DreamHack/2026/Atlanta/SF6'                   WHERE id = 47 AND liquipedia_url IS NULL;
UPDATE tournaments SET liquipedia_url = 'https://liquipedia.net/fighters/Evolution_Championship_Series/2025/SF6'       WHERE id = 12 AND liquipedia_url IS NULL;
UPDATE tournaments SET liquipedia_url = 'https://liquipedia.net/fighters/Combo_Breaker/2025/SF6'                       WHERE id = 21 AND liquipedia_url IS NULL;
UPDATE tournaments SET liquipedia_url = 'https://liquipedia.net/fighters/Evolution_Championship_Series/2025/Japan/SF6' WHERE id = 34 AND liquipedia_url IS NULL;
UPDATE tournaments SET liquipedia_url = 'https://liquipedia.net/fighters/Capcom_Cup/12'                                WHERE id = 9  AND liquipedia_url IS NULL;
UPDATE tournaments SET liquipedia_url = 'https://liquipedia.net/fighters/Capcom_Cup/11'                                WHERE id = 2  AND liquipedia_url IS NULL;
UPDATE tournaments SET liquipedia_url = 'https://liquipedia.net/fighters/Capcom_Cup/10'                                WHERE id = 37 AND liquipedia_url IS NULL;
UPDATE tournaments SET liquipedia_url = 'https://liquipedia.net/fighters/Esports_World_Cup/2024/SF6'                   WHERE id = 3  AND liquipedia_url IS NULL;
UPDATE tournaments SET liquipedia_url = 'https://liquipedia.net/fighters/Esports_World_Cup/2025/SF6'                   WHERE id = 5  AND liquipedia_url IS NULL;
