import { z } from "zod";

export const reserveBodySchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.coerce.number().int().positive().max(999),
  /** Minutes until expiry; default 10 */
  ttlMinutes: z.coerce.number().int().positive().max(120).optional(),
});

export type ReserveBody = z.infer<typeof reserveBodySchema>;
