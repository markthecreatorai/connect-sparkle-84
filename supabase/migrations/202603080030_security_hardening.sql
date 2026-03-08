-- Security hardening (scanner findings)

-- 1) Harden request_withdrawal against user_id spoofing
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _user_id uuid,
  _amount numeric,
  _tax_amount numeric,
  _net_amount numeric,
  _wallet_type text,
  _pix_key text,
  _pix_key_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _wallet_id uuid;
  _wallet_balance numeric;
  _new_balance numeric;
  _wd_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF auth.uid() <> _user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF _amount IS NULL OR _amount <= 0 OR _tax_amount IS NULL OR _tax_amount < 0 OR _net_amount IS NULL OR _net_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  IF _wallet_type NOT IN ('recharge','personal','income') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_wallet_type');
  END IF;

  SELECT id, COALESCE(balance, 0) INTO _wallet_id, _wallet_balance
  FROM wallets WHERE user_id = _user_id AND wallet_type = _wallet_type
  FOR UPDATE;

  IF _wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'wallet_not_found');
  END IF;

  IF _wallet_balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance');
  END IF;

  _new_balance := _wallet_balance - _amount;
  UPDATE wallets SET balance = _new_balance, updated_at = now() WHERE id = _wallet_id;

  INSERT INTO withdrawals (user_id, amount, tax_amount, net_amount, wallet_type, pix_key, pix_key_type, payment_password_verified, status)
  VALUES (_user_id, _amount, _tax_amount, _net_amount, _wallet_type, _pix_key, _pix_key_type, true, 'pending')
  RETURNING id INTO _wd_id;

  INSERT INTO transactions (user_id, type, wallet_type, amount, balance_after, description, status, reference_id, metadata)
  VALUES (
    _user_id,
    'withdrawal',
    _wallet_type,
    _amount,
    _new_balance,
    'Saque solicitado',
    'pending',
    _wd_id,
    jsonb_build_object('withdrawal_id', _wd_id, 'net_amount', _net_amount, 'tax', _tax_amount)
  );

  RETURN jsonb_build_object('success', true, 'withdrawal_id', _wd_id, 'new_balance', _new_balance);
END;
$$;

-- 2) Remove broad anon reads on profiles/platform_settings
DROP POLICY IF EXISTS "Anyone can read referral_code" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='platform_settings' AND policyname='Authenticated can read platform settings'
  ) THEN
    CREATE POLICY "Authenticated can read platform settings"
      ON public.platform_settings
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- 3) Prevent non-admin self-service updates on sensitive profile columns
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _is_admin boolean := false;
BEGIN
  -- service role / system operations bypass (auth.uid() is null)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.has_role(auth.uid(), 'admin') INTO _is_admin;

  IF _is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden_profile_update';
  END IF;

  IF (NEW.balance IS DISTINCT FROM OLD.balance)
    OR (NEW.vip_level IS DISTINCT FROM OLD.vip_level)
    OR (NEW.is_active IS DISTINCT FROM OLD.is_active)
    OR (NEW.referred_by IS DISTINCT FROM OLD.referred_by)
    OR (NEW.referral_code IS DISTINCT FROM OLD.referral_code)
    OR (NEW.payment_password_hash IS DISTINCT FROM OLD.payment_password_hash)
  THEN
    RAISE EXCEPTION 'sensitive_profile_fields_cannot_be_updated_directly';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_updates ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_updates
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_updates();

-- 4) Reduce phone->email enumeration exposure at SQL layer
REVOKE ALL ON FUNCTION public.get_auth_email_by_phone(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_auth_email_by_phone(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_auth_email_by_phone(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_email_by_phone(text) TO service_role;
