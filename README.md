# Agent-Collab-Project

React registration and admin dashboard for Shri Tech Partners AI Ready sessions.

## Run locally

```bash
npm install
npm run dev
```

## Notes

- The app stores session, admin, registration, and EmailJS configuration data in browser storage.
- If `window.storage` is available, the app uses it. Otherwise it falls back to `localStorage`.
- Initial admin bootstrap passcode: `aiready2026`.
- OTP email delivery requires EmailJS service, template, and public key configuration from the admin settings screen.
- Registration export downloads a CSV file.
