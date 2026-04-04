import { useEffect, useMemo, useState } from "react";
import { useData, type Role, type User } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BiometricSettings } from "@/components/biometric-settings";

type SubscriptionPlan = "trial" | "basic" | "pro" | "enterprise";

const PLAN_DETAILS: Array<{
  id: SubscriptionPlan;
  name: string;
  price: string;
  description: string[];
}> = [
  {
    id: "basic",
    name: "Basic",
    price: "$29/mo",
    description: ["1 Shop", "2 Users", "Basic Reports"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$79/mo",
    description: ["3 Shops", "10 Users", "Advanced Analytics", "API Access"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: ["Unlimited Shops", "Unlimited Users", "Dedicated Support"],
  },
];

const EMPTY_MEMBER_FORM = {
  name: "",
  email: "",
  role: "Sales" as Role,
  pin: "",
};

export default function SettingsPage() {
  const { activeShop, users, updateShop, addUser, updateUser } = useData();
  const { user, preferences, updatePreferences } = useAuth();
  const { toast } = useToast();

  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [currency, setCurrency] = useState("UGX");
  const [timezone, setTimezone] = useState("UTC");
  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");

  const [shopName, setShopName] = useState("");
  const [shopLocation, setShopLocation] = useState("");
  const [shopSaving, setShopSaving] = useState(false);
  const [planSaving, setPlanSaving] = useState<SubscriptionPlan | null>(null);

  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER_FORM);

  const canManageTeam = user?.role === "Owner";
  const canManageBilling = user?.role === "Owner" || user?.role === "Manager";

  useEffect(() => {
    if (!preferences) return;
    setTheme(preferences.theme || "system");
    setCurrency(preferences.currency || "UGX");
    setTimezone(preferences.timezone || "UTC");
    setDensity(preferences.density || "comfortable");
  }, [preferences]);

  useEffect(() => {
    setShopName(activeShop?.name || "");
    setShopLocation(activeShop?.location || "");
  }, [activeShop]);

  const memberCounts = useMemo(
    () =>
      users.reduce<Record<Role, number>>(
        (acc, member) => {
          acc[member.role] += 1;
          return acc;
        },
        { Owner: 0, Manager: 0, Sales: 0 },
      ),
    [users],
  );

  const openInviteDialog = () => {
    setEditingMember(null);
    setMemberForm(EMPTY_MEMBER_FORM);
    setMemberDialogOpen(true);
  };

  const openEditDialog = (member: User) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name,
      email: member.email,
      role: member.role,
      pin: "",
    });
    setMemberDialogOpen(true);
  };

  const handleSaveShop = async () => {
    if (!shopName.trim()) {
      toast({ title: "Shop name required", description: "Enter a shop name before saving.", variant: "destructive" });
      return;
    }

    setShopSaving(true);
    try {
      await updateShop(activeShop.id, {
        name: shopName.trim(),
        location: shopLocation.trim(),
      });
      toast({ title: "Saved", description: "Shop profile updated." });
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err?.message || "Could not update the shop profile.",
        variant: "destructive",
      });
    } finally {
      setShopSaving(false);
    }
  };

  const handleSaveMember = async () => {
    if (!memberForm.name.trim() || !memberForm.email.trim()) {
      toast({
        title: "Missing information",
        description: "Name and email are required.",
        variant: "destructive",
      });
      return;
    }

    if (!editingMember && !memberForm.pin.trim()) {
      toast({
        title: "PIN required",
        description: "New staff accounts need a login PIN.",
        variant: "destructive",
      });
      return;
    }

    setMemberSaving(true);
    try {
      if (editingMember) {
        await updateUser(editingMember.id, {
          name: memberForm.name.trim(),
          email: memberForm.email.trim(),
          role: memberForm.role,
          pin: memberForm.pin.trim() || undefined,
        });
        toast({ title: "Team updated", description: `${memberForm.name} was updated.` });
      } else {
        await addUser({
          name: memberForm.name.trim(),
          email: memberForm.email.trim(),
          role: memberForm.role,
          shopId: activeShop.id,
          status: "active",
          pin: memberForm.pin.trim(),
        });
        toast({ title: "User invited", description: `${memberForm.name} can now sign in.` });
      }

      setMemberDialogOpen(false);
      setEditingMember(null);
      setMemberForm(EMPTY_MEMBER_FORM);
    } catch (err: any) {
      toast({
        title: editingMember ? "Update failed" : "Invite failed",
        description: err?.message || "Could not save the team member.",
        variant: "destructive",
      });
    } finally {
      setMemberSaving(false);
    }
  };

  const handlePlanChange = async (plan: SubscriptionPlan) => {
    if (!canManageBilling) {
      toast({
        title: "Access denied",
        description: "Only owners or managers can change plans.",
        variant: "destructive",
      });
      return;
    }

    if (plan === "enterprise") {
      window.location.href = `mailto:sales@ariostore.local?subject=${encodeURIComponent(`${activeShop.name} enterprise plan request`)}`;
      return;
    }

    setPlanSaving(plan);
    try {
      await updateShop(activeShop.id, { subscriptionPlan: plan });
      toast({ title: "Plan updated", description: `${activeShop.name} is now on the ${plan.toUpperCase()} plan.` });
    } catch (err: any) {
      toast({
        title: "Plan change failed",
        description: err?.message || "Could not update the subscription plan.",
        variant: "destructive",
      });
    } finally {
      setPlanSaving(null);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Settings</h1>
          <p className="text-sm text-slate-500 sm:text-base">Manage shop profile, team access, and subscription.</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-xl p-1 sm:max-w-lg sm:grid-cols-4">
          <TabsTrigger value="general" className="w-full px-3 py-2 text-center whitespace-normal">
            General
          </TabsTrigger>
          <TabsTrigger value="team" className="w-full px-3 py-2 text-center whitespace-normal">
            Team & Access
          </TabsTrigger>
          <TabsTrigger value="security" className="w-full px-3 py-2 text-center whitespace-normal">
            Security
          </TabsTrigger>
          <TabsTrigger value="billing" className="w-full px-3 py-2 text-center whitespace-normal">
            Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personalization</CardTitle>
              <CardDescription>Your UI and locale defaults are persisted per user account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label>Theme</Label>
                <Select
                  value={theme}
                  onValueChange={(value: "light" | "dark" | "system") => {
                    setTheme(value);
                    void updatePreferences({ theme: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Currency</Label>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  onBlur={() => void updatePreferences({ currency })}
                />
              </div>

              <div className="grid gap-2">
                <Label>Timezone</Label>
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  onBlur={() => void updatePreferences({ timezone })}
                />
              </div>

              <div className="flex flex-col gap-4 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">Compact layout density</p>
                  <p className="text-sm text-slate-500">Tighten spacing for high-information screens.</p>
                </div>
                <Switch
                  checked={density === "compact"}
                  onCheckedChange={(checked) => {
                    const nextDensity: "compact" | "comfortable" = checked ? "compact" : "comfortable";
                    setDensity(nextDensity);
                    void updatePreferences({ density: nextDensity });
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shop Profile</CardTitle>
              <CardDescription>Update the current branch profile used across the app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="shop-name">Shop Name</Label>
                <Input id="shop-name" value={shopName} onChange={(e) => setShopName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Location / Address</Label>
                <Input id="location" value={shopLocation} onChange={(e) => setShopLocation(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" value={activeShop.currency} disabled />
              </div>
              <Button onClick={handleSaveShop} disabled={shopSaving}>
                {shopSaving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Manage staff access and roles for this branch.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={openInviteDialog}
                disabled={!canManageTeam}
              >
                Invite New User
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {!canManageTeam && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Team changes require an owner account.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <div className="text-sm text-slate-500">Owners</div>
                  <div className="text-2xl font-semibold text-slate-900">{memberCounts.Owner}</div>
                </div>
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <div className="text-sm text-slate-500">Managers</div>
                  <div className="text-2xl font-semibold text-slate-900">{memberCounts.Manager}</div>
                </div>
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <div className="text-sm text-slate-500">Sales Staff</div>
                  <div className="text-2xl font-semibold text-slate-900">{memberCounts.Sales}</div>
                </div>
              </div>

              <div className="space-y-6">
                {users.map((member) => (
                  <div key={member.id} className="flex flex-col gap-4 border-b pb-5 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <Avatar className="shrink-0">
                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{member.name}</p>
                        <p className="truncate text-sm text-slate-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                      <Badge variant={member.role === "Owner" ? "default" : "secondary"}>
                        {member.role === "Sales" ? "Sales Staff" : member.role}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canManageTeam}
                        onClick={() => openEditDialog(member)}
                      >
                        Edit
                      </Button>
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
                  <Shield className="mt-1 h-5 w-5 text-primary" />
                  <div>
                    <h4 className="font-medium">Owner</h4>
                    <p className="text-sm text-slate-500">Full access to everything, including billing and sensitive reports.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Shield className="mt-1 h-5 w-5 text-slate-400" />
                  <div>
                    <h4 className="font-medium">Manager</h4>
                    <p className="text-sm text-slate-500">Can manage closures, view most reports, and edit sales/repairs.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Shield className="mt-1 h-5 w-5 text-slate-200" />
                  <div>
                    <h4 className="font-medium">Sales Staff</h4>
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
              <CardDescription>
                Your shop is currently on the <strong>{activeShop.subscriptionPlan.toUpperCase()}</strong> plan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {PLAN_DETAILS.map((plan) => {
                  const isCurrent = activeShop.subscriptionPlan === plan.id;
                  const isSaving = planSaving === plan.id;

                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-lg border p-6 ${isCurrent ? "border-primary bg-primary/5" : "bg-slate-50"}`}
                    >
                      {isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                          Current Plan
                        </div>
                      )}
                      <h3 className={`text-lg font-bold ${isCurrent ? "text-primary" : "text-slate-900"}`}>{plan.name}</h3>
                      <p className="mt-2 text-2xl font-bold">{plan.price}</p>
                      <ul className="mt-4 space-y-2 text-sm text-slate-600">
                        {plan.description.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                      <Button
                        variant={plan.id === "enterprise" ? "outline" : isCurrent ? "secondary" : "default"}
                        className="mt-4 w-full"
                        disabled={(isCurrent && plan.id !== "enterprise") || !!planSaving}
                        onClick={() => handlePlanChange(plan.id)}
                      >
                        {plan.id === "enterprise"
                          ? "Contact Sales"
                          : isSaving
                            ? "Updating..."
                            : isCurrent
                              ? "Current Plan"
                              : `Switch to ${plan.name}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-6">
          <BiometricSettings />
        </TabsContent>
      </Tabs>

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit Team Member" : "Invite Team Member"}</DialogTitle>
            <DialogDescription>
              {editingMember
                ? "Update the staff record and optionally reset the login PIN."
                : "Create a new staff account for the current branch."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="member-name">Full Name</Label>
              <Input
                id="member-name"
                value={memberForm.name}
                onChange={(e) => setMemberForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                value={memberForm.email}
                onChange={(e) => setMemberForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={memberForm.role}
                onValueChange={(value: Role) => setMemberForm((prev) => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sales">Sales Staff</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="member-pin">{editingMember ? "Reset PIN (optional)" : "Login PIN"}</Label>
              <Input
                id="member-pin"
                type="password"
                value={memberForm.pin}
                onChange={(e) => setMemberForm((prev) => ({ ...prev, pin: e.target.value }))}
                placeholder={editingMember ? "Leave blank to keep current PIN" : "Enter a 4-12 digit PIN"}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMemberDialogOpen(false);
                setEditingMember(null);
                setMemberForm(EMPTY_MEMBER_FORM);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveMember} disabled={memberSaving}>
              {memberSaving ? "Saving..." : editingMember ? "Save Member" : "Invite User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
