import React from "react";
import { Navigate } from "@tanstack/react-router";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { admin, loading, isAdmin } = useAdminAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0F1117] flex items-center justify-center z-50">
        <LoadingSpinner label="Verificando permissões..." />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" />;
  }

  return <>{children}</>;
}
