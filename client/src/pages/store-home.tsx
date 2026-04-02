import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BadgeCheck, ShieldCheck, Truck, Smartphone } from "lucide-react";
import { StoreShell } from "@/components/store-shell";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { formatUGX } from "@/lib/formatters";
import type { StoreProduct } from "@/lib/storefront";

export default function StoreHomePage() {
  const { data: products = [] } = useQuery<StoreProduct[]>({
    queryKey: ["/api/store/products", "home"],
    queryFn: () => apiRequest("GET", "/api/store/products"),
  });

  const featured = products.filter((product) => product.featured).slice(0, 8);
  const flashDeals = products.filter((product) => product.isFlashDeal && product.flashDealPrice).slice(0, 4);
  const spotlightProducts = (featured.length > 0 ? featured : products.slice(0, 4)).slice(0, 4);

  return (
    <StoreShell>
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Ariostore Online Store
            </div>
            <div className="space-y-3">
              <h2 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Premium gadgets and accessories for the modern lifestyle.
              </h2>
              <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
                Discover the latest in technology with Ariostore. Shop premium devices, request fast delivery across Uganda, and enjoy secure payments with mobile money options.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/store/products">
                <Button size="lg">Browse Products</Button>
              </Link>
              <Link href="/store/cart">
                <Button size="lg" variant="outline">View Cart</Button>
              </Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {spotlightProducts.map((product) => (
              <Link key={product.id} href={`/store/products/${product.id}`}>
                <Card className="h-full cursor-pointer overflow-hidden border-white/70 bg-white/90 backdrop-blur transition-transform hover:-translate-y-1">
                  <CardContent className="space-y-3 p-4">
                    <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        fallbackLabel={product.brand || "Device"}
                        className="h-full w-full rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {product.category || product.brand || "Featured"}
                      </p>
                      <h3 className="line-clamp-2 font-medium text-slate-950">{product.name}</h3>
                      <p className="text-sm font-semibold">{formatUGX(product.flashDealPrice || product.price)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "Quality Assured", copy: "Genuine products with warranty and after-sales support." },
            { icon: BadgeCheck, title: "Verified Stock", copy: "All products verified and tracked in our inventory system." },
            { icon: Truck, title: "Fast Delivery", copy: "Nationwide delivery with pickup and courier options." },
            { icon: Smartphone, title: "Latest Gadgets", copy: "Stay updated with the newest technology and accessories." },
          ].map((item) => (
            <Card key={item.title} className="border-border/80">
              <CardContent className="space-y-3 p-5">
                <item.icon className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.copy}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {flashDeals.length > 0 ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Flash Deals</p>
                <h2 className="text-2xl font-semibold tracking-tight">Time-limited online offers</h2>
              </div>
              <Link href="/store/products">
                <Button variant="outline">See all</Button>
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {flashDeals.map((product) => (
                <Card key={product.id} className="overflow-hidden">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Flash Deal</span>
                      <span className="text-xs text-muted-foreground">{product.flashDealEndsAt ? `Ends ${new Date(product.flashDealEndsAt).toLocaleDateString()}` : "Limited time"}</span>
                    </div>
                    <div>
                      <h3 className="font-medium">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">{[product.brand, product.model, product.condition].filter(Boolean).join(" • ")}</p>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-xl font-semibold">{formatUGX(product.flashDealPrice || product.price)}</span>
                      {product.flashDealPrice ? <span className="text-sm text-muted-foreground line-through">{formatUGX(product.price)}</span> : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </StoreShell>
  );
}
