import "dotenv/config";
import { prisma } from "../lib/db";
import { ensureProductImageUrlColumn } from "./ensure-product-imageurl";

async function main() {
  await ensureProductImageUrlColumn();

  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const [east, west] = await prisma.$transaction([
    prisma.warehouse.create({ data: { name: "East Coast DC" } }),
    prisma.warehouse.create({ data: { name: "West Coast DC" } }),
  ]);

  const [widget, gadget] = await prisma.$transaction([
    prisma.product.create({
      data: {
        name: "Widget Pro",
        imageUrl: "https://picsum.photos/seed/allo-widget-pro/384/384",
      },
    }),
    prisma.product.create({
      data: {
        name: "Gadget Mini",
        imageUrl: "https://picsum.photos/seed/allo-gadget-mini/384/384",
      },
    }),
  ]);

  await prisma.inventory.createMany({
    data: [
      {
        productId: widget.id,
        warehouseId: east.id,
        totalUnits: 5,
        reservedUnits: 0,
      },
      {
        productId: widget.id,
        warehouseId: west.id,
        totalUnits: 12,
        reservedUnits: 0,
      },
      {
        productId: gadget.id,
        warehouseId: east.id,
        totalUnits: 1,
        reservedUnits: 0,
      },
      {
        productId: gadget.id,
        warehouseId: west.id,
        totalUnits: 20,
        reservedUnits: 0,
      },
    ],
  });

  console.log("Seed OK:", { east: east.id, west: west.id, widget: widget.id, gadget: gadget.id });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
