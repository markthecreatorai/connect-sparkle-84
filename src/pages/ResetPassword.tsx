import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Loader2, CheckCircle } from "lucide-react";

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isRecovery = location.hash.includes("type=recovery");

  const [identifier, setIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const clean = identifier.trim();
    const digits = clean.replace(/\D/g, "");
    const email = clean.includes("@") ? clean : digits.length === 11 ? `${digits}@plataforma.app` : "";

    if (!email) {
      toast.error("Informe um email válido ou telefone com 11 dígitos");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Senha atualizada com sucesso!");
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-card w-full max-w-[420px] rounded-2xl p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
            {sent ? <CheckCircle className="h-6 w-6 text-primary-foreground" /> : <KeyRound className="h-6 w-6 text-primary-foreground" />}
          </div>
          <h1 className="font-heading text-2xl font-bold">
            {isRecovery ? "Nova Senha" : sent ? "Email Enviado" : "Recuperar Senha"}
          </h1>
          {!isRecovery && !sent && (
            <p className="mt-2 text-sm text-muted-foreground">Informe seu email ou telefone para receber o link</p>
          )}
        </div>

        {sent && !isRecovery ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Verifique seu email para redefinir sua senha.
            </p>
            <p className="text-xs text-muted-foreground">Não recebeu? Verifique sua caixa de spam.</p>
          </div>
        ) : isRecovery ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="bg-secondary border-border"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full gradient-primary btn-glow text-primary-foreground">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Atualizando...</> : "Atualizar Senha"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Email ou Telefone</Label>
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="seu@email.com ou (11) 99999-9999"
                required
                className="bg-secondary border-border"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full gradient-primary btn-glow text-primary-foreground">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Enviar Link de Recuperação"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">Voltar ao login</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
