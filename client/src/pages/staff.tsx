import { useState } from "react";
import { useData, type User, type Role } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Plus, User as UserIcon, Shield, Edit2, Power } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const userSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Invalid email"),
  role: z.enum(["Owner", "Manager", "Sales"]),
  shopId: z.string().min(1, "Shop required"),
  pin: z.string().min(4, "PIN must be 4-12 digits").max(12).optional(),
});

export default function StaffPage() {
  const { users, addUser, updateUser, deleteUser, shops, activeShopId } = useData();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "Sales",
      shopId: activeShopId,
      pin: "",
    }
  });

  const onSubmit = async (values: z.infer<typeof userSchema>) => {
    setSubmitting(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, values);
        toast({ title: "Staff Updated", description: `${values.name} has been updated.` });
      } else {
        await addUser(values);
        toast({ title: "Staff Added", description: `${values.name} has been added.` });
      }
      setOpen(false);
      setEditingUser(null);
      form.reset({
        name: "",
        email: "",
        role: "Sales",
        shopId: activeShopId,
        pin: "",
      });
    } catch (err: any) {
      toast({ title: "Action failed", description: err?.message || "Could not update staff", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.reset({
      name: user.name,
      email: user.email,
      role: user.role as Role,
      shopId: user.shopId,
      pin: "",
    });
    setOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm("Disable this staff account? They will not be able to sign in.")) {
      try {
        await deleteUser(id);
        toast({ title: "Staff Disabled", description: `${name} can no longer log in.` });
      } catch (err: any) {
        toast({
          title: "Could not disable staff",
          description: err?.message || "Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleAddNew = () => {
    setEditingUser(null);
    form.reset({
      name: "",
      email: "",
      role: "Sales",
      shopId: activeShopId,
      pin: "",
    });
    setOpen(true);
  };

  if ((currentUser?.role as string) !== "Owner") {
    return (
      <div className="surface-panel flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 max-w-sm mt-2">Only owners can manage staff members. Please contact your administrator.</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-hero flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="page-kicker">Access Control</div>
          <h1 className="page-title">Staff Management</h1>
          <p className="page-subtitle">Manage staff accounts, branch assignment, and permissions with clearer role guidance.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 sm:w-auto" onClick={handleAddNew}>
              <Plus className="w-4 h-4" />
              Add Staff Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit Staff Member" : "Add New Staff"}</DialogTitle>
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="john@techpos.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Sales">Sales Staff</SelectItem>
                            <SelectItem value="Manager">Manager</SelectItem>
                            <SelectItem value="Owner">Owner</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="shopId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned Shop</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select shop" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {shops.map(shop => (
                              <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Login PIN (4-12 digits)</FormLabel>
                      <FormControl>
                        <Input placeholder="Set/Reset staff PIN" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="surface-muted p-4 text-xs text-slate-500 space-y-2">
                  <div className="font-medium text-slate-700 mb-1">Role Permissions:</div>
                  <div className="grid grid-cols-1 gap-1">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] h-4 px-1">Sales</Badge>
                      <span>Submit sales, repairs, trade-ins, and daily closures. Cannot see owner reports.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] h-4 px-1 tone-info">Manager</Badge>
                      <span>Review closures and repairs. Can view most reports but cannot delete financial records.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] h-4 px-1 bg-indigo-50 text-indigo-700 border-indigo-200">Owner</Badge>
                      <span>Full access. Edit/Delete anything. View all financials.</span>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Saving..." : editingUser ? "Update Staff" : "Create Account"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {users.length} users in your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
                  <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-slate-900">{user.name}</span>
                          <span className="truncate text-xs text-slate-500">{user.email}</span>
                        </div>
                      </div>
                    </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={
                        user.role === "Owner" ? "bg-purple-50 text-purple-700 border-purple-200" :
                        user.role === "Manager" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        "bg-slate-50 text-slate-700 border-slate-200"
                      }
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-600">
                      {shops.find(s => s.id === user.shopId)?.name || "Unknown Shop"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-500">{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : "—"}</span>
                  </TableCell>
                  <TableCell>
                    <div className={`flex items-center gap-1 text-xs font-medium ${user.status === "disabled" ? "text-red-600" : "text-green-600"}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${user.status === "disabled" ? "bg-red-600" : "bg-green-600"}`} />
                      {user.status === "disabled" ? "Disabled" : "Active"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                        <Edit2 className="w-4 h-4 text-slate-400 hover:text-primary" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(user.id, user.name)}
                        disabled={(user.role === "Owner" && users.filter(u => u.role === "Owner").length === 1) || user.status === "disabled"}
                      >
                        <Power className="w-4 h-4 text-slate-400 hover:text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
