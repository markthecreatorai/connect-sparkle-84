CREATE OR REPLACE FUNCTION public.complete_daily_task(_user_id uuid, _task_id uuid, _task_number integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _task RECORD;
  _reward numeric;
  _next_completed int;
  _next_total numeric;
  _done boolean;
  _wallet_id uuid;
  _wallet_balance numeric;
  _new_balance numeric;
  _config jsonb;
  _pct_a numeric;
  _pct_b numeric;
  _pct_c numeric;
  _ref referral_tree%ROWTYPE;
  _comm_amount numeric;
  _w_id uuid;
  _w_bal numeric;
  _new_w_bal numeric;
BEGIN
  -- Security: verify caller is the account owner
  IF auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 1) Fetch and validate task
  SELECT * INTO _task FROM daily_tasks WHERE id = _task_id AND user_id = _user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'task_not_found');
  END IF;
  IF _task.tasks_completed >= _task.tasks_required THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_completed');
  END IF;

  _reward := _task.reward_per_task;
  _next_completed := _task.tasks_completed + 1;
  _next_total := _task.total_earned + _reward;
  _done := _next_completed >= _task.tasks_required;

  -- 2) Update daily_tasks
  UPDATE daily_tasks SET tasks_completed = _next_completed, total_earned = _next_total, is_completed = _done
  WHERE id = _task_id;

  -- 3) Credit personal wallet
  SELECT id, COALESCE(balance, 0) INTO _wallet_id, _wallet_balance
  FROM wallets WHERE user_id = _user_id AND wallet_type = 'personal';
  IF _wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'wallet_not_found');
  END IF;
  _new_balance := _wallet_balance + _reward;
  UPDATE wallets SET balance = _new_balance, updated_at = now() WHERE id = _wallet_id;

  -- 4) Transaction record
  INSERT INTO transactions (user_id, type, wallet_type, amount, balance_after, description, status, metadata)
  VALUES (_user_id, 'task_reward', 'personal', _reward, _new_balance, 'Tarefa ' || _task_number || ' concluída', 'completed',
    jsonb_build_object('task_number', _task_number, 'task_date', _task.task_date));

  -- 5) Distribute task commissions (5%/3%/1%)
  SELECT value::jsonb INTO _config FROM platform_config WHERE key = 'referral_task_commission';
  _pct_a := COALESCE((_config->>'level_a')::numeric, 0);
  _pct_b := COALESCE((_config->>'level_b')::numeric, 0);
  _pct_c := COALESCE((_config->>'level_c')::numeric, 0);

  SELECT * INTO _ref FROM referral_tree WHERE user_id = _user_id;

  -- Level A → personal wallet
  IF _ref.level_a_referrer IS NOT NULL AND _pct_a > 0 THEN
    _comm_amount := ROUND(_reward * _pct_a / 100, 2);
    IF _comm_amount > 0 THEN
      SELECT id, COALESCE(balance, 0) INTO _w_id, _w_bal FROM wallets WHERE user_id = _ref.level_a_referrer AND wallet_type = 'personal';
      IF _w_id IS NOT NULL THEN
        _new_w_bal := _w_bal + _comm_amount;
        UPDATE wallets SET balance = _new_w_bal, updated_at = now() WHERE id = _w_id;
        INSERT INTO transactions (user_id, type, wallet_type, amount, balance_after, description, status, metadata)
        VALUES (_ref.level_a_referrer, 'referral_task_commission', 'personal', _comm_amount, _new_w_bal, 'Comissão tarefa N1', 'completed',
          jsonb_build_object('from_user', _user_id, 'level', 'A', 'task_reward', _reward));
      END IF;
    END IF;
  END IF;

  -- Level B → income wallet
  IF _ref.level_b_referrer IS NOT NULL AND _pct_b > 0 THEN
    _comm_amount := ROUND(_reward * _pct_b / 100, 2);
    IF _comm_amount > 0 THEN
      SELECT id, COALESCE(balance, 0) INTO _w_id, _w_bal FROM wallets WHERE user_id = _ref.level_b_referrer AND wallet_type = 'income';
      IF _w_id IS NOT NULL THEN
        _new_w_bal := _w_bal + _comm_amount;
        UPDATE wallets SET balance = _new_w_bal, updated_at = now() WHERE id = _w_id;
        INSERT INTO transactions (user_id, type, wallet_type, amount, balance_after, description, status, metadata)
        VALUES (_ref.level_b_referrer, 'referral_task_commission', 'income', _comm_amount, _new_w_bal, 'Comissão tarefa N2', 'completed',
          jsonb_build_object('from_user', _user_id, 'level', 'B', 'task_reward', _reward));
      END IF;
    END IF;
  END IF;

  -- Level C → income wallet
  IF _ref.level_c_referrer IS NOT NULL AND _pct_c > 0 THEN
    _comm_amount := ROUND(_reward * _pct_c / 100, 2);
    IF _comm_amount > 0 THEN
      SELECT id, COALESCE(balance, 0) INTO _w_id, _w_bal FROM wallets WHERE user_id = _ref.level_c_referrer AND wallet_type = 'income';
      IF _w_id IS NOT NULL THEN
        _new_w_bal := _w_bal + _comm_amount;
        UPDATE wallets SET balance = _new_w_bal, updated_at = now() WHERE id = _w_id;
        INSERT INTO transactions (user_id, type, wallet_type, amount, balance_after, description, status, metadata)
        VALUES (_ref.level_c_referrer, 'referral_task_commission', 'income', _comm_amount, _new_w_bal, 'Comissão tarefa N3', 'completed',
          jsonb_build_object('from_user', _user_id, 'level', 'C', 'task_reward', _reward));
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tasks_completed', _next_completed,
    'tasks_required', _task.tasks_required,
    'total_earned', _next_total,
    'is_completed', _done,
    'reward', _reward,
    'new_balance', _new_balance
  );
END;
$function$;