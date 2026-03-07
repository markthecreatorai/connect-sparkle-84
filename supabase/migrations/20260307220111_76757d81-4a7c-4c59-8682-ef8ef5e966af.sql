
-- Sync referral_tree codes to match profiles codes (profiles is the source of truth for display)
UPDATE public.referral_tree rt
SET referral_code = p.referral_code
FROM public.profiles p
WHERE rt.user_id = p.id AND rt.referral_code != p.referral_code;
