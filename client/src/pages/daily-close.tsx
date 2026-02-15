import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Upload, CheckCircle2, Plus, Trash2, Wrench, ShoppingCart } from "lucide-react";
import { FileUploader, type UploadedFileMeta } from "@/components/file-uploader";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const repairSchema = z.object({
  deviceBrand: z.string().min(1, "Brand required"),
  deviceModel: z.string().min(1, "Model required"),
  imei: z.string().min(1, "IMEI/Serial required"),
  repairType: z.string().min(1, "Repair type required"),
  price: z.coerce.number().min(0, "Price required"),
  paymentMethod: z.enum(["Cash", "MTN", "Airtel", "Card"]).default("Cash"),
  notes: z.string().optional(),
});

const saleSchema = z.object({
  productId: z.string().optional(), // If selecting from catalog
  productName: z.string().min(1, "Product name required"),
  quantity: z.coerce.number().min(1, "Min quantity 1"),
  totalPrice: z.coerce.number().min(0, "Total price required"),
  paymentMethod: z.enum(["Cash", "MTN", "Airtel", "Card"]).default("Cash"),
});

const cashEntrySchema = z.object({
  type: z.enum(["Cash", "MTN", "Airtel", "Card"]),
  amount: z.coerce.number().min(0, "Amount required"),
  proof: z.string().optional(),
});

const formSchema = z.object({
  cashEntries: z.array(cashEntrySchema),
  repairs: z.array(repairSchema).optional(),
  sales: z.array(saleSchema).optional(),
}).superRefine((data, ctx) => {
  data.cashEntries.forEach((entry, index) => {
    if (entry.amount > 0 && !entry.proof) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${entry.type} proof required`,
        path: ["cashEntries", index, "proof"],
      });
    }
  });
});

export default function DailyClose() {
  const { user } = useAuth();
  const { addClosure, updateClosure, products, closures } = useData();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cashEntries: [],
      repairs: [],
      sales: [],
    },
  });

  const { fields: cashFields, append: appendCash, remove: removeCash } = useFieldArray({
    control: form.control,
    name: "cashEntries",
  });

  const { fields: repairFields, append: appendRepair, remove: removeRepair } = useFieldArray({
    control: form.control,
    name: "repairs",
  });

  const { fields: saleFields, append: appendSale, remove: removeSale } = useFieldArray({
    control: form.control,
    name: "sales",
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setTimeout(() => {
      // Sum up amounts by type in case user adds multiple entries of same type
      const cashCounted = values.cashEntries
        .filter(e => e.type === "Cash")
        .reduce((acc, e) => acc + e.amount, 0);
        
      const mtnAmount = values.cashEntries
        .filter(e => e.type === "MTN")
        .reduce((acc, e) => acc + e.amount, 0);
        
      const airtelAmount = values.cashEntries
        .filter(e => e.type === "Airtel")
        .reduce((acc, e) => acc + e.amount, 0);
        
      const cardAmount = values.cashEntries
        .filter(e => e.type === "Card")
        .reduce((acc, e) => acc + e.amount, 0);
      
      // Take the first available proof for each type
      const proofs = {
        cashDrawer: values.cashEntries.find(e => e.type === "Cash" && e.proof)?.proof || "",
        mtn: values.cashEntries.find(e => e.type === "MTN" && e.proof)?.proof || "",
        airtel: values.cashEntries.find(e => e.type === "Airtel" && e.proof)?.proof || "",
        card: values.cashEntries.find(e => e.type === "Card" && e.proof)?.proof || "",
      };

      const payload = {
        submittedBy: user?.name || "Unknown",
        cashCounted,
        mtnAmount,
        airtelAmount,
        cardAmount,
        expensesTotal: 0,
        proofs,
        repairs: values.repairs?.map((r, i) => ({  
          ...r, 
          id: `temp-r-${i}`, 
          notes: r.notes || "",
          status: "Pending",
          createdAt: new Date().toISOString(),
          repairNumber: "REP-TEMP",
          issueDescription: "Recorded during Daily Close"
        })) || [],
        sales: values.sales?.map((s, i) => ({ 
          ...s, 
          id: `temp-s-${i}`, 
          productId: s.productId || undefined,
          name: s.productName,
          unitPrice: s.quantity > 0 ? s.totalPrice / s.quantity : 0 
        })) || []
      } as any;

      if (editingId) {
        updateClosure(editingId, payload);
        setEditingId(null);
        setSubmitted(true);
        toast({ title: "Closure Updated", description: "Closure saved.", className: "bg-green-600 text-white border-none" });
      } else {
        addClosure(payload);
        setSubmitted(true);
        toast({ title: "Closure Submitted", description: "Your daily report has been successfully recorded.", className: "bg-green-600 text-white border-none" });
      }
    }, 1000);
  }

  // Helper to load an existing closure into the form for editing
  const loadClosureIntoForm = (closure: any) => {
    // Build cashEntries from proofs and amounts
    const cashEntries: any[] = [];
    if (closure.cashCounted !== undefined) cashEntries.push({ type: 'Cash', amount: closure.cashCounted, proof: closure.proofs?.cashDrawer || '' });
    if (closure.mtnAmount !== undefined) cashEntries.push({ type: 'MTN', amount: closure.mtnAmount, proof: closure.proofs?.mtn || '' });
    if (closure.airtelAmount !== undefined) cashEntries.push({ type: 'Airtel', amount: closure.airtelAmount, proof: closure.proofs?.airtel || '' });
    if (closure.cardAmount !== undefined) cashEntries.push({ type: 'Card', amount: closure.cardAmount, proof: closure.proofs?.card || '' });

    form.reset({
      cashEntries,
      repairs: closure.repairs?.map((r: any) => ({ deviceBrand: r.deviceBrand || '', deviceModel: r.deviceModel || '', imei: r.imei || '', repairType: r.repairType || '', price: r.price || 0, paymentMethod: r.paymentMethod || 'Cash', notes: r.notes || '' })) || [],
      sales: closure.sales?.map((s: any) => ({ productId: s.productId || undefined, productName: s.name || '', quantity: s.quantity || 1, totalPrice: s.totalPrice || 0, paymentMethod: s.paymentMethod || 'Cash' })) || [],
    });
  };

  useEffect(() => {
    // If user is owner and there's a last closure, preload it for editing
    if (user?.role === 'Owner' && closures && closures.length > 0) {
      const last = closures[0];
      // Do not auto-enter edit mode; provide button to edit
      // But we keep last closure accessible
    }
  }, [user?.role, closures]);

  // Replace mock upload with real uploader that posts to /api/uploads
  const handleFileChangeForField = (field: any) => (files: UploadedFileMeta[]) => {
    const first = files && files.length > 0 ? files[0] : null;
    field.onChange(first ? first.url : "");
  };

  const handleProductSelect = (index: number, productId: string) => {
    if (productId === "other") {
      form.setValue(`sales.${index}.productId`, undefined);
      form.setValue(`sales.${index}.productName`, "");
      form.setValue(`sales.${index}.totalPrice`, 0);
      return;
    }
    
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue(`sales.${index}.productName`, product.name);
      // Assuming qty 1 initially
      const qty = form.getValues(`sales.${index}.quantity`) || 1;
      form.setValue(`sales.${index}.totalPrice`, product.price * qty);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 pt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">Submission Successful</h2>
          <p className="text-slate-500">Great job, {user?.name}. Your daily close is recorded.</p>
        </div>
        <Button onClick={() => window.location.reload()} variant="outline">Submit Another</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily Close</h1>
        <p className="text-slate-500">Submit end-of-day sales, repairs, and counts.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {user?.role === 'Owner' && closures && closures.length > 0 && (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => {
                const last = closures[0];
                if (!last) return;
                setEditingId(last.id);
                loadClosureIntoForm(last);
                toast({ title: 'Editing Mode', description: 'Loaded last closure for editing.' });
              }}>
                Edit Last Closure
              </Button>
            </div>
          )}
          
          {/* SALES SECTION */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                    Daily Sales
                  </CardTitle>
                  <CardDescription>Log products sold today.</CardDescription>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => appendSale({ productName: "", quantity: 1, totalPrice: 0, paymentMethod: "Cash" })}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Sale
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               {saleFields.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No sales logged for today yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {saleFields.map((field, index) => (
                    <div key={field.id} className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-slate-500">Sale #{index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => removeSale(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`sales.${index}.productId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Select Product (Optional)</FormLabel>
                              <Select 
                                onValueChange={(val) => {
                                  field.onChange(val);
                                  handleProductSelect(index, val);
                                }} 
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Custom / Select..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="other">Custom Input</SelectItem>
                                  {products.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name} - {p.price.toLocaleString()}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                          control={form.control}
                          name={`sales.${index}.productName`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Item Name (Manual)</FormLabel>
                              <FormControl>
                                <Input placeholder="Type item name..." {...field} className="h-9" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <FormField
                          control={form.control}
                          name={`sales.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Qty</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} className="h-9" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                          control={form.control}
                          name={`sales.${index}.totalPrice`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Total Price (UGX)</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} className="h-9 font-mono" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`sales.${index}.paymentMethod`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Payment Method</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select method" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Cash">Cash</SelectItem>
                                  <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                                  <SelectItem value="Airtel">Airtel Money</SelectItem>
                                  <SelectItem value="Card">Card / POS</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
               )}
            </CardContent>
          </Card>

          {/* REPAIRS SECTION */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-primary" />
                    Daily Repairs
                  </CardTitle>
                  <CardDescription>Log any devices repaired today.</CardDescription>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => appendRepair({ deviceBrand: "", deviceModel: "", imei: "", repairType: "", price: 0, paymentMethod: "Cash", notes: "" })}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Repair
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {repairFields.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No repairs logged for today yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {repairFields.map((field, index) => (
                    <div key={field.id} className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-slate-500">Repair #{index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => removeRepair(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`repairs.${index}.deviceBrand`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Brand</FormLabel>
                              <FormControl>
                                <Input placeholder="Samsung" {...field} className="h-9" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                          control={form.control}
                          name={`repairs.${index}.deviceModel`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Model</FormLabel>
                              <FormControl>
                                <Input placeholder="Galaxy S21" {...field} className="h-9" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <FormField
                          control={form.control}
                          name={`repairs.${index}.imei`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">IMEI/Serial</FormLabel>
                              <FormControl>
                                <Input placeholder="356..." {...field} className="h-9" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                          control={form.control}
                          name={`repairs.${index}.repairType`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Type</FormLabel>
                              <FormControl>
                                <Input placeholder="Screen Replacement" {...field} className="h-9" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                         <FormField
                          control={form.control}
                          name={`repairs.${index}.price`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Price (UGX)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="0" {...field} className="h-9 font-mono" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                          control={form.control}
                          name={`repairs.${index}.paymentMethod`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Payment Method</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select method" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Cash">Cash</SelectItem>
                                  <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                                  <SelectItem value="Airtel">Airtel Money</SelectItem>
                                  <SelectItem value="Card">Card / POS</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* FINANCIALS SECTION */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-primary" />
                    Cash & Payments
                  </CardTitle>
                  <CardDescription>Record amounts counted and upload proofs.</CardDescription>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => appendCash({ type: "Cash", amount: 0, proof: "" })}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Entry
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">

              {cashFields.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No payment entries added yet. Click "Add Entry" to start.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {cashFields.map((field, index) => (
                    <div key={field.id} className="p-6 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-slate-500">Entry #{index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => removeCash(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`cashEntries.${index}.type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Cash">Cash Drawer</SelectItem>
                                  <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                                  <SelectItem value="Airtel">Airtel Money</SelectItem>
                                  <SelectItem value="Card">Card / POS</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`cashEntries.${index}.amount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount Counted</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="0.00" {...field} className="font-mono text-lg" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`cashEntries.${index}.proof`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="sr-only">Proof Upload</FormLabel>
                              <FormControl>
                                <FileUploader
                                  value={field.value ? [{ id: `proof-${index}`, url: field.value, filename: 'proof.jpg', contentType: 'image/jpeg', size: 0, uploadedAt: new Date().toISOString() }] : []}
                                  onChange={handleFileChangeForField(field)}
                                  multiple={false}
                                  accept="image/*"
                                  maxFiles={1}
                                />
                              </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

              <div className="pt-4">
                <Button type="submit" className="w-full h-12 text-lg" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Submitting..." : (editingId ? "Update Closure" : "Submit Daily Close")}
                </Button>
              </div>
        </form>
      </Form>
    </div>
  );
}
