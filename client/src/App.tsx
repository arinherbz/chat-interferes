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

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/daily-close" component={DailyClose} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/products" component={ProductsPage} />
        <Route path="/customers" component={CustomersPage} />
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
