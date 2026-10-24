from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator

# --- Enums / Valid Constants ---
VALID_ROLES = {"student", "lecturer", "hod", "admin"}
VALID_ISSUE_TYPES = {
    "MISSING_SCORE",
    "WRONG_SCORE",
    "WRONG_GRADE",
    "MISSING_CA",
    "SCRIPT_REMARK_REQUEST",
    "OTHER",
}
VALID_STATUSES = {
    "SUBMITTED",
    "UNDER_REVIEW",
    "NEEDS_INFO",
    "RESOLVED",
    "REJECTED",
    "ESCALATED",
    "WITHDRAWN",
}

# --- Auth & User Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserResponse"

class UserLogin(BaseModel):
    email: str
    password: str

class UserBase(BaseModel):
    name: str
    email: str
    role: str
    matric_no: Optional[str] = None
    department: Optional[str] = "Computer Science & Engineering"

class UserCreate(UserBase):
    password: str

    @field_validator("role")
    def validate_role(cls, v):
        if v not in VALID_ROLES:
            raise ValueError(f"Role must be one of {VALID_ROLES}")
        return v

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Course Schemas ---
class CourseBase(BaseModel):
    code: str
    title: str
    session: str = "2023/2024"
    semester: str = "Harmattan"
    lecturer_id: Optional[int] = None

class CourseCreate(CourseBase):
    pass

class CourseAssignLecturer(BaseModel):
    lecturer_id: Optional[int] = None

class CourseResponse(CourseBase):
    id: int
    lecturer_name: Optional[str] = None
    enrollment_count: Optional[int] = 0

    class Config:
        from_attributes = True

# --- Status Events ---
class StatusEventResponse(BaseModel):
    id: int
    complaint_item_id: int
    from_status: str
    to_status: str
    actor_id: Optional[int]
    actor_name: Optional[str] = None
    actor_role: Optional[str] = None
    note: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Complaint Items ---
class ComplaintItemCreate(BaseModel):
    issue_type: str
    claimed_score: Optional[float] = Field(None, ge=0, le=100)

    @field_validator("issue_type")
    def validate_issue(cls, v):
        if v not in VALID_ISSUE_TYPES:
            raise ValueError(f"Invalid issue_type. Must be one of {VALID_ISSUE_TYPES}")
        return v

class ComplaintItemResponse(BaseModel):
    id: int
    complaint_id: int
    issue_type: str
    status: str
    claimed_score: Optional[float] = None
    group_id: Optional[int] = None
    assigned_to_role: str
    reopened: bool
    reopen_count: int
    created_at: datetime
    updated_at: datetime
    timeline: List[StatusEventResponse] = []
    # Rich details for display
    student_name: Optional[str] = None
    matric_no: Optional[str] = None
    course_code: Optional[str] = None
    course_title: Optional[str] = None
    days_open: Optional[int] = 0

    class Config:
        from_attributes = True

# --- Issue Groups ---
class IssueGroupResponse(BaseModel):
    id: int
    course_id: int
    course_code: Optional[str] = None
    course_title: Optional[str] = None
    issue_type: str
    title: str
    status: str
    created_at: datetime
    updated_at: datetime
    student_count: int = 0
    assigned_lecturer_id: Optional[int] = None
    assigned_lecturer_name: Optional[str] = None
    items: List[ComplaintItemResponse] = []

    class Config:
        from_attributes = True

class GroupActionRequest(BaseModel):
    action: str  # RESOLVE, REJECT, REQUEST_INFO, ESCALATE
    note: str

    @field_validator("action")
    def validate_action(cls, v):
        allowed = {"RESOLVE", "REJECT", "REQUEST_INFO", "ESCALATE"}
        if v.upper() not in allowed:
            raise ValueError(f"Action must be one of {allowed}")
        return v.upper()

class ItemActionRequest(BaseModel):
    action: str  # REVIEW, RESOLVE, REJECT, REQUEST_INFO, ESCALATE, OVERRIDE
    note: str

    @field_validator("action")
    def validate_action(cls, v):
        allowed = {"REVIEW", "RESOLVE", "REJECT", "REQUEST_INFO", "ESCALATE", "OVERRIDE"}
        if v.upper() not in allowed:
            raise ValueError(f"Action must be one of {allowed}")
        return v.upper()

class ItemReplyRequest(BaseModel):
    reply_note: str

class ItemReopenRequest(BaseModel):
    justification: str

# --- Complaints ---
class ComplaintCreate(BaseModel):
    course_id: int
    description: str
    items: List[ComplaintItemCreate]

    @field_validator("items")
    def validate_items(cls, v):
        if not v or len(v) == 0:
            raise ValueError("Complaint must contain at least one issue item")
        # Check no duplicate issue_type within the same complaint submission
        types = [item.issue_type for item in v]
        if len(types) != len(set(types)):
            raise ValueError("Cannot submit duplicate issue types in the same complaint")
        return v

class AttachmentResponse(BaseModel):
    id: int
    filename: str
    file_path: str
    file_size: int
    uploaded_at: datetime

    class Config:
        from_attributes = True

class ComplaintResponse(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    matric_no: Optional[str] = None
    course_id: int
    course_code: Optional[str] = None
    course_title: Optional[str] = None
    description: str
    overall_status: str
    created_at: datetime
    updated_at: datetime
    items: List[ComplaintItemResponse] = []
    attachments: List[AttachmentResponse] = []

    class Config:
        from_attributes = True

# --- Notifications ---
class NotificationResponse(BaseModel):
    id: int
    user_id: int
    message: str
    read: bool
    complaint_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- HOD & Admin Overview / Stats ---
class DepartmentOverviewStats(BaseModel):
    total_complaints: int
    total_items: int
    pending_count: int
    escalated_count: int
    resolved_count: int
    rejected_count: int
    avg_resolution_hours: float
    status_breakdown: dict
    by_course: List[dict]
    by_issue_type: List[dict]
    oldest_unresolved: List[ComplaintItemResponse]
    courses_without_lecturers: List[dict]

class SimulationRequest(BaseModel):
    days_to_advance: int = 7
