import { prisma } from "../lib/db";

/**
 * Ensures Product.imageUrl exists. Uses DATABASE_URL (pooler) like the rest of the app,
 * so this can succeed when Prisma migrate (DIRECT_URL) hits P1001.
 */
export async function ensureProductImageUrlColumn() {
  try {
    await prisma.$executeRaw`
      ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT
    `;
  } catch (e) {
    console.error(
      "\n[schema] Could not ALTER Product (pooler may block DDL). " +
        "Run scripts/add-product-imageurl.sql in the Supabase SQL Editor.\n",
    );
    throw e;
  }
}
