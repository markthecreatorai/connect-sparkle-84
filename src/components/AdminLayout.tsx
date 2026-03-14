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
  BarChart3,
  Video,
} from "lucide-react";

const adminNav = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/users", icon: Users, label: "Usuários" },
  { to: "/admin/deposits", icon: ArrowDownCircle, label: "Depósitos" },
  { to: "/admin/withdrawals", icon: ArrowUpCircle, label: "Saques" },
  { to: "/admin/settings", icon: Settings, label: "Configurações" },
  { to: "/admin/vip-levels", icon: Crown, label: "Níveis VIP" },
  { to: "/admin/reports", icon: BarChart3, label: "Relatórios" },
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
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
      isActive(path)
        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    );

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="h-10 w-10 rounded-xl gradient-accent flex items-center justify-center shadow-sm">
          <span className="font-heading text-base text-white">A</span>
        </div>
        <div>
          <span className="font-heading text-lg text-white tracking-wide">ADMIN</span>
          <p className="text-[10px] text-sidebar-muted uppercase tracking-wider">Painel de Controle</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto styled-scrollbar">
        <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-muted">
          Gestão
        </p>
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
        <div className="my-3 border-t border-sidebar-border" />
        <button
          onClick={() => { navigate("/dashboard"); onNav?.(); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar ao App</span>
        </button>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={() => { signOut(); onNav?.(); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
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
      <aside className="hidden lg:flex w-[260px] flex-col gradient-navy fixed inset-y-0 left-0 z-30 border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between gradient-navy px-4 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg gradient-accent flex items-center justify-center">
            <span className="font-heading text-xs text-white">A</span>
          </div>
          <span className="font-heading text-sm text-white tracking-wide">ADMIN</span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-white/80 p-1.5 rounded-lg hover:bg-white/10">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative z-50 w-72 gradient-navy flex flex-col h-full shadow-2xl">
            <SidebarContent onNav={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 lg:ml-[260px] min-w-0 overflow-x-hidden">
        <div className="pt-14 lg:pt-0 min-h-screen bg-background w-full min-w-0">{children}</div>
      </main>
    </div>
  );
};