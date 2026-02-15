import { useData } from "@/lib/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { AlertCircle, CheckCircle, TrendingUp, DollarSign, FileText, ArrowUpRight, ArrowDownRight, Wrench, ShoppingCart, Users, AlertTriangle, Store, Download, Wallet, Trophy, Clock3, Truck } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { closures, customers, products, shops, activeShopId, setActiveShopId, expenses, repairs, sales } = useData();
  const { toast } = useToast();

  const handleExport = () => {
    window.print();
  };

  // --- KPI CALCULATIONS ---
  
  // 1. Total Revenue (Sales + Repairs)
  const totalSalesRevenue = closures.reduce((acc, curr) => {
    return acc + (curr.sales?.reduce((sAcc, s) => sAcc + s.totalPrice, 0) || 0);
  }, 0);
  
  const totalRepairRevenue = repairs.reduce((acc, r) => acc + r.price, 0); // Simplified for demo
  const totalRevenue = totalSalesRevenue + totalRepairRevenue;

  // 2. Total Expenses
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

  // 3. Net Profit
  // Assuming 20% cost of goods for sales (mock) and 30% parts cost for repairs
  const cogs = totalSalesRevenue * 0.7; 
  const repairParts = totalRepairRevenue * 0.3;
  const netProfit = totalRevenue - cogs - repairParts - totalExpenses;

  // 4. Alerts
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const pendingRepairs = repairs.filter(r => r.status === "Pending" || r.status === "In Progress").length;

  const salesByStaff = sales.reduce((acc, sale) => {
    const owner = sale.soldBy || "Unassigned";
    const existing = acc[owner] || { amount: 0, count: 0 };
    existing.amount += sale.totalAmount;
    existing.count += 1;
    acc[owner] = existing;
    return acc;
  }, {} as Record<string, { amount: number; count: number }>);

  const staffRanking = Object.entries(salesByStaff)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  const followUpsOverdue = repairs.filter(r => (r.status === "Pending" || r.status === "In Progress") && (new Date().getTime() - new Date(r.createdAt).getTime()) > 1000 * 60 * 60 * 24 * 2).length;
  const deliveriesPending = repairs.filter(r => r.status === "Completed").length;
  const failedDeliveries = closures.filter(c => c.status === "flagged").length;
  
  // Chart data preparation
  const chartData = [...closures].reverse().map(c => ({
    date: format(new Date(c.date), 'MMM dd'),
    revenue: (c.sales?.reduce((acc, s) => acc + s.totalPrice, 0) || 0) + (c.repairs?.reduce((acc, r) => acc + r.price, 0) || 0),
    expenses: 150000, // Mock fixed daily expense
    profit: ((c.sales?.reduce((acc, s) => acc + s.totalPrice, 0) || 0) * 0.3) // Mock profit margin
  }));

  // Top products
  const topProducts = [...products].sort((a, b) => b.price - a.price).slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Owner Dashboard</h1>
          <p className="text-slate-500">Real-time overview of business performance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
           <Select value={activeShopId} onValueChange={setActiveShopId}>
             <SelectTrigger className="w-[200px] bg-white">
               <Store className="w-4 h-4 mr-2 text-slate-500" />
               <SelectValue />
             </SelectTrigger>
             <SelectContent>
               {shops.map(shop => (
                 <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
               ))}
             </SelectContent>
           </Select>
           <Button variant="outline" onClick={handleExport} className="bg-white">
             <Download className="w-4 h-4 mr-2" />
             Export
           </Button>
        </div>
      </div>

      {/* Actionable Alerts Bar */}
      {(lowStockProducts.length > 0 || pendingRepairs > 5) && (
        <div className="grid gap-4 md:grid-cols-2">
          {lowStockProducts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                   <h3 className="font-semibold text-amber-900">{lowStockProducts.length} Items Low on Stock</h3>
                   <p className="text-sm text-amber-700">Iphones and Accessories need restocking.</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-100">Restock</Button>
            </div>
          )}
          {pendingRepairs > 0 && (
             <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                   <h3 className="font-semibold text-blue-900">{pendingRepairs} Pending Repairs</h3>
                   <p className="text-sm text-blue-700">Technician attention required.</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-100">View Jobs</Button>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalRevenue.toLocaleString()} <span className="text-sm font-normal text-slate-400">UGX</span></div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <ArrowUpRight className="w-3 h-3 mr-1" /> +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Net Profit (Est.)</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {netProfit.toLocaleString()} <span className="text-sm font-normal text-slate-400">UGX</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">After expenses & COGS</p>
          </CardContent>
        </Card>
        
        <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Expenses</CardTitle>
            <Wallet className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalExpenses.toLocaleString()} <span className="text-sm font-normal text-slate-400">UGX</span></div>
            <p className="text-xs text-red-500 flex items-center mt-1">
               <ArrowUpRight className="w-3 h-3 mr-1" /> +5% vs avg
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{customers.length}</div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <ArrowUpRight className="w-3 h-3 mr-1" /> +4 new this week
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Sales per Staff</CardTitle>
            <ShoppingCart className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-2">
            {staffRanking.map((staff) => (
              <div key={staff.name} className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">{staff.name}</span>
                <span className="text-slate-500">{staff.count} sale(s) · {staff.amount.toLocaleString()} UGX</span>
              </div>
            ))}
            {staffRanking.length === 0 && (
              <p className="text-sm text-slate-500">No sales recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Productivity Ranking</CardTitle>
            <Trophy className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {staffRanking.map((staff, index) => (
                <div key={staff.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 flex items-center justify-center">{index + 1}</Badge>
                    <span className="font-medium text-slate-800">{staff.name}</span>
                  </div>
                  <span className="text-slate-500">{staff.amount.toLocaleString()} UGX</span>
                </div>
              ))}
              {staffRanking.length === 0 && <p className="text-sm text-slate-500">No activity yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Follow-ups Overdue</CardTitle>
            <Clock3 className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${followUpsOverdue > 0 ? "text-red-600" : "text-green-600"}`}>
              {followUpsOverdue}
            </div>
            <p className="text-xs text-slate-500">Repairs waiting over 48 hours.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Deliveries</CardTitle>
            <Truck className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between text-sm text-slate-700">
              <span>Pending handover</span>
              <span className="font-semibold">{deliveriesPending}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-700">
              <span>Failed / flagged</span>
              <span className={`font-semibold ${failedDeliveries > 0 ? "text-red-600" : "text-green-600"}`}>{failedDeliveries}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        {/* Main Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Financial Performance</CardTitle>
            <CardDescription>Revenue vs Profit Trends (Last 7 Days)</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" name="Net Profit" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Inventory & Quick Actions */}
        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Inventory Value</CardTitle>
              <CardDescription>High-value assets currently in stock.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map(p => (
                   <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                          <ShoppingCart className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{p.name}</span>
                          <span className="text-xs text-slate-500">Qty: {p.stock}</span>
                        </div>
                      </div>
                      <div className="text-right font-medium">
                         {p.price.toLocaleString()}
                      </div>
                   </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white border-none">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
               <Button variant="secondary" className="w-full justify-start" onClick={() => window.location.href='/pos'}>
                 <ShoppingCart className="w-4 h-4 mr-2" /> New Sale
               </Button>
               <Button variant="secondary" className="w-full justify-start" onClick={() => window.location.href='/repairs'}>
                 <Wrench className="w-4 h-4 mr-2" /> New Repair
               </Button>
               <Button variant="secondary" className="w-full justify-start" onClick={() => window.location.href='/daily-close'}>
                 <CheckCircle className="w-4 h-4 mr-2" /> Daily Close
               </Button>
               <Button variant="secondary" className="w-full justify-start" onClick={() => window.location.href='/expenses'}>
                 <Wallet className="w-4 h-4 mr-2" /> Expense
               </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
