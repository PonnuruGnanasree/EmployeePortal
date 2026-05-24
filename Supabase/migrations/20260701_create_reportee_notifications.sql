-- Migration: create_reportee_notifications.sql
-- Create reportee_notifications table
CREATE TABLE IF NOT EXISTS public.reportee_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    reportee_id UUID NOT NULL,
    reportee_name TEXT NOT NULL,
    assigned_by UUID NOT NULL,
    notification_message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    notification_type TEXT NOT NULL,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT fk_reportee FOREIGN KEY (reportee_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT fk_assigned_by FOREIGN KEY (assigned_by) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Index for quick retrieval of unread notifications per user
CREATE INDEX IF NOT EXISTS idx_reportee_notifications_user_unread ON public.reportee_notifications (user_id, is_read);

-- Trigger to ensure expires_at is set to one month after creation if not provided
-- (Optional: you could use a default expression or handle in application)
