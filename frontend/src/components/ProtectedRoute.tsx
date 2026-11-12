import React from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { dashboardPath, useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";

/** UX guard only. Real authorization happens on the server for every API call. */
const ProtectedRoute = ({ role, children }: { role: Role; children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Loading"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to={`/login/${role}`} replace />;
  if (user.role !== role) return <Navigate to={dashboardPath(user.role)} replace />;
  return <>{children}</>;
};
export default ProtectedRoute;
