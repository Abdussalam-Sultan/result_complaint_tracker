import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

const { Pool } = pg;

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

let dbInstance: DbClient | null = null;
let pgliteInstance: PGlite | null = null;
let isDirty = false;
let saveTimeout: NodeJS.Timeout | null = null;

const SNAPSHOT_FILE = path.resolve(process.cwd(), 'database.tar.gz');

async function flushSnapshot(): Promise<void> {
  if (!pgliteInstance || !isDirty) return;
  try {
    const dump = await pgliteInstance.dumpDataDir('gzip');
    const buffer = Buffer.from(await dump.arrayBuffer());
    const tmpFile = `${SNAPSHOT_FILE}.tmp`;
    fs.writeFileSync(tmpFile, buffer);
    fs.renameSync(tmpFile, SNAPSHOT_FILE);
    isDirty = false;
  } catch (err) {
    console.error('[PostgreSQL] Failed to persist database snapshot:', err);
  }
}

function scheduleSnapshot() {
  isDirty = true;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    flushSnapshot().catch((err) => console.error('[PostgreSQL] Snapshot error:', err));
  }, 1000);
}

export async function getDb(): Promise<DbClient> {
  if (dbInstance) {
    return dbInstance;
  }

  // 1. External PostgreSQL connection (if valid PostgreSQL environment variable provided)
  const rawDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  const externalPgUrl =
    rawDbUrl.startsWith('postgresql://') || rawDbUrl.startsWith('postgres://') ? rawDbUrl : null;
  const externalPgHost = process.env.PGHOST || process.env.SQL_HOST;

  if (process.env.VERCEL && !externalPgUrl && !externalPgHost) {
    throw new Error('DATABASE_URL must point to a remote PostgreSQL database on Vercel.');
  }

  if (externalPgUrl || externalPgHost) {
    console.log('[PostgreSQL] Connecting to remote PostgreSQL server via pg.Pool...');
    const pool = new Pool(
      externalPgUrl
        ? { connectionString: externalPgUrl }
        : {
            host: process.env.PGHOST || process.env.SQL_HOST,
            user: process.env.PGUSER || process.env.SQL_USER,
            password: process.env.PGPASSWORD || process.env.SQL_PASSWORD,
            database: process.env.PGDATABASE || process.env.SQL_DB_NAME,
            port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
            max: 10,
          }
    );

    pool.on('error', (err) => {
      console.error('[PostgreSQL] Unexpected pool client error:', err);
    });

    dbInstance = {
      async query<T = any>(sql: string, params?: any[]) {
        const result = await pool.query(sql, params);
        return { rows: result.rows as T[] };
      },
      async queryOne<T = any>(sql: string, params?: any[]) {
        const result = await pool.query(sql, params);
        return (result.rows[0] as T) || null;
      },
      async exec(sql: string) {
        await pool.query(sql);
      },
      async close() {
        await pool.end();
        dbInstance = null;
      },
    };
  } else {
    // 2. Embedded PostgreSQL engine
    // Uses in-memory execution + single-file snapshot persistence.
    // This completely prevents Windows/OneDrive path locking, postmaster.pid, and directory issues.
    console.log('[PostgreSQL] Initializing embedded PostgreSQL engine...');

    let pglite: PGlite;
    if (fs.existsSync(SNAPSHOT_FILE)) {
      try {
        console.log(`[PostgreSQL] Restoring snapshot from ${SNAPSHOT_FILE}...`);
        const snapshotBuffer = fs.readFileSync(SNAPSHOT_FILE);
        pglite = new PGlite({ loadDataDir: new Blob([snapshotBuffer]) });
        await pglite.waitReady;
      } catch (loadErr) {
        console.warn('[PostgreSQL] Snapshot corrupted or incompatible. Initializing fresh instance...', loadErr);
        pglite = new PGlite();
        await pglite.waitReady;
      }
    } else {
      console.log('[PostgreSQL] Starting clean embedded PostgreSQL instance...');
      pglite = new PGlite();
      await pglite.waitReady;
    }

    pgliteInstance = pglite;

    dbInstance = {
      async query<T = any>(sql: string, params?: any[]) {
        const result = await pglite.query(sql, params);
        const upper = sql.trim().toUpperCase();
        if (
          upper.startsWith('INSERT') ||
          upper.startsWith('UPDATE') ||
          upper.startsWith('DELETE') ||
          upper.startsWith('TRUNCATE') ||
          upper.startsWith('ALTER')
        ) {
          scheduleSnapshot();
        }
        return { rows: (result.rows as T[]) || [] };
      },
      async queryOne<T = any>(sql: string, params?: any[]) {
        const result = await pglite.query(sql, params);
        return (result.rows[0] as T) || null;
      },
      async exec(sql: string) {
        await pglite.exec(sql);
        const upper = sql.trim().toUpperCase();
        if (
          upper.includes('INSERT') ||
          upper.includes('UPDATE') ||
          upper.includes('DELETE') ||
          upper.includes('TRUNCATE') ||
          upper.includes('CREATE') ||
          upper.includes('ALTER')
        ) {
          scheduleSnapshot();
        }
      },
      async close() {
        if (saveTimeout) clearTimeout(saveTimeout);
        await flushSnapshot();
        await pglite.close();
        pgliteInstance = null;
        dbInstance = null;
      },
    };
  }

  // Initialize schema if not present
  await initSchema(dbInstance);
  return dbInstance;
}

export async function initSchema(db: DbClient): Promise<void> {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      matric_no VARCHAR(100),
      role VARCHAR(50) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      department VARCHAR(255) DEFAULT 'Computer Science & Engineering',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS courses (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      session VARCHAR(50) DEFAULT '2023/2024',
      semester VARCHAR(50) DEFAULT 'Harmattan',
      lecturer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      overall_status VARCHAR(100) DEFAULT 'SUBMITTED',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS issue_groups (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      issue_type VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      status VARCHAR(100) DEFAULT 'OPEN',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS complaint_items (
      id SERIAL PRIMARY KEY,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      issue_type VARCHAR(100) NOT NULL,
      status VARCHAR(100) DEFAULT 'SUBMITTED',
      claimed_score NUMERIC(5,2),
      group_id INTEGER REFERENCES issue_groups(id) ON DELETE SET NULL,
      assigned_to_role VARCHAR(50) DEFAULT 'lecturer',
      reopened INTEGER DEFAULT 0,
      reopen_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS status_events (
      id SERIAL PRIMARY KEY,
      complaint_item_id INTEGER NOT NULL REFERENCES complaint_items(id) ON DELETE CASCADE,
      from_status VARCHAR(100) NOT NULL,
      to_status VARCHAR(100) NOT NULL,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      note TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      complaint_id INTEGER REFERENCES complaints(id) ON DELETE SET NULL,
      read INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      file_type VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await db.exec(schemaSql);
}
