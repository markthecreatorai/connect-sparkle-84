import { useState, useEffect, useMemo } from "react";
import { getSiteUrl } from "@/lib/site-url";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  User,
  Users2,
  CheckSquare,
  Shield,
  RotateCw,
  Award,
  Crown,
  Diamond,
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  Share2,
  ArrowDown,
  ArrowUp,
  Star,
  Gift,
  Settings,
  Inbox,
  Copy,
  Check,
  ChevronRight,
  X,
  TrendingUp,
  Zap,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const VIP_META: Record<number, { icon: typeof Shield; color: string; label: string }> = {
  0: { icon: Shield, color: "#6B7280", label: "VIP 0" },
  1: { icon: Award, color: "#B45309", label: "VIP 1" },
  2: { icon: Award, color: "#6B7280", label: "VIP 2" },
  3: { icon: Crown, color: "#D97706", label: "VIP 3" },
  4: { icon: Diamond, color: "#1E3A8A", label: "VIP 4" },
};

const TX_ICON: Record<string, { icon: typeof ArrowDown; color: string }> = {
  deposit: { icon: ArrowDown, color: "text-[hsl(var(--success))]" },
  withdrawal: { icon: ArrowUp, color: "text-[hsl(var(--destructive))]" },
  commission: { icon: Star, color: "text-primary" },
  bonus: { icon: Gift, color: "text-primary" },
  adjustment: { icon: Settings, color: "text-muted-foreground" },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "badge-warning" },
  approved: { label: "Aprovado", cls: "badge-success" },
  rejected: { label: "Recusado", cls: "badge-destructive" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};

// ─── types ──────────────────────────────────────────────────────

interface NetworkCounts { n1: number; n2: number; n3: number }
interface VipReqs { [k: string]: number }
interface VipLevelRow {
  level_code: string;
  display_name: string;
  deposit_required: number;
  daily_tasks: number;
  reward_per_task: number;
  daily_income: number;
  monthly_income: number;
  sort_order: number;
  is_available: boolean;
}

// ─── component ──────────────────────────────────────────────────

const Dashboard = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [wallets, setWallets] = useState<{ recharge: number; personal: number; income: number }>({
    recharge: 0,
    personal: 0,
    income: 0,
  });
  const [network, setNetwork] = useState<NetworkCounts>({ n1: 0, n2: 0, n3: 0 });
  const [vipReqs, setVipReqs] = useState<VipReqs>({});
  const [vipLevels, setVipLevels] = useState<VipLevelRow[]>([]);
  const [todayTasks, setTodayTasks] = useState<{ tasks_completed: number; tasks_required: number } | null>(null);
  const [checkinDone, setCheckinDone] = useState(false);
  const [checkinStreak, setCheckinStreak] = useState(0);
  const [spinDone, setSpinDone] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [spinLoading, setSpinLoading] = useState(false);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showVipLevels, setShowVipLevels] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const [txRes, walletsRes, n1Res, settingsRes, vipLevelsRes, taskTodayRes, gamificationRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("wallets")
          .select("wallet_type, balance")
          .eq("user_id", user.id),
        supabase
          .from("profiles")
          .select("id")
          .eq("referred_by", user.id),
        supabase
          .from("platform_settings")
          .select("key, value")
          .eq("key", "vip_requirements")
          .maybeSingle(),
        supabase
          .from("vip_levels" as never)
          .select("level_code, display_name, deposit_required, daily_tasks, reward_per_task, daily_income, monthly_income, sort_order, is_available")
          .order("sort_order", { ascending: true }),
        supabase
          .from("daily_tasks")
          .select("tasks_completed, tasks_required")
          .eq("user_id", user.id)
          .eq("task_date", todayIso)
          .maybeSingle(),
        supabase.functions.invoke("gamification", { body: { action: "status" } }),
      ]);

      setTransactions(txRes.data ?? []);
      const walletMap = { recharge: 0, personal: 0, income: 0 };
      (walletsRes.data ?? []).forEach((w: any) => {
        if (w.wallet_type in walletMap) {
          // @ts-ignore
          walletMap[w.wallet_type] = Number(w.balance ?? 0);
        }
      });
      setWallets(walletMap);
      if (settingsRes.data) setVipReqs((settingsRes.data.value as any) ?? {});
      setVipLevels(((vipLevelsRes.data as unknown as VipLevelRow[]) ?? []));
      setTodayTasks((taskTodayRes.data as { tasks_completed: number; tasks_required: number } | null) ?? null);

      const gData = gamificationRes.data;
      if (gData?.ok) {
        setCheckinDone(!!gData.checkin_done);
        setSpinDone(!!gData.spin_done);
        setCheckinStreak(gData.streak ?? 0);
      }

      const n1Ids = (n1Res.data ?? []).map((p) => p.id);
      let n2Ids: string[] = [];
      let n3Count = 0;

      if (n1Ids.length > 0) {
        const n2Res = await supabase
          .from("profiles")
          .select("id")
          .in("referred_by", n1Ids);
        n2Ids = (n2Res.data ?? []).map((p) => p.id);

        if (n2Ids.length > 0) {
          const n3Res = await supabase
            .from("profiles")
            .select("id")
            .in("referred_by", n2Ids);
          n3Count = (n3Res.data ?? []).length;
        }
      }

      setNetwork({ n1: n1Ids.length, n2: n2Ids.length, n3: n3Count });
      setLoading(false);
    };
    load();
  }, [user]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const vipLevel = profile?.vip_level ?? 0;
  const vip = VIP_META[vipLevel] ?? VIP_META[0];
  const VipIcon = vip.icon;
  const rechargeBalance = wallets.recharge ?? 0;
  const personalBalance = wallets.personal ?? 0;
  const incomeBalance = wallets.income ?? 0;
  const totalNetwork = network.n1 + network.n2 + network.n3;
  const nextVip = vipLevel < 9 ? vipLevel + 1 : null;
  const reqForNext = nextVip !== null ? (vipReqs[String(nextVip)] ?? 0) : 0;
  const codeForLevel = (lvl: number) => (lvl <= 0 ? "intern" : `vip${lvl}`);
  const currentVipConfig = vipLevels.find((v) => v.level_code === codeForLevel(vipLevel));
  const nextVipConfig = nextVip !== null ? vipLevels.find((v) => v.level_code === codeForLevel(nextVip)) : null;
  const initials = (profile?.full_name ?? "")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const inviteLink = `${getSiteUrl()}/register?ref=${profile?.referral_code ?? ""}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: "Convite AvengersPay", text: "Cadastre-se na AvengersPay e comece a ganhar!", url: inviteLink });
    } else {
      copyLink();
    }
  };

  const handleCheckin = async () => {
    setCheckinLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gamification", {
        body: { action: "checkin" },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Erro");
      setCheckinDone(true);
      setCheckinStreak(data.streak ?? checkinStreak + 1);
      toast.success(`Check-in feito! +R$0,50 · Streak: ${data.streak} dia(s) 🔥`);
      const { data: wRes } = await supabase.from("wallets").select("wallet_type,balance").eq("user_id", user!.id);
      const wMap = { recharge: 0, personal: 0, income: 0 };
      (wRes ?? []).forEach((w: any) => { if (w.wallet_type in wMap) (wMap as any)[w.wallet_type] = Number(w.balance ?? 0); });
      setWallets(wMap);
    } catch (e: any) {
      toast.error(e.message || "Erro no check-in");
    }
    setCheckinLoading(false);
  };

  const handleSpin = async () => {
    setSpinLoading(true);
    setSpinResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("gamification", {
        body: { action: "spin" },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Erro");
      await new Promise((r) => setTimeout(r, 2000));
      setSpinResult(data.prize);
      setSpinDone(true);
      if (data.prize > 0) {
        toast.success(`🎉 Parabéns! Você ganhou R$${Number(data.prize).toFixed(2)}!`);
        const { data: wRes } = await supabase.from("wallets").select("wallet_type,balance").eq("user_id", user!.id);
        const wMap = { recharge: 0, personal: 0, income: 0 };
        (wRes ?? []).forEach((w: any) => { if (w.wallet_type in wMap) (wMap as any)[w.wallet_type] = Number(w.balance ?? 0); });
        setWallets(wMap);
      } else {
        toast("Tente novamente amanhã! 🛡️");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro na roleta");
    }
    setSpinLoading(false);
  };

  // ─── render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-5xl mx-auto w-full min-w-0 overflow-x-hidden">
      {/* HERO HEADER */}
      <div className="gradient-hero rounded-2xl p-5 md:p-6 text-white relative overflow-hidden">
        <div className="pattern-dots absolute inset-0 opacity-40" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
            <span className="font-heading text-lg text-white">{loading ? "…" : initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            {loading ? (
              <Skeleton className="h-7 w-48 bg-white/10" />
            ) : (
              <h1 className="font-heading text-2xl md:text-3xl text-white">
                {greeting()}, {firstName}!
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1">
              {loading ? (
                <Skeleton className="h-5 w-24 bg-white/10" />
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 border border-white/20"
                >
                  <VipIcon className="h-3.5 w-3.5" />
                  {currentVipConfig?.display_name ?? vip.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3 CARTEIRAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <WalletCard
          icon={Wallet}
          label="Carteira de Recarga"
          sublabel="Depósitos e investimentos"
          value={rechargeBalance}
          loading={loading}
          accentClass="text-primary"
          borderClass="border-primary/15"
        />
        <WalletCard
          icon={User}
          label="Saldo Pessoal"
          sublabel="Tarefas, bônus e recompensas"
          value={personalBalance}
          loading={loading}
          accentClass="text-accent"
          borderClass="border-accent/15"
        />
        <WalletCard
          icon={Users2}
          label="Saldo de Renda"
          sublabel="Comissões da equipe"
          value={incomeBalance}
          loading={loading}
          accentClass="text-[hsl(var(--success))]"
          borderClass="border-[hsl(var(--success)/0.15)]"
        />
      </div>

      {/* VIP CARD */}
      <div className="card-premium p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Crown className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cargos e Salários</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Consulte o Guia D.V.G
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="text-xs h-8 font-medium" onClick={() => navigate("/vip")}>
            Ver níveis
          </Button>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-secondary/60 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Tarefas hoje</p>
                <p className="font-mono-value text-lg text-foreground mt-0.5">
                  {todayTasks?.tasks_completed ?? 0}/{todayTasks?.tasks_required ?? currentVipConfig?.daily_tasks ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-secondary/60 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Renda diária</p>
                <p className="font-mono-value text-lg text-foreground mt-0.5">
                  {fmtBRL(Number(currentVipConfig?.daily_income ?? 0))}
                </p>
              </div>
            </div>
            {nextVipConfig ? (
              <div className="space-y-1.5">
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full gradient-primary transition-all duration-500"
                    style={{ width: `${Math.min((network.n1 / (reqForNext || 1)) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{network.n1}/{reqForNext}</span> indicados para {nextVipConfig.display_name} · Rede total: <span className="font-semibold">{totalNetwork}</span>
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground font-medium">Nível máximo alcançado! 👑</p>
            )}
          </>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Button onClick={() => navigate("/deposit")} className="gradient-primary btn-glow text-primary-foreground gap-2 h-11">
          <ArrowDownCircle className="h-4 w-4" /> Depositar
        </Button>
        <Button onClick={() => navigate("/withdraw")} variant="outline" className="gap-2 h-11 font-medium">
          <ArrowUpCircle className="h-4 w-4" /> Sacar
        </Button>
        <Button onClick={() => navigate("/tasks")} variant="outline" className="gap-2 h-11 font-medium">
          <CheckSquare className="h-4 w-4" /> Tarefas
        </Button>
        <Button onClick={() => navigate("/team")} variant="outline" className="gap-2 h-11 font-medium">
          <Users className="h-4 w-4" /> Equipe
        </Button>
        <Button onClick={() => setShowInvite(true)} className="gradient-accent btn-accent-glow text-white gap-2 h-11 col-span-2 sm:col-span-1">
          <Share2 className="h-4 w-4" /> Convidar
        </Button>
      </div>

      {/* INVITE MODAL */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="bg-card relative z-10 w-full max-w-md rounded-2xl p-6 space-y-4 border border-border shadow-elevated">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl text-foreground">Convidar Amigos</h2>
              <button onClick={() => setShowInvite(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">Compartilhe seu link e ganhe comissões sobre cada indicado.</p>
            <div className="rounded-lg bg-secondary p-3 text-sm font-mono break-all text-muted-foreground border border-border">
              {inviteLink}
            </div>
            <div className="flex gap-3">
              <Button onClick={copyLink} className="flex-1 gap-2 h-10" variant={copied ? "default" : "outline"}>
                {copied ? <><Check className="h-4 w-4" /> Copiado!</> : <><Copy className="h-4 w-4" /> Copiar</>}
              </Button>
              <Button onClick={shareLink} className="flex-1 gradient-primary btn-glow text-primary-foreground gap-2 h-10">
                <Share2 className="h-4 w-4" /> Compartilhar
              </Button>
            </div>
          </div>
        </div>
      )}

      {showVipLevels && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowVipLevels(false)} />
          <div className="bg-card relative z-10 w-full max-w-4xl rounded-2xl p-4 md:p-6 space-y-4 max-h-[85vh] overflow-auto styled-scrollbar border border-border shadow-elevated">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl text-foreground">Todos os Níveis VIP</h2>
              <button onClick={() => setShowVipLevels(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2.5 pr-3 font-semibold text-xs uppercase tracking-wider">Nível</th>
                    <th className="py-2.5 pr-3 font-semibold text-xs uppercase tracking-wider">Depósito</th>
                    <th className="py-2.5 pr-3 font-semibold text-xs uppercase tracking-wider">Tarefas/dia</th>
                    <th className="py-2.5 pr-3 font-semibold text-xs uppercase tracking-wider">R$/Tarefa</th>
                    <th className="py-2.5 pr-3 font-semibold text-xs uppercase tracking-wider">Renda Diária</th>
                    <th className="py-2.5 font-semibold text-xs uppercase tracking-wider">Renda Mensal</th>
                  </tr>
                </thead>
                <tbody>
                  {vipLevels.map((v) => {
                    const isCurrent = v.level_code === codeForLevel(vipLevel);
                    return (
                      <tr key={v.level_code} className={`border-b border-border/50 ${isCurrent ? "bg-primary/5" : ""}`}>
                        <td className="py-2.5 pr-3 font-semibold">
                          {v.display_name} {!v.is_available ? "🔒" : ""}
                        </td>
                        <td className="py-2.5 pr-3 font-mono-value">{fmtBRL(Number(v.deposit_required || 0))}</td>
                        <td className="py-2.5 pr-3">{v.daily_tasks}</td>
                        <td className="py-2.5 pr-3 font-mono-value">{fmtBRL(Number(v.reward_per_task || 0))}</td>
                        <td className="py-2.5 pr-3 font-mono-value">{fmtBRL(Number(v.daily_income || 0))}</td>
                        <td className="py-2.5 font-mono-value">{fmtBRL(Number(v.monthly_income || 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* GAMIFICAÇÃO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card-elevated p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Check-in Diário</p>
          </div>
          {checkinDone ? (
            <p className="text-sm text-[hsl(var(--success))] font-medium">✓ Check-in feito hoje! Volte amanhã</p>
          ) : (
            <Button onClick={handleCheckin} disabled={checkinLoading} className="gradient-primary btn-glow text-primary-foreground h-10">
              {checkinLoading ? <><RotateCw className="h-4 w-4 mr-2 animate-spin" /> Fazendo...</> : "Fazer Check-in ✓"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">🔥 Streak: <span className="font-semibold text-foreground">{checkinStreak}</span> dia(s) · +R$0,50/dia</p>
        </div>

        <div
          className="card-elevated p-4 space-y-3 cursor-pointer hover:shadow-card-hover transition-shadow"
          onClick={() => navigate("/spin")}
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-accent" />
            </div>
            <p className="text-sm font-semibold text-foreground">Girar o Escudo 🛡️</p>
          </div>
          <p className="text-xs text-muted-foreground">Prêmios de R$1 a R$100 · Disponível 1x por dia</p>
          <p className="text-xs text-accent font-semibold">Toque para jogar →</p>
        </div>
      </div>

      {/* TRANSACTIONS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl text-foreground">Últimas Movimentações</h2>
          {transactions.length > 0 && (
            <button onClick={() => navigate("/transactions")} className="text-xs text-accent font-semibold hover:underline flex items-center gap-1">
              Ver tudo <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="card-elevated p-8 text-center space-y-4">
            <Inbox className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-foreground">Nenhuma movimentação ainda</p>
              <p className="text-xs text-muted-foreground mt-1">Faça seu primeiro depósito para começar</p>
            </div>
            <Button onClick={() => navigate("/deposit")} className="gradient-primary btn-glow text-primary-foreground gap-2">
              <ArrowDownCircle className="h-4 w-4" /> Depositar Agora
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const meta = TX_ICON[tx.type] ?? TX_ICON.adjustment;
              const TxIcon = meta.icon;
              const status = STATUS_BADGE[tx.status] ?? STATUS_BADGE.pending;
              const isPositive = ["deposit", "commission", "bonus"].includes(tx.type);

              return (
                <div key={tx.id} className="card-elevated p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${meta.color} bg-secondary`}>
                    <TxIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">{tx.description || tx.type}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {tx.created_at
                        ? formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: ptBR })
                        : "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className={`font-mono-value text-sm font-bold ${isPositive ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>
                      {isPositive ? "+" : "-"}{fmtBRL(Math.abs(tx.amount))}
                    </p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status.cls}`}>{status.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Wallet Card Sub-component ──────────────────────────────────

const WalletCard = ({
  icon: Icon,
  label,
  sublabel,
  value,
  loading,
  accentClass,
  borderClass,
}: {
  icon: typeof Wallet;
  label: string;
  sublabel: string;
  value: number;
  loading: boolean;
  accentClass: string;
  borderClass: string;
}) => (
  <div className={`card-elevated p-4 space-y-2 border ${borderClass}`}>
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${accentClass}`} />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
    {loading ? (
      <Skeleton className="h-8 w-28" />
    ) : (
      <p className={`font-mono-value text-2xl font-bold ${accentClass}`}>{fmtBRL(value)}</p>
    )}
    <p className="text-[11px] text-muted-foreground">{sublabel}</p>
  </div>
);

export default Dashboard;