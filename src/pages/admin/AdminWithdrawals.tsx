import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, Loader2, Inbox } from "lucide-react";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-warning/20 text-warning" },
  approved: { label: "Aprovado", cls: "bg-success/20 text-success" },
  rejected: { label: "Rejeitado", cls: "bg-destructive/20 text-destructive" },
};

const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("pending");

  const fetchWithdrawals = async () => {
    setLoading(true);
    let query = supabase
      .from("withdrawals")
      .select("*, profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (filter !== "all") query = query.eq("status", filter);

    const { data } = await query;
    setWithdrawals(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchWithdrawals(); }, [filter]);

  const handleAction = async (withdrawalId: string, action: "approve_withdrawal" | "reject_withdrawal") => {
    setActionLoading(withdrawalId);
    const body: any = { action, withdrawal_id: withdrawalId };
    if (action === "reject_withdrawal") body.admin_notes = rejectNotes[withdrawalId] || "";

    const { data, error } = await supabase.functions.invoke("admin-actions", { body });

    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "Erro na operação");
    } else {
      toast.success(action === "approve_withdrawal" ? "Saque aprovado!" : "Saque rejeitado");
      fetchWithdrawals();
    }
    setActionLoading(null);
  };

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-4xl mx-auto">
      <h1 className="font-heading text-xl font-bold">Gerenciar Saques</h1>

      <div className="flex gap-1.5">
        {[
          { v: "pending", l: "Pendentes" },
          { v: "approved", l: "Aprovados" },
          { v: "rejected", l: "Rejeitados" },
          { v: "all", l: "Todos" },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              filter === f.v
                ? "gradient-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : withdrawals.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum saque encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w) => {
            const s = STATUS[w.status] ?? STATUS.pending;
            const isPending = w.status === "pending";
            return (
              <div key={w.id} className="glass-card rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{(w.profiles as any)?.full_name ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{(w.profiles as any)?.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-bold">{fmtBRL(w.amount)}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 text-[10px] text-muted-foreground">
                  <span>Taxa: {fmtBRL(w.fee ?? 0)}</span>
                  <span>Líquido: <span className="text-success">{fmtBRL(w.net_amount)}</span></span>
                  <span>PIX ({w.pix_key_type}): {w.pix_key}</span>
                  <span>{w.created_at ? format(new Date(w.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</span>
                </div>
                {isPending && (
                  <div className="space-y-2">
                    <Input
                      value={rejectNotes[w.id] ?? ""}
                      onChange={(e) => setRejectNotes((p) => ({ ...p, [w.id]: e.target.value }))}
                      placeholder="Motivo da rejeição (opcional)"
                      className="bg-secondary border-border text-xs h-8"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAction(w.id, "approve_withdrawal")}
                        disabled={actionLoading === w.id}
                        size="sm"
                        className="flex-1 gap-1 bg-success hover:bg-success/90 text-success-foreground"
                      >
                        {actionLoading === w.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Aprovar
                      </Button>
                      <Button
                        onClick={() => handleAction(w.id, "reject_withdrawal")}
                        disabled={actionLoading === w.id}
                        size="sm"
                        variant="destructive"
                        className="flex-1 gap-1"
                      >
                        {actionLoading === w.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                )}
                {w.admin_notes && (
                  <p className="text-[10px] text-muted-foreground italic">Nota: {w.admin_notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminWithdrawals;
