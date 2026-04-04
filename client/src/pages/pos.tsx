import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useData, type Customer, type Device, type Product, type SaleItem } from "@/lib/data-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronDown,
  ClipboardList,
  CreditCard,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Scan,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";
import { Scanner } from "@/components/scanner";
import { ProductImage } from "@/components/product-image";
import { Receipt, generateSaleReceipt, type ReceiptData } from "@/components/receipt";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type CatalogTab = "products" | "devices";

const POS_PRIMARY_LINKS = [
  { href: "/pos", label: "Sale", icon: ShoppingCart },
  { href: "/customers", label: "Customers", icon: UserRound },
  { href: "/management/orders", label: "Orders", icon: ClipboardList },
];

const POS_MORE_LINKS = [
  { href: "/repairs", label: "Repairs", icon: Wrench },
  { href: "/trade-in", label: "Trade-In", icon: RefreshCw },
  { href: "/management/deliveries", label: "Deliveries", icon: Truck },
];

const formatUGX = (value: number) => `${value.toLocaleString()} UGX`;

export default function POSPage() {
  const { products, devices, customers, recordSale, currentUser } = useData();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const searchRef = useRef<HTMLInputElement>(null);
  const lastResolvedScanRef = useRef<{ value: string; ts: number } | null>(null);

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState("");
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("products");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const isAdminView = currentUser?.role === "Owner" || currentUser?.role === "Manager";
  const deferredSearch = useDeferredValue(search.trim());

  const focusSearch = () => {
    window.requestAnimationFrame(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    });
  };

  useEffect(() => {
    focusSearch();
  }, []);

  const filteredProducts = useMemo(() => {
    const normalized = deferredSearch.toLowerCase();
    if (!normalized) return products;
    const exactBarcode = products.filter((product) => product.barcode?.toLowerCase() === normalized);
    if (exactBarcode.length > 0) return exactBarcode;
    const exactSku = products.filter((product) => product.sku?.toLowerCase() === normalized);
    if (exactSku.length > 0) return exactSku;
    return products.filter((product) => {
      return [
        product.barcode,
        product.name,
        product.brand,
        product.model,
        product.sku,
        product.category,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    });
  }, [deferredSearch, products]);

  const filteredDevices = useMemo(() => {
    const normalized = deferredSearch.toLowerCase();
    const inStockDevices = devices.filter((device) => device.status === "In Stock");
    if (!normalized) return inStockDevices;
    const exactImei = inStockDevices.filter((device) => device.imei === deferredSearch);
    if (exactImei.length > 0) return exactImei;
    return inStockDevices.filter((device) =>
      [device.brand, device.model, device.storage, device.color, device.imei]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized))
    );
  }, [deferredSearch, devices]);

  const visibleItems = catalogTab === "products" ? filteredProducts : filteredDevices;
  const firstVisibleItem = visibleItems[0];

  const cartTotal = cart.reduce((acc, item) => acc + item.totalPrice, 0);
  const cartItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const clearCart = () => {
    setCart([]);
    focusSearch();
  };

  const addToCart = (type: "product" | "device", item: Product | Device) => {
    setCart((currentCart) => {
      const existing = currentCart.find((cartItem) =>
        type === "product" ? cartItem.productId === item.id : cartItem.deviceId === item.id
      );

      if (existing && type === "device") {
        toast({ title: "Already added", description: "This device is already in the cart." });
        return currentCart;
      }

      if (existing && type === "product") {
        const product = item as Product;
        if (existing.quantity >= product.stock) {
          toast({
            title: "Stock limit reached",
            description: `Only ${product.stock} units of ${product.name} are available.`,
            variant: "destructive",
          });
          return currentCart;
        }

        return currentCart.map((cartItem) =>
          cartItem.id === existing.id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + 1,
                totalPrice: (cartItem.quantity + 1) * cartItem.unitPrice,
              }
            : cartItem
        );
      }

      const newItem: SaleItem = {
        id: `temp-${Date.now()}-${item.id}`,
        name:
          type === "product"
            ? (item as Product).name
            : `${(item as Device).brand} ${(item as Device).model} (${(item as Device).storage})`,
        quantity: 1,
        unitPrice: item.price,
        totalPrice: item.price,
        productId: type === "product" ? item.id : undefined,
        deviceId: type === "device" ? item.id : undefined,
      };

      return [...currentCart, newItem];
    });

    setSearch("");
    focusSearch();
  };

  const updateCartQuantity = (item: SaleItem, direction: "increment" | "decrement") => {
    if (item.deviceId && direction === "increment") {
      toast({ title: "Single device item", description: "Unique devices can only be sold once." });
      return;
    }

    if (direction === "decrement" && item.quantity === 1) {
      setCart((currentCart) => currentCart.filter((cartItem) => cartItem.id !== item.id));
      focusSearch();
      return;
    }

    if (direction === "increment" && item.productId) {
      const product = products.find((entry) => entry.id === item.productId);
      if (product && item.quantity >= product.stock) {
        toast({
          title: "Stock limit reached",
          description: `Only ${product.stock} units of ${product.name} are available.`,
          variant: "destructive",
        });
        return;
      }
    }

    const nextQuantity = direction === "increment" ? item.quantity + 1 : item.quantity - 1;
    setCart((currentCart) =>
      currentCart.map((cartItem) =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: nextQuantity, totalPrice: nextQuantity * cartItem.unitPrice }
          : cartItem
      )
    );
    focusSearch();
  };

  const removeFromCart = (id: string) => {
    setCart((currentCart) => currentCart.filter((item) => item.id !== id));
    focusSearch();
  };

  const lookupCatalogItem = (query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return null;

    const exactBarcodeProduct = products.find((product) => product.barcode?.toLowerCase() === normalized);
    if (exactBarcodeProduct) {
      return { type: "product" as const, item: exactBarcodeProduct, tab: "products" as CatalogTab };
    }

    const exactSkuProduct = products.find((product) => product.sku?.toLowerCase() === normalized);
    if (exactSkuProduct) {
      return { type: "product" as const, item: exactSkuProduct, tab: "products" as CatalogTab };
    }

    const exactDevice = devices.find((device) => device.status === "In Stock" && device.imei === query.trim());
    if (exactDevice) {
      return { type: "device" as const, item: exactDevice, tab: "devices" as CatalogTab };
    }

    const exactNameProduct = products.find((product) => product.name.toLowerCase() === normalized);
    if (exactNameProduct) {
      return { type: "product" as const, item: exactNameProduct, tab: "products" as CatalogTab };
    }

    if (catalogTab === "products" && filteredProducts[0]) {
      return { type: "product" as const, item: filteredProducts[0], tab: "products" as CatalogTab };
    }

    if (catalogTab === "devices" && filteredDevices[0]) {
      return { type: "device" as const, item: filteredDevices[0], tab: "devices" as CatalogTab };
    }

    if (filteredProducts[0]) {
      return { type: "product" as const, item: filteredProducts[0], tab: "products" as CatalogTab };
    }

    if (filteredDevices[0]) {
      return { type: "device" as const, item: filteredDevices[0], tab: "devices" as CatalogTab };
    }

    return null;
  };

  const resolveAndAddCatalogItem = (query: string, source: "manual" | "scanner") => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const now = Date.now();
    if (
      source === "scanner" &&
      lastResolvedScanRef.current &&
      lastResolvedScanRef.current.value === trimmed &&
      now - lastResolvedScanRef.current.ts < 750
    ) {
      return;
    }

    const resolved = lookupCatalogItem(trimmed);
    if (!resolved) {
      toast({
        title: "Item not found",
        description: `No product or device matched: ${trimmed}`,
        variant: "destructive",
      });
      focusSearch();
      return;
    }

    lastResolvedScanRef.current = { value: trimmed, ts: now };
    setCatalogTab(resolved.tab);
    addToCart(resolved.type, resolved.item);
  };

  const addFirstSearchResult = () => {
    if (!firstVisibleItem) return;
    if (catalogTab === "products") {
      addToCart("product", firstVisibleItem as Product);
      return;
    }
    addToCart("device", firstVisibleItem as Device);
  };

  const handleScanResult = (decodedText: string) => {
    const trimmed = decodedText.trim();
    setIsScannerOpen(false);
    setSearch(trimmed);
    resolveAndAddCatalogItem(trimmed, "scanner");
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && search.trim()) {
      event.preventDefault();
      resolveAndAddCatalogItem(search, "manual");
      return;
    }

    if (event.key === "Backspace" && event.ctrlKey) {
      event.preventDefault();
      clearCart();
    }
  };

  const handleCheckout = async () => {
    const insufficient = cart.filter((item) => {
      if (!item.productId) return false;
      const product = products.find((entry) => entry.id === item.productId);
      return product ? product.stock < item.quantity : false;
    });

    if (insufficient.length > 0) {
      toast({
        title: "Insufficient stock",
        description: `Not enough stock for: ${insufficient.map((item) => item.name).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    const saleNumber = `S${Date.now().toString(36).toUpperCase()}`;

    try {
      const recordedSale = await recordSale({
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name || "Walk-in Customer",
        items: cart,
        totalAmount: cartTotal,
        paymentMethod: paymentMethod as any,
        status: "Completed",
        soldBy: currentUser?.name || "Staff",
      });

      const receipt = generateSaleReceipt(
        {
          saleNumber: recordedSale.saleNumber || saleNumber,
          customerName: selectedCustomer?.name || "Walk-in Customer",
          items: cart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
          totalAmount: cartTotal,
          paymentMethod,
          soldBy: currentUser?.name || "Staff",
          createdAt: new Date().toISOString(),
        },
        { name: "Phone Shop", location: "Kampala, Uganda" }
      );

      setReceiptData(receipt);
      setReceiptOpen(true);
      setCart([]);
      setCheckoutOpen(false);
      setSearch("");
      focusSearch();
      toast({
        title: "Sale completed",
        description: `Receipt generated for UGX ${cartTotal.toLocaleString()}.`,
      });
    } catch (err: any) {
      toast({
        title: "Checkout failed",
        description: err?.message || "The sale could not be completed. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_420px]">
      <aside className="flex flex-col rounded-[2rem] bg-white/98 p-3.5 shadow-[0_18px_42px_rgba(24,38,31,0.06)] xl:max-w-[220px]">
        <Link href="/pos">
          <div className="flex cursor-pointer items-center gap-3 rounded-[1.35rem] px-2 py-2.5">
            <img src="/ariostore-logo.png" alt="Ariostore" className="h-11 w-11 object-contain" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Ariostore</p>
              <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950">Point of Sale</h1>
            </div>
          </div>
        </Link>

        <nav className="mt-4 space-y-1.5">
          {POS_PRIMARY_LINKS.map((item) => {
            const active = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-[1.1rem] px-3.5 py-3 text-sm transition-colors",
                    active ? "bg-primary/15 text-slate-950" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <details className="mt-2 rounded-[1.25rem] bg-slate-50/90 px-3 py-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-700">
            <span>More</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </summary>
          <div className="mt-2 space-y-1">
            {POS_MORE_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <div className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-white hover:text-slate-950">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </details>
      </aside>

      <section className="min-w-0 rounded-[2rem] bg-white/98 shadow-[0_20px_48px_rgba(24,38,31,0.06)]">
        <div className="sticky top-0 z-10 rounded-t-[2rem] bg-white/96 px-5 py-5 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                ref={searchRef}
                placeholder="Search or scan product..."
                className="h-14 rounded-[1.3rem] border-border/70 bg-white pl-11 text-base shadow-[0_10px_22px_rgba(24,38,31,0.04)] focus-visible:ring-primary/20"
                aria-label="Search or scan products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                data-testid="pos-search-input"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-14 rounded-[1.3rem] border-border/70 px-5 text-sm font-medium lg:min-w-[160px]"
              aria-label="Scan barcode"
              onClick={() => setIsScannerOpen(true)}
            >
              <Scan className="mr-2 h-4 w-4" />
              Scan barcode
            </Button>
          </div>

          <div className="mt-5 flex gap-6" role="tablist" aria-label="Catalog type">
            <button
              type="button"
              role="tab"
              aria-selected={catalogTab === "products"}
              className={cn(
                "rounded-none border-b-2 px-0 pb-2 pt-0 text-sm font-medium transition-colors",
                catalogTab === "products" ? "border-primary text-slate-950" : "border-transparent text-slate-700 hover:text-slate-950",
              )}
              onClick={() => setCatalogTab("products")}
            >
              Products
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={catalogTab === "devices"}
              className={cn(
                "rounded-none border-b-2 px-0 pb-2 pt-0 text-sm font-medium transition-colors",
                catalogTab === "devices" ? "border-primary text-slate-950" : "border-transparent text-slate-700 hover:text-slate-950",
              )}
              onClick={() => setCatalogTab("devices")}
            >
              Devices
            </button>
          </div>
        </div>

        <Scanner
          open={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onDetected={handleScanResult}
          title="Scan barcode"
        />

        <ScrollArea className="h-[calc(100vh-13rem)] px-4 pb-5 md:px-5">
          {visibleItems.length === 0 ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-[1.8rem] bg-slate-50 px-8 text-center">
              <div>
                <p className="text-base font-medium text-slate-900">Nothing matches this search.</p>
                <p className="mt-1 text-sm text-slate-500">Try another term or use barcode scan for instant add.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 pt-1 pb-6 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
              {catalogTab === "products"
                ? filteredProducts.map((product) => {
                    const isLowStock = product.stock <= product.minStock;
                    return (
                      <div
                        key={product.id}
                        onClick={() => addToCart("product", product)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            addToCart("product", product);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className="group relative rounded-[1.65rem] bg-white p-3.5 text-left shadow-[0_12px_26px_rgba(24,38,31,0.045)] transition duration-200 hover:scale-[1.02] hover:shadow-[0_18px_36px_rgba(24,38,31,0.08)]"
                      >
                        {isAdminView && (
                          <button
                            type="button"
                            className="absolute right-3 top-3 rounded-full bg-white/96 p-1.5 text-slate-400 opacity-0 shadow-[0_6px_18px_rgba(24,38,31,0.08)] transition group-hover:opacity-100 hover:text-slate-900"
                            onClick={(event) => {
                              event.stopPropagation();
                              setLocation("/products");
                            }}
                            aria-label={`Manage ${product.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        <ProductImage
                          src={product.imageUrl}
                          alt={product.name}
                          fallbackLabel={product.brand || product.category || "Product"}
                          className="aspect-square w-full rounded-[18px]"
                        />
                        <div className="pr-8 pt-3">
                          <p className="line-clamp-2 text-sm font-medium text-slate-950">{product.name}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-slate-500">{product.stock} in stock</span>
                            {isAdminView && isLowStock ? (
                              <span className="rounded-full bg-orange-50 px-2 py-0.5 font-medium text-orange-700">
                                Low
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-4 text-lg font-semibold tracking-tight text-slate-950">
                          {formatUGX(product.price)}
                        </p>
                      </div>
                    );
                  })
                : filteredDevices.map((device) => (
                    <div
                      key={device.id}
                      onClick={() => addToCart("device", device)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          addToCart("device", device);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className="rounded-[1.65rem] bg-white p-3.5 text-left shadow-[0_12px_26px_rgba(24,38,31,0.045)] transition duration-200 hover:scale-[1.02] hover:shadow-[0_18px_36px_rgba(24,38,31,0.08)]"
                    >
                      <div className="flex aspect-square w-full items-center justify-center rounded-[1.2rem] bg-slate-100 text-slate-400">
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm font-medium text-slate-950">
                        {device.brand} {device.model}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {device.storage} • {device.color || "Available now"}
                      </p>
                      <p className="mt-4 text-lg font-semibold tracking-tight text-slate-950">
                        {formatUGX(device.price)}
                      </p>
                    </div>
                  ))}
            </div>
          )}
        </ScrollArea>
      </section>

      <section className="flex min-h-0 flex-col rounded-[2rem] bg-white/98 shadow-[0_24px_56px_rgba(24,38,31,0.085)] lg:col-span-2 xl:col-span-1">
        <div className="px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Current sale</h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full text-slate-400 hover:bg-secondary/80 hover:text-rose-600"
              aria-label="Clear current sale"
              onClick={clearCart}
              disabled={cart.length === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4">
            <Select
              value={selectedCustomer?.id ?? "walk-in"}
              onValueChange={(value) => {
                if (value === "walk-in") {
                  setSelectedCustomer(null);
                  return;
                }
                const customer = customers.find((entry) => entry.id === value);
                setSelectedCustomer(customer ?? null);
              }}
            >
              <SelectTrigger aria-label="Selected customer" className="h-12 rounded-[1.25rem] border-border/80">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-slate-400" />
                  <SelectValue placeholder="Select customer" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1 px-5 pb-5">
          {cart.length === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center text-center">
              <div>
                <p className="text-base font-medium text-slate-900">Current sale is empty.</p>
                <p className="mt-1 text-sm text-slate-500">Start by scanning or selecting a product.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pb-24">
              {cart.map((item) => (
                <div key={item.id} className="rounded-[1.45rem] bg-slate-50/90 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-950">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatUGX(item.unitPrice)} each</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-slate-400 hover:bg-white hover:text-rose-600"
                      aria-label={`Remove ${item.name} from cart`}
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-full bg-white p-1 shadow-[0_6px_16px_rgba(24,38,31,0.04)]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        aria-label={`Decrease quantity for ${item.name}`}
                        onClick={() => updateCartQuantity(item, "decrement")}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="min-w-10 text-center text-sm font-medium text-slate-950">{item.quantity}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        aria-label={`Increase quantity for ${item.name}`}
                        onClick={() => updateCartQuantity(item, "increment")}
                        disabled={!!item.deviceId || (() => {
                          if (!item.productId) return false;
                          const product = products.find((p) => p.id === item.productId);
                          return product ? item.quantity >= product.stock : false;
                        })()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-lg font-semibold text-slate-950">{formatUGX(item.totalPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="sticky bottom-0 mt-auto bg-white/98 px-5 py-5 backdrop-blur">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Subtotal</span>
              <span className="font-medium text-slate-900">{formatUGX(cartTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Tax</span>
              <span className="font-medium text-slate-900">0 UGX</span>
            </div>
            <div className="flex items-center justify-between pt-3">
              <span className="text-base font-medium text-slate-600">Total</span>
              <span className="text-4xl font-semibold tracking-tight text-slate-950">{formatUGX(cartTotal)}</span>
            </div>
          </div>

          <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
            <DialogTrigger asChild>
              <Button className="mt-4 h-14 w-full rounded-[1.25rem] text-base font-semibold" disabled={cart.length === 0}>
                Checkout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Complete Sale</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="rounded-[1.4rem] bg-secondary/72 p-5 text-center">
                  <p className="text-sm text-slate-500">Amount to pay</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{formatUGX(cartTotal)}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Payment method</label>
                  <Select onValueChange={setPaymentMethod} defaultValue={paymentMethod}>
                    <SelectTrigger aria-label="Payment method" className="h-12 rounded-[1.25rem] border-border/80">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-slate-400" />
                        <SelectValue placeholder="Select payment method" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                      <SelectItem value="Airtel">Airtel Money</SelectItem>
                      <SelectItem value="Card">Credit / Debit Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCheckout}>Confirm Payment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {receiptData && <Receipt isOpen={receiptOpen} onClose={() => setReceiptOpen(false)} data={receiptData} />}
    </div>
  );
}
