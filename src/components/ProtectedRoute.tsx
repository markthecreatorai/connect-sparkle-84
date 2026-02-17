import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};
