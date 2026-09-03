const baseUrl = 'http://localhost:3001';

async function sync() {
  console.log('1. Logging in as Admin...');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin', username: 'azzikra', password: '4dm1n123' })
  });
  const cookie = loginRes.headers.get('set-cookie');

  console.log('2. Fetching template questions (/api/admin/questions/template)...');
  const templateRes = await fetch(`${baseUrl}/api/admin/questions/template`);
  const templateJson = await templateRes.json();
  console.log('Template loaded:');
  templateJson.sections.forEach((sec, idx) => {
    console.log(`  Section ${idx + 1}: ${sec.label} (${sec.questions.length} items)`);
  });

  console.log('3. Uploading active questions to MySQL database...');
  const uploadRes = await fetch(`${baseUrl}/api/admin/questions/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify(templateJson)
  });
  console.log('Upload result:', uploadRes.status, await uploadRes.json());

  console.log('4. Verifying active questions from database...');
  const activeRes = await fetch(`${baseUrl}/api/admin/questions`, {
    headers: { 'Cookie': cookie }
  });
  const activeData = await activeRes.json();
  const total = activeData.sections.reduce((sum, s) => sum + s.questions.length, 0);
  console.log(`✓ Active database synchronized with ${activeData.sections.length} sections and ${total} total items.`);
}

sync().catch(console.error);
