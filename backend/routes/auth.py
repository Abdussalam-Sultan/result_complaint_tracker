import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.constants import DEPARTMENTS
from backend.database import get_db
from backend.models import Department, User
from backend.schemas import UserLogin, Token, UserResponse
from backend.auth import verify_password, create_access_token, get_current_user, get_password_hash

router = APIRouter(prefix="/api/auth", tags=["auth"])
STAFF_ID_PATTERN = re.compile(r"^OAU/STAFF/\d{4,6}$")
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class StaffRegisterRequest(BaseModel):
    name: str = ""
    email: str = ""
    staff_id: str = ""
    department: str = ""
    password: str = ""


class StaffLoginRequest(BaseModel):
    email: str = ""
    staff_id: str = ""
    password: str = ""


@router.post("/staff/register", status_code=status.HTTP_201_CREATED)
def register_staff(req: StaffRegisterRequest, db: Session = Depends(get_db)):
    name = " ".join(req.name.split())
    email = req.email.strip().lower()
    staff_id = req.staff_id.strip().upper()
    department = req.department.strip()
    if len(name) < 2 or len(name) > 120:
        raise HTTPException(status_code=400, detail="Enter your full name.")
    if not EMAIL_PATTERN.match(email) or not email.endswith("@oauife.edu.ng"):
        raise HTTPException(status_code=400, detail="Use your university email ending in @oauife.edu.ng.")
    if not STAFF_ID_PATTERN.fullmatch(staff_id):
        raise HTTPException(status_code=400, detail="Staff ID must match OAU/STAFF/0001.")
    if department not in DEPARTMENTS:
        raise HTTPException(status_code=400, detail="Select a valid department.")
    if len(req.password) < 8 or len(req.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password must be 8 to 72 bytes long.")
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    if db.query(User).filter(func.upper(User.staff_id) == staff_id).first():
        raise HTTPException(status_code=409, detail="An account with this staff ID already exists.")

    user = User(
        name=name,
        email=email,
        staff_id=staff_id,
        department=department,
        role="part_advisor",
        password_hash=get_password_hash(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Staff account created", "user": UserResponse.model_validate(user)}


@router.post("/staff/login", response_model=Token)
def staff_login(creds: StaffLoginRequest, db: Session = Depends(get_db)):
    staff_id = creds.staff_id.strip().upper()
    if not STAFF_ID_PATTERN.fullmatch(staff_id):
        raise HTTPException(status_code=400, detail="Staff ID must match OAU/STAFF/0001.")
    user = db.query(User).filter(
        User.email == creds.email.lower().strip(),
        User.staff_id == staff_id,
        User.role.in_(["part_advisor", "admin"]),
    ).first()
    if not user or not verify_password(creds.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email, staff ID, or password")
    return {
        "access_token": create_access_token(data={"sub": str(user.id), "role": user.role}),
        "token_type": "bearer",
        "user": user,
    }


@router.get("/advisor")
def get_department_advisor(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can view their part advisor.")
    department = db.query(Department).filter(Department.name == current_user.department).first()
    advisor = department.part_advisor if department else None
    if not advisor:
        return None
    return {
        "name": advisor.name,
        "email": advisor.email,
        "staff_id": advisor.staff_id,
        "department": department.name,
    }

@router.post("/login", response_model=Token)
def login(creds: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == creds.email.lower().strip()).first()
    if not user or not verify_password(creds.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.role == "part_advisor":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Part advisors must sign in with their staff ID.",
        )
    if user.role not in {"student", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account cannot sign in through the student portal.",
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/demo-users")
def get_demo_users(db: Session = Depends(get_db)):
    """Returns sample users for quick demo role switching"""
    users = db.query(User).order_by(User.id).all()
    # Select key representatives
    results = []
    # 1 Admin
    admin = next((u for u in users if u.role == "admin"), None)
    # Part advisors
    advisors = [u for u in users if u.role == "part_advisor"][:3]
    # Students (pick a few interesting ones)
    students = [u for u in users if u.role == "student"][:5]

    for u in [admin] + advisors + students:
        if u:
            results.append({
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "matric_no": u.matric_no,
                "department": u.department,
            })
    return results

@router.post("/switch-demo/{user_id}", response_model=Token)
def switch_demo_user(user_id: int, db: Session = Depends(get_db)):
    """Fast 1-click switch for evaluation/demo without password friction"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role not in {"student", "part_advisor", "admin"}:
        raise HTTPException(status_code=404, detail="Demo user not found")
    
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }
