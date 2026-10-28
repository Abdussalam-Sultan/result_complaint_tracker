from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from backend.database import get_db
from backend.models import ComplaintItem, Complaint, Course, Department, User
from backend.schemas import (
    ItemActionRequest, ItemReplyRequest, ItemReopenRequest,
    ComplaintItemResponse, StatusEventResponse
)
from backend.auth import get_current_user, require_assigned_part_advisor_or_admin, require_roles
from backend.helpers import (
    update_complaint_overall_status, record_status_event, notify_user
)

router = APIRouter(prefix="/api/items", tags=["items"])

@router.post("/{item_id}/action", response_model=ComplaintItemResponse)
def handle_item_action(
    item_id: int,
    req: ItemActionRequest,
    current_user: User = Depends(require_assigned_part_advisor_or_admin()),
    db: Session = Depends(get_db)
):
    item = db.query(ComplaintItem).filter(ComplaintItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Complaint item not found")

    complaint = item.complaint
    course = complaint.course

    # Authorization checks
    is_admin = current_user.role == "admin"
    is_assigned_advisor = complaint.student.department == current_user.department

    if not is_admin and not is_assigned_advisor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to take action on this course complaint."
        )

    # Note validation: REJECT and REQUEST_INFO strictly require notes
    action = req.action.upper()
    if action in ["REJECT", "REQUEST_INFO"] and not req.note.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A detailed reason or note is required for action: {action}"
        )

    prev_status = item.status
    target_status = prev_status

    if action == "REVIEW":
        if prev_status not in ["SUBMITTED", "NEEDS_INFO"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition item from {prev_status} to UNDER_REVIEW"
            )
        target_status = "UNDER_REVIEW"

    elif action == "RESOLVE":
        if prev_status in ["RESOLVED", "REJECTED", "WITHDRAWN"]:
            raise HTTPException(
                status_code=400,
                detail=f"Item is already closed ({prev_status})."
            )
        target_status = "RESOLVED"

    elif action == "REJECT":
        if prev_status in ["RESOLVED", "REJECTED", "WITHDRAWN"]:
            raise HTTPException(
                status_code=400,
                detail=f"Item is already closed ({prev_status})."
            )
        target_status = "REJECTED"

    elif action == "REQUEST_INFO":
        if prev_status in ["RESOLVED", "REJECTED", "WITHDRAWN"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot request info on closed item ({prev_status})."
            )
        target_status = "NEEDS_INFO"

    # State update
    item.status = target_status
    item.updated_at = datetime.utcnow()

    # Timeline event
    record_status_event(
        db=db,
        item_id=item.id,
        from_status=prev_status,
        to_status=target_status,
        actor_id=current_user.id,
        note=req.note.strip() or f"Status transitioned to {target_status} by {current_user.name}",
        commit=False
    )

    # In-app notification to student
    notify_user(
        db=db,
        user_id=complaint.student_id,
        message=(
            f"Update on your {course.code} complaint item ({item.issue_type}): "
            f"Status changed from {prev_status} to {target_status}. Note: {req.note.strip()}"
        ),
        complaint_id=complaint.id,
        actor_id=current_user.id,
        commit=False
    )

    db.commit()
    db.refresh(item)
    update_complaint_overall_status(db, complaint.id)

    # Build response
    timeline_events = [
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

    return ComplaintItemResponse(
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
        timeline=timeline_events,
        student_name=complaint.student.name if complaint.student else None,
        matric_no=complaint.student.matric_no if complaint.student else None,
        course_code=course.code,
        course_title=course.title,
        days_open=(datetime.utcnow() - item.created_at).days
    )

@router.post("/{item_id}/reply")
def reply_to_needs_info(
    item_id: int,
    req: ItemReplyRequest,
    current_user: User = Depends(require_roles(["student"])),
    db: Session = Depends(get_db)
):
    item = db.query(ComplaintItem).filter(ComplaintItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Complaint item not found")

    complaint = item.complaint
    if complaint.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if item.status != "NEEDS_INFO":
        raise HTTPException(
            status_code=400,
            detail=f"This complaint item is not currently requesting info (Status: {item.status})."
        )

    if not req.reply_note.strip():
        raise HTTPException(status_code=400, detail="Reply note cannot be empty.")

    # Move back to UNDER_REVIEW
    prev_status = item.status
    item.status = "UNDER_REVIEW"
    item.updated_at = datetime.utcnow()

    # Timeline event
    record_status_event(
        db=db,
        item_id=item.id,
        from_status=prev_status,
        to_status="UNDER_REVIEW",
        actor_id=current_user.id,
        note=f"Student clarification provided: {req.reply_note.strip()}",
        commit=False
    )

    department = db.query(Department).filter(Department.name == complaint.student.department).first()
    target_user_ids = [department.part_advisor_id] if department and department.part_advisor_id else [
        admin.id for admin in db.query(User).filter(User.role == "admin").all()
    ]
    for target_user_id in target_user_ids:
        notify_user(
            db=db,
            user_id=target_user_id,
            message=f"Student {current_user.name} provided requested information for {complaint.course.code}.",
            complaint_id=complaint.id,
            commit=False
        )

    db.commit()
    db.refresh(item)
    update_complaint_overall_status(db, complaint.id)

    return {"success": True, "message": "Reply submitted successfully. Status is now UNDER_REVIEW."}

@router.post("/{item_id}/reopen")
def reopen_rejected_item(
    item_id: int,
    req: ItemReopenRequest,
    current_user: User = Depends(require_roles(["student"])),
    db: Session = Depends(get_db)
):
    item = db.query(ComplaintItem).filter(ComplaintItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Complaint item not found")

    complaint = item.complaint
    if complaint.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if item.status != "REJECTED":
        raise HTTPException(
            status_code=400,
            detail=f"Only rejected complaints can be reopened. Current status: {item.status}"
        )

    if item.reopen_count >= 1 or item.reopened:
        raise HTTPException(
            status_code=400,
            detail="Policy limit reached: You can only reopen a rejected complaint once. The decision is now final."
        )

    if not req.justification.strip():
        raise HTTPException(
            status_code=400,
            detail="A detailed justification is required to dispute a rejection."
        )

    # A disputed rejection returns to the department's part advisor for review.
    prev_status = item.status
    item.status = "UNDER_REVIEW"
    item.assigned_to_role = "part_advisor"
    item.reopened = True
    item.reopen_count += 1
    item.updated_at = datetime.utcnow()

    # Timeline event
    record_status_event(
        db=db,
        item_id=item.id,
        from_status=prev_status,
        to_status="UNDER_REVIEW",
        actor_id=current_user.id,
        note=f"Student reopened the rejected complaint (1 of 1): {req.justification.strip()}. Returned to the part advisor for review.",
        commit=False
    )

    department = db.query(Department).filter(Department.name == complaint.student.department).first()
    recipient_ids = [department.part_advisor_id] if department and department.part_advisor_id else [
        admin.id for admin in db.query(User).filter(User.role == "admin").all()
    ]
    for recipient_id in recipient_ids:
        notify_user(
            db=db,
            user_id=recipient_id,
            message=(
                f"Student {current_user.name} ({current_user.matric_no}) reopened a rejected complaint "
                f"on {complaint.course.code} for another review."
            ),
            complaint_id=complaint.id,
            commit=False
        )

    db.commit()
    db.refresh(item)
    update_complaint_overall_status(db, complaint.id)

    return {
        "success": True,
        "message": "Complaint reopened and returned to the part advisor for review."
    }

@router.post("/{item_id}/withdraw")
def withdraw_item(
    item_id: int,
    current_user: User = Depends(require_roles(["student"])),
    db: Session = Depends(get_db)
):
    item = db.query(ComplaintItem).filter(ComplaintItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Complaint item not found")

    complaint = item.complaint
    if complaint.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if item.status not in ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot withdraw complaint item in status '{item.status}'. Only open complaints prior to resolution can be withdrawn."
        )

    prev_status = item.status
    item.status = "WITHDRAWN"
    item.updated_at = datetime.utcnow()

    record_status_event(
        db=db,
        item_id=item.id,
        from_status=prev_status,
        to_status="WITHDRAWN",
        actor_id=current_user.id,
        note=f"Complaint item voluntarily withdrawn by student ({current_user.name}).",
        commit=False
    )

    db.commit()
    db.refresh(item)
    update_complaint_overall_status(db, complaint.id)

    return {"success": True, "message": "Complaint item withdrawn successfully."}
