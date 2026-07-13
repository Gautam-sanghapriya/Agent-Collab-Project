# Security Policy

## Supported Versions

The following versions of Agent-Collab-Project currently receive security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Branch Protection & Contribution Policy

The `main` branch of this repository is protected.

- **Only the repository owner ([@Gautam-sanghapriya](https://github.com/Gautam-sanghapriya)) can push to or merge changes into `main`.**
- Direct commits to `main` by anyone else are not permitted.
- All contributors must:
  1. Fork the repository or create a feature branch.
  2. Make changes on that branch.
  3. Open a **Pull Request** targeting `main`.
- Every Pull Request requires review and approval by the repository owner before it can be merged.
- Force pushes and branch deletion on `main` are disabled.

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** open a public issue describing the vulnerability.
2. Report it privately via **GitHub Security Advisories**: go to the **Security** tab of this repository and click **"Report a vulnerability"**.
3. Include as much detail as possible:
   - A description of the vulnerability and its potential impact
   - Steps to reproduce the issue
   - Affected files or components (e.g., OTP flow, email scripts, database schema)

### What to Expect

- **Acknowledgement** of your report within **48 hours**.
- A **status update** within **7 days**, including an initial assessment.
- If the vulnerability is **accepted**, a fix will be prioritized and you will be credited (unless you prefer to remain anonymous) once a patch is released.
- If the vulnerability is **declined**, you will receive an explanation of the reasoning.

## Scope

Security reports are especially welcome for the following sensitive areas of this project:

- OTP generation and email delivery (`otp-sender.gs`, `email-sender.gs`)
- Authentication and session handling
- Database schema and access rules (`supabase-schema.sql`)
- Exposure of secrets or credentials (`.env` handling)

Thank you for helping keep Agent-Collab-Project secure!
