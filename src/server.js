import 'dotenv/config';
import { createServer } from 'node:http';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const publicDir = join(root, 'public');
const uploadsDir = join(root, 'uploads', 'recordings');
await mkdir(uploadsDir, { recursive: true });
let content = JSON.parse(await readFile(join(root, 'content', 'ielts-placement.json'), 'utf8'));
let rubrics = JSON.parse(await readFile(join(root, 'content', 'ielts-rubrics.json'), 'utf8'));
const defaultQuestionsPath = join(root, 'content', 'ielts-placement.json');
const defaultRubricsPath = join(root, 'content', 'ielts-rubrics.json');
const defaultAuthorizedTeachersPath = join(root, 'content', 'authorized-teachers.json');
let authorizedTeachers = [];
try {
  authorizedTeachers = JSON.parse(await readFile(defaultAuthorizedTeachersPath, 'utf8'));
} catch (e) {
  console.warn('Could not load authorized-teachers.json:', e.message);
}

const seedAttempts = [];
const memoryRepository = {
  attempts: [...seedAttempts],
  teachers: authorizedTeachers.map((t, idx) => ({ id: idx + 1, status: 'active', ...t })),
  admins: [
    { id: 1, username: 'azzikra', password: process.env.ADMIN_PASSWORD || '4dm1n123', name: 'Azzikra', email: 'azzikra@karyabangsa.sch.id', status: 'active' },
    { id: 2, username: 'refka', password: process.env.ADMIN_REFKA_PASSWORD || 'r3fk4', name: 'Refka', email: 'refka@karyabangsa.sch.id', status: 'active' }
  ],
  settings: new Map(),
  async listAttempts() { return this.attempts; },
  async createAttempt(attempt) { this.attempts.unshift(attempt); return attempt; },
  async getAttempt(id) { return this.attempts.find((attempt) => attempt.id === id); },
  async updateAttempt(id, update) { const attempt = this.attempts.find((item) => item.id === id); if (attempt) Object.assign(attempt, update); return attempt; },
  async deleteAttempt(id) { const idx = this.attempts.findIndex((item) => item.id === id); if (idx !== -1) { this.attempts.splice(idx, 1); return true; } return false; },
  async getSetting(key) { return this.settings.get(key); },
  async setSetting(key, value) { this.settings.set(key, value); return value; },
  async listTeachers() { return [...this.teachers]; },
  async getTeacher(idOrEmail) {
    const term = String(idOrEmail).toLowerCase().trim();
    return this.teachers.find((t) => String(t.id) === term || (t.email || '').toLowerCase() === term) || null;
  },
  async createTeacher(teacher) {
    const nextId = this.teachers.length ? Math.max(...this.teachers.map((t) => Number(t.id) || 0)) + 1 : 1;
    const created = { id: nextId, status: teacher.status || 'active', ...teacher };
    this.teachers.push(created);
    return created;
  },
  async updateTeacher(id, update) {
    const term = String(id).toLowerCase().trim();
    const teacher = this.teachers.find((t) => String(t.id) === term || (t.email || '').toLowerCase() === term);
    if (!teacher) return null;
    Object.assign(teacher, update);
    return teacher;
  },
  async deleteTeacher(id) {
    const term = String(id).toLowerCase().trim();
    const idx = this.teachers.findIndex((t) => String(t.id) === term || (t.email || '').toLowerCase() === term);
    if (idx !== -1) {
      this.teachers.splice(idx, 1);
      return true;
    }
    return false;
  },
  async listAdmins() {
    return this.admins.map(({ password, ...admin }) => admin);
  },
  async getAdmin(idOrUsername) {
    const term = String(idOrUsername).toLowerCase().trim();
    return this.admins.find((a) => String(a.id) === term || (a.username || '').toLowerCase() === term) || null;
  },
  async createAdmin(admin) {
    const nextId = this.admins.length ? Math.max(...this.admins.map((a) => Number(a.id) || 0)) + 1 : 1;
    const created = { id: nextId, status: admin.status || 'active', ...admin };
    this.admins.push(created);
    return { id: created.id, username: created.username, name: created.name, email: created.email, status: created.status };
  },
  async updateAdmin(id, update) {
    const term = String(id).toLowerCase().trim();
    const admin = this.admins.find((a) => String(a.id) === term || (a.username || '').toLowerCase() === term);
    if (!admin) return null;
    Object.assign(admin, update);
    return { id: admin.id, username: admin.username, name: admin.name, email: admin.email, status: admin.status };
  },
  async deleteAdmin(id) {
    const term = String(id).toLowerCase().trim();
    const idx = this.admins.findIndex((a) => String(a.id) === term || (a.username || '').toLowerCase() === term);
    if (idx !== -1) {
      this.admins.splice(idx, 1);
      return true;
    }
    return false;
  }
};
let repository = memoryRepository;
let storageMode = 'memory';

async function syncAuthorizedTeachersBackup() {
  try {
    const list = await repository.listTeachers();
    authorizedTeachers = list;
    const cleanList = list.map((t) => ({
      email: t.email,
      unit: t.unit,
      name: t.name
    }));
    await writeFile(defaultAuthorizedTeachersPath, JSON.stringify(cleanList, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to sync authorized teachers to disk backup:', err);
  }
}

async function saveQuestions(newContent) {
  content = newContent;
  try {
    await repository.setSetting('questions_content', newContent);
  } catch (err) {
    console.error('Failed to persist questions to database:', err);
  }
  try {
    await writeFile(defaultQuestionsPath, JSON.stringify(newContent, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist questions to disk backup:', err);
  }
  return content;
}

async function saveRubrics(newRubrics) {
  rubrics = newRubrics;
  try {
    await repository.setSetting('rubrics_content', newRubrics);
  } catch (err) {
    console.error('Failed to persist rubrics to database:', err);
  }
  try {
    await writeFile(defaultRubricsPath, JSON.stringify(newRubrics, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist rubrics to disk backup:', err);
  }
  await resyncAttemptsWithRubrics();
  return rubrics;
}

async function connectMySQL() {
  const rawUri = process.env.MYSQL_URI || (process.env.DATABASE_URL?.startsWith('mysql') ? process.env.DATABASE_URL : null);
  const host = (process.env.MYSQL_HOST === 'localhost' || !process.env.MYSQL_HOST) ? '127.0.0.1' : process.env.MYSQL_HOST;
  const port = Number(process.env.MYSQL_PORT) || 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'assessify';

  try {
    const mysql = await import('mysql2/promise');
    let pool;
    if (rawUri && (rawUri.startsWith('mysql://') || rawUri.startsWith('mysql2://'))) {
      pool = mysql.createPool({
        uri: rawUri,
        waitForConnections: true,
        connectionLimit: 10,
        connectTimeout: 3000
      });
    } else {
      pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        connectTimeout: 3000
      });
    }

    // Verify connection with timeout
    const connectPromise = async () => {
      await pool.query('SELECT 1');

      // Initialize tables if they do not exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS attempts (
          id VARCHAR(64) PRIMARY KEY,
          teacher VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          unit VARCHAR(128) NULL,
          status VARCHAR(64) NOT NULL DEFAULT 'In progress',
          started_at VARCHAR(64) NOT NULL,
          submitted_at VARCHAR(64) NULL,
          overall VARCHAR(32) NULL,
          review VARCHAR(64) NOT NULL DEFAULT 'Pending',
          raw_data JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_email_started (email, started_at),
          INDEX idx_unit (unit),
          INDEX idx_status_review (status, review)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      try {
        await pool.query('ALTER TABLE attempts ADD COLUMN unit VARCHAR(128) NULL AFTER email');
      } catch {}

      await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          setting_key VARCHAR(128) PRIMARY KEY,
          setting_value JSON NOT NULL,
          updated_at VARCHAR(64) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS authorized_teachers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          unit VARCHAR(128) NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_email (email),
          INDEX idx_unit (unit)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(64) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query('ALTER TABLE authorized_teachers ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT "active"').catch(() => {});
      await pool.query('ALTER TABLE admin_users ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT "active"').catch(() => {});

      repository = {
        async listAttempts() {
          const [rows] = await pool.query('SELECT raw_data FROM attempts ORDER BY started_at DESC');
          return rows.map((r) => (typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data));
        },
        async createAttempt(attempt) {
          await pool.query(
            `INSERT INTO attempts (id, teacher, email, unit, status, started_at, submitted_at, overall, review, raw_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE raw_data = VALUES(raw_data), unit = VALUES(unit), status = VALUES(status), overall = VALUES(overall), review = VALUES(review), submitted_at = VALUES(submitted_at)`,
            [
              attempt.id,
              attempt.teacher || '',
              attempt.email || '',
              attempt.unit || 'SD KARYA BANGSA',
              attempt.status || 'In progress',
              attempt.startedAt || new Date().toISOString(),
              attempt.submittedAt || null,
              attempt.overall || null,
              attempt.review || 'Pending',
              JSON.stringify(attempt)
            ]
          );
          return attempt;
        },
        async getAttempt(id) {
          const [rows] = await pool.query('SELECT raw_data FROM attempts WHERE id = ? LIMIT 1', [id]);
          if (!rows.length) return null;
          const raw = rows[0].raw_data;
          return typeof raw === 'string' ? JSON.parse(raw) : raw;
        },
        async updateAttempt(id, update) {
          const current = await this.getAttempt(id);
          if (!current) return null;
          const merged = { ...current, ...update };
          await this.createAttempt(merged);
          return merged;
        },
        async deleteAttempt(id) {
          const [res] = await pool.query('DELETE FROM attempts WHERE id = ?', [id]);
          return res.affectedRows > 0;
        },
        async getSetting(key) {
          const [rows] = await pool.query('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1', [key]);
          if (!rows.length) return null;
          const val = rows[0].setting_value;
          return typeof val === 'string' ? JSON.parse(val) : val;
        },
        async setSetting(key, value) {
          const updated = new Date().toISOString();
          await pool.query(
            `INSERT INTO settings (setting_key, setting_value, updated_at)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at)`,
            [key, JSON.stringify(value), updated]
          );
          return value;
        },
        async listTeachers() {
          const [rows] = await pool.query('SELECT id, name, email, unit, COALESCE(status, "active") AS status, created_at, updated_at FROM authorized_teachers ORDER BY name ASC');
          return rows;
        },
        async getTeacher(idOrEmail) {
          const term = String(idOrEmail).toLowerCase().trim();
          const isNum = !isNaN(Number(term)) && !term.includes('@');
          const query = isNum
            ? 'SELECT id, name, email, unit, COALESCE(status, "active") AS status, created_at, updated_at FROM authorized_teachers WHERE id = ? LIMIT 1'
            : 'SELECT id, name, email, unit, COALESCE(status, "active") AS status, created_at, updated_at FROM authorized_teachers WHERE email = ? LIMIT 1';
          const [rows] = await pool.query(query, [isNum ? Number(term) : term]);
          return rows[0] || null;
        },
        async createTeacher({ name, email, unit, status = 'active' }) {
          const normalizedEmail = email.toLowerCase().trim();
          const [res] = await pool.query(
            'INSERT INTO authorized_teachers (name, email, unit, status) VALUES (?, ?, ?, ?)',
            [name.trim(), normalizedEmail, unit.trim(), status || 'active']
          );
          return { id: res.insertId, name: name.trim(), email: normalizedEmail, unit: unit.trim(), status: status || 'active' };
        },
        async updateTeacher(id, { name, email, unit, status }) {
          const normalizedEmail = email ? email.toLowerCase().trim() : undefined;
          await pool.query(
            'UPDATE authorized_teachers SET name = COALESCE(?, name), email = COALESCE(?, email), unit = COALESCE(?, unit), status = COALESCE(?, status) WHERE id = ?',
            [name?.trim(), normalizedEmail, unit?.trim(), status, id]
          );
          return this.getTeacher(id);
        },
        async deleteTeacher(id) {
          const [res] = await pool.query('DELETE FROM authorized_teachers WHERE id = ?', [id]);
          return res.affectedRows > 0;
        },
        async listAdmins() {
          const [rows] = await pool.query('SELECT id, username, name, email, COALESCE(status, "active") AS status, created_at, updated_at FROM admin_users ORDER BY name ASC');
          return rows;
        },
        async getAdmin(idOrUsername) {
          const term = String(idOrUsername).toLowerCase().trim();
          const isNum = !isNaN(Number(term));
          const query = isNum
            ? 'SELECT id, username, password, name, email, COALESCE(status, "active") AS status, created_at, updated_at FROM admin_users WHERE id = ? LIMIT 1'
            : 'SELECT id, username, password, name, email, COALESCE(status, "active") AS status, created_at, updated_at FROM admin_users WHERE username = ? LIMIT 1';
          const [rows] = await pool.query(query, [isNum ? Number(term) : term]);
          return rows[0] || null;
        },
        async createAdmin({ username, password, name, email, status = 'active' }) {
          const normUsername = username.toLowerCase().trim();
          const [res] = await pool.query(
            'INSERT INTO admin_users (username, password, name, email, status) VALUES (?, ?, ?, ?, ?)',
            [normUsername, password, name.trim(), (email || '').toLowerCase().trim() || null, status || 'active']
          );
          return { id: res.insertId, username: normUsername, name: name.trim(), email: (email || '').toLowerCase().trim() || null, status: status || 'active' };
        },
        async updateAdmin(id, { username, password, name, email, status }) {
          const normUsername = username ? username.toLowerCase().trim() : undefined;
          if (password) {
            await pool.query(
              'UPDATE admin_users SET username = COALESCE(?, username), password = ?, name = COALESCE(?, name), email = COALESCE(?, email), status = COALESCE(?, status) WHERE id = ?',
              [normUsername, password, name?.trim(), (email || '').toLowerCase().trim() || null, status, id]
            );
          } else {
            await pool.query(
              'UPDATE admin_users SET username = COALESCE(?, username), name = COALESCE(?, name), email = COALESCE(?, email), status = COALESCE(?, status) WHERE id = ?',
              [normUsername, name?.trim(), (email || '').toLowerCase().trim() || null, status, id]
            );
          }
          const [rows] = await pool.query('SELECT id, username, name, email, COALESCE(status, "active") AS status FROM admin_users WHERE id = ?', [id]);
          return rows[0] || null;
        },
        async deleteAdmin(id) {
          const [res] = await pool.query('DELETE FROM admin_users WHERE id = ?', [id]);
          return res.affectedRows > 0;
        }
      };

      storageMode = 'mysql';
      console.log('MySQL repository connected successfully');

      // Seed default admin accounts if admin_users is empty
      try {
        const [adminRows] = await pool.query('SELECT COUNT(*) as count FROM admin_users');
        if (adminRows[0]?.count === 0) {
          const defaultAdmins = [
            { username: 'azzikra', password: process.env.ADMIN_PASSWORD || '4dm1n123', name: 'Azzikra', email: 'azzikra@karyabangsa.sch.id' },
            { username: 'refka', password: process.env.ADMIN_REFKA_PASSWORD || 'r3fk4', name: 'Refka', email: 'refka@karyabangsa.sch.id' }
          ];
          for (const a of defaultAdmins) {
            await pool.query(
              'INSERT IGNORE INTO admin_users (username, password, name, email) VALUES (?, ?, ?, ?)',
              [a.username, a.password, a.name, a.email]
            );
          }
          console.log('Seeded default administrators (azzikra, refka) into MySQL database');
        }
      } catch (aErr) {
        console.warn(`Could not sync admin accounts with MySQL (${aErr.message})`);
      }

      // Sync Authorized Teachers with MySQL Database
      try {
        const [teacherRows] = await pool.query('SELECT COUNT(*) as count FROM authorized_teachers');
        if (teacherRows[0]?.count === 0 && authorizedTeachers.length > 0) {
          for (const t of authorizedTeachers) {
            try {
              await pool.query(
                'INSERT IGNORE INTO authorized_teachers (name, email, unit) VALUES (?, ?, ?)',
                [t.name, t.email.toLowerCase().trim(), t.unit]
              );
            } catch {}
          }
          console.log(`Seeded ${authorizedTeachers.length} authorized teachers into MySQL database`);
        }

        const dbTeachers = await repository.listTeachers();
        if (dbTeachers && dbTeachers.length > 0) {
          authorizedTeachers = dbTeachers;
          console.log(`Loaded ${dbTeachers.length} active authorized teachers from MySQL database`);
        }
      } catch (tErr) {
        console.warn(`Could not sync authorized teachers with MySQL (${tErr.message})`);
      }

      // Sync Questions & Rubrics with MySQL Database
      try {
        const dbQuestions = await repository.getSetting('questions_content');
        if (dbQuestions && Array.isArray(dbQuestions.sections) && dbQuestions.sections.length === 3 && dbQuestions.version === content.version && dbQuestions.sections[0]?.label) {
          content = dbQuestions;
          console.log('Loaded active Question Bank from MySQL database');
        } else {
          await repository.setSetting('questions_content', content);
          console.log(`Updated Question Bank in MySQL database to final 3-section structure (version ${content.version})`);
        }

        const dbRubrics = await repository.getSetting('rubrics_content');
        if (dbRubrics && dbRubrics.writing && dbRubrics.speaking && dbRubrics.version === rubrics.version && !dbRubrics.writing.title?.includes('Memo')) {
          rubrics = dbRubrics;
          console.log('Loaded active Evaluation Rubrics from MySQL database');
        } else {
          await repository.setSetting('rubrics_content', rubrics);
          console.log(`Updated Evaluation Rubrics in MySQL database to version ${rubrics.version}`);
        }
      } catch (syncErr) {
        console.warn(`Could not sync questions/rubrics with MySQL (${syncErr.message})`);
      }

      await resyncAttemptsWithRubrics();
    };

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 2000));
    await Promise.race([connectPromise(), timeoutPromise]);
  } catch (error) {
    console.warn(`MySQL unavailable; using memory repository (${error.message})`);
  }
}

const json = (response, status, data) => {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
};
const safeTest = () => ({
  ...content,
  sections: (content.sections || []).map(({ questions, topics, ...section }) => {
    const rawQuestions = (questions && questions.length > 0) ? questions : (topics || []);
    const safeQuestions = rawQuestions.map(({ answer, ...question }) => question);
    const safeTopics = (topics && topics.length > 0 ? topics : safeQuestions).map(({ answer, ...t }) => t);
    return {
      ...section,
      topics: safeTopics,
      questions: safeQuestions
    };
  })
});
const readCookies = (request) => Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((item) => { const separator = item.indexOf('='); return [item.slice(0, separator).trim(), item.slice(separator + 1).trim()]; }));
const sessionSecret = process.env.SESSION_SECRET || 'assessify-development-secret-change-me';
const adminAccounts = {
  azzikra: { password: process.env.ADMIN_PASSWORD || '4dm1n123', name: 'Azzikra' },
  refka: { password: process.env.ADMIN_REFKA_PASSWORD || 'r3fk4', name: 'Refka' },
  ...(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD ? { [process.env.ADMIN_USERNAME.toLowerCase().trim()]: { password: process.env.ADMIN_PASSWORD, name: process.env.ADMIN_USERNAME.charAt(0).toUpperCase() + process.env.ADMIN_USERNAME.slice(1) } } : {})
};
let googleOAuthState = null;
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || '';
const googleClient = async () => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !googleRedirectUri) throw new Error('Google Workspace integration is not configured');
  const { google } = await import('googleapis');
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, googleRedirectUri);
};
const createSpeakingMeet = async (attempt) => {
  if (attempt.speakingMeetUrl) return attempt.speakingMeetUrl;
  const refreshToken = await repository.getSetting('googleRefreshToken') || process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) throw new Error('Google Workspace authorization is required');
  const { google } = await import('googleapis');
  const auth = await googleClient();
  auth.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth });
  const start = new Date();
  const event = await calendar.events.insert({ calendarId: 'primary', conferenceDataVersion: 1, requestBody: { summary: `Assessify Speaking Assessment — ${attempt.teacher}`, description: `Speaking assessment for ${attempt.teacher} (${attempt.email}).`, start: { dateTime: start.toISOString() }, end: { dateTime: new Date(start.getTime() + 30 * 60 * 1000).toISOString() }, conferenceData: { createRequest: { requestId: crypto.randomUUID() } } } });
  const meetUrl = event.data.hangoutLink || event.data.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri;
  if (!meetUrl) throw new Error('Google Calendar did not return a Meet link');
  return meetUrl;
};
const createSession = (user) => { const payload = Buffer.from(JSON.stringify(user)).toString('base64url'); const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url'); return `${payload}.${signature}`; };
const currentUser = (request) => { const token = readCookies(request).assessify_session; if (!token) return null; const [payload, signature] = token.split('.'); if (!payload || !signature) return null; const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url'); if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null; try { return JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; } };
const isAdmin = (request) => currentUser(request)?.role === 'admin';
const requestBody = async (request) => { let body = ''; for await (const chunk of request) body += chunk; return body ? JSON.parse(body) : {}; };

// ── CEFR helpers ────────────────────────────────────────────────
const cefrFromCorrect = (correct, total, activeRubrics = rubrics) => {
  // 1. Dynamic Score Mapping from active rubrics (e.g. { score: "47 – 50 points", level: "C2 (Higher Level Series Recommended)" })
  const scoreMapping = activeRubrics?.grammarVocabulary?.scoreMapping;
  if (Array.isArray(scoreMapping) && scoreMapping.length > 0) {
    for (const item of scoreMapping) {
      const levelMatch = String(item.level || '').match(/\b(C2|C1|B2|B1|A2|A1)\b/i);
      const scoreStr = String(item.score || '');
      const rangeMatch = scoreStr.match(/(\d+)\s*[-–—]\s*(\d+)/);
      if (levelMatch && rangeMatch) {
        const min = Number(rangeMatch[1]);
        const max = Number(rangeMatch[2]);
        if (correct >= min && correct <= max) {
          return levelMatch[1].toUpperCase();
        }
      }
    }
  }

  // 2. Dynamic Thresholds string from active rubrics (e.g. "A1: 0–18 | A2: 19–25 | B1: 26–32 | B2: 33–39 | C1: 40–46 | C2: 47–50")
  const thresholds = activeRubrics?.grammarVocabulary?.thresholds;
  if (typeof thresholds === 'string' && thresholds.trim()) {
    const parts = thresholds.split('|');
    for (const part of parts) {
      const levelMatch = part.match(/\b(C2|C1|B2|B1|A2|A1)\b/i);
      const rangeMatch = part.match(/(\d+)\s*[-–—]\s*(\d+)/);
      if (levelMatch && rangeMatch) {
        const min = Number(rangeMatch[1]);
        const max = Number(rangeMatch[2]);
        if (correct >= min && correct <= max) {
          return levelMatch[1].toUpperCase();
        }
      }
    }
  }

  // 3. Scale-level detection: check if active rubric supports C2
  const isScaleUpToC2 = Boolean(
    activeRubrics?.bandScale?.range?.includes('C2') ||
    activeRubrics?.grammarVocabulary?.thresholds?.includes('C2') ||
    activeRubrics?.writing?.levels?.some((l) => l.level === 'C2') ||
    (Array.isArray(activeRubrics?.grammarVocabulary?.scoreMapping) &&
      activeRubrics.grammarVocabulary.scoreMapping.some((m) => String(m.level || '').includes('C2')))
  );

  if (isScaleUpToC2) {
    if (total >= 45 || total === 50) {
      if (correct >= 47) return 'C2';
      if (correct >= 40) return 'C1';
      if (correct >= 33) return 'B2';
      if (correct >= 26) return 'B1';
      if (correct >= 19) return 'A2';
      return 'A1';
    }
    if (total <= 15) {
      if (correct >= 15) return 'C2';
      if (correct >= 13) return 'C1';
      if (correct >= 11) return 'B2';
      if (correct >= 8) return 'B1';
      if (correct >= 5) return 'A2';
      return 'A1';
    }
    if (total <= 20) {
      if (correct >= 19) return 'C2';
      if (correct >= 16) return 'C1';
      if (correct >= 13) return 'B2';
      if (correct >= 10) return 'B1';
      if (correct >= 7) return 'A2';
      return 'A1';
    }
    const ratio = total > 0 ? correct / total : 0;
    if (ratio >= 0.94) return 'C2';
    if (ratio >= 0.80) return 'C1';
    if (ratio >= 0.66) return 'B2';
    if (ratio >= 0.52) return 'B1';
    if (ratio >= 0.38) return 'A2';
    return 'A1';
  }

  // 4. Legacy fallback when C2 is not enabled (scale up to C1)
  if (total >= 45 || total === 50) {
    if (correct >= 45) return 'C1';
    if (correct >= 37) return 'B2';
    if (correct >= 28) return 'B1';
    if (correct >= 18) return 'A2';
    return 'A1';
  }
  if (total <= 15) {
    if (correct >= 15) return 'C1';
    if (correct >= 12) return 'B2';
    if (correct >= 9) return 'B1';
    if (correct >= 6) return 'A2';
    return 'A1';
  }
  if (total <= 18) {
    if (correct >= 18) return 'C1';
    if (correct >= 15) return 'B2';
    if (correct >= 11) return 'B1';
    if (correct >= 7) return 'A2';
    return 'A1';
  }
  if (correct >= 19) return 'C1';
  if (correct >= 16) return 'B2';
  if (correct >= 12) return 'B1';
  if (correct >= 8) return 'A2';
  return 'A1';
};
const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const computeFinalPlacement = (sectionScores) => {
  const levels = Object.values(sectionScores).filter((v) => cefrOrder.includes(v));
  if (levels.length === 0) return null;
  const count = (l) => levels.filter((v) => v === l).length;
  const grammarLevel = sectionScores['Grammar & Vocabulary'] || null;

  if (levels.length >= 3) {
    if (count('C2') >= 2) return 'C2';
    if ((count('C2') + count('C1')) >= 2 && cefrOrder.indexOf(grammarLevel) >= 3) return count('C2') >= 2 ? 'C2' : 'C1';
    if (count('C1') >= 2 && cefrOrder.indexOf(grammarLevel) >= 3) return 'C1';
    if ((count('C2') + count('C1') + count('B2')) >= 2 && cefrOrder.indexOf(grammarLevel) >= 2) return 'B2';
    if ((count('B1') + count('B2') + count('C1') + count('C2')) >= 2 && cefrOrder.indexOf(grammarLevel) >= 1) return 'B1';
    if (count('A1') >= 2) return 'A1';
    return 'A2';
  }
  if (grammarLevel) return grammarLevel;
  return levels[0] || null;
};
const rubricLevel = (criteria, skillKey = 'writing') => {
  const values = Object.values(criteria || {}).map(Number).filter((v) => Number.isInteger(v) && v >= 1);
  if (values.length === 0) return { criteria: criteria || {}, total: 0, level: null };
  const total = values.reduce((sum, value) => sum + value, 0);

  const activeSkill = rubrics && rubrics[skillKey];
  const numCriteria = (activeSkill?.criteria && Array.isArray(activeSkill.criteria) && activeSkill.criteria.length > 0)
    ? activeSkill.criteria.length
    : 4;
  const isScaleUpToC2 = Boolean(rubrics?.bandScale?.range?.includes('C2') || rubrics?.writing?.levels?.some((l) => l.level === 'C2'));

  const isComplete = values.length >= numCriteria;
  if (!isComplete) {
    return { criteria: criteria || {}, total, level: null };
  }

  const avg = total / values.length;
  let level = 'A1';
  if (isScaleUpToC2) {
    if (avg >= 5.5) level = 'C2';
    else if (avg >= 4.5) level = 'C1';
    else if (avg >= 3.5) level = 'B2';
    else if (avg >= 2.5) level = 'B1';
    else if (avg >= 1.5) level = 'A2';
    else level = 'A1';
  } else {
    if (avg >= 4.5) level = 'C1';
    else if (avg >= 3.5) level = 'B2';
    else if (avg >= 2.5) level = 'B1';
    else if (avg >= 1.75) level = 'A2';
    else level = 'A1';
  }
  return { criteria: criteria || {}, total, level };
};
const cefrDescriptor = (level) => ({
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper-Intermediate',
  C1: 'Advanced',
  C2: 'Mastery'
}[level] || level);
const cefrColor = (level) => ({
  A1: '#c0392b', // Crimson Red
  A2: '#d97706', // Warm Amber
  B1: '#2563eb', // Royal Blue
  B2: '#059669', // Emerald Green
  C1: '#7c3aed', // Royal Purple
  C2: '#86198f'  // Magenta / Fuchsia
}[level] || '#1e3a8a');

const performanceAnalysis = (row) => {
  if (!row.overall) return 'This assessment is still in progress. CEFR placement will be available after submission and manual review of Writing and Speaking.';
  const scores = row.sectionScores || {};
  const allLevels = Object.entries(scores).filter(([, v]) => cefrOrder.includes(v));
  const highest = allLevels.sort((a, b) => cefrOrder.indexOf(b[1]) - cefrOrder.indexOf(a[1]))[0];
  const lowest = [...allLevels].sort((a, b) => cefrOrder.indexOf(a[1]) - cefrOrder.indexOf(b[1]))[0];
  const descriptor = cefrDescriptor(row.overall);
  const strongSkill = highest?.[0];
  const weakSkill = lowest?.[0];
  return `Overall CEFR Placement: ${row.overall} — ${descriptor}. ` +
    (strongSkill && scores[strongSkill] ? `${strongSkill} is the strongest skill at ${scores[strongSkill]}. ` : '') +
    (weakSkill && weakSkill !== strongSkill && scores[weakSkill] ? `${weakSkill} is the priority development area at ${scores[weakSkill]}. ` : '') +
    'This placement is based on the Karya Bangsa School English Placement Rubric and should be used as an internal placement indicator.';
};

async function resyncAttemptsWithRubrics() {
  try {
    const attempts = await repository.listAttempts();
    const maxRange = rubrics?.bandScale?.range || (rubrics?.writing?.levels?.some((l) => l.level === 'C2') ? 'A1–C2' : 'A1–C1');
    for (const attempt of attempts) {
      let updated = false;
      const copy = { ...attempt };
      if (copy.scoring?.grammarVocabulary && typeof copy.scoring.grammarVocabulary.correct === 'number') {
        const correct = copy.scoring.grammarVocabulary.correct;
        const total = copy.scoring.grammarVocabulary.total || 50;
        const newLevel = cefrFromCorrect(correct, total, rubrics);

        if (copy.scoring.grammarVocabulary.level !== newLevel || copy.sectionScores?.['Grammar & Vocabulary'] !== newLevel) {
          copy.scoring = {
            ...copy.scoring,
            grammarVocabulary: {
              ...copy.scoring.grammarVocabulary,
              level: newLevel,
              method: `Objective answer-key scoring mapped to CEFR (${maxRange}) per active rubrics`
            }
          };
          copy.sectionScores = {
            ...(copy.sectionScores || {}),
            'Grammar & Vocabulary': newLevel
          };
          const finalPlacement = computeFinalPlacement(copy.sectionScores);
          if (finalPlacement) {
            copy.overall = finalPlacement;
          }
          updated = true;
        }
      }
      if (updated) {
        await repository.updateAttempt(copy.id, copy);
        console.log(`Resynced attempt ${copy.id} Grammar & Vocabulary score to ${copy.sectionScores['Grammar & Vocabulary']} (Overall: ${copy.overall})`);
      }
    }
  } catch (err) {
    console.error('Failed to resync attempts with rubrics:', err.message);
  }
}

const scoreObjective = (sectionId, responses) => {
  const section = (content.sections || []).find((item) => item.id === sectionId);
  const questions = section?.questions || [];
  const correct = questions.filter((question) => String(responses?.[question.id] || '').trim().toLowerCase() === String(question.answer || '').trim().toLowerCase()).length;
  const level = cefrFromCorrect(correct, questions.length, rubrics);
  const maxRange = rubrics?.bandScale?.range || (rubrics?.writing?.levels?.some((l) => l.level === 'C2') ? 'A1–C2' : 'A1–C1');
  return { skill: section?.label, correct, total: questions.length, level, method: `Objective answer-key scoring mapped to CEFR (${maxRange}) per active rubrics` };
};

const certificateNumber = (row) => `KBS-EN-${new Date(row.started).getUTCFullYear()}-${row.attempt.replace(/^ATT-/, '')}`;
const exportRows = (results) => results.map((row) => ({
  teacher: row.teacher,
  email: row.email || '',
  unit: row.unit || 'SD KARYA BANGSA',
  attempt: row.id,
  started: row.startedAt,
  status: row.status,
  grammarVocabulary: row.sectionScores?.['Grammar & Vocabulary'] ?? '',
  writing: row.sectionScores?.Writing ?? '',
  speaking: row.sectionScores?.Speaking ?? '',
  overallBand: row.overall ?? '',
  review: row.review,
  analysis: performanceAnalysis(row)
}));

const sendExcel = async (response, results, unitFilter) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Assessify';
  const sheetName = unitFilter && unitFilter.toLowerCase() !== 'all' ? unitFilter.slice(0, 31) : 'Teacher Results';
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = [
    { header: 'Teacher / Candidate', key: 'teacher', width: 24 },
    { header: 'Email', key: 'email', width: 34 },
    { header: 'School Unit', key: 'unit', width: 24 },
    { header: 'Attempt', key: 'attempt', width: 14 },
    { header: 'Started', key: 'started', width: 25 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Grammar & Vocabulary', key: 'grammarVocabulary', width: 24 },
    { header: 'Writing', key: 'writing', width: 16 },
    { header: 'Speaking', key: 'speaking', width: 16 },
    { header: 'Overall CEFR Band', key: 'overallBand', width: 18 },
    { header: 'Review', key: 'review', width: 18 },
    { header: 'Analysis', key: 'analysis', width: 80 }
  ];
  sheet.addRows(exportRows(results));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D7772' } };
  sheet.getColumn('analysis').alignment = { wrapText: true, vertical: 'top' };
  sheet.autoFilter = 'A1:L1';
  const buffer = await workbook.xlsx.writeBuffer();
  const fileSuffix = unitFilter && unitFilter.toLowerCase() !== 'all' ? `-${unitFilter.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
  response.writeHead(200, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="assessify-teacher-results${fileSuffix}.xlsx"`
  });
  response.end(buffer);
};

const sendCenteredPdf = (response, results, unitFilter) => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: { Title: 'Assessify — CEFR English Placement Result', Author: 'Karya Bangsa School' }
  });

  const fileSuffix = unitFilter && unitFilter.toLowerCase() !== 'all' ? `-${unitFilter.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
  response.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="assessify-results${fileSuffix}.pdf"`
  });
  doc.pipe(response);

  const rows = exportRows(results);

  if (!rows.length) {
    // Render a clean informational page if no assessments match the filter
    doc.rect(0, 0, 595, 100).fill('#0f274a');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('Assessify.', 0, 28, { width: 595, align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`CEFR English Placement Result · ${unitFilter && unitFilter.toLowerCase() !== 'all' ? unitFilter : 'Karya Bangsa School'}`, 0, 58, { width: 595, align: 'center' });

    doc.fillColor('#0f172a').fontSize(18).font('Helvetica-Bold').text('No Candidate Assessments Found', 0, 220, { width: 595, align: 'center' });
    doc.fillColor('#64748b').fontSize(11).font('Helvetica').text(
      `No candidate assessment records matched the requested filter (${unitFilter || 'All Units'}).`,
      60, 255, { width: 475, align: 'center' }
    );
    doc.end();
    return;
  }

  rows.forEach((row, index) => {
    if (index > 0) doc.addPage();

    // ── Header bar ──────────────────────────────────────────────────
    doc.rect(0, 0, 595, 100).fill('#0f274a');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('Assessify.', 0, 28, { width: 595, align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`CEFR English Placement Result · ${row.unit || 'Karya Bangsa School'}`, 0, 58, { width: 595, align: 'center' });

    // ── Teacher info ─────────────────────────────────────────────────
    doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text(row.teacher, 0, 122, { width: 595, align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor('#64748b')
      .text(`${row.email}  |  Unit: ${row.unit || 'SD KARYA BANGSA'}  |  Started ${new Date(row.started).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 0, 148, { width: 595, align: 'center' });
    doc.font('Helvetica-Bold').fillColor('#1e3a8a').text(`Certificate No. ${certificateNumber(row)}`, 0, 163, { width: 595, align: 'center' });

    // ── Overall CEFR badge (Band Color Coded) ────────────────────────
    const overallLevel = row.overallBand;
    const badgeColor = overallLevel ? cefrColor(overallLevel) : '#0f274a';
    const badgeW = 164;
    const badgeH = 72;
    const badgeX = (595 - badgeW) / 2; // = 215.5
    const badgeY = 182;
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 6).fill(badgeColor);
    doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text('OVERALL CEFR LEVEL', badgeX, badgeY + 12, { width: badgeW, align: 'center' });
    doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold').text(overallLevel || 'Pending', badgeX, badgeY + 24, { width: badgeW, align: 'center' });
    if (overallLevel) {
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica').text(cefrDescriptor(overallLevel), badgeX, badgeY + 54, { width: badgeW, align: 'center' });
    }

    // ── CEFR Skill Profile legend (Color Coded Bands A1–C2) ───────────
    const legendY = 270;
    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('CEFR Skill Profile', 0, legendY, { width: 595, align: 'center' });
    const boxesY = legendY + 18;
    const gap = 76;
    const boxW = 54;
    const totalLegendWidth = 5 * gap + boxW;
    const startLegendX = (595 - totalLegendWidth) / 2;
    [['A1', 'Beginner'], ['A2', 'Elementary'], ['B1', 'Intermediate'], ['B2', 'Upper-Inter.'], ['C1', 'Advanced'], ['C2', 'Mastery']].forEach(([lvl, desc], i) => {
      const lx = startLegendX + i * gap;
      doc.roundedRect(lx, boxesY, boxW, 20, 4).fill(cefrColor(lvl));
      doc.fillColor('#ffffff').fontSize(9.5).font('Helvetica-Bold').text(lvl, lx, boxesY + 5, { width: boxW, align: 'center' });
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica').text(desc, lx - 10, boxesY + 23, { width: boxW + 20, align: 'center' });
    });

    // ── Skills table (ONLY 2 COLUMNS: Skill / Component & CEFR Level) ─
    const tableWidth = 480;
    const tableX = (595 - tableWidth) / 2; // = 57.5
    const skillColW = 310;
    const levelColW = 170;
    const tableTop = 335;
    const rowH = 34;

    // Table header
    doc.rect(tableX, tableTop, tableWidth, rowH).fill('#0f274a');
    doc.fillColor('#ffffff').fontSize(9.5).font('Helvetica-Bold')
      .text('Skill / Component', tableX + 24, tableTop + 11, { width: skillColW - 24, align: 'left' })
      .text('CEFR Level', tableX + skillColW, tableTop + 11, { width: levelColW, align: 'center' });

    const skillRows = [
      ['Grammar & Vocabulary', row.grammarVocabulary],
      ['Writing', row.writing],
      ['Speaking', row.speaking],
    ];

    skillRows.forEach(([skill, level], si) => {
      const y = tableTop + rowH + si * rowH;
      const bg = si % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(tableX, y, tableWidth, rowH).fill(bg);
      doc.lineWidth(0.5).strokeColor('#e2e8f0').rect(tableX, y, tableWidth, rowH).stroke();

      // Skill name
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
        .text(skill, tableX + 24, y + 11, { width: skillColW - 24, align: 'left' });

      // CEFR badge with color coding
      if (level && level !== '') {
        const cellBadgeW = 80;
        const cellBadgeH = 22;
        const cellBadgeX = tableX + skillColW + (levelColW - cellBadgeW) / 2;
        doc.roundedRect(cellBadgeX, y + 6, cellBadgeW, cellBadgeH, 4).fill(cefrColor(level));
        doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
          .text(level, cellBadgeX, y + 11, { width: cellBadgeW, align: 'center' });
      } else {
        doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
          .text('Pending review', tableX + skillColW, y + 11, { width: levelColW, align: 'center' });
      }
    });

    // Total / Final row
    const totalY = tableTop + rowH + skillRows.length * rowH;
    doc.rect(tableX, totalY, tableWidth, rowH).fill('#0f274a');
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
      .text('Final CEFR Placement', tableX + 24, totalY + 11, { width: skillColW - 24, align: 'left' });
    if (overallLevel) {
      const cellBadgeW = 80;
      const cellBadgeH = 22;
      const cellBadgeX = tableX + skillColW + (levelColW - cellBadgeW) / 2;
      doc.roundedRect(cellBadgeX, totalY + 6, cellBadgeW, cellBadgeH, 4).fill(cefrColor(overallLevel));
      doc.fillColor('#ffffff').fontSize(10.5).font('Helvetica-Bold')
        .text(overallLevel, cellBadgeX, totalY + 11, { width: cellBadgeW, align: 'center' });
    } else {
      doc.fillColor('#94a3b8').fontSize(9.5).font('Helvetica')
        .text('Pending review', tableX + skillColW, totalY + 11, { width: levelColW, align: 'center' });
    }

    // ── Placement analysis ───────────────────────────────────────────
    const analysisY = totalY + rowH + 24;
    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Placement Analysis', 0, analysisY, { width: 595, align: 'center' });
    doc.font('Helvetica').fontSize(9.5).fillColor('#334155')
      .text(row.analysis, tableX, analysisY + 18, { width: tableWidth, lineGap: 4, align: 'center' });

    // ── Footer ───────────────────────────────────────────────────────
    const oldBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.rect(0, 800, 595, 42).fill('#f8fafc');
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
      .text('This document is an internal placement record issued by Karya Bangsa School. It does not constitute an official CEFR or IELTS certificate.', 42, 814, { width: 511, align: 'center' });
    doc.page.margins.bottom = oldBottomMargin;
  });
  doc.end();
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/api/health') return json(response, 200, { ok: true, service: 'assessify-api', storage: storageMode });
  if (url.pathname === '/api/test') return json(response, 200, safeTest());
  if (url.pathname === '/api/auth/me') return json(response, 200, { user: currentUser(request) || null });
  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const { email, fullName, name, username, password, role = 'teacher', unit } = await requestBody(request);
    if (role === 'admin') {
      const normalizedUsername = (username || '').toLowerCase().trim();
      const dbAccount = await repository.getAdmin(normalizedUsername);
      const fallbackAccount = adminAccounts[normalizedUsername];
      const account = dbAccount || fallbackAccount;
      if (!account || !account.password || password !== account.password) {
        return json(response, 401, { error: 'Invalid admin credentials' });
      }
      if (account.status === 'suspended') {
        return json(response, 403, { error: 'Your administrative account has been suspended. Please contact administration.' });
      }
      if (account.status === 'archived') {
        return json(response, 403, { error: 'Your administrative account has been archived. Please contact administration.' });
      }
      const user = { username: normalizedUsername, name: account.name || 'Admin', role: 'admin' };
      const token = createSession(user);
      response.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': `assessify_session=${token}; HttpOnly; SameSite=Lax; Path=/` });
      return response.end(JSON.stringify({ user }));
    }
    if (role === 'teacher') {
      const normalizedEmail = (email || '').toLowerCase().trim();
      if (!normalizedEmail || !normalizedEmail.endsWith('@karyabangsa.sch.id')) {
        return json(response, 403, { error: 'Please enter your official Karya Bangsa School email (@karyabangsa.sch.id).' });
      }

      const selectedUnit = (unit || '').trim();
      if (!selectedUnit) {
        return json(response, 400, { error: 'Please select your School Unit.' });
      }

      // Strict Teacher Whitelist Check
      const teacherRecord = authorizedTeachers.find((t) => t.email.toLowerCase().trim() === normalizedEmail);
      if (!teacherRecord) {
        return json(response, 403, {
          error: `Access Denied: "${normalizedEmail}" is not recognized in the authorized teacher roster. Please use your official school email or contact administration.`
        });
      }

      if (teacherRecord.status === 'suspended') {
        return json(response, 403, { error: 'Your account has been suspended. Please contact administration.' });
      }
      if (teacherRecord.status === 'archived') {
        return json(response, 403, { error: 'Your account has been archived. Please contact administration.' });
      }

      // Strict Unit Match Check
      if (teacherRecord.unit.toLowerCase().trim() !== selectedUnit.toLowerCase().trim()) {
        return json(response, 400, {
          error: `Unit Mismatch: ${normalizedEmail} is registered under "${teacherRecord.unit}", but you selected "${selectedUnit}". Please select your correct unit.`
        });
      }

      const teacherName = (fullName || name || '').trim() || teacherRecord.name;
      const user = { email: normalizedEmail, name: teacherName, role: 'teacher', unit: teacherRecord.unit };
      const token = createSession(user);
      response.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': `assessify_session=${token}; HttpOnly; SameSite=Lax; Path=/` });
      return response.end(JSON.stringify({ user }));
    }
    return json(response, 400, { error: 'Invalid user role' });
  }
  if (url.pathname === '/api/auth/teacher-lookup' && request.method === 'GET') {
    const qEmail = (url.searchParams.get('email') || '').toLowerCase().trim();
    if (!qEmail) return json(response, 400, { error: 'Email parameter is required' });
    const match = authorizedTeachers.find((t) => t.email.toLowerCase().trim() === qEmail);
    if (!match) return json(response, 404, { found: false, error: 'Teacher not found in roster' });
    return json(response, 200, { found: true, email: match.email, unit: match.unit, name: match.name });
  }
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') { response.writeHead(204, { 'Set-Cookie': 'assessify_session=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/' }); return response.end(); }
  if (url.pathname === '/api/admin/google-workspace/connect' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      googleOAuthState = crypto.randomUUID();
      const auth = googleClient();
      const authorizationUrl = auth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: ['https://www.googleapis.com/auth/calendar'], state: googleOAuthState });
      response.writeHead(302, { Location: authorizationUrl });
      return response.end();
    } catch (error) { return json(response, 503, { error: error.message }); }
  }
  if (url.pathname === '/api/admin/google-workspace/callback' && request.method === 'GET') {
    if (!isAdmin(request) || !url.searchParams.get('code') || url.searchParams.get('state') !== googleOAuthState) return json(response, 400, { error: 'Google Workspace authorization could not be verified' });
    try {
      const auth = googleClient();
      const { tokens } = await auth.getToken(url.searchParams.get('code'));
      if (!tokens.refresh_token) throw new Error('Google did not return a refresh token. Remove Assessify access in Google and connect again.');
      await repository.setSetting('googleRefreshToken', tokens.refresh_token);
      googleOAuthState = null;
      response.writeHead(302, { Location: '/?google_workspace=connected' });
      return response.end();
    } catch (error) { return json(response, 503, { error: error.message }); }
  }
  if (url.pathname === '/api/speaking-meeting' && request.method === 'GET') {
    const user = currentUser(request);
    if (!user || user.role !== 'teacher') return json(response, 401, { error: 'Teacher sign-in required' });
    return json(response, 410, { error: 'Speaking links are created automatically after assessment submission' });
  }
  if (url.pathname === '/api/admin/results') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const results = await repository.listAttempts();
    return json(response, 200, { total: results.length, results });
  }
  if (url.pathname === '/api/admin/results/export') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const unitFilter = url.searchParams.get('unit') || 'all';
    const idsParam = url.searchParams.get('ids');
    let results = await repository.listAttempts();
    if (idsParam) {
      const idList = idsParam.split(',').map((s) => s.trim().toLowerCase());
      results = results.filter((r) => idList.includes(String(r.id || '').toLowerCase()));
    } else if (unitFilter && unitFilter.toLowerCase() !== 'all') {
      results = results.filter((r) => String(r.unit || '').trim().toLowerCase() === unitFilter.trim().toLowerCase());
    }
    if (url.searchParams.get('format') === 'pdf') return sendCenteredPdf(response, results, unitFilter);
    if (url.searchParams.get('format') === 'xlsx') return sendExcel(response, results, unitFilter);
    return json(response, 400, { error: 'Use format=xlsx or format=pdf' });
  }
  if (url.pathname === '/api/admin/results/bulk-delete' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const { ids } = await requestBody(request);
      if (!Array.isArray(ids) || !ids.length) return json(response, 400, { error: 'No candidate attempt IDs provided' });
      for (const id of ids) {
        await repository.deleteAttempt(id);
      }
      return json(response, 200, { success: true, deletedCount: ids.length });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  // Authorized Teachers / User Management
  if (url.pathname === '/api/admin/teachers' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const search = (url.searchParams.get('search') || '').toLowerCase().trim();
    const unitFilter = (url.searchParams.get('unit') || '').trim();
    let teachers = await repository.listTeachers();
    if (unitFilter && unitFilter.toLowerCase() !== 'all') {
      teachers = teachers.filter((t) => (t.unit || '').toLowerCase() === unitFilter.toLowerCase());
    }
    if (search) {
      teachers = teachers.filter((t) => (t.name || '').toLowerCase().includes(search) || (t.email || '').toLowerCase().includes(search));
    }
    return json(response, 200, { total: teachers.length, teachers });
  }

  if (url.pathname === '/api/admin/teachers' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const body = await requestBody(request);
      const name = (body.name || '').trim();
      const email = (body.email || '').toLowerCase().trim();
      const unit = (body.unit || '').trim();

      if (!name) return json(response, 400, { error: 'Teacher full name is required' });
      if (!email) return json(response, 400, { error: 'Official school email is required' });
      const schoolDomain = process.env.SCHOOL_DOMAIN || 'karyabangsa.sch.id';
      if (!email.endsWith(`@${schoolDomain}`)) {
        return json(response, 400, { error: `Email must end with official domain @${schoolDomain}` });
      }
      if (!unit) return json(response, 400, { error: 'School unit assignment is required' });

      // Check for duplicate email
      const existing = await repository.getTeacher(email);
      if (existing) {
        return json(response, 409, { error: `A teacher with email "${email}" is already registered.` });
      }

      const status = (body.status || 'active').toLowerCase().trim();
      const created = await repository.createTeacher({ name, email, unit, status });
      await syncAuthorizedTeachersBackup();
      return json(response, 201, { success: true, teacher: created });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  // Teacher Status Change (suspend, archive, activate)
  if (url.pathname.startsWith('/api/admin/teachers/') && url.pathname.endsWith('/status') && (request.method === 'PUT' || request.method === 'PATCH')) {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const parts = url.pathname.split('/');
      const idOrEmail = decodeURIComponent(parts[parts.length - 2]);
      const body = await requestBody(request);
      const status = (body.status || '').toLowerCase().trim();
      if (!['active', 'suspended', 'archived'].includes(status)) {
        return json(response, 400, { error: 'Status must be active, suspended, or archived.' });
      }

      const current = await repository.getTeacher(idOrEmail);
      if (!current) return json(response, 404, { error: 'Teacher not found' });

      const updated = await repository.updateTeacher(current.id, { status });
      await syncAuthorizedTeachersBackup();
      return json(response, 200, { success: true, teacher: updated });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  if (url.pathname.startsWith('/api/admin/teachers/') && request.method === 'PUT') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const idOrEmail = decodeURIComponent(url.pathname.slice('/api/admin/teachers/'.length));
      const body = await requestBody(request);
      const name = (body.name || '').trim();
      const email = (body.email || '').toLowerCase().trim();
      const unit = (body.unit || '').trim();

      if (!name) return json(response, 400, { error: 'Teacher full name is required' });
      if (!email) return json(response, 400, { error: 'Official school email is required' });
      const schoolDomain = process.env.SCHOOL_DOMAIN || 'karyabangsa.sch.id';
      if (!email.endsWith(`@${schoolDomain}`)) {
        return json(response, 400, { error: `Email must end with official domain @${schoolDomain}` });
      }
      if (!unit) return json(response, 400, { error: 'School unit assignment is required' });

      const current = await repository.getTeacher(idOrEmail);
      if (!current) return json(response, 404, { error: 'Teacher not found' });

      // Check if email changed and if new email is already used by someone else
      if (email !== current.email.toLowerCase()) {
        const duplicate = await repository.getTeacher(email);
        if (duplicate && String(duplicate.id) !== String(current.id)) {
          return json(response, 409, { error: `Email "${email}" is already in use by another teacher.` });
        }
      }

      const status = body.status && ['active', 'suspended', 'archived'].includes(body.status.toLowerCase().trim())
        ? body.status.toLowerCase().trim()
        : current.status || 'active';

      const updated = await repository.updateTeacher(current.id, { name, email, unit, status });
      await syncAuthorizedTeachersBackup();
      return json(response, 200, { success: true, teacher: updated });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  if (url.pathname.startsWith('/api/admin/teachers/') && request.method === 'DELETE') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const idOrEmail = decodeURIComponent(url.pathname.slice('/api/admin/teachers/'.length));
      const current = await repository.getTeacher(idOrEmail);
      if (!current) return json(response, 404, { error: 'Teacher not found' });

      const deleted = await repository.deleteTeacher(current.id);
      if (deleted) {
        await syncAuthorizedTeachersBackup();
        return json(response, 200, { success: true });
      }
      return json(response, 404, { error: 'Teacher not found or could not be deleted' });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  // Administrator Accounts Management
  if (url.pathname === '/api/admin/admins' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const admins = await repository.listAdmins();
    return json(response, 200, { total: admins.length, admins });
  }

  if (url.pathname === '/api/admin/admins' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const body = await requestBody(request);
      const username = (body.username || '').toLowerCase().trim();
      const name = (body.name || '').trim();
      const password = (body.password || '').trim();
      const email = (body.email || '').toLowerCase().trim();
      const status = (body.status || 'active').toLowerCase().trim();

      if (!username || username.length < 3) return json(response, 400, { error: 'Username must be at least 3 characters.' });
      if (!name) return json(response, 400, { error: 'Full name is required for administrator.' });
      if (!password || password.length < 4) return json(response, 400, { error: 'Password must be at least 4 characters.' });

      const existing = await repository.getAdmin(username);
      if (existing) {
        return json(response, 409, { error: `Admin username "${username}" already exists.` });
      }

      const created = await repository.createAdmin({ username, password, name, email: email || null, status });
      return json(response, 201, { success: true, admin: created });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  // Admin Status Change (suspend, archive, activate)
  if (url.pathname.startsWith('/api/admin/admins/') && url.pathname.endsWith('/status') && (request.method === 'PUT' || request.method === 'PATCH')) {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const parts = url.pathname.split('/');
      const idOrUsername = decodeURIComponent(parts[parts.length - 2]);
      const body = await requestBody(request);
      const status = (body.status || '').toLowerCase().trim();
      if (!['active', 'suspended', 'archived'].includes(status)) {
        return json(response, 400, { error: 'Status must be active, suspended, or archived.' });
      }

      const current = await repository.getAdmin(idOrUsername);
      if (!current) return json(response, 404, { error: 'Administrator not found' });

      const currentAdmin = currentUser(request);
      if (status !== 'active' && currentAdmin && (currentAdmin.username === current.username || String(currentAdmin.id) === String(current.id))) {
        return json(response, 400, { error: 'Cannot suspend or archive your own active administrator account.' });
      }

      const updated = await repository.updateAdmin(current.id, { status });
      return json(response, 200, { success: true, admin: updated });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  if (url.pathname.startsWith('/api/admin/admins/') && request.method === 'PUT') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const idOrUsername = decodeURIComponent(url.pathname.slice('/api/admin/admins/'.length));
      const body = await requestBody(request);
      const name = (body.name || '').trim();
      const password = (body.password || '').trim();
      const email = (body.email || '').toLowerCase().trim();
      const username = (body.username || '').toLowerCase().trim();
      const status = body.status ? body.status.toLowerCase().trim() : undefined;

      const current = await repository.getAdmin(idOrUsername);
      if (!current) return json(response, 404, { error: 'Administrator not found' });

      if (username && username !== current.username) {
        const dup = await repository.getAdmin(username);
        if (dup && String(dup.id) !== String(current.id)) {
          return json(response, 409, { error: `Username "${username}" is already in use.` });
        }
      }

      const currentAdmin = currentUser(request);
      if (status && status !== 'active' && currentAdmin && (currentAdmin.username === current.username || String(currentAdmin.id) === String(current.id))) {
        return json(response, 400, { error: 'Cannot suspend or archive your own active administrator account.' });
      }

      const updated = await repository.updateAdmin(current.id, {
        username: username || current.username,
        name: name || current.name,
        password: password || undefined,
        email: email || current.email,
        status: status || current.status || 'active'
      });
      return json(response, 200, { success: true, admin: updated });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  if (url.pathname.startsWith('/api/admin/admins/') && request.method === 'DELETE') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const idOrUsername = decodeURIComponent(url.pathname.slice('/api/admin/admins/'.length));
      const current = await repository.getAdmin(idOrUsername);
      if (!current) return json(response, 404, { error: 'Administrator not found' });

      const allAdmins = await repository.listAdmins();
      if (allAdmins.length <= 1) {
        return json(response, 400, { error: 'Cannot delete the last remaining administrator account.' });
      }

      const currentAdmin = currentUser(request);
      if (currentAdmin && (currentAdmin.username === current.username || String(currentAdmin.id) === String(current.id))) {
        return json(response, 400, { error: 'Cannot delete your own active administrator account.' });
      }

      const deleted = await repository.deleteAdmin(current.id);
      if (deleted) return json(response, 200, { success: true });
      return json(response, 404, { error: 'Administrator could not be deleted' });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  // Unified Users Listing (Teachers + Admins)
  if (url.pathname === '/api/admin/users' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const teachers = await repository.listTeachers();
    const admins = await repository.listAdmins();
    return json(response, 200, {
      total: teachers.length + admins.length,
      teachersCount: teachers.length,
      adminsCount: admins.length,
      teachers,
      admins
    });
  }

  if (url.pathname === '/api/admin/users/bulk-status' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const { targets, status } = await requestBody(request);
      if (!['active', 'suspended', 'archived'].includes(status)) {
        return json(response, 400, { error: 'Invalid status. Must be active, suspended, or archived.' });
      }
      const currentAdmin = currentUser(request);
      let updatedCount = 0;
      for (const target of targets || []) {
        if (target.role === 'admin') {
          if (status !== 'active' && currentAdmin && (currentAdmin.username === target.username || String(currentAdmin.id) === String(target.id))) {
            continue; // skip self-suspension/archival
          }
          await repository.updateAdmin(target.id, { status });
          updatedCount++;
        } else {
          await repository.updateTeacher(target.id, { status });
          updatedCount++;
        }
      }
      await syncAuthorizedTeachersBackup();
      return json(response, 200, { success: true, updatedCount });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  if (url.pathname === '/api/admin/users/bulk-delete' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const { targets } = await requestBody(request);
      const currentAdmin = currentUser(request);
      let deletedCount = 0;
      for (const target of targets || []) {
        if (target.role === 'admin') {
          const allAdmins = await repository.listAdmins();
          if (allAdmins.length <= 1) continue;
          if (currentAdmin && (currentAdmin.username === target.username || String(currentAdmin.id) === String(target.id))) continue;
          await repository.deleteAdmin(target.id);
          deletedCount++;
        } else {
          await repository.deleteTeacher(target.id);
          deletedCount++;
        }
      }
      await syncAuthorizedTeachersBackup();
      return json(response, 200, { success: true, deletedCount });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  // Question Bank Management
  if (url.pathname === '/api/admin/questions/template' && request.method === 'GET') {
    const templatePath = join(root, 'content', 'templates', 'question-bank-template.json');
    try {
      const templateData = await readFile(templatePath, 'utf8');
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="question-bank-template.json"'
      });
      return response.end(templateData);
    } catch (e) {
      return json(response, 404, { error: 'Template file not found' });
    }
  }
  if ((url.pathname === '/api/admin/questions/template/writing' || url.pathname === '/api/admin/questions/writing-template') && request.method === 'GET') {
    const templatePath = join(root, 'content', 'templates', 'writing-topics-template.json');
    try {
      const templateData = await readFile(templatePath, 'utf8');
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="writing-topics-template.json"'
      });
      return response.end(templateData);
    } catch (e) {
      return json(response, 404, { error: 'Writing template file not found' });
    }
  }
  if (url.pathname === '/api/admin/questions' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    return json(response, 200, content);
  }
  if (url.pathname === '/api/admin/questions/upload' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const uploaded = await requestBody(request);
      let newContent;

      const isWritingTemplate = uploaded && (
        (Array.isArray(uploaded.topics) && !uploaded.sections) ||
        (uploaded.id === 'writing' && Array.isArray(uploaded.topics)) ||
        (Array.isArray(uploaded) && uploaded.length > 0 && uploaded[0].title && uploaded[0].prompt)
      );

      if (isWritingTemplate) {
        const topicsList = Array.isArray(uploaded) ? uploaded : uploaded.topics;
        newContent = JSON.parse(JSON.stringify(content));
        if (!Array.isArray(newContent.sections)) newContent.sections = [];
        let writingSec = newContent.sections.find((s) => s.id === 'writing');
        if (!writingSec) {
          writingSec = {
            id: 'writing',
            label: 'Writing Placement Test',
            durationMinutes: 20,
            selectionType: 'single_choice',
            requiredSelections: 1,
            instructions: 'Choose ONE of these topics and write about it. Create 1 Essay based on your selected topic (20 minutes).',
            topics: [],
            questions: []
          };
          newContent.sections.push(writingSec);
        }
        writingSec.selectionType = uploaded.selectionType || 'single_choice';
        writingSec.requiredSelections = uploaded.requiredSelections || 1;
        if (uploaded.instructions) writingSec.instructions = uploaded.instructions;
        if (uploaded.durationMinutes) writingSec.durationMinutes = uploaded.durationMinutes;
        writingSec.topics = topicsList;
        writingSec.questions = [...topicsList];
      } else if (uploaded && Array.isArray(uploaded.sections) && uploaded.sections.length > 0) {
        newContent = uploaded;
      } else {
        return json(response, 400, {
          error: 'Invalid format: Must be either a full question bank with "sections" or a writing template with "topics".'
        });
      }

      await saveQuestions(newContent);
      return json(response, 200, { success: true, totalSections: newContent.sections.length });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }
  if (url.pathname === '/api/admin/questions/delete' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const { sectionId, questionId, clearSection, deleteAll, deletePassage, passageIndex } = await requestBody(request);

      if (deleteAll) {
        let totalRemoved = 0;
        (content.sections || []).forEach((sec) => {
          totalRemoved += (sec.questions || []).length || (sec.topics || []).length;
          sec.questions = [];
          if (sec.topics) sec.topics = [];
          delete sec.passage;
          sec.passages = [];
        });
        await saveQuestions(content);
        return json(response, 200, {
          success: true,
          deleteAll: true,
          deletedCount: totalRemoved,
          remainingQuestions: 0
        });
      }

      if (!sectionId) {
        return json(response, 400, { error: 'sectionId is required' });
      }
      const section = (content.sections || []).find((s) => s.id === sectionId);
      if (!section) return json(response, 404, { error: `Section "${sectionId}" not found` });

      if (deletePassage) {
        if (passageIndex !== undefined && passageIndex !== null && Array.isArray(section.passages)) {
          const idx = Number(passageIndex);
          if (idx >= 0 && idx < section.passages.length) {
            const [removedPassage] = section.passages.splice(idx, 1);
            await saveQuestions(content);
            return json(response, 200, {
              success: true,
              sectionId,
              deletedPassage: true,
              passageTitle: removedPassage?.title || `Passage ${idx + 1}`,
              remainingPassages: section.passages.length
            });
          }
        }
        delete section.passage;
        section.passages = [];
        await saveQuestions(content);
        return json(response, 200, {
          success: true,
          sectionId,
          deletedPassage: true
        });
      }

      if (clearSection) {
        const removedCount = (section.questions || []).length || (section.topics || []).length;
        section.questions = [];
        if (section.topics) section.topics = [];
        delete section.passage;
        section.passages = [];
        await saveQuestions(content);
        return json(response, 200, {
          success: true,
          sectionId,
          cleared: true,
          deletedCount: removedCount,
          remainingQuestions: 0
        });
      }

      if (!questionId) {
        return json(response, 400, { error: 'questionId is required' });
      }

      const qIdx = (section.questions || []).findIndex((q) => q.id === questionId);
      const tIdx = (section.topics || []).findIndex((t) => t.id === questionId);

      if (qIdx === -1 && tIdx === -1) {
        return json(response, 404, { error: `Topic or Question "${questionId}" not found in section` });
      }

      let removedPrompt = '';
      if (qIdx !== -1) {
        const [removed] = section.questions.splice(qIdx, 1);
        removedPrompt = removed?.prompt || removed?.title;
      }
      if (tIdx !== -1) {
        const [removedT] = section.topics.splice(tIdx, 1);
        if (!removedPrompt) removedPrompt = removedT?.title || removedT?.prompt;
      }

      await saveQuestions(content);
      const remainingCount = (section.questions || []).length || (section.topics || []).length;
      return json(response, 200, {
        success: true,
        deletedId: questionId,
        prompt: removedPrompt,
        remainingQuestions: remainingCount
      });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  // Rubrics Management
  if (url.pathname === '/api/admin/rubrics/template' && request.method === 'GET') {
    const templatePath = join(root, 'content', 'templates', 'rubrics-template.json');
    try {
      const templateData = await readFile(templatePath, 'utf8');
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="rubrics-template.json"'
      });
      return response.end(templateData);
    } catch (e) {
      return json(response, 404, { error: 'Template file not found' });
    }
  }
  if (url.pathname === '/api/admin/rubrics' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    return json(response, 200, rubrics);
  }
  if (url.pathname === '/api/admin/rubrics/upload' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const newRubrics = await requestBody(request);
      if (!newRubrics || !newRubrics.writing || !newRubrics.speaking) {
        return json(response, 400, { error: 'Invalid rubrics: Must contain "writing" and "speaking" configuration objects.' });
      }
      await saveRubrics(newRubrics);
      return json(response, 200, { success: true });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }
  if (url.pathname === '/api/admin/rubrics/delete' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const { skillKey, criterionIndex, clearSkill, deleteAll } = await requestBody(request);

      if (deleteAll) {
        let totalRemoved = 0;
        const skillKeys = ['writing', 'speaking', 'listening', 'reading', 'grammarVocabulary'];
        skillKeys.forEach((k) => {
          if (rubrics[k] && Array.isArray(rubrics[k].criteria)) {
            totalRemoved += rubrics[k].criteria.length;
            rubrics[k].criteria = [];
          }
        });
        await saveRubrics(rubrics);
        return json(response, 200, {
          success: true,
          deleteAll: true,
          deletedCount: totalRemoved,
          remainingCriteria: 0
        });
      }

      if (!skillKey) {
        return json(response, 400, { error: 'skillKey is required' });
      }
      const skillObj = rubrics[skillKey];
      if (!skillObj || !Array.isArray(skillObj.criteria)) {
        return json(response, 404, { error: `Skill "${skillKey}" or criteria array not found` });
      }

      if (clearSkill) {
        const removedCount = skillObj.criteria.length;
        skillObj.criteria = [];
        await saveRubrics(rubrics);
        return json(response, 200, {
          success: true,
          skillKey,
          cleared: true,
          deletedCount: removedCount,
          remainingCriteria: 0
        });
      }

      if (criterionIndex === undefined || criterionIndex === null) {
        return json(response, 400, { error: 'criterionIndex is required' });
      }

      const idx = Number(criterionIndex);
      if (idx < 0 || idx >= skillObj.criteria.length) {
        return json(response, 404, { error: `Criterion index ${idx} is out of range` });
      }

      const [removed] = skillObj.criteria.splice(idx, 1);
      await saveRubrics(rubrics);
      return json(response, 200, {
        success: true,
        skillKey,
        deletedName: removed?.name,
        remainingCriteria: skillObj.criteria.length
      });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  if (url.pathname.startsWith('/api/admin/results/') && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const attemptId = url.pathname.split('/').pop();
    let attempt = await repository.getAttempt(attemptId);
    if (!attempt) return json(response, 404, { error: 'Attempt not found' });
    if (attempt.scoring?.grammarVocabulary && typeof attempt.scoring.grammarVocabulary.correct === 'number') {
      const correct = attempt.scoring.grammarVocabulary.correct;
      const total = attempt.scoring.grammarVocabulary.total || 50;
      const currentLevel = cefrFromCorrect(correct, total, rubrics);
      if (attempt.scoring.grammarVocabulary.level !== currentLevel || attempt.sectionScores?.['Grammar & Vocabulary'] !== currentLevel) {
        const maxRange = rubrics?.bandScale?.range || (rubrics?.writing?.levels?.some((l) => l.level === 'C2') ? 'A1–C2' : 'A1–C1');
        attempt.scoring.grammarVocabulary.level = currentLevel;
        attempt.scoring.grammarVocabulary.method = `Objective answer-key scoring mapped to CEFR (${maxRange}) per active rubrics`;
        attempt.sectionScores = {
          ...(attempt.sectionScores || {}),
          'Grammar & Vocabulary': currentLevel
        };
        const finalPlacement = computeFinalPlacement(attempt.sectionScores);
        if (finalPlacement) {
          attempt.overall = finalPlacement;
        }
        await repository.updateAttempt(attempt.id, attempt);
      }
    }
    return json(response, 200, { attempt, review: { writing: 'Pending teacher review', speaking: 'Pending teacher review' } });
  }
  if (url.pathname.startsWith('/api/admin/results/') && request.method === 'DELETE') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const deleted = await repository.deleteAttempt(url.pathname.split('/').pop());
    return deleted ? json(response, 200, { success: true }) : json(response, 404, { error: 'Attempt not found' });
  }
  if (url.pathname.startsWith('/api/admin/results/') && url.pathname.endsWith('/review') && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const attemptId = url.pathname.split('/')[4];
      const attempt = await repository.getAttempt(attemptId);
      if (!attempt) return json(response, 404, { error: 'Attempt not found' });
      const { writing, speaking } = await requestBody(request);
      const manualReview = { writing: rubricLevel(writing, 'writing'), speaking: rubricLevel(speaking, 'speaking'), reviewedAt: new Date().toISOString() };
      const sectionScores = { ...(attempt.sectionScores || {}) };
      if (attempt.scoring?.grammarVocabulary && typeof attempt.scoring.grammarVocabulary.correct === 'number') {
        sectionScores['Grammar & Vocabulary'] = cefrFromCorrect(attempt.scoring.grammarVocabulary.correct, attempt.scoring.grammarVocabulary.total || 50, rubrics);
      }
      if (manualReview.writing.level) sectionScores.Writing = manualReview.writing.level;
      if (manualReview.speaking.level) sectionScores.Speaking = manualReview.speaking.level;
      const finalPlacement = computeFinalPlacement(sectionScores);
      const isComplete = Boolean(manualReview.writing.level && manualReview.speaking.level);
      await repository.updateAttempt(attemptId, {
        manualReview,
        sectionScores,
        ...(finalPlacement ? { overall: finalPlacement } : {}),
        review: isComplete ? 'Teacher reviewed' : 'Review in progress'
      });
      return json(response, 200, { manualReview, sectionScores, overall: finalPlacement || attempt.overall });
    } catch (error) { return json(response, 400, { error: error.message }); }
  }
  if (url.pathname.startsWith('/api/attempts/') && url.pathname.endsWith('/certificate') && request.method === 'GET') {
    const user = currentUser(request);
    if (!user) return json(response, 401, { error: 'Sign-in required' });
    const attemptId = url.pathname.split('/')[3];
    const attempt = await repository.getAttempt(attemptId);
    if (!attempt) return json(response, 404, { error: 'Attempt not found' });
    if (user.role !== 'admin' && (attempt.email || '').toLowerCase().trim() !== (user.email || '').toLowerCase().trim()) {
      return json(response, 403, { error: 'Access denied' });
    }
    return sendCenteredPdf(response, [attempt], attempt.unit || 'all');
  }
  if (url.pathname.startsWith('/api/attempts/') && url.pathname.endsWith('/recording') && request.method === 'POST') {
    const user = currentUser(request);
    if (!user || user.role !== 'teacher') return json(response, 401, { error: 'Teacher sign-in required' });
    const attemptId = url.pathname.split('/')[3];
    const attempt = await repository.getAttempt(attemptId);
    if (!attempt || attempt.email !== user.email) return json(response, 404, { error: 'Attempt not found' });
    if (attempt.status === 'Completed') return json(response, 409, { error: 'This assessment has already been submitted.' });

    const contentType = request.headers['content-type'] || 'video/webm';
    const durationSeconds = Number(request.headers['x-duration-seconds']) || 0;

    const ext = contentType.includes('mp4') ? 'mp4' : contentType.includes('ogg') ? 'ogg' : 'webm';
    const filename = `${attemptId}.${ext}`;
    const filePath = join(uploadsDir, filename);

    try {
      const fileStream = createWriteStream(filePath);
      await pipeline(request, fileStream);
      const fileUrl = `/api/attempts/${attemptId}/recording`;
      const recordingMeta = {
        mimeType: contentType,
        durationSeconds,
        fileUrl,
        filename
      };
      await repository.updateAttempt(attemptId, { speakingRecording: recordingMeta });
      return json(response, 200, { success: true, recording: recordingMeta });
    } catch (error) {
      return json(response, 500, { error: `Failed to save recording: ${error.message}` });
    }
  }

  if (url.pathname.startsWith('/api/attempts/') && url.pathname.endsWith('/recording') && request.method === 'GET') {
    const user = currentUser(request);
    if (!user) return json(response, 401, { error: 'Authentication required' });
    const attemptId = url.pathname.split('/')[3];
    const attempt = await repository.getAttempt(attemptId);
    if (!attempt) return json(response, 404, { error: 'Attempt not found' });
    if (user.role !== 'admin' && attempt.email !== user.email) return json(response, 403, { error: 'Access denied' });

    const possibleExts = ['webm', 'mp4', 'ogg'];
    let foundFile = null;
    let foundExt = 'webm';
    for (const ext of possibleExts) {
      const p = join(uploadsDir, `${attemptId}.${ext}`);
      try {
        await stat(p);
        foundFile = p;
        foundExt = ext;
        break;
      } catch { }
    }

    if (!foundFile) {
      return json(response, 404, { error: 'Recording file not found' });
    }

    try {
      const fileStat = await stat(foundFile);
      const fileSize = fileStat.size;
      const range = request.headers.range;
      const mimeType = attempt.speakingRecording?.mimeType || `video/${foundExt}`;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
          response.writeHead(416, {
            'Content-Range': `bytes */${fileSize}`,
            'Accept-Ranges': 'bytes'
          });
          return response.end();
        }

        const chunksize = (end - start) + 1;
        const fileStream = createReadStream(foundFile, { start, end });
        response.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': mimeType
        });
        return fileStream.pipe(response);
      } else {
        response.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes'
        });
        return createReadStream(foundFile).pipe(response);
      }
    } catch (error) {
      return json(response, 500, { error: error.message });
    }
  }

  if (url.pathname.startsWith('/api/attempts/') && url.pathname.endsWith('/submit') && request.method === 'POST') {
    const user = currentUser(request);
    if (!user || user.role !== 'teacher') return json(response, 401, { error: 'Teacher sign-in required' });
    const attemptId = url.pathname.split('/')[3];
    const attempt = await repository.getAttempt(attemptId);
    if (!attempt || attempt.email !== user.email) return json(response, 404, { error: 'Attempt not found' });
    if (attempt.status === 'Completed') return json(response, 409, { error: 'This assessment has already been submitted.' });
    const { writing = '', speaking = '', responses = {}, speakingRecording = null, earlyTermination = false } = await requestBody(request);
    if (speakingRecording?.dataUrl && speakingRecording.dataUrl.length > 14_000_000) return json(response, 413, { error: 'Speaking recording is too large. Please record a shorter response.' });
    const grammarVocabularyScore = scoreObjective('grammar-vocabulary', responses);
    // All section scores are now CEFR levels (A1/A2/B1/B2/C1)
    const sectionScores = {
      ...(attempt.sectionScores || {}),
      'Grammar & Vocabulary': grammarVocabularyScore.level
    };
    // Provisional placement based on Grammar & Vocabulary (Writing + Speaking pending evaluator review)
    const provisionalPlacement = computeFinalPlacement(sectionScores);
    
    // Combine any existing recording metadata (e.g. from prior /recording endpoint upload) with incoming submission
    const existingRecording = attempt.speakingRecording || null;
    let finalRecording = null;
    if (existingRecording?.fileUrl) {
      finalRecording = {
        ...existingRecording,
        ...(speakingRecording || {}),
        earlyTermination: Boolean(earlyTermination)
      };
    } else if (speakingRecording) {
      finalRecording = {
        mimeType: speakingRecording.mimeType,
        durationSeconds: speakingRecording.durationSeconds,
        transcriptSource: speakingRecording.transcriptSource,
        fileUrl: speakingRecording.fileUrl || null,
        dataUrl: speakingRecording.dataUrl || null,
        earlyTermination: Boolean(earlyTermination)
      };
    }

    const scored = {
      ...attempt,
      status: 'Completed',
      earlyTermination: Boolean(earlyTermination),
      sectionScores,
      overall: provisionalPlacement,
      review: 'Writing and Speaking review required',
      scoring: { grammarVocabulary: grammarVocabularyScore },
      responses,
      writing,
      speaking,
      speakingRecording: finalRecording,
      submittedAt: new Date().toISOString()
    };
    await repository.updateAttempt(attemptId, scored);
    let speakingMeetUrl = null;
    try {
      speakingMeetUrl = await createSpeakingMeet(scored);
      scored.speakingMeetUrl = speakingMeetUrl;
      await repository.updateAttempt(attemptId, { speakingMeetUrl });
    } catch { }
    return json(response, 200, { attempt: scored, speakingMeetUrl });
  }

  // Auto-Save Draft Progress Endpoint (resilient to power cuts and connection loss)
  if (url.pathname.startsWith('/api/attempts/') && url.pathname.endsWith('/draft') && request.method === 'POST') {
    const user = currentUser(request);
    if (!user || user.role !== 'teacher') return json(response, 401, { error: 'Teacher sign-in required' });
    const attemptId = url.pathname.split('/')[3];
    const attempt = await repository.getAttempt(attemptId);
    if (!attempt || (attempt.email || '').toLowerCase().trim() !== user.email.toLowerCase().trim()) {
      return json(response, 404, { error: 'Attempt not found' });
    }
    if (attempt.status === 'Completed') {
      return json(response, 409, { error: 'Assessment has already been submitted.' });
    }
    try {
      const body = await requestBody(request);
      const update = {};
      if (body.responses && typeof body.responses === 'object') {
        update.responses = Object.assign({}, attempt.responses || {}, body.responses);
      }
      if (body.writing !== undefined) update.writing = body.writing;
      if (body.speaking !== undefined) update.speaking = body.speaking;
      if (body.sectionIndex !== undefined) update.sectionIndex = Number(body.sectionIndex);
      if (body.speakingStep !== undefined) update.speakingStep = Number(body.speakingStep);
      update.lastSavedAt = new Date().toISOString();

      await repository.updateAttempt(attemptId, update);
      return json(response, 200, { success: true, lastSavedAt: update.lastSavedAt, attemptId });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  if (url.pathname === '/api/attempts/me' && request.method === 'GET') {
    const user = currentUser(request);
    if (!user || user.role !== 'teacher') return json(response, 401, { error: 'Teacher sign-in required' });
    const all = await repository.listAttempts();
    const userAttempts = all.filter((att) => (att.email || '').toLowerCase().trim() === user.email.toLowerCase().trim());
    const completedAttempt = userAttempts.find((att) => att.status === 'Completed') || null;
    const inProgressAttempt = userAttempts.find((att) => att.status === 'In progress') || null;
    return json(response, 200, {
      hasCompleted: Boolean(completedAttempt),
      completedAttempt,
      inProgressAttempt
    });
  }
  if (url.pathname === '/api/attempts' && request.method === 'POST') {
    const user = currentUser(request);
    if (!user || user.role !== 'teacher') return json(response, 401, { error: 'Teacher sign-in required' });
    const existing = await repository.listAttempts();
    const completedAttempt = existing.find(
      (att) => (att.email || '').toLowerCase().trim() === user.email.toLowerCase().trim() && att.status === 'Completed'
    );
    if (completedAttempt) {
      return json(response, 403, {
        error: 'You have already completed the assessment. Each candidate account may only take the test once.',
        hasCompleted: true,
        attempt: completedAttempt
      });
    }
    const durationMins = Number(content.durationMinutes) || 65;
    const existingInProgress = existing.find(
      (att) => (att.email || '').toLowerCase().trim() === user.email.toLowerCase().trim() && att.status === 'In progress'
    );
    if (existingInProgress) {
      const expiresAt = new Date(new Date(existingInProgress.startedAt).getTime() + durationMins * 60 * 1000).toISOString();
      if (new Date(expiresAt) > new Date()) {
        return json(response, 200, { attempt: existingInProgress, expiresAt, resumed: true });
      }
    }
    const attempt = {
      id: `ATT-${1043 + existing.length}`,
      teacher: user.name,
      email: user.email,
      unit: user.unit || 'SD KARYA BANGSA',
      status: 'In progress',
      startedAt: new Date().toISOString(),
      overall: null,
      review: 'Pending'
    };
    await repository.createAttempt(attempt);
    return json(response, 201, { attempt, expiresAt: new Date(Date.now() + durationMins * 60 * 1000).toISOString() });
  }
  if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Not found' });
  if (url.pathname === '/favicon.ico') {
    try {
      const data = await readFile(join(publicDir, 'favicon.svg'));
      response.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
      return response.end(data);
    } catch {}
  }
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  try {
    const data = await readFile(join(publicDir, file));
    const types = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
      '.webp': 'image/webp'
    };
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});

const PORT = Number(process.env.PORT) || 3000;

server.listen(PORT, 'localhost', () => {
  console.log(`Assessify running at http://localhost:${PORT}`);
  connectMySQL();
});
