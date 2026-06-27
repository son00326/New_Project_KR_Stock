-- rollback: 0046_tier0_shadow_arm_read
drop function if exists public.get_tier0_shadow_arm_top(text, text, int);
