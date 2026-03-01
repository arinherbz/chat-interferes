import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  lowStockCount: number;
  pendingRepairs: number;
  onViewStock: () => void;
  onOpenRepairs: () => void;
};

export function AlertsBar({ lowStockCount, pendingRepairs, onViewStock, onOpenRepairs }: Props) {
  if (lowStockCount <= 0 && pendingRepairs <= 0) return null;

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {lowStockCount > 0 && (
        <Card className="border-slate-200 bg-white">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-slate-900">{lowStockCount} low-stock products</p>
              <p className="text-sm text-slate-500">Restock soon to avoid sales disruption.</p>
            </div>
            <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/5" onClick={onViewStock}>
              View Stock
            </Button>
          </CardContent>
        </Card>
      )}
      {pendingRepairs > 0 && (
        <Card className="border-slate-200 bg-white">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-slate-900">{pendingRepairs} pending repairs</p>
              <p className="text-sm text-slate-500">Technician attention required.</p>
            </div>
            <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/5" onClick={onOpenRepairs}>
              Open Repairs
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
