import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownCircle,
  Check,
  Copy,
  Loader2,
  Inbox,
} from "lucide-react";

// ─── currency helpers ───────────────────────────────────────────

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

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-warning/20 text-warning" },
  approved: { label: "Aprovado", cls: "bg-success/20 text-success" },
  rejected: { label: "Rejeitado", cls: "bg-destructive/20 text-destructive" },
};

// ─── component ──────────────────────────────────────────────────

const Deposit = () => {
  const { user, refreshProfile } = useAuth();

  const [rawValue, setRawValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [minDeposit, setMinDeposit] = useState(10);
  const [pixKey, setPixKey] = useState<{ key: string; type: string } | null>(null);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const amount = parseCurrency(rawValue);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [minRes, pixRes, depRes] = await Promise.all([
        supabase.from("platform_settings").select("value").eq("key", "min_deposit").maybeSingle(),
        supabase.from("platform_settings").select("value").eq("key", "platform_pix_key").maybeSingle(),
        supabase.from("deposits").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (minRes.data) setMinDeposit((minRes.data.value as any)?.amount ?? 10);
      if (pixRes.data) setPixKey(pixRes.data.value as any);
      setDeposits(depRes.data ?? []);
      setPageLoading(false);
    };
    load();
  }, [user]);

  const handleSubmit = async () => {
    if (amount < minDeposit) {
      toast.error(`Valor mínimo: ${fmtBRL(minDeposit)}`);
      return;
    }
    if (!user) return;
    setLoading(true);

    const { data: dep, error: depErr } = await supabase
      .from("deposits")
      .insert({ user_id: user.id, amount, status: "pending" })
      .select()
      .single();

    if (depErr || !dep) {
      toast.error(depErr?.message ?? "Erro ao criar depósito");
      setLoading(false);
      return;
    }

    await supabase.from("transactions").insert({
      user_id: user.id,
      type: "deposit",
      amount,
      status: "pending",
      reference_id: dep.id,
      description: "Depósito solicitado",
    });

    toast.success("Depósito solicitado com sucesso!");
    setSuccess(true);
    setDeposits((prev) => [dep, ...prev]);
    setLoading(false);
    refreshProfile();
  };

  const copyPix = async () => {
    if (!pixKey) return;
    await navigator.clipboard.writeText(pixKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setSuccess(false);
    setRawValue("");
  };

  // ─── render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-3xl mx-auto">
      {/* FORM / SUCCESS */}
      {success ? (
        <div className="glass-card rounded-2xl p-6 space-y-5 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-success/20 flex items-center justify-center">
            <Check className="h-7 w-7 text-success" />
          </div>
          <h2 className="font-heading text-xl font-bold">Depósito solicitado com sucesso!</h2>
          <p className="text-sm text-muted-foreground">Realize o pagamento via PIX para a chave abaixo:</p>

          {pixKey && (
            <div className="space-y-3">
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-xs text-muted-foreground mb-1 uppercase">{pixKey.type}</p>
                <p className="font-mono text-lg font-bold text-foreground break-all">{pixKey.key}</p>
              </div>
              <Button onClick={copyPix} variant="outline" className="gap-2">
                {copied ? <><Check className="h-4 w-4" /> Copiado!</> : <><Copy className="h-4 w-4" /> Copiar Chave PIX</>}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">Após o pagamento, aguarde a confirmação do administrador.</p>
          <Button onClick={resetForm} variant="outline" className="w-full">Fazer outro depósito</Button>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
              <ArrowDownCircle className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold">Solicitar Depósito</h1>
              <p className="text-xs text-muted-foreground">Mínimo: {fmtBRL(minDeposit)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor do depósito</Label>
            <Input
              id="amount"
              value={rawValue ? fmtInput(rawValue) : ""}
              onChange={(e) => setRawValue(e.target.value.replace(/\D/g, ""))}
              placeholder="R$ 0,00"
              className="bg-secondary border-border font-mono text-lg h-12"
            />
            {rawValue && amount < minDeposit && (
              <p className="text-xs text-destructive">Valor mínimo: {fmtBRL(minDeposit)}</p>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || amount < minDeposit || !rawValue}
            className="w-full gradient-primary btn-glow text-primary-foreground h-12"
          >
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</> : "Solicitar Depósito"}
          </Button>
        </div>
      )}

      {/* DEPOSITS LIST */}
      <div className="space-y-3">
        <h2 className="font-heading text-lg font-bold">Meus Depósitos</h2>
        {pageLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : deposits.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <Inbox className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum depósito realizado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {deposits.map((d) => {
              const s = STATUS[d.status] ?? STATUS.pending;
              return (
                <div key={d.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold text-foreground">{fmtBRL(d.amount)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                    </p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Deposit;
