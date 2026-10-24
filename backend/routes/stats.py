from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, List

from backend.database import get_db
from backend.models import (
    Complaint, ComplaintItem, Course, User, IssueGroup
)
from backend.schemas import DepartmentOverviewStats, ComplaintItemResponse, StatusEventResponse
from backend.auth import require_roles

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("/overview", response_model=DepartmentOverviewStats)
def get_department_stats(
    current_user: User = Depends(require_roles(["hod", "admin", "lecturer"])),
    db: Session = Depends(get_db)
):
    complaints = db.query(Complaint).all()
    items = db.query(ComplaintItem).all()
    courses = db.query(Course).all()

    total_complaints = len(complaints)
    total_items = len(items)

    pending_count = sum(1 for i in items if i.status in ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO"])
    escalated_count = sum(1 for i in items if i.status == "ESCALATED")
    resolved_count = sum(1 for i in items if i.status == "RESOLVED")
    rejected_count = sum(1 for i in items if i.status == "REJECTED")

    status_breakdown = {
        "SUBMITTED": sum(1 for i in items if i.status == "SUBMITTED"),
        "UNDER_REVIEW": sum(1 for i in items if i.status == "UNDER_REVIEW"),
        "NEEDS_INFO": sum(1 for i in items if i.status == "NEEDS_INFO"),
        "ESCALATED": escalated_count,
        "RESOLVED": resolved_count,
        "REJECTED": rejected_count,
        "WITHDRAWN": sum(1 for i in items if i.status == "WITHDRAWN"),
    }

    # Resolution hours calculation
    resolved_items = [i for i in items if i.status == "RESOLVED"]
    total_hours = 0.0
    for r in resolved_items:
        hours = max(1.0, (r.updated_at - r.created_at).total_seconds() / 3600.0)
        total_hours += hours
    avg_resolution_hours = round(total_hours / len(resolved_items), 1) if resolved_items else 0.0

    # Course breakdown
    by_course = []
    for c in courses:
        c_items = [i for i in items if i.complaint and i.complaint.course_id == c.id]
        if c_items or c.lecturer_id is None:
            by_course.append({
                "course_id": c.id,
                "code": c.code,
                "title": c.title,
                "lecturer_name": c.lecturer.name if c.lecturer else "Unassigned (HOD)",
                "total": len(c_items),
                "open": sum(1 for i in c_items if i.status in ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO"]),
                "escalated": sum(1 for i in c_items if i.status == "ESCALATED"),
                "resolved": sum(1 for i in c_items if i.status == "RESOLVED"),
                "rejected": sum(1 for i in c_items if i.status == "REJECTED"),
            })

    # Issue type breakdown
    issue_types = {}
    for i in items:
        issue_types.setdefault(i.issue_type, {"total": 0, "resolved": 0, "escalated": 0})
        issue_types[i.issue_type]["total"] += 1
        if i.status == "RESOLVED":
            issue_types[i.issue_type]["resolved"] += 1
        elif i.status == "ESCALATED":
            issue_types[i.issue_type]["escalated"] += 1

    by_issue_type = [
        {
            "issue_type": k,
            "label": k.replace("_", " ").title(),
            "total": v["total"],
            "resolved": v["resolved"],
            "escalated": v["escalated"]
        }
        for k, v in issue_types.items()
    ]

    # Oldest unresolved items
    unresolved = [
        i for i in items if i.status in ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO", "ESCALATED"]
    ]
    unresolved.sort(key=lambda x: x.created_at)

    oldest_unresolved = []
    for item in unresolved[:8]:
        complaint = item.complaint
        student = complaint.student if complaint else None
        course = complaint.course if complaint else None

        events = [
            StatusEventResponse(
                id=ev.id,
                complaint_item_id=ev.complaint_item_id,
                from_status=ev.from_status,
                to_status=ev.to_status,
                actor_id=ev.actor_id,
                actor_name=ev.actor.name if ev.actor else "System",
                actor_role=ev.actor.role if ev.actor else "system",
                note=ev.note,
                created_at=ev.created_at
            ) for ev in item.timeline
        ]

        oldest_unresolved.append(ComplaintItemResponse(
            id=item.id,
            complaint_id=item.complaint_id,
            issue_type=item.issue_type,
            status=item.status,
            claimed_score=item.claimed_score,
            group_id=item.group_id,
            assigned_to_role=item.assigned_to_role,
            reopened=item.reopened,
            reopen_count=item.reopen_count,
            created_at=item.created_at,
            updated_at=item.updated_at,
            timeline=events,
            student_name=student.name if student else None,
            matric_no=student.matric_no if student else None,
            course_code=course.code if course else None,
            course_title=course.title if course else None,
            days_open=(datetime.utcnow() - item.created_at).days
        ))

    courses_without_lecturers = [
        {"id": c.id, "code": c.code, "title": c.title, "session": c.session}
        for c in courses if c.lecturer_id is None
    ]

    return DepartmentOverviewStats(
        total_complaints=total_complaints,
        total_items=total_items,
        pending_count=pending_count,
        escalated_count=escalated_count,
        resolved_count=resolved_count,
        rejected_count=rejected_count,
        avg_resolution_hours=avg_resolution_hours,
        status_breakdown=status_breakdown,
        by_course=by_course,
        by_issue_type=by_issue_type,
        oldest_unresolved=oldest_unresolved,
        courses_without_lecturers=courses_without_lecturers
    )
