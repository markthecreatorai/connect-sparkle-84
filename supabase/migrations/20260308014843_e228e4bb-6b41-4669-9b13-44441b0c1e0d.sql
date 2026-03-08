
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
  _wallet RECORD;
  _new_balance numeric;
  _wd_id uuid;
BEGIN
  -- 1) Validate wallet balance
  SELECT id, COALESCE(balance, 0) as balance INTO _wallet
  FROM wallets WHERE user_id = _user_id AND wallet_type = _wallet_type;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'wallet_not_found');
  END IF;
  
  IF _wallet.balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance');
  END IF;

  -- 2) Debit wallet
  _new_balance := _wallet.balance - _amount;
  UPDATE wallets SET balance = _new_balance, updated_at = now() WHERE id = _wallet.id;

  -- 3) Create withdrawal record
  INSERT INTO withdrawals (user_id, amount, tax_amount, net_amount, wallet_type, pix_key, pix_key_type, payment_password_verified, status)
  VALUES (_user_id, _amount, _tax_amount, _net_amount, _wallet_type, _pix_key, _pix_key_type, true, 'pending')
  RETURNING id INTO _wd_id;

  -- 4) Transaction record
  INSERT INTO transactions (user_id, type, wallet_type, amount, balance_after, description, status, metadata)
  VALUES (_user_id, 'withdrawal', _wallet_type, _amount, _new_balance, 'Saque solicitado', 'pending',
    jsonb_build_object('withdrawal_id', _wd_id, 'net_amount', _net_amount, 'tax', _tax_amount));

  RETURN jsonb_build_object('success', true, 'withdrawal_id', _wd_id, 'new_balance', _new_balance);
END;
$$;
