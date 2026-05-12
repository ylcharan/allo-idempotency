import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json({ warehouses });
}
