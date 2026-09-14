import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('Staged Recording Pipeline (MySQL Buffer -> Google Drive -> MySQL Cleanup)', () => {
  it('verifies that Google Calendar scope is completely removed and only Drive scope is requested', async () => {
    const serverCode = await readFile(join(root, 'src', 'server.js'), 'utf8');

    // Calendar scope must not be requested anywhere
    assert.ok(
      !serverCode.includes("'https://www.googleapis.com/auth/calendar'"),
      'Calendar scope must be removed from Google Workspace authorization'
    );
    assert.ok(
      !serverCode.includes('"https://www.googleapis.com/auth/calendar"'),
      'Calendar scope must be removed from Google Workspace authorization'
    );

    // Google Drive scope must be present
    assert.ok(
      serverCode.includes('https://www.googleapis.com/auth/drive.file'),
      'Google Drive file scope must be configured for Google Workspace authorization'
    );
  });

  it('verifies in-memory repository staged recording buffering and cleanup lifecycle', async () => {
    const recordings = new Map();
    const repo = {
      recordings,
      async saveRecordingToDb({ attemptId, filename, mimeType, fileSize, buffer }) {
        const rec = {
          attemptId,
          filename,
          mimeType,
          fileSize: fileSize || buffer?.length || 0,
          mediaData: buffer || null,
          status: 'saved_to_mysql',
          driveFileId: null,
          driveViewLink: null,
          driveDownloadLink: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.recordings.set(attemptId, rec);
        return rec;
      },
      async getRecordingFromDb(attemptId) {
        return this.recordings.get(attemptId) || null;
      },
      async deleteRecordingMediaFromDb(attemptId, driveMeta = {}) {
        const rec = this.recordings.get(attemptId);
        if (rec) {
          rec.mediaData = null;
          rec.status = 'uploaded_to_drive';
          if (driveMeta.driveFileId) rec.driveFileId = driveMeta.driveFileId;
          if (driveMeta.driveViewLink) rec.driveViewLink = driveMeta.driveViewLink;
          if (driveMeta.driveDownloadLink) rec.driveDownloadLink = driveMeta.driveDownloadLink;
          rec.updatedAt = new Date().toISOString();
          return rec;
        }
        return null;
      },
      async deleteRecording(attemptId) {
        return this.recordings.delete(attemptId);
      },
      async listPendingDriveRecordings() {
        const list = [];
        for (const rec of this.recordings.values()) {
          if (rec.status === 'saved_to_mysql' && rec.mediaData) list.push(rec);
        }
        return list;
      }
    };

    const attemptId = 'ATT-TEST-STAGE-101';
    const dummyBuffer = Buffer.from('FAKE_WEBM_VIDEO_BINARY_DATA_FOR_STAGE_TEST');

    // 1. Save to database
    const saved = await repo.saveRecordingToDb({
      attemptId,
      filename: `${attemptId}.webm`,
      mimeType: 'video/webm',
      fileSize: dummyBuffer.length,
      buffer: dummyBuffer
    });

    assert.equal(saved.status, 'saved_to_mysql');
    assert.equal(saved.fileSize, dummyBuffer.length);

    // 2. Verify media exists in database
    const fetched = await repo.getRecordingFromDb(attemptId);
    assert.ok(fetched, 'Recording must exist in database');
    assert.equal(fetched.status, 'saved_to_mysql');
    assert.ok(Buffer.isBuffer(fetched.mediaData), 'Media data must be stored as Buffer in database');
    assert.equal(fetched.mediaData.toString(), 'FAKE_WEBM_VIDEO_BINARY_DATA_FOR_STAGE_TEST');

    // 3. Verify pending queue
    const pending = await repo.listPendingDriveRecordings();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].attemptId, attemptId);

    // 4. Simulate successful Google Drive upload and MySQL purge
    const driveMeta = {
      driveFileId: 'DRIVE_FILE_XYZ_123',
      driveViewLink: 'https://drive.google.com/file/d/DRIVE_FILE_XYZ_123/view',
      driveDownloadLink: 'https://drive.google.com/uc?id=DRIVE_FILE_XYZ_123&export=download'
    };
    await repo.deleteRecordingMediaFromDb(attemptId, driveMeta);

    // 5. Verify heavy binary data is purged from database
    const postCleanup = await repo.getRecordingFromDb(attemptId);
    assert.ok(postCleanup, 'Metadata row must still exist');
    assert.equal(postCleanup.mediaData, null, 'Binary media payload must be purged from database');
    assert.equal(postCleanup.status, 'uploaded_to_drive', 'Status must be updated to uploaded_to_drive');
    assert.equal(postCleanup.driveFileId, 'DRIVE_FILE_XYZ_123');
    assert.equal(postCleanup.driveViewLink, 'https://drive.google.com/file/d/DRIVE_FILE_XYZ_123/view');

    // 6. Verify pending queue is now empty
    const remainingPending = await repo.listPendingDriveRecordings();
    assert.equal(remainingPending.length, 0, 'No recordings should be pending after upload and cleanup');

    // 7. Full deletion
    const deleted = await repo.deleteRecording(attemptId);
    assert.equal(deleted, true);
    assert.equal(await repo.getRecordingFromDb(attemptId), null);
  });

  it('verifies SQL table definition in assessify.sql has attempt_recordings with longblob and status', async () => {
    const sqlContent = await readFile(join(root, 'assessify.sql'), 'utf8');
    assert.ok(sqlContent.includes('CREATE TABLE `attempt_recordings`'), 'attempt_recordings table must be in assessify.sql');
    assert.ok(sqlContent.includes('`media_data` longblob'), 'media_data LONGBLOB must be in assessify.sql');
    assert.ok(sqlContent.includes('`drive_file_id`'), 'drive_file_id column must be in assessify.sql');
    assert.ok(sqlContent.includes('`drive_view_link`'), 'drive_view_link column must be in assessify.sql');
  });
});
