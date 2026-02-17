import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
} from "lucide-react";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const VIP_META: Record<number, { icon: typeof Shield; color: string; label: string }> = {
  0: { icon: Shield, color: "#6B7280", label: "VIP 0" },
  1: { icon: Award, color: "#CD7F32", label: "VIP 1" },
  2: { icon: Award, color: "#C0C0C0", label: "VIP 2" },
  3: { icon: Crown, color: "#FFD700", label: "VIP 3" },
  4: { icon: Diamond, color: "#A855F7", label: "VIP 4" },
};

interface Referral {
  id: string;
  full_name: string;
  created_at: string | null;
  vip_level: number | null;
  is_active: boolean | null;
  has_approved_deposit: boolean;
}

const censorName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

const Team = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [n1, setN1] = useState<Referral[]>([]);
  const [n2, setN2] = useState<Referral[]>([]);
  const [n3, setN3] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState({ total: 0, n1: 0, n2: 0, n3: 0 });

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

      // Check approved deposits for all referrals
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

      // Fetch commissions
      const { data: comms } = await supabase
        .from("commissions")
        .select("level, amount")
        .eq("beneficiary_id", user.id);

      const c = { total: 0, n1: 0, n2: 0, n3: 0 };
      (comms ?? []).forEach((cm) => {
        c.total += Number(cm.amount);
        if (cm.level === 1) c.n1 += Number(cm.amount);
        else if (cm.level === 2) c.n2 += Number(cm.amount);
        else if (cm.level === 3) c.n3 += Number(cm.amount);
      });
      setCommissions(c);
      setLoading(false);
    };
    load();
  }, [user]);

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

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-3xl mx-auto">
      <h1 className="font-heading text-xl font-bold">Minha Equipe</h1>

      {/* SUMMARY CARDS */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="glass-card rounded-xl p-4 text-center">
            <Users className="mx-auto h-5 w-5 text-primary mb-1" />
            <p className="font-heading text-2xl font-bold">{totalNetwork}</p>
            <p className="text-[10px] text-muted-foreground">Total da Rede</p>
          </div>
          {[
            { label: "Nível 1", count: n1.length, color: "text-success" },
            { label: "Nível 2", count: n2.length, color: "text-warning" },
            { label: "Nível 3", count: n3.length, color: "text-primary" },
          ].map((item) => (
            <div key={item.label} className="glass-card rounded-xl p-4 text-center">
              <p className={`font-heading text-2xl font-bold ${item.color}`}>{item.count}</p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* COMMISSIONS */}
      {loading ? (
        <Skeleton className="h-20 rounded-xl" />
      ) : (
        <div className="glass-card rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total de comissões recebidas</p>
          <p className="font-mono text-xl font-bold text-success">{fmtBRL(commissions.total)}</p>
          <p className="text-[10px] text-muted-foreground">
            N1: {fmtBRL(commissions.n1)} · N2: {fmtBRL(commissions.n2)} · N3: {fmtBRL(commissions.n3)}
          </p>
        </div>
      )}

      {/* TABS */}
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
