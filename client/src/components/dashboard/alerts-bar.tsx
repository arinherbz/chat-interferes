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
    <section className="grid gap-3 lg:grid-cols-2">
      {lowStockCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-amber-900">{lowStockCount} low-stock products</p>
              <p className="text-sm text-amber-700">Restock soon to avoid sales disruption.</p>
            </div>
            <Button variant="outline" className="border-amber-300 text-amber-800" onClick={onViewStock}>
              View Stock
            </Button>
          </CardContent>
        </Card>
      )}
      {pendingRepairs > 0 && (
        <Card className="border-blue-200 bg-blue-50/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-blue-900">{pendingRepairs} pending repairs</p>
              <p className="text-sm text-blue-700">Technician attention required.</p>
            </div>
            <Button variant="outline" className="border-blue-300 text-blue-800" onClick={onOpenRepairs}>
              Open Repairs
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
