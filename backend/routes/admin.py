import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend.constants import DEPARTMENTS
from backend.models import Department, User
from backend.schemas import (
    UserResponse, UserCreate, PartAdvisorAssignment
)
from backend.auth import require_roles, get_password_hash

router = APIRouter(prefix="/api/admin", tags=["admin"])
STAFF_ID_PATTERN = re.compile(r"^OAU/STAFF/\d{4,6}$")

@router.get("/users", response_model=List[UserResponse])
def list_users(
    role: Optional[str] = None,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role.lower())
    return query.order_by(User.id).all()

@router.post("/users", response_model=UserResponse)
def create_user(
    req: UserCreate,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    if req.matric_no:
        existing_matric = db.query(User).filter(User.matric_no == req.matric_no.strip()).first()
        if existing_matric:
            raise HTTPException(status_code=400, detail="Student with this matric number already exists")

    department = req.department or "Computer Science with Mathematics"
    if department not in DEPARTMENTS:
        raise HTTPException(status_code=400, detail="Select a valid department.")
    staff_id = req.staff_id.strip().upper() if req.staff_id else None
    if req.role in {"part_advisor", "admin"}:
        if not staff_id or not STAFF_ID_PATTERN.fullmatch(staff_id):
            raise HTTPException(status_code=400, detail="Staff ID must match OAU/STAFF/0001.")
        if db.query(User).filter(User.staff_id == staff_id).first():
            raise HTTPException(status_code=400, detail="An account with this staff ID already exists")

    user = User(
        name=req.name.strip(),
        email=req.email.lower().strip(),
        role=req.role.lower().strip(),
        matric_no=req.matric_no.strip() if req.matric_no else None,
        staff_id=staff_id,
        department=department,
        password_hash=get_password_hash(req.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/departments")
def get_departments(
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
):
    return [
        {
            "name": name,
            "part_advisor": ({
                "id": department.part_advisor.id,
                "name": department.part_advisor.name,
                "email": department.part_advisor.email,
                "staff_id": department.part_advisor.staff_id,
            } if department and department.part_advisor else None),
        }
        for name in DEPARTMENTS
        for department in [db.query(Department).filter(Department.name == name).first()]
    ]


@router.put("/departments/{department_name}/part-advisor")
def assign_part_advisor(
    department_name: str,
    assignment: PartAdvisorAssignment,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
):
    if department_name not in DEPARTMENTS:
        raise HTTPException(status_code=400, detail="Select a valid department.")
    department = db.query(Department).filter(Department.name == department_name).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department is not initialized.")
    advisor = None
    if assignment.advisor_id is not None:
        advisor = db.query(User).filter(
            User.id == assignment.advisor_id,
            User.role == "part_advisor",
        ).first()
        if not advisor:
            raise HTTPException(status_code=400, detail="Choose a valid part advisor.")
        db.query(Department).filter(
            Department.part_advisor_id == advisor.id,
            Department.name != department_name,
        ).update({Department.part_advisor_id: None}, synchronize_session=False)
        advisor.department = department_name
    department.part_advisor = advisor
    db.commit()
    return {"success": True, "department": department_name}
