from datetime import datetime
from sqlalchemy.orm import Session
from backend.models import Complaint, ComplaintItem, StatusEvent, Notification, User

def derive_complaint_status(items: list[ComplaintItem]) -> str:
    if not items:
        return "SUBMITTED"
    
    statuses = [item.status for item in items]
    total = len(statuses)
    resolved_count = statuses.count("RESOLVED")
    rejected_count = statuses.count("REJECTED")
    withdrawn_count = statuses.count("WITHDRAWN")

    if resolved_count == total:
        return "RESOLVED"
    if (resolved_count + rejected_count + withdrawn_count) == total:
        if resolved_count > 0:
            return f"CLOSED ({resolved_count} resolved, {rejected_count + withdrawn_count} closed)"
        return "CLOSED (All rejected/withdrawn)"

    if any(s == "ESCALATED" for s in statuses):
        return f"ESCALATED TO HOD ({statuses.count('ESCALATED')} item{'s' if statuses.count('ESCALATED') > 1 else ''})"

    if any(s == "NEEDS_INFO" for s in statuses):
        return "ACTION REQUIRED (Needs your response)"

    if any(s == "UNDER_REVIEW" for s in statuses):
        if resolved_count > 0:
            return f"IN PROGRESS ({resolved_count} of {total} resolved)"
        return "UNDER REVIEW"

    if resolved_count > 0:
        return f"IN PROGRESS ({resolved_count} of {total} resolved)"

    return "SUBMITTED"

def update_complaint_overall_status(db: Session, complaint_id: int):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if complaint:
        complaint.overall_status = derive_complaint_status(complaint.items)
        complaint.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(complaint)

def record_status_event(
    db: Session,
    item_id: int,
    from_status: str,
    to_status: str,
    actor_id: int | None,
    note: str,
    commit: bool = True
) -> StatusEvent:
    event = StatusEvent(
        complaint_item_id=item_id,
        from_status=from_status,
        to_status=to_status,
        actor_id=actor_id,
        note=note,
        created_at=datetime.utcnow()
    )
    db.add(event)
    if commit:
        db.commit()
        db.refresh(event)
    return event

def notify_user(
    db: Session,
    user_id: int,
    message: str,
    complaint_id: int | None = None,
    actor_id: int | None = None,
    commit: bool = True
) -> Notification | None:
    # An actor must NEVER receive a notification for their own action!
    if actor_id and user_id == actor_id:
        return None

    cleaned_msg = (
        message
        .replace("UNDER_REVIEW", "Under Review")
        .replace("NEEDS_INFO", "Information Requested")
        .replace("RESOLVED", "Resolved")
        .replace("REJECTED", "Rejected")
        .replace("ESCALATED", "Escalated to Head of Department")
        .replace("WITHDRAWN", "Withdrawn")
        .replace("SUBMITTED", "Submitted")
        .replace("MISSING_CA", "Continuous Assessment")
        .replace("MISSING_EXAM", "Examination Score")
        .replace("WRONG_GRADE", "Letter Grade")
        .replace("WRONG_SCORE", "Score Calculation")
        .replace("SCRIPT_REMARK_REQUEST", "Script Remark Request")
        .replace("Status changed to ", "Status updated to ")
    )

    notif = Notification(
        user_id=user_id,
        message=cleaned_msg,
        complaint_id=complaint_id,
        read=False,
        created_at=datetime.utcnow()
    )
    db.add(notif)
    if commit:
        db.commit()
        db.refresh(notif)
    return notif
