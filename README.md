# OAU Student Result Complaint Tracker

A full-stack result complaint tracker for the **OAU Faculty of Computing and Engineering**, organized around five departments, department part advisors, and shared courses.

It replaces physical score-chasing with department-aware complaint routing, mass complaint clustering, multi-issue status tracking, chronological audit trails, and in-app notifications.

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
Part advisors and admins sign in at `/staff/login` with their university email, unique staff ID, and password. Staff IDs use the format `OAU/FCE/STAFF/0001`.

| Role | Name | Email | Details / Scenario |
|---|---|---|---|
| **Part Advisor 1** | Dr. Folashade Babatunde | `advisor1@oauife.edu.ng` | Staff ID: `OAU/FCE/STAFF/0001` |
| **Part Advisor 2** | Dr. Emeka Okoye | `advisor2@oauife.edu.ng` | Staff ID: `OAU/FCE/STAFF/0002` |
| **Part Advisor 3** | Engr. Adeola Adelekan | `advisor3@oauife.edu.ng` | Staff ID: `OAU/FCE/STAFF/0003` |
| **Part Advisor 4** | Dr. Tola Akinola | `advisor4@oauife.edu.ng` | Staff ID: `OAU/FCE/STAFF/0004` |
| **Part Advisor 5** | Dr. Seyi Oladipo | `advisor5@oauife.edu.ng` | Staff ID: `OAU/FCE/STAFF/0005` |
| **Part Advisor 6** | Dr. Kemi Adebayo | `advisor6@oauife.edu.ng` | Staff ID: `OAU/FCE/STAFF/0006`; available for admin assignment |
| **Part Advisor 7** | Engr. Dele Okafor | `advisor7@oauife.edu.ng` | Staff ID: `OAU/FCE/STAFF/0007`; available for admin assignment |
| **Admin** | Mrs. Funmilayo Alabi | `admin@oauife.edu.ng` | Staff ID: `OAU/FCE/STAFF/9000`; department and course assignment |
| **Student (Multi-issue)** | Ayomide Balogun | `ayomide@oauife.edu.ng` | Matric: `CSC/2021/001` (Missing CA + Wrong Grade) |
| **Student (Mass issue)** | Chiamaka Eze | `chiamaka@oauife.edu.ng` | Matric: `CSC/2021/002` (Part of CSC 301 mass missing score) |
| **Student (Reopened)** | Victor Ekanem | `victor@oauife.edu.ng` | Matric: `CSC/2021/026` (Disputed script remark returned to review) |
| **Student (Shared course)** | Grace Anyanwu | `grace@oauife.edu.ng` | Matric: `CSC/2021/027` |
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
- The part advisor sees **"CSC 301: Missing Score Issue Cluster (25 students)"**.
- The part advisor can perform **Bulk Resolution**, **Bulk Rejection**, or **Request Info in Bulk** with one note that writes a `StatusEvent` to every student's timeline and dispatches notifications.
- The part advisor can also **isolate a single student** from the group to review them individually.

### 2. Multi-Issue Complaints on a Single Course
- A student can lodge multiple issue items in one submission (e.g. `MISSING_CA` test score + `WRONG_GRADE`).
- Each item has its own independent lifecycle and group attachment. Resolving one item does not close the other.
- The overall complaint status is dynamically derived (e.g., `"IN PROGRESS (1 of 2 resolved)"`).

### 3. Chronological Audit Trail & Status Flow
- Every status transition writes a `StatusEvent` recording the previous status, new status, timestamp, actor name, role, and mandatory explanatory note.
- Students cannot have their complaint rejected without a stated academic reason.

### 4. Dispute Rejection & One-Reopen Limit
- If a part advisor rejects a complaint, the student can click **"Dispute Rejection"** and supply justification.
- A disputed rejection returns to the same department part advisor for review. Each item can be reopened once.
- University policy enforces a strict **one reopen limit** per item to prevent endless dispute loops.

### 5. Five Departments and Shared Courses
- Student signup requires one of the five department choices and shows courses assigned to that department plus shared courses.
- The admin can assign or reassign a part advisor for each department, and add or update courses across one or more departments.
- Students see their registered course list and their assigned part advisor's contact details on the dashboard.

---

## Registration Page & Homepage

- **Homepage** (`src/pages/HomePage.tsx`) is shown at `/` to visitors who are not signed in, with **Sign in** and **Create account** buttons.
- **Student registration** (`/register`) asks for name, matric number, university email, department, and password. Department and shared courses are assigned automatically.
- **Staff registration and login** are available at `/staff/register` and `/staff/login`. Each staff account requires a unique staff ID in the `OAU/FCE/STAFF/0001` format; an admin must assign the account as a department's part advisor.
- The API validates the department, course membership, and staff ID before creating accounts.

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
