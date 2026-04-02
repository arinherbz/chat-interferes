import type { ReactNode } from "react";
import { Link } from "wouter";
import { MessageCircle, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoreCart } from "@/lib/store-cart";
import { createWhatsAppUrl } from "@/lib/store-support";
import { useStoreCustomerAuth } from "@/lib/store-customer-auth";

export function StoreShell({ children }: { children: ReactNode }) {
  const { itemCount } = useStoreCart();
  const { customer } = useStoreCustomerAuth();
  const accountHref = customer ? "/store/account" : "/store/login?redirect=%2Fstore%2Faccount";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/store">
            <div className="flex cursor-pointer items-center gap-3">
              <img src="/ariostore-logo.png" alt="Ariostore" className="h-11 w-11 object-contain" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Ariostore</p>
                <h1 className="text-xl font-semibold tracking-tight">Mobile & gadget store</h1>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <a href={createWhatsAppUrl("Hello Ario Store, I need help with my order.")} target="_blank" rel="noreferrer">
              <Button variant="outline" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
            </a>
            <Link href={accountHref}>
              <Button variant="outline">{customer ? "My Account" : "Sign In"}</Button>
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
      <footer className="border-t border-border/70 bg-white/92">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Need help with an order, repair, or trade-in? We reply fastest on WhatsApp.</p>
          <a className="inline-flex items-center gap-2 font-medium text-primary" href={createWhatsAppUrl("Hello Ario Store, I need help with my order.")} target="_blank" rel="noreferrer">
            <MessageCircle className="h-4 w-4" />
            Chat with Ariostore
          </a>
        </div>
      </footer>
    </div>
  );
}
