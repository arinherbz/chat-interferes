import { useData } from "@/lib/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";
import { AlertCircle, CheckCircle, TrendingUp, DollarSign, FileText, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { closures, alerts, updateClosureStatus } = useData();

  // Calculate summary stats
  const totalVariance = closures.reduce((acc, curr) => acc + curr.variance, 0);
  const flaggedCount = closures.filter(c => c.status === "flagged").length;
  const pendingCount = closures.filter(c => c.status === "pending").length;

  // Chart data preparation
  const chartData = [...closures].reverse().map(c => ({
    date: format(new Date(c.date), 'MMM dd'),
    expected: c.cashExpected,
    actual: c.cashCounted + c.mtnAmount + c.airtelAmount,
    variance: c.variance
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Owner Dashboard</h1>
          <p className="text-slate-500">Overview of shop performance and alerts.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline">Export Report</Button>
           <Button>Add Shop</Button>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="grid gap-4">
          {alerts.map(alert => (
            <div key={alert.id} className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Action Required: {alert.type.replace('_', ' ')}</h3>
                <p className="text-red-700 text-sm">{alert.message}</p>
              </div>
              <Button size="sm" variant="destructive" className="h-8">Resolve</Button>
            </div>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Variance (7d)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalVariance < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {totalVariance.toLocaleString()} UGX
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalVariance < 0 ? (
                <span className="flex items-center text-red-500"><ArrowDownRight className="w-3 h-3 mr-1" /> Loss detected</span>
              ) : (
                <span className="flex items-center text-green-500"><ArrowUpRight className="w-3 h-3 mr-1" /> Net positive</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flagged Closures</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{flaggedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Submissions today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">98%</div>
            <p className="text-xs text-muted-foreground mt-1">On-time submissions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        {/* Main Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Cash Flow Trend</CardTitle>
            <CardDescription>Expected vs Actual cash collected over the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="expected" fill="hsl(var(--primary) / 0.3)" radius={[4, 4, 0, 0]} name="Expected" />
                  <Bar dataKey="actual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Actual" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Closures List */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Closures</CardTitle>
            <CardDescription>Latest submissions from staff.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {closures.slice(0, 5).map(closure => (
                <div key={closure.id} className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${closure.status === 'flagged' ? 'bg-red-500' : closure.status === 'confirmed' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{format(new Date(closure.date), 'MMM dd, yyyy')}</p>
                      <p className="text-xs text-slate-500">{closure.submittedBy}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">
                      {(closure.cashCounted + closure.mtnAmount + closure.airtelAmount).toLocaleString()}
                    </p>
                    {closure.variance !== 0 && (
                      <p className={`text-xs ${closure.variance < 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {closure.variance > 0 ? '+' : ''}{closure.variance.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
