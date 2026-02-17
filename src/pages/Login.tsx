import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Check if user is active
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      toast.error("Conta bloqueada. Entre em contato com o suporte.");
      setLoading(false);
      return;
    }

    // Check admin role for redirect
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();

    setLoading(false);
    navigate(adminRole ? "/admin" : "/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-card w-full max-w-[420px] rounded-2xl p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
            <LogIn className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Entrar</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acesse sua conta</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="bg-secondary border-border"
            />
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
