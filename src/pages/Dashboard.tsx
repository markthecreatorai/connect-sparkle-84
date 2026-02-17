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
  Lock,
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

// ─── component ──────────────────────────────────────────────────

const Dashboard = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [network, setNetwork] = useState<NetworkCounts>({ n1: 0, n2: 0, n3: 0 });
  const [vipReqs, setVipReqs] = useState<VipReqs>({});
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [txRes, n1Res, settingsRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("profiles")
          .select("id")
          .eq("referred_by", user.id),
        supabase
          .from("platform_settings")
          .select("key, value")
          .eq("key", "vip_requirements")
          .maybeSingle(),
      ]);

      setTransactions(txRes.data ?? []);
      if (settingsRes.data) setVipReqs((settingsRes.data.value as any) ?? {});

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
  const balance = profile?.balance ?? 0;
  const blockedBalance = profile?.blocked_balance ?? 0;
  const totalNetwork = network.n1 + network.n2 + network.n3;
  const nextVip = vipLevel < 4 ? vipLevel + 1 : null;
  const reqForNext = nextVip !== null ? (vipReqs[String(nextVip)] ?? 0) : 0;
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

      {/* CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Balance */}
        <div className="glass-card rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-accent" />
            <span className="text-xs text-muted-foreground">Saldo Disponível</span>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="font-mono text-[1.75rem] leading-tight font-bold text-accent-cyan">{fmtBRL(balance)}</p>
          )}
          <p className="text-[10px] text-muted-foreground">Disponível para saque</p>
        </div>

        {/* Blocked */}
        <div className="glass-card rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-warning" />
            <span className="text-xs text-muted-foreground">Saldo Bloqueado</span>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="font-mono text-[1.75rem] leading-tight font-bold text-warning">{fmtBRL(blockedBalance)}</p>
          )}
          <p className="text-[10px] text-muted-foreground">Em processamento</p>
        </div>

        {/* VIP */}
        <div className="glass-card rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <VipIcon className="h-4 w-4" style={{ color: vip.color }} />
            <span className="text-xs text-muted-foreground">Nível VIP</span>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <>
              <p className="font-heading text-2xl font-bold" style={{ color: vip.color }}>
                {vip.label}
              </p>
              {nextVip !== null ? (
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full gradient-primary transition-all duration-500"
                      style={{ width: `${Math.min((network.n1 / reqForNext) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {network.n1}/{reqForNext} indicados para VIP {nextVip}
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">Nível máximo! 👑</p>
              )}
            </>
          )}
        </div>

        {/* Network */}
        <div className="glass-card rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Minha Rede</span>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <>
              <p className="font-heading text-2xl font-bold text-foreground">{totalNetwork}</p>
              <p className="text-[10px] text-muted-foreground">
                N1: {network.n1} · N2: {network.n2} · N3: {network.n3}
              </p>
            </>
          )}
        </div>
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
