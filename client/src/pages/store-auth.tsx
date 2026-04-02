import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, LockKeyhole, MessageCircle, UserRound } from "lucide-react";
import { StoreShell } from "@/components/store-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStoreCustomerAuth } from "@/lib/store-customer-auth";
import { useToast } from "@/hooks/use-toast";
import { createWhatsAppUrl, isValidStorePhoneInput, normalizeStorePhoneInput } from "@/lib/store-support";

export default function StoreAuthPage() {
  const [location, setLocation] = useLocation();
  const { customer, loading, login, signup } = useStoreCustomerAuth();
  const { toast } = useToast();

  const isSignupRoute = location.startsWith("/store/signup");
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const redirectTo = search.get("redirect") || "/store/account";
  const [mode, setMode] = useState<"signin" | "signup">(isSignupRoute ? "signup" : "signin");
  const [form, setForm] = useState({
    identifier: "",
    password: "",
    name: "",
    phone: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (customer && !loading) {
      setLocation(redirectTo, { replace: true });
    }
  }, [customer, loading, redirectTo, setLocation]);

  const activeMode = isSignupRoute ? "signup" : mode;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = form.name.trim();
    const normalizedPhone = normalizeStorePhoneInput(form.phone);
    const trimmedIdentifier = form.identifier.trim();
    const trimmedEmail = form.email.trim();

    if (activeMode === "signup") {
      if (!trimmedName) {
        toast({ title: "Name required", description: "Enter your full name to create an account.", variant: "destructive" });
        return;
      }
      if (!isValidStorePhoneInput(normalizedPhone)) {
        toast({ title: "Invalid phone number", description: "Use a phone number in the +256 format.", variant: "destructive" });
        return;
      }
      if (form.password.trim().length < 8) {
        toast({ title: "Password too short", description: "Use at least 8 characters for your password.", variant: "destructive" });
        return;
      }
    } else if (!trimmedIdentifier || !form.password.trim()) {
      toast({ title: "Missing details", description: "Enter your email or phone number and password to sign in.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      if (activeMode === "signup") {
        await signup({
          name: trimmedName,
          phone: normalizedPhone,
          email: trimmedEmail || undefined,
          password: form.password.trim(),
        });
        toast({ title: "Account created", description: "You can now manage your orders and trade-ins." });
      } else {
        await login({ identifier: trimmedIdentifier, password: form.password.trim() });
        toast({ title: "Signed in", description: "Your account dashboard is ready." });
      }
      setLocation(redirectTo, { replace: true });
    } catch (err: any) {
      toast({
        title: activeMode === "signup" ? "Could not create account" : "Could not sign in",
        description: err?.message || "Please check your details and try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StoreShell>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <Card className="border-border/70 bg-white/96 shadow-[0_20px_48px_rgba(24,38,31,0.06)]">
          <CardHeader className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Customer Access</p>
            <CardTitle className="text-3xl font-semibold tracking-tight">Your Ariostore account</CardTitle>
            <CardDescription className="max-w-xl text-sm leading-6">
              Sign in to review your orders and trade-in requests, or create an account using the same phone or email you use at checkout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={activeMode} onValueChange={(value) => {
              const nextMode = value as "signin" | "signup";
              setMode(nextMode);
              setLocation(nextMode === "signup" ? `/store/signup?redirect=${encodeURIComponent(redirectTo)}` : `/store/login?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
            }}>
              <TabsList>
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Create Account</TabsTrigger>
              </TabsList>
            </Tabs>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {activeMode === "signup" ? (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="store-name">Full name</Label>
                      <Input id="store-name" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Your full name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="store-phone">Phone number</Label>
                      <Input id="store-phone" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} placeholder="+2567..." />
                      <p className="text-xs text-muted-foreground">Use your Ugandan number in the +256 format.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store-email">Email address</Label>
                    <Input id="store-email" type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} placeholder="you@example.com" />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="store-identifier">Email or phone</Label>
                  <Input id="store-identifier" value={form.identifier} onChange={(e) => setForm((s) => ({ ...s, identifier: e.target.value }))} placeholder="Email or +256 phone number" />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="store-password">Password</Label>
                <Input id="store-password" type="password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} placeholder="Enter your password" />
              </div>

              <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : activeMode === "signup" ? "Create Account" : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 bg-white/96 shadow-[0_18px_40px_rgba(24,38,31,0.055)]">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-950">What you can access</p>
                  <p className="text-sm text-muted-foreground">Order history, saved delivery addresses, and trade-in activity.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-secondary p-2 text-slate-600">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-950">Protected customer area</p>
                  <p className="text-sm text-muted-foreground">Your account pages stay private and redirect back after sign-in.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-white/96 shadow-[0_18px_40px_rgba(24,38,31,0.055)]">
            <CardContent className="space-y-3 p-6">
              <p className="font-medium text-slate-950">Need help signing in?</p>
              <p className="text-sm text-muted-foreground">If you checked out before creating an account, use the same phone number or email address here.</p>
              <a href={createWhatsAppUrl("Hello Ario Store, I need help accessing my customer account.")} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Chat on WhatsApp
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </StoreShell>
  );
}
