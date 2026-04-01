import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatUGX } from "@/lib/utils";

type Delivery = {
  id: string;
  status: string;
  address: string;
  scheduledAt?: string | null;
  failureReason?: string | null;
  assignedRiderId?: string | null;
  order?: { id: string; orderNumber: string; customerName: string; total: number };
};

type StaffMember = { id: string; name: string; role: string };

export default function DeliveriesPage() {
  const queryClient = useQueryClient();
  const { data: deliveries = [] } = useQuery<Delivery[]>({
    queryKey: ["/api/deliveries"],
    queryFn: () => apiRequest("GET", "/api/deliveries"),
    refetchInterval: 15000,
  });
  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff", "delivery"],
    queryFn: async () => {
      try {
        return await apiRequest("GET", "/api/staff");
      } catch {
        return [];
      }
    },
  });

  const assign = useMutation({
    mutationFn: ({ deliveryId, assignedRiderId }: { deliveryId: string; assignedRiderId: string }) =>
      apiRequest("POST", `/api/deliveries/${deliveryId}/assign`, { assignedRiderId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/deliveries"] }),
  });

  const markDelivered = useMutation({
    mutationFn: (deliveryId: string) => apiRequest("PATCH", `/api/deliveries/${deliveryId}/status`, { status: "DELIVERED" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/deliveries"] }),
  });

  const metrics = useMemo(() => {
    const delivered = deliveries.filter((item) => item.status === "DELIVERED").length;
    const failed = deliveries.filter((item) => item.status === "FAILED").length;
    return {
      perDay: deliveries.length,
      averageTime: deliveries.some((item) => item.scheduledAt) ? "Tracked from scheduled time" : "Pending more data",
      failureRate: deliveries.length > 0 ? `${Math.round((failed / deliveries.length) * 100)}%` : "0%",
      delivered,
    };
  }, [deliveries]);

  return (
    <div className="page-shell">
      <section className="page-hero">
        <p className="page-kicker">Management</p>
        <h1 className="page-title">Deliveries</h1>
        <p className="page-subtitle">Today's queue, assignments, overdue work, and a map placeholder for last-mile operations.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Today's Deliveries", value: String(deliveries.length) },
          { label: "Completed", value: String(metrics.delivered) },
          { label: "Average Time", value: metrics.averageTime },
          { label: "Failure Rate", value: metrics.failureRate },
        ].map((card) => (
          <Card key={card.label} className="stat-card">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="surface-panel">
          <CardHeader><CardTitle>Queue View</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {deliveries.map((delivery) => (
              <div key={delivery.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{delivery.order?.orderNumber || "Order pending"}</p>
                    <h3 className="font-medium">{delivery.order?.customerName || "Customer"}</h3>
                    <p className="text-sm text-muted-foreground">{delivery.address}</p>
                    <p className="mt-1 text-sm font-medium">{delivery.status.replaceAll("_", " ")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select onValueChange={(assignedRiderId) => assign.mutate({ deliveryId: delivery.id, assignedRiderId })}>
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="Assign rider" />
                      </SelectTrigger>
                      <SelectContent>
                        {staff.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => markDelivered.mutate(delivery.id)}>Mark Delivered</Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader><CardTitle>Map Placeholder</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex min-h-[260px] items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-secondary text-center text-sm text-muted-foreground">
              Embed Google Maps or Mapbox here with a delivery drop pin based on the selected address.
            </div>
            <div className="rounded-2xl bg-secondary p-4 text-sm">
              <p className="font-medium">Delivery totals in queue</p>
              <p className="mt-1 text-muted-foreground">{formatUGX(deliveries.reduce((sum, item) => sum + (item.order?.total || 0), 0))}</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
