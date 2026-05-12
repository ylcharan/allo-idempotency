import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isMissingDatabaseObjectError } from "@/lib/prisma-errors";
import { releaseAllExpiredReservations } from "@/lib/reservation-expiry";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function parsePositiveInt(value: string | null, fallback: number) {
  if (value == null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

export async function GET(request: Request) {
  try {
    await releaseAllExpiredReservations(prisma);

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    );
    const skip = (page - 1) * pageSize;

    const [total, products] = await Promise.all([
      prisma.product.count(),
      prisma.product.findMany({
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
        include: {
          inventories: {
            include: { warehouse: true },
            orderBy: { warehouse: { name: "asc" } },
          },
        },
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    const body = {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        warehouses: p.inventories.map((i) => ({
          warehouseId: i.warehouseId,
          warehouseName: i.warehouse.name,
          totalUnits: i.totalUnits,
          reservedUnits: i.reservedUnits,
          availableUnits: i.totalUnits - i.reservedUnits,
        })),
      })),
      page,
      pageSize,
      total,
      totalPages,
    };

    return NextResponse.json(body);
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
