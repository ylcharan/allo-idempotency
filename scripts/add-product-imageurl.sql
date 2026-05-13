-- Run in Supabase: SQL Editor → New query when:
--   - `npm run db:migrate` cannot reach the DB (P1001 on direct host), and
--   - `npm run db:patch-schema` fails (some poolers block DDL).
-- Safe to run more than once.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
