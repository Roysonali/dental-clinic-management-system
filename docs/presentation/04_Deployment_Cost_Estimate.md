# DensCare — Deployment Architecture and Cost Estimate

**Purpose:** This document provides a detailed recommendation for deploying DensCare to production, including the recommended architecture, provider choices, and estimated monthly costs at three tiers.

---

## 1. Recommended Production Architecture

### Architecture Overview

For an initial dental clinic deployment, we recommend a **Platform-as-a-Service (PaaS)** approach. This means using managed cloud platforms that handle server maintenance, security patches, and scaling automatically — so the clinic does not need to hire a dedicated infrastructure team.

```
                        🌐 INTERNET
                            │
                       ┌────┴────┐
                       │         │
                       │ Cloudflare
                       │ • SSL/TLS (HTTPS)
                       │ • DDoS Protection
                       │ • CDN (Caching)
                       │ • DNS Management
                       │   (Free Plan)
                       └────┬────┘
                            │
                  ┌─────────┴─────────┐
                  │                   │
                  ▼                   ▼
         ┌──────────────┐   ┌──────────────────┐
         │              │   │                  │
         │   VERCEL     │   │     RENDER       │
         │              │   │                  │
         │  Frontend    │   │  Backend API     │
         │  (React SPA) │   │  (FastAPI)       │
         │              │   │                  │
         │  Free tier   │   │  Starter plan    │
         │  Global CDN  │   │  Auto-restart    │
         │  Auto-deploy │   │  SSL included    │
         │  from Git    │   │  from Git        │
         └──────────────┘   └────────┬─────────┘
                                     │
                            ┌────────┴─────────┐
                            │                  │
                            │    RENDER        │
                            │    PostgreSQL    │
                            │                  │
                            │  Starter plan    │
                            │  Auto-backups    │
                            │  SSL included    │
                            │  Point-in-time   │
                            │  recovery        │
                            └──────────────────┘

EXTERNAL SERVICES:
     Razorpay — Online Payment Processing
     SendGrid — Email Notifications (Free tier)
     Local Storage — Document Attachments
       (upgradeable to AWS S3)
```

### Why These Providers?

| Provider | Role | Why We Recommend It |
|----------|------|-------------------|
| **Vercel** | Frontend hosting | Industry leader for React/Next.js apps. Free tier is sufficient. Global CDN for fast load times. Automatic SSL. Deploys directly from Git. |
| **Render** | Backend + Database | Managed platform designed for Python/Node.js apps. Includes managed PostgreSQL with automatic backups. Procfile already exists in the project. |
| **Cloudflare** | DNS, SSL, CDN, DDoS | Free plan includes SSL certificates, basic DDoS protection, and CDN caching. Easy DNS management. |
| **SendGrid** | Email service | Free tier (100 emails/day) is sufficient for password reset emails. Owned by Twilio — reliable and well-documented. |
| **Razorpay** | Payment processing | India-focused payment gateway. 2% per transaction. Supports UPI, cards, net banking, and wallets. |

---

## 2. Deployment Steps

### Step 1: Domain Registration

| Task | Details |
|------|---------|
| Register domain | Purchase through Namecheap, GoDaddy, or Cloudflare Registrar |
| Estimated cost | $10–15 per year |
| Example domains | `denscare.clinic`, `denscare.in`, `denscare-dental.com` |
| DNS setup | Point to Cloudflare (as reverse proxy) or directly to Vercel/Render |

### Step 2: Frontend Deployment (Vercel)

| Task | Details |
|------|---------|
| Connect Git repository | Vercel detects `vercel.json` and builds automatically |
| Build command | `npm run build` (TypeScript check + Vite build) |
| Output directory | `dist` |
| Environment variable | `VITE_API_BASE_URL` = backend URL (e.g., `https://api.denscare.clinic`) |
| Domain | Configure custom domain in Vercel dashboard |
| SSL | Automatic via Vercel |
| Estimated cost | $0 (free tier) |

### Step 3: Backend Deployment (Render)

| Task | Details |
|------|---------|
| Connect Git repository | Render detects `Procfile` |
| Runtime | Python 3.11 (from `runtime.txt`) |
| Build command | `pip install -r requirements.txt` |
| Start command | `alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Environment variables | All variables from `.env.example` must be configured |
| Domain | Configure custom domain in Render dashboard |
| SSL | Automatic via Render |
| Estimated cost | $7/month (Starter plan) |

### Step 4: Database Provisioning (Render PostgreSQL)

| Task | Details |
|------|---------|
| Create PostgreSQL instance | Via Render dashboard |
| Connect | Render provides internal connection string |
| Run migrations | `alembic upgrade head` (runs automatically on deploy via Procfile) |
| Seed initial data | Run `python -m app.database.seed_roles` and `python -m app.database.seed_admin` |
| Backups | Automatic daily backups (included in plan) |
| Estimated cost | $7/month (Starter plan) |

### Step 5: Environment Variable Configuration

All environment variables must be configured in Render's dashboard. Here is the complete list:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/denscare` |
| `JWT_SECRET` | Yes | Secret key for JWT signing (min 32 characters) | Random 64-character string |
| `JWT_ALGORITHM` | Yes | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Yes | Token expiry time | `30` |
| `FRONTEND_URLS` | Yes | Allowed CORS origins (comma-separated) | `https://denscare.vercel.app` |
| `FRONTEND_BASE_URL` | Yes | Frontend URL for password reset links | `https://denscare.vercel.app` |
| `SMTP_HOST` | Optional | Email server host | `smtp.sendgrid.net` |
| `SMTP_PORT` | Optional | Email server port | `587` |
| `SMTP_USERNAME` | Optional | Email server username | `apikey` |
| `SMTP_PASSWORD` | Optional | Email server password | SendGrid API key |
| `SMTP_FROM_EMAIL` | Optional | Sender email address | `noreply@denscare.clinic` |
| `UPLOAD_DIR` | Optional | File upload directory | `uploads` |
| `MAX_UPLOAD_SIZE_MB` | Optional | Maximum upload size | `10` |

### Step 6: Email Service Setup (SendGrid)

| Task | Details |
|------|---------|
| Create SendGrid account | Free tier (100 emails/day) |
| Verify sender email | Domain verification or single sender |
| Generate API key | For SMTP authentication |
| Configure in Render | Set SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD |
| Estimated cost | $0 (free tier) |

### Step 7: Razorpay Integration (If Online Payments Needed)

| Task | Details |
|------|---------|
| Create Razorpay account | Standard account for Indian businesses |
| Obtain API keys | Key ID and Key Secret from Razorpay dashboard |
| Integration | Backend API endpoints for payment creation and verification |
| Frontend | Payment checkout UI component |
| Estimated cost | 2% per transaction (pay-as-you-go) |

---

## 3. Cost Estimates

### Important Disclaimer

> All cost estimates are approximate and based on typical provider pricing as of mid-2026. Final costs depend on actual usage, data volume, and number of concurrent users. **Verify current pricing on provider websites before presenting to the client.**

### Tier 1: Minimum Setup (Recommended for Initial Launch)

This is the most cost-effective option and is sufficient for a single dental clinic with a small staff.

| Component | Provider | Plan | Monthly Cost | Notes |
|-----------|----------|------|-------------:|-------|
| Frontend Hosting | Vercel | Free | $0 | Unlimited bandwidth, automatic SSL |
| Backend Server | Render | Starter | $7 | 512 MB RAM, shared CPU |
| Database | Render PostgreSQL | Starter | $7 | 1 GB storage, 97 connections |
| Domain Name | Namecheap/GoDaddy | — | ~$1 | $12/year divided by 12 |
| SSL Certificate | Cloudflare | Free | $0 | Included with free plan |
| CDN | Cloudflare | Free | $0 | Basic caching and DDoS protection |
| Email Service | SendGrid | Free | $0 | 100 emails/day |
| Payment Gateway | Razorpay | Pay-as-you-go | Usage | 2% per transaction |
| Monitoring | — | — | $0 | Not included at this tier |
| **Total** | | | **~$15/month** | |

**What this gets you:**
- Fully functional production application
- Automatic SSL/HTTPS
- Automatic daily database backups
- Email for password resets
- Online payment capability (via Razorpay)
- Sufficient for a single clinic with 5-15 staff members

### Tier 2: Recommended Production Setup

This provides more server capacity, monitoring, and email reliability — suitable for a busy clinic or a clinic that plans to grow.

| Component | Provider | Plan | Monthly Cost | Notes |
|-----------|----------|------|-------------:|-------|
| Frontend Hosting | Vercel | Free | $0 | Free tier sufficient |
| Backend Server | Render | Standard | $25 | 1 GB RAM, dedicated CPU |
| Database | Render PostgreSQL | Standard | $20 | 10 GB storage, more connections |
| Domain Name | Namecheap/GoDaddy | — | ~$1 | $12/year |
| SSL/CDN | Cloudflare | Pro | $20 | Advanced WAF, image optimization |
| Email Service | SendGrid | Essentials | $15 | 50,000 emails/month |
| Error Monitoring | Sentry | Team | $26 | Error tracking, performance monitoring |
| Payment Gateway | Razorpay | Pay-as-you-go | Usage | 2% per transaction |
| **Total** | | | **~$110/month** | |

**What this adds over Tier 1:**
- More server resources (faster response times)
- Advanced security (Web Application Firewall)
- Reliable email delivery (higher volume, analytics)
- Error tracking and performance monitoring
- Larger database storage

### Tier 3: Future Scalable Setup

This is for when the system needs to handle significantly more users, data, or availability requirements — such as a multi-location clinic chain.

| Component | Provider | Plan | Monthly Cost | Notes |
|-----------|----------|------|-------------:|-------|
| Frontend | Vercel | Pro | $20 | Analytics, preview deploys |
| Backend | AWS ECS/Fargate | — | $50–150 | Containerized, auto-scaling |
| Database | AWS RDS | db.t3.micro | $50–150 | Multi-AZ, automated backups |
| Object Storage | AWS S3 | — | $5 | X-rays and documents |
| CDN | CloudFront | — | $10–50 | Global edge locations |
| Email | AWS SES | — | $1 | $0.10 per 1,000 emails |
| Monitoring | Datadog | Pro | $23–70 | Infrastructure + APM |
| Payment Gateway | Razorpay | Pay-as-you-go | Usage | 2% per transaction |
| **Total** | | | **~$160–450/month** | |

**What this adds over Tier 2:**
- Auto-scaling backend (handles traffic spikes)
- Multi-AZ database (high availability)
- Object storage for large files (X-rays, documents)
- Global CDN for fast load times worldwide
- Infrastructure and application monitoring

---

## 4. Cost Variables

The following factors affect which tier is appropriate and the actual monthly cost:

| Factor | Impact | Notes |
|--------|--------|-------|
| **Number of concurrent users** | Higher → more server power needed | A single clinic with 5-15 staff is Tier 1 |
| **Database size** | More patient records → larger DB plan | 1 GB lasts a long time for a single clinic |
| **File attachments** | X-rays and documents → storage costs | Local storage is free; S3 is $0.023/GB/month |
| **Email volume** | More emails → higher SendGrid plan | Password resets are infrequent; 100/day is plenty |
| **Payment volume** | More transactions → more Razorpay fees | 2% is fixed; volume increases absolute cost |
| **Geographic region** | AWS/GCP pricing varies by region | Mumbai region is typically cost-effective for Indian clinics |
| **Backup retention** | Longer retention → more storage costs | Render includes 7-day retention by default |

---

## 5. Scalability Considerations

### Current Capacity (Tier 1)

| Metric | Estimated Capacity |
|--------|-------------------|
| Concurrent users | 10–20 |
| Daily active users | 50–100 |
| API requests per second | 10–50 |
| Database size | Up to 1 GB |
| File storage | Up to 1 GB (local) |

### Growth Path

```
Tier 1: Single Clinic ($15/month)
   │
   │  Clinic grows, more staff, more patients
   ▼
Tier 2: Busy Clinic ($45-110/month)
   │
   │  Multiple locations, higher traffic
   ▼
Tier 3: Multi-Location ($160-450/month)
   │
   │  Enterprise needs, compliance requirements
   ▼
Custom: Enterprise (Contact providers for quotes)
```

### What Changes Between Tiers

| Aspect | Tier 1 | Tier 2 | Tier 3 |
|--------|--------|--------|--------|
| Server | Shared CPU | Dedicated CPU | Containerized, auto-scaling |
| Database | 1 GB | 10 GB | 50+ GB, Multi-AZ |
| Backups | Daily (7-day retention) | Daily (30-day retention) | Continuous, point-in-time |
| Monitoring | None | Basic (Sentry) | Full (Datadog) |
| Email | Free tier (100/day) | Essentials (50K/month) | SES (unlimited) |
| CDN | Basic (Cloudflare Free) | Advanced (Cloudflare Pro) | Global (CloudFront) |

---

## 6. Recommendations

### For Initial Launch

We recommend **Tier 1** for the initial deployment. Reasons:

1. **Lowest cost** — $15/month is very affordable for a production system
2. **Sufficient capacity** — A single dental clinic does not need more than this initially
3. **Already configured** — The frontend has `vercel.json`, the backend has a `Procfile`
4. **Easy to upgrade** — Moving from Tier 1 to Tier 2 requires only changing plan settings, not code

### For Long-Term

Monitor the system's usage over the first 3-6 months. If you notice:
- Slow response times → upgrade backend plan (Tier 2)
- Database approaching storage limits → upgrade database plan
- Need for error tracking → add Sentry (Tier 2)
- Multiple locations → consider Tier 3

### Key Decision Points

| Decision | Recommendation | Timeline |
|----------|---------------|----------|
| Domain registration | Register early, before deployment | Week 1 |
| Hosting provider | Vercel (frontend) + Render (backend) | Week 1 |
| Database provider | Render PostgreSQL (managed) | Week 1 |
| Email provider | SendGrid free tier | Week 2 |
| Payment gateway | Razorpay (if online payments needed) | Week 2 |
| SSL/CDN | Cloudflare free plan | Week 1 |
| Monitoring | Sentry free tier (add later if needed) | Week 3 |
