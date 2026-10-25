# OAU Student Result Complaint Tracker

A full-stack, demo-ready complaint and escalation tracking application tailored for **Obafemi Awolowo University (OAU), Ile-Ife** (Department of Computer Science & Engineering). 

It replaces physical score-chasing with an automated routing engine, mass complaint clustering, multi-issue status tracking, chronological audit trails, in-app notifications, and HOD escalations.

> **DEMO & TEST ACCOUNTS**: See [`DEMO_GUIDE.txt`](./DEMO_GUIDE.txt) for all test credentials, role walkthroughs, and step-by-step presentation scenarios. All accounts use password: `password123`.

---

## Tech Stack
- **Backend**: Python 3.10+, FastAPI, SQLAlchemy ORM, SQLite (`complaints.db`), Pydantic v2 schemas, JWT authentication (`python-jose`), `bcrypt` password hashing.
- **Frontend**: React 19, TypeScript, Vite, React Router v7, Tailwind CSS v4, Axios, Recharts, Lucide Icons.
- **Auditing & Notifications**: StatusEvent chronological timeline per issue item, in-app notifications with unread badge counter.
- **Local Dev Runner**: `npm run dev` starts Python FastAPI and Vite; Vite proxies `/api` requests to FastAPI.

---

## Quick Start & Exact Run Commands

### 1. Unified Dev Server (Runs Both FastAPI + React Frontend)
From the root directory:
```bash
# Install node dependencies
npm install

# Install Python dependencies
pip install -r backend/requirements.txt

# Start full-stack system (launches FastAPI on :8000 + Vite SPA on :3000)
npm run dev
```
Open **`http://localhost:3000`** in your browser.
Interactive API Documentation (Swagger UI) is available at **`http://localhost:3000/docs`**.

---

### 2. Standalone Backend (FastAPI)
If you wish to run the Python backend independently:
```bash
# 1. Install Python dependencies
pip install -r backend/requirements.txt

# 2. Seed database with demo scenarios and test accounts
python3 backend/seed.py

# 3. Launch FastAPI server with Uvicorn
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
Swagger UI will be live at `http://127.0.0.1:8000/docs`.

---

### 3. Standalone Frontend (Vite)
To run only the frontend, start FastAPI separately using the command above, then run:
```bash
npm run dev:frontend
```

---

## Pre-Seeded Demo Login Credentials
All demo accounts use the standard password: **`password123`**. 
*(The app also features a **1-Click Persona Switcher bar** at the top of the screen to switch roles instantly without logging in and out).*

| Role | Name | Email | Details / Scenario |
|---|---|---|---|
| **HOD** | Prof. Olumide Adeleke | `hod@oauife.edu.ng` | Executive oversight, escalated queue & charts |
| **Lecturer 1** | Dr. Folashade Babatunde | `lecturer1@oauife.edu.ng` | Assigned: **CSC 301** (25-student mass group) & **CSC 303** |
| **Lecturer 2** | Dr. Emeka Okoye | `lecturer2@oauife.edu.ng` | Assigned: **CSC 305** & **CSC 401** |
| **Lecturer 3** | Engr. Adeola Adelekan | `lecturer3@oauife.edu.ng` | Assigned: **CPE 307** |
| **Admin** | Mrs. Funmilayo Alabi | `admin@oauife.edu.ng` | Course allocation, user registry & Time Simulator |
| **Student (Multi-issue)** | Ayomide Balogun | `ayomide@oauife.edu.ng` | Matric: `CSC/2021/001` (Missing CA + Wrong Grade) |
| **Student (Mass issue)** | Chiamaka Eze | `chiamaka@oauife.edu.ng` | Matric: `CSC/2021/002` (Part of CSC 301 mass missing score) |
| **Student (Escalated)** | Victor Ekanem | `victor@oauife.edu.ng` | Matric: `CSC/2021/026` (Disputed script remark in HOD queue) |
| **Student (Unassigned)** | Grace Anyanwu | `grace@oauife.edu.ng` | Matric: `CSC/2021/027` (CSC 415 routes straight to HOD) |
| *+26 Students* | *Enrolled 300/400 level* | `*@oauife.edu.ng` | *Full test population enrolled across courses* |

---

## Deploying the Full App to Vercel

The root `vercel.json` deploys two Vercel Services in one project: the Vite frontend and the Python FastAPI backend in `backend/`. Keep the Vercel Root Directory at the repository root. Requests to `/api/*`, `/docs`, `/redoc`, and `/openapi.json` route to FastAPI; other requests route to the frontend.

Add `DATABASE_URL` and a strong, unique `JWT_SECRET` in Vercel's environment settings for each environment. Use a remote PostgreSQL connection string and do not commit `.env` or credentials. The root `requirements.txt` points Vercel's Python build to `backend/requirements.txt`.

Initialize a new demo database by setting `DATABASE_URL` locally to that database and running `python backend/seed.py`. **The Python seed drops and recreates all database tables. Only run it against an empty test database or after backing up data you need.**

Vercel Functions use temporary storage for uploaded attachments (`/tmp/uploads`); files are not durable across function instances. Use object storage such as Supabase Storage if attachments must persist reliably.

---

## Core Scenarios & Features Demonstrated

### 1. Mass & Overlapping Complaints Clustering
- When multiple students log complaints with the same course + session + issue type (e.g. `MISSING_SCORE` on `CSC 301`), the engine automatically attaches them to an **IssueGroup** card.
- The lecturer sees **"CSC 301: Missing Score Issue Cluster (25 students)"**.
- The lecturer can perform **Bulk Resolution**, **Bulk Rejection**, or **Request Info in Bulk** with one atomic note that writes a individual `StatusEvent` to every student's private timeline and dispatches in-app notifications.
- The lecturer can also **isolate a single student** from the group to review them individually.

### 2. Multi-Issue Complaints on a Single Course
- A student can lodge multiple issue items in one submission (e.g. `MISSING_CA` test score + `WRONG_GRADE`).
- Each item has its own independent lifecycle and group attachment. Resolving one item does not close the other.
- The overall complaint status is dynamically derived (e.g., `"IN PROGRESS (1 of 2 resolved)"`).

### 3. Chronological Audit Trail & Status Flow
- Every status transition writes a `StatusEvent` recording the previous status, new status, timestamp, actor name, role, and mandatory explanatory note.
- Students cannot have their complaint rejected without a stated academic reason.

### 4. Dispute Rejection & One-Reopen Limit
- If a lecturer rejects a complaint, the student can click **"Dispute Rejection"** and supply justification.
- Disputed rejections automatically escalate directly to the **HOD** for independent panel review.
- University policy enforces a strict **one reopen limit** per item to prevent endless dispute loops.

### 5. Automated Routing for Unassigned Courses
- When a course has no designated lecturer (e.g. `CSC 415`), student complaints automatically bypass the lecturer stage and route directly into the **HOD's intake queue**.

### 6. Time Passing Simulator (7-Day SLA Auto-Escalation)
- On the **Admin Console**, click the **"Trigger Simulation (+7 Days)"** button.
- Items inactive for > 7 days under lecturer review are automatically escalated to the HOD (`"Auto-escalated: Inactive for 7 days"`).
- Items where the student was asked for info (`NEEDS_INFO`) but did not respond after 7 days are automatically closed as `REJECTED` (`"Auto-closed: No response from student"`).

---

## Registration Page & Homepage

- **Homepage** (`src/pages/HomePage.tsx`) is shown at `/` to visitors who are not signed in, with **Sign in** and **Create account** buttons.
- **Registration** (`src/pages/RegisterPage.tsx`, route `/register`) lets a student sign up with their name, matric number (`CSC/2021/001` format), `@oauife.edu.ng` email, password and enrolled courses. Staff accounts are created by the admin.
- Registration is handled by the Python FastAPI route in `backend/routes/register.py`. Students are always created with the `student` role.

---

## Set Up Your Own Copy (Database + Vercel)

1. **Create a free PostgreSQL database** on [Neon](https://neon.tech) or [Supabase](https://supabase.com) and copy its connection string. On Supabase, use the **Session pooler** string.
2. **Fill it with demo data** (this deletes and recreates all tables, so use a new, empty database only):
   ```bash
   pip install -r backend/requirements.txt
   # macOS / Linux
   export DATABASE_URL="your-connection-string"
   # Windows PowerShell
   $env:DATABASE_URL="your-connection-string"
   python backend/seed.py
   ```
3. **Import the repo into Vercel** (Add New > Project). Keep the Root Directory at the repository root.
4. **Add environment variables** in Vercel for Production, Preview and Development:
   - `DATABASE_URL` = your connection string
   - `JWT_SECRET` = a long random string
5. **Deploy**, then open `/api/health`, then `/register` and create a test student.

Never commit `.env` files or connection strings to GitHub.
