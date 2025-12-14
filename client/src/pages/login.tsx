import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { Smartphone, ShieldCheck, User } from "lucide-react";
import logoUrl from "@assets/generated_images/minimalist_phone_shop_logo_icon.png";

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="text-center space-y-2">
        <img 
          src={logoUrl} 
          alt="Logo" 
          className="w-20 h-20 mx-auto rounded-xl shadow-lg mb-4"
        />
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">TechPOS Oversight</h1>
        <p className="text-slate-500">Secure Daily Closure System</p>
      </div>

      <Card className="border-slate-200 shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Select your role to continue (Mock Auth)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            variant="outline" 
            className="w-full h-16 text-lg justify-start px-6 gap-4 hover:border-primary hover:bg-slate-50 transition-all group"
            onClick={() => login("owner")}
          >
            <div className="bg-primary/10 p-2 rounded-full group-hover:bg-primary/20 transition-colors">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div className="flex flex-col items-start">
              <span className="font-semibold text-slate-900">Owner Access</span>
              <span className="text-xs text-slate-500 font-normal">Dashboard & Reports</span>
            </div>
          </Button>

          <Button 
            variant="outline" 
            className="w-full h-16 text-lg justify-start px-6 gap-4 hover:border-primary hover:bg-slate-50 transition-all group"
            onClick={() => login("staff")}
          >
            <div className="bg-emerald-100 p-2 rounded-full group-hover:bg-emerald-200 transition-colors">
              <User className="w-6 h-6 text-emerald-700" />
            </div>
            <div className="flex flex-col items-start">
              <span className="font-semibold text-slate-900">Staff Access</span>
              <span className="text-xs text-slate-500 font-normal">Submit Daily Close</span>
            </div>
          </Button>
        </CardContent>
      </Card>
      
      <p className="text-center text-xs text-slate-400">
        &copy; 2025 TechPOS Systems. Secure Environment.
      </p>
    </div>
  );
}
