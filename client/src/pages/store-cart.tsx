import { MessageCircle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { StoreShell } from "@/components/store-shell";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatUGX } from "@/lib/formatters";
import { useStoreCart } from "@/lib/store-cart";
import { createWhatsAppUrl } from "@/lib/store-support";

export default function StoreCartPage() {
  const { items, subtotal, updateQuantity, remove } = useStoreCart();

  return (
    <StoreShell>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Your Shopping Cart</h2>
          <p className="mt-1 text-sm text-muted-foreground">Review and manage your items.</p>
        </div>
        <Card>
          <CardContent className="space-y-4 p-6">
            {items.length === 0 ? (
              <div className="flex flex-col items-center text-center py-8">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <ShoppingBag className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Your cart is empty</h3>
                <p className="text-sm text-slate-500 max-w-sm mb-4">
                  Browse our products and add items to your cart.
                </p>
                <Link href="/store/products">
                  <Button>Continue Shopping</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.productId} className="flex flex-col gap-4 rounded-2xl border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-xs text-slate-400">
                          <ProductImage
                            src={item.imageUrl}
                            alt={item.name}
                            fallbackLabel={item.brand || "Item"}
                            className="h-full w-full rounded-2xl"
                          />
                        </div>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{formatUGX(item.price)} each</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.stock <= 5 ? (
                              <span className="text-amber-600">Only {item.stock} left in stock</span>
                            ) : (
                              <span className="text-emerald-600">{item.stock} in stock</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            disabled={item.quantity <= 1}
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            disabled={item.quantity >= item.stock}
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="min-w-24 text-right font-semibold">{formatUGX(item.price * item.quantity)}</p>
                        <Button variant="ghost" size="icon" onClick={() => remove(item.productId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-4 rounded-2xl bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Subtotal</p>
                    <p className="text-2xl font-semibold">{formatUGX(subtotal)}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/store/products">
                      <Button variant="outline">Continue Shopping</Button>
                    </Link>
                    <Link href="/store/checkout">
                      <Button>Proceed to Checkout</Button>
                    </Link>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white/90 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">Need help before checkout?</p>
                    <p className="text-sm text-muted-foreground">Chat with Ariostore on WhatsApp for delivery, stock, or payment questions.</p>
                  </div>
                  <a href={createWhatsAppUrl("Hello Ario Store, I need help with my cart.")} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Contact support
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </StoreShell>
  );
}
