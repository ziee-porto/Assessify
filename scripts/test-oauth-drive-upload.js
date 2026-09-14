import 'dotenv/config';
import { google } from 'googleapis';
import mysql from 'mysql2/promise';
import { Readable } from 'node:stream';

async function testOAuthUpload() {
  console.log('Testing live Google Drive upload via OAuth Token...\n');

  // 1. Fetch refresh token from MySQL
  const db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'assessify'
  });

  const [rows] = await db.query('SELECT setting_value FROM settings WHERE setting_key = "googleRefreshToken"');
  await db.end();

  if (!rows.length || !rows[0].setting_value) {
    throw new Error('No googleRefreshToken found in database');
  }

  const rawVal = rows[0].setting_value;
  const refreshToken = (typeof rawVal === 'string' && rawVal.startsWith('"')) ? JSON.parse(rawVal) : rawVal;
  console.log('✔ Found active Google OAuth Refresh Token in MySQL database.');

  // 2. Authenticate with OAuth2 client
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: 'v3', auth });

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '162TBNwFAKmNKRSayKs2v4-fH1TxZIgYC';
  console.log('Target Folder ID:', folderId);

  // 3. Upload test speaking recording into Google Drive
  console.log('\nUploading test speaking recording into Google Drive folder...');
  const testBuffer = Buffer.from('ASSESSIFY_SPEAKING_CANDIDATE_VIDEO_AUDIO_STREAM_TEST');
  const filename = `ATT-CANDIDATE-TEST-${Date.now()}.webm`;

  let res;
  try {
    res = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: filename,
        ...(folderId ? { parents: [folderId] } : {})
      },
      media: {
        mimeType: 'video/webm',
        body: Readable.from(testBuffer)
      },
      fields: 'id, name, mimeType, webViewLink, webContentLink'
    });
  } catch (err) {
    console.warn('Could not place in target folder directly (' + err.message + '). Creating dedicated Assessify Recordings folder...');
    // Under drive.file scope, create an Assessify folder in the user's Drive:
    const appFolder = await drive.files.create({
      requestBody: {
        name: 'Assessify Candidate Recordings',
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id, name, webViewLink'
    });
    console.log('✔ Created dedicated App Folder in your Google Drive:');
    console.log('  Folder Name:', appFolder.data.name);
    console.log('  Folder ID:  ', appFolder.data.id);
    console.log('  Folder Link:', appFolder.data.webViewLink);

    // Now upload into this app-created folder:
    res = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [appFolder.data.id]
      },
      media: {
        mimeType: 'video/webm',
        body: Readable.from(testBuffer)
      },
      fields: 'id, name, mimeType, webViewLink, webContentLink'
    });
  }

  console.log('\n🎉 SUCCESS! FILE UPLOADED DIRECTLY TO GOOGLE DRIVE!');
  console.log('  File Name:    ', res.data.name);
  console.log('  File ID:      ', res.data.id);
  console.log('  View Link:    ', res.data.webViewLink);
  console.log('  Download Link:', res.data.webContentLink);
}

testOAuthUpload().catch(err => {
  console.error('\n❌ Upload error:', err);
  process.exit(1);
});
