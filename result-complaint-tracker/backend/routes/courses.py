from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend.models import Course, Enrollment, User
from backend.schemas import CourseResponse, CourseCreate, CourseAssignLecturer
from backend.auth import get_current_user, require_roles
from backend.helpers import notify_user

router = APIRouter(prefix="/api/courses", tags=["courses"])

@router.get("", response_model=List[CourseResponse])
def get_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns courses relevant to the current user role."""
    if current_user.role == "student":
        enrollments = db.query(Enrollment).filter(Enrollment.student_id == current_user.id).all()
        course_ids = [e.course_id for e in enrollments]
        courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    elif current_user.role == "lecturer":
        courses = db.query(Course).filter(Course.lecturer_id == current_user.id).all()
    else:  # HOD or Admin sees all
        courses = db.query(Course).order_by(Course.code).all()

    results = []
    for c in courses:
        results.append(CourseResponse(
            id=c.id,
            code=c.code,
            title=c.title,
            session=c.session,
            semester=c.semester,
            lecturer_id=c.lecturer_id,
            lecturer_name=c.lecturer.name if c.lecturer else "Unassigned (Routed to HOD)",
            enrollment_count=len(c.enrollments) if c.enrollments else 0
        ))
    return results

@router.get("/all", response_model=List[CourseResponse])
def get_all_courses(db: Session = Depends(get_db)):
    courses = db.query(Course).order_by(Course.code).all()
    results = []
    for c in courses:
        results.append(CourseResponse(
            id=c.id,
            code=c.code,
            title=c.title,
            session=c.session,
            semester=c.semester,
            lecturer_id=c.lecturer_id,
            lecturer_name=c.lecturer.name if c.lecturer else "Unassigned (Routed to HOD)",
            enrollment_count=len(c.enrollments) if c.enrollments else 0
        ))
    return results

@router.post("", response_model=CourseResponse)
def create_course(
    course_in: CourseCreate,
    current_user: User = Depends(require_roles(["admin", "hod"])),
    db: Session = Depends(get_db)
):
    course = Course(
        code=course_in.code.upper().strip(),
        title=course_in.title.strip(),
        session=course_in.session,
        semester=course_in.semester,
        lecturer_id=course_in.lecturer_id
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return CourseResponse(
        id=course.id,
        code=course.code,
        title=course.title,
        session=course.session,
        semester=course.semester,
        lecturer_id=course.lecturer_id,
        lecturer_name=course.lecturer.name if course.lecturer else "Unassigned (Routed to HOD)",
        enrollment_count=0
    )

@router.post("/{course_id}/assign")
def assign_lecturer(
    course_id: int,
    assignment: CourseAssignLecturer,
    current_user: User = Depends(require_roles(["admin", "hod"])),
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    old_lecturer_id = course.lecturer_id
    course.lecturer_id = assignment.lecturer_id
    db.commit()
    db.refresh(course)

    if assignment.lecturer_id:
        new_lecturer = db.query(User).filter(User.id == assignment.lecturer_id).first()
        if new_lecturer:
            notify_user(
                db=db,
                user_id=new_lecturer.id,
                message=f"You have been assigned as the lead lecturer for {course.code}: {course.title}."
            )

    return {
        "success": True,
        "message": f"Assigned lecturer for {course.code} updated successfully.",
        "course": CourseResponse(
            id=course.id,
            code=course.code,
            title=course.title,
            session=course.session,
            semester=course.semester,
            lecturer_id=course.lecturer_id,
            lecturer_name=course.lecturer.name if course.lecturer else "Unassigned (Routed to HOD)",
            enrollment_count=len(course.enrollments) if course.enrollments else 0
        )
    }
