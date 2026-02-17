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

const AdminDeposits = () => {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("pending");

  const fetchDeposits = async () => {
    setLoading(true);
    let query = supabase
      .from("deposits")
      .select("*, profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (filter !== "all") query = query.eq("status", filter);

    const { data } = await query;
    setDeposits(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchDeposits(); }, [filter]);

  const handleAction = async (depositId: string, action: "approve_deposit" | "reject_deposit") => {
    setActionLoading(depositId);
    const body: any = { action, deposit_id: depositId };
    if (action === "reject_deposit") body.admin_notes = rejectNotes[depositId] || "";

    const { data, error } = await supabase.functions.invoke("admin-actions", { body });

    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "Erro na operação");
    } else {
      toast.success(action === "approve_deposit" ? "Depósito aprovado!" : "Depósito rejeitado");
      fetchDeposits();
    }
    setActionLoading(null);
  };

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-4xl mx-auto">
      <h1 className="font-heading text-xl font-bold">Gerenciar Depósitos</h1>

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
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : deposits.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum depósito encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deposits.map((d) => {
            const s = STATUS[d.status] ?? STATUS.pending;
            const isPending = d.status === "pending";
            return (
              <div key={d.id} className="glass-card rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{(d.profiles as any)?.full_name ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{(d.profiles as any)?.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-bold">{fmtBRL(d.amount)}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                </p>
                {isPending && (
                  <div className="space-y-2">
                    <Input
                      value={rejectNotes[d.id] ?? ""}
                      onChange={(e) => setRejectNotes((p) => ({ ...p, [d.id]: e.target.value }))}
                      placeholder="Motivo da rejeição (opcional)"
                      className="bg-secondary border-border text-xs h-8"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAction(d.id, "approve_deposit")}
                        disabled={actionLoading === d.id}
                        size="sm"
                        className="flex-1 gap-1 bg-success hover:bg-success/90 text-success-foreground"
                      >
                        {actionLoading === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Aprovar
                      </Button>
                      <Button
                        onClick={() => handleAction(d.id, "reject_deposit")}
                        disabled={actionLoading === d.id}
                        size="sm"
                        variant="destructive"
                        className="flex-1 gap-1"
                      >
                        {actionLoading === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                )}
                {d.admin_notes && (
                  <p className="text-[10px] text-muted-foreground italic">Nota: {d.admin_notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDeposits;
