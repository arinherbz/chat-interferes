import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Pencil } from "lucide-react";

type BaseValue = {
  id?: string;
  brand: string;
  model: string;
  storage: string;
  baseValue: number;
  isActive?: boolean;
  shopId?: string | null;
};

export default function BaseValuesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BaseValue[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BaseValue | null>(null);
  const [form, setForm] = useState<BaseValue>({
    brand: "",
    model: "",
    storage: "",
    baseValue: 0,
    isActive: true,
  });

  const canEdit = user?.role === "Owner" || user?.role === "Manager";

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<BaseValue[]>("GET", "/api/trade-in/base-values");
      setRows(data);
    } catch (err: any) {
      toast({ title: "Failed to load base values", description: err?.message || "Please retry.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ brand: "", model: "", storage: "", baseValue: 0, isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (row: BaseValue) => {
    setEditing(row);
    setForm({
      brand: row.brand,
      model: row.model,
      storage: row.storage,
      baseValue: row.baseValue,
      isActive: row.isActive ?? true,
      shopId: row.shopId ?? undefined,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.brand.trim() || !form.model.trim() || !form.storage.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    if (Number.isNaN(form.baseValue) || form.baseValue <= 0) {
      toast({ title: "Enter a valid base value", description: "Must be greater than 0", variant: "destructive" });
      return;
    }
    try {
      await apiRequest("POST", "/api/trade-in/base-values/manage", form);
      toast({ title: editing ? "Base value updated" : "Base value added" });
      setDialogOpen(false);
      setEditing(null);
      load();
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Please retry.", variant: "destructive" });
    }
  };

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
        <Badge variant="outline" className="text-red-600 border-red-200">
          Restricted
        </Badge>
        <p className="text-lg font-semibold text-slate-900">Owner or Manager access required.</p>
        <p className="text-slate-500 text-sm">Ask an admin to grant you access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Trade-In Base Values</h1>
          <p className="text-slate-500">Manage brand/model/storage payouts. Edits apply immediately.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Base Value
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Device Base Values</CardTitle>
          <CardDescription>Showing {rows.length} entries.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Base Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={`${row.brand}-${row.model}-${row.storage}`}>
                      <TableCell className="font-medium">{row.brand}</TableCell>
                      <TableCell>{row.model}</TableCell>
                      <TableCell>{row.storage}</TableCell>
                      <TableCell className="font-semibold">{row.baseValue.toLocaleString()} UGX</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={row.isActive === false ? "text-red-600 border-red-200" : "text-green-600 border-green-200"}
                        >
                          {row.isActive === false ? "Inactive" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500">
                        No base values found. Add one to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Base Value" : "Add Base Value"}</DialogTitle>
            <DialogDescription>Save will upsert by brand/model/storage.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Brand</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Apple" />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="iPhone 17 Pro Max" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Storage</Label>
                <Input value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })} placeholder="256GB" />
              </div>
              <div className="space-y-2">
                <Label>Base Value (UGX)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  value={form.baseValue || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const parsed = Number(val);
                    setForm({ ...form, baseValue: Number.isNaN(parsed) ? 0 : parsed });
                  }}
                  placeholder="e.g. 4200000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.isActive ? "active" : "inactive"}
                  onValueChange={(val) => setForm({ ...form, isActive: val === "active" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button onClick={() => setDialogOpen(false)} variant="ghost">
              Cancel
            </Button>
            <Button onClick={save}>{editing ? "Save Changes" : "Add Base Value"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
