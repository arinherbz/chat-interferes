import { useQuery } from "@tanstack/react-query";
import { LogOut, MapPin, MessageCircle, Package, RefreshCw, Wrench } from "lucide-react";
import { useLocation } from "wouter";
import { StoreShell } from "@/components/store-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { formatUGX } from "@/lib/formatters";
import { useStoreCustomerAuth } from "@/lib/store-customer-auth";
import { createWhatsAppUrl, formatStoreStatus } from "@/lib/store-support";

export default function StoreAccountPage() {
  const { logout, customer } = useStoreCustomerAuth();
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery<{
    customer: { name: string; phone: string; email?: string | null };
    orders: Array<{ id: string; orderNumber: string; total: number; status: string; createdAt?: string }>;
    tradeIns: Array<{ id: string; tradeInNumber: string; brand: string; model: string; calculatedOffer: number; status: string; createdAt?: string }>;
    savedAddresses: string[];
  }>({
    queryKey: ["/api/store/account"],
    queryFn: () => apiRequest("GET", "/api/store/account", undefined, { skipCache: true }),
  });

  return (
    <StoreShell>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Customer Account</p>
            <h2 className="text-3xl font-semibold tracking-tight">My Account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {(customer?.name || data?.customer.name) ?? "Ariostore customer"}
              {customer?.phone || data?.customer.phone ? `, ${customer?.phone || data?.customer.phone}` : ""}
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={async () => {
              await logout();
              setLocation("/store/login", { replace: true });
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Loading your account…</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4" />Order History</CardTitle>
                  <CardDescription>Your recent online orders.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data?.orders.length ? data.orders.map((order) => (
                    <div key={order.id} className="rounded-[1rem] border border-border/70 bg-secondary/50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-950">{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "Recent order"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-950">{formatUGX(order.total)}</p>
                          <p className="text-xs text-muted-foreground">{formatStoreStatus(order.status)}</p>
                        </div>
                      </div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No orders linked to this account yet.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><RefreshCw className="h-4 w-4" />Trade-In Requests</CardTitle>
                  <CardDescription>Recent buyback and trade-in submissions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data?.tradeIns.length ? data.tradeIns.map((tradeIn) => (
                    <div key={tradeIn.id} className="rounded-[1rem] border border-border/70 bg-secondary/50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-950">{tradeIn.tradeInNumber}</p>
                          <p className="text-xs text-muted-foreground">{tradeIn.brand} {tradeIn.model}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-950">{formatUGX(tradeIn.calculatedOffer)}</p>
                          <p className="text-xs text-muted-foreground">{formatStoreStatus(tradeIn.status)}</p>
                        </div>
                      </div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No trade-in activity is linked to this account yet.</p>}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" />Saved Addresses</CardTitle>
                  <CardDescription>Delivery addresses from your previous orders.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data?.savedAddresses.length ? data.savedAddresses.map((address) => (
                    <div key={address} className="rounded-[1rem] border border-border/70 bg-secondary/50 p-4 text-sm text-slate-700">
                      {address}
                    </div>
                  )) : <p className="text-sm text-muted-foreground">Saved addresses will appear here after you place a delivery order.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4" />Repair Support</CardTitle>
                  <CardDescription>Repairs are still handled directly with the shop team.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">Need a repair update or want to confirm a device intake? We handle repair support directly on WhatsApp.</p>
                  <a href={createWhatsAppUrl("Hello Ario Store, I need help tracking my repair.")} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Contact repair support
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </StoreShell>
  );
}
