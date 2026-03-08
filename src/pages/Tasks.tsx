import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, PlayCircle, Clock3, Trophy } from "lucide-react";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const levelToCode = (vipLevel: number | null | undefined) => {
  const lvl = Number(vipLevel ?? 0);
  if (!lvl || lvl <= 0) return "intern";
  return `vip${lvl}`;
};

const Tasks = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dailyTask, setDailyTask] = useState<any>(null);
  const [vipConf, setVipConf] = useState<any>(null);
  const [openTask, setOpenTask] = useState<number | null>(null);
  const [timer, setTimer] = useState(30);
  const [completing, setCompleting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const internDay = useMemo(() => {
    if (!profile?.created_at) return 1;
    const created = new Date(profile.created_at).getTime();
    const now = Date.now();
    const diff = Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)) + 1);
    return diff;
  }, [profile?.created_at]);

  const isIntern = Number(profile?.vip_level ?? 0) === 0;
  const internExpired = isIntern && internDay > 3;

  useEffect(() => {
    let intv: any;
    if (openTask !== null && timer > 0) {
      intv = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(intv);
  }, [openTask, timer]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      const vipCode = levelToCode(profile?.vip_level);

      const [vipRes, taskRes] = await Promise.all([
        supabase
          .from("vip_levels" as never)
          .select("level_code,daily_tasks,reward_per_task,daily_income")
          .eq("level_code", vipCode)
          .maybeSingle(),
        supabase
          .from("daily_tasks")
          .select("*")
          .eq("user_id", user.id)
          .eq("task_date", today)
          .maybeSingle(),
      ]);

      const vip = vipRes.data as any;
      setVipConf(vip);

      if (!taskRes.data && vip) {
        const insertPayload = {
          user_id: user.id,
          task_date: today,
          tasks_completed: 0,
          tasks_required: Number(vip.daily_tasks ?? 0),
          reward_per_task: Number(vip.reward_per_task ?? 0),
          total_earned: 0,
          vip_level: vipCode,
          is_completed: false,
        };

        const inserted = await supabase.from("daily_tasks").insert(insertPayload).select("*").maybeSingle();
        setDailyTask(inserted.data);
      } else {
        setDailyTask(taskRes.data);
      }

      setLoading(false);
    };

    load();
  }, [user, profile?.vip_level, today]);

  const progressPct = useMemo(() => {
    if (!dailyTask?.tasks_required) return 0;
    return Math.min(100, (Number(dailyTask.tasks_completed || 0) / Number(dailyTask.tasks_required || 1)) * 100);
  }, [dailyTask]);

  const completeTask = async () => {
    if (!user || !dailyTask || openTask === null) return;
    if (timer > 0) return;
    if (Number(dailyTask.tasks_completed) >= Number(dailyTask.tasks_required)) return;

    setCompleting(true);

    const { data, error } = await supabase.rpc("complete_daily_task" as any, {
      _user_id: user.id,
      _task_id: dailyTask.id,
      _task_number: openTask,
    });

    if (error) {
      toast.error("Falha ao concluir tarefa");
      setCompleting(false);
      return;
    }

    const result = data as any;
    if (!result?.success) {
      toast.error(result?.error || "Erro desconhecido");
      setCompleting(false);
      return;
    }

    setDailyTask({
      ...dailyTask,
      tasks_completed: result.tasks_completed,
      total_earned: result.total_earned,
      is_completed: result.is_completed,
    });
    setOpenTask(null);
    setTimer(30);
    setCompleting(false);

    if (result.is_completed) {
      toast.success("Parabéns! Você concluiu todas as tarefas do dia 🎉");
    } else {
      toast.success(`Tarefa concluída! +${fmtBRL(result.reward)}`);
    }
  };

  if (loading) {
    return <div className="p-4">Carregando tarefas...</div>;
  }

  if (internExpired) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <Card className="p-6 space-y-3">
          <h1 className="text-xl font-bold">Seu estágio terminou</h1>
          <p className="text-muted-foreground">
            Período de estágio: dia {internDay} de 3. Faça um depósito para ativar um plano VIP e continuar com tarefas.
          </p>
        </Card>
      </div>
    );
  }

  const tasksRequired = Number(dailyTask?.tasks_required || 0);
  const tasksCompleted = Number(dailyTask?.tasks_completed || 0);

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Tarefas do Dia</h1>
          <span className="text-sm text-muted-foreground">{today}</span>
        </div>

        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <p>
            Progresso: <b>{tasksCompleted} de {tasksRequired}</b>
          </p>
          <p>
            Renda hoje: <b>{fmtBRL(Number(dailyTask?.total_earned || 0))}</b>
          </p>
          {isIntern && <p className="text-warning">Período de estágio: dia {Math.min(internDay, 3)} de 3</p>}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        {Array.from({ length: tasksRequired }).map((_, i) => {
          const taskNum = i + 1;
          const isDone = taskNum <= tasksCompleted;
          return (
            <Card key={taskNum} className={`p-4 flex items-center justify-between ${isDone ? "opacity-70" : ""}`}>
              <div>
                <p className="font-semibold">Tarefa {taskNum}</p>
                <p className="text-xs text-muted-foreground">
                  {isDone ? "Concluída ✓" : "Pendente"} · +{fmtBRL(Number(dailyTask?.reward_per_task || 0))}
                </p>
              </div>
              {isDone ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <Button size="sm" onClick={() => { setOpenTask(taskNum); setTimer(30); }}>
                  <PlayCircle className="h-4 w-4 mr-1" /> Iniciar
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={openTask !== null} onOpenChange={(o) => { if (!o) { setOpenTask(null); setTimer(30); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Executar Tarefa {openTask}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Simulação de atividade: aguarde o timer para habilitar a conclusão.
            </p>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Clock3 className="h-5 w-5" /> {timer}s
            </div>
            <Button disabled={timer > 0 || completing} onClick={completeTask} className="w-full">
              {completing ? "Concluindo..." : <><Trophy className="h-4 w-4 mr-1" /> Concluir tarefa</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;
