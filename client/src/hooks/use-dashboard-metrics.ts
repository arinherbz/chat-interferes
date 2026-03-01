import { useMemo } from "react";
import { format, subDays } from "date-fns";
import type { Customer, DailyClosure, Expense, Product, Repair } from "@/lib/data-context";

export type DashboardChartPoint = {
  date: string;
  revenue: number;
  profit: number;
};

export function useDashboardMetrics(input: {
  closures: DailyClosure[];
  customers: Customer[];
  products: Product[];
  expenses: Expense[];
  repairs: Repair[];
}) {
  const { closures, customers, products, expenses, repairs } = input;

  return useMemo(() => {
    const totalSalesRevenue = closures.reduce((acc, closure) => {
      return acc + (closure.sales?.reduce((saleAcc, sale) => saleAcc + sale.totalPrice, 0) || 0);
    }, 0);
    const totalRepairRevenue = repairs.reduce((acc, repair) => acc + repair.price, 0);
    const totalRevenue = totalSalesRevenue + totalRepairRevenue;
    const totalExpenses = expenses.reduce((acc, expense) => acc + expense.amount, 0);

    const cogs = totalSalesRevenue * 0.7;
    const repairParts = totalRepairRevenue * 0.3;
    const netProfit = totalRevenue - cogs - repairParts - totalExpenses;

    const lowStockProducts = products.filter((product) => product.stock <= product.minStock);
    const pendingRepairs = repairs.filter((repair) => repair.status === "Pending" || repair.status === "In Progress").length;
    const followUpsOverdue = repairs.filter((repair) => {
      const isOpen = repair.status === "Pending" || repair.status === "In Progress";
      return isOpen && (Date.now() - new Date(repair.createdAt).getTime()) > 1000 * 60 * 60 * 24 * 2;
    }).length;
    const deliveriesPending = repairs.filter((repair) => repair.status === "Completed").length;
    const flaggedClosures = closures.filter((closure) => closure.status === "flagged").length;

    const chartData: DashboardChartPoint[] = [...closures]
      .sort((a, b) => +new Date(a.date) - +new Date(b.date))
      .slice(-7)
      .map((closure) => {
        const revenue =
          (closure.sales?.reduce((acc, sale) => acc + sale.totalPrice, 0) || 0) +
          (closure.repairs?.reduce((acc, repair) => acc + repair.price, 0) || 0);
        const closureExpense = closure.expensesTotal || 0;
        const profit = Math.max(revenue * 0.3 - closureExpense, 0);
        return {
          date: format(new Date(closure.date), "MMM dd"),
          revenue,
          profit,
        };
      });

    const placeholderChartData: DashboardChartPoint[] = Array.from({ length: 7 }, (_, idx) => {
      const date = format(subDays(new Date(), 6 - idx), "MMM dd");
      return { date, revenue: 0, profit: 0 };
    });

    const topProducts = [...products]
      .sort((a, b) => b.price * b.stock - a.price * a.stock)
      .slice(0, 4);

    return {
      totalRevenue,
      netProfit,
      totalExpenses,
      activeCustomers: customers.length,
      lowStockProducts,
      pendingRepairs,
      followUpsOverdue,
      deliveriesPending,
      flaggedClosures,
      topProducts,
      chartData,
      chartSeries: chartData.length > 0 ? chartData : placeholderChartData,
      hasChartData: chartData.length > 0,
    };
  }, [closures, customers, expenses, products, repairs]);
}
