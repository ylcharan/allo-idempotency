"use client";

import { ChevronRight, Package } from "lucide-react";
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

type Product = {
  id: string;
  name: string;
  imageUrl: string | null;
  warehouses: WarehouseRow[];
};

type ProductsPayload = {
  products: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const PAGE_SIZE = 8;

function productSummary(p: Product) {
  const n = p.warehouses.length;
  const available = p.warehouses.reduce((acc, w) => acc + w.availableUnits, 0);
  return { warehouseCount: n, available };
}

export function ProductsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async (nextPage: number) => {
    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: String(PAGE_SIZE),
    });
    const res = await fetch(`/api/products?${params}`);
    if (!res.ok) return null;
    return (await res.json()) as ProductsPayload;
  }, []);

  const load = useCallback(
    async (nextPage: number) => {
      const data = await fetchList(nextPage);
      if (!data) {
        setError("Could not load products.");
        return null;
      }
      setProducts(data.products);
      setPage(data.page);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setError(null);
      return data;
    },
    [fetchList],
  );

  const silentRefresh = useCallback(async () => {
    const data = await fetchList(page);
    if (!data) return;
    setProducts(data.products);
    setPage(data.page);
    setTotal(data.total);
    setTotalPages(data.totalPages);
  }, [fetchList, page]);

  useInventoryPoll(silentRefresh);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchList(1);
        if (cancelled) return;
        if (!data) {
          setError("Could not load products.");
          return;
        }
        setProducts(data.products);
        setPage(data.page);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setError(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchList]);

  async function refreshCurrentPage() {
    await load(page);
  }

  async function goToPage(next: number) {
    if (next < 1 || (totalPages > 0 && next > totalPages)) return;
    const previousPage = page;
    setLoading(true);
    setPage(next);
    try {
      const data = await load(next);
      if (!data) {
        setPage(previousPage);
      }
    } finally {
      setLoading(false);
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  if (loading && products.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Loading inventory…</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Select a product to open its detail page and reserve by warehouse.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Available units refresh automatically every few seconds while this tab is
            visible.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            void (async () => {
              setLoading(true);
              try {
                await refreshCurrentPage();
              } finally {
                setLoading(false);
              }
            })();
          }}
        >
          {loading ? "Refreshing…" : "Refresh"}
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

      {products.length === 0 && !loading ? (
        <p className="text-muted-foreground text-sm">No products in this view.</p>
      ) : (
        <ul className="space-y-3">
          {products.map((p) => {
            const { warehouseCount, available } = productSummary(p);
            return (
              <li
                key={p.id}
                className="overflow-hidden rounded-lg border border-border bg-card shadow-xs"
              >
                <Link
                  href={`/products/${p.id}`}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-md">
                    {p.imageUrl ? (
                      <Image
                        src={p.imageUrl}
                        alt={`${p.name} preview`}
                        width={56}
                        height={56}
                        className="size-14 object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <div className="flex size-14 items-center justify-center text-muted-foreground">
                        <Package className="size-7" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-medium leading-snug">{p.name}</h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      <span
                        className="tabular-nums font-medium text-foreground"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {available}
                      </span>{" "}
                      unit{available === 1 ? "" : "s"} available
                      <span className="text-muted-foreground">
                        {" "}
                        · {warehouseCount} warehouse{warehouseCount === 1 ? "" : "s"}
                      </span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 0 ? (
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Showing{" "}
            <span className="text-foreground font-medium">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            of <span className="text-foreground font-medium">{total}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || page <= 1}
              onClick={() => void goToPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-muted-foreground px-1 text-sm tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || page >= totalPages}
              onClick={() => void goToPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
