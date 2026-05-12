import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { releaseAllExpiredReservations } from "@/lib/reservation-expiry";

/**
 * Optional Vercel Cron: call GET with `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  await releaseAllExpiredReservations(prisma);
  return NextResponse.json({ ok: true });
}
