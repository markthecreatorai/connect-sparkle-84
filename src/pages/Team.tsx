import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  Shield,
  Award,
  Crown,
  Diamond,
  CheckCircle,
  XCircle,
  UserPlus,
  Network,
  TrendingUp,
  ChevronDown,
} from "lucide-react";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const VIP_META: Record<number, { icon: typeof Shield; color: string; label: string }> = {
  0: { icon: Shield, color: "#6B7280", label: "VIP 0" },
  1: { icon: Shield, color: "#6b7280", label: "VIP 1" },
  2: { icon: Award, color: "#3b82f6", label: "VIP 2" },
  3: { icon: Award, color: "#06b6d4", label: "VIP 3" },
  4: { icon: Crown, color: "#8b5cf6", label: "VIP 4" },
  5: { icon: Crown, color: "#ef4444", label: "VIP 5" },
  6: { icon: Diamond, color: "#f97316", label: "VIP 6" },
  7: { icon: Diamond, color: "#eab308", label: "VIP 7" },
  8: { icon: Diamond, color: "#f5c842", label: "VIP 8" },
  9: { icon: Diamond, color: "#ffffff", label: "VIP 9" },
};

interface Referral {
  id: string;
  full_name: string;
  created_at: string | null;
  vip_level: number | null;
  is_active: boolean | null;
  has_approved_deposit: boolean;
}

interface CommissionEntry {
  id: string;
  amount: number;
  level: number;
  created_at: string | null;
  source_user_id: string;
  source_name: string;
  vip_plan_name: string;
}

const maskName = (name: string): string => {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 2) return word;
      return word[0] + "**" + word[word.length - 1];
    })
    .join(" ");
};

const censorName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

const LEVEL_CONFIG = [
  { key: 1, label: "Nível A", sublabel: "Diretos", color: "#22c55e", icon: UserPlus },
  { key: 2, label: "Nível B", sublabel: "Indiretos", color: "#3b82f6", icon: Users },
  { key: 3, label: "Nível C", sublabel: "Rede", color: "#8b5cf6", icon: Network },
] as const;

const PAGE_SIZE = 20;

const Team = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [n1, setN1] = useState<Referral[]>([]);
  const [n2, setN2] = useState<Referral[]>([]);
  const [n3, setN3] = useState<Referral[]>([]);
  const [commSummary, setCommSummary] = useState<{ total: number; count: number }[]>([
    { total: 0, count: 0 },
    { total: 0, count: 0 },
    { total: 0, count: 0 },
  ]);
  const [commTotal, setCommTotal] = useState(0);
  const [history, setHistory] = useState<CommissionEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const fetchHistory = useCallback(
    async (pageNum: number) => {
      if (!user) return;
      setHistoryLoading(true);
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: comms } = await supabase
        .from("commissions")
        .select("id, amount, level, created_at, source_user_id, vip_plan_id")
        .eq("beneficiary_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (!comms || comms.length === 0) {
        setHasMore(false);
        setHistoryLoading(false);
        return;
      }

      // Fetch source user names
      const sourceIds = [...new Set(comms.map((c) => c.source_user_id))];
      const { data: sourceProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", sourceIds);
      const nameMap: Record<string, string> = {};
      (sourceProfiles ?? []).forEach((p) => (nameMap[p.id] = p.full_name));

      // Fetch vip plan names
      const planIds = [...new Set(comms.filter((c) => c.vip_plan_id).map((c) => c.vip_plan_id!))];
      let planMap: Record<string, string> = {};
      if (planIds.length > 0) {
        const { data: plans } = await supabase
          .from("vip_plans")
          .select("id, name")
          .in("id", planIds);
        (plans ?? []).forEach((p) => (planMap[p.id] = p.name));
      }

      const entries: CommissionEntry[] = comms.map((c) => ({
        id: c.id,
        amount: Number(c.amount),
        level: c.level,
        created_at: c.created_at,
        source_user_id: c.source_user_id,
        source_name: nameMap[c.source_user_id] ?? "Usuário",
        vip_plan_name: c.vip_plan_id ? planMap[c.vip_plan_id] ?? "VIP" : "VIP",
      }));

      setHistory((prev) => (pageNum === 0 ? entries : [...prev, ...entries]));
      setHasMore(comms.length === PAGE_SIZE);
      setHistoryLoading(false);
    },
    [user]
  );

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Fetch N1
      const { data: n1Raw } = await supabase
        .from("profiles")
        .select("id, full_name, created_at, vip_level, is_active")
        .eq("referred_by", user.id)
        .order("created_at", { ascending: false });

      const n1Data = n1Raw ?? [];
      const n1Ids = n1Data.map((p) => p.id);

      // Fetch N2
      let n2Data: typeof n1Data = [];
      let n2Ids: string[] = [];
      if (n1Ids.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, created_at, vip_level, is_active")
          .in("referred_by", n1Ids)
          .order("created_at", { ascending: false });
        n2Data = data ?? [];
        n2Ids = n2Data.map((p) => p.id);
      }

      // Fetch N3
      let n3Data: typeof n1Data = [];
      if (n2Ids.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, created_at, vip_level, is_active")
          .in("referred_by", n2Ids)
          .order("created_at", { ascending: false });
        n3Data = data ?? [];
      }

      // Check approved deposits
      const allIds = [...n1Ids, ...n2Ids, ...n3Data.map((p) => p.id)];
      let depositMap: Record<string, boolean> = {};
      if (allIds.length > 0) {
        const { data: deps } = await supabase
          .from("deposits")
          .select("user_id")
          .in("user_id", allIds)
          .eq("status", "approved");
        const approvedSet = new Set((deps ?? []).map((d) => d.user_id));
        allIds.forEach((id) => (depositMap[id] = approvedSet.has(id)));
      }

      const enrich = (arr: typeof n1Data): Referral[] =>
        arr.map((p) => ({ ...p, has_approved_deposit: !!depositMap[p.id] }));

      setN1(enrich(n1Data));
      setN2(enrich(n2Data));
      setN3(enrich(n3Data));

      // Fetch commission summary
      const { data: comms } = await supabase
        .from("commissions")
        .select("level, amount")
        .eq("beneficiary_id", user.id);

      const summary = [
        { total: 0, count: 0 },
        { total: 0, count: 0 },
        { total: 0, count: 0 },
      ];
      let total = 0;
      (comms ?? []).forEach((cm) => {
        const amt = Number(cm.amount);
        total += amt;
        const idx = cm.level - 1;
        if (idx >= 0 && idx < 3) {
          summary[idx].total += amt;
          summary[idx].count += 1;
        }
      });
      setCommSummary(summary);
      setCommTotal(total);
      setLoading(false);
    };
    load();
    fetchHistory(0);
  }, [user, fetchHistory]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchHistory(next);
  };

  const totalNetwork = n1.length + n2.length + n3.length;

  const ReferralCard = ({ r }: { r: Referral }) => {
    const vip = VIP_META[r.vip_level ?? 0] ?? VIP_META[0];
    const VipIcon = vip.icon;
    return (
      <div className="glass-card rounded-xl p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary-foreground">{getInitials(r.full_name)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{censorName(r.full_name)}</p>
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ color: vip.color, background: `${vip.color}20` }}
            >
              <VipIcon className="h-2.5 w-2.5" />
              {vip.label}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {r.has_approved_deposit ? (
            <CheckCircle className="h-4 w-4 text-success" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground" />
          )}
          <span
            className={`h-2 w-2 rounded-full ${r.is_active ? "bg-success" : "bg-muted-foreground"}`}
          />
        </div>
      </div>
    );
  };

  const EmptyTab = () => (
    <div className="glass-card rounded-xl p-8 text-center space-y-2">
      <UserPlus className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Nenhum indicado neste nível. Compartilhe seu link para crescer sua rede!
      </p>
    </div>
  );

  const TabContent = ({ data }: { data: Referral[] }) =>
    data.length === 0 ? (
      <EmptyTab />
    ) : (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">{data.length} indicado{data.length !== 1 ? "s" : ""}</p>
        {data.map((r) => (
          <ReferralCard key={r.id} r={r} />
        ))}
      </div>
    );

  const getLevelBadge = (level: number) => {
    const cfg = LEVEL_CONFIG[level - 1];
    if (!cfg) return null;
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ color: cfg.color, background: `${cfg.color}18` }}
      >
        {String.fromCharCode(64 + level)}
      </span>
    );
  };

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-3xl mx-auto">
      <h1 className="font-heading text-xl font-bold">Minha Equipe</h1>

      {/* COMMISSION SUMMARY CARDS */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {LEVEL_CONFIG.map((cfg, i) => {
            const Icon = cfg.icon;
            return (
              <div
                key={cfg.key}
                className="rounded-xl p-4 space-y-1"
                style={{
                  background: `${cfg.color}08`,
                  border: `1px solid ${cfg.color}20`,
                }}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                  <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>
                <p className="font-mono text-lg font-bold" style={{ color: cfg.color }}>
                  {fmtBRL(commSummary[i].total)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {commSummary[i].count} comiss{commSummary[i].count !== 1 ? "ões" : "ão"} · {cfg.sublabel}
                </p>
              </div>
            );
          })}
          {/* Total card */}
          <div
            className="rounded-xl p-4 space-y-1"
            style={{
              background: "linear-gradient(135deg, #eab30810, #f9731610)",
              border: "1px solid #eab30830",
            }}
          >
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-yellow-500" />
              <span className="text-xs font-semibold text-yellow-500">Total</span>
            </div>
            <p className="font-mono text-lg font-bold text-yellow-500">
              {fmtBRL(commTotal)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Todas as comissões
            </p>
          </div>
        </div>
      )}

      {/* NETWORK SUMMARY */}
      {!loading && (
        <div className="grid grid-cols-4 gap-2">
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="font-heading text-xl font-bold text-foreground">{totalNetwork}</p>
            <p className="text-[9px] text-muted-foreground">Total</p>
          </div>
          {[
            { count: n1.length, label: "N1", color: "#22c55e" },
            { count: n2.length, label: "N2", color: "#3b82f6" },
            { count: n3.length, label: "N3", color: "#8b5cf6" },
          ].map((item) => (
            <div key={item.label} className="glass-card rounded-xl p-3 text-center">
              <p className="font-heading text-xl font-bold" style={{ color: item.color }}>
                {item.count}
              </p>
              <p className="text-[9px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* COMMISSION HISTORY */}
      {!loading && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Histórico de Comissões</h2>
          {history.length === 0 ? (
            <div className="glass-card rounded-xl p-6 text-center">
              <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma comissão recebida ainda.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {history.map((entry) => (
                  <div key={entry.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: `${LEVEL_CONFIG[entry.level - 1]?.color ?? "#666"}15`,
                      }}
                    >
                      <span
                        className="text-xs font-bold"
                        style={{ color: LEVEL_CONFIG[entry.level - 1]?.color ?? "#666" }}
                      >
                        {String.fromCharCode(64 + entry.level)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {maskName(entry.source_name)}
                        </p>
                        {getLevelBadge(entry.level)}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {entry.vip_plan_name} ·{" "}
                        {entry.created_at
                          ? format(new Date(entry.created_at), "dd/MM · HH:mm", { locale: ptBR })
                          : "—"}
                      </p>
                    </div>
                    <p
                      className="font-mono text-sm font-bold shrink-0"
                      style={{ color: LEVEL_CONFIG[entry.level - 1]?.color ?? "#22c55e" }}
                    >
                      +{fmtBRL(entry.amount)}
                    </p>
                  </div>
                ))}
              </div>
              {hasMore && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={loadMore}
                  disabled={historyLoading}
                >
                  <ChevronDown className="h-4 w-4 mr-1.5" />
                  {historyLoading ? "Carregando..." : "Ver mais"}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* REFERRAL TABS */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <Tabs defaultValue="n1">
          <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start gap-0 p-0">
            {["n1", "n2", "n3"].map((tab, i) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm"
              >
                Nível {i + 1}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="n1" className="mt-4">
            <TabContent data={n1} />
          </TabsContent>
          <TabsContent value="n2" className="mt-4">
            <TabContent data={n2} />
          </TabsContent>
          <TabsContent value="n3" className="mt-4">
            <TabContent data={n3} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Team;
