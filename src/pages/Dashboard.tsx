import { useState, useEffect, useMemo } from "react";
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
  Shield,
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
  1: { icon: Award, color: "#CD7F32", label: "VIP 1" },
  2: { icon: Award, color: "#C0C0C0", label: "VIP 2" },
  3: { icon: Crown, color: "#FFD700", label: "VIP 3" },
  4: { icon: Diamond, color: "#A855F7", label: "VIP 4" },
};

const TX_ICON: Record<string, { icon: typeof ArrowDown; color: string }> = {
  deposit: { icon: ArrowDown, color: "text-success" },
  withdrawal: { icon: ArrowUp, color: "text-destructive" },
  commission: { icon: Star, color: "text-primary" },
  bonus: { icon: Gift, color: "text-accent" },
  adjustment: { icon: Settings, color: "text-muted-foreground" },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-warning/20 text-warning" },
  approved: { label: "Aprovado", cls: "bg-success/20 text-success" },
  rejected: { label: "Recusado", cls: "bg-destructive/20 text-destructive" },
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
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showVipLevels, setShowVipLevels] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [txRes, walletsRes, n1Res, settingsRes, vipLevelsRes, taskTodayRes] = await Promise.all([
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
          .eq("task_date", new Date().toISOString().slice(0, 10))
          .maybeSingle(),
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

      // Network counts
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

  const inviteLink = `${window.location.origin}/register?ref=${profile?.referral_code ?? ""}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: "Convite", text: "Cadastre-se na plataforma!", url: inviteLink });
    } else {
      copyLink();
    }
  };

  // ─── render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center shrink-0">
          <span className="font-heading text-sm font-bold text-primary-foreground">{loading ? "…" : initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          {loading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <h1 className="font-heading text-xl font-bold truncate">
              {greeting()}, {firstName}!
            </h1>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            {loading ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${vipLevel === 4 ? "animate-pulse" : ""}`}
                style={{
                  color: vip.color,
                  background: `${vip.color}20`,
                }}
              >
                <VipIcon className="h-3 w-3" />
                {vip.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3 CARTEIRAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-4 space-y-2 border border-primary/20">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Carteira de Recarga</span>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="font-mono text-[1.75rem] leading-tight font-bold text-primary">{fmtBRL(rechargeBalance)}</p>
          )}
          <p className="text-[10px] text-muted-foreground">Depósitos e investimentos</p>
        </div>

        <div className="glass-card rounded-xl p-4 space-y-2 border border-warning/20">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-warning" />
            <span className="text-xs text-muted-foreground">Carteira Pessoal</span>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="font-mono text-[1.75rem] leading-tight font-bold text-warning">{fmtBRL(personalBalance)}</p>
          )}
          <p className="text-[10px] text-muted-foreground">Tarefas, bônus e recompensas</p>
        </div>

        <div className="glass-card rounded-xl p-4 space-y-2 border border-success/20">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-success" />
            <span className="text-xs text-muted-foreground">Carteira de Renda</span>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="font-mono text-[1.75rem] leading-tight font-bold text-success">{fmtBRL(incomeBalance)}</p>
          )}
          <p className="text-[10px] text-muted-foreground">Comissões da equipe</p>
        </div>
      </div>

      {/* CARD VIP */}
      <div className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VipIcon className="h-4 w-4" style={{ color: vip.color }} />
            <span className="text-xs text-muted-foreground">Nível VIP</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowVipLevels(true)}>
            Ver todos os níveis
          </Button>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <p className="font-heading text-2xl font-bold" style={{ color: vip.color }}>
              {currentVipConfig?.display_name ?? vip.label}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Tarefas hoje: {todayTasks?.tasks_completed ?? 0}/{todayTasks?.tasks_required ?? currentVipConfig?.daily_tasks ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Renda diária: {fmtBRL(Number(currentVipConfig?.daily_income ?? 0))}
            </p>
            {nextVipConfig ? (
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full gradient-primary transition-all duration-500"
                    style={{ width: `${Math.min((network.n1 / (reqForNext || 1)) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {network.n1}/{reqForNext} indicados para {nextVipConfig.display_name} · Rede total: {totalNetwork}
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">Nível máximo! 👑</p>
            )}
          </>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-none">
        <Button onClick={() => navigate("/deposit")} className="gradient-primary btn-glow text-primary-foreground shrink-0 gap-2">
          <ArrowDownCircle className="h-4 w-4" /> Depositar
        </Button>
        <Button onClick={() => navigate("/withdraw")} variant="outline" className="shrink-0 gap-2 border-border">
          <ArrowUpCircle className="h-4 w-4" /> Sacar
        </Button>
        <Button onClick={() => navigate("/team")} variant="outline" className="shrink-0 gap-2 border-border">
          <Users className="h-4 w-4" /> Minha Equipe
        </Button>
        <Button onClick={() => setShowInvite(true)} variant="outline" className="shrink-0 gap-2 border-border">
          <Share2 className="h-4 w-4" /> Convidar
        </Button>
      </div>

      {/* INVITE MODAL */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="glass-card relative z-10 w-full max-w-md rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold">Convidar Amigos</h2>
              <button onClick={() => setShowInvite(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="rounded-lg bg-secondary p-3 text-sm font-mono break-all text-muted-foreground">
              {inviteLink}
            </div>
            <div className="flex gap-3">
              <Button onClick={copyLink} className="flex-1 gap-2" variant={copied ? "default" : "outline"}>
                {copied ? <><Check className="h-4 w-4" /> Copiado!</> : <><Copy className="h-4 w-4" /> Copiar Link</>}
              </Button>
              <Button onClick={shareLink} className="flex-1 gradient-primary btn-glow text-primary-foreground gap-2">
                <Share2 className="h-4 w-4" /> Compartilhar
              </Button>
            </div>
          </div>
        </div>
      )}

      {showVipLevels && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setShowVipLevels(false)} />
          <div className="glass-card relative z-10 w-full max-w-4xl rounded-2xl p-4 md:p-6 space-y-4 max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold">Todos os níveis VIP</h2>
              <button onClick={() => setShowVipLevels(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Nível</th>
                    <th className="py-2 pr-3">Depósito</th>
                    <th className="py-2 pr-3">Tarefas/dia</th>
                    <th className="py-2 pr-3">Renda/Tarefa</th>
                    <th className="py-2 pr-3">Renda Diária</th>
                    <th className="py-2 pr-3">Renda Mensal</th>
                  </tr>
                </thead>
                <tbody>
                  {vipLevels.map((v) => {
                    const isCurrent = v.level_code === codeForLevel(vipLevel);
                    return (
                      <tr key={v.level_code} className={`border-b border-border/50 ${isCurrent ? "bg-primary/10" : ""}`}>
                        <td className="py-2 pr-3 font-medium">
                          {v.display_name} {!v.is_available ? "🔒 Em breve" : ""}
                        </td>
                        <td className="py-2 pr-3">{fmtBRL(Number(v.deposit_required || 0))}</td>
                        <td className="py-2 pr-3">{v.daily_tasks}</td>
                        <td className="py-2 pr-3">{fmtBRL(Number(v.reward_per_task || 0))}</td>
                        <td className="py-2 pr-3">{fmtBRL(Number(v.daily_income || 0))}</td>
                        <td className="py-2 pr-3">{fmtBRL(Number(v.monthly_income || 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTIONS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold">Últimas Movimentações</h2>
          {transactions.length > 0 && (
            <button onClick={() => navigate("/transactions")} className="text-xs text-primary hover:underline flex items-center gap-1">
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
          <div className="glass-card rounded-xl p-8 text-center space-y-3">
            <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda</p>
            <Button onClick={() => navigate("/deposit")} className="gradient-primary btn-glow text-primary-foreground gap-2">
              <ArrowDownCircle className="h-4 w-4" /> Fazer primeiro depósito
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
                <div key={tx.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color} bg-secondary`}>
                    <TxIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description || tx.type}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {tx.created_at
                        ? formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: ptBR })
                        : "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className={`font-mono text-sm font-bold ${isPositive ? "text-success" : "text-destructive"}`}>
                      {isPositive ? "+" : "-"}{fmtBRL(Math.abs(tx.amount))}
                    </p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
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

export default Dashboard;
