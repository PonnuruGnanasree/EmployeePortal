# 🚀 Supabase Integration Guide: From Scratch

This document will help you understand, set up, and verify the Supabase integration for the Gantec Employee Portal.

---

## 1. 🧠 What is Supabase?
Imagine your application is like a **library**. 
*   **The Books**: These are your users, documents, and folders.
*   **The Library Building**: This is your database.

Previously, your "Library" was just a small box on your own computer (`database.sqlite`). If your computer broke or the box was lost, your data was gone. 

**Supabase** is like a massive, secure, 24/7 library in the cloud. Your app "calls" this library over the internet whenever it needs to save or read data. It is safer, more professional, and can handle thousands of users.

---

## 2. 🛠️ Step-by-Step Setup (From Scratch)

### Step 1: Create your project
1.  Go to [Supabase.com](https://supabase.com) and sign in.
2.  Click **"New Project"**.
3.  Give it a name (e.g., `Gantec Portal`) and a secure password.
4.  Wait for the project to finish "provisionsing" (usually takes 1-2 minutes).

### Step 2: Get your "Keys" (The Bridge)
Once your project is ready:
1.  Go to **Project Settings** (gear icon) -> **API**.
2.  Copy the **Project URL**.
3.  Look for the **service_role** key (it starts with `ey...`). This is your "Master Key."
4.  Open your [`.env`](file:///c:/Users/HP/Downloads/Antigravtiy_updated_v2%20(1)/ant_fix/.env) file and paste them here:
    ```env
    SUPABASE_URL=YOUR_PROJECT_URL
    SUPABASE_KEY=YOUR_SERVICE_ROLE_KEY
    ```

### Step 3: Run the SQL Setup
Now you need to create the "tables" (the boxes that hold your data).
1.  On the left sidebar in Supabase, click the **SQL Editor** icon (`>_`).
2.  Click **"New Query"**.
3.  Copy everything from my [`supabase_setup.sql`](file:///c:/Users/HP/Downloads/Antigravtiy_updated_v2%20(1)/ant_fix/supabase_setup.sql) file.
4.  Paste it into the editor and click **Run**.
    *   *Success Message:* "Success. No rows returned." (This is normal!)

---

## 3. 📋 The Database Schema (Why we have these tables)
The screenshot you provided shows 5 tables. Here is exactly what each one does and why it is important for the portal:

### 1. `users`
*   **Purpose**: This is the heart of your security system.
*   **What it stores**: Full names, official email addresses, and encrypted passwords.
*   **Why it's used**: To verify who is logging in and to ensure every document is linked to a specific person.

### 2. `resource_links`
*   **Purpose**: Stores external resources like YouTube training videos.
*   **What it stores**: The video URL, the title of the video, and the folder it belongs to.
*   **Why it's used**: Instead of downloading big videos, we just store the "link" so colleagues can watch them instantly.

### 3. `resource_uploads`
*   **Purpose**: Manages the "Shared Library" (Training Resources).
*   **What it stores**: The filename of the PDF/document and the email of the person who uploaded it.
*   **Why it's used**: It allows everyone to see shared training material, but only the original uploader can delete it.

### 4. `user_folders`
*   **Purpose**: Manages your private "Locker" structure.
*   **What it stores**: A list of folders created by each user (e.g., "Payslips", "Certificates").
*   **Why it's used**: It remembers your folder structure so even if you log in from a different computer, your private locker looks the same.

### 5. `user_documents`
*   **Purpose**: Manages your private encrypted files.
*   **What it stores**: The original filename, the size, and a link to the encrypted "bin" file on the server.
*   **Why it's used**: This ensures that when you upload a private file, no one else can see it. The database keeps track of which file belongs to which user id.

---

## 4. 🔍 How to Check and Understand

### The Table Editor (Your Window)
On the left sidebar of Supabase, click the **Table Editor** icon (looks like a small grid). You will see your new tables:
*   `users`: Stores every person who signs up.
*   `user_documents`: Stores the list of your private uploads.
*   `resource_uploads`: Stores the shared library files.

### The "Test Run"
1.  Run your portal (`node server.js` or use the `.bat` file).
2.  Go to the **Sign Up** page.
3.  Create an account (e.g., `test@gantecusa.com`).
4.  Immediately go to your **Supabase Dashboard** -> **Table Editor** -> **`users`**.
5.  **You should see your test account right there!** If you see it, the connection is 100% successful.

---

## 4. 🛡️ What does "UNRESTRICTED" mean in Supabase?
When you look at your tables in the Supabase Dashboard, you might notice an **"UNRESTRICTED"** warning tag next to them in red. 

**What it means:**
This tag means **Row Level Security (RLS)** is currently disabled for these tables. In other setups where a website talks *directly* to the database, this would be a security risk because anyone could read or write data.

**Why it is completely safe for our app:**
Our application uses a **Backend Server (`server.js`)**. Your website frontend does *not* talk to Supabase directly. Instead:
1. The user talks to your `server.js`.
2. Your `server.js` verifies who they are (checks email/passwords, checks if they own the file).
3. `server.js` then uses your secret `service_role` "Master Key" (from the `.env` file) to talk to Supabase.

Because your Node.js server handles all the security rules and acts as a bouncer, the tables being "unrestricted" does not expose your data, as long as your `.env` file is kept secure.

*(Optional)*: If you want to make the red warnings disappear from your dashboard, you can click on each table, find the **Row Level Security (RLS)** option in the top bar, and click **Enable RLS**. Because we use the Master Key on our server, your app will continue to work perfectly even if RLS is enabled!

---

## 5. 💡 Troubleshooting
*   **"Table not found"**: This means you skipped **Step 3** above. Go back to the SQL Editor and run the script.
*   **"Invalid URL"**: Check your [`.env`](file:///c:/Users/HP/Downloads/Antigravtiy_updated_v2%20(1)/ant_fix/.env) file. Make sure there are no spaces around the `=` sign.
*   **"Auth Failed"**: Ensure you used the `service_role` key, not the `anon` key.

---

### Need Help? 
If any step doesn't work, just ask me! "I'm stuck at Step 2" or "I see an error in the SQL Editor." 

users: This is your digital ID card system. It stores the names and passwords of every employee so the system knows who is allowed to enter.
resource_links: This stores "shortcuts" to things like YouTube videos. This way, we save space by not downloading huge video files.
resource_uploads: This is for the "Shared Library." It tracks who uploaded which PDF so that people can share training materials with each other.
user_folders: This remembers the names of the private folders you create (like "My Taxes" or "ID Proofs"). It ensures your private file organization stays exactly how you want it.
user_documents: This is the record book for your private files. It keeps track of which secret file on the server belongs to which user.

