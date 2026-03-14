import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

const AdminSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);

  // Commission
  const [commN1, setCommN1] = useState("");
  const [commN2, setCommN2] = useState("");
  const [commN3, setCommN3] = useState("");

  // Withdrawals
  const [wdFee, setWdFee] = useState("");
  const [wdMin, setWdMin] = useState("");
  const [wdMax, setWdMax] = useState("");

  // Deposits
  const [depMin, setDepMin] = useState("");

  // VIP
  const [vip1, setVip1] = useState("");
  const [vip2, setVip2] = useState("");
  const [vip3, setVip3] = useState("");
  const [vip4, setVip4] = useState("");

  // PIX
  const [pixType, setPixType] = useState("cpf");
  const [pixKey, setPixKey] = useState("");

  // Gerente
  const [managerPhone, setManagerPhone] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("platform_settings").select("key, value");
      const map: Record<string, any> = {};
      (data ?? []).forEach((s) => { map[s.key] = s.value; });

      setCommN1(String(map["commission_n1"]?.percent ?? ""));
      setCommN2(String(map["commission_n2"]?.percent ?? ""));
      setCommN3(String(map["commission_n3"]?.percent ?? ""));
      setWdFee(String(map["withdrawal_fee"]?.percent ?? ""));
      setWdMin(String(map["min_withdrawal"]?.amount ?? ""));
      setWdMax(String(map["max_withdrawal"]?.amount ?? ""));
      setDepMin(String(map["min_deposit"]?.amount ?? ""));

      const vr = (map["vip_requirements"] ?? {}) as Record<string, number>;
      setVip1(String(vr["1"] ?? ""));
      setVip2(String(vr["2"] ?? ""));
      setVip3(String(vr["3"] ?? ""));
      setVip4(String(vr["4"] ?? ""));

      const pix = map["platform_pix_key"] as any;
      setPixType(pix?.type ?? "cpf");
      setPixKey(pix?.key ?? "");

      setManagerPhone(String((map["manager_whatsapp"] as any)?.phone ?? ""));

      setLoading(false);
    };
    load();
  }, []);

  const doSave = async () => {
    setConfirmModal(false);
    setSaving(true);

    const upserts: { key: string; value: any }[] = [
      { key: "commission_n1", value: { percent: parseFloat(commN1 || "0") } },
      { key: "commission_n2", value: { percent: parseFloat(commN2 || "0") } },
      { key: "commission_n3", value: { percent: parseFloat(commN3 || "0") } },
      { key: "withdrawal_fee", value: { percent: parseFloat(wdFee || "0") } },
      { key: "min_withdrawal", value: { amount: parseFloat(wdMin || "0") } },
      { key: "max_withdrawal", value: { amount: parseFloat(wdMax || "0") } },
      { key: "min_deposit", value: { amount: parseFloat(depMin || "0") } },
      { key: "vip_requirements", value: { "0": 0, "1": parseInt(vip1 || "0"), "2": parseInt(vip2 || "0"), "3": parseInt(vip3 || "0"), "4": parseInt(vip4 || "0") } },
      { key: "platform_pix_key", value: { type: pixType, key: pixKey } },
      { key: "manager_whatsapp", value: { phone: managerPhone.replace(/\D/g, "") } },
      { key: "commission_rates", value: { level_1: parseFloat(commN1 || "0"), level_2: parseFloat(commN2 || "0"), level_3: parseFloat(commN3 || "0") } },
    ];

    for (const u of upserts) {
      await supabase.from("platform_settings").upsert(
        { key: u.key, value: u.value, updated_at: new Date().toISOString(), updated_by: user?.id },
        { onConflict: "key" }
      );
    }

    await supabase.from("activity_logs").insert({
      user_id: user?.id,
      action: "settings_updated",
      details: { keys: upserts.map((u) => u.key) },
    });

    toast.success("Configurações atualizadas com sucesso!");
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4 lg:p-6 max-w-3xl mx-auto">
        <h1 className="font-heading text-xl font-bold">Configurações</h1>
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    );
  }

  const NumInput = ({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-secondary border-border pr-10"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-3xl mx-auto">
      <h1 className="font-heading text-xl font-bold">Configurações da Plataforma</h1>

      {/* Comissões */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <h2 className="font-heading text-sm font-bold text-primary">Comissões</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <NumInput label="Comissão Nível 1" value={commN1} onChange={setCommN1} suffix="%" />
          <NumInput label="Comissão Nível 2" value={commN2} onChange={setCommN2} suffix="%" />
          <NumInput label="Comissão Nível 3" value={commN3} onChange={setCommN3} suffix="%" />
        </div>
      </div>

      {/* Saques */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <h2 className="font-heading text-sm font-bold text-primary">Saques</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <NumInput label="Taxa de saque" value={wdFee} onChange={setWdFee} suffix="%" />
          <NumInput label="Saque mínimo" value={wdMin} onChange={setWdMin} suffix="R$" />
          <NumInput label="Saque máximo" value={wdMax} onChange={setWdMax} suffix="R$" />
        </div>
      </div>

      {/* Depósitos */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <h2 className="font-heading text-sm font-bold text-primary">Depósitos</h2>
        <NumInput label="Depósito mínimo" value={depMin} onChange={setDepMin} suffix="R$" />
      </div>

      {/* Requisitos VIP */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <h2 className="font-heading text-sm font-bold text-primary">Requisitos VIP (indicados válidos)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-center block">VIP 0</Label>
            <Input value="0" disabled className="bg-secondary/50 border-border text-center text-muted-foreground" />
          </div>
          <NumInput label="VIP 1" value={vip1} onChange={setVip1} />
          <NumInput label="VIP 2" value={vip2} onChange={setVip2} />
          <NumInput label="VIP 3" value={vip3} onChange={setVip3} />
          <NumInput label="VIP 4" value={vip4} onChange={setVip4} />
        </div>
      </div>

      {/* PIX */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <h2 className="font-heading text-sm font-bold text-primary">Chave PIX da Plataforma</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={pixType} onValueChange={setPixType}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="random">Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Chave</Label>
            <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Chave PIX" className="bg-secondary border-border" />
          </div>
        </div>
      </div>

      <Button onClick={() => setConfirmModal(true)} disabled={saving} className="w-full gradient-primary btn-glow text-primary-foreground gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar Configurações
      </Button>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setConfirmModal(false)} />
          <div className="glass-card relative z-10 w-full max-w-sm rounded-2xl p-6 space-y-4">
            <h2 className="font-heading text-lg font-bold">Confirmar</h2>
            <p className="text-sm text-muted-foreground">Tem certeza que deseja atualizar as configurações?</p>
            <div className="flex gap-2">
              <Button onClick={() => setConfirmModal(false)} variant="outline" className="flex-1">Cancelar</Button>
              <Button onClick={doSave} className="flex-1 gradient-primary text-primary-foreground">Confirmar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
