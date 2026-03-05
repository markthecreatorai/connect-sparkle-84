import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Crown, Star, Users, UserPlus, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface VipPlan {
  id: string;
  level: number;
  name: string;
  price: number;
  commission_a_pct: number;
  commission_b_pct: number;
  commission_c_pct: number;
  reward_a: number;
  reward_b: number;
  reward_c: number;
  color_hex: string;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const VipPlans = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [plans, setPlans] = useState<VipPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const userLevel = profile?.vip_level ?? 0;

  useEffect(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from("vip_plans")
        .select("*")
        .order("level", { ascending: true });

      if (!error && data) {
        setPlans(data as VipPlan[]);
      }
      setLoading(false);
    };
    fetchPlans();
  }, []);

  const getButtonState = (planLevel: number) => {
    if (planLevel === userLevel) return "current";
    if (planLevel < userLevel) return "lower";
    return "available";
  };

  const getVip9Gradient = "linear-gradient(135deg, #eab308, #ef4444, #f97316)";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-500" />
          <h1 className="text-lg font-bold text-foreground">Planos VIP</h1>
        </div>
      </div>

      {/* Plans List */}
      <div className="max-w-[430px] mx-auto px-4 py-4 space-y-4 pb-24">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))
        ) : (
          plans.map((plan) => {
            const state = getButtonState(plan.level);
            const isVip9 = plan.level === 9;
            const borderColor = isVip9 ? undefined : plan.color_hex;

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-2xl p-[1px] transition-all",
                  state === "current" && "ring-2 ring-yellow-500/60 shadow-lg shadow-yellow-500/10"
                )}
                style={{
                  background: isVip9
                    ? getVip9Gradient
                    : state === "current"
                    ? `linear-gradient(135deg, ${plan.color_hex}, ${plan.color_hex}88)`
                    : `${plan.color_hex}33`,
                }}
              >
                <div className="bg-card rounded-2xl p-4 space-y-3">
                  {/* Plan Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                        style={{
                          background: isVip9
                            ? getVip9Gradient
                            : `${plan.color_hex}22`,
                          color: isVip9 ? "#fff" : plan.color_hex,
                          border: `1.5px solid ${isVip9 ? "transparent" : plan.color_hex}44`,
                        }}
                      >
                        {plan.level}
                      </div>
                      <div>
                        <h3
                          className="font-bold text-base"
                          style={{ color: isVip9 ? "#f5c842" : plan.color_hex }}
                        >
                          {plan.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Recarga mínima
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className="font-bold text-lg"
                        style={{ color: isVip9 ? "#f5c842" : plan.color_hex }}
                      >
                        {formatBRL(plan.price)}
                      </p>
                    </div>
                  </div>

                  {/* Current badge */}
                  {state === "current" && (
                    <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5 w-fit">
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-semibold text-yellow-500">
                        Seu plano atual
                      </span>
                    </div>
                  )}

                  {/* Rewards */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Recompensas por convite
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <RewardBadge
                        label="Nível A"
                        sublabel="Diretos"
                        value={plan.reward_a}
                        color="#22c55e"
                        icon={<UserPlus className="w-3 h-3" />}
                      />
                      <RewardBadge
                        label="Nível B"
                        sublabel="Indiretos"
                        value={plan.reward_b}
                        color="#3b82f6"
                        icon={<Users className="w-3 h-3" />}
                      />
                      <RewardBadge
                        label="Nível C"
                        sublabel="Rede"
                        value={plan.reward_c}
                        color="#8b5cf6"
                        icon={<Network className="w-3 h-3" />}
                      />
                    </div>
                  </div>

                  {/* Commission percentages */}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Comissões:</span>
                    <span className="text-green-400">{(plan.commission_a_pct * 100).toFixed(0)}% A</span>
                    <span>·</span>
                    <span className="text-blue-400">{(plan.commission_b_pct * 100).toFixed(0)}% B</span>
                    <span>·</span>
                    <span className="text-purple-400">{(plan.commission_c_pct * 100).toFixed(0)}% C</span>
                  </div>

                  {/* Action Button */}
                  {state === "available" && (
                    <Button
                      className="w-full font-semibold"
                      style={{
                        background: isVip9
                          ? getVip9Gradient
                          : plan.color_hex,
                        color: plan.level >= 7 ? "#000" : "#fff",
                      }}
                      onClick={() => navigate(`/deposit?vip_plan=${plan.id}`)}
                    >
                      Obter {plan.name}
                    </Button>
                  )}
                  {state === "current" && (
                    <Button
                      disabled
                      className="w-full border-2 border-yellow-500/50 bg-yellow-500/10 text-yellow-500 font-semibold cursor-default"
                    >
                      <Star className="w-4 h-4 mr-1.5 fill-yellow-500" />
                      Seu plano
                    </Button>
                  )}
                  {state === "lower" && (
                    <Button
                      disabled
                      className="w-full bg-muted text-muted-foreground font-medium cursor-default"
                    >
                      Rebaixar não permitido
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const RewardBadge = ({
  label,
  sublabel,
  value,
  color,
  icon,
}: {
  label: string;
  sublabel: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}) => (
  <div
    className="rounded-lg p-2 text-center space-y-0.5"
    style={{ background: `${color}10`, border: `1px solid ${color}22` }}
  >
    <div className="flex items-center justify-center gap-1" style={{ color }}>
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
    </div>
    <p className="font-bold text-sm" style={{ color }}>
      {formatBRL(value)}
    </p>
    <p className="text-[9px] text-muted-foreground">{sublabel}</p>
  </div>
);

export default VipPlans;
