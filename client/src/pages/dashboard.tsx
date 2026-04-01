import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Download, Store } from "lucide-react";
import { useData } from "@/lib/data-context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { AlertsBar } from "@/components/dashboard/alerts-bar";
import { FinancialChart } from "@/components/dashboard/financial-chart";
import { InventoryActionsPanel } from "@/components/dashboard/inventory-actions-panel";
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { formatUGX } from "@/lib/utils";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { closures, customers, products, shops, activeShopId, setActiveShopId, expenses, repairs } = useData();
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [days, setDays] = useState("7");

  useEffect(() => {
    const t = setTimeout(() => setIsBootLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const metrics = useDashboardMetrics({
    closures,
    customers,
    products,
    expenses,
    repairs,
  });

  const { data: onlineMetrics } = useQuery<any>({
    queryKey: ["/api/dashboard/metrics", activeShopId, days],
    queryFn: () => apiRequest("GET", `/api/dashboard/metrics?shopId=${activeShopId}&days=${days}`),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Executive Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Live operational and financial view across your active shop.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-full sm:w-[160px] bg-white transition-colors hover:border-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activeShopId} onValueChange={setActiveShopId}>
            <SelectTrigger className="w-full sm:w-[220px] bg-white transition-colors hover:border-slate-300">
              <Store className="mr-2 h-4 w-4 text-slate-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {shops.map((shop) => (
                <SelectItem key={shop.id} value={shop.id}>
                  {shop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="bg-white" onClick={() => window.print()}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </section>

      <KpiGrid
        isLoading={isBootLoading}
        totalRevenue={metrics.totalRevenue}
        netProfit={metrics.netProfit}
        totalExpenses={metrics.totalExpenses}
        activeCustomers={metrics.activeCustomers}
        pendingRepairs={metrics.pendingRepairs}
        followUpsOverdue={metrics.followUpsOverdue}
        deliveriesPending={metrics.deliveriesPending}
        flaggedClosures={metrics.flaggedClosures}
      />

      <AlertsBar
        lowStockCount={metrics.lowStockProducts.length}
        pendingRepairs={metrics.pendingRepairs}
        onViewStock={() => navigate("/products")}
        onOpenRepairs={() => navigate("/repairs")}
      />

      <section className="grid gap-4 xl:grid-cols-3">
        <FinancialChart isLoading={isBootLoading} hasChartData={metrics.hasChartData} data={metrics.chartSeries} />
        <InventoryActionsPanel
          topProducts={metrics.topProducts}
          onNewSale={() => navigate("/pos")}
          onNewRepair={() => navigate("/repairs")}
          onDailyClose={() => navigate("/daily-close")}
          onCustomers={() => navigate("/customers")}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Orders Today", value: String(onlineMetrics?.ordersTodayCount ?? 0), meta: formatUGX(onlineMetrics?.ordersTodayValue ?? 0) },
          { label: "Pending Deliveries", value: String(onlineMetrics?.pendingDeliveries ?? 0), meta: `${onlineMetrics?.overdueDeliveries ?? 0} overdue` },
          { label: "Completion Rate", value: `${onlineMetrics?.deliveryCompletionRate ?? 0}%`, meta: "Last selected window" },
          { label: "Online Revenue", value: formatUGX((onlineMetrics?.revenueByChannel || []).find((row: any) => row.channel === "Online Store")?.value || 0), meta: "Storefront only" },
        ].map((item) => (
          <Card key={item.label} className="stat-card">
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
              <p className="mt-1 text-xs text-slate-500">{item.meta}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
