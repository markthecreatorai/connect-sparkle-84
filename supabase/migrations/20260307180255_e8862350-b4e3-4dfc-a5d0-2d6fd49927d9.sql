
CREATE OR REPLACE FUNCTION public.distribute_deposit_commissions(p_user_id uuid, p_deposit_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _config jsonb;
  _pct_a numeric;
  _pct_b numeric;
  _pct_c numeric;
  _ref referral_tree%ROWTYPE;
  _comm_amount numeric;
  _wallet_id uuid;
  _current_balance numeric;
  _new_balance numeric;
BEGIN
  -- 1) Read commission config
  SELECT value::jsonb INTO _config
  FROM platform_config
  WHERE key = 'referral_deposit_commission';

  _pct_a := COALESCE((_config->>'level_a')::numeric, 0);
  _pct_b := COALESCE((_config->>'level_b')::numeric, 0);
  _pct_c := COALESCE((_config->>'level_c')::numeric, 0);

  -- 2) Read referral chain
  SELECT * INTO _ref FROM referral_tree WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 3) Level A → wallet personal
  IF _ref.level_a_referrer IS NOT NULL AND _pct_a > 0 THEN
    _comm_amount := ROUND(p_deposit_amount * _pct_a / 100, 2);
    IF _comm_amount > 0 THEN
      SELECT id, COALESCE(balance, 0) INTO _wallet_id, _current_balance
      FROM wallets WHERE user_id = _ref.level_a_referrer AND wallet_type = 'personal';

      IF _wallet_id IS NOT NULL THEN
        _new_balance := _current_balance + _comm_amount;
        UPDATE wallets SET balance = _new_balance, updated_at = now() WHERE id = _wallet_id;

        INSERT INTO transactions (user_id, type, wallet_type, amount, balance_after, description, metadata)
        VALUES (
          _ref.level_a_referrer,
          'referral_deposit_commission',
          'personal',
          _comm_amount,
          _new_balance,
          'Comissão N1 depósito',
          jsonb_build_object('from_user', p_user_id, 'level', 'A', 'deposit_amount', p_deposit_amount)
        );
      END IF;
    END IF;
  END IF;

  -- 4) Level B → wallet income
  IF _ref.level_b_referrer IS NOT NULL AND _pct_b > 0 THEN
    _comm_amount := ROUND(p_deposit_amount * _pct_b / 100, 2);
    IF _comm_amount > 0 THEN
      SELECT id, COALESCE(balance, 0) INTO _wallet_id, _current_balance
      FROM wallets WHERE user_id = _ref.level_b_referrer AND wallet_type = 'income';

      IF _wallet_id IS NOT NULL THEN
        _new_balance := _current_balance + _comm_amount;
        UPDATE wallets SET balance = _new_balance, updated_at = now() WHERE id = _wallet_id;

        INSERT INTO transactions (user_id, type, wallet_type, amount, balance_after, description, metadata)
        VALUES (
          _ref.level_b_referrer,
          'referral_deposit_commission',
          'income',
          _comm_amount,
          _new_balance,
          'Comissão N2 depósito',
          jsonb_build_object('from_user', p_user_id, 'level', 'B', 'deposit_amount', p_deposit_amount)
        );
      END IF;
    END IF;
  END IF;

  -- 5) Level C → wallet income
  IF _ref.level_c_referrer IS NOT NULL AND _pct_c > 0 THEN
    _comm_amount := ROUND(p_deposit_amount * _pct_c / 100, 2);
    IF _comm_amount > 0 THEN
      SELECT id, COALESCE(balance, 0) INTO _wallet_id, _current_balance
      FROM wallets WHERE user_id = _ref.level_c_referrer AND wallet_type = 'income';

      IF _wallet_id IS NOT NULL THEN
        _new_balance := _current_balance + _comm_amount;
        UPDATE wallets SET balance = _new_balance, updated_at = now() WHERE id = _wallet_id;

        INSERT INTO transactions (user_id, type, wallet_type, amount, balance_after, description, metadata)
        VALUES (
          _ref.level_c_referrer,
          'referral_deposit_commission',
          'income',
          _comm_amount,
          _new_balance,
          'Comissão N3 depósito',
          jsonb_build_object('from_user', p_user_id, 'level', 'C', 'deposit_amount', p_deposit_amount)
        );
      END IF;
    END IF;
  END IF;
END;
$function$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.distribute_deposit_commissions(uuid, numeric) TO authenticated;
