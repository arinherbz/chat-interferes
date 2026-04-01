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
import { Loader2, Truck, MapPin, Phone, User, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import type { Delivery } from "@shared/schema";

const statusColors = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  "PICKED UP": "bg-purple-100 text-purple-800",
  "IN TRANSIT": "bg-orange-100 text-orange-800",
  DELIVERED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

const statusIcons = {
  PENDING: Clock,
  ASSIGNED: User,
  "PICKED UP": Truck,
  "IN TRANSIT": MapPin,
  DELIVERED: CheckCircle,
  FAILED: XCircle,
};

export default function DeliveriesPage() {
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["deliveries", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await apiRequest("GET", `/api/deliveries?${params}`);
      return unwrapApiData(await response.json());
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ deliveryId, status, notes }: { deliveryId: string; status: string; notes?: string }) => {
      const response = await apiRequest("PATCH", `/api/deliveries/${deliveryId}/status`, { status, notes });
      return unwrapApiData(await response.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      toast({
        title: "Success",
        description: "Delivery status updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update delivery status",
        variant: "destructive",
      });
    },
  });

  const createDeliveryMutation = useMutation({
    mutationFn: async (data: { orderId: string; address?: string; assignedRiderId?: string; scheduledAt?: string; notes?: string }) => {
      const response = await apiRequest("POST", "/api/deliveries", data);
      return unwrapApiData(await response.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      toast({
        title: "Success",
        description: "Delivery created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create delivery",
        variant: "destructive",
      });
    },
  });

  const filteredDeliveries = deliveries.filter((delivery: Delivery) =>
    statusFilter === "all" || delivery.status === statusFilter
  );

  const StatusIcon = selectedDelivery ? statusIcons[selectedDelivery.status as keyof typeof statusIcons] || Clock : Clock;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deliveries</h1>
          <p className="text-muted-foreground">Manage delivery assignments and track delivery status</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Deliveries</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="PICKED UP">Picked Up</SelectItem>
                <SelectItem value="IN TRANSIT">In Transit</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
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
                  <TableHead>Address</TableHead>
                  <TableHead>Rider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeliveries.map((delivery: Delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="font-mono text-sm">{delivery.orderId.slice(-8)}</TableCell>
                    <TableCell className="max-w-xs truncate">{delivery.address}</TableCell>
                    <TableCell>
                      {delivery.assignedRiderId ? (
                        <div>
                          <p className="text-sm font-medium">Rider Assigned</p>
                          <p className="text-xs text-muted-foreground">ID: {delivery.assignedRiderId.slice(-8)}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[delivery.status as keyof typeof statusColors]}>
                        {delivery.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {delivery.scheduledAt ? new Date(delivery.scheduledAt).toLocaleDateString() : "Not scheduled"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedDelivery(delivery)}
                            >
                              <Truck className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <StatusIcon className="h-5 w-5" />
                                Delivery Details - {delivery.id.slice(-8)}
                              </DialogTitle>
                            </DialogHeader>
                            {selectedDelivery && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Order ID</Label>
                                    <p className="text-sm font-mono">{selectedDelivery.orderId}</p>
                                  </div>
                                  <div>
                                    <Label>Status</Label>
                                    <Select
                                      value={selectedDelivery.status}
                                      onValueChange={(status) =>
                                        updateStatusMutation.mutate({ deliveryId: selectedDelivery.id, status })
                                      }
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="PENDING">Pending</SelectItem>
                                        <SelectItem value="ASSIGNED">Assigned</SelectItem>
                                        <SelectItem value="PICKED UP">Picked Up</SelectItem>
                                        <SelectItem value="IN TRANSIT">In Transit</SelectItem>
                                        <SelectItem value="DELIVERED">Delivered</SelectItem>
                                        <SelectItem value="FAILED">Failed</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div>
                                  <Label>Delivery Address</Label>
                                  <p className="text-sm">{selectedDelivery.address}</p>
                                </div>
                                {selectedDelivery.scheduledAt && (
                                  <div>
                                    <Label>Scheduled For</Label>
                                    <p className="text-sm">{new Date(selectedDelivery.scheduledAt).toLocaleString()}</p>
                                  </div>
                                )}
                                {selectedDelivery.pickedUpAt && (
                                  <div>
                                    <Label>Picked Up At</Label>
                                    <p className="text-sm">{new Date(selectedDelivery.pickedUpAt).toLocaleString()}</p>
                                  </div>
                                )}
                                {selectedDelivery.deliveredAt && (
                                  <div>
                                    <Label>Delivered At</Label>
                                    <p className="text-sm">{new Date(selectedDelivery.deliveredAt).toLocaleString()}</p>
                                  </div>
                                )}
                                {selectedDelivery.failureReason && (
                                  <div>
                                    <Label>Failure Reason</Label>
                                    <p className="text-sm text-red-600">{selectedDelivery.failureReason}</p>
                                  </div>
                                )}
                                {selectedDelivery.notes && (
                                  <div>
                                    <Label>Notes</Label>
                                    <p className="text-sm">{selectedDelivery.notes}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
