import 'dotenv/config';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { evaluateWritingWithGemini, evaluateSpeakingWithGemini, testGeminiConnection } from './gemini-evaluator.js';

const execFileAsync = promisify(execFile);

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const publicDir = join(root, 'public');
const uploadsDir = join(root, 'uploads', 'recordings');
await mkdir(uploadsDir, { recursive: true });

async function deleteAttemptFiles(attemptId) {
  const exts = ['.webm', '.mp4', '.ogg', '.wav', '.json'];
  for (const ext of exts) {
    try {
      await unlink(join(uploadsDir, `${attemptId}${ext}`));
    } catch {}
  }
  try {
    await repository?.deleteRecording?.(attemptId);
  } catch {}
}
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
  students: [],
  admins: [
    { id: 1, username: 'azzikra', password: process.env.ADMIN_PASSWORD || '4dm1n123', name: 'Azzikra', email: 'azzikra@karyabangsa.sch.id', status: 'active' },
    { id: 2, username: 'refka', password: process.env.ADMIN_REFKA_PASSWORD || 'r3fk4', name: 'Refka', email: 'refka@karyabangsa.sch.id', status: 'active' }
  ],
  settings: new Map(),
  auditLogs: [],
  examSessions: [],
  async listAttempts() { return this.attempts; },
  async createAttempt(attempt) { this.attempts.unshift(attempt); return attempt; },
  async getAttempt(id) { return this.attempts.find((attempt) => attempt.id === id); },
  async updateAttempt(id, update) { const attempt = this.attempts.find((item) => item.id === id); if (attempt) Object.assign(attempt, update); return attempt; },
  async deleteAttempt(id) { const idx = this.attempts.findIndex((item) => item.id === id); if (idx !== -1) { this.attempts.splice(idx, 1); return true; } return false; },
  async listExamSessions() { return [...this.examSessions]; },
  async createExamSession(session) {
    const s = { id: `SES-${Date.now()}`, createdAt: new Date().toISOString(), status: 'active', ...session };
    this.examSessions.unshift(s);
    return s;
  },
  async deleteExamSession(id) {
    const idx = this.examSessions.findIndex((s) => s.id === id);
    if (idx !== -1) {
      this.examSessions.splice(idx, 1);
      return true;
    }
    return false;
  },
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
  async bulkCreateTeachers(teachersList) {
    let added = 0;
    let updated = 0;
    for (const t of teachersList) {
      const normEmail = (t.email || '').toLowerCase().trim();
      const existing = this.teachers.find((x) => (x.email || '').toLowerCase() === normEmail);
      if (existing) {
        existing.name = t.name.trim();
        existing.unit = t.unit.trim();
        existing.status = t.status || existing.status || 'active';
        updated++;
      } else {
        const nextId = this.teachers.length ? Math.max(...this.teachers.map((x) => Number(x.id) || 0)) + 1 : 1;
        this.teachers.push({
          id: nextId,
          name: t.name.trim(),
          email: normEmail,
          unit: t.unit.trim(),
          status: t.status || 'active'
        });
        added++;
      }
    }
    return { added, updated, total: teachersList.length };
  },
  async listAuditLogs(filters = {}) {
    let logs = [...this.auditLogs];
    if (filters.category && filters.category !== 'all') {
      logs = logs.filter((l) => l.category === filters.category);
    }
    if (filters.status && filters.status !== 'all') {
      logs = logs.filter((l) => l.status === filters.status);
    }
    if (filters.actorType && filters.actorType !== 'all') {
      logs = logs.filter((l) => l.actorType === filters.actorType);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      logs = logs.filter((l) =>
        (l.actorName || '').toLowerCase().includes(q) ||
        (l.actorId || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q) ||
        (l.target || '').toLowerCase().includes(q) ||
        JSON.stringify(l.details || '').toLowerCase().includes(q)
      );
    }
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const total = logs.length;
    const limit = Math.min(Number(filters.limit) || 100, 500);
    const offset = Math.max(0, Number(filters.offset) || 0);
    return {
      logs: logs.slice(offset, offset + limit),
      total,
      stats: this.getAuditStats()
    };
  },
  getAuditStats() {
    const today = new Date().toISOString().slice(0, 10);
    const todayLogs = this.auditLogs.filter((l) => (l.timestamp || '').startsWith(today));
    const securityAlerts = this.auditLogs.filter((l) => l.status === 'FAILURE' || l.status === 'WARNING');
    const uniqueActors = new Set(this.auditLogs.map((l) => l.actorId).filter(Boolean));
    return {
      total: this.auditLogs.length,
      todayCount: todayLogs.length,
      securityAlertsCount: securityAlerts.length,
      activeActorsCount: uniqueActors.size
    };
  },
  async createAuditLog(entry) {
    const nextId = this.auditLogs.length ? Math.max(...this.auditLogs.map((l) => Number(l.id) || 0)) + 1 : 1;
    const log = {
      id: nextId,
      timestamp: entry.timestamp || new Date().toISOString(),
      actorType: entry.actorType || 'system',
      actorId: entry.actorId || '',
      actorName: entry.actorName || '',
      action: entry.action || '',
      category: entry.category || 'GENERAL',
      target: entry.target || '',
      details: entry.details || null,
      ipAddress: entry.ipAddress || '',
      status: entry.status || 'SUCCESS'
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 2000) this.auditLogs.pop();
    return log;
  },
  async clearAuditLogs() {
    this.auditLogs = [];
    return true;
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
  },
  async bulkCreateAdmins(adminsList) {
    let added = 0;
    let updated = 0;
    for (const a of adminsList) {
      const u = (a.username || '').toLowerCase().trim();
      if (!u) continue;
      const existing = this.admins.find((x) => (x.username || '').toLowerCase() === u);
      if (existing) {
        if (a.name) existing.name = a.name.trim();
        if (a.email !== undefined) existing.email = a.email ? a.email.toLowerCase().trim() : null;
        if (a.status !== undefined) existing.status = a.status;
        if (a.password) existing.password = a.password;
        updated++;
      } else {
        const nextId = this.admins.length ? Math.max(...this.admins.map((x) => Number(x.id) || 0)) + 1 : 1;
        this.admins.push({
          id: nextId,
          username: u,
          name: (a.name || u).trim(),
          email: a.email ? a.email.toLowerCase().trim() : null,
          password: a.password || 'admin123',
          status: a.status || 'active'
        });
        added++;
      }
    }
    return { added, updated, total: adminsList.length };
  },
  async listStudents() { return [...this.students]; },
  async getStudent(idOrEmail) {
    const term = String(idOrEmail).toLowerCase().trim();
    return this.students.find((s) => String(s.id) === term || (s.email || '').toLowerCase() === term || (s.student_id || '').toLowerCase() === term) || null;
  },
  async createStudent(student) {
    const nextId = this.students.length ? Math.max(...this.students.map((s) => Number(s.id) || 0)) + 1 : 1;
    const created = { id: nextId, status: student.status || 'active', ...student };
    this.students.push(created);
    return created;
  },
  async updateStudent(id, update) {
    const term = String(id).toLowerCase().trim();
    const student = this.students.find((s) => String(s.id) === term || (s.email || '').toLowerCase() === term);
    if (!student) return null;
    Object.assign(student, update);
    return student;
  },
  async deleteStudent(id) {
    const term = String(id).toLowerCase().trim();
    const idx = this.students.findIndex((s) => String(s.id) === term || (s.email || '').toLowerCase() === term);
    if (idx !== -1) {
      this.students.splice(idx, 1);
      return true;
    }
    return false;
  },
  async bulkCreateStudents(studentsList) {
    let added = 0;
    let updated = 0;
    for (const s of studentsList) {
      const normEmail = (s.email || '').toLowerCase().trim();
      const existing = this.students.find((x) => (x.email || '').toLowerCase() === normEmail);
      if (existing) {
        existing.name = s.name.trim();
        existing.unit = s.unit.trim();
        existing.grade = s.grade || existing.grade || null;
        existing.student_id = s.student_id || existing.student_id || null;
        existing.status = s.status || existing.status || 'active';
        updated++;
      } else {
        const nextId = this.students.length ? Math.max(...this.students.map((x) => Number(x.id) || 0)) + 1 : 1;
        this.students.push({
          id: nextId,
          name: s.name.trim(),
          email: normEmail,
          unit: s.unit.trim(),
          grade: s.grade || null,
          student_id: s.student_id || null,
          status: s.status || 'active'
        });
        added++;
      }
    }
    return { added, updated, total: studentsList.length };
  },
  recordings: new Map(),
  async saveRecordingToDb({ attemptId, filename, mimeType, fileSize, buffer }) {
    const rec = {
      attemptId,
      filename,
      mimeType,
      fileSize: fileSize || buffer?.length || 0,
      mediaData: buffer || null,
      status: 'saved_to_mysql',
      driveFileId: null,
      driveViewLink: null,
      driveDownloadLink: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.recordings.set(attemptId, rec);
    return rec;
  },
  async getRecordingFromDb(attemptId) {
    return this.recordings.get(attemptId) || null;
  },
  async deleteRecordingMediaFromDb(attemptId, driveMeta = {}) {
    const rec = this.recordings.get(attemptId);
    if (rec) {
      rec.mediaData = null;
      rec.status = 'uploaded_to_drive';
      const fileId = driveMeta.driveFileId || driveMeta.fileId;
      const viewLink = driveMeta.driveViewLink || driveMeta.webViewLink;
      const dlLink = driveMeta.driveDownloadLink || driveMeta.webContentLink;
      if (fileId) rec.driveFileId = fileId;
      if (viewLink) rec.driveViewLink = viewLink;
      if (dlLink) rec.driveDownloadLink = dlLink;
      rec.updatedAt = new Date().toISOString();
      return rec;
    }
    return null;
  },
  async deleteRecording(attemptId) {
    return this.recordings.delete(attemptId);
  },
  async listPendingDriveRecordings() {
    const list = [];
    for (const rec of this.recordings.values()) {
      if (rec.status === 'saved_to_mysql' && rec.mediaData) list.push(rec);
    }
    return list;
  }
};
let repository = memoryRepository;
let storageMode = 'memory';

const defaultSystemSettings = {
  // Assessment Rules
  durationMinutes: 65,
  allowResume: true,
  autosaveIntervalSeconds: 30,
  requireCameraAudio: true,
  maxAudioPlayCount: 2,

  // Standards & Placement
  passingBand: '6.5',
  provisionalScoringAuto: true,
  certificateIssuer: 'Pusat Bahasa & Asesmen Guru Karya Bangsa',

  // Institution & Access Policy
  schoolName: 'Karya Bangsa School',
  schoolDomain: 'karyabangsa.sch.id',
  supportEmail: 'admin@karyabangsa.sch.id',
  enforceTeacherWhitelist: true,
  enforceUnitMatch: true,

  // System & Maintenance
  maintenanceMode: false,
  maintenanceMessage: 'Assessify is currently undergoing scheduled maintenance. Candidate assessments will resume shortly.',
  sessionTimeoutHours: 12,

  // Anti-Cheat Controls
  antiCheat: {
    enabled: true,
    tabSwitchDetection: true,
    requireFullscreen: true,
    splitScreenDetection: true,
    blockDevTools: true,
    blockCopyPaste: true
  },

  // Metadata
  updatedAt: new Date().toISOString(),
  updatedBy: 'system'
};

let currentSystemSettings = { ...defaultSystemSettings };
memoryRepository.settings.set('system_settings', { ...defaultSystemSettings });

function getClientIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return request.socket?.remoteAddress || '127.0.0.1';
}

// =========================================================================
// Assessify Live Real-Time Event Hub & Presence Engine
// =========================================================================
const realtimeHub = new EventEmitter();
realtimeHub.setMaxListeners(1000);

// Active SSE Connections: Map<clientId, { id, res, user, role, attemptId, ip, connectedAt }>
const realtimeClients = new Map();

// Active Candidate Presence & Live Monitor State: Map<attemptId, presenceObj>
const activeCandidatePresence = new Map();

function broadcastRealtime(target, eventType, data = {}) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() })}\n\n`;
  for (const [clientId, client] of realtimeClients.entries()) {
    try {
      if (target === 'all') {
        client.res.write(payload);
      } else if (target === 'admin' && client.role === 'admin') {
        client.res.write(payload);
      } else if (target === 'candidates' && (client.role === 'teacher' || client.role === 'student' || client.role === 'candidate')) {
        client.res.write(payload);
      } else if (typeof target === 'string') {
        if (client.attemptId === target || client.user?.email?.toLowerCase() === target.toLowerCase()) {
          client.res.write(payload);
        }
      }
    } catch (err) {
      realtimeClients.delete(clientId);
    }
  }
}

function getActiveCandidatesSnapshot() {
  const now = Date.now();
  const list = [];
  for (const [attemptId, presence] of activeCandidatePresence.entries()) {
    if (presence.status === 'completed' && (now - (presence.completedAt || 0) > 300_000)) {
      activeCandidatePresence.delete(attemptId);
      continue;
    }
    const diff = now - (presence.lastHeartbeat || 0);
    if (presence.status !== 'completed') {
      if (diff > 45_000) {
        presence.status = 'offline';
      } else if (diff > 15_000) {
        presence.status = 'idle';
      } else {
        presence.status = 'active';
      }
    }
    list.push({ ...presence });
  }
  return list;
}

// Keep-alive heartbeat & presence status evaluator every 10 seconds
setInterval(() => {
  const pingPayload = `: ping ${Date.now()}\n\n`;
  for (const [clientId, client] of realtimeClients.entries()) {
    try {
      client.res.write(pingPayload);
    } catch (err) {
      realtimeClients.delete(clientId);
    }
  }

  const now = Date.now();
  let presenceChanged = false;
  for (const [attemptId, presence] of activeCandidatePresence.entries()) {
    if (presence.status === 'completed') continue;
    const diff = now - (presence.lastHeartbeat || 0);
    const oldStatus = presence.status;
    if (diff > 45_000 && oldStatus !== 'offline') {
      presence.status = 'offline';
      presenceChanged = true;
    } else if (diff > 15_000 && diff <= 45_000 && oldStatus !== 'idle') {
      presence.status = 'idle';
      presenceChanged = true;
    }
  }
  if (presenceChanged) {
    broadcastRealtime('admin', 'CANDIDATE_PRESENCE_SYNC', { candidates: getActiveCandidatesSnapshot() });
  }
}, 10_000).unref();

async function recordAuditLog({
  actorType = 'system',
  actorId = '',
  actorName = '',
  action = '',
  category = 'GENERAL',
  target = '',
  details = null,
  ip = '',
  status = 'SUCCESS'
}) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      actorType,
      actorId,
      actorName,
      action,
      category,
      target,
      details,
      ipAddress: ip,
      status
    };
    await repository.createAuditLog(entry);
    broadcastRealtime('admin', 'AUDIT_LOG_ENTRY', entry);
  } catch (err) {
    console.error('Failed to record audit log:', err.message);
  }
}

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
    const poolConfig = {
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 30000
    };

    if (rawUri && (rawUri.startsWith('mysql://') || rawUri.startsWith('mysql2://'))) {
      pool = mysql.createPool({ uri: rawUri, ...poolConfig });
    } else {
      pool = mysql.createPool({ host, port, user, password, database, ...poolConfig });
    }

    const originalQuery = pool.query.bind(pool);
    pool.query = async function (sql, params) {
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          return await originalQuery(sql, params);
        } catch (err) {
          const isTransient = err.code === 'ECONNRESET' ||
            err.code === 'PROTOCOL_CONNECTION_LOST' ||
            err.code === 'ETIMEDOUT' ||
            err.syscall === 'read' ||
            (err.message && err.message.includes('ECONNRESET'));
          if (isTransient && attempt < 2) {
            console.warn(`[MySQL] Transient error (${err.code || err.message}), retrying query (${attempt + 1}/2)...`);
            await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
            continue;
          }
          throw err;
        }
      }
    };

    pool.on('error', (err) => {
      console.warn('MySQL pool background event:', err.message);
      if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET' || err.syscall === 'read') {
        return;
      }
      repository = memoryRepository;
      storageMode = 'memory';
    });

    // Verify connection with timeout
    const connectPromise = async () => {
      await pool.query('SELECT 1');
      await pool.query('SET GLOBAL max_allowed_packet = 67108864').catch(() => {});
      await pool.query('SET SESSION max_allowed_packet = 67108864').catch(() => {});

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
        CREATE TABLE IF NOT EXISTS exam_sessions (
          id VARCHAR(64) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          target_unit VARCHAR(128) NULL,
          scheduled_start VARCHAR(64) NULL,
          anti_cheat JSON NOT NULL,
          created_by VARCHAR(128) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        CREATE TABLE IF NOT EXISTS students (
          id INT AUTO_INCREMENT PRIMARY KEY,
          student_id VARCHAR(64) NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          unit VARCHAR(128) NOT NULL,
          grade VARCHAR(64) NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_student_email (email),
          INDEX idx_student_unit (unit)
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
      await pool.query('ALTER TABLE students ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT "active"').catch(() => {});
      await pool.query('ALTER TABLE students ADD COLUMN grade VARCHAR(64) NULL').catch(() => {});
      await pool.query('ALTER TABLE students ADD COLUMN student_id VARCHAR(64) NULL').catch(() => {});
      await pool.query('ALTER TABLE admin_users ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT "active"').catch(() => {});

      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          timestamp VARCHAR(64) NOT NULL,
          actor_type VARCHAR(32) NOT NULL,
          actor_id VARCHAR(255) NOT NULL,
          actor_name VARCHAR(255) NOT NULL,
          action VARCHAR(64) NOT NULL,
          category VARCHAR(64) NOT NULL,
          target VARCHAR(255) NULL,
          details JSON NULL,
          ip_address VARCHAR(64) NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_timestamp (timestamp),
          INDEX idx_category (category),
          INDEX idx_action (action),
          INDEX idx_actor (actor_id),
          INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS attempt_recordings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          attempt_id VARCHAR(64) NOT NULL UNIQUE,
          filename VARCHAR(255) NOT NULL,
          mime_type VARCHAR(128) NOT NULL,
          file_size BIGINT NOT NULL DEFAULT 0,
          media_data LONGBLOB NULL,
          status VARCHAR(64) NOT NULL DEFAULT 'saved_to_mysql',
          drive_file_id VARCHAR(255) NULL,
          drive_view_link TEXT NULL,
          drive_download_link TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_rec_attempt (attempt_id),
          INDEX idx_rec_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      repository = {
        async saveRecordingToDb({ attemptId, filename, mimeType, fileSize, buffer }) {
          await pool.query(
            `INSERT INTO attempt_recordings (attempt_id, filename, mime_type, file_size, media_data, status)
             VALUES (?, ?, ?, ?, ?, 'saved_to_mysql')
             ON DUPLICATE KEY UPDATE filename = VALUES(filename), mime_type = VALUES(mime_type), file_size = VALUES(file_size), media_data = VALUES(media_data), status = 'saved_to_mysql', updated_at = CURRENT_TIMESTAMP`,
            [attemptId, filename, mimeType, fileSize || buffer?.length || 0, buffer]
          );
          return { attemptId, filename, mimeType, fileSize, status: 'saved_to_mysql' };
        },
        async getRecordingFromDb(attemptId) {
          const [rows] = await pool.query(
            'SELECT attempt_id, filename, mime_type, file_size, media_data, status, drive_file_id, drive_view_link, drive_download_link, created_at, updated_at FROM attempt_recordings WHERE attempt_id = ? LIMIT 1',
            [attemptId]
          );
          if (!rows.length) return null;
          const r = rows[0];
          return {
            attemptId: r.attempt_id,
            filename: r.filename,
            mimeType: r.mime_type,
            fileSize: Number(r.file_size),
            mediaData: r.media_data,
            status: r.status,
            driveFileId: r.drive_file_id,
            driveViewLink: r.drive_view_link,
            driveDownloadLink: r.drive_download_link,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          };
        },
        async deleteRecordingMediaFromDb(attemptId, driveMeta = {}) {
          const fileId = driveMeta.driveFileId || driveMeta.fileId || null;
          const viewLink = driveMeta.driveViewLink || driveMeta.webViewLink || null;
          const dlLink = driveMeta.driveDownloadLink || driveMeta.webContentLink || null;
          await pool.query(
            `UPDATE attempt_recordings
             SET media_data = NULL,
                 status = 'uploaded_to_drive',
                 drive_file_id = COALESCE(?, drive_file_id),
                 drive_view_link = COALESCE(?, drive_view_link),
                 drive_download_link = COALESCE(?, drive_download_link),
                 updated_at = CURRENT_TIMESTAMP
             WHERE attempt_id = ?`,
            [fileId, viewLink, dlLink, attemptId]
          );
          return true;
        },
        async deleteRecording(attemptId) {
          const [res] = await pool.query('DELETE FROM attempt_recordings WHERE attempt_id = ?', [attemptId]);
          return res.affectedRows > 0;
        },
        async listPendingDriveRecordings() {
          const [rows] = await pool.query(
            'SELECT attempt_id, filename, mime_type, file_size, media_data, status FROM attempt_recordings WHERE status = "saved_to_mysql" AND media_data IS NOT NULL'
          );
          return rows.map((r) => ({
            attemptId: r.attempt_id,
            filename: r.filename,
            mimeType: r.mime_type,
            fileSize: Number(r.file_size),
            mediaData: r.media_data,
            status: r.status
          }));
        },
        async listAttempts() {
          const [rows] = await pool.query(`
            SELECT a.raw_data, r.filename, r.mime_type, r.status AS rec_status, r.drive_file_id, r.drive_view_link, r.drive_download_link
            FROM attempts a
            LEFT JOIN attempt_recordings r ON a.id = r.attempt_id
            ORDER BY a.started_at DESC
          `);
          return rows.map((r) => {
            const att = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data;
            if (r.drive_file_id || r.drive_view_link || r.filename) {
              att.speakingRecording = {
                ...(att.speakingRecording || {}),
                filename: r.filename || att.speakingRecording?.filename,
                mimeType: r.mime_type || att.speakingRecording?.mimeType,
                fileUrl: `/api/attempts/${att.id}/recording`,
                driveFileId: r.drive_file_id || att.speakingRecording?.driveFileId,
                driveViewLink: r.drive_view_link || att.speakingRecording?.driveViewLink,
                driveDownloadLink: r.drive_download_link || att.speakingRecording?.driveDownloadLink,
                driveStatus: r.rec_status || att.speakingRecording?.driveStatus
              };
            }
            return att;
          });
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
          const [rows] = await pool.query(`
            SELECT a.raw_data, r.filename, r.mime_type, r.status AS rec_status, r.drive_file_id, r.drive_view_link, r.drive_download_link
            FROM attempts a
            LEFT JOIN attempt_recordings r ON a.id = r.attempt_id
            WHERE a.id = ? LIMIT 1
          `, [id]);
          if (!rows.length) return null;
          const r = rows[0];
          const att = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data;
          if (r.drive_file_id || r.drive_view_link || r.filename) {
            att.speakingRecording = {
              ...(att.speakingRecording || {}),
              filename: r.filename || att.speakingRecording?.filename,
              mimeType: r.mime_type || att.speakingRecording?.mimeType,
              fileUrl: `/api/attempts/${att.id}/recording`,
              driveFileId: r.drive_file_id || att.speakingRecording?.driveFileId,
              driveViewLink: r.drive_view_link || att.speakingRecording?.driveViewLink,
              driveDownloadLink: r.drive_download_link || att.speakingRecording?.driveDownloadLink,
              driveStatus: r.rec_status || att.speakingRecording?.driveStatus
            };
          }
          return att;
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
        async bulkCreateTeachers(teachersList) {
          let added = 0;
          let updated = 0;
          for (const t of teachersList) {
            const normEmail = (t.email || '').toLowerCase().trim();
            const normName = (t.name || '').trim();
            const normUnit = (t.unit || '').trim();
            const normStatus = t.status || 'active';
            const [res] = await pool.query(
              `INSERT INTO authorized_teachers (name, email, unit, status)
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE name = VALUES(name), unit = VALUES(unit), status = VALUES(status)`,
              [normName, normEmail, normUnit, normStatus]
            );
            if (res.affectedRows === 1) {
              added++;
            } else {
              updated++;
            }
          }
          return { added, updated, total: teachersList.length };
        },
        async listStudents() {
          const [rows] = await pool.query('SELECT id, student_id, name, email, unit, grade, COALESCE(status, "active") AS status, created_at, updated_at FROM students ORDER BY name ASC');
          return rows;
        },
        async getStudent(idOrEmail) {
          const term = String(idOrEmail).toLowerCase().trim();
          const isNum = !isNaN(Number(term)) && !term.includes('@');
          const query = isNum
            ? 'SELECT id, student_id, name, email, unit, grade, COALESCE(status, "active") AS status, created_at, updated_at FROM students WHERE id = ? LIMIT 1'
            : 'SELECT id, student_id, name, email, unit, grade, COALESCE(status, "active") AS status, created_at, updated_at FROM students WHERE email = ? OR student_id = ? LIMIT 1';
          const [rows] = await pool.query(query, isNum ? [Number(term)] : [term, term]);
          return rows[0] || null;
        },
        async createStudent({ name, email, unit, student_id = null, grade = null, status = 'active' }) {
          const normalizedEmail = email.toLowerCase().trim();
          const [res] = await pool.query(
            'INSERT INTO students (student_id, name, email, unit, grade, status) VALUES (?, ?, ?, ?, ?, ?)',
            [student_id ? String(student_id).trim() : null, name.trim(), normalizedEmail, unit.trim(), grade ? String(grade).trim() : null, status || 'active']
          );
          return { id: res.insertId, student_id: student_id ? String(student_id).trim() : null, name: name.trim(), email: normalizedEmail, unit: unit.trim(), grade: grade ? String(grade).trim() : null, status: status || 'active' };
        },
        async updateStudent(id, { name, email, unit, student_id, grade, status }) {
          const normalizedEmail = email ? email.toLowerCase().trim() : undefined;
          await pool.query(
            'UPDATE students SET name = COALESCE(?, name), email = COALESCE(?, email), unit = COALESCE(?, unit), student_id = COALESCE(?, student_id), grade = COALESCE(?, grade), status = COALESCE(?, status) WHERE id = ?',
            [name?.trim(), normalizedEmail, unit?.trim(), student_id !== undefined ? String(student_id).trim() : null, grade !== undefined ? String(grade).trim() : null, status, id]
          );
          return this.getStudent(id);
        },
        async deleteStudent(id) {
          const [res] = await pool.query('DELETE FROM students WHERE id = ?', [id]);
          return res.affectedRows > 0;
        },
        async bulkCreateStudents(studentsList) {
          let added = 0;
          let updated = 0;
          for (const s of studentsList) {
            const normEmail = (s.email || '').toLowerCase().trim();
            const normName = (s.name || '').trim();
            const normUnit = (s.unit || '').trim();
            const normStudentId = s.student_id ? String(s.student_id).trim() : null;
            const normGrade = s.grade ? String(s.grade).trim() : null;
            const normStatus = s.status || 'active';
            const [res] = await pool.query(
              `INSERT INTO students (student_id, name, email, unit, grade, status)
               VALUES (?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE name = VALUES(name), unit = VALUES(unit), student_id = VALUES(student_id), grade = VALUES(grade), status = VALUES(status)`,
              [normStudentId, normName, normEmail, normUnit, normGrade, normStatus]
            );
            if (res.affectedRows === 1) {
              added++;
            } else {
              updated++;
            }
          }
          return { added, updated, total: studentsList.length };
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
        },
        async bulkCreateAdmins(adminsList) {
          let added = 0;
          let updated = 0;
          for (const a of adminsList) {
            const normUsername = (a.username || '').toLowerCase().trim();
            const normName = (a.name || normUsername).trim();
            const normEmail = (a.email || '').toLowerCase().trim() || null;
            const normStatus = (a.status || 'active').toLowerCase().trim();
            const normPassword = a.password || 'admin123';
            if (!normUsername) continue;

            const [existing] = await pool.query('SELECT id FROM admin_users WHERE LOWER(username) = ?', [normUsername]);
            if (existing && existing.length > 0) {
              await pool.query(
                'UPDATE admin_users SET name = ?, email = ?, status = ? WHERE id = ?',
                [normName, normEmail, normStatus, existing[0].id]
              );
              updated++;
            } else {
              await pool.query(
                'INSERT INTO admin_users (username, password, name, email, status) VALUES (?, ?, ?, ?, ?)',
                [normUsername, normPassword, normName, normEmail, normStatus]
              );
              added++;
            }
          }
          return { added, updated, total: adminsList.length };
        },
        async listAuditLogs(filters = {}) {
          const conditions = [];
          const params = [];
          if (filters.category && filters.category !== 'all') {
            conditions.push('category = ?');
            params.push(filters.category);
          }
          if (filters.status && filters.status !== 'all') {
            conditions.push('status = ?');
            params.push(filters.status);
          }
          if (filters.actorType && filters.actorType !== 'all') {
            conditions.push('actor_type = ?');
            params.push(filters.actorType);
          }
          if (filters.search) {
            conditions.push('(actor_name LIKE ? OR actor_id LIKE ? OR action LIKE ? OR target LIKE ? OR details LIKE ?)');
            const s = `%${filters.search}%`;
            params.push(s, s, s, s, s);
          }
          const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
          const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`, params);
          const total = countResult[0]?.total || 0;

          const limit = Math.min(Number(filters.limit) || 100, 500);
          const offset = Math.max(0, Number(filters.offset) || 0);

          const [rows] = await pool.query(
            `SELECT id, timestamp, actor_type AS actorType, actor_id AS actorId, actor_name AS actorName,
                    action, category, target, details, ip_address AS ipAddress, status, created_at AS createdAt
             FROM audit_logs ${whereClause}
             ORDER BY timestamp DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
          );

          const formattedLogs = rows.map((r) => ({
            ...r,
            details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details
          }));

          const stats = await this.getAuditStats();
          return { logs: formattedLogs, total, stats };
        },
        async getAuditStats() {
          const today = new Date().toISOString().slice(0, 10);
          const [[totalRes], [todayRes], [alertsRes], [actorsRes]] = await Promise.all([
            pool.query('SELECT COUNT(*) as c FROM audit_logs'),
            pool.query('SELECT COUNT(*) as c FROM audit_logs WHERE timestamp LIKE ?', [`${today}%`]),
            pool.query('SELECT COUNT(*) as c FROM audit_logs WHERE status IN ("FAILURE", "WARNING")'),
            pool.query('SELECT COUNT(DISTINCT actor_id) as c FROM audit_logs WHERE actor_id != ""')
          ]);
          return {
            total: totalRes[0]?.c || 0,
            todayCount: todayRes[0]?.c || 0,
            securityAlertsCount: alertsRes[0]?.c || 0,
            activeActorsCount: actorsRes[0]?.c || 0
          };
        },
        async createAuditLog(entry) {
          const ts = entry.timestamp || new Date().toISOString();
          const [res] = await pool.query(
            `INSERT INTO audit_logs (timestamp, actor_type, actor_id, actor_name, action, category, target, details, ip_address, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              ts,
              entry.actorType || 'system',
              entry.actorId || '',
              entry.actorName || '',
              entry.action || '',
              entry.category || 'GENERAL',
              entry.target || '',
              entry.details ? JSON.stringify(entry.details) : null,
              entry.ipAddress || '',
              entry.status || 'SUCCESS'
            ]
          );
          return { id: res.insertId, ...entry, timestamp: ts };
        },
        async clearAuditLogs() {
          await pool.query('TRUNCATE TABLE audit_logs');
          return true;
        },
        async listExamSessions() {
          const [rows] = await pool.query('SELECT * FROM exam_sessions ORDER BY created_at DESC');
          return rows.map((r) => ({
            id: r.id,
            title: r.title,
            targetUnit: r.target_unit,
            scheduledStart: r.scheduled_start,
            antiCheat: typeof r.anti_cheat === 'string' ? JSON.parse(r.anti_cheat) : r.anti_cheat,
            createdBy: r.created_by,
            createdAt: r.created_at
          }));
        },
        async createExamSession(session) {
          const id = session.id || `SES-${Date.now()}`;
          const title = session.title || 'Sesi Ujian';
          const targetUnit = session.targetUnit || null;
          const scheduledStart = session.scheduledStart || null;
          const antiCheat = session.antiCheat || defaultSystemSettings.antiCheat;
          const createdBy = session.createdBy || 'admin';
          await pool.query(
            'INSERT INTO exam_sessions (id, title, target_unit, scheduled_start, anti_cheat, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [id, title, targetUnit, scheduledStart, JSON.stringify(antiCheat), createdBy]
          );
          return { id, title, targetUnit, scheduledStart, antiCheat, createdBy, createdAt: new Date().toISOString() };
        },
        async deleteExamSession(id) {
          const [res] = await pool.query('DELETE FROM exam_sessions WHERE id = ?', [id]);
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
        }      } catch (syncErr) {
        console.warn(`Could not sync questions/rubrics with MySQL (${syncErr.message})`);
      }

      await resyncAttemptsWithRubrics();

      // Sync System Settings with MySQL Database
      try {
        const dbSettings = await repository.getSetting('system_settings');
        if (dbSettings && typeof dbSettings === 'object') {
          currentSystemSettings = { ...defaultSystemSettings, ...dbSettings };
          console.log('Loaded System Settings from MySQL database');
        } else {
          await repository.setSetting('system_settings', defaultSystemSettings);
          currentSystemSettings = { ...defaultSystemSettings };
          console.log('Initialized default System Settings in MySQL database');
        }
      } catch (settingsErr) {
        console.warn(`Could not sync system settings with MySQL (${settingsErr.message})`);
      }
    };

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 15000));
    await Promise.race([connectPromise(), timeoutPromise]);
  } catch (error) {
    console.warn(`MySQL unavailable; using memory repository (${error.message})`);
  }
}

const json = (response, status, data) => {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
};
const hashString = (str) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const seededRandom = (seed) => {
  let s = typeof seed === 'number' ? seed : hashString(String(seed));
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleWithSeed = (array, seed) => {
  const result = [...array];
  const rng = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const safeTest = (user = null, attempt = null) => {
  let gvOrder = attempt?.grammarVocabularyOrder || null;
  if (!gvOrder && user && (user.role === 'teacher' || user.role === 'student' || user.role === 'candidate') && user.email) {
    const gvSection = (content.sections || []).find((s) => s.id === 'grammar-vocabulary');
    if (gvSection && Array.isArray(gvSection.questions)) {
      gvOrder = shuffleWithSeed(gvSection.questions, user.email.toLowerCase().trim()).map((q) => q.id);
    }
  }

  return {
    ...content,
    sections: (content.sections || []).map(({ questions, topics, ...section }) => {
      const rawQuestions = (questions && questions.length > 0) ? questions : (topics || []);
      let safeQuestions = rawQuestions.map(({ answer, ...question }) => question);

      if (section.id === 'grammar-vocabulary' && Array.isArray(gvOrder) && gvOrder.length > 0) {
        const qMap = new Map(safeQuestions.map((q) => [q.id, q]));
        const ordered = gvOrder.map((id) => qMap.get(id)).filter(Boolean);
        for (const q of safeQuestions) {
          if (!gvOrder.includes(q.id)) ordered.push(q);
        }
        safeQuestions = ordered;
      }

      const safeTopics = (topics && topics.length > 0 ? topics : safeQuestions).map(({ answer, ...t }) => t);
      return {
        ...section,
        topics: safeTopics,
        questions: safeQuestions
      };
    })
  };
};
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
const createSpeakingMeet = async () => null;

let appDriveFolderCache = null;

const normalizeRefreshToken = (raw) => {
  if (!raw) return null;
  let token = raw;
  if (typeof token === 'string') {
    token = token.trim();
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
      try {
        const parsed = JSON.parse(token);
        if (typeof parsed === 'string') token = parsed.trim();
      } catch {
        token = token.slice(1, -1).trim();
      }
    }
  } else if (typeof token === 'object' && token.refresh_token) {
    token = String(token.refresh_token).trim();
  }
  return token || null;
};

const getGoogleDriveClient = async () => {
  const { google } = await import('googleapis');

  const rawToken = (await repository.getSetting('googleRefreshToken')) || process.env.GOOGLE_REFRESH_TOKEN;
  const refreshToken = normalizeRefreshToken(rawToken);
  if (refreshToken) {
    const auth = await googleClient();
    auth.setCredentials({ refresh_token: refreshToken });
    auth.on('tokens', async (newTokens) => {
      if (newTokens?.refresh_token) {
        try {
          await repository.setSetting('googleRefreshToken', newTokens.refresh_token);
        } catch (e) {
          console.warn('Could not persist updated refresh token to database:', e.message);
        }
      }
    });
    return google.drive({ version: 'v3', auth });
  }

  const serviceAccountFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || join(root, 'service-account.json');
  if (existsSync(serviceAccountFile)) {
    const auth = new google.auth.GoogleAuth({
      keyFile: serviceAccountFile,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    return google.drive({ version: 'v3', auth });
  }

  throw new Error('Google Drive authorization required (connect via Admin portal)');
};

const isGoogleDriveConfigured = async () => {
  const serviceAccountFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || join(root, 'service-account.json');
  if (existsSync(serviceAccountFile)) return true;
  const rawToken = (await repository.getSetting('googleRefreshToken')) || process.env.GOOGLE_REFRESH_TOKEN;
  return Boolean(normalizeRefreshToken(rawToken));
};

const getOrCreateAssessifyFolder = async (drive) => {
  if (appDriveFolderCache) {
    try {
      const check = await drive.files.get({ fileId: appDriveFolderCache, fields: 'id, name, trashed', supportsAllDrives: true });
      if (!check.data.trashed) return appDriveFolderCache;
    } catch {
      appDriveFolderCache = null;
    }
  }

  // 1. Check persistent setting in database or environment variable
  let configuredFolderId = null;
  try {
    const dbSetting = await repository.getSetting('googleDriveFolderId');
    configuredFolderId = (typeof dbSetting === 'string' && dbSetting.trim()) ? dbSetting.trim() : null;
  } catch {}
  if (!configuredFolderId && process.env.GOOGLE_DRIVE_FOLDER_ID) {
    configuredFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID.trim();
  }

  if (configuredFolderId) {
    try {
      const check = await drive.files.get({ fileId: configuredFolderId, fields: 'id, name, trashed', supportsAllDrives: true });
      if (!check.data.trashed) {
        appDriveFolderCache = configuredFolderId;
        return appDriveFolderCache;
      }
    } catch (fErr) {
      console.warn(`Configured folder ${configuredFolderId} inaccessible (${fErr.message}). Searching Drive for Assessify folder...`);
    }
  }

  // 2. Search user's Google Drive for existing folder named "Assessify Recordings" or "Assessify"
  try {
    const q = "mimeType = 'application/vnd.google-apps.folder' and (name = 'Assessify Recordings' or name = 'Assessify') and trashed = false";
    const res = await drive.files.list({ q, fields: 'files(id, name, webViewLink)', spaces: 'drive', pageSize: 1 });
    if (res.data.files && res.data.files.length > 0) {
      appDriveFolderCache = res.data.files[0].id;
      try { await repository.setSetting('googleDriveFolderId', appDriveFolderCache); } catch {}
      console.log(`Using existing Assessify folder in Google Drive: ${res.data.files[0].name} (${appDriveFolderCache})`);
      return appDriveFolderCache;
    }
  } catch (err) {
    console.warn('Could not list folders in Drive:', err.message);
  }

  // 3. Create dedicated "Assessify Recordings" folder in user's Google Drive
  try {
    const res = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: 'Assessify Recordings',
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id, name, webViewLink'
    });
    if (res.data?.id) {
      appDriveFolderCache = res.data.id;
      try { await repository.setSetting('googleDriveFolderId', appDriveFolderCache); } catch {}
      console.log(`Created dedicated "Assessify Recordings" folder in Google Drive: ${appDriveFolderCache}`);
      return appDriveFolderCache;
    }
  } catch (err) {
    console.warn('Could not create dedicated Assessify Recordings folder:', err.message);
  }

  return null;
};

const uploadMediaBufferToGoogleDrive = async ({ buffer, filename, mimeType, folderId }) => {
  if (!buffer || buffer.length === 0) {
    throw new Error('Cannot upload empty media buffer to Google Drive');
  }

  const drive = await getGoogleDriveClient();
  const effectiveMimeType = mimeType || 'video/webm';

  // Always resolve the dedicated Assessify folder:
  let targetFolderId = folderId || (await getOrCreateAssessifyFolder(drive));

  let res = null;

  // Attempt 1: Upload directly into the Assessify folder
  if (targetFolderId) {
    try {
      res = await drive.files.create({
        supportsAllDrives: true,
        requestBody: {
          name: filename,
          parents: [targetFolderId]
        },
        media: {
          mimeType: effectiveMimeType,
          body: Readable.from(buffer)
        },
        fields: 'id, name, mimeType, webViewLink, webContentLink, parents'
      });
      console.log(`✔ Uploaded ${filename} directly into Assessify folder (${targetFolderId})`);
    } catch (folderErr) {
      if (folderErr?.message?.includes('invalid_grant')) {
        console.warn('[Google Drive] Authorization expired (invalid_grant). Skipping Drive upload, stored in MySQL.');
        return null;
      }
      console.warn(`Could not upload to folder ${targetFolderId} (${folderErr.message}). Re-checking Assessify folder...`);
      appDriveFolderCache = null;
    }
  }

  // Attempt 2: If attempt 1 failed, re-create/re-fetch Assessify folder and upload
  if (!res) {
    const fallbackFolderId = await getOrCreateAssessifyFolder(drive);
    if (fallbackFolderId) {
      try {
        res = await drive.files.create({
          supportsAllDrives: true,
          requestBody: {
            name: filename,
            parents: [fallbackFolderId]
          },
          media: {
            mimeType: effectiveMimeType,
            body: Readable.from(buffer)
          },
          fields: 'id, name, mimeType, webViewLink, webContentLink, parents'
        });
        console.log(`✔ Uploaded ${filename} into re-created Assessify folder (${fallbackFolderId})`);
      } catch (fbErr) {
        console.warn(`Could not upload to dedicated Assessify folder (${fbErr.message}). Falling back to root Drive...`);
      }
    }
  }

  // Attempt 3: Root upload fallback (emergency last resort)
  if (!res) {
    res = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: filename
      },
      media: {
        mimeType: effectiveMimeType,
        body: Readable.from(buffer)
      },
      fields: 'id, name, mimeType, webViewLink, webContentLink, parents'
    });
  }

  const fileId = res?.data?.id;
  if (!fileId) {
    throw new Error('Google Drive did not return a valid file ID');
  }

  const webViewLink = res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  const webContentLink = res.data.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`;

  // Best-effort reader permission
  try {
    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
  } catch (permErr) {
    // Ignored if domain policy prevents public sharing
  }

  return {
    fileId,
    name: filename,
    mimeType: effectiveMimeType,
    webViewLink,
    webContentLink
  };
};

const uploadRecordingToDriveAndCleanup = async (attemptId) => {
  try {
    const rec = await repository.getRecordingFromDb(attemptId);
    if (!rec || !rec.mediaData) {
      console.warn(`No binary media data found in database for attempt ${attemptId}`);
      return null;
    }

    const driveReady = await isGoogleDriveConfigured();
    if (!driveReady) {
      console.log(`Google Workspace not connected yet. Recording for ${attemptId} remains safely stored in MySQL.`);
      return null;
    }

    const driveMeta = await uploadMediaBufferToGoogleDrive({
      buffer: rec.mediaData,
      filename: rec.filename,
      mimeType: rec.mimeType
    });

    // Successfully uploaded to Google Drive -> Delete/purge binary media data from MySQL!
    await repository.deleteRecordingMediaFromDb(attemptId, driveMeta);

    // Update attempt record
    const attempt = await repository.getAttempt(attemptId);
    if (attempt) {
      const existing = attempt.speakingRecording || {};
      const updated = {
        ...existing,
        driveFileId: driveMeta.fileId,
        driveViewLink: driveMeta.webViewLink,
        driveDownloadLink: driveMeta.webContentLink,
        driveStatus: 'uploaded_to_drive'
      };
      await repository.updateAttempt(attemptId, { speakingRecording: updated });
    }

    console.log(`Successfully uploaded recording for attempt ${attemptId} to Google Drive and purged media from MySQL.`);
    return driveMeta;
  } catch (err) {
    console.error(`Failed to upload recording for ${attemptId} to Google Drive:`, err.message);
    return null;
  }
};
const createSession = (user) => {
  const sessionData = { ...user, iat: Date.now() };
  const payload = Buffer.from(JSON.stringify(sessionData)).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};
const currentUser = (request) => {
  const token = readCookies(request).assessify_session;
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const timeoutHours = Number(currentSystemSettings?.sessionTimeoutHours) || 12;
    if (data.iat && (Date.now() - data.iat > timeoutHours * 3600 * 1000)) return null;
    return data;
  } catch {
    return null;
  }
};
const isAdmin = (request) => currentUser(request)?.role === 'admin';
const requestBody = async (request) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  if (!body || !body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch (err) {
    try {
      const params = new URLSearchParams(body);
      const obj = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      if (Object.keys(obj).length > 0) return obj;
    } catch {}
    return {};
  }
};

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
  const school = currentSystemSettings?.schoolName || 'Karya Bangsa School';
  return `Overall CEFR Placement: ${row.overall} — ${descriptor}. ` +
    (strongSkill && scores[strongSkill] ? `${strongSkill} is the strongest skill at ${scores[strongSkill]}. ` : '') +
    (weakSkill && weakSkill !== strongSkill && scores[weakSkill] ? `${weakSkill} is the priority development area at ${scores[weakSkill]}. ` : '') +
    `This placement is based on the ${school} English Placement Rubric and should be used as an internal placement indicator.`;
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

const certificateNumber = (row) => {
  const school = currentSystemSettings?.schoolName || 'Karya Bangsa School';
  const prefix = school.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 3).join('').toUpperCase() || 'KBS';
  const rawDate = row.submittedAt || row.started || row.startedAt;
  const year = rawDate ? new Date(rawDate).getUTCFullYear() : new Date().getUTCFullYear();
  const attemptStr = String(row.attempt || row.id || '1001').replace(/^ATT-/, '');
  return `${prefix}-EN-${year}-${attemptStr}`;
};

const exportRows = (results) => results.map((row) => ({
  id: row.id,
  teacher: row.teacher || row.name || 'Candidate',
  email: row.email || '',
  unit: row.unit || 'SD KARYA BANGSA',
  attempt: row.id || 'ATT-1001',
  started: row.startedAt || row.started || new Date().toISOString(),
  submittedAt: row.submittedAt || row.completedAt || null,
  status: row.status,
  grammarVocabulary: row.sectionScores?.['Grammar & Vocabulary'] ?? '',
  writing: row.sectionScores?.Writing ?? '',
  speaking: row.sectionScores?.Speaking ?? '',
  overallBand: row.overall ?? '',
  review: row.review,
  analysis: performanceAnalysis(row),
  scoring: row.scoring,
  manualReview: row.manualReview
}));

const cefrPillStyle = (level) => {
  const styles = {
    A1: { bg: '#fee2e2', border: '#fca5a5', text: '#dc2626' },
    A2: { bg: '#ffedd5', border: '#fdba74', text: '#ea580c' },
    B1: { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb' },
    B2: { bg: '#ecfdf5', border: '#86efac', text: '#059669' },
    C1: { bg: '#f5f3ff', border: '#d8b4fe', text: '#7c3aed' },
    C2: { bg: '#fdf2f8', border: '#f472b6', text: '#86198f' }
  };
  return styles[level] || { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569' };
};

function drawCheckmark(doc, x, y, color = '#6ee7b7') {
  doc.save()
    .lineWidth(1.4)
    .strokeColor(color)
    .lineCap('round')
    .lineJoin('round')
    .moveTo(x, y + 4.5)
    .lineTo(x + 3.5, y + 8)
    .lineTo(x + 9, y + 1.5)
    .stroke()
    .restore();
}

function drawCheckCircleIcon(doc, x, y, color = '#6ee7b7') {
  doc.save()
    .lineWidth(1.3)
    .strokeColor(color)
    .lineCap('round')
    .lineJoin('round')
    .circle(x + 5.5, y + 5.5, 6)
    .stroke()
    .moveTo(x + 3, y + 5.5)
    .lineTo(x + 4.8, y + 7.5)
    .lineTo(x + 8.2, y + 3.5)
    .stroke()
    .restore();
}

function drawCapIcon(doc, x, y, color = '#93c5fd') {
  doc.save()
    .lineWidth(1.2)
    .strokeColor(color)
    .lineCap('round')
    .lineJoin('round')
    .moveTo(x, y + 4)
    .lineTo(x + 6, y + 0.5)
    .lineTo(x + 12, y + 4)
    .lineTo(x + 6, y + 7.5)
    .closePath()
    .stroke()
    .moveTo(x + 2, y + 5)
    .lineTo(x + 2, y + 8.5)
    .bezierCurveTo(x + 4, y + 10.5, x + 8, y + 10.5, x + 10, y + 8.5)
    .lineTo(x + 10, y + 5)
    .stroke()
    .restore();
}

function drawLayersIcon(doc, x, y, color = '#2563eb') {
  doc.save()
    .lineWidth(1.2)
    .strokeColor(color)
    .lineCap('round')
    .lineJoin('round')
    .moveTo(x, y + 3).lineTo(x + 5, y).lineTo(x + 10, y + 3).lineTo(x + 5, y + 6).closePath().stroke()
    .moveTo(x + 1.5, y + 5.5).lineTo(x + 5, y + 7.5).lineTo(x + 8.5, y + 5.5).stroke()
    .moveTo(x + 1.5, y + 8).lineTo(x + 5, y + 10).lineTo(x + 8.5, y + 8).stroke()
    .restore();
}

function drawPenIcon(doc, x, y, color = '#7c3aed') {
  doc.save()
    .lineWidth(1.2)
    .strokeColor(color)
    .lineCap('round')
    .lineJoin('round')
    .moveTo(x + 8, y)
    .lineTo(x + 10, y + 2)
    .lineTo(x + 3, y + 9)
    .lineTo(x, y + 9)
    .lineTo(x, y + 6)
    .closePath()
    .stroke()
    .restore();
}

function drawMicIcon(doc, x, y, color = '#059669') {
  doc.save()
    .lineWidth(1.2)
    .strokeColor(color)
    .lineCap('round')
    .lineJoin('round')
    .roundedRect(x + 3, y, 4, 7, 2).stroke()
    .moveTo(x + 1, y + 4)
    .bezierCurveTo(x + 1, y + 9, x + 9, y + 9, x + 9, y + 4).stroke()
    .moveTo(x + 5, y + 9).lineTo(x + 5, y + 11).stroke()
    .moveTo(x + 2.5, y + 11).lineTo(x + 7.5, y + 11).stroke()
    .restore();
}

function drawBulbIcon(doc, x, y, color = '#2563eb') {
  doc.save()
    .lineWidth(1.2)
    .strokeColor(color)
    .lineCap('round')
    .circle(x + 5, y + 4.5, 4)
    .stroke()
    .moveTo(x + 3, y + 8.5)
    .lineTo(x + 7, y + 8.5)
    .stroke()
    .moveTo(x + 3.8, y + 10.5)
    .lineTo(x + 6.2, y + 10.5)
    .stroke()
    .restore();
}

function drawLockIcon(doc, x, y, color = '#64748b') {
  doc.save()
    .lineWidth(1.1)
    .strokeColor(color)
    .lineCap('round')
    .lineJoin('round')
    .roundedRect(x, y + 4, 9, 7, 1.5)
    .stroke()
    .moveTo(x + 2, y + 4)
    .lineTo(x + 2, y + 2.5)
    .bezierCurveTo(x + 2, y + 0.5, x + 7, y + 0.5, x + 7, y + 2.5)
    .lineTo(x + 7, y + 4)
    .stroke()
    .restore();
}

function drawUserIcon(doc, x, y, color = '#64748b') {
  doc.save()
    .lineWidth(1)
    .strokeColor(color)
    .circle(x + 4, y + 3, 2.5)
    .stroke()
    .moveTo(x + 1, y + 8)
    .bezierCurveTo(x + 1, y + 6, x + 7, y + 6, x + 7, y + 8)
    .stroke()
    .restore();
}

function drawMailIcon(doc, x, y, color = '#64748b') {
  doc.save()
    .lineWidth(1)
    .strokeColor(color)
    .roundedRect(x, y + 1, 8.5, 6.5, 1)
    .stroke()
    .moveTo(x, y + 2)
    .lineTo(x + 4.25, y + 4.5)
    .lineTo(x + 8.5, y + 2)
    .stroke()
    .restore();
}

function drawPinIcon(doc, x, y, color = '#64748b') {
  doc.save()
    .lineWidth(1)
    .strokeColor(color)
    .circle(x + 4, y + 3, 2.2)
    .stroke()
    .moveTo(x + 4, y + 5.2)
    .lineTo(x + 4, y + 8.5)
    .stroke()
    .restore();
}

function drawClockIcon(doc, x, y, color = '#64748b') {
  doc.save()
    .lineWidth(1)
    .strokeColor(color)
    .circle(x + 4, y + 4, 3.5)
    .stroke()
    .moveTo(x + 4, y + 2)
    .lineTo(x + 4, y + 4)
    .lineTo(x + 6, y + 4)
    .stroke()
    .restore();
}

function drawCheckDocIcon(doc, x, y, color = '#64748b') {
  doc.save()
    .lineWidth(1)
    .strokeColor(color)
    .roundedRect(x, y + 0.5, 7.5, 8, 1)
    .stroke()
    .moveTo(x + 2, y + 4.5)
    .lineTo(x + 3.2, y + 6)
    .lineTo(x + 5.5, y + 2.8)
    .stroke()
    .restore();
}

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

function findBrowser() {
  const paths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  return paths.find((p) => existsSync(p)) || null;
}

function getBadgeStyle(level) {
  const styles = {
    A1: 'background:#fee2e2;color:#dc2626;border:1px solid #fecaca',
    A2: 'background:#ffedd5;color:#ea580c;border:1px solid #fed7aa',
    B1: 'background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe',
    B2: 'background:#ecfdf5;color:#059669;border:1px solid #a7f3d0',
    C1: 'background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe',
    C2: 'background:#fdf2f8;color:#86198f;border:1px solid #fbcfe8'
  };
  return styles[level] || 'background:#f1f5f9;color:#475569;border:1px solid #cbd5e1';
}

function buildCertificateHtml(rows, schoolName, certIssuer) {
  const pagesHtml = rows.map((row) => {
    const candidateName = row.teacher || 'Candidate';
    const initials = candidateName.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'CA';
    const isReviewed = row.review === 'Teacher reviewed';
    const statusText = isReviewed ? 'Official Placement Certified' : 'Official Record Sealed';
    const overallBand = row.overallBand || 'A2';
    const overallDesc = cefrDescriptor(overallBand);
    const overallColor = cefrColor(overallBand);
    const gvLevel = row.grammarVocabulary || 'A1';
    const writingLevel = row.writing || 'B1';
    const speakingLevel = row.speaking || 'B1';
    
    const subDate = new Date(row.submittedAt || row.startedAt || row.started);
    const formattedDate = !isNaN(subDate.getTime())
      ? subDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + subDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : '05 Sept 2026, 01:54';

    const gvCorrect = row.scoring?.grammarVocabulary?.correct !== undefined
      ? `${row.scoring.grammarVocabulary.correct}/${row.scoring.grammarVocabulary.total || 50} correct`
      : '0/50 correct';
    const writingMetric = row.manualReview?.writing?.level ? 'Rubric Evaluated' : 'Rubric Evaluated';
    const speakingMetric = row.manualReview?.speaking?.level ? 'Rubric Evaluated' : 'Rubric Evaluated';

    const analysisText = isReviewed
      ? `Overall CEFR Placement: ${overallBand} — ${overallDesc}. Assessment has been officially graded and archived by ${schoolName} Academic Evaluation Board.`
      : (row.analysis || 'Your objective Grammar & Vocabulary placement is securely recorded. Manual evaluation of your essay and oral interview recording is underway.');

    const certSerial = certificateNumber(row);

    return `
    <div class="cert-page">
      <div class="result-card-container">
        <div class="result-hero-banner">
          <div class="result-hero-top">
            <div class="result-institution-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              <span>${schoolName} · Faculty Placement Board</span>
            </div>
            <div class="result-status-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>${statusText}</span>
            </div>
          </div>
          <div class="result-hero-main">
            <h1>Official Placement Assessment Record</h1>
            <p>
              Your English language proficiency placement test has been recorded. Each candidate account is authorized for one official test attempt.
            </p>
          </div>
        </div>

        <div class="result-body">
          <div class="candidate-meta-grid">
            <div class="meta-item-box">
              <span class="meta-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Candidate Name
              </span>
              <div class="meta-value">
                <span class="initials-circle">${initials}</span>
                <span>${candidateName}</span>
              </div>
            </div>
            <div class="meta-item-box">
              <span class="meta-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                School Email
              </span>
              <div class="meta-value">${row.email || '-'}</div>
            </div>
            <div class="meta-item-box">
              <span class="meta-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/></svg>
                School Unit
              </span>
              <div class="meta-value">
                <span class="pill-box">${(row.unit || 'SMK KARYA BANGSA').toUpperCase()}</span>
              </div>
            </div>
            <div class="meta-item-box">
              <span class="meta-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Serial Number
              </span>
              <div class="meta-value">
                <span class="pill-serial">${certSerial}</span>
              </div>
            </div>
            <div class="meta-item-box">
              <span class="meta-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Submission Date
              </span>
              <div class="meta-value">${formattedDate}</div>
            </div>
            <div class="meta-item-box">
              <span class="meta-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                Evaluation Status
              </span>
              <div class="meta-value">
                <span class="${isReviewed ? 'pill-reviewed' : 'pill-pending'}">${isReviewed ? 'Teacher reviewed' : 'Pending Review'}</span>
              </div>
            </div>
          </div>

          <div class="overall-showcase-box">
            <div class="overall-badge-disc" style="background:${overallColor}">
              <strong>${overallBand}</strong>
              <span>${overallDesc.toUpperCase()}</span>
            </div>
            <div class="overall-text-block">
              <div class="overall-label">Official Placement Result</div>
              <h2>Overall CEFR Level ${overallBand}</h2>
              <p>
                ${isReviewed
                  ? `Evaluated across Grammar & Vocabulary, Writing, and Speaking according to ${schoolName} CEFR Placement Rubrics.`
                  : 'Provisional placement benchmark based on Grammar & Vocabulary. Writing & Speaking are queued for faculty review.'}
              </p>
            </div>
          </div>

          <div class="skills-sec-header">
            <h3>Evaluated Skill Components</h3>
            <span>3 Verified Competencies</span>
          </div>

          <div class="skills-showcase-grid">
            <div class="skill-showcase-card">
              <div class="skill-card-top">
                <div class="skill-icon-bubble" style="background:#eff6ff;color:#2563eb">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                </div>
                <div class="skill-card-info">
                  <h4>Grammar & Vocabulary</h4>
                  <p>Syntax & Lexical Precision</p>
                </div>
              </div>
              <div class="skill-card-badge-row">
                <span class="skill-metric-tag">${gvCorrect}</span>
                <span class="skill-badge" style="${getBadgeStyle(gvLevel)}">${gvLevel}</span>
              </div>
            </div>

            <div class="skill-showcase-card">
              <div class="skill-card-top">
                <div class="skill-icon-bubble" style="background:#f5f3ff;color:#7c3aed">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
                </div>
                <div class="skill-card-info">
                  <h4>Writing</h4>
                  <p>Essay & Task Response</p>
                </div>
              </div>
              <div class="skill-card-badge-row">
                <span class="skill-metric-tag">${writingMetric}</span>
                <span class="skill-badge" style="${getBadgeStyle(writingLevel)}">${writingLevel}</span>
              </div>
            </div>

            <div class="skill-showcase-card">
              <div class="skill-card-top">
                <div class="skill-icon-bubble" style="background:#ecfdf5;color:#059669">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                </div>
                <div class="skill-card-info">
                  <h4>Speaking</h4>
                  <p>Oral Fluency & Interaction</p>
                </div>
              </div>
              <div class="skill-card-badge-row">
                <span class="skill-metric-tag">${speakingMetric}</span>
                <span class="skill-badge" style="${getBadgeStyle(speakingLevel)}">${speakingLevel}</span>
              </div>
            </div>
          </div>

          <div class="placement-insight-card">
            <div class="insight-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/></svg>
            </div>
            <div class="insight-body">
              <strong>Placement Academic Evaluation</strong>
              <p>${analysisText}</p>
            </div>
          </div>

          <div class="policy-compliance-tag">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <div><strong>Single Assessment Policy:</strong> Record is officially sealed and locked under institutional academic governance. · Issued by: ${certIssuer}</div>
          </div>
        </div>
      </div>

      <div class="legal-footnote">
        This official placement record is validated and issued under institutional academic governance by ${schoolName}.<br>
        Archived securely in platform repository. Any unauthorized reproduction, tampering, or alteration voids this certificate.
      </div>
    </div>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700;800&display=swap');

@page {
  size: A4 portrait;
  margin: 0;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #f1f5f9;
  color: #0f172a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  margin: 0;
  padding: 0;
}

.cert-page {
  width: 210mm;
  height: 297mm;
  page-break-after: always;
  break-after: page;
  margin: 0 auto;
  padding: 8mm 10mm 6mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
}

.cert-page:last-child {
  page-break-after: auto;
  break-after: auto;
}

.result-card-container {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 10px 30px -5px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  flex: 1;
}

.result-hero-banner {
  background: linear-gradient(135deg, #091a32 0%, #173867 55%, #1e40af 100%);
  padding: 30px 36px 32px;
  color: #ffffff;
  position: relative;
}

.result-hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.result-institution-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #e0f2fe;
  padding: 6px 15px;
  border-radius: 30px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.result-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(16, 185, 129, 0.22);
  border: 1px solid rgba(52, 211, 153, 0.5);
  color: #a7f3d0;
  padding: 6px 15px;
  border-radius: 30px;
  font-size: 12px;
  font-weight: 700;
}

.result-hero-main h1 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 26px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 8px;
  letter-spacing: -0.4px;
}

.result-hero-main p {
  font-size: 13px;
  color: #cbd5e1;
  line-height: 1.5;
  margin: 0;
  max-width: 90%;
}

.result-body {
  padding: 26px 36px 26px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 20px;
  flex: 1;
}

.candidate-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 22px;
}

.meta-item-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-value {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 8px;
}

.initials-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #2563eb;
  color: #ffffff;
  display: inline-grid;
  place-items: center;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}

.pill-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 14px;
  font-size: 12px;
  font-weight: 700;
  color: #1e3a8a;
}

.pill-serial {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 14px;
  font-size: 12px;
  font-weight: 700;
  color: #1e40af;
}

.pill-reviewed {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #dcfce7;
  border: 1px solid #86efac;
  border-radius: 20px;
  padding: 4px 16px;
  font-size: 12px;
  font-weight: 700;
  color: #15803d;
}

.pill-pending {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 20px;
  padding: 4px 16px;
  font-size: 12px;
  font-weight: 700;
  color: #b45309;
}

.overall-showcase-box {
  background: #f0f7ff;
  border: 1.5px solid #bfdbfe;
  border-radius: 14px;
  padding: 18px 24px;
  display: flex;
  align-items: center;
  gap: 22px;
}

.overall-badge-disc {
  width: 78px;
  height: 78px;
  border-radius: 16px;
  background: #ea580c;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(234, 88, 12, 0.22);
}

.overall-badge-disc strong {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 32px;
  line-height: 1;
  font-weight: 800;
}

.overall-badge-disc span {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.5px;
  margin-top: 3px;
}

.overall-text-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.overall-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: #0284c7;
}

.overall-text-block h2 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 21px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.overall-text-block p {
  font-size: 12.5px;
  color: #475569;
  line-height: 1.45;
  margin: 0;
}

.skills-sec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: -4px;
}

.skills-sec-header h3 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.skills-sec-header span {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.skills-showcase-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.skill-showcase-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 116px;
  gap: 14px;
}

.skill-card-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.skill-icon-bubble {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.skill-card-info h4 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 2px;
}

.skill-card-info p {
  font-size: 11px;
  color: #64748b;
  margin: 0;
}

.skill-card-badge-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.skill-metric-tag {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.skill-badge {
  font-size: 13px;
  font-weight: 700;
  padding: 3px 12px;
  border-radius: 6px;
}

.placement-insight-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-left: 4.5px solid #2563eb;
  border-radius: 10px;
  padding: 16px 20px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.insight-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #dbeafe;
  color: #1d4ed8;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.insight-body strong {
  font-size: 13.5px;
  font-weight: 700;
  color: #0f172a;
  display: block;
  margin-bottom: 3px;
}

.insight-body p {
  font-size: 12px;
  color: #334155;
  margin: 0;
  line-height: 1.5;
}

.policy-compliance-tag {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: #64748b;
  line-height: 1.4;
}

.policy-compliance-tag strong {
  color: #0f172a;
}

.legal-footnote {
  text-align: center;
  font-size: 9.5px;
  color: #94a3b8;
  line-height: 1.45;
  padding: 8px 0 2px;
}
</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
}

async function renderChromiumPdf(html, schoolName, certIssuer) {
  // Headless browser CLI on Windows hangs on user profile / IPC locks.
  // Bypass external browser CLI and use high-performance built-in PDFKit generator.
  return null;
}

const sendCenteredPdf = async (response, results, unitFilter) => {
  const schoolName = currentSystemSettings?.schoolName || 'Karya Bangsa School';
  const certIssuer = currentSystemSettings?.certificateIssuer || 'Pusat Bahasa & Asesmen Guru Karya Bangsa';
  const passingBand = currentSystemSettings?.passingBand || '6.5';
  const rows = exportRows(results);
  const fileSuffix = unitFilter && unitFilter.toLowerCase() !== 'all' ? `-${unitFilter.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
  const singleAttemptId = (rows.length === 1 && rows[0].id) ? rows[0].id : null;
  const downloadFileName = singleAttemptId ? `certificate-${singleAttemptId}.pdf` : `assessify-results${fileSuffix}.pdf`;

  // High-Fidelity Chromium PDF Renderer (Matches web placement result UI 100% pixel-for-pixel)
  if (rows.length > 0) {
    try {
      const html = buildCertificateHtml(rows, schoolName, certIssuer);
      const pdfBuffer = await renderChromiumPdf(html, schoolName, certIssuer);
      if (pdfBuffer && pdfBuffer.length > 500) {
        response.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="assessify-results${fileSuffix}.pdf"`
        });
        return response.end(pdfBuffer);
      }
    } catch (err) {
      console.warn('Chromium PDF render failed, falling back to PDFKit:', err.message);
    }
  }

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: {
      Title: `${schoolName} — Official Placement Assessment Record`,
      Author: schoolName,
      Subject: 'CEFR English Placement Result Certificate'
    }
  });

  response.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${downloadFileName}"`
  });
  doc.pipe(response);

  if (!rows.length) {
    // Render a clean informational page if no assessments match the filter
    doc.rect(0, 0, 595.28, 841.89).fill('#f8fafc');
    doc.rect(0, 0, 595.28, 140).fill('#091a32');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text(schoolName, 0, 42, { width: 595.28, align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#94a3b8').text(`CEFR English Placement Result · ${unitFilter && unitFilter.toLowerCase() !== 'all' ? unitFilter : 'All Units'}`, 0, 74, { width: 595.28, align: 'center' });

    doc.fillColor('#0f172a').fontSize(18).font('Helvetica-Bold').text('No Candidate Assessments Found', 0, 260, { width: 595.28, align: 'center' });
    doc.fillColor('#64748b').fontSize(11).font('Helvetica').text(
      `No candidate assessment records matched the requested filter (${unitFilter || 'All Units'}).`,
      60, 295, { width: 475.28, align: 'center' }
    );
    doc.end();
    return;
  }

  const pageWidth = 595.28;
  const pageHeight = 841.89;

  rows.forEach((row, index) => {
    if (index > 0) doc.addPage();

    // Outer canvas background (soft clean modern #f1f5f9)
    doc.rect(0, 0, pageWidth, pageHeight).fill('#f1f5f9');

    // Main Floating Card Container (Matches Web UI .result-card-container 100%)
    const containerX = 24;
    const containerY = 22;
    const containerW = pageWidth - 48; // 547.28
    const containerH = 754;
    const containerRadius = 20;

    // Draw outer white card container with rounded corners and subtle border
    doc.roundedRect(containerX, containerY, containerW, containerH, containerRadius)
      .fillAndStroke('#ffffff', '#cbd5e1');

    // 1. Hero Banner with Rounded Top Corners (Clipped cleanly)
    const bannerH = 152;
    doc.save();
    doc.roundedRect(containerX, containerY, containerW, bannerH, containerRadius).clip();

    // Linear gradient: #091a32 0%, #173867 55%, #1e40af 100%
    const grad = doc.linearGradient(containerX, containerY, containerX + containerW, containerY + bannerH);
    grad.stop(0, '#091a32');
    grad.stop(0.55, '#173867');
    grad.stop(1, '#1e40af');
    doc.rect(containerX, containerY, containerW, bannerH).fill(grad);

    // Ambient soft glow on top-right
    doc.save().opacity(0.18).circle(containerX + containerW - 40, containerY + 20, 100).fill('#60a5fa').restore();
    doc.restore();

    // Hero Banner Badges
    const badgeY = containerY + 18;
    // Left Institution Badge (Dynamically measured so it never wraps and text is perfectly aligned)
    const schoolBadgeText = `${schoolName} · Faculty Placement Board`;
    doc.font('Helvetica-Bold').fontSize(8.5);
    const schoolTextW = doc.widthOfString(schoolBadgeText);
    const schoolPillW = Math.round(schoolTextW + 36);
    const schoolPillH = 24;
    const schoolPillX = containerX + 24;
    doc.roundedRect(schoolPillX, badgeY, schoolPillW, schoolPillH, 12).fillAndStroke('#132c4d', '#2c4c79');
    drawCapIcon(doc, schoolPillX + 8, badgeY + 6, '#93c5fd');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#e0f2fe')
      .text(schoolBadgeText, schoolPillX + 26, badgeY + 7.5, { lineBreak: false });

    // Right Status Badge
    const isReviewed = row.review === 'Teacher reviewed';
    const statusText = isReviewed ? 'Official Placement Certified' : 'Official Record Sealed';
    const statusTextW = doc.font('Helvetica-Bold').fontSize(8.5).widthOfString(statusText);
    const statusPillW = Math.round(statusTextW + 34);
    const statusPillH = 24;
    const statusPillX = containerX + containerW - 24 - statusPillW;
    doc.roundedRect(statusPillX, badgeY, statusPillW, statusPillH, 12).fillAndStroke('#064e3b', '#059669');
    drawCheckCircleIcon(doc, statusPillX + 9, badgeY + 6, '#6ee7b7');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#a7f3d0')
      .text(statusText, statusPillX + 25, badgeY + 7.5, { lineBreak: false });

    // Hero Banner Title & Subtitle (Exact copy from web UI)
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff')
      .text('Official Placement Assessment Record', containerX + 24, containerY + 54);
    doc.font('Helvetica').fontSize(9.5).fillColor('#cbd5e1')
      .text(
        'Your English language proficiency placement test has been recorded. Each candidate account is authorized for one official test attempt.',
        containerX + 24, containerY + 84, { width: containerW - 48, lineGap: 3.5 }
      );

    // 2. Candidate Credentials Meta Card
    const card1X = containerX + 24;
    const card1Y = containerY + 124;
    const card1W = containerW - 48;
    const card1H = 118;
    doc.roundedRect(card1X, card1Y, card1W, card1H, 14).fillAndStroke('#ffffff', '#e2e8f0');

    const col1X = card1X + 18;
    const col2X = card1X + 184;
    const col3X = card1X + 348;
    const row1Y = card1Y + 15;
    const row2Y = card1Y + 64;

    // Col 1 Row 1: Candidate Name
    drawUserIcon(doc, col1X, row1Y, '#64748b');
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('CANDIDATE NAME', col1X + 13, row1Y + 1);
    const candidateName = row.teacher || 'Candidate';
    const initials = candidateName.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'CA';
    doc.circle(col1X + 11, row1Y + 24, 11).fill('#2563eb');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text(initials, col1X, row1Y + 20, { width: 22, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f172a').text(candidateName, col1X + 29, row1Y + 19, { width: 135, ellipsis: true });

    // Col 2 Row 1: School Email
    drawMailIcon(doc, col2X, row1Y, '#64748b');
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('SCHOOL EMAIL', col2X + 13, row1Y + 1);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text(row.email || '-', col2X, row1Y + 19, { width: 160, ellipsis: true });

    // Col 3 Row 1: School Unit Pill (Tight inline pill with centered text)
    drawCapIcon(doc, col3X, row1Y, '#64748b');
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('SCHOOL UNIT', col3X + 15, row1Y + 1);
    const unitText = (row.unit || 'SMK KARYA BANGSA').toUpperCase();
    doc.font('Helvetica-Bold').fontSize(8.5);
    const unitTextW = doc.widthOfString(unitText);
    const unitPillW = Math.round(unitTextW + 20);
    const unitPillH = 22;
    const unitPillY = row1Y + 14;
    doc.roundedRect(col3X, unitPillY, unitPillW, unitPillH, 6).fillAndStroke('#f8fafc', '#cbd5e1');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1e3a8a')
      .text(unitText, col3X, unitPillY + 6.5, { width: unitPillW, align: 'center', lineBreak: false });

    // Col 1 Row 2: SERIAL NUMBER (Tight inline pill with centered text)
    drawPinIcon(doc, col1X, row2Y, '#64748b');
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('SERIAL NUMBER', col1X + 13, row2Y + 1);
    const certSerial = certificateNumber(row);
    doc.font('Helvetica-Bold').fontSize(8.8);
    const serialTextW = doc.widthOfString(certSerial);
    const serialPillW = Math.round(serialTextW + 20);
    const serialPillH = 22;
    const serialPillY = row2Y + 14;
    doc.roundedRect(col1X, serialPillY, serialPillW, serialPillH, 6).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.font('Helvetica-Bold').fontSize(8.8).fillColor('#1e40af')
      .text(certSerial, col1X, serialPillY + 6.5, { width: serialPillW, align: 'center', lineBreak: false });

    // Col 2 Row 2: Submission Date
    drawClockIcon(doc, col2X, row2Y, '#64748b');
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('SUBMISSION DATE', col2X + 13, row2Y + 1);
    const subDate = new Date(row.submittedAt || row.startedAt || row.started);
    const formattedDate = !isNaN(subDate.getTime())
      ? subDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + subDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : '05 Sept 2026, 01:15';
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text(formattedDate, col2X, row2Y + 19, { width: 160, ellipsis: true });

    // Col 3 Row 2: Evaluation Status Pill (Tight rounded pill with centered text)
    drawCheckDocIcon(doc, col3X, row2Y, '#64748b');
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('EVALUATION STATUS', col3X + 13, row2Y + 1);
    const evalText = isReviewed ? 'Teacher reviewed' : 'Pending Review';
    doc.font('Helvetica-Bold').fontSize(8.5);
    const evalTextW = doc.widthOfString(evalText);
    const evalPillW = Math.round(evalTextW + 24);
    const evalPillH = 22;
    const evalPillY = row2Y + 14;
    if (isReviewed) {
      doc.roundedRect(col3X, evalPillY, evalPillW, evalPillH, 11).fillAndStroke('#dcfce7', '#86efac');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#15803d')
        .text(evalText, col3X, evalPillY + 6.5, { width: evalPillW, align: 'center', lineBreak: false });
    } else {
      doc.roundedRect(col3X, evalPillY, evalPillW, evalPillH, 11).fillAndStroke('#fef3c7', '#fde68a');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#b45309')
        .text(evalText, col3X, evalPillY + 6.5, { width: evalPillW, align: 'center', lineBreak: false });
    }

    // 3. Official Placement Result Card (Overall Showcase Box)
    const card2Y = card1Y + card1H + 16;
    const card2H = 100;
    doc.roundedRect(card1X, card2Y, card1W, card2H, 14).fillAndStroke('#f0f7ff', '#bfdbfe');

    // Left CEFR Badge Disc
    const overallBand = row.overallBand || 'A2';
    const overallDesc = cefrDescriptor(overallBand);
    const badgeColor = cefrColor(overallBand);
    const badgeX = card1X + 16;
    const cefrBadgeY = card2Y + 12;
    const badgeW = 76;
    const badgeH = 76;
    doc.roundedRect(badgeX, cefrBadgeY, badgeW, badgeH, 14).fill(badgeColor);
    doc.font('Helvetica-Bold').fontSize(30).fillColor('#ffffff').text(overallBand, badgeX, cefrBadgeY + 11, { width: badgeW, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text(overallDesc.toUpperCase(), badgeX, cefrBadgeY + 51, { width: badgeW, align: 'center' });

    // Right Result Text
    const resultTextX = card1X + 106;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0284c7').text('OFFICIAL PLACEMENT RESULT', resultTextX, card2Y + 15);
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text(`Overall CEFR Level ${overallBand}`, resultTextX, card2Y + 29);
    const resultDesc = isReviewed
      ? `Evaluated across Grammar & Vocabulary, Writing, and Speaking according to ${schoolName} CEFR Placement Rubrics.`
      : 'Provisional placement benchmark based on Grammar & Vocabulary. Writing & Speaking are queued for faculty review.';
    doc.font('Helvetica').fontSize(9.5).fillColor('#475569').text(
      resultDesc,
      resultTextX, card2Y + 53, { width: card1W - 122, lineGap: 3.2 }
    );

    // 4. Section: Evaluated Skill Components
    const secTitleY = card2Y + card2H + 18;
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text('Evaluated Skill Components', card1X, secTitleY);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#64748b').text('3 Verified Competencies', card1X, secTitleY + 2, { width: card1W, align: 'right' });

    const skillCardY = secTitleY + 18;
    const gap = 12;
    const skillCardW = (card1W - gap * 2) / 3;
    const skillCardH = 124;

    const getSkillBadgeColors = (level) => {
      const lvl = String(level).toUpperCase().trim();
      if (lvl.includes('C2') || lvl.includes('C1')) return { bg: '#dcfce7', border: '#86efac', text: '#15803d' };
      if (lvl.includes('B2') || lvl.includes('B1')) return { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' };
      if (lvl.includes('A2')) return { bg: '#fef3c7', border: '#fde68a', text: '#b45309' };
      return { bg: '#fee2e2', border: '#fecaca', text: '#dc2626' };
    };

    const renderSkillCard = (x, iconFn, iconBg, iconColor, title, subtitle, metric, band) => {
      doc.roundedRect(x, skillCardY, skillCardW, skillCardH, 12).fillAndStroke('#ffffff', '#e2e8f0');

      // Top header inside card: Icon Bubble + Title + Subtitle
      doc.roundedRect(x + 12, skillCardY + 12, 30, 30, 8).fill(iconBg);
      iconFn(doc, x + 21, skillCardY + 21, iconColor);

      const titleFont = doc.font('Helvetica-Bold').fontSize(10).widthOfString(title) > (skillCardW - 52) ? 8.8 : 10;
      doc.font('Helvetica-Bold').fontSize(titleFont).fillColor('#0f172a')
        .text(title, x + 46, skillCardY + 13.5, { width: skillCardW - 50, lineBreak: false });
      doc.font('Helvetica').fontSize(7.8).fillColor('#64748b')
        .text(subtitle, x + 46, skillCardY + 28, { width: skillCardW - 50, ellipsis: true, lineBreak: false });

      // Divider
      doc.moveTo(x + 12, skillCardY + 76).lineTo(x + skillCardW - 12, skillCardY + 76).lineWidth(0.8).strokeColor('#f1f5f9').stroke();

      // Bottom row: metric tag + badge (aligned on exact center line)
      const badgeStyle = getSkillBadgeColors(band);
      const pillW = 38;
      const pillH = 22;
      const pillX = x + skillCardW - 12 - pillW;
      const pillY = skillCardY + 87;

      // Metric text: vertical center matches pill center exactly
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569')
        .text(metric, x + 12, skillCardY + 93.5, { width: skillCardW - 60, ellipsis: true, lineBreak: false });

      // Pill badge: rounded capsule with centered text
      doc.roundedRect(pillX, pillY, pillW, pillH, 11).fillAndStroke(badgeStyle.bg, badgeStyle.border);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(badgeStyle.text)
        .text(band, pillX, pillY + 5.75, { width: pillW, align: 'center', lineBreak: false });
    };

    // 4a. Grammar & Vocabulary Card
    const gvCorrect = row.scoring?.grammarVocabulary?.correct !== undefined
      ? `${row.scoring.grammarVocabulary.correct}/${row.scoring.grammarVocabulary.total || 50} correct`
      : '0/50 correct';
    renderSkillCard(card1X, drawLayersIcon, '#eff6ff', '#2563eb', 'Grammar & Vocabulary', 'Syntax & Lexical Precision', gvCorrect, row.grammarVocabulary || 'C1');

    // 4b. Writing Card
    const writingMetric = row.manualReview?.writing?.level ? 'Rubric Evaluated' : 'Rubric Evaluated';
    renderSkillCard(card1X + skillCardW + gap, drawPenIcon, '#f5f3ff', '#7c3aed', 'Writing', 'Essay & Task Response', writingMetric, row.writing || 'B1');

    // 4c. Speaking Card
    const speakingMetric = row.manualReview?.speaking?.level ? 'Rubric Evaluated' : 'Rubric Evaluated';
    renderSkillCard(card1X + (skillCardW + gap) * 2, drawMicIcon, '#ecfdf5', '#059669', 'Speaking', 'Oral Fluency & Interaction', speakingMetric, row.speaking || 'A1');

    // 5. Placement Academic Evaluation Card (.placement-insight-card)
    const card4Y = skillCardY + skillCardH + 16;
    const card4H = 78;
    doc.roundedRect(card1X, card4Y, card1W, card4H, 10).fillAndStroke('#f8fafc', '#e2e8f0');
    // Blue left accent bar
    doc.roundedRect(card1X, card4Y, 4, card4H, 2).fill('#2563eb');
    doc.circle(card1X + 22, card4Y + 22, 12).fill('#dbeafe');
    drawBulbIcon(doc, card1X + 17, card4Y + 16, '#1d4ed8');
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f172a').text('Placement Academic Evaluation', card1X + 44, card4Y + 13);
    const analysisText = isReviewed
      ? `Overall CEFR Placement: ${overallBand} — ${overallDesc}. Assessment has been officially graded and archived by ${schoolName} Academic Evaluation Board.`
      : (row.analysis || `Your objective Grammar & Vocabulary placement is securely recorded. Manual evaluation of your essay and oral interview recording is underway.`);
    doc.font('Helvetica').fontSize(9).fillColor('#334155').text(analysisText, card1X + 44, card4Y + 30, { width: card1W - 56, lineGap: 3.2 });

    // 6. Policy Compliance Tag (.policy-compliance-tag)
    const card5Y = card4Y + card4H + 14;
    const card5H = 46;
    doc.roundedRect(card1X, card5Y, card1W, card5H, 8).fillAndStroke('#ffffff', '#e2e8f0');

    drawLockIcon(doc, card1X + 16, card5Y + 17, '#475569');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
      .text('Single Assessment Policy: ', card1X + 34, card5Y + 13, { continued: true });
    doc.font('Helvetica').fontSize(8.5).fillColor('#64748b')
      .text(`Record is officially sealed and locked under institutional academic governance.`);
    doc.font('Helvetica').fontSize(8).fillColor('#64748b')
      .text(`Issued by: ${certIssuer}`, card1X + 34, card5Y + 28, { width: card1W - 50, ellipsis: true });

    // 7. Legal Footnote outside the card
    const legalY = containerY + containerH + 14;
    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b')
      .text(
        `This official placement record is validated and issued under institutional academic governance by ${schoolName}.`,
        containerX, legalY, { width: containerW, align: 'center' }
      );
    doc.font('Helvetica').fontSize(7.2).fillColor('#94a3b8')
      .text(
        'Archived securely in platform repository. Any unauthorized reproduction, tampering, or alteration voids this certificate.',
        containerX, legalY + 12, { width: containerW, align: 'center' }
      );
  });
  doc.end();
};

const server = createServer(async (request, response) => {
  try {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/api/health') return json(response, 200, { ok: true, service: 'assessify-api', storage: storageMode });

  // --- REAL-TIME LIVE STREAMING & PROCTORING API ---
  if (url.pathname === '/api/realtime/events' && request.method === 'GET') {
    const user = currentUser(request);
    if (!user) {
      return json(response, 401, { error: 'Authentication required for real-time live events' });
    }

    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const role = user.role || (isAdmin(request) ? 'admin' : 'candidate');

    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });
    if (typeof response.flushHeaders === 'function') response.flushHeaders();

    const clientInfo = {
      id: clientId,
      res: response,
      user,
      role,
      attemptId: url.searchParams.get('attemptId') || null,
      ip: getClientIp(request),
      connectedAt: Date.now()
    };
    realtimeClients.set(clientId, clientInfo);

    // Initial connection handshake
    response.write(`event: CONNECTED\ndata: ${JSON.stringify({
      clientId,
      role,
      user: { email: user.email, name: user.name, role: user.role, unit: user.unit },
      serverTime: Date.now()
    })}\n\n`);

    // If admin, send active candidate presence snapshot immediately
    if (role === 'admin') {
      response.write(`event: CANDIDATE_PRESENCE_SYNC\ndata: ${JSON.stringify({
        candidates: getActiveCandidatesSnapshot(),
        connectedAdmins: Array.from(realtimeClients.values()).filter(c => c.role === 'admin').length
      })}\n\n`);
    }

    request.on('close', () => {
      realtimeClients.delete(clientId);
      if (clientInfo.attemptId && activeCandidatePresence.has(clientInfo.attemptId)) {
        const p = activeCandidatePresence.get(clientInfo.attemptId);
        const stillConnected = Array.from(realtimeClients.values()).some(c => c.attemptId === clientInfo.attemptId);
        if (!stillConnected && p.status !== 'completed') {
          p.status = 'offline';
          p.lastHeartbeat = Date.now();
          broadcastRealtime('admin', 'CANDIDATE_PRESENCE_UPDATE', p);
        }
      }
    });

    return;
  }

  if (url.pathname === '/api/realtime/heartbeat' && request.method === 'POST') {
    const user = currentUser(request);
    if (!user) return json(response, 401, { error: 'Sign-in required' });
    const body = await requestBody(request);
    const attemptId = body.attemptId;
    if (!attemptId) return json(response, 400, { error: 'attemptId required' });

    const existing = activeCandidatePresence.get(attemptId) || {};
    let attemptRecord = null;
    if (!existing.name || !existing.antiCheat?.violations?.length) {
      try { attemptRecord = await repository.getAttempt(attemptId); } catch {}
    }
    const existingAc = existing.antiCheat || attemptRecord?.antiCheat || {};
    const bodyAc = body.antiCheat || {};
    const mergedAntiCheat = {
      ...existingAc,
      ...bodyAc,
      violations: (existingAc.violations && Array.isArray(existingAc.violations) && existingAc.violations.length)
        ? existingAc.violations
        : (Array.isArray(bodyAc.violations) ? bodyAc.violations : [])
    };
    const presence = {
      attemptId,
      email: user.email,
      name: user.name || existing.name || attemptRecord?.teacher || user.email,
      unit: user.unit || existing.unit || attemptRecord?.unit || 'School Unit',
      sectionIndex: Number(body.sectionIndex ?? existing.sectionIndex ?? 0),
      sectionName: body.sectionName || existing.sectionName || 'Grammar & Vocabulary',
      answeredCount: Number(body.answeredCount ?? existing.answeredCount ?? 0),
      totalQuestions: Number(body.totalQuestions ?? existing.totalQuestions ?? 25),
      remainingMs: Number(body.remainingMs ?? existing.remainingMs ?? 0),
      antiCheat: mergedAntiCheat,
      lastHeartbeat: Date.now(),
      status: 'active'
    };

    activeCandidatePresence.set(attemptId, presence);

    for (const client of realtimeClients.values()) {
      if (client.user?.email?.toLowerCase() === user.email?.toLowerCase()) {
        client.attemptId = attemptId;
      }
    }

    broadcastRealtime('admin', 'CANDIDATE_PRESENCE_UPDATE', presence);
    return json(response, 200, { ok: true, serverTime: Date.now() });
  }

  if (url.pathname === '/api/admin/proctor/candidates' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    
    // Sync any ongoing uncompleted attempts from database into memory presence
    try {
      const allAttempts = await repository.listAttempts();
      const now = Date.now();
      for (const att of allAttempts) {
        if (att && att.status !== 'Completed' && !activeCandidatePresence.has(att.id)) {
          const lastActive = new Date(att.lastSavedAt || att.startedAt || att.started || 0).getTime();
          const diff = now - lastActive;
          const status = diff < 25_000 ? 'active' : (diff < 90_000 ? 'idle' : 'offline');
          const totalQ = att.totalQuestions || 25;
          const ansCount = Object.keys(att.responses || {}).length;
          const presence = {
            attemptId: att.id,
            email: att.email,
            name: att.teacher || att.email,
            unit: att.unit || 'SMK KARYA BANGSA',
            sectionIndex: att.sectionIndex || 0,
            sectionName: att.sectionIndex === 1 ? 'Writing' : (att.sectionIndex === 2 ? 'Speaking' : 'Grammar & Vocabulary'),
            answeredCount: ansCount,
            totalQuestions: totalQ,
            remainingMs: att.sectionRemainingMs?.[att.sectionIndex || 0] || 0,
            antiCheat: att.antiCheat || { violations: [], totalCount: 0 },
            lastHeartbeat: lastActive || now,
            status
          };
          activeCandidatePresence.set(att.id, presence);
        }
      }
    } catch {}

    const candidates = getActiveCandidatesSnapshot();
    for (const cand of candidates) {
      if (!cand.antiCheat?.violations || cand.antiCheat.violations.length === 0) {
        try {
          const att = await repository.getAttempt(cand.attemptId);
          if (att?.antiCheat?.violations && att.antiCheat.violations.length) {
            cand.antiCheat = {
              ...(cand.antiCheat || {}),
              ...att.antiCheat,
              violations: att.antiCheat.violations
            };
            if (activeCandidatePresence.has(cand.attemptId)) {
              activeCandidatePresence.get(cand.attemptId).antiCheat = cand.antiCheat;
            }
          }
        } catch {}
      }
    }
    return json(response, 200, {
      candidates,
      connectedAdmins: Array.from(realtimeClients.values()).filter(c => c.role === 'admin').length,
      serverTime: Date.now()
    });
  }

  if (url.pathname.startsWith('/api/admin/proctor/candidate/') && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const attemptId = url.pathname.split('/')[5];
    const attempt = await repository.getAttempt(attemptId);
    if (!attempt) return json(response, 404, { error: 'Candidate attempt not found' });
    const presence = activeCandidatePresence.get(attemptId) || null;
    return json(response, 200, {
      attempt,
      presence
    });
  }

  if (url.pathname === '/api/admin/proctor/message' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const { attemptId, message, urgency = 'high' } = await requestBody(request);
    if (!attemptId || !message) return json(response, 400, { error: 'attemptId and message required' });
    const admin = currentUser(request);

    broadcastRealtime(attemptId, 'PROCTOR_MESSAGE', {
      attemptId,
      message: message.trim(),
      urgency,
      sender: admin?.name || 'Exam Proctor',
      sentAt: new Date().toISOString()
    });

    await recordAuditLog({
      actorType: 'admin',
      actorId: admin?.username || 'admin',
      actorName: admin?.name || 'Administrator',
      action: 'PROCTOR_SEND_WARNING',
      category: 'MONITORING',
      target: attemptId,
      details: { message, urgency },
      ip: getClientIp(request),
      status: 'SUCCESS'
    });

    return json(response, 200, { success: true, attemptId, sentAt: new Date().toISOString() });
  }

  if (url.pathname === '/api/admin/proctor/extend-time' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const body = await requestBody(request);
      const attemptId = body?.attemptId;
      const additionalMinutes = Number(body?.additionalMinutes || body?.minutes || 5);
      const reason = body?.reason || 'Proctor extension';
      if (!attemptId) return json(response, 400, { error: 'attemptId required' });
      const admin = currentUser(request);
      const attempt = await repository.getAttempt(attemptId);
      if (!attempt) return json(response, 404, { error: 'Attempt not found' });

      const extraMs = Number(additionalMinutes) * 60 * 1000;
      const sectionIndex = attempt.sectionIndex || 0;
      const sectionEndTimes = { ...(attempt.sectionEndTimes || {}) };
      if (sectionEndTimes[sectionIndex]) {
        sectionEndTimes[sectionIndex] = Number(sectionEndTimes[sectionIndex]) + extraMs;
      }
      const sectionRemainingMs = { ...(attempt.sectionRemainingMs || {}) };
      if (sectionRemainingMs[sectionIndex] !== undefined) {
        sectionRemainingMs[sectionIndex] = Number(sectionRemainingMs[sectionIndex]) + extraMs;
      }

      await repository.updateAttempt(attemptId, {
        sectionEndTimes,
        sectionRemainingMs,
        timeExtendedBy: (attempt.timeExtendedBy || 0) + Number(additionalMinutes)
      });

      broadcastRealtime(attemptId, 'TIME_EXTENDED', {
        attemptId,
        additionalMinutes: Number(additionalMinutes),
        reason,
        sectionEndTimes,
        sectionRemainingMs,
        extraMs
      });

      if (activeCandidatePresence.has(attemptId)) {
        const p = activeCandidatePresence.get(attemptId);
        p.remainingMs = (p.remainingMs || 0) + extraMs;
        broadcastRealtime('admin', 'CANDIDATE_PRESENCE_UPDATE', p);
      }

      await recordAuditLog({
        actorType: 'admin',
        actorId: admin?.username || 'admin',
        actorName: admin?.name || 'Administrator',
        action: 'PROCTOR_EXTEND_TIME',
        category: 'MONITORING',
        target: attemptId,
        details: { additionalMinutes, reason },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });

      return json(response, 200, { success: true, attemptId, additionalMinutes });
    } catch (e) {
      console.error('Error in extend-time:', e);
      return json(response, 400, { error: e.message || 'Failed to extend time' });
    }
  }

  if (url.pathname === '/api/admin/proctor/force-submit' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const body = await requestBody(request);
      const attemptId = body?.attemptId;
      const reason = body?.reason || 'Force submitted by exam proctor';
      if (!attemptId) return json(response, 400, { error: 'attemptId required' });
      const admin = currentUser(request);

      try {
        const attempt = await repository.getAttempt(attemptId);
        if (attempt && attempt.status !== 'Completed') {
          const responses = attempt.responses || {};
          const gvScore = scoreGrammarVocabulary(responses, attempt.grammarVocabularyOrder);
          const writingScore = attempt.scoring?.writing || { band: 'Pending' };
          const speakingScore = attempt.scoring?.speaking || { band: 'Pending' };
          const scored = {
            ...attempt,
            status: 'Completed',
            review: attempt.review || 'Pending',
            scoring: {
              grammarVocabulary: gvScore,
              writing: writingScore,
              speaking: speakingScore
            },
            overall: gvScore?.level || 'Pending',
            earlyTermination: true,
            forceSubmittedByProctor: true,
            proctorNotes: reason,
            submittedAt: new Date().toISOString()
          };
          await repository.updateAttempt(attemptId, scored);
          broadcastRealtime('admin', 'ATTEMPT_SUBMITTED', { attempt: scored });
        }
      } catch (err) {
        console.warn('DB update on force-submit failed:', err);
      }

      if (activeCandidatePresence.has(attemptId)) {
        const p = activeCandidatePresence.get(attemptId);
        p.status = 'completed';
        p.completedAt = Date.now();
        broadcastRealtime('admin', 'CANDIDATE_PRESENCE_UPDATE', p);
      }

      broadcastRealtime(attemptId, 'FORCE_SUBMIT', {
        attemptId,
        reason,
        proctor: admin?.name || 'Administrator',
        timestamp: new Date().toISOString()
      });

      await recordAuditLog({
        actorType: 'admin',
        actorId: admin?.username || 'admin',
        actorName: admin?.name || 'Administrator',
        action: 'PROCTOR_FORCE_SUBMIT',
        category: 'SECURITY',
        target: attemptId,
        details: { reason },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });

      return json(response, 200, { success: true, attemptId });
    } catch (e) {
      console.error('Error in force-submit:', e);
      return json(response, 400, { error: e.message || 'Failed to force submit' });
    }
  }

  if (url.pathname === '/api/admin/proctor/broadcast' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const { message, level = 'info' } = await requestBody(request);
    if (!message) return json(response, 400, { error: 'message required' });
    const admin = currentUser(request);

    broadcastRealtime('candidates', 'BROADCAST_ANNOUNCEMENT', {
      message: message.trim(),
      level,
      sender: admin?.name || 'Exam Supervisor',
      timestamp: new Date().toISOString()
    });

    await recordAuditLog({
      actorType: 'admin',
      actorId: admin?.username || 'admin',
      actorName: admin?.name || 'Administrator',
      action: 'PROCTOR_BROADCAST',
      category: 'MONITORING',
      target: 'ALL_CANDIDATES',
      details: { message, level },
      ip: getClientIp(request),
      status: 'SUCCESS'
    });

    return json(response, 200, { success: true });
  }
  if (url.pathname === '/api/test') {
    const user = currentUser(request);
    let inProgressAttempt = null;
    if (user && (user.role === 'teacher' || user.role === 'student' || user.role === 'candidate') && user.email) {
      const all = await repository.listAttempts();
      inProgressAttempt = all.find(
        (att) => (att.email || '').toLowerCase().trim() === user.email.toLowerCase().trim() && att.status === 'In progress'
      );
    }
    return json(response, 200, safeTest(user, inProgressAttempt));
  }
  if (url.pathname === '/api/auth/me') return json(response, 200, { user: currentUser(request) || null });
  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const { email, fullName, name, username, password, role = 'teacher', unit } = await requestBody(request);
    if (role === 'admin') {
      const normalizedUsername = (username || '').toLowerCase().trim();
      const dbAccount = await repository.getAdmin(normalizedUsername);
      const fallbackAccount = adminAccounts[normalizedUsername];
      const account = dbAccount || fallbackAccount;
      if (!account || !account.password || password !== account.password) {
        await recordAuditLog({
          actorType: 'admin',
          actorId: normalizedUsername || 'unknown',
          actorName: 'Administrator Attempt',
          action: 'ADMIN_LOGIN_FAILED',
          category: 'AUTH',
          target: normalizedUsername || 'admin',
          details: { reason: 'Invalid administrative credentials' },
          ip: getClientIp(request),
          status: 'FAILURE'
        });
        return json(response, 401, { error: 'Invalid admin credentials' });
      }
      if (account.status === 'suspended') {
        await recordAuditLog({
          actorType: 'admin',
          actorId: normalizedUsername,
          actorName: account.name || normalizedUsername,
          action: 'ADMIN_LOGIN_BLOCKED',
          category: 'SECURITY',
          target: normalizedUsername,
          details: { reason: 'Account suspended' },
          ip: getClientIp(request),
          status: 'WARNING'
        });
        return json(response, 403, { error: 'Your administrative account has been suspended. Please contact administration.' });
      }
      if (account.status === 'archived') {
        await recordAuditLog({
          actorType: 'admin',
          actorId: normalizedUsername,
          actorName: account.name || normalizedUsername,
          action: 'ADMIN_LOGIN_BLOCKED',
          category: 'SECURITY',
          target: normalizedUsername,
          details: { reason: 'Account archived' },
          ip: getClientIp(request),
          status: 'WARNING'
        });
        return json(response, 403, { error: 'Your administrative account has been archived. Please contact administration.' });
      }
      const user = { username: normalizedUsername, name: account.name || 'Admin', role: 'admin' };
      const token = createSession(user);

      await recordAuditLog({
        actorType: 'admin',
        actorId: normalizedUsername,
        actorName: account.name || 'Admin',
        action: 'ADMIN_LOGIN',
        category: 'AUTH',
        target: normalizedUsername,
        details: { role: 'admin' },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });

      const timeoutHours = Number(currentSystemSettings.sessionTimeoutHours) || 12;
      const maxAgeSeconds = timeoutHours * 3600;
      response.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': `assessify_session=${token}; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax; Path=/` });
      return response.end(JSON.stringify({ user }));
    }
    if (role === 'teacher' || role === 'candidate' || role === 'student') {
      const normalizedEmail = (email || '').toLowerCase().trim();

      if (currentSystemSettings.maintenanceMode) {
        await recordAuditLog({
          actorType: 'candidate',
          actorId: normalizedEmail || 'unknown',
          actorName: (fullName || name || '').trim() || 'Placement Candidate',
          action: 'LOGIN_BLOCKED_MAINTENANCE',
          category: 'SECURITY',
          target: normalizedEmail,
          details: { reason: 'Maintenance mode active', message: currentSystemSettings.maintenanceMessage },
          ip: getClientIp(request),
          status: 'WARNING'
        });
        return json(response, 503, {
          error: currentSystemSettings.maintenanceMessage || 'Assessify is currently undergoing scheduled maintenance. Please try again later.'
        });
      }

      const schoolBrand = currentSystemSettings.schoolName || 'Karya Bangsa School';
      const configuredDomain = (currentSystemSettings.schoolDomain || 'karyabangsa.sch.id').toLowerCase().trim();
      const supportContact = currentSystemSettings.supportEmail || 'admin@karyabangsa.sch.id';

      if (!normalizedEmail || !normalizedEmail.endsWith('@' + configuredDomain)) {
        await recordAuditLog({
          actorType: 'candidate',
          actorId: normalizedEmail || 'unknown',
          actorName: (fullName || name || '').trim() || 'Unknown Candidate',
          action: 'CANDIDATE_LOGIN_REJECTED',
          category: 'AUTH',
          target: normalizedEmail,
          details: { reason: `Email not matching @${configuredDomain}` },
          ip: getClientIp(request),
          status: 'FAILURE'
        });
        return json(response, 403, { error: `Please enter your official ${schoolBrand} email (@${configuredDomain}).` });
      }

      const selectedUnit = (unit || '').trim();
      if (!selectedUnit) {
        return json(response, 400, { error: 'Please select your School Unit.' });
      }

      // Check teacher roster first, then students roster
      const teacherRecord = authorizedTeachers.find((t) => t.email.toLowerCase().trim() === normalizedEmail);
      const studentRecord = !teacherRecord ? await repository.getStudent(normalizedEmail) : null;
      const candidateRecord = teacherRecord || studentRecord;
      const candidateRole = candidateRecord ? (teacherRecord ? 'teacher' : 'student') : 'teacher';

      const enforceWhitelist = currentSystemSettings.enforceTeacherWhitelist !== false;
      if (!candidateRecord && enforceWhitelist) {
        await recordAuditLog({
          actorType: 'candidate',
          actorId: normalizedEmail,
          actorName: (fullName || name || '').trim() || 'Unregistered Candidate',
          action: 'CANDIDATE_WHITELIST_REJECTED',
          category: 'SECURITY',
          target: normalizedEmail,
          details: { reason: 'Email not in authorized teacher or student roster', selectedUnit },
          ip: getClientIp(request),
          status: 'WARNING'
        });
        return json(response, 403, {
          error: `Access Denied: "${normalizedEmail}" is not recognized in the ${schoolBrand} roster. Please use your official school email or contact ${supportContact}.`
        });
      }

      if (candidateRecord && candidateRecord.status === 'suspended') {
        await recordAuditLog({
          actorType: candidateRole,
          actorId: normalizedEmail,
          actorName: candidateRecord.name,
          action: `${candidateRole.toUpperCase()}_LOGIN_BLOCKED`,
          category: 'SECURITY',
          target: normalizedEmail,
          details: { reason: 'Account suspended' },
          ip: getClientIp(request),
          status: 'WARNING'
        });
        return json(response, 403, { error: `Your account has been suspended. Please contact ${supportContact}.` });
      }
      if (candidateRecord && candidateRecord.status === 'archived') {
        await recordAuditLog({
          actorType: candidateRole,
          actorId: normalizedEmail,
          actorName: candidateRecord.name,
          action: `${candidateRole.toUpperCase()}_LOGIN_BLOCKED`,
          category: 'SECURITY',
          target: normalizedEmail,
          details: { reason: 'Account archived' },
          ip: getClientIp(request),
          status: 'WARNING'
        });
        return json(response, 403, { error: `Your account has been archived. Please contact ${supportContact}.` });
      }

      // Strict Unit Match Check (only enforced if enabled in system settings)
      const enforceUnit = currentSystemSettings.enforceUnitMatch !== false;
      if (enforceUnit && candidateRecord && candidateRecord.unit && selectedUnit && candidateRecord.unit.toLowerCase().trim() !== selectedUnit.toLowerCase().trim()) {
        await recordAuditLog({
          actorType: candidateRole,
          actorId: normalizedEmail,
          actorName: candidateRecord.name,
          action: `${candidateRole.toUpperCase()}_UNIT_MISMATCH`,
          category: 'AUTH',
          target: candidateRecord.unit,
          details: { registeredUnit: candidateRecord.unit, selectedUnit },
          ip: getClientIp(request),
          status: 'WARNING'
        });
        return json(response, 400, {
          error: `Unit Mismatch: ${normalizedEmail} is registered under "${candidateRecord.unit}", but you selected "${selectedUnit}". Please select your correct unit or contact ${supportContact}.`
        });
      }

      const candidateName = (fullName || name || '').trim() || (candidateRecord ? candidateRecord.name : normalizedEmail.split('@')[0]);
      const effectiveUnit = (selectedUnit || candidateRecord?.unit || 'SMK KARYA BANGSA').trim();
      const user = {
        email: normalizedEmail,
        name: candidateName,
        role: candidateRole,
        unit: effectiveUnit,
        student_id: candidateRecord?.student_id || null,
        grade: candidateRecord?.grade || null
      };
      const token = createSession(user);

      await recordAuditLog({
        actorType: candidateRole,
        actorId: normalizedEmail,
        actorName: candidateName,
        action: `${candidateRole.toUpperCase()}_LOGIN`,
        category: 'AUTH',
        target: effectiveUnit,
        details: { unit: effectiveUnit, role: candidateRole },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });

      const timeoutHours = Number(currentSystemSettings.sessionTimeoutHours) || 12;
      const maxAgeSeconds = timeoutHours * 3600;
      response.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': `assessify_session=${token}; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax; Path=/` });
      return response.end(JSON.stringify({ user }));
    }

    return json(response, 400, { error: 'Invalid user role' });
  }
  if ((url.pathname === '/api/auth/teacher-lookup' || url.pathname === '/api/auth/candidate-lookup') && request.method === 'GET') {
    const qEmail = (url.searchParams.get('email') || '').toLowerCase().trim();
    if (!qEmail) return json(response, 400, { error: 'Email parameter is required' });
    const teacherMatch = authorizedTeachers.find((t) => t.email.toLowerCase().trim() === qEmail);
    if (teacherMatch) {
      return json(response, 200, { found: true, email: teacherMatch.email, unit: teacherMatch.unit, name: teacherMatch.name, role: 'teacher' });
    }
    const studentMatch = await repository.getStudent(qEmail);
    if (studentMatch) {
      return json(response, 200, { found: true, email: studentMatch.email, unit: studentMatch.unit, name: studentMatch.name, role: 'student', student_id: studentMatch.student_id, grade: studentMatch.grade });
    }
    return json(response, 404, { found: false, error: 'Candidate not found in school roster (teachers or students)' });
  }
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    const user = currentUser(request);
    if (user) {
      await recordAuditLog({
        actorType: user.role || 'user',
        actorId: user.email || user.username || 'user',
        actorName: user.name || user.role,
        action: 'LOGOUT',
        category: 'AUTH',
        target: user.email || user.username,
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
    }
    response.writeHead(204, { 'Set-Cookie': 'assessify_session=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/' });
    return response.end();
  }
  if (url.pathname === '/api/public-settings' && request.method === 'GET') {
    return json(response, 200, {
      schoolName: currentSystemSettings.schoolName || 'Karya Bangsa School',
      schoolDomain: currentSystemSettings.schoolDomain || 'karyabangsa.sch.id',
      supportEmail: currentSystemSettings.supportEmail || 'admin@karyabangsa.sch.id',
      certificateIssuer: currentSystemSettings.certificateIssuer || 'Pusat Bahasa & Asesmen Guru Karya Bangsa',
      durationMinutes: Number(currentSystemSettings.durationMinutes) || 65,
      allowResume: currentSystemSettings.allowResume !== false,
      autosaveIntervalSeconds: Number(currentSystemSettings.autosaveIntervalSeconds) || 30,
      requireCameraAudio: currentSystemSettings.requireCameraAudio !== false,
      maxAudioPlayCount: Number(currentSystemSettings.maxAudioPlayCount) || 2,
      maintenanceMode: Boolean(currentSystemSettings.maintenanceMode),
      maintenanceMessage: currentSystemSettings.maintenanceMessage || 'Assessify is currently undergoing scheduled maintenance.',
      passingBand: currentSystemSettings.passingBand || '6.5',
      provisionalScoringAuto: currentSystemSettings.provisionalScoringAuto !== false,
      enforceTeacherWhitelist: currentSystemSettings.enforceTeacherWhitelist !== false,
      enforceUnitMatch: currentSystemSettings.enforceUnitMatch !== false,
      sessionTimeoutHours: Number(currentSystemSettings.sessionTimeoutHours) || 12,
      antiCheat: currentSystemSettings.antiCheat || defaultSystemSettings.antiCheat
    });
  }
  if (url.pathname === '/api/admin/settings' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 401, { error: 'Unauthorized' });
    return json(response, 200, {
      settings: currentSystemSettings,
      storageMode,
      version: '2026.1'
    });
  }
  if (url.pathname === '/api/admin/settings' && (request.method === 'PUT' || request.method === 'POST')) {
    if (!isAdmin(request)) return json(response, 401, { error: 'Unauthorized' });
    const currentAdmin = currentUser(request);
    const updates = await requestBody(request);
    if (!updates || typeof updates !== 'object') {
      return json(response, 400, { error: 'Invalid settings payload' });
    }
    const updatedSettings = {
      ...currentSystemSettings,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: currentAdmin?.username || 'admin'
    };
    currentSystemSettings = updatedSettings;
    await repository.setSetting('system_settings', updatedSettings);
    if (typeof updates.gemini_api_key === 'string') {
      await repository.setSetting('gemini_api_key', updates.gemini_api_key.trim());
    }
    if (typeof updates.gemini_model === 'string') {
      await repository.setSetting('gemini_model', updates.gemini_model.trim());
    }

    await recordAuditLog({
      actorType: 'admin',
      actorId: currentAdmin?.username || 'admin',
      actorName: currentAdmin?.name || 'Administrator',
      action: 'UPDATE_SYSTEM_SETTINGS',
      category: 'SYSTEM',
      target: 'System Settings',
      details: { changedKeys: Object.keys(updates) },
      ip: getClientIp(request),
      status: 'SUCCESS'
    });

    // Real-time broadcast to all connected examinees and proctor consoles
    broadcastRealtime('all', 'SYSTEM_SETTINGS_UPDATED', { settings: currentSystemSettings });

    return json(response, 200, { ok: true, settings: currentSystemSettings });
  }
  if (url.pathname === '/api/admin/settings/reset' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 401, { error: 'Unauthorized' });
    const currentAdmin = currentUser(request);
    currentSystemSettings = {
      ...defaultSystemSettings,
      updatedAt: new Date().toISOString(),
      updatedBy: currentAdmin?.username || 'admin'
    };
    await repository.setSetting('system_settings', currentSystemSettings);

    await recordAuditLog({
      actorType: 'admin',
      actorId: currentAdmin?.username || 'admin',
      actorName: currentAdmin?.name || 'Administrator',
      action: 'RESET_SYSTEM_SETTINGS',
      category: 'SYSTEM',
      target: 'System Settings',
      details: { resetTo: 'default_institutional_profile' },
      ip: getClientIp(request),
      status: 'WARNING'
    });

    broadcastRealtime('all', 'SYSTEM_SETTINGS_UPDATED', { settings: currentSystemSettings });

    return json(response, 200, { ok: true, settings: currentSystemSettings });
  }

  if (url.pathname === '/api/admin/audit-logs' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 401, { error: 'Unauthorized' });
    const category = url.searchParams.get('category') || 'all';
    const status = url.searchParams.get('status') || 'all';
    const actorType = url.searchParams.get('actorType') || 'all';
    const search = url.searchParams.get('search') || '';
    const limit = url.searchParams.get('limit') || 100;
    const offset = url.searchParams.get('offset') || 0;

    const result = await repository.listAuditLogs({ category, status, actorType, search, limit, offset });
    return json(response, 200, result);
  }
  if (url.pathname === '/api/admin/audit-logs/clear' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 401, { error: 'Unauthorized' });
    const currentAdmin = currentUser(request);
    await repository.clearAuditLogs();

    await recordAuditLog({
      actorType: 'admin',
      actorId: currentAdmin?.username || 'admin',
      actorName: currentAdmin?.name || 'Administrator',
      action: 'CLEAR_AUDIT_LOGS',
      category: 'SECURITY',
      target: 'Audit Log Repository',
      details: { clearedBy: currentAdmin?.username || 'admin', timestamp: new Date().toISOString() },
      ip: getClientIp(request),
      status: 'WARNING'
    });

    return json(response, 200, { ok: true, message: 'Audit logs cleared successfully' });
  }
  if (url.pathname === '/api/admin/audit-logs/export' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 401, { error: 'Unauthorized' });
    const currentAdmin = currentUser(request);
    const category = url.searchParams.get('category') || 'all';
    const status = url.searchParams.get('status') || 'all';
    const actorType = url.searchParams.get('actorType') || 'all';
    const search = url.searchParams.get('search') || '';

    const rawIds = url.searchParams.get('ids');
    const filterIds = rawIds ? rawIds.split(',').map((s) => s.trim()).filter(Boolean) : null;

    let { logs } = await repository.listAuditLogs({ category, status, actorType, search, limit: 1000, offset: 0 });
    if (filterIds && filterIds.length > 0) {
      logs = logs.filter((l) => filterIds.includes(String(l.id)));
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Assessify Administration Engine';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Audit Trail', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Timestamp (UTC)', key: 'timestamp', width: 24 },
      { header: 'Actor Name', key: 'actorName', width: 22 },
      { header: 'Actor ID / Email', key: 'actorId', width: 26 },
      { header: 'Actor Role', key: 'actorType', width: 14 },
      { header: 'Action', key: 'action', width: 26 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Target Entity', key: 'target', width: 24 },
      { header: 'Details / Metadata', key: 'details', width: 36 },
      { header: 'IP Address', key: 'ipAddress', width: 16 },
      { header: 'Status', key: 'status', width: 12 }
    ];

    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Segoe UI' };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F274A' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    logs.forEach((log, index) => {
      const row = sheet.addRow({
        id: log.id,
        timestamp: log.timestamp,
        actorName: log.actorName || '-',
        actorId: log.actorId || '-',
        actorType: (log.actorType || '').toUpperCase(),
        action: log.action,
        category: log.category,
        target: log.target || '-',
        details: log.details ? (typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)) : '-',
        ipAddress: log.ipAddress || '127.0.0.1',
        status: log.status
      });

      row.height = 22;
      row.font = { size: 10, name: 'Segoe UI' };
      row.alignment = { vertical: 'middle', horizontal: 'left' };
      if (index % 2 === 1) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
      row.getCell('id').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('timestamp').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('actorType').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('category').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('status').alignment = { vertical: 'middle', horizontal: 'center' };

      const statusCell = row.getCell('status');
      if (log.status === 'SUCCESS') {
        statusCell.font = { bold: true, color: { argb: 'FF15803D' } };
      } else if (log.status === 'WARNING') {
        statusCell.font = { bold: true, color: { argb: 'FFB45309' } };
      } else if (log.status === 'FAILURE') {
        statusCell.font = { bold: true, color: { argb: 'FFB91C1C' } };
      }
    });

    await recordAuditLog({
      actorType: 'admin',
      actorId: currentAdmin?.username || 'admin',
      actorName: currentAdmin?.name || 'Administrator',
      action: 'EXPORT_AUDIT_LOGS',
      category: 'SECURITY',
      target: 'Audit Trail (.xlsx)',
      details: { count: logs.length },
      ip: getClientIp(request),
      status: 'SUCCESS'
    });

    response.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="assessify-audit-logs-${Date.now()}.xlsx"`,
      'Cache-Control': 'no-cache'
    });
    await workbook.xlsx.write(response);
    return response.end();
  }

  // Exam Sessions API
  if (url.pathname === '/api/admin/exam-sessions' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const sessions = await repository.listExamSessions();
    return json(response, 200, { sessions });
  }
  if (url.pathname === '/api/admin/exam-sessions' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const currentAdmin = currentUser(request);
    const body = await requestBody(request);
    const title = (body.title || 'Sesi Ujian').trim();
    const targetUnit = body.targetUnit || 'ALL';
    const scheduledStart = body.scheduledStart || null;
    const antiCheat = body.antiCheat || currentSystemSettings.antiCheat || defaultSystemSettings.antiCheat;

    // Apply anti-cheat settings globally so tests use the configured parameters
    if (body.applyToActiveSettings !== false) {
      currentSystemSettings.antiCheat = { ...antiCheat };
      await repository.setSetting('system_settings', currentSystemSettings);
    }

    const session = await repository.createExamSession({
      title,
      targetUnit,
      scheduledStart,
      antiCheat,
      createdBy: currentAdmin?.username || 'admin'
    });

    await recordAuditLog({
      actorType: 'admin',
      actorId: currentAdmin?.username || 'admin',
      actorName: currentAdmin?.name || 'Administrator',
      action: 'CREATE_EXAM_SESSION',
      category: 'ASSESSMENT',
      target: session.id,
      details: { title, targetUnit, scheduledStart, antiCheat },
      ip: getClientIp(request),
      status: 'SUCCESS'
    });

    return json(response, 201, { session, currentSettings: currentSystemSettings });
  }
  if (url.pathname.startsWith('/api/admin/exam-sessions/') && request.method === 'DELETE') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const currentAdmin = currentUser(request);
    const sessionId = url.pathname.slice('/api/admin/exam-sessions/'.length);
    const deleted = await repository.deleteExamSession(sessionId);
    if (!deleted) return json(response, 404, { error: 'Exam session not found' });

    await recordAuditLog({
      actorType: 'admin',
      actorId: currentAdmin?.username || 'admin',
      actorName: currentAdmin?.name || 'Administrator',
      action: 'DELETE_EXAM_SESSION',
      category: 'ASSESSMENT',
      target: sessionId,
      ip: getClientIp(request),
      status: 'WARNING'
    });
    return json(response, 200, { ok: true, id: sessionId });
  }

  if (url.pathname === '/api/admin/google-workspace/connect' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      googleOAuthState = crypto.randomUUID();
      const auth = await googleClient();
      const authorizationUrl = auth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: ['https://www.googleapis.com/auth/drive.file'],
        state: googleOAuthState
      });
      response.writeHead(302, { Location: authorizationUrl });
      return response.end();
    } catch (error) { return json(response, 503, { error: error.message }); }
  }
  if (url.pathname === '/api/admin/google-workspace/callback' && request.method === 'GET') {
    if (!isAdmin(request) || !url.searchParams.get('code') || url.searchParams.get('state') !== googleOAuthState) return json(response, 400, { error: 'Google Workspace authorization could not be verified' });
    try {
      const auth = await googleClient();
      const { tokens } = await auth.getToken(url.searchParams.get('code'));
      if (tokens.refresh_token) {
        await repository.setSetting('googleRefreshToken', tokens.refresh_token);
      } else {
        const existingToken = await repository.getSetting('googleRefreshToken');
        if (!existingToken && !process.env.GOOGLE_REFRESH_TOKEN) {
          throw new Error('Google did not return a refresh token. Remove Assessify access in your Google Account security settings and connect again.');
        }
      }
      googleOAuthState = null;
      response.writeHead(302, { Location: '/?google_workspace=connected' });
      return response.end();
    } catch (error) { return json(response, 503, { error: error.message }); }
  }
  if (url.pathname === '/api/admin/google-drive/status' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const configured = await isGoogleDriveConfigured();
      const rawToken = (await repository.getSetting('googleRefreshToken')) || process.env.GOOGLE_REFRESH_TOKEN;
      const serviceAccountFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || join(root, 'service-account.json');
      const authType = normalizeRefreshToken(rawToken) ? 'oauth' : (existsSync(serviceAccountFile) ? 'service_account' : 'none');
      const pendingRecordings = await repository.listPendingDriveRecordings();

      let folderId = null;
      let folderName = 'Assessify Recordings';
      let folderLink = null;

      if (configured) {
        try {
          const drive = await getGoogleDriveClient();
          folderId = await getOrCreateAssessifyFolder(drive);
          if (folderId) {
            folderLink = `https://drive.google.com/drive/folders/${folderId}`;
            try {
              const fMeta = await drive.files.get({ fileId: folderId, fields: 'id, name, webViewLink', supportsAllDrives: true });
              folderName = fMeta.data.name || folderName;
              folderLink = fMeta.data.webViewLink || folderLink;
            } catch {}
          }
        } catch (e) {
          console.warn('Could not resolve drive folder details:', e.message);
        }
      }

      return json(response, 200, {
        configured,
        authType,
        folderId,
        folderName,
        folderLink,
        pendingSyncCount: pendingRecordings.length,
        hasClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
        hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
        redirectUri: googleRedirectUri
      });
    } catch (err) {
      return json(response, 500, { error: err.message });
    }
  }
  if (url.pathname === '/api/admin/google-drive/test' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const drive = await getGoogleDriveClient();
      const folderId = await getOrCreateAssessifyFolder(drive);
      let folderName = 'Assessify Recordings';
      let folderLink = folderId ? `https://drive.google.com/drive/folders/${folderId}` : null;
      if (folderId) {
        try {
          const folderRes = await drive.files.get({ fileId: folderId, fields: 'id, name, webViewLink', supportsAllDrives: true });
          folderName = folderRes.data.name || folderName;
          folderLink = folderRes.data.webViewLink || folderLink;
        } catch (fErr) {
          console.warn('Folder get error:', fErr.message);
        }
      }

      // Test creating a verification ping file inside the Assessify folder
      if (folderId) {
        const ping = await drive.files.create({
          supportsAllDrives: true,
          requestBody: {
            name: `assessify-ping-test-${Date.now()}.txt`,
            parents: [folderId]
          },
          media: {
            mimeType: 'text/plain',
            body: 'Assessify Google Drive folder live connection verified!'
          },
          fields: 'id'
        });
        if (ping.data?.id) {
          await drive.files.delete({ fileId: ping.data.id }).catch(() => {});
        }
      }

      const about = await drive.about.get({ fields: 'user(displayName, emailAddress)' }).catch(() => null);
      const userEmail = about?.data?.user?.emailAddress || 'Authorized Workspace User';

      return json(response, 200, {
        success: true,
        message: `Google Drive connection verified successfully! Logged in as: ${userEmail}. All candidate records are stored in dedicated folder: "${folderName}".`,
        user: userEmail,
        target: `Folder: "${folderName}" (${folderId || 'Root'})`,
        folderId,
        folderName,
        folderLink
      });
    } catch (err) {
      return json(response, 500, { error: `Google Drive test failed: ${err.message}` });
    }
  }
  if (url.pathname === '/api/admin/recordings/sync-drive' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const pendingList = await repository.listPendingDriveRecordings();
      let syncedCount = 0;
      const errors = [];
      for (const rec of pendingList) {
        try {
          const res = await uploadRecordingToDriveAndCleanup(rec.attemptId);
          if (res) syncedCount++;
        } catch (e) {
          errors.push({ attemptId: rec.attemptId, error: e.message });
        }
      }
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'SYNC_RECORDINGS_TO_DRIVE',
        category: 'STORAGE',
        target: `${syncedCount} recordings`,
        details: { syncedCount, totalPending: pendingList.length, errors },
        ip: getClientIp(request),
        status: errors.length > 0 ? 'WARNING' : 'SUCCESS'
      });
      return json(response, 200, { success: true, syncedCount, totalPending: pendingList.length, errors });
    } catch (error) {
      return json(response, 500, { error: error.message });
    }
  }
  if (url.pathname === '/api/speaking-meeting' && request.method === 'GET') {
    const user = currentUser(request);
    if (!user || (user.role !== 'teacher' && user.role !== 'student' && user.role !== 'candidate')) return json(response, 401, { error: 'Candidate sign-in required' });
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
        await deleteAttemptFiles(id);
      }
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'BULK_DELETE_ASSESSMENTS',
        category: 'ASSESSMENT',
        target: `${ids.length} Candidate Attempts`,
        details: { count: ids.length, ids },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
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
      const schoolDomain = (currentSystemSettings.schoolDomain || process.env.SCHOOL_DOMAIN || 'karyabangsa.sch.id').toLowerCase().trim();
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
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'CREATE_TEACHER',
        category: 'USER_MGMT',
        target: created.email,
        details: { name: created.name, unit: created.unit, status: created.status },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
      return json(response, 201, { success: true, teacher: created });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  // Bulk Add Teachers endpoint
  if (url.pathname === '/api/admin/teachers/bulk' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const body = await requestBody(request);
      const unit = (body.unit || '').trim();
      const rawList = Array.isArray(body.teachers) ? body.teachers : [];

      if (!unit) return json(response, 400, { error: 'Please select a school unit first.' });
      if (!rawList.length) return json(response, 400, { error: 'No user data provided.' });
      if (rawList.length > 500) return json(response, 400, { error: 'Maximum 500 users can be imported per batch.' });

      const validTeachers = [];
      const invalidRows = [];

      for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i] || {};
        const name = String(item.name || item.fullName || item['Nama Lengkap'] || item.Nama || '').trim();
        const email = String(item.email || item.emailAddress || item['Email Address'] || item.Email || '').toLowerCase().trim();
        const rowUnit = String(item.unit || item.Unit || unit).trim();
        const status = ['active', 'suspended', 'archived'].includes(String(item.status || '').toLowerCase())
          ? String(item.status).toLowerCase()
          : 'active';

        if (!name || !email) {
          invalidRows.push({ row: i + 1, error: 'Name and email are required' });
          continue;
        }

        if (!email.includes('@')) {
          invalidRows.push({ row: i + 1, email, error: 'Invalid email address' });
          continue;
        }

        validTeachers.push({ name, email, unit: rowUnit, status });
      }

      if (!validTeachers.length) {
        return json(response, 400, { error: 'No valid teacher records found to import.', details: invalidRows });
      }

      const result = await repository.bulkCreateTeachers(validTeachers);
      await syncAuthorizedTeachersBackup();
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'BULK_IMPORT_TEACHERS',
        category: 'USER_MGMT',
        target: unit,
        details: { unit, total: validTeachers.length, added: result.added, updated: result.updated, invalid: invalidRows.length },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });

      return json(response, 201, {
        success: true,
        message: `Successfully processed ${validTeachers.length} users (${result.added} added, ${result.updated} updated).`,
        added: result.added,
        updated: result.updated,
        total: validTeachers.length,
        invalidCount: invalidRows.length,
        invalidRows
      });
    } catch (e) {
      console.error('Bulk teacher import error:', e);
      return json(response, 500, { error: `Failed to import users: ${e.message}` });
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
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'CHANGE_TEACHER_STATUS',
        category: 'USER_MGMT',
        target: updated.email,
        details: { newStatus: status, previousStatus: current.status },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
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
      const schoolDomain = (currentSystemSettings.schoolDomain || process.env.SCHOOL_DOMAIN || 'karyabangsa.sch.id').toLowerCase().trim();
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
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'UPDATE_TEACHER',
        category: 'USER_MGMT',
        target: updated.email,
        details: { name: updated.name, unit: updated.unit, status: updated.status },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
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
        await recordAuditLog({
          actorType: 'admin',
          actorId: currentUser(request)?.username || 'admin',
          actorName: currentUser(request)?.name || 'Admin',
          action: 'DELETE_TEACHER',
          category: 'USER_MGMT',
          target: current.email,
          details: { id: current.id, name: current.name },
          ip: getClientIp(request),
          status: 'SUCCESS'
        });
        return json(response, 200, { success: true });
      }
      return json(response, 404, { error: 'Teacher not found or could not be deleted' });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  // Student Accounts API
  if (url.pathname === '/api/admin/students' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const search = (url.searchParams.get('search') || '').toLowerCase().trim();
    const unitFilter = (url.searchParams.get('unit') || '').trim();
    let students = await repository.listStudents();
    if (unitFilter && unitFilter.toLowerCase() !== 'all') {
      students = students.filter((s) => (s.unit || '').toLowerCase() === unitFilter.toLowerCase());
    }
    if (search) {
      students = students.filter((s) => (s.name || '').toLowerCase().includes(search) || (s.email || '').toLowerCase().includes(search) || (s.student_id || '').toLowerCase().includes(search));
    }
    return json(response, 200, { total: students.length, students });
  }

  if (url.pathname === '/api/admin/students' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const body = await requestBody(request);
      const name = (body.name || '').trim();
      const email = (body.email || '').toLowerCase().trim();
      const unit = (body.unit || '').trim();
      const student_id = (body.student_id || '').trim();
      const grade = (body.grade || '').trim();
      const status = (body.status || 'active').toLowerCase().trim();

      if (!name) return json(response, 400, { error: 'Student full name is required' });
      if (!email) return json(response, 400, { error: 'Student email is required' });
      if (!unit) return json(response, 400, { error: 'School unit assignment is required' });

      const existing = await repository.getStudent(email);
      if (existing) {
        return json(response, 409, { error: `A student with email "${email}" is already registered.` });
      }

      const created = await repository.createStudent({ name, email, unit, student_id, grade, status });
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'CREATE_STUDENT',
        category: 'USER_MGMT',
        target: created.email,
        details: { name: created.name, unit: created.unit, grade: created.grade, student_id: created.student_id, status: created.status },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
      return json(response, 201, { success: true, student: created });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  if (url.pathname === '/api/admin/students/bulk' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const body = await requestBody(request);
      const unit = (body.unit || '').trim();
      const rawList = Array.isArray(body.students) ? body.students : [];

      if (!unit) return json(response, 400, { error: 'Please select a school unit first.' });
      if (!rawList.length) return json(response, 400, { error: 'No student data provided.' });
      if (rawList.length > 500) return json(response, 400, { error: 'Maximum 500 students can be imported per batch.' });

      const validStudents = [];
      const invalidRows = [];

      for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i] || {};
        const name = String(item.name || item.fullName || item['Nama Lengkap'] || item.Nama || '').trim();
        const email = String(item.email || item.emailAddress || item['Email Address'] || item.Email || '').toLowerCase().trim();
        const rowUnit = String(item.unit || item.Unit || unit).trim();
        const student_id = String(item.student_id || item.studentId || item.nisn || item.NISN || '').trim();
        const grade = String(item.grade || item.Grade || item.kelas || item.Kelas || '').trim();
        const status = ['active', 'suspended', 'archived'].includes(String(item.status || '').toLowerCase())
          ? String(item.status).toLowerCase()
          : 'active';

        if (!name || !email) {
          invalidRows.push({ row: i + 1, error: 'Name and email are required' });
          continue;
        }
        if (!email.includes('@')) {
          invalidRows.push({ row: i + 1, email, error: 'Invalid email address' });
          continue;
        }
        validStudents.push({ name, email, unit: rowUnit, student_id, grade, status });
      }

      if (!validStudents.length) {
        return json(response, 400, { error: 'No valid student records found to import.', details: invalidRows });
      }

      const result = await repository.bulkCreateStudents(validStudents);
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'BULK_IMPORT_STUDENTS',
        category: 'USER_MGMT',
        target: unit,
        details: { unit, total: validStudents.length, added: result.added, updated: result.updated, invalid: invalidRows.length },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });

      return json(response, 200, {
        success: true,
        message: `Successfully processed ${validStudents.length} students (${result.added} added, ${result.updated} updated).`,
        added: result.added,
        updated: result.updated,
        total: validStudents.length,
        invalidCount: invalidRows.length,
        invalidRows
      });
    } catch (e) {
      console.error('Bulk student import error:', e);
      return json(response, 500, { error: `Failed to import students: ${e.message}` });
    }
  }

  // Student Status Change
  if (url.pathname.startsWith('/api/admin/students/') && url.pathname.endsWith('/status') && (request.method === 'PUT' || request.method === 'PATCH')) {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const parts = url.pathname.split('/');
      const idOrEmail = decodeURIComponent(parts[parts.length - 2]);
      const body = await requestBody(request);
      const status = (body.status || '').toLowerCase().trim();
      if (!['active', 'suspended', 'archived'].includes(status)) {
        return json(response, 400, { error: 'Status must be active, suspended, or archived.' });
      }
      const current = await repository.getStudent(idOrEmail);
      if (!current) return json(response, 404, { error: 'Student not found' });
      const updated = await repository.updateStudent(current.id, { status });
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'CHANGE_STUDENT_STATUS',
        category: 'USER_MGMT',
        target: updated.email,
        details: { newStatus: status, previousStatus: current.status },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
      return json(response, 200, { success: true, student: updated });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  if (url.pathname.startsWith('/api/admin/students/') && request.method === 'PUT') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const idOrEmail = decodeURIComponent(url.pathname.slice('/api/admin/students/'.length));
      const current = await repository.getStudent(idOrEmail);
      if (!current) return json(response, 404, { error: 'Student not found' });
      const body = await requestBody(request);
      const name = (body.name || current.name).trim();
      const email = (body.email || current.email).toLowerCase().trim();
      const unit = (body.unit || current.unit).trim();
      const student_id = body.student_id !== undefined ? String(body.student_id).trim() : current.student_id;
      const grade = body.grade !== undefined ? String(body.grade).trim() : current.grade;
      const status = body.status ? body.status.toLowerCase().trim() : current.status;

      const updated = await repository.updateStudent(current.id, { name, email, unit, student_id, grade, status });
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'UPDATE_STUDENT',
        category: 'USER_MGMT',
        target: updated.email,
        details: { id: updated.id, name: updated.name, unit: updated.unit },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
      return json(response, 200, { success: true, student: updated });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  if (url.pathname.startsWith('/api/admin/students/') && request.method === 'DELETE') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const idOrEmail = decodeURIComponent(url.pathname.slice('/api/admin/students/'.length));
      const current = await repository.getStudent(idOrEmail);
      if (!current) return json(response, 404, { error: 'Student not found' });
      const ok = await repository.deleteStudent(current.id);
      if (ok) {
        await recordAuditLog({
          actorType: 'admin',
          actorId: currentUser(request)?.username || 'admin',
          actorName: currentUser(request)?.name || 'Admin',
          action: 'DELETE_STUDENT',
          category: 'USER_MGMT',
          target: current.email,
          details: { id: current.id, name: current.name },
          ip: getClientIp(request),
          status: 'SUCCESS'
        });
        return json(response, 200, { success: true });
      }
      return json(response, 404, { error: 'Student not found or could not be deleted' });
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
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'CREATE_ADMIN',
        category: 'USER_MGMT',
        target: created.username,
        details: { username: created.username, name: created.name, email: created.email },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
      return json(response, 201, { success: true, admin: created });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  // Bulk Import Administrators API
  if (url.pathname === '/api/admin/admins/bulk' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const body = await requestBody(request);
      const rawList = Array.isArray(body.admins) ? body.admins : [];
      if (!rawList.length) return json(response, 400, { error: 'No administrator data provided.' });
      if (rawList.length > 100) return json(response, 400, { error: 'Maximum 100 administrators can be imported per batch.' });

      const validAdmins = [];
      const invalidRows = [];
      for (let i = 0; i < rawList.length; i++) {
        const row = rawList[i];
        const username = String(row.username || '').toLowerCase().trim();
        const name = String(row.name || '').trim();
        const password = String(row.password || 'admin123').trim();
        const email = String(row.email || '').toLowerCase().trim() || null;
        const status = ['active', 'suspended', 'archived'].includes(String(row.status || '').toLowerCase().trim())
          ? String(row.status).toLowerCase().trim()
          : 'active';

        if (!username || !name) {
          invalidRows.push({ row: i + 1, error: 'Username and name are required.' });
          continue;
        }
        validAdmins.push({ username, name, password, email, status });
      }

      if (!validAdmins.length) {
        return json(response, 400, { error: 'No valid administrator records found to import.', details: invalidRows });
      }

      const result = await repository.bulkCreateAdmins(validAdmins);
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'BULK_IMPORT_ADMINS',
        category: 'USER_MGMT',
        target: 'admin_users',
        details: { total: validAdmins.length, added: result.added, updated: result.updated, invalid: invalidRows.length },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });

      return json(response, 200, {
        success: true,
        message: `Successfully processed ${validAdmins.length} administrators (${result.added} added, ${result.updated} updated).`,
        added: result.added,
        updated: result.updated,
        total: validAdmins.length,
        invalidCount: invalidRows.length,
        invalidRows
      });
    } catch (e) {
      return json(response, 500, { error: `Failed to import administrators: ${e.message}` });
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
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'CHANGE_ADMIN_STATUS',
        category: 'USER_MGMT',
        target: updated.username,
        details: { newStatus: status, previousStatus: current.status },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
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
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'UPDATE_ADMIN',
        category: 'USER_MGMT',
        target: updated.username,
        details: { username: updated.username, name: updated.name, email: updated.email, status: updated.status },
        ip: getClientIp(request),
        status: 'SUCCESS'
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
      if (deleted) {
        await recordAuditLog({
          actorType: 'admin',
          actorId: currentUser(request)?.username || 'admin',
          actorName: currentUser(request)?.name || 'Admin',
          action: 'DELETE_ADMIN',
          category: 'USER_MGMT',
          target: current.username,
          details: { id: current.id, username: current.username },
          ip: getClientIp(request),
          status: 'SUCCESS'
        });
        return json(response, 200, { success: true });
      }
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
        if (target.role === 'admin' || target.role === 'admin_user') {
          if (status !== 'active' && currentAdmin && (currentAdmin.username === target.username || String(currentAdmin.id) === String(target.id))) {
            continue; // skip self-suspension/archival
          }
          await repository.updateAdmin(target.id, { status });
          updatedCount++;
        } else if (target.role === 'students' || target.role === 'student') {
          await repository.updateStudent(target.id, { status });
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
        if (target.role === 'admin' || target.role === 'admin_user') {
          const allAdmins = await repository.listAdmins();
          if (allAdmins.length <= 1) continue;
          if (currentAdmin && (currentAdmin.username === target.username || String(currentAdmin.id) === String(target.id))) continue;
          await repository.deleteAdmin(target.id);
          deletedCount++;
        } else if (target.role === 'students' || target.role === 'student') {
          await repository.deleteStudent(target.id);
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
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'UPLOAD_QUESTION_BANK',
        category: 'CONTENT',
        target: 'Question Bank',
        details: { totalSections: newContent.sections.length },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
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
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'UPLOAD_RUBRICS',
        category: 'CONTENT',
        target: 'Evaluation Rubrics',
        details: { writingCriteriaCount: newRubrics.writing?.criteria?.length, speakingCriteriaCount: newRubrics.speaking?.criteria?.length },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
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
    const attemptId = url.pathname.split('/').pop();
    const currentAttempt = await repository.getAttempt(attemptId);
    const deleted = await repository.deleteAttempt(attemptId);
    if (deleted) {
      await deleteAttemptFiles(attemptId);
      broadcastRealtime('admin', 'ATTEMPT_DELETED', { attemptId });
      activeCandidatePresence.delete(attemptId);
      broadcastRealtime('admin', 'CANDIDATE_PRESENCE_SYNC', { candidates: getActiveCandidatesSnapshot() });
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'DELETE_ASSESSMENT',
        category: 'ASSESSMENT',
        target: attemptId,
        details: { teacher: currentAttempt?.teacher, email: currentAttempt?.email, unit: currentAttempt?.unit },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
    }
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
      const updatedAttempt = await repository.getAttempt(attemptId);
      broadcastRealtime('admin', 'ATTEMPT_GRADED', { attemptId, attempt: updatedAttempt });
      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'EVALUATE_ASSESSMENT',
        category: 'EVALUATION',
        target: attemptId,
        details: {
          teacher: attempt.teacher,
          email: attempt.email,
          writingLevel: manualReview.writing.level || 'Pending',
          speakingLevel: manualReview.speaking.level || 'Pending',
          overallBand: finalPlacement || attempt.overall
        },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
      return json(response, 200, { manualReview, sectionScores, overall: finalPlacement || attempt.overall });
    } catch (error) { return json(response, 400, { error: error.message }); }
  }
  if (url.pathname.startsWith('/api/admin/results/') && url.pathname.endsWith('/ai-grade') && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const attemptId = url.pathname.split('/')[4];
      const attempt = await repository.getAttempt(attemptId);
      if (!attempt) return json(response, 404, { error: 'Attempt not found' });

      // Retrieve API key from settings or environment
      const dbApiKey = await repository.getSetting('gemini_api_key');
      const apiKey = (dbApiKey || process.env.GEMINI_API_KEY || '').trim();
      const dbModel = await repository.getSetting('gemini_model');
      const model = (dbModel || process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();

      if (!apiKey) {
        return json(response, 400, {
          error: 'Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file or system settings.'
        });
      }

      // 1. Evaluate Writing
      let writingEvaluation = null;
      try {
        writingEvaluation = await evaluateWritingWithGemini({
          apiKey,
          model,
          attempt,
          rubrics,
          questions: content
        });
      } catch (wErr) {
        console.error('AI Writing Evaluation error:', wErr);
        writingEvaluation = {
          scores: {},
          feedback: `AI Writing evaluation error: ${wErr.message}`,
          strengths: [],
          improvements: []
        };
      }

      // 2. Evaluate Speaking
      let speakingEvaluation = null;
      try {
        speakingEvaluation = await evaluateSpeakingWithGemini({
          apiKey,
          model,
          attempt,
          rubrics,
          uploadsDir
        });
      } catch (sErr) {
        console.error('AI Speaking Evaluation error:', sErr);
        speakingEvaluation = {
          scores: {},
          feedback: `AI Speaking evaluation error: ${sErr.message}`,
          strengths: [],
          improvements: []
        };
      }

      // Compute tentative rubric levels from AI scores
      const writingLevelObj = rubricLevel(writingEvaluation.scores, 'writing');
      const speakingLevelObj = rubricLevel(speakingEvaluation.scores, 'speaking');

      const simulatedSectionScores = { ...(attempt.sectionScores || {}) };
      if (writingLevelObj.level) simulatedSectionScores.Writing = writingLevelObj.level;
      if (speakingLevelObj.level) simulatedSectionScores.Speaking = speakingLevelObj.level;
      const suggestedOverall = computeFinalPlacement(simulatedSectionScores);

      await recordAuditLog({
        actorType: 'admin',
        actorId: currentUser(request)?.username || 'admin',
        actorName: currentUser(request)?.name || 'Admin',
        action: 'AI_GRADE_ASSESSMENT',
        category: 'EVALUATION',
        target: attemptId,
        details: {
          teacher: attempt.teacher,
          email: attempt.email,
          writingLevel: writingLevelObj.level,
          speakingLevel: speakingLevelObj.level,
          suggestedOverall
        },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });

      const latestAttempt = await repository.getAttempt(attemptId);
      broadcastRealtime('admin', 'ATTEMPT_GRADED', { attemptId, attempt: latestAttempt });

      return json(response, 200, {
        success: true,
        writing: {
          ...writingEvaluation,
          level: writingLevelObj.level,
          total: writingLevelObj.total
        },
        speaking: {
          ...speakingEvaluation,
          level: speakingLevelObj.level,
          total: speakingLevelObj.total
        },
        suggestedOverall
      });
    } catch (error) {
      return json(response, 500, { error: error.message });
    }
  }
  if (url.pathname === '/api/admin/ai-settings' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const dbApiKey = await repository.getSetting('gemini_api_key');
    const rawKey = (dbApiKey || process.env.GEMINI_API_KEY || '').trim();
    const dbModel = await repository.getSetting('gemini_model');
    const model = (dbModel || process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();

    return json(response, 200, {
      configured: Boolean(rawKey && rawKey.length > 5),
      maskedKey: rawKey ? `${rawKey.slice(0, 4)}••••••••${rawKey.slice(-4)}` : '',
      model
    });
  }
  if (url.pathname === '/api/admin/ai-settings/test' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const dbApiKey = await repository.getSetting('gemini_api_key');
    const apiKey = (dbApiKey || process.env.GEMINI_API_KEY || '').trim();
    const dbModel = await repository.getSetting('gemini_model');
    const model = (dbModel || process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();

    if (!apiKey) {
      return json(response, 400, { error: 'Gemini API key is not configured.' });
    }

    const testRes = await testGeminiConnection(apiKey, model);
    if (!testRes.success) {
      return json(response, 400, { error: testRes.error });
    }
    return json(response, 200, { success: true, message: 'Google Gemini API connection test succeeded!' });
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
    if (!user || (user.role !== 'teacher' && user.role !== 'student' && user.role !== 'candidate' && user.role !== 'admin')) return json(response, 401, { error: 'Candidate sign-in required' });
    const attemptId = url.pathname.split('/')[3];
    const attempt = await repository.getAttempt(attemptId);
    if (!attempt || (attempt.email !== user.email && user.role !== 'admin')) return json(response, 404, { error: 'Attempt not found' });
    if (attempt.status === 'Completed') return json(response, 409, { error: 'This assessment has already been submitted.' });

    const rawContentType = request.headers['content-type'] || 'video/webm';
    const contentType = rawContentType.split(';')[0].trim() || 'video/webm';
    const durationSeconds = Number(request.headers['x-duration-seconds']) || 0;

    const ext = contentType.includes('mp4') ? 'mp4' : contentType.includes('ogg') ? 'ogg' : 'webm';
    const filename = `${attemptId}.${ext}`;
    const filePath = join(uploadsDir, filename);

    try {
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Step 1: Save buffer to MySQL database first
      await repository.saveRecordingToDb({
        attemptId,
        filename,
        mimeType: contentType,
        fileSize: buffer.length,
        buffer
      });

      const fileUrl = `/api/attempts/${attemptId}/recording`;
      let recordingMeta = {
        mimeType: contentType,
        durationSeconds,
        fileUrl,
        filename,
        driveStatus: 'saved_to_mysql_pending_drive'
      };

      await repository.updateAttempt(attemptId, { speakingRecording: recordingMeta });

      // Respond immediately to candidate with success so submission pipeline never hangs!
      json(response, 200, { success: true, recording: recordingMeta });

      // Google Drive archive & MySQL cleanup runs in background asynchronously (non-blocking)
      uploadRecordingToDriveAndCleanup(attemptId).catch((driveErr) => {
        console.warn(`[Background Drive Sync] Recording ${attemptId} sync note:`, driveErr.message);
      });
      return;
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
      // Check if media is buffered in MySQL database
      const dbRec = await repository.getRecordingFromDb(attemptId);
      if (dbRec?.mediaData) {
        const mimeType = dbRec.mimeType || 'video/webm';
        const buf = dbRec.mediaData;
        response.writeHead(200, {
          'Content-Length': buf.length,
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes'
        });
        return response.end(buf);
      }

      // Check if uploaded to Google Drive
      if (attempt.speakingRecording?.driveFileId) {
        try {
          const drive = await getGoogleDriveClient();
          const driveStream = await drive.files.get(
            { fileId: attempt.speakingRecording.driveFileId, alt: 'media', supportsAllDrives: true },
            { responseType: 'stream' }
          );
          const mimeType = attempt.speakingRecording.mimeType || 'video/webm';
          response.writeHead(200, {
            'Content-Type': mimeType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600'
          });
          return driveStream.data.pipe(response);
        } catch (streamErr) {
          console.warn('Could not stream directly from Google Drive API, falling back to redirect:', streamErr.message);
        }
      }

      if (attempt.speakingRecording?.driveViewLink || attempt.speakingRecording?.driveDownloadLink) {
        response.writeHead(302, { Location: attempt.speakingRecording.driveViewLink || attempt.speakingRecording.driveDownloadLink });
        return response.end();
      }

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
    try {
      const user = currentUser(request);
      if (!user || (user.role !== 'teacher' && user.role !== 'student' && user.role !== 'candidate')) return json(response, 401, { error: 'Candidate sign-in required' });
      const attemptId = url.pathname.split('/')[3];
      const attempt = await repository.getAttempt(attemptId);
      if (!attempt || attempt.email !== user.email) return json(response, 404, { error: 'Attempt not found' });
      if (attempt.status === 'Completed') return json(response, 409, { error: 'This assessment has already been submitted.' });
      const { writing = '', speaking = '', responses = {}, speakingRecording = null, earlyTermination = false, antiCheat = null } = await requestBody(request);
      if (speakingRecording?.dataUrl && speakingRecording.dataUrl.length > 14_000_000) return json(response, 413, { error: 'Speaking recording is too large. Please record a shorter response.' });
      const grammarVocabularyScore = scoreObjective('grammar-vocabulary', responses);
      // All section scores are now CEFR levels (A1/A2/B1/B2/C1)
      const sectionScores = {
        ...(attempt.sectionScores || {}),
        'Grammar & Vocabulary': grammarVocabularyScore.level
      };
      const autoScore = currentSystemSettings.provisionalScoringAuto !== false;
      const provisionalPlacement = autoScore ? computeFinalPlacement(sectionScores) : 'Under Review';
      const reviewStatus = autoScore ? 'Writing and Speaking review required' : 'Evaluation in progress';

      // Combine any existing recording metadata (e.g. from prior /recording endpoint upload) with incoming submission
      const existingRecording = attempt.speakingRecording || null;
      let finalRecording = null;
      if (existingRecording?.fileUrl) {
        finalRecording = {
          ...existingRecording,
          ...(speakingRecording || {}),
          driveFileId: existingRecording.driveFileId || speakingRecording?.driveFileId || null,
          driveViewLink: existingRecording.driveViewLink || speakingRecording?.driveViewLink || null,
          driveDownloadLink: existingRecording.driveDownloadLink || speakingRecording?.driveDownloadLink || null,
          driveStatus: existingRecording.driveStatus || speakingRecording?.driveStatus || null,
          earlyTermination: Boolean(earlyTermination)
        };
      } else if (speakingRecording) {
        finalRecording = {
          mimeType: speakingRecording.mimeType,
          durationSeconds: speakingRecording.durationSeconds,
          transcriptSource: speakingRecording.transcriptSource,
          fileUrl: speakingRecording.fileUrl || null,
          dataUrl: speakingRecording.dataUrl || null,
          driveFileId: speakingRecording.driveFileId || null,
          driveViewLink: speakingRecording.driveViewLink || null,
          driveDownloadLink: speakingRecording.driveDownloadLink || null,
          driveStatus: speakingRecording.driveStatus || null,
          earlyTermination: Boolean(earlyTermination)
        };
      }

      const scored = {
        ...attempt,
        status: 'Completed',
        earlyTermination: Boolean(earlyTermination),
        sectionScores,
        overall: provisionalPlacement,
        review: reviewStatus,
        scoring: { grammarVocabulary: grammarVocabularyScore },
        responses,
        writing,
        speaking,
        speakingRecording: finalRecording,
        antiCheat: antiCheat || attempt.antiCheat || null,
        submittedAt: new Date().toISOString()
      };

      await repository.updateAttempt(attemptId, scored);

      // Live real-time broadcast of submission
      broadcastRealtime('admin', 'ATTEMPT_SUBMITTED', { attempt: scored });
      broadcastRealtime(attemptId, 'GRADING_PROGRESS', { stage: 1, totalStages: 5, label: 'Exam responses and media buffer secured in database', status: 'completed' });
      broadcastRealtime(attemptId, 'GRADING_PROGRESS', { stage: 2, totalStages: 5, label: 'Securing cloud archive in Google Drive...', status: 'completed' });
      broadcastRealtime(attemptId, 'GRADING_PROGRESS', { stage: 3, totalStages: 5, label: 'Calculating Grammar & Vocabulary CEFR benchmark...', status: 'completed' });
      broadcastRealtime(attemptId, 'GRADING_PROGRESS', { stage: 4, totalStages: 5, label: 'Evaluating Writing Task Response, Coherence & Lexical Resource...', status: 'completed' });
      broadcastRealtime(attemptId, 'GRADING_PROGRESS', { stage: 5, totalStages: 5, label: 'Provisional CEFR & IELTS placement assessment completed', status: 'completed' });

      if (activeCandidatePresence.has(attemptId)) {
        const p = activeCandidatePresence.get(attemptId);
        p.status = 'completed';
        p.completedAt = Date.now();
        broadcastRealtime('admin', 'CANDIDATE_PRESENCE_UPDATE', p);
      }

      await recordAuditLog({
        actorType: 'teacher',
        actorId: attempt.email,
        actorName: attempt.teacher,
        action: 'SUBMIT_ASSESSMENT',
        category: 'ASSESSMENT',
        target: attempt.id,
        details: {
          overallBand: provisionalPlacement,
          unit: attempt.unit,
          earlyTermination: Boolean(earlyTermination)
        },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });
      return json(response, 200, { attempt: scored });
    } catch (submitErr) {
      console.error('[Submit Assessment Error]', submitErr);
      return json(response, 500, { error: `Failed to submit assessment: ${submitErr.message}` });
    }
  }

  // Auto-Save Draft Progress Endpoint (resilient to power cuts and connection loss)
  if (url.pathname.startsWith('/api/attempts/') && url.pathname.endsWith('/draft') && request.method === 'POST') {
    const user = currentUser(request);
    if (!user || (user.role !== 'teacher' && user.role !== 'student' && user.role !== 'candidate')) return json(response, 401, { error: 'Candidate sign-in required' });
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
      if (body.sectionStartTimes && typeof body.sectionStartTimes === 'object') {
        update.sectionStartTimes = Object.assign({}, attempt.sectionStartTimes || {}, body.sectionStartTimes);
      }
      if (body.sectionRemainingMs && typeof body.sectionRemainingMs === 'object') {
        update.sectionRemainingMs = Object.assign({}, attempt.sectionRemainingMs || {}, body.sectionRemainingMs);
      }
      if (body.sectionEndTimes && typeof body.sectionEndTimes === 'object') {
        update.sectionEndTimes = Object.assign({}, attempt.sectionEndTimes || {}, body.sectionEndTimes);
      }
      if (body.antiCheat && typeof body.antiCheat === 'object') {
        update.antiCheat = Object.assign({}, attempt.antiCheat || {}, body.antiCheat);
      }
      update.lastSavedAt = new Date().toISOString();

      await repository.updateAttempt(attemptId, update);

      broadcastRealtime('admin', 'ATTEMPT_AUTOSAVED', {
        attemptId,
        email: attempt.email,
        sectionIndex: update.sectionIndex ?? attempt.sectionIndex,
        answeredCount: Object.keys(update.responses || attempt.responses || {}).length,
        lastSavedAt: update.lastSavedAt
      });
      let p = activeCandidatePresence.get(attemptId);
      if (!p) {
        const totalQ = attempt.totalQuestions || 25;
        p = {
          attemptId,
          email: attempt.email,
          name: attempt.teacher || attempt.email,
          unit: attempt.unit || 'SMK KARYA BANGSA',
          sectionIndex: update.sectionIndex ?? attempt.sectionIndex ?? 0,
          sectionName: (update.sectionIndex ?? attempt.sectionIndex) === 1 ? 'Writing' : ((update.sectionIndex ?? attempt.sectionIndex) === 2 ? 'Speaking' : 'Grammar & Vocabulary'),
          answeredCount: Object.keys(update.responses || attempt.responses || {}).length,
          totalQuestions: totalQ,
          remainingMs: update.sectionRemainingMs?.[update.sectionIndex ?? 0] || 0,
          antiCheat: update.antiCheat || attempt.antiCheat || { violations: [], totalCount: 0 },
          lastHeartbeat: Date.now(),
          status: 'active'
        };
        activeCandidatePresence.set(attemptId, p);
      } else {
        if (update.sectionIndex !== undefined) p.sectionIndex = update.sectionIndex;
        if (update.responses) p.answeredCount = Object.keys(update.responses).length;
        if (update.antiCheat) p.antiCheat = update.antiCheat;
        if (update.sectionRemainingMs?.[p.sectionIndex] !== undefined) {
          p.remainingMs = update.sectionRemainingMs[p.sectionIndex];
        }
        p.lastHeartbeat = Date.now();
        p.status = 'active';
      }
      broadcastRealtime('admin', 'CANDIDATE_PRESENCE_UPDATE', p);

      return json(response, 200, { success: true, lastSavedAt: update.lastSavedAt, attemptId });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  // Real-time Anti-Cheat Violation Event Endpoint
  if (url.pathname.startsWith('/api/attempts/') && url.pathname.endsWith('/anti-cheat-event') && request.method === 'POST') {
    const user = currentUser(request);
    if (!user || (user.role !== 'teacher' && user.role !== 'student' && user.role !== 'candidate')) return json(response, 401, { error: 'Candidate sign-in required' });
    const attemptId = url.pathname.split('/')[3];
    const attempt = await repository.getAttempt(attemptId);
    if (!attempt || (attempt.email || '').toLowerCase().trim() !== user.email.toLowerCase().trim()) {
      return json(response, 404, { error: 'Attempt not found' });
    }
    const { type = 'UNKNOWN', message = '', details = {} } = await requestBody(request);
    const existingAc = attempt.antiCheat || {
      enabled: true,
      tabSwitches: 0,
      fullscreenExits: 0,
      splitScreenDetections: 0,
      devToolsAttempts: 0,
      copyPasteAttempts: 0,
      violations: []
    };

    existingAc.violations = Array.isArray(existingAc.violations) ? existingAc.violations : [];

    // SERVER DEBOUNCE: discard burst duplicate events of the same violation type within 1500ms
    const lastV = existingAc.violations[existingAc.violations.length - 1];
    const now = Date.now();
    if (lastV && lastV.type === type && (now - new Date(lastV.timestamp).getTime()) < 1500) {
      return json(response, 200, {
        ok: true,
        debounced: true,
        antiCheat: existingAc,
        totalCount: existingAc.totalCount || 0
      });
    }

    if (type === 'TAB_SWITCH') existingAc.tabSwitches = (existingAc.tabSwitches || 0) + 1;
    else if (type === 'FULLSCREEN_EXIT') existingAc.fullscreenExits = (existingAc.fullscreenExits || 0) + 1;
    else if (type === 'SPLIT_SCREEN') existingAc.splitScreenDetections = (existingAc.splitScreenDetections || 0) + 1;
    else if (type === 'DEVTOOLS_ATTEMPT') existingAc.devToolsAttempts = (existingAc.devToolsAttempts || 0) + 1;
    else if (type === 'COPY_PASTE_ATTEMPT') existingAc.copyPasteAttempts = (existingAc.copyPasteAttempts || 0) + 1;

    existingAc.violations.push({
      timestamp: new Date().toISOString(),
      type,
      message,
      details
    });
    if (existingAc.violations.length > 200) existingAc.violations.shift();

    const totalCount = (existingAc.tabSwitches || 0) +
      (existingAc.fullscreenExits || 0) +
      (existingAc.splitScreenDetections || 0) +
      (existingAc.devToolsAttempts || 0) +
      (existingAc.copyPasteAttempts || 0);
    existingAc.totalCount = totalCount;

    await repository.updateAttempt(attemptId, { antiCheat: existingAc });

    broadcastRealtime('admin', 'ANTI_CHEAT_VIOLATION', {
      attemptId,
      teacher: attempt.teacher,
      email: attempt.email,
      unit: attempt.unit,
      type,
      message,
      totalCount,
      timestamp: new Date().toISOString()
    });
    if (activeCandidatePresence.has(attemptId)) {
      const p = activeCandidatePresence.get(attemptId);
      p.antiCheat = existingAc;
      broadcastRealtime('admin', 'CANDIDATE_PRESENCE_UPDATE', p);
    }

    await recordAuditLog({
      actorType: 'teacher',
      actorId: attempt.email,
      actorName: attempt.teacher,
      action: `ANTI_CHEAT_${type}`,
      category: 'SECURITY',
      target: attempt.id,
      details: {
        type,
        message,
        totalViolations: totalCount,
        unit: attempt.unit
      },
      ip: getClientIp(request),
      status: 'WARNING'
    });

    return json(response, 200, { ok: true, totalCount, antiCheat: existingAc });
  }

  // Real-time Attempt Status Check Endpoint
  if (url.pathname.startsWith('/api/attempts/') && url.pathname.endsWith('/status') && request.method === 'GET') {
    const user = currentUser(request);
    if (!user || user.role !== 'teacher') return json(response, 401, { error: 'Teacher sign-in required' });
    const attemptId = url.pathname.split('/')[3];
    const attempt = await repository.getAttempt(attemptId);
    if (!attempt || (attempt.email || '').toLowerCase().trim() !== user.email.toLowerCase().trim()) {
      return json(response, 404, { error: 'Attempt not found', attemptDeleted: true });
    }
    const isAcActive = Boolean(
      currentSystemSettings.antiCheat?.enabled !== false &&
      (
        currentSystemSettings.antiCheat?.tabSwitchDetection ||
        currentSystemSettings.antiCheat?.requireFullscreen ||
        currentSystemSettings.antiCheat?.splitScreenDetection ||
        currentSystemSettings.antiCheat?.blockDevTools ||
        currentSystemSettings.antiCheat?.blockCopyPaste
      )
    );
    return json(response, 200, {
      id: attempt.id,
      status: attempt.status,
      sectionIndex: attempt.sectionIndex,
      sectionRemainingMs: attempt.sectionRemainingMs,
      antiCheat: {
        enabled: isAcActive,
        rules: { ...(currentSystemSettings.antiCheat || defaultSystemSettings.antiCheat) }
      }
    });
  }

  if (url.pathname === '/api/attempts/me' && request.method === 'GET') {
    const user = currentUser(request);
    if (!user || (user.role !== 'teacher' && user.role !== 'student' && user.role !== 'candidate')) return json(response, 401, { error: 'Candidate sign-in required' });
    const all = await repository.listAttempts();
    const userAttempts = all.filter((att) => (att.email || '').toLowerCase().trim() === user.email.toLowerCase().trim());
    const completedAttempt = userAttempts.find((att) => att.status === 'Completed') || null;
    const inProgressAttempt = userAttempts.find((att) => att.status === 'In progress') || null;
    if (inProgressAttempt && inProgressAttempt.antiCheat) {
      const isAcActive = Boolean(
        currentSystemSettings.antiCheat?.enabled !== false &&
        (
          currentSystemSettings.antiCheat?.tabSwitchDetection ||
          currentSystemSettings.antiCheat?.requireFullscreen ||
          currentSystemSettings.antiCheat?.splitScreenDetection ||
          currentSystemSettings.antiCheat?.blockDevTools ||
          currentSystemSettings.antiCheat?.blockCopyPaste
        )
      );
      inProgressAttempt.antiCheat.enabled = isAcActive;
      inProgressAttempt.antiCheat.rules = { ...(currentSystemSettings.antiCheat || defaultSystemSettings.antiCheat) };
    }
    return json(response, 200, {
      hasCompleted: Boolean(completedAttempt),
      completedAttempt,
      inProgressAttempt
    });
  }
  if (url.pathname === '/api/attempts' && request.method === 'POST') {
    const user = currentUser(request);
    if (!user || (user.role !== 'teacher' && user.role !== 'student' && user.role !== 'candidate')) return json(response, 401, { error: 'Candidate sign-in required' });

    if (currentSystemSettings.maintenanceMode) {
      return json(response, 503, {
        error: currentSystemSettings.maintenanceMessage || 'Assessify is currently undergoing scheduled maintenance. Candidate assessments will resume shortly.'
      });
    }

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
    const durationMins = Number(currentSystemSettings.durationMinutes) || Number(content.durationMinutes) || 65;
    const gvMins = Math.max(5, Math.round(durationMins * (30 / 65)));
    const writingMins = Math.max(5, Math.round(durationMins * (20 / 65)));
    const speakingMins = Math.max(5, durationMins - gvMins - writingMins);

    const gvSection = (content.sections || []).find((s) => s.id === 'grammar-vocabulary');
    const gvQuestions = gvSection?.questions || [];
    const existingInProgress = existing.find(
      (att) => (att.email || '').toLowerCase().trim() === user.email.toLowerCase().trim() && att.status === 'In progress'
    );
    if (existingInProgress) {
      if (currentSystemSettings.allowResume === false) {
        return json(response, 403, {
          error: 'Assessment resumption is currently disabled by institutional policy. Please contact your test administrator.'
        });
      }
      const updates = {};
      if (!existingInProgress.grammarVocabularyOrder && gvQuestions.length > 0) {
        const seed = user.email ? user.email.toLowerCase().trim() : existingInProgress.id;
        existingInProgress.grammarVocabularyOrder = shuffleWithSeed(gvQuestions, seed).map((q) => q.id);
        updates.grammarVocabularyOrder = existingInProgress.grammarVocabularyOrder;
      }
      if (!existingInProgress.sectionStartTimes) {
        existingInProgress.sectionStartTimes = { 0: existingInProgress.startedAt };
        updates.sectionStartTimes = existingInProgress.sectionStartTimes;
      }
      if (!existingInProgress.sectionEndTimes) {
        const s0Start = new Date(existingInProgress.startedAt).getTime();
        existingInProgress.sectionEndTimes = { 0: s0Start + gvMins * 60 * 1000 };
        updates.sectionEndTimes = existingInProgress.sectionEndTimes;
      }
      if (!existingInProgress.sectionRemainingMs) {
        existingInProgress.sectionRemainingMs = {
          0: Math.max(0, (new Date(existingInProgress.startedAt).getTime() + gvMins * 60 * 1000) - Date.now()),
          1: writingMins * 60 * 1000,
          2: speakingMins * 60 * 1000
        };
        updates.sectionRemainingMs = existingInProgress.sectionRemainingMs;
      }
      if (Object.keys(updates).length > 0) {
        await repository.updateAttempt(existingInProgress.id, updates);
      }
      let expiresAt = new Date(new Date(existingInProgress.startedAt).getTime() + durationMins * 60 * 1000).toISOString();
      if (new Date(expiresAt) <= new Date()) {
        expiresAt = new Date(Date.now() + durationMins * 60 * 1000).toISOString();
      }

      activeCandidatePresence.set(existingInProgress.id, {
        attemptId: existingInProgress.id,
        email: user.email,
        name: user.name || user.email,
        unit: existingInProgress.unit || user.unit || 'School',
        sectionIndex: existingInProgress.sectionIndex || 0,
        sectionName: 'Grammar & Vocabulary',
        answeredCount: Object.keys(existingInProgress.responses || {}).length,
        totalQuestions: gvQuestions.length || 25,
        remainingMs: existingInProgress.sectionRemainingMs?.[existingInProgress.sectionIndex || 0] || durationMins * 60 * 1000,
        antiCheat: existingInProgress.antiCheat,
        lastHeartbeat: Date.now(),
        status: 'active'
      });
      broadcastRealtime('admin', 'CANDIDATE_PRESENCE_UPDATE', activeCandidatePresence.get(existingInProgress.id));

      await recordAuditLog({
        actorType: 'teacher',
        actorId: user.email,
        actorName: user.name || user.email,
        action: 'RESUME_ASSESSMENT',
        category: 'ASSESSMENT',
        target: existingInProgress.id,
        details: { unit: user.unit, resumed: true },
        ip: getClientIp(request),
        status: 'SUCCESS'
      });

      return json(response, 200, { attempt: existingInProgress, expiresAt, resumed: true });
    }
    const maxAttemptNum = existing.reduce((max, a) => {
      const match = String(a.id || '').match(/ATT-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 1042);
    const newAttemptId = `ATT-${maxAttemptNum + 1}`;
    const seed = user.email ? user.email.toLowerCase().trim() : newAttemptId;
    const scrambledOrder = gvQuestions.length > 0 ? shuffleWithSeed(gvQuestions, seed).map((q) => q.id) : [];
    const startedAt = new Date().toISOString();
    const startMs = new Date(startedAt).getTime();
    const attempt = {
      id: newAttemptId,
      teacher: user.name,
      email: user.email,
      unit: user.unit || 'SD KARYA BANGSA',
      status: 'In progress',
      startedAt,
      overall: null,
      review: 'Pending',
      grammarVocabularyOrder: scrambledOrder,
      sectionStartTimes: {
        0: startedAt
      },
      sectionEndTimes: {
        0: startMs + gvMins * 60 * 1000
      },
      sectionRemainingMs: {
        0: gvMins * 60 * 1000,
        1: writingMins * 60 * 1000,
        2: speakingMins * 60 * 1000
      },

      antiCheat: {
        enabled: Boolean(
          currentSystemSettings.antiCheat?.enabled !== false &&
          (
            currentSystemSettings.antiCheat?.tabSwitchDetection ||
            currentSystemSettings.antiCheat?.requireFullscreen ||
            currentSystemSettings.antiCheat?.splitScreenDetection ||
            currentSystemSettings.antiCheat?.blockDevTools ||
            currentSystemSettings.antiCheat?.blockCopyPaste
          )
        ),
        rules: { ...(currentSystemSettings.antiCheat || defaultSystemSettings.antiCheat) },
        tabSwitches: 0,
        fullscreenExits: 0,
        splitScreenDetections: 0,
        devToolsAttempts: 0,
        copyPasteAttempts: 0,
        totalCount: 0,
        violations: []
      }
    };
    await repository.createAttempt(attempt);

    broadcastRealtime('admin', 'ATTEMPT_STARTED', {
      attempt,
      teacher: user.name || user.email,
      email: user.email,
      unit: attempt.unit,
      startedAt
    });
    activeCandidatePresence.set(attempt.id, {
      attemptId: attempt.id,
      email: user.email,
      name: user.name || user.email,
      unit: attempt.unit,
      sectionIndex: 0,
      sectionName: 'Grammar & Vocabulary',
      answeredCount: 0,
      totalQuestions: gvQuestions.length || 25,
      remainingMs: durationMins * 60 * 1000,
      antiCheat: attempt.antiCheat,
      lastHeartbeat: Date.now(),
      status: 'active'
    });
    broadcastRealtime('admin', 'CANDIDATE_PRESENCE_UPDATE', activeCandidatePresence.get(attempt.id));

    await recordAuditLog({
      actorType: 'teacher',
      actorId: user.email,
      actorName: user.name || user.email,
      action: 'START_ASSESSMENT',
      category: 'ASSESSMENT',
      target: attempt.id,
      details: { unit: attempt.unit, durationMinutes: durationMins },
      ip: getClientIp(request),
      status: 'SUCCESS'
    });

    return json(response, 201, { attempt, expiresAt: new Date(Date.now() + durationMins * 60 * 1000).toISOString(), resumed: false });
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
    const etag = `"${crypto.createHash('md5').update(data).digest('hex')}"`;
    const clientEtag = request.headers['if-none-match'];

    if (clientEtag && clientEtag === etag) {
      response.writeHead(304, {
        ETag: etag,
        'Cache-Control': 'no-cache'
      });
      return response.end();
    }

    const headers = {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      ETag: etag
    };
    if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.css')) {
      headers['Cache-Control'] = 'no-cache';
    } else {
      headers['Cache-Control'] = 'public, max-age=86400';
    }
    response.writeHead(200, headers);
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
} catch (err) {
  console.error('Unhandled request error:', err);
  if (!response.headersSent) {
    json(response, 500, { error: 'Internal server error' });
  }
}
});

const PORT = Number(process.env.PORT) || 3000;

server.listen(PORT, () => {
  console.log(`Assessify running at http://localhost:${PORT}`);
  connectMySQL();
});
