# Community & Opportunities Platform

Full-stack React + Express + Supabase app for a focused student opportunity-management platform: students discover
internships/workshops (offered by **Xentwin Technology**) and events/hackathons (organized by
**Genaura Technologies**), apply/register, track progress, get notified, and use a basic
community — while staff manage students, opportunities, applications, registrations and
announcements.

## Stack
React + Vite + React Router · Node/Express REST API · Supabase (Postgres) · JWT + bcrypt · Socket.IO (basic community chat) · Cloudinary

## Local setup

### Server
```
cd server
cp .env.example .env      # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, CLOUDINARY_*
npm install                # Node 20+
# In the Supabase dashboard: SQL Editor -> run server/supabase/schema.sql (once)
npm run seed               # creates the 8 community channels (run once)
npm run dev                 # http://localhost:5000/api/health
```

### Client
```
cd client
cp .env.example .env       # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                 # http://localhost:5173
```

### First staff account
There is no public staff registration by design. Create one with the included script:
```
cd server
node createStaffUser.js staff@example.com yourPassword123
```

### Migrating existing MongoDB data (optional)
If you have data in the old MongoDB database, `server/scripts/migrateMongoToSupabase.js` copies it
into Supabase (new UUIDs, references rewritten). See the comment at the top of that file. Users
will need to log in again afterwards.

## Docs
- `docs/postman_collection.json` — import into Postman
- `docs/SECURITY.md` — security checklist
- `docs/TESTING.md` — manual test checklist
- `docs/DEPLOYMENT.md` — Vercel + backend host + Atlas + Cloudinary

## What V1 includes

**Roles:** only `student` and `staff` (no admin/moderator). Students self-register (role is
always forced server-side); staff accounts are created manually, never via public signup.

**Opportunities:** unified `/student/opportunities` page searches and filters across
internships, workshops, events and hackathons at once (`GET /api/opportunities?search=&type=&organization=`),
while each type also keeps its own dedicated browse/manage pages and its own DB collection.
Invalid org/type combinations (e.g. Xentwin + hackathon) are blocked in both the API and the
filter UI.

**Applications:** Applied → Under Review → Shortlisted → Selected/Rejected, with a visual
timeline per application (`My Applications`, tabbed by status) and a status-change
notification to the student. Duplicate applications are blocked (unique DB index + 409).

**Registrations:** workshops/events/hackathons — duplicate-safe registration, a confirmation
notification, and a staff-side "Registrations" view per opportunity showing who signed up.

**Student dashboard:** active applications, upcoming registered activities, recent
notifications, and recently added opportunities (no AI — simple "recently added" logic per
the MVP spec).

**Staff analytics** (`/staff/analytics`): applications by month, status breakdown, popular
opportunities, registrations by type, organization activity — plain grouped bars, no charting
library, no BI system.

**Community (scope-reduced per MVP spec):** 8 fixed channels, basic posts via Socket.IO
(kept from the original build — see note below), comments/replies on each post (plain REST,
not real-time), announcements, and basic staff moderation (remove any post or reply, create
new channels). No presence/typing indicators, no DMs, no advanced moderation.

**Resume:** upload/replace via Cloudinary, PDF/Word only, 5MB limit, URL/metadata only in
the database (no binary storage).

**Security:** bcrypt password hashing, JWT auth, `requireRole()` middleware returns 403 (not
just hidden UI), org fields are immutable at the DB level (trigger), no secrets in source.

## A note on Socket.IO

The original project already had a working Socket.IO channel chat (join/leave channel rooms,
send/receive messages, no presence or typing indicators — i.e. not a full Slack clone to begin
with). The MVP spec says not to prioritize real-time chat for V1 and to defer it if removing it
is safe. Here, posting a message has no REST endpoint — Socket.IO is the only way messages are
created — so removing it outright would break basic posting rather than simplify it. It's kept
as-is for V1. Comments/replies (the new addition) intentionally use plain REST instead of
sockets, so the "advanced real-time" surface hasn't grown.

## Version 2 / Future (documented, not built)
- AI internship recommendations, resume analysis, skill matching, chatbot
- Presence/typing indicators, direct messages, advanced moderation tooling
- Email/push notifications
- Certificates, attendance management, hackathon leaderboards
- Advanced analytics (beyond the current simple bar breakdowns)
- Mobile application

## Phase status
| Area | Status |
|---|---|
| Auth & role enforcement | Done |
| Unified Opportunities page (search/filter) | Done |
| Internships (student + staff) | Done |
| Workshops (student + staff) | Done |
| Events (student + staff) | Done |
| Hackathons (student + staff) | Done |
| Applications + status timeline | Done |
| Registrations (workshop/event/hackathon) + staff view | Done |
| Student dashboard (active/upcoming/notifications/recent) | Done |
| Staff dashboard | Done |
| Staff analytics | Done |
| Notifications (applications, registrations, announcements) | Done |
| Resume upload/replace | Done |
| Community — channels, posts, replies, moderation | Done |
| Profile (student) | Done |
| Responsive layout (sidebar → row, tables → cards) | Done |
| API testing | Postman collection provided |
| Security | Implemented + checklist in docs/SECURITY.md |
| Deployment | Configs + guide in docs/DEPLOYMENT.md |

## Known gaps / not built
- Staff "Student Details" single-page view (backend route `GET /api/users/students/:id`
  already returns student + their applications — just needs a details page/link from the
  Students table)
- Staff Settings/profile page (not in the original nav; the student Profile page pattern can
  be copied if needed)
- No automated test suite (manual checklist only, in `docs/TESTING.md`)
