import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shield, Flame, Gift, Trophy } from "lucide-react";

const PRIZES = [
  { label: "R$1", amount: 1 },
  { label: "R$5", amount: 5 },
  { label: "R$10", amount: 10 },
  { label: "R$20", amount: 20 },
  { label: "R$50", amount: 50 },
  { label: "R$100", amount: 100 },
  { label: "Tente\namanhã", amount: 0 },
  { label: "R$1", amount: 1 },
];

const SEGMENT_ANGLE = 360 / PRIZES.length;

const SpinWheel = () => {
  const { user } = useAuth();
  const [spinning, setSpinning] = useState(false);
  const [spinDone, setSpinDone] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const shieldRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.functions.invoke("gamification", {
        body: { action: "status" },
      });
      if (data?.ok) {
        setSpinDone(!!data.spin_done);
        setCheckinDone(!!data.checkin_done);
        setStreak(data.streak ?? 0);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleCheckin = async () => {
    setCheckinLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gamification", {
        body: { action: "checkin" },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Erro");
      setCheckinDone(true);
      setStreak(data.streak ?? streak + 1);
      toast.success(`Check-in feito! +R$0,50 · Streak: ${data.streak} dia(s) 🔥`);
    } catch (e: any) {
      toast.error(e.message || "Erro no check-in");
    }
    setCheckinLoading(false);
  };

  const handleSpin = async () => {
    if (spinning || spinDone) return;
    setSpinning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("gamification", {
        body: { action: "spin" },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Erro");

      const prize = data.prize;
      // Find the prize index
      let prizeIdx = PRIZES.findIndex((p) => p.amount === prize);
      if (prizeIdx === -1) prizeIdx = 6; // "Tente amanhã"

      // Calculate rotation: at least 5 full spins + land on the prize segment
      const targetAngle = 360 - prizeIdx * SEGMENT_ANGLE - SEGMENT_ANGLE / 2;
      const totalRotation = rotation + 360 * 6 + targetAngle;
      setRotation(totalRotation);

      // Wait for animation
      setTimeout(() => {
        setResult(prize);
        setSpinDone(true);
        setSpinning(false);
        if (prize > 0) {
          toast.success(`🎉 Parabéns! Você ganhou R$${Number(prize).toFixed(2)}!`);
        } else {
          toast("Tente novamente amanhã! 🛡️");
        }
      }, 4000);
    } catch (e: any) {
      toast.error(e.message || "Erro na roleta");
      setSpinning(false);
    }
  };

  const shieldColors = {
    outerRing: "hsl(0, 84%, 50%)",
    secondRing: "hsl(0, 0%, 98%)",
    thirdRing: "hsl(0, 84%, 50%)",
    innerCircle: "hsl(224, 76%, 33%)",
    star: "hsl(0, 0%, 98%)",
  };

  return (
    <div className="min-h-screen p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="font-heading text-2xl text-foreground flex items-center justify-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Girar o Escudo
        </h1>
        <p className="text-sm text-muted-foreground">
          Gire o escudo do Capitão América uma vez por dia e ganhe prêmios!
        </p>
      </div>

      {/* Check-in Card */}
      <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Flame className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Check-in Diário</p>
              <p className="text-xs text-muted-foreground">
                {checkinDone ? `Streak: ${streak} dia(s) 🔥` : "Faça check-in para ganhar R$0,50"}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            disabled={checkinDone || checkinLoading || loading}
            onClick={handleCheckin}
            className={checkinDone ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground hover:bg-accent/90"}
          >
            {checkinLoading ? "..." : checkinDone ? "✓ Feito" : "Check-in"}
          </Button>
        </div>
      </div>

      {/* Shield Wheel */}
      <div className="flex flex-col items-center gap-6">
        {/* Arrow indicator */}
        <div className="relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-accent drop-shadow-md" />
          </div>

          {/* The Shield / Wheel */}
          <div className="relative w-72 h-72 md:w-80 md:h-80">
            <svg
              ref={shieldRef}
              viewBox="0 0 300 300"
              className="w-full h-full drop-shadow-2xl"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              }}
            >
              {/* Outer red ring with segments */}
              <circle cx="150" cy="150" r="148" fill={shieldColors.outerRing} stroke="hsl(0,0%,20%)" strokeWidth="2" />
              
              {/* Segment lines on outer ring */}
              {PRIZES.map((_, i) => {
                const angle = (i * SEGMENT_ANGLE - 90) * (Math.PI / 180);
                const x2 = 150 + 148 * Math.cos(angle);
                const y2 = 150 + 148 * Math.sin(angle);
                const x1 = 150 + 105 * Math.cos(angle);
                const y1 = 150 + 105 * Math.sin(angle);
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(0,84%,40%)" strokeWidth="1.5" />
                );
              })}

              {/* Prize labels on outer ring */}
              {PRIZES.map((prize, i) => {
                const midAngle = ((i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2) - 90) * (Math.PI / 180);
                const labelR = 127;
                const x = 150 + labelR * Math.cos(midAngle);
                const y = 150 + labelR * Math.sin(midAngle);
                const textRotation = i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
                return (
                  <text
                    key={i}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="11"
                    fontWeight="bold"
                    transform={`rotate(${textRotation}, ${x}, ${y})`}
                  >
                    {prize.label.split("\n").map((line, li) => (
                      <tspan key={li} x={x} dy={li === 0 ? 0 : 12}>{line}</tspan>
                    ))}
                  </text>
                );
              })}

              {/* White ring */}
              <circle cx="150" cy="150" r="105" fill={shieldColors.secondRing} />
              
              {/* Inner red ring */}
              <circle cx="150" cy="150" r="80" fill={shieldColors.outerRing} />
              
              {/* Blue center circle */}
              <circle cx="150" cy="150" r="55" fill={shieldColors.innerCircle} />

              {/* White star */}
              <polygon
                points={Array.from({ length: 5 }, (_, i) => {
                  const outerAngle = (i * 72 - 90) * (Math.PI / 180);
                  const innerAngle = ((i * 72 + 36) - 90) * (Math.PI / 180);
                  const outerR = 35;
                  const innerR = 14;
                  return `${150 + outerR * Math.cos(outerAngle)},${150 + outerR * Math.sin(outerAngle)} ${150 + innerR * Math.cos(innerAngle)},${150 + innerR * Math.sin(innerAngle)}`;
                }).join(" ")}
                fill={shieldColors.star}
              />
            </svg>
          </div>
        </div>

        {/* Spin button */}
        <Button
          size="lg"
          disabled={spinning || spinDone || loading}
          onClick={handleSpin}
          className={`w-56 h-12 text-base font-heading gap-2 ${
            spinDone
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
          }`}
        >
          <Shield className="h-5 w-5" />
          {spinning ? "Girando..." : spinDone ? "Já girou hoje" : "Girar o Escudo!"}
        </Button>

        {/* Result */}
        {result !== null && (
          <div className="bg-card rounded-xl p-5 border border-border shadow-sm text-center space-y-2 animate-scale-in w-full max-w-sm">
            <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              {result > 0 ? (
                <Trophy className="h-6 w-6 text-accent" />
              ) : (
                <Gift className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <p className="font-heading text-lg text-foreground">
              {result > 0 ? `Você ganhou R$${result.toFixed(2)}!` : "Não foi dessa vez!"}
            </p>
            <p className="text-xs text-muted-foreground">
              {result > 0
                ? "O prêmio foi creditado na sua carteira pessoal."
                : "Tente novamente amanhã. Boa sorte! 🍀"}
            </p>
          </div>
        )}
      </div>

      {/* Prize table */}
      <div className="bg-card rounded-xl p-4 border border-border shadow-sm space-y-3">
        <h2 className="font-heading text-sm text-foreground">Tabela de Prêmios</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "R$1,00", chance: "40%" },
            { label: "R$5,00", chance: "25%" },
            { label: "R$10,00", chance: "15%" },
            { label: "R$20,00", chance: "10%" },
            { label: "R$50,00", chance: "5%" },
            { label: "R$100,00", chance: "3%" },
          ].map((p) => (
            <div key={p.label} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-foreground">{p.label}</span>
              <span className="text-xs text-muted-foreground">{p.chance}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpinWheel;
