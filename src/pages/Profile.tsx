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
} from "lucide-react";

const VIP_META: Record<number, { icon: typeof Shield; color: string; label: string }> = {
  0: { icon: Shield, color: "#6B7280", label: "VIP 0" },
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

const strengthLabel = (pw: string) => {
  if (pw.length < 6) return { text: "Muito fraca", color: "bg-destructive", w: "w-1/5" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { text: "Fraca", color: "bg-destructive", w: "w-2/5" };
  if (score === 2) return { text: "Média", color: "bg-warning", w: "w-3/5" };
  if (score === 3) return { text: "Forte", color: "bg-success", w: "w-4/5" };
  return { text: "Muito forte", color: "bg-success", w: "w-full" };
};

const Profile = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPix, setSavingPix] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [copied, setCopied] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // PIX
  const [pixType, setPixType] = useState("");
  const [pixKey, setPixKey] = useState("");

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Sponsor
  const [sponsor, setSponsor] = useState<{ full_name: string; referral_code: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name);
    setPhone(profile.phone ?? "");
    setPixType(profile.pix_key_type ?? "");
    setPixKey(profile.pix_key ?? "");

    const loadSponsor = async () => {
      if (profile.id) {
        // Re-fetch to get referred_by
        const { data: fullProfile } = await supabase
          .from("profiles")
          .select("referred_by")
          .eq("id", profile.id)
          .maybeSingle();

        if (fullProfile?.referred_by) {
          const { data } = await supabase
            .from("profiles")
            .select("full_name, referral_code")
            .eq("id", fullProfile.referred_by)
            .maybeSingle();
          setSponsor(data);
        }
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
        .update({ full_name: fullName.trim(), phone: phone || null })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Perfil atualizado!");
      refreshProfile();
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
      refreshProfile();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
    setSavingPix(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Senhas não conferem");
      return;
    }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
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

  const pwStrength = newPassword ? strengthLabel(newPassword) : null;

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
      {/* USER INFO CARD */}
      <div className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full gradient-primary flex items-center justify-center shrink-0">
            <span className="font-heading text-2xl font-bold text-primary-foreground">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-xl font-bold truncate">{profile.full_name}</h1>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1"
              style={{ color: vip.color, background: `${vip.color}20` }}
            >
              <VipIcon className="h-3 w-3" />
              {vip.label}
            </span>
          </div>
        </div>

        {/* Editable fields */}
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Nome completo</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input value={profile.email} disabled className="bg-secondary/50 border-border text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Telefone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              className="bg-secondary border-border"
            />
          </div>
          <Button onClick={saveProfile} disabled={saving} className="w-full gradient-primary btn-glow text-primary-foreground gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Alterações
          </Button>
        </div>

        {/* Read-only info */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Código de indicação</p>
              <p className="font-mono text-lg font-bold text-primary">{profile.referral_code}</p>
            </div>
            <Button onClick={copyCode} variant="outline" size="sm" className="gap-1.5">
              {copied ? <><Check className="h-3 w-3" /> Copiado!</> : <><Copy className="h-3 w-3" /> Copiar</>}
            </Button>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Indicado por</span>
            <span className="font-medium">{sponsor ? `${sponsor.full_name} (${sponsor.referral_code})` : "Nenhum"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Membro desde</span>
            <span className="font-medium">
              {profile.id && profile.email
                ? format(new Date(user?.created_at ?? new Date()), "dd/MM/yyyy", { locale: ptBR })
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* PIX SECTION */}
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
              placeholder={
                pixType === "cpf" ? "000.000.000-00"
                : pixType === "phone" ? "(11) 99999-9999"
                : pixType === "email" ? "seu@email.com"
                : "Chave aleatória"
              }
              className="bg-secondary border-border font-mono"
            />
          </div>
        </div>
        <Button onClick={savePix} disabled={savingPix || !pixType || !pixKey.trim()} className="w-full gradient-primary btn-glow text-primary-foreground gap-2">
          {savingPix ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Chave PIX
        </Button>
      </div>

      {/* PASSWORD SECTION */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="font-heading text-lg font-bold">Alterar Senha</h2>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Nova senha</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="bg-secondary border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwStrength && (
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${pwStrength.color} ${pwStrength.w}`} />
                </div>
                <p className="text-[10px] text-muted-foreground">{pwStrength.text}</p>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Confirmar nova senha</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="bg-secondary border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-destructive">Senhas não conferem</p>
            )}
          </div>
          <Button
            onClick={changePassword}
            disabled={changingPw || newPassword.length < 6 || newPassword !== confirmPassword}
            className="w-full gradient-primary btn-glow text-primary-foreground gap-2"
          >
            {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Alterar Senha
          </Button>
        </div>
      </div>

      {/* LOGOUT */}
      <Button onClick={signOut} variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/10 gap-2">
        <LogOut className="h-4 w-4" /> Sair da Conta
      </Button>
    </div>
  );
};

export default Profile;
