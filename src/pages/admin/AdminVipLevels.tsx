import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const AdminVipLevels = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("vip_levels" as never)
        .select("*")
        .order("sort_order", { ascending: true });
      setRows((data as any[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const setField = (idx: number, key: string, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    for (const r of rows) {
      const updateData: Record<string, unknown> = {
          display_name: r.display_name,
          deposit_required: Number(r.deposit_required || 0),
          daily_tasks: Number(r.daily_tasks || 0),
          reward_per_task: Number(r.reward_per_task || 0),
          daily_income: Number(r.daily_income || 0),
          monthly_income: Number(r.monthly_income || 0),
          yearly_income: Number(r.yearly_income || 0),
          min_direct_referrals: Number(r.min_direct_referrals || 0),
          is_available: !!r.is_available,
          sort_order: Number(r.sort_order || 0),
        };
      const { error } = await (supabase
        .from("vip_levels" as never) as any)
        .update(updateData)
        .eq("id", r.id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    }
    toast.success("Níveis VIP atualizados");
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-3 p-4 lg:p-6 max-w-6xl mx-auto">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold">Níveis VIP</h1>
        <Button onClick={save} disabled={saving} className="gradient-primary text-primary-foreground">
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>

      <div className="space-y-3">
        {rows.map((r, idx) => (
          <Card key={r.id} className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2 space-y-1">
              <p className="text-xs text-muted-foreground">Nível</p>
              <Input value={r.display_name || ""} onChange={(e) => setField(idx, "display_name", e.target.value)} />
              <p className="text-[11px] text-muted-foreground">{r.level_code}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Depósito</p>
              <Input type="number" value={r.deposit_required ?? 0} onChange={(e) => setField(idx, "deposit_required", e.target.value)} />
              <p className="text-[11px] text-muted-foreground">{fmtBRL(Number(r.deposit_required || 0))}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Tarefas/dia</p>
              <Input type="number" value={r.daily_tasks ?? 0} onChange={(e) => setField(idx, "daily_tasks", e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Renda diária</p>
              <Input type="number" value={r.daily_income ?? 0} onChange={(e) => setField(idx, "daily_income", e.target.value)} />
              <p className="text-[11px] text-muted-foreground">{fmtBRL(Number(r.daily_income || 0))}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Disponível</p>
              <div className="flex items-center gap-2">
                <Switch checked={!!r.is_available} onCheckedChange={(v) => setField(idx, "is_available", v)} />
                <span className="text-xs">{r.is_available ? "Ativo" : "Em breve"}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminVipLevels;
