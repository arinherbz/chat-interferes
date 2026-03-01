import { ArrowDownRight, ArrowUpRight, Truck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "./animated-number";

type Props = {
  isLoading: boolean;
  totalRevenue: number;
  netProfit: number;
  totalExpenses: number;
  activeCustomers: number;
  pendingRepairs: number;
  followUpsOverdue: number;
  deliveriesPending: number;
  flaggedClosures: number;
};

export function KpiGrid(props: Props) {
  const {
    isLoading,
    totalRevenue,
    netProfit,
    totalExpenses,
    activeCustomers,
    pendingRepairs,
    followUpsOverdue,
    deliveriesPending,
    flaggedClosures,
  } = props;

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="card-lift border-slate-200 bg-white xl:col-span-2">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Revenue</CardTitle>
            <CardDescription className="text-xs">Sales + repairs across recorded closures</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoading ? (
              <Skeleton className="h-12 w-56" />
            ) : (
              <div className="flex items-end gap-2">
                <div className="text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
                  <AnimatedNumber value={totalRevenue} />
                </div>
                <span className="pb-1 text-xs font-medium uppercase tracking-wide text-slate-500">UGX</span>
              </div>
            )}
            <p className="mt-3 flex items-center gap-1 text-xs text-primary">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Revenue health: {totalRevenue > 0 ? "Active" : "No transactions yet"}
            </p>
          </CardContent>
        </Card>

        <Card className="card-lift border-slate-200 bg-white">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">Net Profit (Est.)</CardTitle>
            <CardDescription className="text-xs">After estimated COGS and expenses</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoading ? (
              <Skeleton className="h-9 w-36" />
            ) : (
              <div className={`text-4xl font-bold ${netProfit >= 0 ? "text-slate-900" : "text-rose-600"}`}>
                <AnimatedNumber value={netProfit} /> <span className="text-xs font-medium uppercase tracking-wide text-slate-500">UGX</span>
              </div>
            )}
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              {netProfit >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 text-rose-600" />
              )}
              {netProfit >= 0 ? "Operating above break-even" : "Operating below break-even"}
            </p>
          </CardContent>
        </Card>

        <Card className="card-lift border-slate-200 bg-white">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Expenses</CardTitle>
            <CardDescription className="text-xs">Logged operational spend</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoading ? (
              <Skeleton className="h-9 w-36" />
            ) : (
              <div className="text-4xl font-bold text-slate-900">
                <AnimatedNumber value={totalExpenses} /> <span className="text-xs font-medium uppercase tracking-wide text-slate-500">UGX</span>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">Keep this below gross margin growth.</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="card-lift border-slate-200 bg-white">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">Active Customers</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-4xl font-bold text-slate-900">{activeCustomers}</div>
          </CardContent>
        </Card>
        <Card className="card-lift border-slate-200 bg-white">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">Pending Repairs</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-4xl font-bold text-slate-900">{pendingRepairs}</div>
          </CardContent>
        </Card>
        <Card className="card-lift border-slate-200 bg-white">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">Overdue Follow-ups</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={`text-4xl font-bold ${followUpsOverdue > 0 ? "text-rose-600" : "text-slate-900"}`}>
              {followUpsOverdue}
            </div>
          </CardContent>
        </Card>
        <Card className="card-lift border-slate-200 bg-white">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">Deliveries / Flags</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center justify-between text-sm text-slate-700">
              <span className="inline-flex items-center gap-1">
                <Truck className="h-4 w-4 text-slate-500" /> Pending
              </span>
              <span className="font-semibold">{deliveriesPending}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-slate-700">
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Flagged
              </span>
              <span className={`font-semibold ${flaggedClosures > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {flaggedClosures}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
