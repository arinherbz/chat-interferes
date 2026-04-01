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
  RefreshCw,
  UserCog,
  FileText,
  Tags,
  Truck,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import logoUrl from "@assets/generated_images/minimalist_phone_shop_logo_icon.png";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading, preferences, updatePreferences } = useAuth();
  const { activeShop, notifications } = useData(); // Get dynamic shop name
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(preferences?.sidebarCollapsed ?? false);

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
    if (location.startsWith("/store")) {
      return <>{children}</>;
    }
    return <div className="min-h-screen bg-background flex items-center justify-center p-4">{children}</div>;
  }

  if (location.startsWith("/store")) {
    return <>{children}</>;
  }

  const isOwner = user.role === "Owner";
  const isManager = user.role === "Manager";
  const isSales = user.role === "Sales";
  const canSeeAdmin = isOwner || isManager;
  const canSeeDashboard = isOwner || isManager;
  const canSeeClosures = isOwner || isManager;
  const canSeeBaseValues = isOwner || isManager;

  const unreadNotifications = notifications.filter(n => !n.read).length;

  const NavLink = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const active = location === href;
    return (
      <Link href={href}>
        <div className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 cursor-pointer",
          active 
            ? "bg-accent text-primary font-semibold border border-primary/10 shadow-sm" 
            : "text-slate-600 hover:bg-secondary hover:text-foreground"
        )}
        title={sidebarCollapsed ? label : undefined}
        aria-current={active ? "page" : undefined}>
          <Icon className={cn("h-5 w-5 shrink-0", active ? "" : "group-hover:scale-105")} />
          {!sidebarCollapsed && <span>{label}</span>}
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden border-b bg-white p-4 flex items-center justify-between gap-3 sticky top-0 z-50">
        <Link href={`/shop-settings/${activeShop?.id || "shop1"}`}> 
          <div className="flex min-w-0 items-center gap-2 font-bold text-foreground" aria-label="Edit shop settings">
            <img src={logoUrl} className="w-8 h-8 rounded-md" alt="TechPOS" />
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate">{activeShop?.name || "TechPOS"}</span>
              {activeShop?.isMain && (
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
        "fixed inset-y-0 left-0 z-40 w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] border-r bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] transform transition-all duration-200 ease-in-out md:translate-x-0 md:static md:h-screen md:max-w-none flex flex-col overflow-hidden",
        sidebarCollapsed ? "md:w-[84px]" : "md:w-72",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="hidden md:flex items-center justify-between border-b px-4 py-5">
          <Link href={`/shop-settings/${activeShop?.id || "shop1"}`} className="flex items-center gap-3 min-w-0" aria-label="Edit shop settings">
           <img src={logoUrl} className="w-8 h-8 rounded-md" alt="TechPOS" />
           {!sidebarCollapsed && (
             <div className="flex flex-col min-w-0">
             <div className="flex items-center gap-2">
               <span className="font-bold text-lg text-foreground leading-tight truncate">{activeShop?.name || "TechPOS"}</span>
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
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            onClick={() => {
              const next = !sidebarCollapsed;
              setSidebarCollapsed(next);
              void updatePreferences({ sidebarCollapsed: next });
            }}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

          <div className={cn("flex-1 overflow-y-auto py-6 space-y-1.5", sidebarCollapsed ? "px-2" : "px-4")}>
          {!sidebarCollapsed && <div className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.16em] mb-2 px-3">Main</div>}
          
          {canSeeDashboard && (
            <NavLink href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          )}
          
          <NavLink href="/pos" icon={ShoppingCart} label="Point of Sale" />
          <NavLink href="/daily-close" icon={PlusCircle} label="Daily Close" />
          {canSeeClosures && (
             <NavLink href="/closures" icon={FileText} label="Closures" />
          )}
          
          {!sidebarCollapsed && <div className="mt-8 text-xs font-semibold text-muted-foreground uppercase tracking-[0.16em] mb-2 px-3">Management</div>}
          
          <NavLink href="/trade-in" icon={RefreshCw} label="Trade-In / Buyback" />
          <NavLink href="/leads" icon={MessageSquare} label="Leads & Follow-ups" />
          <NavLink href="/orders" icon={Package} label="Orders" />
          <NavLink href="/deliveries" icon={Truck} label="Deliveries" />
          <NavLink href="/devices" icon={Smartphone} label="Devices (IMEI)" />
          {(isOwner || isManager) && <NavLink href="/products" icon={Package} label="Products" />}
          {(isOwner || isManager) && <NavLink href="/customers" icon={Users} label="Customers" />}
          <NavLink href="/repairs" icon={Wrench} label="Repairs" />
          
          {canSeeAdmin && (
            <>
              {!sidebarCollapsed && <div className="mt-8 text-xs font-semibold text-muted-foreground uppercase tracking-[0.16em] mb-2 px-3">Admin</div>}
              <NavLink href="/expenses" icon={CreditCard} label="Expenses" />
              <NavLink href="/audit-logs" icon={ShieldAlert} label="Audit Logs" />
              {canSeeBaseValues && <NavLink href="/brands" icon={Tags} label="Brands & Models" />}
              {canSeeBaseValues && <NavLink href="/base-values" icon={UserCog} label="Base Values" />}
              {isOwner && <NavLink href="/staff" icon={UserCog} label="Staff" />}
              <NavLink href="/settings" icon={Settings} label="Settings" />
            </>
          )}

          <div className="mt-auto pt-8 border-t">
             <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground font-bold">
                {user.name.charAt(0)}
              </div>
              {!sidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground truncate">{user.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                </div>
              )}
            </div>
            
            <Button 
              variant="ghost" 
              className={cn("w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50/80", sidebarCollapsed ? "justify-center" : "justify-start")}
              onClick={logout}
            >
              <LogOut className={cn("h-4 w-4", sidebarCollapsed ? "" : "mr-2")} />
              {!sidebarCollapsed && "Logout"}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8">
          <div className="mx-auto w-full max-w-[1640px] min-w-0">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
