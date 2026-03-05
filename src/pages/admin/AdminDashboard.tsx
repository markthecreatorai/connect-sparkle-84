import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format, subDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  UserCheck,
  ArrowDownCircle,
  ArrowUpCircle,
  Award,
  AlertTriangle,
  Download,
  TrendingUp,
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

interface CommissionStats {
  today: number;
  month: number;
  topGenerators: { name: string; total: number }[];
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
  const [commStats, setCommStats] = useState<CommissionStats>({ today: 0, month: 0, topGenerators: [] });
  const [chartData, setChartData] = useState<{ date: string; count: number }[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const monthStart = startOfMonth(new Date()).toISOString();

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
        commsToday,
        commsMonth,
        commsAll,
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
        supabase.from("commissions").select("amount").gte("created_at", todayStart.toISOString()),
        supabase.from("commissions").select("amount").gte("created_at", monthStart),
        supabase.from("commissions").select("source_user_id, amount"),
      ]);

      setStats({
        totalUsers: usersRes.count ?? 0,
        activeUsers: activeRes.count ?? 0,
        totalDeposited: (depApproved.data ?? []).reduce((s, d) => s + Number(d.amount), 0),
        totalWithdrawn: (wdApproved.data ?? []).reduce((s, d) => s + Number(d.amount), 0),
        totalCommissions: (commsRes.data ?? []).reduce((s, d) => s + Number(d.amount), 0),
        pendingWithdrawals: (wdPending.data ?? []).reduce((s, d) => s + Number(d.amount), 0),
      });

      // Commission stats
      const todayTotal = (commsToday.data ?? []).reduce((s, d) => s + Number(d.amount), 0);
      const monthTotal = (commsMonth.data ?? []).reduce((s, d) => s + Number(d.amount), 0);

      // Top generators (by source_user_id)
      const genMap: Record<string, number> = {};
      (commsAll.data ?? []).forEach((c) => {
        genMap[c.source_user_id] = (genMap[c.source_user_id] || 0) + Number(c.amount);
      });
      const topIds = Object.entries(genMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      let topGenerators: { name: string; total: number }[] = [];
      if (topIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", topIds.map(([id]) => id));
        const nameMap: Record<string, string> = {};
        (profiles ?? []).forEach((p) => (nameMap[p.id] = p.full_name));
        topGenerators = topIds.map(([id, total]) => ({ name: nameMap[id] ?? "—", total }));
      }

      setCommStats({ today: todayTotal, month: monthTotal, topGenerators });

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

  const exportCSV = async () => {
    setExporting(true);
    const monthStart = startOfMonth(new Date()).toISOString();
    const { data } = await supabase
      .from("commissions")
      .select("id, beneficiary_id, source_user_id, amount, level, type, origin_payment_id, created_at")
      .gte("created_at", monthStart)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const headers = ["ID", "Beneficiário", "Origem", "Valor", "Nível", "Tipo", "Payment ID", "Data"];
      const rows = data.map((c) =>
        [c.id, c.beneficiary_id, c.source_user_id, c.amount, c.level, c.type, c.origin_payment_id ?? "", c.created_at ?? ""].join(",")
      );
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comissoes_${format(new Date(), "yyyy-MM")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  };

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

      {/* Commissions Section */}
      {!loading && (
        <div className="glass-card rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-warning" />
              <h2 className="font-heading text-sm font-bold">Comissões VIP</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={exporting}
              className="text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              {exporting ? "Exportando..." : "CSV do mês"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3 bg-secondary/50">
              <p className="text-[10px] text-muted-foreground uppercase">Hoje</p>
              <p className="font-mono text-lg font-bold text-warning">{fmtBRL(commStats.today)}</p>
            </div>
            <div className="rounded-lg p-3 bg-secondary/50">
              <p className="text-[10px] text-muted-foreground uppercase">Este mês</p>
              <p className="font-mono text-lg font-bold text-warning">{fmtBRL(commStats.month)}</p>
            </div>
          </div>

          {commStats.topGenerators.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Top geradores de comissão</p>
              <div className="space-y-1.5">
                {commStats.topGenerators.map((g, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate">
                      <span className="text-foreground font-medium mr-1.5">#{i + 1}</span>
                      {g.name}
                    </span>
                    <span className="font-mono font-bold text-warning shrink-0">{fmtBRL(g.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
