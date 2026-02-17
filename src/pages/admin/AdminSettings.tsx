import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

const SETTINGS_KEYS = [
  { key: "min_deposit", label: "Depósito mínimo (R$)", field: "amount" },
  { key: "min_withdrawal", label: "Saque mínimo (R$)", field: "amount" },
  { key: "max_withdrawal", label: "Saque máximo (R$)", field: "amount" },
  { key: "withdrawal_fee", label: "Taxa de saque (%)", field: "percent" },
  { key: "commission_n1", label: "Comissão N1 (%)", field: "percent" },
  { key: "commission_n2", label: "Comissão N2 (%)", field: "percent" },
  { key: "commission_n3", label: "Comissão N3 (%)", field: "percent" },
];

const VIP_KEYS = ["0", "1", "2", "3", "4"];

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [vipReqs, setVipReqs] = useState<Record<string, string>>({});
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("platform_settings").select("key, value");
      const map: Record<string, any> = {};
      (data ?? []).forEach((s) => { map[s.key] = s.value; });

      const vals: Record<string, string> = {};
      SETTINGS_KEYS.forEach((s) => {
        vals[s.key] = String((map[s.key] as any)?.[s.field] ?? "");
      });
      setValues(vals);

      const vr = (map["vip_requirements"] ?? {}) as Record<string, number>;
      const vipVals: Record<string, string> = {};
      VIP_KEYS.forEach((k) => { vipVals[k] = String(vr[k] ?? ""); });
      setVipReqs(vipVals);

      const pix = map["platform_pix_key"] as any;
      setPixKey(pix?.key ?? "");
      setPixType(pix?.type ?? "");

      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);

    const upserts: { key: string; value: any }[] = [];

    SETTINGS_KEYS.forEach((s) => {
      const val = parseFloat(values[s.key] || "0");
      upserts.push({ key: s.key, value: { [s.field]: val } });
    });

    const vipObj: Record<string, number> = {};
    VIP_KEYS.forEach((k) => { vipObj[k] = parseInt(vipReqs[k] || "0"); });
    upserts.push({ key: "vip_requirements", value: vipObj });

    upserts.push({ key: "platform_pix_key", value: { key: pixKey, type: pixType } });

    // Also update commission_rates for the invite page
    upserts.push({
      key: "commission_rates",
      value: {
        level_1: parseFloat(values["commission_n1"] || "0"),
        level_2: parseFloat(values["commission_n2"] || "0"),
        level_3: parseFloat(values["commission_n3"] || "0"),
      },
    });

    for (const u of upserts) {
      await supabase.from("platform_settings").upsert(
        { key: u.key, value: u.value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    }

    toast.success("Configurações salvas!");
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4 lg:p-6 max-w-3xl mx-auto">
        <h1 className="font-heading text-xl font-bold">Configurações</h1>
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-3xl mx-auto">
      <h1 className="font-heading text-xl font-bold">Configurações da Plataforma</h1>

      {/* Financial settings */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <h2 className="font-heading text-sm font-bold">Valores e Taxas</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {SETTINGS_KEYS.map((s) => (
            <div key={s.key} className="space-y-1">
              <Label className="text-xs">{s.label}</Label>
              <Input
                type="number"
                step="0.01"
                value={values[s.key] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [s.key]: e.target.value }))}
                className="bg-secondary border-border"
              />
            </div>
          ))}
        </div>
      </div>

      {/* VIP Requirements */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <h2 className="font-heading text-sm font-bold">Requisitos VIP (indicados válidos)</h2>
        <div className="grid grid-cols-5 gap-3">
          {VIP_KEYS.map((k) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs text-center block">VIP {k}</Label>
              <Input
                type="number"
                value={vipReqs[k] ?? ""}
                onChange={(e) => setVipReqs((p) => ({ ...p, [k]: e.target.value }))}
                className="bg-secondary border-border text-center"
              />
            </div>
          ))}
        </div>
      </div>

      {/* PIX Key */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <h2 className="font-heading text-sm font-bold">Chave PIX da Plataforma</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Input
              value={pixType}
              onChange={(e) => setPixType(e.target.value)}
              placeholder="cpf, email, phone, random"
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Chave</Label>
            <Input
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="Chave PIX"
              className="bg-secondary border-border"
            />
          </div>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="w-full gradient-primary btn-glow text-primary-foreground gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar Configurações
      </Button>
    </div>
  );
};

export default AdminSettings;
