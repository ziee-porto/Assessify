import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL || ('http://localhost:' + (process.env.PORT || 3000));

describe('Grammar & Vocabulary Question Scrambling Engine', () => {
  const teacher1 = {
    email: 'elma@karyabangsa.sch.id',
    fullName: 'Elma Sanditia',
    unit: 'SMA KARYA BANGSA'
  };

  const teacher2 = {
    email: 'anggra@karyabangsa.sch.id',
    fullName: 'Anggra Novita Sari',
    unit: 'SMA KARYA BANGSA'
  };

  let teacher1Cookie = '';
  let teacher2Cookie = '';
  let adminCookie = '';

  it('authenticates admin and obtains session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', username: 'azzikra', password: '4dm1n123' })
    });
    assert.strictEqual(res.status, 200);
    adminCookie = res.headers.get('set-cookie');
    assert.ok(adminCookie);
  });

  it('serves canonical unscrambled questions for admin / unauthenticated /api/test', async () => {
    const unauthRes = await fetch(`${baseUrl}/api/test`);
    assert.strictEqual(unauthRes.status, 200);
    const unauthTest = await unauthRes.json();
    const gvUnauth = unauthTest.sections.find((s) => s.id === 'grammar-vocabulary');
    assert.ok(gvUnauth);
    assert.strictEqual(gvUnauth.questions.length, 50);

    const adminRes = await fetch(`${baseUrl}/api/test`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(adminRes.status, 200);
    const adminTest = await adminRes.json();
    const gvAdmin = adminTest.sections.find((s) => s.id === 'grammar-vocabulary');
    assert.ok(gvAdmin);

    // Both should match canonical order
    assert.deepStrictEqual(
      gvUnauth.questions.map((q) => q.id),
      gvAdmin.questions.map((q) => q.id)
    );
  });

  it('authenticates two different candidate teachers', async () => {
    const res1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'teacher', ...teacher1 })
    });
    assert.strictEqual(res1.status, 200);
    teacher1Cookie = res1.headers.get('set-cookie');
    assert.ok(teacher1Cookie);

    const res2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'teacher', ...teacher2 })
    });
    assert.strictEqual(res2.status, 200);
    teacher2Cookie = res2.headers.get('set-cookie');
    assert.ok(teacher2Cookie);
  });

  it('scrambles Grammar & Vocabulary questions uniquely for each candidate', async () => {
    // 1. Fetch questions for Candidate 1
    const res1 = await fetch(`${baseUrl}/api/test`, {
      headers: { 'Cookie': teacher1Cookie }
    });
    assert.strictEqual(res1.status, 200);
    const test1 = await res1.json();
    const gv1 = test1.sections.find((s) => s.id === 'grammar-vocabulary');
    assert.ok(gv1);
    assert.strictEqual(gv1.questions.length, 50);

    // 2. Fetch questions for Candidate 2
    const res2 = await fetch(`${baseUrl}/api/test`, {
      headers: { 'Cookie': teacher2Cookie }
    });
    assert.strictEqual(res2.status, 200);
    const test2 = await res2.json();
    const gv2 = test2.sections.find((s) => s.id === 'grammar-vocabulary');
    assert.ok(gv2);
    assert.strictEqual(gv2.questions.length, 50);

    const order1 = gv1.questions.map((q) => q.id);
    const order2 = gv2.questions.map((q) => q.id);

    // Ensure all 50 questions are unique and complete for both candidates
    assert.strictEqual(new Set(order1).size, 50, 'Candidate 1 should have 50 unique questions');
    assert.strictEqual(new Set(order2).size, 50, 'Candidate 2 should have 50 unique questions');

    // Canonical order for comparison
    const unauthRes = await fetch(`${baseUrl}/api/test`);
    const canonicalOrder = (await unauthRes.json()).sections.find((s) => s.id === 'grammar-vocabulary').questions.map((q) => q.id);

    // Candidate 1's order must be scrambled relative to canonical
    assert.notDeepStrictEqual(order1, canonicalOrder, 'Candidate 1 should receive a scrambled order');

    // Candidate 2's order must be scrambled relative to canonical
    assert.notDeepStrictEqual(order2, canonicalOrder, 'Candidate 2 should receive a scrambled order');

    // Candidate 1 and Candidate 2 must receive DIFFERENT scrambles
    assert.notDeepStrictEqual(order1, order2, 'Candidate 1 and Candidate 2 must receive different scrambles');
  });

  it('maintains deterministic and stable order on page refresh / reconnection', async () => {
    // Fetch multiple times for Candidate 1
    const res1 = await fetch(`${baseUrl}/api/test`, { headers: { 'Cookie': teacher1Cookie } });
    const test1 = await res1.json();
    const order1 = test1.sections.find((s) => s.id === 'grammar-vocabulary').questions.map((q) => q.id);

    const res2 = await fetch(`${baseUrl}/api/test`, { headers: { 'Cookie': teacher1Cookie } });
    const test2 = await res2.json();
    const order2 = test2.sections.find((s) => s.id === 'grammar-vocabulary').questions.map((q) => q.id);

    assert.deepStrictEqual(order1, order2, 'Candidate 1 should receive the exact same scramble on repeated requests');
  });

  it('stores scrambled grammarVocabularyOrder on created attempt', async () => {
    // Clean up any existing attempts for teacher 1
    const resultsRes = await fetch(`${baseUrl}/api/admin/results`, { headers: { 'Cookie': adminCookie } });
    const existing = (await resultsRes.json()).results || [];
    for (const att of existing.filter((a) => (a.email || '').toLowerCase().trim() === teacher1.email)) {
      await fetch(`${baseUrl}/api/admin/results/${att.id}`, { method: 'DELETE', headers: { 'Cookie': adminCookie } });
    }

    // Start attempt for teacher 1
    const startRes = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: { 'Cookie': teacher1Cookie }
    });
    assert.ok([200, 201].includes(startRes.status));
    const startData = await startRes.json();
    const attempt = startData.attempt;

    assert.ok(Array.isArray(attempt.grammarVocabularyOrder), 'Attempt should contain grammarVocabularyOrder array');
    assert.strictEqual(attempt.grammarVocabularyOrder.length, 50, 'Attempt should have all 50 questions recorded in order');

    // Clean up
    await fetch(`${baseUrl}/api/admin/results/${attempt.id}`, { method: 'DELETE', headers: { 'Cookie': adminCookie } });
  });

  it('correctly scores candidate responses keyed to scrambled question IDs upon submission', async () => {
    // Start attempt for teacher 1
    const startRes = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: { 'Cookie': teacher1Cookie }
    });
    const startData = await startRes.json();
    const attemptId = startData.attempt.id;

    // Get scrambled questions for teacher 1
    const testRes = await fetch(`${baseUrl}/api/test`, { headers: { 'Cookie': teacher1Cookie } });
    const testData = await testRes.json();
    const gvQuestions = testData.sections.find((s) => s.id === 'grammar-vocabulary').questions;

    // Get canonical answer bank from content file to build a known test answer set
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
    const bank = JSON.parse(await readFile(join(root, 'content', 'ielts-placement.json'), 'utf8'));
    const bankGv = bank.sections.find((s) => s.id === 'grammar-vocabulary');
    const answerMap = new Map(bankGv.questions.map((q) => [q.id, q.answer]));

    // Candidate answers the first 45 questions according to their scrambled order correctly
    const responses = {};
    for (let i = 0; i < 45; i++) {
      const q = gvQuestions[i];
      responses[q.id] = answerMap.get(q.id);
    }
    // And answers the last 5 with a wrong answer
    for (let i = 45; i < 50; i++) {
      const q = gvQuestions[i];
      responses[q.id] = 'WRONG_ANSWER_TEST';
    }

    // Submit assessment
    const submitRes = await fetch(`${baseUrl}/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': teacher1Cookie },
      body: JSON.stringify({
        responses,
        writing: 'Test essay response...',
        speakingRecording: null
      })
    });
    assert.strictEqual(submitRes.status, 200);
    const submitData = await submitRes.json();

    // Verify 45/50 correct answers were scored precisely
    assert.strictEqual(submitData.attempt.scoring.grammarVocabulary.correct, 45);
    assert.strictEqual(submitData.attempt.scoring.grammarVocabulary.total, 50);
    assert.strictEqual(submitData.attempt.sectionScores['Grammar & Vocabulary'], 'C1');

    // Clean up
    await fetch(`${baseUrl}/api/admin/results/${attemptId}`, { method: 'DELETE', headers: { 'Cookie': adminCookie } });
  });
});
