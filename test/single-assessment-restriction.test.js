import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = 'http://localhost:3001';

describe('Single Assessment Restriction (No 2nd Test Policy)', () => {
  const teacherEmail = 'anggra@karyabangsa.sch.id';
  const teacherName = 'Anggra Novita Sari';
  const teacherUnit = 'SMA KARYA BANGSA';
  let adminCookie = '';
  let teacherCookie = '';
  let attemptId = '';

  it('authenticates admin and cleans up any existing attempts for test teacher', async () => {
    const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', username: 'azzikra', password: '4dm1n123' })
    });
    assert.strictEqual(adminRes.status, 200);
    adminCookie = adminRes.headers.get('set-cookie');

    // Fetch existing attempts and delete any for test teacher
    const resultsRes = await fetch(`${baseUrl}/api/admin/results`, {
      headers: { 'Cookie': adminCookie }
    });
    const resultsData = await resultsRes.json();
    const existing = (resultsData.results || []).filter(
      (a) => (a.email || '').toLowerCase().trim() === teacherEmail.toLowerCase().trim()
    );
    for (const att of existing) {
      await fetch(`${baseUrl}/api/admin/results/${att.id}`, {
        method: 'DELETE',
        headers: { 'Cookie': adminCookie }
      });
    }
  });

  it('authenticates authorized teacher and receives session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'teacher',
        email: teacherEmail,
        fullName: teacherName,
        unit: teacherUnit
      })
    });
    assert.strictEqual(res.status, 200);
    teacherCookie = res.headers.get('set-cookie');
    assert.ok(teacherCookie, 'Should receive session cookie for teacher');
  });

  it('checks /api/attempts/me before taking the test and confirms hasCompleted is false', async () => {
    const res = await fetch(`${baseUrl}/api/attempts/me`, {
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.hasCompleted, false);
    assert.strictEqual(data.completedAttempt, null);
  });

  it('allows teacher to start their official first assessment attempt', async () => {
    const res = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(res.status, 201, 'Should create new attempt with 201 Created');
    const data = await res.json();
    assert.ok(data.attempt, 'Should return attempt object');
    assert.ok(data.attempt.id, 'Should have attempt ID');
    attemptId = data.attempt.id;
  });

  it('teacher submits their assessment successfully (status becomes Completed)', async () => {
    const res = await fetch(`${baseUrl}/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': teacherCookie
      },
      body: JSON.stringify({
        responses: {
          'writing-0': 'Official Task 1 memorandum content.',
          'writing-1': 'Official Task 2 discursive essay content.'
        },
        writing: 'Official Task 1 memorandum content.\n\nOfficial Task 2 discursive essay content.'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.attempt.status, 'Completed');
  });

  it('verifies /api/attempts/me now reports hasCompleted: true with the completed attempt', async () => {
    const res = await fetch(`${baseUrl}/api/attempts/me`, {
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.hasCompleted, true);
    assert.ok(data.completedAttempt, 'Should contain completedAttempt object');
    assert.strictEqual(data.completedAttempt.id, attemptId);
    assert.strictEqual(data.completedAttempt.status, 'Completed');
  });

  it('STRICTLY BLOCKS teacher from testing a 2nd time via POST /api/attempts (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(res.status, 403, 'Should reject 2nd test attempt with 403 Forbidden');
    const data = await res.json();
    assert.strictEqual(data.hasCompleted, true);
    assert.match(data.error, /already completed the assessment/i);
  });

  it('cleans up test attempt record after verification', async () => {
    if (attemptId && adminCookie) {
      await fetch(`${baseUrl}/api/admin/results/${attemptId}`, {
        method: 'DELETE',
        headers: { 'Cookie': adminCookie }
      });
    }
  });
});
