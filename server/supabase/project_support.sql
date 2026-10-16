-- Project Support — migration (Xentwin Technologies only)
--
-- Run ONCE in the Supabase SQL Editor on your EXISTING project (after schema.sql).
-- Purely additive: it creates 3 new tables and widens the notifications.type
-- check by one value. No existing table/row/column is changed.
--
-- Requires helper functions already created by schema.sql:
--   set_updated_at(), prevent_org_change()

-- ---------------------------------------------------------------- requests

create table project_support_requests (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references users (id) on delete cascade,

  -- fixed to Xentwin Technologies (same pattern as internships / workshops)
  organization       text not null default 'Xentwin Technologies',
  org_label          text not null default 'Supported by Xentwin Technologies',

  title              text not null,
  description        text not null,
  domain             text not null,
  project_stage      text not null
                     check (project_stage in ('Idea', 'Prototype', 'MVP', 'Beta', 'Live')),
  support_type       text not null
                     check (support_type in ('Guidance', 'Investment', 'Both')),
  investment_required text,                       -- required by the API for Investment / Both
  demo_link          text check (demo_link is null or demo_link = '' or demo_link ~* '^https?://'),
  message            text,

  status             text not null default 'Pending'
                     check (status in ('Pending', 'In Review', 'Accepted', 'Rejected', 'Completed')),
  assigned_staff_id  uuid references users (id) on delete set null,

  guidance_feedback  text,                        -- staff: guidance / feedback for the student
  investment_notes   text,                        -- staff: investment decision / notes
  completed_at       timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index project_support_requests_student_idx on project_support_requests (student_id, created_at desc);
create index project_support_requests_status_idx  on project_support_requests (status, support_type);
create index project_support_requests_staff_idx   on project_support_requests (assigned_staff_id);

-- ---------------------------------------------------------------- conversation (student <-> staff)

create table project_support_messages (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references project_support_requests (id) on delete cascade,
  sender_id   uuid not null references users (id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index project_support_messages_request_idx on project_support_messages (request_id, created_at);

-- ---------------------------------------------------------------- request history (audit trail)

create table project_support_history (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references project_support_requests (id) on delete cascade,
  actor_id    uuid references users (id) on delete set null,
  action      text not null,          -- Submitted | Taken | Status Changed | Guidance Updated | Investment Notes Updated | Completed
  from_status text,
  to_status   text,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index project_support_history_request_idx on project_support_history (request_id, created_at);

-- ---------------------------------------------------------------- triggers

create trigger project_support_requests_set_updated_at before update on project_support_requests
  for each row execute function set_updated_at();
create trigger project_support_messages_set_updated_at before update on project_support_messages
  for each row execute function set_updated_at();
create trigger project_support_history_set_updated_at before update on project_support_history
  for each row execute function set_updated_at();
create trigger project_support_requests_org_immutable before update on project_support_requests
  for each row execute function prevent_org_change();

-- ---------------------------------------------------------------- row level security (same model as schema.sql)

alter table project_support_requests enable row level security;
alter table project_support_messages enable row level security;
alter table project_support_history  enable row level security;

-- ---------------------------------------------------------------- notifications: allow the new type

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check check (type in (
  'application_submitted', 'application_status_changed',
  'workshop_registration', 'event_registration',
  'hackathon_registration', 'announcement', 'community',
  'project_support'));
