-- Community & Opportunities Platform — Supabase (Postgres) schema
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It is safe to run on an empty project. Re-running will fail on "already exists".
--
-- Access model: the Express API is the only thing that talks to the database, using
-- the service_role key (which bypasses Row Level Security). RLS is enabled on every
-- table with NO policies, so the public anon key can read/write nothing even though
-- Supabase exposes these tables over its REST API.

-- ---------------------------------------------------------------- helpers

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- organization / org_label were `immutable: true` in the Mongoose models.
create or replace function prevent_org_change() returns trigger
language plpgsql as $$
begin
  if new.organization is distinct from old.organization
     or new.org_label is distinct from old.org_label then
    raise exception 'organization and org_label are immutable';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- users

create table users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null unique check (email = lower(email)),
  password_hash text not null,
  role          text not null check (role in ('student', 'staff')),

  -- student-only profile fields
  phone         text,
  university    text,
  course        text,
  year          text,
  skills        text[] not null default '{}',
  resume_url    text,
  resume_name   text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index users_role_idx on users (role);

-- ---------------------------------------------------------------- opportunities

create table internships (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  organization     text not null default 'Xentwin Technologies',
  org_label        text not null default 'Offered by Xentwin Technologies',
  description      text not null,
  responsibilities text[] not null default '{}',
  required_skills  text[] not null default '{}',
  eligibility      text,
  duration         text,
  mode             text check (mode in ('Remote', 'On-site', 'Hybrid')),
  location         text,
  openings         integer default 1,
  deadline         timestamptz not null,
  created_by       uuid not null references users (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table workshops (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  organization          text not null default 'Xentwin Technologies',
  org_label             text not null default 'Conducted by Xentwin Technologies',
  description           text not null,
  date                  timestamptz not null,
  time                  text,
  instructor            text,
  mode                  text check (mode in ('Remote', 'On-site', 'Hybrid')),
  seats                 integer,
  registration_deadline timestamptz not null,
  poster_url            text,
  created_by            uuid not null references users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table events (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  organization          text not null default 'GenAura Technologies',
  org_label             text not null default 'Organized by GenAura Technologies',
  description           text not null,
  date                  timestamptz not null,
  time                  text,
  location              text,
  mode                  text check (mode in ('Remote', 'On-site', 'Hybrid')),
  capacity              integer,
  registration_deadline timestamptz not null,
  poster_url            text,
  created_by            uuid not null references users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table hackathons (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  organization          text not null default 'GenAura Technologies',
  org_label             text not null default 'Organized by GenAura Technologies',
  theme                 text,
  description           text not null,
  date                  timestamptz not null,
  registration_deadline timestamptz not null,
  team_size             text,
  -- legacy 'Remote' / 'On-site' are mapped to Online / Offline by the API (and by the migration script)
  mode                  text check (mode in ('Online', 'Offline', 'Hybrid')),
  venue                 text,
  meeting_link          text check (meeting_link is null or meeting_link = '' or meeting_link ~* '^https?://'),
  prize_info            text,
  rules                 text,
  eligibility           text,
  poster_url            text,
  created_by            uuid not null references users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------- applications & registrations

create table applications (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references users (id) on delete cascade,
  internship_id uuid not null references internships (id) on delete cascade,
  status        text not null default 'Applied'
                check (status in ('Applied', 'Under Review', 'Shortlisted', 'Selected', 'Rejected')),
  resume_url    text,
  resume_name   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (student_id, internship_id)          -- one application per student per internship
);
create index applications_internship_idx on applications (internship_id);

create table workshop_registrations (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references users (id) on delete cascade,
  workshop_id uuid not null references workshops (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (student_id, workshop_id)
);
create index workshop_registrations_workshop_idx on workshop_registrations (workshop_id);

create table event_registrations (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references users (id) on delete cascade,
  event_id   uuid not null references events (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, event_id)
);
create index event_registrations_event_idx on event_registrations (event_id);

create table hackathon_registrations (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references users (id) on delete cascade,
  hackathon_id        uuid not null references hackathons (id) on delete cascade,

  -- team details
  team_name           text not null,
  leader_name         text not null,
  leader_email        text not null,
  phone               text not null,
  team_members        text not null,
  college             text not null,

  -- project details
  project_title       text,
  project_description text,
  github_link         text,

  agreed_to_rules     boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (student_id, hackathon_id)
);
create index hackathon_registrations_hackathon_idx on hackathon_registrations (hackathon_id);

-- ---------------------------------------------------------------- community

create table channels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table messages (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels (id) on delete cascade,
  sender_id  uuid not null references users (id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index messages_channel_created_idx on messages (channel_id, created_at);

create table comments (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages (id) on delete cascade,   -- deleting a post removes its replies
  author_id  uuid not null references users (id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_message_created_idx on comments (message_id, created_at);

create table announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  created_by uuid not null references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  type       text not null check (type in (
               'application_submitted', 'application_status_changed',
               'workshop_registration', 'event_registration',
               'hackathon_registration', 'announcement', 'community')),
  message    text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_user_created_idx on notifications (user_id, created_at desc);

-- ---------------------------------------------------------------- triggers

do $$
declare t text;
begin
  foreach t in array array[
    'users', 'internships', 'workshops', 'events', 'hackathons',
    'applications', 'workshop_registrations', 'event_registrations',
    'hackathon_registrations', 'channels', 'messages', 'comments',
    'announcements', 'notifications'
  ] loop
    execute format(
      'create trigger %I before update on %I for each row execute function set_updated_at()',
      t || '_set_updated_at', t);
  end loop;

  foreach t in array array['internships', 'workshops', 'events', 'hackathons'] loop
    execute format(
      'create trigger %I before update on %I for each row execute function prevent_org_change()',
      t || '_org_immutable', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- row level security
-- Enabled with no policies = deny all for anon/authenticated. service_role bypasses RLS.

alter table users                   enable row level security;
alter table internships             enable row level security;
alter table workshops               enable row level security;
alter table events                  enable row level security;
alter table hackathons              enable row level security;
alter table applications            enable row level security;
alter table workshop_registrations  enable row level security;
alter table event_registrations     enable row level security;
alter table hackathon_registrations enable row level security;
alter table channels                enable row level security;
alter table messages                enable row level security;
alter table comments                enable row level security;
alter table announcements           enable row level security;
alter table notifications           enable row level security;
