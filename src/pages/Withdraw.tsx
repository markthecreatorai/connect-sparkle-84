import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpCircle, Loader2, Wallet, User, Users2, Clock3, AlertTriangle } from "lucide-react";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type WalletType = "recharge" | "personal" | "income";

const Withdraw = () => {
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [wallets, setWallets] = useState<Record<WalletType, number>>({
    recharge: 0,
    personal: 0,
    income: 0,
  });

  const [walletType, setWalletType] = useState<WalletType>("personal");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [pixType, setPixType] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [paymentPassword, setPaymentPassword] = useState("");

  const [withdrawalWindow, setWithdrawalWindow] = useState<{ start: string; end: string }>({ start: "11:00", end: "17:00" });
  const [presetAmounts, setPresetAmounts] = useState<number[]>([50, 150, 300, 500, 1000, 2000, 4000, 7000]);
  const [taxPercentage, setTaxPercentage] = useState(10);

  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      const [walletRes, confRes, wdRes] = await Promise.all([
        supabase.from("wallets").select("wallet_type,balance").eq("user_id", user.id),
        supabase.rpc("get_public_platform_config", { _keys: ["withdrawal_hours", "withdrawal_amounts", "tax_rate"] }),
        supabase.from("withdrawals").select("*").eq("user_id", user.id).order("requested_at", { ascending: false }),
      ]);

      const map: Record<WalletType, number> = { recharge: 0, personal: 0, income: 0 };
      (walletRes.data ?? []).forEach((w: any) => {
        const k = w.wallet_type as WalletType;
        if (k in map) map[k] = Number(w.balance || 0);
      });
      setWallets(map);

      const cfg: Record<string, any> = {};
      (confRes.data ?? []).forEach((c: any) => {
        cfg[c.key] = c.value;
      });

      if (cfg.withdrawal_hours?.start && cfg.withdrawal_hours?.end) {
        setWithdrawalWindow({ start: cfg.withdrawal_hours.start, end: cfg.withdrawal_hours.end });
      }
      if (Array.isArray(cfg.withdrawal_amounts) && cfg.withdrawal_amounts.length > 0) {
        setPresetAmounts(cfg.withdrawal_amounts.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n)));
      }
      if (cfg.tax_rate?.percentage !== undefined) {
        setTaxPercentage(Number(cfg.tax_rate.percentage || 10));
      }

      setWithdrawals(wdRes.data ?? []);

      setPixType((profile as any)?.pix_key_type || "");
      setPixKey((profile as any)?.pix_key || "");

      setLoading(false);
    };

    load();
  }, [user, profile]);

  const nowSP = new Date();
  const nowMinutes = nowSP.getHours() * 60 + nowSP.getMinutes();
  const [startH, startM] = withdrawalWindow.start.split(":").map(Number);
  const [endH, endM] = withdrawalWindow.end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const inWindow = nowMinutes >= startMinutes && nowMinutes <= endMinutes;

  const selectedWalletBalance = wallets[walletType] ?? 0;
  const amount = selectedAmount ?? 0;
  const tax = walletType === "recharge" ? 0 : Number(((amount * taxPercentage) / 100).toFixed(2));
  const netAmount = Number((amount - tax).toFixed(2));

  const [hasPaymentPassword, setHasPaymentPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.functions.invoke("payment-password", { body: { action: "check" } }).then(({ data }) => {
      if (data?.ok) setHasPaymentPassword(!!data.has_password);
    });
  }, [user]);

  const canSubmit =
    !!user &&
    inWindow &&
    amount > 0 &&
    amount <= selectedWalletBalance &&
    !!pixType &&
    !!pixKey.trim() &&
    !!paymentPassword.trim() &&
    hasPaymentPassword;

  const submitWithdraw = async () => {
    if (!user || !canSubmit) return;

    setSubmitting(true);

    // Verify payment password server-side
    try {
      const { data: pwData, error: pwErr } = await supabase.functions.invoke("payment-password", {
        body: { action: "verify", password: paymentPassword },
      });
      if (pwErr || !pwData?.ok) {
        toast.error("Erro ao verificar senha de pagamento");
        setSubmitting(false);
        return;
      }
      if (!pwData.valid) {
        toast.error("Senha de pagamento incorreta");
        setSubmitting(false);
        return;
      }
    } catch {
      toast.error("Erro ao verificar senha de pagamento");
      setSubmitting(false);
      return;
    }

    const { data, error } = await supabase.rpc("request_withdrawal" as any, {
      _user_id: user.id,
      _amount: amount,
      _tax_amount: tax,
      _net_amount: netAmount,
      _wallet_type: walletType,
      _pix_key: pixKey.trim(),
      _pix_key_type: pixType,
    });

    if (error) {
      toast.error(error.message || "Erro ao solicitar saque");
      setSubmitting(false);
      return;
    }

    const result = data as any;
    if (!result?.success) {
      toast.error(result?.error === 'insufficient_balance' ? 'Saldo insuficiente' : (result?.error || "Erro desconhecido"));
      setSubmitting(false);
      return;
    }

    toast.success("Saque solicitado com sucesso! Aguarde aprovação.");
    setSelectedAmount(null);
    setPaymentPassword("");

    const { data: wdRefresh } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false });
    setWithdrawals(wdRefresh ?? []);

    // Refresh wallets
    const { data: wRes } = await supabase.from("wallets").select("wallet_type,balance").eq("user_id", user.id);
    const map: Record<WalletType, number> = { recharge: 0, personal: 0, income: 0 };
    (wRes ?? []).forEach((w: any) => {
      const k = w.wallet_type as WalletType;
      if (k in map) map[k] = Number(w.balance || 0);
    });
    setWallets(map);

    setSubmitting(false);
  };

  const statusLabel = (s: string) => {
    if (s === "approved") return "Aprovado";
    if (s === "rejected") return "Rejeitado";
    if (s === "paid") return "Pago";
    return "Pendente";
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 border border-primary/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4 text-primary" /> Carteira de Recarga</div>
          <p className="font-mono text-xl font-bold text-primary mt-1">{fmtBRL(wallets.recharge)}</p>
        </Card>
        <Card className="p-4 border border-warning/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><User className="h-4 w-4 text-warning" /> Carteira Pessoal</div>
          <p className="font-mono text-xl font-bold text-warning mt-1">{fmtBRL(wallets.personal)}</p>
        </Card>
        <Card className="p-4 border border-success/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users2 className="h-4 w-4 text-success" /> Carteira de Renda</div>
          <p className="font-mono text-xl font-bold text-success mt-1">{fmtBRL(wallets.income)}</p>
        </Card>
      </div>

      {!inWindow && (
        <Card className="p-4 border border-warning/30 bg-warning/10">
          <div className="flex items-start gap-2 text-warning">
            <Clock3 className="h-4 w-4 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Fora do horário de saque</p>
              <p className="text-xs text-warning/90">⏰ Horário permitido: {withdrawalWindow.start} às {withdrawalWindow.end}</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ArrowUpCircle className="h-5 w-5 text-primary" />
          <h1 className="font-heading text-xl font-bold">Solicitar Saque</h1>
        </div>

        <div className="space-y-2">
          <Label>De qual carteira deseja sacar?</Label>
          <Select value={walletType} onValueChange={(v: WalletType) => setWalletType(v)}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Carteira Pessoal</SelectItem>
              <SelectItem value="income">Carteira de Renda</SelectItem>
              <SelectItem value="recharge">Carteira de Recarga</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Saldo disponível: {fmtBRL(selectedWalletBalance)}</p>
        </div>

        <div className="space-y-2">
          <Label>Quantia</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {presetAmounts.map((a) => {
              const disabled = a > selectedWalletBalance || !inWindow;
              const active = selectedAmount === a;
              return (
                <Button
                  key={a}
                  type="button"
                  variant={active ? "default" : "outline"}
                  disabled={disabled}
                  onClick={() => setSelectedAmount(a)}
                  className={active ? "gradient-primary text-primary-foreground" : ""}
                >
                  {fmtBRL(a)}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg bg-secondary/50 p-3 text-sm space-y-1">
          <p>Valor solicitado: <b>{fmtBRL(amount)}</b></p>
          <p>Taxa ({walletType === "recharge" ? 0 : taxPercentage}%): <b>{fmtBRL(tax)}</b></p>
          <p>Valor líquido: <b className="text-success">{fmtBRL(netAmount)}</b></p>
        </div>

        <div className="space-y-2">
          <Label>Tipo da chave PIX</Label>
          <Select value={pixType} onValueChange={setPixType}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="phone">Telefone</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="random">Aleatória</SelectItem>
            </SelectContent>
          </Select>
          <Label>Chave PIX</Label>
          <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} className="bg-secondary border-border" />
        </div>

        {!hasPaymentPassword && (
          <div className="rounded-lg p-3 border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>Você ainda não cadastrou senha de pagamento. Vá ao perfil para configurar antes de sacar.</span>
          </div>
        )}

        <div className="space-y-2">
          <Label>Senha de pagamento</Label>
          <Input
            type="password"
            value={paymentPassword}
            onChange={(e) => setPaymentPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6 dígitos"
            className="bg-secondary border-border"
          />
        </div>

        <Button onClick={submitWithdraw} disabled={!canSubmit || submitting} className="w-full gradient-primary text-primary-foreground">
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : "Solicitar Saque"}
        </Button>

        <p className="text-xs text-muted-foreground">
          ⚠️ Em alguns casos, o banco pode exibir um alerta de segurança durante a transferência. Isso faz parte do protocolo normal de verificação. A operação é regular e segura.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-heading text-lg font-bold">Histórico de Saques</h2>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum saque solicitado ainda.</p>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((w) => (
              <div key={w.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex justify-between items-center">
                  <b>{fmtBRL(Number(w.amount || 0))}</b>
                  <span className="text-xs text-muted-foreground">{statusLabel(w.status)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Líquido: {fmtBRL(Number(w.net_amount || 0))} · {w.requested_at ? format(new Date(w.requested_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Withdraw;
