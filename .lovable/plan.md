

## Adicionar Configurações de Tarefas por Nível VIP no Admin

### Contexto

A página `/admin/tasks` gerencia apenas os vídeos. Porém, as configurações de tarefas por nível VIP (quantidade de tarefas diárias, recompensa por tarefa, renda diária) estão na tabela `vip_levels` e não são editáveis nesta página. O usuário quer um painel unificado.

### Plano

Adicionar uma **segunda seção** na página `AdminTasks.tsx` — acima da tabela de vídeos — com uma tabela editável inline mostrando cada nível VIP e seus campos de tarefas:

| Nível | Tarefas Diárias | Recompensa/Tarefa | Renda Diária |
|-------|----------------|-------------------|--------------|
| Estagiário | 3 | R$ 0,50 | R$ 1,50 |
| VIP 1 | 5 | R$ 1,00 | R$ 5,00 |
| ... | ... | ... | ... |

**Campos editáveis inline** (da tabela `vip_levels`):
- `daily_tasks` — Quantidade de tarefas diárias
- `reward_per_task` — Recompensa por tarefa (R$)
- `daily_income` — Renda diária (R$)

**Implementação:**
1. Buscar todos os registros de `vip_levels` com `level_code, display_name, daily_tasks, reward_per_task, daily_income`
2. Exibir em uma tabela com inputs numéricos editáveis por linha
3. Botão "Salvar" por linha que faz `UPDATE` na `vip_levels` pelo `level_code`
4. Nenhuma alteração de banco — os campos já existem na tabela `vip_levels` e o admin já tem RLS `ALL`

**Arquivo alterado:** `src/pages/admin/AdminTasks.tsx` — adicionar card "Configuração de Tarefas por Nível" antes do card de vídeos.

