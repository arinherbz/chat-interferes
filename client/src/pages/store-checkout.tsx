import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { StoreShell } from "@/components/store-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { useStoreCart } from "@/lib/storefront";
import { formatUGX } from "@/lib/utils";

export default function StoreCheckoutPage() {
  const [, navigate] = useLocation();
  const { items, subtotal, clearCart } = useStoreCart();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("+256");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryType, setDeliveryType] = useState("PICKUP");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("MTN_MOMO");
  const [notes, setNotes] = useState("");

  const deliveryFee = deliveryType === "KAMPALA" ? 15000 : 0;

  const mutation = useMutation({
    mutationFn: async () =>
      apiRequest<any>("POST", "/api/store/checkout", {
        customerName,
        customerPhone,
        customerEmail,
        deliveryType,
        deliveryAddress,
        deliveryFee,
        paymentMethod,
        notes,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      }),
    onSuccess: (order) => {
      clearCart();
      navigate(`/store/confirmation?order=${order.orderNumber}`);
    },
  });

  return (
    <StoreShell>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Checkout</p>
          <h2 className="text-3xl font-semibold tracking-tight">Delivery and payment details.</h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardContent className="grid gap-5 p-6">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Delivery Option</Label>
                  <Select value={deliveryType} onValueChange={setDeliveryType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PICKUP">Pick Up In Store</SelectItem>
                      <SelectItem value="KAMPALA">Kampala Delivery</SelectItem>
                      <SelectItem value="UPCOUNTRY">Upcountry Delivery (quote)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Payment</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MTN_MOMO">MTN MoMo</SelectItem>
                      <SelectItem value="AIRTEL_MONEY">Airtel Money</SelectItem>
                      <SelectItem value="CASH_ON_DELIVERY">Cash on Delivery</SelectItem>
                      <SelectItem value="PAY_AT_STORE">Pay at Store</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Delivery Address</Label>
                <Textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Kampala road, building, landmark..." />
              </div>
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferred pickup time, landmark, or payment note." />
              </div>
              <div className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
                Mobile money instructions: pay to the shop number shown by staff, then wait for manual confirmation. Upcountry delivery creates an admin follow-up for final pricing.
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit lg:sticky lg:top-24">
            <CardContent className="space-y-4 p-5">
              {items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between gap-3 text-sm">
                  <span>{item.name} x {item.quantity}</span>
                  <span>{formatUGX(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatUGX(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span>{deliveryType === "UPCOUNTRY" ? "Quoted" : formatUGX(deliveryFee)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-4 text-base font-semibold">
                <span>Total</span>
                <span>{deliveryType === "UPCOUNTRY" ? formatUGX(subtotal) : formatUGX(subtotal + deliveryFee)}</span>
              </div>
              <Button
                className="w-full"
                disabled={!customerName || !customerPhone || items.length === 0 || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? "Submitting..." : "Place Order"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </StoreShell>
  );
}
