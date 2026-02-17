import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowUpCircle,
  Loader2,
  Inbox,
  Wallet,
  X,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────

const parseCurrency = (v: string): number => {
  const digits = v.replace(/\D/g, "");
  return parseInt(digits || "0", 10) / 100;
};

const fmtInput = (v: string): string => {
  const num = parseCurrency(v);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-warning/20 text-warning" },
  approved: { label: "Aprovado", cls: "bg-success/20 text-success" },
  rejected: { label: "Rejeitado", cls: "bg-destructive/20 text-destructive" },
};

const PIX_LABELS: Record<string, string> = {
  cpf: "CPF",
  email: "Email",
  phone: "Telefone",
  random: "Aleatória",
};

// ─── component ──────────────────────────────────────────────────

const Withdraw = () => {
  const { user, profile, refreshProfile } = useAuth();

  const [rawValue, setRawValue] = useState("");
  const [pixKeyType, setPixKeyType] = useState(profile?.pix_key_type ?? "");
  const [pixKeyValue, setPixKeyValue] = useState(profile?.pix_key ?? "");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  const [minWithdraw, setMinWithdraw] = useState(20);
  const [maxWithdraw, setMaxWithdraw] = useState(5000);
  const [feePct, setFeePct] = useState(5);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  const amount = parseCurrency(rawValue);
  const balance = profile?.balance ?? 0;
  const fee = Math.round(amount * feePct) / 100;
  const netAmount = Math.round((amount - fee) * 100) / 100;

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [minRes, maxRes, feeRes, wdRes] = await Promise.all([
        supabase.from("platform_settings").select("value").eq("key", "min_withdrawal").maybeSingle(),
        supabase.from("platform_settings").select("value").eq("key", "max_withdrawal").maybeSingle(),
        supabase.from("platform_settings").select("value").eq("key", "withdrawal_fee").maybeSingle(),
        supabase.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (minRes.data) setMinWithdraw((minRes.data.value as any)?.amount ?? 20);
      if (maxRes.data) setMaxWithdraw((maxRes.data.value as any)?.amount ?? 5000);
      if (feeRes.data) setFeePct((feeRes.data.value as any)?.percent ?? 5);
      setWithdrawals(wdRes.data ?? []);
      setPageLoading(false);
    };
    load();
  }, [user]);

  // Pre-fill PIX from profile
  useEffect(() => {
    if (profile?.pix_key && !pixKeyValue) {
      setPixKeyValue(profile.pix_key);
      setPixKeyType(profile.pix_key_type ?? "");
    }
  }, [profile]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (rawValue && amount < minWithdraw) e.push(`Valor mínimo: ${fmtBRL(minWithdraw)}`);
    if (rawValue && amount > maxWithdraw) e.push(`Valor máximo: ${fmtBRL(maxWithdraw)}`);
    if (rawValue && amount > balance) e.push("Saldo insuficiente");
    if (!pixKeyType) e.push("Selecione o tipo de chave PIX");
    if (!pixKeyValue.trim()) e.push("Informe a chave PIX");
    return e;
  }, [rawValue, amount, balance, minWithdraw, maxWithdraw, pixKeyType, pixKeyValue]);

  const isValid = rawValue && amount >= minWithdraw && amount <= maxWithdraw && amount <= balance && pixKeyType && pixKeyValue.trim();

  const handlePixKeyChange = (val: string) => {
    if (pixKeyType === "cpf") setPixKeyValue(maskCPF(val));
    else if (pixKeyType === "phone") setPixKeyValue(maskPhone(val));
    else setPixKeyValue(val);
  };

  const handleConfirm = async () => {
    if (!user || !isValid) return;
    setLoading(true);

    // Update balance
    const { error: balErr } = await supabase
      .from("profiles")
      .update({
        balance: balance - amount,
        blocked_balance: (profile?.blocked_balance ?? 0) + amount,
        pix_key: pixKeyValue.trim(),
        pix_key_type: pixKeyType,
      })
      .eq("id", user.id);

    if (balErr) {
      toast.error("Erro ao atualizar saldo");
      setLoading(false);
      return;
    }

    const { data: wd, error: wdErr } = await supabase
      .from("withdrawals")
      .insert({
        user_id: user.id,
        amount,
        fee,
        net_amount: netAmount,
        pix_key: pixKeyValue.trim(),
        pix_key_type: pixKeyType,
        status: "pending",
      })
      .select()
      .single();

    if (wdErr || !wd) {
      toast.error(wdErr?.message ?? "Erro ao criar saque");
      setLoading(false);
      return;
    }

    await supabase.from("transactions").insert({
      user_id: user.id,
      type: "withdrawal",
      amount: -amount,
      status: "pending",
      reference_id: wd.id,
      description: "Saque solicitado",
    });

    toast.success("Saque solicitado! Aguarde aprovação.");
    setWithdrawals((prev) => [wd, ...prev]);
    setRawValue("");
    setShowConfirm(false);
    setLoading(false);
    refreshProfile();
  };

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-3xl mx-auto">
      {/* BALANCE HEADER */}
      <div className="glass-card rounded-xl p-4 flex items-center gap-3">
        <Wallet className="h-5 w-5 text-accent" />
        <div>
          <p className="text-xs text-muted-foreground">Saldo disponível</p>
          <p className="font-mono text-2xl font-bold text-accent-cyan">{fmtBRL(balance)}</p>
        </div>
      </div>

      {/* FORM */}
      <div className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
            <ArrowUpCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-xl font-bold">Solicitar Saque</h1>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label>Valor do saque</Label>
          <Input
            value={rawValue ? fmtInput(rawValue) : ""}
            onChange={(e) => setRawValue(e.target.value.replace(/\D/g, ""))}
            placeholder="R$ 0,00"
            className="bg-secondary border-border font-mono text-lg h-12"
          />
          {rawValue && amount > 0 && (
            <div className="rounded-lg bg-secondary/50 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxa ({feePct}%)</span>
                <span className="font-mono text-warning">{fmtBRL(fee)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-muted-foreground">Você receberá</span>
                <span className="font-mono text-success">{fmtBRL(netAmount)}</span>
              </div>
            </div>
          )}
          {rawValue && amount < minWithdraw && (
            <p className="text-xs text-destructive">Valor mínimo: {fmtBRL(minWithdraw)}</p>
          )}
          {rawValue && amount > maxWithdraw && (
            <p className="text-xs text-destructive">Valor máximo: {fmtBRL(maxWithdraw)}</p>
          )}
          {rawValue && amount > balance && (
            <p className="text-xs text-destructive">Saldo insuficiente</p>
          )}
        </div>

        {/* PIX Type */}
        <div className="space-y-2">
          <Label>Tipo de chave PIX</Label>
          <Select value={pixKeyType} onValueChange={(v) => { setPixKeyType(v); setPixKeyValue(""); }}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Telefone</SelectItem>
              <SelectItem value="random">Aleatória</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* PIX Key */}
        {pixKeyType && (
          <div className="space-y-2">
            <Label>Chave PIX ({PIX_LABELS[pixKeyType]})</Label>
            <Input
              value={pixKeyValue}
              onChange={(e) => handlePixKeyChange(e.target.value)}
              placeholder={
                pixKeyType === "cpf" ? "000.000.000-00"
                : pixKeyType === "phone" ? "(11) 99999-9999"
                : pixKeyType === "email" ? "seu@email.com"
                : "Chave aleatória"
              }
              className="bg-secondary border-border font-mono"
            />
            {profile?.pix_key && profile.pix_key_type === pixKeyType && pixKeyValue !== profile.pix_key && (
              <button
                onClick={() => setPixKeyValue(profile.pix_key!)}
                className="text-xs text-primary hover:underline"
              >
                Usar chave salva: {profile.pix_key}
              </button>
            )}
          </div>
        )}

        <Button
          onClick={() => setShowConfirm(true)}
          disabled={!isValid}
          className="w-full gradient-primary btn-glow text-primary-foreground h-12"
        >
          Solicitar Saque
        </Button>
      </div>

      {/* CONFIRMATION MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" onClick={() => !loading && setShowConfirm(false)} />
          <div className="glass-card relative z-10 w-full max-w-md rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold">Confirmar Saque</h2>
              {!loading && (
                <button onClick={() => setShowConfirm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-mono font-bold">{fmtBRL(amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Taxa ({feePct}%)</span><span className="font-mono text-warning">{fmtBRL(fee)}</span></div>
              <div className="border-t border-border pt-2 flex justify-between font-bold"><span>Você receberá</span><span className="font-mono text-success">{fmtBRL(netAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Chave PIX</span><span className="font-mono text-xs break-all">{pixKeyValue}</span></div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={loading} className="flex-1">Cancelar</Button>
              <Button onClick={handleConfirm} disabled={loading} className="flex-1 gradient-primary btn-glow text-primary-foreground">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</> : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* WITHDRAWALS LIST */}
      <div className="space-y-3">
        <h2 className="font-heading text-lg font-bold">Meus Saques</h2>
        {pageLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <Inbox className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum saque realizado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((w) => {
              const s = STATUS[w.status] ?? STATUS.pending;
              return (
                <div key={w.id} className="glass-card rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-mono text-sm font-bold text-foreground">{fmtBRL(w.amount)}</p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground">
                    <span>Taxa: {fmtBRL(w.fee ?? 0)}</span>
                    <span>Líquido: <span className="text-success">{fmtBRL(w.net_amount)}</span></span>
                    <span>PIX: {w.pix_key}</span>
                    <span>{w.created_at ? format(new Date(w.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</span>
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

export default Withdraw;
