import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Shield,
  Award,
  Crown,
  Diamond,
  Loader2,
} from "lucide-react";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const VIP_META: Record<number, { icon: typeof Shield; color: string; label: string }> = {
  0: { icon: Shield, color: "#6B7280", label: "VIP 0" },
  1: { icon: Award, color: "#CD7F32", label: "VIP 1" },
  2: { icon: Award, color: "#C0C0C0", label: "VIP 2" },
  3: { icon: Crown, color: "#FFD700", label: "VIP 3" },
  4: { icon: Diamond, color: "#A855F7", label: "VIP 4" },
};

const PAGE_SIZE = 20;

const AdminUsers = () => {
  const { user: adminUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vipFilter, setVipFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<any | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Modal action states
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [newVip, setNewVip] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("id, full_name, email, phone, referral_code, vip_level, balance, blocked_balance, is_active, pix_key, pix_key_type, referred_by, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search.trim()) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    if (vipFilter !== "all") {
      query = query.eq("vip_level", parseInt(vipFilter));
    }
    if (statusFilter === "active") query = query.eq("is_active", true);
    if (statusFilter === "blocked") query = query.eq("is_active", false);

    const { data, count } = await query;
    setUsers(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [search, vipFilter, statusFilter, page]);

  useEffect(() => { setPage(0); }, [search, vipFilter, statusFilter]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Modal detail data
  const [sponsor, setSponsor] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  const openModal = async (u: any) => {
    setSelected(u);
    setAdjustAmount("");
    setAdjustReason("");
    setNewVip(String(u.vip_level ?? 0));
    setModalLoading(true);

    const [sponsorRes, referralsRes, txRes, roleRes] = await Promise.all([
      u.referred_by
        ? supabase.from("profiles").select("full_name, referral_code").eq("id", u.referred_by).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("profiles").select("id, full_name").eq("referred_by", u.id).limit(20),
      supabase.from("transactions").select("*").eq("user_id", u.id).order("created_at", { ascending: false }).limit(5),
      supabase.from("user_roles").select("role").eq("user_id", u.id).eq("role", "admin").maybeSingle(),
    ]);

    setSponsor(sponsorRes.data);
    setReferrals(referralsRes.data ?? []);
    setRecentTx(txRes.data ?? []);
    setUserIsAdmin(!!roleRes.data);
    setModalLoading(false);
  };

  const toggleBlock = async () => {
    if (!selected) return;
    const newStatus = !selected.is_active;
    if (!confirm(`${newStatus ? "Desbloquear" : "Bloquear"} este usuário?`)) return;
    setModalLoading(true);
    await supabase.from("profiles").update({ is_active: newStatus }).eq("id", selected.id);
    await supabase.from("activity_logs").insert({
      user_id: adminUser!.id,
      action: newStatus ? "user_unblocked" : "user_blocked",
      details: { target_user: selected.id },
    });
    toast.success(newStatus ? "Usuário desbloqueado" : "Usuário bloqueado");
    setSelected({ ...selected, is_active: newStatus });
    fetchUsers();
    setModalLoading(false);
  };

  const adjustBalance = async () => {
    if (!selected || !adjustAmount || !adjustReason.trim()) {
      toast.error("Preencha valor e motivo");
      return;
    }
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt === 0) { toast.error("Valor inválido"); return; }

    setModalLoading(true);
    const newBalance = (selected.balance ?? 0) + amt;
    await supabase.from("profiles").update({ balance: newBalance }).eq("id", selected.id);
    await supabase.from("transactions").insert({
      user_id: selected.id,
      type: "adjustment",
      amount: amt,
      status: "approved",
      approved_by: adminUser!.id,
      approved_at: new Date().toISOString(),
      description: `Ajuste: ${adjustReason}`,
    });
    await supabase.from("activity_logs").insert({
      user_id: adminUser!.id,
      action: "balance_adjusted",
      details: { target_user: selected.id, amount: amt, reason: adjustReason },
    });
    toast.success("Saldo ajustado");
    setSelected({ ...selected, balance: newBalance });
    setAdjustAmount("");
    setAdjustReason("");
    fetchUsers();
    setModalLoading(false);
  };

  const changeVip = async () => {
    if (!selected) return;
    const lvl = parseInt(newVip);
    if (lvl === (selected.vip_level ?? 0)) return;
    setModalLoading(true);
    await supabase.from("profiles").update({ vip_level: lvl }).eq("id", selected.id);
    await supabase.from("activity_logs").insert({
      user_id: adminUser!.id,
      action: "vip_changed",
      details: { target_user: selected.id, from: selected.vip_level, to: lvl },
    });
    toast.success(`VIP alterado para ${lvl}`);
    setSelected({ ...selected, vip_level: lvl });
    fetchUsers();
    setModalLoading(false);
  };

  const toggleAdmin = async () => {
    if (!selected) return;
    const action = userIsAdmin ? "remover admin" : "tornar admin";
    if (!confirm(`Deseja ${action} para este usuário?`)) return;
    setModalLoading(true);
    if (userIsAdmin) {
      await supabase.from("user_roles").delete().eq("user_id", selected.id).eq("role", "admin");
    } else {
      await supabase.from("user_roles").insert({ user_id: selected.id, role: "admin" });
    }
    await supabase.from("activity_logs").insert({
      user_id: adminUser!.id,
      action: userIsAdmin ? "admin_removed" : "admin_granted",
      details: { target_user: selected.id },
    });
    setUserIsAdmin(!userIsAdmin);
    toast.success(userIsAdmin ? "Admin removido" : "Admin concedido");
    setModalLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-6xl mx-auto">
      <h1 className="font-heading text-xl font-bold">Gerenciar Usuários</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, email ou telefone..."
            className="pl-9 bg-secondary border-border"
          />
        </div>
        <Select value={vipFilter} onValueChange={setVipFilter}>
          <SelectTrigger className="w-[100px] bg-secondary border-border">
            <SelectValue placeholder="VIP" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {[0, 1, 2, 3, 4].map((v) => (
              <SelectItem key={v} value={String(v)}>VIP {v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px] bg-secondary border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="blocked">Bloqueado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3">Nome</th>
                <th className="pb-2 pr-3 hidden lg:table-cell">Email</th>
                <th className="pb-2 pr-3">Saldo</th>
                <th className="pb-2 pr-3">VIP</th>
                <th className="pb-2 pr-3 hidden lg:table-cell">Status</th>
                <th className="pb-2 pr-3 hidden lg:table-cell">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const vip = VIP_META[u.vip_level ?? 0] ?? VIP_META[0];
                const VipIcon = vip.icon;
                return (
                  <tr
                    key={u.id}
                    onClick={() => openModal(u)}
                    className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 pr-3">
                      <p className="font-medium truncate max-w-[180px]">{u.full_name}</p>
                      <p className="text-[10px] text-muted-foreground lg:hidden">{u.email}</p>
                    </td>
                    <td className="py-3 pr-3 hidden lg:table-cell text-muted-foreground">{u.email}</td>
                    <td className="py-3 pr-3 font-mono text-xs">{fmtBRL(u.balance ?? 0)}</td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: vip.color, background: `${vip.color}20` }}>
                        <VipIcon className="h-2.5 w-2.5" /> {vip.label}
                      </span>
                    </td>
                    <td className="py-3 pr-3 hidden lg:table-cell">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.is_active ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                        {u.is_active ? "Ativo" : "Bloqueado"}
                      </span>
                    </td>
                    <td className="py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {u.created_at ? format(new Date(u.created_at), "dd/MM/yy", { locale: ptBR }) : "—"}
                    </td>
                  </tr>
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

      {/* USER DETAIL MODAL */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 overflow-y-auto">
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="glass-card relative z-10 w-full max-w-lg rounded-2xl p-6 space-y-5 mb-10">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold">Detalhes do Usuário</h2>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {modalLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <>
                {/* Info */}
                <div className="space-y-2 text-sm">
                  <Row label="Nome" value={selected.full_name} />
                  <Row label="Email" value={selected.email} />
                  <Row label="Telefone" value={selected.phone ?? "—"} />
                  <Row label="Saldo" value={fmtBRL(selected.balance ?? 0)} />
                  <Row label="Bloqueado" value={fmtBRL(selected.blocked_balance ?? 0)} />
                  <Row label="PIX" value={selected.pix_key ? `${selected.pix_key_type}: ${selected.pix_key}` : "—"} />
                  <Row label="Código" value={selected.referral_code} />
                  <Row label="Sponsor" value={sponsor ? `${sponsor.full_name} (${sponsor.referral_code})` : "Nenhum"} />
                  <Row label="Admin" value={userIsAdmin ? "Sim" : "Não"} />
                </div>

                {/* Referrals */}
                {referrals.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Indicados N1 ({referrals.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {referrals.map((r) => (
                        <span key={r.id} className="text-[10px] bg-secondary px-2 py-0.5 rounded-full">{r.full_name}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent TX */}
                {recentTx.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Últimas transações</p>
                    <div className="space-y-1">
                      {recentTx.map((tx) => (
                        <div key={tx.id} className="flex justify-between text-xs">
                          <span className="text-muted-foreground truncate">{tx.description ?? tx.type}</span>
                          <span className={`font-mono ${tx.amount >= 0 ? "text-success" : "text-destructive"}`}>{fmtBRL(tx.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ACTIONS */}
                <div className="border-t border-border pt-4 space-y-4">
                  {/* Block/Unblock */}
                  <Button
                    onClick={toggleBlock}
                    variant={selected.is_active ? "destructive" : "default"}
                    className="w-full"
                    size="sm"
                  >
                    {selected.is_active ? "Bloquear Usuário" : "Desbloquear Usuário"}
                  </Button>

                  {/* Adjust Balance */}
                  <div className="space-y-2">
                    <Label className="text-xs">Ajustar Saldo</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        placeholder="Valor (+/-)"
                        className="bg-secondary border-border flex-1"
                      />
                      <Button onClick={adjustBalance} size="sm" disabled={!adjustAmount || !adjustReason.trim()}>
                        Aplicar
                      </Button>
                    </div>
                    <Textarea
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="Motivo do ajuste (obrigatório)"
                      className="bg-secondary border-border text-xs h-16"
                    />
                  </div>

                  {/* Change VIP */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0">Alterar VIP:</Label>
                    <Select value={newVip} onValueChange={setNewVip}>
                      <SelectTrigger className="w-24 bg-secondary border-border h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4].map((v) => <SelectItem key={v} value={String(v)}>VIP {v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button onClick={changeVip} size="sm" disabled={parseInt(newVip) === (selected.vip_level ?? 0)}>
                      Salvar
                    </Button>
                  </div>

                  {/* Toggle Admin */}
                  <Button onClick={toggleAdmin} variant="outline" className="w-full" size="sm">
                    {userIsAdmin ? "Remover Admin" : "Tornar Admin"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right max-w-[60%] break-all">{value}</span>
  </div>
);

export default AdminUsers;
