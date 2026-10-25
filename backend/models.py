from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    matric_no = Column(String(50), unique=True, nullable=True, index=True)  # only for students
    role = Column(String(20), nullable=False, index=True)  # 'student', 'lecturer', 'hod', 'admin'
    password_hash = Column(String(255), nullable=False)
    department = Column(String(100), default="Computer Science & Engineering")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    complaints = relationship("Complaint", back_populates="student", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="student", cascade="all, delete-orphan")
    courses_taught = relationship("Course", back_populates="lecturer")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), nullable=False, index=True)  # e.g., CSC 301
    title = Column(String(200), nullable=False)
    session = Column(String(20), nullable=False, default="2023/2024")
    semester = Column(String(20), nullable=False, default="Harmattan")  # Harmattan or Rain
    lecturer_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # nullable -> routes to HOD
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    lecturer = relationship("User", back_populates="courses_taught")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")
    complaints = relationship("Complaint", back_populates="course")
    issue_groups = relationship("IssueGroup", back_populates="course", cascade="all, delete-orphan")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")


class IssueGroup(Base):
    __tablename__ = "issue_groups"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    issue_type = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    status = Column(String(30), default="OPEN", index=True)  # OPEN, UNDER_REVIEW, NEEDS_INFO, RESOLVED, REJECTED, ESCALATED
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course = relationship("Course", back_populates="issue_groups")
    items = relationship("ComplaintItem", back_populates="group")


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    description = Column(Text, nullable=False)
    overall_status = Column(String(50), default="SUBMITTED", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("User", back_populates="complaints")
    course = relationship("Course", back_populates="complaints")
    items = relationship("ComplaintItem", back_populates="complaint", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="complaint", cascade="all, delete-orphan")


class ComplaintItem(Base):
    __tablename__ = "complaint_items"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False, index=True)
    issue_type = Column(String(50), nullable=False, index=True)
    # MISSING_SCORE, WRONG_SCORE, WRONG_GRADE, MISSING_CA, SCRIPT_REMARK_REQUEST, OTHER
    status = Column(String(30), default="SUBMITTED", index=True)
    # SUBMITTED, UNDER_REVIEW, NEEDS_INFO, RESOLVED, REJECTED, ESCALATED, WITHDRAWN
    claimed_score = Column(Float, nullable=True)  # 0 to 100
    group_id = Column(Integer, ForeignKey("issue_groups.id"), nullable=True, index=True)
    assigned_to_role = Column(String(20), default="lecturer")  # 'lecturer' or 'hod'
    reopened = Column(Boolean, default=False)
    reopen_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="items")
    group = relationship("IssueGroup", back_populates="items")
    timeline = relationship("StatusEvent", back_populates="complaint_item", cascade="all, delete-orphan", order_by="StatusEvent.created_at")


class StatusEvent(Base):
    __tablename__ = "status_events"

    id = Column(Integer, primary_key=True, index=True)
    complaint_item_id = Column(Integer, ForeignKey("complaint_items.id"), nullable=False, index=True)
    from_status = Column(String(30), nullable=False)
    to_status = Column(String(30), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    complaint_item = relationship("ComplaintItem", back_populates="timeline")
    actor = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    complaint_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)  # Supabase bucket object path
    file_size = Column(Integer, default=0)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="attachments")
