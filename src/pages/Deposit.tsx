import { useEffect, useRef, useState } from "react";
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
import { ArrowDownCircle, Check, Copy, Loader2, QrCode, Wallet } from "lucide-react";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseCurrency = (v: string): number => {
  const digits = v.replace(/\D/g, "");
  return parseInt(digits || "0", 10) / 100;
};

const fmtInput = (v: string): string => {
  const num = parseCurrency(v);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};



interface PixPayment {
  qr_code: string;
  qr_code_base64: string;
  ticket_url: string;
  deposit_id: string;
  expires_at?: string;
}

const Deposit = () => {
  const { user, profile, refreshProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  
  const [wallets, setWallets] = useState({ recharge: 0, personal: 0, income: 0 });
  const [deposits, setDeposits] = useState<any[]>([]);

  const [copied, setCopied] = useState(false);
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null);

  const [rawDeposit, setRawDeposit] = useState("");
  const [minDeposit, setMinDeposit] = useState(50);

  

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling: check deposit status every 5s when PIX is active
  useEffect(() => {
    if (!pixPayment?.deposit_id || !user) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const checkStatus = async () => {
      const { data } = await supabase
        .from("deposits")
        .select("status")
        .eq("id", pixPayment.deposit_id)
        .single();

      if (data?.status === "approved") {
        toast.success("✅ Pagamento confirmado! Seu saldo foi atualizado.");
        setPixPayment(null);
        refreshProfile();

        // Reload deposits and wallets
        const [depRes, walletRes] = await Promise.all([
          supabase.from("deposits").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
          supabase.from("wallets").select("wallet_type,balance").eq("user_id", user.id),
        ]);
        setDeposits(depRes.data ?? []);
        const wm = { recharge: 0, personal: 0, income: 0 };
        (walletRes.data ?? []).forEach((w: any) => {
          if (w.wallet_type in wm) (wm as any)[w.wallet_type] = Number(w.balance ?? 0);
        });
        setWallets(wm);
      } else if (data?.status === "rejected") {
        toast.error("Pagamento rejeitado.");
        setPixPayment(null);
        const { data: deps } = await supabase.from("deposits").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        setDeposits(deps ?? []);
      }
    };

    pollingRef.current = setInterval(checkStatus, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pixPayment?.deposit_id, user]);


  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      const [walletRes, depRes, confRes] = await Promise.all([
        supabase.from("wallets").select("wallet_type,balance").eq("user_id", user.id),
        supabase.from("deposits").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase
          .from("platform_settings")
          .select("key,value")
          .in("key", ["min_deposit"]),
      ]);

      

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
      if (cfg.min_deposit?.amount) setMinDeposit(Number(cfg.min_deposit.amount));

      setLoading(false);
    };

    load();
  }, [user]);

  const amount = parseCurrency(rawDeposit);

  const generatePix = async (pixAmount: number, description: string, depositType: string, vipLevelCode?: string) => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const res = await supabase.functions.invoke("mercadopago-pix", {
        body: {
          amount: pixAmount,
          description,
          deposit_type: depositType,
          vip_level_code: vipLevelCode,
        },
      });

      if (res.error) throw new Error(res.error.message || "Erro ao gerar PIX");

      const data = res.data;
      if (!data?.ok) throw new Error(data?.error || "Erro ao gerar cobrança");

      setPixPayment({
        qr_code: data.qr_code,
        qr_code_base64: data.qr_code_base64,
        ticket_url: data.ticket_url,
        deposit_id: data.deposit_id,
        expires_at: data.expires_at,
      });

      toast.success("PIX gerado! Escaneie o QR Code ou copie o código.");

      // Reload deposits
      if (user) {
        const { data: deps } = await supabase.from("deposits").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        setDeposits(deps ?? []);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar PIX");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNormalDeposit = async () => {
    if (!user) return;
    if (amount < minDeposit) {
      toast.error(`Depósito mínimo: ${fmtBRL(minDeposit)}`);
      return;
    }
    await generatePix(amount, "Depósito para carteira de recarga", "balance");
    setRawDeposit("");
  };


  const copyPixCode = async () => {
    if (!pixPayment?.qr_code) return;
    await navigator.clipboard.writeText(pixPayment.qr_code);
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

      {/* PIX Payment QR Code */}
      {pixPayment && (
        <Card className="p-5 space-y-4 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-lg font-bold">Pagamento PIX Gerado</h2>
          </div>

          {pixPayment.qr_code_base64 && (
            <div className="flex justify-center">
              <img
                src={`data:image/png;base64,${pixPayment.qr_code_base64}`}
                alt="QR Code PIX"
                className="w-56 h-56 rounded-lg border border-border"
              />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Código PIX (Copia e Cola):</p>
            <div className="bg-secondary rounded-lg p-3 break-all font-mono text-xs max-h-24 overflow-y-auto">
              {pixPayment.qr_code}
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={copyPixCode}>
              {copied ? <><Check className="h-4 w-4 mr-1" /> Copiado!</> : <><Copy className="h-4 w-4 mr-1" /> Copiar código PIX</>}
            </Button>
          </div>

          {pixPayment.ticket_url && (
            <a href={pixPayment.ticket_url} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="outline" size="sm" className="w-full">
                Abrir página de pagamento
              </Button>
            </a>
          )}

          <p className="text-xs text-muted-foreground text-center">
            ✅ O pagamento será confirmado automaticamente após a transferência PIX.
          </p>

          <Button variant="ghost" size="sm" className="w-full" onClick={() => setPixPayment(null)}>
            Fechar
          </Button>
        </Card>
      )}

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
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando PIX...</> : "Gerar PIX para depósito"}
          </Button>
      </Card>

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
                <span className={`text-xs px-2 py-1 rounded-full ${
                  d.status === "approved" ? "bg-success/20 text-success" :
                  d.status === "rejected" ? "bg-destructive/20 text-destructive" :
                  "bg-warning/20 text-warning"
                }`}>
                  {d.status === "approved" ? "Aprovado" : d.status === "rejected" ? "Rejeitado" : "Pendente"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Deposit;
