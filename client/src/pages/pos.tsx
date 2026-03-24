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
import { Search, ShoppingCart, Trash2, User, CreditCard, Plus, Smartphone, Package, Scan } from "lucide-react";
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
    <div className="flex min-h-[calc(100vh-2rem)] flex-col gap-4 xl:h-[calc(100vh-2rem)] xl:flex-row animate-in fade-in duration-500">
      {/* LEFT: Product Catalog */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search products, devices, or IMEI..." 
                className="h-12 rounded-2xl border-border/80 bg-white/85 pl-10 shadow-sm backdrop-blur-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleScan}
              />
            </div>
            <Button variant="outline" className="gap-2 shrink-0" onClick={() => setIsScannerOpen(true)}>
              <Scan className="w-4 h-4" />
              <span className="hidden sm:inline">Scan Barcode</span>
            </Button>
          </div>
        </div>

        <BarcodeScanner 
          isOpen={isScannerOpen} 
          onClose={() => setIsScannerOpen(false)} 
          onScan={handleScanResult} 
        />

          <Tabs defaultValue="products" className="flex-1 flex flex-col">
          <TabsList className="h-12 rounded-2xl border border-border/70 bg-secondary/90 p-1 shadow-sm">
            <TabsTrigger value="products">Products & Accessories</TabsTrigger>
            <TabsTrigger value="devices">Phones & Devices</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="flex-1">
            <ScrollArea className="h-[600px] pr-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                {filteredProducts.map(product => (
                  <Card 
                    key={product.id} 
                    className="group cursor-pointer overflow-hidden rounded-[1.4rem] border-border/80 bg-white/92 shadow-sm hover:border-primary/25 hover:shadow-md"
                    onClick={() => addToCart("product", product)}
                  >
                    <CardContent className="p-4 flex flex-col gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-primary">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium line-clamp-1">{product.name}</h4>
                        <p className="text-xs text-muted-foreground">{product.stock} in stock</p>
                      </div>
                      <div className="mt-auto font-semibold text-foreground">
                        {product.price.toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="devices" className="flex-1">
            <ScrollArea className="h-[600px] pr-4">
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                {filteredDevices.map(device => (
                  <Card 
                    key={device.id} 
                    className="group cursor-pointer overflow-hidden rounded-[1.4rem] border-border/80 bg-white/92 shadow-sm hover:border-primary/25 hover:shadow-md"
                    onClick={() => addToCart("device", device)}
                  >
                    <CardContent className="p-4 flex flex-col gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-primary">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium line-clamp-1">{device.brand} {device.model}</h4>
                        <p className="text-xs text-muted-foreground">{device.storage} • {device.color}</p>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground/80">{device.imei}</p>
                      </div>
                      <div className="mt-auto font-semibold text-foreground">
                        {device.price.toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* RIGHT: Cart */}
      <div className="w-full xl:w-[400px] flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden rounded-[1.6rem] border-border/80 bg-white/95 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
          <CardHeader className="border-b border-border/70 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Current Sale</CardTitle>
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
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
                <p>Cart is empty</p>
              </div>
            ) : (
              <div className="divide-y">
                {cart.map(item => (
                  <div key={item.id} className="p-4 flex gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} x {item.unitPrice.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{item.totalPrice.toLocaleString()}</p>
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
                ))}
              </div>
            )}
          </CardContent>

          <div className="space-y-4 border-t border-border/70 bg-secondary/55 p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{cartTotal.toLocaleString()} UGX</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (0%)</span>
                <span>0 UGX</span>
              </div>
              <div className="flex justify-between border-t border-border/80 pt-2 text-lg font-semibold">
                <span>Total</span>
                <span>{cartTotal.toLocaleString()} UGX</span>
              </div>
            </div>

            <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
              <DialogTrigger asChild>
                <Button className="w-full h-12 text-lg" disabled={cart.length === 0}>
                  Checkout
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Complete Sale</DialogTitle>
                </DialogHeader>
                
                <div className="py-4 space-y-4">
                  <div className="rounded-2xl bg-secondary/70 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Amount to Pay</p>
                    <p className="text-3xl font-semibold text-foreground">{cartTotal.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">UGX</span></p>
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
      </div>
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
