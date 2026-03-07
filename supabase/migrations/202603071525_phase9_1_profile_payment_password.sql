-- FASE 9.1 support: payment password hash

alter table public.profiles
  add column if not exists payment_password_hash text;
