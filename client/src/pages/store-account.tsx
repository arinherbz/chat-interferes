import { StoreShell } from "@/components/store-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function StoreAccountPage() {
  return (
    <StoreShell>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">My Account</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage your orders and profile.</p>
        </div>
        <Card>
          <CardContent className="grid gap-4 p-6 md:grid-cols-2">
            {["Order History", "Repair Tracking", "Trade-In Requests", "Saved Addresses"].map((title) => (
              <Card key={title}>
                <CardContent className="space-y-2 p-5">
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-sm text-muted-foreground">Coming soon</p>
                  <Button size="sm" variant="outline">View</Button>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>
    </StoreShell>
  );
}
