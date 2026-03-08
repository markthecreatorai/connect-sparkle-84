import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDown,
  ArrowUp,
  Star,
  Gift,
  Settings,
  Inbox,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TX_TYPES: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "deposit", label: "Depósito" },
  { value: "withdrawal", label: "Saque" },
  { value: "commission", label: "Comissão" },
  { value: "bonus", label: "Bônus" },
  { value: "adjustment", label: "Ajuste" },
];

const PERIODS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "all", label: "Todos" },
];

const TX_ICON: Record<string, { icon: typeof ArrowDown; color: string }> = {
  deposit: { icon: ArrowDown, color: "text-success" },
  withdrawal: { icon: ArrowUp, color: "text-destructive" },
  commission: { icon: Star, color: "text-primary" },
  bonus: { icon: Gift, color: "text-accent" },
  adjustment: { icon: Settings, color: "text-muted-foreground" },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-warning/20 text-warning" },
  approved: { label: "Aprovado", cls: "bg-success/20 text-success" },
  rejected: { label: "Recusado", cls: "bg-destructive/20 text-destructive" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};

const PAGE_SIZE = 20;

const Transactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user) return;
    setPage(0);
  }, [typeFilter, periodFilter]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from("transactions")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (typeFilter !== "all") query = query.eq("type", typeFilter);

      if (periodFilter !== "all") {
        const days = parseInt(periodFilter);
        const since = new Date();
        since.setDate(since.getDate() - days);
        query = query.gte("created_at", since.toISOString());
      }

      const { data, count } = await query;
      setTransactions(data ?? []);
      setTotal(count ?? 0);
      setLoading(false);
    };
    load();
  }, [user, typeFilter, periodFilter, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-4xl mx-auto w-full min-w-0 overflow-x-hidden">
      <h1 className="font-heading text-xl font-bold">Histórico de Transações</h1>

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TX_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors duration-200 ${
                typeFilter === t.value
                  ? "gradient-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[120px] bg-secondary border-border text-xs h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : transactions.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma transação encontrada para os filtros selecionados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const meta = TX_ICON[tx.type] ?? TX_ICON.adjustment;
            const TxIcon = meta.icon;
            const status = STATUS_BADGE[tx.status] ?? STATUS_BADGE.pending;
            const isPositive = ["deposit", "commission", "bonus"].includes(tx.type);

            return (
              <div key={tx.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color} bg-secondary`}>
                  <TxIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.description || tx.type}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {tx.created_at ? format(new Date(tx.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className={`font-mono text-sm font-bold ${isPositive ? "text-success" : "text-destructive"}`}>
                    {isPositive ? "+" : ""}{fmtBRL(tx.amount)}
                  </p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="gap-1"
          >
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default Transactions;
