import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { releaseAllExpiredReservations } from "@/lib/reservation-expiry";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  await releaseAllExpiredReservations(prisma);

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { product: true, warehouse: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    reservation: {
      id: reservation.id,
      productId: reservation.productId,
      warehouseId: reservation.warehouseId,
      productName: reservation.product.name,
      warehouseName: reservation.warehouse.name,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
    },
  });
}
