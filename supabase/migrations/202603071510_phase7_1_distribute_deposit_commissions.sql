-- FASE 7.1
-- Comissão por depósito: 12% / 4% / 2%

create or replace function public.distribute_deposit_commissions(
  p_user_id uuid,
  p_deposit_amount numeric
)
returns void
language plpgsql
security definer
as $$
declare
  v_referral record;
  v_cfg jsonb;
  v_a numeric := 0;
  v_b numeric := 0;
  v_c numeric := 0;
begin
  select value into v_cfg
  from public.platform_config
  where key = 'referral_deposit_commission';

  if v_cfg is null then
    v_cfg := jsonb_build_object('level_a', 12, 'level_b', 4, 'level_c', 2);
  end if;

  select * into v_referral
  from public.referral_tree
  where user_id = p_user_id;

  if not found then
    return;
  end if;

  -- Nível A -> carteira pessoal
  if v_referral.level_a_referrer is not null then
    v_a := p_deposit_amount * coalesce((v_cfg->>'level_a')::numeric, 0) / 100;

    update public.wallets
      set balance = coalesce(balance,0) + v_a,
          updated_at = now()
      where user_id = v_referral.level_a_referrer
        and wallet_type = 'personal';

    insert into public.transactions(user_id, type, wallet_type, amount, description, metadata)
    values (
      v_referral.level_a_referrer,
      'referral_deposit_commission',
      'personal',
      v_a,
      'Comissão de depósito - Nível A',
      jsonb_build_object('from_user', p_user_id, 'level', 'A', 'deposit_amount', p_deposit_amount)
    );
  end if;

  -- Nível B -> carteira renda
  if v_referral.level_b_referrer is not null then
    v_b := p_deposit_amount * coalesce((v_cfg->>'level_b')::numeric, 0) / 100;

    update public.wallets
      set balance = coalesce(balance,0) + v_b,
          updated_at = now()
      where user_id = v_referral.level_b_referrer
        and wallet_type = 'income';

    insert into public.transactions(user_id, type, wallet_type, amount, description, metadata)
    values (
      v_referral.level_b_referrer,
      'referral_deposit_commission',
      'income',
      v_b,
      'Comissão de depósito - Nível B',
      jsonb_build_object('from_user', p_user_id, 'level', 'B', 'deposit_amount', p_deposit_amount)
    );
  end if;

  -- Nível C -> carteira renda
  if v_referral.level_c_referrer is not null then
    v_c := p_deposit_amount * coalesce((v_cfg->>'level_c')::numeric, 0) / 100;

    update public.wallets
      set balance = coalesce(balance,0) + v_c,
          updated_at = now()
      where user_id = v_referral.level_c_referrer
        and wallet_type = 'income';

    insert into public.transactions(user_id, type, wallet_type, amount, description, metadata)
    values (
      v_referral.level_c_referrer,
      'referral_deposit_commission',
      'income',
      v_c,
      'Comissão de depósito - Nível C',
      jsonb_build_object('from_user', p_user_id, 'level', 'C', 'deposit_amount', p_deposit_amount)
    );
  end if;
end;
$$;

grant execute on function public.distribute_deposit_commissions(uuid, numeric) to authenticated;
