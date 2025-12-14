import { useState } from "react";
import { useData, TradeIn } from "@/lib/data-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Smartphone, DollarSign, User, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const tradeInSchema = z.object({
  brand: z.string().min(1, "Brand required"),
  model: z.string().min(1, "Model required"),
  imei: z.string().min(10, "Valid IMEI required"),
  condition: z.string().min(1, "Condition required"),
  offerPrice: z.coerce.number().min(0, "Price required"),
  payoutMethod: z.enum(["Cash", "MTN", "Airtel", "Credit"]).default("Cash"),
  customerName: z.string().min(1, "Customer name required"),
  customerPhone: z.string().min(1, "Customer phone required"),
});

export default function TradeInPage() {
  const { tradeIns, recordTradeIn, addCustomer } = useData();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  
  const form = useForm<z.infer<typeof tradeInSchema>>({
    resolver: zodResolver(tradeInSchema),
    defaultValues: {
      brand: "",
      model: "",
      imei: "",
      condition: "Good",
      offerPrice: 0,
      payoutMethod: "Cash",
      customerName: "",
      customerPhone: "",
    }
  });

  const onSubmit = (values: z.infer<typeof tradeInSchema>) => {
    // 1. Create or Find Customer (simplified)
    const customerId = `c-trade-${Date.now()}`;
    addCustomer({
      name: values.customerName,
      phone: values.customerPhone,
      email: "",
    });

    // 2. Record Trade-in
    const deviceId = `d-trade-${Date.now()}`; // Pre-generate or let backend handle in real app
    recordTradeIn({
      deviceId, // Add this
      brand: values.brand,
      model: values.model,
      imei: values.imei,
      condition: values.condition,
      offerPrice: values.offerPrice,
      customerId: customerId,
    });

    toast({
      title: "Trade-in Successful",
      description: "Device added to inventory and payout recorded.",
      className: "bg-green-600 text-white border-none",
    });

    form.reset();
    setStep(1);
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Trade-In Center</h1>
          <p className="text-slate-500">Process device buybacks and exchanges.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: Trade-in Form */}
        <Card className="lg:col-span-2 border-slate-200 shadow-md">
          <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                 {step}
               </div>
               {step === 1 && "Device Information"}
               {step === 2 && "Condition Assessment"}
               {step === 3 && "Final Offer & Customer"}
             </CardTitle>
             <CardDescription>
               {step === 1 && "Identify the device being traded in."}
               {step === 2 && "Check the physical state of the device."}
               {step === 3 && "Confirm price and customer details."}
             </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* STEP 1: DEVICE INFO */}
                {step === 1 && (
                  <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="brand"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Brand</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select brand" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Apple">Apple</SelectItem>
                                <SelectItem value="Samsung">Samsung</SelectItem>
                                <SelectItem value="Tecno">Tecno</SelectItem>
                                <SelectItem value="Infinix">Infinix</SelectItem>
                              </SelectContent>
                            </Select>
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
                              <Input placeholder="e.g. iPhone 12" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="imei"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IMEI Number</FormLabel>
                          <FormControl>
                            <Input placeholder="356..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="pt-4 flex justify-end">
                      <Button type="button" onClick={nextStep}>Next Step</Button>
                    </div>
                  </div>
                )}

                {/* STEP 2: CONDITION */}
                {step === 2 && (
                  <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <FormField
                      control={form.control}
                      name="condition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Overall Condition</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Like New">Like New (Mint)</SelectItem>
                              <SelectItem value="Good">Good (Minor scratches)</SelectItem>
                              <SelectItem value="Fair">Fair (Visible wear)</SelectItem>
                              <SelectItem value="Damaged">Damaged (Cracked screen/back)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                      <h4 className="font-medium text-sm">Quick Checklist</h4>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-slate-300" id="chk1" />
                        <label htmlFor="chk1" className="text-sm">Device powers on</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-slate-300" id="chk2" />
                        <label htmlFor="chk2" className="text-sm">Screen is responsive</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-slate-300" id="chk3" />
                        <label htmlFor="chk3" className="text-sm">Cameras working</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-slate-300" id="chk4" />
                        <label htmlFor="chk4" className="text-sm">iCloud/Google Account removed</label>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-between">
                      <Button type="button" variant="outline" onClick={prevStep}>Back</Button>
                      <Button type="button" onClick={nextStep}>Next Step</Button>
                    </div>
                  </div>
                )}

                {/* STEP 3: PRICE & CUSTOMER */}
                {step === 3 && (
                  <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="p-6 bg-green-50 border border-green-100 rounded-lg text-center mb-6">
                      <h3 className="text-sm text-green-800 uppercase tracking-wide font-semibold mb-2">Offer Price</h3>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-4xl font-bold text-green-700">UGX</span>
                        <FormField
                          control={form.control}
                          name="offerPrice"
                          render={({ field }) => (
                            <FormItem className="mb-0">
                              <FormControl>
                                <Input 
                                  type="number" 
                                  className="text-3xl font-bold h-12 w-48 text-center bg-white border-green-200 focus:border-green-500 focus:ring-green-200" 
                                  {...field} 
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="payoutMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payout Method</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Cash">Cash</SelectItem>
                                <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                                <SelectItem value="Airtel">Airtel Money</SelectItem>
                                <SelectItem value="Credit">Store Credit</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Customer Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <FormField
                        control={form.control}
                        name="customerPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="077..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="pt-4 flex justify-between">
                      <Button type="button" variant="outline" onClick={prevStep}>Back</Button>
                      <Button type="submit" className="bg-green-600 hover:bg-green-700 w-40">Complete Trade-In</Button>
                    </div>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* RIGHT: Recent Activity */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Recent Trade-Ins</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tradeIns.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No recent activity.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {tradeIns.slice(0, 5).map(trade => (
                    <div key={trade.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                          <RefreshCw className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{trade.brand} {trade.model}</p>
                          <p className="text-xs text-slate-500">{format(new Date(trade.createdAt), 'MMM dd')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-red-600">-{trade.offerPrice.toLocaleString()}</span>
                        <Badge variant="outline" className="ml-2 text-[10px] h-5">{trade.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white border-none">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Policy Reminder
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300 space-y-2">
              <p>• Always check ID for trade-ins over 500k.</p>
              <p>• Verify IMEI is not blacklisted.</p>
              <p>• Ensure iCloud/Google account is signed out.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
