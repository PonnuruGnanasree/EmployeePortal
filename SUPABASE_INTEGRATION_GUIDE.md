# Supabase Integration Guide – Gantec Employee Portal

## Overview

This guide explains how to connect the Gantec Employee Portal to a **Supabase** (PostgreSQL) cloud database instead of the local SQLite database.

## Prerequisites

1. A free [Supabase](https://supabase.com) account.
2. A Supabase project created in the dashboard.

## Step 1: Get Your Credentials

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. Navigate to **Settings → API**.
4. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Service Role Key** (the `service_role` secret, NOT the `anon` key)

## Step 2: Update `.env`

Open the `.env` file in the project root and add/update:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
GEMINI_API_KEY=your-gemini-api-key
```

## Step 3: Create the Database Tables

1. Go to your Supabase Dashboard → **SQL Editor**.
2. Open the file `supabase_setup.sql` from this project.
3. Copy and paste the entire contents into the SQL Editor.
4. Click **Run** to create all tables.

### Tables Created:

| Table               | Purpose                              |
|---------------------|--------------------------------------|
| `users`             | Employee accounts (name, email, pwd) |
| `user_folders`      | Personal document folders            |
| `user_documents`    | Uploaded document metadata           |
| `resource_uploads`  | Training resource files              |
| `resource_links`    | Training resource links              |

## Step 4: Migrate server.js (Future)

To fully migrate from SQLite to Supabase, `server.js` needs to be updated to:
- Replace `better-sqlite3` with `@supabase/supabase-js`.
- Convert all synchronous `db.prepare().get()` calls to async `supabase.from().select()`.
- Ensure all handlers use `async/await` properly.

> **Note:** The current `server.js` still uses SQLite. The Supabase tables are ready for when the migration is performed.

## Step 5: Test

1. Run `npm start` or double-click `START_PORTAL.bat`.
2. Open `http://localhost:3000` in your browser.
3. Test signup, login, and document upload.

## Troubleshooting

- **"relation does not exist"**: You haven't run the SQL setup script yet.
- **Connection refused**: Check your `SUPABASE_URL` in `.env`.
- **Permission denied**: Make sure you're using the `service_role` key, not the `anon` key.
