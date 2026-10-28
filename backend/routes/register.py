import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import get_password_hash
from backend.database import get_db
from backend.constants import DEPARTMENTS, SHARED_DEPARTMENT
from backend.models import Course, CourseDepartment, Enrollment, User
from backend.schemas import UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMAIL_DOMAIN = "@oauife.edu.ng"
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MATRIC_PATTERN = re.compile(r"^[A-Z]{2,4}/\d{4}/\d{3,4}$")  # e.g. CSC/2021/001
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72  # bcrypt ignores/rejects anything longer


class RegisterRequest(BaseModel):
    # Fields default to empty so that missing values reach the checks below and
    # return the same plain-text "detail" message the front end already shows.
    name: str = ""
    email: str = ""
    matric_no: str = ""
    department: str = ""
    password: str = ""


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


@router.get("/departments")
def list_departments():
    return list(DEPARTMENTS)


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_student(req: RegisterRequest, db: Session = Depends(get_db)):
    """Student self-registration. Staff accounts are created by the admin."""
    name = " ".join(req.name.split())
    email = req.email.strip().lower()
    matric_no = req.matric_no.strip().upper()
    department = req.department.strip()
    password = req.password

    # --- Validation -------------------------------------------------------
    if len(name) < 2 or len(name) > 120:
        raise _bad_request("Enter your full name (2 to 120 characters).")
    if not EMAIL_PATTERN.match(email) or not email.endswith(EMAIL_DOMAIN):
        raise _bad_request(f"Use your university email ending in {EMAIL_DOMAIN}.")
    if not MATRIC_PATTERN.match(matric_no):
        raise _bad_request("Enter your matric number in the format CSC/2021/001.")
    if department not in DEPARTMENTS:
        raise _bad_request("Select a valid department.")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise _bad_request(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise _bad_request("Password is too long. Use 72 bytes or fewer (about 72 characters).")
    # --- Duplicate checks -------------------------------------------------
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Sign in instead.",
        )
    if db.query(User).filter(func.upper(User.matric_no) == matric_no).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this matric number already exists.",
        )

    # Assign all department-specific courses and faculty-wide shared courses.
    course_ids = [row[0] for row in (
        db.query(Course.id)
        .join(CourseDepartment)
        .filter(
            CourseDepartment.department_name.in_([department, SHARED_DEPARTMENT]),
        )
        .distinct()
        .all()
    )]

    # --- Create the user (role is always "student") and enrol them --------
    user = User(
        name=name,
        email=email,
        matric_no=matric_no,
        role="student",
        department=department,
        password_hash=get_password_hash(password),
    )
    db.add(user)
    try:
        db.flush()  # assigns user.id without committing yet
        for course_id in course_ids:
            db.add(Enrollment(student_id=user.id, course_id=course_id))
        db.commit()
    except IntegrityError:
        db.rollback()
        # Two sign-ups with the same email / matric number at the same moment
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email or matric number already exists.",
        )

    db.refresh(user)
    return {"message": "Account created", "user": UserResponse.model_validate(user)}
