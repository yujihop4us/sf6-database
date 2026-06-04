-- Blink Respawn 2026 (id=43) の設定を更新
UPDATE tournaments SET
  slug                  = 'blink-respawn-2026',
  startgg_slug          = 'blink-respawn-2026',
  startgg_tournament_id = 869254,
  startgg_event_id      = 1537500,
  cpt_event_type        = 'premier',
  ewc_qualifying_spots  = 2,
  stream_url            = 'https://www.twitch.tv/blinkesportsrd',
  liquipedia_url        = 'https://liquipedia.net/fighters/Blink_Respawn/2026/SF6',
  logo_url              = '/images/tournaments/blink-respawn-2026.jpg'
WHERE id = 43;
