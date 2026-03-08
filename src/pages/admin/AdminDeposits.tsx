import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, Loader2, Inbox, ExternalLink } from "lucide-react";

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
  const [filter, setFilter] = useState("pending");

  // Modal states
  const [approveModal, setApproveModal] = useState<any | null>(null);
  const [rejectModal, setRejectModal] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDeposits = async () => {
    setLoading(true);
    let query = supabase
      .from("deposits")
      .select("*, profiles!deposits_user_id_fkey(full_name, email), approver:profiles!deposits_approved_by_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (filter !== "all") query = query.eq("status", filter);

    const { data } = await query;
    setDeposits(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchDeposits(); }, [filter]);

  const handleApprove = async () => {
    if (!approveModal) return;
    setActionLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-actions", {
      body: { action: "approve_deposit", deposit_id: approveModal.id },
    });
    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "Erro ao aprovar");
    } else {
      toast.success("Depósito aprovado! Saldo creditado e comissões distribuídas.");
      fetchDeposits();
    }
    setApproveModal(null);
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) {
      toast.error("Informe o motivo da rejeição");
      return;
    }
    setActionLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-actions", {
      body: { action: "reject_deposit", deposit_id: rejectModal.id, admin_notes: rejectReason },
    });
    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "Erro ao rejeitar");
    } else {
      toast.success("Depósito rejeitado.");
      fetchDeposits();
    }
    setRejectModal(null);
    setRejectReason("");
    setActionLoading(false);
  };

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-5xl mx-auto w-full min-w-0 overflow-x-hidden">
      <h1 className="font-heading text-xl font-bold">Gerenciar Depósitos</h1>

      {/* Filters */}
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

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : deposits.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum depósito encontrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3">Usuário</th>
                <th className="pb-2 pr-3">Valor</th>
                <th className="pb-2 pr-3 hidden md:table-cell">Comprovante</th>
                <th className="pb-2 pr-3 hidden md:table-cell">Data</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => {
                const s = STATUS[d.status] ?? STATUS.pending;
                const isPending = d.status === "pending";
                const profile = d.profiles as any;
                const approver = d.approver as any;
                return (
                  <tr
                    key={d.id}
                    className={`border-b border-border/50 transition-colors ${
                      isPending ? "border-l-[3px] border-l-warning" : ""
                    }`}
                  >
                    <td className="py-3 pr-3">
                      <p className="font-medium truncate max-w-[180px]">{profile?.full_name ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{profile?.email}</p>
                    </td>
                    <td className="py-3 pr-3 font-mono font-bold">{fmtBRL(d.amount)}</td>
                    <td className="py-3 pr-3 hidden md:table-cell">
                      {d.proof_url ? (
                        <a href={d.proof_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                          Ver <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 hidden md:table-cell text-xs text-muted-foreground">
                      {d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                      {!isPending && approver && (
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          por {approver.full_name} em {d.approved_at ? format(new Date(d.approved_at), "dd/MM HH:mm") : ""}
                        </p>
                      )}
                    </td>
                    <td className="py-3">
                      {isPending ? (
                        <div className="flex gap-1">
                          <Button size="sm" className="h-7 text-[10px] gap-1 bg-success hover:bg-success/90 text-success-foreground" onClick={() => setApproveModal(d)}>
                            <Check className="h-3 w-3" /> Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-[10px] gap-1" onClick={() => { setRejectModal(d); setRejectReason(""); }}>
                            <X className="h-3 w-3" /> Rejeitar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* APPROVE MODAL */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => !actionLoading && setApproveModal(null)} />
          <div className="glass-card relative z-10 w-full max-w-md rounded-2xl p-6 space-y-4">
            <h2 className="font-heading text-lg font-bold">Confirmar Aprovação</h2>
            <p className="text-sm text-muted-foreground">
              Confirmar aprovação do depósito de <span className="text-foreground font-bold">{fmtBRL(approveModal.amount)}</span> para{" "}
              <span className="text-foreground font-medium">{(approveModal.profiles as any)?.full_name}</span>?
            </p>
            <p className="text-xs text-muted-foreground">Isso creditará o saldo e gerará comissões automáticas.</p>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => setApproveModal(null)} variant="outline" className="flex-1" disabled={actionLoading}>Cancelar</Button>
              <Button onClick={handleApprove} className="flex-1 bg-success hover:bg-success/90 text-success-foreground gap-1" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => !actionLoading && setRejectModal(null)} />
          <div className="glass-card relative z-10 w-full max-w-md rounded-2xl p-6 space-y-4">
            <h2 className="font-heading text-lg font-bold">Rejeitar Depósito</h2>
            <p className="text-sm text-muted-foreground">
              Rejeitar depósito de <span className="text-foreground font-bold">{fmtBRL(rejectModal.amount)}</span> de{" "}
              <span className="text-foreground font-medium">{(rejectModal.profiles as any)?.full_name}</span>?
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Motivo da rejeição (obrigatório)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Informe o motivo..."
                className="bg-secondary border-border text-sm h-20"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => setRejectModal(null)} variant="outline" className="flex-1" disabled={actionLoading}>Cancelar</Button>
              <Button onClick={handleReject} variant="destructive" className="flex-1 gap-1" disabled={actionLoading || !rejectReason.trim()}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Rejeitar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDeposits;
