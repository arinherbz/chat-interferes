import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Eye, CheckCircle2, XCircle, AlertTriangle, FileText } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ClosuresPage() {
  const { closures, activeShop, updateClosure } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedClosure, setSelectedClosure] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Filter closures for active shop
  const shopClosures = closures.filter(c => c.shopId === activeShop.id);

  if ((user?.role as string) !== "Owner" && (user?.role as string) !== "Manager") {
    return (
      <div className="surface-panel flex flex-col items-center justify-center h-[50vh] text-center">
        <AlertTriangle className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 max-w-sm mt-2">Only owners and managers can review daily closures.</p>
      </div>
    );
  }

  const handleApprove = async () => {
    if (!selectedClosure) return;

    setIsApproving(true);
    try {
      await updateClosure(selectedClosure.id, { status: "confirmed" });
      toast({ title: "Closure approved", description: "The daily report has been verified." });
      setOpen(false);
      setSelectedClosure(null);
    } catch (error) {
      toast({
        title: "Could not approve closure",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-hero">
        <div className="page-kicker">Branch Controls</div>
        <h1 className="page-title">Daily Closures</h1>
        <p className="page-subtitle">Review balances, proof uploads, and branch variances in a calmer audit-friendly layout.</p>
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>Past 30 days of closures.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Counted</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shopClosures.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                    No closures recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                shopClosures.map((closure) => (
                  <TableRow key={closure.id}>
                    <TableCell>{format(new Date(closure.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{closure.submittedBy}</TableCell>
                    <TableCell className="text-right">{closure.cashExpected.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {(closure.cashCounted + closure.mtnAmount + closure.airtelAmount + closure.cardAmount).toLocaleString()}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${closure.variance < 0 ? 'text-red-600' : closure.variance > 0 ? 'text-green-600' : 'text-slate-500'}`}>
                      {closure.variance > 0 ? "+" : ""}{closure.variance.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={
                          closure.status === "confirmed" ? "tone-success" :
                          closure.status === "flagged" ? "tone-danger" :
                          "tone-warning"
                        }
                      >
                        {closure.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedClosure(closure); setOpen(true); }}>
                        <Eye className="w-4 h-4 mr-2" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Closure Details - {selectedClosure && format(new Date(selectedClosure.date), "MMM dd, yyyy")}</DialogTitle>
          </DialogHeader>
          
          {selectedClosure && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="surface-muted p-4">
                  <div className="text-xs text-slate-500 uppercase">Cash Counted</div>
                  <div className="text-xl font-bold">{selectedClosure.cashCounted.toLocaleString()}</div>
                </div>
                <div className="tone-warning rounded-lg p-4">
                  <div className="text-xs uppercase">MTN Money</div>
                  <div className="text-xl font-bold">{selectedClosure.mtnAmount.toLocaleString()}</div>
                </div>
                <div className="tone-danger rounded-lg p-4">
                  <div className="text-xs uppercase">Airtel Money</div>
                  <div className="text-xl font-bold">{selectedClosure.airtelAmount.toLocaleString()}</div>
                </div>
                <div className="tone-info rounded-lg p-4">
                  <div className="text-xs uppercase">Card / POS</div>
                  <div className="text-xl font-bold">{selectedClosure.cardAmount.toLocaleString()}</div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Proof Uploads
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   {selectedClosure.proofs.cashDrawer && (
                     <div className="aspect-video bg-slate-100 rounded flex items-center justify-center text-xs text-slate-500">
                       <img src={selectedClosure.proofs.cashDrawer} className="w-full h-full object-cover rounded" alt="Cash" />
                     </div>
                   )}
                   {selectedClosure.proofs.mtn && (
                     <div className="aspect-video bg-slate-100 rounded flex items-center justify-center text-xs text-slate-500">
                       <img src={selectedClosure.proofs.mtn} className="w-full h-full object-cover rounded" alt="MTN" />
                     </div>
                   )}
                   {selectedClosure.proofs.airtel && (
                     <div className="aspect-video bg-slate-100 rounded flex items-center justify-center text-xs text-slate-500">
                       <img src={selectedClosure.proofs.airtel} className="w-full h-full object-cover rounded" alt="Airtel" />
                     </div>
                   )}
                   {selectedClosure.proofs.card && (
                     <div className="aspect-video bg-slate-100 rounded flex items-center justify-center text-xs text-slate-500">
                       <img src={selectedClosure.proofs.card} className="w-full h-full object-cover rounded" alt="Card" />
                     </div>
                   )}
                </div>
              </div>

              {selectedClosure.variance !== 0 && (
                <div className="tone-danger rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900">Variance Detected</h4>
                    <p className="text-sm text-red-700">
                      There is a discrepancy of {selectedClosure.variance.toLocaleString()} UGX between expected and counted amounts.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={() => void handleApprove()} disabled={isApproving}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {isApproving ? "Approving..." : "Approve Closure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
