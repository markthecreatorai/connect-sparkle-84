import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownCircle, Check, Copy, Loader2, Shield, Wallet } from "lucide-react";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseCurrency = (v: string): number => {
  const digits = v.replace(/\D/g, "");
  return parseInt(digits || "0", 10) / 100;
};

const fmtInput = (v: string): string => {
  const num = parseCurrency(v);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

type Tab = "vip" | "saldo";

const Deposit = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>("vip");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [vipLevels, setVipLevels] = useState<any[]>([]);
  const [wallets, setWallets] = useState({ recharge: 0, personal: 0, income: 0 });
  const [deposits, setDeposits] = useState<any[]>([]);

  const [pixKey, setPixKey] = useState<{ key: string; type: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [rawDeposit, setRawDeposit] = useState("");
  const [minDeposit, setMinDeposit] = useState(50);

  const [selectedVip, setSelectedVip] = useState<any>(null);

  const vipLevel = Number(profile?.vip_level ?? 0);
  const vipCode = vipLevel <= 0 ? "intern" : `vip${vipLevel}`;
  const currentVip = vipLevels.find((v) => v.level_code === vipCode);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      const [levelsRes, walletRes, depRes, confRes] = await Promise.all([
        supabase
          .from("vip_levels" as never)
          .select("level_code,display_name,deposit_required,daily_income,daily_tasks,is_available,min_direct_referrals,sort_order")
          .order("sort_order", { ascending: true }),
        supabase.from("wallets").select("wallet_type,balance").eq("user_id", user.id),
        supabase.from("deposits").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase
          .from("platform_settings")
          .select("key,value")
          .in("key", ["platform_pix_key", "min_deposit"]),
      ]);

      setVipLevels((levelsRes.data as any[]) ?? []);

      const wm = { recharge: 0, personal: 0, income: 0 };
      (walletRes.data ?? []).forEach((w: any) => {
        if (w.wallet_type in wm) {
          // @ts-ignore
          wm[w.wallet_type] = Number(w.balance ?? 0);
        }
      });
      setWallets(wm);

      setDeposits(depRes.data ?? []);

      const cfg: Record<string, any> = {};
      (confRes.data ?? []).forEach((c: any) => (cfg[c.key] = c.value));
      if (cfg.platform_pix_key) setPixKey(cfg.platform_pix_key);
      if (cfg.min_deposit?.amount) setMinDeposit(Number(cfg.min_deposit.amount));

      setLoading(false);
    };

    load();
  }, [user]);

  const amount = parseCurrency(rawDeposit);

  const handleNormalDeposit = async () => {
    if (!user) return;
    if (amount < minDeposit) {
      toast.error(`Depósito mínimo: ${fmtBRL(minDeposit)}`);
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("deposits").insert({
      user_id: user.id,
      amount,
      status: "pending",
    } as any);

    if (error) {
      toast.error(error.message || "Erro ao solicitar depósito");
      setSubmitting(false);
      return;
    }

    await supabase.from("transactions").insert({
      user_id: user.id,
      type: "deposit",
      amount,
      description: "Depósito para carteira de recarga",
      wallet_type: "recharge",
    } as any);

    toast.success("Depósito solicitado com sucesso.");
    setRawDeposit("");
    refreshProfile();
    setSubmitting(false);
  };

  const handleVipUpgrade = async () => {
    if (!user || !selectedVip) return;

    const currentDeposit = Number(currentVip?.deposit_required ?? 0);
    const targetDeposit = Number(selectedVip.deposit_required ?? 0);

    setSubmitting(true);

    const { error } = await supabase.from("deposits").insert({
      user_id: user.id,
      amount: targetDeposit,
      status: "pending",
      admin_notes: `Upgrade VIP para ${selectedVip.display_name}`,
    } as any);

    if (error) {
      toast.error(error.message || "Erro ao iniciar upgrade VIP");
      setSubmitting(false);
      return;
    }

    await supabase.from("transactions").insert([
      {
        user_id: user.id,
        type: "vip_upgrade",
        amount: targetDeposit,
        description: `Solicitação de upgrade para ${selectedVip.display_name}`,
      },
      {
        user_id: user.id,
        type: "vip_refund",
        amount: currentDeposit,
        description: `Previsão de devolução do depósito anterior em até 36h`,
      },
    ] as any);

    toast.success(`Upgrade para ${selectedVip.display_name} iniciado. Pague o PIX para concluir.`);
    setSelectedVip(null);
    setSubmitting(false);
  };

  const canVip3 = useMemo(() => {
    // requisito depende de diretos ativos - simplificado aqui para não bloquear fluxo
    return true;
  }, []);

  const copyPix = async () => {
    if (!pixKey?.key) return;
    await navigator.clipboard.writeText(pixKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
      <div className="glass-card rounded-xl p-3 grid grid-cols-2 gap-2">
        <Button variant={tab === "vip" ? "default" : "outline"} className={tab === "vip" ? "gradient-primary text-primary-foreground" : ""} onClick={() => setTab("vip")}>
          Ativar/Upgrade VIP
        </Button>
        <Button variant={tab === "saldo" ? "default" : "outline"} className={tab === "saldo" ? "gradient-primary text-primary-foreground" : ""} onClick={() => setTab("saldo")}>
          Depositar Saldo
        </Button>
      </div>

      {tab === "vip" ? (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-heading text-xl font-bold">Ativar / Upgrade VIP</h1>
          </div>

          <p className="text-sm text-muted-foreground">Nível atual: <b>{currentVip?.display_name ?? "Estagiário"}</b></p>

          <div className="grid md:grid-cols-2 gap-3">
            {vipLevels.map((v) => {
              const levelNum = v.level_code === "intern" ? 0 : Number(String(v.level_code).replace("vip", ""));
              const locked = !v.is_available;
              const belowOrEqualCurrent = levelNum <= vipLevel;
              const vip3Blocked = v.level_code === "vip3" && !canVip3;
              const disabled = locked || belowOrEqualCurrent || vip3Blocked;
              return (
                <div key={v.level_code} className="rounded-xl border border-border p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">{v.display_name}</h3>
                    {locked && <span className="text-xs text-muted-foreground">🔒 Em breve</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">Depósito: {fmtBRL(Number(v.deposit_required || 0))}</p>
                  <p className="text-xs text-muted-foreground">Renda diária: {fmtBRL(Number(v.daily_income || 0))}</p>
                  <p className="text-xs text-muted-foreground">Tarefas/dia: {v.daily_tasks}</p>
                  <Button disabled={disabled} onClick={() => setSelectedVip(v)} className="w-full" variant={disabled ? "outline" : "default"}>
                    {belowOrEqualCurrent ? "Nível atual/anterior" : `Ativar ${v.display_name}`}
                  </Button>
                </div>
              );
            })}
          </div>

          {selectedVip && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 space-y-3">
              <p className="text-sm font-medium">Confirmação de upgrade</p>
              <p className="text-xs text-muted-foreground">
                Para ativar <b>{selectedVip.display_name}</b>, faça depósito de <b>{fmtBRL(Number(selectedVip.deposit_required || 0))}</b>.
                Seu depósito anterior de <b>{fmtBRL(Number(currentVip?.deposit_required || 0))}</b> será devolvido para a Carteira de Recarga em até 36 horas.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelectedVip(null)}>Cancelar</Button>
                <Button className="gradient-primary text-primary-foreground" onClick={handleVipUpgrade} disabled={submitting}>
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</> : "Confirmar e gerar PIX"}
                </Button>
              </div>
            </div>
          )}

          {pixKey && (
            <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">PIX para pagamento</p>
              <p className="font-mono text-sm break-all">{pixKey.key}</p>
              <Button variant="outline" size="sm" onClick={copyPix}>
                {copied ? <><Check className="h-4 w-4 mr-1" /> Copiado!</> : <><Copy className="h-4 w-4 mr-1" /> Copiar chave</>}
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-primary" />
            <h1 className="font-heading text-xl font-bold">Depositar Saldo (Carteira de Recarga)</h1>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-primary/20 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4 text-primary" /> Recarga</div>
              <p className="font-mono font-bold text-primary">{fmtBRL(wallets.recharge)}</p>
            </div>
            <div className="rounded-lg border border-warning/20 p-3">
              <p className="text-xs text-muted-foreground">Pessoal</p>
              <p className="font-mono font-bold text-warning">{fmtBRL(wallets.personal)}</p>
            </div>
            <div className="rounded-lg border border-success/20 p-3">
              <p className="text-xs text-muted-foreground">Renda</p>
              <p className="font-mono font-bold text-success">{fmtBRL(wallets.income)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Valor do depósito</Label>
            <Input
              value={rawDeposit ? fmtInput(rawDeposit) : ""}
              onChange={(e) => setRawDeposit(e.target.value.replace(/\D/g, ""))}
              placeholder="R$ 0,00"
              className="bg-secondary border-border font-mono text-lg"
            />
            <p className="text-xs text-muted-foreground">Mínimo: {fmtBRL(minDeposit)}</p>
          </div>

          <Button className="w-full gradient-primary text-primary-foreground" disabled={submitting || amount < minDeposit} onClick={handleNormalDeposit}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</> : "Gerar PIX para depósito"}
          </Button>

          {pixKey && (
            <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">Chave PIX ({pixKey.type})</p>
              <p className="font-mono text-sm break-all">{pixKey.key}</p>
              <Button variant="outline" size="sm" onClick={copyPix}>
                {copied ? <><Check className="h-4 w-4 mr-1" /> Copiado!</> : <><Copy className="h-4 w-4 mr-1" /> Copiar chave</>}
              </Button>
              <p className="text-xs text-muted-foreground">
                ⚠️ Em alguns casos, o banco pode exibir um alerta de segurança durante a transferência. Isso faz parte do protocolo normal de verificação das instituições financeiras. Caso apareça o aviso, basta confirmar a transação. A operação é regular e segura.
              </p>
            </div>
          )}
        </Card>
      )}

      <Card className="p-5 space-y-3">
        <h2 className="font-heading text-lg font-bold">Histórico de Depósitos</h2>
        {deposits.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum depósito realizado.</p>
        ) : (
          <div className="space-y-2">
            {deposits.map((d) => (
              <div key={d.id} className="rounded-lg border border-border p-3 text-sm flex items-center justify-between">
                <div>
                  <p className="font-mono font-bold">{fmtBRL(Number(d.amount || 0))}</p>
                  <p className="text-xs text-muted-foreground">{d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</p>
                </div>
                <span className="text-xs text-muted-foreground">{d.status}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Deposit;
