
CREATE OR REPLACE FUNCTION public.distribute_vip_commissions(
  _user_id uuid,
  _vip_plan_id uuid,
  _payment_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _plan RECORD;
  _sponsor_a uuid;
  _sponsor_b uuid;
  _sponsor_c uuid;
  _commissions_count int := 0;
  _existing int;
BEGIN
  -- STEP 1: Idempotency check
  SELECT count(*) INTO _existing
  FROM commissions WHERE origin_payment_id = _payment_id;
  IF _existing > 0 THEN
    RETURN jsonb_build_object('success', true, 'commissionsDistributed', 0, 'message', 'already_processed');
  END IF;

  -- STEP 2: Fetch plan
  SELECT * INTO _plan FROM vip_plans WHERE id = _vip_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VIP plan not found: %', _vip_plan_id;
  END IF;

  -- Fetch sponsor chain
  SELECT referred_by INTO _sponsor_a FROM profiles WHERE id = _user_id;

  -- STEP 3: Level A (direct sponsor)
  IF _sponsor_a IS NOT NULL AND _sponsor_a != _user_id THEN
    UPDATE profiles SET balance = COALESCE(balance, 0) + _plan.reward_a WHERE id = _sponsor_a;
    INSERT INTO commissions (beneficiary_id, source_user_id, deposit_id, level, percentage, amount, type, origin_payment_id, vip_plan_id)
    VALUES (_sponsor_a, _user_id, _vip_plan_id, 1, _plan.commission_a_pct, _plan.reward_a, 'vip_purchase', _payment_id, _vip_plan_id);
    _commissions_count := _commissions_count + 1;

    -- STEP 4: Level B (sponsor's sponsor)
    SELECT referred_by INTO _sponsor_b FROM profiles WHERE id = _sponsor_a;
    IF _sponsor_b IS NOT NULL AND _sponsor_b != _user_id THEN
      UPDATE profiles SET balance = COALESCE(balance, 0) + _plan.reward_b WHERE id = _sponsor_b;
      INSERT INTO commissions (beneficiary_id, source_user_id, deposit_id, level, percentage, amount, type, origin_payment_id, vip_plan_id)
      VALUES (_sponsor_b, _user_id, _vip_plan_id, 2, _plan.commission_b_pct, _plan.reward_b, 'vip_purchase', _payment_id, _vip_plan_id);
      _commissions_count := _commissions_count + 1;

      -- STEP 5: Level C (sponsor's sponsor's sponsor)
      SELECT referred_by INTO _sponsor_c FROM profiles WHERE id = _sponsor_b;
      IF _sponsor_c IS NOT NULL AND _sponsor_c != _user_id THEN
        UPDATE profiles SET balance = COALESCE(balance, 0) + _plan.reward_c WHERE id = _sponsor_c;
        INSERT INTO commissions (beneficiary_id, source_user_id, deposit_id, level, percentage, amount, type, origin_payment_id, vip_plan_id)
        VALUES (_sponsor_c, _user_id, _vip_plan_id, 3, _plan.commission_c_pct, _plan.reward_c, 'vip_purchase', _payment_id, _vip_plan_id);
        _commissions_count := _commissions_count + 1;
      END IF;
    END IF;
  END IF;

  -- STEP 6: Update buyer
  UPDATE profiles
  SET vip_level = _plan.level,
      vip_purchased_at = now(),
      updated_at = now()
  WHERE id = _user_id;

  RETURN jsonb_build_object('success', true, 'commissionsDistributed', _commissions_count);
END;
$$;
