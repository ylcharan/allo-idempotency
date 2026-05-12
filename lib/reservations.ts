import { prisma } from "@/lib/db";
import { ReservationStatus } from "@/lib/generated/prisma/client";
import { releaseExpiredForSku } from "@/lib/reservation-expiry";

export type ReserveResult =
  | { ok: true; reservation: NonNullable<Awaited<ReturnType<typeof mapReservation>>> }
  | { ok: false; code: "NOT_ENOUGH_STOCK" | "NO_INVENTORY" };

export async function createReservation(input: {
  productId: string;
  warehouseId: string;
  quantity: number;
  ttlMinutes: number;
}): Promise<ReserveResult> {
  const ttlMs = input.ttlMinutes * 60 * 1000;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT 1
      FROM "Inventory" AS i
      WHERE i."productId" = ${input.productId}
        AND i."warehouseId" = ${input.warehouseId}
      FOR UPDATE
    `;

    await releaseExpiredForSku(tx, input.productId, input.warehouseId);

    const inv = await tx.inventory.findUnique({
      where: {
        productId_warehouseId: {
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
    });

    if (!inv) {
      return { ok: false, code: "NO_INVENTORY" };
    }

    const available = inv.totalUnits - inv.reservedUnits;
    if (available < input.quantity) {
      return { ok: false, code: "NOT_ENOUGH_STOCK" };
    }

    await tx.inventory.update({
      where: { id: inv.id },
      data: { reservedUnits: { increment: input.quantity } },
    });

    const expiresAt = new Date(Date.now() + ttlMs);
    const reservation = await tx.reservation.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        expiresAt,
        status: ReservationStatus.PENDING,
      },
      include: { product: true, warehouse: true },
    });

    return { ok: true, reservation: mapReservation(reservation)! };
  });
}

export type ConfirmResult =
  | { ok: true; reservation: NonNullable<ReturnType<typeof mapReservation>> }
  | {
      ok: false;
      code: "NOT_FOUND" | "EXPIRED" | "CANCELLED" | "NOT_PENDING";
    };

export async function confirmReservation(id: string): Promise<ConfirmResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT 1 FROM "Reservation" AS r WHERE r.id = ${id} FOR UPDATE
    `;

    const resv = await tx.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    });
    if (!resv) {
      return { ok: false, code: "NOT_FOUND" };
    }

    if (resv.status === ReservationStatus.CONFIRMED) {
      return { ok: true, reservation: mapReservation(resv)! };
    }

    if (resv.status === ReservationStatus.RELEASED) {
      const now = new Date();
      if (resv.expiresAt >= now) {
        return { ok: false, code: "CANCELLED" };
      }
      return { ok: false, code: "EXPIRED" };
    }

    const now = new Date();
    if (resv.expiresAt < now) {
      await tx.reservation.update({
        where: { id },
        data: { status: ReservationStatus.RELEASED },
      });
      await tx.inventory.update({
        where: {
          productId_warehouseId: {
            productId: resv.productId,
            warehouseId: resv.warehouseId,
          },
        },
        data: { reservedUnits: { decrement: resv.quantity } },
      });
      return { ok: false, code: "EXPIRED" };
    }

    await tx.$executeRaw`
      SELECT 1
      FROM "Inventory" AS i
      WHERE i."productId" = ${resv.productId}
        AND i."warehouseId" = ${resv.warehouseId}
      FOR UPDATE
    `;

    await releaseExpiredForSku(tx, resv.productId, resv.warehouseId);

    const current = await tx.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    });

    if (!current) {
      return { ok: false, code: "NOT_FOUND" };
    }

    if (current.status === ReservationStatus.CONFIRMED) {
      return { ok: true, reservation: mapReservation(current)! };
    }

    if (current.status !== ReservationStatus.PENDING) {
      if (current.status === ReservationStatus.RELEASED) {
        return current.expiresAt >= new Date()
          ? { ok: false, code: "CANCELLED" }
          : { ok: false, code: "EXPIRED" };
      }
      return { ok: false, code: "NOT_PENDING" };
    }

    if (current.expiresAt < new Date()) {
      await tx.reservation.update({
        where: { id },
        data: { status: ReservationStatus.RELEASED },
      });
      await tx.inventory.update({
        where: {
          productId_warehouseId: {
            productId: current.productId,
            warehouseId: current.warehouseId,
          },
        },
        data: { reservedUnits: { decrement: current.quantity } },
      });
      return { ok: false, code: "EXPIRED" };
    }

    await tx.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CONFIRMED },
    });

    await tx.inventory.update({
      where: {
        productId_warehouseId: {
          productId: current.productId,
          warehouseId: current.warehouseId,
        },
      },
      data: {
        totalUnits: { decrement: current.quantity },
        reservedUnits: { decrement: current.quantity },
      },
    });

    const updated = await tx.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    });

    return { ok: true, reservation: mapReservation(updated)! };
  });
}

export type ReleaseResult =
  | { ok: true; reservation: NonNullable<ReturnType<typeof mapReservation>> }
  | { ok: false; code: "NOT_FOUND" | "NOT_PENDING" };

export async function releaseReservation(id: string): Promise<ReleaseResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT 1 FROM "Reservation" AS r WHERE r.id = ${id} FOR UPDATE
    `;

    const resv = await tx.reservation.findUnique({ where: { id } });
    if (!resv) {
      return { ok: false, code: "NOT_FOUND" };
    }

    await tx.$executeRaw`
      SELECT 1
      FROM "Inventory" AS i
      WHERE i."productId" = ${resv.productId}
        AND i."warehouseId" = ${resv.warehouseId}
      FOR UPDATE
    `;

    await releaseExpiredForSku(tx, resv.productId, resv.warehouseId);

    const current = await tx.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    });

    if (!current) {
      return { ok: false, code: "NOT_FOUND" };
    }

    if (current.status === ReservationStatus.RELEASED) {
      return { ok: true, reservation: mapReservation(current)! };
    }

    if (current.status !== ReservationStatus.PENDING) {
      return { ok: false, code: "NOT_PENDING" };
    }

    await tx.reservation.update({
      where: { id },
      data: { status: ReservationStatus.RELEASED },
    });

    await tx.inventory.update({
      where: {
        productId_warehouseId: {
          productId: current.productId,
          warehouseId: current.warehouseId,
        },
      },
      data: { reservedUnits: { decrement: current.quantity } },
    });

    const updated = await tx.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    });

    return { ok: true, reservation: mapReservation(updated)! };
  });
}

function mapReservation(
  r:
    | ({
        product: { id: string; name: string };
        warehouse: { id: string; name: string };
      } & {
        id: string;
        productId: string;
        warehouseId: string;
        quantity: number;
        status: ReservationStatus;
        expiresAt: Date;
        createdAt: Date;
      })
    | null,
) {
  if (!r) return null;
  return {
    id: r.id,
    productId: r.productId,
    warehouseId: r.warehouseId,
    productName: r.product.name,
    warehouseName: r.warehouse.name,
    quantity: r.quantity,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}
