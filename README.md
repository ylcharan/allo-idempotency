# Allo take-home — inventory reservations

Next.js (App Router) app: hosted Postgres via Prisma, concurrent-safe stock holds, products list + detail pages, checkout UI with countdown, and idempotent reserve/confirm/release when clients send `Idempotency-Key`.

## Prerequisites

- Node 20+
- A **hosted** PostgreSQL database (Neon, Supabase, Railway, etc.) — not SQLite
- `DATABASE_URL` connection string (SSL URL for most providers)

## Local setup

1. Copy env and set your database URL:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set `DATABASE_URL`.

   If you're using Supabase:
   - `DATABASE_URL`: pooler URL (often `*.pooler.supabase.com`, port `6543`)
   - `DIRECT_URL`: direct URL (`db.<ref>.supabase.co:5432`) for Prisma migrate

2. Install dependencies (generates Prisma client on `postinstall`):

   ```bash
   npm install
   ```

3. Apply schema to the database (pick one):

   ```bash
   npm run db:migrate
   # or, for a throwaway dev DB:
   # npx prisma db push
   ```

   If `db:migrate` fails (e.g. can't reach Supabase direct host from your network):

   ```bash
   npm run db:patch-schema
   ```

4. Seed sample warehouses, products, and inventory:

   ```bash
   npm run db:seed
   ```

5. Run the app:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) → **Products** → pick a product → reserve from a warehouse → checkout with countdown, **Confirm purchase**, or **Cancel**.

## API

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/products` | Paginated products list with per-warehouse totals, reserved, available, and `imageUrl` |
| `GET` | `/api/products/:id` | Single product detail (same shape as list item) |
| `GET` | `/api/warehouses` | Warehouse list |
| `POST` | `/api/reservations` | Body: `{ productId, warehouseId, quantity, ttlMinutes? }` — `409` if not enough available stock |
| `POST` | `/api/reservations/:id/confirm` | `410` if the hold expired; idempotent with `Idempotency-Key` |
| `POST` | `/api/reservations/:id/release` | Early release; idempotent with `Idempotency-Key` |
| `GET` | `/api/reservations/:id` | Read reservation (used by checkout; also runs lazy expiry cleanup) |

## UI

- `/products`: paginated list; available units auto-refresh every few seconds while the tab is visible
- `/products/:id`: product detail with image, summary, and per-warehouse cards (choose quantity and reserve)
- `/checkout/:id`: reservation countdown + confirm/release actions

## Concurrency (reservations)

`POST /api/reservations` runs in a **single database transaction** that:

1. Locks the matching `Inventory` row with `SELECT … FOR UPDATE`.
2. Auto-releases **other** expired `PENDING` rows for that product/warehouse and subtracts their quantities from `reservedUnits`.
3. Checks `totalUnits - reservedUnits >= quantity`, then increments `reservedUnits` and inserts a `PENDING` reservation.

Two simultaneous requests for the last unit therefore serialize on the inventory row; one succeeds with `201`, the other gets `409 NOT_ENOUGH_STOCK`.

## Reservation expiry (production)

**Lazy cleanup:** `GET /api/products`, `GET /api/reservations/:id`, and the reserve transaction path run SQL that moves expired `PENDING` reservations to `RELEASED` and subtracts held quantities from `Inventory.reservedUnits` (globally or per SKU as appropriate). Stock shown in the UI stays honest without a background worker.

## Idempotency (bonus)

If the client sends `Idempotency-Key`, responses for `POST /api/reservations`, `POST …/confirm`, and `POST …/release` are stored in `IdempotencyRecord` (key + scope, where scope includes a hash of the reserve body). Retries with the same key and scope return the stored status and JSON body without duplicating side effects. Scope is chosen so the same key with a different reserve payload does not replay a mismatched response.

## Trade-offs / next steps

- Idempotency under identical parallel requests is “check then act”; a stricter design would take a DB advisory lock or `INSERT … ON CONFLICT` first.
- No Redis layer; Postgres row locks are enough for this scope.
- `Gadget Mini` in the East warehouse is intentionally seeded with **1** unit to demo `409` under contention.

## Deploy

1. Create a Vercel project from this repo; set `DATABASE_URL` (and `DIRECT_URL` if your build step runs migrations).
2. Run migrations against production (`npm run db:migrate` in CI or locally against prod URL).
3. Run `npm run db:seed` once against production so reviewers have data (or adjust seed for prod).
# allo-idempotency
# ylcharan-allo-idempotency
# allo-idempotency
