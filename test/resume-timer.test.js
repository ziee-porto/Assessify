import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL || ('http://localhost:' + (process.env.PORT || 3000));

describe('Assessment Resume Timer Continuity Engine', () => {
  const teacher = {
    email: 'meta@karyabangsa.sch.id',
    fullName: 'Meta Wulandari',
    unit: 'SMA KARYA BANGSA'
  };

  let teacherCookie = '';
  let adminCookie = '';
  let attemptId = '';

  it('authenticates admin and candidate teacher, cleaning up existing attempts', async () => {
    const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', username: 'azzikra', password: '4dm1n123' })
    });
    assert.strictEqual(adminRes.status, 200);
    adminCookie = adminRes.headers.get('set-cookie');

    // Clean up attempts for teacher
    const resultsRes = await fetch(`${baseUrl}/api/admin/results`, { headers: { 'Cookie': adminCookie } });
    const existing = (await resultsRes.json()).results || [];
    for (const att of existing.filter((a) => (a.email || '').toLowerCase().trim() === teacher.email)) {
      await fetch(`${baseUrl}/api/admin/results/${att.id}`, { method: 'DELETE', headers: { 'Cookie': adminCookie } });
    }

    const teacherRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'teacher', ...teacher })
    });
    assert.strictEqual(teacherRes.status, 200);
    teacherCookie = teacherRes.headers.get('set-cookie');
  });

  it('initializes sectionRemainingMs and sectionEndTimes on start assessment', async () => {
    const startRes = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: { 'Cookie': teacherCookie }
    });
    assert.ok([200, 201].includes(startRes.status));
    const startData = await startRes.json();
    attemptId = startData.attempt.id;

    assert.ok(startData.attempt.sectionRemainingMs, 'Attempt should have sectionRemainingMs');
    assert.strictEqual(startData.attempt.sectionRemainingMs[0], 30 * 60 * 1000, 'Section 0 should start at 30 mins');
  });

  it('persists remaining time in draft when candidate works on questions', async () => {
    // Simulate candidate spending 8 minutes on Grammar & Vocabulary (leaving 22 minutes / 1320000ms)
    const simulatedRemainingMs = 22 * 60 * 1000;
    const simulatedEndTime = Date.now() + simulatedRemainingMs;

    const draftRes = await fetch(`${baseUrl}/api/attempts/${attemptId}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': teacherCookie },
      body: JSON.stringify({
        responses: { 'g-1': 'older than', 'g-2': 'reliable' },
        sectionIndex: 0,
        sectionRemainingMs: { 0: simulatedRemainingMs },
        sectionEndTimes: { 0: simulatedEndTime }
      })
    });
    assert.strictEqual(draftRes.status, 200);
    const draftData = await draftRes.json();
    assert.strictEqual(draftData.success, true);
  });

  it('resumes with the continued remaining time (22 minutes) rather than resetting to 30 minutes', async () => {
    // 1. Check /api/attempts/me returns the in-progress attempt with the continued remaining time
    const meRes = await fetch(`${baseUrl}/api/attempts/me`, { headers: { 'Cookie': teacherCookie } });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.ok(meData.inProgressAttempt);
    assert.strictEqual(meData.inProgressAttempt.sectionRemainingMs[0], 22 * 60 * 1000, 'Should retain 22 mins remaining on /me');

    // 2. Calling POST /api/attempts (resuming) returns the attempt with the continued remaining time
    const resumeRes = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(resumeRes.status, 200);
    const resumeData = await resumeRes.json();
    assert.strictEqual(resumeData.resumed, true);
    assert.strictEqual(resumeData.attempt.id, attemptId);
    assert.strictEqual(resumeData.attempt.sectionRemainingMs[0], 22 * 60 * 1000, 'Should retain 22 mins remaining, not 30 mins');

    // Clean up
    await fetch(`${baseUrl}/api/admin/results/${attemptId}`, { method: 'DELETE', headers: { 'Cookie': adminCookie } });
  });
});
