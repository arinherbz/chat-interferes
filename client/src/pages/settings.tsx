import { useData } from "@/lib/data-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Building, CreditCard, Users, Settings as SettingsIcon, Shield } from "lucide-react";

export default function SettingsPage() {
  const { activeShop, users } = useData();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="text-slate-500">Manage shop profile, team access, and subscription.</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="team">Team & Access</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shop Profile</CardTitle>
              <CardDescription>Public details about your shop.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="shop-name">Shop Name</Label>
                <Input id="shop-name" defaultValue={activeShop.name} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Location / Address</Label>
                <Input id="location" defaultValue={activeShop.location} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" defaultValue={activeShop.currency} disabled />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                 <CardTitle>Team Members</CardTitle>
                 <CardDescription>Manage staff access and roles.</CardDescription>
              </div>
              <Button variant="outline" size="sm">Invite New User</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {users.map(user => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-slate-900">{user.name}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={user.role === 'Owner' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions</CardTitle>
              <CardDescription>View what each role can do.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <Shield className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <h4 className="font-medium">Owner</h4>
                    <p className="text-sm text-slate-500">Full access to everything, including billing and sensitive reports.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Shield className="w-5 h-5 text-slate-400 mt-1" />
                  <div>
                    <h4 className="font-medium">Supervisor</h4>
                    <p className="text-sm text-slate-500">Can manage closures, view most reports, and edit sales/repairs.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Shield className="w-5 h-5 text-slate-200 mt-1" />
                  <div>
                    <h4 className="font-medium">Staff</h4>
                    <p className="text-sm text-slate-500">Can process sales, repairs, and submit daily closures.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plan</CardTitle>
              <CardDescription>You are currently on the <strong>{activeShop.subscriptionPlan.toUpperCase()}</strong> plan.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                 <div className="border rounded-lg p-6 bg-slate-50 opacity-50">
                    <h3 className="font-bold text-lg">Basic</h3>
                    <p className="text-2xl font-bold mt-2">$29<span className="text-sm font-normal text-slate-500">/mo</span></p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-600">
                      <li>• 1 Shop</li>
                      <li>• 2 Users</li>
                      <li>• Basic Reports</li>
                    </ul>
                 </div>
                 <div className="border rounded-lg p-6 border-primary bg-primary/5 relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs px-2 py-0.5 rounded-full">Current Plan</div>
                    <h3 className="font-bold text-lg text-primary">Pro</h3>
                    <p className="text-2xl font-bold mt-2">$79<span className="text-sm font-normal text-slate-500">/mo</span></p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-600">
                      <li>• 3 Shops</li>
                      <li>• 10 Users</li>
                      <li>• Advanced Analytics</li>
                      <li>• API Access</li>
                    </ul>
                 </div>
                 <div className="border rounded-lg p-6 bg-slate-50">
                    <h3 className="font-bold text-lg">Enterprise</h3>
                    <p className="text-2xl font-bold mt-2">Custom</p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-600">
                      <li>• Unlimited Shops</li>
                      <li>• Unlimited Users</li>
                      <li>• Dedicated Support</li>
                    </ul>
                    <Button variant="outline" className="w-full mt-4">Contact Sales</Button>
                 </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
