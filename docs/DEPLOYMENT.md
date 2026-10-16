# Deployment Guide (Phase 15)

## Database — Supabase
1. Create a project at supabase.com.
2. SQL Editor -> paste and run `server/supabase/schema.sql`.
3. Project Settings -> API: copy the Project URL into `SUPABASE_URL` and the **service_role** key into `SUPABASE_SERVICE_ROLE_KEY` (host env vars only — never in the client or in git).

## File storage — Cloudinary
1. Create a free account, grab Cloud name / API key / API secret from the dashboard.
2. Fill `CLOUDINARY_*` vars in the server `.env`.

## Backend — any Node host (Render, Railway, Fly.io, etc.)
1. Push the `server/` folder as its own deploy (or point the host at the `server` subfolder).
2. Set environment variables from `.env.example` in the host's dashboard — never commit `.env`.
3. Build command: `npm install`. Start command: `npm start` (uses the included `Procfile` if the host supports it).
4. Run `npm run seed` once after first deploy to create the 8 community channels.
5. Note the deployed backend URL — you'll need it for `VITE_API_URL`.

## Frontend — Vercel
1. Import the `client/` folder as the project root in Vercel.
2. Framework preset: Vite.
3. Set `VITE_API_URL` env var to `https://your-backend-url/api`.
4. The included `vercel.json` handles client-side routing refreshes (React Router).

## After both are live
1. Update the backend's `CLIENT_URL` env var to your live Vercel URL (for CORS + Socket.IO).
2. Redeploy the backend so CORS picks up the change.
3. Do a full smoke test: register, login, apply, chat — using the checklist in TESTING.md against production URLs.
