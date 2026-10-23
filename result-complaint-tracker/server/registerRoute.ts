import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from './db';

export const registerRouter = Router();

const EMAIL_DOMAIN = '@oauife.edu.ng';
const MATRIC_PATTERN = /^[A-Z]{2,4}\/\d{4}\/\d{3,4}$/; // e.g. CSC/2021/001
const MIN_PASSWORD_LENGTH = 8;

// ---------------------------------------------------------------------------
// Password helpers (Node built-in scrypt, no extra dependency)
// Stored format: scrypt$<salt hex>$<hash hex>  (fits the VARCHAR(255) column)
// ---------------------------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

/**
 * Verifies a password against a stored value.
 * Plain-text values (the seeded demo accounts) are still accepted so existing
 * accounts keep working.
 */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  if (!stored.startsWith('scrypt$')) return password === stored;
  const [, salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const candidate = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(candidate, expected);
}

// ---------------------------------------------------------------------------
// GET /api/auth/register/courses
// Public list of courses so a new student can pick the ones they are enrolled in.
// ---------------------------------------------------------------------------
registerRouter.get('/auth/register/courses', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = await db.query(
      'SELECT id, code, title, session, semester FROM courses ORDER BY code ASC'
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ detail: 'Could not load courses. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/register
// Body: { name, email, matric_no, password, course_ids: number[] }
// Self-registration is student-only; staff accounts are created by the admin.
// ---------------------------------------------------------------------------
registerRouter.post('/auth/register', async (req: Request, res: Response) => {
  const body = req.body || {};
  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  const email = String(body.email || '').trim().toLowerCase();
  const matricNo = String(body.matric_no || '').trim().toUpperCase();
  const password = String(body.password || '');
  const courseIds: number[] = Array.isArray(body.course_ids)
    ? Array.from(new Set(body.course_ids.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)))
    : [];

  // --- Validation ---------------------------------------------------------
  if (name.length < 2 || name.length > 120) {
    return res.status(400).json({ detail: 'Enter your full name (2 to 120 characters).' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !email.endsWith(EMAIL_DOMAIN)) {
    return res.status(400).json({ detail: `Use your university email ending in ${EMAIL_DOMAIN}.` });
  }
  if (!MATRIC_PATTERN.test(matricNo)) {
    return res.status(400).json({ detail: 'Enter your matric number in the format CSC/2021/001.' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ detail: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }
  if (courseIds.length === 0) {
    return res.status(400).json({ detail: 'Select at least one course you are enrolled in.' });
  }

  try {
    const db = await getDb();

    // --- Duplicate checks -------------------------------------------------
    const emailTaken = await db.queryOne('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (emailTaken) {
      return res.status(409).json({ detail: 'An account with this email already exists. Sign in instead.' });
    }
    const matricTaken = await db.queryOne('SELECT id FROM users WHERE UPPER(matric_no) = $1', [matricNo]);
    if (matricTaken) {
      return res.status(409).json({ detail: 'An account with this matric number already exists.' });
    }

    // --- Make sure every selected course exists ---------------------------
    const found = await db.query('SELECT id FROM courses WHERE id = ANY($1::int[])', [courseIds]);
    if (found.rows.length !== courseIds.length) {
      return res.status(400).json({ detail: 'One or more selected courses no longer exist. Refresh and try again.' });
    }

    // --- Create the user (role is always "student") -----------------------
    const inserted = await db.query(
      `INSERT INTO users (name, email, matric_no, role, password_hash)
       VALUES ($1, $2, $3, 'student', $4)
       RETURNING id, name, email, matric_no, role, department, created_at`,
      [name, email, matricNo, hashPassword(password)]
    );
    const user = inserted.rows[0];

    // --- Enrol the student; roll the user back if this fails --------------
    try {
      for (const courseId of courseIds) {
        await db.query(
          'INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [user.id, courseId]
        );
      }
    } catch (enrollErr) {
      await db.query('DELETE FROM users WHERE id = $1', [user.id]);
      throw enrollErr;
    }

    return res.status(201).json({ message: 'Account created', user });
  } catch (err: any) {
    // Unique-constraint race (two sign-ups with the same email at once)
    if (err?.code === '23505') {
      return res.status(409).json({ detail: 'An account with this email already exists. Sign in instead.' });
    }
    console.error('[Register] Failed to create account:', err);
    return res.status(500).json({ detail: 'Could not create your account. Please try again.' });
  }
});
