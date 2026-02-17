import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Inbox, ChevronDown, ChevronUp } from "lucide-react";

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  deposit_approved: "Depósito aprovado",
  deposit_rejected: "Depósito rejeitado",
  withdrawal_approved: "Saque aprovado",
  withdrawal_rejected: "Saque rejeitado",
  user_blocked: "Usuário bloqueado",
  user_unblocked: "Usuário desbloqueado",
  balance_adjusted: "Saldo ajustado",
  vip_changed: "VIP alterado",
  admin_granted: "Admin concedido",
  admin_removed: "Admin removido",
  settings_updated: "Configurações atualizadas",
  vip_recalculated: "VIP recalculado",
};

const formatAction = (action: string) => ACTION_LABELS[action] ?? action;

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

const AdminLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("all");
  const [period, setPeriod] = useState("30");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const since = subDays(new Date(), parseInt(period)).toISOString();

    let query = supabase
      .from("activity_logs")
      .select("*, profiles(full_name)", { count: "exact" })
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (actionFilter !== "all") {
      query = query.eq("action", actionFilter);
    }

    const { data, count } = await query;
    setLogs(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, actionFilter, period]);

  useEffect(() => { setPage(0); }, [actionFilter, period]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const actionTypes = Object.keys(ACTION_LABELS);

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-5xl mx-auto">
      <h1 className="font-heading text-xl font-bold">Logs de Atividade</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px] bg-secondary border-border text-sm">
            <SelectValue placeholder="Tipo de ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {actionTypes.map((a) => (
              <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px] bg-secondary border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : logs.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum log encontrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3">Data/Hora</th>
                <th className="pb-2 pr-3">Usuário</th>
                <th className="pb-2 pr-3">Ação</th>
                <th className="pb-2 w-10">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isOpen = expanded.has(log.id);
                const hasDetails = log.details && Object.keys(log.details).length > 0;
                return (
                  <>
                    <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                        {log.created_at
                          ? format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{(log.profiles as any)?.full_name ?? "Sistema"}</td>
                      <td className="py-2.5 pr-3">
                        <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded">{formatAction(log.action)}</span>
                      </td>
                      <td className="py-2.5">
                        {hasDetails && (
                          <button onClick={() => toggleExpand(log.id)} className="text-muted-foreground hover:text-foreground">
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && hasDetails && (
                      <tr key={`${log.id}-details`}>
                        <td colSpan={4} className="pb-3 pt-0 px-3">
                          <pre className="text-[10px] text-muted-foreground bg-secondary/50 rounded-lg p-3 whitespace-pre-wrap break-all font-mono overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminLogs;
