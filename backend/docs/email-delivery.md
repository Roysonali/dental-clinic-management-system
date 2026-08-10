# Email Delivery — Password Reset

> **Scope:** This document covers the only email DensCare sends today —
> password-reset instructions (`POST /auth/forgot-password`). There is no
> general notification framework; do not build one here.

## 1. Architecture

- All email goes through a single, tiny abstraction: `EmailService` in
  `backend/app/core/email.py`.
- It is **provider-agnostic and SDK-free**: it sends a plain-text message
  over **SMTP** using Python's standard library (`smtplib`). Both SendGrid
  and Resend (and any SMTP relay) work without a provider library — there
  is deliberately no second email architecture.
- The reset email is dispatched via FastAPI `BackgroundTasks` **after** the
  HTTP response is sent, so `POST /auth/forgot-password` never waits on
  SMTP. This keeps response times uniform (anti-enumeration) and makes the
  flow resilient to a slow relay.
- The reset link inside the email is built from `FRONTEND_BASE_URL` and
  contains the raw (single-use, expiring) reset token. The token is stored
  in the database only as a SHA-256 digest — see
  `PasswordResetToken` in `backend/app/modules/auth/models.py`.

## 2. Environment variables

All values are read from the environment (`.env` in `backend/`). No
credentials are ever hardcoded. Copy `backend/.env.example` to
`backend/.env` and fill in real values.

| Variable | Required to send | Description |
|----------|------------------|-------------|
| `SMTP_HOST` | ✅ | SMTP relay hostname. **Empty ⇒ email delivery is disabled** (safe dev fallback). |
| `SMTP_PORT` | ✅ | Relay port. `587` (STARTTLS) or `465` (implicit TLS). |
| `SMTP_USERNAME` | when the relay requires auth | Login — SendGrid: literal `apikey`; Resend: literal `resend`. |
| `SMTP_PASSWORD` | when the relay requires auth | The provider secret (SendGrid API key / Resend `re_…` key). |
| `SMTP_FROM_EMAIL` | ✅ | Verified sender address. **Must be authenticated with the provider** (see §3/§4) or delivery is rejected. |
| `SMTP_USE_TLS` | – | `true` = STARTTLS after connect (default). Set `false` when `SMTP_USE_SSL=true`. |
| `SMTP_USE_SSL` | – | `true` = implicit TLS from the first byte (for port `465`). |
| `FRONTEND_BASE_URL` | ✅ | Public origin used to build the reset link (e.g. `https://app.denscare.clinic`). Production must never use localhost. |
| `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES` | – | Reset-link lifetime in minutes (default `30`). |
| `EMAIL_LOG_RESET_LINKS` | – | **Dev only.** `true` logs the full reset link when SMTP is unconfigured. Never enable in production. |

## 3. Option A — SendGrid (recommended)

1. Create a SendGrid account and an **API key**
   (`Settings → API Keys → Create API Key`).
2. Authenticate a sender (`Settings → Sender Authentication`): either add a
   **single verified sender** (for quick tests) or authenticate a domain
   with the DNS records SendGrid provides. Emails will not be delivered
   from an unauthenticated address.
3. Set in `backend/.env`:

   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USERNAME=apikey
   SMTP_PASSWORD=<your-sendgrid-api-key>
   SMTP_FROM_EMAIL=no-reply@<verified-domain>
   SMTP_USE_TLS=true
   SMTP_USE_SSL=false
   ```

4. Verify (see §5).

## 4. Option B — Resend (alternative)

1. Create a Resend account and an **API key** (https://resend.com/api-keys,
   `re_…`).
2. Add and verify your sending domain in the Resend dashboard (DKIM/SPF/
   DMARC records). The `From` domain must be verified.
3. Set in `backend/.env`:

   ```env
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_USERNAME=resend
   SMTP_PASSWORD=re_<your-api-key>
   SMTP_FROM_EMAIL=no-reply@<verified-domain>
   SMTP_USE_TLS=false
   SMTP_USE_SSL=true
   ```

   (Resend also accepts port `587` with `SMTP_USE_TLS=true`.)

## 5. Verifying the setup

**Quick test** (sends one email through the configured relay):

```bash
cd backend
python -c "from app.core.email import email_service; email_service.send_password_reset_email('you@example.com', 'https://app.denscare.clinic/auth/reset-password?token=test-1234567890abcdef')"
```

Successful send is logged at INFO: `Password reset email sent: to=…`.
A failure is logged at ERROR without raising (see §6) — check the log.

**End-to-end:** run the backend, call the public endpoint, and confirm the
email arrives and the link opens the reset page:

```bash
curl -s -X POST http://localhost:8000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com"}'
# → {"message": "If an account exists for this email address, you will receive password reset instructions."}
```

## 6. Behaviour when SMTP is not configured

With `SMTP_HOST` empty, `EmailService.is_configured` is `False` and the
service degrades gracefully:

- `EMAIL_LOG_RESET_LINKS=true` → the full reset link is written to the
  application log (**development only** — this deliberately contains the
  raw token).
- otherwise → an opaque warning is logged (`Password reset email NOT sent
  for user=…`). The raw token, password, and hash are never logged.

`POST /auth/forgot-password` always returns the same generic message;
delivery failures are logged, not surfaced, so the endpoint cannot be used
to enumerate accounts.

## 7. Security notes

- No credentials in source code — everything comes from the environment.
- Sending runs out-of-band (background task) and failures never propagate
  to the HTTP response.
- The token lives only in the email link; only its SHA-256 digest is
  stored, and it expires in `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES` minutes
  and is single-use.
