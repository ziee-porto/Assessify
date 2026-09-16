import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateWritingWithGemini,
  evaluateSpeakingWithGemini,
  testGeminiConnection
} from '../src/gemini-evaluator.js';

const baseUrl = process.env.BASE_URL || ('http://localhost:' + (process.env.PORT || 3000));

describe('Google Gemini AI Evaluator Module', () => {
  it('returns graceful error when testing connection without API key', async () => {
    const result = await testGeminiConnection('', 'gemini-1.5-flash');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('GEMINI_API_KEY'));
  });

  it('handles empty writing candidate response gracefully', async () => {
    const res = await evaluateWritingWithGemini({
      apiKey: 'dummy_key',
      model: 'gemini-1.5-flash',
      attempt: { responses: {} },
      rubrics: { writing: { criteria: [] } },
      questions: {}
    });

    assert.deepStrictEqual(res.scores, {});
    assert.ok(res.feedback.includes('No candidate writing submission'));
    assert.ok(Array.isArray(res.improvements));
  });

  it('handles missing speaking recording file gracefully', async () => {
    const res = await evaluateSpeakingWithGemini({
      apiKey: 'dummy_key',
      model: 'gemini-1.5-flash',
      attempt: { id: 'non-existent-attempt-id' },
      rubrics: { speaking: { criteria: [] } },
      uploadsDir: './uploads/recordings'
    });

    assert.deepStrictEqual(res.scores, {});
    assert.ok(res.feedback.includes('No audio/video recording file found'));
  });
});

describe('AI Grading & Settings HTTP Endpoints', () => {
  let adminCookie = '';

  before(async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', username: 'azzikra', password: '4dm1n123' })
    });
    if (loginRes.status === 200) {
      adminCookie = loginRes.headers.get('set-cookie') || '';
    }
  });

  it('rejects unauthenticated access to /api/admin/ai-settings', async () => {
    const res = await fetch(`${baseUrl}/api/admin/ai-settings`);
    assert.strictEqual(res.status, 403);
  });

  it('returns AI settings status to authenticated admin', async () => {
    if (!adminCookie) return;
    const res = await fetch(`${baseUrl}/api/admin/ai-settings`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(typeof data.configured, 'boolean');
    assert.ok(data.model);
  });

  it('rejects unauthenticated access to /api/admin/ai-settings/test', async () => {
    const res = await fetch(`${baseUrl}/api/admin/ai-settings/test`, { method: 'POST' });
    assert.strictEqual(res.status, 403);
  });

  it('rejects AI grade request for non-existent attempt', async () => {
    if (!adminCookie) return;
    const res = await fetch(`${baseUrl}/api/admin/results/non-existent-9999/ai-grade`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie }
    });
    assert.ok([400, 404].includes(res.status));
  });
});
