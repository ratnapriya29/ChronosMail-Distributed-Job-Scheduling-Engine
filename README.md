# ChronosMail • Distributed Job Scheduling Engine

A production-grade, highly reliable, and distributed Full-Stack Email Job Scheduler engineered with **Node.js, TypeScript, Express, BullMQ, Redis, PostgreSQL (Prisma), Elasticsearch, Ethereal SMTP**, and a **React + Tailwind CSS** frontend.

Built for the **ReachInbox (Outbox Labs)** technical assessment.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel%20App-000000?style=for-the-badge&logo=vercel&logoColor=white)]https://chronos-mail-distributed-job-schedu.vercel.app/
[![GitHub Repository](https://img.shields.io/badge/GitHub-ChronosMail--Distributed--Job--Scheduling--Engine-indigo?style=for-the-badge&logo=github)](https://github.com/ratnapriya29/ChronosMail-Distributed-Job-Scheduling-Engine)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Distributed%20Queue-red?style=for-the-badge&logo=redis)](https://docs.bullmq.io/)
[![Prisma](https://img.shields.io/badge/Prisma-PostgreSQL-teal?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8.13-yellow?style=for-the-badge&logo=elasticsearch)](https://www.elastic.co/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)

> 🚀 **Live Production Demo**: https://chronos-mail-distributed-job-schedu.vercel.app/

---

## 🏗️ Architecture Overview

The system strictly avoids cron jobs, instead utilizing a **distributed delayed queue architecture** powered by BullMQ and Redis. Every email schedule request guarantees persistence, deduplication, atomic rate-limiting, and resilience across server or worker restarts.

```
                                  ┌───────────────────────────────┐
                                  │      React + Vite Frontend    │
                                  │  (Dashboard, Compose, Search) │
                                  └───────────────┬───────────────┘
                                                  │ HTTP (REST)
                                                  ▼
                                  ┌───────────────────────────────┐
                                  │   Express Backend Controller  │
                                  └───────┬───────────────┬───────┘
                                          │               │
                 1. Persist PENDING Record│               │ 2. Index Document
                                          ▼               ▼
                                    ┌───────────┐   ┌───────────────┐
                                    │PostgreSQL │   │ Elasticsearch │
                                    │ (Prisma)  │   │(Search Engine)│
                                    └─────┬─────┘   └───────────────┘
                                          │
                                 3. Add Delayed Job { delay: ms }
                                          ▼
                                    ┌───────────┐
                                    │   Redis   │◄───────┐
                                    │ (BullMQ)  │        │ Recovery Service
                                    └─────┬─────┘        │ (Checks PG on restart)
                                          │              │
                    Workers Poll Delayed  │              │
                    Jobs via Concurrency  ▼              │
                                    ┌───────────┐        │
                                    │  BullMQ   │────────┘
                                    │  Workers  │
                                    └─────┬─────┘
                                          │
              ┌───────────────────────────┴───────────────────────────┐
              │                                                       │
  Rate Limit Check (Atomic INCR)                              Rate Limit Exceeded?
  key: rate_limit:{sender}:{YYYY-MM-DD-HH}                            │
              │                                                       ├──► 1. Trigger Live Slack Alert
              ▼                                                       │    (Webhook / OAuth)
      [Within Limit]                                                  └──► 2. Reschedule Job in BullMQ
              │                                                            (delay = millisUntilNextHour)
              ▼
  Provider Throttle (2000ms delay)
              │
              ▼
  Send via Ethereal SMTP (nodemailer)
              │
              ├──► Extract Preview URL (nodemailer.getTestMessageUrl)
              ├──► Update PostgreSQL Status -> SENT
              └──► Update Elasticsearch Document -> SENT
```

---

## ✨ Core Engineering Features

### 1. Zero-Cron Native BullMQ Delay Scheduling
- **No cron jobs or polling intervals** are used to trigger scheduled emails.
- Schedules are calculated in milliseconds from the target execution time:
  ```ts
  const delayMs = Math.max(0, targetTime.getTime() - Date.now());
  await emailQueue.add('sendEmail', data, { delay: delayMs, jobId: emailJob.id });
  ```
- BullMQ leverages Redis sorted sets (`zset`) with UNIX timestamps as scores to atomically pop jobs when they are ready.

### 2. Idempotency & Concurrency-Safe State Transitions
- Every schedule request requires or generates a unique `idempotencyKey`. Duplicate requests return the existing job without creating redundant queue entries.
- Multi-worker race conditions are prevented using **atomic Compare-And-Swap (CAS)** state transitions:
  ```ts
  const lock = await prisma.emailJob.updateMany({
    where: {
      id: emailJobId,
      status: { in: ['PENDING', 'DELAYED_RATE_LIMIT'] }
    },
    data: { status: 'PROCESSING' }
  });
  if (lock.count === 0) return; // Already locked or processed by another worker
  ```

### 3. Distributed Hourly Rate Limiter (Atomic Redis Counters)
- Enforces a hard limit per sender per hour (`MAX_EMAILS_PER_HOUR_PER_SENDER`).
- Tracks send count atomically using Redis `INCR` with a 2-hour TTL:
  ```
  rate_limit:{sender_id}:{YYYY-MM-DD-HH}
  ```
- **Zero-Drop Guarantee:** When the limit is reached:
  1. The job is **NEVER dropped or failed**.
  2. The job is marked as `DELAYED_RATE_LIMIT` and rescheduled to the start of the next hour window (`delay = millisUntilNextHour()`).
  3. A real-time **Slack alert** is posted to the user's connected webhook/OAuth channel.

### 4. Server Restart & Crash Recovery Routine
- If the server restarts or Redis is flushed, scheduled jobs are not lost.
- On startup, `RecoveryService.recoverPendingJobs()` queries PostgreSQL for all jobs with `status IN ('PENDING', 'DELAYED_RATE_LIMIT')`.
- Compares against BullMQ's active delayed set and safely re-enqueues missing jobs with exact remaining delay times.

### 5. Elasticsearch Fulltext Indexing & Resilient Fallback
- Every email is indexed upon creation and updated upon completion (`recipient`, `subject`, `body`, `status`, `sentAt`).
- Search queries use Elasticsearch `multi_match` with field boosting and fuzziness.
- **Resilient Fallback:** If Elasticsearch is not running locally, search operations automatically fallback to PostgreSQL `ILIKE` queries so development and grading are never blocked.

### 6. Live BullMQ Dashboard (`@bull-board/express`)
- Real-time queue telemetry mounted on `http://localhost:5000/admin/queues`.
- Inspect active, waiting, delayed, completed, and failed jobs.

### 7. Real-Time Slack Alerts (Webhooks & OAuth)
- Connect via **Slack Incoming Webhook URL** (instant test setup) or **Slack OAuth**.
- Dispatches formatted Slack Block Kit cards with sender ID, recipient, threshold reached, and the exact rescheduled execution time.
- Fails gracefully without breaking email processing if Slack is disconnected.

### 8. Ethereal Fake SMTP & Live Email Previews
- Automatically spins up an Ethereal SMTP test account on boot.
- Renders a **"View in Ethereal"** button on the frontend for each sent email, taking you directly to the rendered message in the Ethereal web viewer.

---

## 📁 Repository Structure

```
ChronosMail-Distributed-Job-Scheduling-Engine/
├── docker-compose.yml              # Local Postgres, Redis & Elasticsearch
├── sample_leads.csv                # Sample leads for instant CSV upload test
├── package.json                    # Monorepo scripts
├── README.md                       # Documentation
│
├── backend/                        # Node.js + Express + TypeScript
│   ├── prisma/
│   │   └── schema.prisma           # User, EmailJob, SlackConfig models
│   ├── src/
│   │   ├── config/                 # Redis, Prisma, Elasticsearch, Ethereal configs
│   │   ├── controllers/            # Email, Search, Slack, Auth controllers
│   │   ├── queues/
│   │   │   ├── email.queue.ts      # BullMQ queue setup
│   │   │   ├── email.worker.ts     # Multi-worker concurrency & rate limiter
│   │   │   └── recovery.service.ts # Server restart crash recovery routine
│   │   ├── services/               # Ethereal, RateLimiter, Slack, Elasticsearch
│   │   ├── routes/                 # Express API routes
│   │   ├── app.ts                  # Express app & Bull-Board mount
│   │   └── server.ts               # Boot sequence & graceful shutdown
│   └── package.json
│
└── frontend/                       # React (Vite) + Tailwind CSS
    ├── src/
    │   ├── components/
    │   │   ├── Header.tsx          # Brand, Slack badge, Bull-Board link, Auth
    │   │   ├── StatsCards.tsx      # Scheduled, Sent, Rate Limit metrics
    │   │   ├── ScheduledTable.tsx  # Pending & Rate-limited queue table
    │   │   ├── SentTable.tsx       # Delivered emails & Ethereal preview links
    │   │   ├── SearchBar.tsx       # Elasticsearch search input & filter pills
    │   │   ├── ComposeModal.tsx    # CSV/TXT lead upload & scheduling options
    │   │   └── SlackModal.tsx      # Slack webhook connect & test notification
    │   ├── services/api.ts         # Axios client
    │   ├── App.tsx                 # Main dashboard with real-time polling
    │   └── index.css               # Tailwind CSS & glassmorphism tokens
    └── package.json
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **Docker & Docker Compose** (for PostgreSQL, Redis, Elasticsearch)

### 2. Start Infrastructure via Docker
Spin up PostgreSQL, Redis, and Elasticsearch in one command:
```bash
docker compose up -d
```

Verify services are healthy:
```bash
docker compose ps
```
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **Elasticsearch**: `localhost:9200`

---

### 3. Backend Setup

1. Navigate to `backend` directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Ensure `.env` is configured (defaults are pre-configured for Docker):
   ```bash
   cp .env.example .env
   ```

4. Push Prisma schema to PostgreSQL:
   ```bash
   npx prisma db push
   ```

5. Start the backend development server:
   ```bash
   npm run dev
   ```

Backend services will be online:
- **API Server**: `http://localhost:5000`
- **BullMQ Admin Board**: `http://localhost:5000/admin/queues`
- **Health Check**: `http://localhost:5000/health`

---

### 4. Frontend Setup

1. Open a new terminal and navigate to `frontend`:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite dev server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser.

---

## 🌐 Deploying Live to the Web (Public Website)

Want to share a live URL with recruiters without running localhost? Follow this free 2-part deployment guide:

### Part 1: Free Cloud Database & Redis (5 minutes)
1. **PostgreSQL Database:** Sign up for free at [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com). Create a project and copy your `DATABASE_URL`.
2. **Redis Instance:** Sign up for free at [Upstash Redis](https://upstash.com). Create a database and copy the `rediss://...` connection string (`REDIS_URL`).

### Part 2: Deploy Backend to Render (Free)
1. Log into [Render.com](https://render.com) and click **New + > Web Service**.
2. Connect your GitHub repository: `https://github.com/ratnapriya29/ChronosMail-Distributed-Job-Scheduling-Engine`.
3. Configure the settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npm run start`
4. Under **Environment Variables**, add:
   - `DATABASE_URL`: *(Your Neon/Supabase PostgreSQL URL)*
   - `REDIS_URL`: *(Your Upstash Redis URL)*
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `FRONTEND_URL`: `*`
5. Click **Deploy Web Service**. Once deployed, copy your backend URL (e.g. `https://chronosmail-backend.onrender.com`).

### Part 3: Deploy Frontend to Vercel (1 minute)
1. Log into [Vercel.com](https://vercel.com) and click **Add New... > Project**.
2. Select your repository `ChronosMail-Distributed-Job-Scheduling-Engine`.
3. In the project setup:
   - **Root Directory:** Click Edit and select `frontend`.
   - **Framework Preset:** `Vite` (auto-detected).
4. Under **Environment Variables**, add:
   - `VITE_API_BASE_URL`: `https://your-backend-url.onrender.com/api`
5. Click **Deploy**!
   - **Production URL**: [`https://chronos-mail-distributed-job-scheduling-engine-2mmruwhwx.vercel.app/`](https://chronos-mail-distributed-job-scheduling-engine-2mmruwhwx.vercel.app/)

---

## 🧪 Testing Edge Cases & Verification

### Scenario A: Testing the CSV Lead Upload & Batch Scheduling
1. On the frontend dashboard (`http://localhost:3000`), click **"Compose"** or **"Schedule Batch Leads"**.
2. Select the **CSV / Lead List Upload** tab.
3. Drag & drop the included [`sample_leads.csv`](file:///sample_leads.csv) file.
4. Notice the validator instantly extracts and counts the valid unique email leads.
5. Set `Delay Between Leads (sec)` to `2`.
6. Click **"Dispatch Emails Now"**.
7. Observe the jobs in the **Scheduled Queue** tab transitioning to **Sent History** as workers process them every 2 seconds.
8. Click **"View in Ethereal"** to preview the real email in the browser!

---

### Scenario B: Testing Hourly Rate Limiting & Slack Real-Time Alerts
1. In the frontend header, click **"Connect Slack"**.
2. Paste an incoming Slack Webhook URL (e.g. from your Slack workspace) and click **"Save & Connect"** (or use the test button to verify connection).
3. In `Compose Modal`, set **Hourly Rate Limit** to `3` emails/hour, and upload 5 recipients.
4. Watch the processing:
   - The first 3 emails will be delivered immediately.
   - The 4th and 5th emails will **NOT fail**; they will automatically enter the `DELAYED_RATE_LIMIT` state and be rescheduled for the start of the next hour window.
   - A live notification will immediately appear in your Slack channel!
5. To test again, click the **Reset Rate Limit** button next to the "Hourly Rate Limit" card on the dashboard to clear the Redis counter.

---

### Scenario C: Testing Server Restart Recovery (Zero Lost Jobs)
1. Schedule 5 emails with a 60-second delay.
2. Verify in the Scheduled Queue table that the jobs are in `PENDING` state.
3. Stop the backend server in the terminal (`Ctrl + C`).
4. Restart the backend server (`npm run dev`).
5. Observe the startup logs:
   ```
   [Startup] Running job recovery routine against PostgreSQL & Redis...
   [Recovery] Completed successfully: 5 checked, 0 missing, 5 already active in Redis.
   ```
   *(If Redis was restarted or flushed, missing jobs are safely re-enqueued using their exact remaining delay times).*

---

### Scenario D: Testing Elasticsearch Fulltext Search
1. In the search bar on the dashboard, type any keyword from the email subject, recipient, or body (e.g., `Cyberdyne` or `ReachInbox`).
2. Results filter in real-time. Notice the **Elasticsearch Index** badge confirming the engine used.

---

## ⚙️ Environment Variables Reference

### Backend (`/backend/.env`)
| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port for Express server |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `REDIS_HOST` | `localhost` | Redis server host |
| `REDIS_PORT` | `6379` | Redis server port |
| `ELASTICSEARCH_NODE` | `http://localhost:9200` | Elasticsearch instance URL |
| `ELASTICSEARCH_INDEX` | `reachinbox_emails` | Elasticsearch index name |
| `WORKER_CONCURRENCY` | `5` | Number of concurrent jobs per worker |
| `PROVIDER_THROTTLE_DELAY_MS` | `2000` | Intentional provider throttle delay |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `5` | Hourly rate limit threshold per sender |
| `SLACK_DEFAULT_WEBHOOK_URL` | `""` | Optional fallback Slack incoming webhook |
| `ETHEREAL_USER` | `""` | Optional Ethereal user (auto-generated if empty) |

---

## ⚖️ Architectural Decisions & Trade-Offs

1. **BullMQ Native Delays vs. Cron Jobs:**
   - *Decision:* Native delayed jobs via BullMQ.
   - *Rationale:* Cron jobs require constant database polling, introduce scheduling drift, and scale poorly across distributed workers. BullMQ utilizes Redis sorted sets for $O(\log N)$ delay execution and handles worker crashes gracefully.

2. **Atomic Compare-And-Swap (CAS) Transitions:**
   - *Decision:* Using `updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PROCESSING' } })`.
   - *Rationale:* In multi-worker environments (`WORKER_CONCURRENCY=5`), this guarantees that only one worker can process a job, preventing duplicate email dispatches.

3. **Hourly Window Rate Limiting:**
   - *Decision:* Redis atomic `INCR` keyed by sender and hour: `rate_limit:{sender}:{YYYY-MM-DD-HH}`.
   - *Rationale:* Eliminates database locks during rate checks. Automatically expires with a 2-hour TTL to prevent memory leaks in Redis.

4. **Elasticsearch with DB Fallback:**
   - *Decision:* Dual-layer search (Elasticsearch primary, PostgreSQL `ILIKE` fallback).
   - *Rationale:* Provides fulltext fuzziness and relevance scoring in production while maintaining a zero-friction developer experience if Elasticsearch is not running locally.
