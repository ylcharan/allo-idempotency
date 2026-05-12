import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";

export async function getIdempotentResponse(
  key: string | null,
  scope: string,
): Promise<{ statusCode: number; body: unknown } | null> {
  if (!key) return null;
  const row = await prisma.idempotencyRecord.findUnique({
    where: { key_scope: { key, scope } },
  });
  if (!row) return null;
  return { statusCode: row.statusCode, body: row.body };
}

export async function saveIdempotentResponse(
  key: string | null,
  scope: string,
  statusCode: number,
  body: unknown,
): Promise<void> {
  if (!key) return;
  try {
    await prisma.idempotencyRecord.create({
      data: {
        key,
        scope,
        statusCode,
        body: body as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return;
    }
    throw e;
  }
}
