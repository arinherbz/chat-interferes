import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { CheckCircle2, MessageCircleMore, ShieldCheck } from "lucide-react";
import { StoreShell } from "@/components/store-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { useStoreCart, type StoreProduct } from "@/lib/storefront";
import { formatUGX } from "@/lib/utils";

type ProductDetail = StoreProduct & {
  related: StoreProduct[];
  imeiTracked: boolean;
};

export default function StoreProductDetailPage() {
  const [, params] = useRoute("/store/products/:slug");
  const { addItem } = useStoreCart();
  const { data, isLoading } = useQuery<ProductDetail>({
    queryKey: ["/api/store/products/detail", params?.slug],
    enabled: !!params?.slug,
    queryFn: () => apiRequest("GET", `/api/store/products/${params?.slug}`),
  });

  if (isLoading || !data) {
    return (
      <StoreShell>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="h-[36rem] rounded-[2rem]" />
        </div>
      </StoreShell>
    );
  }

  const whatsAppMessage = encodeURIComponent(`Hello, I'm interested in ${data.name}. Is it still available?`);

  return (
    <StoreShell>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <Card className="overflow-hidden border-border/80">
            <CardContent className="p-6">
              <div className="aspect-square overflow-hidden rounded-[1.75rem] bg-slate-100">
                {data.imageUrl ? (
                  <img src={data.imageUrl} alt={data.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">{data.brand || "Product image"}</div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/80">
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">{data.condition || "New"}</span>
                  {data.imeiTracked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-600">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      IMEI Verified
                    </span>
                  ) : null}
                </div>
                <h2 className="text-3xl font-semibold tracking-tight">{data.name}</h2>
                <p className="text-sm text-muted-foreground">{data.description || "Verified stock, live pricing, and UGX checkout."}</p>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-semibold">{formatUGX(data.flashDealPrice || data.price)}</p>
                <p className={`text-sm font-medium ${data.stock > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {data.stock > 0 ? `In stock: ${data.stock}` : "Currently unavailable"}
                </p>
              </div>
              <div className="grid gap-2 rounded-2xl bg-secondary p-4 text-sm">
                {Object.entries(data.specs || { Brand: data.brand || "-", Model: data.model || "-", RAM: data.ram || "-", Storage: data.storage || "-" }).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button size="lg" onClick={() => addItem(data)} disabled={data.stock <= 0}>Add to Cart</Button>
                <Button size="lg" variant="outline" onClick={() => addItem(data)} disabled={data.stock <= 0}>Buy Now</Button>
                <Button size="lg" variant="secondary" className="sm:col-span-2">Request Delivery</Button>
                <a href={`https://wa.me/256756524407?text=${whatsAppMessage}`} target="_blank" rel="noreferrer" className="sm:col-span-2">
                  <Button size="lg" variant="outline" className="w-full gap-2"><MessageCircleMore className="h-4 w-4" /> WhatsApp Inquiry</Button>
                </a>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Genuine products, warranty support, and manual mobile-money confirmation.</div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Related Products</p>
            <h3 className="text-2xl font-semibold tracking-tight">You may also want these.</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.related.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="space-y-3 p-4">
                  <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" /> : null}
                  </div>
                  <div>
                    <h4 className="font-medium">{item.name}</h4>
                    <p className="text-sm text-muted-foreground">{formatUGX(item.price)}</p>
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
