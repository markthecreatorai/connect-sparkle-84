import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, Crown, CheckSquare, Users, Briefcase, ArrowUpFromLine, TrendingUp, BookOpen, Shield, Star, Zap } from "lucide-react";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface VipLevel {
  level_code: string;
  display_name: string;
  deposit_required: number;
  daily_tasks: number;
  reward_per_task: number;
  daily_income: number;
  monthly_income: number;
  yearly_income: number;
  is_available: boolean;
  sort_order: number;
}

const Guide = () => {
  const [loading, setLoading] = useState(true);
  const [vipLevels, setVipLevels] = useState<VipLevel[]>([]);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [positions, setPositions] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [vipRes, configRes, posRes] = await Promise.all([
        supabase.from("vip_levels" as never).select("*").order("sort_order", { ascending: true }),
        supabase.rpc("get_public_platform_config", { _keys: ["referral_deposit_commission", "referral_task_commission", "withdrawal_hours", "withdrawal_amounts", "tax_rate", "investment_plans"] }),
        supabase.from("team_positions").select("*").order("sort_order", { ascending: true }),
      ]);

      setVipLevels((vipRes.data as unknown as VipLevel[]) ?? []);

      const cfgMap: Record<string, any> = {};
      (configRes.data ?? []).forEach((c: any) => { cfgMap[c.key] = c.value; });
      setConfig(cfgMap);

      setPositions(posRes.data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const depComm = config.referral_deposit_commission ?? { level_a: 12, level_b: 4, level_c: 2 };
  const taskComm = config.referral_task_commission ?? { level_a: 5, level_b: 3, level_c: 1 };
  const taxRate = config.tax_rate?.percentage ?? 10;
  const wdHours = config.withdrawal_hours ?? { start: "11:00", end: "17:00" };
  const wdAmounts = Array.isArray(config.withdrawal_amounts) ? config.withdrawal_amounts : [50, 150, 300, 500, 1000, 2000, 4000, 7000];
  const investPlans = config.investment_plans ?? { "7": 1.5, "10": 3, "15": 5, "30": 12 };

  const paidVipLevels = vipLevels.filter((v) => v.deposit_required > 0);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-3">
        <Skeleton className="h-8 w-48" />
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h1 className="font-heading text-xl font-bold">Como Funciona</h1>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {/* ABOUT */}
        <AccordionItem value="about" className="glass-card rounded-xl border-none px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="font-semibold">Sobre a AvengersPay</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
            <p className="font-semibold text-foreground">Onde heróis comuns se tornam os verdadeiros Vingadores do Marketing Marvel</p>
            <p>A <b>AvengersPay</b> é uma empresa de marketing e publicidade 100% temática Marvel, especializada em inteligência coletiva de fãs.</p>
            <p>Criamos uma plataforma gamificada onde entusiastas do MCU e quadrinhos realizam tarefas online simples e divertidas:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Avaliação de artes visuais conceituais</li>
              <li>Análise detalhada de trailers</li>
              <li>Críticas estruturadas de filmes e séries</li>
              <li>Feedback sobre fotografia, direção de arte, efeitos visuais e trilha sonora</li>
            </ul>
            <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-1"><Star className="h-3.5 w-3.5 text-warning" /> Nossa Missão</p>
              <p>Usamos o poder das avaliações reais dos fãs para entregar feedback estratégico diretamente para os estúdios Marvel — decisões de produção, design de personagens, cinematografia e engajamento global.</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-warning" /> Renda Extra com Poder Ilimitado</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Pagamento por tarefa (missões rápidas)</li>
                <li>Bônus por performance e streaks diários</li>
                <li>Sistema de rede Avengers — monte sua equipe de heróis</li>
                <li>Comissões recorrentes sobre o desempenho da sua rede</li>
                <li>Prêmios de gestão exclusivos</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* WALLETS */}
        <AccordionItem value="wallets" className="glass-card rounded-xl border-none px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="font-semibold">Como funcionam os Saldos</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
            <p>A plataforma possui <b>3 carteiras independentes</b>:</p>
            <div className="space-y-2">
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="font-semibold text-primary">💳 Carteira de Recarga</p>
                <p>Recebe seus depósitos via PIX. Usada para ativar planos VIP e investimentos. <b>Sem imposto ao sacar.</b></p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="font-semibold text-warning">👤 Saldo Pessoal</p>
                <p>Representa o valor acumulado exclusivamente pelas suas atividades na plataforma: recompensas de tarefas, bônus de check-in, prêmios da roleta e comissões de Nível A (diretas). Taxa de {taxRate}% ao sacar.</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="font-semibold text-success">👥 Saldo de Renda</p>
                <p>Refere-se ao montante proveniente da ativação de novos membros na sua rede: comissões de Nível B e C (equipe indireta), bônus de indicação e bonificações associadas ao crescimento da sua estrutura. Taxa de {taxRate}% ao sacar.</p>
              </div>
            </div>
            <div className="rounded-lg border border-border/50 p-3 text-xs">
              <p className="font-semibold text-foreground mb-1">⚠️ Importante</p>
              <p>Essa separação permite maior controle e transparência, distinguindo claramente o que foi conquistado de forma individual (Saldo Pessoal) do que foi obtido via rede e indicações (Saldo de Renda). <b>Não é possível misturar os saldos no mesmo pedido de saque.</b></p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* VIP LEVELS */}
        <AccordionItem value="vip" className="glass-card rounded-xl border-none px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-warning" />
              <span className="font-semibold">Níveis VIP — Tarefas e Rendimentos</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
            <p>Cada nível VIP desbloqueia mais tarefas e maiores recompensas diárias.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-1.5 pr-2">Nível</th>
                    <th className="py-1.5 pr-2">Depósito</th>
                    <th className="py-1.5 pr-2">Tarefas</th>
                    <th className="py-1.5 pr-2">R$/Tarefa</th>
                    <th className="py-1.5 pr-2">Renda/Dia</th>
                    <th className="py-1.5 pr-2">30 Dias</th>
                    <th className="py-1.5">360 Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {vipLevels.map((v) => (
                    <tr key={v.level_code} className="border-b border-border/30">
                      <td className="py-1.5 pr-2 font-medium">{v.display_name} {!v.is_available ? "🔒" : ""}</td>
                      <td className="py-1.5 pr-2">{fmtBRL(v.deposit_required)}</td>
                      <td className="py-1.5 pr-2">{v.daily_tasks}</td>
                      <td className="py-1.5 pr-2">{fmtBRL(v.reward_per_task)}</td>
                      <td className="py-1.5 pr-2">{fmtBRL(v.daily_income)}</td>
                      <td className="py-1.5 pr-2">{v.monthly_income > 0 ? fmtBRL(v.monthly_income) : "—"}</td>
                      <td className="py-1.5">{v.yearly_income > 0 ? fmtBRL(v.yearly_income) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs">Ao fazer upgrade, o depósito anterior é devolvido à Carteira de Recarga em até 36 horas.</p>
          </AccordionContent>
        </AccordionItem>

        {/* TASKS */}
        <AccordionItem value="tasks" className="glass-card rounded-xl border-none px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-success" />
              <span className="font-semibold">Sistema de Tarefas</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2 pb-4">
            <p>Complete suas tarefas diárias para ganhar recompensas na Carteira Pessoal.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>O número de tarefas e o valor por tarefa dependem do seu nível VIP.</li>
              <li>Estagiários têm 3 dias gratuitos com 3 tarefas/dia (R$1,00 cada).</li>
              <li>Após os 3 dias, é necessário ativar um plano VIP para continuar.</li>
              <li>As tarefas são renovadas todo dia à meia-noite.</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        {/* REFERRAL */}
        <AccordionItem value="referral" className="glass-card rounded-xl border-none px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-semibold">Sistema de Indicação e Comissões</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-4 pb-4">
            <p>Convide amigos e ganhe comissões em <b>3 níveis</b>:</p>

            {/* Deposit/Activation commissions */}
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Comissão sobre Depósitos / Ativação VIP ({depComm.level_a}% – {depComm.level_b}% – {depComm.level_c}%)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-1.5 pr-2">Nível</th>
                      <th className="py-1.5 pr-2">Valor Recarga</th>
                      <th className="py-1.5 pr-2">Nível A ({depComm.level_a}%)</th>
                      <th className="py-1.5 pr-2">Nível B ({depComm.level_b}%)</th>
                      <th className="py-1.5">Nível C ({depComm.level_c}%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidVipLevels.map((v) => (
                      <tr key={v.level_code} className="border-b border-border/30">
                        <td className="py-1.5 pr-2 font-medium">{v.display_name}</td>
                        <td className="py-1.5 pr-2">{fmtBRL(v.deposit_required)}</td>
                        <td className="py-1.5 pr-2">{fmtBRL(v.deposit_required * depComm.level_a / 100)}</td>
                        <td className="py-1.5 pr-2">{fmtBRL(v.deposit_required * depComm.level_b / 100)}</td>
                        <td className="py-1.5">{fmtBRL(v.deposit_required * depComm.level_c / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs">Nível A → Carteira Pessoal · Níveis B e C → Carteira de Renda</p>
            </div>

            {/* Task commissions */}
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Comissão sobre Tarefas dos Indicados ({taskComm.level_a}% – {taskComm.level_b}% – {taskComm.level_c}%)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-1.5 pr-2">Nível</th>
                      <th className="py-1.5 pr-2">Renda/Dia do Indicado</th>
                      <th className="py-1.5 pr-2">Nível A ({taskComm.level_a}%)</th>
                      <th className="py-1.5 pr-2">Nível B ({taskComm.level_b}%)</th>
                      <th className="py-1.5">Nível C ({taskComm.level_c}%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidVipLevels.map((v) => (
                      <tr key={v.level_code} className="border-b border-border/30">
                        <td className="py-1.5 pr-2 font-medium">{v.display_name}</td>
                        <td className="py-1.5 pr-2">{fmtBRL(v.daily_income)}</td>
                        <td className="py-1.5 pr-2">{fmtBRL(v.daily_income * taskComm.level_a / 100)}</td>
                        <td className="py-1.5 pr-2">{fmtBRL(v.daily_income * taskComm.level_b / 100)}</td>
                        <td className="py-1.5">{fmtBRL(v.daily_income * taskComm.level_c / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* POSITIONS */}
        <AccordionItem value="positions" className="glass-card rounded-xl border-none px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-accent" />
              <span className="font-semibold">Cargos e Salários</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
            <p>Ao crescer sua equipe, você desbloqueia cargos com salário mensal:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-1.5 pr-2">Cargo</th>
                    <th className="py-1.5 pr-2">Diretos</th>
                    <th className="py-1.5 pr-2">Equipe Total</th>
                    <th className="py-1.5">Salário/Mês</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id} className="border-b border-border/30">
                      <td className="py-1.5 pr-2 font-medium">{p.display_name}</td>
                      <td className="py-1.5 pr-2">{p.required_direct_referrals || "—"}</td>
                      <td className="py-1.5 pr-2">{p.required_total_team || "—"}</td>
                      <td className="py-1.5">{fmtBRL(Number(p.monthly_salary))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* WITHDRAW */}
        <AccordionItem value="withdraw" className="glass-card rounded-xl border-none px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2">
              <ArrowUpFromLine className="h-4 w-4 text-destructive" />
              <span className="font-semibold">Como Sacar</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
            <ul className="list-disc pl-5 space-y-1">
              <li>Horário permitido: <b>{wdHours.start} às {wdHours.end}</b></li>
              <li>Valores disponíveis: {wdAmounts.map((a: number) => fmtBRL(a)).join(", ")}</li>
              <li>Taxa sobre Saldo Pessoal e de Renda: <b>{taxRate}%</b></li>
              <li>Carteira de Recarga: <b>sem taxa</b></li>
              <li>Cadastre sua chave PIX e senha de pagamento no Perfil antes de sacar</li>
              <li>Saques são processados manualmente e podem levar até 24 horas</li>
            </ul>
            <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
              <p className="font-semibold text-foreground">Processo de Saque</p>
              <ol className="list-decimal pl-5 space-y-1 text-xs">
                <li>Escolha de qual carteira deseja sacar: <b>Saldo Pessoal</b> ou <b>Saldo de Renda</b>.</li>
                <li>Não é possível misturar saldos no mesmo pedido.</li>
                <li>O método de recebimento é <b>PIX — Transferência Instantânea</b>.</li>
                <li>Sua chave PIX (e-mail, CPF, telefone etc.) deve estar previamente validada no sistema.</li>
              </ol>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* INVESTMENTS */}
        <AccordionItem value="investments" className="glass-card rounded-xl border-none px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="font-semibold">Investimentos</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2 pb-4">
            <p>Aplique seu saldo e receba juros ao final do período:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-1.5 pr-2">Período</th>
                    <th className="py-1.5">Rendimento</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(investPlans).sort(([a], [b]) => Number(a) - Number(b)).map(([days, pct]) => (
                    <tr key={days} className="border-b border-border/30">
                      <td className="py-1.5 pr-2">{days} dias</td>
                      <td className="py-1.5">{String(pct)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Valor mínimo: R$50,00</li>
              <li>Ordem de débito: Renda → Pessoal → Recarga</li>
              <li>No resgate, cada valor retorna à carteira de origem</li>
              <li>Juros são creditados na Carteira Pessoal</li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default Guide;
