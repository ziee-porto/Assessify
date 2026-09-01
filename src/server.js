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
const seedAttempts = [];
const memoryRepository = {
  attempts: [...seedAttempts],
  settings: new Map(),
  async listAttempts() { return this.attempts; },
  async createAttempt(attempt) { this.attempts.unshift(attempt); return attempt; },
  async getAttempt(id) { return this.attempts.find((attempt) => attempt.id === id); },
  async updateAttempt(id, update) { const attempt = this.attempts.find((item) => item.id === id); if (attempt) Object.assign(attempt, update); return attempt; },
  async deleteAttempt(id) { const idx = this.attempts.findIndex((item) => item.id === id); if (idx !== -1) { this.attempts.splice(idx, 1); return true; } return false; },
  async getSetting(key) { return this.settings.get(key); },
  async setSetting(key, value) { this.settings.set(key, value); return value; }
};
let repository = memoryRepository;
let storageMode = 'memory';

async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI is not configured; using memory repository. Test data will not survive restart.');
    return;
  }
  try {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 1500, connectTimeoutMS: 1500 });
    const connectPromise = async () => {
      await client.connect();
      const database = client.db(process.env.MONGODB_DB || 'assessify');
      const collection = database.collection('attempts');
      const settings = database.collection('settings');
      await collection.createIndex({ id: 1 }, { unique: true });
      await collection.createIndex({ email: 1, startedAt: -1 });
      await collection.createIndex({ status: 1, review: 1, startedAt: -1 });
      await Promise.all(seedAttempts.map((attempt) => collection.updateOne({ id: attempt.id }, { $setOnInsert: attempt }, { upsert: true })));
      repository = {
        async listAttempts() { return collection.find({}, { projection: { _id: 0 } }).sort({ startedAt: -1 }).toArray(); },
        async createAttempt(attempt) { await collection.insertOne(attempt); return attempt; },
        async getAttempt(id) { return collection.findOne({ id }, { projection: { _id: 0 } }); },
        async updateAttempt(id, update) { return collection.findOneAndUpdate({ id }, { $set: update }, { returnDocument: 'after', projection: { _id: 0 } }); },
        async deleteAttempt(id) { const result = await collection.deleteOne({ id }); return result.deletedCount > 0; },
        async getSetting(key) { return (await settings.findOne({ _id: key }))?.value; },
        async setSetting(key, value) { await settings.updateOne({ _id: key }, { $set: { value, updatedAt: new Date().toISOString() } }, { upsert: true }); return value; }
      };
      storageMode = 'mongodb';
      console.log('MongoDB repository connected');
    };
    
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 1500));
    await Promise.race([connectPromise(), timeoutPromise]);
  } catch (error) {
    console.warn(`MongoDB unavailable; using memory repository (${error.message})`);
  }
}

const json = (response, status, data) => {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
};
const safeTest = () => ({ ...content, sections: content.sections.map(({ questions, ...section }) => ({ ...section, questions: questions.map(({ answer, ...question }) => question) })) });
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
const cefrFromCorrect = (correct, total) => {
  if (total <= 18) {
    if (correct >= 15) return 'B2';
    if (correct >= 11) return 'B1';
    if (correct >= 7) return 'A2';
    return 'A1';
  }
  if (correct >= 16) return 'B2';
  if (correct >= 12) return 'B1';
  if (correct >= 8) return 'A2';
  return 'A1';
};
const cefrOrder = ['A1', 'A2', 'B1', 'B2'];
const computeFinalPlacement = (sectionScores) => {
  const levels = Object.values(sectionScores).filter((v) => cefrOrder.includes(v));
  if (levels.length < 3) return null;
  const count = (l) => levels.filter((v) => v === l).length;
  const writingLevel = sectionScores.Writing || null;
  const speakingLevel = sectionScores.Speaking || null;
  if (count('B2') >= 3 && cefrOrder.indexOf(writingLevel) >= 2 && cefrOrder.indexOf(speakingLevel) >= 2) return 'B2';
  if (count('B1') + count('B2') >= 3 && cefrOrder.indexOf(writingLevel) >= 1 && cefrOrder.indexOf(speakingLevel) >= 1) return 'B1';
  if (count('A1') >= 3) return 'A1';
  return 'A2';
};
const rubricLevel = (criteria) => {
  const values = Object.values(criteria || {}).map(Number).filter((v) => Number.isInteger(v) && v >= 1 && v <= 4);
  if (values.length === 0) return { criteria: criteria || {}, total: 0, level: null };
  const total = values.reduce((sum, value) => sum + value, 0);
  const level = values.length === 4 ? (total <= 6 ? 'A1' : total <= 9 ? 'A2' : total <= 13 ? 'B1' : 'B2') : null;
  return { criteria: criteria || {}, total, level };
};
const cefrDescriptor = (level) => ({ A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate', B2: 'Upper-Intermediate' }[level] || level);
const cefrColor = (level) => ({ A1: '#c0392b', A2: '#d68910', B1: '#2b5da8', B2: '#1a7a4a' }[level] || '#555555');

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

const scoreObjective = (sectionId, responses) => {
  const section = content.sections.find((item) => item.id === sectionId);
  const questions = section?.questions || [];
  const correct = questions.filter((question) => String(responses?.[question.id] || '').trim().toLowerCase() === String(question.answer || '').trim().toLowerCase()).length;
  const level = cefrFromCorrect(correct, questions.length);
  return { skill: section?.label, correct, total: questions.length, level, method: 'Objective answer-key scoring mapped to CEFR (A1–B2) per school rubric' };
};

const certificateNumber = (row) => `KBS-EN-${new Date(row.started).getUTCFullYear()}-${row.attempt.replace(/^ATT-/, '')}`;
const exportRows = (results) => results.map((row) => ({ teacher: row.teacher, email: row.email || '', attempt: row.id, started: row.startedAt, status: row.status, grammarVocabulary: row.sectionScores?.['Grammar & Vocabulary'] ?? '', reading: row.sectionScores?.Reading ?? '', writing: row.sectionScores?.Writing ?? '', listening: row.sectionScores?.Listening ?? '', speaking: row.sectionScores?.Speaking ?? '', overallBand: row.overall ?? '', review: row.review, analysis: performanceAnalysis(row) }));
const sendExcel = async (response, results) => { const workbook = new ExcelJS.Workbook(); workbook.creator = 'Assessify'; const sheet = workbook.addWorksheet('Teacher Results'); sheet.columns = [{ header: 'Teacher', key: 'teacher', width: 24 }, { header: 'Email', key: 'email', width: 36 }, { header: 'Attempt', key: 'attempt', width: 14 }, { header: 'Started', key: 'started', width: 25 }, { header: 'Status', key: 'status', width: 16 }, { header: 'Grammar & Vocabulary', key: 'grammarVocabulary', width: 22 }, { header: 'Reading', key: 'reading', width: 12 }, { header: 'Writing', key: 'writing', width: 12 }, { header: 'Listening', key: 'listening', width: 12 }, { header: 'Speaking', key: 'speaking', width: 12 }, { header: 'Overall Band', key: 'overallBand', width: 16 }, { header: 'Review', key: 'review', width: 18 }, { header: 'Analysis', key: 'analysis', width: 80 }]; sheet.addRows(exportRows(results)); sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D7772' } }; sheet.getColumn('analysis').alignment = { wrapText: true, vertical: 'top' }; sheet.autoFilter = 'A1:M1'; const buffer = await workbook.xlsx.writeBuffer(); response.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="assessify-teacher-results.xlsx"' }); response.end(buffer); };

const sendCenteredPdf = (response, results) => {
  const doc = new PDFDocument({ margin: 42, size: 'A4' });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => {
    response.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="assessify-teacher-results.pdf"' });
    response.end(Buffer.concat(chunks));
  });
  const rows = exportRows(results);
  rows.forEach((row, index) => {
    if (index > 0) doc.addPage();

    // ── Header bar ──────────────────────────────────────────────────
    doc.rect(0, 0, 595, 100).fill('#173f7a');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('Assessify.', 0, 28, { width: 595, align: 'center' });
    doc.fontSize(10).font('Helvetica').text('CEFR English Placement Result · Karya Bangsa School', 0, 58, { width: 595, align: 'center' });

    // ── Teacher info ─────────────────────────────────────────────────
    doc.fillColor('#17252a').fontSize(20).font('Helvetica-Bold').text(row.teacher, 0, 122, { width: 595, align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor('#6e7d7c')
      .text(`${row.email}  |  Started ${new Date(row.started).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 0, 148, { width: 595, align: 'center' });
    doc.font('Helvetica-Bold').fillColor('#214d91').text(`Certificate No. ${certificateNumber(row)}`, 0, 163, { width: 595, align: 'center' });

    // ── Overall CEFR badge ───────────────────────────────────────────
    const overallLevel = row.overallBand;
    const badgeColor = cefrColor(overallLevel);
    const badgeW = 153;
    const badgeH = 68;
    const badgeX = (595 - badgeW) / 2; // = 221
    const badgeY = 180;
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 6).fill(badgeColor);
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold').text('OVERALL CEFR LEVEL', badgeX, badgeY + 12, { width: badgeW, align: 'center' });
    doc.fontSize(28).text(overallLevel || 'Pending', badgeX, badgeY + 24, { width: badgeW, align: 'center' });
    if (overallLevel) {
      doc.fontSize(8).font('Helvetica').text(cefrDescriptor(overallLevel), badgeX, badgeY + 54, { width: badgeW, align: 'center' });
    }

    // ── CEFR legend ──────────────────────────────────────────────────
    const legendY = 265;
    doc.fillColor('#17252a').fontSize(12).font('Helvetica-Bold').text('CEFR Skill Profile', 0, legendY, { width: 595, align: 'center' });
    const boxesY = legendY + 18; // = 283
    const gap = 120;
    const boxW = 52;
    const totalLegendWidth = 3 * gap + boxW; // = 412
    const startLegendX = (595 - totalLegendWidth) / 2; // = 91.5
    [['A1', 'Beginner'], ['A2', 'Elementary'], ['B1', 'Intermediate'], ['B2', 'Upper-Intermediate']].forEach(([lvl, desc], i) => {
      const lx = startLegendX + i * gap;
      doc.roundedRect(lx, boxesY, boxW, 18, 3).fill(cefrColor(lvl));
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(lvl, lx, boxesY + 5, { width: boxW, align: 'center' });
      doc.fillColor('#555').fontSize(7).font('Helvetica').text(desc, lx - 10, boxesY + 20, { width: boxW + 20, align: 'center' });
    });

    // ── Skills table ─────────────────────────────────────────────────
    const tableX = 42;
    const tableWidth = 511;
    const skillColW = 260;
    const levelColW = 130;
    const rawColW = tableWidth - skillColW - levelColW;
    const tableTop = 330;
    const rowH = 32;

    // Table header
    doc.rect(tableX, tableTop, tableWidth, rowH).fill('#1a2e5a');
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
      .text('Skill / Component', tableX, tableTop + 11, { width: skillColW, align: 'center' })
      .text('CEFR Level', tableX + skillColW, tableTop + 11, { width: levelColW, align: 'center' })
      .text('Raw Score', tableX + skillColW + levelColW, tableTop + 11, { width: rawColW, align: 'center' });

    const skillRows = [
      ['Grammar & Vocabulary', row.grammarVocabulary, '/ 20'],
      ['Listening', row.listening, '/ 18'],
      ['Reading', row.reading, '/ 20'],
      ['Writing', row.writing, '/ 16 (rubric)'],
      ['Speaking', row.speaking, '/ 16 (rubric)'],
    ];

    skillRows.forEach(([skill, level, rawLabel], si) => {
      const y = tableTop + rowH + si * rowH;
      const bg = si % 2 === 0 ? '#f4f6fb' : '#ffffff';
      doc.rect(tableX, y, tableWidth, rowH).fill(bg);
      doc.lineWidth(0.5).strokeColor('#d0d8e8').rect(tableX, y, tableWidth, rowH).stroke();

      // Skill name
      doc.fillColor('#1a2e5a').fontSize(10).font('Helvetica-Bold')
        .text(skill, tableX, y + 10, { width: skillColW, align: 'center' });

      // CEFR badge
      if (level && level !== '') {
        const bColor = cefrColor(level);
        const cellBadgeX = tableX + skillColW + (levelColW - 70) / 2;
        doc.roundedRect(cellBadgeX, y + 6, 70, 20, 4).fill(bColor);
        doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
          .text(level, cellBadgeX, y + 11, { width: 70, align: 'center' });
      } else {
        doc.fillColor('#aaa').fontSize(9).font('Helvetica').text('Pending review', tableX + skillColW, y + 11, { width: levelColW, align: 'center' });
      }

      // Raw label column
      doc.fillColor('#666').fontSize(8).font('Helvetica')
        .text(rawLabel, tableX + skillColW + levelColW, y + 11, { width: rawColW, align: 'center' });
    });

    // Total / Final row
    const totalY = tableTop + rowH + skillRows.length * rowH;
    doc.rect(tableX, totalY, tableWidth, rowH).fill('#1a2e5a');
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
      .text('Final CEFR Placement', tableX, totalY + 10, { width: skillColW, align: 'center' });
    if (overallLevel) {
      const cellBadgeX = tableX + skillColW + (levelColW - 70) / 2;
      doc.roundedRect(cellBadgeX, totalY + 6, 70, 20, 4).fill(cefrColor(overallLevel));
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
        .text(overallLevel, cellBadgeX, totalY + 11, { width: 70, align: 'center' });
      doc.fillColor('#aad4ff').fontSize(8).font('Helvetica')
        .text(cefrDescriptor(overallLevel), tableX + skillColW + levelColW, totalY + 11, { width: rawColW, align: 'center' });
    } else {
      doc.fillColor('#aaa').fontSize(9).font('Helvetica')
        .text('Pending review', tableX + skillColW, totalY + 10, { width: levelColW + rawColW, align: 'center' });
    }

    // ── Placement analysis ───────────────────────────────────────────
    const analysisY = totalY + rowH + 20;
    doc.fillColor('#17252a').fontSize(12).font('Helvetica-Bold').text('Placement Analysis', 0, analysisY, { width: 595, align: 'center' });
    doc.font('Helvetica').fontSize(9.5).fillColor('#415354')
      .text(row.analysis, tableX, analysisY + 18, { width: tableWidth, lineGap: 4, align: 'center' });

    // ── Footer ───────────────────────────────────────────────────────
    const oldBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.rect(0, 800, 595, 42).fill('#f0f4fb');
    doc.fillColor('#6e7d7c').fontSize(7.5).font('Helvetica')
      .text('This document is an internal placement record issued by Karya Bangsa School. It does not constitute an official CEFR or IELTS certificate.', 42, 812, { width: 511, align: 'center' });
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
    const { email, fullName, name, username, password, role = 'teacher' } = await requestBody(request);
    if (role === 'admin') {
      const normalizedUsername = (username || '').toLowerCase().trim();
      const account = adminAccounts[normalizedUsername];
      if (!account || !account.password || password !== account.password) {
        return json(response, 401, { error: 'Invalid admin credentials' });
      }
      const user = { username: normalizedUsername, name: account.name || 'Admin', role: 'admin' };
      const token = createSession(user);
      response.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': `assessify_session=${token}; HttpOnly; SameSite=Lax; Path=/` });
      return response.end(JSON.stringify({ user }));
    }
    if (!email || !email.endsWith('@karyabangsa.sch.id')) return json(response, 403, { error: 'Use your Karya Bangsa School account (@karyabangsa.sch.id)' });
    const teacherName = (fullName || name || '').trim() || email.split('@')[0].split('.').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    const user = { email, name: teacherName, role: 'teacher' };
    const token = createSession(user);
    response.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': `assessify_session=${token}; HttpOnly; SameSite=Lax; Path=/` });
    return response.end(JSON.stringify({ user }));
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
    const results = await repository.listAttempts();
    if (url.searchParams.get('format') === 'pdf') return sendCenteredPdf(response, results);
    if (url.searchParams.get('format') === 'xlsx') return sendExcel(response, results);
    return json(response, 400, { error: 'Use format=xlsx or format=pdf' });
  }
  // Question Bank Management
  if (url.pathname === '/api/admin/questions' && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    return json(response, 200, content);
  }
  if (url.pathname === '/api/admin/questions/upload' && request.method === 'POST') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    try {
      const newContent = await requestBody(request);
      if (!newContent || !Array.isArray(newContent.sections) || newContent.sections.length === 0) {
        return json(response, 400, { error: 'Invalid question bank: Must contain a non-empty "sections" array.' });
      }
      content = newContent;
      await writeFile(join(root, 'content', 'ielts-placement.json'), JSON.stringify(newContent, null, 2), 'utf8');
      return json(response, 200, { success: true, totalSections: newContent.sections.length });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  // Rubrics Management
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
      rubrics = newRubrics;
      await writeFile(join(root, 'content', 'ielts-rubrics.json'), JSON.stringify(newRubrics, null, 2), 'utf8');
      return json(response, 200, { success: true });
    } catch (e) {
      return json(response, 400, { error: e.message });
    }
  }

  if (url.pathname.startsWith('/api/admin/results/') && request.method === 'GET') {
    if (!isAdmin(request)) return json(response, 403, { error: 'Admin access required' });
    const attempt = await repository.getAttempt(url.pathname.split('/').pop());
    return attempt ? json(response, 200, { attempt, review: { writing: 'Pending teacher review', speaking: 'Pending teacher review' } }) : json(response, 404, { error: 'Attempt not found' });
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
      const manualReview = { writing: rubricLevel(writing), speaking: rubricLevel(speaking), reviewedAt: new Date().toISOString() };
      const sectionScores = { ...(attempt.sectionScores || {}) };
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
  if (url.pathname.startsWith('/api/attempts/') && url.pathname.endsWith('/recording') && request.method === 'POST') {
    const user = currentUser(request);
    if (!user || user.role !== 'teacher') return json(response, 401, { error: 'Teacher sign-in required' });
    const attemptId = url.pathname.split('/')[3];
    const attempt = await repository.getAttempt(attemptId);
    if (!attempt || attempt.email !== user.email) return json(response, 404, { error: 'Attempt not found' });
    if (attempt.status === 'Completed') return json(response, 409, { error: 'This assessment has already been submitted.' });

    const contentType = request.headers['content-type'] || 'video/webm';
    const durationSeconds = Number(request.headers['x-duration-seconds']) || 0;
    const transcriptSource = request.headers['x-transcript-source'] || 'Browser SpeechRecognition';

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
        transcriptSource,
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
    const { writing = '', speaking = '', responses = {}, speakingRecording = null } = await requestBody(request);
    if (speakingRecording?.dataUrl && speakingRecording.dataUrl.length > 14_000_000) return json(response, 413, { error: 'Speaking recording is too large. Please record a shorter response.' });
    const grammarVocabularyScore = scoreObjective('grammar-vocabulary', responses);
    const readingScore = scoreObjective('reading', responses);
    const listeningScore = scoreObjective('listening', responses);
    // All section scores are now CEFR levels (A1/A2/B1/B2)
    const sectionScores = {
      ...(attempt.sectionScores || {}),
      'Grammar & Vocabulary': grammarVocabularyScore.level,
      Reading: readingScore.level,
      Listening: listeningScore.level
    };
    // Provisional placement based on the 3 objective skills (W+S still pending)
    const provisionalPlacement = computeFinalPlacement(sectionScores);
    
    // Combine any existing recording metadata (e.g. from prior /recording endpoint upload) with incoming submission
    const existingRecording = attempt.speakingRecording || null;
    let finalRecording = null;
    if (existingRecording?.fileUrl) {
      finalRecording = {
        ...existingRecording,
        ...(speakingRecording || {})
      };
    } else if (speakingRecording) {
      finalRecording = {
        mimeType: speakingRecording.mimeType,
        durationSeconds: speakingRecording.durationSeconds,
        transcriptSource: speakingRecording.transcriptSource,
        fileUrl: speakingRecording.fileUrl || null,
        dataUrl: speakingRecording.dataUrl || null
      };
    }

    const scored = {
      ...attempt,
      status: 'Completed',
      sectionScores,
      overall: provisionalPlacement,
      review: 'Writing and Speaking review required',
      scoring: { grammarVocabulary: grammarVocabularyScore, reading: readingScore, listening: listeningScore },
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
  if (url.pathname === '/api/attempts' && request.method === 'POST') {
    const user = currentUser(request);
    if (!user || user.role !== 'teacher') return json(response, 401, { error: 'Teacher sign-in required' });
    const existing = await repository.listAttempts();
    const attempt = { id: `ATT-${1043 + existing.length}`, teacher: user.name, email: user.email, status: 'In progress', startedAt: new Date().toISOString(), overall: null, review: 'Pending' };
    await repository.createAttempt(attempt);
    return json(response, 201, { attempt, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
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

server.listen(Number(process.env.PORT) || 3000, () => {
  console.log(`Assessify running at http://localhost:${process.env.PORT || 3000}`);
  connectMongo();
});
