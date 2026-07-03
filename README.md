# Agent-Collab-Project

React registration and admin dashboard for Shri Tech Partners AI Ready sessions.

## Run locally

```bash
npm install
npm run dev
```

On Windows, you can also double-click `run-app.bat`. It installs dependencies if needed and starts the local dev server.

## Notes

- The app stores session, admin, registration, and email configuration data in browser storage.
- If `window.storage` is available, the app uses it. Otherwise it falls back to `localStorage`.
- Initial admin bootstrap passcode: `aiready2026`.
- OTP email delivery uses Google Apps Script. Deploy `otp-sender.gs` as a web app, then paste the `/exec` URL in the admin settings screen.
- Registration export downloads a CSV file.
