
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
  _sponsor_exists boolean;
  _commissions_count int := 0;
  _existing int;
  _logs jsonb := '[]'::jsonb;
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

  -- Fetch sponsor chain (Level A)
  SELECT referred_by INTO _sponsor_a FROM profiles WHERE id = _user_id;

  -- STEP 3: Level A (direct sponsor)
  IF _sponsor_a IS NOT NULL AND _sponsor_a != _user_id THEN
    -- Check sponsor exists and is active
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = _sponsor_a AND is_active = true) INTO _sponsor_exists;
    IF _sponsor_exists THEN
      UPDATE profiles SET balance = COALESCE(balance, 0) + _plan.reward_a WHERE id = _sponsor_a;
      INSERT INTO commissions (beneficiary_id, source_user_id, deposit_id, level, percentage, amount, type, origin_payment_id, vip_plan_id)
      VALUES (_sponsor_a, _user_id, _vip_plan_id, 1, _plan.commission_a_pct, _plan.reward_a, 'vip_purchase', _payment_id, _vip_plan_id);
      _commissions_count := _commissions_count + 1;
    ELSE
      _logs := _logs || jsonb_build_array(jsonb_build_object('level', 'A', 'skipped', 'sponsor_inactive_or_missing', 'sponsor_id', _sponsor_a));
    END IF;

    -- STEP 4: Level B (sponsor's sponsor)
    SELECT referred_by INTO _sponsor_b FROM profiles WHERE id = _sponsor_a;
    IF _sponsor_b IS NOT NULL AND _sponsor_b != _user_id THEN
      SELECT EXISTS(SELECT 1 FROM profiles WHERE id = _sponsor_b AND is_active = true) INTO _sponsor_exists;
      IF _sponsor_exists THEN
        UPDATE profiles SET balance = COALESCE(balance, 0) + _plan.reward_b WHERE id = _sponsor_b;
        INSERT INTO commissions (beneficiary_id, source_user_id, deposit_id, level, percentage, amount, type, origin_payment_id, vip_plan_id)
        VALUES (_sponsor_b, _user_id, _vip_plan_id, 2, _plan.commission_b_pct, _plan.reward_b, 'vip_purchase', _payment_id, _vip_plan_id);
        _commissions_count := _commissions_count + 1;
      ELSE
        _logs := _logs || jsonb_build_array(jsonb_build_object('level', 'B', 'skipped', 'sponsor_inactive_or_missing', 'sponsor_id', _sponsor_b));
      END IF;

      -- STEP 5: Level C (sponsor's sponsor's sponsor)
      SELECT referred_by INTO _sponsor_c FROM profiles WHERE id = _sponsor_b;
      IF _sponsor_c IS NOT NULL AND _sponsor_c != _user_id THEN
        SELECT EXISTS(SELECT 1 FROM profiles WHERE id = _sponsor_c AND is_active = true) INTO _sponsor_exists;
        IF _sponsor_exists THEN
          UPDATE profiles SET balance = COALESCE(balance, 0) + _plan.reward_c WHERE id = _sponsor_c;
          INSERT INTO commissions (beneficiary_id, source_user_id, deposit_id, level, percentage, amount, type, origin_payment_id, vip_plan_id)
          VALUES (_sponsor_c, _user_id, _vip_plan_id, 3, _plan.commission_c_pct, _plan.reward_c, 'vip_purchase', _payment_id, _vip_plan_id);
          _commissions_count := _commissions_count + 1;
        ELSE
          _logs := _logs || jsonb_build_array(jsonb_build_object('level', 'C', 'skipped', 'sponsor_inactive_or_missing', 'sponsor_id', _sponsor_c));
        END IF;
      END IF;
    END IF;
  ELSE
    _logs := _logs || jsonb_build_array(jsonb_build_object('info', 'no_sponsor', 'user_id', _user_id));
  END IF;

  -- STEP 6: Update buyer (upgrade or renewal)
  UPDATE profiles
  SET vip_level = _plan.level,
      vip_purchased_at = now(),
      updated_at = now()
  WHERE id = _user_id;

  RETURN jsonb_build_object('success', true, 'commissionsDistributed', _commissions_count, 'logs', _logs);
END;
$$;

-- Also create a dry-run version that rolls back
CREATE OR REPLACE FUNCTION public.test_distribute_vip_commissions(
  _user_id uuid,
  _vip_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result jsonb;
  _plan RECORD;
  _buyer RECORD;
  _sponsor_a uuid;
  _sponsor_b uuid;
  _sponsor_c uuid;
  _sponsor_a_name text;
  _sponsor_b_name text;
  _sponsor_c_name text;
  _sponsor_exists boolean;
  _commissions jsonb := '[]'::jsonb;
  _errors jsonb := '[]'::jsonb;
  _buyer_vip_before int;
BEGIN
  -- Fetch plan
  SELECT * INTO _plan FROM vip_plans WHERE id = _vip_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'VIP plan not found');
  END IF;

  -- Fetch buyer
  SELECT id, full_name, vip_level INTO _buyer FROM profiles WHERE id = _user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;
  _buyer_vip_before := COALESCE(_buyer.vip_level, 0);

  -- Sponsor chain
  SELECT referred_by INTO _sponsor_a FROM profiles WHERE id = _user_id;

  IF _sponsor_a IS NULL OR _sponsor_a = _user_id THEN
    _errors := _errors || jsonb_build_array('no_sponsor');
  ELSE
    -- Level A
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = _sponsor_a AND is_active = true) INTO _sponsor_exists;
    IF _sponsor_exists THEN
      SELECT full_name INTO _sponsor_a_name FROM profiles WHERE id = _sponsor_a;
      _commissions := _commissions || jsonb_build_array(jsonb_build_object(
        'level', 'A', 'recipient_id', _sponsor_a, 'recipient_name', _sponsor_a_name, 'amount', _plan.reward_a
      ));
    ELSE
      _errors := _errors || jsonb_build_array('level_a_sponsor_inactive');
    END IF;

    -- Level B
    SELECT referred_by INTO _sponsor_b FROM profiles WHERE id = _sponsor_a;
    IF _sponsor_b IS NOT NULL AND _sponsor_b != _user_id THEN
      SELECT EXISTS(SELECT 1 FROM profiles WHERE id = _sponsor_b AND is_active = true) INTO _sponsor_exists;
      IF _sponsor_exists THEN
        SELECT full_name INTO _sponsor_b_name FROM profiles WHERE id = _sponsor_b;
        _commissions := _commissions || jsonb_build_array(jsonb_build_object(
          'level', 'B', 'recipient_id', _sponsor_b, 'recipient_name', _sponsor_b_name, 'amount', _plan.reward_b
        ));
      ELSE
        _errors := _errors || jsonb_build_array('level_b_sponsor_inactive');
      END IF;

      -- Level C
      SELECT referred_by INTO _sponsor_c FROM profiles WHERE id = _sponsor_b;
      IF _sponsor_c IS NOT NULL AND _sponsor_c != _user_id THEN
        SELECT EXISTS(SELECT 1 FROM profiles WHERE id = _sponsor_c AND is_active = true) INTO _sponsor_exists;
        IF _sponsor_exists THEN
          SELECT full_name INTO _sponsor_c_name FROM profiles WHERE id = _sponsor_c;
          _commissions := _commissions || jsonb_build_array(jsonb_build_object(
            'level', 'C', 'recipient_id', _sponsor_c, 'recipient_name', _sponsor_c_name, 'amount', _plan.reward_c
          ));
        ELSE
          _errors := _errors || jsonb_build_array('level_c_sponsor_inactive');
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'buyer', jsonb_build_object('id', _buyer.id, 'name', _buyer.full_name, 'vip_level_before', _buyer_vip_before, 'vip_level_after', _plan.level),
    'commissions_created', _commissions,
    'errors', _errors
  );
END;
$$;
