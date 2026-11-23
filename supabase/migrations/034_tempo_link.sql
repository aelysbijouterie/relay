-- Liaison RELAYS ⇄ Tempo : une ligne par carte « opération commerciale » liée à une opération de Tempo.
create table if not exists tempo_links (
  task_id            uuid primary key references tasks(id) on delete cascade,
  tempo_operation_id text not null unique,
  conflict           text,          -- texte de dissonance de dates (NULL = d'accord)
  conflict_notified  text,          -- dissonance déjà signalée par e-mail (évite les doublons)
  pushed_state       text,          -- dernières dates RELAYS transmises à Tempo
  synced_at          timestamptz default now()
);

alter table tempo_links enable row level security;
revoke all on tempo_links from anon, authenticated;
