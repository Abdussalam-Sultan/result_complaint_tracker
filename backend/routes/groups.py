from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from backend.database import get_db
from backend.models import IssueGroup, ComplaintItem, Complaint, Course, User
from backend.models import Department
from backend.schemas import (
    IssueGroupResponse, GroupActionRequest, ComplaintItemResponse, StatusEventResponse
)
from backend.auth import get_current_user, require_assigned_part_advisor_or_admin
from backend.helpers import (
    update_complaint_overall_status, record_status_event, notify_user
)

router = APIRouter(prefix="/api/groups", tags=["groups"])

def build_group_response(group: IssueGroup, db: Session) -> IssueGroupResponse:
    items_out = []
    course = group.course

    for item in group.items:
        complaint = item.complaint
        student = complaint.student if complaint else None

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

        items_out.append(ComplaintItemResponse(
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

    department = db.query(Department).filter(Department.name == group.department).first()
    advisor = department.part_advisor if department else None
    return IssueGroupResponse(
        id=group.id,
        course_id=group.course_id,
        course_code=course.code if course else None,
        course_title=course.title if course else None,
        issue_type=group.issue_type,
        title=group.title,
        status=group.status,
        created_at=group.created_at,
        updated_at=group.updated_at,
        student_count=len(group.items),
        assigned_advisor_id=advisor.id if advisor else None,
        assigned_advisor_name=advisor.name if advisor else "Unassigned",
        items=items_out
    )

@router.get("", response_model=List[IssueGroupResponse])
def list_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(IssueGroup)

    if current_user.role == "part_advisor":
        department = db.query(Department).filter(Department.name == current_user.department).first()
        if not department or department.part_advisor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Your account is not the assigned part advisor.")
        query = query.filter(IssueGroup.department == current_user.department)
    elif current_user.role == "student":
        # Students do not browse groups directly, but we don't throw 403; just return empty or enrolled
        return []
    elif current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied.")

    groups = query.order_by(IssueGroup.created_at.desc()).all()
    return [build_group_response(g, db) for g in groups]

@router.get("/{group_id}", response_model=IssueGroupResponse)
def get_group(
    group_id: int,
    current_user: User = Depends(require_assigned_part_advisor_or_admin()),
    db: Session = Depends(get_db)
):
    group = db.query(IssueGroup).filter(IssueGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Issue group not found")

    if current_user.role == "part_advisor" and group.department != current_user.department:
        raise HTTPException(status_code=403, detail="Unauthorized access to this course group.")

    return build_group_response(group, db)

@router.post("/{group_id}/bulk-action")
def perform_bulk_action(
    group_id: int,
    req: GroupActionRequest,
    current_user: User = Depends(require_assigned_part_advisor_or_admin()),
    db: Session = Depends(get_db)
):
    group = db.query(IssueGroup).filter(IssueGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Issue group not found")

    course = group.course
    is_admin = current_user.role == "admin"
    if not is_admin and group.department != current_user.department:
        raise HTTPException(status_code=403, detail="Unauthorized to act on this course group.")

    action = req.action.upper()
    if not req.note.strip():
        raise HTTPException(status_code=400, detail="A required explanation/note must be provided for bulk actions.")

    target_status_map = {
        "RESOLVE": "RESOLVED",
        "REJECT": "REJECTED",
        "REQUEST_INFO": "NEEDS_INFO",
    }

    target_status = target_status_map.get(action)
    if not target_status:
        raise HTTPException(status_code=400, detail=f"Unsupported bulk action {action}")

    # Atomic execution across all items in group
    items = group.items
    affected_count = 0
    parent_complaint_ids = set()

    for item in items:
        # Skip items that were already closed
        if item.status in ["RESOLVED", "WITHDRAWN"] and action != "RESOLVE":
            continue

        prev_status = item.status
        item.status = target_status
        item.updated_at = datetime.utcnow()
        # Record timeline event for EVERY student
        record_status_event(
            db=db,
            item_id=item.id,
            from_status=prev_status,
            to_status=target_status,
            actor_id=current_user.id,
            note=f"[Group Bulk Action - {action}] {req.note.strip()}",
            commit=False
        )

        # Notify student
        complaint = item.complaint
        if complaint and complaint.student_id:
            parent_complaint_ids.add(complaint.id)
            notify_user(
                db=db,
                user_id=complaint.student_id,
                message=(
                    f"Mass update on {course.code} ({item.issue_type}): "
                    f"Status changed to {target_status}. Part advisor's note: {req.note.strip()}"
                ),
                complaint_id=complaint.id,
                commit=False
            )

        affected_count += 1

    group.status = target_status
    group.updated_at = datetime.utcnow()

    # Commit atomically
    db.commit()

    # Update overall status for all affected parent complaints
    for cid in parent_complaint_ids:
        update_complaint_overall_status(db, cid)

    return {
        "success": True,
        "message": f"Bulk {action} completed successfully for {affected_count} student(s) in group.",
        "group_id": group.id,
        "new_status": target_status,
        "affected_count": affected_count
    }

@router.post("/{group_id}/remove-student/{item_id}")
def remove_student_from_group(
    group_id: int,
    item_id: int,
    current_user: User = Depends(require_assigned_part_advisor_or_admin()),
    db: Session = Depends(get_db)
):
    group = db.query(IssueGroup).filter(IssueGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Issue group not found")

    course = group.course
    is_admin = current_user.role == "admin"
    if not is_admin and group.department != current_user.department:
        raise HTTPException(status_code=403, detail="Unauthorized")

    item = db.query(ComplaintItem).filter(
        ComplaintItem.id == item_id,
        ComplaintItem.group_id == group_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Student complaint item not found in this group")

    # Detach from group
    item.group_id = None
    item.updated_at = datetime.utcnow()

    student_name = item.complaint.student.name if item.complaint and item.complaint.student else "Student"

    record_status_event(
        db=db,
        item_id=item.id,
        from_status=item.status,
        to_status=item.status,
        actor_id=current_user.id,
        note=f"Removed from mass group cluster by {current_user.name}. Item will be handled individually.",
        commit=False
    )

    if item.complaint and item.complaint.student_id:
        notify_user(
            db=db,
            user_id=item.complaint.student_id,
            message=f"Your complaint item on {course.code} was separated from the group and will be handled individually.",
            complaint_id=item.complaint_id,
            commit=False
        )

    db.commit()

    return {
        "success": True,
        "message": f"{student_name} was removed from group #{group.id} and is now an individual complaint."
    }
