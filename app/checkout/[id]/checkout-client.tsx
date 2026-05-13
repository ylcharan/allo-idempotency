"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Reservation = {
  id: string;
  productId: string;
  warehouseId: string;
  productName: string;
  warehouseName: string;
  quantity: number;
  status: string;
  expiresAt: string;
  createdAt: string;
};

export function CheckoutClient({ reservationId }: { reservationId: string }) {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/reservations/${reservationId}`);
    if (res.status === 404) {
      setLoadError("Reservation not found.");
      setReservation(null);
      return;
    }
    if (!res.ok) {
      setLoadError("Could not load reservation.");
      return;
    }
    const data = (await res.json()) as { reservation: Reservation };
    setReservation(data.reservation);
    setLoadError(null);
  }, [reservationId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const expiresMs = reservation ? new Date(reservation.expiresAt).getTime() : 0;
  const remainingMs = expiresMs - now;

  const countdown = useMemo(() => {
    if (!reservation || reservation.status !== "PENDING") return null;
    if (remainingMs <= 0) return "Expired";
    const s = Math.floor(remainingMs / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }, [reservation, remainingMs]);

  async function post(path: string) {
    setPending(true);
    setActionError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      const body = (await res.json()) as { error?: string; reservation?: Reservation };

      if (res.status === 409 && body.error === "NOT_ENOUGH_STOCK") {
        setActionError("Not enough stock (this should not happen on confirm).");
        return;
      }
      if (res.status === 410 && body.error === "RESERVATION_EXPIRED") {
        setActionError("This reservation has expired and was released.");
        await load();
        return;
      }
      if (res.status === 409 && body.error === "RESERVATION_CANCELLED") {
        setActionError("This reservation was already cancelled.");
        await load();
        return;
      }
      if (res.status === 409 && body.error === "NOT_PENDING") {
        setActionError("This reservation can no longer be confirmed in its current state.");
        await load();
        return;
      }
      if (!res.ok) {
        setActionError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      if (body.reservation) {
        setReservation(body.reservation);
      } else {
        await load();
      }
    } finally {
      setPending(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <p className="text-destructive text-sm" role="alert">
          {loadError}
        </p>
        <Link href="/products" className="text-primary text-sm underline-offset-4 hover:underline">
          Back to products
        </Link>
      </div>
    );
  }

  if (!reservation) {
    return <p className="text-muted-foreground text-sm">Loading reservation…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Hold expires automatically if payment does not complete in time.
        </p>
      </div>

      {actionError ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {actionError}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-4 shadow-xs space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Product:</span> {reservation.productName}
        </p>
        <p>
          <span className="text-muted-foreground">Warehouse:</span>{" "}
          {reservation.warehouseName}
        </p>
        <p>
          <span className="text-muted-foreground">Quantity:</span> {reservation.quantity}
        </p>
        <p>
          <span className="text-muted-foreground">Status:</span> {reservation.status}
        </p>
        {reservation.status === "PENDING" ? (
          <p>
            <span className="text-muted-foreground">Time left:</span>{" "}
            <span className="font-mono tabular-nums">{countdown}</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={
            pending ||
            reservation.status !== "PENDING" ||
            remainingMs <= 0
          }
          onClick={() =>
            void post(`/api/reservations/${reservationId}/confirm`)
          }
        >
          Confirm purchase
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending || reservation.status !== "PENDING"}
          onClick={() =>
            void post(`/api/reservations/${reservationId}/release`)
          }
        >
          Cancel
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
          Refresh state
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        <Link href="/products" className="text-primary underline-offset-4 hover:underline">
          Back to products
        </Link>
      </p>
    </div>
  );
}
