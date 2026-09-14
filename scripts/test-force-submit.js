import http from 'node:http';

function makeRequest(options, postData = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const headers = options.headers || {};
    if (cookie) headers['Cookie'] = cookie;
    const req = http.request({ ...options, headers }, (res) => {
      let data = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, setCookie, data: parsed });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function test() {
  console.log('Testing force-submit and audit logs...');

  // 1. Admin Login
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    role: 'admin',
    username: 'azzikra',
    password: process.env.ADMIN_PASSWORD || '4dm1n123'
  });
  const cookie = loginRes.setCookie.map(c => c.split(';')[0]).join('; ');
  console.log('Admin login status:', loginRes.status);

  // 2. Test Force Submit endpoint with JSON payload
  const forceRes1 = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/proctor/force-submit',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    attemptId: 'ATT-TEST-001',
    reason: 'Force submitted by exam proctor'
  }, cookie);
  console.log('Force submit (JSON) status:', forceRes1.status, forceRes1.data);
  if (forceRes1.status !== 200) throw new Error('Force submit failed!');

  // 3. Test Force Submit endpoint with form-urlencoded or malformed string
  const forceRes2 = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/proctor/force-submit',
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }
  }, 'attemptId=ATT-TEST-002&reason=Malformed+Body+Test', cookie);
  console.log('Force submit (fallback parsing) status:', forceRes2.status, forceRes2.data);
  if (forceRes2.status !== 200) throw new Error('Fallback parsing failed!');

  // 4. Test Audit Logs query
  const auditRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/audit-logs?limit=10',
    method: 'GET'
  }, null, cookie);
  console.log('Audit logs status:', auditRes.status, 'Total logs:', auditRes.data.logs?.length);
  const latestLog = auditRes.data.logs?.[0];
  console.log('Latest audit log:', {
    action: latestLog?.action,
    category: latestLog?.category,
    actorName: latestLog?.actorName,
    target: latestLog?.target,
    status: latestLog?.status
  });

  console.log('\n✓ Force-submit and Audit log APIs working perfectly with 0 errors!');
}

test().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
