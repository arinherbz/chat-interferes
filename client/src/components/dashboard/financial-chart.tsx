import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardChartPoint } from "@/hooks/use-dashboard-metrics";

type Props = {
  isLoading: boolean;
  hasChartData: boolean;
  data: DashboardChartPoint[];
};

export function FinancialChart({ isLoading, hasChartData, data }: Props) {
  return (
    <Card className="card-lift border-slate-200 bg-white xl:col-span-2">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">Financial Performance</CardTitle>
        <CardDescription>Revenue vs Net Profit (last 7 days)</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-[280px] w-full rounded-lg" />
          </div>
        ) : (
          <div className="h-[300px] sm:h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 12, right: 20, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={62}
                  tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                />
                <Tooltip
                  cursor={{ stroke: "#cbd5e1" }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive
                  animationDuration={500}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Net Profit"
                  stroke="#334155"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive
                  animationDuration={650}
                />
              </LineChart>
            </ResponsiveContainer>
            {!hasChartData && (
              <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                No closure history yet. Placeholder trend is shown until real data is recorded.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
