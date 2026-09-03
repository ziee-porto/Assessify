import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = 'http://localhost:3001';

describe('User Manager & Authorized Teachers API', () => {
  let adminCookie = '';
  const testEmail = 'automated.test.teacher@karyabangsa.sch.id';
  let createdTeacherId = null;

  it('authenticates admin and obtains session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', username: 'azzikra', password: '4dm1n123' })
    });
    assert.strictEqual(res.status, 200);
    adminCookie = res.headers.get('set-cookie');
    assert.ok(adminCookie, 'Should receive session cookie');
  });

  it('rejects unauthorized non-admin access to teacher management', async () => {
    const res = await fetch(`${baseUrl}/api/admin/teachers`);
    assert.strictEqual(res.status, 403);
  });

  it('lists authorized teachers for admin with total count', async () => {
    const res = await fetch(`${baseUrl}/api/admin/teachers`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.teachers));
    assert.ok(data.teachers.length >= 50, `Expected at least 50 teachers, got ${data.teachers.length}`);
    assert.ok(data.total >= 50);
  });

  it('rejects adding a teacher with invalid email domain', async () => {
    const res = await fetch(`${baseUrl}/api/admin/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        name: 'Invalid Domain Teacher',
        email: 'invalid@gmail.com',
        unit: 'SD KARYA BANGSA'
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /@karyabangsa\.sch\.id/);
  });

  it('successfully creates a new authorized educator', async () => {
    const res = await fetch(`${baseUrl}/api/admin/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        name: 'Budi Test Teacher, M.Pd.',
        email: testEmail,
        unit: 'SD KARYA BANGSA'
      })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.teacher);
    assert.strictEqual(data.teacher.email, testEmail);
    assert.strictEqual(data.teacher.unit, 'SD KARYA BANGSA');
    createdTeacherId = data.teacher.id;
    assert.ok(createdTeacherId);
  });

  it('verifies newly created educator is found by teacher-lookup API', async () => {
    const res = await fetch(`${baseUrl}/api/auth/teacher-lookup?email=${encodeURIComponent(testEmail)}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.found, true);
    assert.strictEqual(data.email, testEmail);
    assert.strictEqual(data.unit, 'SD KARYA BANGSA');
    assert.strictEqual(data.name, 'Budi Test Teacher, M.Pd.');
  });

  it('rejects creating a duplicate educator with the same email', async () => {
    const res = await fetch(`${baseUrl}/api/admin/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        name: 'Another Teacher',
        email: testEmail,
        unit: 'SMP KARYA BANGSA'
      })
    });
    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.match(data.error, /already registered/);
  });

  it('updates educator details (name and unit)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/teachers/${createdTeacherId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        name: 'Budi Test Teacher Updated, Dr.',
        email: testEmail,
        unit: 'SMP KARYA BANGSA'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.teacher.name, 'Budi Test Teacher Updated, Dr.');
    assert.strictEqual(data.teacher.unit, 'SMP KARYA BANGSA');
  });

  it('verifies teacher-lookup returns updated unit and name', async () => {
    const res = await fetch(`${baseUrl}/api/auth/teacher-lookup?email=${encodeURIComponent(testEmail)}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.unit, 'SMP KARYA BANGSA');
    assert.strictEqual(data.name, 'Budi Test Teacher Updated, Dr.');
  });

  it('deletes the test educator from the roster', async () => {
    const res = await fetch(`${baseUrl}/api/admin/teachers/${createdTeacherId}`, {
      method: 'DELETE',
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  it('verifies deleted educator is no longer found in teacher-lookup', async () => {
    const res = await fetch(`${baseUrl}/api/auth/teacher-lookup?email=${encodeURIComponent(testEmail)}`);
    assert.strictEqual(res.status, 404);
  });

  // ── Admin Accounts & Role Management ──────────────────────────────────
  let createdAdminId = null;

  it('lists administrators including azzikra and refka', async () => {
    const res = await fetch(`${baseUrl}/api/admin/admins`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.admins));
    assert.ok(data.admins.length >= 2, 'Should have at least azzikra and refka');
    const usernames = data.admins.map((a) => a.username.toLowerCase());
    assert.ok(usernames.includes('azzikra'), 'Should include azzikra');
    assert.ok(usernames.includes('refka'), 'Should include refka');
  });

  it('creates a new administrator account', async () => {
    const res = await fetch(`${baseUrl}/api/admin/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        username: 'sarah_admin',
        password: 'Password123!',
        name: 'Sarah Admin Test',
        email: 'sarah.admin@karyabangsa.sch.id'
      })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.admin.username, 'sarah_admin');
    assert.strictEqual(data.admin.name, 'Sarah Admin Test');
    createdAdminId = data.admin.id;
    assert.ok(createdAdminId);
  });

  it('allows logging in with newly created administrator credentials', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'admin',
        username: 'sarah_admin',
        password: 'Password123!'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.user.role, 'admin');
    assert.strictEqual(data.user.username, 'sarah_admin');
    assert.strictEqual(data.user.name, 'Sarah Admin Test');
  });

  it('updates administrator details', async () => {
    const res = await fetch(`${baseUrl}/api/admin/admins/${createdAdminId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        name: 'Sarah Admin Senior',
        email: 'sarah.senior@karyabangsa.sch.id'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.admin.name, 'Sarah Admin Senior');
  });

  it('fetches unified users endpoint (both teachers and admins)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.total >= 52);
    assert.ok(data.teachersCount >= 50);
    assert.ok(data.adminsCount >= 3);
  });

  it('deletes the test administrator account', async () => {
    const res = await fetch(`${baseUrl}/api/admin/admins/${createdAdminId}`, {
      method: 'DELETE',
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  it('verifies deleted admin can no longer log in', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'admin',
        username: 'sarah_admin',
        password: 'Password123!'
      })
    });
    assert.strictEqual(res.status, 401);
  });

  it('updates teacher status to suspended and blocks assessment login', async () => {
    // 1. Get first teacher
    const listRes = await fetch(`${baseUrl}/api/admin/teachers`, {
      headers: { 'Cookie': adminCookie }
    });
    const listData = await listRes.json();
    const targetTeacher = listData.teachers[0];

    // 2. Suspend teacher
    const suspRes = await fetch(`${baseUrl}/api/admin/teachers/${targetTeacher.id}/status`, {
      method: 'PUT',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'suspended' })
    });
    assert.strictEqual(suspRes.status, 200);

    // 3. Attempt candidate login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'teacher',
        email: targetTeacher.email,
        unit: targetTeacher.unit,
        fullName: targetTeacher.name
      })
    });
    assert.strictEqual(loginRes.status, 403);
    const loginData = await loginRes.json();
    assert.match(loginData.error, /suspended/i);

    // 4. Reactivate teacher
    const reactRes = await fetch(`${baseUrl}/api/admin/teachers/${targetTeacher.id}/status`, {
      method: 'PUT',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' })
    });
    assert.strictEqual(reactRes.status, 200);
  });

  it('supports bulk status update for multiple users', async () => {
    const listRes = await fetch(`${baseUrl}/api/admin/teachers`, {
      headers: { 'Cookie': adminCookie }
    });
    const listData = await listRes.json();
    const t1 = listData.teachers[0];
    const t2 = listData.teachers[1];

    const bulkRes = await fetch(`${baseUrl}/api/admin/users/bulk-status`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targets: [
          { id: t1.id, role: 'candidate' },
          { id: t2.id, role: 'candidate' }
        ],
        status: 'archived'
      })
    });
    assert.strictEqual(bulkRes.status, 200);
    const bulkData = await bulkRes.json();
    assert.strictEqual(bulkData.success, true);
    assert.strictEqual(bulkData.updatedCount, 2);

    // Restore to active
    await fetch(`${baseUrl}/api/admin/users/bulk-status`, {
      method: 'POST',
      headers: { 'Cookie': adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targets: [
          { id: t1.id, role: 'candidate' },
          { id: t2.id, role: 'candidate' }
        ],
        status: 'active'
      })
    });
  });
});
