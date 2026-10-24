import os
import sys
from datetime import datetime, timedelta

# Ensure root directory is on PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import engine, SessionLocal, Base
from backend.models import (
    User, Course, Enrollment, Complaint, ComplaintItem,
    IssueGroup, StatusEvent, Notification
)
from backend.auth import get_password_hash
from backend.helpers import derive_complaint_status

def seed_database():
    print("Initializing database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    default_password = "password123"
    hashed_pwd = get_password_hash(default_password)

    print("Seeding Users...")
    # 1. HOD
    hod = User(
        name="Prof. Olumide Adeleke",
        email="hod@oauife.edu.ng",
        role="hod",
        department="Computer Science & Engineering",
        password_hash=hashed_pwd
    )
    db.add(hod)

    # 2. Admin
    admin = User(
        name="Mrs. Funmilayo Alabi (Academic Affairs)",
        email="admin@oauife.edu.ng",
        role="admin",
        department="Academic Affairs / Faculty Office",
        password_hash=hashed_pwd
    )
    db.add(admin)

    # 3. Lecturers
    lecturer1 = User(
        name="Dr. Folashade Babatunde",
        email="lecturer1@oauife.edu.ng",
        role="lecturer",
        department="Computer Science & Engineering",
        password_hash=hashed_pwd
    )
    lecturer2 = User(
        name="Dr. Emeka Okoye",
        email="lecturer2@oauife.edu.ng",
        role="lecturer",
        department="Computer Science & Engineering",
        password_hash=hashed_pwd
    )
    lecturer3 = User(
        name="Engr. Adeola Adelekan",
        email="lecturer3@oauife.edu.ng",
        role="lecturer",
        department="Computer Science & Engineering",
        password_hash=hashed_pwd
    )
    db.add_all([lecturer1, lecturer2, lecturer3])
    db.flush()

    # 4. 30 Students with authentic Nigerian names and OAU matric numbers (CSC/2021/XXX)
    student_data = [
        ("Ayomide Balogun", "CSC/2021/001", "ayomide@oauife.edu.ng"),
        ("Chiamaka Eze", "CSC/2021/002", "chiamaka@oauife.edu.ng"),
        ("Oluwaseun Adeyemi", "CSC/2021/003", "seun@oauife.edu.ng"),
        ("Babatunde Olatunji", "CSC/2021/004", "babatunde@oauife.edu.ng"),
        ("Ngozi Okonkwo", "CSC/2021/005", "ngozi@oauife.edu.ng"),
        ("Ibrahim Danjuma", "CSC/2021/006", "ibrahim@oauife.edu.ng"),
        ("Yetunde Ogundimu", "CSC/2021/007", "yetunde@oauife.edu.ng"),
        ("Femi Adeleke", "CSC/2021/008", "femi@oauife.edu.ng"),
        ("Zainab Abubakar", "CSC/2021/009", "zainab@oauife.edu.ng"),
        ("Kehinde Sowore", "CSC/2021/010", "kehinde@oauife.edu.ng"),
        ("Damilola Fagbemi", "CSC/2021/011", "damilola@oauife.edu.ng"),
        ("Tobi Akinwunmi", "CSC/2021/012", "tobi@oauife.edu.ng"),
        ("Blessing Nwachukwu", "CSC/2021/013", "blessing@oauife.edu.ng"),
        ("Olamide Bakare", "CSC/2021/014", "olamide@oauife.edu.ng"),
        ("Kazeem Bello", "CSC/2021/015", "kazeem@oauife.edu.ng"),
        ("Chinonso Obi", "CSC/2021/016", "chinonso@oauife.edu.ng"),
        ("Ronke Ajayi", "CSC/2021/017", "ronke@oauife.edu.ng"),
        ("Taiwo Omotayo", "CSC/2021/018", "taiwo@oauife.edu.ng"),
        ("Maryam Sanni", "CSC/2021/019", "maryam@oauife.edu.ng"),
        ("Emeka Umeh", "CSC/2021/020", "emeka.umeh@oauife.edu.ng"),
        ("Sodiq Popoola", "CSC/2021/021", "sodiq@oauife.edu.ng"),
        ("Adaugo Nwosu", "CSC/2021/022", "adaugo@oauife.edu.ng"),
        ("Kunle Alade", "CSC/2021/023", "kunle@oauife.edu.ng"),
        ("Halima Musa", "CSC/2021/024", "halima@oauife.edu.ng"),
        ("Bolanle Shittu", "CSC/2021/025", "bolanle@oauife.edu.ng"),
        ("Victor Ekanem", "CSC/2021/026", "victor@oauife.edu.ng"),
        ("Grace Anyanwu", "CSC/2021/027", "grace@oauife.edu.ng"),
        ("David Olaniyan", "CSC/2021/028", "david@oauife.edu.ng"),
        ("Aisha Garba", "CSC/2021/029", "aisha@oauife.edu.ng"),
        ("Samuel Osoba", "CSC/2021/030", "samuel@oauife.edu.ng"),
    ]

    students = []
    for name, matric, email in student_data:
        s = User(
            name=name,
            email=email,
            matric_no=matric,
            role="student",
            department="Computer Science & Engineering",
            password_hash=hashed_pwd
        )
        students.append(s)
        db.add(s)

    db.flush()

    print("Seeding Courses...")
    # 6 Courses (including 1 unassigned course to show direct routing to HOD)
    course_data = [
        ("CSC 301", "Database Design & Management", lecturer1.id),
        ("CSC 303", "Operating Systems & Systems Programming", lecturer1.id),
        ("CSC 305", "Data Communications & Networking", lecturer2.id),
        ("CSC 401", "Compiler Construction & Formal Languages", lecturer2.id),
        ("CPE 307", "Microprocessor Systems & Interfacing", lecturer3.id),
        ("CSC 415", "Software Engineering & Architecture", None),  # Unassigned -> Routes to HOD!
    ]

    courses = []
    for code, title, lec_id in course_data:
        c = Course(
            code=code,
            title=title,
            session="2023/2024",
            semester="Harmattan",
            lecturer_id=lec_id
        )
        courses.append(c)
        db.add(c)

    db.flush()

    print("Seeding Enrollments...")
    # Enroll all 30 students in CSC 301 and CSC 303
    # Enroll students 1-20 in CSC 305 and CSC 401
    # Enroll students 20-30 in CPE 307 and CSC 415
    for s in students:
        db.add(Enrollment(student_id=s.id, course_id=courses[0].id))
        db.add(Enrollment(student_id=s.id, course_id=courses[1].id))

    for s in students[:20]:
        db.add(Enrollment(student_id=s.id, course_id=courses[2].id))
        db.add(Enrollment(student_id=s.id, course_id=courses[3].id))

    for s in students[15:]:
        db.add(Enrollment(student_id=s.id, course_id=courses[4].id))
        db.add(Enrollment(student_id=s.id, course_id=courses[5].id))

    db.flush()

    print("Seeding Scenarios...")

    # SCENARIO A: Mass Complaints on CSC 301 (Missing Score, 25 students affected)
    csc301 = courses[0]
    mass_group_missing = IssueGroup(
        course_id=csc301.id,
        issue_type="MISSING_SCORE",
        title="CSC 301: Missing Score Issue Cluster (Batch Continuous Assessment)",
        status="OPEN",
        created_at=datetime.utcnow() - timedelta(days=3)
    )
    db.add(mass_group_missing)
    db.flush()

    # Create complaints for the first 25 students joining this mass group
    for i in range(25):
        s = students[i]
        c = Complaint(
            student_id=s.id,
            course_id=csc301.id,
            description=f"My CSC 301 examination and continuous assessment score is completely missing on the portal result sheet.",
            overall_status="SUBMITTED",
            created_at=datetime.utcnow() - timedelta(days=3, hours=i * 2)
        )
        db.add(c)
        db.flush()

        item = ComplaintItem(
            complaint_id=c.id,
            issue_type="MISSING_SCORE",
            status="SUBMITTED",
            claimed_score=68.0,
            group_id=mass_group_missing.id,
            assigned_to_role="lecturer",
            created_at=c.created_at,
            updated_at=c.created_at
        )
        db.add(item)
        db.flush()

        # Status event
        db.add(StatusEvent(
            complaint_item_id=item.id,
            from_status="NONE",
            to_status="SUBMITTED",
            actor_id=s.id,
            note=f"Complaint lodged by student ({s.name}, {s.matric_no}). Attached to mass cluster #{mass_group_missing.id}.",
            created_at=item.created_at
        ))

    # SCENARIO B: Multi-Issue Complaints (Student has BOTH MISSING_SCORE and WRONG_GRADE)
    # Let's say Student #0 (Ayomide) and Student #1 (Chiamaka) on CSC 303 have 2 items:
    # 1 item: MISSING_CA, 1 item: WRONG_GRADE
    csc303 = courses[1]
    group_wrong_grade = IssueGroup(
        course_id=csc303.id,
        issue_type="WRONG_GRADE",
        title="CSC 303: Wrong Letter Grade Computation Cluster",
        status="OPEN",
        created_at=datetime.utcnow() - timedelta(days=2)
    )
    db.add(group_wrong_grade)
    db.flush()

    multi_student = students[0]  # Ayomide
    multi_comp = Complaint(
        student_id=multi_student.id,
        course_id=csc303.id,
        description="I have two issues: my test score of 28/30 is missing from the CA column, and my final letter grade shows 'F' instead of 'B'.",
        overall_status="UNDER_REVIEW",
        created_at=datetime.utcnow() - timedelta(days=2)
    )
    db.add(multi_comp)
    db.flush()

    # Item 1: MISSING_CA (individual review)
    item_ca = ComplaintItem(
        complaint_id=multi_comp.id,
        issue_type="MISSING_CA",
        status="UNDER_REVIEW",
        claimed_score=28.0,
        group_id=None,
        assigned_to_role="lecturer",
        created_at=datetime.utcnow() - timedelta(days=2),
        updated_at=datetime.utcnow() - timedelta(days=1)
    )
    db.add(item_ca)
    db.flush()

    db.add(StatusEvent(
        complaint_item_id=item_ca.id,
        from_status="NONE",
        to_status="SUBMITTED",
        actor_id=multi_student.id,
        note="Initial submission: Continuous assessment test score omitted.",
        created_at=datetime.utcnow() - timedelta(days=2)
    ))
    db.add(StatusEvent(
        complaint_item_id=item_ca.id,
        from_status="SUBMITTED",
        to_status="UNDER_REVIEW",
        actor_id=lecturer1.id,
        note="Lecturer verifying CA attendance records with course representative.",
        created_at=datetime.utcnow() - timedelta(days=1)
    ))

    # Item 2: WRONG_GRADE (in group)
    item_grade = ComplaintItem(
        complaint_id=multi_comp.id,
        issue_type="WRONG_GRADE",
        status="SUBMITTED",
        claimed_score=64.0,
        group_id=group_wrong_grade.id,
        assigned_to_role="lecturer",
        created_at=datetime.utcnow() - timedelta(days=2),
        updated_at=datetime.utcnow() - timedelta(days=2)
    )
    db.add(item_grade)
    db.flush()

    db.add(StatusEvent(
        complaint_item_id=item_grade.id,
        from_status="NONE",
        to_status="SUBMITTED",
        actor_id=multi_student.id,
        note="Portal grade displays F while total marks tally to 64 (B).",
        created_at=datetime.utcnow() - timedelta(days=2)
    ))

    # SCENARIO C: Complaint Already Escalated to HOD
    # Student #25 (Victor Ekanem) on CSC 401
    csc401 = courses[3]
    esc_student = students[25]
    esc_comp = Complaint(
        student_id=esc_student.id,
        course_id=csc401.id,
        description="Script remark request. Submitted remark request 12 days ago; lecturer was unresponsive and dispute was lodged.",
        overall_status="ESCALATED TO HOD (1 item)",
        created_at=datetime.utcnow() - timedelta(days=12)
    )
    db.add(esc_comp)
    db.flush()

    esc_item = ComplaintItem(
        complaint_id=esc_comp.id,
        issue_type="SCRIPT_REMARK_REQUEST",
        status="ESCALATED",
        claimed_score=75.0,
        group_id=None,
        assigned_to_role="hod",
        reopened=True,
        reopen_count=1,
        created_at=datetime.utcnow() - timedelta(days=12),
        updated_at=datetime.utcnow() - timedelta(days=3)
    )
    db.add(esc_item)
    db.flush()

    db.add(StatusEvent(
        complaint_item_id=esc_item.id,
        from_status="NONE",
        to_status="SUBMITTED",
        actor_id=esc_student.id,
        note="Student formally requested physical script re-marking.",
        created_at=datetime.utcnow() - timedelta(days=12)
    ))
    db.add(StatusEvent(
        complaint_item_id=esc_item.id,
        from_status="SUBMITTED",
        to_status="UNDER_REVIEW",
        actor_id=lecturer2.id,
        note="Script retrieval initiated from department exam vault.",
        created_at=datetime.utcnow() - timedelta(days=10)
    ))
    db.add(StatusEvent(
        complaint_item_id=esc_item.id,
        from_status="UNDER_REVIEW",
        to_status="REJECTED",
        actor_id=lecturer2.id,
        note="Remark rejected: Examiner found no marking discrepancies.",
        created_at=datetime.utcnow() - timedelta(days=5)
    ))
    db.add(StatusEvent(
        complaint_item_id=esc_item.id,
        from_status="REJECTED",
        to_status="ESCALATED",
        actor_id=esc_student.id,
        note="Student disputed rejection with evidence of question 3 sub-part marking error. Escalated to HOD for independent panel re-assessment.",
        created_at=datetime.utcnow() - timedelta(days=3)
    ))

    # SCENARIO D: Several Resolved Complaints (for HOD analytics & charts)
    resolved_pairs = [
        (students[2], courses[0], "WRONG_SCORE", 55.0, 72.0, 5, 2),
        (students[3], courses[1], "MISSING_SCORE", 0.0, 65.0, 6, 1),
        (students[4], courses[2], "MISSING_CA", 10.0, 26.0, 8, 3),
        (students[5], courses[4], "WRONG_GRADE", 48.0, 60.0, 7, 2),
    ]

    for student_obj, course_obj, issue_t, old_s, new_s, created_days_ago, resolved_days_ago in resolved_pairs:
        res_comp = Complaint(
            student_id=student_obj.id,
            course_id=course_obj.id,
            description=f"Correction requested for {issue_t.replace('_', ' ').lower()}. Exam sheet verified.",
            overall_status="RESOLVED",
            created_at=datetime.utcnow() - timedelta(days=created_days_ago)
        )
        db.add(res_comp)
        db.flush()

        res_item = ComplaintItem(
            complaint_id=res_comp.id,
            issue_type=issue_t,
            status="RESOLVED",
            claimed_score=new_s,
            group_id=None,
            assigned_to_role="lecturer",
            created_at=datetime.utcnow() - timedelta(days=created_days_ago),
            updated_at=datetime.utcnow() - timedelta(days=resolved_days_ago)
        )
        db.add(res_item)
        db.flush()

        db.add(StatusEvent(
            complaint_item_id=res_item.id,
            from_status="NONE",
            to_status="SUBMITTED",
            actor_id=student_obj.id,
            note="Submitted result complaint.",
            created_at=datetime.utcnow() - timedelta(days=created_days_ago)
        ))
        db.add(StatusEvent(
            complaint_item_id=res_item.id,
            from_status="SUBMITTED",
            to_status="UNDER_REVIEW",
            actor_id=course_obj.lecturer_id,
            note="Lecturer retrieved original score sheet and cross-referenced with attendance roster.",
            created_at=datetime.utcnow() - timedelta(days=created_days_ago - 1)
        ))
        db.add(StatusEvent(
            complaint_item_id=res_item.id,
            from_status="UNDER_REVIEW",
            to_status="RESOLVED",
            actor_id=course_obj.lecturer_id,
            note=f"Score sheet verified and updated to {new_s}. Amendment transmitted to department board.",
            created_at=datetime.utcnow() - timedelta(days=resolved_days_ago)
        ))

    # SCENARIO E: Unassigned Course Complaint (Direct HOD Routing)
    # Student #26 (Grace Anyanwu) on CSC 415 (which has no assigned lecturer)
    unassigned_course = courses[5]  # CSC 415
    student_unassigned = students[26]
    c_unassigned = Complaint(
        student_id=student_unassigned.id,
        course_id=unassigned_course.id,
        description="Missing continuous assessment score for CSC 415 project submission.",
        overall_status="SUBMITTED",
        created_at=datetime.utcnow() - timedelta(days=1)
    )
    db.add(c_unassigned)
    db.flush()

    item_unassigned = ComplaintItem(
        complaint_id=c_unassigned.id,
        issue_type="MISSING_CA",
        status="SUBMITTED",
        claimed_score=35.0,
        group_id=None,
        assigned_to_role="hod",
        created_at=datetime.utcnow() - timedelta(days=1),
        updated_at=datetime.utcnow() - timedelta(days=1)
    )
    db.add(item_unassigned)
    db.flush()

    db.add(StatusEvent(
        complaint_item_id=item_unassigned.id,
        from_status="NONE",
        to_status="SUBMITTED",
        actor_id=student_unassigned.id,
        note="Course has no assigned lead lecturer; automatically routed directly to Head of Department (HOD) queue.",
        created_at=item_unassigned.created_at
    ))

    # SCENARIO F: In-App Notifications for users
    notif_data = [
        (hod.id, "Urgent: 1 complaint item escalated to HOD for CSC 401 script remark dispute.", esc_comp.id),
        (hod.id, "Intake routing: New complaint logged on unassigned course CSC 415.", c_unassigned.id),
        (lecturer1.id, "Mass Complaint Alert: 25 students lodged MISSING_SCORE on CSC 301.", None),
        (multi_student.id, "Your CSC 303 complaint item (Missing CA) is now UNDER_REVIEW by Dr. Folashade Babatunde.", multi_comp.id),
        (esc_student.id, "Your CSC 401 script remark dispute has been escalated to the HOD office.", esc_comp.id),
    ]

    for uid, msg, comp_id in notif_data:
        db.add(Notification(
            user_id=uid,
            message=msg,
            complaint_id=comp_id,
            read=False,
            created_at=datetime.utcnow() - timedelta(hours=4)
        ))

    db.commit()
    db.close()

    print("\n=======================================================")
    print("DEMO SEEDING COMPLETED SUCCESSFULLY!")
    print("=======================================================")
    print("Institution: Obafemi Awolowo University (OAU), Ile-Ife")
    print("All demo accounts have password: password123")
    print("-------------------------------------------------------")
    print("1. HOD (Executive Oversight & Escalations):")
    print("   Email: hod@oauife.edu.ng | Name: Prof. Olumide Adeleke")
    print("\n2. Lecturers:")
    print("   - Dr. Folashade Babatunde (CSC 301, CSC 303): lecturer1@oauife.edu.ng")
    print("   - Dr. Emeka Okoye (CSC 305, CSC 401): lecturer2@oauife.edu.ng")
    print("   - Engr. Adeola Adelekan (CPE 307): lecturer3@oauife.edu.ng")
    print("\n3. Admin (User Management & Time Simulation):")
    print("   Email: admin@oauife.edu.ng | Name: Mrs. Funmilayo Alabi")
    print("\n4. Featured Students (Matric Format: CSC/2021/XXX):")
    print("   - Ayomide Balogun (Multi-issue): ayomide@oauife.edu.ng | Matric: CSC/2021/001")
    print("   - Chiamaka Eze (Mass issue group): chiamaka@oauife.edu.ng | Matric: CSC/2021/002")
    print("   - Victor Ekanem (HOD Escalation): victor@oauife.edu.ng | Matric: CSC/2021/026")
    print("   - Grace Anyanwu (Unassigned Course): grace@oauife.edu.ng | Matric: CSC/2021/027")
    print("   + 26 additional enrolled students (all password123)")
    print("=======================================================\n")

if __name__ == "__main__":
    seed_database()
