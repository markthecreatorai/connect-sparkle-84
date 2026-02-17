import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  UserCheck,
  ArrowDownCircle,
  ArrowUpCircle,
  Award,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalCommissions: number;
  pendingWithdrawals: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalCommissions: 0,
    pendingWithdrawals: 0,
  });
  const [chartData, setChartData] = useState<{ date: string; count: number }[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      const [
        usersRes,
        activeRes,
        depApproved,
        wdApproved,
        commsRes,
        wdPending,
        depPendingRes,
        wdPendingListRes,
        recentProfiles,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
        supabase.from("deposits").select("amount").eq("status", "approved"),
        supabase.from("withdrawals").select("amount").eq("status", "approved"),
        supabase.from("commissions").select("amount"),
        supabase.from("withdrawals").select("amount").eq("status", "pending"),
        supabase.from("deposits").select("id, amount, created_at, user_id, profiles(full_name)").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        supabase.from("withdrawals").select("id, amount, created_at, user_id, profiles(full_name)").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        supabase.from("profiles").select("created_at").gte("created_at", thirtyDaysAgo).order("created_at", { ascending: true }),
      ]);

      setStats({
        totalUsers: usersRes.count ?? 0,
        activeUsers: activeRes.count ?? 0,
        totalDeposited: (depApproved.data ?? []).reduce((s, d) => s + Number(d.amount), 0),
        totalWithdrawn: (wdApproved.data ?? []).reduce((s, d) => s + Number(d.amount), 0),
        totalCommissions: (commsRes.data ?? []).reduce((s, d) => s + Number(d.amount), 0),
        pendingWithdrawals: (wdPending.data ?? []).reduce((s, d) => s + Number(d.amount), 0),
      });

      setPendingDeposits(depPendingRes.data ?? []);
      setPendingWithdrawals(wdPendingListRes.data ?? []);

      // Build chart data
      const days: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "dd/MM");
        days[d] = 0;
      }
      (recentProfiles.data ?? []).forEach((p) => {
        if (p.created_at) {
          const d = format(new Date(p.created_at), "dd/MM");
          if (days[d] !== undefined) days[d]++;
        }
      });
      setChartData(Object.entries(days).map(([date, count]) => ({ date, count })));
      setLoading(false);
    };
    load();
  }, []);

  const cards = [
    { label: "Total de Usuários", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "Ativos (30 dias)", value: stats.activeUsers, icon: UserCheck, color: "text-success" },
    { label: "Total Depositado", value: fmtBRL(stats.totalDeposited), icon: ArrowDownCircle, color: "text-accent" },
    { label: "Total Sacado", value: fmtBRL(stats.totalWithdrawn), icon: ArrowUpCircle, color: "text-destructive" },
    { label: "Comissões Pagas", value: fmtBRL(stats.totalCommissions), icon: Award, color: "text-warning" },
    { label: "Saques Pendentes", value: fmtBRL(stats.pendingWithdrawals), icon: AlertTriangle, color: "text-warning", highlight: true },
  ];

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-6xl mx-auto">
      <h1 className="font-heading text-xl font-bold">Admin Dashboard</h1>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((c) => (
            <div key={c.label} className={`glass-card rounded-xl p-4 space-y-2 ${c.highlight ? "border-warning/30" : ""}`}>
              <div className="flex items-center gap-2">
                <c.icon className={`h-4 w-4 ${c.color}`} />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
              <p className={`font-heading text-xl font-bold ${c.highlight ? "text-warning" : "text-foreground"}`}>
                {c.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="glass-card rounded-xl p-4 space-y-3">
        <h2 className="font-heading text-sm font-bold">Novos cadastros (últimos 30 dias)</h2>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="date" tick={{ fill: "hsl(245 8% 57%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(245 8% 57%)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(240 20% 7%)", border: "1px solid hsl(0 0% 100% / 0.06)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(252 56% 65%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pending lists */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold">Depósitos Pendentes</h2>
            <button onClick={() => navigate("/admin/deposits")} className="text-xs text-primary hover:underline">Ver todos</button>
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
          ) : pendingDeposits.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum depósito pendente</p>
          ) : (
            <div className="space-y-2">
              {pendingDeposits.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate">{(d.profiles as any)?.full_name ?? "—"}</span>
                  <span className="font-mono font-bold text-foreground">{fmtBRL(d.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold">Saques Pendentes</h2>
            <button onClick={() => navigate("/admin/withdrawals")} className="text-xs text-primary hover:underline">Ver todos</button>
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
          ) : pendingWithdrawals.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum saque pendente</p>
          ) : (
            <div className="space-y-2">
              {pendingWithdrawals.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate">{(w.profiles as any)?.full_name ?? "—"}</span>
                  <span className="font-mono font-bold text-foreground">{fmtBRL(w.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
