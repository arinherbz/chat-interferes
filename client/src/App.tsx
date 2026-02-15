import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth, type UserRole } from "@/lib/auth-context";
import { DataProvider } from "@/lib/data-context";
import Layout from "@/components/layout";
import Login from "@/pages/login";
import DailyClose from "@/pages/daily-close";
import Dashboard from "@/pages/dashboard";
import ProductsPage from "@/pages/products";
import CustomersPage from "@/pages/customers";
import RepairsPage from "@/pages/repairs";
import DevicesPage from "@/pages/devices";
import ExpensesPage from "@/pages/expenses";
import POSPage from "@/pages/pos";
import SettingsPage from "@/pages/settings";
import StaffPage from "@/pages/staff"; // Import StaffPage
import ClosuresPage from "@/pages/closures"; // Import ClosuresPage
import AuditLogsPage from "@/pages/audit-logs";
import TradeInPage from "@/pages/trade-in";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import BaseValuesPage from "@/pages/base-values";
import LeadsPage from "@/pages/leads";
import ShopSettingsPage from "@/pages/shop-settings/[id]";

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType<any>; roles?: UserRole[] }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/");
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Loading your session...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md bg-white shadow-sm rounded-xl border border-slate-200 p-6 text-center space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Access restricted</h2>
          <p className="text-slate-500 text-sm">You do not have permission to view this area. Please contact the owner.</p>
        </div>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/dashboard" component={() => <ProtectedRoute roles={["Owner", "Manager"]} component={Dashboard} />} />
        <Route path="/pos" component={() => <ProtectedRoute roles={["Owner", "Manager", "Sales"]} component={POSPage} />} />
        <Route path="/daily-close" component={() => <ProtectedRoute roles={["Owner", "Manager", "Sales"]} component={DailyClose} />} />
        <Route path="/closures" component={() => <ProtectedRoute roles={["Owner", "Manager"]} component={ClosuresPage} />} />
        <Route path="/trade-in" component={() => <ProtectedRoute roles={["Owner", "Manager", "Sales"]} component={TradeInPage} />} />
        
        <Route path="/products" component={() => <ProtectedRoute roles={["Owner", "Manager"]} component={ProductsPage} />} />
        <Route path="/devices" component={() => <ProtectedRoute roles={["Owner", "Manager", "Sales"]} component={DevicesPage} />} />
        <Route path="/customers" component={() => <ProtectedRoute roles={["Owner", "Manager", "Sales"]} component={CustomersPage} />} />
        <Route path="/repairs" component={() => <ProtectedRoute roles={["Owner", "Manager", "Sales"]} component={RepairsPage} />} />
        <Route path="/leads" component={() => <ProtectedRoute roles={["Owner", "Manager", "Sales"]} component={LeadsPage} />} />
        
        <Route path="/expenses" component={() => <ProtectedRoute roles={["Owner", "Manager"]} component={ExpensesPage} />} />
        <Route path="/audit-logs" component={() => <ProtectedRoute roles={["Owner", "Manager"]} component={AuditLogsPage} />} />
        <Route path="/staff" component={() => <ProtectedRoute roles={["Owner"]} component={StaffPage} />} />
        <Route path="/settings" component={() => <ProtectedRoute roles={["Owner", "Manager"]} component={SettingsPage} />} />
        <Route path="/base-values" component={() => <ProtectedRoute roles={["Owner", "Manager"]} component={BaseValuesPage} />} />
        <Route path="/shop-settings/:id" component={() => <ProtectedRoute roles={["Owner", "Manager"]} component={ShopSettingsPage} />} />
        
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DataProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </DataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
