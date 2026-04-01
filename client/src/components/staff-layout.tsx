import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Barcode, ClipboardList, LogOut, Package, RefreshCw, Truck, UserRound, Wrench } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const staffNav = [
  { href: "/pos", label: "POS", icon: Barcode },
  { href: "/customers", label: "Customers", icon: UserRound },
  { href: "/repairs", label: "Repairs", icon: Wrench },
  { href: "/trade-in", label: "Trade-In", icon: RefreshCw },
  { href: "/management/orders", label: "Orders", icon: ClipboardList },
  { href: "/management/deliveries", label: "Deliveries", icon: Truck },
  { href: "/devices", label: "Devices", icon: Package },
];

export function StaffLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const isPOSRoute = location === "/pos";
  const primaryNav = isPOSRoute ? staffNav.slice(0, 3) : staffNav;
  const secondaryNav = isPOSRoute ? staffNav.slice(3) : [];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-foreground">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className={cn("mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8", isPOSRoute ? "max-w-[1600px] py-3" : "max-w-7xl py-4")}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{isPOSRoute ? "Sales Desk" : "Staff Workspace"}</p>
            <h1 className={cn("font-semibold tracking-tight text-slate-900", isPOSRoute ? "text-lg" : "text-xl")}>
              {isPOSRoute ? "Fast cashier mode" : "Fulfillment and front desk"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
            <Button variant="outline" className="gap-2" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className={cn("mx-auto grid gap-6 px-4 py-6 sm:px-6 lg:px-8", isPOSRoute ? "max-w-[1600px] lg:grid-cols-[112px_minmax(0,1fr)]" : "max-w-7xl lg:grid-cols-[240px_minmax(0,1fr)]")}>
        <aside className={cn("hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:block", isPOSRoute ? "p-3" : "p-4")}>
          <nav className="space-y-2">
            {primaryNav.map((item) => {
              const active = location === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "flex cursor-pointer rounded-2xl text-sm transition-colors",
                      isPOSRoute ? "flex-col items-center gap-2 px-3 py-3 text-center" : "items-center gap-3 px-4 py-3",
                      active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {isPOSRoute && secondaryNav.length > 0 && (
            <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <summary className="cursor-pointer list-none text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                More
              </summary>
              <nav className="mt-2 space-y-1">
                {secondaryNav.map((item) => {
                  const active = location === item.href;
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={cn(
                          "flex cursor-pointer flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] transition-colors",
                          active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-white hover:text-slate-900",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </details>
          )}
        </aside>

        <main className="min-w-0">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-4 gap-2">
          {staffNav.slice(0, 4).map((item) => {
            const active = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex cursor-pointer flex-col items-center rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                    active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon className="mb-1 h-4 w-4" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
