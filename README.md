# Pam's Farm Time Clock — PWA

A fully offline Progressive Web App for employee time tracking.
Works on **iPhone, Android, and any modern browser**. No app store needed.

---

## Deploy to GitHub Pages (Free)

### Step 1 — Create a GitHub account
Go to https://github.com and sign up (free).

### Step 2 — Create a new repository
1. Click the **+** icon → **New repository**
2. Name it: `pams-farm-timeclock` (or anything you like)
3. Set it to **Public**
4. Click **Create repository**

### Step 3 — Upload the files
1. On your new repository page, click **uploading an existing file**
2. Drag and drop ALL files from this folder into the upload area:
   - `index.html`
   - `app.js`
   - `styles.css`
   - `export.js`
   - `storage.js`
   - `service-worker.js`
   - `manifest.json`
   - The entire `icons/` folder
3. Scroll down and click **Commit changes**

### Step 4 — Enable GitHub Pages
1. Click **Settings** (tab at top of your repository)
2. In the left sidebar, click **Pages**
3. Under **Branch**, select `main` → click **Save**
4. Wait 1–2 minutes, then your app is live at:
   `https://YOUR-USERNAME.github.io/pams-farm-timeclock/`

---

## Install on iPhone (Safari)

1. Open the app URL in **Safari** on your iPhone
2. Tap the **Share** button (box with arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add**

The app icon will appear on your home screen. It opens full-screen with no browser chrome, just like a native app. **Works completely offline after first load.**

---

## Install on Android (Chrome)

1. Open the app URL in **Chrome**
2. Tap the **⋮** menu → **Add to Home screen**
3. Tap **Add**

---

## Features

- **Clock In / Clock Out** with 24-hour time from device clock
- **Notes** on clock out (optional)
- **Multiple punches** per day supported
- **Timesheet tab** — Thu–Wed work week, last 6 weeks with arrow navigation
- **Daily totals** and **weekly total** in decimal hours
- **Add / Edit / Delete** time entries manually
- **Export CSV** — uses Share Sheet on iOS to send via email, Messages, etc.
- **First-run name prompt** — your name appears on all CSV exports
- **100% offline** — all data stored locally on the device (IndexedDB)
- No accounts, no servers, no subscriptions

---

## Notes

- Data is stored in the browser's IndexedDB on each device separately
- Clearing browser site data will erase time entries — treat exports as your backup
- The service worker caches all files so the app works with no internet after first visit
- CSV is pre-formatted for easy email to pamsfarm2140@gmail.com
