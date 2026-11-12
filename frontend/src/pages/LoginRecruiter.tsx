import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import sauLogo from "@/assets/sau-logo.png";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { FieldError } from "@/components/dashboard/common";

const inputCls = "bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white";

const LoginRecruiter = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState({ name: "", company_name: "", company_location: "", website: "", email: "", password: "", confirmPassword: "" });
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [e.target.id]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);
    try {
      if (isSignUp) {
        if (f.password !== f.confirmPassword) { setErrors({ confirmPassword: "Passwords do not match" }); return; }
        const r = await api.auth.registerRecruiter({ name: f.name, company_name: f.company_name, company_location: f.company_location, website: f.website, email: f.email, password: f.password });
        toast({ title: "Registration received", description: r.message });
        setIsSignUp(false);
      } else {
        await login("recruiter", f.email, f.password);
        navigate("/recruiter/dashboard");
      }
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      toast({ title: isSignUp ? "Registration failed" : "Login failed", description: err instanceof ApiError ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const field = (id: keyof typeof f, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-white font-medium">{label}</Label>
      <Input id={id} value={f[id]} onChange={onChange} className={inputCls} aria-invalid={!!errors[id]} {...props} />
      <FieldError id={id} message={errors[id] ?? undefined} />
    </div>
  );
  return (
    <div className="min-h-screen bg-gradient-to-br from-hero-overlay via-primary to-hero-overlay flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-hero-overlay/40" />
      <Button variant="ghost" className="absolute top-4 left-4 z-20 text-white hover:text-white hover:bg-white/10" onClick={() => navigate("/login")}>
        <ArrowLeft className="mr-2 h-4 w-4" />Back
      </Button>

      <div className="relative z-10 w-full max-w-lg mx-4">
        <div className="glass-morphism rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <img src={sauLogo} alt="SAU Logo" className="w-auto h-24 drop-shadow-lg" />
            <h1 className="text-3xl font-bold text-white text-center">{isSignUp ? "Recruiter Registration" : "Recruiter Login"}</h1>
            <p className="text-white/80 text-center">South Asian University Placement Cell</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {isSignUp && (
              <>
                {field("name", "Your name", { placeholder: "Priya Sharma" })}
                {field("company_name", "Company", { placeholder: "Acme Corp" })}
                <div className="grid gap-4 sm:grid-cols-2">{field("company_location", "Headquarters (optional)", { placeholder: "Bengaluru" })}{field("website", "Website (optional)", { placeholder: "https://" })}</div>
              </>
            )}
            {field("email", "Company Email", { type: "email", placeholder: "recruiter@company.com", autoComplete: "email" })}
            {field("password", "Password", { type: "password", placeholder: "••••••••", autoComplete: isSignUp ? "new-password" : "current-password" })}
            {isSignUp && field("confirmPassword", "Confirm Password", { type: "password", placeholder: "••••••••", autoComplete: "new-password" })}
            {isSignUp && <p className="text-xs text-white/70">New recruiter accounts must be approved by the placement office before you can sign in.</p>}
            <Button type="submit" className="w-full bg-white hover:bg-white/90 text-foreground font-bold py-6 text-lg shadow-lg" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isSignUp ? "Submitting..." : "Signing In..."}</> : isSignUp ? "Request Access" : "Sign In"}
            </Button>
            <div className="text-center">
              <button type="button" onClick={() => { setIsSignUp(!isSignUp); setErrors({}); }} className="text-white/80 hover:text-white text-sm transition-colors">
                {isSignUp ? "Already approved? Sign In" : "New company? Request access"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginRecruiter;
