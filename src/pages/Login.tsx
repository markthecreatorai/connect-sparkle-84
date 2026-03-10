import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Phone } from "lucide-react";
import avengersLogo from "@/assets/avengers-logo.svg";

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const Login = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length !== 11) {
      toast.error("Telefone inválido");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("login", {
        body: { phone: phoneDigits, password },
      });

      if (error || !data?.ok || !data?.session) {
        toast.error("Telefone ou senha incorretos");
        setLoading(false);
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        toast.error("Erro ao estabelecer sessão");
        setLoading(false);
        return;
      }

      const userId = data.user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", userId)
        .maybeSingle();

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        toast.error("Conta bloqueada. Entre em contato com o suporte.");
        setLoading(false);
        return;
      }

      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      setLoading(false);
      navigate(adminRole ? "/admin" : "/dashboard");
    } catch {
      toast.error("Erro ao fazer login");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
      {/* Left — Hero Panel (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero items-center justify-center relative overflow-hidden">
        <div className="pattern-dots absolute inset-0" />
        <div className="relative z-10 text-center space-y-6 px-12 max-w-lg">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
            <img src={avengersLogo} alt="AvengersPay" className="h-14 w-14 brightness-0 invert" />
          </div>
          <div>
            <h2 className="font-heading text-4xl text-white tracking-wide">
              AVENGERS<span className="text-accent">PAY</span>
            </h2>
            <p className="mt-3 text-white/60 text-sm leading-relaxed">
              Plataforma confiável de rendimentos diários. Tarefas, indicações e investimentos com segurança e transparência.
            </p>
          </div>
          <div className="flex items-center justify-center gap-6 text-white/40 text-xs">
            <span className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Plataforma Ativa
            </span>
            <span>Segura & Confiável</span>
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 bg-background">
        <div className="w-full max-w-[420px] space-y-8">
          {/* Mobile Brand */}
          <div className="lg:hidden text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
              <img src={avengersLogo} alt="AvengersPay" className="h-9 w-9 brightness-0 invert" />
            </div>
            <div>
              <span className="font-heading text-2xl text-foreground tracking-wide">AVENGERS</span>
              <span className="font-heading text-2xl text-accent tracking-wide">PAY</span>
            </div>
          </div>

          {/* Header */}
          <div>
            <h1 className="font-heading text-3xl text-foreground">Entrar na Conta</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Acesse sua conta para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  required
                  className="pl-9 h-11 bg-secondary/50 border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pr-10 h-11 bg-secondary/50 border-border"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="text-right">
              <Link to="/reset-password" className="text-xs text-primary hover:underline font-medium">
                Esqueceu a senha?
              </Link>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-11 gradient-primary btn-glow text-primary-foreground font-semibold text-sm">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</> : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link to="/register" className="text-accent font-semibold hover:underline">Criar conta grátis</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;