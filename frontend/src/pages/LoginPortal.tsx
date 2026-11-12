import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { User, Building2, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import sauLogo from "@/assets/sau-logo.png";
import LoadingScreen from "@/components/LoadingScreen"; // Ensure this import path is correct

const LoginPortal = () => {
  const navigate = useNavigate();
  // 1. Initialize loading state to true
  const [isLoading, setIsLoading] = useState(true);

  // 2. Define the handler that the LoadingScreen will call when it's done
  const handleLoadComplete = () => {
    setIsLoading(false);
  };

  // 3. Conditional Rendering: Show LoadingScreen first
  if (isLoading) {
    return <LoadingScreen onLoadComplete={handleLoadComplete} />;
  }

  // 4. Once loading is false, render your original Login Portal layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-hero-overlay via-primary to-hero-overlay flex items-center justify-center">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <img 
              src={sauLogo} 
              alt="SAU Logo" 
              className="w-auto h-32 mx-auto mb-6 drop-shadow-2xl" 
            />
            <h1 className="text-5xl font-bold text-white mb-4">Placement Cell Portal</h1>
            <p className="text-xl text-white/80">South Asian University</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Student Login Card */}
            <div 
              className="glass-morphism rounded-2xl p-8 text-center space-y-6 hover:scale-105 transition-transform cursor-pointer"
              onClick={() => navigate('/login/student')}
            >
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto">
                <User className="w-10 h-10 text-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-white">Student</h2>
              <p className="text-white/70">Access your placement dashboard and opportunities</p>
              <Button className="w-full bg-white hover:bg-white/90 text-foreground font-bold">
                Student Login
              </Button>
            </div>

            {/* Recruiter Login Card */}
            <div 
              className="glass-morphism rounded-2xl p-8 text-center space-y-6 hover:scale-105 transition-transform cursor-pointer"
              onClick={() => navigate('/login/recruiter')}
            >
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto">
                <Building2 className="w-10 h-10 text-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-white">Recruiter</h2>
              <p className="text-white/70">Post opportunities and connect with talent</p>
              <Button className="w-full bg-white hover:bg-white/90 text-foreground font-bold">
                Recruiter Login
              </Button>
            </div>

            {/* Admin Login Card */}
            <div 
              className="glass-morphism rounded-2xl p-8 text-center space-y-6 hover:scale-105 transition-transform cursor-pointer"
              onClick={() => navigate('/login/admin')}
            >
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-10 h-10 text-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-white">Administrator</h2>
              <p className="text-white/70">Manage the placement cell operations</p>
              <Button className="w-full bg-white hover:bg-white/90 text-foreground font-bold">
                Admin Login
              </Button>
            </div>
          </div>

          <div className="text-center mt-12">
            <Button
              variant="ghost"
              className="text-white hover:text-white hover:bg-white/10"
              onClick={() => navigate('/')}
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPortal;