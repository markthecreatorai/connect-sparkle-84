import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, Eye, EyeOff, Loader2, Phone } from "lucide-react";

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const getPasswordStrength = (password: string): { label: string; color: string; width: string } => {
  if (!password) return { label: "", color: "", width: "0%" };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { label: "Fraca", color: "bg-destructive", width: "33%" };
  if (score <= 3) return { label: "Média", color: "bg-warning", width: "66%" };
  return { label: "Forte", color: "bg-success", width: "100%" };
};

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref") || "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState(refCode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const mark = (field: string) => () => setTouched((p) => ({ ...p, [field]: true }));

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (touched.fullName && fullName.trim().length < 3) e.fullName = "Nome deve ter no mínimo 3 caracteres";
    if (touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Email inválido";
    if (touched.phone && phone.replace(/\D/g, "").length < 11) e.phone = "Telefone incompleto";
    if (touched.password && password.length < 6) e.password = "Mínimo 6 caracteres";
    if (touched.confirmPassword && confirmPassword !== password) e.confirmPassword = "Senhas não coincidem";
    return e;
  }, [fullName, email, phone, password, confirmPassword, touched]);

  const strength = getPasswordStrength(password);

  const isValid =
    fullName.trim().length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    phone.replace(/\D/g, "").length === 11 &&
    password.length >= 6 &&
    confirmPassword === password &&
    Object.keys(errors).length === 0;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);

    let referredBy: string | null = null;
    if (referralCode.trim()) {
      const { data: referrer } = await supabase
        .from("profiles")
        .select("id")
        .eq("referral_code", referralCode.toUpperCase().trim())
        .maybeSingle();
      if (!referrer) {
        toast.error("Código de indicação não encontrado");
        setLoading(false);
        return;
      }
      referredBy = referrer.id;
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.replace(/\D/g, ""),
          referred_by: referredBy,
        },
        emailRedirectTo: window.location.origin,
      },
    });

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Cadastro realizado! Verifique seu email para confirmar.");
      navigate("/login");
    }
  };

  const fieldClass = (field: string) =>
    `bg-secondary border-border transition-colors duration-200 ${errors[field] ? "border-destructive focus-visible:ring-destructive" : ""}`;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-card w-full max-w-[420px] rounded-2xl p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
            <UserPlus className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Criar Conta</h1>
          <p className="mt-2 text-sm text-muted-foreground">Preencha seus dados para começar</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={mark("fullName")}
              placeholder="Seu nome completo"
              className={fieldClass("fullName")}
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={mark("email")}
              placeholder="seu@email.com"
              className={fieldClass("email")}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                onBlur={mark("phone")}
                placeholder="(11) 99999-9999"
                className={`pl-9 ${fieldClass("phone")}`}
              />
            </div>
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={mark("password")}
                placeholder="Mínimo 6 caracteres"
                className={`pr-10 ${fieldClass("password")}`}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            {password && (
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                </div>
                <p className="text-xs text-muted-foreground">Força: <span className={strength.color === "bg-destructive" ? "text-destructive" : strength.color === "bg-warning" ? "text-warning" : "text-success"}>{strength.label}</span></p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={mark("confirmPassword")}
                placeholder="Repita a senha"
                className={`pr-10 ${fieldClass("confirmPassword")}`}
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
          </div>

          {/* Referral Code */}
          <div className="space-y-1.5">
            <Label htmlFor="referral">Código de indicação (opcional)</Label>
            <Input
              id="referral"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="Ex: A7K2M9"
              maxLength={6}
              className="bg-secondary border-border uppercase tracking-widest font-mono"
            />
          </div>

          <Button type="submit" disabled={loading || !isValid} className="w-full gradient-primary btn-glow text-primary-foreground mt-2">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cadastrando...</> : "Cadastrar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline">Faça login</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
