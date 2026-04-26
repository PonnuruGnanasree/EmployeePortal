-- ============================================================
-- Supabase Setup Script for Gantec Employee Portal
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  fullname TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

-- 2. User folders table
CREATE TABLE IF NOT EXISTS user_folders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  UNIQUE(user_id, path)
);

-- 3. User documents table
CREATE TABLE IF NOT EXISTS user_documents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  hashed_name TEXT UNIQUE NOT NULL,
  folder TEXT NOT NULL,
  size BIGINT,
  upload_date TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Resource uploads table (for training resources)
CREATE TABLE IF NOT EXISTS resource_uploads (
  id BIGSERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  folder TEXT NOT NULL,
  size BIGINT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Resource links table
CREATE TABLE IF NOT EXISTS resource_links (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  folder TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Optional: Enable Row Level Security (RLS) for production
-- ============================================================
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_folders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
