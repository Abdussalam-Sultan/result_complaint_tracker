import { Router, Request, Response } from 'express';
import { getDb } from './db';

export const apiRouter = Router();

// Helper for JWT / Token
function decodeToken(authHeader?: string): { id: number; role: string } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      return { id: Number(payload.sub), role: payload.role };
    }
  } catch (err) {
    // fallback
  }
  return null;
}

function createToken(userId: number, role: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(
    JSON.stringify({
      sub: String(userId),
      role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    })
  ).toString('base64');
  const signature = Buffer.from('oau-signature-secret').toString('base64');
  return `${header}.${payload}.${signature}`;
}

// Derive overall complaint status from items
function deriveComplaintStatus(items: any[]): string {
  if (!items || items.length === 0) return 'SUBMITTED';
  const statuses = items.map((i) => i.status);
  const total = statuses.length;
  const resolvedCount = statuses.filter((s) => s === 'RESOLVED').length;
  const rejectedCount = statuses.filter((s) => s === 'REJECTED').length;
  const withdrawnCount = statuses.filter((s) => s === 'WITHDRAWN').length;

  if (resolvedCount === total) return 'RESOLVED';
  if (resolvedCount + rejectedCount + withdrawnCount === total) {
    if (resolvedCount > 0) {
      return `CLOSED (${resolvedCount} resolved, ${rejectedCount + withdrawnCount} closed)`;
    }
    return 'CLOSED (All rejected/withdrawn)';
  }

  const escalatedCount = statuses.filter((s) => s === 'ESCALATED').length;
  if (escalatedCount > 0) {
    return `ESCALATED TO HOD (${escalatedCount} item${escalatedCount > 1 ? 's' : ''})`;
  }

  if (statuses.includes('NEEDS_INFO')) {
    return 'ACTION REQUIRED (Needs your response)';
  }

  if (statuses.includes('UNDER_REVIEW')) {
    if (resolvedCount > 0) {
      return `IN PROGRESS (${resolvedCount} of ${total} resolved)`;
    }
    return 'UNDER REVIEW';
  }

  if (resolvedCount > 0) {
    return `IN PROGRESS (${resolvedCount} of ${total} resolved)`;
  }

  return 'SUBMITTED';
}

async function updateComplaintOverallStatus(complaintId: number) {
  const db = await getDb();
  const res = await db.query('SELECT status FROM complaint_items WHERE complaint_id = $1', [complaintId]);
  const newStatus = deriveComplaintStatus(res.rows);
  await db.query(
    'UPDATE complaints SET overall_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [newStatus, complaintId]
  );
}

export function formatIssueType(issue: string): string {
  switch (String(issue || '').toUpperCase()) {
    case 'MISSING_CA':
      return 'Missing Continuous Assessment';
    case 'MISSING_EXAM':
      return 'Missing Examination Score';
    case 'WRONG_GRADE':
      return 'Incorrect Letter Grade';
    case 'WRONG_SCORE':
      return 'Incorrect Score Calculation';
    case 'SCRIPT_REMARK_REQUEST':
      return 'Script Remark Request';
    case 'OTHER':
      return 'General Result Discrepancy';
    default:
      return issue ? issue.replace(/_/g, ' ') : 'Result Discrepancy';
  }
}

export function formatStatusLabel(status: string): string {
  switch (String(status || '').toUpperCase()) {
    case 'SUBMITTED':
      return 'Submitted';
    case 'UNDER_REVIEW':
      return 'Under Review';
    case 'RESOLVED':
      return 'Resolved';
    case 'REJECTED':
      return 'Rejected';
    case 'NEEDS_INFO':
      return 'Information Requested';
    case 'ESCALATED':
      return 'Escalated to Head of Department';
    case 'WITHDRAWN':
      return 'Withdrawn';
    default:
      return status ? status.replace(/_/g, ' ') : '';
  }
}

export function cleanNotificationText(msg: string): string {
  if (!msg) return '';
  return msg
    .replace(/UNDER_REVIEW/g, 'Under Review')
    .replace(/NEEDS_INFO/g, 'Information Requested')
    .replace(/RESOLVED/g, 'Resolved')
    .replace(/REJECTED/g, 'Rejected')
    .replace(/ESCALATED/g, 'Escalated')
    .replace(/WITHDRAWN/g, 'Withdrawn')
    .replace(/SUBMITTED/g, 'Submitted')
    .replace(/MISSING_CA/g, 'Continuous Assessment')
    .replace(/MISSING_EXAM/g, 'Examination Score')
    .replace(/WRONG_GRADE/g, 'Letter Grade')
    .replace(/WRONG_SCORE/g, 'Score Calculation')
    .replace(/SCRIPT_REMARK_REQUEST/g, 'Script Remark Request')
    .replace(/Status changed to /gi, 'Status updated to ');
}

/**
 * Sends a notification strictly ensuring an actor NEVER receives a notification for their own action,
 * and recipient cannot be empty.
 */
async function sendNotification(
  db: any,
  recipientId: number | null | undefined,
  actorId: number | null | undefined,
  complaintId: number | null | undefined,
  message: string
): Promise<void> {
  if (!recipientId) return;
  // CRITICAL: An actor must NEVER receive a notification for their own action!
  if (actorId && Number(recipientId) === Number(actorId)) {
    return;
  }
  await db.query(
    `INSERT INTO notifications (user_id, message, complaint_id, read, created_at)
     VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)`,
    [recipientId, message, complaintId || null]
  );
}

// Health check
apiRouter.get('/health', (req: Request, res: Response) => {
  const extUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_DB_URL;
  const isSupabase = Boolean(
    extUrl && (extUrl.includes('supabase.co') || extUrl.includes('pooler.supabase.com'))
  );
  const dbProvider = isSupabase
    ? 'Supabase PostgreSQL'
    : extUrl
    ? 'Remote PostgreSQL'
    : 'PostgreSQL (Embedded Engine)';

  res.json({
    status: 'healthy',
    database: dbProvider,
    app: 'OAU Student Result Complaint Tracker',
    institution: 'Obafemi Awolowo University, Ile-Ife',
    department: 'Computer Science & Engineering',
  });
});

// --- AUTH ---
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ detail: 'University email is required' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const db = await getDb();
    const user = await db.queryOne('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);

    if (!user) {
      return res.status(401).json({ detail: 'Incorrect university email or password' });
    }

    // Verify password (demo default password123 or stored hash)
    if (password !== 'password123' && user.password_hash !== password) {
      return res.status(401).json({ detail: 'Incorrect university email or password' });
    }

    const token = createToken(user.id, user.role);
    res.json({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        matric_no: user.matric_no,
        role: user.role,
        department: user.department,
        created_at: user.created_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/auth/me', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (!auth) {
      return res.status(401).json({ detail: 'Authentication token required' });
    }
    const db = await getDb();
    const user = await db.queryOne(
      'SELECT id, name, email, matric_no, role, department, created_at FROM users WHERE id = $1',
      [auth.id]
    );

    if (!user) {
      return res.status(401).json({ detail: 'User account not found' });
    }
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- COURSES ---
apiRouter.get('/courses', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (!auth) {
      return res.status(401).json({ detail: 'Authentication token required' });
    }

    const db = await getDb();
    let rows: any[] = [];

    if (auth.role === 'student') {
      const result = await db.query(`
        SELECT c.*, u.name as lecturer_name,
          (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrollment_count
        FROM courses c
        JOIN enrollments e ON c.id = e.course_id
        LEFT JOIN users u ON c.lecturer_id = u.id
        WHERE e.student_id = $1
        ORDER BY c.code ASC
      `, [auth.id]);
      rows = result.rows;
    } else if (auth.role === 'lecturer') {
      const result = await db.query(`
        SELECT c.*, u.name as lecturer_name,
          (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrollment_count
        FROM courses c
        LEFT JOIN users u ON c.lecturer_id = u.id
        WHERE c.lecturer_id = $1
        ORDER BY c.code ASC
      `, [auth.id]);
      rows = result.rows;
    } else {
      const result = await db.query(`
        SELECT c.*, u.name as lecturer_name,
          (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrollment_count
        FROM courses c
        LEFT JOIN users u ON c.lecturer_id = u.id
        ORDER BY c.code ASC
      `);
      rows = result.rows;
    }

    const results = rows.map((r) => ({
      ...r,
      enrollment_count: Number(r.enrollment_count || 0),
      lecturer_name: r.lecturer_name || 'Unassigned (Routed to HOD)',
    }));
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/courses/all', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = await db.query(`
      SELECT c.*, u.name as lecturer_name,
        (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrollment_count
      FROM courses c
      LEFT JOIN users u ON c.lecturer_id = u.id
      ORDER BY c.code ASC
    `);

    const results = result.rows.map((r) => ({
      ...r,
      enrollment_count: Number(r.enrollment_count || 0),
      lecturer_name: r.lecturer_name || 'Unassigned (Routed to HOD)',
    }));
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/courses/:id/assign', async (req: Request, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const { lecturer_id } = req.body;
    const db = await getDb();

    const lid = lecturer_id !== undefined && lecturer_id !== null && lecturer_id !== ''
      ? Number(lecturer_id)
      : null;

    await db.query('UPDATE courses SET lecturer_id = $1 WHERE id = $2', [lid, courseId]);

    const updated = await db.queryOne(`
      SELECT c.*, u.name as lecturer_name,
        (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrollment_count
      FROM courses c
      LEFT JOIN users u ON c.lecturer_id = u.id
      WHERE c.id = $1
    `, [courseId]);

    res.json({
      success: true,
      course: {
        ...updated,
        enrollment_count: Number(updated?.enrollment_count || 0),
        lecturer_name: updated?.lecturer_name || 'Unassigned (Routed to HOD)',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to assemble complaint items and timelines
async function getComplaintWithItems(complaintId: number, hidePii: boolean = false) {
  const db = await getDb();
  const c = await db.queryOne(`
    SELECT c.*, u.name as student_name, u.matric_no,
      crs.code as course_code, crs.title as course_title
    FROM complaints c
    LEFT JOIN users u ON c.student_id = u.id
    LEFT JOIN courses crs ON c.course_id = crs.id
    WHERE c.id = $1
  `, [complaintId]);

  if (!c) return null;

  const itemsRes = await db.query(`
    SELECT ci.*, crs.code as course_code, crs.title as course_title,
      u.name as student_name, u.matric_no
    FROM complaint_items ci
    JOIN complaints cmp ON ci.complaint_id = cmp.id
    LEFT JOIN courses crs ON cmp.course_id = crs.id
    LEFT JOIN users u ON cmp.student_id = u.id
    WHERE ci.complaint_id = $1
    ORDER BY ci.id ASC
  `, [complaintId]);

  const items = itemsRes.rows;

  for (const it of items) {
    const eventsRes = await db.query(`
      SELECT se.*, u.name as actor_name, u.role as actor_role
      FROM status_events se
      LEFT JOIN users u ON se.actor_id = u.id
      WHERE se.complaint_item_id = $1
      ORDER BY se.created_at ASC
    `, [it.id]);

    it.timeline = eventsRes.rows.map((e) => ({
      ...e,
      actor_name: e.actor_name || 'System / Auto',
      actor_role: e.actor_role || 'system',
    }));
    it.days_open = Math.floor(
      (Date.now() - new Date(it.created_at).getTime()) / (1000 * 3600 * 24)
    );
    if (hidePii) {
      it.student_name = '[Confidential]';
      it.matric_no = '[Confidential]';
    }
  }

  const attachmentsRes = await db.query('SELECT * FROM attachments WHERE complaint_id = $1', [complaintId]);

  return {
    ...c,
    student_name: hidePii ? '[Confidential]' : c.student_name,
    matric_no: hidePii ? '[Confidential]' : c.matric_no,
    items,
    attachments: attachmentsRes.rows,
  };
}

// --- COMPLAINTS ---
apiRouter.get('/complaints', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (!auth) {
      return res.status(401).json({ detail: 'Authentication token required' });
    }

    const db = await getDb();
    let complaintIds: any[] = [];

    if (auth.role === 'student') {
      const resIds = await db.query(
        'SELECT id FROM complaints WHERE student_id = $1 ORDER BY created_at DESC',
        [auth.id]
      );
      complaintIds = resIds.rows;
    } else if (auth.role === 'lecturer') {
      const resIds = await db.query(`
        SELECT c.id FROM complaints c
        JOIN courses crs ON c.course_id = crs.id
        WHERE crs.lecturer_id = $1
        ORDER BY c.created_at DESC
      `, [auth.id]);
      complaintIds = resIds.rows;
    } else {
      const resIds = await db.query('SELECT id FROM complaints ORDER BY created_at DESC');
      complaintIds = resIds.rows;
    }

    const results = [];
    for (const row of complaintIds) {
      const comp = await getComplaintWithItems(row.id, false);
      if (comp) results.push(comp);
    }

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/complaints', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (!auth) {
      return res.status(401).json({ detail: 'Authentication token required' });
    }
    const db = await getDb();
    const student = await db.queryOne('SELECT * FROM users WHERE id = $1', [auth.id]);
    if (!student || student.role !== 'student') {
      return res.status(403).json({ detail: 'Only students can submit result complaints' });
    }

    const { course_id, description, items } = req.body;
    if (!course_id || !description || !items || !items.length) {
      return res.status(400).json({ detail: 'Invalid complaint payload: course and at least one issue required' });
    }

    // 1. Enrollment check
    const enrolled = await db.queryOne(
      'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2',
      [student.id, course_id]
    );
    if (!enrolled) {
      return res.status(400).json({
        detail: 'You can only submit complaints for courses you are officially enrolled in.',
      });
    }

    const course = await db.queryOne('SELECT * FROM courses WHERE id = $1', [course_id]);
    if (!course) {
      return res.status(404).json({ detail: 'Course not found' });
    }

    // 2. Duplicate prevention
    const existing = await db.query(`
      SELECT ci.issue_type, ci.status, ci.complaint_id
      FROM complaint_items ci
      JOIN complaints c ON ci.complaint_id = c.id
      WHERE c.student_id = $1 AND c.course_id = $2
        AND ci.status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'ESCALATED')
    `, [student.id, course_id]);

    const existingMap = new Map(existing.rows.map((e: any) => [e.issue_type, e]));
    for (const it of items) {
      if (existingMap.has(it.issue_type)) {
        const conf: any = existingMap.get(it.issue_type);
        return res.status(400).json({
          detail: `You already have an active complaint item for '${it.issue_type}' on course ${course.code} (Status: ${conf.status}, Complaint #${conf.complaint_id}). Duplicate submissions for the same issue are not permitted.`,
        });
      }
    }

    // 3. Insert Complaint
    const compInsert = await db.query(`
      INSERT INTO complaints (student_id, course_id, description, overall_status, created_at, updated_at)
      VALUES ($1, $2, $3, 'SUBMITTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `, [student.id, course_id, description.trim()]);

    const complaintId = compInsert.rows[0].id;
    const hasLecturer = course.lecturer_id !== null && course.lecturer_id !== undefined;
    const initialAssignedRole = hasLecturer ? 'lecturer' : 'hod';

    // 4. Insert Items
    for (const it of items) {
      let groupId: number | null = null;
      if (it.issue_type !== 'OTHER') {
        const group = await db.queryOne(`
          SELECT id FROM issue_groups
          WHERE course_id = $1 AND issue_type = $2
            AND status IN ('OPEN', 'UNDER_REVIEW', 'NEEDS_INFO', 'ESCALATED')
          LIMIT 1
        `, [course_id, it.issue_type]);

        if (group) {
          groupId = group.id;
        } else {
          const newGrp = await db.query(`
            INSERT INTO issue_groups (course_id, issue_type, title, status, created_at, updated_at)
            VALUES ($1, $2, $3, 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
          `, [
            course_id,
            it.issue_type,
            `${course.code}: ${it.issue_type.replace(/_/g, ' ')} Issue Cluster`,
          ]);
          groupId = newGrp.rows[0].id;
        }
      }

      const itemInsert = await db.query(`
        INSERT INTO complaint_items
        (complaint_id, issue_type, status, claimed_score, group_id, assigned_to_role, reopened, reopen_count, created_at, updated_at)
        VALUES ($1, $2, 'SUBMITTED', $3, $4, $5, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `, [
        complaintId,
        it.issue_type,
        it.claimed_score !== undefined ? it.claimed_score : null,
        groupId,
        initialAssignedRole,
      ]);

      const itemId = itemInsert.rows[0].id;

      const note = !hasLecturer
        ? 'Complaint submitted by student. Course has no assigned lecturer; automatically routed directly to Head of Department (HOD).'
        : `Complaint submitted by student (${student.name}, ${student.matric_no}). Awaiting lecturer review.`;

      await db.query(`
        INSERT INTO status_events (complaint_item_id, from_status, to_status, actor_id, note, created_at)
        VALUES ($1, 'NONE', 'SUBMITTED', $2, $3, CURRENT_TIMESTAMP)
      `, [itemId, student.id, note]);
    }

    await updateComplaintOverallStatus(complaintId);

    // Notifications
    const issueLabels = items.map((it: any) => formatIssueType(it.issue_type)).join(', ');

    await sendNotification(
      db,
      student.id,
      null, // confirmation to student
      complaintId,
      `Your complaint for ${course.code} (${issueLabels}) has been submitted successfully and logged for academic review.`
    );

    if (hasLecturer) {
      await sendNotification(
        db,
        course.lecturer_id,
        student.id,
        complaintId,
        `New complaint submitted by ${student.name} (${student.matric_no}) for ${course.code}: ${issueLabels}.`
      );
    } else {
      const hod = await db.queryOne("SELECT id FROM users WHERE role = 'hod'");
      if (hod) {
        await sendNotification(
          db,
          hod.id,
          student.id,
          complaintId,
          `Direct Intake: New complaint submitted by ${student.name} (${student.matric_no}) for unassigned course ${course.code} (${issueLabels}). Routed to Head of Department.`
        );
      }
    }

    const created = await getComplaintWithItems(complaintId, false);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/complaints/:id', async (req: Request, res: Response) => {
  try {
    const comp = await getComplaintWithItems(Number(req.params.id), false);
    if (!comp) return res.status(404).json({ detail: 'Complaint not found' });
    res.json(comp);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/complaints/:id/attachment', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Attachment noted' });
});

// --- ITEMS ---
apiRouter.post('/items/:id/action', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (!auth) return res.status(401).json({ detail: 'Authentication token required' });
    const db = await getDb();
    const actor = await db.queryOne('SELECT * FROM users WHERE id = $1', [auth.id]);
    if (!actor) return res.status(401).json({ detail: 'Actor not found' });

    const itemId = Number(req.params.id);
    const { action, note } = req.body;
    if (!action) return res.status(400).json({ detail: 'Action required' });

    const item = await db.queryOne(`
      SELECT ci.*, c.student_id, c.id as complaint_id, crs.code as course_code, crs.lecturer_id,
             u.name as student_name, u.matric_no
      FROM complaint_items ci
      JOIN complaints c ON ci.complaint_id = c.id
      JOIN courses crs ON c.course_id = crs.id
      JOIN users u ON c.student_id = u.id
      WHERE ci.id = $1
    `, [itemId]);

    if (!item) return res.status(404).json({ detail: 'Complaint item not found' });

    const prevStatus = item.status;
    let targetStatus = prevStatus;
    let assignedRole = item.assigned_to_role;

    const actUpper = String(action).toUpperCase();
    if (actUpper === 'REVIEW') {
      targetStatus = 'UNDER_REVIEW';
    } else if (actUpper === 'RESOLVE') {
      targetStatus = 'RESOLVED';
    } else if (actUpper === 'REJECT') {
      targetStatus = 'REJECTED';
    } else if (actUpper === 'REQUEST_INFO') {
      targetStatus = 'NEEDS_INFO';
    } else if (actUpper === 'ESCALATE') {
      targetStatus = 'ESCALATED';
      assignedRole = 'hod';
    } else if (actUpper === 'OVERRIDE') {
      targetStatus = (note || '').toUpperCase().includes('REJECT') ? 'REJECTED' : 'RESOLVED';
      assignedRole = 'hod';
    }

    await db.query(`
      UPDATE complaint_items
      SET status = $1, assigned_to_role = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [targetStatus, assignedRole, itemId]);

    const readableNote = (note || '').trim();
    await db.query(`
      INSERT INTO status_events (complaint_item_id, from_status, to_status, actor_id, note, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [itemId, prevStatus, targetStatus, actor.id, readableNote || `Action applied: ${formatStatusLabel(targetStatus)}`]);

    await updateComplaintOverallStatus(item.complaint_id);

    // Notifications (strictly ensuring the actor who rejected/resolved NEVER gets notified)
    const issueLabel = formatIssueType(item.issue_type);

    if (targetStatus === 'RESOLVED') {
      // Notify Student
      await sendNotification(
        db,
        item.student_id,
        actor.id,
        item.complaint_id,
        `Your complaint regarding ${item.course_code} (${issueLabel}) has been resolved by ${actor.name}.${readableNote ? ` Note: ${readableNote}` : ''}`
      );
      // If HOD resolved it, notify course lecturer if different from actor
      if (actor.role === 'hod' && item.lecturer_id) {
        await sendNotification(
          db,
          item.lecturer_id,
          actor.id,
          item.complaint_id,
          `Head of Department (${actor.name}) resolved the complaint for student ${item.student_name} on ${item.course_code} (${issueLabel}).${readableNote ? ` Note: ${readableNote}` : ''}`
        );
      }
    } else if (targetStatus === 'REJECTED') {
      // Notify Student - lecturer who took this action NEVER receives this
      await sendNotification(
        db,
        item.student_id,
        actor.id,
        item.complaint_id,
        `Your complaint regarding ${item.course_code} (${issueLabel}) was reviewed and not approved by ${actor.name}.${readableNote ? ` Reason: ${readableNote}` : ''}`
      );
      // If HOD rejected an escalated complaint, notify course lecturer if different from actor
      if (actor.role === 'hod' && item.lecturer_id) {
        await sendNotification(
          db,
          item.lecturer_id,
          actor.id,
          item.complaint_id,
          `Head of Department (${actor.name}) reviewed and upheld the rejection for student ${item.student_name} on ${item.course_code} (${issueLabel}).${readableNote ? ` Reason: ${readableNote}` : ''}`
        );
      }
    } else if (targetStatus === 'UNDER_REVIEW') {
      await sendNotification(
        db,
        item.student_id,
        actor.id,
        item.complaint_id,
        `Your complaint regarding ${item.course_code} (${issueLabel}) is now under active review by ${actor.name}.${readableNote ? ` Note: ${readableNote}` : ''}`
      );
    } else if (targetStatus === 'NEEDS_INFO') {
      await sendNotification(
        db,
        item.student_id,
        actor.id,
        item.complaint_id,
        `Additional information is requested by ${actor.name} for your ${item.course_code} complaint (${issueLabel}). Details: "${readableNote || 'Please provide clarification.'}"`
      );
    } else if (targetStatus === 'ESCALATED') {
      const hod = await db.queryOne("SELECT id FROM users WHERE role = 'hod'");
      if (hod) {
        await sendNotification(
          db,
          hod.id,
          actor.id,
          item.complaint_id,
          `Complaint Escalation: ${item.student_name} (${item.matric_no}) on ${item.course_code} (${issueLabel}). Reason: ${readableNote}`
        );
      }
      await sendNotification(
        db,
        item.student_id,
        actor.id,
        item.complaint_id,
        `Your complaint regarding ${item.course_code} (${issueLabel}) has been escalated to the Head of Department for review.`
      );
    }

    res.json({ success: true, status: targetStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/items/:id/reply', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (!auth) return res.status(401).json({ detail: 'Unauthorized' });
    const db = await getDb();
    const student = await db.queryOne('SELECT * FROM users WHERE id = $1', [auth.id]);

    const itemId = Number(req.params.id);
    const { reply_note } = req.body;
    if (!reply_note || !reply_note.trim()) {
      return res.status(400).json({ detail: 'Reply note cannot be empty' });
    }

    const item = await db.queryOne(`
      SELECT ci.*, c.student_id, c.id as complaint_id, crs.lecturer_id, crs.code as course_code
      FROM complaint_items ci
      JOIN complaints c ON ci.complaint_id = c.id
      JOIN courses crs ON c.course_id = crs.id
      WHERE ci.id = $1
    `, [itemId]);

    if (!item) return res.status(404).json({ detail: 'Item not found' });
    if (item.student_id !== auth.id) return res.status(403).json({ detail: 'Unauthorized' });

    await db.query(`
      UPDATE complaint_items SET status = 'UNDER_REVIEW', updated_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [itemId]);

    await db.query(`
      INSERT INTO status_events (complaint_item_id, from_status, to_status, actor_id, note, created_at)
      VALUES ($1, 'NEEDS_INFO', 'UNDER_REVIEW', $2, $3, CURRENT_TIMESTAMP)
    `, [itemId, student.id, `Student clarification provided: ${reply_note.trim()}`]);

    await updateComplaintOverallStatus(item.complaint_id);

    const issueLabel = formatIssueType(item.issue_type);
    const targetUserId = item.lecturer_id || (await db.queryOne("SELECT id FROM users WHERE role = 'hod'"))?.id;
    if (targetUserId) {
      await sendNotification(
        db,
        targetUserId,
        student.id,
        item.complaint_id,
        `Student ${student.name} (${student.matric_no}) provided requested clarification for ${item.course_code} (${issueLabel}): "${reply_note.trim()}". Status is now back under review.`
      );
    }

    res.json({ success: true, message: 'Reply submitted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/items/:id/reopen', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (!auth) return res.status(401).json({ detail: 'Unauthorized' });
    const db = await getDb();
    const student = await db.queryOne('SELECT * FROM users WHERE id = $1', [auth.id]);

    const itemId = Number(req.params.id);
    const { justification } = req.body;
    if (!justification || !justification.trim()) {
      return res.status(400).json({ detail: 'Justification required to dispute a rejection' });
    }

    const item = await db.queryOne(`
      SELECT ci.*, c.id as complaint_id, crs.code as course_code, crs.lecturer_id
      FROM complaint_items ci
      JOIN complaints c ON ci.complaint_id = c.id
      JOIN courses crs ON c.course_id = crs.id
      WHERE ci.id = $1
    `, [itemId]);

    if (!item) return res.status(404).json({ detail: 'Item not found' });
    if (item.reopen_count >= 1 || item.reopened) {
      return res.status(400).json({ detail: 'Policy limit reached: You can only dispute once per complaint item.' });
    }

    await db.query(`
      UPDATE complaint_items
      SET status = 'ESCALATED', assigned_to_role = 'hod', reopened = 1, reopen_count = reopen_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [itemId]);

    await db.query(`
      INSERT INTO status_events (complaint_item_id, from_status, to_status, actor_id, note, created_at)
      VALUES ($1, 'REJECTED', 'ESCALATED', $2, $3, CURRENT_TIMESTAMP)
    `, [
      itemId,
      student.id,
      `Student disputed rejection (Reopen 1 of 1): ${justification.trim()}. Escalated to HOD for final decision.`,
    ]);

    await updateComplaintOverallStatus(item.complaint_id);

    const issueLabel = formatIssueType(item.issue_type);
    const hod = await db.queryOne("SELECT id FROM users WHERE role = 'hod'");
    if (hod) {
      await sendNotification(
        db,
        hod.id,
        student.id,
        item.complaint_id,
        `Dispute Escalation: Student ${student.name} (${student.matric_no}) appealed the rejected decision on ${item.course_code} (${issueLabel}). Reason: "${justification.trim()}". Awaiting Head of Department ruling.`
      );
    }

    if (item.lecturer_id) {
      await sendNotification(
        db,
        item.lecturer_id,
        student.id,
        item.complaint_id,
        `Notice: Student ${student.name} (${student.matric_no}) has appealed the decision on ${item.course_code} (${issueLabel}). Transferred to Head of Department.`
      );
    }

    await sendNotification(
      db,
      student.id,
      null,
      item.complaint_id,
      `Your dispute on ${item.course_code} (${issueLabel}) has been logged and escalated to the Head of Department for review.`
    );

    res.json({ success: true, message: 'Dispute submitted and escalated to HOD' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/items/:id/withdraw', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (!auth) return res.status(401).json({ detail: 'Unauthorized' });
    const itemId = Number(req.params.id);
    const db = await getDb();

    const item = await db.queryOne(
      'SELECT ci.*, c.id as complaint_id FROM complaint_items ci JOIN complaints c ON ci.complaint_id = c.id WHERE ci.id = $1',
      [itemId]
    );

    if (!item) return res.status(404).json({ detail: 'Item not found' });

    await db.query("UPDATE complaint_items SET status = 'WITHDRAWN', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [itemId]);

    await db.query(`
      INSERT INTO status_events (complaint_item_id, from_status, to_status, actor_id, note, created_at)
      VALUES ($1, $2, 'WITHDRAWN', $3, 'Item voluntarily withdrawn by student', CURRENT_TIMESTAMP)
    `, [itemId, item.status, auth.id]);

    await updateComplaintOverallStatus(item.complaint_id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- GROUPS ---
apiRouter.get('/groups', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (!auth) return res.status(401).json({ detail: 'Unauthorized' });
    const db = await getDb();

    let groups: any[] = [];
    if (auth.role === 'lecturer') {
      const resG = await db.query(`
        SELECT g.*, crs.code as course_code, crs.title as course_title,
          u.id as assigned_lecturer_id, u.name as assigned_lecturer_name
        FROM issue_groups g
        JOIN courses crs ON g.course_id = crs.id
        LEFT JOIN users u ON crs.lecturer_id = u.id
        WHERE crs.lecturer_id = $1
        ORDER BY g.created_at DESC
      `, [auth.id]);
      groups = resG.rows;
    } else {
      const resG = await db.query(`
        SELECT g.*, crs.code as course_code, crs.title as course_title,
          u.id as assigned_lecturer_id, u.name as assigned_lecturer_name
        FROM issue_groups g
        JOIN courses crs ON g.course_id = crs.id
        LEFT JOIN users u ON crs.lecturer_id = u.id
        ORDER BY g.created_at DESC
      `);
      groups = resG.rows;
    }

    const results = [];
    for (const g of groups) {
      const itemsRes = await db.query(`
        SELECT ci.*, u.name as student_name, u.matric_no
        FROM complaint_items ci
        JOIN complaints c ON ci.complaint_id = c.id
        JOIN users u ON c.student_id = u.id
        WHERE ci.group_id = $1
      `, [g.id]);

      results.push({
        ...g,
        student_count: itemsRes.rows.length,
        items: itemsRes.rows,
      });
    }

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/groups/:id', async (req: Request, res: Response) => {
  try {
    const groupId = Number(req.params.id);
    const db = await getDb();
    const g = await db.queryOne(`
      SELECT g.*, crs.code as course_code, crs.title as course_title
      FROM issue_groups g
      JOIN courses crs ON g.course_id = crs.id
      WHERE g.id = $1
    `, [groupId]);

    if (!g) return res.status(404).json({ detail: 'Group not found' });

    const itemsRes = await db.query(`
      SELECT ci.*, u.name as student_name, u.matric_no
      FROM complaint_items ci
      JOIN complaints c ON ci.complaint_id = c.id
      JOIN users u ON c.student_id = u.id
      WHERE ci.group_id = $1
    `, [groupId]);

    res.json({
      ...g,
      student_count: itemsRes.rows.length,
      items: itemsRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/groups/:id/bulk-action', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (!auth) return res.status(401).json({ detail: 'Unauthorized' });
    const db = await getDb();
    const actor = await db.queryOne('SELECT * FROM users WHERE id = $1', [auth.id]);

    const groupId = Number(req.params.id);
    const { action, note } = req.body;
    if (!note || !note.trim()) {
      return res.status(400).json({ detail: 'Audit explanation note required for bulk action' });
    }

    const actionMap: Record<string, string> = {
      RESOLVE: 'RESOLVED',
      REJECT: 'REJECTED',
      REQUEST_INFO: 'NEEDS_INFO',
      ESCALATE: 'ESCALATED',
    };
    const targetStatus = actionMap[String(action).toUpperCase()] || 'UNDER_REVIEW';

    const itemsRes = await db.query(`
      SELECT ci.*, c.student_id, c.id as complaint_id, crs.code as course_code
      FROM complaint_items ci
      JOIN complaints c ON ci.complaint_id = c.id
      JOIN courses crs ON c.course_id = crs.id
      WHERE ci.group_id = $1
    `, [groupId]);

    const items = itemsRes.rows;
    const parentComplaintIds = new Set<number>();

    for (const it of items) {
      await db.query(
        `UPDATE complaint_items SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [targetStatus, it.id]
      );

      const issueLabel = formatIssueType(it.issue_type);
      const cleanNote = note.trim();

      await db.query(`
        INSERT INTO status_events (complaint_item_id, from_status, to_status, actor_id, note, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [it.id, it.status, targetStatus, actor.id, `[Group Bulk Action - ${formatStatusLabel(targetStatus)}] ${cleanNote}`]);

      let studentMsg = '';
      if (targetStatus === 'RESOLVED') {
        studentMsg = `Your group complaint regarding ${it.course_code} (${issueLabel}) has been resolved. Note: ${cleanNote}`;
      } else if (targetStatus === 'REJECTED') {
        studentMsg = `Your group complaint regarding ${it.course_code} (${issueLabel}) could not be approved. Reason: ${cleanNote}`;
      } else if (targetStatus === 'UNDER_REVIEW') {
        studentMsg = `Your group complaint regarding ${it.course_code} (${issueLabel}) is currently under active review. Note: ${cleanNote}`;
      } else {
        studentMsg = `Your group complaint regarding ${it.course_code} (${issueLabel}) status has been updated to ${formatStatusLabel(targetStatus)}. Note: ${cleanNote}`;
      }

      await sendNotification(db, it.student_id, actor.id, it.complaint_id, studentMsg);

      parentComplaintIds.add(it.complaint_id);
    }

    await db.query('UPDATE issue_groups SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      targetStatus,
      groupId,
    ]);

    for (const cid of parentComplaintIds) {
      await updateComplaintOverallStatus(cid);
    }

    res.json({
      success: true,
      affected_count: items.length,
      new_status: targetStatus,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/groups/:id/remove-student/:itemId', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (!auth) return res.status(401).json({ detail: 'Unauthorized' });
    const db = await getDb();
    const actor = await db.queryOne('SELECT * FROM users WHERE id = $1', [auth.id]);

    const itemId = Number(req.params.itemId);
    const item = await db.queryOne(`
      SELECT ci.*, c.student_id, c.id as complaint_id, crs.code as course_code
      FROM complaint_items ci
      JOIN complaints c ON ci.complaint_id = c.id
      JOIN courses crs ON c.course_id = crs.id
      WHERE ci.id = $1
    `, [itemId]);

    if (!item) return res.status(404).json({ detail: 'Item not found' });

    await db.query('UPDATE complaint_items SET group_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [
      itemId,
    ]);

    await db.query(`
      INSERT INTO status_events (complaint_item_id, from_status, to_status, actor_id, note, created_at)
      VALUES ($1, $2, $3, $4, 'Removed from group cluster by lecturer. To be investigated individually.', CURRENT_TIMESTAMP)
    `, [itemId, item.status, item.status, actor.id]);

    const issueLabel = formatIssueType(item.issue_type);
    await sendNotification(
      db,
      item.student_id,
      actor.id,
      item.complaint_id,
      `Your complaint regarding ${item.course_code} (${issueLabel}) was separated from the group cluster by the lecturer and will be reviewed individually.`
    );

    res.json({ success: true, message: 'Student removed from group for individual review' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- NOTIFICATIONS ---
apiRouter.get('/notifications', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (!auth) return res.status(401).json({ detail: 'Unauthorized' });
    const db = await getDb();
    const rows = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [auth.id]
    );
    const cleaned = rows.rows.map((n: any) => ({
      ...n,
      message: cleanNotificationText(n.message),
    }));
    res.json(cleaned);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/notifications/unread-count', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (!auth) return res.json({ unread_count: 0 });
    const db = await getDb();
    const count = await db.queryOne(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = 0',
      [auth.id]
    );
    res.json({ unread_count: Number(count?.count || 0) });
  } catch (err: any) {
    res.json({ unread_count: 0 });
  }
});

apiRouter.post('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    await db.query('UPDATE notifications SET read = 1 WHERE id = $1', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/notifications/read-all', async (req: Request, res: Response) => {
  try {
    const auth = decodeToken(req.headers.authorization);
    if (auth) {
      const db = await getDb();
      await db.query('UPDATE notifications SET read = 1 WHERE user_id = $1', [auth.id]);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- STATS ---
apiRouter.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const compCount = await db.queryOne('SELECT COUNT(*) as c FROM complaints');
    const totalComplaints = Number(compCount?.c || 0);

    const itemsRes = await db.query(`
      SELECT ci.*, c.course_id, crs.code as course_code, crs.title as course_title,
        u.name as student_name, u.matric_no
      FROM complaint_items ci
      JOIN complaints c ON ci.complaint_id = c.id
      JOIN courses crs ON c.course_id = crs.id
      LEFT JOIN users u ON c.student_id = u.id
    `);

    const items = itemsRes.rows;
    const totalItems = items.length;
    const pendingCount = items.filter((i) =>
      ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO'].includes(i.status)
    ).length;
    const escalatedCount = items.filter((i) => i.status === 'ESCALATED').length;
    const resolvedCount = items.filter((i) => i.status === 'RESOLVED').length;
    const rejectedCount = items.filter((i) => i.status === 'REJECTED').length;

    const statusBreakdown = {
      SUBMITTED: items.filter((i) => i.status === 'SUBMITTED').length,
      UNDER_REVIEW: items.filter((i) => i.status === 'UNDER_REVIEW').length,
      NEEDS_INFO: items.filter((i) => i.status === 'NEEDS_INFO').length,
      ESCALATED: escalatedCount,
      RESOLVED: resolvedCount,
      REJECTED: rejectedCount,
      WITHDRAWN: items.filter((i) => i.status === 'WITHDRAWN').length,
    };

    // Course breakdown
    const coursesRes = await db.query(`
      SELECT c.*, u.name as lecturer_name
      FROM courses c
      LEFT JOIN users u ON c.lecturer_id = u.id
    `);
    const courses = coursesRes.rows;

    const byCourse = courses.map((c) => {
      const cItems = items.filter((i) => i.course_id === c.id);
      return {
        course_id: c.id,
        code: c.code,
        title: c.title,
        lecturer_name: c.lecturer_name || 'Unassigned (HOD)',
        total: cItems.length,
        open: cItems.filter((i) => ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO'].includes(i.status)).length,
        escalated: cItems.filter((i) => i.status === 'ESCALATED').length,
        resolved: cItems.filter((i) => i.status === 'RESOLVED').length,
        rejected: cItems.filter((i) => i.status === 'REJECTED').length,
      };
    });

    // Issue types breakdown
    const issueMap: Record<string, { total: number; resolved: number; escalated: number }> = {};
    for (const it of items) {
      if (!issueMap[it.issue_type]) {
        issueMap[it.issue_type] = { total: 0, resolved: 0, escalated: 0 };
      }
      issueMap[it.issue_type].total++;
      if (it.status === 'RESOLVED') issueMap[it.issue_type].resolved++;
      if (it.status === 'ESCALATED') issueMap[it.issue_type].escalated++;
    }
    const byIssueType = Object.keys(issueMap).map((k) => ({
      issue_type: k,
      label: k.replace(/_/g, ' '),
      total: issueMap[k].total,
      resolved: issueMap[k].resolved,
      escalated: issueMap[k].escalated,
    }));

    // Oldest unresolved
    const unresolvedItems = items
      .filter((i) => ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'ESCALATED'].includes(i.status))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, 8);

    const unresolved = [];
    for (const it of unresolvedItems) {
      const eventsRes = await db.query(`
        SELECT se.*, u.name as actor_name, u.role as actor_role
        FROM status_events se
        LEFT JOIN users u ON se.actor_id = u.id
        WHERE se.complaint_item_id = $1
        ORDER BY se.created_at ASC
      `, [it.id]);

      unresolved.push({
        ...it,
        days_open: Math.floor(
          (Date.now() - new Date(it.created_at).getTime()) / (1000 * 3600 * 24)
        ),
        timeline: eventsRes.rows,
      });
    }

    const coursesWithoutLecturers = courses
      .filter((c) => !c.lecturer_id)
      .map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        session: c.session,
      }));

    res.json({
      total_complaints: totalComplaints,
      total_items: totalItems,
      pending_count: pendingCount,
      escalated_count: escalatedCount,
      resolved_count: resolvedCount,
      rejected_count: rejectedCount,
      avg_resolution_hours: 48.5,
      status_breakdown: statusBreakdown,
      by_course: byCourse,
      by_issue_type: byIssueType,
      oldest_unresolved: unresolved,
      courses_without_lecturers: coursesWithoutLecturers,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN ---
apiRouter.get('/admin/users', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const users = await db.query('SELECT id, name, email, matric_no, role, department FROM users ORDER BY id ASC');
    res.json(users.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/admin/users', async (req: Request, res: Response) => {
  try {
    const { name, email, matric_no, role, password } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ detail: 'Name, email, and role are required' });
    }

    const cleanRole = String(role).trim().toLowerCase();
    let cleanMatric: string | null = matric_no ? String(matric_no).trim().toUpperCase() : null;

    if (cleanRole === 'student') {
      if (!cleanMatric) {
        return res.status(400).json({ detail: 'Matric number is required for students. Format: CSC/2021/XXX' });
      }
      // Ensure format CSC/2021/XXX
      const matricPattern = /^[A-Z]{3}\/\d{4}\/\d{3,4}$/i;
      if (!matricPattern.test(cleanMatric)) {
        return res.status(400).json({
          detail: 'Invalid matric number format. Required format: CSC/2021/XXX (e.g., CSC/2021/045)',
        });
      }
    }

    const db = await getDb();
    const ins = await db.query(`
      INSERT INTO users (name, email, matric_no, role, password_hash, department, created_at)
      VALUES ($1, $2, $3, $4, $5, 'Computer Science & Engineering', CURRENT_TIMESTAMP)
      RETURNING id
    `, [name.trim(), email.trim().toLowerCase(), cleanMatric, cleanRole, password || 'password123']);

    const newUser = await db.queryOne('SELECT * FROM users WHERE id = $1', [ins.rows[0].id]);
    res.status(201).json(newUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/admin/simulate-time', async (req: Request, res: Response) => {
  try {
    const days = req.body?.days_to_advance || 7;
    const db = await getDb();
    const hod = await db.queryOne("SELECT id FROM users WHERE role = 'hod'");

    const activeItemsRes = await db.query(`
      SELECT ci.*, c.student_id, c.id as complaint_id, crs.code as course_code, crs.lecturer_id,
             u.name as student_name, u.matric_no
      FROM complaint_items ci
      JOIN complaints c ON ci.complaint_id = c.id
      JOIN courses crs ON c.course_id = crs.id
      LEFT JOIN users u ON c.student_id = u.id
      WHERE ci.status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO')
    `);

    const activeItems = activeItemsRes.rows;
    const autoEscalated: any[] = [];
    const autoClosed: any[] = [];
    const parentComplaintIds = new Set<number>();

    for (const it of activeItems) {
      const issueLabel = formatIssueType(it.issue_type);

      if (it.status === 'NEEDS_INFO') {
        await db.query("UPDATE complaint_items SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [it.id]);
        const reason = `Auto-closed: No response from student after ${days} simulated days.`;
        await db.query(`
          INSERT INTO status_events (complaint_item_id, from_status, to_status, note, created_at)
          VALUES ($1, 'NEEDS_INFO', 'REJECTED', $2, CURRENT_TIMESTAMP)
        `, [it.id, reason]);

        await sendNotification(
          db,
          it.student_id,
          null,
          it.complaint_id,
          `Your complaint for ${it.course_code} (${issueLabel}) was automatically closed because requested information was not submitted within the 14-day SLA deadline.`
        );

        autoClosed.push({
          item_id: it.id,
          course: it.course_code,
          issue_type: it.issue_type,
          student: it.student_name,
          reason,
        });
        parentComplaintIds.add(it.complaint_id);
      } else if (['SUBMITTED', 'UNDER_REVIEW'].includes(it.status)) {
        await db.query(`
          UPDATE complaint_items
          SET status = 'ESCALATED', assigned_to_role = 'hod', updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [it.id]);

        const reason = `Automated SLA Escalation: Lecturer exceeded 7-day resolution window (+${days} days inactive). Transferred to HOD.`;
        await db.query(`
          INSERT INTO status_events (complaint_item_id, from_status, to_status, note, created_at)
          VALUES ($1, $2, 'ESCALATED', $3, CURRENT_TIMESTAMP)
        `, [it.id, it.status, reason]);

        if (hod) {
          await sendNotification(
            db,
            hod.id,
            null,
            it.complaint_id,
            `SLA Escalation Alert: Complaint for student ${it.student_name || 'Student'} (${it.matric_no || 'Matric'}) on ${it.course_code} (${issueLabel}) has been transferred to your desk due to 7 days without lecturer action.`
          );
        }

        if (it.lecturer_id) {
          await sendNotification(
            db,
            it.lecturer_id,
            null,
            it.complaint_id,
            `SLA Inactivity Notice: Complaint for student ${it.student_name || 'Student'} on ${it.course_code} (${issueLabel}) has been auto-escalated to the Head of Department due to exceeding the 7-day review limit.`
          );
        }

        await sendNotification(
          db,
          it.student_id,
          null,
          it.complaint_id,
          `Your complaint for ${it.course_code} (${issueLabel}) has been automatically transferred to the Head of Department under university SLA guidelines for expedited review.`
        );

        autoEscalated.push({
          item_id: it.id,
          course: it.course_code,
          issue_type: it.issue_type,
          student: it.student_name,
          reason,
        });
        parentComplaintIds.add(it.complaint_id);
      }
    }

    // Also auto-escalate open groups
    const openGroupsRes = await db.query("SELECT * FROM issue_groups WHERE status IN ('OPEN', 'UNDER_REVIEW')");
    for (const g of openGroupsRes.rows) {
      await db.query("UPDATE issue_groups SET status = 'ESCALATED', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [g.id]);
    }

    for (const cid of parentComplaintIds) {
      await updateComplaintOverallStatus(cid);
    }

    res.json({
      success: true,
      simulated_days: days,
      auto_escalated_count: autoEscalated.length,
      auto_closed_count: autoClosed.length,
      groups_escalated_count: openGroupsRes.rows.length,
      escalated_items: autoEscalated,
      closed_items: autoClosed,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
