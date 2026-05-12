import { Prisma } from "@/lib/generated/prisma/client";

/** Tables not created yet (migrations not applied). */
export function isMissingDatabaseObjectError(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === "P2021") return true;
  if (e.code !== "P2010") return false;
  const meta = e.meta as { code?: string; message?: string } | undefined;
  const code = meta?.code;
  const msg = `${e.message} ${meta?.message ?? ""}`;
  return code === "42P01" || msg.includes("does not exist");
}
