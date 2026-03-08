import { useState, useEffect } from "react";
import { getSiteUrl } from "@/lib/site-url";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Share2, Gift } from "lucide-react";

const Invite = () => {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [percents, setPercents] = useState<{ n1: number; n2: number; n3: number }>({ n1: 0, n2: 0, n3: 0 });

  const inviteLink = `${getSiteUrl()}/register?ref=${profile?.referral_code ?? ""}`;

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "commission_rates")
        .maybeSingle();
      if (data) {
        const v = data.value as any;
        setPercents({ n1: v?.level_1 ?? 0, n2: v?.level_2 ?? 0, n3: v?.level_3 ?? 0 });
      }
      setLoading(false);
    };
    load();
  }, []);

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: "Convite", text: "Cadastre-se na plataforma!", url: inviteLink });
    } else {
      copyLink();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="glass-card rounded-2xl p-6 w-full max-w-md space-y-6 text-center">
        <div className="mx-auto h-14 w-14 rounded-xl gradient-primary flex items-center justify-center">
          <Gift className="h-7 w-7 text-primary-foreground" />
        </div>

        <div>
          <h1 className="font-heading text-2xl font-bold">Convide e Ganhe!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Compartilhe seu link exclusivo e ganhe comissões quando seus indicados fizerem depósitos.
          </p>
        </div>

        {/* Commission rates */}
        {loading ? (
          <Skeleton className="h-10 w-full rounded-lg" />
        ) : (
          <div className="flex justify-center gap-4 text-sm">
            {[
              { label: "Nível 1", pct: percents.n1, color: "text-success" },
              { label: "Nível 2", pct: percents.n2, color: "text-warning" },
              { label: "Nível 3", pct: percents.n3, color: "text-primary" },
            ].map((item) => (
              <div key={item.label} className="glass-card rounded-lg px-3 py-2">
                <p className={`font-mono font-bold ${item.color}`}>{item.pct}%</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={inviteLink} size={160} />
          </div>
        </div>

        {/* Link */}
        <div className="flex gap-2">
          <Input
            readOnly
            value={inviteLink}
            className="bg-secondary border-border font-mono text-xs"
          />
          <Button onClick={copyLink} variant="outline" size="icon" className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <Button onClick={shareLink} className="w-full gradient-primary btn-glow text-primary-foreground gap-2 h-12">
          <Share2 className="h-5 w-5" /> Compartilhar Link
        </Button>
      </div>
    </div>
  );
};

export default Invite;
