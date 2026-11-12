import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react"; // Added Loader2
import { useNavigate } from "react-router-dom";
import sauLogo from "@/assets/sau-logo.png";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const LoginAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login("admin", email, password); // server-side session; no role flag is stored in the browser
      navigate("/admin/dashboard");
    } catch (err) {
      toast({ title: "Access denied", description: err instanceof ApiError ? err.message : "Could not connect to server.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-hero-overlay via-primary to-hero-overlay flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-hero-overlay/40" />
      
      <Button
        variant="ghost"
        className="absolute top-4 left-4 z-20 text-white hover:text-white hover:bg-white/10"
        onClick={() => navigate('/login')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="glass-morphism rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <img src={sauLogo} alt="SAU Logo" className="w-auto h-24 object-contain drop-shadow-lg" />
            <h1 className="text-3xl font-bold text-white text-center">Administrator Login</h1>
            <p className="text-white/80 text-center">South Asian University Placement Cell</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white font-medium">Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@sau.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-white hover:bg-white/90 text-foreground font-bold py-6 text-lg shadow-lg hover:shadow-xl transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying Access...
                </>
              ) : (
                "Sign In"
              )}
            </Button>

            <div className="text-center">
              <a href="#" className="text-white/80 hover:text-white text-sm transition-colors">
                Forgot Password?
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginAdmin;