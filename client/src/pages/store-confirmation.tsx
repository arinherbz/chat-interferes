import { StoreShell } from "@/components/store-shell";
import { Button } from "@/components/ui/button";

export default function StoreConfirmationPage() {
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get("order") || "Pending";
  const whatsAppMessage = encodeURIComponent(`Hello, I'm confirming order ${orderNumber}.`);

  return (
    <StoreShell>
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full rounded-[2rem] border border-border bg-card p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Order Received</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">Order {orderNumber}</h2>
          <p className="mt-3 text-muted-foreground">
            The shop team has your request. You can confirm payment or delivery details on WhatsApp using the link below.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href={`https://wa.me/256756524407?text=${whatsAppMessage}`} target="_blank" rel="noreferrer">
              <Button>Confirm on WhatsApp</Button>
            </a>
            <a href="/store/products">
              <Button variant="outline">Continue Shopping</Button>
            </a>
          </div>
        </div>
      </div>
    </StoreShell>
  );
}
