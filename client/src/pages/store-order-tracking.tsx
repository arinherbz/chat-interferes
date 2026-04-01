import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StoreShell } from "@/components/store-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";
import { formatUGX } from "@/lib/utils";

type OrderTracking = {
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    subtotal: number;
    deliveryFee: number;
    total: number;
    paymentMethod: string;
    paymentStatus: string;
    status: string;
    deliveryType: string;
    deliveryAddress: string;
    notes: string;
    createdAt: string;
  };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  delivery?: {
    status: string;
    address: string;
    scheduledAt?: string;
    pickedUpAt?: string;
    deliveredAt?: string;
    failureReason?: string;
  };
};

export default function StoreOrderTrackingPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [trackingOrderNumber, setTrackingOrderNumber] = useState("");

  const { data, isLoading, error } = useQuery<OrderTracking>({
    queryKey: ["/api/store/orders/track", trackingOrderNumber],
    enabled: !!trackingOrderNumber,
    queryFn: () => apiRequest("GET", `/api/store/orders/track/${trackingOrderNumber}`),
  });

  const handleTrack = () => {
    if (orderNumber.trim()) {
      setTrackingOrderNumber(orderNumber.trim());
    }
  };

  return (
    <StoreShell>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Order Tracking</p>
          <h2 className="text-3xl font-semibold tracking-tight">Track your order status.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your order number to check delivery status and order details.
          </p>
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
                  onKeyPress={(e) => e.key === "Enter" && handleTrack()}
                />
                <Button onClick={handleTrack} disabled={!orderNumber.trim()}>
                  Track Order
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Loading order details...</p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card>
            <CardContent className="p-6">
              <p className="text-red-600">Order not found. Please check your order number and try again.</p>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Order {data.order.orderNumber}</h3>
                    <p className="text-sm text-muted-foreground">
                      Placed on {new Date(data.order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Status: {data.order.status}</p>
                    <p className="text-sm text-muted-foreground">Payment: {data.order.paymentStatus}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Customer Details</h4>
                    <p className="text-sm">{data.order.customerName}</p>
                    <p className="text-sm">{data.order.customerPhone}</p>
                    {data.order.customerEmail && <p className="text-sm">{data.order.customerEmail}</p>}
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Delivery Details</h4>
                    <p className="text-sm">{data.order.deliveryType}</p>
                    {data.order.deliveryAddress && <p className="text-sm">{data.order.deliveryAddress}</p>}
                    {data.delivery && (
                      <p className="text-sm">Delivery Status: {data.delivery.status}</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Order Items</h4>
                  <div className="space-y-2">
                    {data.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.productName} x{item.quantity}</span>
                        <span>{formatUGX(item.total)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border-t pt-4">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatUGX(data.order.subtotal)}</span>
                    </div>
                    {data.order.deliveryFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Delivery Fee</span>
                        <span>{formatUGX(data.order.deliveryFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>{formatUGX(data.order.total)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </StoreShell>
  );
}