# 🚀 How to Run the Gantec Portal

Follow these 3 simple steps to get your portal running.

## Step 1: Open the Project Folder
Go to this location on your computer:
`C:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix`

## Step 2: Start the Server
You have two options:

### Option A: The Easy Way (Recommended)
**Double-click** the file named:
> 📄 **`START_PORTAL.bat`**
> *(A black window will appear. **Leave it open** while you use the site.)*

### Option B: The Manual Way (Terminal)
If you prefer using the terminal (PowerShell/CMD):
1. Right-click in the folder and select **"Open in Terminal"**.
2. Type `npm start` and press **Enter**.

## Step 3: Open the Website
Once the black window says "Gantec Employee Portal running", open your browser and go to:
### 🔗 [http://localhost:3000](http://localhost:3000)

---

## ❌ Common "Why won't it work?" Fixes

### 1. "Cannot find module" error
**Reason:** You are in the wrong folder (usually inside `public`).
**Fix:** Make sure the top of your terminal says `...\ant_fix` and NOT `...\ant_fix\public`.

### 2. "Port 3000 already in use"
**Reason:** You have another window already running the server.
**Fix:** Close all black terminal windows and try double-clicking `START_PORTAL.bat` again.

### 3. "npm is not recognized"
**Reason:** Node.js is not installed on your computer.
**Fix:** Install Node.js from [nodejs.org](https://nodejs.org/).
