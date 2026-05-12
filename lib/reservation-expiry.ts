import type { PrismaClient } from "@/lib/generated/prisma/client";

type Db = PrismaClient | Pick<PrismaClient, "$executeRaw">;

/**
 * Marks expired PENDING reservations as RELEASED and subtracts their quantities
 * from inventory.reservedUnits (batched by product/warehouse).
 */
export async function releaseAllExpiredReservations(db: Db): Promise<void> {
  await db.$executeRaw`
    WITH "expired" AS (
      UPDATE "Reservation"
      SET "status" = 'RELEASED'::"ReservationStatus"
      WHERE "status" = 'PENDING'::"ReservationStatus"
        AND "expiresAt" < NOW()
      RETURNING "productId", "warehouseId", "quantity"
    ),
    "agg" AS (
      SELECT "productId", "warehouseId", SUM("quantity")::int AS "q"
      FROM "expired"
      GROUP BY "productId", "warehouseId"
    )
    UPDATE "Inventory" AS i
    SET "reservedUnits" = GREATEST(0, i."reservedUnits" - COALESCE(a."q", 0))
    FROM "agg" AS a
    WHERE i."productId" = a."productId"
      AND i."warehouseId" = a."warehouseId"
  `;
}

/**
 * Same as global cleanup but scoped to one SKU inside an existing transaction
 * (after the inventory row is locked).
 */
export async function releaseExpiredForSku(
  tx: Pick<PrismaClient, "$executeRaw">,
  productId: string,
  warehouseId: string,
): Promise<void> {
  await tx.$executeRaw`
    WITH "expired" AS (
      UPDATE "Reservation"
      SET "status" = 'RELEASED'::"ReservationStatus"
      WHERE "status" = 'PENDING'::"ReservationStatus"
        AND "expiresAt" < NOW()
        AND "productId" = ${productId}
        AND "warehouseId" = ${warehouseId}
      RETURNING "quantity"
    )
    UPDATE "Inventory" AS i
    SET "reservedUnits" = GREATEST(
      0,
      i."reservedUnits" - COALESCE((SELECT SUM("quantity")::int FROM "expired"), 0)
    )
    WHERE i."productId" = ${productId}
      AND i."warehouseId" = ${warehouseId}
  `;
}
