import { Link } from "wouter";
import { StoreShell } from "@/components/store-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStoreCart } from "@/lib/storefront";
import { formatUGX } from "@/lib/utils";

export default function StoreCartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useStoreCart();

  return (
    <StoreShell>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Cart</p>
          <h2 className="text-3xl font-semibold tracking-tight">Review your order.</h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            {items.length === 0 ? (
              <Card>
                <CardContent className="space-y-4 p-6">
                  <p className="text-muted-foreground">Your cart is empty.</p>
                  <Link href="/store/products"><Button>Browse products</Button></Link>
                </CardContent>
              </Card>
            ) : (
              items.map((item) => (
                <Card key={item.productId}>
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">{formatUGX(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.productId, Number(e.target.value) || 1)}
                        className="w-20"
                      />
                      <p className="w-28 text-right font-medium">{formatUGX(item.price * item.quantity)}</p>
                      <Button variant="ghost" onClick={() => removeItem(item.productId)}>Remove</Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <Card className="h-fit lg:sticky lg:top-24">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{formatUGX(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Delivery</span>
                <span className="font-semibold">Calculated at checkout</span>
              </div>
              <Link href="/store/checkout">
                <Button className="w-full" disabled={items.length === 0}>Proceed to Checkout</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </StoreShell>
  );
}
