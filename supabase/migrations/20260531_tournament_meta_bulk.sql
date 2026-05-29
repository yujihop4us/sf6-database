-- ============================================================
-- Tournament meta bulk update
-- cpt_event_type / ewc_qualifying_spots / logo_url
-- ============================================================

-- EVO Japan 2026 (id=40) - CPT Premier, EWC 2枠
UPDATE tournaments SET
  cpt_event_type       = 'premier',
  ewc_qualifying_spots = 2
WHERE id = 40;

-- DreamHack Atlanta 2026 (id=47) - Road to EWC, EWC 2枠
UPDATE tournaments SET
  ewc_qualifying_spots = 2
WHERE id = 47;

-- EVO Japan 2025 (id=34)
UPDATE tournaments SET
  cpt_event_type = 'premier'
WHERE id = 34;

-- Evo 2025 (id=12)
UPDATE tournaments SET
  cpt_event_type = 'premier'
WHERE id = 12;

-- COMBO BREAKER 2025 (id=21)
UPDATE tournaments SET
  cpt_event_type = 'premier'
WHERE id = 21;

-- CAPCOM CUP X (id=37)
UPDATE tournaments SET
  cpt_event_type = 'capcom_cup'
WHERE id = 37;

-- ── Logo URLs (ローカルキャッシュ) ────────────────────────────────

UPDATE tournaments SET logo_url = '/images/tournaments/dreamhack-atlanta-2026.jpg' WHERE id = 47;
UPDATE tournaments SET logo_url = '/images/tournaments/evo-japan-2026.jpg'          WHERE id = 40;
UPDATE tournaments SET logo_url = '/images/tournaments/evo-2025.jpg'                WHERE id = 12;
UPDATE tournaments SET logo_url = '/images/tournaments/cb2025.png'                  WHERE id = 21;
UPDATE tournaments SET logo_url = '/images/tournaments/evo-japan-2025.jpg'          WHERE id = 34;
UPDATE tournaments SET logo_url = '/images/tournaments/capcom-cup-x.png'            WHERE id = 37;
