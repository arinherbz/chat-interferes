import React, { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, type UserRole } from "@/lib/auth-context";
import { DataProvider } from "@/lib/data-context";
import Layout from "@/components/layout";
import { Loader2 } from "lucide-react";

const NotFound = lazy(() => import("@/pages/not-found"));
const Login = lazy(() => import("@/pages/login"));
const DailyClose = lazy(() => import("@/pages/daily-close"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const ProductsPage = lazy(() => import("@/pages/products"));
const CustomersPage = lazy(() => import("@/pages/customers"));
const RepairsPage = lazy(() => import("@/pages/repairs"));
const DevicesPage = lazy(() => import("@/pages/devices"));
const ExpensesPage = lazy(() => import("@/pages/expenses"));
const POSPage = lazy(() => import("@/pages/pos"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const StaffPage = lazy(() => import("@/pages/staff"));
const ClosuresPage = lazy(() => import("@/pages/closures"));
const AuditLogsPage = lazy(() => import("@/pages/audit-logs"));
const TradeInPage = lazy(() => import("@/pages/trade-in"));
const BaseValuesPage = lazy(() => import("@/pages/base-values"));
const LeadsPage = lazy(() => import("@/pages/leads"));
const ShopSettingsPage = lazy(() => import("@/pages/shop-settings/[id]"));

function AppShellFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span>Loading workspace...</span>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error("UI boundary captured:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
            <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
            <p className="mt-2 text-sm text-slate-500">Please refresh the page. If it persists, contact your admin.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType<any>; roles?: UserRole[] }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/");
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return <AppShellFallback />;
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
      <Suspense fallback={<AppShellFallback />}>
        <Switch>
          <Route path="/" component={Login} />
          <Route path="/login" component={Login} />
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
      </Suspense>
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
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
          </TooltipProvider>
        </DataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
