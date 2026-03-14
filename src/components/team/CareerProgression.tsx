import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, MessageCircle, Check, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type Position = {
  id: number;
  position_code: string;
  display_name: string;
  required_direct_referrals: number;
  required_total_team: number;
  monthly_salary: number;
  sort_order: number;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface CareerProgressionProps {
  positions: Position[];
  currentPosition: Position | null;
  directCount: number;
  totalTeam: number;
}

export const CareerProgression = ({
  positions,
  currentPosition,
  directCount,
  totalTeam,
}: CareerProgressionProps) => {
  if (!positions.length) return null;

  const handleContactManager = () => {
    // Open WhatsApp or support channel
    window.open("https://wa.me/?text=Olá, gostaria de falar sobre minha promoção de cargo.", "_blank");
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-warning" />
        <p className="text-sm font-semibold">Plano de Carreira</p>
      </div>

      {currentPosition && (
        <div className="rounded-lg bg-success/10 border border-success/20 p-3">
          <p className="text-sm font-medium text-success">
            Cargo atual: <b>{currentPosition.display_name}</b> — Salário: {fmtBRL(Number(currentPosition.monthly_salary))}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {positions.map((p) => {
          const reqDirect = Number(p.required_direct_referrals || 0);
          const reqTotal = Number(p.required_total_team || 0);

          const directPct = reqDirect > 0 ? Math.min(100, (directCount / reqDirect) * 100) : 100;
          const totalPct = reqTotal > 0 ? Math.min(100, (totalTeam / reqTotal) * 100) : 100;
          const overallPct = Math.round((directPct + totalPct) / 2);

          const isEligible = directPct >= 100 && totalPct >= 100;
          const isCurrent = currentPosition?.id === p.id;
          const isAchieved = currentPosition
            ? p.sort_order <= currentPosition.sort_order
            : false;

          return (
            <div
              key={p.id}
              className={`rounded-lg border p-3 space-y-2 transition-colors ${
                isCurrent
                  ? "border-primary bg-primary/5"
                  : isAchieved
                  ? "border-success/30 bg-success/5"
                  : isEligible
                  ? "border-warning/40 bg-warning/5"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isAchieved ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : isEligible ? (
                    <Crown className="h-4 w-4 text-warning" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{p.display_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {fmtBRL(Number(p.monthly_salary))}/mês
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isAchieved
                        ? "bg-success/20 text-success"
                        : isEligible
                        ? "bg-warning/20 text-warning"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isAchieved ? "Conquistado" : isEligible ? "Elegível" : `${overallPct}%`}
                  </span>
                </div>
              </div>

              {!isAchieved && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Diretos</span>
                        <span>
                          {directCount}/{reqDirect}
                        </span>
                      </div>
                      <Progress value={directPct} className="h-1.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Equipe total</span>
                        <span>
                          {totalTeam}/{reqTotal}
                        </span>
                      </div>
                      <Progress value={totalPct} className="h-1.5" />
                    </div>
                  </div>

                  {isEligible && !isCurrent && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-1 border-warning text-warning hover:bg-warning/10"
                      onClick={handleContactManager}
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1" />
                      Falar com gerente
                    </Button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
