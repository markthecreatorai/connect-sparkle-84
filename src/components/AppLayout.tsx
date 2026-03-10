import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  ArrowDownToLine,
  Users,
  ArrowUpFromLine,
  UserCircle,
  Shield,
  Link2,
  History,
  CheckSquare,
  TrendingUp,
  BookOpen,
  Crown,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import avengersLogo from "@/assets/avengers-logo.svg";
import { cn } from "@/lib/utils";

const userNavItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { to: "/deposit", icon: ArrowDownToLine, label: "Depositar" },
  { to: "/team", icon: Users, label: "Equipe" },
  { to: "/withdraw", icon: ArrowUpFromLine, label: "Sacar" },
  { to: "/profile", icon: UserCircle, label: "Perfil" },
];

const sidebarExtraItems = [
  { to: "/tasks", icon: CheckSquare, label: "Tarefas" },
  { to: "/vip", icon: Crown, label: "Planos VIP" },
  { to: "/spin", icon: Shield, label: "Girar Escudo" },
  { to: "/investments", icon: TrendingUp, label: "Investimentos" },
  { to: "/transactions", icon: History, label: "Transações" },
  { to: "/invite", icon: Link2, label: "Convite" },
  { to: "/guide", icon: BookOpen, label: "Como Funciona" },
];

const adminItems = [
  { to: "/admin", icon: Shield, label: "Admin" },
];

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { isAdmin, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/dashboard" && location.pathname.startsWith(path + "/"));

  const linkClasses = (path: string) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
      isActive(path)
        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar — Dark Navy */}
      <aside className="hidden lg:flex w-[260px] flex-col gradient-navy fixed inset-y-0 left-0 z-30 border-r border-sidebar-border">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="h-10 w-10 rounded-xl bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center">
            <img src={avengersLogo} alt="AvengersPay" className="h-7 w-7 brightness-0 invert" />
          </div>
          <div>
            <span className="font-heading text-lg text-white tracking-wide">AVENGERS</span>
            <span className="font-heading text-lg text-sidebar-primary tracking-wide">PAY</span>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto styled-scrollbar">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-muted">
            Menu Principal
          </p>
          {userNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClasses(item.to)}>
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className="my-3 border-t border-sidebar-border" />
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-muted">
            Recursos
          </p>
          {sidebarExtraItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClasses(item.to)}>
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="my-3 border-t border-sidebar-border" />
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-muted">
                Administração
              </p>
              {adminItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClasses(item.to)}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between gradient-navy px-4 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center">
            <img src={avengersLogo} alt="AvengersPay" className="h-5 w-5 brightness-0 invert" />
          </div>
          <div>
            <span className="font-heading text-sm text-white tracking-wide">AVENGERS</span>
            <span className="font-heading text-sm text-sidebar-primary tracking-wide">PAY</span>
          </div>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white/80 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile Slide Menu */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex justify-end">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 w-72 gradient-navy flex flex-col h-full shadow-2xl">
            <div className="p-5 border-b border-sidebar-border">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center">
                  <img src={avengersLogo} alt="AvengersPay" className="h-5 w-5 brightness-0 invert" />
                </div>
                <span className="font-heading text-base text-white tracking-wide">Menu</span>
              </div>
            </div>
            <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto styled-scrollbar">
              {[...userNavItems, ...sidebarExtraItems].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={linkClasses(item.to)}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              {isAdmin && (
                <>
                  <div className="my-3 border-t border-sidebar-border" />
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-muted">Admin</p>
                  {adminItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={linkClasses(item.to)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </>
              )}
            </nav>
            <div className="border-t border-sidebar-border p-3">
              <button
                onClick={() => { signOut(); setSidebarOpen(false); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-[260px] min-w-0 overflow-x-hidden">
        <div className="pt-14 pb-20 lg:pt-0 lg:pb-0 min-h-screen bg-background w-full min-w-0">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around gradient-navy shadow-[0_-2px_10px_rgba(0,0,0,0.15)]">
        {userNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors duration-200 py-1",
              isActive(item.to) ? "text-sidebar-primary" : "text-white/50"
            )}
          >
            <item.icon className={cn("h-5 w-5", isActive(item.to) && "drop-shadow-sm")} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};