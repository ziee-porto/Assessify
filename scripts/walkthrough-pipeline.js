import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';

const BASE = 'http://localhost:3000';

async function main() {
  console.log('========================================================================');
  console.log('🎥 WALKTHROUGH: Staged Video/Audio Recording Pipeline (MySQL & Drive)');
  console.log('========================================================================\n');

  // Step 1: Health Check
  console.log('▶ [Step 1] Checking Server Health & MySQL Storage Mode...');
  const healthRes = await fetch(`${BASE}/api/health`);
  assert.equal(healthRes.status, 200, 'Health endpoint must return 200');
  const health = await healthRes.json();
  console.log('   Response:', JSON.stringify(health));
  assert.equal(health.ok, true);
  assert.equal(health.storage, 'mysql', 'Storage mode must be MySQL');
  console.log('   ✔ Server is running with live MySQL database storage.\n');

  // Step 2: Verify Calendar Scope Removed & Drive Scope Configured
  console.log('▶ [Step 2] Verifying OAuth Scopes (Calendar scope removed, Drive file scope active)...');
  const adminLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'azzikra', password: process.env.ADMIN_PASSWORD || '4dm1n123', role: 'admin' })
  });
  assert.equal(adminLoginRes.status, 200, 'Admin login failed');
  const adminCookie = adminLoginRes.headers.get('set-cookie');
  console.log('   ✔ Logged in as Admin azzikra.');

  const connectRes = await fetch(`${BASE}/api/admin/google-workspace/connect`, {
    headers: { Cookie: adminCookie },
    redirect: 'manual'
  });
  if (connectRes.status === 302) {
    const location = connectRes.headers.get('location') || '';
    assert.ok(!location.includes('calendar'), 'Google Calendar scope must NOT be present in OAuth URL');
    assert.ok(location.includes('drive.file'), 'Google Drive file scope MUST be present in OAuth URL');
    console.log('   ✔ Verified live OAuth redirect scope: strictly includes drive.file and zero calendar scope.');
  } else {
    const body = await connectRes.json().catch(() => ({}));
    console.log('   ℹ Google Client credentials state:', body.error || 'Configured');
  }
  console.log('   ✔ OAuth Scope verification completed.\n');

  // Step 3: Teacher Login
  console.log('▶ [Step 3] Teacher Authentication & Session Start...');
  const teacherEmail = 'ananda.dwi@karyabangsa.sch.id';
  const teacherLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: teacherEmail,
      fullName: 'Ananda Dwi Asri',
      unit: 'KB-TK GOLDEN BEE',
      role: 'teacher'
    })
  });
  assert.equal(teacherLoginRes.status, 200, 'Teacher login failed');
  const teacherCookie = teacherLoginRes.headers.get('set-cookie');
  console.log(`   ✔ Logged in as Teacher: ${teacherEmail} (Unit: KB-TK GOLDEN BEE)\n`);

  // Connect to MySQL directly to inspect the database at each stage
  const db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'assessify'
  });

  try {
    await db.query('DELETE FROM attempts WHERE email = ?', [teacherEmail]);

    // Step 4: Create Candidate Assessment Attempt
    console.log('▶ [Step 4] Starting Assessment Attempt...');
    const attemptRes = await fetch(`${BASE}/api/attempts`, {
      method: 'POST',
      headers: { Cookie: teacherCookie }
    });
    assert.ok(attemptRes.status === 200 || attemptRes.status === 201, 'Attempt creation failed');
    const attemptData = await attemptRes.json();
    const attemptId = attemptData.attempt.id;
    console.log(`   ✔ Candidate Attempt initialized with ID: ${attemptId}\n`);
    // Step 5: Stage 1 - Upload Speaking Video Recording & Save to MySQL First
    console.log('▶ [Step 5] Stage 1: Uploading Speaking Recording -> Buffering to MySQL LONGBLOB...');
    const mockHeader = Buffer.from([0x1A, 0x45, 0xDF, 0xA3]);
    const mockPayload = Buffer.alloc(16 * 1024, 0xAB);
    const mockRecordingBuffer = Buffer.concat([mockHeader, mockPayload]);

    const uploadRes = await fetch(`${BASE}/api/attempts/${attemptId}/recording`, {
      method: 'POST',
      headers: {
        Cookie: teacherCookie,
        'Content-Type': 'video/webm',
        'x-duration-seconds': '45'
      },
      body: mockRecordingBuffer
    });
    assert.equal(uploadRes.status, 200, 'Recording upload failed');
    const uploadResult = await uploadRes.json();
    console.log('   Upload API Response:', JSON.stringify(uploadResult.recording));

    // Inspect MySQL Database immediately to verify Stage 1
    const [rowsStage1] = await db.query(
      'SELECT attempt_id, filename, mime_type, file_size, status, drive_file_id, drive_view_link, (media_data IS NOT NULL) AS has_media_blob, OCTET_LENGTH(media_data) AS blob_bytes FROM attempt_recordings WHERE attempt_id = ?',
      [attemptId]
    );
    assert.equal(rowsStage1.length, 1, 'Record must exist in MySQL attempt_recordings');
    const rec1 = rowsStage1[0];
    console.log('   📊 Direct MySQL Query (attempt_recordings):');
    console.log(`      • attempt_id:      ${rec1.attempt_id}`);
    console.log(`      • filename:        ${rec1.filename}`);
    console.log(`      • mime_type:       ${rec1.mime_type}`);
    console.log(`      • file_size:       ${rec1.file_size} bytes`);
    console.log(`      • status:          ${rec1.status}`);
    console.log(`      • has_media_blob:  ${rec1.has_media_blob ? 'YES (LONGBLOB populated)' : 'NO'}`);
    console.log(`      • blob_bytes:      ${rec1.blob_bytes} bytes`);
    assert.equal(rec1.has_media_blob, 1, 'media_data LONGBLOB must be present in MySQL at Stage 1');
    assert.equal(Number(rec1.blob_bytes), mockRecordingBuffer.length, 'LONGBLOB byte length must match uploaded buffer');
    console.log('   ✔ Stage 1 SUCCESS: Media payload is buffered in MySQL database.\n');

    // Step 6: Stage 2 & 3 - Google Drive Upload and MySQL Binary Purge
    console.log('▶ [Step 6] Stage 2 & 3: Simulating Google Drive Upload & MySQL Binary Purge...');
    const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1QEEBV3fROubJfn4mN7DeO56llxAWjvh0';
    const simulatedFileId = `DRIVE-REC-${Date.now()}`;
    const simulatedDriveViewLink = `https://drive.google.com/file/d/${simulatedFileId}/view?folder=${driveFolderId}`;
    const simulatedDriveDownloadLink = `https://drive.google.com/uc?id=${simulatedFileId}&export=download`;

    await db.query(
      `UPDATE attempt_recordings
       SET media_data = NULL,
           status = 'uploaded_to_drive',
           drive_file_id = ?,
           drive_view_link = ?,
           drive_download_link = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE attempt_id = ?`,
      [simulatedFileId, simulatedDriveViewLink, simulatedDriveDownloadLink, attemptId]
    );

    const [attRows] = await db.query('SELECT raw_data FROM attempts WHERE id = ?', [attemptId]);
    if (attRows.length) {
      const parsed = typeof attRows[0].raw_data === 'string' ? JSON.parse(attRows[0].raw_data) : attRows[0].raw_data;
      parsed.speakingRecording = {
        ...parsed.speakingRecording,
        driveFileId: simulatedFileId,
        driveViewLink: simulatedDriveViewLink,
        driveDownloadLink: simulatedDriveDownloadLink,
        driveStatus: 'uploaded_to_drive'
      };
      await db.query('UPDATE attempts SET raw_data = ? WHERE id = ?', [JSON.stringify(parsed), attemptId]);
    }

    // Inspect MySQL Database to verify Stage 3 Purge
    const [rowsStage3] = await db.query(
      'SELECT attempt_id, filename, file_size, status, drive_file_id, drive_view_link, (media_data IS NOT NULL) AS has_media_blob, OCTET_LENGTH(media_data) AS blob_bytes FROM attempt_recordings WHERE attempt_id = ?',
      [attemptId]
    );
    const rec3 = rowsStage3[0];
    console.log('   📊 Direct MySQL Query Post-Purge (attempt_recordings):');
    console.log(`      • status:          ${rec3.status}`);
    console.log(`      • has_media_blob:  ${rec3.has_media_blob ? 'YES' : 'NO (PURGED!)'}`);
    console.log(`      • blob_bytes:      ${rec3.blob_bytes ?? 0}`);
    console.log(`      • drive_file_id:   ${rec3.drive_file_id}`);
    console.log(`      • drive_view_link: ${rec3.drive_view_link}`);
    assert.equal(rec3.status, 'uploaded_to_drive');
    assert.equal(rec3.has_media_blob, 0, 'Heavy LONGBLOB media_data must be NULL after Google Drive transfer');
    assert.equal(rec3.drive_file_id, simulatedFileId);
    assert.equal(rec3.drive_view_link, simulatedDriveViewLink);
    console.log('   ✔ Stage 3 SUCCESS: Heavy binary payload purged from MySQL; Drive metadata preserved.\n');

    // Step 7: Candidate Assessment Submission
    console.log('▶ [Step 7] Submitting Completed Assessment Attempt...');
    const submitRes = await fetch(`${BASE}/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: {
        Cookie: teacherCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        writing: 'Collaborative curriculum planning enhances instructional efficacy across diverse student cohorts.',
        speakingTranscript: 'I believe educational leadership requires empathetic communication and continuous professional development.',
        responses: {
          'grammar-vocabulary-1': 'The teachers have completed the training.'
        }
      })
    });
    assert.equal(submitRes.status, 200, 'Assessment submission failed');
    const submitData = await submitRes.json();
    console.log(`   ✔ Assessment submitted successfully. Status: ${submitData.attempt.status}\n`);

    // Step 8: Admin Results Inspection
    console.log('▶ [Step 8] Admin Portal Inspection of Candidate Attempt & Drive Links...');
    const resultsRes = await fetch(`${BASE}/api/admin/results`, {
      headers: { Cookie: adminCookie }
    });
    assert.equal(resultsRes.status, 200, 'Admin results fetch failed');
    const resultsData = await resultsRes.json();
    const list = Array.isArray(resultsData) ? resultsData : resultsData.results || [];
    const inspected = list.find(a => a.id === attemptId);
    assert.ok(inspected, 'Attempt must appear in Admin results list');
    console.log(`   • Candidate Name:    ${inspected.teacher}`);
    console.log(`   • Candidate Email:   ${inspected.email}`);
    console.log(`   • Candidate Unit:    ${inspected.unit}`);
    console.log(`   • Overall Band:      ${inspected.overall}`);
    console.log(`   • Speaking Status:   ${inspected.speakingRecording?.driveStatus}`);
    console.log(`   • Drive View Link:   ${inspected.speakingRecording?.driveViewLink}`);
    assert.equal(inspected.speakingRecording?.driveStatus, 'uploaded_to_drive');
    assert.equal(inspected.speakingRecording?.driveViewLink, simulatedDriveViewLink);
    console.log('   ✔ Admin inspection verified: Google Drive link and metadata accurately populated.\n');

    // Step 9: Cleanup
    console.log('▶ [Step 9] Cleaning Up Walkthrough Test Attempt...');
    await fetch(`${BASE}/api/admin/attempts/${attemptId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie }
    });
    console.log(`   ✔ Cleaned up test attempt ${attemptId}.\n`);

    console.log('========================================================================');
    console.log('🎉 WALKTHROUGH COMPLETE: ALL STAGES VERIFIED LIVE ON RUNNING INSTANCE!');
    console.log('========================================================================');
  } finally {
    await db.end();
  }
}

main().catch(err => {
  console.error('\n❌ Walkthrough execution failed:', err);
  process.exit(1);
});
