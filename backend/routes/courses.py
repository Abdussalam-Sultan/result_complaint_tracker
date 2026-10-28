from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.database import get_db
from backend.constants import DEPARTMENTS, SHARED_DEPARTMENT
from backend.models import Course, CourseDepartment, Department, Enrollment, User
from backend.schemas import CourseResponse, CourseCreate, CourseDepartmentsUpdate
from backend.auth import get_current_user, require_roles

router = APIRouter(prefix="/api/courses", tags=["courses"])


def build_course_response(course: Course) -> CourseResponse:
    departments = [membership.department_name for membership in course.departments]
    return CourseResponse(
        id=course.id,
        code=course.code,
        title=course.title,
        session=course.session,
        semester=course.semester,
        departments=departments,
        enrollment_count=len(course.enrollments) if course.enrollments else 0,
    )


def enroll_eligible_students(db: Session, course_id: int, departments: set[str]) -> None:
    students_query = db.query(User).filter(User.role == "student")
    if SHARED_DEPARTMENT not in departments:
        students_query = students_query.filter(User.department.in_(departments))
    students = students_query.all()
    enrolled_ids = {
        student_id for (student_id,) in db.query(Enrollment.student_id).filter(
            Enrollment.course_id == course_id
        ).all()
    }
    for student in students:
        if student.id not in enrolled_ids:
            db.add(Enrollment(student_id=student.id, course_id=course_id))

@router.get("", response_model=List[CourseResponse])
def get_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns courses relevant to the current user role."""
    if current_user.role == "student":
        courses = (
            db.query(Course)
            .join(CourseDepartment)
            .filter(CourseDepartment.department_name.in_([current_user.department, SHARED_DEPARTMENT]))
            .order_by(Course.code)
            .all()
        )
    elif current_user.role == "part_advisor":
        department = db.query(Department).filter(Department.name == current_user.department).first()
        if not department or department.part_advisor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Your account is not the assigned part advisor.")
        courses = (
            db.query(Course)
            .join(CourseDepartment)
            .filter(CourseDepartment.department_name.in_([current_user.department, SHARED_DEPARTMENT]))
            .order_by(Course.code)
            .all()
        )
    elif current_user.role == "admin":
        courses = db.query(Course).order_by(Course.code).all()
    else:
        raise HTTPException(status_code=403, detail="Access denied.")
    return [build_course_response(course) for course in courses]

@router.get("/all", response_model=List[CourseResponse])
def get_all_courses(
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
):
    courses = db.query(Course).order_by(Course.code).all()
    return [build_course_response(course) for course in courses]

@router.post("", response_model=CourseResponse)
def create_course(
    course_in: CourseCreate,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    departments = set(course_in.departments)
    if SHARED_DEPARTMENT in departments:
        departments = {SHARED_DEPARTMENT}
    invalid_departments = departments - set(DEPARTMENTS) - {SHARED_DEPARTMENT}
    if invalid_departments or not departments:
        raise HTTPException(status_code=400, detail="Assign the course to one or more valid departments.")
    course = Course(
        code=course_in.code.upper().strip(),
        title=course_in.title.strip(),
        session=course_in.session,
        semester=course_in.semester,
    )
    db.add(course)
    for department in departments:
        db.add(CourseDepartment(course=course, department_name=department))
    db.flush()
    enroll_eligible_students(db, course.id, departments)
    db.commit()
    db.refresh(course)
    return build_course_response(course)


@router.put("/{course_id}/departments", response_model=CourseResponse)
def update_course_departments(
    course_id: int,
    assignment: CourseDepartmentsUpdate,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
):
    departments = set(assignment.departments)
    if SHARED_DEPARTMENT in departments:
        departments = {SHARED_DEPARTMENT}
    if not departments or departments - set(DEPARTMENTS) - {SHARED_DEPARTMENT}:
        raise HTTPException(status_code=400, detail="Assign one or more valid departments.")
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    course.departments.clear()
    course.departments.extend(
        CourseDepartment(department_name=department) for department in sorted(departments)
    )
    db.flush()
    # Remove enrollments for students no longer eligible
    eligible_departments = departments
    if SHARED_DEPARTMENT in eligible_departments:
        # all students remain eligible
        pass
    else:
        students_to_remove = db.query(User).filter(User.role == "student", ~User.department.in_(eligible_departments)).all()
        student_ids = [s.id for s in students_to_remove]
        if student_ids:
            db.query(Enrollment).filter(Enrollment.course_id == course_id, Enrollment.student_id.in_(student_ids)).delete(synchronize_session=False)
    enroll_eligible_students(db, course.id, departments)
    db.commit()
    db.refresh(course)
    return build_course_response(course)
