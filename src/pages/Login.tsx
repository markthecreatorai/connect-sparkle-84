import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff, Loader2, Phone } from "lucide-react";

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
      // Use edge function for secure login (legacy mapping stays server-side)
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
    <div className="flex min-h-screen items-center justify-center px-4 py-6 w-full max-w-full overflow-x-hidden">
      <div className="glass-card w-full max-w-[420px] rounded-2xl p-6 sm:p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
            <LogIn className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Entrar</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acesse sua conta</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                required
                className="bg-secondary border-border pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-secondary border-border pr-10"
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
            <Link to="/reset-password" className="text-xs text-primary hover:underline">
              Esqueceu a senha?
            </Link>
          </div>

          <Button type="submit" disabled={loading} className="w-full gradient-primary btn-glow text-primary-foreground">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</> : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link to="/register" className="text-primary hover:underline">Criar conta</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
