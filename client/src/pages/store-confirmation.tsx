import { readLastStoreOrder } from "@/lib/store-cart";
import { Link } from "wouter";
import { StoreShell } from "@/components/store-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatUGX } from "@/lib/formatters";

export default function StoreConfirmationPage() {
  const order = readLastStoreOrder();

  return (
    <StoreShell>
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full rounded-[2rem] border border-border bg-card p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Order Received</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">Thank You!</h2>
          <p className="mt-3 text-muted-foreground">Your order has been received. We'll confirm it shortly.</p>
          {order ? (
            <Card className="mt-6 text-left">
              <CardContent className="space-y-2 p-5">
                <p className="text-sm"><span className="text-muted-foreground">Order Number:</span> <span className="font-medium">{order.orderNumber}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">Status:</span> <span className="font-medium">{order.status}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">Total:</span> <span className="font-medium">{formatUGX(order.totalAmount)}</span></p>
                {order.estimatedDelivery ? <p className="text-sm"><span className="text-muted-foreground">Estimate:</span> <span className="font-medium">{order.estimatedDelivery}</span></p> : null}
              </CardContent>
            </Card>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/store/products">
              <Button>Continue Shopping</Button>
            </Link>
            <Link href="/store/track">
              <Button variant="outline">Track Order</Button>
            </Link>
            {order?.whatsappUrl ? (
              <a href={order.whatsappUrl} target="_blank" rel="noreferrer">
                <Button variant="outline">Open WhatsApp</Button>
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </StoreShell>
  );
}
