import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, AdminRoute, PublicOnlyRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import {
  Deposit,
  Withdraw,
  Transactions,
  Team,
  Profile,
  Invite,
  AdminDashboard,
  AdminUsers,
  AdminDeposits,
  AdminWithdrawals,
  AdminSettings,
  AdminLogs,
} from "./pages/PlaceholderPages";

const queryClient = new QueryClient();

const UserPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const AdminPage = ({ children }: { children: React.ReactNode }) => (
  <AdminRoute>
    <AppLayout>{children}</AppLayout>
  </AdminRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* User */}
            <Route path="/dashboard" element={<UserPage><Dashboard /></UserPage>} />
            <Route path="/deposit" element={<UserPage><Deposit /></UserPage>} />
            <Route path="/withdraw" element={<UserPage><Withdraw /></UserPage>} />
            <Route path="/transactions" element={<UserPage><Transactions /></UserPage>} />
            <Route path="/team" element={<UserPage><Team /></UserPage>} />
            <Route path="/profile" element={<UserPage><Profile /></UserPage>} />
            <Route path="/invite" element={<UserPage><Invite /></UserPage>} />

            {/* Admin */}
            <Route path="/admin" element={<AdminPage><AdminDashboard /></AdminPage>} />
            <Route path="/admin/users" element={<AdminPage><AdminUsers /></AdminPage>} />
            <Route path="/admin/deposits" element={<AdminPage><AdminDeposits /></AdminPage>} />
            <Route path="/admin/withdrawals" element={<AdminPage><AdminWithdrawals /></AdminPage>} />
            <Route path="/admin/settings" element={<AdminPage><AdminSettings /></AdminPage>} />
            <Route path="/admin/logs" element={<AdminPage><AdminLogs /></AdminPage>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
