# Gantec Employee Portal — Architecture

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js + Express.js |
| Local Database | SQLite (better-sqlite3) |
| Cloud Database | Supabase (PostgreSQL) |
| Cloud Storage | Supabase Storage (file uploads) |
| AI | Google Gemini (gemini-flash-lite-latest) |
| Auth | Custom HMAC JWT tokens + Supabase Auth |
| File Processing | pdf-parse, mammoth (docx), multer (uploads) |
| Email | Nodemailer (SMTP - optional) |
| Real-time | Supabase Realtime channels |

---

## Project Structure

```
EmployeePortal/
├── server.js                 # Main Express server (all API routes)
├── package.json              # Dependencies
├── .env                      # Environment variables (secrets)
├── .gitignore                # Git exclusions
│
├── config/
│   └── admins.json           # Admin email list
│
├── data/
│   ├── database.sqlite       # Local SQLite database
│   └── knowledge_base.txt    # AI Chatbot knowledge base
│
├── middleware/
│   ├── auth.js               # JWT token generation/verification
│   ├── rateLimiter.js        # Rate limiting (in-memory)
│   └── security.js           # Security headers (CSP, XSS, etc.)
│
├── utils/
│   └── validation.js         # Input sanitization & path safety
│
├── uploads/                  # Public training resource files (encrypted)
├── user_uploads/             # Private document locker files (encrypted)
│
├── public/                   # Static frontend files
│   ├── css/
│   │   ├── styles.css        # Main stylesheet
│   │   ├── branding.css      # Brand colors & variables
│   │   └── resources.css     # Resource page styles
│   │
│   ├── js/
│   │   ├── app.js            # Global shared logic (auth, sidebar, profile, notifications)
│   │   ├── viewer.js         # Training Resources viewer page
│   │   ├── uploader.js       # Training Resources uploader page
│   │   ├── my-docs.js        # Document Locker (private files)
│   │   ├── my-docs-uploader.js
│   │   ├── my-docs-viewer.js
│   │   └── social.js         # Gantec Idea Hub (social feed)
│   │
│   ├── images/               # Static images (logos, avatars)
│   │
│   ├── index.html            # Landing/redirect page
│   ├── login.html            # Login & Signup
│   ├── home.html             # Dashboard with feature cards
│   ├── viewer.html           # Training Resources (view/upload)
│   ├── uploader.html         # Training Resources uploader
│   ├── document-locker.html  # Private Document Vault
│   ├── monthly-feedback.html # Feedback Insights (rubric)
│   ├── feedback-dashboard.html # Monthly Scorecard
│   ├── analysis.html         # Performance Analysis
│   ├── insights.html         # Reportee Insights
│   ├── certifications.html   # View Certifications
│   ├── add-certification.html # Add & View Certifications
│   ├── certificate-leaders.html # Certificate Leaderboard
│   ├── company-holidays.html # Holiday Calendar
│   ├── weekly-connect.html   # Weekly Connect Sessions
│   ├── team-members.html     # Team Members Management
│   ├── contact-hr.html       # Contact HR (Teams integration)
│   ├── employee-support.html # Employee Support Tickets
│   ├── faq.html              # FAQ + AI Chatbot
│   ├── company-culture.html  # Company Culture
│   ├── content-leader.html   # Content Leaders (points leaderboard)
│   ├── hr-queries.html       # Admin: HR Queries Dashboard
│   ├── support-queries.html  # Admin: Support Tickets Dashboard
│   └── webpage-creation.html # Webpage Builder
│
├── Supabase/
│   ├── supabase_setup.sql    # Full database schema
│   └── migrations/           # Migration scripts
│
└── scripts/                  # Utility scripts
```

---

## Data Flow Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser   │────▶│  Express.js  │────▶│  SQLite (local)  │
│  (Frontend) │◀────│   Server     │◀────│                  │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                           │ Background Sync
                           ▼
                    ┌──────────────┐
                    │   Supabase   │
                    │  (Cloud DB)  │
                    │  + Storage   │
                    │  + Auth      │
                    │  + Realtime  │
                    └──────────────┘
```

---

## Database Tables

### Core Tables
| Table | Purpose |
|-------|---------|
| `users` | User profiles (id, name, email, role, points, profile_image) |
| `admin_emails` | Admin access list |

### Training Resources
| Table | Purpose |
|-------|---------|
| `public_documents` | Uploaded file metadata (folder, filename, uploader) |
| `resource_uploads` | Supabase file tracking |
| `resource_links` | YouTube/video links |
| `resource_folders` | Folder registry |

### Private Documents
| Table | Purpose |
|-------|---------|
| `user_documents` | Per-user encrypted file records |
| `user_folders` | Per-user folder structure |

### Feedback System
| Table | Purpose |
|-------|---------|
| `monthly_feedback` | Rubric selections, remarks, submit status per month |
| `main_sub_mails` | Manager-reportee relationships |

### Notifications
| Table | Purpose |
|-------|---------|
| `manager_notifications` | Local notifications (SQLite) |
| `reportee_notifications` | Cloud notifications (Supabase) |

### Social / Idea Hub
| Table | Purpose |
|-------|---------|
| `gantec_idea_hub_posts` | Social feed posts |
| `social_posts` | Local social posts |
| `social_comments` | Post comments |
| `social_likes` | Post likes |
| `social_stories` | 24hr stories |

### HR & Support
| Table | Purpose |
|-------|---------|
| `hr_queries` | Contact HR submissions |
| `support_tickets` | Employee support tickets |

### Other
| Table | Purpose |
|-------|---------|
| `holidays` | Company holiday calendar |
| `weekly_sessions` | Weekly Connect session data |
| `weekly_connect_members` | Team members |
| `certificate_leaders` | Certification records |
| `leave_balances` | Leave balance + Power Apps link |

---

## Authentication Flow

```
1. User signs up → bcrypt hash password → store in SQLite + Supabase Auth
2. User logs in → verify bcrypt → generate HMAC JWT token (24hr expiry)
3. Token stored in localStorage → sent as Bearer header on protected routes
4. Server verifies token on each request via authMiddleware
5. Admin check: email compared against config/admins.json
```

---

## Security Features

- ✅ HMAC-SHA256 JWT tokens (custom, no external library)
- ✅ bcrypt password hashing (10 rounds)
- ✅ AES-256-CBC file encryption (uploads)
- ✅ Content-Security-Policy headers
- ✅ Rate limiting (auth: 30/15min, API: 60/min, chat: 15/min)
- ✅ Path traversal prevention (sanitizePath + isPathSafe)
- ✅ HTML escaping in email templates (XSS prevention)
- ✅ Input validation & sanitization
- ✅ Trust proxy for correct IP detection
- ✅ Graceful shutdown (SIGTERM/SIGINT)
- ✅ File type whitelist on uploads
- ✅ 50MB max file size limit

---

## Key Features

### Training Resources (viewer.html / uploader.html)
- Upload files & YouTube links to folders
- View/preview PDFs, DOCX, PPTX, images, videos
- AI-powered document summarization (Gemini)
- Points system (+1 upload, +0.5 view, -1 delete)
- Ownership-based delete (only uploader or admin can delete)

### Document Locker (document-locker.html)
- Private per-user encrypted file storage
- Folder tree with create/rename/delete
- AES-256-CBC encryption at rest
- Only the owner can access their files

### Monthly Feedback (monthly-feedback.html)
- 7-level rubric for 22+ competencies
- Self-Assessment (User) + Manager Review (Admin) modes
- Auto-save on every cell click
- Save (draft) vs Submit (permanent lock)
- Per-month storage with full history

### Gantec Idea Hub (social feed)
- Post with images/text
- @mention users (auto-notification)
- Like, comment, delete own posts
- 24hr stories
- Separate notification system

### Notifications
- Bell: Reportee assignments
- Idea Hub: Mentions, comments, likes
- Mark as read → disappears
- Auto-expire after 30 days

### Admin Features
- Support Queries dashboard (admin only)
- HR Queries dashboard (admin only)
- Folder/file delete override
- Role managed via config/admins.json

---

## Environment Variables (.env)

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<key>
SUPABASE_ANON_KEY=<key>
ENCRYPTION_KEY=<random-key>
GEMINI_API_KEY=<google-api-key>
HR_EMAIL=hr@gantecusa.com
SUPPORT_EMAIL=support@gantecusa.com
TOKEN_SECRET=<random-64-byte-hex>
CORS_ORIGIN=http://localhost:10000
PORT=10000
```

---

## Dual Database Sync Strategy

1. **Write**: Always write to SQLite first (instant), then sync to Supabase (background)
2. **Read**: Try Supabase first (cloud), fall back to SQLite (local)
3. **Conflict**: Supabase is source of truth when both have data
4. **Auto-heal**: If user exists in Supabase but not SQLite, auto-create locally
5. **Offline**: App works from SQLite alone if Supabase is unreachable

---

## Deployment

- **Local**: `node server.js` (port 10000)
- **Production**: Deploy to any Node.js host (Render, Railway, etc.)
- **Database**: Supabase cloud (free tier supports this)
- **Storage**: Supabase Storage buckets (resource-uploads)
