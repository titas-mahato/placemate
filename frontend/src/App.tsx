import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
import LoginPortal from "./pages/LoginPortal";
import LoginStudent from "./pages/LoginStudent";
import LoginRecruiter from "./pages/LoginRecruiter";
import LoginAdmin from "./pages/LoginAdmin";
import NotFound from "./pages/NotFound";
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const RecruiterDashboard = lazy(() => import("./pages/RecruiterDashboard"));
import { AuthProvider } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center" role="status" aria-label="Loading">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<LoginPortal />} />
          <Route path="/login/student" element={<LoginStudent />} />
          <Route path="/student/dashboard" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/login/recruiter" element={<LoginRecruiter />} />
          <Route path="/login/admin" element={<LoginAdmin />} />
          <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/recruiter/dashboard" element={<ProtectedRoute role="recruiter"><RecruiterDashboard /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
