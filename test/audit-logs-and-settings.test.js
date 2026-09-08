import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = 'http://localhost:3001';

describe('Security Audit Log & System Settings Engine', () => {
  let adminCookie = '';
  let teacherCookie = '';
  const testTeacherEmail = 'refka@karyabangsa.sch.id';

  it('authenticates admin and verifies session', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', username: 'azzikra', password: '4dm1n123' })
    });
    assert.strictEqual(res.status, 200);
    adminCookie = res.headers.get('set-cookie');
    assert.ok(adminCookie, 'Admin session cookie should be returned');
  });

  it('serves public settings to candidates without credentials', async () => {
    const res = await fetch(`${baseUrl}/api/public-settings`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.schoolName, 'Karya Bangsa School');
    assert.strictEqual(data.schoolDomain, 'karyabangsa.sch.id');
    assert.strictEqual(typeof data.durationMinutes, 'number');
    assert.strictEqual(typeof data.maintenanceMode, 'boolean');
  });

  it('rejects unauthenticated access to admin settings and audit logs', async () => {
    const settingsRes = await fetch(`${baseUrl}/api/admin/settings`);
    assert.strictEqual(settingsRes.status, 401);

    const auditRes = await fetch(`${baseUrl}/api/admin/audit-logs`);
    assert.strictEqual(auditRes.status, 401);
  });

  it('fetches system settings for authorized administrator', async () => {
    const res = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.settings, 'Settings object should exist');
    assert.strictEqual(data.settings.schoolName, 'Karya Bangsa School');
    assert.ok(data.storageMode, 'Storage mode should be reported');
  });

  it('updates system settings and persists new configurations', async () => {
    const updatePayload = {
      durationMinutes: 70,
      passingBand: '7.0',
      schoolName: 'Karya Bangsa International School'
    };

    const updateRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify(updatePayload)
    });
    assert.strictEqual(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.strictEqual(updateData.settings.durationMinutes, 70);
    assert.strictEqual(updateData.settings.passingBand, '7.0');
    assert.strictEqual(updateData.settings.schoolName, 'Karya Bangsa International School');

    // Confirm via GET
    const verifyRes = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: { 'Cookie': adminCookie }
    });
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.settings.durationMinutes, 70);
  });

  it('fetches audit logs and verifies UPDATE_SYSTEM_SETTINGS was recorded', async () => {
    const res = await fetch(`${baseUrl}/api/admin/audit-logs?category=SYSTEM`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.logs), 'Logs should be an array');
    assert.ok(data.stats, 'Stats summary should be present');

    const updateLog = data.logs.find((l) => l.action === 'UPDATE_SYSTEM_SETTINGS');
    assert.ok(updateLog, 'An audit log for UPDATE_SYSTEM_SETTINGS should exist');
    assert.strictEqual(updateLog.actorType, 'admin');
    assert.strictEqual(updateLog.status, 'SUCCESS');
  });

  it('tests maintenance mode enforcement on candidate assessment flow', async () => {
    // 1. Enable maintenance mode
    const enableMaint = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        maintenanceMode: true,
        maintenanceMessage: 'System is currently undergoing test maintenance.'
      })
    });
    assert.strictEqual(enableMaint.status, 200);

    // 2. Teacher login attempt should be blocked with 503
    const teacherLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'teacher',
        email: 'anggra@karyabangsa.sch.id',
        unit: 'SMA KARYA BANGSA'
      })
    });
    assert.strictEqual(teacherLogin.status, 503);
    const loginErr = await teacherLogin.json();
    assert.ok(loginErr.error.includes('maintenance'), 'Should display maintenance message');

    // 3. Disable maintenance mode
    const disableMaint = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        maintenanceMode: false
      })
    });
    assert.strictEqual(disableMaint.status, 200);
  });

  it('records teacher authentication, test events, and user management in audit log', async () => {
    // 1. Teacher login successfully
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'teacher',
        email: 'anggra@karyabangsa.sch.id',
        unit: 'SMA KARYA BANGSA'
      })
    });
    assert.strictEqual(loginRes.status, 200);

    // 2. Admin creates a test educator
    const tempEmail = `audit.teacher.${Date.now()}@karyabangsa.sch.id`;
    const createTeacherRes = await fetch(`${baseUrl}/api/admin/teachers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        name: 'Audit Test Educator',
        email: tempEmail,
        unit: 'SMP KARYA BANGSA',
        status: 'active'
      })
    });
    assert.strictEqual(createTeacherRes.status, 201);
    const teacherData = await createTeacherRes.json();

    // 3. Admin deletes the test educator
    const deleteRes = await fetch(`${baseUrl}/api/admin/teachers/${teacherData.teacher.id}`, {
      method: 'DELETE',
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(deleteRes.status, 200);

    // 4. Verify audit log captures both CREATE_TEACHER and DELETE_TEACHER
    const auditRes = await fetch(`${baseUrl}/api/admin/audit-logs?category=USER_MGMT`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(auditRes.status, 200);
    const auditData = await auditRes.json();

    const hasCreate = auditData.logs.some((l) => l.action === 'CREATE_TEACHER' && l.target === tempEmail);
    const hasDelete = auditData.logs.some((l) => l.action === 'DELETE_TEACHER' && l.target === tempEmail);
    assert.ok(hasCreate, 'Audit log should record CREATE_TEACHER');
    assert.ok(hasDelete, 'Audit log should record DELETE_TEACHER');
  });

  it('exports audit logs as an Excel workbook (.xlsx)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/audit-logs/export`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(contentType.includes('spreadsheetml') || contentType.includes('octet-stream'), 'Content-Type should be spreadsheetml');
    const buffer = await res.arrayBuffer();
    assert.ok(buffer.byteLength > 100, 'Workbook buffer should contain data');
  });

  it('clears audit logs and ensures the clearance itself is logged as a security alert', async () => {
    const clearRes = await fetch(`${baseUrl}/api/admin/audit-logs/clear`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(clearRes.status, 200);

    // Fetch logs right after clear: exactly 1 log should exist (the CLEAR_AUDIT_LOGS entry)
    const afterClearRes = await fetch(`${baseUrl}/api/admin/audit-logs`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(afterClearRes.status, 200);
    const afterClearData = await afterClearRes.json();
    assert.strictEqual(afterClearData.logs.length, 1);
    assert.strictEqual(afterClearData.logs[0].action, 'CLEAR_AUDIT_LOGS');
    assert.strictEqual(afterClearData.logs[0].category, 'SECURITY');
    assert.strictEqual(afterClearData.logs[0].status, 'WARNING');
  });

  it('resets system settings back to institutional defaults', async () => {
    const resetRes = await fetch(`${baseUrl}/api/admin/settings/reset`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(resetRes.status, 200);
    const resetData = await resetRes.json();
    assert.strictEqual(resetData.settings.durationMinutes, 65);
    assert.strictEqual(resetData.settings.passingBand, '6.5');
    assert.strictEqual(resetData.settings.schoolName, 'Karya Bangsa School');
  });
});
