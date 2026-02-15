import { useMemo, useState } from "react";
import { useData, RepairStatus, Repair } from "@/lib/data-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, Wrench, CheckCircle2, Clock, Truck, User, Calendar, DollarSign, PenTool, History } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth-context";

const repairSchema = z.object({
  deviceBrand: z.string().min(1, "Brand required"),
  deviceModel: z.string().min(1, "Model required"),
  imei: z.string().min(3, "IMEI/Serial required"),
  issueDescription: z.string().min(3, "Issue required"),
  repairType: z.string().min(1, "Type required"),
  price: z.coerce.number().min(0, "Price required"),
  cost: z.coerce.number().min(0, "Cost required"),
  technician: z.string().min(1, "Assign a technician"),
  customerName: z.string().optional(),
});

export default function RepairsPage() {
  const { repairs, updateRepairStatus, users, addRepair } = useData();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [techFilter, setTechFilter] = useState<string>("all");
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const filteredRepairs = useMemo(() => repairs.filter(r => {
    const matchesSearch = 
      r.deviceBrand.toLowerCase().includes(search.toLowerCase()) || 
      r.deviceModel.toLowerCase().includes(search.toLowerCase()) ||
      r.imei.includes(search);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    const matchesTech = techFilter === "all" || r.technician === techFilter;
    return matchesSearch && matchesStatus && matchesTech;
  }), [repairs, search, statusFilter, techFilter]);

  const form = useForm<z.infer<typeof repairSchema>>({
    resolver: zodResolver(repairSchema),
    defaultValues: {
      deviceBrand: "",
      deviceModel: "",
      imei: "",
      issueDescription: "",
      repairType: "",
      price: 0,
      cost: 0,
      technician: user?.name || "",
      customerName: "",
    }
  });

  const handleStatusChange = (id: string, newStatus: RepairStatus) => {
    updateRepairStatus(id, newStatus);
    toast({
      title: "Status Updated",
      description: `Repair marked as ${newStatus}`,
    });
    if (selectedRepair && selectedRepair.id === id) {
      setSelectedRepair({ ...selectedRepair, status: newStatus });
    }
  };

  const getStatusColor = (status: RepairStatus) => {
    switch (status) {
      case "Pending": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "In Progress": return "bg-blue-100 text-blue-800 border-blue-200";
      case "Completed": return "bg-green-100 text-green-800 border-green-200";
      case "Delivered": return "bg-slate-100 text-slate-800 border-slate-200";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Repair Tracking</h1>
          <p className="text-slate-500">Manage device repairs, assign technicians, and track profitability.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Wrench className="w-4 h-4" />
            New Repair Ticket
          </Button>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Repair Ticket</DialogTitle>
              <DialogDescription>Capture device details, assign technician, and track cost vs. price.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit((values) => {
                addRepair({
                  ...values,
                  price: Number(values.price),
                  cost: Number(values.cost),
                  technician: values.technician,
                  customerName: values.customerName || "Walk-in",
                  status: "Pending",
                  createdAt: new Date().toISOString(),
                  notes: values.issueDescription,
                } as any);
                toast({ title: "Repair created", description: "Ticket logged and assigned." });
                form.reset();
                setOpen(false);
              })}
              className="space-y-3 mt-2"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Device Brand</Label>
                  <Input {...form.register("deviceBrand")} placeholder="Apple" />
                </div>
                <div className="space-y-1">
                  <Label>Device Model</Label>
                  <Input {...form.register("deviceModel")} placeholder="iPhone 12" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>IMEI / Serial</Label>
                <Input {...form.register("imei")} placeholder="IMEI or serial" />
              </div>
              <div className="space-y-1">
                <Label>Issue</Label>
                <Textarea rows={2} {...form.register("issueDescription")} placeholder="Describe the problem" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Repair Type</Label>
                  <Input {...form.register("repairType")} placeholder="Screen, battery, board..." />
                </div>
                <div className="space-y-1">
                  <Label>Customer Name</Label>
                  <Input {...form.register("customerName")} placeholder="Optional" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Price (UGX)</Label>
                  <Input type="number" {...form.register("price", { valueAsNumber: true })} />
                </div>
                <div className="space-y-1">
                  <Label>Cost (UGX)</Label>
                  <Input type="number" {...form.register("cost", { valueAsNumber: true })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Assign Technician</Label>
                <Select onValueChange={(v) => form.setValue("technician", v)} defaultValue={form.getValues("technician")}>
                  <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-2">
                <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">Save Ticket</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-600" />
              <span className="font-medium">Pending</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {repairs.filter(r => r.status === "Pending").length}
            </div>
            <p className="text-xs text-slate-500 mt-1">Awaiting technician</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600" />
              <span className="font-medium">In Progress</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {repairs.filter(r => r.status === "In Progress").length}
            </div>
            <p className="text-xs text-slate-500 mt-1">Currently being fixed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="font-medium">Ready</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {repairs.filter(r => r.status === "Completed").length}
            </div>
            <p className="text-xs text-slate-500 mt-1">Waiting for customer</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-purple-600" />
              <span className="font-medium">Revenue (This Month)</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {repairs.reduce((acc, r) => acc + r.price, 0).toLocaleString()} <span className="text-sm font-normal text-slate-400">UGX</span>
            </div>
             <p className="text-xs text-slate-500 mt-1">Est. Profit: {(repairs.reduce((acc, r) => acc + r.price, 0) * 0.4).toLocaleString()} UGX</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input 
                placeholder="Search by Ticket #, Model, or IMEI..." 
                className="pl-9 max-w-sm" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2 text-slate-500" />
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
              <Select value={techFilter} onValueChange={setTechFilter}>
                <SelectTrigger className="w-[200px]">
                  <User className="w-4 h-4 mr-2 text-slate-500" />
                  <SelectValue placeholder="Filter by Technician" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket Info</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Device & Issue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRepairs.map((repair) => (
                <TableRow key={repair.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedRepair(repair)}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono font-medium text-slate-900">{repair.repairNumber}</span>
                      <span className="text-xs text-slate-500">{format(new Date(repair.createdAt), 'MMM dd')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{repair.customerName || "Walk-in"}</span>
                      <span className="text-xs text-slate-500">077...</span>
                    </div>
                  </TableCell>
                  <TableCell>
                     <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{repair.deviceBrand} {repair.deviceModel}</span>
                      <span className="text-xs text-slate-500">{repair.repairType}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(repair.status)}>
                      {repair.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                        {repair.technician ? repair.technician.charAt(0) : "?"}
                      </div>
                      <span className="text-sm">{repair.technician || "Unassigned"}</span>
                    </div>
                  </TableCell>
                <TableCell className="text-right font-medium">
                    {repair.price.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-slate-600">
                    {(repair as any).cost ? (repair as any).cost.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-right text-green-700">
                    {(repair.price - ((repair as any).cost || 0)).toLocaleString()} UGX
                  </TableCell>
                  <TableCell>
                     <Button variant="ghost" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRepairs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No repairs found matching criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Repair Detail Dialog */}
      <Dialog open={!!selectedRepair} onOpenChange={(open) => !open && setSelectedRepair(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  {selectedRepair?.repairNumber} 
                  <Badge variant="outline" className={selectedRepair ? getStatusColor(selectedRepair.status) : ""}>
                    {selectedRepair?.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Created on {selectedRepair && format(new Date(selectedRepair.createdAt), 'PPP p')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Job Details</TabsTrigger>
              <TabsTrigger value="financials">Parts & Labor</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Customer</Label>
                    <div className="font-medium">{selectedRepair?.customerName || "Walk-in Customer"}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Device</Label>
                    <div className="font-medium">{selectedRepair?.deviceBrand} {selectedRepair?.deviceModel}</div>
                    <div className="text-sm text-slate-500 font-mono">{selectedRepair?.imei}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Issue Reported</Label>
                    <div className="p-3 bg-slate-50 rounded text-sm">{selectedRepair?.issueDescription}</div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Technician</Label>
                    <Select defaultValue={selectedRepair?.technician || "unassigned"}>
                      <SelectTrigger>
                        <SelectValue placeholder="Assign Technician" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {users.filter(u => u.role !== 'Owner').map(u => (
                          <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Status</Label>
                    <Select 
                      defaultValue={selectedRepair?.status} 
                      onValueChange={(val) => selectedRepair && handleStatusChange(selectedRepair.id, val as RepairStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Technician Notes</Label>
                    <Input placeholder="Add internal notes..." defaultValue={selectedRepair?.notes} />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="financials" className="space-y-4 pt-4">
               <div className="grid grid-cols-3 gap-4">
                 <div className="space-y-2">
                   <Label>Estimated Cost</Label>
                   <Input type="number" defaultValue={selectedRepair?.price} />
                 </div>
                 <div className="space-y-2">
                   <Label>Parts Cost</Label>
                   <Input type="number" placeholder="0" />
                 </div>
                 <div className="space-y-2">
                   <Label>Labor Cost</Label>
                   <Input type="number" placeholder="0" />
                 </div>
               </div>
               <div className="p-4 bg-green-50 rounded-lg border border-green-100 mt-4">
                 <div className="flex justify-between items-center">
                   <span className="font-medium text-green-900">Estimated Profit</span>
                   <span className="font-bold text-xl text-green-700">
                     {selectedRepair ? (selectedRepair.price * 0.4).toLocaleString() : 0} UGX
                   </span>
                 </div>
               </div>
            </TabsContent>

            <TabsContent value="history" className="pt-4">
              <div className="relative border-l border-slate-200 ml-3 space-y-6 pb-2">
                <div className="mb-8 ml-6 relative">
                  <span className="absolute -left-[31px] bg-green-100 border-4 border-white rounded-full w-4 h-4 flex items-center justify-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </span>
                  <h3 className="font-medium leading-tight">Ticket Created</h3>
                  <p className="text-sm text-slate-500">Ticket {selectedRepair?.repairNumber} opened by {selectedRepair?.technician || "Staff"}</p>
                  <p className="text-xs text-slate-400 mt-1">{selectedRepair && format(new Date(selectedRepair.createdAt), 'MMM dd, yyyy HH:mm')}</p>
                </div>
                {/* Mock History Item */}
                <div className="mb-8 ml-6 relative">
                  <span className="absolute -left-[31px] bg-slate-100 border-4 border-white rounded-full w-4 h-4"></span>
                  <h3 className="font-medium leading-tight text-slate-500">Status Updated to {selectedRepair?.status}</h3>
                  <p className="text-sm text-slate-500">Updated recently</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
             <Button variant="outline" onClick={() => setSelectedRepair(null)}>Close</Button>
             <Button onClick={() => {
               toast({ title: "Changes Saved", description: "Repair ticket updated successfully." });
               setSelectedRepair(null);
             }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
