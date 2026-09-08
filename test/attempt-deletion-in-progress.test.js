import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = 'http://localhost:3001';

describe('Candidate Attempt Deletion & In-Progress Termination Engine', () => {
  const teacher = {
    email: 'albine@karyabangsa.sch.id',
    fullName: 'Albine Ompusunggu',
    unit: 'SMA KARYA BANGSA'
  };

  let adminCookie = '';
  let teacherCookie = '';
  let attemptId = '';

  it('authenticates admin and resets existing attempts for test teacher', async () => {
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

  it('starts assessment and saves in-progress progress with 18 mins remaining', async () => {
    const startRes = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: { 'Cookie': teacherCookie }
    });
    assert.ok([200, 201].includes(startRes.status));
    const startData = await startRes.json();
    attemptId = startData.attempt.id;

    // Simulate saving draft at 18 minutes remaining (1080000 ms)
    const draftRes = await fetch(`${baseUrl}/api/attempts/${attemptId}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': teacherCookie },
      body: JSON.stringify({
        responses: { 'g-1': 'older than' },
        sectionIndex: 0,
        sectionRemainingMs: { 0: 18 * 60 * 1000 }
      })
    });
    assert.strictEqual(draftRes.status, 200);

    // Verify status endpoint reports active status
    const statusRes = await fetch(`${baseUrl}/api/attempts/${attemptId}/status`, {
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.strictEqual(statusData.status, 'In progress');
  });

  it('resumes with continued remaining time (18 mins) when candidate data is NOT deleted', async () => {
    const resumeRes = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(resumeRes.status, 200);
    const resumeData = await resumeRes.json();
    assert.strictEqual(resumeData.resumed, true);
    assert.strictEqual(resumeData.attempt.id, attemptId);
    assert.strictEqual(resumeData.attempt.sectionRemainingMs[0], 18 * 60 * 1000, 'Continues with 18 mins when not deleted');
  });

  it('admin deletes candidate assessment record; status and draft immediately report 404', async () => {
    // Admin deletes the candidate attempt
    const delRes = await fetch(`${baseUrl}/api/admin/results/${attemptId}`, {
      method: 'DELETE',
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(delRes.status, 200);

    // /api/attempts/:id/status immediately returns 404
    const statusRes = await fetch(`${baseUrl}/api/attempts/${attemptId}/status`, {
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(statusRes.status, 404);
    const statusData = await statusRes.json();
    assert.strictEqual(statusData.attemptDeleted, true);

    // /api/attempts/:id/draft immediately returns 404
    const draftRes = await fetch(`${baseUrl}/api/attempts/${attemptId}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': teacherCookie },
      body: JSON.stringify({ responses: { 'g-1': 'B' } })
    });
    assert.strictEqual(draftRes.status, 404);

    // /api/attempts/me reports inProgressAttempt: null
    const meRes = await fetch(`${baseUrl}/api/attempts/me`, {
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.inProgressAttempt, null, 'Deleted candidate data should not show inProgressAttempt');
  });

  it('when starting a new assessment after deletion, it starts fresh with 30 mins and resumed: false', async () => {
    const newStartRes = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(newStartRes.status, 201);
    const newStartData = await newStartRes.json();
    assert.strictEqual(newStartData.resumed, false, 'Should be a fresh start, not resumed');
    assert.strictEqual(newStartData.attempt.sectionRemainingMs[0], 30 * 60 * 1000, 'Should start with full 30 mins, not previous 18 mins');

    // Clean up
    await fetch(`${baseUrl}/api/admin/results/${newStartData.attempt.id}`, {
      method: 'DELETE',
      headers: { 'Cookie': adminCookie }
    });
  });
});
