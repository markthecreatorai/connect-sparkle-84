

## Atualizar Critérios de Cargos e Salários

Os valores atuais na tabela `team_positions` estão desatualizados. Preciso atualizá-los conforme os novos critérios:

| Cargo | Diretos | Total Equipe | Salário Atual | Salário Novo |
|-------|---------|-------------|---------------|--------------|
| Assistente | 20 → **25** | 0 | R$600 → **R$500** | ✓ |
| Líder de Equipe | 40 (ok) | 0 | R$1.000 → **R$800** | ✓ |
| Senior Captain | 0 | 160 → **180** | R$2.500 → **R$1.500** | ✓ |
| Supervisor | 0 | 400 → **450** | R$4.000 → **R$2.600** | ✓ |
| Gerente Regional | 0 | 800 (ok) | R$8.000 → **R$4.200** | ✓ |
| Diretor de Marketing | 0 | 3000 → **1.500** | R$15.000 → **R$8.000** | ✓ |

### Implementação

Uma única migração SQL atualizando os 6 registros da tabela `team_positions` com os novos valores de `required_direct_referrals`, `required_total_team` e `monthly_salary`.

Nenhuma alteração de código necessária — a página Team.tsx e o admin já leem dinamicamente da tabela.

