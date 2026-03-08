ALTER TABLE public.deposits 
  ADD COLUMN IF NOT EXISTS mp_payment_id text,
  ADD COLUMN IF NOT EXISTS mp_qr_code text,
  ADD COLUMN IF NOT EXISTS mp_qr_code_base64 text,
  ADD COLUMN IF NOT EXISTS mp_ticket_url text,
  ADD COLUMN IF NOT EXISTS deposit_type text DEFAULT 'balance';