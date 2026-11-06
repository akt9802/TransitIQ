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

2. In `.env.local`:

   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/transitiq
   ```

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
