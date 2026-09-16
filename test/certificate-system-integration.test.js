import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL || ('http://localhost:' + (process.env.PORT || 3000));

test('Placement Certificate Generation & System Settings Dynamic Integration', async (t) => {
  // 1. Authenticate Admin
  const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin', username: 'azzikra', password: '4dm1n123' })
  });
  assert.equal(adminLoginRes.status, 200);
  const adminCookie = adminLoginRes.headers.get('set-cookie')?.split(';')[0] || '';

  try {
    // 2. Fetch or update system settings
    const customSchoolName = 'Karya Bangsa International Academy';
    const customIssuer = 'Lembaga Sertifikasi Bahasa & Asesmen Guru';
    const updateSettingsRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        schoolName: customSchoolName,
        certificateIssuer: customIssuer,
        passingBand: '7.0'
      })
    });
    assert.equal(updateSettingsRes.status, 200);

    // 3. Verify public-settings returns the updated settings
    const pubRes = await fetch(`${baseUrl}/api/public-settings`);
    assert.equal(pubRes.status, 200);
    const pubData = await pubRes.json();
    assert.equal(pubData.schoolName, customSchoolName);
    assert.equal(pubData.certificateIssuer, customIssuer);
    assert.equal(pubData.passingBand, '7.0');

    // 4. Test PDF Export with admin credentials
    const exportPdfRes = await fetch(`${baseUrl}/api/admin/results/export?format=pdf`, {
      headers: { Cookie: adminCookie }
    });
    assert.equal(exportPdfRes.status, 200);
    assert.equal(exportPdfRes.headers.get('content-type'), 'application/pdf');
    const pdfBuffer = Buffer.from(await exportPdfRes.arrayBuffer());
    assert.ok(pdfBuffer.length > 500, 'PDF buffer should be non-empty');
    const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
    assert.equal(pdfHeader, '%PDF-');

    // Check that the PDF content contains our custom school name
    const pdfText = pdfBuffer.toString('latin1').replace(/\0/g, '');
    assert.ok(
      pdfText.includes(customSchoolName),
      'Exported PDF must dynamically include the customized schoolName from System Settings'
    );

    // 5. Test Single Candidate Certificate Endpoint (/api/attempts/:id/certificate)
    const listRes = await fetch(`${baseUrl}/api/admin/results`, { headers: { Cookie: adminCookie } });
    const listData = await listRes.json();
    if (listData.results && listData.results.length > 0) {
      const testAttempt = listData.results[0];
      const singleCertRes = await fetch(`${baseUrl}/api/attempts/${testAttempt.id}/certificate`, {
        headers: { Cookie: adminCookie }
      });
      assert.equal(singleCertRes.status, 200);
      assert.equal(singleCertRes.headers.get('content-type'), 'application/pdf');
      const singleBuf = Buffer.from(await singleCertRes.arrayBuffer());
      assert.equal(singleBuf.slice(0, 5).toString('ascii'), '%PDF-');
      const singleText = singleBuf.toString('latin1').replace(/\0/g, '');
      assert.ok(singleText.includes('Official Placement Assessment Record'));
    }
  } finally {
    // 6. Restore institutional default settings
    await fetch(`${baseUrl}/api/admin/settings/reset`, {
      method: 'POST',
      headers: { Cookie: adminCookie }
    });
  }
});
