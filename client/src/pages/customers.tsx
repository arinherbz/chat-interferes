import { useState } from "react";
import { useData } from "@/lib/data-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Users, Search, Plus, Mail, MessageSquare, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const customerSchema = z.object({
  name: z.string().min(1, "Name required"),
  phone: z.string().min(1, "Phone required"),
  email: z.string().email("Invalid email"),
});

export default function CustomersPage() {
  const { customers, addCustomer } = useData();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{name: string, phone: string} | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
    }
  });

  const onSubmit = (values: z.infer<typeof customerSchema>) => {
    addCustomer(values);
    setOpen(false);
    form.reset();
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    setMsgOpen(false);
    toast({
      title: "Message Sent",
      description: `SMS sent to ${selectedCustomer?.name} (${selectedCustomer?.phone})`,
      className: "bg-green-600 text-white border-none",
    });
  };

  const openMessageDialog = (customer: {name: string, phone: string}) => {
    setSelectedCustomer(customer);
    setMsgOpen(true);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Customer Management</h1>
          <p className="text-slate-500">Track customers and their device history.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+256..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full">Save Customer</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Message</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSendMessage} className="space-y-4 pt-2">
              <div className="p-3 bg-slate-50 rounded-md text-sm">
                <span className="font-medium">To:</span> {selectedCustomer?.name} ({selectedCustomer?.phone})
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message Type</label>
                <select className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm">
                  <option>SMS</option>
                  <option>Email</option>
                  <option>WhatsApp</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Content</label>
                <Textarea placeholder="Type your message here..." className="min-h-[100px]" />
              </div>
              <Button type="submit" className="w-full gap-2">
                <Send className="w-4 h-4" />
                Send Message
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Search customers..." 
              className="pl-9 max-w-sm" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{customer.name}</span>
                      <span className="text-xs text-slate-500">{customer.totalPurchases} purchases</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span>{customer.phone}</span>
                      <span className="text-slate-500">{customer.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(customer.joinedAt), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-blue-600"
                        onClick={() => openMessageDialog(customer)}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600">
                        <Mail className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCustomers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No customers found.
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
