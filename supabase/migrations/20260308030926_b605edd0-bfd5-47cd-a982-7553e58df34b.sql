
-- 1. Fix request_withdrawal: add caller identity check
CREATE OR REPLACE FUNCTION public.request_withdrawal(_user_id uuid, _amount numeric, _tax_amount numeric, _net_amount numeric, _wallet_type text, _pix_key text, _pix_key_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet_id uuid;
  _wallet_balance numeric;
  _new_balance numeric;
  _wd_id uuid;
BEGIN
  -- Security: verify caller is the account owner
  IF _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id, COALESCE(balance, 0) INTO _wallet_id, _wallet_balance
  FROM wallets WHERE user_id = _user_id AND wallet_type = _wallet_type;
  
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
  VALUES (_user_id, 'withdrawal', _wallet_type, _amount, _new_balance, 'Saque solicitado', 'pending', _wd_id,
    jsonb_build_object('withdrawal_id', _wd_id, 'net_amount', _net_amount, 'tax', _tax_amount));

  RETURN jsonb_build_object('success', true, 'withdrawal_id', _wd_id, 'new_balance', _new_balance);
END;
$$;

-- 2. Remove overly broad anon SELECT on profiles (exposes ALL columns to unauthenticated users)
DROP POLICY IF EXISTS "Anyone can read referral_code" ON public.profiles;

-- 3. Allow users to see profiles of people they referred (for team page)
CREATE POLICY "Users can view referred profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (referred_by = auth.uid());

-- 4. Protect sensitive profile columns from direct UPDATE by non-admins
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.balance := OLD.balance;
    NEW.blocked_balance := OLD.blocked_balance;
    NEW.vip_level := OLD.vip_level;
    NEW.is_active := OLD.is_active;
    NEW.referral_code := OLD.referral_code;
    NEW.vip_purchased_at := OLD.vip_purchased_at;
    NEW.referred_by := OLD.referred_by;
    NEW.payment_password_hash := OLD.payment_password_hash;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- 5. Restrict platform_settings to authenticated only
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Authenticated can read platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

-- 6. Restrict platform_config to authenticated only
DROP POLICY IF EXISTS "Config viewable by all" ON public.platform_config;
CREATE POLICY "Authenticated can read platform config"
  ON public.platform_config FOR SELECT
  TO authenticated
  USING (true);

-- 7. Revoke get_auth_email_by_phone from anon/public (will be called server-side only)
REVOKE EXECUTE ON FUNCTION public.get_auth_email_by_phone(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_email_by_phone(text) TO service_role;
