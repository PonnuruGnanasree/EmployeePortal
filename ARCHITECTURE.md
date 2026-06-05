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
- View/preview PDFs, DOCX, PPTX, CSV, TXT, images, videos
- AI-powered document summarization (Gemini)
- Points system (+1 upload, +0.5 view, -1 delete)
- Ownership-based delete (only uploader or admin can delete)
- Admin sees delete button on all files; employees only on their own
- Folder create/delete/rename with ownership checks
- File rename (inline double-click)
- Confirm upload modal with folder picker + custom rename
- Dropdown sidebar with expandable folder tree
- YouTube link embedding with auto-redirect

### Document Locker (document-locker.html)
- Private per-user encrypted file storage
- Folder tree with create/rename/delete (sidebar + modal)
- AES-256-CBC encryption at rest
- Only the owner can access their files
- Grid + List view toggle
- Drag-and-drop upload support
- File preview modal (PDF, images, DOCX, PPTX, videos)
- Supabase Storage sync for cloud backup
- Auto-heal: creates stub user profile if missing

### Monthly Feedback (monthly-feedback.html)
- 7-level rubric for 26 competencies across 6 categories
- Self-Assessment (User) + Manager Review (Admin) modes
- Auto-save on every cell click with cloud sync status indicator
- Save (draft) vs Submit (permanent lock)
- Per-month storage with full history
- Period selector (month + year) with auto-navigation to last edited
- Remarks per skill + comments per sub-category
- URL params support: `?period=2026-05&role=user&email=x@y.com`

### Monthly Scorecard (feedback-dashboard.html)
- Competency Focus doughnut chart with User/Manager + Month/Year filters
- Recent Submissions History table with User/Manager/All filter dropdown
- Dynamic data: role, score, status all pulled from database
- View/Edit links navigate to specific period + role in Feedback Insights
- Current Period stat card
- Supports reportee view via `?email=` URL param

### Performance Analysis (analysis.html)
- Overall Skill Progression (line chart) — User vs Manager trend over 12 months
- Skill Fingerprint (radar chart) — 6-category comparison User vs Manager
- Pictorial Metric Breakdown:
  - Horizontal bar chart with tier-based colors (Green=Mastery, Purple=Advanced, Orange=Developing)
  - Grid view with circular gauge cards + category emoji icons
  - Toggle between Chart and Grid views
  - Filter by Mastery/Advanced/Developing tier
  - Search skills by name
  - Dynamic label showing current Role + Period being viewed
- View Role filter (Self-Assessment / Manager Review)
- Year + Month filters
- AI Performance Insight card (month-over-month comparison)
- Download Report (print)
- Supports reportee view via `?email=` URL param

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
- Support Queries dashboard (admin only) — view/delete tickets, change status (pending/in-progress/resolved)
- HR Queries dashboard (admin only) — same status management
- Folder/file delete override (admin can delete any resource)
- Role managed via config/admins.json + Supabase admin_emails table
- Admin sync on server startup
- Category badge only shows when category exists (no "General" fallback)

---

## Feedback Data Flow

```
┌─────────────────────┐     POST /api/feedback/save     ┌──────────────────┐
│  Feedback Insights   │ ──────────────────────────────▶ │   Supabase DB    │
│ (monthly-feedback)   │                                 │  monthly_feedback │
└─────────────────────┘                                  └────────┬─────────┘
                                                                  │
                         GET /api/feedback/data                    │
┌─────────────────────┐ ◀────────────────────────────────────────┘
│  Monthly Scorecard   │
│ (feedback-dashboard) │     Same API endpoint
└─────────────────────┘
                         GET /api/feedback/data
┌─────────────────────┐ ◀────────────────────────────────────────┘
│ Performance Analysis │
│    (analysis.html)   │
└─────────────────────┘
```

- Data keyed by: `user_email` + `period` (YYYY-MM) + `role` (user/admin)
- Saved/submitted data persists permanently
- All three pages read from the same API endpoint
- Role filter values: `user` (Self-Assessment), `admin` (Manager Review)

---

## Rubric Categories (26 Skills)

| Category | Skills | Weight |
|----------|--------|--------|
| Technical Delivery | Output Volume, Accuracy/Quality, Speed/Velocity, Process Adherence, Testing Rigor | 60% (Hard) |
| Solutioning Depth | Root Cause (RCA), Scalability, Edge-Cases, Maintainability, Architectural Design | 60% (Hard) |
| Reliability | Availability, Follow-Through, Crisis Response, Punctuality/Attendance | 60% (Hard) |
| Growth | Self-Learning, Feedback Loop, New POCs, Technology Adoption | 40% (Soft) |
| Presence | Articulation, Stakeholder Interaction, Discussion Energy, Reporting Transparency | 40% (Soft) |
| Assist | Mentorship, Knowledge Sharing, Collaboration, Onboarding Support | 40% (Soft) |

### Scoring Levels (1-7)
| Level | Index | Label |
|-------|-------|-------|
| 1 | 0 | Stagnant |
| 2 | 1 | Fluctuating |
| 3 | 2 | Steady |
| 4 | 3 | Proactive |
| 5 | 4 | High-Perf |
| 6 | 5 | Multiplier |
| 7 | 6 | Engine |

### Tier Classification (Performance Analysis)
| Tier | Score Range | Color |
|------|-------------|-------|
| Mastery | 6-7 (index 5-6) | Green (#10b981) |
| Advanced | 4-5 (index 3-4) | Purple (#6366f1) |
| Developing | 1-3 (index 0-2) | Orange (#f59e0b) |
| No Entry | - | Gray (#e2e8f0) |

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

## API Endpoints

### Authentication
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/signup` | Create new account |
| POST | `/api/auth/login` | Login + get JWT token |
| GET | `/api/auth/profile` | Get user profile |
| PUT | `/api/auth/profile` | Update profile (name, email, password, image) |

### Training Resources
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/folders` | Get all folders with files |
| POST | `/api/folders` | Create new folder |
| POST | `/api/upload` | Upload file to folder |
| POST | `/api/resources/links` | Add YouTube link |
| GET | `/api/file` | Download/view a file |
| DELETE | `/api/file` | Delete a file |
| DELETE | `/api/delete-folder` | Delete entire folder |
| PATCH | `/api/rename-file` | Rename file |
| PATCH | `/api/rename-folder` | Rename folder |
| POST | `/api/view-resource` | Award view points |
| GET | `/api/leaderboard` | Top 3 content leaders |

### Document Locker
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/my-documents/folders` | Get user's private folders |
| POST | `/api/my-documents/folders` | Create private folder |
| POST | `/api/my-documents/upload` | Upload private file |
| GET | `/api/my-documents/file` | Download private file |
| DELETE | `/api/my-documents/file` | Delete private file |
| DELETE | `/api/my-documents/folder` | Delete private folder |
| PATCH | `/api/my-documents/rename-file` | Rename private file |
| PATCH | `/api/my-documents/rename-folder` | Rename private folder |

### Feedback System
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/feedback/data` | Get all feedback for a user |
| POST | `/api/feedback/save` | Save/submit feedback |
| GET | `/api/sub-mails` | Get manager's reportees |
| POST | `/api/sub-mails` | Add reportee |
| DELETE | `/api/sub-mails` | Remove reportee |

### Notifications
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/notifications` | Get bell notifications |
| PUT | `/api/notifications/read` | Mark as read |
| GET | `/api/social/notifications` | Get Idea Hub notifications |
| POST | `/api/social/notifications/read` | Mark social as read |

### Social / Idea Hub
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/social/feed` | Get posts + stories |
| POST | `/api/social/posts` | Create post |
| DELETE | `/api/social/posts/:id` | Delete own post |
| POST | `/api/social/comments` | Add comment |
| POST | `/api/social/likes` | Toggle like |
| POST | `/api/social/stories` | Create 24hr story |
| GET | `/api/social/users/search` | Search users for @mention |

### HR & Support
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/contact-hr` | Submit HR inquiry |
| GET | `/api/hr/queries` | Admin: get all HR queries |
| PATCH | `/api/hr/queries/:id` | Admin: update status |
| DELETE | `/api/hr/queries/:id` | Admin: delete query |
| POST | `/api/employee-support/ticket` | Submit support ticket |
| GET | `/api/admin/support-tickets` | Admin: get all tickets |
| PATCH | `/api/admin/support-tickets/:id` | Admin: update status |
| DELETE | `/api/admin/support-tickets/:id` | Admin: delete ticket |

### Other
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/chat` | AI chatbot (Gemini) |
| POST | `/api/summarize` | Document summarization |
| GET | `/api/holidays` | Company holidays |
| GET | `/api/certifications` | Get certifications |
| POST | `/api/certifications` | Add certification |
| PUT | `/api/certifications/:id` | Update certification |
| DELETE | `/api/certifications/:id` | Delete certification |
| GET | `/api/weekly-sessions` | Weekly Connect sessions |
| POST | `/api/weekly-sessions` | Create session |
| PUT | `/api/weekly-sessions/:id` | Update session |
| DELETE | `/api/weekly-sessions/:id` | Delete session |
| GET | `/api/team-members` | Get team members |
| POST | `/api/team-members` | Add member |
| DELETE | `/api/team-members/:id` | Delete member |
| GET | `/api/hr/config` | Get HR email config |
| GET | `/api/support/config` | Get support email config |
| GET | `/api/config/supabase` | Get Supabase public config |
| GET | `/api/leave/settings` | Get leave portal link |

---

## Deployment

- **Local**: `node server.js` (port 10000)
- **Production**: Deploy to any Node.js host (Render, Railway, etc.)
- **Database**: Supabase cloud (free tier supports this)
- **Storage**: Supabase Storage buckets (resource-uploads)
