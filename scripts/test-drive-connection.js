import { google } from 'googleapis';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

async function testDrive() {
  console.log('Testing Google Drive Service Account Connection...\n');
  const serviceAccountPath = join(root, 'service-account.json');
  const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
  console.log('✔ Loaded service-account.json:');
  console.log('  Client Email:', serviceAccount.client_email);
  console.log('  Project ID:', serviceAccount.project_id);

  const auth = new google.auth.GoogleAuth({
    keyFile: serviceAccountPath,
    scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
  });

  const drive = google.drive({ version: 'v3', auth });

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1QEEBV3fROubJfn4mN7DeO56llxAWjvh0';
  console.log('\nTesting access to target folder:', folderId);

  try {
    const folder = await drive.files.get({
      fileId: folderId,
      supportsAllDrives: true,
      fields: 'id, name, mimeType, capabilities'
    });
    console.log('✔ Successfully accessed folder in Google Drive:');
    console.log('  Folder Name:', folder.data.name);
    console.log('  Can add children (can edit):', folder.data.capabilities?.canAddChildren);

    // Test uploading a tiny verification text file into this folder
    console.log('\nTesting live file upload to Google Drive folder...');
    const testFile = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: `assessify-connection-test-${Date.now()}.txt`,
        parents: [folderId]
      },
      media: {
        mimeType: 'text/plain',
        body: 'Assessify Google Drive live connection successfully verified!'
      },
      fields: 'id, name, webViewLink'
    });

    console.log('🎉 LIVE UPLOAD SUCCESSFUL!');
    console.log('  File ID:', testFile.data.id);
    console.log('  File Name:', testFile.data.name);
    console.log('  View Link:', testFile.data.webViewLink);

    // Clean up the test file
    console.log('\nCleaning up test verification file from Drive...');
    await drive.files.delete({ fileId: testFile.data.id });
    console.log('✔ Cleanup complete. Google Drive integration is 100% OPERATIONAL!');
  } catch (err) {
    console.error('❌ Google Drive access error:', err.message);
    if (err.message.includes('File not found') || err.message.includes('404')) {
      console.error('\n👉 IMPORTANT: Please ensure you have shared the Google Drive folder');
      console.error('   https://drive.google.com/drive/folders/' + folderId);
      console.error('   with the service account email:');
      console.error('   ' + serviceAccount.client_email);
      console.error('   and granted it "Editor" permission!');
    }
  }
}

testDrive().catch(err => {
  console.error('Fatal error:', err);
});
