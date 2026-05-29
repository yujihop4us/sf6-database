-- Tournament logos and cpt_event_type updates
-- ロゴ画像のローカルキャッシュパスを設定
UPDATE tournaments SET logo_url = '/images/tournaments/capcom-cup-11.png' WHERE id = 2 AND logo_url IS NULL;
UPDATE tournaments SET logo_url = '/images/tournaments/capcom-cup-12.png' WHERE id = 9 AND logo_url IS NULL;
UPDATE tournaments SET logo_url = '/images/tournaments/ewc-2024.png'        WHERE id = 3 AND logo_url IS NULL;
UPDATE tournaments SET logo_url = '/images/tournaments/ewc-2025.png'        WHERE id = 5 AND logo_url IS NULL;
UPDATE tournaments SET logo_url = '/images/tournaments/dreamhack-birmingham-2026.jpg' WHERE id = 39 AND logo_url IS NULL;

-- CC11, CC12 を capcom_cup タイプに設定
UPDATE tournaments SET cpt_event_type = 'capcom_cup' WHERE id = 2;
UPDATE tournaments SET cpt_event_type = 'capcom_cup' WHERE id = 9;

-- EWC は CPT外のイベント → cpt_event_type = 'ewc'
UPDATE tournaments SET cpt_event_type = 'ewc' WHERE id IN (3, 5, 11);

-- DreamHack は Road to EWC → cpt_event_type = 'road_to_ewc'
UPDATE tournaments SET cpt_event_type = 'road_to_ewc' WHERE id IN (39, 47);
