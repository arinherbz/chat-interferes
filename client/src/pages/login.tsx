import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { Smartphone, ShieldCheck, User, LockKeyhole, Loader2 } from "lucide-react";
import logoUrl from "@assets/generated_images/minimalist_phone_shop_logo_icon.png";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("owner");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username.trim(), pin);
      toast({ title: "Signed in", description: "Session secured for this device." });
    } catch (err: any) {
      toast({ title: "Login failed", description: err?.message || "Check your username or PIN", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="text-center space-y-2">
        <img 
          src={logoUrl} 
          alt="Logo" 
          className="w-20 h-20 mx-auto rounded-xl shadow-lg mb-4"
        />
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Ariostore Control</h1>
        <p className="text-slate-500">Sign in with your staff PIN to unlock the shop system.</p>
      </div>

      <Card className="border-slate-200 shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Staff Login</CardTitle>
          <CardDescription>Username + PIN. Sessions persist after refresh.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="h-12 text-lg"
                placeholder="owner"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin" className="text-sm text-slate-700 flex items-center gap-2">
                <LockKeyhole className="w-4 h-4 text-slate-400" />
                PIN / Password
              </Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="h-12 text-lg tracking-widest"
                placeholder="••••"
              />
            </div>

            <Button type="submit" className="w-full h-12 text-lg" disabled={submitting}>
              {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ShieldCheck className="w-5 h-5 mr-2" />}
              Enter Store
            </Button>
          </form>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div className="text-sm text-slate-600 text-left">
                <div className="font-semibold text-slate-800">Default owner login</div>
                <div>username: <span className="font-mono">owner</span> · PIN: <span className="font-mono">0000</span></div>
                <div className="text-xs text-amber-600 mt-1">Change this in Staff as soon as you sign in.</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <p className="text-center text-xs text-slate-400">
        &copy; 2025 Ariostore. Secure environment.
      </p>
    </div>
  );
}
