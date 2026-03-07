-- FASE 7.2
-- Comissão por tarefas de subordinados: 5% / 3% / 1%

create or replace function public.distribute_task_commissions(
  p_user_id uuid,
  p_task_reward numeric
)
returns void
language plpgsql
security definer
as $$
declare
  v_referral record;
  v_cfg jsonb;
  v_commission numeric := 0;
begin
  select value into v_cfg
  from public.platform_config
  where key = 'referral_task_commission';

  if v_cfg is null then
    v_cfg := jsonb_build_object('level_a', 5, 'level_b', 3, 'level_c', 1);
  end if;

  select * into v_referral
  from public.referral_tree
  where user_id = p_user_id;

  if not found then
    return;
  end if;

  -- Nível A -> carteira renda
  if v_referral.level_a_referrer is not null then
    v_commission := p_task_reward * coalesce((v_cfg->>'level_a')::numeric, 0) / 100;

    if v_commission > 0 then
      update public.wallets
        set balance = coalesce(balance,0) + v_commission,
            updated_at = now()
        where user_id = v_referral.level_a_referrer
          and wallet_type = 'income';

      insert into public.transactions(user_id, type, wallet_type, amount, description, metadata)
      values (
        v_referral.level_a_referrer,
        'referral_task_commission',
        'income',
        v_commission,
        'Comissão de tarefa - Nível A',
        jsonb_build_object('from_user', p_user_id, 'level', 'A', 'task_reward', p_task_reward)
      );
    end if;
  end if;

  -- Nível B -> carteira renda
  if v_referral.level_b_referrer is not null then
    v_commission := p_task_reward * coalesce((v_cfg->>'level_b')::numeric, 0) / 100;

    if v_commission > 0 then
      update public.wallets
        set balance = coalesce(balance,0) + v_commission,
            updated_at = now()
        where user_id = v_referral.level_b_referrer
          and wallet_type = 'income';

      insert into public.transactions(user_id, type, wallet_type, amount, description, metadata)
      values (
        v_referral.level_b_referrer,
        'referral_task_commission',
        'income',
        v_commission,
        'Comissão de tarefa - Nível B',
        jsonb_build_object('from_user', p_user_id, 'level', 'B', 'task_reward', p_task_reward)
      );
    end if;
  end if;

  -- Nível C -> carteira renda
  if v_referral.level_c_referrer is not null then
    v_commission := p_task_reward * coalesce((v_cfg->>'level_c')::numeric, 0) / 100;

    if v_commission > 0 then
      update public.wallets
        set balance = coalesce(balance,0) + v_commission,
            updated_at = now()
        where user_id = v_referral.level_c_referrer
          and wallet_type = 'income';

      insert into public.transactions(user_id, type, wallet_type, amount, description, metadata)
      values (
        v_referral.level_c_referrer,
        'referral_task_commission',
        'income',
        v_commission,
        'Comissão de tarefa - Nível C',
        jsonb_build_object('from_user', p_user_id, 'level', 'C', 'task_reward', p_task_reward)
      );
    end if;
  end if;
end;
$$;

grant execute on function public.distribute_task_commissions(uuid, numeric) to authenticated;
