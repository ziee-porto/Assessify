import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = 'http://localhost:3001';

describe('Auto-Save & In-Progress Recovery Engine', () => {
  const teacherEmail = 'elma@karyabangsa.sch.id';
  const teacherName = 'Elma Sanditia';
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

  it('authenticates teacher and starts initial assessment', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'teacher',
        email: teacherEmail,
        fullName: teacherName,
        unit: teacherUnit
      })
    });
    assert.strictEqual(loginRes.status, 200);
    teacherCookie = loginRes.headers.get('set-cookie');

    const startRes = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: { 'Cookie': teacherCookie }
    });
    assert.ok([200, 201].includes(startRes.status), `startRes status was ${startRes.status}`);
    const startData = await startRes.json();
    attemptId = startData.attempt.id;
    assert.ok(attemptId);
  });

  it('auto-saves in-progress answers, selected topic, and writing essay draft to server', async () => {
    const draftPayload = {
      responses: {
        'grammar-q-1': 'B',
        'grammar-q-2': 'A',
        'grammar-q-3': 'D',
        'writing_selected_topic_id': 'w-topic-2',
        'writing_selected_topic_title': 'Email About Your Country',
        'writing-essay': 'Dear Friend,\n\nI am writing to tell you about Indonesia, an archipelago of breathtaking islands...'
      },
      writing: 'Dear Friend,\n\nI am writing to tell you about Indonesia, an archipelago of breathtaking islands...',
      sectionIndex: 1,
      speakingStep: 0
    };

    const draftRes = await fetch(`${baseUrl}/api/attempts/${attemptId}/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': teacherCookie
      },
      body: JSON.stringify(draftPayload)
    });
    assert.strictEqual(draftRes.status, 200);
    const draftData = await draftRes.json();
    assert.strictEqual(draftData.success, true);
    assert.ok(draftData.lastSavedAt);
  });

  it('recovers all saved draft answers and section state after simulated connection drop / restart', async () => {
    // 1. Check /api/attempts/me
    const meRes = await fetch(`${baseUrl}/api/attempts/me`, {
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.hasCompleted, false);
    assert.ok(meData.inProgressAttempt, 'Should detect active in-progress attempt');
    assert.strictEqual(meData.inProgressAttempt.id, attemptId);

    // Verify draft responses are intact
    const restored = meData.inProgressAttempt.responses;
    assert.ok(restored);
    assert.strictEqual(restored['grammar-q-1'], 'B');
    assert.strictEqual(restored['grammar-q-2'], 'A');
    assert.strictEqual(restored['writing_selected_topic_id'], 'w-topic-2');
    assert.ok(restored['writing-essay'].includes('Dear Friend'));
    assert.strictEqual(meData.inProgressAttempt.sectionIndex, 1);

    // 2. Re-invoking POST /api/attempts seamlessly returns the in-progress attempt with resumed: true
    const resumeRes = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(resumeRes.status, 200);
    const resumeData = await resumeRes.json();
    assert.strictEqual(resumeData.resumed, true);
    assert.strictEqual(resumeData.attempt.id, attemptId);
  });

  it('submits assessment and cleans up test attempt', async () => {
    const submitRes = await fetch(`${baseUrl}/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': teacherCookie
      },
      body: JSON.stringify({
        responses: {
          'grammar-q-1': 'B',
          'writing_selected_topic_id': 'w-topic-2',
          'writing-essay': 'Final Essay Text'
        },
        writing: 'Final Essay Text'
      })
    });
    assert.strictEqual(submitRes.status, 200);

    // Clean up test attempt
    await fetch(`${baseUrl}/api/admin/results/${attemptId}`, {
      method: 'DELETE',
      headers: { 'Cookie': adminCookie }
    });
  });
});
