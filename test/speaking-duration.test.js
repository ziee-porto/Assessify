import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL || ('http://localhost:' + (process.env.PORT || 3000));

test('Speaking Section Dynamic Duration Configuration & Attempt Initialization', async (t) => {
  // 1. Authenticate Admin
  const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin', username: 'azzikra', password: '4dm1n123' })
  });
  assert.equal(adminLoginRes.status, 200);
  const adminCookie = adminLoginRes.headers.get('set-cookie')?.split(';')[0] || '';

  // 2. Verify /api/test returns Speaking with its configured durationMinutes
  const testRes = await fetch(`${baseUrl}/api/test`);
  assert.equal(testRes.status, 200);
  const testData = await testRes.json();
  const speakingSection = (testData.sections || []).find(s => s.id === 'speaking');
  assert.ok(speakingSection, 'Speaking section must exist in /api/test');
  assert.equal(speakingSection.durationMinutes, 20, 'Speaking section must have durationMinutes: 20');

  // 3. Clean up any existing attempt for test teacher
  const teacherEmail = 'azzikra.syani@karyabangsa.sch.id';
  const teacherUnit = 'SMK KARYA BANGSA';
  const teacherName = 'Muhammad Azzikra Syani';

  const existingRes = await fetch(`${baseUrl}/api/admin/results`, { headers: { Cookie: adminCookie } });
  const existingData = await existingRes.json();
  for (const att of (existingData.results || []).filter(r => (r.email || '').toLowerCase() === teacherEmail.toLowerCase())) {
    await fetch(`${baseUrl}/api/admin/results/${att.id}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
  }

  // 4. Authenticate candidate
  const candidateLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'teacher',
      email: teacherEmail,
      unit: teacherUnit,
      name: teacherName
    })
  });
  assert.equal(candidateLoginRes.status, 200);
  const candidateCookie = candidateLoginRes.headers.get('set-cookie')?.split(';')[0] || '';

  let createdAttemptId = null;

  try {
    // 5. Start Assessment
    const startRes = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: { Cookie: candidateCookie }
    });
    assert.equal(startRes.status, 201);
    const startData = await startRes.json();
    createdAttemptId = startData.attempt?.id;
    assert.ok(createdAttemptId, 'Attempt must be created');

    // 6. Verify sectionRemainingMs for Speaking section (index 2) is 20 minutes (1,200,000 ms), NOT 15 minutes (900,000 ms)
    const speakingRemainingMs = startData.attempt?.sectionRemainingMs?.[2] || startData.attempt?.sectionRemainingMs?.['2'];
    assert.equal(
      speakingRemainingMs,
      20 * 60 * 1000,
      `Speaking section remaining time must be initialized to 20 minutes (1200000 ms), got: ${speakingRemainingMs}`
    );

    // Section 0 (Grammar) must be 30 minutes
    assert.equal(startData.attempt?.sectionRemainingMs?.[0], 30 * 60 * 1000);
    // Section 1 (Writing) must be 20 minutes
    assert.equal(startData.attempt?.sectionRemainingMs?.[1], 20 * 60 * 1000);

  } finally {
    if (createdAttemptId) {
      await fetch(`${baseUrl}/api/admin/results/${createdAttemptId}`, {
        method: 'DELETE',
        headers: { Cookie: adminCookie }
      });
    }
  }
});
