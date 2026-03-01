import { DollarSign, Users, Wallet, Wrench } from "lucide-react";
import type { Product } from "@/lib/data-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  topProducts: Product[];
  onNewSale: () => void;
  onNewRepair: () => void;
  onDailyClose: () => void;
  onCustomers: () => void;
};

export function InventoryActionsPanel({
  topProducts,
  onNewSale,
  onNewRepair,
  onDailyClose,
  onCustomers,
}: Props) {
  return (
    <div className="space-y-4">
      <Card className="card-lift border-slate-200 bg-white">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">Top Inventory Value</CardTitle>
          <CardDescription>Highest value stock on hand</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          {topProducts.map((product) => (
            <div key={product.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
                <p className="text-xs text-slate-500">Qty {product.stock}</p>
              </div>
              <Badge variant="secondary">{(product.price * product.stock).toLocaleString()} UGX</Badge>
            </div>
          ))}
          {topProducts.length === 0 && <p className="text-sm text-slate-500">No products in inventory yet.</p>}
        </CardContent>
      </Card>

      <Card className="card-lift border-slate-200 bg-white">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">Quick Actions</CardTitle>
          <CardDescription>Fast access to daily workflows</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 p-4 pt-0">
          <Button variant="outline" className="justify-start border-primary/30 text-primary hover:bg-primary/5" onClick={onNewSale}>
            <DollarSign className="mr-2 h-4 w-4" />
            New Sale
          </Button>
          <Button variant="outline" className="justify-start border-primary/30 text-primary hover:bg-primary/5" onClick={onNewRepair}>
            <Wrench className="mr-2 h-4 w-4" />
            New Repair
          </Button>
          <Button variant="outline" className="justify-start border-primary/30 text-primary hover:bg-primary/5" onClick={onDailyClose}>
            <Wallet className="mr-2 h-4 w-4" />
            Daily Close
          </Button>
          <Button variant="outline" className="justify-start border-primary/30 text-primary hover:bg-primary/5" onClick={onCustomers}>
            <Users className="mr-2 h-4 w-4" />
            Customers
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
