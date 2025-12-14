import { useForm } from "react-hook-form";
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
import { Camera, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  cashExpected: z.coerce.number().min(0, "Cash expected is required"),
  cashCounted: z.coerce.number().min(0, "Cash counted is required"),
  mtnAmount: z.coerce.number().min(0, "MTN amount is required"),
  airtelAmount: z.coerce.number().min(0, "Airtel amount is required"),
  // In a real app, these would be file objects. For mockup, we'll confirm they are "uploaded"
  proofCashDrawer: z.string().min(1, "Cash drawer photo is required"),
  proofMtn: z.string().min(1, "MTN screenshot is required"),
  proofAirtel: z.string().min(1, "Airtel screenshot is required"),
});

export default function DailyClose() {
  const { user } = useAuth();
  const { addClosure } = useData();
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
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Simulate API delay
    setTimeout(() => {
      addClosure({
        submittedBy: user?.name || "Unknown",
        cashExpected: values.cashExpected,
        cashCounted: values.cashCounted,
        mtnAmount: values.mtnAmount,
        airtelAmount: values.airtelAmount,
        proofs: {
          cashDrawer: values.proofCashDrawer,
          mtn: values.proofMtn,
          airtel: values.proofAirtel,
        }
      });
      setSubmitted(true);
      toast({
        title: "Closure Submitted",
        description: "Your daily report has been successfully recorded.",
        className: "bg-green-600 text-white border-none",
      });
    }, 1000);
  }

  // Helper for mock file upload
  const handleMockUpload = (field: any) => {
    // Simulate picking a file
    const mockUrl = "https://placehold.co/600x400?text=Uploaded+Proof";
    field.onChange(mockUrl);
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
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily Close</h1>
        <p className="text-slate-500">Submit end-of-day counts and proofs.</p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Cash & Mobile Money</CardTitle>
          <CardDescription>Enter the final amounts from your drawer and phones.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
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

              <Separator />

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

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium text-slate-900 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Required Proofs
                </h3>
                
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
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
