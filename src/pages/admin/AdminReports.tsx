import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileText } from "lucide-react";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const toCsv = (rows: any[]) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
};

const downloadCsv = (name: string, csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

const AdminReports = () => {
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    setFrom(`${y}-${m}-01`);
    setTo(now.toISOString().slice(0, 10));
  }, []);

  const run = async () => {
    if (!from || !to) return;
    setLoading(true);
    const start = `${from}T00:00:00.000Z`;
    const end = `${to}T23:59:59.999Z`;

    const { data } = await supabase
      .from("transactions")
      .select("id,user_id,type,wallet_type,amount,description,created_at")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false });

    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (from && to) run();
  }, [from, to]);

  const summary = useMemo(() => {
    let inV = 0;
    let outV = 0;
    rows.forEach((r) => {
      const v = Number(r.amount || 0);
      if (v >= 0) inV += v;
      else outV += Math.abs(v);
    });
    return { inV, outV, net: inV - outV };
  }, [rows]);

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold">Relatórios</h1>
        <Button
          variant="outline"
          onClick={() => downloadCsv(`transactions_${from}_to_${to}.csv`, toCsv(rows))}
          disabled={!rows.length}
          className="gap-2"
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-xs text-muted-foreground mb-1">De</p>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-secondary border-border" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Até</p>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-secondary border-border" />
        </div>
        <Button onClick={run}>Atualizar</Button>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Entradas</p>
          <p className="text-xl font-bold text-success">{fmtBRL(summary.inV)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Saídas</p>
          <p className="text-xl font-bold text-destructive">{fmtBRL(summary.outV)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Saldo Líquido</p>
          <p className="text-xl font-bold">{fmtBRL(summary.net)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" /> {rows.length} registros
        </div>
        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-8 rounded" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2">Tipo</th>
                  <th className="py-2 pr-2">Carteira</th>
                  <th className="py-2 pr-2">Valor</th>
                  <th className="py-2 pr-2">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-2 pr-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                    <td className="py-2 pr-2">{r.type}</td>
                    <td className="py-2 pr-2">{r.wallet_type || "—"}</td>
                    <td className="py-2 pr-2 font-mono">{fmtBRL(Number(r.amount || 0))}</td>
                    <td className="py-2 pr-2 text-xs text-muted-foreground">{r.description || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminReports;
