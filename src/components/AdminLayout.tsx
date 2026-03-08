import { ReactNode, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  Settings,
  Crown,
  FileText,
  ArrowLeft,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const adminNav = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/users", icon: Users, label: "Usuários" },
  { to: "/admin/deposits", icon: ArrowDownCircle, label: "Depósitos" },
  { to: "/admin/withdrawals", icon: ArrowUpCircle, label: "Saques" },
  { to: "/admin/settings", icon: Settings, label: "Configurações" },
  { to: "/admin/vip-levels", icon: Crown, label: "Níveis VIP" },
  { to: "/admin/reports", icon: FileText, label: "Relatórios" },
  { to: "/admin/logs", icon: FileText, label: "Logs" },
];

export const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    path === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(path);

  const linkCls = (path: string) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200",
      isActive(path)
        ? "gradient-primary text-primary-foreground font-medium"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    );

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      <div className="flex items-center gap-2 px-5 py-6">
        <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
          <span className="font-heading text-sm font-bold text-primary-foreground">A</span>
        </div>
        <span className="font-heading text-lg font-bold text-foreground">Admin</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
        {adminNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/admin"}
            onClick={onNav}
            className={linkCls(item.to)}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <div className="my-3 border-t border-border" />
        <button
          onClick={() => { navigate("/dashboard"); onNav?.(); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar ao App</span>
        </button>
      </nav>
      <div className="border-t border-border p-3">
        <button
          onClick={() => { signOut(); onNav?.(); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-sidebar fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center">
            <span className="font-heading text-xs font-bold text-primary-foreground">A</span>
          </div>
          <span className="font-heading text-base font-bold">Admin</span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-foreground">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative z-50 w-64 bg-background border-r border-border flex flex-col h-full shadow-xl">
            <SidebarContent onNav={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 lg:ml-60">
        <div className="pt-14 lg:pt-0 min-h-screen">{children}</div>
      </main>
    </div>
  );
};
