# DensCare — Production Deployment Checklist
## Step-by-Step Hosting & Setup Guide

> **Purpose:** This document guides you through deploying DensCare to production.
> Follow each step in order. Check off items as you complete them.

---

## Overview: What We're Deploying

```
┌─────────────────────────────────────────────────────┐
│                  PRODUCTION ARCHITECTURE              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  🌐 User Browser                                     │
│       │                                              │
│       │  HTTPS                                      │
│       ▼                                              │
│  ┌──────────────┐                                   │
│  │   Frontend    │ ◄── Vercel (Free tier)            │
│  │   (React)     │     https://denscare.in           │
│  └──────┬───────┘                                   │
│         │  API calls                                │
│         ▼                                           │
│  ┌──────────────┐                                   │
│  │   Backend     │ ◄── Railway ($5/mo)              │
│  │   (FastAPI)   │     https://api.denscare.in      │
│  └──────┬───────┘                                   │
│         │                                           │
│         ▼                                           │
│  ┌──────────────┐                                   │
│  │   Database    │ ◄── Neon PostgreSQL (Free tier)  │
│  │   (PostgreSQL)│     Managed & auto-backup        │
│  └──────────────┘                                   │
│                                                      │
│  📧 Email ──── SendGrid (Free tier: 100/day)        │
│  💳 Payments ── Razorpay (Pay per transaction)      │
│  🌍 Domain ──── GoDaddy / Namecheap                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: Account Setup (Day 1)
### Estimated time: 2-3 hours

### Step 1.1: Create Cloud Accounts

- [ ] **Vercel** (Frontend Hosting)
  - Go to [vercel.com](https://vercel.com)
  - Sign up with GitHub / Email
  - Free tier: ✅ 100GB bandwidth/month (sufficient)

- [ ] **Railway** (Backend Hosting)
  - Go to [railway.app](https://railway.app)
  - Sign up with GitHub
  - Free tier: $5 credit/month (sufficient for small clinic)

- [ ] **Neon** (PostgreSQL Database)
  - Go to [neon.tech](https://neon.tech)
  - Sign up with GitHub
  - Free tier: 0.5GB storage (sufficient for testing)
  - **Recommended:** Pro plan ($19/mo) for 10GB + daily backups

- [ ] **SendGrid** (Transactional Emails)
  - Go to [sendgrid.com](https://sendgrid.com)
  - Sign up for free account
  - Free tier: 100 emails/day
  - **Note:** Required for password reset emails

- [ ] **GoDaddy India** (Domain Purchase)
  - Go to [godaddy.in](https://godaddy.in)
  - Sign up / Login

### Step 1.2: Purchase Domain

- [ ] Search for your preferred domain:
  - `denscare.in` (₹500-800/year) — **Recommended**
  - `denscare.clinic` (₹2,000-3,000/year)
  - `yourclinicname.in` (varies)
- [ ] Add to cart and complete purchase
- [ ] Note down your domain name: `_______________`

---

## Phase 2: Database Setup (Day 1)
### Estimated time: 1-2 hours

### Step 2.1: Create Neon PostgreSQL Database

- [ ] Login to [console.neon.tech](https://console.neon.tech)
- [ ] Click **"Create Project"**
  - Project name: `denscare`
  - Region: **Mumbai** (closest to India)
  - PostgreSQL version: 15+
- [ ] **Save these credentials securely:**
  ```
  Host:     ep-xxxxxx.ap-south-1.aws.neon.tech
  Database: denscare
  User:     neondb_owner
  Password: xxxxxxxxxxxxxxxx
  Port:     5432
  ```
- [ ] Copy the full connection string:
  ```
  postgresql://neondb_owner:xxxx@ep-xxxxxx.ap-south-1.aws.neon.tech/denscare?sslmode=require
  ```

### Step 2.2: Test Database Connection

- [ ] Open terminal and test:
  ```bash
  # Install psql client (if not installed)
  # Windows: Download from postgresql.org
  # Mac: brew install postgresql
  # Linux: sudo apt install postgresql-client

  # Test connection
  PGPASSWORD=your_password psql -h ep-xxxxxx.ap-south-1.aws.neon.tech -U neondb_owner -d denscare

  # If connected, you'll see: denscare=>
  # Type \q to exit
  ```

---

## Phase 3: Backend Deployment (Day 2)
### Estimated time: 2-3 hours

### Step 3.1: Prepare Backend for Production

- [ ] **Update CORS in `backend/main.py`**

Replace the existing CORS configuration:
```python
# BEFORE (development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AFTER (production) - Add your frontend URLs
import os

FRONTEND_URLS = os.getenv("FRONTEND_URLS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Create `Procfile`** in `backend/` directory:
  ```
  web: uvicorn main:app --host 0.0.0.0 --port $PORT
  ```

- [ ] **Create `railway.json`** in `backend/` directory:
  ```json
  {
    "$schema": "https://railway.app/railway.schema.json",
    "build": {
      "builder": "NIXPACKS"
    },
    "deploy": {
      "startCommand": "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT",
      "healthcheckPath": "/",
      "healthcheckTimeout": 300,
      "restartPolicyType": "ON_FAILURE",
      "restartPolicyMaxRetries": 3
    }
  }
  ```

- [ ] **Create `nixpacks.toml`** in `backend/` directory (optional, for custom build):
  ```toml
  [phases.setup]
  nixPkgs = ["python311"]

  [phases.install]
  cmds = ["pip install -r requirements.txt"]

  [phases.build]
  cmds = []
  ```

### Step 3.2: Push Backend to GitHub

- [ ] Initialize git in backend (if not already):
  ```bash
  cd backend
  git init
  git add .
  git commit -m "Initial backend commit"
  ```

- [ ] Create a new GitHub repository: `denscare-backend`
- [ ] Push to GitHub:
  ```bash
  git remote add origin https://github.com/YOUR_USERNAME/denscare-backend.git
  git push -u origin main
  ```

### Step 3.3: Deploy Backend to Railway

- [ ] Login to [railway.app](https://railway.app)
- [ ] Click **"New Project"** → **"Deploy from GitHub Repo"**
- [ ] Select your `denscare-backend` repository
- [ ] Railway will auto-detect it's a Python project
- [ ] Go to **"Variables"** tab and add all environment variables:

  ```
  # ── Database ──────────────────────────────────
  DATABASE_URL=postgresql://neondb_owner:xxxx@ep-xxxxxx.ap-south-1.aws.neon.tech/denscare?sslmode=require

  # ── JWT / Authentication ──────────────────────
  JWT_SECRET=generate-a-strong-random-string-min-32-chars
  JWT_ALGORITHM=HS256
  ACCESS_TOKEN_EXPIRE_MINUTES=30

  # ── Frontend URLs (for CORS) ──────────────────
  FRONTEND_URLS=https://denscare.in,https://www.denscare.in

  # ── Frontend Base URL (for password reset) ────
  FRONTEND_BASE_URL=https://denscare.in

  # ── Password Reset ────────────────────────────
  PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30

  # ── File Uploads ──────────────────────────────
  UPLOAD_DIR=/tmp/uploads
  MAX_UPLOAD_SIZE_MB=10

  # ── Email (SendGrid) ──────────────────────────
  SMTP_HOST=smtp.sendgrid.net
  SMTP_PORT=587
  SMTP_USERNAME=apikey
  SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxxxxxx
  SMTP_FROM_EMAIL=no-reply@denscare.in
  SMTP_USE_TLS=true
  SMTP_USE_SSL=false

  # ── Razorpay (add later) ──────────────────────
  RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
  RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
  ```

- [ ] Click **"Deploy"**
- [ ] Wait for deployment to complete (2-5 minutes)
- [ ] **Note your backend URL:** `https://your-app-name.up.railway.app`
- [ ] Test the health check:
  ```bash
  curl https://your-app-name.up.railway.app/
  # Expected: {"message":"DensCare Backend Running"}
  ```

### Step 3.4: Run Database Migrations

- [ ] Open Railway dashboard → Your project → **"Deploy"** tab
- [ ] Open the **"Shell"** tab (or use Railway CLI):
  ```bash
  # Run all 17 Alembic migrations
  alembic upgrade head

  # Seed roles (if not auto-seeded)
  python -m app.database.seed_roles
  ```

- [ ] Verify tables were created:
  ```bash
  psql $DATABASE_URL -c "\dt"
  # Should show 30 tables
  ```

### Step 3.5: Generate Strong JWT Secret

- [ ] Run this command to generate a secure secret:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(48))"
  ```
- [ ] Copy the output and set it as `JWT_SECRET` in Railway variables
- [ ] **NEVER share this secret or commit it to git**

---

## Phase 4: Frontend Deployment (Day 2)
### Estimated time: 1-2 hours

### Step 4.1: Update Frontend API URL

- [ ] **Create `frontend/.env.production`:**
  ```
  VITE_API_BASE_URL=https://your-app-name.up.railway.app
  ```

- [ ] **Update `frontend/src/services/api.ts`:**

Replace the hardcoded URL:
```typescript
// BEFORE
export const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 15_000,
});

// AFTER
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
  timeout: 15_000,
});
```

- [ ] **Create `frontend/src/vite-env.d.ts`:**
  ```typescript
  /// <reference types="vite/client" />

  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  ```

### Step 4.2: Push Frontend to GitHub

- [ ] Initialize git in frontend (if not already):
  ```bash
  cd frontend
  git init
  git add .
  git commit -m "Initial frontend commit"
  ```

- [ ] Create a new GitHub repository: `denscare-frontend`
- [ ] Push to GitHub:
  ```bash
  git remote add origin https://github.com/YOUR_USERNAME/denscare-frontend.git
  git push -u origin main
  ```

### Step 4.3: Deploy Frontend to Vercel

- [ ] Login to [vercel.com](https://vercel.com)
- [ ] Click **"New Project"** → **"Import Git Repository"**
- [ ] Select your `denscare-frontend` repository
- [ ] Configure settings:
  - **Framework Preset:** Vite
  - **Build Command:** `npm run build`
  - **Output Directory:** `dist`
  - **Install Command:** `npm install`
- [ ] Go to **"Environment Variables"** and add:
  ```
  VITE_API_BASE_URL = https://your-app-name.up.railway.app
  ```
- [ ] Click **"Deploy"**
- [ ] Wait for deployment (1-2 minutes)
- [ ] **Note your frontend URL:** `https://denscare-xxxx.vercel.app`

### Step 4.4: Connect Custom Domain to Vercel

- [ ] In Vercel dashboard → Your project → **"Settings"** → **"Domains"**
- [ ] Enter your domain: `denscare.in`
- [ ] Click **"Add"**
- [ ] Vercel will show DNS records to configure:
  ```
  Type: A
  Name: @
  Value: 76.76.21.21

  Type: CNAME
  Name: www
  Value: cname.vercel-dns.com
  ```

- [ ] Go to your domain registrar (GoDaddy):
  - Login → My Products → DNS Management
  - Add the DNS records from Vercel
  - **Wait 5-30 minutes** for DNS propagation

- [ ] Verify domain is connected:
  ```bash
  # Test DNS resolution
  nslookup denscare.in

  # Test website
  curl -I https://denscare.in
  # Should return: HTTP/2 200
  ```

---

## Phase 5: Email Setup (Day 3)
### Estimated time: 1 hour

### Step 5.1: Configure SendGrid

- [ ] Login to [SendGrid dashboard](https://app.sendgrid.com)
- [ ] Go to **Settings** → **Sender Authentication**
- [ ] Choose **"Single Sender Verification"** (for testing)
  - From Email: `no-reply@denscare.in`
  - From Name: `DensCare`
  - Reply To: `support@denscare.in`
- [ ] Verify the email (check inbox for verification link)

- [ ] For production, use **Domain Authentication**:
  - Go to **Settings** → **Sender Authentication** → **Authenticate Your Domain**
  - Enter your domain: `denscare.in`
  - SendGrid will provide DNS records to add:
    ```
    SPF record (TXT)
    DKIM records (CNAME x3)
    DMARC record (TXT)
    ```
  - Add these to your GoDaddy DNS settings
  - Wait for verification (may take 24-48 hours)

- [ ] **Create API Key:**
  - Go to **Settings** → **API Keys** → **Create API Key**
  - Name: `denscare-production`
  - Permissions: **Full Access** (or at least "Mail Send")
  - Copy the API key: `SG.xxxxxxxxxxxxxxxxxxxx`
  - **Save it securely — it won't be shown again**

- [ ] **Set environment variable in Railway:**
  ```
  SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxxxxxx
  ```

### Step 5.2: Test Email Sending

- [ ] Register a test user on the frontend
- [ ] Click "Forgot Password"
- [ ] Check if email is received
- [ ] If not received, check SendGrid Activity log for errors

---

## Phase 6: Razorpay Setup (Day 3-4)
### Estimated time: 2-3 hours

### Step 6.1: Create Razorpay Account

- [ ] Go to [razorpay.com](https://razorpay.com)
- [ ] Click **"Sign Up"**
- [ ] Complete business registration:
  - Business Type: **Sole Proprietorship** / **Private Limited**
  - PAN Card details
  - Bank Account details (for settlements)
  - GST Number (if applicable)
- [ ] Complete KYC verification
- [ ] Wait for account activation (usually 1-2 business days)

### Step 6.2: Get API Keys

- [ ] Login to Razorpay Dashboard
- [ ] Go to **Settings** → **API Keys**
- [ ] Click **"Generate Key"**
- [ ] Copy:
  - **Key ID:** `rzp_test_xxxxxxxxxxxxx` (or `rzp_live_xxx` for production)
  - **Key Secret:** `xxxxxxxxxxxxxxxxxxxxxxxx`
- [ ] **Set environment variables in Railway:**
  ```
  RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
  RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
  ```

### Step 6.3: Configure Webhooks

- [ ] In Razorpay Dashboard → **Settings** → **Webhooks**
- [ ] Click **"Add New Webhook"**
  - **URL:** `https://your-app-name.up.railway.app/api/payments/webhook`
  - **Secret:** Generate a strong random string
  - **Events to subscribe:**
    - `payment.captured`
    - `payment.failed`
    - `refund.created`
    - `refund.processed`
- [ ] Click **"Create Webhook"**
- [ ] **Set webhook secret in Railway:**
  ```
  RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
  ```

### Step 6.4: Test Payment Flow

- [ ] Use Razorpay test mode (keys start with `rzp_test_`)
- [ ] Test card details (Razorpay sandbox):
  ```
  Card Number: 4111 1111 1111 1111
  Expiry: Any future date
  CVV: Any 3 digits
  Name: Any name
  ```
- [ ] Test UPI:
  ```
  UPI ID: success@razorpay (for success)
  UPI ID: failure@razorpay (for failure)
  ```
- [ ] Verify payment appears in Razorpay dashboard
- [ ] Verify payment is recorded in your database

---

## Phase 7: Post-Deployment Verification (Day 4)
### Estimated time: 2-3 hours

### Step 7.1: Smoke Tests

- [ ] **Backend Health Check:**
  ```bash
  curl https://your-app-name.up.railway.app/
  # Expected: {"message":"DensCare Backend Running"}
  ```

- [ ] **API Docs:**
  ```bash
  # Open in browser
  https://your-app-name.up.railway.app/docs
  # Should show Swagger UI with all endpoints
  ```

- [ ] **Frontend loads:**
  ```bash
  curl -I https://denscare.in
  # Expected: HTTP/2 200
  ```

### Step 7.2: Feature Verification Checklist

- [ ] **Authentication:**
  - [ ] Register a new user (Admin)
  - [ ] Login with the new user
  - [ ] Test "Forgot Password" flow
  - [ ] Verify JWT token is stored in browser

- [ ] **User Management:**
  - [ ] Register a second user (Receptionist)
  - [ ] Admin approves the new user
  - [ ] Both users can login

- [ ] **Patient Management:**
  - [ ] Create a new patient
  - [ ] Verify patient appears in list
  - [ ] Edit patient details
  - [ ] Deactivate patient

- [ ] **Appointments:**
  - [ ] Book an appointment
  - [ ] Verify no double-booking
  - [ ] Cancel an appointment

- [ ] **Doctor Management:**
  - [ ] Create a doctor profile
  - [ ] Add specializations
  - [ ] Set weekly schedule

- [ ] **Patient Records:**
  - [ ] Create a patient record
  - [ ] Add a diagnosis
  - [ ] Add a prescription
  - [ ] Upload an attachment
  - [ ] Finalize the record

- [ ] **Treatment Plans:**
  - [ ] Create a treatment plan
  - [ ] Add procedure items
  - [ ] Submit for review
  - [ ] Approve the plan

- [ ] **Billing:**
  - [ ] Create an invoice
  - [ ] Issue the invoice
  - [ ] Record a payment
  - [ ] Generate receipt
  - [ ] View billing dashboard

- [ ] **Mobile View:**
  - [ ] Test on Chrome mobile (DevTools responsive mode)
  - [ ] Test on actual mobile device
  - [ ] Verify sidebar navigation works
  - [ ] Verify forms are usable on mobile

### Step 7.3: Security Verification

- [ ] Verify HTTPS is working (padlock icon in browser)
- [ ] Verify CORS is configured correctly (no mixed content errors)
- [ ] Verify unauthorized API calls return 401
- [ ] Verify RBAC (receptionist can't access admin features)
- [ ] Check that `.env` files are NOT in git:
  ```bash
  git ls-files | grep -E "\.env$"
  # Should return nothing
  ```

---

## Phase 8: Staff Training (Day 5)
### Estimated time: 1-2 hours

### Step 8.1: Create All Staff Accounts

- [ ] Admin account (clinic owner): `admin@denscare.in`
- [ ] Doctor accounts: `dr.smith@denscare.in`, etc.
- [ ] Receptionist account: `reception@denscare.in`
- [ ] Dental Assistant account: `assistant@denscare.in`

### Step 8.2: Quick Training Guide

**For Receptionists (15 min):**
1. Login → Dashboard shows today's appointments
2. **Register Patient:** Patients → Add New → Fill form → Save
3. **Book Appointment:** Appointments → New → Select patient & doctor → Pick time → Save
4. **Create Invoice:** Billing → Invoices → Create → Add items → Issue

**For Doctors (15 min):**
1. Login → See your appointments for the day
2. **View Patient:** Click patient name → See full history
3. **Add Record:** Patient Records → New → Add diagnoses & prescriptions
4. **Create Treatment Plan:** Treatment Plans → New → Add procedures → Submit

**For Admin (10 min):**
1. Login → See dashboard with statistics
2. **Approve Users:** Admin → Pending Users → Approve
3. **View Reports:** Billing Dashboard → See financial overview
4. **Manage Doctors:** Doctors → Add/Edit profiles

### Step 8.3: Distribute Credentials

- [ ] Share login credentials with each staff member (securely)
- [ ] **Recommend:** Have each user change their password on first login
- [ ] Create a cheat sheet for common tasks

---

## Phase 9: Go-Live (Day 5)
### Estimated time: 1 hour

### Step 9.1: Final Pre-Launch Checks

- [ ] All smoke tests passed
- [ ] Domain is working: `https://denscare.in`
- [ ] SSL certificate is valid (padlock icon)
- [ ] Email sending is working
- [ ] Payment gateway is configured (test mode OK for soft launch)
- [ ] All staff accounts are created
- [ ] Database backups are configured

### Step 9.2: Switch to Production Razorpay Keys

- [ ] In Razorpay Dashboard → API Keys → Generate **Live** keys
- [ ] Update Railway environment variables:
  ```
  RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxx
  RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
  ```
- [ ] Redeploy the backend (Railway auto-redeploys on variable change)
- [ ] Test a real ₹1 transaction to verify

### Step 9.3: Enable Monitoring

- [ ] **Railway Metrics:** Check CPU/Memory usage in Railway dashboard
- [ ] **Uptime Monitoring:** Set up a free monitor at [uptimerobot.com](https://uptimerobot.com)
  - Monitor URL: `https://your-app-name.up.railway.app/`
  - Check interval: 5 minutes
  - Alert via email on downtime

### Step 9.4: Announce Go-Live

- [ ] Send announcement to staff
- [ ] Schedule weekly check-in for first month
- [ ] Collect feedback from users

---

## Environment Variables Summary

### Backend (Railway)

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://...` | Neon connection string |
| `JWT_SECRET` | Random 48+ char string | Generate with Python |
| `JWT_ALGORITHM` | `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | |
| `FRONTEND_URLS` | `https://denscare.in` | CORS origins |
| `FRONTEND_BASE_URL` | `https://denscare.in` | For password reset |
| `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES` | `30` | |
| `UPLOAD_DIR` | `/tmp/uploads` | |
| `MAX_UPLOAD_SIZE_MB` | `10` | |
| `SMTP_HOST` | `smtp.sendgrid.net` | |
| `SMTP_PORT` | `587` | |
| `SMTP_USERNAME` | `apikey` | Literal string "apikey" |
| `SMTP_PASSWORD` | `SG.xxx...` | SendGrid API key |
| `SMTP_FROM_EMAIL` | `no-reply@denscare.in` | |
| `SMTP_USE_TLS` | `true` | |
| `SMTP_USE_SSL` | `false` | |
| `EMAIL_LOG_RESET_LINKS` | `false` | NEVER true in production |
| `RAZORPAY_KEY_ID` | `rzp_live_xxx` | Live key for production |
| `RAZORPAY_KEY_SECRET` | `xxx...` | |
| `RAZORPAY_WEBHOOK_SECRET` | Random string | Set in Razorpay dashboard |

### Frontend (Vercel)

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_BASE_URL` | `https://your-app.up.railway.app` | Backend API URL |

---

## Cost Summary (Production)

| Service | Plan | Monthly Cost | Annual Cost |
|---------|------|-------------|-------------|
| Vercel (Frontend) | Free | ₹0 | ₹0 |
| Railway (Backend) | Hobby | ₹400 | ₹4,800 |
| Neon (Database) | Pro | ₹1,600 | ₹19,200 |
| SendGrid (Email) | Free | ₹0 | ₹0 |
| Domain (.in) | Annual | — | ₹600 |
| Razorpay | Pay-per-use | ₹0 | ₹0 |
| **Total** | | **₹2,000/mo** | **₹24,600/yr** |

> **Note:** These are estimates. Actual costs depend on usage.
> For a small clinic (1-3 doctors, 50-100 patients/month), this is sufficient.

---

## Rollback Plan

If something goes wrong during deployment:

### Backend Rollback
- [ ] Railway keeps deployment history
- [ ] Go to Railway dashboard → Deployments → Click previous deployment → "Redeploy"
- [ ] Takes < 1 minute

### Database Rollback
- [ ] Neon keeps backups (Pro plan: 7-day retention)
- [ ] Contact Neon support for point-in-time recovery
- [ ] Or restore from manual backup:
  ```bash
  pg_restore -h host -U user -d denscare backup.dump
  ```

### Frontend Rollback
- [ ] Vercel keeps all deployments
- [ ] Go to Vercel dashboard → Deployments → Click previous → "Promote to Production"
- [ ] Takes < 30 seconds

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Frontend shows "Network Error" | Check `VITE_API_BASE_URL` in Vercel env vars |
| CORS error in browser | Add frontend domain to `FRONTEND_URLS` in Railway |
| Database connection refused | Check `DATABASE_URL` format, ensure `?sslmode=require` |
| Emails not sending | Verify SendGrid API key, check spam folder |
| Razorpay payment fails | Verify API keys match (test vs live), check webhook URL |
| 500 Internal Server Error | Check Railway logs → Deployments → View Logs |
| Slow response times | Upgrade Railway plan or check Neon query performance |
| Build fails on Railway | Check `requirements.txt` for missing packages |

---

## Quick Reference Commands

```bash
# Test backend health
curl https://your-app.up.railway.app/

# Check API docs
open https://your-app.up.railway.app/docs

# View Railway logs (if using CLI)
railway logs

# Generate JWT secret
python -c "import secrets; print(secrets.token_urlsafe(48))"

# Test database connection
PGGPASSWORD=xxx psql -h ep-xxx.neon.tech -U neondb_owner -d denscare -c "\dt"

# Check domain DNS
nslookup denscare.in

# Force Vercel redeploy
cd frontend && npx vercel --prod
```

---

## Checklist Summary

| Phase | Task | Status | Notes |
|-------|------|--------|-------|
| **Phase 1** | Account Setup | ☐ | Vercel, Railway, Neon, SendGrid, GoDaddy |
| **Phase 1** | Domain Purchase | ☐ | denscare.in |
| **Phase 2** | Database Setup | ☐ | Neon PostgreSQL |
| **Phase 3** | Backend Deploy | ☐ | Railway |
| **Phase 3** | Run Migrations | ☐ | alembic upgrade head |
| **Phase 4** | Frontend Deploy | ☐ | Vercel |
| **Phase 4** | Custom Domain | ☐ | DNS propagation |
| **Phase 5** | Email Setup | ☐ | SendGrid |
| **Phase 6** | Razorpay Setup | ☐ | API keys + webhooks |
| **Phase 7** | Smoke Tests | ☐ | All features verified |
| **Phase 8** | Staff Training | ☐ | 1-2 hour session |
| **Phase 9** | Go-Live | ☐ | Production keys enabled |

---

*This checklist ensures a smooth, step-by-step deployment. Follow each phase in order.*
