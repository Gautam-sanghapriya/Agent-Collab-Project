# Agent-Collab-Project

React registration and admin dashboard for Shri Tech Partners AI Ready sessions.

## Run locally

```bash
npm install
npm run dev
```

On Windows, you can also double-click `run-app.bat`. It installs dependencies if needed and starts the local dev server.

## Notes

- The app stores session, admin, registration, and email configuration data in Supabase when configured.
- If Supabase is not configured, the app falls back to browser storage.
- Initial admin bootstrap passcode: `aiready2026`.
- OTP email delivery uses Google Apps Script. Deploy `otp-sender.gs` as a web app, then paste the `/exec` URL in the admin settings screen.
- Registration export downloads a CSV file.

## Supabase setup

1. Create or open your Supabase project.
2. Open the SQL editor and run `supabase-schema.sql`.
3. Copy `.env.example` to `.env.local` and set:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

For Vercel, Netlify, or Cloudflare Pages, add the same two environment variables in the hosting dashboard.
