-- AlterTable (IF NOT EXISTS: safe if column was added earlier via seed/SQL Editor)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
