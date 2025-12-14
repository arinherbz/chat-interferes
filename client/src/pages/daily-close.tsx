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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const repairSchema = z.object({
  deviceBrand: z.string().min(1, "Brand required"),
  deviceModel: z.string().min(1, "Model required"),
  imei: z.string().min(1, "IMEI/Serial required"),
  repairType: z.string().min(1, "Repair type required"),
  price: z.coerce.number().min(0, "Price required"),
  notes: z.string().optional(),
});

const saleSchema = z.object({
  productId: z.string().optional(), // If selecting from catalog
  productName: z.string().min(1, "Product name required"),
  quantity: z.coerce.number().min(1, "Min quantity 1"),
  totalPrice: z.coerce.number().min(0, "Total price required"),
});

const formSchema = z.object({
  cashExpected: z.coerce.number().min(0, "Cash expected is required"),
  cashCounted: z.coerce.number().min(0, "Cash counted is required"),
  mtnAmount: z.coerce.number().min(0, "MTN amount is required"),
  airtelAmount: z.coerce.number().min(0, "Airtel amount is required"),
  proofCashDrawer: z.string().optional(),
  proofMtn: z.string().optional(),
  proofAirtel: z.string().optional(),
  repairs: z.array(repairSchema).optional(),
  sales: z.array(saleSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.cashCounted > 0 && !data.proofCashDrawer) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cash drawer proof required when cash is counted",
      path: ["proofCashDrawer"],
    });
  }
  if (data.mtnAmount > 0 && !data.proofMtn) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "MTN proof required when amount > 0",
      path: ["proofMtn"],
    });
  }
  if (data.airtelAmount > 0 && !data.proofAirtel) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Airtel proof required when amount > 0",
      path: ["proofAirtel"],
    });
  }
});

export default function DailyClose() {
  const { user } = useAuth();
  const { addClosure, products } = useData();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cashExpected: 0,
      cashCounted: 0,
      mtnAmount: 0,
      airtelAmount: 0,
      proofCashDrawer: "",
      proofMtn: "",
      proofAirtel: "",
      repairs: [],
      sales: [],
    },
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
      addClosure({
        submittedBy: user?.name || "Unknown",
        cashExpected: values.cashExpected,
        cashCounted: values.cashCounted,
        mtnAmount: values.mtnAmount,
        airtelAmount: values.airtelAmount,
        proofs: {
          cashDrawer: values.proofCashDrawer || "",
          mtn: values.proofMtn || "",
          airtel: values.proofAirtel || "",
        },
        repairs: values.repairs?.map((r, i) => ({ 
          ...r, 
          id: `temp-r-${i}`, 
          notes: r.notes || "",
          status: "Pending",
          createdAt: new Date().toISOString()
        })) || [],
        sales: values.sales?.map((s, i) => ({ ...s, id: `temp-s-${i}`, productId: s.productId || null })) || []
      });
      setSubmitted(true);
      toast({
        title: "Closure Submitted",
        description: "Your daily report has been successfully recorded.",
        className: "bg-green-600 text-white border-none",
      });
    }, 1000);
  }

  const handleMockUpload = (field: any) => {
    const mockUrl = "https://placehold.co/600x400?text=Uploaded+Proof";
    field.onChange(mockUrl);
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
                  onClick={() => appendSale({ productName: "", quantity: 1, totalPrice: 0 })}
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
                  onClick={() => appendRepair({ deviceBrand: "", deviceModel: "", imei: "", repairType: "", price: 0, notes: "" })}
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* FINANCIALS SECTION */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Cash & Mobile Money</CardTitle>
              <CardDescription>Enter the final amounts from your drawer and phones.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="cashExpected"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cash Expected (System)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} className="font-mono text-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cashCounted"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cash Counted (Physical)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} className="font-mono text-lg" />
                      </FormControl>
                      <FormDescription>Actual cash in drawer</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator className="my-6" />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="mtnAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MTN Mobile Money</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} className="font-mono text-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="airtelAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Airtel Money</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} className="font-mono text-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator className="my-6" />

              <div className="space-y-4">
                <h3 className="font-medium text-slate-900 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Proof of Balances
                </h3>
                <p className="text-sm text-slate-500">Only upload proofs for methods you have cash in.</p>
                
                <div className="grid gap-4 md:grid-cols-3">
                  {/* Cash Drawer Upload */}
                  <FormField
                    control={form.control}
                    name="proofCashDrawer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">Cash Drawer</FormLabel>
                        <FormControl>
                          <div 
                            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${field.value ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-primary hover:bg-slate-50'}`}
                            onClick={() => handleMockUpload(field)}
                          >
                            {field.value ? (
                              <div className="flex flex-col items-center text-green-700">
                                <CheckCircle2 className="w-8 h-8 mb-2" />
                                <span className="text-xs font-medium">Cash Drawer Uploaded</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center text-slate-500">
                                <Upload className="w-8 h-8 mb-2" />
                                <span className="text-sm font-medium">Upload Cash Drawer</span>
                                <span className="text-xs text-slate-400 mt-1">Tap to capture</span>
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* MTN Upload */}
                  <FormField
                    control={form.control}
                    name="proofMtn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">MTN Proof</FormLabel>
                        <FormControl>
                          <div 
                            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${field.value ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-primary hover:bg-slate-50'}`}
                            onClick={() => handleMockUpload(field)}
                          >
                            {field.value ? (
                              <div className="flex flex-col items-center text-green-700">
                                <CheckCircle2 className="w-8 h-8 mb-2" />
                                <span className="text-xs font-medium">MTN Proof Uploaded</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center text-slate-500">
                                <Upload className="w-8 h-8 mb-2" />
                                <span className="text-sm font-medium">Upload MTN Balance</span>
                                <span className="text-xs text-slate-400 mt-1">Tap to capture</span>
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Airtel Upload */}
                  <FormField
                    control={form.control}
                    name="proofAirtel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">Airtel Proof</FormLabel>
                        <FormControl>
                          <div 
                            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${field.value ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-primary hover:bg-slate-50'}`}
                            onClick={() => handleMockUpload(field)}
                          >
                            {field.value ? (
                              <div className="flex flex-col items-center text-green-700">
                                <CheckCircle2 className="w-8 h-8 mb-2" />
                                <span className="text-xs font-medium">Airtel Proof Uploaded</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center text-slate-500">
                                <Upload className="w-8 h-8 mb-2" />
                                <span className="text-sm font-medium">Upload Airtel Balance</span>
                                <span className="text-xs text-slate-400 mt-1">Tap to capture</span>
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" className="w-full h-12 text-lg" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Submitting..." : "Submit Daily Close"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
