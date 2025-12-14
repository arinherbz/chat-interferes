import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/lib/auth-context";
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

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/pos" component={POSPage} />
        <Route path="/daily-close" component={DailyClose} />
        <Route path="/closures" component={ClosuresPage} /> {/* Add Route */}
        <Route path="/trade-in" component={TradeInPage} />
        
        <Route path="/products" component={ProductsPage} />
        <Route path="/devices" component={DevicesPage} />
        <Route path="/customers" component={CustomersPage} />
        <Route path="/repairs" component={RepairsPage} />
        
        <Route path="/expenses" component={ExpensesPage} />
        <Route path="/audit-logs" component={AuditLogsPage} />
        <Route path="/staff" component={StaffPage} /> {/* Add Route */}
        <Route path="/settings" component={SettingsPage} />
        
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
