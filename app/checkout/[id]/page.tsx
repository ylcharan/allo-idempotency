import { CheckoutClient } from "./checkout-client";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <CheckoutClient reservationId={id} />
    </div>
  );
}
