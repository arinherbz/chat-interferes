import type { ReactNode } from "react";
import { Link } from "wouter";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoreCart } from "@/lib/store-cart";

export function StoreShell({ children }: { children: ReactNode }) {
  const { itemCount } = useStoreCart();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/store">
            <div className="cursor-pointer">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Ariostore gadgets</p>
              <h1 className="text-xl font-semibold tracking-tight">New is Next</h1>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/store/account">
              <Button variant="outline">Account</Button>
            </Link>
            <Link href="/store/track">
              <Button variant="outline">Track Order</Button>
            </Link>
            <Link href="/store/cart">
              <Button className="gap-2">
                <ShoppingBag className="h-4 w-4" />
                Cart{itemCount > 0 ? ` (${itemCount})` : ""}
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
