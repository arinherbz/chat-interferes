import { useState } from "react";
import { useData } from "@/lib/data-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge"; // Ensure Badge is imported
import { Wallet, Search, Plus, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const expenseSchema = z.object({
  category: z.string().min(1, "Category required"),
  description: z.string().min(1, "Description required"),
  amount: z.coerce.number().min(1, "Amount required"),
  paymentMethod: z.enum(["Cash", "MTN", "Airtel", "Card"]).default("Cash"),
  date: z.string().min(1, "Date required"),
});

export default function ExpensesPage() {
  const { expenses, recordExpense, currentUser } = useData();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: "Supplies",
      description: "",
      amount: 0,
      paymentMethod: "Cash",
      date: format(new Date(), 'yyyy-MM-dd'),
    }
  });

  const onSubmit = async (values: z.infer<typeof expenseSchema>) => {
    setIsSaving(true);
    try {
      await recordExpense({
        ...values,
        recordedBy: currentUser?.name || "Owner",
      });
      toast({
        title: "Expense recorded",
        description: "The expense has been saved successfully.",
      });
      setOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: "Could not save expense",
        description: error instanceof Error ? error.message : "Please review the expense details and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="page-shell">
      <div className="page-hero flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="page-kicker">Operations Finance</div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track shop spending with a cleaner ledger view and reliable server-backed records.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Record Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record New Expense</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Rent">Rent</SelectItem>
                          <SelectItem value="Utilities">Utilities (Power/Water)</SelectItem>
                          <SelectItem value="Salaries">Salaries</SelectItem>
                          <SelectItem value="Supplies">Supplies</SelectItem>
                          <SelectItem value="Maintenance">Maintenance</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Shop Cleaning" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (UGX)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Source</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                            <SelectItem value="Airtel">Airtel Money</SelectItem>
                            <SelectItem value="Card">Card</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? "Saving expense..." : "Save Expense"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="stat-card">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium">Total Expenses (All Time)</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-semibold text-foreground">
               {totalExpenses.toLocaleString()} UGX
             </div>
             <p className="mt-1 text-sm text-muted-foreground">All recorded operating costs for the active branch.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle>Expense History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{format(new Date(expense.date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{expense.category}</Badge>
                  </TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell className="text-xs text-slate-500">{(expense as any).paymentMethod || "Cash"}</TableCell>
                  <TableCell className="text-sm text-slate-500">{expense.recordedBy}</TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    -{expense.amount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No expenses recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
