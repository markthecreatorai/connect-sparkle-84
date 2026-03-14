import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

interface UnifiedLevel {
  // vip_levels fields
  vl_id: string;
  level_code: string;
  display_name: string;
  deposit_required: number;
  daily_tasks: number;
  reward_per_task: number;
  daily_income: number;
  monthly_income: number;
  yearly_income: number;
  min_direct_referrals: number;
  is_available: boolean;
  sort_order: number;
  // vip_plans fields
  vp_id: string;
  level_number: number;
  price: number;
  commission_a_pct: number;
  commission_b_pct: number;
  commission_c_pct: number;
  reward_a: number;
  reward_b: number;
  reward_c: number;
  color_hex: string;
  plan_name: string;
}

const defaultNew: Omit<UnifiedLevel, "vl_id" | "vp_id"> = {
  level_code: "",
  display_name: "",
  deposit_required: 0,
  daily_tasks: 0,
  reward_per_task: 0,
  daily_income: 0,
  monthly_income: 0,
  yearly_income: 0,
  min_direct_referrals: 0,
  is_available: true,
  sort_order: 0,
  level_number: 0,
  price: 0,
  commission_a_pct: 0.12,
  commission_b_pct: 0.04,
  commission_c_pct: 0.02,
  reward_a: 0,
  reward_b: 0,
  reward_c: 0,
  color_hex: "#6b7280",
  plan_name: "",
};

function extractLevelNumber(code: string): number {
  if (code === "intern") return 0;
  const m = code.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : -1;
}

const SortableVipCard = ({ row, idx, setField, setDeleteTarget, renderForm, fmtBRL }: {
  row: UnifiedLevel; idx: number;
  setField: (idx: number, key: keyof UnifiedLevel, value: any) => void;
  setDeleteTarget: (r: UnifiedLevel) => void;
  renderForm: (data: any, setter: (key: string, val: any) => void, showCode?: boolean) => React.ReactNode;
  fmtBRL: (v: number) => string;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.vl_id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <Card ref={setNodeRef} style={style} className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: row.color_hex }} />
          <h3 className="font-semibold text-sm">{row.display_name} <span className="text-muted-foreground font-normal">({row.level_code})</span></h3>
          {row.price > 0 && <span className="text-xs text-muted-foreground">{fmtBRL(Number(row.price))}</span>}
        </div>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(row)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {renderForm(row, (key, val) => setField(idx, key as keyof UnifiedLevel, val), true)}
    </Card>
  );
};

const AdminVipLevels = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<UnifiedLevel[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newLevel, setNewLevel] = useState({ ...defaultNew });
  const [deleteTarget, setDeleteTarget] = useState<UnifiedLevel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = async () => {
    setLoading(true);
    const [{ data: levels }, { data: plans }] = await Promise.all([
      supabase.from("vip_levels").select("*").order("sort_order", { ascending: true }),
      supabase.from("vip_plans").select("*").order("level", { ascending: true }),
    ]);

    const planMap = new Map<number, any>();
    (plans ?? []).forEach((p: any) => planMap.set(p.level, p));

    const unified: UnifiedLevel[] = (levels ?? []).map((vl: any) => {
      const num = extractLevelNumber(vl.level_code);
      const vp = planMap.get(num);
      return {
        vl_id: vl.id,
        level_code: vl.level_code,
        display_name: vl.display_name,
        deposit_required: vl.deposit_required,
        daily_tasks: vl.daily_tasks,
        reward_per_task: vl.reward_per_task,
        daily_income: vl.daily_income,
        monthly_income: vl.monthly_income,
        yearly_income: vl.yearly_income,
        min_direct_referrals: vl.min_direct_referrals,
        is_available: vl.is_available,
        sort_order: vl.sort_order,
        vp_id: vp?.id ?? "",
        level_number: num,
        price: vp?.price ?? 0,
        commission_a_pct: vp?.commission_a_pct ?? 0.12,
        commission_b_pct: vp?.commission_b_pct ?? 0.04,
        commission_c_pct: vp?.commission_c_pct ?? 0.02,
        reward_a: vp?.reward_a ?? 0,
        reward_b: vp?.reward_b ?? 0,
        reward_c: vp?.reward_c ?? 0,
        color_hex: vp?.color_hex ?? "#6b7280",
        plan_name: vp?.name ?? vl.display_name,
      };
    });
    setRows(unified);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const PCT_FIELDS = ["commission_a_pct", "commission_b_pct", "commission_c_pct"] as const;

  const setField = (idx: number, key: keyof UnifiedLevel, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      let v = value;
      if ((PCT_FIELDS as readonly string[]).includes(key)) {
        v = Math.min(1, Math.max(0, Number(v) || 0));
      }
      next[idx] = { ...next[idx], [key]: v };
      return next;
    });
  };

  const validateRows = (list: UnifiedLevel[]): string | null => {
    for (const r of list) {
      for (const f of PCT_FIELDS) {
        const v = Number(r[f]);
        if (v < 0 || v > 1) return `${r.display_name}: comissão ${f} deve estar entre 0 e 1 (0%–100%)`;
      }
    }
    return null;
  };

  const save = async () => {
    const err = validateRows(rows);
    if (err) { toast.error(err); return; }
    setSaving(true);
    for (const r of rows) {
      // Update vip_levels
      const { error: e1 } = await (supabase.from("vip_levels" as never) as any)
        .update({
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
        })
        .eq("id", r.vl_id);
      if (e1) { toast.error(e1.message); setSaving(false); return; }

      // Update vip_plans if exists
      if (r.vp_id) {
        const { error: e2 } = await supabase.from("vip_plans")
          .update({
            name: r.plan_name || r.display_name,
            price: Number(r.price || 0),
            commission_a_pct: Number(r.commission_a_pct || 0),
            commission_b_pct: Number(r.commission_b_pct || 0),
            commission_c_pct: Number(r.commission_c_pct || 0),
            reward_a: Number(r.reward_a || 0),
            reward_b: Number(r.reward_b || 0),
            reward_c: Number(r.reward_c || 0),
            color_hex: r.color_hex || "#6b7280",
          })
          .eq("id", r.vp_id);
        if (e2) { toast.error(e2.message); setSaving(false); return; }
      }
    }
    toast.success("Níveis VIP atualizados");
    setSaving(false);
  };

  const handleAdd = async () => {
    setSaving(true);
    const nextNum = rows.length > 0 ? Math.max(...rows.map(r => r.level_number)) + 1 : 1;
    const code = `vip${nextNum}`;
    const sortOrder = rows.length > 0 ? Math.max(...rows.map(r => r.sort_order)) + 1 : nextNum;

    const { error: e1 } = await (supabase.from("vip_levels" as never) as any)
      .insert({
        level_code: code,
        display_name: newLevel.display_name || `VIP ${nextNum}`,
        deposit_required: Number(newLevel.deposit_required || 0),
        daily_tasks: Number(newLevel.daily_tasks || 0),
        reward_per_task: Number(newLevel.reward_per_task || 0),
        daily_income: Number(newLevel.daily_income || 0),
        monthly_income: Number(newLevel.monthly_income || 0),
        yearly_income: Number(newLevel.yearly_income || 0),
        min_direct_referrals: Number(newLevel.min_direct_referrals || 0),
        is_available: !!newLevel.is_available,
        sort_order: sortOrder,
      });
    if (e1) { toast.error(e1.message); setSaving(false); return; }

    const { error: e2 } = await supabase.from("vip_plans")
      .insert({
        level: nextNum,
        name: newLevel.plan_name || newLevel.display_name || `VIP ${nextNum}`,
        price: Number(newLevel.price || 0),
        commission_a_pct: Number(newLevel.commission_a_pct || 0),
        commission_b_pct: Number(newLevel.commission_b_pct || 0),
        commission_c_pct: Number(newLevel.commission_c_pct || 0),
        reward_a: Number(newLevel.reward_a || 0),
        reward_b: Number(newLevel.reward_b || 0),
        reward_c: Number(newLevel.reward_c || 0),
        color_hex: newLevel.color_hex || "#6b7280",
      });
    if (e2) { toast.error(e2.message); setSaving(false); return; }

    toast.success("Nível adicionado");
    setAddOpen(false);
    setNewLevel({ ...defaultNew });
    setSaving(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    // Check users on this level
    const { count } = await supabase.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("vip_level", deleteTarget.level_number);

    if (count && count > 0) {
      toast.error(`Não é possível excluir: ${count} usuário(s) estão neste nível`);
      setDeleting(false);
      setDeleteTarget(null);
      return;
    }

    const { error: e1 } = await (supabase.from("vip_levels" as never) as any)
      .delete().eq("id", deleteTarget.vl_id);
    if (e1) { toast.error(e1.message); setDeleting(false); return; }

    if (deleteTarget.vp_id) {
      const { error: e2 } = await supabase.from("vip_plans")
        .delete().eq("id", deleteTarget.vp_id);
      if (e2) { toast.error(e2.message); setDeleting(false); return; }
    }

    toast.success("Nível excluído");
    setDeleteTarget(null);
    setDeleting(false);
    load();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const oldIdx = prev.findIndex((r) => r.vl_id === active.id);
      const newIdx = prev.findIndex((r) => r.vl_id === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx);
      return reordered.map((r, i) => ({ ...r, sort_order: i }));
    });
  };

  if (loading) {
    return (
      <div className="space-y-3 p-4 lg:p-6 max-w-6xl mx-auto">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );

  const renderForm = (data: any, setter: (key: string, val: any) => void, showCode?: boolean) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      <FieldRow label="Nome de exibição">
        <Input value={data.display_name || ""} onChange={(e) => setter("display_name", e.target.value)} />
      </FieldRow>
      {showCode && (
        <FieldRow label="Código">
          <Input value={data.level_code || ""} disabled className="opacity-60" />
        </FieldRow>
      )}
      <FieldRow label="Preço (R$)">
        <Input type="number" value={data.price ?? 0} onChange={(e) => setter("price", e.target.value)} />
      </FieldRow>
      <FieldRow label="Depósito mínimo">
        <Input type="number" value={data.deposit_required ?? 0} onChange={(e) => setter("deposit_required", e.target.value)} />
      </FieldRow>
      <FieldRow label="Tarefas/dia">
        <Input type="number" value={data.daily_tasks ?? 0} onChange={(e) => setter("daily_tasks", e.target.value)} />
      </FieldRow>
      <FieldRow label="Recompensa/tarefa">
        <Input type="number" value={data.reward_per_task ?? 0} onChange={(e) => setter("reward_per_task", e.target.value)} />
      </FieldRow>
      <FieldRow label="Renda diária">
        <Input type="number" value={data.daily_income ?? 0} onChange={(e) => setter("daily_income", e.target.value)} />
      </FieldRow>
      <FieldRow label="Renda mensal">
        <Input type="number" value={data.monthly_income ?? 0} onChange={(e) => setter("monthly_income", e.target.value)} />
      </FieldRow>
      <FieldRow label="Renda anual">
        <Input type="number" value={data.yearly_income ?? 0} onChange={(e) => setter("yearly_income", e.target.value)} />
      </FieldRow>
      <FieldRow label="Indicações diretas mín.">
        <Input type="number" value={data.min_direct_referrals ?? 0} onChange={(e) => setter("min_direct_referrals", e.target.value)} />
      </FieldRow>

      <div className="sm:col-span-2 md:col-span-3 border-t pt-3 mt-1">
        <p className="text-sm font-medium text-muted-foreground mb-2">Comissões por indicação</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <FieldRow label="% Nível A">
            <Input type="number" step="0.01" value={data.commission_a_pct ?? 0} onChange={(e) => setter("commission_a_pct", e.target.value)} />
          </FieldRow>
          <FieldRow label="Reward A (R$)">
            <Input type="number" value={data.reward_a ?? 0} onChange={(e) => setter("reward_a", e.target.value)} />
          </FieldRow>
          <FieldRow label="% Nível B">
            <Input type="number" step="0.01" value={data.commission_b_pct ?? 0} onChange={(e) => setter("commission_b_pct", e.target.value)} />
          </FieldRow>
          <FieldRow label="Reward B (R$)">
            <Input type="number" value={data.reward_b ?? 0} onChange={(e) => setter("reward_b", e.target.value)} />
          </FieldRow>
          <FieldRow label="% Nível C">
            <Input type="number" step="0.01" value={data.commission_c_pct ?? 0} onChange={(e) => setter("commission_c_pct", e.target.value)} />
          </FieldRow>
          <FieldRow label="Reward C (R$)">
            <Input type="number" value={data.reward_c ?? 0} onChange={(e) => setter("reward_c", e.target.value)} />
          </FieldRow>
        </div>
      </div>

      <FieldRow label="Cor (hex)">
        <div className="flex items-center gap-2">
          <input type="color" value={data.color_hex || "#6b7280"} onChange={(e) => setter("color_hex", e.target.value)} className="h-10 w-10 rounded cursor-pointer border-0" />
          <Input value={data.color_hex || "#6b7280"} onChange={(e) => setter("color_hex", e.target.value)} className="flex-1" />
        </div>
      </FieldRow>
      <FieldRow label="Disponível">
        <div className="flex items-center gap-2 pt-1">
          <Switch checked={!!data.is_available} onCheckedChange={(v) => setter("is_available", v)} />
          <span className="text-xs">{data.is_available ? "Ativo" : "Em breve"}</span>
        </div>
      </FieldRow>
    </div>
  );

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold">Níveis VIP</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Nível
          </Button>
          <Button onClick={save} disabled={saving} className="gradient-primary text-primary-foreground">
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map(r => r.vl_id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {rows.map((r, idx) => (
              <SortableVipCard
                key={r.vl_id}
                row={r}
                idx={idx}
                setField={setField}
                setDeleteTarget={setDeleteTarget}
                renderForm={renderForm}
                fmtBRL={fmtBRL}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Nível VIP</DialogTitle>
            <DialogDescription>Preencha os dados do novo nível. O código será gerado automaticamente.</DialogDescription>
          </DialogHeader>
          {renderForm(newLevel, (key, val) => setNewLevel((p) => ({ ...p, [key]: val })))}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nível "{deleteTarget?.display_name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o nível de ambas as tabelas. Não será possível excluir se houver usuários neste nível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminVipLevels;
