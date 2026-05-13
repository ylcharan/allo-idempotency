"use client";

import { ArrowLeft, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useInventoryPoll } from "@/lib/use-inventory-poll";

type WarehouseRow = {
  warehouseId: string;
  warehouseName: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
};

type ProductDetail = {
  id: string;
  name: string;
  imageUrl: string | null;
  warehouses: WarehouseRow[];
};

export function ProductDetailClient({ productId }: { productId: string }) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [qtyByWarehouse, setQtyByWarehouse] = useState<Record<string, number>>(
    {},
  );

  const applyFetchResponse = useCallback(async (res: Response) => {
    if (res.status === 404) {
      setProduct(null);
      setError(null);
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      setError(body.message ?? body.error ?? "Could not load product.");
      setProduct(null);
      return;
    }
    const data = (await res.json()) as { product: ProductDetail };
    setProduct(data.product);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/products/${productId}`);
      if (cancelled) return;
      await applyFetchResponse(res);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, applyFetchResponse]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}`);
      await applyFetchResponse(res);
    } finally {
      setLoading(false);
    }
  }, [productId, applyFetchResponse]);

  const silentPoll = useCallback(async () => {
    const res = await fetch(`/api/products/${productId}`);
    await applyFetchResponse(res);
  }, [productId, applyFetchResponse]);

  useInventoryPoll(silentPoll);

  async function reserve(
    warehouseId: string,
    requestedQty: number,
    maxAvailable: number,
  ) {
    const quantity = Math.min(Math.max(1, requestedQty), maxAvailable);
    if (maxAvailable < 1) return;
    const key = crypto.randomUUID();
    setBusyKey(`${productId}:${warehouseId}`);
    setError(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ productId, warehouseId, quantity }),
      });
      const body = (await res.json()) as {
        error?: string;
        reservation?: { id: string };
      };
      if (res.status === 409 && body.error === "NOT_ENOUGH_STOCK") {
        setError("Not enough stock available for that warehouse.");
        const r = await fetch(`/api/products/${productId}`);
        await applyFetchResponse(r);
        return;
      }
      if (!res.ok) {
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      if (body.reservation?.id) {
        window.location.href = `/checkout/${body.reservation.id}`;
        return;
      }
      setError("Unexpected response.");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading && !product) {
    return (
      <p className="text-muted-foreground text-sm">Loading product…</p>
    );
  }

  if (!product) {
    return (
      <div className="space-y-4">
        <Link
          href="/products"
          className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to products
        </Link>
        <p className="text-muted-foreground text-sm">
          {error ?? "This product could not be found."}
        </p>
      </div>
    );
  }

  const totalAvailableAll = product.warehouses.reduce(
    (a, w) => a + w.availableUnits,
    0,
  );
  const totalReservedAll = product.warehouses.reduce(
    (a, w) => a + w.reservedUnits,
    0,
  );
  const totalCapacityAll = product.warehouses.reduce(
    (a, w) => a + w.totalUnits,
    0,
  );

  return (
    <div className="flex flex-col space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Link
          href="/products"
          className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to products
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void refresh()}
        >
          {loading ? "Refreshing…" : "Refresh stock"}
        </Button>
      </div>

      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="bg-muted relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-xl border border-border shadow-xs">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 448px"
            priority
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Package className="size-20" aria-hidden />
          </div>
        )}
      </div>

      <div className="space-y-1 text-center sm:text-left">
        <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
        <p className="text-muted-foreground font-mono text-xs">
          Product ID: {product.id}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Warehouses
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {product.warehouses.length}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Available (live)
          </dt>
          <dd
            className="mt-1 text-2xl font-semibold tabular-nums"
            aria-live="polite"
            aria-atomic="true"
          >
            {totalAvailableAll}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Reserved / total
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {totalReservedAll} / {totalCapacityAll}
          </dd>
        </div>
      </dl>

      <p className="text-muted-foreground text-xs">
        Available units refresh every few seconds while this tab is visible (includes
        stock freed when reservations expire).
      </p>

      <div>
        <h2 className="text-lg font-medium">Inventory by warehouse</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Available = total minus reserved. Set quantity and reserve.
        </p>
        <ul className="mt-4 space-y-4">
          {product.warehouses.map((w) => {
            const busy = busyKey === `${productId}:${w.warehouseId}`;
            const qtyKey = w.warehouseId;
            const raw = qtyByWarehouse[qtyKey] ?? 1;
            const qty = Math.min(
              Math.max(1, raw),
              Math.max(1, w.availableUnits),
            );
            return (
              <li
                key={w.warehouseId}
                className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
              >
                <h3 className="text-base font-semibold leading-tight">
                  {w.warehouseName}
                </h3>
                <dl className="mt-4 space-y-4">
                  <div className="min-w-0 space-y-1">
                    <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Warehouse ID
                    </dt>
                    <dd className="font-mono text-xs leading-relaxed break-all text-foreground">
                      {w.warehouseId}
                    </dd>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Total
                      </dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        {w.totalUnits}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Reserved
                      </dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        {w.reservedUnits}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Available
                      </dt>
                      <dd
                        className="text-lg font-semibold tabular-nums"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {w.availableUnits}
                      </dd>
                    </div>
                  </div>
                </dl>
                <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-2">
                    <label
                      htmlFor={`qty-${w.warehouseId}`}
                      className="text-muted-foreground block text-xs font-medium uppercase tracking-wide"
                    >
                      Quantity
                    </label>
                    <input
                      id={`qty-${w.warehouseId}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={w.availableUnits}
                      disabled={busy || w.availableUnits < 1}
                      className="border-input bg-background h-10 w-full max-w-[8rem] rounded-md border px-3 text-sm tabular-nums shadow-xs disabled:opacity-50 sm:h-9"
                      aria-label={`Quantity for ${w.warehouseName}`}
                      value={w.availableUnits < 1 ? 0 : qty}
                      onChange={(e) => {
                        const v = Number.parseInt(e.target.value, 10);
                        const next = Number.isFinite(v)
                          ? Math.min(Math.max(1, v), w.availableUnits)
                          : 1;
                        setQtyByWarehouse((prev) => ({ ...prev, [qtyKey]: next }));
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={busy || w.availableUnits < 1}
                    onClick={() => void reserve(w.warehouseId, qty, w.availableUnits)}
                  >
                    {busy ? "Reserving…" : "Reserve"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
