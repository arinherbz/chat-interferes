import { useState } from "react";
import { useData, RepairStatus } from "@/lib/data-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, Wrench, CheckCircle2, Clock, Truck } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function RepairsPage() {
  const { repairs, updateRepairStatus } = useData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const filteredRepairs = repairs.filter(r => {
    const matchesSearch = 
      r.deviceBrand.toLowerCase().includes(search.toLowerCase()) || 
      r.deviceModel.toLowerCase().includes(search.toLowerCase()) ||
      r.imei.includes(search);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = (id: string, newStatus: RepairStatus) => {
    updateRepairStatus(id, newStatus);
    toast({
      title: "Status Updated",
      description: `Repair marked as ${newStatus}`,
    });
  };

  const getStatusColor = (status: RepairStatus) => {
    switch (status) {
      case "Pending": return "bg-yellow-100 text-yellow-800";
      case "In Progress": return "bg-blue-100 text-blue-800";
      case "Completed": return "bg-green-100 text-green-800";
      case "Delivered": return "bg-slate-100 text-slate-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Repair Tracking</h1>
          <p className="text-slate-500">Manage device repairs from intake to delivery.</p>
        </div>
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
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="font-medium">Completed</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {repairs.filter(r => r.status === "Completed").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-600" />
              <span className="font-medium">Delivered</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {repairs.filter(r => r.status === "Delivered").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input 
                placeholder="Search by device, model, or IMEI..." 
                className="pl-9 max-w-sm" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
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
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRepairs.map((repair) => (
                <TableRow key={repair.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{repair.deviceBrand} {repair.deviceModel}</span>
                      <span className="text-xs text-slate-500 font-mono">{repair.imei}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                     <div className="flex flex-col">
                      <span>{repair.repairType}</span>
                      <span className="text-xs text-slate-500">{repair.notes}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getStatusColor(repair.status)}>
                      {repair.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{repair.price.toLocaleString()}</TableCell>
                  <TableCell>{format(new Date(repair.createdAt), 'MMM dd')}</TableCell>
                  <TableCell>
                    <Select 
                      defaultValue={repair.status} 
                      onValueChange={(val) => handleStatusChange(repair.id, val as RepairStatus)}
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRepairs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No repairs found matching criteria.
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
