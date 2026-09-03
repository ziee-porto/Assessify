import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const baseUrl = 'http://localhost:3001';

async function run() {
  console.log('1. Logging in as Admin...');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin', username: 'azzikra', password: '4dm1n123' })
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Admin login status:', loginRes.status, cookie ? 'Cookie received' : 'No cookie');

  console.log('\n2. Testing Template Download endpoint (/api/admin/questions/template)...');
  const templateRes = await fetch(`${baseUrl}/api/admin/questions/template`);
  console.log('Template endpoint status:', templateRes.status);
  const templateJson = await templateRes.json();
  console.log('Template sections count:', templateJson.sections?.length);
  const templateListening = templateJson.sections?.find(s => s.id === 'listening');
  console.log('Template listening questions count:', templateListening?.questions?.length);
  console.log('Template listening Q1 audioScript:', templateListening?.questions?.[0]?.audioScript ? '✓ Present' : '✗ Missing');
  const templateReading = templateJson.sections?.find(s => s.id === 'reading');
  console.log('Template reading passages count:', templateReading?.passages?.length);
  console.log('Template reading questions count:', templateReading?.questions?.length);

  console.log('\n3. Uploading Question Bank with Audio Scripts and Multiple Passages...');
  const uploadRes = await fetch(`${baseUrl}/api/admin/questions/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify(templateJson)
  });
  console.log('Upload status:', uploadRes.status, await uploadRes.json());

  console.log('\n4. Fetching active questions from database...');
  const activeRes = await fetch(`${baseUrl}/api/admin/questions`, {
    headers: { 'Cookie': cookie }
  });
  const activeQuestions = await activeRes.json();
  const activeReading = activeQuestions.sections?.find(s => s.id === 'reading');
  console.log('Active reading passages:', activeReading?.passages?.length);

  console.log('\n5. Deleting 1 reading passage from Reading section...');
  const deletePassageRes = await fetch(`${baseUrl}/api/admin/questions/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ sectionId: 'reading', deletePassage: true, passageIndex: 0 })
  });
  console.log('Delete passage status:', deletePassageRes.status, await deletePassageRes.json());

  console.log('\n6. Verifying remaining reading passages in database...');
  const updatedActiveRes = await fetch(`${baseUrl}/api/admin/questions`, {
    headers: { 'Cookie': cookie }
  });
  const updatedActive = await updatedActiveRes.json();
  const updatedReading = updatedActive.sections?.find(s => s.id === 'reading');
  console.log('Remaining reading passages:', updatedReading?.passages?.length);

  console.log('\n7. Restoring full standard template to active database...');
  await fetch(`${baseUrl}/api/admin/questions/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify(templateJson)
  });
  console.log('✓ Standard template restored to database.');
}

run().catch(console.error);
