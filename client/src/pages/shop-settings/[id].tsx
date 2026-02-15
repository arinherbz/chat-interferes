import { useState, useEffect } from "react";
import { useData, type Shop } from "@/lib/data-context";
import { useParams, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";

export default function ShopSettingsPage() {
  const { id } = useParams();
  const { shops, updateShop } = useData();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const shop = shops.find(s => s.id === id) as Shop | undefined;
  const [form, setForm] = useState<Partial<Shop>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shop) {
      setForm({
        ...shop,
        location: (shop as any).location || (shop as any).address || "",
        logoUrl: (shop as any).logo?.url || shop.logoUrl,
        coverUrl: (shop as any).coverImage?.url || (shop as any).coverUrl,
      });
    }
  }, [shop]);

  if (!shop) return <div className="p-6">Shop not found.</div>;

  const onChange = (field: keyof Shop, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const save = async () => {
    if (!shop) return;
    setSaving(true);
    try {
      // Map UI fields to API schema (logo/coverImage as objects)
      const payload: any = {
        name: form.name,
        location: form.location || (form as any).address || "",
        description: (form as any).description || "",
        phone: (form as any).phone || "",
        email: (form as any).email || "",
      };
      if ((form as any).logo?.url) payload.logoUrl = (form as any).logo.url;
      else if (form.logoUrl) payload.logoUrl = form.logoUrl;
      if ((form as any).coverImage?.url) payload.coverUrl = (form as any).coverImage.url;
      else if (form.coverUrl) payload.coverUrl = form.coverUrl;

      await updateShop(shop.id, payload);
      toast({ title: "Saved", description: "Shop settings updated" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Could not update shop", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-semibold mb-2">{shop.name} — Settings</h1>
        <p className="text-sm text-slate-500 mb-6">Edit shop details, brand assets, and appearance.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Brand</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col items-center">
                  <div className="w-28 h-28 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center mb-3">
                    {((form as any).logo?.url || form.logoUrl) ? (
                      <img src={(form as any).logo?.url || form.logoUrl} alt="logo" className="w-full h-full object-cover"/>
                    ) : <div className="text-slate-400">Logo</div>}
                  </div>
                  <FileUpload
                    accept="image/*"
                    onUpload={(url: string) => {
                      onChange("logo", { url });
                      onChange("logoUrl" as any, url);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Cover Image</label>
                  {((form as any).coverImage?.url || form.coverUrl) && (
                    <img src={(form as any).coverImage?.url || form.coverUrl} alt="cover" className="w-full h-28 object-cover rounded-md mb-2" />
                  )}
                  <FileUpload
                    accept="image/*"
                    onUpload={(url: string) => {
                      onChange("coverImage", { url });
                      onChange("coverUrl" as any, url);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-600">Shop Name</label>
                    <Input value={form.name || ""} onChange={e => onChange("name", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Location</label>
                    <Input value={form.location || ""} onChange={e => onChange("location", e.target.value)} />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-sm text-slate-600">Description</label>
                  <Textarea value={(form as any).description || ""} onChange={e => onChange("description" as any, e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact & Appearance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-600">Phone</label>
                    <Input value={(form as any).phone || ""} onChange={e => onChange("phone" as any, e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Email</label>
                    <Input value={(form as any).email || ""} onChange={e => onChange("email" as any, e.target.value)} />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end">
                  <Button onClick={() => window.history.back()} variant="ghost" className="mr-2">Cancel</Button>
                  <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
