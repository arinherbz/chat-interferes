import { Link, useLocation } from "wouter";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  LogOut, 
  Menu, 
  PlusCircle, 
  X,
  Package,
  Users,
  MessageSquare,
  Wrench,
  Smartphone,
  CreditCard,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Truck,
  ClipboardList,
  RefreshCw,
  UserCog,
  FileText,
  Tags,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { StaffLayout } from "@/components/staff-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading, preferences, updatePreferences } = useAuth();
  const { activeShop, notifications } = useData(); // Get dynamic shop name
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(preferences?.sidebarCollapsed ?? false);
  const isPOSRoute = location === "/pos";

  useEffect(() => {
    if (preferences?.sidebarCollapsed !== undefined) {
      setSidebarCollapsed(preferences.sidebarCollapsed);
    }
  }, [preferences?.sidebarCollapsed]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Securing your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div className="min-h-screen bg-background flex items-center justify-center p-4">{children}</div>;
  }

  if (user.role === "Sales") {
    return <StaffLayout>{children}</StaffLayout>;
  }

  const isOwner = user.role === "Owner";
  const isManager = user.role === "Manager";
  const canSeeAdmin = isOwner || isManager;
  const canSeeDashboard = isOwner || isManager;
  const canSeeClosures = isOwner || isManager;
  const canSeeBaseValues = isOwner || isManager;

  const unreadNotifications = notifications.filter(n => !n.read).length;
  const posFocusedNav = [
    { href: "/pos", icon: ShoppingCart, label: "Point of Sale" },
    { href: "/management/orders", icon: ClipboardList, label: "Orders" },
    { href: "/products", icon: Package, label: "Products" },
    { href: "/customers", icon: Users, label: "Customers" },
  ];
  const standardMainNav = [
    canSeeDashboard ? { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" } : null,
    { href: "/pos", icon: ShoppingCart, label: "Point of Sale" },
    { href: "/daily-close", icon: PlusCircle, label: "Daily Close" },
    canSeeClosures ? { href: "/closures", icon: FileText, label: "Closures" } : null,
  ].filter(Boolean) as Array<{ href: string; icon: any; label: string }>;
  const standardManagementNav = [
    { href: "/management/orders", icon: ClipboardList, label: "Orders" },
    { href: "/management/deliveries", icon: Truck, label: "Deliveries" },
    { href: "/trade-in", icon: RefreshCw, label: "Trade-In / Buyback" },
    { href: "/leads", icon: MessageSquare, label: "Leads & Follow-ups" },
    { href: "/devices", icon: Smartphone, label: "Devices (IMEI)" },
    (isOwner || isManager) ? { href: "/products", icon: Package, label: "Products" } : null,
    (isOwner || isManager) ? { href: "/customers", icon: Users, label: "Customers" } : null,
    { href: "/repairs", icon: Wrench, label: "Repairs" },
  ].filter(Boolean) as Array<{ href: string; icon: any; label: string }>;
  const standardAdminNav = canSeeAdmin ? [
    { href: "/expenses", icon: CreditCard, label: "Expenses" },
    { href: "/audit-logs", icon: ShieldAlert, label: "Audit Logs" },
    canSeeBaseValues ? { href: "/brands", icon: Tags, label: "Brands & Models" } : null,
    canSeeBaseValues ? { href: "/base-values", icon: UserCog, label: "Base Values" } : null,
    isOwner ? { href: "/staff", icon: UserCog, label: "Staff" } : null,
    { href: "/settings", icon: Settings, label: "Settings" },
  ].filter(Boolean) as Array<{ href: string; icon: any; label: string }> : [];

  const NavLink = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const active = location === href;
    return (
      <Link href={href}>
        <div className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 cursor-pointer",
          active 
            ? "bg-primary/10 text-primary font-semibold border border-primary/10 shadow-[0_10px_22px_rgba(63,121,92,0.08)]" 
            : "text-slate-600 hover:bg-secondary/80 hover:text-foreground"
        )}
        title={sidebarCollapsed ? label : undefined}
        aria-current={active ? "page" : undefined}>
          <Icon className={cn("h-5 w-5 shrink-0", active ? "" : "group-hover:scale-105")} />
          {!sidebarCollapsed && <span>{label}</span>}
        </div>
      </Link>
    );
  };

  if (isPOSRoute) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto w-full max-w-[1800px] px-3 py-3 md:px-4 md:py-4 xl:px-5 xl:py-5">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className={cn("md:hidden border-b border-border/70 bg-white/92 flex items-center justify-between gap-3 sticky top-0 z-50 backdrop-blur", isPOSRoute ? "p-3" : "p-4")}>
        <Link href={`/shop-settings/${activeShop?.id || "shop1"}`}> 
            <div className="flex min-w-0 items-center gap-2 font-bold text-foreground" aria-label="Edit shop settings">
            <img src="/ariostore-logo.png" className="h-8 w-8 object-contain" alt="Ariostore" />
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate">{isPOSRoute ? "POS" : (activeShop?.name || "Ariostore")}</span>
              {!isPOSRoute && activeShop?.isMain && (
                <span className="shrink-0 text-[10px] bg-secondary text-muted-foreground font-medium px-2 py-0.5 rounded-full">Main</span>
              )}
            </div>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] border-r border-border/70 bg-white/94 shadow-[0_18px_40px_rgba(24,38,31,0.08)] transform transition-all duration-200 ease-in-out md:translate-x-0 md:static md:h-screen md:max-w-none flex flex-col overflow-hidden backdrop-blur",
        (sidebarCollapsed || isPOSRoute) ? "md:w-[96px]" : "md:w-72",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="hidden md:flex items-center justify-between border-b border-border/70 px-4 py-5">
          <Link href={`/shop-settings/${activeShop?.id || "shop1"}`} className="flex items-center gap-3 min-w-0" aria-label="Edit shop settings">
           <img src="/ariostore-logo.png" className="h-8 w-8 object-contain" alt="Ariostore" />
           {!(sidebarCollapsed || isPOSRoute) && (
             <div className="flex flex-col min-w-0">
             <div className="flex items-center gap-2">
               <span className="font-bold text-lg text-foreground leading-tight truncate">{activeShop?.name || "Ariostore"}</span>
               {activeShop?.isMain && (
                 <span className="text-xs bg-secondary text-muted-foreground font-medium px-2 py-0.5 rounded-full">Main</span>
               )}
             </div>
             <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Operations</span>
             </div>
           )}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            aria-label={(sidebarCollapsed || isPOSRoute) ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!(sidebarCollapsed || isPOSRoute)}
            onClick={() => {
              const next = !sidebarCollapsed;
              setSidebarCollapsed(next);
              void updatePreferences({ sidebarCollapsed: next });
            }}
            disabled={isPOSRoute}
          >
            {(sidebarCollapsed || isPOSRoute) ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

          <div className={cn("flex-1 overflow-y-auto py-6 space-y-1.5", (sidebarCollapsed || isPOSRoute) ? "px-2" : "px-4")}>
          {!isPOSRoute && !sidebarCollapsed && <div className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.16em] mb-2 px-3">Main</div>}
          {isPOSRoute
            ? posFocusedNav.map((item) => <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />)
            : standardMainNav.map((item) => <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />)}
          
          {!isPOSRoute && !sidebarCollapsed && <div className="mt-8 text-xs font-semibold text-muted-foreground uppercase tracking-[0.16em] mb-2 px-3">Management</div>}
          {!isPOSRoute && standardManagementNav.map((item) => <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />)}
          
          {!isPOSRoute && canSeeAdmin && (
            <>
              {!sidebarCollapsed && <div className="mt-8 text-xs font-semibold text-muted-foreground uppercase tracking-[0.16em] mb-2 px-3">Admin</div>}
              {standardAdminNav.map((item) => <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />)}
            </>
          )}

          {isPOSRoute && (
            <details className="mt-3 rounded-[1.25rem] border border-border/70 bg-secondary/80 px-2 py-2">
              <summary className="cursor-pointer list-none text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                More
              </summary>
              <div className="mt-2 space-y-1">
                {[...standardManagementNav.slice(1, 5), ...standardAdminNav.slice(0, 2)].map((item) => (
                  <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
                ))}
              </div>
            </details>
          )}

          <div className="mt-auto border-t border-border/70 pt-8">
             <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-secondary/90 flex items-center justify-center text-muted-foreground font-bold">
                {user.name.charAt(0)}
              </div>
              {!(sidebarCollapsed || isPOSRoute) && (
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground truncate">{user.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                </div>
              )}
            </div>
            
            <Button 
              variant="ghost" 
              className={cn("w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50/70", (sidebarCollapsed || isPOSRoute) ? "justify-center" : "justify-start")}
              onClick={logout}
            >
              <LogOut className={cn("h-4 w-4", (sidebarCollapsed || isPOSRoute) ? "" : "mr-2")} />
              {!(sidebarCollapsed || isPOSRoute) && "Logout"}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className={cn("flex-1 overflow-y-auto", isPOSRoute ? "p-3 md:p-4 xl:p-5" : "p-4 md:p-6 xl:p-8")}>
          <div className={cn("mx-auto w-full min-w-0", isPOSRoute ? "max-w-[1800px]" : "max-w-[1640px]")}>
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-[rgba(24,38,31,0.16)] z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
