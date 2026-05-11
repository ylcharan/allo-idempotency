import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * CLI (migrate, db push, introspect) uses this URL. Supabase **transaction** pooler
 * (port 6543) and even **session** pooler on `*.pooler.supabase.com` often fail for
 * migrate with P1017 / P1001. Use a **direct** URL (host `db.<ref>.supabase.co`) in
 * DIRECT_URL. The app runtime still uses `DATABASE_URL` in `lib/db.ts`.
 */
function looksLikeSupabasePooler(url: string) {
  return url.includes("pooler.supabase.com") || url.includes(":6543");
}

function warnSupabaseCliUrl(url: string, label: string) {
  if (!looksLikeSupabasePooler(url)) return;
  console.warn(
    `\n[prisma] ${label} points at a Supabase pooler. Prisma migrate often fails (P1017 / P1001).\n` +
      "Use DIRECT_URL with the **direct** host from the dashboard, e.g.\n" +
      "  postgresql://postgres.[ref]:PASSWORD@db.[ref].supabase.co:5432/postgres?sslmode=require\n" +
      "(Settings → Database → Connection string → URI → Direct connection.)\n" +
      "If migrate still fails here, use `npm run db:patch-schema` (pooler) or SQL Editor → scripts/add-product-imageurl.sql, then db:seed.\n",
  );
}

/** Direct db.*.supabase.co can return P1001 from some networks (IPv6 / firewall). */
function warnSupabaseDirectHost(url: string) {
  if (looksLikeSupabasePooler(url)) return;
  if (!url.includes(".supabase.co") || !url.includes("db.")) return;
  console.warn(
    "[prisma] If migrate fails with P1001 to db.*.supabase.co, run `npm run db:patch-schema` (uses DATABASE_URL) or paste scripts/add-product-imageurl.sql in the SQL Editor.\n",
  );
}

function datasourceUrlForCli(): string {
  const direct = process.env.DIRECT_URL?.trim();
  const databaseUrl = env("DATABASE_URL");
  if (direct) {
    warnSupabaseCliUrl(direct, "DIRECT_URL");
    warnSupabaseDirectHost(direct);
    return direct;
  }
  warnSupabaseCliUrl(databaseUrl, "DATABASE_URL (no DIRECT_URL)");
  return databaseUrl;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrlForCli(),
  },
});
