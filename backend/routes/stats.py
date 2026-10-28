from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, List

from backend.database import get_db
from backend.models import (
    Complaint, ComplaintItem, Course, CourseDepartment, Department, User
)
from backend.schemas import DepartmentOverviewStats, ComplaintItemResponse, StatusEventResponse
from backend.auth import require_assigned_part_advisor_or_admin

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("/overview", response_model=DepartmentOverviewStats)
def get_department_stats(
    current_user: User = Depends(require_assigned_part_advisor_or_admin()),
    db: Session = Depends(get_db)
):
    complaint_query = db.query(Complaint)
    if current_user.role == "part_advisor":
        complaint_query = complaint_query.join(User, Complaint.student_id == User.id).filter(
            User.department == current_user.department
        )
    complaints = complaint_query.all()
    complaint_ids = [complaint.id for complaint in complaints]
    items = db.query(ComplaintItem).join(Complaint).filter(Complaint.id.in_(complaint_ids)).all() if complaint_ids else []
    course_query = db.query(Course)
    if current_user.role == "part_advisor":
        course_query = course_query.join(CourseDepartment).filter(
            CourseDepartment.department_name.in_([current_user.department, "All Departments"])
        )
    courses = course_query.all()

    total_complaints = len(complaints)
    total_items = len(items)

    pending_count = sum(1 for i in items if i.status in ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO"])
    resolved_count = sum(1 for i in items if i.status == "RESOLVED")
    rejected_count = sum(1 for i in items if i.status == "REJECTED")

    status_breakdown = {
        "SUBMITTED": sum(1 for i in items if i.status == "SUBMITTED"),
        "UNDER_REVIEW": sum(1 for i in items if i.status == "UNDER_REVIEW"),
        "NEEDS_INFO": sum(1 for i in items if i.status == "NEEDS_INFO"),
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
        if c_items:
            department = db.query(Department).filter(Department.name == current_user.department).first()
            by_course.append({
                "course_id": c.id,
                "code": c.code,
                "title": c.title,
                "part_advisor_name": department.part_advisor.name if department and department.part_advisor else "Unassigned",
                "total": len(c_items),
                "open": sum(1 for i in c_items if i.status in ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO"]),
                "resolved": sum(1 for i in c_items if i.status == "RESOLVED"),
                "rejected": sum(1 for i in c_items if i.status == "REJECTED"),
            })

    # Issue type breakdown
    issue_types = {}
    for i in items:
        issue_types.setdefault(i.issue_type, {"total": 0, "resolved": 0})
        issue_types[i.issue_type]["total"] += 1
        if i.status == "RESOLVED":
            issue_types[i.issue_type]["resolved"] += 1

    by_issue_type = [
        {
            "issue_type": k,
            "label": k.replace("_", " ").title(),
            "total": v["total"],
            "resolved": v["resolved"],
        }
        for k, v in issue_types.items()
    ]

    # Oldest unresolved items
    unresolved = [
        i for i in items if i.status in ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO"]
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

    courses_without_advisors = []
    for course in courses:
        for membership in course.departments:
            department = membership.department_record
            if department and department.name != "All Departments" and not department.part_advisor_id:
                courses_without_advisors.append({
                    "id": course.id,
                    "code": course.code,
                    "title": course.title,
                    "session": course.session,
                    "department": department.name,
                })

    return DepartmentOverviewStats(
        total_complaints=total_complaints,
        total_items=total_items,
        pending_count=pending_count,
        resolved_count=resolved_count,
        rejected_count=rejected_count,
        avg_resolution_hours=avg_resolution_hours,
        status_breakdown=status_breakdown,
        by_course=by_course,
        by_issue_type=by_issue_type,
        oldest_unresolved=oldest_unresolved,
        courses_without_advisors=courses_without_advisors
    )
