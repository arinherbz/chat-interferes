import { StoreShell } from "@/components/store-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function StoreAccountPage() {
  return (
    <StoreShell>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Account Portal</p>
          <h2 className="text-3xl font-semibold tracking-tight">Phone + OTP sign-in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This UI is ready for SMS or WhatsApp OTP integration and will host orders, repairs, trade-ins, saved addresses, and wishlist data.
          </p>
        </div>
        <Card>
          <CardContent className="grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-2">
              <Label>Phone Number</Label>
              <Input defaultValue="+256" />
            </div>
            <Button>Send OTP</Button>
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          {["Order History", "Repair Tracking", "Trade-In Requests", "Saved Addresses / Wishlist"].map((title) => (
            <Card key={title}>
              <CardContent className="space-y-2 p-5">
                <h3 className="font-medium">{title}</h3>
                <p className="text-sm text-muted-foreground">Connected UI shell in place. Backend auth and customer-scoped data endpoints still need provider-specific OTP integration.</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </StoreShell>
  );
}
