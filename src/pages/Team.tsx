import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, UserPlus, Network, Crown, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Member = {
  user_id: string;
  full_name: string;
  vip_level: number | null;
  is_active: boolean | null;
  created_at: string | null;
};

type Position = {
  id: number;
  position_code: string;
  display_name: string;
  required_direct_referrals: number;
  required_total_team: number;
  monthly_salary: number;
  sort_order: number;
};

const Team = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);

  const [n1, setN1] = useState<Member[]>([]);
  const [n2, setN2] = useState<Member[]>([]);
  const [n3, setN3] = useState<Member[]>([]);

  const [commByLevel, setCommByLevel] = useState({ n1: 0, n2: 0, n3: 0, total: 0 });
  const [positions, setPositions] = useState<Position[]>([]);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      const [treeRes, profilesRes, txRes, posRes] = await Promise.all([
        supabase
          .from("referral_tree" as never)
          .select("user_id, level_a_referrer, level_b_referrer, level_c_referrer")
          .or(`level_a_referrer.eq.${user.id},level_b_referrer.eq.${user.id},level_c_referrer.eq.${user.id}`),
        supabase.from("profiles").select("id, full_name, vip_level, is_active, created_at"),
        supabase
          .from("transactions")
          .select("amount, metadata, type")
          .eq("user_id", user.id)
          .in("type", ["referral_deposit_commission", "referral_task_commission"]),
        supabase
          .from("team_positions" as never)
          .select("id, position_code, display_name, required_direct_referrals, required_total_team, monthly_salary, sort_order")
          .order("sort_order", { ascending: true }),
      ]);

      const tree = (treeRes.data as any[]) ?? [];
      const pMap = new Map<string, any>(((profilesRes.data as any[]) ?? []).map((p) => [p.id, p]));

      const mapMember = (id: string): Member => {
        const p = pMap.get(id);
        return {
          user_id: id,
          full_name: p?.full_name ?? "Usuário",
          vip_level: p?.vip_level ?? 0,
          is_active: p?.is_active ?? true,
          created_at: p?.created_at ?? null,
        };
      };

      const n1Ids = tree.filter((r) => r.level_a_referrer === user.id).map((r) => r.user_id);
      const n2Ids = tree.filter((r) => r.level_b_referrer === user.id).map((r) => r.user_id);
      const n3Ids = tree.filter((r) => r.level_c_referrer === user.id).map((r) => r.user_id);

      setN1([...new Set(n1Ids)].map(mapMember));
      setN2([...new Set(n2Ids)].map(mapMember));
      setN3([...new Set(n3Ids)].map(mapMember));

      let n1v = 0,
        n2v = 0,
        n3v = 0;
      ((txRes.data as any[]) ?? []).forEach((t) => {
        const amount = Number(t.amount || 0);
        const level = String(t?.metadata?.level || "").toUpperCase();
        if (level === "A") n1v += amount;
        else if (level === "B") n2v += amount;
        else if (level === "C") n3v += amount;
      });
      setCommByLevel({ n1: n1v, n2: n2v, n3: n3v, total: n1v + n2v + n3v });

      const pos = (posRes.data as Position[]) ?? [];
      setPositions(pos);

      const totalTeam = new Set([...n1Ids, ...n2Ids, ...n3Ids]).size;
      const direct = new Set(n1Ids).size;

      const qualified = pos.filter(
        (p) => direct >= Number(p.required_direct_referrals || 0) && totalTeam >= Number(p.required_total_team || 0)
      );
      setCurrentPosition(qualified.length ? qualified[qualified.length - 1] : null);

      setLoading(false);
    };

    load();
  }, [user]);

  const totalTeam = useMemo(() => new Set([...n1.map((m) => m.user_id), ...n2.map((m) => m.user_id), ...n3.map((m) => m.user_id)]).size, [n1, n2, n3]);

  const referralLink = useMemo(() => {
    const code = profile?.referral_code || "";
    return `${window.location.origin}/register?ref=${code}`;
  }, [profile?.referral_code]);

  const qrUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(referralLink)}`;
  }, [referralLink]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(profile?.referral_code || "");
    toast.success("Código copiado");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    toast.success("Link copiado");
  };

  const nativeShare = async () => {
    try {
      // @ts-ignore
      if (navigator.share) {
        // @ts-ignore
        await navigator.share({ title: "Meu convite", text: "Cadastre-se com meu código", url: referralLink });
      } else {
        await copyLink();
      }
    } catch {}
  };

  const MemberList = ({ rows }: { rows: Member[] }) => {
    if (!rows.length) {
      return (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum indicado neste nível. Compartilhe seu link para crescer sua rede!
        </Card>
      );
    }

    return (
      <div className="space-y-2">
        {rows.map((m) => (
          <Card key={m.user_id} className="p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{m.full_name}</p>
              <p className="text-xs text-muted-foreground">
                VIP {m.vip_level ?? 0} · {m.created_at ? format(new Date(m.created_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
              </p>
            </div>
            <span className={`text-xs ${m.is_active ? "text-success" : "text-muted-foreground"}`}>
              {m.is_active ? "Ativo" : "Inativo"}
            </span>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-4xl mx-auto">
      <h1 className="font-heading text-xl font-bold">Minha Equipe</h1>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold">{totalTeam}</p>
              <p className="text-xs text-muted-foreground">Total da Rede</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-success">{n1.length}</p>
              <p className="text-xs text-muted-foreground">Nível 1</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{n2.length}</p>
              <p className="text-xs text-muted-foreground">Nível 2</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-violet-500">{n3.length}</p>
              <p className="text-xs text-muted-foreground">Nível 3</p>
            </Card>
          </div>

          <Card className="p-4 space-y-1">
            <p className="text-sm font-semibold">Comissões Totais</p>
            <p className="text-2xl font-bold">{fmtBRL(commByLevel.total)}</p>
            <p className="text-xs text-muted-foreground">
              N1: {fmtBRL(commByLevel.n1)} · N2: {fmtBRL(commByLevel.n2)} · N3: {fmtBRL(commByLevel.n3)}
            </p>
          </Card>

          <Tabs defaultValue="n1">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="n1">Nível 1</TabsTrigger>
              <TabsTrigger value="n2">Nível 2</TabsTrigger>
              <TabsTrigger value="n3">Nível 3</TabsTrigger>
            </TabsList>
            <TabsContent value="n1" className="mt-3">
              <MemberList rows={n1} />
            </TabsContent>
            <TabsContent value="n2" className="mt-3">
              <MemberList rows={n2} />
            </TabsContent>
            <TabsContent value="n3" className="mt-3">
              <MemberList rows={n3} />
            </TabsContent>
          </Tabs>

          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-warning" />
              <p className="text-sm font-semibold">Cargo atual</p>
            </div>
            {currentPosition ? (
              <p className="text-sm">
                Seu cargo atual: <b>{currentPosition.display_name}</b> · Salário mensal: <b>{fmtBRL(Number(currentPosition.monthly_salary || 0))}</b>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Continue crescendo sua equipe para desbloquear cargos e salários!</p>
            )}

            <div className="space-y-1">
              {positions.map((p) => (
                <div key={p.id} className="text-xs text-muted-foreground flex justify-between border-b border-border/40 py-1">
                  <span>{p.display_name}</span>
                  <span>Diretos: {p.required_direct_referrals} · Total: {p.required_total_team} · {fmtBRL(Number(p.monthly_salary || 0))}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Convide sua equipe</p>
            </div>

            <div className="flex items-center gap-2">
              <code className="px-2 py-1 rounded bg-secondary text-sm">{profile?.referral_code || "—"}</code>
              <Button variant="outline" size="sm" onClick={copyCode}><Copy className="h-4 w-4 mr-1" /> Copiar código</Button>
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-start">
              <img src={qrUrl} alt="QR convite" className="h-[140px] w-[140px] rounded border border-border" />
              <div className="space-y-2">
                <p className="text-xs break-all text-muted-foreground">{referralLink}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyLink}>Copiar link</Button>
                  <Button size="sm" onClick={nativeShare}>Compartilhar</Button>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default Team;
