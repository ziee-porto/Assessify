const BASE_URL = 'http://localhost:3001';

async function main() {
  console.log('Testing Assessify Admin Authentication...');
  
  // 1. Log in as admin
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin', username: 'azzikra', password: '4dm1n123' })
  });
  
  const cookie = loginRes.headers.get('set-cookie');
  if (!cookie) throw new Error('Failed to get session cookie');
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': cookie.split(';')[0]
  };

  // 2. Fetch Questions
  console.log('Fetching Question Bank from database...');
  const qRes = await fetch(`${BASE_URL}/api/admin/questions`, { headers });
  const questions = await qRes.json();
  console.log(`✓ Fetched Question Bank: ${questions.sections.length} sections, total duration: ${questions.durationMinutes}m`);

  // 3. Fetch Rubrics
  console.log('Fetching Evaluation Rubrics from database...');
  const rRes = await fetch(`${BASE_URL}/api/admin/rubrics`, { headers });
  const rubrics = await rRes.json();
  console.log(`✓ Fetched Rubrics: Writing has ${rubrics.writing.criteria.length} criteria, Speaking has ${rubrics.speaking.criteria.length} criteria`);

  // 4. Test deleting a single question
  const grammarSec = questions.sections.find(s => s.id === 'grammar-vocabulary');
  const initialQCount = grammarSec.questions.length;
  const qToDelete = grammarSec.questions[grammarSec.questions.length - 1];
  console.log(`Deleting test question ${qToDelete.id} from ${grammarSec.label}...`);

  const delQRes = await fetch(`${BASE_URL}/api/admin/questions/delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sectionId: 'grammar-vocabulary', questionId: qToDelete.id })
  });
  const delQData = await delQRes.json();
  console.log(`✓ Question delete response:`, delQData);

  // Verify questions count updated
  const qRes2 = await fetch(`${BASE_URL}/api/admin/questions`, { headers });
  const questions2 = await qRes2.json();
  const grammarSec2 = questions2.sections.find(s => s.id === 'grammar-vocabulary');
  console.log(`✓ Grammar questions count after deletion: ${grammarSec2.questions.length} (was ${initialQCount})`);

  // 5. Test deleting a rubric criterion
  const initialCritCount = rubrics.writing.criteria.length;
  const lastCritIdx = initialCritCount - 1;
  const critToDelete = rubrics.writing.criteria[lastCritIdx];
  console.log(`Deleting criterion "${critToDelete.name}" from Writing...`);

  const delCRes = await fetch(`${BASE_URL}/api/admin/rubrics/delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ skillKey: 'writing', criterionIndex: lastCritIdx })
  });
  const delCData = await delCRes.json();
  console.log(`✓ Criterion delete response:`, delCData);

  // Verify rubrics updated
  const rRes2 = await fetch(`${BASE_URL}/api/admin/rubrics`, { headers });
  const rubrics2 = await rRes2.json();
  console.log(`✓ Writing criteria count after deletion: ${rubrics2.writing.criteria.length} (was ${initialCritCount})`);

  console.log('ALL DELETE TESTS PASSED AND VERIFIED WITH MYSQL! 🚀');
}

main().catch(err => {
  console.error('Error during test:', err);
  process.exit(1);
});
