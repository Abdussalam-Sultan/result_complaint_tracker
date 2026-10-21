from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional

from backend.database import get_db
from backend.models import (
    User, Course, Complaint, ComplaintItem, IssueGroup
)
from backend.schemas import (
    UserResponse, UserCreate, SimulationRequest
)
from backend.auth import require_roles, get_password_hash
from backend.helpers import (
    update_complaint_overall_status, record_status_event, notify_user
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/users", response_model=List[UserResponse])
def list_users(
    role: Optional[str] = None,
    current_user: User = Depends(require_roles(["admin", "hod"])),
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

    user = User(
        name=req.name.strip(),
        email=req.email.lower().strip(),
        role=req.role.lower().strip(),
        matric_no=req.matric_no.strip() if req.matric_no else None,
        department=req.department or "Computer Science & Engineering",
        password_hash=get_password_hash(req.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/simulate-time")
def simulate_time_passing(
    req: SimulationRequest,
    current_user: User = Depends(require_roles(["admin", "hod"])),
    db: Session = Depends(get_db)
):
    """
    Simulates X days passing:
    1. Lecturer inactivity on SUBMITTED or UNDER_REVIEW items -> Auto-escalate to HOD
    2. Inactive NEEDS_INFO items with no student reply -> Auto-close as REJECTED ('No response from student')
    3. Auto-escalate open IssueGroups
    """
    days = req.days_to_advance
    hod = db.query(User).filter(User.role == "hod").first()
    hod_id = hod.id if hod else current_user.id

    auto_escalated = []
    auto_closed = []
    parent_complaint_ids = set()

    # Find items in SUBMITTED or UNDER_REVIEW assigned to lecturer
    # In demo simulation, we advance all active non-final items or those whose age + days >= 7
    active_items = db.query(ComplaintItem).filter(
        ComplaintItem.status.in_(["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO"])
    ).all()

    for item in active_items:
        prev_status = item.status
        complaint = item.complaint
        course = complaint.course if complaint else None
        student = complaint.student if complaint else None
        course_code = course.code if course else "Course"

        if prev_status == "NEEDS_INFO":
            # Auto-close as REJECTED with reason 'no response'
            item.status = "REJECTED"
            item.updated_at = datetime.utcnow()
            reason = f"Auto-closed: No response from student after {days} simulated days of requesting information."
            
            record_status_event(
                db=db,
                item_id=item.id,
                from_status=prev_status,
                to_status="REJECTED",
                actor_id=None,
                note=reason,
                commit=False
            )

            if student:
                notify_user(
                    db=db,
                    user_id=student.id,
                    message=f"Your complaint item on {course_code} ({item.issue_type}) was closed as rejected due to no response after {days} days.",
                    complaint_id=item.complaint_id,
                    commit=False
                )

            auto_closed.append({
                "item_id": item.id,
                "course": course_code,
                "issue_type": item.issue_type,
                "student": student.name if student else "Student",
                "action": "AUTO_CLOSED_REJECTED"
            })

        elif prev_status in ["SUBMITTED", "UNDER_REVIEW"]:
            # Auto-escalate to HOD due to lecturer inactivity
            item.status = "ESCALATED"
            item.assigned_to_role = "hod"
            item.updated_at = datetime.utcnow()
            note = f"Auto-escalated to HOD: Lecturer took no action for {days} simulated days (SLA breached)."

            record_status_event(
                db=db,
                item_id=item.id,
                from_status=prev_status,
                to_status="ESCALATED",
                actor_id=None,
                note=note,
                commit=False
            )

            # Notify HOD
            if hod:
                notify_user(
                    db=db,
                    user_id=hod.id,
                    message=f"Escalation Alert: Item #{item.id} on {course_code} auto-escalated to HOD due to lecturer inactivity ({days} days).",
                    complaint_id=item.complaint_id,
                    commit=False
                )

            # Notify student
            if student:
                notify_user(
                    db=db,
                    user_id=student.id,
                    message=f"Your complaint on {course_code} ({item.issue_type}) has been auto-escalated to the Head of Department (HOD) for direct intervention.",
                    complaint_id=item.complaint_id,
                    commit=False
                )

            auto_escalated.append({
                "item_id": item.id,
                "course": course_code,
                "issue_type": item.issue_type,
                "student": student.name if student else "Student",
                "action": "AUTO_ESCALATED_TO_HOD"
            })

        if complaint:
            parent_complaint_ids.add(complaint.id)

    # Also escalate any open IssueGroups where all items escalated
    open_groups = db.query(IssueGroup).filter(IssueGroup.status.in_(["OPEN", "UNDER_REVIEW"])).all()
    groups_escalated = 0
    for g in open_groups:
        g.status = "ESCALATED"
        g.updated_at = datetime.utcnow()
        groups_escalated += 1

    db.commit()

    for cid in parent_complaint_ids:
        update_complaint_overall_status(db, cid)

    return {
        "success": True,
        "message": f"Time advanced by {days} days.",
        "simulated_days": days,
        "auto_escalated_count": len(auto_escalated),
        "auto_closed_count": len(auto_closed),
        "groups_escalated_count": groups_escalated,
        "auto_escalated_items": auto_escalated,
        "auto_closed_items": auto_closed
    }
