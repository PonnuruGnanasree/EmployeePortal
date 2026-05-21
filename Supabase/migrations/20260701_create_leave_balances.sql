/* 20260701_create_leave_balances.sql */
CREATE TABLE IF NOT EXISTS public.leave_balances (
    user_email TEXT PRIMARY KEY,
    pto DECIMAL DEFAULT 12.5,
    sick DECIMAL DEFAULT 4.5,
    floating INTEGER DEFAULT 3,
    celebration INTEGER DEFAULT 1,
    power_apps_link TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
