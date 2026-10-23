import { getDb, DbClient } from './db';

export async function seedDatabase(db?: DbClient): Promise<void> {
  const client = db || (await getDb());

  console.log('[PostgreSQL Seed] Cleaning existing records...');
  await client.exec(`
    TRUNCATE attachments, notifications, status_events, complaint_items, issue_groups, complaints, enrollments, courses, users RESTART IDENTITY CASCADE;
  `);

  console.log('[PostgreSQL Seed] Inserting authentic OAU Staff and HOD accounts...');

  // 1. Staff and HOD
  const usersToInsert = [
    {
      name: 'Prof. Olumide Adeleke',
      email: 'hod@oauife.edu.ng',
      role: 'hod',
      matric_no: null,
      department: 'Computer Science & Engineering',
    },
    {
      name: 'Mrs. Funmilayo Alabi (Academic Affairs)',
      email: 'admin@oauife.edu.ng',
      role: 'admin',
      matric_no: null,
      department: 'Academic Affairs / Faculty Office',
    },
    {
      name: 'Dr. Folashade Babatunde',
      email: 'lecturer1@oauife.edu.ng',
      role: 'lecturer',
      matric_no: null,
      department: 'Computer Science & Engineering',
    },
    {
      name: 'Dr. Emeka Okoye',
      email: 'lecturer2@oauife.edu.ng',
      role: 'lecturer',
      matric_no: null,
      department: 'Computer Science & Engineering',
    },
    {
      name: 'Engr. Adeola Adelekan',
      email: 'lecturer3@oauife.edu.ng',
      role: 'lecturer',
      matric_no: null,
      department: 'Computer Science & Engineering',
    },
  ];

  for (const u of usersToInsert) {
    await client.query(
      `INSERT INTO users (name, email, matric_no, role, password_hash, department)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [u.name, u.email, u.matric_no, u.role, 'password123', u.department]
    );
  }

  // 2. 30 Students with authentic OAU matric numbers (CSC/2021/XXX format)
  const students = [
    { name: 'Ayomide Balogun', matric: 'CSC/2021/001', email: 'ayomide@oauife.edu.ng' },
    { name: 'Chiamaka Eze', matric: 'CSC/2021/002', email: 'chiamaka@oauife.edu.ng' },
    { name: 'Oluwaseun Adeyemi', matric: 'CSC/2021/003', email: 'seun@oauife.edu.ng' },
    { name: 'Babatunde Olatunji', matric: 'CSC/2021/004', email: 'babatunde@oauife.edu.ng' },
    { name: 'Ngozi Okonkwo', matric: 'CSC/2021/005', email: 'ngozi@oauife.edu.ng' },
    { name: 'Ibrahim Danjuma', matric: 'CSC/2021/006', email: 'ibrahim@oauife.edu.ng' },
    { name: 'Yetunde Ogundimu', matric: 'CSC/2021/007', email: 'yetunde@oauife.edu.ng' },
    { name: 'Femi Adeleke', matric: 'CSC/2021/008', email: 'femi@oauife.edu.ng' },
    { name: 'Zainab Abubakar', matric: 'CSC/2021/009', email: 'zainab@oauife.edu.ng' },
    { name: 'Kehinde Sowore', matric: 'CSC/2021/010', email: 'kehinde@oauife.edu.ng' },
    { name: 'Damilola Fagbemi', matric: 'CSC/2021/011', email: 'damilola@oauife.edu.ng' },
    { name: 'Tobi Akinwunmi', matric: 'CSC/2021/012', email: 'tobi@oauife.edu.ng' },
    { name: 'Blessing Nwachukwu', matric: 'CSC/2021/013', email: 'blessing@oauife.edu.ng' },
    { name: 'Olamide Bakare', matric: 'CSC/2021/014', email: 'olamide@oauife.edu.ng' },
    { name: 'Kazeem Bello', matric: 'CSC/2021/015', email: 'kazeem@oauife.edu.ng' },
    { name: 'Chinonso Obi', matric: 'CSC/2021/016', email: 'chinonso@oauife.edu.ng' },
    { name: 'Ronke Ajayi', matric: 'CSC/2021/017', email: 'ronke@oauife.edu.ng' },
    { name: 'Taiwo Omotayo', matric: 'CSC/2021/018', email: 'taiwo@oauife.edu.ng' },
    { name: 'Maryam Sanni', matric: 'CSC/2021/019', email: 'maryam@oauife.edu.ng' },
    { name: 'Emeka Umeh', matric: 'CSC/2021/020', email: 'emeka.umeh@oauife.edu.ng' },
    { name: 'Sodiq Popoola', matric: 'CSC/2021/021', email: 'sodiq@oauife.edu.ng' },
    { name: 'Adaugo Nwosu', matric: 'CSC/2021/022', email: 'adaugo@oauife.edu.ng' },
    { name: 'Kunle Alade', matric: 'CSC/2021/023', email: 'kunle@oauife.edu.ng' },
    { name: 'Halima Musa', matric: 'CSC/2021/024', email: 'halima@oauife.edu.ng' },
    { name: 'Bolanle Shittu', matric: 'CSC/2021/025', email: 'bolanle@oauife.edu.ng' },
    { name: 'Victor Ekanem', matric: 'CSC/2021/026', email: 'victor@oauife.edu.ng' },
    { name: 'Grace Anyanwu', matric: 'CSC/2021/027', email: 'grace@oauife.edu.ng' },
    { name: 'David Olaniyan', matric: 'CSC/2021/028', email: 'david@oauife.edu.ng' },
    { name: 'Aisha Garba', matric: 'CSC/2021/029', email: 'aisha@oauife.edu.ng' },
    { name: 'Samuel Osoba', matric: 'CSC/2021/030', email: 'samuel@oauife.edu.ng' },
  ];

  for (const s of students) {
    await client.query(
      `INSERT INTO users (name, email, matric_no, role, password_hash, department)
       VALUES ($1, $2, $3, 'student', $4, 'Computer Science & Engineering')`,
      [s.name, s.email, s.matric, 'password123']
    );
  }

  console.log('[PostgreSQL Seed] Inserting OAU Computer Science Courses...');
  // Users map
  const userRows = (await client.query('SELECT id, email FROM users')).rows;
  const userMap = new Map(userRows.map((r: any) => [r.email, r.id]));

  const courses = [
    { code: 'CSC 301', title: 'Database Design & Management', session: '2023/2024', semester: 'Harmattan', lecturer: 'lecturer1@oauife.edu.ng' },
    { code: 'CSC 303', title: 'Operating Systems & Systems Programming', session: '2023/2024', semester: 'Harmattan', lecturer: 'lecturer1@oauife.edu.ng' },
    { code: 'CSC 305', title: 'Data Communications & Networking', session: '2023/2024', semester: 'Harmattan', lecturer: 'lecturer2@oauife.edu.ng' },
    { code: 'CSC 401', title: 'Compiler Construction & Formal Languages', session: '2023/2024', semester: 'Harmattan', lecturer: 'lecturer2@oauife.edu.ng' },
    { code: 'CPE 307', title: 'Microprocessor Systems & Interfacing', session: '2023/2024', semester: 'Harmattan', lecturer: 'lecturer3@oauife.edu.ng' },
    { code: 'CSC 415', title: 'Artificial Intelligence & Machine Learning', session: '2023/2024', semester: 'Harmattan', lecturer: null }, // Unassigned course!
  ];

  for (const c of courses) {
    const lecturerId = c.lecturer ? userMap.get(c.lecturer) : null;
    await client.query(
      `INSERT INTO courses (code, title, session, semester, lecturer_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [c.code, c.title, c.session, c.semester, lecturerId]
    );
  }

  const courseRows = (await client.query('SELECT id, code FROM courses')).rows;
  const courseMap = new Map(courseRows.map((r: any) => [r.code, r.id]));

  console.log('[PostgreSQL Seed] Enrolling all 30 students in courses...');
  const studentRows = (await client.query("SELECT id, name, email, matric_no FROM users WHERE role = 'student'")).rows;
  for (const s of studentRows) {
    for (const c of courseRows) {
      await client.query(
        `INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [s.id, c.id]
      );
    }
  }

  console.log('[PostgreSQL Seed] Setting up real complaint scenarios...');

  // Scenario 1: Mass Issue Cluster on CSC 301 (Missing Continuous Assessment scores for 25 students)
  const csc301Id = courseMap.get('CSC 301');
  const groupRes = await client.query(
    `INSERT INTO issue_groups (course_id, issue_type, title, status, created_at)
     VALUES ($1, 'MISSING_CA', 'CSC 301: Missing Continuous Assessment Scores (25 Students)', 'OPEN', NOW() - INTERVAL '3 days')
     RETURNING id`,
    [csc301Id]
  );
  const groupId = groupRes.rows[0].id;

  // First 25 students submit missing CA
  for (let i = 0; i < 25; i++) {
    const s = studentRows[i];
    const compRes = await client.query(
      `INSERT INTO complaints (student_id, course_id, description, overall_status, created_at, updated_at)
       VALUES ($1, $2, 'My Continuous Assessment (test + lab quiz) score of 26/30 was omitted from the published results sheet.', 'SUBMITTED', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
       RETURNING id`,
      [s.id, csc301Id]
    );
    const compId = compRes.rows[0].id;

    const itemRes = await client.query(
      `INSERT INTO complaint_items (complaint_id, issue_type, status, claimed_score, group_id, assigned_to_role, created_at)
       VALUES ($1, 'MISSING_CA', 'SUBMITTED', 26.0, $2, 'lecturer', NOW() - INTERVAL '3 days')
       RETURNING id`,
      [compId, groupId]
    );
    const itemId = itemRes.rows[0].id;

    await client.query(
      `INSERT INTO status_events (complaint_item_id, from_status, to_status, actor_id, note, created_at)
       VALUES ($1, 'NONE', 'SUBMITTED', $2, 'Complaint submitted by student. Clustered into CSC 301 Continuous Assessment group.', NOW() - INTERVAL '3 days')`,
      [itemId, s.id]
    );
  }

  // Scenario 2: Multi-issue complaint for Ayomide Balogun (CSC/2021/001) on CSC 303
  const csc303Id = courseMap.get('CSC 303');
  const ayomide = studentRows.find((s: any) => s.email === 'ayomide@oauife.edu.ng');
  const lecturer1Id = userMap.get('lecturer1@oauife.edu.ng');

  if (ayomide) {
    const ayoCompRes = await client.query(
      `INSERT INTO complaints (student_id, course_id, description, overall_status, created_at, updated_at)
       VALUES ($1, $2, 'Two distinct issues noted on my CSC 303 result: missing CA score and incorrect grading threshold.', 'IN PROGRESS (1 of 2 resolved)', NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day')
       RETURNING id`,
      [ayomide.id, csc303Id]
    );
    const ayoCompId = ayoCompRes.rows[0].id;

    // Item A: Missing CA -> Under Review
    const itemARes = await client.query(
      `INSERT INTO complaint_items (complaint_id, issue_type, status, claimed_score, assigned_to_role, created_at)
       VALUES ($1, 'MISSING_CA', 'UNDER_REVIEW', 28.0, 'lecturer', NOW() - INTERVAL '5 days')
       RETURNING id`,
      [ayoCompId]
    );
    const itemAId = itemARes.rows[0].id;

    await client.query(
      `INSERT INTO status_events (complaint_item_id, from_status, to_status, actor_id, note, created_at)
       VALUES ($1, 'NONE', 'SUBMITTED', $2, 'Submitted by student', NOW() - INTERVAL '5 days'),
              ($1, 'SUBMITTED', 'UNDER_REVIEW', $3, 'Lecturer reviewing original attendance register and lab records', NOW() - INTERVAL '2 days')`,
      [itemAId, ayomide.id, lecturer1Id]
    );

    // Item B: Wrong Grade -> Resolved
    const itemBRes = await client.query(
      `INSERT INTO complaint_items (complaint_id, issue_type, status, claimed_score, assigned_to_role, created_at)
       VALUES ($1, 'WRONG_GRADE', 'RESOLVED', 72.0, 'lecturer', NOW() - INTERVAL '5 days')
       RETURNING id`,
      [ayoCompId]
    );
    const itemBId = itemBRes.rows[0].id;

    await client.query(
      `INSERT INTO status_events (complaint_item_id, from_status, to_status, actor_id, note, created_at)
       VALUES ($1, 'NONE', 'SUBMITTED', $2, 'Submitted by student', NOW() - INTERVAL '5 days'),
              ($1, 'SUBMITTED', 'RESOLVED', $3, 'Score sheet reconciled: Grade updated from B (65) to A (72)', NOW() - INTERVAL '1 day')`,
      [itemBId, ayomide.id, lecturer1Id]
    );

    await client.query(
      `INSERT INTO notifications (user_id, message, complaint_id, created_at)
       VALUES ($1, 'Your complaint regarding CSC 303 (Incorrect Letter Grade) has been resolved by Dr. Folashade Babatunde. Grade updated from B (65) to A (72).', $2, NOW() - INTERVAL '1 day')`,
      [ayomide.id, ayoCompId]
    );
  }

  // Scenario 3: Dispute Rejection Escalated to HOD - Victor Ekanem (CSC/2021/026) on CSC 401
  const csc401Id = courseMap.get('CSC 401');
  const victor = studentRows.find((s: any) => s.email === 'victor@oauife.edu.ng');
  const lecturer2Id = userMap.get('lecturer2@oauife.edu.ng');
  const hodId = userMap.get('hod@oauife.edu.ng');

  if (victor) {
    const victorCompRes = await client.query(
      `INSERT INTO complaints (student_id, course_id, description, overall_status, created_at, updated_at)
       VALUES ($1, $2, 'Requesting physical script remark for CSC 401. Section B question 4 parser algorithm was not graded.', 'ESCALATED TO HOD (1 item)', NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days')
       RETURNING id`,
      [victor.id, csc401Id]
    );
    const victorCompId = victorCompRes.rows[0].id;

    const victorItemRes = await client.query(
      `INSERT INTO complaint_items (complaint_id, issue_type, status, claimed_score, assigned_to_role, reopened, reopen_count, created_at)
       VALUES ($1, 'SCRIPT_REMARK_REQUEST', 'ESCALATED', 75.0, 'hod', 1, 1, NOW() - INTERVAL '6 days')
       RETURNING id`,
      [victorCompId]
    );
    const victorItemId = victorItemRes.rows[0].id;

    await client.query(
      `INSERT INTO status_events (complaint_item_id, from_status, to_status, actor_id, note, created_at)
       VALUES ($1, 'NONE', 'SUBMITTED', $2, 'Student submitted script remark request', NOW() - INTERVAL '6 days'),
              ($1, 'SUBMITTED', 'REJECTED', $3, 'Initial remark review shows script grading matches marking scheme.', NOW() - INTERVAL '4 days'),
              ($1, 'REJECTED', 'ESCALATED', $2, 'Student disputed rejection (Dispute 1 of 1): Provided draft solution proving question 4 parser code was completely omitted by grader. Escalated to HOD.', NOW() - INTERVAL '2 days')`,
      [victorItemId, victor.id, lecturer2Id]
    );

    await client.query(
      `INSERT INTO notifications (user_id, message, complaint_id, created_at)
       VALUES ($1, 'Dispute Escalation: Student Victor Ekanem (CSC/2021/026) has appealed the rejection on CSC 401 (Script Remark Request). Transferred for Head of Department review.', $2, NOW() - INTERVAL '2 days')`,
      [hodId, victorCompId]
    );
  }

  // Scenario 4: Direct Unassigned Course Routing - Grace Anyanwu (CSC/2021/027) on CSC 415
  const csc415Id = courseMap.get('CSC 415');
  const grace = studentRows.find((s: any) => s.email === 'grace@oauife.edu.ng');

  if (grace) {
    const graceCompRes = await client.query(
      `INSERT INTO complaints (student_id, course_id, description, overall_status, created_at, updated_at)
       VALUES ($1, $2, 'CSC 415 CA score was awarded 0/30 instead of submitted project mark.', 'ESCALATED TO HOD (1 item)', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
       RETURNING id`,
      [grace.id, csc415Id]
    );
    const graceCompId = graceCompRes.rows[0].id;

    const graceItemRes = await client.query(
      `INSERT INTO complaint_items (complaint_id, issue_type, status, claimed_score, assigned_to_role, created_at)
       VALUES ($1, 'WRONG_SCORE', 'ESCALATED', 27.0, 'hod', NOW() - INTERVAL '2 days')
       RETURNING id`,
      [graceCompId]
    );
    const graceItemId = graceItemRes.rows[0].id;

    await client.query(
      `INSERT INTO status_events (complaint_item_id, from_status, to_status, actor_id, note, created_at)
       VALUES ($1, 'NONE', 'ESCALATED', $2, 'Course CSC 415 currently has no assigned lecturer. Automatically routed directly to Head of Department (HOD).', NOW() - INTERVAL '2 days')`,
      [graceItemId, grace.id]
    );

    await client.query(
      `INSERT INTO notifications (user_id, message, complaint_id, created_at)
       VALUES ($1, 'Unassigned Course Intake: New complaint submitted by Grace Anyanwu (CSC/2021/027) on CSC 415 (Incorrect Score Calculation). Direct routing to Head of Department.', $2, NOW() - INTERVAL '2 days')`,
      [hodId, graceCompId]
    );
  }

  console.log('[PostgreSQL Seed] PostgreSQL Database successfully populated!');
}

// Allow direct CLI execution: tsx server/seed.ts
if (process.argv[1]?.endsWith('seed.ts') || process.argv.some((a) => a.includes('seed.ts'))) {
  (async () => {
    const client = await getDb();
    try {
      await seedDatabase(client);
      console.log('[PostgreSQL Seed] Seeding complete.');
    } finally {
      await client.close();
      process.exit(0);
    }
  })().catch((err) => {
    console.error('[PostgreSQL Seed] Failed:', err);
    process.exit(1);
  });
}
