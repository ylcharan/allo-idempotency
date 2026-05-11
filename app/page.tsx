import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Allo inventory demo</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Take-home: concurrent-safe reservations, checkout flow, and automatic expiry
          cleanup.
        </p>
      </div>
      <Link
        href="/products"
        className="text-primary inline-flex w-fit text-sm font-medium underline-offset-4 hover:underline"
      >
        View products →
      </Link>
    </div>
  );
}
