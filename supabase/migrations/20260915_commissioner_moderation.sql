alter table public.ranking_rounds
  add column if not exists voting_locked boolean not null default false;

create table if not exists public.round_voter_locks (
  round_id bigint not null references public.ranking_rounds(id) on delete cascade,
  voter_name text not null,
  locked_at timestamptz not null default now(),
  primary key (round_id, voter_name),
  constraint valid_locked_voter_name check (
    voter_name in ('Alex','Tommy','CK','JP','Stephen','Fedgi','Matty B','Will','Enzo','Maria','Marco','A Smokes')
  )
);

alter table public.round_voter_locks enable row level security;

grant select on table public.round_voter_locks to anon, authenticated;

create policy "public can read voter locks"
on public.round_voter_locks
for select
to anon, authenticated
using (true);

drop policy if exists "public can insert active week ballots" on public.tier_ballots;
drop policy if exists "public can update active week ballots" on public.tier_ballots;

create policy "public can insert active unlocked week ballots"
on public.tier_ballots
for insert
to anon, authenticated
with check (
  voter_name in ('Alex','Tommy','CK','JP','Stephen','Fedgi','Matty B','Will','Enzo','Maria','Marco','A Smokes')
  and not (assignments ? voter_name)
  and public.jsonb_key_count(assignments) = 11
  and exists (
    select 1
    from public.ranking_rounds r
    where r.id = tier_ballots.round_id
      and r.status = 'active'
      and r.voting_locked = false
  )
  and not exists (
    select 1
    from public.round_voter_locks l
    where l.round_id = tier_ballots.round_id
      and l.voter_name = tier_ballots.voter_name
  )
);

create policy "public can update active unlocked week ballots"
on public.tier_ballots
for update
to anon, authenticated
using (
  exists (
    select 1
    from public.ranking_rounds r
    where r.id = tier_ballots.round_id
      and r.status = 'active'
      and r.voting_locked = false
  )
  and not exists (
    select 1
    from public.round_voter_locks l
    where l.round_id = tier_ballots.round_id
      and l.voter_name = tier_ballots.voter_name
  )
)
with check (
  voter_name in ('Alex','Tommy','CK','JP','Stephen','Fedgi','Matty B','Will','Enzo','Maria','Marco','A Smokes')
  and not (assignments ? voter_name)
  and public.jsonb_key_count(assignments) = 11
  and exists (
    select 1
    from public.ranking_rounds r
    where r.id = tier_ballots.round_id
      and r.status = 'active'
      and r.voting_locked = false
  )
  and not exists (
    select 1
    from public.round_voter_locks l
    where l.round_id = tier_ballots.round_id
      and l.voter_name = tier_ballots.voter_name
  )
);
