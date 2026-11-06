# TransitIQ

Marketing site for TransitIQ: what the product is, a Google Maps corridor preview, and pricing.

```bash
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and enable Maps JavaScript API for that key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Styling is **Tailwind CSS v4** only (`app/globals.css` imports `tailwindcss` and theme tokens).
- The map reads **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** from `.env.local`.
- The fleet dashboard UI was removed for now; product spec remains in `Docs/first.md`.

## PostgreSQL

This app can talk to **Postgres** from **Route Handlers** or **Server Actions** using the [`pg`](https://node-postgres.com/) pool in `lib/db.ts`.

1. Run Postgres locally (Docker example):

   ```bash
   docker run --name transitiq-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=transitiq -p 5432:5432 -d postgres:16
   ```

2. In `.env.local`, set **`DATABASE_URL`** OR **`SUPABASE_DB_PASSWORD`** + **`NEXT_PUBLIC_SUPABASE_URL`**:

   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/transitiq
   # Supabase: copy URI from Project Settings → Database, or set SUPABASE_DB_PASSWORD only (see .env.example)
   ```

If you see **`getaddrinfo ENOTFOUND db.<ref>.supabase.co`**, that host is often **IPv6-only**; set **`SUPABASE_DB_REGION`** (and **`SUPABASE_POOLER_HOST`** from **Connect**) so the app uses Supabase’s **IPv4 session pooler**, or paste the **pooler** URI from **Connect**.

If you see **`tenant/user postgres.<ref> not found`**, the pooler **region or cluster index is wrong** (`ap-south-1` vs `ap-southeast-1`, `aws-0` vs `aws-1`). Copy the host from the dashboard — do not compose it.

Passwords with **`%`** in `DATABASE_URL` must use **`%25`** (or use **`SUPABASE_DB_PASSWORD`** only — we URL-encode it).

3. After `npm run dev`, open [http://localhost:3000/api/health/db](http://localhost:3000/api/health/db) — you should see `{ "ok": true, "version": "..." }`.

For **migrations and schemas**, add **Drizzle ORM** or **Prisma** next; the pool in `lib/db.ts` is a thin starting point until you choose one.

## Supabase (optional)

Installed: `@supabase/supabase-js`, `@supabase/ssr`.

1. Add to `.env.local` (from [Supabase dashboard](https://supabase.com/dashboard/project/_/settings/api) → **Project URL** and **anon public** / publishable key):

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

2. Helpers:

   - **Server:** `import { createClient } from "@/utils/supabase/server"` then `const supabase = await createClient()`
   - **Browser:** `import { createClient } from "@/utils/supabase/client"` then `createClient()`

3. **Session refresh:** root `middleware.ts` calls `updateSession` so auth cookies stay fresh.

4. **Example route:** [`/supabase-example`](http://localhost:3000/supabase-example) — tries `from('todos').select()`; create that table or you’ll see an error message.

If you pasted project keys in chat elsewhere, **rotate** them in Supabase (Settings → API → reset).

## Fleet owner auth (OTP + password)

Requires **`DATABASE_URL`** (Postgres — use Supabase **Database → Connection string → URI** with your DB password).

1. Set **`JWT_SECRET`** to a long random string in `.env.local`.
2. Set **SMTP_**\* variables for Brevo (or another SMTP provider).
3. Visit [http://localhost:3000/login](http://localhost:3000/login):
   - **New user:** email → 6-digit OTP (email) → set password (bcrypt in DB) → session cookie.
   - **Returning:** “Sign in with password” or use the last step with email + password.

Tables are created automatically on first use: `fleet_users`, `email_otps` (see `lib/auth/schema.ts`).

**API:** `POST /api/auth/request-otp`, `verify-otp`, `set-password`, `login`, `logout` — `GET /api/auth/me` for current user (JWT cookie).

Rotate **Brevo SMTP** and **JWT** secrets if they were ever shared or committed.
