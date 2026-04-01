import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatUGX } from "@/lib/utils";

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: number;
  status: string;
  paymentStatus: string;
  deliveryType: string;
  deliveryAddress?: string | null;
  items: Array<{ id: string; productName: string; quantity: number; total: number; imei?: string | null }>;
  delivery?: { id: string; status: string; assignedRiderId?: string | null };
};

export default function OrdersPage() {
  const [status, setStatus] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders", status],
    queryFn: () => apiRequest("GET", `/api/orders${status !== "all" ? `?status=${status}` : ""}`),
    refetchInterval: 15000,
  });

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || orders[0];

  const updateStatus = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: string }) =>
      apiRequest("PATCH", `/api/orders/${id}/status`, { status: nextStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
  });

  return (
    <div className="page-shell">
      <section className="page-hero">
        <p className="page-kicker">Management</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title">Orders</h1>
            <p className="page-subtitle">Online and assigned orders with payment, delivery, and fulfillment context.</p>
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full lg:w-56 bg-white"><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>
              {["all", "PENDING", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"].map((item) => (
                <SelectItem key={item} value={item}>{item === "all" ? "All statuses" : item.replaceAll("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="surface-panel">
          <CardHeader><CardTitle>Orders Queue</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {orders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelectedOrderId(order.id)}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedOrder?.id === order.id ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-secondary"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{order.orderNumber}</p>
                    <h3 className="font-medium">{order.customerName}</h3>
                    <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{order.status.replaceAll("_", " ")}</Badge>
                    <p className="mt-2 font-semibold">{formatUGX(order.total)}</p>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader><CardTitle>Order Detail</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {!selectedOrder ? <p className="text-sm text-muted-foreground">No orders found.</p> : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{selectedOrder.orderNumber}</p>
                    <h3 className="text-xl font-semibold">{selectedOrder.customerName}</h3>
                  </div>
                  <Button asChild variant="outline">
                    <a href={`/api/orders/${selectedOrder.id}/receipt`} target="_blank" rel="noreferrer">Open Receipt</a>
                  </Button>
                </div>
                <div className="grid gap-3 rounded-2xl bg-secondary p-4 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Payment</span><span>{selectedOrder.paymentStatus}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Delivery</span><span>{selectedOrder.deliveryType}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Address</span><span className="text-right">{selectedOrder.deliveryAddress || "Pickup at store"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Delivery Status</span><span>{selectedOrder.delivery?.status || "Not assigned"}</span></div>
                </div>
                <div className="space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">Qty {item.quantity}{item.imei ? ` • IMEI ${item.imei}` : ""}</p>
                      </div>
                      <span className="font-semibold">{formatUGX(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {["CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"].map((nextStatus) => (
                    <Button key={nextStatus} variant="outline" onClick={() => updateStatus.mutate({ id: selectedOrder.id, nextStatus })}>
                      Mark {nextStatus.replaceAll("_", " ")}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
