-- Symptoms table for automatic tracking and follow-up
create table symptoms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  symptom_name text not null,
  first_reported_at timestamptz default now(),
  last_asked_at timestamptz,
  follow_up_due_at timestamptz,
  follow_up_count integer default 0,
  status text default 'active' check (status in ('active', 'resolved', 'worsening', 'monitoring')),
  resolved_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS policies
alter table symptoms enable row level security;

create policy "Users can view own symptoms"
  on symptoms for select
  using (auth.uid() = user_id);

create policy "Users can insert own symptoms"
  on symptoms for insert
  with check (auth.uid() = user_id);

create policy "Users can update own symptoms"
  on symptoms for update
  using (auth.uid() = user_id);

-- Add symptom alerts toggle to notification preferences
alter table notification_preferences
add column if not exists symptom_alerts_enabled boolean default false;
