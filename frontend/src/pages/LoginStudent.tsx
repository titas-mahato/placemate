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

const LoginStudent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  // State for Form Data
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "", 
    lastName: "",  
    studentId: "",
    program: "",
    year: "",
    gpa: "",       
    confirmPassword: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    // --- 1. REGISTRATION ---
    if (isSignUp) {
      if (formData.password !== formData.confirmPassword) {
        setFieldErrors({ confirmPassword: "Passwords do not match" });
        return;
      }
      setIsLoading(true);
      try {
        await api.auth.registerStudent({
          student_id: formData.studentId, first_name: formData.firstName, last_name: formData.lastName, email: formData.email,
          password: formData.password, major: formData.program, graduation_year: formData.year, gpa: formData.gpa || undefined,
        });
        toast({ title: "Account created", description: "You can now sign in." });
        setIsSignUp(false);
      } catch (err) {
        if (err instanceof ApiError) {
          // server field names -> form field ids
          const map: Record<string, string> = { student_id: "studentId", first_name: "firstName", last_name: "lastName", graduation_year: "year", major: "program" };
          setFieldErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [map[k] ?? k, v])));
          toast({ title: "Registration failed", description: err.message, variant: "destructive" });
        } else toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // --- 2. LOGIN (the server creates the session; nothing is stored in the browser) ---
    setIsLoading(true);
    try {
      await login("student", formData.email, formData.password);
      navigate("/student/dashboard");
    } catch (err) {
      toast({ title: "Login failed", description: err instanceof ApiError ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-hero-overlay via-primary to-hero-overlay flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-hero-overlay/40" />
      
      <Button variant="ghost" className="absolute top-4 left-4 z-20 text-white hover:text-white hover:bg-white/10" onClick={() => navigate('/login')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="relative z-10 w-full max-w-2xl mx-4">
        <div className="glass-morphism rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <img src={sauLogo} alt="SAU Logo" className="w-auto h-24 object-contain drop-shadow-lg" />
            <h1 className="text-3xl font-bold text-white text-center">
              {isSignUp ? "Student Registration" : "Student Login"}
            </h1>
            <p className="text-white/80 text-center">South Asian University Placement Cell</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                {/* FIRST & LAST NAME */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-white font-medium">First Name</Label>
                    <Input 
                      id="firstName" 
                      placeholder="John"  // <--- RESTORED
                      value={formData.firstName} 
                      onChange={handleChange} 
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white" 
                      required 
                    />
                    <FieldError id="firstName" message={fieldErrors.firstName} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-white font-medium">Last Name</Label>
                    <Input 
                      id="lastName" 
                      placeholder="Doe"  // <--- RESTORED
                      value={formData.lastName} 
                      onChange={handleChange} 
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white" 
                      required 
                    />
                    <FieldError id="lastName" message={fieldErrors.lastName} />
                  </div>
                </div>

                {/* ID & PROGRAM */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="studentId" className="text-white font-medium">Student ID</Label>
                    <Input 
                      id="studentId" 
                      placeholder="SAU001"  // <--- RESTORED
                      value={formData.studentId} 
                      onChange={handleChange} 
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white" 
                      required 
                    />
                    <FieldError id="studentId" message={fieldErrors.studentId} />
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="program" className="text-white font-medium">Program</Label>
                    <Input 
                      id="program" 
                      placeholder="Computer Science"  // <--- RESTORED
                      value={formData.program} 
                      onChange={handleChange} 
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white" 
                      required 
                    />
                    <FieldError id="program" message={fieldErrors.program} />
                  </div>
                </div>

                {/* YEAR & GPA */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year" className="text-white font-medium">Graduation Year</Label>
                    <Input 
                      id="year" 
                      type="number" 
                      placeholder="2028"  // <--- RESTORED
                      value={formData.year} 
                      onChange={handleChange} 
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white" 
                      required 
                    />
                    <FieldError id="year" message={fieldErrors.year} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gpa" className="text-white font-medium">Current GPA</Label>
                    <Input 
                      id="gpa" 
                      type="number" 
                      step="0.01" 
                      placeholder="0.0"  // <--- RESTORED
                      value={formData.gpa} 
                      onChange={handleChange} 
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white" 
                      required 
                    />
                    <FieldError id="gpa" message={fieldErrors.gpa} />
                  </div>
                </div>
              </>
            )}

            {/* EMAIL & PASSWORD */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white font-medium">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="student@sau.ac.in"  // <--- RESTORED
                value={formData.email} 
                onChange={handleChange} 
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white" 
                required 
              />
                    <FieldError id="email" message={fieldErrors.email} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white font-medium">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••"  // <--- RESTORED
                value={formData.password} 
                onChange={handleChange} 
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white" 
                required 
              />
                    <FieldError id="password" message={fieldErrors.password} />
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white font-medium">Confirm Password</Label>
                <Input 
                  id="confirmPassword" 
                  type="password" 
                  placeholder="••••••••"  // <--- RESTORED
                  value={formData.confirmPassword} 
                  onChange={handleChange} 
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white" 
                  required 
                />
                    <FieldError id="confirmPassword" message={fieldErrors.confirmPassword} />
              </div>
            )}

            <Button type="submit" className="w-full bg-white hover:bg-white/90 text-foreground font-bold py-6 text-lg shadow-lg hover:shadow-xl transition-all" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isSignUp ? "Creating..." : "Signing In..."}</> : (isSignUp ? "Create Account" : "Sign In")}
            </Button>

            <div className="text-center space-y-2">
              <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-white/80 hover:text-white text-sm transition-colors">
                {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginStudent;