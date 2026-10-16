# Security Checklist (Phase 13)

## Implemented in this codebase
- Passwords hashed with bcrypt (10 salt rounds), never stored or logged in plaintext
- JWT signed with `JWT_SECRET` from `.env`, 7-day expiry, verified on every protected route via `middleware/auth.js`
- Role enforcement happens in `middleware/role.js` on the **backend** — the frontend's `RoleRoute` only hides UI, it grants no access
- Role on registration is hard-coded to `"student"` server-side — the request body cannot set it
- No public staff registration endpoint exists at all
- CORS restricted to `CLIENT_URL` from `.env`
- Centralized error handler in `app.js` — never sends stack traces to the client
- File upload (`uploadRoutes.js`) validates MIME type and caps size at 5MB before hitting Cloudinary
- Postgres UNIQUE constraints prevent duplicate applications/registrations at the database level (not just app logic)
- Row Level Security is enabled on every table with no policies, so the public Supabase anon key can access nothing; only the backend (service_role key) reads/writes data
- `.env` is gitignored; `.env.example` ships with placeholders only

## Before going to production, also do
- [ ] Rotate `JWT_SECRET` to a long random value (not the placeholder)
- [ ] Set `NODE_ENV=production` and confirm no verbose errors leak
- [ ] Add rate limiting on `/api/auth/login` (e.g. `express-rate-limit`) to slow brute-force attempts
- [ ] Add input validation library (e.g. `express-validator`) for stricter field checks if you outgrow manual checks
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` is only set on the backend host (never in `client/`, never committed)
- [ ] In Supabase, confirm RLS shows as enabled on all tables (Table Editor / Authentication -> Policies)
- [ ] Confirm Cloudinary upload preset doesn't allow public unsigned uploads
