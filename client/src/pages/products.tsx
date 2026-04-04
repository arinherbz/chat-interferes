import { useState } from "react";
import { useData } from "@/lib/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Plus, Scan } from "lucide-react";
import { FileUploader, type UploadedFileMeta } from "@/components/file-uploader";
import { useToast } from "@/hooks/use-toast";
import { ProductImage } from "@/components/product-image";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";

const productSchema = z.object({
  brand: z.string().optional(),
  model: z.string().optional(),
  name: z.string().min(1, "Name required"),
  displayTitle: z.string().optional(),
  description: z.string().optional(),
  category: z.string().min(1, "Category required"),
  condition: z.string().optional(),
  barcode: z.string().optional(),
  price: z.coerce.number().min(0, "Price required"),
  stock: z.coerce.number().min(0, "Stock required"),
  costPrice: z.coerce.number().min(0, "Cost required"),
  minStock: z.coerce.number().min(0, "Min stock required"),
  storefrontVisibility: z.enum(["published", "draft", "hidden", "archived"]).default("published"),
  isFeatured: z.coerce.boolean().default(false),
  isFlashDeal: z.coerce.boolean().default(false),
  flashDealPrice: z.union([z.coerce.number().min(0), z.nan()]).optional(),
  flashDealEndsAt: z.string().optional(),
  imageUrl: z.string().optional(),
});

import { BarcodeScanner } from "@/components/barcode-scanner";

export default function ProductsPage() {
  const { products, addProduct, updateProduct, deleteProduct } = useData();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [attachments, setAttachments] = useState<UploadedFileMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<typeof products[number] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const startEdit = (product: typeof products[number]) => {
    form.reset({
      brand: product.brand ?? "",
      model: product.model ?? "",
      name: product.name,
      displayTitle: product.displayTitle ?? "",
      description: product.description ?? "",
      category: product.category as any,
      condition: product.condition ?? "",
      barcode: product.barcode ?? "",
      price: product.price,
      stock: product.stock,
      costPrice: product.costPrice ?? 0,
      minStock: product.minStock ?? 1,
      storefrontVisibility: product.storefrontVisibility ?? "published",
      isFeatured: Boolean(product.isFeatured),
      isFlashDeal: Boolean(product.isFlashDeal),
      flashDealPrice: product.flashDealPrice ?? undefined,
      flashDealEndsAt: product.flashDealEndsAt ? new Date(product.flashDealEndsAt).toISOString().slice(0, 16) : "",
      imageUrl: product.imageUrl ?? "",
    });
    setAttachments(
      product.imageUrl
        ? [{ id: product.id, url: product.imageUrl, filename: "", contentType: "", size: 0, uploadedAt: "" }]
        : []
    );
    setEditingId(product.id);
    setOpen(true);
  };

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      brand: "",
      model: "",
      name: "",
      displayTitle: "",
      description: "",
      category: "iPhone",
      condition: "",
      barcode: "",
      price: 0,
      stock: 0,
      costPrice: 0,
      minStock: 1,
      storefrontVisibility: "published",
      isFeatured: false,
      isFlashDeal: false,
      flashDealPrice: undefined,
      flashDealEndsAt: "",
      imageUrl: "",
    }
  });

  const handleScanResult = (decodedText: string) => {
    setSearch(decodedText);
    setIsScannerOpen(false);
  };

  const handleSaveClick = async () => {
    const valid = await form.trigger(undefined, { shouldFocus: true });
    if (!valid) {
      const firstError = Object.values(form.formState.errors)[0];
      const message = firstError?.message ? String(firstError.message) : "Please review the product details and try again.";
      console.warn("Product form validation failed", form.formState.errors);
      toast({
        title: "Could not save product",
        description: message,
        variant: "destructive",
      });
      return;
    }
    await form.handleSubmit(onSubmit)();
  };

  const onSubmit = async (values: z.infer<typeof productSchema>) => {
    const imageUrl = attachments[0]?.url ?? null;
    const payload = {
      ...values,
      barcode: values.barcode?.trim() || undefined,
      displayTitle: values.displayTitle?.trim() || undefined,
      description: values.description?.trim() || undefined,
      condition: values.condition?.trim() || undefined,
      flashDealPrice: values.isFlashDeal ? Number(values.flashDealPrice || 0) : undefined,
      flashDealEndsAt: values.isFlashDeal && values.flashDealEndsAt ? new Date(values.flashDealEndsAt).toISOString() : undefined,
      imageUrl
    };
    setSaving(true);
    try {
      if (editingId) {
        await updateProduct(editingId, payload);
        toast({ title: "Product updated", description: `${payload.name} was saved successfully.` });
      } else {
        await addProduct(payload);
        toast({ title: "Product added", description: `${payload.name} is now in inventory.` });
      }
      setOpen(false);
      form.reset();
      setAttachments([]);
      setEditingId(null);
    } catch (err: any) {
      toast({
        title: editingId ? "Could not update product" : "Could not add product",
        description: err?.message || "Please review the product details and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.category.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase()) ||
    p.model?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-shell">
      <div className="page-hero flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="page-kicker">Stock Control</div>
          <h1 className="page-title">Inventory Management</h1>
          <p className="page-subtitle">Manage catalog pricing, stock thresholds, and product media with a cleaner inventory workspace.</p>
        </div>
        
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setAttachments([]); form.reset(); } }}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 sm:w-auto">
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Product" : "Add New Product"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. iPhone 14 Pro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="displayTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Storefront Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Leave blank to use the product name publicly" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">This is the customer-facing title shown on the storefront.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Apple" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. iPhone 14 Pro" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. iPhone, Accessories" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. New, Refurbished, Open Box" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="storefrontVisibility"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Storefront Visibility</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose visibility" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="hidden">Hidden</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <FormControl>
                        <Input placeholder="Scan or enter barcode" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Storefront Description</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder="What should customers know about this product?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (UGX)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock Qty</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="costPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost (UGX)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="minStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Stock Alert</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-secondary/52 p-4">
                  <Label>Photo (optional)</Label>
                  <FileUploader
                    value={attachments}
                    onChange={(files) => {
                      setAttachments(files);
                      form.setValue("imageUrl", files[0]?.url || "");
                    }}
                    multiple={false}
                    accept="image/*"
                    maxFiles={1}
                    uploadFolder="product-images"
                  />
                </div>

                <div className="grid gap-4 rounded-[1.25rem] border border-border/70 bg-secondary/52 p-4">
                  <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/85 p-4">
                    <div>
                      <p className="font-medium text-slate-950">Featured on storefront</p>
                      <p className="text-xs text-muted-foreground">Show this product in the storefront featured section.</p>
                    </div>
                    <FormField
                      control={form.control}
                      name="isFeatured"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4 rounded-2xl bg-white/85 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-950">Flash deal</p>
                        <p className="text-xs text-muted-foreground">Enable a discounted price in the storefront flash deals section.</p>
                      </div>
                      <FormField
                        control={form.control}
                        name="isFlashDeal"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {form.watch("isFlashDeal") ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="flashDealPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Flash Deal Price (UGX)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  value={Number.isNaN(field.value) || field.value === undefined ? "" : field.value}
                                  onChange={(e) => field.onChange(e.target.value)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="flashDealEndsAt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Deal Ends</FormLabel>
                              <FormControl>
                                <Input type="datetime-local" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full"
                  disabled={saving}
                  onClick={() => void handleSaveClick()}
                >
                  {saving ? "Saving..." : "Save Product"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="surface-panel">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input 
                placeholder="Search products..." 
                className="pl-9" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="w-full sm:w-10" onClick={() => setIsScannerOpen(true)}>
              <Scan className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <BarcodeScanner 
          isOpen={isScannerOpen} 
          onClose={() => setIsScannerOpen(false)} 
          onScan={handleScanResult} 
        />
        <CardContent>
          <Table className="min-w-[760px]">
            <TableHeader>
                <TableRow>
                  <TableHead>Photo</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Storefront</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Stock</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.name}
                      fallbackLabel={product.brand || product.category || "Product"}
                      className="h-12 w-12 rounded-xl"
                    />
                  </TableCell>
                  <TableCell className="font-medium whitespace-normal">{product.name}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">{product.barcode || "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200/80">
                      {product.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {product.storefrontVisibility || "published"}
                      </span>
                      {product.isFeatured ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          Featured
                        </span>
                      ) : null}
                      {product.isFlashDeal ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                          Deal
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{product.costPrice?.toLocaleString?.() ?? "-"}</TableCell>
                  <TableCell>{product.stock}</TableCell>
                  <TableCell className="text-right">{product.price.toLocaleString()} UGX</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(product)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setProductToDelete(product);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      Remove
                    </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24">
                    <EmptyState
                      title="No products yet"
                      description="Add your first product to start selling"
                      icon="package"
                      action={{
                        label: "Add Product",
                        onClick: () => setOpen(true),
                      }}
                    />
                  </TableCell>
                </TableRow>
              )}
              {filteredProducts.length === 0 && products.length > 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                    No products match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Product"
        description={productToDelete 
          ? `Are you sure you want to delete "${productToDelete.name}"? This action cannot be undone.`
          : "Are you sure you want to delete this product?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        loading={deleting}
        onConfirm={async () => {
          if (!productToDelete) return;
          setDeleting(true);
          try {
            await deleteProduct(productToDelete.id);
            toast({ 
              title: "Product removed", 
              description: `${productToDelete.name} was removed from inventory.` 
            });
            setDeleteDialogOpen(false);
            setProductToDelete(null);
          } catch (err: any) {
            toast({
              title: "Could not remove product",
              description: err?.message || "Please try again.",
              variant: "destructive",
            });
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
