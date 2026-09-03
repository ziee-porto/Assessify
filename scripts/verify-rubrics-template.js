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

  console.log('\n2. Testing Rubrics Template Download endpoint (/api/admin/rubrics/template)...');
  const templateRes = await fetch(`${baseUrl}/api/admin/rubrics/template`);
  console.log('Rubrics template endpoint status:', templateRes.status);
  const templateJson = await templateRes.json();
  console.log('Template title:', templateJson.title);
  console.log('Template skills:', Object.keys(templateJson).filter(k => templateJson[k]?.criteria));

  console.log('\n3. Uploading Standard Rubrics Template...');
  const uploadRes = await fetch(`${baseUrl}/api/admin/rubrics/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify(templateJson)
  });
  console.log('Upload rubrics status:', uploadRes.status, await uploadRes.json());

  console.log('\n4. Verifying active rubrics in database...');
  const activeRes = await fetch(`${baseUrl}/api/admin/rubrics`, {
    headers: { 'Cookie': cookie }
  });
  const activeRubrics = await activeRes.json();
  console.log('Active writing criteria count:', activeRubrics.writing?.criteria?.length);
  console.log('Active speaking criteria count:', activeRubrics.speaking?.criteria?.length);
  console.log('Active listening criteria count:', activeRubrics.listening?.criteria?.length);
  console.log('Active reading criteria count:', activeRubrics.reading?.criteria?.length);
  console.log('Active grammar criteria count:', activeRubrics.grammarVocabulary?.criteria?.length);

  console.log('\n5. Deleting 1 criterion from Writing...');
  const deleteCriterionRes = await fetch(`${baseUrl}/api/admin/rubrics/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ skillKey: 'writing', criterionIndex: 0 })
  });
  console.log('Delete criterion status:', deleteCriterionRes.status, await deleteCriterionRes.json());

  console.log('\n6. Restoring standard rubrics template...');
  await fetch(`${baseUrl}/api/admin/rubrics/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify(templateJson)
  });
  console.log('✓ Standard rubrics template restored to database.');
}

run().catch(console.error);
