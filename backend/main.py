from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from backend.constants import ADMIN_STAFF_ID, DEPARTMENTS, SHARED_DEPARTMENT
from backend.database import engine, Base, SessionLocal
from backend.models import Department, User
from backend.routes import (
    auth, courses, complaints, items, groups,
    notifications, stats, admin, register
)

def migrate_legacy_schema():
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        if "users" in tables:
            user_columns = {column["name"] for column in inspector.get_columns("users")}
            if "staff_id" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN staff_id VARCHAR(50)"))
            connection.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_staff_id ON users (staff_id)"
            ))
            legacy_staff = connection.execute(text(
                "SELECT id, role, staff_id, department FROM users WHERE role = 'lecturer'"
            )).mappings().all()
            for user in legacy_staff:
                staff_id = user["staff_id"] or f"OAU/STAFF/{user['id']:04d}"
                department = user["department"] or DEPARTMENTS[0]
                if department in {"Computer Science & Engineering", "Computer Science and Engineering"}:
                    department = DEPARTMENTS[0]
                connection.execute(text(
                    "UPDATE users SET role = 'part_advisor', staff_id = :staff_id, department = :department WHERE id = :user_id"
                ), {"staff_id": staff_id, "department": department, "user_id": user["id"]})
            assigned_staff_ids = {
                staff_id for (staff_id,) in connection.execute(
                    text("SELECT staff_id FROM users WHERE staff_id IS NOT NULL")
                ).all()
            }
            admin_accounts = connection.execute(text(
                "SELECT id, staff_id FROM users WHERE role = 'admin' ORDER BY id"
            )).mappings().all()
            next_admin_number = 9000
            for admin in admin_accounts:
                if admin["staff_id"]:
                    continue
                staff_id = ADMIN_STAFF_ID if next_admin_number == 9000 else f"OAU/STAFF/{next_admin_number:04d}"
                while staff_id in assigned_staff_ids:
                    next_admin_number += 1
                    staff_id = f"OAU/STAFF/{next_admin_number:04d}"
                connection.execute(text(
                    "UPDATE users SET staff_id = :staff_id WHERE id = :user_id"
                ), {"staff_id": staff_id, "user_id": admin["id"]})
                assigned_staff_ids.add(staff_id)
                next_admin_number += 1
            connection.execute(text(
                "UPDATE users SET department = :department WHERE department IN ('Computer Science & Engineering', 'Computer Science and Engineering')"
            ), {"department": DEPARTMENTS[0]})
            if "created_at" in user_columns:
                connection.execute(text(
                    "UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"
                ))
            connection.execute(text("UPDATE users SET role = 'inactive' WHERE role = 'hod'"))
        if "issue_groups" in tables:
            group_columns = {column["name"] for column in inspector.get_columns("issue_groups")}
            if "department" not in group_columns:
                connection.execute(text("ALTER TABLE issue_groups ADD COLUMN department VARCHAR(100)"))
            connection.execute(text(
                "UPDATE issue_groups SET department = :department WHERE department IS NULL"
            ), {"department": DEPARTMENTS[0]})
            connection.execute(text(
                "UPDATE issue_groups SET status = 'UNDER_REVIEW' WHERE status = 'ESCALATED'"
            ))
        if "courses" in tables and "course_departments" in tables:
            course_ids = connection.execute(text("SELECT id FROM courses")).scalars().all()
            for course_id in course_ids:
                membership_exists = connection.execute(text(
                    "SELECT 1 FROM course_departments WHERE course_id = :course_id LIMIT 1"
                ), {"course_id": course_id}).first()
                if not membership_exists:
                    connection.execute(text(
                        "INSERT INTO course_departments (course_id, department_name) VALUES (:course_id, :department)"
                    ), {"course_id": course_id, "department": DEPARTMENTS[0]})
        if "complaint_items" in tables:
            connection.execute(text(
                "UPDATE complaint_items SET status = 'UNDER_REVIEW', assigned_to_role = 'part_advisor' WHERE status = 'ESCALATED'"
            ))
            connection.execute(text(
                "UPDATE complaint_items SET assigned_to_role = 'part_advisor' WHERE assigned_to_role IN ('lecturer', 'hod')"
            ))
        if "complaints" in tables:
            connection.execute(text(
                "UPDATE complaints SET overall_status = 'UNDER REVIEW' WHERE overall_status LIKE 'ESCALATED%'"
            ))
        if "status_events" in tables:
            connection.execute(text(
                "UPDATE status_events SET to_status = 'UNDER_REVIEW' WHERE to_status = 'ESCALATED'"
            ))
            connection.execute(text(
                "UPDATE status_events SET from_status = 'UNDER_REVIEW' WHERE from_status = 'ESCALATED'"
            ))


def ensure_admin_staff_ids():
    db = SessionLocal()
    try:
        used_ids = {
            staff_id for (staff_id,) in db.query(User.staff_id).filter(User.staff_id.isnot(None)).all()
        }
        next_number = 9000
        admins = db.query(User).filter(User.role == "admin", User.staff_id.is_(None)).order_by(User.id).all()
        for admin in admins:
            candidate = ADMIN_STAFF_ID if next_number == 9000 else f"OAU/STAFF/{next_number:04d}"
            while candidate in used_ids:
                next_number += 1
                candidate = f"OAU/STAFF/{next_number:04d}"
            admin.staff_id = candidate
            used_ids.add(candidate)
            next_number += 1
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = {department.name for department in db.query(Department).all()}
        for name in (*DEPARTMENTS, SHARED_DEPARTMENT):
            if name not in existing:
                db.add(Department(name=name))
        db.commit()
    finally:
        db.close()
    migrate_legacy_schema()
    ensure_admin_staff_ids()
    yield

app = FastAPI(
    title="OAU Student Result Complaint Tracker API",
    description="Backend API for managing result complaints across the OAU Faculty of Computing and Engineering.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(register.router)
app.include_router(courses.router)
app.include_router(complaints.router)
app.include_router(items.router)
app.include_router(groups.router)
app.include_router(notifications.router)
app.include_router(stats.router)
app.include_router(admin.router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "OAU Student Result Complaint Tracker",
        "institution": "Obafemi Awolowo University, Ile-Ife",
        "departments": list(DEPARTMENTS)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
