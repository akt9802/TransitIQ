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
