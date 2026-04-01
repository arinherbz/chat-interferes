import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Grid2X2, List, Search } from "lucide-react";
import { Link } from "wouter";
import { StoreShell } from "@/components/store-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { useStoreCart, type StoreProduct } from "@/lib/storefront";
import { formatUGX } from "@/lib/utils";

export default function StoreProductsPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState("popular");
  const [condition, setCondition] = useState("all");
  const { addItem } = useStoreCart();

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
    () => Array.from(new Set(products.map((product) => product.brand).filter(Boolean))).sort(),
    [products],
  );

  return (
    <StoreShell>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Store</p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Premium gadgets and accessories.</h2>
              <p className="mt-1 text-sm text-muted-foreground">Discover the latest technology with fast delivery across Uganda.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={view === "grid" ? "default" : "outline"} size="icon" onClick={() => setView("grid")}><Grid2X2 className="h-4 w-4" /></Button>
              <Button variant={view === "list" ? "default" : "outline"} size="icon" onClick={() => setView("list")}><List className="h-4 w-4" /></Button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit border-border/80 lg:sticky lg:top-24">
            <CardContent className="space-y-4 p-5">
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
                  <div className="rounded-2xl bg-secondary p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Brands in stock</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {brands.map((brand) => (
                        <span key={brand} className="rounded-full border border-border bg-background px-3 py-1 text-xs">{brand}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-4"}>
            {isLoading
              ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-72 rounded-[1.5rem]" />)
              : products.map((product) => (
                  <Card key={product.id} className={`overflow-hidden border-border/80 ${view === "list" ? "flex flex-col md:flex-row" : ""}`}>
                    <div className={view === "list" ? "md:w-56" : ""}>
                      <div className="aspect-square overflow-hidden bg-slate-100">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-400">{product.brand || "Product"}</div>
                        )}
                      </div>
                    </div>
                    <CardContent className="flex flex-1 flex-col justify-between gap-4 p-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">{product.condition || "New"}</span>
                          <span className={`text-xs font-medium ${product.stock > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                          </span>
                        </div>
                        <div>
                          <Link href={`/store/products/${product.slug}`}>
                            <h3 className="cursor-pointer text-lg font-medium tracking-tight">{product.name}</h3>
                          </Link>
                          <p className="text-sm text-muted-foreground">{[product.brand, product.ram, product.storage].filter(Boolean).join(" • ")}</p>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-xl font-semibold">{formatUGX(product.flashDealPrice || product.price)}</span>
                          {product.flashDealPrice ? <span className="text-sm text-muted-foreground line-through">{formatUGX(product.price)}</span> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => addItem(product)} disabled={product.stock <= 0}>Add to Cart</Button>
                        <Link href={`/store/checkout?buy=${product.id}`}>
                          <Button variant="outline">Request Delivery</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>
        </section>
      </div>
    </StoreShell>
  );
}
