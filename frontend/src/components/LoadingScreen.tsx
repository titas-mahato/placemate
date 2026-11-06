import React, { useEffect, useState } from "react";
import sauLogo from "@/assets/sau-logo.png"; // Ensure this path matches your project
import { Progress } from "@/components/ui/progress"; // Assuming you have shadcn/ui progress, otherwise see styling below

interface LoadingScreenProps {
  onLoadComplete: () => void;
}

const LoadingScreen = ({ onLoadComplete }: LoadingScreenProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 100) {
          clearInterval(timer);
          setTimeout(onLoadComplete, 500); // Small delay at 100% for smoothness
          return 100;
        }
        return prevProgress + 2; // Adjust speed here (higher = faster)
      });
    }, 20); // Adjust tick rate (lower = smoother/faster)

    return () => clearInterval(timer);
  }, [onLoadComplete]);

  return (
    // 1. Flex container with 'items-center' to force horizontal centering
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-hero-overlay via-primary to-hero-overlay">
      
      {/* 2. Logo Container with 'mb-8' for spacing */}
      <div className="mb-8 relative animate-pulse">
        {/* 'mx-auto' ensures the image itself is centered if the container grows */}
        <img 
          src={sauLogo} 
          alt="South Asian University" 
          className="w-24 h-24 md:w-32 md:h-32 object-contain mx-auto drop-shadow-2xl" 
        />
      </div>

      {/* 3. Text Container - Centered */}
      <div className="text-center space-y-3 mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-wide">
          South Asian University
        </h1>
        <p className="text-lg text-white/80 font-light tracking-wider uppercase">
          Internship & Placement Cell
        </p>
      </div>

      {/* 4. Custom Progress Bar - Perfectly Centered */}
      <div className="w-64 md:w-80 h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gold-accent shadow-[0_0_10px_rgba(255,215,0,0.5)] transition-all duration-100 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default LoadingScreen;