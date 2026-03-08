
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
