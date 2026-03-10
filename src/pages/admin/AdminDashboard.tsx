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
  Activity,
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

      const todayTotal = (commsToday.data ?? []).reduce((s, d) => s + Number(d.amount), 0);
      const monthTotal = (commsMonth.data ?? []).reduce((s, d) => s + Number(d.amount), 0);

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
    { label: "Total de Usuários", value: stats.totalUsers, icon: Users, accentClass: "text-primary", bgClass: "bg-primary/8" },
    { label: "Ativos (30d)", value: stats.activeUsers, icon: UserCheck, accentClass: "text-[hsl(var(--success))]", bgClass: "bg-[hsl(var(--success)/0.08)]" },
    { label: "Total Depositado", value: fmtBRL(stats.totalDeposited), icon: ArrowDownCircle, accentClass: "text-primary", bgClass: "bg-primary/8" },
    { label: "Total Sacado", value: fmtBRL(stats.totalWithdrawn), icon: ArrowUpCircle, accentClass: "text-accent", bgClass: "bg-accent/8" },
    { label: "Comissões Pagas", value: fmtBRL(stats.totalCommissions), icon: Award, accentClass: "text-[hsl(var(--warning))]", bgClass: "bg-[hsl(var(--warning)/0.08)]" },
    { label: "Saques Pendentes", value: fmtBRL(stats.pendingWithdrawals), icon: AlertTriangle, accentClass: "text-accent", bgClass: "bg-accent/8", highlight: true },
  ];

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="gradient-hero rounded-2xl p-5 md:p-6 text-white relative overflow-hidden">
        <div className="pattern-dots absolute inset-0 opacity-30" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-2xl md:text-3xl text-white">Painel Administrativo</h1>
            <p className="text-white/50 text-sm mt-0.5">Visão geral da plataforma AvengersPay</p>
          </div>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((c) => (
            <div key={c.label} className={`card-elevated p-4 space-y-3 ${c.highlight ? "border-accent/30" : ""}`}>
              <div className="flex items-center gap-2.5">
                <div className={`h-8 w-8 rounded-lg ${c.bgClass} flex items-center justify-center`}>
                  <c.icon className={`h-4 w-4 ${c.accentClass}`} />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
              </div>
              <p className={`font-heading text-xl ${c.highlight ? "text-accent" : "text-foreground"}`}>
                {c.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Commissions Section */}
      {!loading && (
        <div className="card-premium p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--warning)/0.1)] flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-[hsl(var(--warning))]" />
              </div>
              <h2 className="font-heading text-lg">Comissões VIP</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={exporting}
              className="text-xs h-8 font-medium"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {exporting ? "Exportando..." : "CSV do mês"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4 bg-secondary/50 border border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Hoje</p>
              <p className="font-mono-value text-xl font-bold text-[hsl(var(--warning))] mt-1">{fmtBRL(commStats.today)}</p>
            </div>
            <div className="rounded-xl p-4 bg-secondary/50 border border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Este Mês</p>
              <p className="font-mono-value text-xl font-bold text-[hsl(var(--warning))] mt-1">{fmtBRL(commStats.month)}</p>
            </div>
          </div>

          {commStats.topGenerators.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Geradores</p>
              <div className="space-y-2">
                {commStats.topGenerators.map((g, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5">
                    <span className="text-muted-foreground truncate">
                      <span className="text-foreground font-semibold mr-2">#{i + 1}</span>
                      {g.name}
                    </span>
                    <span className="font-mono-value font-bold text-[hsl(var(--warning))] shrink-0">{fmtBRL(g.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="card-premium p-5 space-y-4">
        <h2 className="font-heading text-lg">Novos Cadastros — Últimos 30 Dias</h2>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <XAxis dataKey="date" tick={{ fill: "hsl(215 14% 46%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 14% 46%)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(0 0% 100%)",
                  border: "1px solid hsl(214 18% 90%)",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
                }}
              />
              <Bar dataKey="count" fill="hsl(222 80% 28%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pending lists */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card-elevated p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base">Depósitos Pendentes</h2>
            <button onClick={() => navigate("/admin/deposits")} className="text-xs text-accent font-semibold hover:underline">Ver todos →</button>
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
          ) : pendingDeposits.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhum depósito pendente</p>
          ) : (
            <div className="space-y-2">
              {pendingDeposits.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground truncate">{(d.profiles as any)?.full_name ?? "—"}</span>
                  <span className="font-mono-value font-bold text-foreground">{fmtBRL(d.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-elevated p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base">Saques Pendentes</h2>
            <button onClick={() => navigate("/admin/withdrawals")} className="text-xs text-accent font-semibold hover:underline">Ver todos →</button>
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
          ) : pendingWithdrawals.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhum saque pendente</p>
          ) : (
            <div className="space-y-2">
              {pendingWithdrawals.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground truncate">{(w.profiles as any)?.full_name ?? "—"}</span>
                  <span className="font-mono-value font-bold text-foreground">{fmtBRL(w.amount)}</span>
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
