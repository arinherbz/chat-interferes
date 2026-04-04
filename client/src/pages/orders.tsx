import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { unwrapApiData } from "@/lib/api-response";
import { Loader2, Eye, Package, Truck, CheckCircle, XCircle, Clock, ClipboardList } from "lucide-react";
import type { Order } from "@shared/schema";

const ORDER_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  { value: "CONFIRMED", label: "Confirmed", color: "bg-blue-100 text-blue-800", icon: CheckCircle },
  { value: "PROCESSING", label: "Processing", color: "bg-purple-100 text-purple-800", icon: Package },
  { value: "READY FOR DELIVERY", label: "Ready for Delivery", color: "bg-orange-100 text-orange-800", icon: Truck },
  { value: "DELIVERED", label: "Delivered", color: "bg-green-100 text-green-800", icon: CheckCircle },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-800", icon: XCircle },
] as const;

function getOrderStatusMeta(status: string) {
  return ORDER_STATUS_OPTIONS.find((option) => option.value === status) ?? {
    value: status,
    label: status,
    color: "bg-slate-100 text-slate-800",
    icon: Clock,
  };
}

function formatOrderDate(value: unknown) {
  if (!value) return "N/A";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleDateString();
}

function formatOrderDateTime(value: unknown) {
  if (!value) return "N/A";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleString();
}

export default function OrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await apiRequest("GET", `/api/orders?${params}`);
      return unwrapApiData(await response.json());
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status });
      return unwrapApiData(await response.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  const filteredOrders = orders.filter((order: Order) =>
    statusFilter === "all" || order.status === statusFilter
  );

  const StatusIcon = selectedOrder ? getOrderStatusMeta(selectedOrder.status).icon : Clock;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">Manage customer orders and track their status</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Orders</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {ORDER_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order: Order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">{order.id.slice(-8)}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>{order.customerPhone}</TableCell>
                    <TableCell>{order.total?.toLocaleString()} UGX</TableCell>
                    <TableCell>
                      <Badge className={getOrderStatusMeta(order.status).color}>
                        {getOrderStatusMeta(order.status).label}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatOrderDate(order.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedOrder(order)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <StatusIcon className="h-5 w-5" />
                                Order Details - {order.id.slice(-8)}
                              </DialogTitle>
                            </DialogHeader>
                            {selectedOrder && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Customer</Label>
                                    <p className="text-sm">{selectedOrder.customerName}</p>
                                    <p className="text-sm text-muted-foreground">{selectedOrder.customerPhone}</p>
                                    {selectedOrder.customerEmail && (
                                      <p className="text-sm text-muted-foreground">{selectedOrder.customerEmail}</p>
                                    )}
                                  </div>
                                  <div>
                                    <Label>Order Info</Label>
                                    <p className="text-sm">Total: {selectedOrder.total?.toLocaleString()} UGX</p>
                                    <p className="text-sm">Payment: {selectedOrder.paymentMethod}</p>
                                    <p className="text-sm">Date: {formatOrderDateTime(selectedOrder.createdAt)}</p>
                                  </div>
                                </div>
                                {selectedOrder.deliveryAddress && (
                                  <div>
                                    <Label>Delivery Address</Label>
                                    <p className="text-sm">{selectedOrder.deliveryAddress}</p>
                                  </div>
                                )}
                                {selectedOrder.notes && (
                                  <div>
                                    <Label>Notes</Label>
                                    <p className="text-sm">{selectedOrder.notes}</p>
                                  </div>
                                )}
                                <div>
                                  <Label>Status</Label>
                                  <Select
                                    value={selectedOrder.status}
                                    onValueChange={(status) =>
                                      updateStatusMutation.mutate({ orderId: selectedOrder.id, status })
                                    }
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ORDER_STATUS_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32">
                      <div className="flex flex-col items-center justify-center text-center">
                        <ClipboardList className="h-10 w-10 text-slate-300 mb-2" />
                        <p className="text-sm font-medium text-slate-900">No orders found</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {statusFilter === "all" ? "Orders will appear here when customers place them." : `No orders with status "${statusFilter}".`}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
