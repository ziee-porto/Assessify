const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const toastContainer = document.querySelector('#toast-container');

// Toast Notification System (replaces native browser alert/prompt)
function showToast(message, type = 'success', duration = 4500) {
  const container = document.querySelector('#toast-container') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-container';
    el.className = 'toast-container';
    document.body.appendChild(el);
    return el;
  })();

  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '•'}</span>
    <div class="toast-content">${message}</div>
    <button class="toast-close" type="button" aria-label="Close">✕</button>
  `;

  const closeToast = () => {
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 200);
  };

  toast.querySelector('.toast-close').onclick = closeToast;
  container.appendChild(toast);

  if (duration) {
    setTimeout(closeToast, duration);
  }
}

const request = async (path, options = {}) => {
  try {
    const response = await fetch(path, options);
    if (response.status === 204) return {};
    const data = await response.json();
    if (!response.ok) return { error: data.error || 'Request failed' };
    if (path.includes('/submit') && data.speakingMeetUrl) window.location.assign(data.speakingMeetUrl);
    return data;
  } catch (err) {
    return { error: err.message || 'Network error occurred' };
  }
};

const ICONS = {
  results: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>`,
  questions: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
  rubrics: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  school: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
  excel: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13l3 4"/><path d="M11 13l-3 4"/><line x1="14" y1="13" x2="16" y2="13"/><line x1="14" y1="17" x2="16" y2="17"/></svg>`,
  pdf: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
  grade: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  eye: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  upload: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  x: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  users: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  fileText: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  checkCircle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  clock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  penTool: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>`,
  mic: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
  headphones: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`,
  book: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  layers: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  award: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`,
  video: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
  refresh: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  lightbulb: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5"/></svg>`,
  volume2: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  lock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  alertTriangle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  edit: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  pin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.77V5a3 3 0 0 0-6 0v5.77a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z"/></svg>`,
  save: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
  clipboardCheck: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><polyline points="9 14 12 17 16 12"/></svg>`
};

const sectionIcons = {
  'Grammar & Vocabulary': ICONS.layers,
  Reading: ICONS.book,
  Writing: ICONS.penTool,
  Listening: ICONS.headphones,
  Speaking: ICONS.mic
};

const renderQuestion = (question, section) => {
  const audio = question.audioScript ? `<button class="button speak-question" data-text="${question.audioScript.replaceAll('"', '&quot;')}">Play audio</button>` : '';
  if (question.options) return `${audio}<p><strong>${question.prompt}</strong></p>${question.options.map((option) => `<label class="option"><input type="radio" name="${question.id}"> ${option}</label>`).join('')}`;
  return `<p><strong>${question.prompt}</strong></p>${section.id === 'speaking' ? `<video id="camera-preview" autoplay muted playsinline style="width:100%;max-width:480px;background:#17263d;border-radius:8px;display:block;margin:14px 0"></video><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="status" id="recording-status">Preparing camera…</span><button class="ghost" id="stop-recording" type="button">Stop recording</button></div>` : `<textarea id="writing-response" rows="8" placeholder="Write your response here" style="width:100%;border:1px solid var(--line);padding:12px;font:14px 'DM Sans';border-radius:7px"></textarea>`}`;
};

function renderLogin(initialRole) {
  const logoutBtn = document.querySelector('#logout');
  if (logoutBtn) logoutBtn.hidden = true;
  const roleLabel = document.querySelector('#role-label');
  if (roleLabel) roleLabel.textContent = 'Secure school workspace';

  const savedRole = initialRole || localStorage.getItem('assessify_login_role') || (new URLSearchParams(window.location.search).get('role')) || 'teacher';
  const isAdminRole = savedRole === 'admin';

  app.innerHTML = `
    <div class="login-wrapper">
      <section class="panel login-panel">
        <div class="eyebrow">Karya Bangsa School</div>
        <h1 style="font:700 32px 'Space Grotesk';margin:8px 0;color:var(--ink)">Welcome to Assessify</h1>
        <p style="color:var(--muted);line-height:1.6;font-size:14px;margin-bottom:20px">Sign in with your educator credentials to begin a placement assessment or access administration reports.</p>
        
        <form id="login-form">
          <label style="display:block;font-size:13px;font-weight:700;margin:16px 0 6px;color:var(--ink)">Workspace</label>
          <select class="select-filter" id="login-role" name="role" style="width:100%;padding:12px;margin-bottom:6px">
            <option value="teacher" ${!isAdminRole ? 'selected' : ''}>Teacher Placement Assessment</option>
            <option value="admin" ${isAdminRole ? 'selected' : ''}>School Administration Portal</option>
          </select>

          <!-- Teacher Login Fields -->
          <div id="teacher-fields" ${isAdminRole ? 'hidden' : ''}>
            <label style="display:block;font-size:13px;font-weight:700;margin:16px 0 6px;color:var(--ink)">
              Full Name <span style="font-size:11.5px;font-weight:400;color:var(--muted)">(used for Official Certificate & Placement Records)</span>
            </label>
            <input type="text" name="fullName" placeholder="e.g. Budi Santoso, S.Pd." ${isAdminRole ? '' : 'required'} style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif">

            <label style="display:block;font-size:13px;font-weight:700;margin:16px 0 6px;color:var(--ink)">School Email</label>
            <input type="email" name="email" placeholder="name@karyabangsa.sch.id" ${isAdminRole ? '' : 'required'} style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif">

            <label style="display:block;font-size:13px;font-weight:700;margin:16px 0 6px;color:var(--ink)">School Unit</label>
            <select class="select-filter" id="teacher-unit" name="unit" ${isAdminRole ? '' : 'required'} style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif">
              <option value="" disabled selected>Select Unit</option>
              <option value="KB-TK GOLDEN BEE">KB-TK GOLDEN BEE</option>
              <option value="SD KARYA BANGSA">SD KARYA BANGSA</option>
              <option value="SMP KARYA BANGSA">SMP KARYA BANGSA</option>
              <option value="SMA KARYA BANGSA">SMA KARYA BANGSA</option>
              <option value="SMK KARYA BANGSA">SMK KARYA BANGSA</option>
            </select>
          </div>

          <!-- Admin Login Fields -->
          <div id="admin-fields" ${isAdminRole ? '' : 'hidden'}>
            <label style="display:block;font-size:13px;font-weight:700;margin:16px 0 6px;color:var(--ink)">Admin Username</label>
            <input type="text" name="username" autocomplete="username" placeholder="Admin username" ${isAdminRole ? 'required' : ''} style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif">

            <label style="display:block;font-size:13px;font-weight:700;margin:16px 0 6px;color:var(--ink)">Password</label>
            <input type="password" name="password" autocomplete="current-password" placeholder="Admin password" ${isAdminRole ? 'required' : ''} style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif">
          </div>

          <p id="login-error" style="color:var(--coral);font-size:13px;font-weight:600;margin:12px 0 0"></p>
          
          <button class="button" type="submit" style="width:100%;justify-content:center;margin-top:20px;padding:12px">
            Continue Securely <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
    </div>
  `;

  const roleSelect = document.querySelector('#login-role');
  roleSelect.onchange = () => {
    const admin = roleSelect.value === 'admin';
    localStorage.setItem('assessify_login_role', roleSelect.value);
    document.querySelector('#teacher-fields').hidden = admin;
    document.querySelector('#admin-fields').hidden = !admin;
    document.querySelector('[name="fullName"]').required = !admin;
    document.querySelector('[name="email"]').required = !admin;
    document.querySelector('[name="unit"]').required = !admin;
    document.querySelector('[name="username"]').required = admin;
    document.querySelector('[name="password"]').required = admin;
  };

  document.querySelector('#login-form').onsubmit = async (event) => {
    event.preventDefault();
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying account…';

    const data = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(event.target)))
    });

    if (data.error) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Continue Securely <span aria-hidden="true">→</span>';
      return document.querySelector('#login-error').textContent = data.error;
    }
    boot(data.user);
  };
}

function boot(user) {
  document.querySelector('#logout').hidden = false;
  document.querySelector('#role-label').textContent = user.role === 'admin' ? 'Admin workspace' : 'Teacher workspace';
  user.role === 'admin' ? renderAdmin() : request('/api/test').then((test) => renderTeacher(test, user));
}

function renderTeacher(test, user) {
  const totalQuestions = (test.sections || []).reduce((sum, s) => sum + (s.questions ? s.questions.length : 0), 0);

  app.innerHTML = `
    <div class="teacher-shell">
      <section class="hero">
        <div>
          <div class="eyebrow">Karya Bangsa School · Placement Assessment</div>
          <h1>Welcome, ${user.name || 'Educator'}.</h1>
          <p>This English proficiency assessment measures your skills across Grammar & Vocabulary, Reading, Listening, Writing, and Speaking for Karya Bangsa School development.</p>
        </div>
        <div class="hero-note">
          <strong>01:15:00</strong>
          <span>Total assessment time</span>
        </div>
      </section>

      <!-- Section Overview Grid -->
      <section class="sections">
        ${test.sections.map((section, idx) => `
          <article class="section-card">
            <div class="section-icon">${sectionIcons[section.label] || (idx + 1)}</div>
            <b>${section.label}</b>
            <span>${section.durationMinutes} mins · ${section.questions.length} items</span>
          </article>
        `).join('')}
      </section>

      <!-- Guidelines Card -->
      <div class="test-guidelines-card">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="skill-icon-badge skill-icon-writing" style="width:28px;height:28px">${ICONS.pin}</div>
          <h3 style="font:700 18px 'Space Grotesk';margin:0;color:var(--ink)">Before You Begin</h3>
        </div>
        <div class="test-guidelines-grid">
          <div class="guideline-item">
            <div class="guideline-icon">${ICONS.clock}</div>
            <div>
              <div class="guideline-title">75-Minute Session</div>
              <p class="guideline-desc">The assessment is timed. Once started, complete all 5 sections within the allotted 75 minutes.</p>
            </div>
          </div>
          <div class="guideline-item">
            <div class="guideline-icon">${ICONS.headphones}</div>
            <div>
              <div class="guideline-title">Headphones Recommended</div>
              <p class="guideline-desc">Listening questions include audio prompts. Adjust your device volume beforehand.</p>
            </div>
          </div>
          <div class="guideline-item">
            <div class="guideline-icon">${ICONS.mic}</div>
            <div>
              <div class="guideline-title">Camera & Microphone</div>
              <p class="guideline-desc">Speaking questions record a short video/audio response directly in the browser.</p>
            </div>
          </div>
          <div class="guideline-item">
            <div class="guideline-icon">${ICONS.save}</div>
            <div>
              <div class="guideline-title">Real-Time Autosave</div>
              <p class="guideline-desc">All selected answers and written drafts are saved automatically as you proceed.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Device Check & Camera / Microphone Testing Card -->
      <div class="device-check-card">
        <div class="device-check-header">
          <div>
            <div class="eyebrow" style="margin-bottom:2px">Hardware Readiness Check</div>
            <h3 style="font:700 18px 'Space Grotesk';margin:0;color:var(--ink)">Camera & Microphone Diagnostics</h3>
          </div>
          <span id="device-overall-badge" class="device-status-badge testing">● Testing Camera & Mic…</span>
        </div>

        <div class="device-check-grid">
          <!-- Live Camera Preview -->
          <div>
            <div class="device-preview-box">
              <video id="diag-camera-preview" autoplay muted playsinline></video>
              <div id="diag-camera-overlay" style="position:absolute;top:10px;left:10px;background:rgba(15,23,42,0.85);color:#fff;padding:4px 10px;border-radius:20px;font-size:11.5px;font-weight:600;display:flex;align-items:center;gap:5px">
                ${ICONS.video} Live Camera Preview
              </div>
            </div>
            <div class="device-status-bar">
              <div class="device-status-indicator" id="diag-cam-status-wrap">
                <span class="status-pulse-dot is-testing" id="diag-cam-dot"></span>
                <span id="diag-cam-status">Checking camera…</span>
              </div>
              <button type="button" class="btn-retest-device" id="diag-retry-cam-btn" title="Re-initialize and verify camera and microphone">
                ${ICONS.refresh}
                <span>Retest Device</span>
              </button>
            </div>
          </div>

          <!-- Microphone & Sample Test -->
          <div>
            <div class="device-meter-row">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:6px;color:var(--blue-dark)">
                  ${ICONS.mic}
                  <strong style="font-size:13px;color:var(--ink)">Live Microphone Input</strong>
                </div>
                <span id="diag-mic-text" style="font-size:12px;font-weight:600;color:#64748b">Listening…</span>
              </div>
              <div style="background:#e2e8f0;height:10px;border-radius:5px;overflow:hidden;position:relative">
                <div id="diag-mic-bar" style="width:0%;height:100%;background:#22c55e;transition:width 0.08s ease"></div>
              </div>
              <p style="font-size:11.5px;color:var(--muted);margin:8px 0 0">Speak a few words into your microphone. The green bar will move in real time.</p>
            </div>

            <!-- Quick 3-Second Audio/Video Sample Recording Test -->
            <div class="device-sample-box">
              <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:4px">Sound & Video Playback Test</div>
              <p style="font-size:12px;color:var(--muted);margin:0 0 10px">Record a 3-second test clip to verify your voice can be recorded and heard clearly.</p>
              
              <button type="button" class="button button-sm" id="diag-sample-btn" style="padding:8px 18px;font-size:12.5px;margin:0 auto">
                <span class="rec-dot" style="margin-right:6px"></span> <span>Record 3s Test Sample</span>
              </button>

              <div id="diag-playback-container" style="margin-top:12px;display:none">
                <video id="diag-sample-player" controls playsinline style="width:100%;max-width:320px;border-radius:8px;background:#0f172a;margin:6px auto;display:block"></video>
                <span style="font-size:11.5px;color:#16a34a;font-weight:600;display:inline-flex;align-items:center;gap:4px">${ICONS.check} Play the clip above to verify your voice sound!</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Start Panel -->
      <section class="panel" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
        <div>
          <h2 style="margin:0 0 4px">Ready to start?</h2>
          <p style="color:var(--muted);margin:0;font-size:14px">Ensure you have a quiet environment and a stable internet connection.</p>
        </div>
        <button class="button" id="start" style="padding:14px 28px;font-size:15px">
          <span>Start Assessment</span> <span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  `;

  // ── Diagnostic Camera & Mic Engine ────────────────────────
  let diagStream = null;
  let diagAudioCtx = null;
  let diagAnalyser = null;
  let diagAnimId = null;

  async function startDiagnosticCheck(isUserRetry = false) {
    const previewEl = document.querySelector('#diag-camera-preview');
    const camStatus = document.querySelector('#diag-cam-status');
    const camDot = document.querySelector('#diag-cam-dot');
    const retryBtn = document.querySelector('#diag-retry-cam-btn');
    const overallBadge = document.querySelector('#device-overall-badge');

    if (retryBtn) {
      retryBtn.classList.add('is-retesting');
      const btnSpan = retryBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = 'Testing…';
    }
    if (camDot) camDot.className = 'status-pulse-dot is-testing';
    if (camStatus) camStatus.textContent = 'Verifying camera & audio…';

    try {
      if (diagStream) {
        diagStream.getTracks().forEach((t) => t.stop());
      }
      diagStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      if (previewEl) previewEl.srcObject = diagStream;
      if (camStatus) camStatus.textContent = 'Camera & Audio Active (Ready)';
      if (camDot) camDot.className = 'status-pulse-dot';
      if (overallBadge) {
        overallBadge.className = 'device-status-badge ok';
        overallBadge.textContent = '✓ Camera & Mic Ready';
      }
      if (isUserRetry) {
        showToast('✓ Camera and Microphone retested and verified successfully!', 'success');
      }

      // Audio Meter
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        if (diagAudioCtx) {
          try { diagAudioCtx.close(); } catch { }
        }
        diagAudioCtx = new AudioContextClass();
        const src = diagAudioCtx.createMediaStreamSource(diagStream);
        diagAnalyser = diagAudioCtx.createAnalyser();
        diagAnalyser.fftSize = 64;
        src.connect(diagAnalyser);

        const bar = document.querySelector('#diag-mic-bar');
        const txt = document.querySelector('#diag-mic-text');
        const buf = new Uint8Array(diagAnalyser.frequencyBinCount);

        function checkLevel() {
          if (!diagAnalyser || !document.querySelector('#diag-mic-bar')) return;
          diagAnalyser.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i];
          const avg = sum / buf.length;
          const pct = Math.min(100, Math.round((avg / 75) * 100));
          if (bar) {
            bar.style.width = `${Math.max(4, pct)}%`;
            bar.style.background = pct > 10 ? '#22c55e' : '#94a3b8';
          }
          if (txt) {
            if (pct > 10) {
              txt.textContent = '● Voice Signal Detected';
              txt.style.color = '#15803d';
            } else {
              txt.textContent = 'Microphone Active';
              txt.style.color = '#64748b';
            }
          }
          diagAnimId = requestAnimationFrame(checkLevel);
        }
        checkLevel();
      }
    } catch (err) {
      console.warn('Diagnostic media check error:', err);
      if (camStatus) camStatus.textContent = 'Camera/Mic permission blocked';
      if (camDot) camDot.className = 'status-pulse-dot is-error';
      if (overallBadge) {
        overallBadge.className = 'device-status-badge error';
        overallBadge.textContent = '⚠️ Check Permissions';
      }
      if (isUserRetry) {
        showToast('⚠️ Unable to access camera/mic. Please check browser permissions.', 'error');
      }
    } finally {
      if (retryBtn) {
        setTimeout(() => {
          retryBtn.classList.remove('is-retesting');
          const btnSpan = retryBtn.querySelector('span');
          if (btnSpan) btnSpan.textContent = 'Retest Device';
        }, 400);
      }
    }
  }

  startDiagnosticCheck();

  document.querySelector('#diag-retry-cam-btn')?.addEventListener('click', () => {
    startDiagnosticCheck(true);
  });

  // 3-Second Sample Recording Test
  const sampleBtn = document.querySelector('#diag-sample-btn');
  if (sampleBtn) {
    sampleBtn.onclick = () => {
      if (!diagStream || !window.MediaRecorder) return;
      sampleBtn.disabled = true;
      let countdown = 3;
      sampleBtn.textContent = `● Recording sample (${countdown}s)…`;

      let sampleChunks = [];
      const rec = new MediaRecorder(diagStream);
      rec.ondataavailable = (e) => { if (e.data.size) sampleChunks.push(e.data); };
      rec.start();

      const timer = setInterval(() => {
        countdown -= 1;
        if (countdown > 0) {
          sampleBtn.textContent = `● Recording sample (${countdown}s)…`;
        } else {
          clearInterval(timer);
          rec.stop();
          sampleBtn.disabled = false;
          sampleBtn.textContent = '🔄 Retest 3s Sample';

          rec.onstop = () => {
            const blob = new Blob(sampleChunks, { type: rec.mimeType || 'video/webm' });
            const url = URL.createObjectURL(blob);
            const player = document.querySelector('#diag-sample-player');
            const cont = document.querySelector('#diag-playback-container');
            if (player && cont) {
              cont.style.display = 'block';
              player.src = url;
              player.muted = false;
              player.volume = 1.0;
              player.play();
            }
          };
        }
      }, 1000);
    };
  }

  // Start Assessment Button Hand-off
  document.querySelector('#start').onclick = async () => {
    // Teardown diagnostic stream cleanly so the assessment starts fresh
    if (diagStream) {
      diagStream.getTracks().forEach((t) => t.stop());
      diagStream = null;
    }
    if (diagAudioCtx) {
      try { diagAudioCtx.close(); } catch { }
      diagAudioCtx = null;
    }
    if (diagAnimId) cancelAnimationFrame(diagAnimId);

    const btn = document.querySelector('#start');
    btn.disabled = true;
    btn.textContent = 'Preparing assessment…';
    const result = await request('/api/attempts', { method: 'POST' });
    if (result.error) return renderLogin();
    renderSectionFlow(test, result.expiresAt, result.attempt.id);
  };
}

function renderSectionFlow(test, expiresAt, attemptId) {
  let sectionIndex = 0;
  let mediaRecorder = null;
  let mediaStream = null;
  let recordingChunks = [];
  let recordingStartedAt = null;
  let speechRecognizer = null;
  let speakingStep = 0;
  let speakingRecordingState = 'idle'; // 'idle' | 'recording' | 'stopped'
  const playedAudio = {};
  const answers = {};

  const section = () => test.sections[sectionIndex];

  const stopMedia = () => new Promise((resolve) => {
    if (speechRecognizer) {
      try { speechRecognizer.stop(); } catch { }
      speechRecognizer = null;
    }
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
      return resolve();
    }
    mediaRecorder.addEventListener('stop', () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
      resolve();
    }, { once: true });
    try { mediaRecorder.stop(); } catch { resolve(); }
  });

  const draw = () => {
    const current = section();
    const speaking = current.id === 'speaking' || current.label.toLowerCase().includes('speaking');
    const isLastSection = sectionIndex === test.sections.length - 1;

    let contentHtml = '';
    if (speaking) {
      const activePrompt = current.questions[speakingStep] || current.questions[0];
      contentHtml = `
        <div class="speaking-flow-container">
          <div class="speaking-stepper">
            ${current.questions.map((q, idx) => `
              <div class="speaking-step-chip ${idx === speakingStep ? 'active' : (idx < speakingStep ? 'completed' : '')}">
                <span class="step-num">${idx < speakingStep ? '✓' : idx + 1}</span>
                <span>${idx === 0 ? 'Part 1: Intro' : (idx === 1 ? 'Part 2: Challenge' : 'Part 3: Vision')}</span>
              </div>
            `).join('')}
          </div>

          <div class="camera-monitor-card" style="background:#0f172a;border-radius:14px;padding:20px;margin-bottom:24px;max-width:680px;box-shadow:0 8px 24px rgba(0,0,0,0.15)">
            <div style="position:relative;border-radius:10px;overflow:hidden;background:#1e293b;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center">
              <video id="camera-preview" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;display:block"></video>
              ${speakingRecordingState === 'recording' ? `
                <div style="position:absolute;top:12px;left:12px;background:rgba(220,38,38,0.9);color:#fff;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px">
                  <span class="pill-dot" style="background:#fff;animation:pulse-dot 1s infinite"></span> Recording
                </div>
              ` : ''}
            </div>

            <!-- Live Microphone Audio VU Meter -->
            <div style="margin-top:12px;background:#1e293b;padding:8px 14px;border-radius:8px;display:flex;align-items:center;gap:10px">
              <span style="font-size:12px;color:#94a3b8;white-space:nowrap;font-weight:600">🎤 Mic Input:</span>
              <div style="flex:1;background:#334155;height:8px;border-radius:4px;overflow:hidden;position:relative">
                <div id="mic-level-bar" style="width:0%;height:100%;background:#22c55e;transition:width 0.08s ease"></div>
              </div>
              <span id="mic-level-text" style="font-size:11.5px;font-weight:600;color:#94a3b8">Active</span>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap;gap:10px">
              <div>
                <span id="recording-status" style="font-weight:600;font-size:13px;color:${speakingRecordingState === 'recording' ? '#f87171' : (speakingRecordingState === 'stopped' ? '#4ade80' : '#94a3b8')}">
                  ${speakingRecordingState === 'idle' ? 'Camera & Mic Ready — Click Start Recording to begin' : (speakingRecordingState === 'recording' ? '● Recording video, audio & live speech…' : '✓ Recording completed and attached to submission')}
                </span>
              </div>
              <div style="display:flex;gap:10px;align-items:center">
                ${speakingRecordingState === 'idle' ? `
                  <button class="button" id="start-speaking-record-btn" type="button" style="background:#16a34a;padding:9px 18px;font-size:13px">
                    🔴 Start Recording
                  </button>
                ` : ''}
                ${speakingRecordingState === 'recording' && speakingStep === current.questions.length - 1 ? `
                  <button class="button" id="stop-speaking-record-btn" type="button" style="background:#dc2626;padding:9px 18px;font-size:13px">
                    ⏹ Stop Recording
                  </button>
                ` : ''}
              </div>
            </div>
          </div>

          <div class="question" style="margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:gap:8px">
              <span class="eyebrow">Speaking Prompt ${speakingStep + 1} of ${current.questions.length}</span>
              <span class="attempt-pill">${activePrompt.part || 'Speaking Task'}</span>
            </div>
            <p style="font-size:17px;font-weight:700;color:var(--ink);margin:0 0 10px;line-height:1.4">
              ${activePrompt.prompt}
            </p>
            ${activePrompt.guidance ? `
              <div style="font-size:13px;color:var(--muted);background:#f8fafc;padding:10px 14px;border-radius:8px;border-left:3.5px solid var(--blue);margin-bottom:18px;display:flex;align-items:center;gap:8px">
                <span style="color:var(--blue);display:inline-flex">${ICONS.lightbulb}</span>
                <span><strong>Guidance:</strong> ${activePrompt.guidance}</span>
              </div>
            ` : ''}

            <div style="font-size:13px;color:var(--muted);background:#f1f5f9;padding:12px 14px;border-radius:8px;display:flex;align-items:center;gap:8px;margin-bottom:16px">
              <span style="color:var(--blue);display:inline-flex">${ICONS.video}</span>
              <span>Your spoken video and audio are recorded directly for evaluator review. No typing or transcript needed.</span>
            </div>

            ${speakingStep < current.questions.length - 1 ? `
              <div style="display:flex;justify-content:flex-end;margin-top:16px">
                <button class="button" id="speaking-next-prompt-btn" type="button" style="padding:10px 20px">
                  <span>Next Question</span> <span aria-hidden="true">→</span>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else {
      contentHtml = `
        ${current.passage ? `
          <div class="reading-passage-box">
            <div style="font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px">
              <div class="skill-icon-badge skill-icon-reading" style="width:26px;height:26px">${ICONS.book}</div>
              <span>Reading Passage</span>
            </div>
            <div style="line-height:1.7;font-size:14.5px">${current.passage.replace(/\n\n/g, '<br><br>')}</div>
          </div>
        ` : ''}

        <div class="questions-flow">
          ${current.questions.map((question, index) => `
            <div class="question" id="q-wrap-${question.id}">
              <div class="eyebrow" style="margin-bottom:8px">Question ${index + 1} of ${current.questions.length}</div>

              ${question.audioScript ? `
                <div style="margin-bottom:14px">
                  ${playedAudio[question.id] ? `
                    <button class="button button-sm speak-question played" disabled style="background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;cursor:not-allowed;display:inline-flex;align-items:center;gap:6px" type="button">
                      ${ICONS.lock} <span>Audio Played (1/1 Attempt Used)</span>
                    </button>
                  ` : `
                    <button class="button button-sm speak-question" data-qid="${question.id}" data-text="${question.audioScript.replaceAll('"', '&quot;')}" type="button" style="display:inline-flex;align-items:center;gap:6px">
                      ${ICONS.volume2} <span>Play Audio (Single Play Only)</span>
                    </button>
                  `}
                </div>
              ` : ''}

              <p style="font-size:15.5px;font-weight:600;color:var(--ink);margin:0 0 14px;line-height:1.5">${question.prompt}</p>

              ${question.options ? `
                <div class="options-container">
                  ${question.options.map((option) => {
        const isSelected = answers[question.id] === option.trim();
        return `
                      <label class="option-tile ${isSelected ? 'selected' : ''}">
                        <input type="radio" name="${question.id}" value="${option.trim()}" ${isSelected ? 'checked' : ''}>
                        <span>${option}</span>
                      </label>
                    `;
      }).join('')}
                </div>
              ` : `
                <div>
                  <textarea class="writing-input" id="writing-${index}" data-target="${index === 0 ? 600 : 300}" rows="9" placeholder="Compose your written response here…" style="width:100%;border:1px solid var(--line);padding:14px;font:14px 'DM Sans';border-radius:8px;line-height:1.6"></textarea>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;flex-wrap:wrap;gap:8px">
                    <span style="font-size:12px;color:var(--muted)">Recommended: <strong>${index === 0 ? '600–1000' : '300–600'} letters</strong></span>
                    <span class="letter-counter-tag" id="counter-writing-${index}">
                      ${ICONS.penTool}
                      <span>0 letters</span>
                    </span>
                  </div>
                </div>
              `}
            </div>
          `).join('')}
        </div>
      `;
    }

    const canSubmitSpeaking = !speaking || speakingRecordingState === 'stopped';

    app.innerHTML = `
      <div class="teacher-shell">
        <div class="test-stepper">
          ${test.sections.map((sec, idx) => {
      const isDone = idx < sectionIndex;
      const isCurr = idx === sectionIndex;
      return `
              <div class="step-chip ${isCurr ? 'active' : isDone ? 'completed' : ''}">
                <span class="step-num">${isDone ? '✓' : idx + 1}</span>
                <span>${sec.label}</span>
              </div>
            `;
    }).join('')}
        </div>

        <section class="hero">
          <div>
            <div class="eyebrow">Section ${sectionIndex + 1} of ${test.sections.length}</div>
            <h1>${current.label}</h1>
            <p>${current.instructions || 'Answer all questions carefully before proceeding.'}</p>
          </div>
          <div class="hero-note" id="timer-box">
            <strong id="timer">01:00:00</strong>
            <span>Time Remaining</span>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>${current.label} ${speaking ? 'Interview' : 'Questions'}</h2>
            <span class="status">${current.questions.length} ${speaking ? 'interview prompts' : 'questions'} · ${current.durationMinutes} mins allocated</span>
          </div>

          ${contentHtml}

          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:28px;padding-top:20px;border-top:1px solid var(--line)">
            <button class="ghost" id="previous" ${sectionIndex === 0 ? 'hidden' : ''} type="button">
              ← Previous Section
            </button>
            <button class="button" id="next" type="button" ${!canSubmitSpeaking && isLastSection ? 'disabled style="opacity:0.4;cursor:not-allowed" title="Please complete and stop recording before submitting"' : ''} style="margin-left:auto;padding:12px 24px">
              ${isLastSection ? 'Submit Assessment ✓' : 'Next Section →'}
            </button>
          </div>
        </section>
      </div>
    `;

    document.querySelectorAll('.speak-question:not(.played)').forEach((button) => {
      button.onclick = () => {
        const qid = button.dataset.qid;
        if (playedAudio[qid]) return;
        playedAudio[qid] = true;
        button.disabled = true;
        button.classList.add('played');
        button.innerHTML = `${ICONS.volume2} <span>Playing Audio… (Single Play Only)</span>`;
        button.style.background = '#fef3c7';
        button.style.color = '#92400e';
        button.style.borderColor = '#fde68a';

        window.speechSynthesis?.cancel();
        const utterance = new SpeechSynthesisUtterance(button.dataset.text);
        utterance.rate = 0.92;
        utterance.onend = () => {
          button.innerHTML = `${ICONS.lock} <span>Audio Played (1/1 Attempt Used)</span>`;
          button.style.background = '#f1f5f9';
          button.style.color = '#64748b';
          button.style.borderColor = '#cbd5e1';
        };
        utterance.onerror = () => {
          button.innerHTML = `${ICONS.lock} <span>Audio Played (1/1 Attempt Used)</span>`;
          button.style.background = '#f1f5f9';
          button.style.color = '#64748b';
          button.style.borderColor = '#cbd5e1';
        };
        window.speechSynthesis?.speak(utterance);
      };
    });

    document.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.addEventListener('change', () => {
        answers[input.name] = input.value;
        const parentTiles = input.closest('.options-container')?.querySelectorAll('.option-tile');
        parentTiles?.forEach((tile) => tile.classList.remove('selected'));
        input.closest('.option-tile')?.classList.add('selected');
      });
    });

    document.querySelectorAll('.writing-input').forEach((input) => {
      input.value = answers[input.id] || '';
      const updateLetterCount = () => {
        const text = input.value;
        const letters = text.length;
        const target = Number(input.dataset.target) || 300;
        const counter = document.querySelector(`#counter-${input.id}`);
        if (counter) {
          const isGood = letters >= target;
          counter.className = `letter-counter-tag ${isGood ? 'good' : ''}`;
          counter.innerHTML = `${ICONS.penTool} <span>${letters} letter${letters === 1 ? '' : 's'}${isGood ? ' ✓' : ''}</span>`;
        }
      };
      updateLetterCount();
      input.addEventListener('input', () => {
        answers[input.id] = input.value;
        updateLetterCount();
      });
    });

    if (speaking) {
      const preview = document.querySelector('#camera-preview');
      let audioCtx = null;
      let analyser = null;

      function attachAudioVisualizer(stream) {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) return;
          if (!audioCtx || audioCtx.state === 'closed') {
            audioCtx = new AudioContextClass();
          }
          if (audioCtx.state === 'suspended') {
            audioCtx.resume();
          }
          const source = audioCtx.createMediaStreamSource(stream);
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const bar = document.querySelector('#mic-level-bar');
          const txt = document.querySelector('#mic-level-text');
          const buf = new Uint8Array(analyser.frequencyBinCount);

          function meterLoop() {
            if (!analyser || !document.querySelector('#mic-level-bar')) return;
            analyser.getByteFrequencyData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i];
            const avg = sum / buf.length;
            const pct = Math.min(100, Math.round((avg / 80) * 100));
            if (bar) {
              bar.style.width = `${Math.max(4, pct)}%`;
              bar.style.background = pct > 12 ? '#22c55e' : '#64748b';
            }
            if (txt) {
              if (pct > 12) {
                txt.textContent = '● Voice Detected';
                txt.style.color = '#4ade80';
              } else {
                txt.textContent = 'Listening…';
                txt.style.color = '#94a3b8';
              }
            }
            requestAnimationFrame(meterLoop);
          }
          meterLoop();
        } catch (e) {
          console.warn('Audio visualizer error:', e);
        }
      }

      function getSupportedMediaOptions() {
        const types = [
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=h264,opus',
          'video/webm',
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4'
        ];
        for (const type of types) {
          if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) {
            return { mimeType: type, audioBitsPerSecond: 128000, videoBitsPerSecond: 2500000 };
          }
        }
        return {};
      }

      async function setupCameraAndMic() {
        if (mediaStream && mediaStream.active) {
          if (preview) preview.srcObject = mediaStream;
          attachAudioVisualizer(mediaStream);
          return mediaStream;
        }
        if (!navigator.mediaDevices?.getUserMedia) return null;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          mediaStream.getAudioTracks().forEach((track) => { track.enabled = true; });
          if (preview) preview.srcObject = mediaStream;
          attachAudioVisualizer(mediaStream);
          return mediaStream;
        } catch (err) {
          console.warn('Advanced constraints failed, trying basic getUserMedia:', err);
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            mediaStream.getAudioTracks().forEach((track) => { track.enabled = true; });
            if (preview) preview.srcObject = mediaStream;
            attachAudioVisualizer(mediaStream);
            return mediaStream;
          } catch (e2) {
            console.warn('Camera/mic access error:', e2);
            const st = document.querySelector('#recording-status');
            if (st) st.textContent = 'Camera/mic permission unavailable (Text transcript response mode)';
            return null;
          }
        }
      }

      if (preview) {
        if (mediaStream) {
          preview.srcObject = mediaStream;
          attachAudioVisualizer(mediaStream);
        } else {
          setupCameraAndMic();
        }
      }

      const startRecordBtn = document.querySelector('#start-speaking-record-btn');
      if (startRecordBtn) {
        startRecordBtn.onclick = async () => {
          if (!mediaStream) {
            await setupCameraAndMic();
          }
          beginRecording();
        };
      }

      function beginRecording() {
        speakingRecordingState = 'recording';
        recordingStartedAt = Date.now();
        recordingChunks = [];
        if (mediaStream && window.MediaRecorder) {
          try {
            const opts = getSupportedMediaOptions();
            mediaRecorder = new MediaRecorder(mediaStream, opts);
            mediaRecorder.ondataavailable = (e) => { if (e.data.size) recordingChunks.push(e.data); };
            mediaRecorder.start(500);
          } catch (e) { console.warn('MediaRecorder error:', e); }
        }
        draw();
      }

      const nextPromptBtn = document.querySelector('#speaking-next-prompt-btn');
      if (nextPromptBtn) {
        nextPromptBtn.onclick = () => {
          speakingStep = Math.min(speakingStep + 1, current.questions.length - 1);
          draw();
        };
      }

      const stopRecordBtn = document.querySelector('#stop-speaking-record-btn');
      if (stopRecordBtn) {
        stopRecordBtn.onclick = async () => {
          speakingRecordingState = 'stopped';
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            try { mediaRecorder.stop(); } catch { }
          }
          draw();
        };
      }
    }

    document.querySelector('#previous')?.addEventListener('click', async () => {
      await stopMedia();
      sectionIndex -= 1;
      speakingStep = 0;
      draw();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.querySelector('#next').onclick = async () => {
      if (sectionIndex < test.sections.length - 1) {
        await stopMedia();
        sectionIndex += 1;
        speakingStep = 0;
        draw();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const nextBtn = document.querySelector('#next');
      nextBtn.disabled = true;
      nextBtn.textContent = 'Submitting responses…';

      await stopMedia();
      const video = recordingChunks.length ? new Blob(recordingChunks, { type: mediaRecorder?.mimeType || 'video/webm' }) : null;
      let recordingMeta = null;
      if (video) {
        const durationSeconds = Math.round((Date.now() - recordingStartedAt) / 1000);
        try {
          const uploadRes = await fetch(`/api/attempts/${attemptId}/recording`, {
            method: 'POST',
            headers: {
              'Content-Type': video.type,
              'x-duration-seconds': String(durationSeconds)
            },
            body: video
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            recordingMeta = uploadData.recording;
          }
        } catch (e) {
          console.warn('Failed to upload recording:', e);
        }
      }

      const result = await request(`/api/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses: answers,
          writing: ['writing-0', 'writing-1'].map((id) => answers[id] || '').filter(Boolean).join('\n\n') || Object.entries(answers).filter(([k]) => k.startsWith('writing')).map(([, v]) => v).join('\n\n'),
          speakingRecording: recordingMeta
        })
      });

      app.innerHTML = `
        <div class="teacher-shell" style="max-width:680px;margin:60px auto;text-align:center">
          <div class="panel" style="padding:48px 36px">
            <div style="width:64px;height:64px;border-radius:50%;background:#dcfce7;color:#16a34a;display:grid;place-items:center;font-size:32px;margin:0 auto 20px">✓</div>
            <h1 style="font:700 34px 'Space Grotesk';margin:0 0 12px;color:var(--ink)">Assessment Submitted!</h1>
            <p style="color:var(--muted);line-height:1.6;font-size:15px;margin-bottom:24px">
              Your placement responses have been securely recorded. Grammar, Reading, and Listening scores are processed automatically, and your Writing and Speaking submissions are queued for admin rubric review.
            </p>
            <div style="background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:16px;font-size:13px;color:var(--ink);margin-bottom:28px">
              <strong>Attempt Reference:</strong> <code>${attemptId}</code><br>
              <span style="color:var(--muted)">Result will be published to the school administration dashboard.</span>
            </div>
            <button class="button" id="close-test" style="padding:12px 24px">Close Test & Sign Out</button>
          </div>
        </div>
      `;

      document.querySelector('#close-test').onclick = async () => {
        await request('/api/auth/logout', { method: 'POST' });
        renderLogin();
      };
    };

    const end = new Date(expiresAt).getTime();
    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, end - now);
      const timerEl = document.querySelector('#timer');
      const timerBox = document.querySelector('#timer-box');
      if (timerEl) {
        const h = String(Math.floor(left / 3600000)).padStart(2, '0');
        const m = String(Math.floor((left % 3600000) / 60000)).padStart(2, '0');
        const s = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
        timerEl.textContent = `${h}:${m}:${s}`;
        if (left < 600000 && timerBox) {
          timerBox.style.borderColor = '#ef4444';
          timerBox.style.background = '#fef2f2';
          timerEl.style.color = '#dc2626';
        }
      }
      if (left && timerEl) setTimeout(tick, 1000);
    };
    tick();
  };
  draw();
}

const getStoredAdminTab = () => {
  const hash = window.location.hash.replace('#', '').trim();
  if (['results', 'questions', 'rubrics'].includes(hash)) return hash;
  const stored = localStorage.getItem('assessify_admin_tab');
  if (['results', 'questions', 'rubrics'].includes(stored)) return stored;
  return 'results';
};

const adminState = {
  activeTab: getStoredAdminTab(),
  stagedQuestions: null,
  stagedRubrics: null
};

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '').trim();
  if (['results', 'questions', 'rubrics'].includes(hash) && adminState.activeTab !== hash) {
    renderAdmin(hash);
  }
});

async function renderAdmin(tab) {
  if (!tab || !['results', 'questions', 'rubrics'].includes(tab)) {
    tab = getStoredAdminTab();
  }
  adminState.activeTab = tab;
  localStorage.setItem('assessify_admin_tab', tab);
  if (window.location.hash !== `#${tab}`) {
    history.replaceState(null, '', `#${tab}`);
  }

  // Render base shell with sidebar
  app.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div>
          <div class="sidebar-title">Main Menu</div>
          <nav class="sidebar-nav">
            <button class="sidebar-btn ${tab === 'results' ? 'active' : ''}" id="nav-results" type="button">
              <span class="sidebar-icon">${ICONS.results}</span>
              <span>Teacher Results</span>
            </button>
            <button class="sidebar-btn ${tab === 'questions' ? 'active' : ''}" id="nav-questions" type="button">
              <span class="sidebar-icon">${ICONS.questions}</span>
              <span>Question Bank</span>
              ${adminState.stagedQuestions ? '<span class="sidebar-badge" style="background:#f59e0b">Draft</span>' : ''}
            </button>
            <button class="sidebar-btn ${tab === 'rubrics' ? 'active' : ''}" id="nav-rubrics" type="button">
              <span class="sidebar-icon">${ICONS.rubrics}</span>
              <span>Rubrics Management</span>
              ${adminState.stagedRubrics ? '<span class="sidebar-badge" style="background:#f59e0b">Draft</span>' : ''}
            </button>
          </nav>
        </div>
        <div style="margin-top:auto;padding-top:16px;border-top:1px solid var(--line);font-size:12px;color:var(--muted);text-align:center">
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;color:var(--ink);margin-bottom:2px">
            <span>Karya Bangsa School</span>
          </div>
          <div>English Assessment</div>
        </div>
      </aside>
      <main class="admin-main" id="admin-content">
        <p style="color:var(--muted)">Loading workspace…</p>
      </main>
    </div>
  `;

  document.querySelector('#nav-results').onclick = () => renderAdmin('results');
  document.querySelector('#nav-questions').onclick = () => renderAdmin('questions');
  document.querySelector('#nav-rubrics').onclick = () => renderAdmin('rubrics');

  const mainContainer = document.querySelector('#admin-content');

  if (tab === 'results') {
    await renderAdminResultsTab(mainContainer);
  } else if (tab === 'questions') {
    await renderAdminQuestionsTab(mainContainer);
  } else if (tab === 'rubrics') {
    await renderAdminRubricsTab(mainContainer);
  }
}

async function renderAdminResultsTab(container) {
  const data = await request('/api/admin/results');
  if (data.error) return renderLogin();

  const completedCount = data.results.filter((item) => item.status === 'Completed').length;
  const pendingCount = data.results.filter((item) => item.review === 'Pending' || item.review?.includes('required')).length;

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:24px">
      <div>
        <div class="eyebrow">School Administration</div>
        <h1 style="font:700 32px 'Space Grotesk';margin:6px 0 4px;color:var(--ink)">Teacher Assessments & Results</h1>
        <p style="color:var(--muted);font-size:14px;margin:0">Monitor diagnostic placement progress and evaluate candidate responses across Karya Bangsa School.</p>
      </div>
      <div class="admin-toolbar">
        <a class="btn-icon" id="export-excel-btn" href="/api/admin/results/export?format=xlsx" title="Download Excel spreadsheet">
          ${ICONS.excel} <span>Export Excel</span>
        </a>
        <a class="btn-icon" id="export-pdf-btn" href="/api/admin/results/export?format=pdf" title="Download PDF report">
          ${ICONS.pdf} <span>Export PDF</span>
        </a>
      </div>
    </div>

    <!-- 3-Column KPI Grid -->
    <div class="admin-kpis-grid">
      <div class="kpi-card kpi-indigo">
        <div class="kpi-card-info">
          <strong>${data.total}</strong>
          <span>Total Attempts</span>
        </div>
        <div class="kpi-card-icon">${ICONS.fileText}</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-card-info">
          <strong>${completedCount}</strong>
          <span>Completed Tests</span>
        </div>
        <div class="kpi-card-icon">${ICONS.checkCircle}</div>
      </div>
      <div class="kpi-card kpi-amber">
        <div class="kpi-card-info">
          <strong>${pendingCount}</strong>
          <span>Pending Review</span>
        </div>
        <div class="kpi-card-icon">${ICONS.clock}</div>
      </div>
    </div>

    <!-- Teacher Results Table Card -->
    <div class="panel" style="padding:24px 28px">
      <!-- Bulk Actions Bar (Shown when candidates are selected) -->
      <div class="bulk-actions-bar" id="bulk-actions-bar" style="display:none">
        <div class="bulk-selected-info">
          <span class="bulk-count-badge" id="bulk-selected-count">0</span>
          <span>candidate(s) selected</span>
        </div>
        <div class="bulk-actions-btns">
          <button type="button" class="btn-bulk-export" id="bulk-export-excel-btn" title="Export only selected candidates to Excel">
            ${ICONS.excel} <span>Export Selected (Excel)</span>
          </button>
          <button type="button" class="btn-bulk-export" id="bulk-export-pdf-btn" title="Export only selected candidates to PDF">
            ${ICONS.pdf} <span>Export Selected (PDF)</span>
          </button>
          <button type="button" class="btn-bulk-delete" id="bulk-delete-btn" title="Delete selected candidate records">
            ${ICONS.trash} <span>Delete Selected</span>
          </button>
          <button type="button" class="btn-bulk-cancel" id="bulk-deselect-btn" title="Clear selection">✕</button>
        </div>
      </div>

      <div class="table-toolbar">
        <div class="search-wrap">
          <span class="search-icon-prefix">${ICONS.search}</span>
          <input id="search" placeholder="Search by teacher name, email, or attempt ID…">
        </div>
        <select class="select-filter" id="unit-filter" style="min-width:160px">
          <option value="">All Units</option>
          <option value="KB-TK GOLDEN BEE">KB-TK GOLDEN BEE</option>
          <option value="SD KARYA BANGSA">SD KARYA BANGSA</option>
          <option value="SMP KARYA BANGSA">SMP KARYA BANGSA</option>
          <option value="SMA KARYA BANGSA">SMA KARYA BANGSA</option>
          <option value="SMK KARYA BANGSA">SMK KARYA BANGSA</option>
        </select>
        <select class="select-filter" id="status">
          <option value="">All Statuses</option>
          <option value="Completed">Completed</option>
          <option value="In progress">In progress</option>
        </select>
        <select class="select-filter" id="review-filter">
          <option value="">All Reviews</option>
          <option value="Pending">Review required</option>
          <option value="Teacher reviewed">Teacher reviewed</option>
        </select>
      </div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th style="width:40px;text-align:center;padding:12px 8px">
                <input type="checkbox" id="select-all-attempts" class="custom-table-checkbox" title="Select all visible candidates">
              </th>
              <th style="width:24%">Teacher Candidate</th>
              <th style="width:16%">School Unit</th>
              <th style="width:10%">Attempt ID</th>
              <th style="width:11%">Started</th>
              <th style="width:11%">Status</th>
              <th style="width:10%">Overall Band</th>
              <th style="width:11%">Review Status</th>
              <th style="width:14%;text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody id="results">${renderTableRows(data.results)}</tbody>
        </table>
      </div>
    </div>
  `;

  function renderTableRows(list) {
    if (!list || !list.length) {
      return `
        <tr>
          <td colspan="9" style="text-align:center;padding:48px 16px;color:var(--muted)">
            <div style="font-size:32px;margin-bottom:8px">👥</div>
            <div style="font-weight:700;font-size:15px;color:var(--ink)">No Teacher Assessments Found</div>
            <div style="font-size:13px;color:var(--muted);margin-top:4px">Try adjusting your search or unit filter, or wait for candidate submissions.</div>
          </td>
        </tr>
      `;
    }
    return list.map(renderRow).join('');
  }

  const filter = () => {
    const query = (document.querySelector('#search')?.value || '').toLowerCase();
    const selectedUnit = document.querySelector('#unit-filter')?.value || '';
    const selectedStatus = document.querySelector('#status')?.value || '';
    const selectedReview = document.querySelector('#review-filter')?.value || '';
    const filtered = data.results.filter((row) => {
      const matchUnit = !selectedUnit || (row.unit || '').trim().toLowerCase() === selectedUnit.trim().toLowerCase();
      const matchStatus = !selectedStatus || row.status === selectedStatus;
      const matchReview = !selectedReview || (selectedReview === 'Pending' ? (row.review === 'Pending' || row.review?.includes('required')) : row.review === selectedReview);
      const matchQuery = !query || `${row.teacher} ${row.email || ''} ${row.unit || ''} ${row.id}`.toLowerCase().includes(query);
      return matchUnit && matchStatus && matchReview && matchQuery;
    });
    document.querySelector('#results').innerHTML = renderTableRows(filtered);

    // Update export links dynamically to reflect the active Unit filter
    const excelBtn = document.querySelector('#export-excel-btn');
    const pdfBtn = document.querySelector('#export-pdf-btn');
    const unitParam = selectedUnit ? `&unit=${encodeURIComponent(selectedUnit)}` : '';
    if (excelBtn) excelBtn.href = `/api/admin/results/export?format=xlsx${unitParam}`;
    if (pdfBtn) pdfBtn.href = `/api/admin/results/export?format=pdf${unitParam}`;

    bindDetails();
  };

  document.querySelector('#search').oninput = filter;
  document.querySelector('#unit-filter').onchange = filter;
  document.querySelector('#status').onchange = filter;
  document.querySelector('#review-filter').onchange = filter;
  bindDetails();
}

async function renderAdminQuestionsTab(container) {
  let questionsData = adminState.stagedQuestions;
  const isStaged = Boolean(questionsData);

  if (!questionsData) {
    questionsData = await request('/api/admin/questions');
    if (questionsData.error) return showToast(questionsData.error, 'error');
  }

  const totalQuestions = (questionsData.sections || []).reduce((sum, s) => sum + (s.questions ? s.questions.length : 0), 0);

  container.innerHTML = `
    ${isStaged ? `
      <div class="staged-review-banner">
        <div class="staged-banner-info">
          <div class="staged-banner-icon">${ICONS.alertTriangle}</div>
          <div>
            <h3 class="staged-banner-title">Questions Draft Staged for Review</h3>
            <p class="staged-banner-desc">You are reviewing a draft upload containing <strong>${questionsData.sections?.length || 0} sections</strong> and <strong>${totalQuestions} questions</strong>. Review below and approve to make live.</p>
          </div>
        </div>
        <div class="staged-banner-actions">
          <button class="btn-discard" id="discard-questions-draft" type="button">${ICONS.x} <span>Discard Draft</span></button>
          <button class="btn-approve" id="approve-questions-draft" type="button">${ICONS.check} <span>Approve & Publish</span></button>
        </div>
      </div>
    ` : ''}

    <div class="content-header-card">
      <div>
        <div class="eyebrow">${isStaged ? 'Draft Preview' : 'Active Test Content'}</div>
        <h1 style="font:700 28px 'Space Grotesk';margin:4px 0">${questionsData.title || 'Placement Question Bank'}</h1>
        <p style="color:var(--muted);margin:0;font-size:14px">Version: <strong>${questionsData.version || '2026.2'}</strong> · Total Duration: <strong>${questionsData.durationMinutes || 60} minutes</strong> · Total Questions: <strong>${totalQuestions}</strong></p>
      </div>
      <div class="admin-toolbar">
        <div class="file-upload-wrapper">
          <label class="file-upload-label" for="questions-upload-input">${ICONS.upload} <span>Choose Questions JSON</span>
            <input type="file" id="questions-upload-input" accept=".json">
          </label>
        </div>
      </div>
    </div>

    <div class="sections-preview">
      ${(questionsData.sections || []).map((sec, secIdx) => `
        <div class="section-group-card">
          <div class="section-group-header">
            <h3 class="section-group-title">
              <div class="skill-icon-badge ${sec.label === 'Writing' ? 'skill-icon-writing' : (sec.label === 'Speaking' ? 'skill-icon-speaking' : (sec.label === 'Reading' ? 'skill-icon-reading' : (sec.label === 'Listening' ? 'skill-icon-listening' : 'skill-icon-grammar')))}" style="width:30px;height:30px">${sectionIcons[sec.label] || ICONS.fileText}</div>
              <span>Section ${secIdx + 1}: ${sec.label}</span>
              <span class="pill">${sec.questions?.length || 0} items</span>
              <span class="pill pending">${sec.durationMinutes || 0} mins</span>
            </h3>
          </div>
          ${sec.passage ? `
            <div style="background:var(--blue-soft);padding:16px 24px;border-bottom:1px solid var(--line);font-size:13px;line-height:1.6;color:var(--ink)">
              <strong>Reading Passage:</strong><br>${sec.passage}
            </div>
          ` : ''}
          <div class="questions-list">
            ${(sec.questions || []).map((q, qIdx) => `
              <div class="question-item-card">
                <div class="question-item-header">
                  <span class="question-num-tag">Q${qIdx + 1} · ${q.type || 'standard'}</span>
                  ${q.audioScript ? `<span class="pill success" style="display:inline-flex;align-items:center;gap:5px">${ICONS.headphones} Audio Script Included</span>` : ''}
                </div>
                <p class="question-item-prompt">${q.prompt}</p>
                ${q.options ? `
                  <div class="options-preview-grid">
                    ${q.options.map((opt) => {
    const isCorrect = String(opt).trim().toLowerCase() === String(q.answer).trim().toLowerCase();
    return `<div class="option-preview-pill ${isCorrect ? 'is-correct' : ''}">${opt}</div>`;
  }).join('')}
                  </div>
                ` : `
                  <div style="font-size:12px;color:var(--muted);background:#f8fafc;padding:8px 12px;border-radius:6px;border:1px dashed var(--line)">
                    Open-ended submission prompt (Candidate responds in writing/speech).
                  </div>
                `}
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Bind file upload for staged review
  const fileInput = document.querySelector('#questions-upload-input');
  if (fileInput) {
    fileInput.onchange = async () => {
      if (!fileInput.files.length) return;
      const file = fileInput.files[0];
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
          showToast('Invalid JSON: Must contain a "sections" array.', 'error');
          return;
        }
        adminState.stagedQuestions = parsed;
        showToast(`Staged draft loaded from "${file.name}". Please review below.`, 'info');
        renderAdmin('questions');
      } catch (e) {
        showToast('Failed to parse JSON file. Please ensure it is valid JSON.', 'error');
      }
    };
  }

  // Bind Staged actions
  const discardBtn = document.querySelector('#discard-questions-draft');
  if (discardBtn) {
    discardBtn.onclick = () => {
      adminState.stagedQuestions = null;
      showToast('Draft discarded.', 'info');
      renderAdmin('questions');
    };
  }

  const approveBtn = document.querySelector('#approve-questions-draft');
  if (approveBtn) {
    approveBtn.onclick = async () => {
      approveBtn.disabled = true;
      approveBtn.innerHTML = 'Publishing…';
      const res = await request('/api/admin/questions/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminState.stagedQuestions)
      });
      if (res.error) {
        showToast(`Error: ${res.error}`, 'error');
        approveBtn.disabled = false;
        approveBtn.innerHTML = `${ICONS.check} <span>Approve & Publish</span>`;
      } else {
        adminState.stagedQuestions = null;
        showToast('✓ Questions successfully approved and published live!', 'success');
        renderAdmin('questions');
      }
    };
  }
}

async function renderAdminRubricsTab(container) {
  let rubricsData = adminState.stagedRubrics;
  const isStaged = Boolean(rubricsData);

  if (!rubricsData) {
    rubricsData = await request('/api/admin/rubrics');
    if (rubricsData.error) return showToast(rubricsData.error, 'error');
  }

  container.innerHTML = `
    ${isStaged ? `
      <div class="staged-review-banner">
        <div class="staged-banner-info">
          <div class="staged-banner-icon">⚠️</div>
          <div>
            <h3 class="staged-banner-title">Rubrics Draft Staged for Review</h3>
            <p class="staged-banner-desc">You are reviewing a draft upload for <strong>Writing & Speaking CEFR Rubrics</strong>. Review below and approve to make live.</p>
          </div>
        </div>
        <div class="staged-banner-actions">
          <button class="btn-discard" id="discard-rubrics-draft" type="button">${ICONS.x} <span>Discard Draft</span></button>
          <button class="btn-approve" id="approve-rubrics-draft" type="button">${ICONS.check} <span>Approve & Publish</span></button>
        </div>
      </div>
    ` : ''}

    <div class="content-header-card">
      <div>
        <div class="eyebrow">${isStaged ? 'Draft Preview' : 'Active Evaluation Standard'}</div>
        <h1 style="font:700 28px 'Space Grotesk';margin:4px 0">${rubricsData.title || 'Teacher Placement CEFR Rubrics'}</h1>
        <p style="color:var(--muted);margin:0;font-size:14px">Version: <strong>${rubricsData.version || '2026.2'}</strong> · Scale: <strong>${rubricsData.bandScale?.range || 'A1–B2'}</strong></p>
      </div>
      <div class="admin-toolbar">
        <div class="file-upload-wrapper">
          <label class="file-upload-label" for="rubrics-upload-input">
            ${ICONS.upload} <span>Choose Rubrics JSON</span>
            <input type="file" id="rubrics-upload-input" accept=".json">
          </label>
        </div>
      </div>
    </div>

    <!-- 1. Listening Rubric -->
    <div class="rubric-skill-card">
      <div class="rubric-skill-title">
        <div class="rubric-title-wrap">
          <div class="skill-icon-badge skill-icon-listening">${ICONS.headphones}</div>
          <span>${rubricsData.listening?.title || 'Listening Comprehension Rubric'}</span>
        </div>
        <span class="pill success rubric-pill-badge">15 Items · Auto-Scored</span>
      </div>
      <p style="color:var(--muted);font-size:13px;margin:0 0 12px;word-break:break-word"><strong>Format:</strong> ${rubricsData.listening?.format || '15 Objective Audio Prompts (15 Mins)'} · <strong>Thresholds:</strong> ${rubricsData.listening?.thresholds || 'A1: 0–5 | A2: 6–8 | B1: 9–11 | B2: 12–14 | C1: 15 / 15'}</p>
      <div class="rubric-criteria-grid">
        ${(rubricsData.listening?.criteria || []).map((c) => `
          <div class="criterion-card criterion-card-listening">
            <div class="criterion-card-title">${c.name}</div>
            <p class="criterion-card-desc">${c.description}</p>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 2. Grammar & Vocabulary Rubric -->
    <div class="rubric-skill-card">
      <div class="rubric-skill-title">
        <div class="rubric-title-wrap">
          <div class="skill-icon-badge skill-icon-grammar">${ICONS.edit}</div>
          <span>${rubricsData.grammarVocabulary?.title || 'Grammar & Vocabulary Rubric'}</span>
        </div>
        <span class="pill success rubric-pill-badge">20 Items · Auto-Scored</span>
      </div>
      <p style="color:var(--muted);font-size:13px;margin:0 0 12px;word-break:break-word"><strong>Format:</strong> ${rubricsData.grammarVocabulary?.format || '20 Contextual Questions (15 Mins)'} · <strong>Thresholds:</strong> ${rubricsData.grammarVocabulary?.thresholds || 'A1: 0–7 | A2: 8–11 | B1: 12–15 | B2: 16–18 | C1: 19–20 / 20'}</p>
      <div class="rubric-criteria-grid">
        ${(rubricsData.grammarVocabulary?.criteria || []).map((c) => `
          <div class="criterion-card criterion-card-grammar">
            <div class="criterion-card-title">${c.name}</div>
            <p class="criterion-card-desc">${c.description}</p>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 3. Reading Rubric -->
    <div class="rubric-skill-card">
      <div class="rubric-skill-title">
        <div class="rubric-title-wrap">
          <div class="skill-icon-badge skill-icon-reading">${ICONS.book}</div>
          <span>${rubricsData.reading?.title || 'Reading Comprehension Rubric'}</span>
        </div>
        <span class="pill success rubric-pill-badge">15 Items · Auto-Scored</span>
      </div>
      <p style="color:var(--muted);font-size:13px;margin:0 0 12px;word-break:break-word"><strong>Format:</strong> ${rubricsData.reading?.format || '15 Passage Items (20 Mins)'} · <strong>Thresholds:</strong> ${rubricsData.reading?.thresholds || 'A1: 0–5 | A2: 6–8 | B1: 9–11 | B2: 12–14 | C1: 15 / 15'}</p>
      <div class="rubric-criteria-grid">
        ${(rubricsData.reading?.criteria || []).map((c) => `
          <div class="criterion-card criterion-card-reading">
            <div class="criterion-card-title">${c.name}</div>
            <p class="criterion-card-desc">${c.description}</p>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 4. Writing Rubric -->
    <div class="rubric-skill-card">
      <div class="rubric-skill-title">
        <div class="rubric-title-wrap">
          <div class="skill-icon-badge skill-icon-writing">${ICONS.penTool}</div>
          <span>${rubricsData.writing?.title || 'Writing Evaluation Criteria'}</span>
        </div>
        <span class="pill success rubric-pill-badge">4 Criteria · Max 20 pts</span>
      </div>
      <p style="color:var(--muted);font-size:13px;margin:0 0 16px;word-break:break-word">${rubricsData.writing?.weight || 'Administrator scores each criterion from 1 (A1) to 5 (C1).'}</p>
      <div class="rubric-criteria-grid">
        ${(rubricsData.writing?.criteria || []).map((c) => `
          <div class="criterion-card criterion-card-writing">
            <div class="criterion-card-title">${c.name}</div>
            <p class="criterion-card-desc">${c.description}</p>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 5. Speaking Rubric -->
    <div class="rubric-skill-card">
      <div class="rubric-skill-title">
        <div class="rubric-title-wrap">
          <div class="skill-icon-badge skill-icon-speaking">${ICONS.mic}</div>
          <span>${rubricsData.speaking?.title || 'Speaking Evaluation Criteria'}</span>
        </div>
        <span class="pill success rubric-pill-badge">4 Criteria · Max 20 pts</span>
      </div>
      <p style="color:var(--muted);font-size:13px;margin:0 0 16px;word-break:break-word">${rubricsData.speaking?.weight || 'Administrator scores each criterion from 1 (A1) to 5 (C1).'}</p>
      <div class="rubric-criteria-grid">
        ${(rubricsData.speaking?.criteria || []).map((c) => `
          <div class="criterion-card criterion-card-speaking">
            <div class="criterion-card-title">${c.name}</div>
            <p class="criterion-card-desc">${c.description}</p>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- CEFR Placement Band Mapping Table (A1 to C1) -->
    <div class="rubric-skill-card" style="background:#f8fafc">
      <h3 style="font:700 18px 'Space Grotesk';margin:0 0 8px;color:var(--blue-dark);display:flex;align-items:center;gap:10px">
        <div class="skill-icon-badge skill-icon-award" style="width:30px;height:30px">${ICONS.award}</div>
        <span>CEFR Placement Band Mapping Standards (A1 to C1)</span>
      </h3>
      <p style="color:var(--muted);font-size:13px;margin:0 0 16px">Complete standard mapping breakdown across all 5 skills and administrative evaluation rubrics:</p>
      
      <div class="table-responsive" style="background:#ffffff;border:1px solid var(--line);border-radius:10px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#0f274a;color:#ffffff">
              <th style="padding:12px 16px;text-align:left">CEFR Band</th>
              <th style="padding:12px 16px;text-align:left">Listening (15 Items)</th>
              <th style="padding:12px 16px;text-align:left">Grammar & Vocab (20 Items)</th>
              <th style="padding:12px 16px;text-align:left">Reading (15 Items)</th>
              <th style="padding:12px 16px;text-align:left">Writing & Speaking Rubric (4–20 Pts)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #e2e8f0">
              <td style="padding:12px 16px"><span class="cefr-badge c1" style="font-size:12px">C1 Advanced</span></td>
              <td style="padding:12px 16px;font-weight:600">15 / 15 (100%)</td>
              <td style="padding:12px 16px;font-weight:600">19–20 / 20 (95–100%)</td>
              <td style="padding:12px 16px;font-weight:600">15 / 15 (100%)</td>
              <td style="padding:12px 16px;font-weight:600">18–20 Pts (Criteria avg ≥ 4.5)</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;background:#fbfdff">
              <td style="padding:12px 16px"><span class="cefr-badge b2" style="font-size:12px">B2 Upper-Int</span></td>
              <td style="padding:12px 16px">12–14 / 15</td>
              <td style="padding:12px 16px">16–18 / 20</td>
              <td style="padding:12px 16px">12–14 / 15</td>
              <td style="padding:12px 16px">14–17 Pts (Criteria avg 3.5–4.25)</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0">
              <td style="padding:12px 16px"><span class="cefr-badge b1" style="font-size:12px">B1 Intermediate</span></td>
              <td style="padding:12px 16px">9–11 / 15</td>
              <td style="padding:12px 16px">12–15 / 20</td>
              <td style="padding:12px 16px">9–11 / 15</td>
              <td style="padding:12px 16px">10–13 Pts (Criteria avg 2.5–3.25)</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;background:#fbfdff">
              <td style="padding:12px 16px"><span class="cefr-badge a2" style="font-size:12px">A2 Elementary</span></td>
              <td style="padding:12px 16px">6–8 / 15</td>
              <td style="padding:12px 16px">8–11 / 20</td>
              <td style="padding:12px 16px">6–8 / 15</td>
              <td style="padding:12px 16px">7–9 Pts (Criteria avg 1.75–2.25)</td>
            </tr>
            <tr>
              <td style="padding:12px 16px"><span class="cefr-badge a1" style="font-size:12px">A1 Beginner</span></td>
              <td style="padding:12px 16px">0–5 / 15</td>
              <td style="padding:12px 16px">0–7 / 20</td>
              <td style="padding:12px 16px">0–5 / 15</td>
              <td style="padding:12px 16px">4–6 Pts (Criteria avg 1.0–1.5)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style="color:var(--muted);font-size:12px;margin:12px 0 0"><em>Source: ${rubricsData.source || 'Official IELTS / CEFR Guidance Standards'}</em></p>
    </div>
  `;

  // Bind file upload for staged review
  const fileInput = document.querySelector('#rubrics-upload-input');
  if (fileInput) {
    fileInput.onchange = async () => {
      if (!fileInput.files.length) return;
      const file = fileInput.files[0];
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed.writing || !parsed.speaking) {
          showToast('Invalid JSON: Must contain "writing" and "speaking" configuration.', 'error');
          return;
        }
        adminState.stagedRubrics = parsed;
        showToast(`Staged draft loaded from "${file.name}". Please review below.`, 'info');
        renderAdmin('rubrics');
      } catch (e) {
        showToast('Failed to parse JSON file. Please ensure it is valid JSON.', 'error');
      }
    };
  }

  // Bind Staged actions
  const discardBtn = document.querySelector('#discard-rubrics-draft');
  if (discardBtn) {
    discardBtn.onclick = () => {
      adminState.stagedRubrics = null;
      showToast('Draft discarded.', 'info');
      renderAdmin('rubrics');
    };
  }

  const approveBtn = document.querySelector('#approve-rubrics-draft');
  if (approveBtn) {
    approveBtn.onclick = async () => {
      approveBtn.disabled = true;
      approveBtn.textContent = 'Publishing…';
      const res = await request('/api/admin/rubrics/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminState.stagedRubrics)
      });
      if (res.error) {
        showToast(`Error: ${res.error}`, 'error');
        approveBtn.disabled = false;
        approveBtn.innerHTML = `${ICONS.check} <span>Approve & Publish</span>`;
      } else {
        adminState.stagedRubrics = null;
        showToast('✓ Rubrics successfully approved and published live!', 'success');
        renderAdmin('rubrics');
      }
    };
  }
}

function renderRow(row) {
  const isPendingReview = row.review === 'Pending' || row.review?.includes('required');
  const reviewPillClass = isPendingReview ? 'pill pending' : (row.review === 'Teacher reviewed' ? 'pill success' : 'pill');
  const reviewLabel = isPendingReview ? 'Review required' : (row.review || 'Pending');
  const statusPillClass = row.status === 'Completed' ? 'pill success' : 'pill in-progress';
  const initial = (row.teacher || 'T').charAt(0).toUpperCase();

  return `
    <tr id="row-${row.id}">
      <td style="text-align:center;padding:12px 8px">
        <input type="checkbox" class="attempt-row-checkbox custom-table-checkbox" data-id="${row.id}" data-name="${(row.teacher || '').replaceAll('"', '&quot;')}" title="Select ${row.teacher}">
      </td>
      <td>
        <div class="teacher-cell">
          <div class="teacher-avatar-sm">${initial}</div>
          <div>
            <div class="teacher-meta-name">${row.teacher}</div>
            <div class="teacher-meta-email">${row.email || 'Teacher account'}</div>
          </div>
        </div>
      </td>
      <td>
        <span class="unit-pill">${row.unit || 'SD KARYA BANGSA'}</span>
      </td>
      <td><span class="attempt-pill">${row.id}</span></td>
      <td style="color:var(--muted);font-size:13px">${new Date(row.startedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td>
        <span class="${statusPillClass}">
          <span class="pill-dot"></span>
          ${row.status}
        </span>
      </td>
      <td>
        ${row.overall ? `<span class="cefr-tag ${getLevelBadgeClass(row.overall)}">${row.overall}</span>` : '<span style="color:var(--muted)">—</span>'}
      </td>
      <td>
        <span class="${reviewPillClass}">
          <span class="pill-dot"></span>
          ${reviewLabel}
        </span>
      </td>
      <td style="text-align:right">
        <div class="action-btn-group" style="justify-content:flex-end">
          <button class="btn-grade ${isPendingReview ? '' : 'view-grade'} details" data-id="${row.id}" type="button" title="${isPendingReview ? 'Grade Candidate Rubric' : 'View or Edit Grade'}">
            ${isPendingReview ? ICONS.grade : ICONS.eye}
            <span>${isPendingReview ? 'Grade Rubric' : 'View / Edit'}</span>
          </button>
          <button class="btn-delete-ghost delete-btn" data-id="${row.id}" data-name="${(row.teacher || '').replaceAll('"', '&quot;')}" type="button" title="Delete attempt">
            ${ICONS.trash}
          </button>
        </div>
      </td>
    </tr>
  `;
}

function openBulkDeleteModal(selectedIds, selectedNames) {
  const modalContainer = document.querySelector('#modal-root') || document.body;
  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="delete-modal-backdrop" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;backdrop-filter:blur(4px)">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:480px;background:#ffffff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;padding:0">
        <div style="padding:28px 24px 20px;text-align:center">
          <div class="modal-icon-danger" style="width:56px;height:56px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:22px;margin:0 auto 16px">
            ${ICONS.trash}
          </div>
          <h3 style="font:700 20px 'Space Grotesk';color:var(--ink);margin:0 0 8px">Delete ${selectedIds.length} Assessment Records?</h3>
          <p style="font-size:14px;color:var(--muted);margin:0;line-height:1.5">
            Are you sure you want to permanently delete <strong>${selectedIds.length} candidate attempts</strong>?
          </p>
          <div style="max-height:100px;overflow-y:auto;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin:12px 0 0;font-size:12px;text-align:left;color:var(--ink)">
            ${selectedNames.map((n, i) => `<div>• <strong>${n}</strong> (${selectedIds[i]})</div>`).join('')}
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12px;padding:10px 12px;border-radius:8px;margin-top:14px;text-align:left;display:flex;align-items:flex-start;gap:8px">
            <span style="flex-shrink:0;color:#dc2626">${ICONS.alertTriangle}</span>
            <span><strong>Warning:</strong> All answers, scores, and recordings for these candidates will be permanently erased. This cannot be undone.</span>
          </div>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="modal-cancel-delete" type="button" style="padding:8px 16px;font-size:13px">Cancel</button>
          <button class="button" id="bulk-delete-confirm-btn" type="button" style="background:#dc2626;border-color:#dc2626;color:#ffffff;padding:8px 18px;font-size:13px;font-weight:600">
            ${ICONS.trash} <span>Yes, Delete ${selectedIds.length} Records</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => {
    modalContainer.innerHTML = '';
  };

  document.querySelector('#modal-cancel-delete').onclick = closeModal;
  const backdrop = document.querySelector('#delete-modal-backdrop');
  if (backdrop) backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };

  document.querySelector('#bulk-delete-confirm-btn').onclick = async () => {
    const btn = document.querySelector('#bulk-delete-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Deleting…';

    const res = await request('/api/admin/results/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds })
    });
    closeModal();
    if (res.error) {
      showToast(`Error: ${res.error}`, 'error');
    } else {
      showToast(`✓ ${selectedIds.length} candidate attempts deleted successfully.`, 'success');
      renderAdmin();
    }
  };
}

function openDeleteModal(attemptId, teacherName) {
  const modalContainer = document.querySelector('#modal-root') || document.body;
  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="delete-modal-backdrop" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;backdrop-filter:blur(4px)">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:440px;background:#ffffff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;padding:0">
        <div style="padding:28px 24px 20px;text-align:center">
          <div class="modal-icon-danger" style="width:56px;height:56px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:22px;margin:0 auto 16px">
            ${ICONS.trash}
          </div>
          <h3 style="font:700 20px 'Space Grotesk';color:var(--ink);margin:0 0 8px">Delete Assessment Record?</h3>
          <p style="font-size:14px;color:var(--muted);margin:0;line-height:1.5">
            Are you sure you want to permanently delete attempt <strong style="color:var(--ink)">${attemptId}</strong>${teacherName ? ` for <strong>${teacherName}</strong>` : ''}?
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12px;padding:10px 12px;border-radius:8px;margin-top:16px;text-align:left;display:flex;align-items:flex-start;gap:8px">
            <span style="flex-shrink:0;color:#dc2626">${ICONS.alertTriangle}</span>
            <span><strong>Warning:</strong> This will permanently erase all test answers, grading rubrics, and video recordings. This action cannot be undone.</span>
          </div>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="modal-cancel-delete" type="button" style="padding:8px 16px;font-size:13px">Cancel</button>
          <button class="button" id="delete-confirm-btn" type="button" style="background:#dc2626;border-color:#dc2626;color:#ffffff;padding:8px 18px;font-size:13px;font-weight:600">
            ${ICONS.trash} <span>Delete Permanently</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => {
    modalContainer.innerHTML = '';
  };

  document.querySelector('#modal-cancel-delete').onclick = closeModal;
  const backdrop = document.querySelector('#delete-modal-backdrop');
  if (backdrop) {
    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeModal();
    };
  }

  document.querySelector('#delete-confirm-btn').onclick = async () => {
    const btn = document.querySelector('#delete-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Deleting…';

    const res = await request(`/api/admin/results/${attemptId}`, { method: 'DELETE' });
    closeModal();
    if (res.error) {
      showToast(`Error: ${res.error}`, 'error');
    } else {
      showToast(`Attempt ${attemptId} deleted successfully.`, 'success');
      renderAdmin();
    }
  };
}

function bindDetails() {
  document.querySelectorAll('.details').forEach((button) => {
    button.onclick = (e) => {
      e.preventDefault();
      openGradingModal(button.dataset.id);
    };
  });
  document.querySelectorAll('.delete-btn').forEach((button) => {
    button.onclick = (e) => {
      e.preventDefault();
      openDeleteModal(button.dataset.id, button.dataset.name);
    };
  });

  // Checkbox selection and bulk actions
  const selectAllCheckbox = document.querySelector('#select-all-attempts');
  const rowCheckboxes = document.querySelectorAll('.attempt-row-checkbox');
  const bulkBar = document.querySelector('#bulk-actions-bar');
  const bulkCountBadge = document.querySelector('#bulk-selected-count');

  const syncSelection = () => {
    const checked = Array.from(document.querySelectorAll('.attempt-row-checkbox:checked'));
    if (!checked.length) {
      if (bulkBar) bulkBar.style.display = 'none';
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      }
    } else {
      if (bulkBar) bulkBar.style.display = 'flex';
      if (bulkCountBadge) bulkCountBadge.textContent = checked.length;
      if (selectAllCheckbox) {
        if (checked.length === rowCheckboxes.length) {
          selectAllCheckbox.checked = true;
          selectAllCheckbox.indeterminate = false;
        } else {
          selectAllCheckbox.checked = false;
          selectAllCheckbox.indeterminate = true;
        }
      }
    }
  };

  if (selectAllCheckbox) {
    selectAllCheckbox.onchange = () => {
      rowCheckboxes.forEach((cb) => {
        cb.checked = selectAllCheckbox.checked;
      });
      syncSelection();
    };
  }

  rowCheckboxes.forEach((cb) => {
    cb.onchange = () => syncSelection();
  });

  const deselectBtn = document.querySelector('#bulk-deselect-btn');
  if (deselectBtn) {
    deselectBtn.onclick = () => {
      rowCheckboxes.forEach((cb) => { cb.checked = false; });
      syncSelection();
    };
  }

  const bulkExportExcel = document.querySelector('#bulk-export-excel-btn');
  if (bulkExportExcel) {
    bulkExportExcel.onclick = () => {
      const checked = Array.from(document.querySelectorAll('.attempt-row-checkbox:checked'));
      if (!checked.length) return showToast('Please select at least one candidate.', 'info');
      const ids = checked.map((cb) => cb.dataset.id);
      window.location.href = `/api/admin/results/export?format=xlsx&ids=${encodeURIComponent(ids.join(','))}`;
    };
  }

  const bulkExportPdf = document.querySelector('#bulk-export-pdf-btn');
  if (bulkExportPdf) {
    bulkExportPdf.onclick = () => {
      const checked = Array.from(document.querySelectorAll('.attempt-row-checkbox:checked'));
      if (!checked.length) return showToast('Please select at least one candidate.', 'info');
      const ids = checked.map((cb) => cb.dataset.id);
      window.location.href = `/api/admin/results/export?format=pdf&ids=${encodeURIComponent(ids.join(','))}`;
    };
  }

  const bulkDeleteBtn = document.querySelector('#bulk-delete-btn');
  if (bulkDeleteBtn) {
    bulkDeleteBtn.onclick = () => {
      const checked = Array.from(document.querySelectorAll('.attempt-row-checkbox:checked'));
      if (!checked.length) return showToast('Please select at least one candidate.', 'info');
      const ids = checked.map((cb) => cb.dataset.id);
      const names = checked.map((cb) => cb.dataset.name);
      openBulkDeleteModal(ids, names);
    };
  }
}

// -------------------------------------------------------------
// GRADING MODAL LOGIC (Scale 1 to 5: A1, A2, B1, B2, C1)
// -------------------------------------------------------------
const RUBRIC_DESCRIPTIONS = {
  writing: {
    taskAchievement: {
      name: 'Task Achievement',
      desc: 'Addresses all requirements of the prompt with clarity and development.',
      levels: {
        1: { code: 'A1', label: 'Minimal response; barely addresses the prompt.' },
        2: { code: 'A2', label: 'Partially addresses task; ideas are limited or unclear.' },
        3: { code: 'B1', label: 'Addresses all main points adequately with relevant ideas.' },
        4: { code: 'B2', label: 'Fully addresses the prompt with well-developed, clear supporting points.' },
        5: { code: 'C1', label: 'Thoroughly satisfies all requirements with deep critical insights and sophisticated evidence.' }
      }
    },
    organization: {
      name: 'Coherence & Organization',
      desc: 'Logical structure, paragraphing, and seamless cohesive linking.',
      levels: {
        1: { code: 'A1', label: 'Disjointed; little to no logical sequencing.' },
        2: { code: 'A2', label: 'Basic paragraphing with repetitive or mechanical linking.' },
        3: { code: 'B1', label: 'Clear progression throughout with effective connectives.' },
        4: { code: 'B2', label: 'Skillfully organized paragraphs with smooth, sophisticated transitions.' },
        5: { code: 'C1', label: 'Flawlessly structured with effortless cohesion and sophisticated discourse transitions.' }
      }
    },
    lexicalResource: {
      name: 'Lexical Resource (Vocabulary)',
      desc: 'Breadth, accuracy, and natural use of educational and topical vocabulary.',
      levels: {
        1: { code: 'A1', label: 'Extremely restricted vocabulary; frequent word choice errors.' },
        2: { code: 'A2', label: 'Sufficient for simple communication; limited variety.' },
        3: { code: 'B1', label: 'Good range of general and topic-specific vocabulary with few errors.' },
        4: { code: 'B2', label: 'Rich, natural vocabulary with flexible collocations and precision.' },
        5: { code: 'C1', label: 'Extensive academic and idiomatic vocabulary used with natural, subtle precision.' }
      }
    },
    grammaticalRangeAccuracy: {
      name: 'Grammar Range & Accuracy',
      desc: 'Variety of sentence structures and precision in tense, agreement, and punctuation.',
      levels: {
        1: { code: 'A1', label: 'Simple phrases with frequent systemic grammar errors.' },
        2: { code: 'A2', label: 'Basic structures mostly accurate; complex forms break down.' },
        3: { code: 'B1', label: 'Mix of simple and complex sentences with good control.' },
        4: { code: 'B2', label: 'Wide range of complex structures used accurately and fluently.' },
        5: { code: 'C1', label: 'Full flexibility and mastery across complex sentence structures with virtually no errors.' }
      }
    }
  },
  speaking: {
    fluency: {
      name: 'Fluency & Coherence',
      desc: 'Speaking flow, natural pacing, and continuous expression without hesitation.',
      levels: {
        1: { code: 'A1', label: 'Very hesitant; frequent long pauses and fragmented speech.' },
        2: { code: 'A2', label: 'Can sustain short phrases; noticeable pauses when formulating sentences.' },
        3: { code: 'B1', label: 'Speaks with good flow; occasional pauses to search for language.' },
        4: { code: 'B2', label: 'Fluent, spontaneous, and natural pace with effortless coherence.' },
        5: { code: 'C1', label: 'Speaks fluently with effortless flow, natural rhythm, and no noticeable searching for words.' }
      }
    },
    vocabulary: {
      name: 'Lexical Resource (Vocabulary)',
      desc: 'Range, flexibility, and nuance in spoken expression.',
      levels: {
        1: { code: 'A1', label: 'Extremely basic vocabulary for isolated topics.' },
        2: { code: 'A2', label: 'Adequate for familiar topics; relies on repetitive words.' },
        3: { code: 'B1', label: 'Good variety of words to discuss diverse classroom topics.' },
        4: { code: 'B2', label: 'Expressive and nuanced vocabulary with natural idioms.' },
        5: { code: 'C1', label: 'Vast repertoire of academic, idiomatic, and professional expressions applied precisely.' }
      }
    },
    grammar: {
      name: 'Grammar Range & Accuracy',
      desc: 'Accuracy in spoken grammar, clauses, tenses, and structural variety.',
      levels: {
        1: { code: 'A1', label: 'Short memorized utterances with persistent grammatical errors.' },
        2: { code: 'A2', label: 'Simple tenses accurate; frequent mistakes in complex sentences.' },
        3: { code: 'B1', label: 'Consistent grammatical control with minor non-impeding errors.' },
        4: { code: 'B2', label: 'Broad range of complex spoken structures produced accurately.' },
        5: { code: 'C1', label: 'Consistently accurate and sophisticated sentence structures produced spontaneously.' }
      }
    },
    communication: {
      name: 'Interactive Communication / Pronunciation',
      desc: 'Clarity, intonation, comprehensibility, and effective engagement.',
      levels: {
        1: { code: 'A1', label: 'Hard to understand; minimal interactive engagement.' },
        2: { code: 'A2', label: 'Pronunciation is intelligible with listener effort; basic responses.' },
        3: { code: 'B1', label: 'Clear pronunciation, natural intonation, and good interaction.' },
        4: { code: 'B2', label: 'Highly clear, expressive intonation with confident interaction.' },
        5: { code: 'C1', label: 'Exceptional pronunciation clarity, nuanced intonation, and engaging persuasive delivery.' }
      }
    }
  }
};

const calculateLevel = (total) => {
  if (total <= 6) return 'A1';
  if (total <= 9) return 'A2';
  if (total <= 13) return 'B1';
  if (total <= 17) return 'B2';
  return 'C1';
};

const getLevelBadgeClass = (level) => {
  switch (level) {
    case 'C1': return 'cefr-badge c1';
    case 'B2': return 'cefr-badge b2';
    case 'B1': return 'cefr-badge b1';
    case 'A2': return 'cefr-badge a2';
    case 'A1': return 'cefr-badge a1';
    default: return 'cefr-badge';
  }
};

  async function openGradingModal(attemptId) {
  const modalContainer = document.querySelector('#modal-root') || document.body;
  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="grading-modal-backdrop">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:960px">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <div class="modal-icon">${ICONS.grade}</div>
            <div>
              <h2>Assessment Evaluation & Grading</h2>
              <p>Loading candidate attempt details…</p>
            </div>
          </div>
          <button class="modal-close" id="modal-close-btn" type="button" aria-label="Close modal">✕</button>
        </div>
        <div class="modal-body" style="min-height:280px;display:grid;place-items:center;">
          <p style="color:var(--muted)">Fetching assessment data…</p>
        </div>
      </div>
    </div>
  `;

  document.querySelector('#modal-close-btn').onclick = closeGradingModal;

  const data = await request(`/api/admin/results/${attemptId}`);
  if (data.error || !data.attempt) {
    showToast(`Error: ${data.error || 'Attempt not found'}`, 'error');
    closeGradingModal();
    return;
  }

  const attempt = data.attempt;
  const existingWritingCriteria = attempt.manualReview?.writing?.criteria || {};
  const existingSpeakingCriteria = attempt.manualReview?.speaking?.criteria || {};

  // Form State
  const scores = {
    writing: {
      taskAchievement: existingWritingCriteria.taskAchievement || null,
      organization: existingWritingCriteria.organization || null,
      lexicalResource: existingWritingCriteria.lexicalResource || null,
      grammaticalRangeAccuracy: existingWritingCriteria.grammaticalRangeAccuracy || null
    },
    speaking: {
      fluency: existingSpeakingCriteria.fluency || null,
      vocabulary: existingSpeakingCriteria.vocabulary || null,
      grammar: existingSpeakingCriteria.grammar || null,
      communication: existingSpeakingCriteria.communication || null
    }
  };

  // Extract candidate submission content
  const writingSubmission = attempt.writing || (attempt.responses ? Object.entries(attempt.responses).filter(([k]) => k.startsWith('writing')).map(([, v]) => v).join('\n\n') : '') || 'No written response recorded for this attempt.';
  const speakingSubmission = attempt.speaking || (attempt.responses ? Object.entries(attempt.responses).filter(([k]) => k.startsWith('speaking')).map(([, v]) => v).join('\n\n') : '') || 'No speech transcript recorded.';
  const recordingInfo = attempt.speakingRecording ? `${attempt.speakingRecording.mimeType || 'audio/video'}, ${attempt.speakingRecording.durationSeconds || 0}s (${attempt.speakingRecording.transcriptSource || 'recorded'})` : 'No media record file attached';

  // Section objective scores
  const gvBand = attempt.sectionScores?.['Grammar & Vocabulary'] ?? (attempt.scoring?.grammarVocabulary ? `Band ${attempt.scoring.grammarVocabulary.band}` : '—');
  const readingBand = attempt.sectionScores?.Reading ?? (attempt.scoring?.reading ? `Band ${attempt.scoring.reading.band}` : '—');
  const listeningBand = attempt.sectionScores?.Listening ?? (attempt.scoring?.listening ? `Band ${attempt.scoring.listening.band}` : '—');

  const computeTotals = () => {
    const wVals = Object.values(scores.writing).map(Number).filter((v) => Number.isInteger(v) && v >= 1 && v <= 5);
    const sVals = Object.values(scores.speaking).map(Number).filter((v) => Number.isInteger(v) && v >= 1 && v <= 5);

    const wTotal = wVals.length === 4 ? wVals.reduce((a, b) => a + b, 0) : null;
    const sTotal = sVals.length === 4 ? sVals.reduce((a, b) => a + b, 0) : null;

    return {
      writing: { total: wTotal, level: wTotal ? calculateLevel(wTotal) : null, complete: wVals.length === 4 },
      speaking: { total: sTotal, level: sTotal ? calculateLevel(sTotal) : null, complete: sVals.length === 4 }
    };
  };

  const renderModalContent = () => {
    const totals = computeTotals();

    const writingPill = totals.writing.complete ? `<span class="${getLevelBadgeClass(totals.writing.level)}">${totals.writing.level} (${totals.writing.total}/20)</span>` : '<span class="pill pending">Incomplete (select 4 criteria)</span>';
    const speakingPill = totals.speaking.complete ? `<span class="${getLevelBadgeClass(totals.speaking.level)}">${totals.speaking.level} (${totals.speaking.total}/20)</span>` : '<span class="pill pending">Incomplete (select 4 criteria)</span>';

    return `
      <div class="modal-backdrop" id="grading-modal-backdrop">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <!-- Modal Header -->
          <div class="modal-header">
            <div class="modal-title-wrap">
              <div class="modal-icon">${ICONS.clipboardCheck}</div>
              <div>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                  <h2 id="modal-title" style="margin:0">Manual Evaluation & Grading</h2>
                  <span id="autosave-status-badge" style="font-size:12px;font-weight:600;color:#16a34a">✓ Ready</span>
                </div>
                <p style="margin:2px 0 0">Click any criterion rating below to grade. Changes auto-save instantly without refreshing.</p>
              </div>
            </div>
            <button class="modal-close" id="modal-close-btn" type="button" aria-label="Close modal">✕</button>
          </div>

          <!-- Modal Body -->
          <div class="modal-body">
            <!-- Candidate Meta Strip -->
            <div class="candidate-meta-bar">
              <div class="candidate-profile">
                <div class="candidate-avatar">${(attempt.teacher || 'T').charAt(0).toUpperCase()}</div>
                <div>
                  <div class="candidate-name">${attempt.teacher}</div>
                  <div class="candidate-email">${attempt.email || 'Teacher Account'}</div>
                </div>
              </div>
              <div class="candidate-tags">
                <span class="pill">Attempt: ${attempt.id}</span>
                <span class="pill ${attempt.status === 'Completed' ? 'success' : 'pending'}">${attempt.status}</span>
                <span class="pill ${attempt.review === 'Teacher reviewed' ? 'success' : 'pending'}">${attempt.review || 'Pending'}</span>
              </div>
            </div>

            <!-- Objective Test Summary Strip -->
            <div class="bands-strip">
              <div class="band-mini-card">
                <span>Grammar & Vocab</span>
                <strong>${gvBand}</strong>
              </div>
              <div class="band-mini-card">
                <span>Reading</span>
                <strong>${readingBand}</strong>
              </div>
              <div class="band-mini-card">
                <span>Listening</span>
                <strong>${listeningBand}</strong>
              </div>
              <div class="band-mini-card">
                <span>Writing Grade</span>
                <strong id="w-summary-chip">${totals.writing.level ? `${totals.writing.level} (${totals.writing.total}/20)` : (attempt.sectionScores?.Writing || 'Pending')}</strong>
              </div>
              <div class="band-mini-card">
                <span>Speaking Grade</span>
                <strong id="s-summary-chip">${totals.speaking.level ? `${totals.speaking.level} (${totals.speaking.total}/20)` : (attempt.sectionScores?.Speaking || 'Pending')}</strong>
              </div>
            </div>

            <!-- Candidate Submissions Preview -->
            <section class="submission-card">
              <div class="submission-header">
                <div style="display:flex;align-items:center;gap:8px;color:var(--blue-dark)">
                  ${ICONS.fileText}
                  <strong>Candidate Written Essay Submission</strong>
                </div>
                <span style="font-size:12px;color:var(--muted)">${writingSubmission.length} letters</span>
              </div>
              <div class="submission-content">${writingSubmission.replace(/</g, '&lt;')}</div>
            </section>

            <section class="submission-card">
              <div class="submission-header">
                <div style="display:flex;align-items:center;gap:8px;color:var(--blue-dark)">
                  ${ICONS.mic}
                  <strong>Candidate Spoken Audio / Video Recording</strong>
                </div>
                <span style="font-size:12px;color:var(--muted)">${recordingInfo}</span>
              </div>
              ${(attempt.speakingRecording?.fileUrl || attempt.speakingRecording?.dataUrl) ? `
                <div class="recording-meta"><span class="rec-dot"></span> Spoken audio/video recording — ${attempt.speakingRecording.durationSeconds || 0}s · ${attempt.speakingRecording.mimeType || 'video/webm'}</div>
                <video class="speaking-playback" id="review-speaking-video" controls playsinline preload="auto" src="${attempt.speakingRecording.fileUrl || attempt.speakingRecording.dataUrl}"></video>
                <div style="display:flex;align-items:center;gap:10px;margin:6px 0 8px">
                  <button type="button" class="button button-sm" id="btn-force-play-video" style="padding:6px 14px;font-size:12px">▶ Play Recording with Audio</button>
                  <span style="font-size:12px;color:var(--muted)">Ensure device output speaker is unmuted</span>
                </div>
              ` : `<div class="recording-meta" style="background:#fef3c7;color:#92400e">⚠ No video recording stored for this attempt</div>`}
            </section>

            <!-- Error Banner (if validation fails) -->
            <div id="modal-validation-error" class="modal-notice error" hidden>
              <span>✕</span>
              <span id="modal-validation-msg">Please select scores for all 8 criteria before saving.</span>
            </div>

            <!-- Rubrics Evaluation Section -->
            <div style="display:grid;grid-template-columns:1fr;gap:20px;">
              <!-- 1. Writing Rubric -->
              <section class="rubric-panel-card" id="writing-rubric-card">
                <div class="rubric-panel-header">
                  <div class="rubric-panel-title">
                    <div class="skill-icon-badge skill-icon-writing" style="width:28px;height:28px">${ICONS.penTool}</div>
                    <span>Writing Rubric Assessment</span>
                  </div>
                  <div id="w-calc-badge" class="rubric-panel-badge">
                    ${writingPill}
                  </div>
                </div>
                <div class="rubric-grid">
                  ${Object.entries(RUBRIC_DESCRIPTIONS.writing).map(([key, data]) => {
      const selectedVal = scores.writing[key];
      return `
                      <div class="rubric-item" data-skill="writing" data-field="${key}">
                        <div class="rubric-item-header">
                          <span class="rubric-item-title">${data.name}</span>
                          <span class="rubric-item-desc">${data.desc}</span>
                        </div>
                        <div class="scale-buttons">
                          ${[1, 2, 3, 4, 5].map((val) => {
        const levelInfo = data.levels[val];
        const isActive = selectedVal === val;
        return `
                              <button type="button" class="scale-btn ${isActive ? 'active' : ''}" data-skill="writing" data-field="${key}" data-val="${val}" title="${levelInfo.label}">
                                <strong>${val} — ${levelInfo.code}</strong>
                                <span>${val === 1 ? 'A1' : (val === 2 ? 'A2' : (val === 3 ? 'B1' : (val === 4 ? 'B2' : 'C1')))}</span>
                              </button>
                            `;
      }).join('')}
                        </div>
                      </div>
                    `;
    }).join('')}
                </div>
              </section>

              <!-- 2. Speaking Rubric -->
              <section class="rubric-panel-card" id="speaking-rubric-card">
                <div class="rubric-panel-header">
                  <div class="rubric-panel-title">
                    <div class="skill-icon-badge skill-icon-speaking" style="width:28px;height:28px">${ICONS.mic}</div>
                    <span>Speaking Rubric Assessment</span>
                  </div>
                  <div id="s-calc-badge" class="rubric-panel-badge">
                    ${speakingPill}
                  </div>
                </div>
                <div class="rubric-grid">
                  ${Object.entries(RUBRIC_DESCRIPTIONS.speaking).map(([key, data]) => {
      const selectedVal = scores.speaking[key];
      return `
                      <div class="rubric-item" data-skill="speaking" data-field="${key}">
                        <div class="rubric-item-header">
                          <span class="rubric-item-title">${data.name}</span>
                          <span class="rubric-item-desc">${data.desc}</span>
                        </div>
                        <div class="scale-buttons">
                          ${[1, 2, 3, 4, 5].map((val) => {
        const levelInfo = data.levels[val];
        const isActive = selectedVal === val;
        return `
                              <button type="button" class="scale-btn ${isActive ? 'active' : ''}" data-skill="speaking" data-field="${key}" data-val="${val}" title="${levelInfo.label}">
                                <strong>${val} — ${levelInfo.code}</strong>
                                <span>${val === 1 ? 'A1' : (val === 2 ? 'A2' : (val === 3 ? 'B1' : (val === 4 ? 'B2' : 'C1')))}</span>
                              </button>
                            `;
      }).join('')}
                        </div>
                      </div>
                    `;
    }).join('')}
                </div>
              </section>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer">
            <div class="modal-footer-summary" id="modal-footer-summary">
              ${totals.writing.complete && totals.speaking.complete
        ? `<span>Ready to save: <strong>Writing ${totals.writing.level} (${totals.writing.total}/20)</strong> · <strong>Speaking ${totals.speaking.level} (${totals.speaking.total}/20)</strong></span>`
        : `<span style="color:var(--warning)">⚠️ Please select a score (1 to 5) for all criteria in both sections.</span>`}
            </div>
            <div class="modal-actions">
              <button class="ghost" id="modal-cancel-btn" type="button">Cancel</button>
              <button class="button" id="modal-save-btn" type="button">
                <span>Save & Finalize Grades</span> <span aria-hidden="true">✓</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  modalContainer.innerHTML = renderModalContent();

  // Close button
  document.querySelector('#modal-close-btn').onclick = closeGradingModal;
  document.querySelector('#modal-cancel-btn').onclick = closeGradingModal;

  // Backdrop click
  const backdrop = document.querySelector('#grading-modal-backdrop');
  if (backdrop) {
    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeGradingModal();
    };
  }

  // Background Auto-Save Debounced Routine
  let autoSaveTimer = null;
  const triggerAutoSave = () => {
    const statusBadge = document.querySelector('#autosave-status-badge');
    if (statusBadge) {
      statusBadge.innerHTML = '<span style="color:#2563eb">💾 Autosaving point…</span>';
    }
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      try {
        const res = await request(`/api/admin/results/${attemptId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            writing: scores.writing,
            speaking: scores.speaking
          })
        });
        if (statusBadge) {
          statusBadge.innerHTML = `<span style="color:#16a34a;font-weight:700">✓ Autosaved at ${new Date().toLocaleTimeString()}</span>`;
        }
      } catch (err) {
        if (statusBadge) {
          statusBadge.innerHTML = '<span style="color:#dc2626">⚠️ Autosave failed</span>';
        }
      }
    }, 200);
  };

  // Scale Button Clicks (In-place DOM updates — NO modal refresh)
  document.querySelectorAll('.scale-btn').forEach((btn) => {
    btn.onclick = () => {
      const skill = btn.dataset.skill;
      const field = btn.dataset.field;
      const val = Number(btn.dataset.val);

      scores[skill][field] = val;

      // 1. In-place button active toggle
      const siblingBtns = document.querySelectorAll(`.scale-btn[data-skill="${skill}"][data-field="${field}"]`);
      siblingBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // 2. In-place summary calculations
      const totals = computeTotals();

      const wBadge = document.querySelector('#w-calc-badge');
      if (wBadge) {
        wBadge.innerHTML = totals.writing.complete
          ? `<span class="${getLevelBadgeClass(totals.writing.level)}">${totals.writing.level} (${totals.writing.total}/16)</span>`
          : `<span class="pill pending">Incomplete (${Object.values(scores.writing).filter(Boolean).length}/4 criteria)</span>`;
      }

      const sBadge = document.querySelector('#s-calc-badge');
      if (sBadge) {
        sBadge.innerHTML = totals.speaking.complete
          ? `<span class="${getLevelBadgeClass(totals.speaking.level)}">${totals.speaking.level} (${totals.speaking.total}/16)</span>`
          : `<span class="pill pending">Incomplete (${Object.values(scores.speaking).filter(Boolean).length}/4 criteria)</span>`;
      }

      const wSum = document.querySelector('#w-summary-chip');
      if (wSum) {
        wSum.textContent = totals.writing.level ? `${totals.writing.level} (${totals.writing.total}/16)` : 'Pending';
      }

      const sSum = document.querySelector('#s-summary-chip');
      if (sSum) {
        sSum.textContent = totals.speaking.level ? `${totals.speaking.level} (${totals.speaking.total}/16)` : 'Pending';
      }

      const footSum = document.querySelector('#modal-footer-summary');
      if (footSum) {
        footSum.innerHTML = totals.writing.complete && totals.speaking.complete
          ? `<span>Ready to finalize: <strong>Writing ${totals.writing.level} (${totals.writing.total}/16)</strong> · <strong>Speaking ${totals.speaking.level} (${totals.speaking.total}/16)</strong></span>`
          : `<span style="color:var(--warning)">⚠️ Please select a score (1 to 4) for all criteria in both sections.</span>`;
      }

      // 3. Instant background autosave
      triggerAutoSave();
    };
  });

  const revVid = document.querySelector('#review-speaking-video');
  const forcePlayBtn = document.querySelector('#btn-force-play-video');
  if (revVid) {
    revVid.muted = false;
    revVid.volume = 1.0;
    if (forcePlayBtn) {
      forcePlayBtn.onclick = () => {
        revVid.muted = false;
        revVid.volume = 1.0;
        revVid.play();
      };
    }
  }

  // Save & Finalize Button
  document.querySelector('#modal-save-btn').onclick = async () => {
    const totals = computeTotals();
    const errorBox = document.querySelector('#modal-validation-error');
    const errorMsg = document.querySelector('#modal-validation-msg');

    if (!totals.writing.complete || !totals.speaking.complete) {
      if (errorBox && errorMsg) {
        errorBox.hidden = false;
        errorMsg.textContent = 'Please select a rating for all 4 Writing and 4 Speaking criteria.';
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (errorBox) errorBox.hidden = true;

    const saveBtn = document.querySelector('#modal-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span>Finalizing grades…</span>';

    const result = await request(`/api/admin/results/${attemptId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writing: scores.writing,
        speaking: scores.speaking
      })
    });

    if (result.error) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>Save & Finalize Grades</span> ✓';
      if (errorBox && errorMsg) {
        errorBox.hidden = false;
        errorMsg.textContent = result.error;
      }
      showToast(result.error, 'error');
      return;
    }

    closeGradingModal();
    showToast(`Grades finalized successfully for ${attempt.teacher}! Writing: ${result.manualReview.writing.level} (${result.manualReview.writing.total}/16), Speaking: ${result.manualReview.speaking.level} (${result.manualReview.speaking.total}/16).`, 'success');
    renderAdmin();
  };

  // Escape key handler
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeGradingModal();
      window.removeEventListener('keydown', onKeyDown);
    }
  };
  window.addEventListener('keydown', onKeyDown);
}

function closeGradingModal() {
  const modalRoot = document.querySelector('#modal-root');
  if (modalRoot) {
    const backdrop = modalRoot.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.style.opacity = '0';
      setTimeout(() => { modalRoot.innerHTML = ''; }, 150);
      return;
    }
    modalRoot.innerHTML = '';
  }
}

// Global Auth & Logout
document.querySelector('#logout').onclick = async () => {
  await request('/api/auth/logout', { method: 'POST' });
  document.querySelector('#logout').hidden = true;
  localStorage.removeItem('assessify_admin_tab');
  localStorage.removeItem('assessify_user');
  history.replaceState(null, '', window.location.pathname);
  renderLogin();
};

async function init() {
  try {
    const data = await request('/api/auth/me');
    if (data && data.user) {
      boot(data.user);
    } else {
      renderLogin();
    }
  } catch {
    renderLogin();
  }
}

init();
