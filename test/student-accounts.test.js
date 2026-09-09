import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = 'http://localhost:3001';

describe('Student Accounts & Bulk Import API', () => {
  let adminCookie = '';
  const testStudentId = '2026999901';
  const testEmail = 'student.automated.test@karyabangsa.sch.id';
  let createdDbId = null;

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

  it('rejects unauthenticated access to /api/admin/students', async () => {
    const res = await fetch(`${baseUrl}/api/admin/students`);
    assert.strictEqual(res.status, 403);
  });

  it('creates a new student account', async () => {
    const res = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        name: 'Ahmad Siswa Test',
        email: testEmail,
        unit: 'SMA KARYA BANGSA',
        student_id: testStudentId,
        grade: 'Kelas 10-A',
        status: 'active'
      })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.student);
    assert.strictEqual(data.student.email, testEmail);
    assert.strictEqual(data.student.unit, 'SMA KARYA BANGSA');
    assert.strictEqual(data.student.student_id, testStudentId);
    createdDbId = data.student.id;
  });

  it('lists students and includes newly created student', async () => {
    const res = await fetch(`${baseUrl}/api/admin/students`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.students));
    const found = data.students.find((s) => s.email === testEmail);
    assert.ok(found, 'Created student should exist in list');
    assert.strictEqual(found.student_id, testStudentId);
  });

  it('updates student status to suspended', async () => {
    const res = await fetch(`${baseUrl}/api/admin/students/${createdDbId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({ status: 'suspended' })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.student.status, 'suspended');
  });

  it('performs bulk student import with multiple valid rows', async () => {
    const bulkList = [
      {
        student_id: '2026999902',
        name: 'Budi Bulk Student 1',
        email: 'budi.bulk1@karyabangsa.sch.id',
        unit: 'SMA KARYA BANGSA',
        grade: 'Kelas 11-IPA',
        status: 'active'
      },
      {
        student_id: '2026999903',
        name: 'Siti Bulk Student 2',
        email: 'siti.bulk2@karyabangsa.sch.id',
        unit: 'SMA KARYA BANGSA',
        grade: 'Kelas 11-IPA',
        status: 'active'
      }
    ];

    const res = await fetch(`${baseUrl}/api/admin/students/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        unit: 'SMA KARYA BANGSA',
        students: bulkList
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.total, 2);
    assert.ok(data.added >= 1);
  });

  it('looks up student via /api/auth/teacher-lookup and returns student details', async () => {
    const res = await fetch(`${baseUrl}/api/auth/teacher-lookup?email=${encodeURIComponent(testEmail)}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.found, true);
    assert.strictEqual(data.email, testEmail);
    assert.strictEqual(data.role, 'student');
    assert.strictEqual(data.unit, 'SMA KARYA BANGSA');
    assert.strictEqual(data.student_id, testStudentId);
  });

  it('blocks suspended student from logging in', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'teacher',
        email: testEmail,
        fullName: 'Ahmad Siswa Test',
        unit: 'SMA KARYA BANGSA'
      })
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.ok(data.error && data.error.includes('suspended'));
  });

  it('reactivates student account', async () => {
    const res = await fetch(`${baseUrl}/api/admin/students/${createdDbId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({ status: 'active' })
    });
    assert.strictEqual(res.status, 200);
  });

  it('rejects student login with unit mismatch', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'teacher',
        email: testEmail,
        fullName: 'Ahmad Siswa Test',
        unit: 'SMP KARYA BANGSA' // Wrong unit
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error && data.error.includes('Unit Mismatch'));
  });

  it('allows student to log in via Placement Candidate workspace with matching unit', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'teacher',
        email: testEmail,
        fullName: 'Ahmad Siswa Test',
        unit: 'SMA KARYA BANGSA'
      })
    });
    assert.strictEqual(res.status, 200);
    const studentCookie = res.headers.get('set-cookie');
    assert.ok(studentCookie, 'Should receive session cookie for student');
    const data = await res.json();
    assert.strictEqual(data.user.role, 'student');
    assert.strictEqual(data.user.email, testEmail);

    // Verify student can query /api/attempts/me and /api/test
    const meRes = await fetch(`${baseUrl}/api/attempts/me`, {
      headers: { 'Cookie': studentCookie }
    });
    assert.strictEqual(meRes.status, 200);

    const testRes = await fetch(`${baseUrl}/api/test`, {
      headers: { 'Cookie': studentCookie }
    });
    assert.strictEqual(testRes.status, 200);
  });

  it('deletes the test student account', async () => {
    const res = await fetch(`${baseUrl}/api/admin/students/${createdDbId}`, {
      method: 'DELETE',
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(res.status, 200);
  });

  it('cleans up bulk test students', async () => {
    const res = await fetch(`${baseUrl}/api/admin/students?search=bulk`, {
      headers: { 'Cookie': adminCookie }
    });
    const data = await res.json();
    for (const s of data.students || []) {
      if (s.email.includes('bulk') && s.email.includes('karyabangsa.sch.id')) {
        await fetch(`${baseUrl}/api/admin/students/${s.id}`, {
          method: 'DELETE',
          headers: { 'Cookie': adminCookie }
        });
      }
    }
  });
});
