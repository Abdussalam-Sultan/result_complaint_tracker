from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pathlib import PurePath
from uuid import uuid4

from backend.database import get_db
from backend.models import (
    Complaint, ComplaintItem, Course, Enrollment, IssueGroup,
    StatusEvent, User, Attachment
)
from backend.schemas import (
    ComplaintCreate, ComplaintResponse, ComplaintItemResponse,
    StatusEventResponse, AttachmentResponse, AttachmentUploadRequest,
    AttachmentCompleteRequest
)
from backend.auth import get_current_user, require_roles
from backend.helpers import (
    derive_complaint_status, update_complaint_overall_status,
    record_status_event, notify_user
)
from backend.storage import (
    SIGNED_URL_TTL_SECONDS, SupabaseStorageError,
    create_signed_download_url, create_signed_upload_url, get_object_metadata
)

router = APIRouter(prefix="/api/complaints", tags=["complaints"])

MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024
ALLOWED_ATTACHMENT_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def _validate_attachment_metadata(filename: str, size: int, content_type: str) -> str:
    extension = PurePath(filename).suffix.lower()
    expected_type = ALLOWED_ATTACHMENT_TYPES.get(extension)
    if not filename.strip() or len(filename) > 255 or "\x00" in filename or not expected_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, PNG, and JPEG files are allowed.",
        )
    if content_type.lower() != expected_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The file type does not match its filename.",
        )
    if size <= 0 or size > MAX_ATTACHMENT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be between 1 byte and 15 MB.",
        )
    return extension


def _get_authorized_complaint(
    complaint_id: int, current_user: User, db: Session
) -> Complaint:
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if current_user.role == "student":
        allowed = complaint.student_id == current_user.id
    elif current_user.role == "lecturer":
        allowed = complaint.course.lecturer_id == current_user.id
    else:
        allowed = current_user.role in {"hod", "admin"}

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this complaint.",
        )
    return complaint

def build_complaint_response(c: Complaint, db: Session, hide_student_pii: bool = False) -> ComplaintResponse:
    items_out = []
    for item in c.items:
        # Timeline events
        events_out = []
        for ev in item.timeline:
            actor_name = None
            actor_role = None
            if ev.actor:
                actor_name = ev.actor.name
                actor_role = ev.actor.role
            elif ev.actor_id:
                u = db.query(User).filter(User.id == ev.actor_id).first()
                if u:
                    actor_name = u.name
                    actor_role = u.role

            events_out.append(StatusEventResponse(
                id=ev.id,
                complaint_item_id=ev.complaint_item_id,
                from_status=ev.from_status,
                to_status=ev.to_status,
                actor_id=ev.actor_id,
                actor_name=actor_name or "System / Auto",
                actor_role=actor_role or "system",
                note=ev.note,
                created_at=ev.created_at
            ))

        days_open = (datetime.utcnow() - item.created_at).days

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
            timeline=events_out,
            student_name="[Confidential]" if hide_student_pii else (c.student.name if c.student else None),
            matric_no="[Confidential]" if hide_student_pii else (c.student.matric_no if c.student else None),
            course_code=c.course.code if c.course else None,
            course_title=c.course.title if c.course else None,
            days_open=days_open
        ))

    attachments_out = [
        AttachmentResponse(
            id=att.id,
            filename=att.filename,
            file_path=att.file_path,
            file_size=att.file_size,
            uploaded_at=att.uploaded_at
        ) for att in c.attachments
    ]

    return ComplaintResponse(
        id=c.id,
        student_id=c.student_id,
        student_name="[Confidential]" if hide_student_pii else (c.student.name if c.student else None),
        matric_no="[Confidential]" if hide_student_pii else (c.student.matric_no if c.student else None),
        course_id=c.course_id,
        course_code=c.course.code if c.course else None,
        course_title=c.course.title if c.course else None,
        description=c.description,
        overall_status=c.overall_status,
        created_at=c.created_at,
        updated_at=c.updated_at,
        items=items_out,
        attachments=attachments_out
    )

@router.get("", response_model=List[ComplaintResponse])
def list_complaints(
    course_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Complaint)

    if current_user.role == "student":
        query = query.filter(Complaint.student_id == current_user.id)
    elif current_user.role == "lecturer":
        # Lecturer can only see complaints for their assigned courses
        lecturer_course_ids = [c.id for c in db.query(Course).filter(Course.lecturer_id == current_user.id).all()]
        query = query.filter(Complaint.course_id.in_(lecturer_course_ids))
    # HOD and Admin see all department complaints

    if course_id:
        query = query.filter(Complaint.course_id == course_id)

    complaints = query.order_by(Complaint.created_at.desc()).all()

    results = []
    for c in complaints:
        # Check status filter
        if status_filter and status_filter.upper() not in c.overall_status.upper():
            continue
        # Never expose other students' identities to students
        hide_pii = (current_user.role == "student" and c.student_id != current_user.id)
        results.append(build_complaint_response(c, db, hide_student_pii=hide_pii))

    return results

@router.post("", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
def create_complaint(
    payload: ComplaintCreate,
    current_user: User = Depends(require_roles(["student"])),
    db: Session = Depends(get_db)
):
    # 1. Verify student enrollment in course
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        Enrollment.course_id == payload.course_id
    ).first()
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only submit complaints for courses you are officially enrolled in."
        )

    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # 2. Duplicate prevention: A student cannot submit the same issue_type for the same course and session
    # while one is still open (SUBMITTED, UNDER_REVIEW, NEEDS_INFO, ESCALATED)
    open_statuses = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO", "ESCALATED"]
    existing_items = (
        db.query(ComplaintItem)
        .join(Complaint)
        .filter(
            Complaint.student_id == current_user.id,
            Complaint.course_id == payload.course_id,
            ComplaintItem.status.in_(open_statuses)
        )
        .all()
    )

    existing_open_issue_types = {item.issue_type: item for item in existing_items}
    for item_in in payload.items:
        if item_in.issue_type in existing_open_issue_types:
            conflicting_item = existing_open_issue_types[item_in.issue_type]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"You already have an active complaint item for '{item_in.issue_type}' "
                    f"on course {course.code} (Status: {conflicting_item.status}, Complaint #{conflicting_item.complaint_id}). "
                    "You cannot submit a duplicate issue while an open one exists."
                )
            )

    # 3. Create parent complaint
    complaint = Complaint(
        student_id=current_user.id,
        course_id=course.id,
        description=payload.description.strip(),
        overall_status="SUBMITTED",
        created_at=datetime.utcnow()
    )
    db.add(complaint)
    db.flush()

    # Determine assigned role based on course lecturer presence
    has_assigned_lecturer = course.lecturer_id is not None
    initial_assigned_role = "lecturer" if has_assigned_lecturer else "hod"

    # 4. Create ComplaintItems and attach to IssueGroups (for mass complaint clustering)
    created_items = []
    for item_in in payload.items:
        group_id = None
        # Auto-cluster mass issues unless OTHER
        if item_in.issue_type != "OTHER":
            # Find active group for same course and issue_type
            group = db.query(IssueGroup).filter(
                IssueGroup.course_id == course.id,
                IssueGroup.issue_type == item_in.issue_type,
                IssueGroup.status.in_(["OPEN", "UNDER_REVIEW", "NEEDS_INFO", "ESCALATED"])
            ).first()

            if not group:
                group = IssueGroup(
                    course_id=course.id,
                    issue_type=item_in.issue_type,
                    title=f"{course.code}: {item_in.issue_type.replace('_', ' ').title()} Issue Cluster",
                    status="OPEN",
                    created_at=datetime.utcnow()
                )
                db.add(group)
                db.flush()
            group_id = group.id

        item = ComplaintItem(
            complaint_id=complaint.id,
            issue_type=item_in.issue_type,
            status="SUBMITTED",
            claimed_score=item_in.claimed_score,
            group_id=group_id,
            assigned_to_role=initial_assigned_role,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(item)
        db.flush()
        created_items.append(item)

        # Initial Status Event
        if not has_assigned_lecturer:
            note = "Complaint submitted by student. Course has no assigned lecturer; automatically routed directly to Head of Department (HOD)."
        else:
            note = f"Complaint submitted by student ({current_user.name}, {current_user.matric_no}). Awaiting lecturer review."

        record_status_event(
            db=db,
            item_id=item.id,
            from_status="NONE",
            to_status="SUBMITTED",
            actor_id=current_user.id,
            note=note,
            commit=False
        )

    # Derive overall status
    complaint.overall_status = derive_complaint_status(created_items)

    # Notifications
    notify_user(
        db=db,
        user_id=current_user.id,
        message=f"Your complaint #{complaint.id} for {course.code} has been logged with {len(created_items)} issue item(s).",
        complaint_id=complaint.id,
        commit=False
    )

    if has_assigned_lecturer:
        notify_user(
            db=db,
            user_id=course.lecturer_id,
            message=f"New complaint #{complaint.id} submitted for {course.code} by student {current_user.name}.",
            complaint_id=complaint.id,
            commit=False
        )
    else:
        # Notify HOD
        hod = db.query(User).filter(User.role == "hod").first()
        if hod:
            notify_user(
                db=db,
                user_id=hod.id,
                message=f"Escalated intake: New complaint #{complaint.id} for unassigned course {course.code} routed to HOD.",
                complaint_id=complaint.id,
                commit=False
            )

    db.commit()
    db.refresh(complaint)

    return build_complaint_response(complaint, db, hide_student_pii=False)

@router.get("/{complaint_id}", response_model=ComplaintResponse)
def get_complaint(
    complaint_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    complaint = _get_authorized_complaint(complaint_id, current_user, db)
    return build_complaint_response(complaint, db, hide_student_pii=False)


@router.post("/{complaint_id}/attachment/prepare")
def prepare_attachment_upload(
    complaint_id: int,
    payload: AttachmentUploadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    complaint = _get_authorized_complaint(complaint_id, current_user, db)
    if current_user.role != "student" or complaint.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the student who filed the complaint can upload evidence.",
        )

    extension = _validate_attachment_metadata(
        payload.filename, payload.size, payload.content_type
    )
    path = f"complaints/{complaint.id}/{current_user.id}/{uuid4().hex}{extension}"
    try:
        upload_url = create_signed_upload_url(path)
    except SupabaseStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return {"path": path, "upload_url": upload_url}


@router.post("/{complaint_id}/attachment/complete", response_model=AttachmentResponse)
def complete_attachment_upload(
    complaint_id: int,
    payload: AttachmentCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    complaint = _get_authorized_complaint(complaint_id, current_user, db)
    if current_user.role != "student" or complaint.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the student who filed the complaint can upload evidence.",
        )

    _validate_attachment_metadata(payload.filename, payload.size, payload.content_type)
    expected_prefix = f"complaints/{complaint.id}/{current_user.id}/"
    if (
        not payload.path.startswith(expected_prefix)
        or "\\" in payload.path
        or ".." in payload.path.split("/")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid upload path for this complaint.",
        )

    existing_attachment = db.query(Attachment).filter(
        Attachment.complaint_id == complaint.id,
        Attachment.file_path == payload.path,
    ).first()
    if existing_attachment:
        return existing_attachment

    try:
        metadata = get_object_metadata(payload.path)
    except SupabaseStorageError as exc:
        if exc.status_code not in {400, 404}:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file could not be verified in Supabase Storage.",
        ) from exc

    object_metadata = metadata.get("metadata") or {}
    try:
        actual_size = int(object_metadata.get("size", metadata.get("size")))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase Storage did not return the uploaded file size.",
        ) from exc
    actual_content_type = (
        object_metadata.get("mimetype")
        or object_metadata.get("contentType")
        or metadata.get("mimetype")
    )
    if actual_size != payload.size or (
        actual_content_type
        and actual_content_type.lower() != payload.content_type.lower()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file metadata does not match the prepared upload.",
        )

    attachment = Attachment(
        complaint_id=complaint.id,
        filename=PurePath(payload.filename.replace("\\", "/")).name,
        file_path=payload.path,
        file_size=payload.size,
        uploaded_at=datetime.utcnow()
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return attachment


@router.get("/{complaint_id}/attachments/{attachment_id}/download")
def get_attachment_download_url(
    complaint_id: int,
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    complaint = _get_authorized_complaint(complaint_id, current_user, db)
    attachment = db.query(Attachment).filter(
        Attachment.id == attachment_id,
        Attachment.complaint_id == complaint.id,
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    try:
        url = create_signed_download_url(attachment.file_path)
    except SupabaseStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return {"url": url, "expires_in": SIGNED_URL_TTL_SECONDS}
