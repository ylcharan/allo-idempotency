import { NextResponse } from "next/server";
import { getIdempotentResponse, saveIdempotentResponse } from "@/lib/idempotency";
import { confirmScope } from "@/lib/idempotency-scope";
import { confirmReservation } from "@/lib/reservations";

type Ctx = { params: Promise<{ id: string }> };

function idempotencyKey(request: Request): string | null {
  return request.headers.get("Idempotency-Key")?.trim() || null;
}

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const key = idempotencyKey(request);
  const scope = confirmScope(id);

  const cached = await getIdempotentResponse(key, scope);
  if (cached) {
    return NextResponse.json(cached.body, { status: cached.statusCode });
  }

  const result = await confirmReservation(id);

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      const payload = { error: "NOT_FOUND" };
      const res = NextResponse.json(payload, { status: 404 });
      await saveIdempotentResponse(key, scope, 404, payload);
      return res;
    }
    if (result.code === "EXPIRED") {
      const payload = { error: "RESERVATION_EXPIRED" };
      const res = NextResponse.json(payload, { status: 410 });
      await saveIdempotentResponse(key, scope, 410, payload);
      return res;
    }
    if (result.code === "CANCELLED") {
      const payload = { error: "RESERVATION_CANCELLED" };
      const res = NextResponse.json(payload, { status: 409 });
      await saveIdempotentResponse(key, scope, 409, payload);
      return res;
    }
    const payload = { error: "NOT_PENDING" };
    const res = NextResponse.json(payload, { status: 409 });
    await saveIdempotentResponse(key, scope, 409, payload);
    return res;
  }

  const payload = { reservation: result.reservation };
  const res = NextResponse.json(payload, { status: 200 });
  await saveIdempotentResponse(key, scope, 200, payload);
  return res;
}
