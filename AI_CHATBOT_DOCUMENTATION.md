# 🤖 AI Chatbot Documentation: The "Gantec Assistant"

This document explains exactly how the AI feature was built, what tools were used, and the logic behind it.

---

## 🛠️ 1. What Technologies We Used
We used a "Full Stack" approach to build this:
*   **Engine:** Google Gemini 1.5 Flash (The high-speed AI model).
*   **Backend:** Node.js + Express (To handle the API safely).
*   **Frontend:** Vanilla JavaScript, HTML5, and CSS3 (For the chat interface).
*   **Authentication:** Dotenv (To keep the API Key hidden and secure).

---

## 🧠 2. How the "Idea" Works (The Logic)
The AI doesn't just guess; it follows a specific **Identity Program** we created.

### A. The System Prompt (Identity)
Inside `server.js`, we send a "hidden" message to the AI every time a user speaks. We tell it:
> *"You are the Gantec HR Assistant. You must be concise. You only answer questions about Gantec using these facts..."*

### B. The Knowledge Base
The AI is "grounded" with these specific facts provided in the code:
*   **Weekly Connect:** Thursdays at 4:00 PM IST.
*   **HR Manager:** Hemalatha Malem.
*   **Navigation:** It knows that "Training Resources" are in the sidebar.

---

## 🏗️ 3. How We Built It (Step-by-Step)

### Step 1: Secure API Bridge
Instead of the browser talking to Google, we made a route: `POST /api/chat`.
*   **Why?** Browsers are public. If we put the API key there, anyone could steal it. The server is private and keeps your key safe.

### Step 2: Intent Recognition
We used the **Fetch API** to send the user's message to Google's servers. We set the `temperature` to a low value (concise mode) so the AI doesn't start "hallucinating" or telling jokes—it stays professional.

### Step 3: The Floating UI
We didn't want the chat to take up the whole screen. We built a **Floating Widget**:
*   **Toggle:** A simple circle button at the bottom right.
*   **Glassmorphism:** Using `backdrop-filter: blur(20px)` to make it look premium and modern.
*   **Auto-Scroll:** JavaScript logic that automatically scrolls to the bottom so you can see the latest reply.

---

## 🔄 4. The Data Flow
1.  **User Types:** *"How do I upload a PDF?"* in `faq.html`.
2.  **Frontend:** Sends a JSON request to `/api/chat`.
3.  **Backend:** Combines the user's text with the **Gantec Facts**.
4.  **Google AI:** Reads the facts, reads the question, and writes a short reply.
5.  **You:** See the response instantly in the chat bubble.

---

## 📝 5. How to Update the AI's Knowledge
If the Weekly Connect time changes or you have a new HR manager:
1.  Open `server.js`.
2.  Go to the `/api/chat` route (near line 720).
3.  Edit the text in the `System Prompt` area.
4.  Restart the server!
