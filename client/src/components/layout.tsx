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
  Loader2
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import logoUrl from "@assets/generated_images/minimalist_phone_shop_logo_icon.png";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const { activeShop, notifications } = useData(); // Get dynamic shop name
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Securing your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">{children}</div>;
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
          "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer",
          active 
            ? "bg-primary text-primary-foreground font-medium shadow-sm" 
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )}>
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <Link href={`/shop-settings/${activeShop?.id || "shop1"}`}> 
          <div className="flex items-center gap-2 font-bold text-slate-800" aria-label="Edit shop settings">
            <img src={logoUrl} className="w-8 h-8 rounded-md" alt="TechPOS" />
            <div className="flex items-center gap-2">
              <span>{activeShop?.name || "TechPOS"}</span>
              {activeShop?.isMain && (
                <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full">Main</span>
              )}
            </div>
          </div>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:h-screen flex flex-col",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Link href={`/shop-settings/${activeShop?.id || "shop1"}`} className="p-6 border-b border-slate-100 hidden md:flex items-center gap-3" aria-label="Edit shop settings">
           <img src={logoUrl} className="w-8 h-8 rounded-md" alt="TechPOS" />
           <div className="flex flex-col">
             <div className="flex items-center gap-2">
               <span className="font-bold text-lg text-slate-800 leading-tight">{activeShop?.name || "TechPOS"}</span>
               {activeShop?.isMain && (
                 <span className="text-xs bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full">Main</span>
               )}
             </div>
             <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">SaaS Edition</span>
           </div>
        </Link>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">Main</div>
          
          {canSeeDashboard && (
            <NavLink href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          )}
          
          <NavLink href="/pos" icon={ShoppingCart} label="Point of Sale" />
          <NavLink href="/daily-close" icon={PlusCircle} label="Daily Close" />
          {canSeeClosures && (
             <NavLink href="/closures" icon={FileText} label="Closures" />
          )}
          
          <div className="mt-8 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">Management</div>
          
          <NavLink href="/trade-in" icon={RefreshCw} label="Trade-In / Buyback" />
          <NavLink href="/leads" icon={MessageSquare} label="Leads & Follow-ups" />
          <NavLink href="/devices" icon={Smartphone} label="Devices (IMEI)" />
          {(isOwner || isManager) && <NavLink href="/products" icon={Package} label="Products" />}
          {(isOwner || isManager) && <NavLink href="/customers" icon={Users} label="Customers" />}
          <NavLink href="/repairs" icon={Wrench} label="Repairs" />
          
          {canSeeAdmin && (
            <>
              <div className="mt-8 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">Admin</div>
              <NavLink href="/expenses" icon={CreditCard} label="Expenses" />
              <NavLink href="/audit-logs" icon={ShieldAlert} label="Audit Logs" />
              {canSeeBaseValues && <NavLink href="/base-values" icon={UserCog} label="Base Values" />}
              {isOwner && <NavLink href="/staff" icon={UserCog} label="Staff" />}
              <NavLink href="/settings" icon={Settings} label="Settings" />
            </>
          )}

          <div className="mt-auto pt-8 border-t border-slate-100">
             <div className="px-3 py-2 text-sm text-slate-600 flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                {user.name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-slate-900">{user.name}</span>
                <span className="text-xs text-slate-500 capitalize">{user.role}</span>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
