import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

interface Brand { id: string; name: string; isActive?: boolean; sortOrder?: number }
interface Model { id: string; name: string; brandId: string; isActive?: boolean; sortOrder?: number }

export default function BrandsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  const [loading, setLoading] = useState(false);

  // Dialog state
  const [openBrandDialog, setOpenBrandDialog] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);

  const [openModelDialog, setOpenModelDialog] = useState(false);
  const [modelName, setModelName] = useState("");
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  useEffect(() => { loadBrands(); }, []);

  async function loadBrands() {
    setLoading(true);
    try {
      const res = await fetch(`/api/brands`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load brands");
      const json = await res.json();
      // server may return objects or simple array
      const list = Array.isArray(json) ? json : [];
      setBrands(list as Brand[]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || String(err), variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function loadModels(brandId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/models?brand_id=${encodeURIComponent(brandId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load models");
      const json = await res.json();
      setModels(json as Model[]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || String(err), variant: "destructive" });
    } finally { setLoading(false); }
  }

  // Brand CRUD
  const openCreateBrand = () => { setEditingBrandId(null); setBrandName(""); setOpenBrandDialog(true); };
  const openEditBrand = (b: Brand) => { setEditingBrandId(b.id); setBrandName(b.name); setOpenBrandDialog(true); };

  async function saveBrand() {
    if (!brandName.trim()) return toast({ title: "Validation", description: "Name is required" });
    try {
      const payload = { name: brandName.trim() };
      let res;
      if (editingBrandId) {
        res = await fetch(`/api/brands/${editingBrandId}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        res = await fetch(`/api/brands`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      if (!res.ok) throw new Error('Save failed');
      await loadBrands();
      setOpenBrandDialog(false);
      toast({ title: 'Saved', description: 'Brand saved.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' });
    }
  }

  async function deleteBrand(id: string) {
    if (!confirm('Delete brand? This will not remove existing models automatically.')) return;
    try {
      const res = await fetch(`/api/brands/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      await loadBrands();
      setModels([]);
      setSelectedBrand(null);
      toast({ title: 'Deleted', description: 'Brand deleted.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' });
    }
  }

  // Model CRUD
  const openCreateModel = () => { setEditingModelId(null); setModelName(""); setOpenModelDialog(true); };
  const openEditModel = (m: Model) => { setEditingModelId(m.id); setModelName(m.name); setOpenModelDialog(true); };

  async function saveModel() {
    if (!modelName.trim() || !selectedBrand) return toast({ title: 'Validation', description: 'Brand and model name required' });
    try {
      const payload = { brandId: selectedBrand.id, name: modelName.trim() };
      let res;
      if (editingModelId) {
        res = await fetch(`/api/models/${editingModelId}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        res = await fetch(`/api/models`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      if (!res.ok) throw new Error('Save failed');
      await loadModels(selectedBrand.id);
      setOpenModelDialog(false);
      toast({ title: 'Saved', description: 'Model saved.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' });
    }
  }

  async function deleteModel(id: string) {
    if (!confirm('Delete model?')) return;
    try {
      const res = await fetch(`/api/models/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      if (selectedBrand) await loadModels(selectedBrand.id);
      toast({ title: 'Deleted', description: 'Model deleted.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Brands & Models</h1>
        {user?.role === 'Owner' || user?.role === 'Manager' ? (
          <div className="flex gap-2">
            <Button onClick={openCreateBrand}>New Brand</Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Brands</CardTitle>
            <CardDescription>Canonical list of brands</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.map(b => (
                  <TableRow key={b.id} className="hover:bg-slate-50 cursor-pointer">
                    <TableCell onClick={() => { setSelectedBrand(b); loadModels(b.id); }}>{b.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => openEditBrand(b)}>Edit</Button>
                        <Button variant="ghost" onClick={() => deleteBrand(b.id)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Models {selectedBrand ? `— ${selectedBrand.name}` : ''}</CardTitle>
            <CardDescription>Models for selected brand</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-4">
              <Button onClick={openCreateModel} disabled={!selectedBrand}>New Model</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => openEditModel(m)}>Edit</Button>
                        <Button variant="ghost" onClick={() => deleteModel(m.id)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Brand Dialog */}
      <Dialog open={openBrandDialog} onOpenChange={setOpenBrandDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBrandId ? 'Edit Brand' : 'New Brand'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Name</Label>
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={() => setOpenBrandDialog(false)} variant="ghost">Cancel</Button>
            <Button onClick={saveBrand}>{editingBrandId ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Model Dialog */}
      <Dialog open={openModelDialog} onOpenChange={setOpenModelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModelId ? 'Edit Model' : 'New Model'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Model Name</Label>
            <Input value={modelName} onChange={(e) => setModelName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={() => setOpenModelDialog(false)} variant="ghost">Cancel</Button>
            <Button onClick={saveModel}>{editingModelId ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
