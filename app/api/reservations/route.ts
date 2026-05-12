import { NextResponse } from "next/server";
import { getIdempotentResponse, saveIdempotentResponse } from "@/lib/idempotency";
import { reserveScope } from "@/lib/idempotency-scope";
import { createReservation } from "@/lib/reservations";
import { reserveBodySchema } from "@/lib/validators";

function idempotencyKey(request: Request): string | null {
  return request.headers.get("Idempotency-Key")?.trim() || null;
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = reserveBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const key = idempotencyKey(request);
  const scope = reserveScope(body);

  const cached = await getIdempotentResponse(key, scope);
  if (cached) {
    return NextResponse.json(cached.body, { status: cached.statusCode });
  }

  const ttlMinutes = body.ttlMinutes ?? 10;
  const result = await createReservation({
    productId: body.productId,
    warehouseId: body.warehouseId,
    quantity: body.quantity,
    ttlMinutes,
  });

  if (!result.ok) {
    if (result.code === "NO_INVENTORY") {
      const payload = { error: "NO_INVENTORY" };
      const res = NextResponse.json(payload, { status: 404 });
      await saveIdempotentResponse(key, scope, 404, payload);
      return res;
    }
    const payload = { error: "NOT_ENOUGH_STOCK" };
    const res = NextResponse.json(payload, { status: 409 });
    await saveIdempotentResponse(key, scope, 409, payload);
    return res;
  }

  const payload = { reservation: result.reservation };
  const res = NextResponse.json(payload, { status: 201 });
  await saveIdempotentResponse(key, scope, 201, payload);
  return res;
}
