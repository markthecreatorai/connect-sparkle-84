
ALTER TABLE public.transactions DROP CONSTRAINT transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type = ANY (ARRAY[
    'deposit','withdrawal','commission','bonus','adjustment',
    'task_reward','referral_task_commission','referral_deposit_commission',
    'vip_purchase','investment','salary'
  ]));

ALTER TABLE public.transactions DROP CONSTRAINT transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check
  CHECK (status = ANY (ARRAY['pending','approved','rejected','cancelled','completed']));
