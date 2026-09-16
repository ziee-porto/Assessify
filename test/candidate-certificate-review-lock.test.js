import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL || ('http://localhost:' + (process.env.PORT || 3000));

test('Candidate Certificate Review Lock Lifecycle', async (t) => {
  // 1. Authenticate Admin
  const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin', username: 'azzikra', password: '4dm1n123' })
  });
  assert.equal(adminLoginRes.status, 200);
  const adminCookie = adminLoginRes.headers.get('set-cookie')?.split(';')[0] || '';

  // 2. Look up authorized teacher and authenticate
  const teacherEmail = 'azzikra.syani@karyabangsa.sch.id';
  const teacherUnit = 'SMK KARYA BANGSA';
  const teacherName = 'Muhammad Azzikra Syani';

  // Clean up any existing attempt for this teacher first
  const existingAttemptsRes = await fetch(`${baseUrl}/api/admin/results`, { headers: { Cookie: adminCookie } });
  const existingData = await existingAttemptsRes.json();
  const existingAttempts = (existingData.results || []).filter(r => (r.email || '').toLowerCase() === teacherEmail.toLowerCase());
  for (const att of existingAttempts) {
    await fetch(`${baseUrl}/api/admin/results/${att.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie }
    });
  }

  // Teacher Login
  const teacherLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'teacher',
      email: teacherEmail,
      unit: teacherUnit,
      name: teacherName
    })
  });
  assert.equal(teacherLoginRes.status, 200);
  const teacherCookie = teacherLoginRes.headers.get('set-cookie')?.split(';')[0] || '';

  let createdAttemptId = null;

  try {
    // 3. Start Assessment
    const startRes = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: { Cookie: teacherCookie }
    });
    assert.equal(startRes.status, 201);
    const startData = await startRes.json();
    createdAttemptId = startData.attempt?.id;
    assert.ok(createdAttemptId, 'Attempt should be created');

    // 4. Submit Assessment (Grammar scored, Writing & Speaking pending review)
    const submitRes = await fetch(`${baseUrl}/api/attempts/${createdAttemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: teacherCookie },
      body: JSON.stringify({
        responses: { 'g-1': 'option-1' },
        writing: 'Sample student placement essay response.',
        speaking: 'Sample speaking transcript.'
      })
    });
    assert.equal(submitRes.status, 200);
    const submitData = await submitRes.json();
    assert.equal(submitData.attempt?.status, 'Completed');
    assert.equal(submitData.attempt?.review, 'Writing and Speaking review required');

    // 5. Candidate queries /api/attempts/me and confirms completedAttempt has pending review
    const meRes = await fetch(`${baseUrl}/api/attempts/me`, { headers: { Cookie: teacherCookie } });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.hasCompleted, true);
    assert.equal(meData.completedAttempt?.review, 'Writing and Speaking review required');

    // 6. CANDIDATE ATTEMPTS TO DOWNLOAD CERTIFICATE WHILE PENDING REVIEW
    // Should be STRICTLY BLOCKED (403 Forbidden)
    const lockedCertRes = await fetch(`${baseUrl}/api/attempts/${createdAttemptId}/certificate`, {
      headers: { Cookie: teacherCookie }
    });
    assert.equal(lockedCertRes.status, 403, 'Candidate download must be rejected while review is pending');
    const lockedError = await lockedCertRes.json();
    assert.match(lockedError.error, /locked pending Writing and Speaking/i);

    // 7. Admin can still inspect/download certificate anytime
    const adminCertRes = await fetch(`${baseUrl}/api/attempts/${createdAttemptId}/certificate`, {
      headers: { Cookie: adminCookie }
    });
    assert.equal(adminCertRes.status, 200, 'Admin can access certificate at any stage');

    // 8. Evaluator completes Writing & Speaking evaluation via /api/admin/results/:id/review
    const reviewRes = await fetch(`${baseUrl}/api/admin/results/${createdAttemptId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        writing: {
          'Task Achievement': 4,
          'Coherence & Cohesion': 4,
          'Lexical Resource': 4,
          'Grammatical Range & Accuracy': 4
        },
        speaking: {
          'Fluency & Coherence': 4,
          'Lexical Resource': 4,
          'Grammatical Range & Accuracy': 4,
          'Pronunciation': 4
        }
      })
    });
    assert.equal(reviewRes.status, 200);
    const reviewData = await reviewRes.json();
    assert.ok(reviewData.manualReview);

    // Verify /api/attempts/me now reflects 'Teacher reviewed'
    const meAfterRes = await fetch(`${baseUrl}/api/attempts/me`, { headers: { Cookie: teacherCookie } });
    const meAfterData = await meAfterRes.json();
    assert.equal(meAfterData.completedAttempt?.review, 'Teacher reviewed');

    // 9. CANDIDATE ATTEMPTS TO DOWNLOAD CERTIFICATE AFTER REVIEW COMPLETE
    // Must now SUCCEED (200 OK with application/pdf)
    const unlockedCertRes = await fetch(`${baseUrl}/api/attempts/${createdAttemptId}/certificate`, {
      headers: { Cookie: teacherCookie }
    });
    assert.equal(unlockedCertRes.status, 200, 'Candidate must now be allowed to download certificate');
    assert.equal(unlockedCertRes.headers.get('content-type'), 'application/pdf');
    const pdfBuf = Buffer.from(await unlockedCertRes.arrayBuffer());
    assert.equal(pdfBuf.slice(0, 5).toString('ascii'), '%PDF-');

  } finally {
    // 10. Clean up attempt
    if (createdAttemptId) {
      await fetch(`${baseUrl}/api/admin/results/${createdAttemptId}`, {
        method: 'DELETE',
        headers: { Cookie: adminCookie }
      });
    }
  }
});
