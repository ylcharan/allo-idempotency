import { createHash } from "node:crypto";

export function reserveScope(body: unknown): string {
  const payload = JSON.stringify(body);
  const hash = createHash("sha256").update(payload).digest("hex");
  return `POST /api/reservations#${hash}`;
}

export function confirmScope(id: string): string {
  return `POST /api/reservations/${id}/confirm`;
}

export function releaseScope(id: string): string {
  return `POST /api/reservations/${id}/release`;
}
