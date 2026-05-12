import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isMissingDatabaseObjectError } from "@/lib/prisma-errors";
import { releaseAllExpiredReservations } from "@/lib/reservation-expiry";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    await releaseAllExpiredReservations(prisma);

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        inventories: {
          include: { warehouse: true },
          orderBy: { warehouse: { name: "asc" } },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        warehouses: product.inventories.map((i) => ({
          warehouseId: i.warehouseId,
          warehouseName: i.warehouse.name,
          totalUnits: i.totalUnits,
          reservedUnits: i.reservedUnits,
          availableUnits: i.totalUnits - i.reservedUnits,
        })),
      },
    });
  } catch (e) {
    if (isMissingDatabaseObjectError(e)) {
      return NextResponse.json(
        {
          error: "DATABASE_NOT_READY",
          message:
            "Tables are missing. Run: npm run db:migrate && npm run db:seed (set DIRECT_URL for Supabase migrations).",
        },
        { status: 503 },
      );
    }
    throw e;
  }
}
