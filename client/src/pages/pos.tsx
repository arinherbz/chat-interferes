import { useState } from "react";
import { useData, SaleItem, Product, Device, Customer } from "@/lib/data-context";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ShoppingCart, Trash2, User, CreditCard, Smartphone, Package, Scan, Box, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { BarcodeScanner } from "@/components/barcode-scanner";
import { Receipt, generateSaleReceipt, type ReceiptData } from "@/components/receipt";

export default function POSPage() {
  const { products, devices, customers, recordSale, currentUser } = useData();
  const { toast } = useToast();
  
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  // Auto-scan logic
  const handleScanResult = (decodedText: string) => {
    setSearch(decodedText);
    setIsScannerOpen(false);
    
    // Simulate Enter key press behavior
    const exactDevice = devices.find(d => d.status === "In Stock" && d.imei === decodedText.trim());
    const exactProduct = products.find(p => p.name.toLowerCase() === decodedText.toLowerCase());

    if (exactDevice) {
      addToCart("device", exactDevice);
      setSearch("");
      toast({ title: "Scanned", description: `Added ${exactDevice.model}` });
    } else if (exactProduct) {
      addToCart("product", exactProduct);
      setSearch("");
      toast({ title: "Scanned", description: `Added ${exactProduct.name}` });
    } else {
      toast({ 
        title: "Item Not Found", 
        description: `No item found for code: ${decodedText}`,
        variant: "destructive"
      });
    }
  };

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && search.trim()) {
      handleScanResult(search);
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const filteredDevices = devices.filter(d => d.status === "In Stock" && (d.model.toLowerCase().includes(search.toLowerCase()) || d.imei.includes(search)));

  const addToCart = (type: "product" | "device", item: Product | Device) => {
    const existing = cart.find(i => (type === "product" ? i.productId === item.id : i.deviceId === item.id));
    
    if (existing && type === "product") {
      // Products can have qty > 1
      setCart(cart.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice } : i));
    } else if (existing && type === "device") {
      toast({ title: "Item already in cart", description: "Unique devices can only be added once." });
    } else {
      // Add new
      const newItem: SaleItem = {
        id: `temp-${Date.now()}`,
        name: type === "product" ? (item as Product).name : `${(item as Device).brand} ${(item as Device).model} (${(item as Device).storage})`,
        quantity: 1,
        unitPrice: item.price,
        totalPrice: item.price,
        productId: type === "product" ? item.id : undefined,
        deviceId: type === "device" ? item.id : undefined,
      };
      setCart([...cart, newItem]);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(i => i.id !== id));
  };

  const cartTotal = cart.reduce((acc, i) => acc + i.totalPrice, 0);
  const cartItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleCheckout = async () => {
    // Prevent negative stock: block checkout if any product lacks stock
    const insufficient = cart.filter(item => {
      if (!item.productId) return false;
      const product = products.find(p => p.id === item.productId);
      return product ? product.stock < item.quantity : false;
    });
    if (insufficient.length > 0) {
      toast({
        title: "Insufficient stock",
        description: `Not enough stock for: ${insufficient.map(i => i.name).join(", ")}`,
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
          items: cart.map(item => ({
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
    <div className="grid min-h-[calc(100vh-2rem)] gap-5 xl:grid-cols-[280px_minmax(0,1fr)_380px] animate-in fade-in duration-500">
      <section className="section-card flex flex-col p-5">
        <div className="border-b pb-4">
          <p className="section-label">Workspace</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Point of Sale</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search inventory, build the cart, and complete checkout from one screen.</p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="surface-muted p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-label">Customer</p>
                <p className="mt-2 font-medium text-foreground">{selectedCustomer?.name || "Walk-in Customer"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{selectedCustomer?.phone || "Attach a saved customer from checkout if needed."}</p>
              </div>
              <User className="mt-1 h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="surface-muted p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-label">Order Summary</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{cartItemsCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">Items currently in cart</p>
              </div>
              <ShoppingCart className="mt-1 h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="surface-muted p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-label">Total</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{cartTotal.toLocaleString()} UGX</p>
                <p className="mt-1 text-sm text-muted-foreground">Updates as you add products and devices.</p>
              </div>
              <CreditCard className="mt-1 h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-border bg-secondary/60 p-4">
          <p className="text-sm font-medium text-foreground">Quick tips</p>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><ChevronRight className="mt-0.5 h-4 w-4 text-primary" />Press Enter after an IMEI or product name to add it instantly.</li>
            <li className="flex gap-2"><ChevronRight className="mt-0.5 h-4 w-4 text-primary" />Use the barcode scanner for faster product lookup.</li>
            <li className="flex gap-2"><ChevronRight className="mt-0.5 h-4 w-4 text-primary" />The cart checks stock before completing checkout.</li>
          </ul>
        </div>
      </section>

      <section className="section-card flex min-h-0 flex-col p-5">
        <div className="flex flex-col gap-4 border-b pb-5">
          <div>
            <p className="section-label">Catalog</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">Products and devices</h2>
            <p className="mt-1 text-sm text-muted-foreground">Browse current inventory and add items directly to the cart.</p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search products, devices, or IMEI..." 
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleScan}
              />
            </div>
            <Button variant="outline" className="gap-2 lg:h-11" onClick={() => setIsScannerOpen(true)}>
              <Scan className="w-4 h-4" />
              <span>Scan barcode</span>
            </Button>
          </div>
        </div>

        <BarcodeScanner 
          isOpen={isScannerOpen} 
          onClose={() => setIsScannerOpen(false)} 
          onScan={handleScanResult} 
        />

        <Tabs defaultValue="products" className="mt-5 flex min-h-0 flex-1 flex-col">
          <TabsList className="h-12 rounded-xl border border-border bg-secondary p-1 shadow-none">
            <TabsTrigger value="products">Products & Accessories</TabsTrigger>
            <TabsTrigger value="devices">Phones & Devices</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-4 min-h-0 flex-1">
            <ScrollArea className="h-[calc(100vh-18rem)] pr-2">
              {filteredProducts.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40 p-8 text-center">
                  <Box className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-4 text-base font-medium text-foreground">No products found</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try a different search term or scan a barcode.</p>
                </div>
              ) : (
              <div className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredProducts.map(product => (
                  <Card 
                    key={product.id} 
                    className="group card-lift cursor-pointer overflow-hidden border-border bg-white"
                    onClick={() => addToCart("product", product)}
                  >
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-primary">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium line-clamp-2 text-foreground">{product.name}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">{product.stock} in stock</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <span className="text-lg font-bold text-foreground">{product.price.toLocaleString()}</span>
                        <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-primary">Add</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="devices" className="mt-4 min-h-0 flex-1">
            <ScrollArea className="h-[calc(100vh-18rem)] pr-2">
              {filteredDevices.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40 p-8 text-center">
                  <Smartphone className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-4 text-base font-medium text-foreground">No devices available</p>
                  <p className="mt-1 text-sm text-muted-foreground">Search by model name or IMEI to find a device.</p>
                </div>
              ) : (
               <div className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredDevices.map(device => (
                  <Card 
                    key={device.id} 
                    className="group card-lift cursor-pointer overflow-hidden border-border bg-white"
                    onClick={() => addToCart("device", device)}
                  >
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-primary">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium line-clamp-1 text-foreground">{device.brand} {device.model}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">{device.storage} • {device.color}</p>
                        <p className="mt-2 font-mono text-[11px] text-muted-foreground">{device.imei}</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <span className="text-lg font-bold text-foreground">{device.price.toLocaleString()}</span>
                        <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-primary">Add</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </section>

      <section className="section-card flex min-h-0 flex-col overflow-hidden">
        <Card className="flex flex-1 flex-col overflow-hidden border-0 bg-transparent shadow-none">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-label">Cart</p>
                <CardTitle className="mt-2 text-2xl font-bold">Current sale</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCart([])}>
                <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-500" />
              </Button>
            </div>
            
            <Select onValueChange={(val) => {
              const c = customers.find(c => c.id === val);
              setSelectedCustomer(c || null);
            }}>
              <SelectTrigger className="w-full mt-2">
                <div className="flex items-center gap-2">
                   <User className="w-4 h-4 text-muted-foreground" />
                   <span>{selectedCustomer?.name || "Walk-in Customer"}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-auto">
            {cart.length === 0 ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center text-muted-foreground">
                <ShoppingCart className="mb-3 h-12 w-12 opacity-25" />
                <p className="text-base font-medium text-foreground">Cart is empty</p>
                <p className="mt-1 text-sm text-muted-foreground">Select a product or device from the catalog to begin checkout.</p>
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {cart.map(item => (
                  <div key={item.id} className="rounded-xl border bg-secondary/35 p-4">
                    <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">{item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.quantity} x {item.unitPrice.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-foreground">{item.totalPrice.toLocaleString()}</p>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 -mr-2 text-muted-foreground hover:text-red-500"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          <div className="space-y-4 border-t bg-secondary/45 p-5">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground">{cartTotal.toLocaleString()} UGX</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (0%)</span>
                <span className="font-medium text-foreground">0 UGX</span>
              </div>
              <div className="flex justify-between border-t pt-3 text-lg font-bold">
                <span>Total</span>
                <span>{cartTotal.toLocaleString()} UGX</span>
              </div>
            </div>

            <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
              <DialogTrigger asChild>
                <Button className="h-12 w-full text-base font-semibold" disabled={cart.length === 0}>
                  Checkout
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Complete Sale</DialogTitle>
                </DialogHeader>
                
                <div className="py-4 space-y-4">
                  <div className="rounded-xl border bg-secondary/70 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Amount to Pay</p>
                    <p className="text-3xl font-bold text-foreground">{cartTotal.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">UGX</span></p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <label className="text-sm font-medium">Payment Method</label>
                    <Select onValueChange={setPaymentMethod} defaultValue={paymentMethod}>
                      <SelectTrigger className="w-full h-12">
                         <div className="flex items-center gap-2">
                           <CreditCard className="w-4 h-4 text-muted-foreground" />
                           <SelectValue placeholder="Select Payment Method" />
                         </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                        <SelectItem value="Airtel">Airtel Money</SelectItem>
                        <SelectItem value="Card">Credit/Debit Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
                  <Button onClick={handleCheckout}>Confirm Payment</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Card>
      </section>
      {receiptData && (
        <Receipt
          isOpen={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          data={receiptData}
        />
      )}
    </div>
  );
}
