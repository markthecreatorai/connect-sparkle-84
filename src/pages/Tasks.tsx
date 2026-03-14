import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, PlayCircle, Clock3, Trophy, Star, ChevronRight, Video } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const levelToCode = (vipLevel: number | null | undefined) => {
  const lvl = Number(vipLevel ?? 0);
  if (!lvl || lvl <= 0) return "intern";
  return `vip${lvl}`;
};

type VideoItem = { id: string; title: string };

type VideoStatus = "pending" | "watching" | "completed";

const Tasks = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dailyTask, setDailyTask] = useState<any>(null);
  const [vipConf, setVipConf] = useState<any>(null);
  const [openTask, setOpenTask] = useState<number | null>(null);
  const [watchTimer, setWatchTimer] = useState(10);
  const [canRate, setCanRate] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [videoPool, setVideoPool] = useState<VideoItem[]>([]);

  const today = new Date().toISOString().slice(0, 10);

  const internDay = useMemo(() => {
    if (!profile?.created_at) return 1;
    const created = new Date(profile.created_at).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)) + 1);
  }, [profile?.created_at]);

  const isIntern = Number(profile?.vip_level ?? 0) === 0;
  const internExpired = isIntern && internDay > 3;

  // Watch timer countdown
  useEffect(() => {
    let intv: any;
    if (openTask !== null && watchTimer > 0) {
      intv = setInterval(() => setWatchTimer((t) => {
        if (t <= 1) {
          setCanRate(true);
          return 0;
        }
        return t - 1;
      }), 1000);
    }
    return () => clearInterval(intv);
  }, [openTask, watchTimer]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      const vipCode = levelToCode(profile?.vip_level);

      const [vipRes, taskRes, videosRes] = await Promise.all([
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
        supabase
          .from("task_videos")
          .select("youtube_id, title")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      const vids = ((videosRes.data as any[]) || []).map((v: any) => ({ id: v.youtube_id, title: v.title }));
      setVideoPool(vids.length > 0 ? vids : [{ id: "dQw4w9WgXcQ", title: "Vídeo padrão" }]);

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

  const openVideoTask = useCallback((taskNum: number) => {
    setOpenTask(taskNum);
    setWatchTimer(10);
    setCanRate(false);
    setRating(0);
    setHoverRating(0);
  }, []);

  const completeTask = async () => {
    if (!user || !dailyTask || openTask === null) return;
    if (!canRate || rating === 0) return;
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

    const updatedTask = {
      ...dailyTask,
      tasks_completed: result.tasks_completed,
      total_earned: result.total_earned,
      is_completed: result.is_completed,
    };
    setDailyTask(updatedTask);
    setCompleting(false);

    if (result.is_completed) {
      setOpenTask(null);
      toast.success("Parabéns! Você concluiu todas as tarefas do dia 🎉");
    } else {
      toast.success(`Tarefa concluída! +${fmtBRL(result.reward)}`);
      // Auto-advance to next task
      const nextTaskNum = openTask + 1;
      if (nextTaskNum <= Number(dailyTask.tasks_required)) {
        setTimeout(() => openVideoTask(nextTaskNum), 800);
      } else {
        setOpenTask(null);
      }
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

  const getVideoForTask = (taskNum: number) => {
    // Rotate through video pool using date seed + task number
    const dateSeed = today.replace(/-/g, "");
    const index = (parseInt(dateSeed) + taskNum) % (videoPool.length || 1);
    return videoPool[index] || { id: "dQw4w9WgXcQ", title: "Vídeo" };
  };

  const getTaskStatus = (taskNum: number): VideoStatus => {
    if (taskNum <= tasksCompleted) return "completed";
    if (openTask === taskNum) return "watching";
    return "pending";
  };

  const currentVideo = openTask ? getVideoForTask(openTask) : null;

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
      {/* Progress Header */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            <h1 className="font-heading text-xl font-bold">Tarefas do Dia</h1>
          </div>
          <span className="text-sm text-muted-foreground">{today}</span>
        </div>

        <Progress value={progressPct} className="h-2.5" />

        <div className="flex flex-wrap gap-4 text-sm">
          <p>
            Progresso: <b className="text-foreground">{tasksCompleted} de {tasksRequired}</b>
          </p>
          <p>
            Renda hoje: <b className="text-primary">{fmtBRL(Number(dailyTask?.total_earned || 0))}</b>
          </p>
          <p>
            Por tarefa: <b className="text-foreground">{fmtBRL(Number(dailyTask?.reward_per_task || 0))}</b>
          </p>
          {isIntern && <p className="text-warning">Período de estágio: dia {Math.min(internDay, 3)} de 3</p>}
        </div>
      </Card>

      {/* Video Task Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: tasksRequired }).map((_, i) => {
          const taskNum = i + 1;
          const video = getVideoForTask(taskNum);
          const status = getTaskStatus(taskNum);
          const isDone = status === "completed";
          const isNext = taskNum === tasksCompleted + 1;

          return (
            <Card
              key={taskNum}
              className={`overflow-hidden transition-all ${
                isDone ? "opacity-60" : isNext ? "ring-1 ring-primary/40 shadow-md" : ""
              }`}
            >
              {/* Video Thumbnail */}
              <div className="relative aspect-video bg-secondary">
                <img
                  src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                  alt={video.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {isDone && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                    <CheckCircle2 className="h-10 w-10 text-success" />
                  </div>
                )}
                {!isDone && (
                  <div className="absolute inset-0 bg-background/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <PlayCircle className="h-12 w-12 text-foreground drop-shadow-lg" />
                  </div>
                )}
                {/* Task number badge */}
                <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs font-bold">
                  #{taskNum}
                </div>
                {/* Status badge */}
                <div className={`absolute top-2 right-2 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                  isDone
                    ? "bg-success/20 text-success"
                    : isNext
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {isDone ? "Concluído" : isNext ? "Próxima" : "Pendente"}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-3 space-y-2">
                <p className="text-sm font-semibold line-clamp-1">{video.title}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    +{fmtBRL(Number(dailyTask?.reward_per_task || 0))}
                  </span>
                  {isDone ? (
                    <span className="text-xs text-success font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Feito
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant={isNext ? "default" : "outline"}
                      className={`text-xs h-7 ${isNext ? "gradient-primary text-primary-foreground" : ""}`}
                      onClick={() => openVideoTask(taskNum)}
                      disabled={taskNum > tasksCompleted + 1}
                    >
                      <PlayCircle className="h-3.5 w-3.5 mr-1" />
                      {isNext ? "Assistir" : "Bloqueado"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Video Watch + Rate Dialog */}
      <Dialog open={openTask !== null} onOpenChange={(o) => { if (!o) { setOpenTask(null); setWatchTimer(10); setCanRate(false); setRating(0); } }}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <div className="p-4 pb-0">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" />
                Tarefa {openTask} — {currentVideo?.title}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Embedded Video */}
          {currentVideo && (
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${currentVideo.id}?autoplay=1&rel=0`}
                title={currentVideo.title}
                className="w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* Watch timer */}
            {!canRate && (
              <div className="flex items-center justify-center gap-3 py-2">
                <Clock3 className="h-5 w-5 text-muted-foreground animate-pulse" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Assista por pelo menos 10 segundos</span>
                    <span className="font-mono font-bold text-foreground">{watchTimer}s</span>
                  </div>
                  <Progress value={((10 - watchTimer) / 10) * 100} className="h-1.5" />
                </div>
              </div>
            )}

            {/* Rating section */}
            {canRate && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-center">Avalie este vídeo para concluir a tarefa</p>
                <div className="flex items-center justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-8 w-8 transition-colors ${
                          star <= (hoverRating || rating)
                            ? "text-yellow-500 fill-yellow-500"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-xs text-center text-muted-foreground">
                    {rating === 1 ? "😕 Ruim" : rating === 2 ? "😐 Regular" : rating === 3 ? "🙂 Bom" : rating === 4 ? "😊 Muito bom" : "🤩 Excelente!"}
                  </p>
                )}
              </div>
            )}

            {/* Complete button */}
            <Button
              disabled={!canRate || rating === 0 || completing}
              onClick={completeTask}
              className="w-full gradient-primary text-primary-foreground"
            >
              {completing ? (
                "Concluindo..."
              ) : !canRate ? (
                <>
                  <Clock3 className="h-4 w-4 mr-1.5" /> Aguarde o tempo mínimo
                </>
              ) : rating === 0 ? (
                <>
                  <Star className="h-4 w-4 mr-1.5" /> Avalie para concluir
                </>
              ) : (
                <>
                  <Trophy className="h-4 w-4 mr-1.5" /> Concluir e avançar
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;
