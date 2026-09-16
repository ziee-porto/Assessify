import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL || ('http://localhost:' + (process.env.PORT || 3000));

describe('Anti-Cheat Direct Test Integration Engine', () => {
  const teacher = {
    email: 'anggra@karyabangsa.sch.id',
    fullName: 'Anggra Novita Sari',
    unit: 'SMA KARYA BANGSA'
  };

  let adminCookie = '';
  let teacherCookie = '';
  let attemptId = '';

  it('authenticates admin and verifies session, cleaning up previous attempts', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', username: 'azzikra', password: '4dm1n123' })
    });
    assert.strictEqual(res.status, 200);
    adminCookie = res.headers.get('set-cookie');
    assert.ok(adminCookie, 'Admin session cookie should be returned');

    // Clean up attempts for test teacher to avoid single assessment block
    const resultsRes = await fetch(`${baseUrl}/api/admin/results`, { headers: { 'Cookie': adminCookie } });
    if (resultsRes.status === 200) {
      const data = await resultsRes.json();
      const existing = data.results || [];
      for (const att of existing.filter((a) => (a.email || '').toLowerCase().trim() === teacher.email.toLowerCase().trim())) {
        await fetch(`${baseUrl}/api/admin/results/${att.id}`, { method: 'DELETE', headers: { 'Cookie': adminCookie } });
      }
    }
  });

  it('serves anti-cheat settings on public-settings', async () => {
    const res = await fetch(`${baseUrl}/api/public-settings`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.antiCheat, 'antiCheat should exist in public settings');
    assert.strictEqual(typeof data.antiCheat.tabSwitchDetection, 'boolean');
    assert.strictEqual(typeof data.antiCheat.requireFullscreen, 'boolean');
    assert.strictEqual(typeof data.antiCheat.splitScreenDetection, 'boolean');
    assert.strictEqual(typeof data.antiCheat.blockDevTools, 'boolean');
    assert.strictEqual(typeof data.antiCheat.blockCopyPaste, 'boolean');
  });

  it('allows admin to fetch and update anti-cheat settings', async () => {
    const getRes = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert.ok(getData.settings.antiCheat, 'Settings should contain antiCheat');

    const putRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        antiCheat: {
          enabled: true,
          tabSwitchDetection: true,
          requireFullscreen: true,
          splitScreenDetection: true,
          blockDevTools: true,
          blockCopyPaste: true
        }
      })
    });
    assert.strictEqual(putRes.status, 200);
    const putData = await putRes.json();
    assert.strictEqual(putData.settings.antiCheat.tabSwitchDetection, true);
    assert.strictEqual(putData.settings.antiCheat.requireFullscreen, true);
  });


  it('authenticates teacher and starts attempt with initialized anti-cheat', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'teacher',
        ...teacher
      })
    });
    assert.strictEqual(loginRes.status, 200);
    teacherCookie = loginRes.headers.get('set-cookie');
    assert.ok(teacherCookie);

    const attemptRes = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: {
        'Cookie': teacherCookie,
        'Content-Type': 'application/json'
      }
    });
    assert.ok([200, 201].includes(attemptRes.status));
    const attemptData = await attemptRes.json();
    assert.ok(attemptData.attempt && attemptData.attempt.id, 'Attempt ID should be present');
    attemptId = attemptData.attempt.id;

    assert.ok(attemptData.attempt.antiCheat, 'Attempt should have antiCheat initialized');
    assert.strictEqual(attemptData.attempt.antiCheat.tabSwitches, 0);
    assert.strictEqual(attemptData.attempt.antiCheat.fullscreenExits, 0);
    assert.strictEqual(attemptData.attempt.antiCheat.splitScreenDetections, 0);
    assert.strictEqual(attemptData.attempt.antiCheat.devToolsAttempts, 0);
    assert.strictEqual(attemptData.attempt.antiCheat.copyPasteAttempts, 0);
    assert.strictEqual(attemptData.attempt.antiCheat.totalCount, 0);
  });

  it('records real-time anti-cheat violation events', async () => {
    const eventRes1 = await fetch(`${baseUrl}/api/attempts/${attemptId}/anti-cheat-event`, {
      method: 'POST',
      headers: {
        'Cookie': teacherCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'TAB_SWITCH',
        message: 'Kandidat beralih tab atau minimize window',
        details: { section: 'Grammar' }
      })
    });
    assert.strictEqual(eventRes1.status, 200);
    const resData1 = await eventRes1.json();
    assert.strictEqual(resData1.antiCheat.tabSwitches, 1);
    assert.strictEqual(resData1.antiCheat.totalCount, 1);

    const eventRes2 = await fetch(`${baseUrl}/api/attempts/${attemptId}/anti-cheat-event`, {
      method: 'POST',
      headers: {
        'Cookie': teacherCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'FULLSCREEN_EXIT',
        message: 'Kandidat keluar dari mode fullscreen',
        details: { section: 'Writing' }
      })
    });
    assert.strictEqual(eventRes2.status, 200);
    const resData2 = await eventRes2.json();
    assert.strictEqual(resData2.antiCheat.fullscreenExits, 1);
    assert.strictEqual(resData2.antiCheat.totalCount, 2);

    const eventRes3 = await fetch(`${baseUrl}/api/attempts/${attemptId}/anti-cheat-event`, {
      method: 'POST',
      headers: {
        'Cookie': teacherCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'DEVTOOLS_ATTEMPT',
        message: 'Kandidat mencoba membuka Developer Tools (F12)',
        details: { key: 'F12' }
      })
    });
    assert.strictEqual(eventRes3.status, 200);
    const resData3 = await eventRes3.json();
    assert.strictEqual(resData3.antiCheat.devToolsAttempts, 1);
    assert.strictEqual(resData3.antiCheat.totalCount, 3);
  });

  it('verifies audit log contains recorded anti-cheat violations', async () => {
    const auditRes = await fetch(`${baseUrl}/api/admin/audit-logs?category=SECURITY`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(auditRes.status, 200);
    const auditData = await auditRes.json();
    assert.ok(Array.isArray(auditData.logs), 'Logs should be an array');
    const acLogs = auditData.logs.filter(l => (l.action || '').startsWith('ANTI_CHEAT_'));
    assert.ok(acLogs.length >= 3, `Expected >= 3 anti-cheat logs, got ${acLogs.length}`);
    assert.ok(acLogs.some(l => l.action === 'ANTI_CHEAT_TAB_SWITCH'));
    assert.ok(acLogs.some(l => l.action === 'ANTI_CHEAT_FULLSCREEN_EXIT'));
    assert.ok(acLogs.some(l => l.action === 'ANTI_CHEAT_DEVTOOLS_ATTEMPT'));
  });

  it('persists anti-cheat state on draft save', async () => {
    const draftRes = await fetch(`${baseUrl}/api/attempts/${attemptId}/draft`, {
      method: 'POST',
      headers: {
        'Cookie': teacherCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        responses: { 0: 'a' },
        antiCheat: {
          totalCount: 3,
          tabSwitches: 1,
          fullscreenExits: 1,
          splitScreenDetections: 0,
          devToolsAttempts: 1,
          copyPasteAttempts: 0
        }
      })
    });
    assert.strictEqual(draftRes.status, 200);
    const draftData = await draftRes.json();
    assert.strictEqual(draftData.success, true);

    const meRes = await fetch(`${baseUrl}/api/attempts/me`, {
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.ok(meData.inProgressAttempt?.antiCheat);
    assert.strictEqual(meData.inProgressAttempt.antiCheat.totalCount, 3);
  });

  it('verifies anti-cheat reflects disabled state when admin disables it', async () => {
    // Admin disables all anti-cheat rules
    const putRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        antiCheat: {
          enabled: false,
          tabSwitchDetection: false,
          requireFullscreen: false,
          splitScreenDetection: false,
          blockDevTools: false,
          blockCopyPaste: false
        }
      })
    });
    assert.strictEqual(putRes.status, 200);

    // Status endpoint should report disabled
    const statusRes = await fetch(`${baseUrl}/api/attempts/${attemptId}/status`, {
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.strictEqual(statusData.antiCheat?.enabled, false);

    // Me endpoint should report disabled
    const meRes = await fetch(`${baseUrl}/api/attempts/me`, {
      headers: { 'Cookie': teacherCookie }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.inProgressAttempt?.antiCheat?.enabled, false);
  });

  it('cleans up test attempt', async () => {
    if (attemptId) {
      const delAttemptRes = await fetch(`${baseUrl}/api/admin/results/${attemptId}`, {
        method: 'DELETE',
        headers: { 'Cookie': adminCookie }
      });
      assert.strictEqual(delAttemptRes.status, 200);
    }
  });
});

