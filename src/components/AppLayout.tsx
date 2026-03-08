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
  Settings,
  FileText,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
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
  { to: "/investments", icon: TrendingUp, label: "Investimentos" },
  { to: "/transactions", icon: History, label: "Transações" },
  { to: "/invite", icon: Link2, label: "Convite" },
];

const adminItems = [
  { to: "/admin", icon: Shield, label: "Admin" },
  { to: "/admin/users", icon: Users, label: "Usuários" },
  { to: "/admin/deposits", icon: ArrowDownToLine, label: "Depósitos" },
  { to: "/admin/withdrawals", icon: ArrowUpFromLine, label: "Saques" },
  { to: "/admin/settings", icon: Settings, label: "Config" },
  { to: "/admin/logs", icon: FileText, label: "Logs" },
];

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { isAdmin, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/dashboard" && location.pathname.startsWith(path + "/"));

  const linkClasses = (path: string) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200",
      isActive(path)
        ? "gradient-primary text-primary-foreground font-medium"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    );

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-sidebar fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-2 px-5 py-6">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <span className="font-heading text-sm font-bold text-primary-foreground">P</span>
          </div>
          <span className="font-heading text-lg font-bold text-foreground">Plataforma</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
          <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Menu</p>
          {userNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClasses(item.to)}>
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
          {sidebarExtraItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClasses(item.to)}>
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="my-3 border-t border-border" />
              <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Admin</p>
              {adminItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClasses(item.to)}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center">
            <span className="font-heading text-xs font-bold text-primary-foreground">P</span>
          </div>
          <span className="font-heading text-base font-bold">Plataforma</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-foreground">
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile Slide Menu */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex justify-end">
          <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 w-64 bg-sidebar border-l border-border flex flex-col h-full">
            <div className="p-4 border-b border-border">
              <span className="font-heading text-lg font-bold">Menu</span>
            </div>
            <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
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
                  <div className="my-3 border-t border-border" />
                  <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Admin</p>
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
            <div className="border-t border-border p-3">
              <button
                onClick={() => { signOut(); setSidebarOpen(false); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-60">
        <div className="pt-14 pb-20 lg:pt-0 lg:pb-0 min-h-screen">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-border bg-background/80 backdrop-blur-xl">
        {userNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-0.5 text-[10px] transition-colors duration-200",
              isActive(item.to) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className={cn("h-5 w-5", isActive(item.to) && "drop-shadow-[0_0_6px_rgba(108,92,231,0.6)]")} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
