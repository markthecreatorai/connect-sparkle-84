import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Copy,
  Check,
  Save,
  Loader2,
  LogOut,
  Eye,
  EyeOff,
  Shield,
  Award,
  Crown,
  Diamond,
  Lock,
} from "lucide-react";

const VIP_META: Record<number, { icon: typeof Shield; color: string; label: string }> = {
  0: { icon: Shield, color: "#6B7280", label: "Estagiário" },
  1: { icon: Award, color: "#CD7F32", label: "VIP 1" },
  2: { icon: Award, color: "#C0C0C0", label: "VIP 2" },
  3: { icon: Crown, color: "#FFD700", label: "VIP 3" },
  4: { icon: Diamond, color: "#A855F7", label: "VIP 4" },
};

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const PIX_LABELS: Record<string, string> = {
  cpf: "CPF",
  email: "Email",
  phone: "Telefone",
  random: "Aleatória",
};

async function hashText(value: string) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const Profile = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPix, setSavingPix] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [savingPayPw, setSavingPayPw] = useState(false);
  const [copied, setCopied] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [pixType, setPixType] = useState("");
  const [pixKey, setPixKey] = useState("");

  const [currentLoginPassword, setCurrentLoginPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [currentPayPassword, setCurrentPayPassword] = useState("");
  const [newPayPassword, setNewPayPassword] = useState("");
  const [confirmPayPassword, setConfirmPayPassword] = useState("");

  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showNewLoginPw, setShowNewLoginPw] = useState(false);
  const [showConfirmLoginPw, setShowConfirmLoginPw] = useState(false);
  const [showCurrentPayPw, setShowCurrentPayPw] = useState(false);
  const [showNewPayPw, setShowNewPayPw] = useState(false);
  const [showConfirmPayPw, setShowConfirmPayPw] = useState(false);

  const [sponsor, setSponsor] = useState<{ full_name: string; referral_code: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || "");
    setPhone(profile.phone ?? "");
    setPixType(profile.pix_key_type ?? "");
    setPixKey(profile.pix_key ?? "");

    const loadSponsor = async () => {
      const { data: fullProfile } = await supabase
        .from("profiles")
        .select("referred_by")
        .eq("id", profile.id)
        .maybeSingle();

      if ((fullProfile as any)?.referred_by) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, referral_code")
          .eq("id", (fullProfile as any).referred_by)
          .maybeSingle();
        setSponsor((data as any) ?? null);
      }

      setLoading(false);
    };

    loadSponsor();
  }, [profile]);

  const initials = (profile?.full_name ?? "")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const vipLevel = profile?.vip_level ?? 0;
  const vip = VIP_META[vipLevel] ?? VIP_META[0];
  const VipIcon = vip.icon;

  const [hasPaymentPassword, setHasPaymentPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.functions.invoke("payment-password", { body: { action: "check" } }).then(({ data }) => {
      if (data?.ok) setHasPaymentPassword(!!data.has_password);
    });
  }, [user]);

  const copyCode = async () => {
    if (!profile?.referral_code) return;
    await navigator.clipboard.writeText(profile.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveProfile = async () => {
    if (!user || !fullName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Perfil atualizado!");
      await refreshProfile();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
    setSaving(false);
  };

  const savePix = async () => {
    if (!user || !pixType || !pixKey.trim()) {
      toast.error("Preencha tipo e chave PIX");
      return;
    }
    setSavingPix(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ pix_key: pixKey.trim(), pix_key_type: pixType })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Chave PIX salva!");
      await refreshProfile();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
    setSavingPix(false);
  };

  const savePaymentPassword = async () => {
    if (!user) return;

    if (!/^\d{6}$/.test(newPayPassword)) {
      toast.error("Senha de pagamento deve ter 6 dígitos numéricos");
      return;
    }
    if (newPayPassword !== confirmPayPassword) {
      toast.error("Senhas de pagamento não conferem");
      return;
    }

    setSavingPayPw(true);

    try {
      const payload: Record<string, string> = {
        action: "set",
        password: newPayPassword,
      };
      if (hasPaymentPassword) {
        if (!/^\d{6}$/.test(currentPayPassword)) {
          toast.error("Informe a senha de pagamento atual");
          setSavingPayPw(false);
          return;
        }
        payload.current_password = currentPayPassword;
      }

      const { data, error } = await supabase.functions.invoke("payment-password", {
        body: payload,
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Erro desconhecido");

      toast.success(hasPaymentPassword ? "Senha de pagamento alterada" : "Senha de pagamento criada");
      setHasPaymentPassword(true);
      setCurrentPayPassword("");
      setNewPayPassword("");
      setConfirmPayPassword("");
      await refreshProfile();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar senha de pagamento");
    }

    setSavingPayPw(false);
  };

  const changeLoginPassword = async () => {
    if (!profile?.email) {
      toast.error("Conta sem email interno para reautenticação");
      return;
    }
    if (!currentLoginPassword) {
      toast.error("Informe a senha atual");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Senhas não conferem");
      return;
    }

    setChangingPw(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentLoginPassword,
      });

      if (authError) {
        toast.error("Senha atual inválida");
        setChangingPw(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success("Senha de login alterada com sucesso!");
      setCurrentLoginPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao alterar senha");
    }

    setChangingPw(false);
  };

  const handlePixKeyChange = (val: string) => {
    if (pixType === "cpf") setPixKey(maskCPF(val));
    else if (pixType === "phone") setPixKey(maskPhone(val));
    else setPixKey(val);
  };

  if (loading || !profile) {
    return (
      <div className="space-y-6 p-4 lg:p-6 max-w-3xl mx-auto">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full gradient-primary flex items-center justify-center shrink-0">
            <span className="font-heading text-2xl font-bold text-primary-foreground">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-xl font-bold truncate">{profile.full_name}</h1>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1" style={{ color: vip.color, background: `${vip.color}20` }}>
              <VipIcon className="h-3 w-3" />
              {vip.label}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-secondary border-border" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Telefone</Label>
            <Input value={maskPhone(phone)} disabled className="bg-secondary/50 border-border text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Código de indicação</Label>
            <div className="flex gap-2">
              <Input value={profile.referral_code} disabled className="bg-secondary/50 border-border font-mono text-primary" />
              <Button onClick={copyCode} variant="outline" className="gap-1.5 shrink-0">
                {copied ? <><Check className="h-3 w-3" /> Copiado!</> : <><Copy className="h-3 w-3" /> Copiar</>}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">Indicado por</p>
              <p className="font-medium">{sponsor ? `${sponsor.full_name} (${sponsor.referral_code})` : "Nenhum"}</p>
            </div>
            <div className="rounded-lg bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">Membro desde</p>
              <p className="font-medium">{format(new Date(user?.created_at ?? new Date()), "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
          </div>
          <Button onClick={saveProfile} disabled={saving} className="w-full gradient-primary btn-glow text-primary-foreground gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Alterações
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="font-heading text-lg font-bold">Chave PIX para Saques</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Tipo PIX</Label>
            <Select value={pixType} onValueChange={(v) => { setPixType(v); setPixKey(""); }}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="random">Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Chave PIX {pixType ? `(${PIX_LABELS[pixType]})` : ""}</Label>
            <Input
              value={pixKey}
              onChange={(e) => handlePixKeyChange(e.target.value)}
              placeholder={pixType === "cpf" ? "000.000.000-00" : pixType === "phone" ? "(11) 99999-9999" : pixType === "email" ? "seu@email.com" : "Chave aleatória"}
              className="bg-secondary border-border font-mono"
            />
          </div>
        </div>
        <Button onClick={savePix} disabled={savingPix || !pixType || !pixKey.trim()} className="w-full gradient-primary btn-glow text-primary-foreground gap-2">
          {savingPix ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Chave PIX
        </Button>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-warning" />
          <h2 className="font-heading text-lg font-bold">Senha de Pagamento</h2>
        </div>

        {!hasPaymentPassword ? (
          <p className="text-sm text-muted-foreground">Nenhuma senha de pagamento cadastrada. Crie agora (6 dígitos).</p>
        ) : (
          <p className="text-sm text-success">Senha de pagamento: ativa ✓</p>
        )}

        {hasPaymentPassword && (
          <div className="space-y-1">
            <Label className="text-xs">Senha de pagamento atual</Label>
            <div className="relative">
              <Input
                type={showCurrentPayPw ? "text" : "password"}
                value={currentPayPassword}
                onChange={(e) => setCurrentPayPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="******"
                className="bg-secondary border-border pr-10"
              />
              <button type="button" onClick={() => setShowCurrentPayPw(!showCurrentPayPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showCurrentPayPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Nova senha de pagamento</Label>
            <div className="relative">
              <Input
                type={showNewPayPw ? "text" : "password"}
                value={newPayPassword}
                onChange={(e) => setNewPayPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6 dígitos"
                className="bg-secondary border-border pr-10"
              />
              <button type="button" onClick={() => setShowNewPayPw(!showNewPayPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showNewPayPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Confirmar nova senha de pagamento</Label>
            <div className="relative">
              <Input
                type={showConfirmPayPw ? "text" : "password"}
                value={confirmPayPassword}
                onChange={(e) => setConfirmPayPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6 dígitos"
                className="bg-secondary border-border pr-10"
              />
              <button type="button" onClick={() => setShowConfirmPayPw(!showConfirmPayPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showConfirmPayPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <Button onClick={savePaymentPassword} disabled={savingPayPw} className="w-full gradient-primary btn-glow text-primary-foreground gap-2">
          {savingPayPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {hasPaymentPassword ? "Alterar Senha de Pagamento" : "Criar Senha de Pagamento"}
        </Button>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="font-heading text-lg font-bold">Alterar Senha de Login</h2>
        <div className="space-y-1">
          <Label className="text-xs">Senha atual</Label>
          <div className="relative">
            <Input
              type={showLoginPw ? "text" : "password"}
              value={currentLoginPassword}
              onChange={(e) => setCurrentLoginPassword(e.target.value)}
              placeholder="Senha atual"
              className="bg-secondary border-border pr-10"
            />
            <button type="button" onClick={() => setShowLoginPw(!showLoginPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showLoginPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Nova senha</Label>
            <div className="relative">
              <Input
                type={showNewLoginPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="bg-secondary border-border pr-10"
              />
              <button type="button" onClick={() => setShowNewLoginPw(!showNewLoginPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showNewLoginPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Confirmar nova senha</Label>
            <div className="relative">
              <Input
                type={showConfirmLoginPw ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="bg-secondary border-border pr-10"
              />
              <button type="button" onClick={() => setShowConfirmLoginPw(!showConfirmLoginPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showConfirmLoginPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <Button onClick={changeLoginPassword} disabled={changingPw} className="w-full gradient-primary btn-glow text-primary-foreground gap-2">
          {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Alterar Senha de Login
        </Button>
      </div>

      <Button onClick={signOut} variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/10 gap-2">
        <LogOut className="h-4 w-4" /> Sair da Conta
      </Button>
    </div>
  );
};

export default Profile;
