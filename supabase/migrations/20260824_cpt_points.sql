-- 大会サーキットポイント（CPT / EWC）を格納する。
--
-- circuit は日付から推測しないこと。
-- Capcom Cup 12 は 2026年3月開催だが CPT2025 シーズンの決勝であり、
-- 暦年でシーズンを割ると誤る。Liquipedia の infobox `|circuit=` と
-- 賞金表テンプレートの `points=cpt2026` / `points=ewc2026` から取得する。
--
-- CPT と EWC は別サーキットのため合算しない。circuit の接頭辞で分離して集計する。

create table if not exists cpt_points (
  id            bigint generated always as identity primary key,
  player_id     bigint not null references players(id) on delete cascade,
  tournament_id bigint not null references tournaments(id) on delete cascade,
  circuit       text   not null,   -- 'cpt2024' | 'cpt2025' | 'cpt2026' | 'ewc2026' 等
  points        int    not null,
  placement     int,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  -- 再実行を冪等にするための一意制約（upsert の onConflict に使う）
  unique (player_id, tournament_id, circuit)
);

create index if not exists cpt_points_player_idx     on cpt_points (player_id);
create index if not exists cpt_points_circuit_idx    on cpt_points (circuit);
create index if not exists cpt_points_tournament_idx on cpt_points (tournament_id);

-- 選手ページは anon キーで読むため参照のみ許可する
alter table cpt_points enable row level security;

drop policy if exists "cpt_points_read" on cpt_points;
create policy "cpt_points_read" on cpt_points
  for select using (true);
