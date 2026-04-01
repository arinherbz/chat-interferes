import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Grid2X2, List, Search } from "lucide-react";
import { Link } from "wouter";
import { StoreShell } from "@/components/store-shell";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { formatUGX } from "@/lib/formatters";
import type { StoreProduct } from "@/lib/storefront";

export default function StoreProductsPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState("popular");
  const [condition, setCondition] = useState("all");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data: products = [], isLoading } = useQuery<StoreProduct[]>({
    queryKey: ["/api/store/products", debouncedQuery, sort, condition],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/store/products?q=${encodeURIComponent(debouncedQuery)}&sort=${encodeURIComponent(sort)}${
          condition !== "all" ? `&condition=${encodeURIComponent(condition)}` : ""
        }`,
      ),
  });

  const brands = useMemo(
    () => Array.from(new Set(products.map((product) => product.brand?.trim()).filter(Boolean))).sort(),
    [products],
  );

  return (
    <StoreShell>
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-7 sm:px-6 lg:px-8">
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Store</p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Premium gadgets and accessories.</h2>
              <p className="text-sm text-muted-foreground">Shop verified devices and accessories with cleaner pricing, trusted stock, and fast delivery across Uganda.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={view === "grid" ? "default" : "outline"} size="icon" onClick={() => setView("grid")}><Grid2X2 className="h-4 w-4" /></Button>
              <Button variant={view === "list" ? "default" : "outline"} size="icon" onClick={() => setView("list")}><List className="h-4 w-4" /></Button>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <Card className="h-fit border-border/80 bg-white/95 shadow-sm lg:sticky lg:top-24">
            <CardContent className="space-y-4 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Search devices, accessories..." />
              </div>
              <div className="grid gap-3">
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="price-asc">Price Low-High</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="stock">In Stock First</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger><SelectValue placeholder="Condition" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Conditions</SelectItem>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Refurbished">Refurbished</SelectItem>
                    <SelectItem value="Open Box">Open Box</SelectItem>
                  </SelectContent>
                </Select>
                {brands.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Brands</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {brands.map((brand) => (
                        <span key={brand} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">{brand}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No products found.</p>
                </CardContent>
              </Card>
            ) : view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <Link key={product.id} href={`/store/products/${product.id}`}>
                    <Card className="h-full cursor-pointer overflow-hidden border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
                      <CardContent className="space-y-4 p-4">
                        <div className="aspect-[4/4.2] overflow-hidden rounded-[1.25rem] bg-slate-100">
                          <ProductImage
                            src={product.imageUrl}
                            alt={product.name}
                            fallbackLabel={product.brand || "Device"}
                            className="h-full w-full rounded-[1.25rem]"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              {product.category || product.brand || "Featured"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              {product.stock > 0 ? "In stock" : "Sold out"}
                            </span>
                          </div>
                          <h3 className="line-clamp-2 text-base font-medium leading-snug text-slate-950">{product.name}</h3>
                          <p className="text-lg font-semibold tracking-tight text-slate-950">{formatUGX(product.price)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {products.map((product) => (
                  <Link key={product.id} href={`/store/products/${product.id}`}>
                    <Card className="cursor-pointer border-slate-200 shadow-sm transition-colors hover:bg-slate-50">
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          <ProductImage
                            src={product.imageUrl}
                            alt={product.name}
                            fallbackLabel={product.brand || "Device"}
                            className="h-full w-full rounded-xl"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {product.category || product.brand || "Store item"}
                          </p>
                          <h3 className="font-medium text-slate-950">{product.name}</h3>
                          <p className="text-sm text-muted-foreground">{[product.brand, product.model, product.storage].filter(Boolean).join(" • ")}</p>
                          <p className="mt-1 text-base font-semibold text-slate-950">{formatUGX(product.price)}</p>
                        </div>
                        <Button variant="outline">View</Button>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </StoreShell>
  );
}
