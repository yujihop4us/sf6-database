-- 修正1: CPT 2025 Premier大会の ewc_qualifying_spots 設定
-- EWC 2025は各CPT Premier大会から2枠出場権が付与された
UPDATE tournaments SET ewc_qualifying_spots = 2 WHERE id = 34;  -- EVO Japan 2025
UPDATE tournaments SET ewc_qualifying_spots = 2 WHERE id = 21;  -- Combo Breaker 2025
UPDATE tournaments SET ewc_qualifying_spots = 2 WHERE id = 12;  -- Evo 2025

-- CC11/CC12はEWC出場権なし（Capcom Cup自体がシーズン最終大会）
-- EWC 2025 / EWC 2026 も ewc_qualifying_spots は不要（自分がEWC本体）

-- EVO Japan 2026のstartgg_slugを設定（standings取得済み）
UPDATE tournaments SET startgg_slug = 'evo-japan-2026' WHERE id = 40 AND startgg_slug IS NULL;
