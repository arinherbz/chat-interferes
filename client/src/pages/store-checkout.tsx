import { useState } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { MessageCircle } from "lucide-react";
import { StoreShell } from "@/components/store-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { formatUGX } from "@/lib/formatters";
import { saveLastStoreOrder, useStoreCart } from "@/lib/store-cart";
import { createWhatsAppUrl, isValidStorePhoneInput, normalizeStorePhoneInput } from "@/lib/store-support";
import { useToast } from "@/hooks/use-toast";

export default function StoreCheckoutPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { items, subtotal, shopId, clear } = useStoreCart();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("+256");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Mobile Money");
  const [deliveryType, setDeliveryType] = useState("PICKUP");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const deliveryFee = deliveryType === "PICKUP" ? 0 : deliveryType === "KAMPALA" ? 15000 : 25000;
  const total = subtotal + deliveryFee;

  async function submitOrder() {
    const trimmedName = customerName.trim();
    const normalizedPhone = normalizeStorePhoneInput(customerPhone);
    const trimmedEmail = customerEmail.trim();
    const trimmedAddress = deliveryAddress.trim();
    const trimmedNotes = notes.trim();

    if (items.length === 0) {
      toast({ title: "Cart is empty", description: "Add at least one item before checkout.", variant: "destructive" });
      return;
    }

    if (!trimmedName || !normalizedPhone) {
      toast({ title: "Missing details", description: "Customer name and phone are required.", variant: "destructive" });
      return;
    }

    if (!isValidStorePhoneInput(normalizedPhone)) {
      toast({ title: "Invalid phone number", description: "Use a phone number in the +256 format so we can confirm your order.", variant: "destructive" });
      return;
    }

    if (deliveryType !== "PICKUP" && !trimmedAddress) {
      toast({ title: "Delivery address required", description: "Add your delivery address before placing this order.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiRequest<{
        orderId: string;
        orderNumber: string;
        status: string;
        totalAmount: number;
        estimatedDelivery?: string;
        whatsappUrl?: string;
      }>("POST", "/api/store/checkout", {
        shopId: shopId ?? undefined,
        customerName: trimmedName,
        customerPhone: normalizedPhone,
        customerEmail: trimmedEmail || undefined,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        paymentMethod,
        deliveryType,
        deliveryAddress: deliveryType === "PICKUP" ? undefined : trimmedAddress,
        notes: [trimmedNotes, deliveryType !== "PICKUP" ? `Delivery type: ${deliveryType}` : ""].filter(Boolean).join(" | "),
      });

      saveLastStoreOrder(response);
      clear();
      navigate("/store/confirmation");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed";
      toast({ title: "Checkout failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StoreShell>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Checkout</h2>
          <p className="mt-1 text-sm text-muted-foreground">Complete your purchase</p>
        </div>
        <Card>
          <CardContent className="grid gap-8 p-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div className="grid gap-2">
                <Label>Customer Name</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="grid gap-2">
                <Label>Phone Number</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+2567..." />
                <p className="text-xs text-muted-foreground">We use this number to confirm delivery and payment details.</p>
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Optional email" />
              </div>
              <div className="grid gap-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                    <SelectItem value="Cash">Cash on Delivery</SelectItem>
                    <SelectItem value="Card">Pay at Store</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Delivery Option</Label>
                <Select value={deliveryType} onValueChange={setDeliveryType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PICKUP">Pickup</SelectItem>
                    <SelectItem value="KAMPALA">Kampala Delivery</SelectItem>
                    <SelectItem value="UPCOUNTRY">Upcountry Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {deliveryType !== "PICKUP" ? (
                <div className="grid gap-2">
                  <Label>Delivery Address</Label>
                  <Textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Street, area, landmark" />
                  <p className="text-xs text-muted-foreground">Include the area and a nearby landmark for faster delivery coordination.</p>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional order notes" />
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-secondary/35 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-slate-950">Need help finishing your order?</p>
                  <p className="text-sm text-muted-foreground">Our team can confirm delivery options and payment details on WhatsApp.</p>
                </div>
                <a href={createWhatsAppUrl("Hello Ario Store, I need help completing my order.")} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Chat on WhatsApp
                  </Button>
                </a>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl bg-secondary p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Order Summary</p>
                <h3 className="mt-2 text-2xl font-semibold">Your items</h3>
              </div>
              {items.length === 0 ? (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>Your cart is empty.</p>
                  <Link href="/store/cart"><Button variant="outline">Back to Cart</Button></Link>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.productId} className="flex items-start justify-between gap-4 rounded-2xl bg-background p-3">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">Qty {item.quantity}</p>
                        </div>
                        <p className="font-semibold">{formatUGX(item.price * item.quantity)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 border-t border-border/70 pt-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatUGX(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Delivery</span>
                      <span>{formatUGX(deliveryFee)}</span>
                    </div>
                    <div className="flex items-center justify-between text-base font-semibold">
                      <span>Total</span>
                      <span>{formatUGX(total)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/store/cart"><Button variant="outline">Back to Cart</Button></Link>
                    <Button onClick={submitOrder} disabled={submitting}>
                      {submitting ? "Placing Order..." : "Place Order"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </StoreShell>
  );
}
