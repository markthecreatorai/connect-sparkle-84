import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, Wallet, User, Users2, Loader2, Clock, CheckCircle, ArrowDownCircle } from "lucide-react";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type WalletBalances = { recharge: number; personal: number; income: number };

const INVESTMENTS_ENABLED = false; // Toggle to true to re-enable

const Investments = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  if (!INVESTMENTS_ENABLED) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="p-8 max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="font-heading text-xl font-bold">Fundos de Investimentos A.V.G</h1>
            <p className="text-muted-foreground text-sm">Em Breve.</p>
          </div>
        </Card>
      </div>
    );
  }
  const [submitting, setSubmitting] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const [wallets, setWallets] = useState<WalletBalances>({ recharge: 0, personal: 0, income: 0 });
  const [plans, setPlans] = useState<Record<string, number>>({});
  const [investments, setInvestments] = useState<any[]>([]);

  const [amount, setAmount] = useState("");
  const [selectedDays, setSelectedDays] = useState<number | null>(null);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [walletRes, configRes, invRes] = await Promise.all([
      supabase.from("wallets").select("wallet_type,balance").eq("user_id", user.id),
      supabase.from("platform_config").select("value").eq("key", "investment_plans").single(),
      supabase.from("investments").select("*").eq("user_id", user.id).order("started_at", { ascending: false }),
    ]);

    const map: WalletBalances = { recharge: 0, personal: 0, income: 0 };
    (walletRes.data ?? []).forEach((w: any) => {
      if (w.wallet_type in map) (map as any)[w.wallet_type] = Number(w.balance || 0);
    });
    setWallets(map);

    if (configRes.data?.value) {
      setPlans(configRes.data.value as Record<string, number>);
    }

    setInvestments(invRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const totalAvailable = wallets.income + wallets.personal + wallets.recharge;
  const amountNum = Number(amount) || 0;
  const rate = selectedDays ? (plans[String(selectedDays)] ?? 0) : 0;
  const profit = Number((amountNum * rate / 100).toFixed(2));

  // Breakdown
  const fromIncome = Math.min(amountNum, wallets.income);
  const fromPersonal = Math.min(amountNum - fromIncome, wallets.personal);
  const fromRecharge = Math.min(amountNum - fromIncome - fromPersonal, wallets.recharge);

  const canSubmit = amountNum >= 50 && amountNum <= totalAvailable && selectedDays !== null;

  const handleCreate = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("manage-investment", {
        body: { action: "create", amount: amountNum, duration_days: selectedDays },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Erro desconhecido");
      toast.success("Investimento realizado com sucesso!");
      setAmount("");
      setSelectedDays(null);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao investir");
    }
    setSubmitting(false);
  };

  const handleRedeem = async (id: string) => {
    setRedeeming(id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-investment", {
        body: { action: "redeem", investment_id: id },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Erro desconhecido");
      toast.success(`Resgatado! Juros de ${fmtBRL(data.profit)} creditados na Carteira Pessoal.`);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao resgatar");
    }
    setRedeeming(null);
  };

  const activeInvestments = investments.filter((i) => i.status === "active" || i.status === "matured");
  const pastInvestments = investments.filter((i) => i.status === "returned");

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
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h1 className="font-heading text-xl font-bold">Investimentos</h1>
      </div>

      {/* Wallet Balances */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 border border-primary/20">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Wallet className="h-3 w-3 text-primary" /> Recarga</div>
          <p className="font-mono text-sm font-bold text-primary">{fmtBRL(wallets.recharge)}</p>
        </Card>
        <Card className="p-3 border border-warning/20">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><User className="h-3 w-3 text-warning" /> Pessoal</div>
          <p className="font-mono text-sm font-bold text-warning">{fmtBRL(wallets.personal)}</p>
        </Card>
        <Card className="p-3 border border-success/20">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Users2 className="h-3 w-3 text-success" /> Renda</div>
          <p className="font-mono text-sm font-bold text-success">{fmtBRL(wallets.income)}</p>
        </Card>
      </div>

      <Tabs defaultValue="new" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="new">Nova Aplicação</TabsTrigger>
          <TabsTrigger value="active">Ativos ({activeInvestments.length})</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <Card className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>Valor da aplicação (mínimo R$50)</Label>
              <Input
                type="number"
                min={50}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 200"
                className="bg-secondary border-border"
              />
              <p className="text-xs text-muted-foreground">Disponível: {fmtBRL(totalAvailable)}</p>
            </div>

            <div className="space-y-2">
              <Label>Período</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(plans).sort(([a], [b]) => Number(a) - Number(b)).map(([days, pct]) => (
                  <Button
                    key={days}
                    variant={selectedDays === Number(days) ? "default" : "outline"}
                    onClick={() => setSelectedDays(Number(days))}
                    className={selectedDays === Number(days) ? "gradient-primary text-primary-foreground" : ""}
                  >
                    {days} dias ({pct}%)
                  </Button>
                ))}
              </div>
            </div>

            {amountNum > 0 && selectedDays && (
              <div className="rounded-lg bg-secondary/50 p-4 space-y-2 text-sm">
                <p className="font-semibold">Resumo da aplicação</p>
                <div className="space-y-1 text-muted-foreground">
                  {fromIncome > 0 && <p>Renda: {fmtBRL(fromIncome)}</p>}
                  {fromPersonal > 0 && <p>Pessoal: {fmtBRL(fromPersonal)}</p>}
                  {fromRecharge > 0 && <p>Recarga: {fmtBRL(fromRecharge)}</p>}
                </div>
                <div className="border-t border-border pt-2">
                  <p>Total: <b>{fmtBRL(amountNum)}</b> × {rate}% = <b className="text-success">{fmtBRL(profit)}</b> de juros em {selectedDays} dias</p>
                  <p>Retorno total: <b className="text-primary">{fmtBRL(amountNum + profit)}</b></p>
                </div>
              </div>
            )}

            <Button onClick={handleCreate} disabled={!canSubmit || submitting} className="w-full gradient-primary text-primary-foreground">
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aplicando...</> : "Aplicar"}
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="active">
          {activeInvestments.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">Nenhum investimento ativo.</Card>
          ) : (
            <div className="space-y-3">
              {activeInvestments.map((inv) => {
                const matured = new Date(inv.matures_at) <= new Date();
                return (
                  <Card key={inv.id} className={`p-4 space-y-2 border ${matured ? "border-success/40" : "border-border"}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">{fmtBRL(Number(inv.total_amount))}</p>
                        <p className="text-xs text-muted-foreground">{inv.duration_days} dias a {inv.interest_rate}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-success">+{fmtBRL(Number(inv.profit_amount))}</p>
                        {matured ? (
                          <span className="text-xs text-success flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Vencido</span>
                        ) : (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(inv.matures_at), { locale: ptBR, addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    {matured && (
                      <Button
                        onClick={() => handleRedeem(inv.id)}
                        disabled={redeeming === inv.id}
                        className="w-full gradient-primary text-primary-foreground"
                        size="sm"
                      >
                        {redeeming === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowDownCircle className="h-4 w-4 mr-1" /> Resgatar</>}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {pastInvestments.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">Nenhum investimento resgatado.</Card>
          ) : (
            <div className="space-y-2">
              {pastInvestments.map((inv) => (
                <Card key={inv.id} className="p-3 text-sm">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{fmtBRL(Number(inv.total_amount))} · {inv.duration_days}d</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.returned_at ? format(new Date(inv.returned_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </p>
                    </div>
                    <p className="text-success font-medium">+{fmtBRL(Number(inv.profit_amount))}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Investments;
