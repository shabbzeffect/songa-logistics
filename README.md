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
- **E-commerce parcels:** prohibited-items acknowledgement, server-side estimate (never a guaranteed
  quote), 20 kg cap, pickup-confirmation step, rider assignment, tracking + history. Built for
  online sellers and personal sends alike.
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
| Online M-Pesa (Daraja STK) | **Off** — checkout offers *cash* + *M-Pesa on delivery* only | Set `MPESA_ENABLED=true` + key/secret/shortcode/passkey; finish `lib/mpesa.ts` + verify `app/api/payments/mpesa-callback` source (see code TODO) |
| Maps / GPS | **Off** — ETAs are labelled estimates; no live rider map | Plug a maps provider into tracking + dispatch |
| SMS/WhatsApp | **Off** — status via in-app tracking | Configure sender + templates |
| Identity verification | **Demo picker** — no passwords | Staff SSO + rider phone-OTP + KYC checks |
| Managed Postgres | Embedded PGlite by default | Set `DATABASE_URL`, run `drizzle/*.sql` via drizzle-kit against it |

Demo auth is intentionally passwordless so reviewers can tour every workspace; every
staff action is still role-checked server-side and audit-logged.

## Project map

- `app/` — pages + `app/api/*` route handlers (all mutations Zod-validated, role-gated)
- `drizzle/schema.ts`, `drizzle/0001_init.sql` … `0003_categories.sql` — full Postgres schema
  (works on PGlite or hosted PG)
- `lib/` — money (int KES), KE phones, state machines, parcels, M-Pesa gate, sessions, seed
- `tests/` — unit + API integration journeys (see `pnpm test:api`)
- `components/` — brand UI, basket/city context, staff widgets
