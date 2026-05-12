# Gantec Employee Portal: Technical Documentation

This document provides a deep dive into the architecture, features, and technologies used in the Gantec Employee Portal.

---

## 1. Core Technology Stack

### **Frontend (The User Experience)**
*   **Architecture**: Multi-page Application (MPA) using Vanilla HTML5, CSS3, and ES6+ JavaScript.
*   **Styling**: Modern "Glassmorphism" UI using CSS variables, backdrop-filters, and custom animations.
*   **Design Tokens**: Centralized in `branding.css` and `styles.css` to maintain Gantec's corporate identity (Deep Blue & Vibrant Orange).
*   **Client-side Libraries**:
    *   **Mammoth.js**: Renders `.docx` files directly in the browser.
    *   **JSZip**: Parses `.pptx` files for browser-based presentations.
    *   **PDF.js**: Powers the high-fidelity PDF viewer.

### **Backend (The Engine)**
*   **Node.js & Express**: High-concurrency server handling API routing and file processing.
*   **Supabase JS SDK**: Facilitates secure cloud communication and real-time data sync.
*   **Better-SQLite3**: High-performance local database for offline fallback and speed.
*   **Gemini AI API**: Used for intelligent document analysis and automated summarization.

---

## 2. Page-by-Page Deep Dive

### **🏠 Home Dashboard**
*   **Specialty**: Centralized hub with real-time analytics.
*   **Key Feature**: Dynamic "Stats Banner" that fetches counts of all documents and folders across the system.
*   **Technical Detail**: Uses CSS Grid for a responsive layout that adapts from large monitors to mobile devices seamlessly.

### **📚 Training Resources**
*   **Specialty**: Intelligent learning management.
*   **Key Feature**: **AI Summarization**. When a PDF is uploaded, the Gemini AI engine analyzes the text and provides a concise summary to save employees time.
*   **Integrations**: YouTube API integration for video-based training modules.

### **🔒 Document Locker**
*   **Specialty**: Absolute User Privacy.
*   **Key Feature**: **Multi-level Folders**. Supports nested directories (Folders within Folders) for complex organization.
*   **Security**: Uses **Filename Hashing**. Files are renamed on the server to prevent unauthorized guessing of file locations. Every request is filtered by the user's authenticated email.

### **🗓️ Company Holidays**
*   **Specialty**: Interactive Schedule Management.
*   **Key Feature**: **Auto-Calculating Calendar**. The calendar is built dynamically via JS, ensuring it always displays the correct dates for 2026.
*   **Data Flow**: Fetches holiday data from Supabase, allowing HR to add new holidays (like 2027) without changing a single line of code.

### **🤝 Weekly Connect**
*   **Specialty**: Team Collaboration.
*   **Key Feature**: **Session Cards**. A social-media-style feed where weekly sessions are posted.
*   **Real-time Logic**: Uses Supabase Real-time to ensure that when a new session is posted, it appears on everyone's screen instantly.

### **🎓 Certifications**
*   **Specialty**: Professional Upskilling.
*   **Key Feature**: **Dynamic Requirements**. Displays a list of required and recommended certifications, categorized by impact (High/Medium).
*   **Technical Detail**: Data is fetched from a dedicated `certifications` table in the cloud.

### **🚪 Leave Portal (Power Apps Integration)**
*   **Specialty**: Individualized Redirection.
*   **Key Feature**: **User-Specific Links**. The "Leave Portal" button is not a static link.
*   **Logic**: A background script checks the logged-in user's email, looks up their specific Power Apps URL in Supabase, and updates the button destination before they even click it.

---

## 3. Data Flow & Synchronization

### **The "Hybrid" Strategy**
The portal uses a **Dual-Database System**:
1.  **Primary**: Supabase (PostgreSQL) – The cloud source of truth.
2.  **Fallback**: SQLite – The local source of speed.

### **Self-Healing Sync**
In `server.js`, I implemented a **Startup Sync Logic**:
*   Whenever the server starts, it compares the local files/rows with the cloud entries.
*   If a file exists in Supabase but not locally, the server "heals" itself by downloading the metadata.
*   This ensures that no matter where the server is running, the data is consistent.

---

## 4. Security & Privacy Features

*   **Encrypted Storage**: Sensitive documents are stored in private buckets with limited access keys.
*   **Environment Isolation**: All sensitive credentials (API Keys, DB URLs) are stored in a `.env` file and are never exposed to the frontend.
*   **Email-Based Isolation**: Every API request for private documents requires an email parameter, which is cross-referenced against the internal user table.

---

## 5. UI/UX Principles
*   **Micro-interactions**: Hover effects on cards, smooth transitions on the sidebar, and "pulsing" loading states for a premium feel.
*   **Glassmorphism**: Use of `backdrop-filter: blur()` to create a layered, modern aesthetic.
*   **Performance**: Zero-dependency frontend ensures that even on slow connections, the UI feels snappy and responsive.
