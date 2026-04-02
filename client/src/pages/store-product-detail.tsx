import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { StoreShell } from "@/components/store-shell";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { formatUGX } from "@/lib/formatters";
import { addToStoreCart } from "@/lib/store-cart";
import type { StoreProduct } from "@/lib/storefront";
import { useToast } from "@/hooks/use-toast";

export default function StoreProductDetailPage() {
  const [, params] = useRoute("/store/products/:id");
  const [, navigate] = useLocation();
  const productId = params?.id;
  const { toast } = useToast();

  const { data: product, isLoading } = useQuery<StoreProduct & { sku?: string; model?: string }>({
    queryKey: [`/api/store/products/${productId}`],
    queryFn: () => apiRequest("GET", `/api/store/products/${productId}`),
    enabled: Boolean(productId),
  });
  const isAvailable = (product?.stock ?? 0) > 0;

  return (
    <StoreShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <Skeleton className="h-[28rem] rounded-3xl" />
        ) : !product ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Product not found.</p>
              <Link href="/store/products"><Button className="mt-4">Back to Products</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden rounded-3xl border-border/70">
            <CardContent className="grid gap-8 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
              <div className="aspect-square rounded-3xl bg-slate-100">
                <ProductImage
                  src={product.imageUrl}
                  alt={product.name}
                  fallbackLabel={product.brand || product.name}
                  className="h-full w-full rounded-3xl"
                />
              </div>
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {product.category || product.brand || "Storefront"}
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight">{product.name}</h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{product.description || "Premium device available for immediate dispatch."}</p>
                </div>
                <div className="rounded-2xl bg-secondary p-4">
                  <div className="flex items-end gap-2">
                    <p className="text-2xl font-semibold">{formatUGX(product.isFlashDeal && product.flashDealPrice ? product.flashDealPrice : product.price)}</p>
                    {product.isFlashDeal && product.flashDealPrice ? (
                      <p className="text-sm text-muted-foreground line-through">{formatUGX(product.price)}</p>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isAvailable ? `${product.stock} unit(s) in stock` : "Currently out of stock"}
                  </p>
                </div>
                <div className="grid gap-3 text-sm text-muted-foreground">
                  <div>Category: {product.category || "Devices"}</div>
                  <div>Model: {product.model || "Available on request"}</div>
                  <div>Brand: {product.brand || "Ariostore selection"}</div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={!isAvailable}
                    onClick={() => {
                      if (!isAvailable) return;
                      addToStoreCart(product);
                      toast({ title: "Added to cart", description: `${product.name} is ready for checkout.` });
                    }}
                  >
                    {isAvailable ? "Add to cart" : "Out of stock"}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!isAvailable}
                    onClick={() => {
                      if (!isAvailable) return;
                      addToStoreCart(product);
                      navigate("/store/cart");
                    }}
                  >
                    Buy now
                  </Button>
                  <Link href="/store/products"><Button variant="outline">Back to Products</Button></Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </StoreShell>
  );
}
