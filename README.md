# Songa Logistics — We move what matters.

Kenya-first delivery company across **Nairobi, Mombasa and Kisumu**, focused on four
verticals: **medical courier, food delivery, groceries & shopping, and e-commerce parcel
deliveries**. Built with **Next.js App Router, TypeScript, Drizzle ORM, PostgreSQL
(embedded PGlite by default) and Tailwind CSS**. Money is always integer KES. Times are
Africa/Nairobi.

> Functional demo: all catalogue, basket, checkout, tracking, parcel, merchant, courier and HQ
> flows below are real and database-backed. The catalogue, photos, reviews and riders are
> **fictional samples** until real partners join.

## Quick start

Prerequisites: Node 20+ and `pnpm` (npm works too, if your registry is reachable).

```bash
cp .env.example .env.local   # optional — sensible defaults work out of the box
pnpm install
pnpm dev                     # → http://localhost:3000
```

First load runs the SQL migrations (`drizzle/0001_init.sql` → `0003_categories.sql`) and seeds
demo partners (11 merchants across the four verticals, promos `KARIBU10` / `LUNCH150` /
`SWEET20`, 4 riders). Data lives in `data/pgdata` (embedded Postgres — no Docker needed).

```bash
pnpm test          # unit tests: pricing, validation, state machines, reviews
pnpm typecheck     # tsc --noEmit
pnpm build         # production build check
BASE_URL=http://localhost:3000 pnpm test:api   # API integration tests (needs dev server)
```

## Deploying to production (Vercel + hosted Postgres)

The app runs anywhere Node does, but the supported path is Vercel + Neon:

1. **Database** — create a Postgres database (Neon free tier works). Copy the **pooled**
   connection string (PgBouncer) for serverless use.
2. **Vercel** — import the repo, then set environment variables:
   | Variable | Required | Notes |
   |---|---|---|
   | `DATABASE_URL` | Yes | Pooled hosted-Postgres URL. Without it the app uses embedded PGlite, which has no persistent disk on serverless and refuses to boot on Vercel. |
   | `SESSION_SECRET` | Yes | Long random string (`openssl rand -base64 48`). The app throws at runtime without it in production. |
   | `NEXT_PUBLIC_WHATSAPP` / `NEXT_PUBLIC_SUPPORT_PHONE` | No | Support contacts in footer + `/support`. |
   | `MPESA_*` | Later | Leave unset until Daraja go-live (see table below). |
3. **Deploy.** On first boot the app auto-applies `drizzle/*.sql` (tracked in
   `schema_migrations`) — no manual migration step. **Demo seed data is never inserted in
   production** (`NODE_ENV=production`); onboard real shops/riders via `/partner` + HQ.
4. **Verify:** `GET /api/health` returns `{ status: "ok", db: "hosted" }`. Pushes to `main`
   run typecheck, unit tests, lint and build in GitHub Actions (`.github/workflows/ci.yml`).

Local dev keeps working with zero config: no `DATABASE_URL` means embedded PGlite + demo seed.

## What works today (all backed by Postgres)

- **Discovery:** city switcher (Nairobi/Mombasa/Kisumu), live search across shops + dishes,
  category/fee/rating/open filters, sorting, collections (Quick lunch, Market run, Medical
  courier, Highly rated), saved shops (♥), empty states with next steps.
- **Storefront:** real open/closed status, fees/minimums, sections, stock flags, dietary/allergen
  notes, required/optional modifier groups with **server-side repricing**, customer reviews.
- **Basket → checkout:** single-merchant basket with replace confirmation, free-delivery progress,
  validated address + `07…/01…/+254…` phones, itemised totals, promo codes, tips, scheduled orders
  (90-min cut-off). Order refs look like `SG-XXXXXX`. Order creation is **transactional +
  idempotent** (Idempotency-Key): atomic conditional stock decrements (no oversell), atomic
  promo-use guard, immutable item snapshots, payment intents. Invalid phone/stock/promo/cross-city
  fail gracefully.
- **Tracking:** high-entropy token link (`/track/…`), real status history
  (`placed → accepted → preparing → ready → picked up → on the way → delivered`),
  customer cancellation with exactly-once stock restore, live polling, post-delivery star ratings.
  SMS updates go to the order phone on placed/accepted/on-the-way/delivered/cancelled
  (provider-gated; the tracking page shows the masked number).
- **E-commerce parcels:** prohibited-items acknowledgement, server-side estimate (never a guaranteed
  quote), 20 kg cap, pickup-confirmation step, rider assignment, tracking + history. Built for
  online sellers and personal sends alike.
- **Online M-Pesa:** with credentials, checkout sends a Daraja STK prompt after the order commits,
  stores the `CheckoutRequestID` on the payment intent, and marks paid only on a verified callback
  (amount-checked, exactly-once, order payment synced). Expired prompts can be resent from the
  tracking page (max 3 per 10 minutes); stale callbacks can't complete after a resend.
- **Medical courier:** pharmacy-essentials catalogue with sealed, priority handling; prescription
  orders are verified with a pharmacist by phone before dispatch (see `/support` policy).
- **Merchant console** (`/merchant`): order queue with legal transitions, menu CRUD,
  pause/unpause, price/stock edits, shop open-hours/fees/prep-time.
- **Courier workspace** (`/courier`): online toggle, assigned jobs only (customer phones stay
  masked elsewhere), accept→deliver steps, proof-of-delivery note, per-drop earnings estimate.
- **Operations HQ** (`/hq`): live overview, order/parcel dispatch with rider assignment and
  per-rider workload, merchant approval + catalogue moderation, promo management with on/off
  toggles, partner-lead inbox, audit trail for every money/status change.
- **Partners** (`/partner`): kitchens, markets/shops, pharmacies, online sellers and riders —
  enquiries surface in HQ.

## What needs credentials before public launch

| Service | Status | To switch on |
|---|---|---|
| Online M-Pesa (Daraja STK) | **Implemented, needs credentials** — without them checkout offers *cash* + *M-Pesa on delivery* only | Sandbox: app + shortcode at developer.safaricom.co.ke, set `MPESA_*` with `MPESA_ENV=sandbox`; go-live: flip to `production` with live shortcode/passkey and an HTTPS `MPESA_CALLBACK_URL` |
| Maps / GPS | **Off** — ETAs are labelled estimates; no live rider map | Plug a maps provider into tracking + dispatch |
| SMS/WhatsApp | **SMS implemented, needs provider** — status texts via Africa's Talking once `SMS_ENABLED=true` (+ key/username); skipped silently until then | WhatsApp templates later |
| Identity verification | **Phone OTP + staff passwords** — riders/customers sign in with a 6-digit SMS code, staff with scrypt-hashed passwords (see below) | Federated SSO later; rider KYC checks before go-live |
| Managed Postgres | Embedded PGlite by default | Set `DATABASE_URL` (see Deploying above); schema auto-migrates on boot |

Demo auth is intentionally passwordless so reviewers can tour every workspace; every
staff action is still role-checked server-side and audit-logged.

## Sign-in: OTP + staff passwords

- **Riders & customers** (`/login`): enter a Kenyan mobile number, receive a 6-digit code,
  verify within 10 minutes. Codes are single-use, hashed at rest, locked after 5 wrong tries,
  and rate-limited. Riders must already exist in HQ (onboarded + verified); customers get
  cross-device order history (`/api/me/orders`) on their verified number.
- **Staff** (ops + merchants): password login (`POST /api/auth/staff`, scrypt-hashed,
  10+ char policy, brute-force rate limits). Create logins with:
  ```bash
  npx tsx scripts/create-staff.ts --role ops --name "HQ Admin" --phone 0712345678 --password '…'
  npx tsx scripts/create-staff.ts --role merchant --merchant-id <uuid> --name "Shop Owner" --phone 0712… --password '…'
  ```
- **Demo picker** (passwordless role switcher) renders only in non-production builds, and
  `POST /api/auth` demo logins are rejected with 403 in production.
- **SMS** is provider-gated (`lib/sms.ts`, same pattern as M-Pesa): until `SMS_ENABLED=true`
  with credentials, codes are logged server-side and returned as `demoCode` outside production.
  Set `SMS_ENABLED` / `SMS_API_KEY` / `SMS_SENDER` when wired (Africa's Talking, Twilio, …).

## Project map

- `app/` — pages + `app/api/*` route handlers (all mutations Zod-validated, role-gated)
- `drizzle/schema.ts`, `drizzle/0001_init.sql` … `0003_categories.sql` — full Postgres schema
  (works on PGlite or hosted PG)
- `lib/` — money (int KES), KE phones, state machines, parcels, M-Pesa gate, sessions, seed
- `tests/` — unit + API integration journeys (see `pnpm test:api`)
- `components/` — brand UI, basket/city context, staff widgets
