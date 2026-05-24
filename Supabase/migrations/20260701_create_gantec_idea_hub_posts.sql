-- Migration: Create gantec_idea_hub_posts table
CREATE TABLE IF NOT EXISTS public.gantec_idea_hub_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  user_email TEXT NOT NULL,
  post_content TEXT NOT NULL,
  image_url TEXT,
  tagged_users JSONB DEFAULT '[]'::jsonb, -- array of usernames or user IDs
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  post_visibility TEXT NOT NULL DEFAULT 'public', -- could be 'public' or 'private'
  attachments JSONB DEFAULT '[]'::jsonb, -- list of attachment URLs or metadata
  edited BOOLEAN NOT NULL DEFAULT FALSE
);

-- Index for newest posts first
CREATE INDEX IF NOT EXISTS idx_gantec_idea_hub_posts_created_at_desc ON public.gantec_idea_hub_posts (created_at DESC);

-- Trigger to update updated_at on row modification
CREATE OR REPLACE FUNCTION public.update_gantec_idea_hub_posts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_gantec_idea_hub_posts_timestamp ON public.gantec_idea_hub_posts;
CREATE TRIGGER trg_update_gantec_idea_hub_posts_timestamp
BEFORE UPDATE ON public.gantec_idea_hub_posts
FOR EACH ROW EXECUTE PROCEDURE public.update_gantec_idea_hub_posts_timestamp();
