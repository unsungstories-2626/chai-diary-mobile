# Chai Diary — your mobile tea tracker

Mark one tea per day, starting at ₹12. Your bill is always the number of marked days × that month’s rate.

## Start here

1. Open your website on your phone.
2. Tap **Mark today’s tea**, or tap any earlier date in the calendar.
3. To remove a cup, tap its date and confirm.
4. Tap **Mark as paid** after paying the tea boy. Paid months are locked against accidental calendar/rate edits. Undo paid status to edit again.
5. **History** shows every month in the selected year. **Share bill** opens your phone’s sharing menu, including WhatsApp where available. **Export month** downloads a CSV.

**Without Firebase, records are saved only in this browser on this device.** They are real records, not demonstration data. They do not sync between devices, browsers, or website addresses. Clearing browser data removes device-only records. Download a backup from Settings occasionally.

## What you need to upload to GitHub

Create a repository called **chai-diary**. Upload all the files in this folder directly to its root, including the two PNG icons. The root should contain `index.html`, not another enclosing `chai-diary` folder.

Required website files:

- index.html
- style.css
- app.js
- core.js
- cloud.js
- firebase-config.js
- manifest.json
- sw.js
- icon-192.png
- icon-512.png

Also upload README.md and firestore.rules so the in-app guide links work. There are no npm dependencies, no React, and no build command. Do not upload the ZIP itself as your website.

### Enable GitHub Pages

1. Open your GitHub repository → **Settings → Pages**.
2. Under Build and deployment, choose **Deploy from a branch**.
3. Select **main** and **/(root)**, then Save.
4. Wait for the deployment and use the URL GitHub displays, usually `https://YOUR_USERNAME.github.io/chai-diary/`.
5. Open that HTTPS URL on your phone. Do not open index.html by double-clicking: browsers restrict JavaScript modules on `file://` URLs.

For local development, run `python -m http.server 8000` in this folder, then open `http://localhost:8000`. Python is optional and needed only for this local preview, not hosting. Add `localhost` to Firebase authorized domains if testing Google login locally.

## Enable online cloud storage once

Use **Firebase**, not Claude, to store the records. Claude Code can edit the website; it is not the database. Use the same Firebase project and Google account on each device.

### 1. Create a dedicated Firebase project

1. Go to https://console.firebase.google.com/ and create a project, for example **rushi-tea-tracker**. A separate project keeps your school app unaffected.
2. Google Analytics is optional; this app does not use it.
3. In Project overview, choose the Web icon `</>` to register a web app called **Chai Diary**.
4. Copy the web app’s `firebaseConfig` object. You can find it again under Project settings → General → Your apps → SDK setup and configuration → Config.

### 2. Enable Google sign-in

1. Open **Build → Authentication → Get started**.
2. Open **Sign-in method → Google → Enable**.
3. Choose your support email and Save.
4. Under **Settings → Authorized domains**, add the hostname where the app is hosted.
   - GitHub Pages: `YOUR_USERNAME.github.io` (no https:// and no `/chai-diary/`).
   - For the provided hosted website: open its Settings → Set up cloud sync and copy the displayed hostname.
   - Local preview: `localhost` when needed; it may not be authorized by default for new projects.

### 3. Create and secure Cloud Firestore

1. Open **Build → Firestore Database → Create database**.
2. Use the default database and Standard edition/native Firestore, where offered. Pick an appropriate region; a region near India is sensible for your use.
3. Choose production mode. This app does not need open test-mode rules.
4. Open the included `firestore.rules` file. Copy its complete contents.
5. Paste it into **Firestore Database → Rules** and click **Publish**.

These rules allow a signed-in person to read and write only their own months. No database password or service-account private key belongs in the website. Firebase’s client web config is intended to be public; access is protected by Authentication and Firestore rules. Do not apply these replacement rules to an existing unrelated Firebase project without preserving that app’s rules.

### 4. Paste your config

**Recommended for GitHub Pages:** edit `firebase-config.js`. Replace placeholder values on **lines 3–8** with your actual web app config values. The object starts on **line 2**. Commit the change to GitHub and wait for Pages to deploy. Every device opening this website then uses the same project.

```js
export const firebaseConfig = {
  apiKey: "YOUR_REAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "YOUR_STORAGE_BUCKET_FROM_FIREBASE",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

**No code editing option:** open the website → Settings → Set up cloud sync. Paste the complete `const firebaseConfig = { ... };` snippet from Firebase, with double-quoted values, then tap **Save config & reload**. This override stays in that browser. Repeat on other devices using the same config. A browser override takes precedence over firebase-config.js; to change projects, sign out first and paste the new config.

### 5. Sign in and verify

1. Open Settings → **Sign in with Google**. Allow the login popup if your browser asks.
2. Mark a tea day. Wait for **Cloud synced**.
3. Open the same website on another device, using the same Firebase config and Google account. The marked date should appear.
4. Device-only records stay separate. To move them, sign in on the original device and tap **Copy device-only months to cloud**. Only months missing from cloud are copied. Existing cloud months are skipped entirely, including their dates, rate and payment status. Keep a backup if combining records manually later.

### Mobile Google login and redirects

This app uses Google popup login. Open it in Chrome or Safari, not an embedded WhatsApp/Instagram browser. If a popup is blocked, allow popups for the site and tap Sign in again.

Automatic redirect login is **off on GitHub Pages** because third-party storage restrictions can break Firebase redirects across origins. Merely authorizing the domain does not fix this. If you want redirects, host on your project's `firebaseapp.com` domain, or implement a supported same-origin Firebase auth setup. Only then set `allowRedirectSignIn = true` in firebase-config.js. The app will use a redirect only when the popup is blocked. Refer to Firebase’s official redirect guide below.

## Phone installation and offline use

- Android Chrome: browser menu → Install app / Add to Home screen. Settings also shows an install button when the browser supplies an installation prompt.
- iPhone Safari: Share → Add to Home Screen.
- Open the website at least once while online so the app files can be cached. Connect and sign in at least once online before expecting cloud mode to work offline.
- In device mode, entries save to localStorage.
- In cloud mode, Firestore uses persistent IndexedDB caching and supports multiple tabs. Existing cached months can be edited offline; queued changes sync when connection returns. New uncached months require an online load first to avoid overwriting unseen records.
- “Changes waiting to sync” means the cloud has **not yet confirmed** the save. Do not clear browser data or sign out before it says Cloud synced. Offline persistence depends on browser storage being available; first login requires internet.
- The cache retains records on the device. Use your personal phone/computer. Signing out separates the app view but is not a secure erasure of browser cache.
- For website updates, re-open or reload online. Close older tabs if a service-worker update is waiting. If changing cached files, bump the CACHE version in sw.js for a clean cache update.

## Calculations and behavior

- Maximum one tea per date. Repeated taps cannot create two cups for a day.
- Default rate is ₹12 for each new month. Changing a rate updates only the displayed month; future months still start at ₹12.
- Paise are supported, with totals rounded to two decimal places.
- Days without tea counts **strictly past dates only**, including weekends. Today and future days are excluded.
- Future tea dates are disabled. Calendar weeks run Monday through Sunday.
- Dates always follow **Asia/Kolkata**, even when you travel. Intl.DateTimeFormat builds India date keys without UTC date conversion.
- Paid records are protected in the UI; undo paid status to edit. This is a personal diary, not a payment processor or a tamper-proof accounting ledger.
- History shows the selected year. Months without documents display “No entries”, not an invented paid/unpaid bill.
- The backup is a portable JSON export, including all cloud months when online. This version does not have a backup-restore screen; keep JSON as an archive or for a later developer-assisted restore.

## Data structure

One Firestore document per month: `users/{uid}/months/{YYYY-MM}`.

```json
{
  "rate": 12,
  "days": { "01": true, "02": true },
  "paid": false,
  "paidOn": null,
  "updatedAt": "Firestore server timestamp"
}
```

The year view listens to at most 12 month documents through one query. Changing a day writes only that day’s map field, leaving other days untouched. Removing a cup deletes that field. Concurrent changes to the same field use Firestore’s last-write-wins behavior. Avoid editing the same month on two offline devices at once, especially rate and payment status. Firestore usage is subject to your project’s quotas and pricing; this app does not enable billing or require Cloud Functions.

## Troubleshooting

- **Cloud access denied:** confirm Google login and publish the rules in the correct Firebase project.
- **Unauthorized domain:** add the exact hostname in Authentication settings.
- **Login not enabled:** enable Google as a sign-in provider.
- **No data on a second device:** use the same URL, Google account and Firebase project. Device-only records need explicit copying to cloud.
- **Cloud fails to load offline:** go online once, allow browser storage, reload and sign in.
- **Wrong rate:** open that month → Edit beside price per cup. Undo Paid first if necessary.
- **Device storage unavailable:** no success message is shown for failed local writes; enable storage or download an existing backup before clearing anything.

## Verification

Automated checks cover date boundaries in India, leap years, per-month rates, calculation/rounding, future dates, config parsing, device save/undo/payment/history flows, and Firestore field patch construction. Browser visual QA and live Firebase login/sync need testing with your own project; they were not verified against real credentials.

## Official references

- Firebase Google sign-in: https://firebase.google.com/docs/auth/web/google-signin
- Firebase redirect compatibility: https://firebase.google.com/docs/auth/web/redirect-best-practices
- Firestore offline caching: https://firebase.google.com/docs/firestore/manage-data/enable-offline
- Firestore writes: https://firebase.google.com/docs/firestore/manage-data/add-data
- GitHub Pages publishing: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

Created for Rushi · Chai Diary
