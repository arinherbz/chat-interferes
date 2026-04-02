import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StoreShell } from "@/components/store-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";
import { formatUGX } from "@/lib/formatters";
import { createWhatsAppUrl, formatStoreStatus } from "@/lib/store-support";

export default function StoreOrderTrackingPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState("");

  const { data, isLoading, error } = useQuery<{
    orderNumber: string;
    status: string;
    totalAmount: number;
    paymentMethod: string;
    items: Array<{ productName: string; quantity: number; total: number }>;
    delivery: null | { status: string; address: string; scheduledAt?: string };
  }>({
    queryKey: [`/api/store/orders/track/${submittedOrderNumber}`],
    queryFn: () => apiRequest("GET", `/api/store/orders/track/${encodeURIComponent(submittedOrderNumber)}`),
    enabled: submittedOrderNumber.trim().length > 0,
    retry: false,
  });

  return (
    <StoreShell>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Track Your Order</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enter your order number to check the status.</p>
        </div>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-2">
              <Label>Order Number</Label>
              <div className="flex gap-2">
                <Input
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="Enter your order number"
                />
                <Button disabled={!orderNumber.trim()} onClick={() => setSubmittedOrderNumber(orderNumber.trim())}>Track</Button>
              </div>
            </div>
            {isLoading ? <p className="text-sm text-muted-foreground">Checking order status...</p> : null}
            {error ? <p className="text-sm text-red-600">Order not found. Confirm the order number and try again.</p> : null}
            {data ? (
              <div className="space-y-4 rounded-2xl border border-border/70 bg-secondary/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Order</p>
                    <p className="text-lg font-semibold">{data.orderNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</p>
                    <p className="text-lg font-semibold">{formatStoreStatus(data.status)}</p>
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <div>Total: {formatUGX(data.totalAmount)}</div>
                  <div>Payment: {data.paymentMethod}</div>
                  <div>Items: {data.items.map((item) => `${item.productName} x${item.quantity}`).join(", ")}</div>
                  {data.delivery ? <div>Delivery: {formatStoreStatus(data.delivery.status)} to {data.delivery.address}</div> : <div>Delivery: Awaiting assignment</div>}
                </div>
              </div>
            ) : null}
            <div className="rounded-[1rem] border border-border/70 bg-white/90 p-4 text-sm text-muted-foreground">
              Need help with this order?{" "}
              <a className="font-medium text-primary" href={createWhatsAppUrl("Hello Ario Store, I need help with my order.")} target="_blank" rel="noreferrer">
                Chat with us on WhatsApp
              </a>
              .
            </div>
          </CardContent>
        </Card>
      </div>
    </StoreShell>
  );
}
