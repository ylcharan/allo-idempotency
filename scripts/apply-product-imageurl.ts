import "dotenv/config";
import { prisma } from "../lib/db";
import { ensureProductImageUrlColumn } from "../prisma/ensure-product-imageurl";

async function main() {
  await ensureProductImageUrlColumn();
  console.log("OK: Product.imageUrl is present (or was already).");
}

main()
  .catch(() => process.exit(1))
  .finally(() => prisma.$disconnect());
