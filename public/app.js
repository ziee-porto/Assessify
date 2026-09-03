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
    return data;
  } catch (err) {
    return { error: err.message || 'Network error occurred' };
  }
};

// Dynamic Multi-Voice Speech Synthesis Engine (Unique voice, pitch, and accent per question)
let cachedBrowserVoices = [];
function loadBrowserVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  if (cachedBrowserVoices.length > 0) return cachedBrowserVoices;
  const allVoices = window.speechSynthesis.getVoices();
  if (allVoices && allVoices.length > 0) {
    const englishVoices = allVoices.filter((v) => (v.lang || '').toLowerCase().startsWith('en'));
    cachedBrowserVoices = englishVoices.length > 0 ? englishVoices : allVoices;
  }
  return cachedBrowserVoices;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadBrowserVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedBrowserVoices = [];
    loadBrowserVoices();
  };
}

function speakQuestionAudio(text, questionIndex = 0, onStart, onEnd, onError) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();

  const voices = loadBrowserVoices();
  const utterance = new SpeechSynthesisUtterance(text);

  // 15 distinct acoustic and pitch profiles to ensure varied male/female/character voices
  const pitchProfiles = [1.08, 0.86, 1.18, 0.82, 1.12, 0.90, 1.22, 0.85, 1.04, 0.88, 1.15, 0.83, 1.06, 0.92, 1.10];
  const rateProfiles = [0.93, 0.90, 0.95, 0.91, 0.94, 0.89, 0.96, 0.92, 0.93, 0.90, 0.95, 0.91, 0.94, 0.92, 0.96];

  const idx = Math.abs(Number(questionIndex) || 0);
  utterance.pitch = pitchProfiles[idx % pitchProfiles.length];
  utterance.rate = rateProfiles[idx % rateProfiles.length];

  if (voices.length > 0) {
    utterance.voice = voices[idx % voices.length];
    utterance.lang = utterance.voice.lang || 'en-US';
  } else {
    utterance.lang = 'en-US';
  }

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  if (onError) utterance.onerror = onError;

  window.speechSynthesis.speak(utterance);
}

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
  download: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
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
  sliders: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
  clipboardCheck: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><polyline points="9 14 12 17 16 12"/></svg>`
};

const sectionIcons = {
  'Grammar & Vocabulary': ICONS.layers,
  'Grammar & Vocabulary Placement Test': ICONS.layers,
  'grammar-vocabulary': ICONS.layers,
  'Writing Placement Test': ICONS.penTool,
  'Writing': ICONS.penTool,
  'writing': ICONS.penTool,
  'Oral Placement Test': ICONS.mic,
  'Speaking': ICONS.mic,
  'speaking': ICONS.mic,
  Reading: ICONS.book,
  Listening: ICONS.headphones
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
              School Email <span style="font-size:11.5px;font-weight:400;color:var(--muted)">(Official @karyabangsa.sch.id)</span>
            </label>
            <input type="email" id="login-teacher-email" name="email" placeholder="name@karyabangsa.sch.id" ${isAdminRole ? '' : 'required'} style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif">
            <div id="email-verify-badge" style="margin-top:6px;font-size:12px;font-weight:600;display:none"></div>

            <label style="display:block;font-size:13px;font-weight:700;margin:16px 0 6px;color:var(--ink)">
              Full Name <span style="font-size:11.5px;font-weight:400;color:var(--muted)">(for Official Certificate & Placement Records)</span>
            </label>
            <input type="text" id="login-teacher-name" name="fullName" placeholder="e.g. Budi Santoso, S.Pd." ${isAdminRole ? '' : 'required'} style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif">

            <label style="display:block;font-size:13px;font-weight:700;margin:16px 0 6px;color:var(--ink)">School Unit</label>
            <select class="select-filter" id="teacher-unit" name="unit" ${isAdminRole ? '' : 'required'} style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif">
              <option value="" disabled selected>Select Your Assigned School Unit</option>
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

  // Real-time email verification and auto-unit matching
  const emailInput = document.querySelector('#login-teacher-email');
  const nameInput = document.querySelector('#login-teacher-name');
  const unitSelect = document.querySelector('#teacher-unit');
  const verifyBadge = document.querySelector('#email-verify-badge');

  if (emailInput) {
    let lookupTimer = null;
    const resetTeacherFields = () => {
      if (nameInput) nameInput.value = '';
      if (unitSelect) unitSelect.value = '';
      if (verifyBadge) {
        verifyBadge.style.display = 'none';
        verifyBadge.innerHTML = '';
      }
      const errEl = document.querySelector('#login-error');
      if (errEl) errEl.textContent = '';
    };

    const checkEmail = async () => {
      const email = emailInput.value.trim().toLowerCase();
      if (!email) {
        resetTeacherFields();
        return;
      }
      if (!email.includes('@')) {
        if (verifyBadge) verifyBadge.style.display = 'none';
        return;
      }
      try {
        const res = await request(`/api/auth/teacher-lookup?email=${encodeURIComponent(email)}`);
        if (res && res.found) {
          if (verifyBadge) {
            verifyBadge.style.display = 'block';
            verifyBadge.style.color = '#15803d';
            verifyBadge.innerHTML = `✓ Verified Educator Roster: <strong>${res.unit}</strong>`;
          }
          if (unitSelect) unitSelect.value = res.unit;
          if (nameInput && res.name) nameInput.value = res.name;
          const errEl = document.querySelector('#login-error');
          if (errEl) errEl.textContent = '';
        } else {
          if (verifyBadge) {
            verifyBadge.style.display = 'block';
            verifyBadge.style.color = '#dc2626';
            verifyBadge.innerHTML = `⚠ Email is not registered in the Karya Bangsa teacher roster.`;
          }
        }
      } catch (e) { }
    };

    emailInput.addEventListener('input', () => {
      if (!emailInput.value.trim()) {
        clearTimeout(lookupTimer);
        resetTeacherFields();
        return;
      }
      clearTimeout(lookupTimer);
      lookupTimer = setTimeout(checkEmail, 300);
    });
    emailInput.addEventListener('blur', checkEmail);
    if (emailInput.value.trim()) checkEmail();
  }

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

function renderCompletedTeacher(attempt, user) {
  const submittedDate = attempt.submittedAt
    ? new Date(attempt.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : (attempt.startedAt ? new Date(attempt.startedAt).toLocaleDateString('en-GB') : 'Submitted');

  const gvLevel = attempt.sectionScores?.['Grammar & Vocabulary'] || (attempt.scoring?.grammarVocabulary?.level || 'Recorded');
  const writingLevel = attempt.sectionScores?.Writing || (attempt.manualReview?.writing?.level || 'Evaluation in progress');
  const speakingLevel = attempt.sectionScores?.Speaking || (attempt.manualReview?.speaking?.level || 'Evaluation in progress');
  const overallBand = attempt.overall || 'Under Review';
  const isReviewed = attempt.review === 'Teacher reviewed';

  const cefrColorMap = {
    C2: '#86198f',
    C1: '#7c3aed',
    B2: '#059669',
    B1: '#2563eb',
    A2: '#d97706',
    A1: '#dc2626'
  };

  const cefrDescMap = {
    C2: 'Mastery',
    C1: 'Advanced',
    B2: 'Upper-Intermediate',
    B1: 'Intermediate',
    A2: 'Elementary',
    A1: 'Beginner'
  };

  const overallColor = cefrColorMap[overallBand] || '#1e40af';
  const overallDesc = cefrDescMap[overallBand] || (isReviewed ? 'Certified Placement' : 'Provisional Placement');

  const candidateName = user.name || attempt.teacher || 'Candidate';
  const candidateInitials = candidateName.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const analysisText = attempt.analysis || (
    isReviewed
      ? `Overall CEFR Placement: ${overallBand} — ${overallDesc}. Assessment has been officially graded and archived by Karya Bangsa School Academic Evaluation Board.`
      : `Your objective Grammar & Vocabulary placement is securely recorded. Manual evaluation of your essay and oral interview recording is underway.`
  );

  app.innerHTML = `
    <div class="teacher-shell" style="max-width:920px;margin:36px auto">
      <div class="result-card-container">
        <!-- Hero Banner Header -->
        <div class="result-hero-banner">
          <div class="result-hero-top">
            <div class="result-institution-badge">
              ${ICONS.school}
              <span>Karya Bangsa School · Faculty Placement Board</span>
            </div>
            <div class="result-status-pill">
              ${ICONS.checkCircle}
              <span>${isReviewed ? 'Official Placement Certified' : 'Official Record Sealed'}</span>
            </div>
          </div>
          <div class="result-hero-main">
            <h1>Official Placement Assessment Record</h1>
            <p>
              Your English language proficiency placement test has been recorded. Each candidate account is authorized for one official test attempt.
            </p>
          </div>
        </div>

        <div class="result-body">
          <!-- Candidate Credentials Meta Grid -->
          <div class="candidate-meta-grid">
            <div class="meta-item-box">
              <span class="meta-label">${ICONS.users} Candidate Name</span>
              <div class="meta-value">
                <span style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg, #1e40af, #3b82f6);color:#fff;display:inline-grid;place-items:center;font-size:11px;font-weight:700;flex-shrink:0">${candidateInitials}</span>
                <span>${candidateName}</span>
              </div>
            </div>
            <div class="meta-item-box">
              <span class="meta-label">${ICONS.fileText} School Email</span>
              <div class="meta-value" style="font-size:13.5px;font-weight:600;color:var(--ink)">${user.email || attempt.email}</div>
            </div>
            <div class="meta-item-box">
              <span class="meta-label">${ICONS.school} School Unit</span>
              <div class="meta-value"><span class="unit-pill">${attempt.unit || user.unit || 'SMK KARYA BANGSA'}</span></div>
            </div>
            <div class="meta-item-box">
              <span class="meta-label">${ICONS.pin} Attempt Reference</span>
              <div class="meta-value"><span class="attempt-pill">${attempt.id}</span></div>
            </div>
            <div class="meta-item-box">
              <span class="meta-label">${ICONS.clock} Submission Date</span>
              <div class="meta-value" style="font-size:13.5px;font-weight:600">${submittedDate}</div>
            </div>
            <div class="meta-item-box">
              <span class="meta-label">${ICONS.clipboardCheck} Evaluation Status</span>
              <div class="meta-value">
                <span class="pill ${isReviewed ? 'success' : 'pending'}">${attempt.review || 'Pending Review'}</span>
              </div>
            </div>
          </div>

          <!-- Overall CEFR Placement Showcase Banner -->
          <div class="overall-showcase-box">
            <div class="overall-left-block">
              <div class="overall-badge-disc" style="background:${overallColor}">
                <strong>${overallBand}</strong>
                <span>${overallDesc}</span>
              </div>
              <div class="overall-text-block">
                <div class="overall-label">Official Placement Result</div>
                <h2>Overall CEFR Level ${overallBand}</h2>
                <p>
                  ${isReviewed
                    ? 'Evaluated across Grammar & Vocabulary, Writing, and Speaking according to Karya Bangsa CEFR Placement Rubrics.'
                    : 'Provisional placement benchmark based on Grammar & Vocabulary. Writing & Speaking are queued for faculty review.'}
                </p>
              </div>
            </div>
            <div class="overall-action-block">
              <a class="btn-cert-download" href="/api/attempts/${attempt.id}/certificate" target="_blank">
                ${ICONS.pdf}
                <span>Download Placement Certificate</span>
              </a>
            </div>
          </div>

          <!-- Section Skills Component Cards (ONLY Grammar & Vocabulary, Writing, Speaking) -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <h3 style="font:700 17px 'Space Grotesk', sans-serif;color:var(--ink);margin:0">
              Evaluated Skill Components
            </h3>
            <span style="font-size:12px;color:var(--muted);font-weight:600">3 Verified Competencies</span>
          </div>

          <div class="skills-showcase-grid">
            <!-- 1. Grammar & Vocabulary -->
            <div class="skill-showcase-card">
              <div class="skill-card-top">
                <div class="skill-icon-bubble" style="background:#eff6ff;color:#2563eb">
                  ${ICONS.layers}
                </div>
                <div class="skill-card-info">
                  <h3>Grammar & Vocabulary</h3>
                  <p>Syntax & Lexical Precision</p>
                </div>
              </div>
              <div class="skill-card-badge-row">
                <span class="skill-metric-tag">
                  ${attempt.scoring?.grammarVocabulary?.correct !== undefined
                    ? `${attempt.scoring.grammarVocabulary.correct}/${attempt.scoring.grammarVocabulary.total} correct`
                    : 'Objective answer key'}
                </span>
                <span class="${getLevelBadgeClass(gvLevel)}" style="font-size:14px;font-weight:700;padding:4px 12px">
                  ${gvLevel}
                </span>
              </div>
            </div>

            <!-- 2. Writing -->
            <div class="skill-showcase-card">
              <div class="skill-card-top">
                <div class="skill-icon-bubble" style="background:#f5f3ff;color:#7c3aed">
                  ${ICONS.penTool}
                </div>
                <div class="skill-card-info">
                  <h3>Writing</h3>
                  <p>Essay & Task Response</p>
                </div>
              </div>
              <div class="skill-card-badge-row">
                <span class="skill-metric-tag">
                  ${attempt.manualReview?.writing?.level ? 'Rubric Evaluated' : 'Proctored Review'}
                </span>
                <span class="${getLevelBadgeClass(writingLevel)}" style="font-size:14px;font-weight:700;padding:4px 12px">
                  ${writingLevel}
                </span>
              </div>
            </div>

            <!-- 3. Speaking -->
            <div class="skill-showcase-card">
              <div class="skill-card-top">
                <div class="skill-icon-bubble" style="background:#ecfdf5;color:#059669">
                  ${ICONS.mic}
                </div>
                <div class="skill-card-info">
                  <h3>Speaking</h3>
                  <p>Oral Fluency & Interaction</p>
                </div>
              </div>
              <div class="skill-card-badge-row">
                <span class="skill-metric-tag">
                  ${attempt.manualReview?.speaking?.level ? 'Rubric Evaluated' : 'Recorded Interview'}
                </span>
                <span class="${getLevelBadgeClass(speakingLevel)}" style="font-size:14px;font-weight:700;padding:4px 12px">
                  ${speakingLevel}
                </span>
              </div>
            </div>
          </div>

          <!-- Placement Analysis Insight Card -->
          <div class="placement-insight-card">
            <div class="insight-icon">${ICONS.lightbulb}</div>
            <div>
              <strong style="display:block;font-size:13.5px;color:var(--ink);margin-bottom:4px">Placement Academic Evaluation</strong>
              <p>${analysisText}</p>
            </div>
          </div>

          <!-- Footer Actions & Compliance -->
          <div class="result-footer-bar">
            <div class="policy-compliance-tag">
              ${ICONS.lock}
              <span><strong>Single Assessment Policy:</strong> Record is officially sealed and locked under institutional academic governance.</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
              <button class="button button-outline" id="completed-sign-out-btn" type="button" style="padding:10px 22px">
                <span>Sign Out</span> <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.querySelector('#completed-sign-out-btn').onclick = async () => {
    await request('/api/auth/logout', { method: 'POST' });
    renderLogin();
  };
}

async function renderTeacher(test, user) {
  // Check if candidate already has a completed attempt or active in-progress attempt
  let inProgressAttempt = null;
  try {
    const attemptStatus = await request('/api/attempts/me');
    if (attemptStatus?.hasCompleted && attemptStatus.completedAttempt) {
      renderCompletedTeacher(attemptStatus.completedAttempt, user);
      return;
    }
    if (attemptStatus?.inProgressAttempt) {
      inProgressAttempt = attemptStatus.inProgressAttempt;
    }
  } catch (err) {
    console.warn('Could not check attempt status:', err);
  }

  const totalQuestions = (test.sections || []).reduce((sum, s) => sum + (s.questions ? s.questions.length : 0), 0);

  app.innerHTML = `
    <div class="teacher-shell">
      ${inProgressAttempt ? `
        <div class="resume-assessment-card" style="background:#eff6ff;border:2px solid #3b82f6;border-radius:14px;padding:20px 24px;margin-bottom:24px;box-shadow:0 6px 20px rgba(59,130,246,0.12)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px">
            <div style="display:flex;align-items:center;gap:14px">
              <div style="width:44px;height:44px;border-radius:50%;background:#2563eb;color:#ffffff;display:grid;place-items:center;font-size:22px;flex-shrink:0">
                ${ICONS.clock}
              </div>
              <div>
                <span class="pill" style="background:#dbeafe;color:#1e40af;font-weight:700;font-size:11px;letter-spacing:0.5px">SESSION IN PROGRESS DETECTED</span>
                <h3 style="font:700 18px 'Space Grotesk';margin:3px 0 2px;color:#1e3a8a">Resume Your Active Assessment</h3>
                <p style="margin:0;font-size:13px;color:#1e40af">
                  Your previous answers, essay progress, and section states have been auto-saved. You can seamlessly continue without losing any work.
                </p>
              </div>
            </div>
            <button class="button" id="resume-banner-btn" type="button" style="padding:10px 24px;font-size:14px;background:#2563eb;color:#fff;font-weight:600">
              <span>Resume Assessment Now</span> <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ` : ''}

      <section class="hero">
        <div>
          <div class="eyebrow">Karya Bangsa School · Placement Assessment</div>
          <h1>Welcome, ${user.name || 'Candidate'}.</h1>
          <p>This English proficiency placement assessment measures your skills across Grammar & Vocabulary (50 questions · 30m), Writing Placement Test (User selects 1 topic to write 1 Essay · 20m), and Oral Placement Test (21 questions · 20m).</p>
        </div>
        <div class="hero-note">
          <strong>01:10:00</strong>
          <span>Total assessment time</span>
        </div>
      </section>

      <!-- Section Overview Grid -->
      <section class="sections">
        ${test.sections.map((section, idx) => {
          const secLabel = section.label || (section.id === 'grammar-vocabulary' ? 'Grammar & Vocabulary Placement Test' : section.id === 'writing' ? 'Writing Placement Test' : 'Oral Placement Test');
          const itemCount = (section.topics && section.topics.length) ? `${section.topics.length} topics (1 selected)` : `${section.questions ? section.questions.length : 0} items`;
          return `
            <article class="section-card">
              <div class="section-icon">${sectionIcons[secLabel] || sectionIcons[section.id] || (idx + 1)}</div>
              <b>${secLabel}</b>
              <span>${section.durationMinutes || 20} mins · ${itemCount}</span>
            </article>
          `;
        }).join('')}
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
              <div class="guideline-title">Dedicated Section Timers</div>
              <p class="guideline-desc">Grammar & Vocabulary (30m), Writing (20m), and Speaking (15m). Sections automatically advance when time expires.</p>
            </div>
          </div>
          <div class="guideline-item">
            <div class="guideline-icon">${ICONS.headphones}</div>
            <div>
              <div class="guideline-title">Audio Format Prompts</div>
              <p class="guideline-desc">Speaking prompts are delivered in audio format (integrated listening). Please adjust your sound volume beforehand.</p>
            </div>
          </div>
          <div class="guideline-item">
            <div class="guideline-icon">${ICONS.mic}</div>
            <div>
              <div class="guideline-title">Teacher / Examiner Recording</div>
              <p class="guideline-desc">Speaking answers are recorded via camera and microphone. The test can be concluded early if subsequent questions cannot be answered.</p>
            </div>
          </div>
          <div class="guideline-item">
            <div class="guideline-icon">${ICONS.save}</div>
            <div>
              <div class="guideline-title">Real-Time Autosave</div>
              <p class="guideline-desc">All selected options, written drafts, and audio/video recordings are saved automatically.</p>
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
          <h2 style="margin:0 0 4px">${inProgressAttempt ? 'Assessment in Progress' : 'Ready to start?'}</h2>
          <p style="color:var(--muted);margin:0;font-size:14px">${inProgressAttempt ? 'Your previous answers have been safely saved. Click to continue.' : 'Ensure you have a quiet environment and a stable internet connection.'}</p>
        </div>
        <button class="button" id="start" style="padding:14px 28px;font-size:15px;background:${inProgressAttempt ? '#2563eb' : 'var(--blue-dark)'};color:#fff">
          <span>${inProgressAttempt ? 'Resume Assessment' : 'Start Assessment'}</span> <span aria-hidden="true">→</span>
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

    const isInsecureRemote = !window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
    if (isInsecureRemote || !navigator.mediaDevices?.getUserMedia) {
      if (camStatus) camStatus.textContent = isInsecureRemote ? 'HTTPS required on remote IP' : 'Camera not supported';
      if (camDot) camDot.className = 'status-pulse-dot is-error';
      if (overallBadge) {
        overallBadge.className = 'device-status-badge error';
        overallBadge.textContent = isInsecureRemote ? '⚠️ HTTPS Required' : '⚠️ Check Permissions';
      }
      if (isUserRetry) {
        showToast('⚠️ Mobile browsers require HTTPS to enable camera/mic when connecting via IP address.', 'error');
      }
      if (retryBtn) {
        setTimeout(() => {
          retryBtn.classList.remove('is-retesting');
          const btnSpan = retryBtn.querySelector('span');
          if (btnSpan) btnSpan.textContent = 'Retest Device';
        }, 400);
      }
      return;
    }

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
      const isHttpsIssue = !window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
      if (camStatus) camStatus.textContent = isHttpsIssue ? 'HTTPS required on remote IP' : 'Camera/Mic permission blocked';
      if (camDot) camDot.className = 'status-pulse-dot is-error';
      if (overallBadge) {
        overallBadge.className = 'device-status-badge error';
        overallBadge.textContent = isHttpsIssue ? '⚠️ HTTPS Required' : '⚠️ Check Permissions';
      }
      if (isUserRetry) {
        showToast(isHttpsIssue ? '⚠️ Mobile browsers block camera/mic over plain HTTP. Access via localhost or HTTPS.' : '⚠️ Unable to access camera/mic. Please check browser permissions.', 'error');
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

  // Resume Banner Button Hand-off
  const resumeBannerBtn = document.querySelector('#resume-banner-btn');
  if (resumeBannerBtn) {
    resumeBannerBtn.onclick = () => {
      document.querySelector('#start')?.click();
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
    btn.textContent = inProgressAttempt ? 'Resuming assessment…' : 'Preparing assessment…';
    const result = await request('/api/attempts', { method: 'POST' });
    if (result.error) {
      btn.disabled = false;
      btn.textContent = inProgressAttempt ? 'Resume Assessment →' : 'Start Assessment →';
      showToast(result.error, 'error');
      if (result.hasCompleted && result.attempt) {
        renderCompletedTeacher(result.attempt, user);
      }
      return;
    }
    renderSectionFlow(test, result.expiresAt, result.attempt.id, result.attempt, user);
  };
}

function renderSectionFlow(test, expiresAt, attemptId, attemptData = {}, user = {}) {
  let sectionIndex = 0;
  let mediaRecorder = null;
  let mediaStream = null;
  let recordingChunks = [];
  let recordingStartedAt = null;
  let speechRecognizer = null;
  let speakingStep = 0;
  let speakingRecordingState = 'idle'; // 'idle' | 'recording' | 'stopped'
  const playedAudio = {};

  const userEmail = (user?.email || attemptData?.email || 'candidate').toLowerCase().trim();
  const STORAGE_KEY = `assessify_autosave_${userEmail}_${attemptId}`;
  const LEGACY_STORAGE_KEY = `assessify_autosave_${userEmail}`;

  let localState = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) localState = JSON.parse(raw);
  } catch (err) {
    console.warn('Could not read from localStorage:', err);
  }

  // Restore answers from server database attempt responses AND local device storage
  const answers = Object.assign(
    {},
    attemptData?.responses || {},
    localState.answers || {}
  );
  if (attemptData?.writing && !answers['writing-essay'] && !answers['writing-0']) {
    answers['writing-essay'] = attemptData.writing;
  }

  // Restore section index
  if (localState.sectionIndex !== undefined && Number.isInteger(localState.sectionIndex) && localState.sectionIndex >= 0 && localState.sectionIndex < test.sections.length) {
    sectionIndex = localState.sectionIndex;
  } else if (attemptData?.sectionIndex !== undefined && Number.isInteger(attemptData.sectionIndex) && attemptData.sectionIndex >= 0 && attemptData.sectionIndex < test.sections.length) {
    sectionIndex = attemptData.sectionIndex;
  }

  // Restore speaking step
  if (localState.speakingStep !== undefined && Number.isInteger(localState.speakingStep)) {
    speakingStep = localState.speakingStep;
  } else if (attemptData?.speakingStep !== undefined && Number.isInteger(attemptData.speakingStep)) {
    speakingStep = attemptData.speakingStep;
  }

  const sectionDurations = {
    'grammar-vocabulary': 30 * 60 * 1000,
    'writing': 20 * 60 * 1000,
    'speaking': 15 * 60 * 1000
  };
  const sectionEndTimes = {};
  if (localState.sectionEndTimes && typeof localState.sectionEndTimes === 'object') {
    Object.assign(sectionEndTimes, localState.sectionEndTimes);
  }
  let timerTimeoutId = null;
  let saveDebounceTimer = null;
  let hasRestoredToastShown = false;

  const updateSaveIndicator = (status = 'saved') => {
    const indicator = document.querySelector('#autosave-indicator');
    if (!indicator) return;
    if (status === 'saving') {
      indicator.innerHTML = `<span class="spinner-sm" style="width:11px;height:11px;border:2px solid #2563eb;border-top-color:transparent;border-radius:50%;display:inline-block;animation:spin 0.8s linear infinite"></span> <span>Saving…</span>`;
      indicator.style.color = '#2563eb';
      indicator.style.background = '#eff6ff';
      indicator.style.borderColor = '#bfdbfe';
    } else if (status === 'offline') {
      indicator.innerHTML = `<span>⚠️</span> <span>Saved locally (offline)</span>`;
      indicator.style.color = '#b45309';
      indicator.style.background = '#fffbeb';
      indicator.style.borderColor = '#fde68a';
    } else {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      indicator.innerHTML = `${ICONS.check} <span>Auto-saved at ${timeStr}</span>`;
      indicator.style.color = '#16a34a';
      indicator.style.background = '#f0fdf4';
      indicator.style.borderColor = '#bbf7d0';
    }
  };

  const persistProgress = (immediate = false) => {
    // 1. Instantly save to local device storage (protects against browser crash, power loss, or tab close)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        attemptId,
        userEmail,
        answers,
        sectionIndex,
        speakingStep,
        sectionEndTimes,
        savedAt: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // 2. Sync with database
    const syncServer = async () => {
      updateSaveIndicator('saving');
      try {
        const payload = {
          responses: answers,
          writing: answers['writing-essay'] || answers['writing-0'] || answers['writing'] || '',
          sectionIndex,
          speakingStep
        };
        const res = await fetch(`/api/attempts/${attemptId}/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          updateSaveIndicator('saved');
        } else {
          updateSaveIndicator('offline');
        }
      } catch (err) {
        updateSaveIndicator('offline');
      }
    };

    if (immediate) {
      if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
      syncServer();
    } else {
      updateSaveIndicator('saving');
      if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
      saveDebounceTimer = setTimeout(syncServer, 500);
    }
  };

  // Safe window unload handler (device power off, accidental tab close)
  const handlePageUnload = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        attemptId,
        userEmail,
        answers,
        sectionIndex,
        speakingStep,
        sectionEndTimes,
        savedAt: new Date().toISOString()
      }));
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({
          responses: answers,
          writing: answers['writing-essay'] || answers['writing-0'] || answers['writing'] || '',
          sectionIndex,
          speakingStep
        })], { type: 'application/json' });
        navigator.sendBeacon(`/api/attempts/${attemptId}/draft`, blob);
      }
    } catch { }
  };
  window.addEventListener('beforeunload', handlePageUnload);
  window.addEventListener('pagehide', handlePageUnload);
  window.addEventListener('online', () => persistProgress(true));
  window.addEventListener('offline', () => updateSaveIndicator('offline'));

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

  const submitAssessment = async (isEarlyEnd = false, isAutoTimeLimit = false) => {
    if (timerTimeoutId) clearTimeout(timerTimeoutId);
    window.removeEventListener('beforeunload', handlePageUnload);
    window.removeEventListener('pagehide', handlePageUnload);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch { }

    app.innerHTML = `
      <div class="teacher-shell" style="max-width:680px;margin:80px auto;text-align:center">
        <div class="panel" style="padding:48px 36px">
          <div style="width:56px;height:56px;border-radius:50%;background:#eff6ff;color:#2563eb;display:grid;place-items:center;font-size:28px;margin:0 auto 20px">⏳</div>
          <h2 style="font:700 24px 'Space Grotesk';margin:0 0 10px;color:var(--ink)">Submitting Assessment Responses…</h2>
          <p style="color:var(--muted);font-size:14px">Processing audio recordings, grammar items, and written responses. Please wait a moment.</p>
        </div>
      </div>
    `;

    await stopMedia();
    const video = recordingChunks.length ? new Blob(recordingChunks, { type: mediaRecorder?.mimeType || 'video/webm' }) : null;
    let recordingMeta = null;
    if (video) {
      const durationSeconds = Math.round((Date.now() - (recordingStartedAt || Date.now())) / 1000);
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
        writing: answers['writing-essay'] || answers['writing-0'] || answers['writing'] || ['writing-0', 'writing-1'].map((id) => answers[id] || '').filter(Boolean).join('\n\n') || Object.entries(answers).filter(([k]) => k.startsWith('writing') && !k.includes('selected')).map(([, v]) => v).join('\n\n'),
        speakingRecording: recordingMeta,
        earlyTermination: Boolean(isEarlyEnd)
      })
    });

    app.innerHTML = `
      <div class="teacher-shell" style="max-width:680px;margin:60px auto;text-align:center">
        <div class="panel" style="padding:48px 36px">
          <div style="width:64px;height:64px;border-radius:50%;background:#dcfce7;color:#16a34a;display:grid;place-items:center;font-size:32px;margin:0 auto 20px">✓</div>
          <h1 style="font:700 34px 'Space Grotesk';margin:0 0 12px;color:var(--ink)">Assessment Submitted!</h1>
          <p style="color:var(--muted);line-height:1.6;font-size:15px;margin-bottom:24px">
            Your placement responses have been securely recorded. Grammar & Vocabulary is scored automatically, and your Writing and Speaking (including auditory prompt comprehension) submissions are queued for admin rubric review.
            ${isEarlyEnd ? '<br><span class="pill" style="margin-top:8px;background:#fee2e2;color:#991b1b;border-color:#fecaca;display:inline-block">⚠️ Notice: Speaking test was concluded early by examiner</span>' : ''}
            ${isAutoTimeLimit ? '<br><span class="pill" style="margin-top:8px;background:#fef3c7;color:#92400e;border-color:#fde68a;display:inline-block">⏱ Notice: Concluded automatically at 15-minute time limit</span>' : ''}
          </p>
          <div style="background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:16px;font-size:13px;color:var(--ink);margin-bottom:28px">
            <strong>Attempt Reference:</strong> <code>${attemptId}</code><br>
            <span style="color:var(--muted)">Provisional scores and recordings are now available in the administration dashboard.</span>
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

  const advanceToNextSection = async () => {
    await stopMedia();
    sectionIndex += 1;
    speakingStep = 0;
    draw();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startSectionTimer = () => {
    if (timerTimeoutId) clearTimeout(timerTimeoutId);
    const currSec = section();
    if (!currSec) return;
    if (!sectionEndTimes[sectionIndex]) {
      const dur = sectionDurations[currSec.id] || (currSec.durationMinutes || 15) * 60 * 1000;
      sectionEndTimes[sectionIndex] = Date.now() + dur;
    }

    const tick = () => {
      const end = sectionEndTimes[sectionIndex];
      const now = Date.now();
      const left = Math.max(0, end - now);
      const timerEl = document.querySelector('#timer');
      const timerBox = document.querySelector('#timer-box');
      if (timerEl) {
        const m = String(Math.floor(left / 60000)).padStart(2, '0');
        const s = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
        timerEl.textContent = `${m}:${s}`;
        if (left < 180000 && timerBox) {
          timerBox.style.borderColor = '#ef4444';
          timerBox.style.background = '#fef2f2';
          timerEl.style.color = '#dc2626';
        } else if (timerBox) {
          timerBox.style.borderColor = '';
          timerBox.style.background = '';
          timerEl.style.color = '';
        }
      }
      if (left <= 0) {
        if (sectionIndex < test.sections.length - 1) {
          showToast(`Time limit reached for ${currSec.label}. Advancing to next section...`, 'info', 4500);
          advanceToNextSection();
        } else {
          showToast('15-minute Speaking time limit reached. Concluding assessment...', 'info', 5000);
          submitAssessment(false, true);
        }
        return;
      }
      timerTimeoutId = setTimeout(tick, 1000);
    };
    tick();
  };

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
                <span>Part ${idx + 1}: ${idx === 0 ? 'Intro & Teaching Philosophy' : 'Scenarios & Scaffolding'}</span>
              </div>
            `).join('')}
          </div>

          <!-- Integrated Listening: Audio Format Prompt Player Card -->
          <div class="speaking-audio-prompt-card" style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:16px 20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(22,163,74,0.06)">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:40px;height:40px;border-radius:50%;background:#16a34a;color:#fff;display:grid;place-items:center;font-size:20px;flex-shrink:0">
                  ${ICONS.volume2}
                </div>
                <div>
                  <div style="font-weight:700;font-size:15px;color:#166534;margin-bottom:2px">Spoken Audio Prompt (Integrated Listening)</div>
                  <div style="font-size:12.5px;color:#15803d">Listen to the prompt audio carefully. Teacher/examiner will record the student's spoken response.</div>
                </div>
              </div>
              <button class="button button-sm" id="play-speaking-prompt-btn" data-text="${(activePrompt.audioScript || activePrompt.prompt).replaceAll('"', '&quot;')}" type="button" style="background:#16a34a;color:#fff;padding:9px 18px;font-size:13px;display:inline-flex;align-items:center;gap:8px">
                ${ICONS.volume2} <span>Play Spoken Prompt</span>
              </button>
            </div>
          </div>

          <!-- Camera Monitor Card (Examiner Recording Station) -->
          <div class="camera-monitor-card" style="background:#0f172a;border-radius:14px;padding:20px;margin-bottom:24px;max-width:680px;box-shadow:0 8px 24px rgba(0,0,0,0.15)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <span style="font-size:13px;font-weight:700;color:#94a3b8;display:flex;align-items:center;gap:6px">
                👨‍🏫 Teacher / Examiner Recording Control
              </span>
              <span style="font-size:11.5px;color:#cbd5e1;background:#334155;padding:3px 10px;border-radius:12px">15 Mins Limit</span>
            </div>

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
                  ${speakingRecordingState === 'idle' ? 'Camera & Mic Ready — Click Start Recording to record answer' : (speakingRecordingState === 'recording' ? '● Recording student response…' : '✓ Recording completed and attached to submission')}
                </span>
              </div>
              <div style="display:flex;gap:10px;align-items:center">
                ${speakingRecordingState === 'idle' ? `
                  <button class="button" id="start-speaking-record-btn" type="button" style="background:#16a34a;padding:9px 18px;font-size:13px">
                    🔴 Start Recording
                  </button>
                ` : ''}
                ${speakingRecordingState === 'recording' ? `
                  <button class="button" id="stop-speaking-record-btn" type="button" style="background:#dc2626;padding:9px 18px;font-size:13px">
                    ⏹ Stop Recording
                  </button>
                ` : ''}
              </div>
            </div>
          </div>

          <div class="question" style="margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
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

            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid #f1f5f9">
              <button class="button" id="end-early-btn" type="button" style="background:#b91c1c;color:#fff;padding:9px 18px;font-size:13px;display:inline-flex;align-items:center;gap:6px">
                <span>⏹ End Test Early (Student Unable to Continue)</span>
              </button>

              ${speakingStep < current.questions.length - 1 ? `
                <button class="button" id="speaking-next-prompt-btn" type="button" style="padding:10px 22px;margin-left:auto">
                  <span>Next Question</span> <span aria-hidden="true">→</span>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    } else if (current.id === 'writing' || current.selectionType === 'single_choice') {
      const writingTopics = current.topics || current.questions || [];
      if (!answers['writing_selected_topic_id'] && writingTopics.length > 0) {
        answers['writing_selected_topic_id'] = writingTopics[0].id;
        answers['writing_selected_topic_title'] = writingTopics[0].title;
      }
      const currentTopicId = answers['writing_selected_topic_id'];
      const currentTopic = writingTopics.find((t) => t.id === currentTopicId) || writingTopics[0] || {};
      const currentEssayText = answers['writing-essay'] || answers['writing-0'] || answers['writing'] || '';

      contentHtml = `
        <div class="writing-selection-flow">
          <!-- Step Instructions Header -->
          <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:16px 20px;margin-bottom:20px">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:40px;height:40px;border-radius:50%;background:#2563eb;color:#fff;display:grid;place-items:center;font-size:18px;flex-shrink:0">
                ${ICONS.penTool}
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <h3 style="font:700 17px 'Space Grotesk';margin:0;color:#1e3a8a">Choose ONE Writing Topic</h3>
                  <span class="pill success" style="font-size:11.5px;font-weight:700">1 Essay Required</span>
                </div>
                <p style="font-size:13px;color:#1e40af;margin:3px 0 0">
                  Select 1 topic from the ${writingTopics.length} options below. You only need to create <strong>1 Essay</strong> based on your selected question (20 minutes).
                </p>
              </div>
            </div>
          </div>

          <!-- Topics Selector Cards -->
          <div class="writing-topics-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));gap:12px;margin-bottom:22px">
            ${writingTopics.map((t, idx) => {
              const isSelected = t.id === currentTopicId;
              return `
                <div class="topic-choice-card ${isSelected ? 'selected' : ''}" data-topic-id="${t.id}" style="cursor:pointer;padding:14px;border-radius:10px;border:2px solid ${isSelected ? '#2563eb' : '#cbd5e1'};background:${isSelected ? '#f0f7ff' : '#ffffff'};box-shadow:${isSelected ? '0 0 0 1px #2563eb' : 'none'};transition:all 0.15s ease;display:flex;flex-direction:column;justify-content:space-between">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
                    <span style="font-size:11px;font-weight:700;color:${isSelected ? '#2563eb' : 'var(--muted)'};text-transform:uppercase;letter-spacing:0.5px">Topic ${idx + 1}</span>
                    <input type="radio" name="writing_topic_choice" value="${t.id}" ${isSelected ? 'checked' : ''} style="accent-color:#2563eb;transform:scale(1.15);cursor:pointer">
                  </div>
                  <strong style="font-size:14px;color:var(--ink);line-height:1.35;margin-bottom:6px">${t.title}</strong>
                  <span style="font-size:11.5px;color:${isSelected ? '#1d4ed8' : 'var(--muted)'};font-weight:${isSelected ? '700' : '500'}">${isSelected ? '✓ Selected for Essay' : 'Click to select topic'}</span>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Active Selected Question Details Card -->
          <div class="question" style="margin-bottom:22px;border:2px solid #bfdbfe;background:#fcfdff;padding:22px;border-radius:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="pill success" style="font-weight:700">Selected Question</span>
                <strong style="font-size:16px;color:var(--ink)">${currentTopic.title || 'Selected Topic'}</strong>
              </div>
              <span class="attempt-pill">Topic ID: ${currentTopic.id}</span>
            </div>

            <p style="font-size:15.5px;font-weight:600;color:var(--ink);line-height:1.5;margin:0 0 14px">
              ${(currentTopic.prompt || '').replace(/\n/g, '<br>')}
            </p>

            ${currentTopic.guidingQuestions && currentTopic.guidingQuestions.length ? `
              <div style="background:#f8fafc;border-left:4px solid #2563eb;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:6px">
                <div style="font-size:12.5px;font-weight:700;color:#1e3a8a;margin-bottom:6px">Guiding Questions & Ideas:</div>
                <ul style="margin:0;padding-left:18px;font-size:13px;color:var(--ink);line-height:1.6">
                  ${currentTopic.guidingQuestions.map((g) => `<li>${g}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>

          <!-- Single Essay Textarea Editor -->
          <div class="question" style="padding:22px;border-radius:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="eyebrow" style="margin:0">Candidate Essay</span>
                <strong style="font-size:14px;color:var(--ink)">Response for ${currentTopic.title}</strong>
              </div>
              <span style="font-size:12px;color:var(--muted)">Target: <strong>150–220 words</strong></span>
            </div>

            <textarea class="writing-input" id="writing-essay" data-target="150" rows="12" placeholder="Write your complete essay on '${currentTopic.title}' here…" style="width:100%;border:1px solid var(--line);padding:16px;font:14.5px 'DM Sans';border-radius:8px;line-height:1.65"></textarea>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;flex-wrap:wrap;gap:8px">
              <span style="font-size:12px;color:var(--muted)">All typed words are autosaved in real time.</span>
              <span class="letter-counter-tag" id="counter-writing-essay">
                ${ICONS.penTool}
                <span>0 words</span>
              </span>
            </div>
          </div>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="questions-flow">
          ${current.questions.map((question, index) => `
            <div class="question" id="q-wrap-${question.id}">
              ${question.options ? `
                <div class="eyebrow" style="margin-bottom:8px">Question ${index + 1} of ${current.questions.length}</div>
              ` : `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
                  <span class="eyebrow" style="margin:0">Writing Task ${index + 1} of ${current.questions.length}</span>
                  <span class="attempt-pill" style="font-weight:700;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe">Writing Task ${index + 1} (Question ${index + 1})</span>
                </div>
              `}

              <p style="font-size:15.5px;font-weight:600;color:var(--ink);margin:0 0 14px;line-height:1.5">${question.prompt.replace(/\n/g, '<br>')}</p>

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
                  <textarea class="writing-input" id="writing-${index}" data-target="${index === 0 ? 120 : 180}" rows="9" placeholder="Compose your written response here…" style="width:100%;border:1px solid var(--line);padding:14px;font:14px 'DM Sans';border-radius:8px;line-height:1.6"></textarea>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;flex-wrap:wrap;gap:8px">
                    <span style="font-size:12px;color:var(--muted)">Target: <strong>${index === 0 ? '120–150 words' : '180–220 words'}</strong></span>
                    <span class="letter-counter-tag" id="counter-writing-${index}">
                      ${ICONS.penTool}
                      <span>0 words</span>
                    </span>
                  </div>
                </div>
              `}
            </div>
          `).join('')}
        </div>
      `;
    }

    if (!hasRestoredToastShown && Object.keys(answers).length > 0) {
      hasRestoredToastShown = true;
      const count = Object.keys(answers).filter((k) => !k.includes('title')).length;
      showToast(`✓ Previous progress restored: ${count} saved answers recovered.`, 'info');
    }

    const canSubmitSpeaking = !speaking || speakingRecordingState === 'stopped' || speakingRecordingState === 'idle';

    app.innerHTML = `
      <div class="teacher-shell">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
          <div class="top-nav-row" style="margin-bottom:0">
            ${test.sections.map((sec, idx) => {
              const isSecActive = idx === sectionIndex;
              const isSecPast = idx < sectionIndex;
              return `
                <div class="section-step-pill ${isSecActive ? 'active' : ''} ${isSecPast ? 'completed' : ''}">
                  <div class="step-num">${isSecPast ? '✓' : idx + 1}</div>
                  <span class="step-label">${sec.label}</span>
                </div>
              `;
            }).join('')}
          </div>
          <div id="autosave-indicator" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#16a34a;background:#f0fdf4;padding:6px 14px;border-radius:20px;border:1px solid #bbf7d0;box-shadow:0 1px 3px rgba(0,0,0,0.05);transition:all 0.2s ease">
            ${ICONS.check} <span>All answers saved</span>
          </div>
        </div>

        <section class="hero">
          <div>
            <div class="eyebrow">Section ${sectionIndex + 1} of ${test.sections.length}</div>
            <h1>${current.label}</h1>
            <p>${current.instructions || 'Answer all questions carefully before proceeding.'}</p>
          </div>
          <div class="hero-note" id="timer-box">
            <strong id="timer">--:--</strong>
            <span id="timer-subtitle">${current.label} Remaining</span>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>${current.label} ${speaking ? 'Interview' : 'Questions'}</h2>
            <span class="status">${current.questions.length} ${speaking ? 'interview prompts' : 'questions'} · ${current.durationMinutes} mins allocated</span>
          </div>

          ${contentHtml}

          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:28px;padding-top:20px;border-top:1px solid var(--line)">
            <button class="ghost" id="previous" ${sectionIndex === 0 || speaking ? 'hidden' : ''} type="button">
              ← Previous Section
            </button>
            <button class="button" id="next" type="button" style="margin-left:auto;padding:12px 24px">
              ${isLastSection ? 'Submit Assessment ✓' : 'Next Section →'}
            </button>
          </div>
        </section>
      </div>
    `;

    document.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.addEventListener('change', () => {
        answers[input.name] = input.value;
        const parentTiles = input.closest('.options-container')?.querySelectorAll('.option-tile');
        parentTiles?.forEach((tile) => tile.classList.remove('selected'));
        input.closest('.option-tile')?.classList.add('selected');
        persistProgress(true);
      });
    });

    // Bind Topic Choice Cards for Writing Section
    document.querySelectorAll('.topic-choice-card').forEach((card) => {
      card.addEventListener('click', () => {
        const tid = card.dataset.topicId;
        const writingTopics = current.topics || current.questions || [];
        const t = writingTopics.find((x) => x.id === tid);
        answers['writing_selected_topic_id'] = tid;
        if (t) answers['writing_selected_topic_title'] = t.title;
        persistProgress(true);
        draw();
      });
    });

    document.querySelectorAll('.writing-input').forEach((input) => {
      input.value = answers[input.id] || answers['writing-0'] || answers['writing'] || '';
      const updateWordCount = () => {
        const text = input.value.trim();
        const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        const target = Number(input.dataset.target) || 150;
        const counter = document.querySelector(`#counter-${input.id}`);
        if (counter) {
          const isGood = words >= target;
          counter.className = `letter-counter-tag ${isGood ? 'good' : ''}`;
          counter.innerHTML = `${ICONS.penTool} <span>${words} word${words === 1 ? '' : 's'}${isGood ? ' ✓' : ''}</span>`;
        }
      };
      updateWordCount();
      input.addEventListener('input', () => {
        answers[input.id] = input.value;
        if (input.id === 'writing-essay') {
          answers['writing-0'] = input.value;
          answers['writing'] = input.value;
        }
        updateWordCount();
        persistProgress(false);
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
          console.warn('Camera/mic fallback:', err);
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            mediaStream.getAudioTracks().forEach((track) => { track.enabled = true; });
            if (preview) preview.srcObject = mediaStream;
            attachAudioVisualizer(mediaStream);
            return mediaStream;
          } catch (e2) {
            console.warn('Camera/mic access error:', e2);
            const st = document.querySelector('#recording-status');
            if (st) st.textContent = 'Camera/mic permission unavailable (Proceeding without video)';
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

      // Audio prompt player
      const playSpeakingBtn = document.querySelector('#play-speaking-prompt-btn');
      if (playSpeakingBtn) {
        playSpeakingBtn.onclick = () => {
          const textToSpeak = playSpeakingBtn.dataset.text || activePrompt.prompt;
          playSpeakingBtn.disabled = true;
          playSpeakingBtn.innerHTML = `${ICONS.volume2} <span>Playing Spoken Prompt…</span>`;
          playSpeakingBtn.style.background = '#fef3c7';
          playSpeakingBtn.style.color = '#92400e';
          speakQuestionAudio(
            textToSpeak,
            speakingStep,
            null,
            () => {
              playSpeakingBtn.disabled = false;
              playSpeakingBtn.innerHTML = `${ICONS.volume2} <span>Play Spoken Prompt</span>`;
              playSpeakingBtn.style.background = '#16a34a';
              playSpeakingBtn.style.color = '#fff';
            },
            () => {
              playSpeakingBtn.disabled = false;
              playSpeakingBtn.innerHTML = `${ICONS.volume2} <span>Play Spoken Prompt</span>`;
              playSpeakingBtn.style.background = '#16a34a';
              playSpeakingBtn.style.color = '#fff';
            }
          );
        };
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
          persistProgress(true);
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
          persistProgress(true);
          draw();
        };
      }

      const endEarlyBtn = document.querySelector('#end-early-btn');
      if (endEarlyBtn) {
        endEarlyBtn.onclick = () => {
          const modalBackdrop = document.createElement('div');
          modalBackdrop.className = 'modal-backdrop';
          modalBackdrop.innerHTML = `
            <div class="modal-card" style="max-width:500px;border-radius:14px;padding:26px">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
                <div style="width:40px;height:40px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:22px;flex-shrink:0">⚠️</div>
                <h3 style="font:700 20px 'Space Grotesk';margin:0;color:var(--ink)">End Speaking Assessment Early?</h3>
              </div>
              <p style="color:var(--muted);font-size:14px;line-height:1.6;margin:0 0 20px">
                If the student is unable to answer subsequent questions, you can conclude the test now.
                All written tasks, recorded responses, and grammar answers completed so far will be preserved and submitted.
              </p>
              <div style="display:flex;justify-content:flex-end;gap:10px">
                <button class="ghost" id="modal-cancel-early" type="button" style="padding:9px 18px">Cancel & Continue</button>
                <button class="button" id="modal-confirm-early" type="button" style="background:#dc2626;color:#fff;padding:9px 20px">Yes, Conclude & Submit</button>
              </div>
            </div>
          `;
          document.body.appendChild(modalBackdrop);
          modalBackdrop.querySelector('#modal-cancel-early').onclick = () => modalBackdrop.remove();
          modalBackdrop.querySelector('#modal-confirm-early').onclick = async () => {
            modalBackdrop.remove();
            await submitAssessment(true);
          };
        };
      }
    }

    document.querySelector('#previous')?.addEventListener('click', async () => {
      await stopMedia();
      sectionIndex -= 1;
      speakingStep = 0;
      persistProgress(true);
      draw();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.querySelector('#next').onclick = async () => {
      persistProgress(true);
      if (sectionIndex < test.sections.length - 1) {
        await advanceToNextSection();
        return;
      }
      const nextBtn = document.querySelector('#next');
      nextBtn.disabled = true;
      nextBtn.textContent = 'Submitting responses…';
      await submitAssessment(false);
    };

    startSectionTimer();
  };

  draw();
}

const getStoredAdminTab = () => {
  const hash = window.location.hash.replace('#', '').trim();
  if (['results', 'users', 'questions', 'rubrics'].includes(hash)) return hash;
  const stored = localStorage.getItem('assessify_admin_tab');
  if (['results', 'users', 'questions', 'rubrics'].includes(stored)) return stored;
  return 'results';
};

const adminState = {
  activeTab: getStoredAdminTab(),
  stagedQuestions: null,
  stagedRubrics: null
};

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '').trim();
  if (['results', 'users', 'questions', 'rubrics'].includes(hash) && adminState.activeTab !== hash) {
    renderAdmin(hash);
  }
});

async function renderAdmin(tab) {
  if (!tab || !['results', 'users', 'questions', 'rubrics'].includes(tab)) {
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
        <div style="display:flex;flex-direction:column;gap:18px">
          <div class="sidebar-section">
            <div class="sidebar-title">Main Menu</div>
            <nav class="sidebar-nav">
              <button class="sidebar-btn ${tab === 'results' ? 'active' : ''}" id="nav-results" type="button">
                <span class="sidebar-icon">${ICONS.results}</span>
                <span>Candidate Results</span>
              </button>
            </nav>
          </div>

          <div class="sidebar-section" style="border-top:1px solid var(--line);padding-top:18px">
            <div class="sidebar-title">Settings</div>
            <nav class="sidebar-nav">
              <button class="sidebar-btn ${tab === 'users' ? 'active' : ''}" id="nav-users" type="button">
                <span class="sidebar-icon">${ICONS.users}</span>
                <span>User Manager</span>
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
        </div>
        <div style="margin-top:auto;padding-top:16px;border-top:1px solid var(--line);font-size:12px;color:var(--muted);text-align:center">
          <div>English Assessment</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">Version: <strong>2026.1</strong></div>
        </div>
      </aside>
      <main class="admin-main" id="admin-content">
        <p style="color:var(--muted)">Loading workspace…</p>
      </main>
    </div>
  `;

  document.querySelector('#nav-results').onclick = () => renderAdmin('results');
  document.querySelector('#nav-users').onclick = () => renderAdmin('users');
  document.querySelector('#nav-questions').onclick = () => renderAdmin('questions');
  document.querySelector('#nav-rubrics').onclick = () => renderAdmin('rubrics');

  const mainContainer = document.querySelector('#admin-content');

  if (tab === 'results') {
    await renderAdminResultsTab(mainContainer);
  } else if (tab === 'users') {
    await renderAdminUsersTab(mainContainer);
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
        <a class="btn-icon" id="export-excel-btn" href="/api/admin/results/export?format=xlsx" download="assessify-teacher-results.xlsx" title="Download Excel spreadsheet">
          ${ICONS.excel} <span>Export Excel</span>
        </a>
        <a class="btn-icon" id="export-pdf-btn" href="/api/admin/results/export?format=pdf" download="assessify-results.pdf" title="Download PDF report">
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
    const fileSuffix = selectedUnit ? `-${selectedUnit.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
    if (excelBtn) {
      excelBtn.href = `/api/admin/results/export?format=xlsx${unitParam}`;
      excelBtn.setAttribute('download', `assessify-teacher-results${fileSuffix}.xlsx`);
    }
    if (pdfBtn) {
      pdfBtn.href = `/api/admin/results/export?format=pdf${unitParam}`;
      pdfBtn.setAttribute('download', `assessify-results${fileSuffix}.pdf`);
    }

    bindDetails();
  };

  document.querySelector('#search').oninput = filter;
  document.querySelector('#unit-filter').onchange = filter;
  document.querySelector('#status').onchange = filter;
  document.querySelector('#review-filter').onchange = filter;
  bindDetails();
}

async function renderAdminUsersTab(container) {
  const [teachersRes, adminsRes] = await Promise.all([
    request('/api/admin/teachers'),
    request('/api/admin/admins')
  ]);

  if (teachersRes.error) return showToast(teachersRes.error, 'error');

  const teachers = (teachersRes.teachers || []).map((t) => ({ ...t, role: 'candidate', status: t.status || 'active' }));
  const admins = (adminsRes.admins || []).map((a) => ({ ...a, role: 'admin', unit: 'All School Units', status: a.status || 'active' }));
  const allUsers = [...admins, ...teachers];

  const selectedKeys = new Set();

  const renderDashboard = () => {
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:24px">
        <div>
          <div class="eyebrow">School Administration</div>
          <h1 style="font:700 32px 'Space Grotesk';margin:6px 0 4px;color:var(--ink)">User Manager</h1>
          <p style="color:var(--muted);font-size:14px;margin:0">Manage authorized educators and administrators across Karya Bangsa School.</p>
        </div>
        <div class="admin-toolbar">
          <button class="button" id="btn-add-user" type="button" style="display:flex;align-items:center;gap:6px">
            <span>+</span> <span>Add New User</span>
          </button>
        </div>
      </div>

      <!-- 4-Column Modern KPI Cards Grid -->
      <div class="admin-kpis-grid cols-4">
        <div class="kpi-card kpi-indigo">
          <div class="kpi-card-info">
            <strong>${allUsers.length}</strong>
            <span>Total Accounts</span>
          </div>
          <div class="kpi-card-icon">${ICONS.users}</div>
        </div>
        <div class="kpi-card kpi-blue">
          <div class="kpi-card-info">
            <strong>${teachers.length}</strong>
            <span>Placement Candidates</span>
          </div>
          <div class="kpi-card-icon">${ICONS.penTool}</div>
        </div>
        <div class="kpi-card kpi-purple">
          <div class="kpi-card-info">
            <strong>${admins.length}</strong>
            <span>Administrators</span>
          </div>
          <div class="kpi-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
        </div>
        <div class="kpi-card kpi-green">
          <div class="kpi-card-info">
            <strong>5 Units</strong>
            <span>KB-TK · SD · SMP · SMA · SMK</span>
          </div>
          <div class="kpi-card-icon">${ICONS.school}</div>
        </div>
      </div>

      <!-- Bulk Actions Bar -->
      <div class="bulk-actions-bar" id="user-bulk-bar" style="display:none">
        <div class="bulk-selected-info">
          <span class="bulk-count-badge" id="user-selected-count">0</span>
          <span>accounts selected</span>
        </div>
        <div class="bulk-actions-btns">
          <button type="button" class="btn-bulk-export" id="btn-bulk-activate" title="Activate selected accounts">
            ⚡ Activate
          </button>
          <button type="button" class="btn-bulk-export" id="btn-bulk-suspend" title="Suspend selected accounts" style="border-color:rgba(245,158,11,0.4);color:#fef3c7">
            ⏸ Suspend
          </button>
          <button type="button" class="btn-bulk-export" id="btn-bulk-archive" title="Archive selected accounts" style="border-color:rgba(148,163,184,0.4);color:#e2e8f0">
            📦 Archive
          </button>
          <button type="button" class="btn-bulk-export" id="btn-bulk-delete" title="Delete selected accounts" style="border-color:rgba(239,68,68,0.5);color:#fecaca">
            ${ICONS.trash} Delete
          </button>
        </div>
      </div>

      <!-- User Accounts Table Card (Styled like Teacher Results page) -->
      <div class="panel" style="padding:24px 28px">
        <div class="table-toolbar">
          <div class="search-wrap">
            <span class="search-icon-prefix">${ICONS.search}</span>
            <input id="user-search" placeholder="Search by name, email, or unit…">
          </div>
          <select class="select-filter" id="user-role-filter">
            <option value="">All Accounts (${allUsers.length})</option>
            <option value="candidate">Candidates (${teachers.length})</option>
            <option value="admin">Administrators (${admins.length})</option>
          </select>
          <select class="select-filter" id="user-status-filter">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
          </select>
          <select class="select-filter" id="user-unit-filter" style="min-width:160px">
            <option value="">All Units</option>
            <option value="KB-TK GOLDEN BEE">KB-TK GOLDEN BEE</option>
            <option value="SD KARYA BANGSA">SD KARYA BANGSA</option>
            <option value="SMP KARYA BANGSA">SMP KARYA BANGSA</option>
            <option value="SMA KARYA BANGSA">SMA KARYA BANGSA</option>
            <option value="SMK KARYA BANGSA">SMK KARYA BANGSA</option>
          </select>
        </div>

        <!-- Data Table -->
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th style="width:40px;text-align:center;padding:12px 8px">
                  <input type="checkbox" id="user-select-all" class="custom-table-checkbox" title="Select all accounts">
                </th>
                <th style="width:26%">User / Name</th>
                <th style="width:20%">Account / Identifier</th>
                <th style="width:16%">System Role</th>
                <th style="width:16%">Assigned Unit / Scope</th>
                <th style="width:11%">Status</th>
                <th style="width:11%;text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody id="users-table-body"></tbody>
          </table>
        </div>
      </div>
    `;

    const searchInput = container.querySelector('#user-search');
    const roleFilter = container.querySelector('#user-role-filter');
    const statusFilter = container.querySelector('#user-status-filter');
    const unitFilter = container.querySelector('#user-unit-filter');
    const tbody = container.querySelector('#users-table-body');
    const selectAllCheckbox = container.querySelector('#user-select-all');
    const bulkBar = container.querySelector('#user-bulk-bar');
    const bulkCount = container.querySelector('#user-selected-count');
    const addUserBtn = container.querySelector('#btn-add-user');

    addUserBtn.onclick = () => openUserModal(null, roleFilter?.value === 'admin' ? 'admin' : 'candidate');

    const updateBulkBar = () => {
      if (!bulkBar || !bulkCount) return;
      if (selectedKeys.size > 0) {
        bulkBar.style.display = 'flex';
        bulkCount.textContent = selectedKeys.size;
      } else {
        bulkBar.style.display = 'none';
      }
    };

    const updateTable = () => {
      const q = (searchInput?.value || '').toLowerCase().trim();
      const r = (roleFilter?.value || '').trim();
      const s = (statusFilter?.value || '').trim();
      const u = (unitFilter?.value || '').trim();

      const filtered = allUsers.filter((user) => {
        const matchRole = !r || user.role === r || (r === 'candidate' && (user.role === 'candidate' || user.role === 'teacher'));
        const matchStatus = !s || (user.status || 'active') === s;
        const matchUnit = !u || (user.unit || '').trim().toLowerCase() === u.toLowerCase();
        const searchStr = `${user.name || ''} ${user.email || ''} ${user.username || ''} ${user.unit || ''}`.toLowerCase();
        const matchSearch = !q || searchStr.includes(q);
        return matchRole && matchStatus && matchUnit && matchSearch;
      });

      if (!filtered.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center;padding:48px 16px;color:var(--muted)">
              <div style="font-size:32px;margin-bottom:8px">👥</div>
              <div style="font-weight:700;font-size:15px;color:var(--ink)">No Accounts Found</div>
              <div style="font-size:13px;color:var(--muted);margin-top:4px">Try adjusting your search query, role, status, or unit filter.</div>
            </td>
          </tr>
        `;
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        return;
      }

      tbody.innerHTML = filtered.map((item) => {
        const isAdminUser = item.role === 'admin';
        const key = `${item.role}_${item.id}`;
        const isChecked = selectedKeys.has(key);

        const rolePill = isAdminUser
          ? `<span class="pill" style="background:#f3e8ff;color:#7e22ce;border:1px solid #e9d5ff;font-weight:700">Admin</span>`
          : `<span class="pill" style="background:#eff6ff;color:#1d4ed8;border:1px solid #dbeafe;font-weight:700">Placement Candidate</span>`;

        const unitPill = isAdminUser
          ? `<span class="unit-pill" style="background:#faf5ff;color:#6b21a8;border-color:#e9d5ff;font-weight:600">All Units (Full Access)</span>`
          : `<span class="unit-pill">${item.unit}</span>`;

        const identifier = isAdminUser
          ? `<span style="color:var(--muted);font-weight:700;font-size:15px">-</span>`
          : `<span style="font-family:monospace;font-size:13px;color:var(--ink);background:#f1f5f9;padding:3px 8px;border-radius:4px">${item.email}</span>`;

        const avatarStyle = isAdminUser ? 'background:#f3e8ff;color:#7e22ce;border-color:#e9d5ff;' : '';

        const st = item.status || 'active';
        let statusPill = `<span class="pill success"><span class="pill-dot"></span> Active</span>`;
        if (st === 'suspended') {
          statusPill = `<span class="pill" style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;font-weight:600"><span class="pill-dot" style="background:#f59e0b"></span> Suspended</span>`;
        } else if (st === 'archived') {
          statusPill = `<span class="pill" style="background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;font-weight:600"><span class="pill-dot" style="background:#94a3b8"></span> Archived</span>`;
        }

        return `
          <tr data-user-id="${item.id}" data-role="${item.role}" data-key="${key}">
            <td style="text-align:center;padding:12px 8px">
              <input type="checkbox" class="user-row-checkbox custom-table-checkbox" data-key="${key}" data-id="${item.id}" data-role="${item.role}" title="Select ${item.name}" ${isChecked ? 'checked' : ''}>
            </td>
            <td>
              <div class="teacher-cell">
                <div class="teacher-avatar-sm" style="${avatarStyle}">${(item.name || 'U').charAt(0).toUpperCase()}</div>
                <div>
                  <div class="teacher-meta-name">${item.name}</div>
                  <div class="teacher-meta-email">ID: #${item.id}</div>
                </div>
              </div>
            </td>
            <td>${identifier}</td>
            <td>${rolePill}</td>
            <td>${unitPill}</td>
            <td>${statusPill}</td>
            <td style="text-align:right">
              <div class="action-btn-group" style="justify-content:flex-end;gap:5px">
                <!-- 1. Edit Button (Icon Only) -->
                <button type="button" class="btn-action-icon btn-edit-user" data-id="${item.id}" data-role="${item.role}" title="Edit User">
                  ${ICONS.edit}
                </button>

                <!-- 2. Suspend / Reactivate Button (Icon Only) -->
                ${st === 'suspended' ? `
                  <button type="button" class="btn-action-icon btn-reactivate-user" data-id="${item.id}" data-role="${item.role}" title="Activate Account">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  </button>
                ` : `
                  <button type="button" class="btn-action-icon btn-suspend-user" data-id="${item.id}" data-role="${item.role}" title="Suspend Account">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="10" y1="15" x2="10" y2="9"></line><line x1="14" y1="15" x2="14" y2="9"></line></svg>
                  </button>
                `}

                <!-- 3. Archive / Unarchive Button (Icon Only) -->
                ${st === 'archived' ? `
                  <button type="button" class="btn-action-icon btn-unarchive-user" data-id="${item.id}" data-role="${item.role}" title="Unarchive (Restore)">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line><path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9"></path><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"></path></svg>
                  </button>
                ` : `
                  <button type="button" class="btn-action-icon btn-archive-user" data-id="${item.id}" data-role="${item.role}" title="Archive Account">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                  </button>
                `}

                <!-- 4. Delete Button (Icon Only) -->
                <button type="button" class="btn-delete-ghost btn-delete-user" data-id="${item.id}" data-role="${item.role}" title="Delete User">
                  ${ICONS.trash}
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Bind row checkboxes
      tbody.querySelectorAll('.user-row-checkbox').forEach((cb) => {
        cb.onchange = (e) => {
          const key = e.target.dataset.key;
          if (e.target.checked) selectedKeys.add(key);
          else selectedKeys.delete(key);
          updateBulkBar();
          updateSelectAllState(filtered);
        };
      });

      // Bind status action buttons
      tbody.querySelectorAll('.btn-suspend-user').forEach((btn) => {
        btn.onclick = () => {
          const target = findUser(btn.dataset.id, btn.dataset.role);
          if (target) changeUserStatus(target, 'suspended');
        };
      });

      tbody.querySelectorAll('.btn-reactivate-user').forEach((btn) => {
        btn.onclick = () => {
          const target = findUser(btn.dataset.id, btn.dataset.role);
          if (target) changeUserStatus(target, 'active');
        };
      });

      tbody.querySelectorAll('.btn-archive-user').forEach((btn) => {
        btn.onclick = () => {
          const target = findUser(btn.dataset.id, btn.dataset.role);
          if (target) changeUserStatus(target, 'archived');
        };
      });

      tbody.querySelectorAll('.btn-unarchive-user').forEach((btn) => {
        btn.onclick = () => {
          const target = findUser(btn.dataset.id, btn.dataset.role);
          if (target) changeUserStatus(target, 'active');
        };
      });

      tbody.querySelectorAll('.btn-edit-user').forEach((btn) => {
        btn.onclick = () => {
          const target = findUser(btn.dataset.id, btn.dataset.role);
          if (target) openUserModal(target, btn.dataset.role);
        };
      });

      tbody.querySelectorAll('.btn-delete-user').forEach((btn) => {
        btn.onclick = () => {
          const target = findUser(btn.dataset.id, btn.dataset.role);
          if (target) openDeleteUserModal(target);
        };
      });

      updateSelectAllState(filtered);
      updateBulkBar();
    };

    const findUser = (id, role) => {
      return role === 'admin'
        ? admins.find((a) => String(a.id) === String(id))
        : teachers.find((t) => String(t.id) === String(id));
    };

    const changeUserStatus = async (user, newStatus) => {
      const endpoint = user.role === 'admin' ? `/api/admin/admins/${user.id}/status` : `/api/admin/teachers/${user.id}/status`;
      const res = await request(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.error) return showToast(res.error, 'error');
      user.status = newStatus;
      showToast(`✓ Account "${user.name}" marked as ${newStatus}.`, 'success');
      updateTable();
    };

    const updateSelectAllState = (filtered) => {
      if (!selectAllCheckbox) return;
      const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selectedKeys.has(`${u.role}_${u.id}`));
      const someFilteredSelected = filtered.some((u) => selectedKeys.has(`${u.role}_${u.id}`));
      selectAllCheckbox.checked = allFilteredSelected;
      selectAllCheckbox.indeterminate = !allFilteredSelected && someFilteredSelected;
    };

    if (selectAllCheckbox) {
      selectAllCheckbox.onchange = () => {
        const q = (searchInput?.value || '').toLowerCase().trim();
        const r = (roleFilter?.value || '').trim();
        const s = (statusFilter?.value || '').trim();
        const u = (unitFilter?.value || '').trim();

        const filtered = allUsers.filter((user) => {
          const matchRole = !r || user.role === r || (r === 'candidate' && (user.role === 'candidate' || user.role === 'teacher'));
          const matchStatus = !s || (user.status || 'active') === s;
          const matchUnit = !u || (user.unit || '').trim().toLowerCase() === u.toLowerCase();
          const searchStr = `${user.name || ''} ${user.email || ''} ${user.username || ''} ${user.unit || ''}`.toLowerCase();
          return matchRole && matchStatus && matchUnit && (!q || searchStr.includes(q));
        });

        if (selectAllCheckbox.checked) {
          filtered.forEach((user) => selectedKeys.add(`${user.role}_${user.id}`));
        } else {
          filtered.forEach((user) => selectedKeys.delete(`${user.role}_${user.id}`));
        }
        updateTable();
      };
    }

    // Bulk action handlers
    const getSelectedTargets = () => {
      const targets = [];
      selectedKeys.forEach((key) => {
        const [role, id] = key.split('_');
        targets.push({ id: Number(id) || id, role });
      });
      return targets;
    };

    const applyBulkStatus = async (status) => {
      const targets = getSelectedTargets();
      if (!targets.length) return;
      const res = await request('/api/admin/users/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets, status })
      });
      if (res.error) return showToast(res.error, 'error');
      targets.forEach((t) => {
        const u = findUser(t.id, t.role);
        if (u) u.status = status;
      });
      selectedKeys.clear();
      showToast(`✓ Updated ${res.updatedCount || targets.length} accounts to ${status}.`, 'success');
      updateTable();
    };

    container.querySelector('#btn-bulk-activate').onclick = () => applyBulkStatus('active');
    container.querySelector('#btn-bulk-suspend').onclick = () => applyBulkStatus('suspended');
    container.querySelector('#btn-bulk-archive').onclick = () => applyBulkStatus('archived');
    container.querySelector('#btn-bulk-delete').onclick = async () => {
      const targets = getSelectedTargets();
      if (!targets.length) return;
      if (!confirm(`Are you sure you want to delete ${targets.length} selected accounts?`)) return;
      const res = await request('/api/admin/users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets })
      });
      if (res.error) return showToast(res.error, 'error');
      showToast(`✓ Deleted ${res.deletedCount || targets.length} accounts.`, 'success');
      renderAdmin('users');
    };

    if (searchInput) searchInput.oninput = updateTable;
    if (roleFilter) roleFilter.onchange = updateTable;
    if (statusFilter) statusFilter.onchange = updateTable;
    if (unitFilter) unitFilter.onchange = updateTable;
    updateTable();
  };

  renderDashboard();
}

function openUserModal(user = null, defaultRole = 'candidate') {
  const isEdit = Boolean(user);
  let selectedRole = isEdit ? user.role : defaultRole;
  const modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) return;

  const renderModal = () => {
    modalRoot.innerHTML = `
      <div class="modal-backdrop" id="user-modal-backdrop">
        <div class="modal-card" style="max-width:540px" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
          <div class="modal-header">
            <div class="modal-title-wrap">
              <div class="modal-icon" style="background:${selectedRole === 'admin' ? 'rgba(126,34,206,0.1)' : 'rgba(37,99,235,0.1)'};color:${selectedRole === 'admin' ? '#7e22ce' : '#2563eb'}">
                ${selectedRole === 'admin' ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' : ICONS.users}
              </div>
              <div>
                <h2 id="user-modal-title" style="margin:0">${isEdit ? (selectedRole === 'admin' ? 'Edit Administrator' : 'Edit Placement Candidate') : 'Add New User'}</h2>
                <p style="margin:2px 0 0;font-size:13px;color:var(--muted)">${isEdit ? 'Update account details and credentials.' : 'Create a new candidate or administrator account.'}</p>
              </div>
            </div>
            <button class="modal-close" id="close-user-modal" type="button" aria-label="Close modal">✕</button>
          </div>
          <div class="modal-body" style="padding:20px 24px">
            <form id="user-modal-form">
              <!-- Role Selector (Only when creating new user) -->
              ${!isEdit ? `
                <label style="display:block;font-size:13px;font-weight:700;margin-bottom:8px;color:var(--ink)">Account Role</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px">
                  <label style="display:flex;align-items:center;gap:8px;padding:12px;border:1.5px solid ${selectedRole === 'candidate' ? 'var(--blue)' : 'var(--line)'};border-radius:8px;cursor:pointer;background:${selectedRole === 'candidate' ? '#eff6ff' : 'var(--white)'}">
                    <input type="radio" name="modal-role" value="candidate" ${selectedRole === 'candidate' ? 'checked' : ''} style="accent-color:var(--blue)">
                    <div>
                      <div style="font-weight:700;font-size:13.5px;color:var(--ink)">Placement Candidate</div>
                      <div style="font-size:11.5px;color:var(--muted)">candidate taking assessment</div>
                    </div>
                  </label>
                  <label style="display:flex;align-items:center;gap:8px;padding:12px;border:1.5px solid ${selectedRole === 'admin' ? '#7e22ce' : 'var(--line)'};border-radius:8px;cursor:pointer;background:${selectedRole === 'admin' ? '#faf5ff' : 'var(--white)'}">
                    <input type="radio" name="modal-role" value="admin" ${selectedRole === 'admin' ? 'checked' : ''} style="accent-color:#7e22ce">
                    <div>
                      <div style="font-weight:700;font-size:13.5px;color:var(--ink)">Administrator</div>
                      <div style="font-size:11.5px;color:var(--muted)">Full Portal Access</div>
                    </div>
                  </label>
                </div>
              ` : ''}

              <!-- Common: Full Name -->
              <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                Full Name <span style="font-weight:400;color:var(--muted)">${selectedRole === 'candidate' ? '(with academic title)' : ''}</span>
              </label>
              <input type="text" id="um-name" name="name" value="${user ? user.name : ''}" placeholder="${selectedRole === 'admin' ? 'e.g. Refka Admin' : 'e.g. Siti Aminah, S.Pd.'}" required style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">

              <!-- Teacher Fields -->
              ${selectedRole === 'candidate' ? `
                <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                  Official School Email <span style="font-weight:400;color:var(--muted)">(@karyabangsa.sch.id)</span>
                </label>
                <input type="email" id="um-email" name="email" value="${user?.email || ''}" placeholder="name@karyabangsa.sch.id" required style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">

                <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                  Assigned School Unit
                </label>
                <select id="um-unit" name="unit" class="select-filter" required style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">
                  <option value="" disabled ${!user ? 'selected' : ''}>Select School Unit</option>
                  <option value="KB-TK GOLDEN BEE" ${user?.unit === 'KB-TK GOLDEN BEE' ? 'selected' : ''}>KB-TK GOLDEN BEE</option>
                  <option value="SD KARYA BANGSA" ${user?.unit === 'SD KARYA BANGSA' ? 'selected' : ''}>SD KARYA BANGSA</option>
                  <option value="SMP KARYA BANGSA" ${user?.unit === 'SMP KARYA BANGSA' ? 'selected' : ''}>SMP KARYA BANGSA</option>
                  <option value="SMA KARYA BANGSA" ${user?.unit === 'SMA KARYA BANGSA' ? 'selected' : ''}>SMA KARYA BANGSA</option>
                  <option value="SMK KARYA BANGSA" ${user?.unit === 'SMK KARYA BANGSA' ? 'selected' : ''}>SMK KARYA BANGSA</option>
                </select>
              ` : `
                <!-- Administrator Fields -->
                <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                  Admin Username <span style="font-weight:400;color:var(--muted)">(used for admin sign-in)</span>
                </label>
                <input type="text" id="um-username" name="username" value="${user?.username || ''}" placeholder="e.g. refka" required style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">

                <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                  ${isEdit ? 'New Password <span style="font-weight:400;color:var(--muted)">(leave blank to keep current)</span>' : 'Password <span style="font-weight:400;color:var(--muted)">(min. 4 characters)</span>'}
                </label>
                <input type="password" id="um-password" name="password" placeholder="${isEdit ? '••••••••' : 'Enter admin password'}" ${isEdit ? '' : 'required'} style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">

                <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                  Email Address <span style="font-weight:400;color:var(--muted)">(optional)</span>
                </label>
                <input type="email" id="um-admin-email" name="email" value="${user?.email || ''}" placeholder="admin@karyabangsa.sch.id" style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">
              `}

              <!-- Account Status Selector -->
              <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                Account Status
              </label>
              <select id="um-status" name="status" class="select-filter" style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:8px">
                <option value="active" ${(user?.status || 'active') === 'active' ? 'selected' : ''}>Active</option>
                <option value="suspended" ${user?.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                <option value="archived" ${user?.status === 'archived' ? 'selected' : ''}>Archived</option>
              </select>

              <div id="um-error" style="color:#dc2626;background:#fef2f2;border:1px solid #fecaca;padding:10px 14px;border-radius:7px;font-size:13px;margin-top:12px;display:none"></div>

              <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px">
                <button type="button" class="button ghost" id="btn-cancel-um" style="padding:10px 18px">Cancel</button>
                <button type="submit" class="button" id="btn-save-um" style="padding:10px 22px;display:flex;align-items:center;gap:6px">
                  ${ICONS.check} <span>${isEdit ? 'Save Changes' : (selectedRole === 'admin' ? 'Create Administrator' : 'Add Candidate')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => { modalRoot.innerHTML = ''; };
    modalRoot.querySelector('#close-user-modal').onclick = closeModal;
    modalRoot.querySelector('#btn-cancel-um').onclick = closeModal;
    modalRoot.querySelector('#user-modal-backdrop').onclick = (e) => {
      if (e.target.id === 'user-modal-backdrop') closeModal();
    };

    if (!isEdit) {
      modalRoot.querySelectorAll('input[name="modal-role"]').forEach((r) => {
        r.onchange = () => {
          selectedRole = r.value;
          renderModal();
        };
      });
    }

    const form = modalRoot.querySelector('#user-modal-form');
    const errEl = modalRoot.querySelector('#um-error');
    const saveBtn = modalRoot.querySelector('#btn-save-um');

    form.onsubmit = async (e) => {
      e.preventDefault();
      errEl.style.display = 'none';
      errEl.textContent = '';

      const name = modalRoot.querySelector('#um-name').value.trim();

      if (selectedRole === 'candidate') {
        const email = modalRoot.querySelector('#um-email').value.trim().toLowerCase();
        const unit = modalRoot.querySelector('#um-unit').value.trim();

        if (!name || !email || !unit) {
          errEl.textContent = 'Please fill in all required fields.';
          errEl.style.display = 'block';
          return;
        }

        if (!email.endsWith('@karyabangsa.sch.id')) {
          errEl.textContent = 'Email must belong to the school domain (@karyabangsa.sch.id).';
          errEl.style.display = 'block';
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        const status = modalRoot.querySelector('#um-status')?.value || 'active';
        const url = isEdit ? `/api/admin/teachers/${user.id}` : '/api/admin/teachers';
        const method = isEdit ? 'PUT' : 'POST';
        const res = await request(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, unit, status })
        });

        if (res.error) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `${ICONS.check} <span>${isEdit ? 'Save Changes' : 'Add Candidate'}</span>`;
          errEl.textContent = res.error;
          errEl.style.display = 'block';
          return;
        }

        closeModal();
        showToast(isEdit ? `✓ Placement candidate "${name}" updated successfully!` : `✓ Placement candidate "${name}" added to roster!`, 'success');
        renderAdmin('users');
      } else {
        const username = modalRoot.querySelector('#um-username').value.trim().toLowerCase();
        const password = modalRoot.querySelector('#um-password').value.trim();
        const email = (modalRoot.querySelector('#um-admin-email')?.value || '').trim().toLowerCase();
        const status = modalRoot.querySelector('#um-status')?.value || 'active';

        if (!name || !username) {
          errEl.textContent = 'Name and username are required.';
          errEl.style.display = 'block';
          return;
        }

        if (!isEdit && (!password || password.length < 4)) {
          errEl.textContent = 'Password must be at least 4 characters.';
          errEl.style.display = 'block';
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        const url = isEdit ? `/api/admin/admins/${user.id}` : '/api/admin/admins';
        const method = isEdit ? 'PUT' : 'POST';
        const payload = { name, username, email: email || null, status };
        if (password) payload.password = password;

        const res = await request(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.error) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `${ICONS.check} <span>${isEdit ? 'Save Changes' : 'Create Administrator'}</span>`;
          errEl.textContent = res.error;
          errEl.style.display = 'block';
          return;
        }

        closeModal();
        showToast(isEdit ? `✓ Administrator "${name}" updated successfully!` : `✓ Administrator "${name}" created!`, 'success');
        renderAdmin('users');
      }
    };
  };

  renderModal();
}

function openDeleteUserModal(user) {
  const modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) return;

  const isAdminUser = user.role === 'admin';

  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="delete-user-modal-backdrop">
      <div class="modal-card" style="max-width:480px" role="dialog" aria-modal="true" aria-labelledby="delete-um-title">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <div class="modal-icon" style="background:rgba(220,38,38,0.1);color:#dc2626">${ICONS.trash}</div>
            <div>
              <h2 id="delete-um-title" style="margin:0;color:#dc2626">${isAdminUser ? 'Delete Administrator' : 'Delete Candidate'}</h2>
              <p style="margin:2px 0 0;font-size:13px;color:var(--muted)">Remove user from system</p>
            </div>
          </div>
          <button class="modal-close" id="close-delete-um" type="button" aria-label="Close modal">✕</button>
        </div>
        <div class="modal-body" style="padding:20px 24px">
          <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:var(--ink)">
            Are you sure you want to remove ${isAdminUser ? 'administrator' : 'placement candidate'} <strong>${user.name}</strong> (${isAdminUser ? `@${user.username}` : user.email})?
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;padding:12px 14px;border-radius:8px;font-size:13px;color:#991b1b;margin-bottom:20px">
            ⚠️ <strong>Warning:</strong> This ${isAdminUser ? 'administrator will permanently lose access to the administration portal.' : 'candidate will no longer be authorized to take placement assessments.'}
          </div>
          <div id="delete-um-error" style="color:#dc2626;font-size:13px;font-weight:600;display:none;margin-bottom:12px"></div>
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button type="button" class="button ghost" id="btn-cancel-del-um" style="padding:10px 18px">Cancel</button>
            <button type="button" class="button" id="btn-confirm-del-um" style="padding:10px 20px;background:#dc2626;border-color:#dc2626;display:flex;align-items:center;gap:6px">
              ${ICONS.trash} <span>Confirm Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalRoot.innerHTML = ''; };
  modalRoot.querySelector('#close-delete-um').onclick = closeModal;
  modalRoot.querySelector('#btn-cancel-del-um').onclick = closeModal;
  modalRoot.querySelector('#delete-user-modal-backdrop').onclick = (e) => {
    if (e.target.id === 'delete-user-modal-backdrop') closeModal();
  };

  const confirmBtn = modalRoot.querySelector('#btn-confirm-del-um');
  const errEl = modalRoot.querySelector('#delete-um-error');

  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting…';

    const url = isAdminUser ? `/api/admin/admins/${user.id}` : `/api/admin/teachers/${user.id}`;
    const res = await request(url, { method: 'DELETE' });

    if (res.error) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `${ICONS.trash} <span>Confirm Delete</span>`;
      errEl.textContent = res.error;
      errEl.style.display = 'block';
      return;
    }

    closeModal();
    showToast(`✓ Account "${user.name}" deleted successfully.`, 'success');
    renderAdmin('users');
  };
}

async function renderAdminQuestionsTab(container) {
  let questionsData = adminState.stagedQuestions;
  const isStaged = Boolean(questionsData);

  if (!questionsData) {
    questionsData = await request('/api/admin/questions');
    if (questionsData.error) return showToast(questionsData.error, 'error');
  }

  (questionsData.sections || []).forEach((sec) => {
    if ((!sec.questions || !sec.questions.length) && Array.isArray(sec.topics) && sec.topics.length > 0) {
      sec.questions = [...sec.topics];
    }
    if ((!sec.topics || !sec.topics.length) && Array.isArray(sec.questions) && (sec.id === 'writing' || (sec.label && sec.label.toLowerCase().includes('writing')))) {
      sec.topics = [...sec.questions];
    }
  });

  const totalQuestions = (questionsData.sections || []).reduce((sum, s) => sum + (s.questions ? s.questions.length : (s.topics ? s.topics.length : 0)), 0);

  container.innerHTML = `
    ${isStaged ? `
      <div class="staged-review-banner">
        <div class="staged-banner-info">
          <div class="staged-banner-icon">${ICONS.alertTriangle}</div>
          <div>
            <h3 class="staged-banner-title">Questions Draft Staged for Review</h3>
            <p class="staged-banner-desc">You are reviewing a draft upload containing <strong>${questionsData.sections?.length || 0} sections</strong> and <strong>${totalQuestions} questions / topics</strong>. Review below and approve to make live in database.</p>
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
        <div class="eyebrow">${isStaged ? 'Draft Preview' : 'Active Test Content · MySQL Database'}</div>
        <h1 style="font:700 28px 'Space Grotesk';margin:4px 0">${questionsData.title || 'Placement Question Bank'}</h1>
        <p style="color:var(--muted);margin:0;font-size:14px">Version: <strong>${questionsData.version || '2026.3'}</strong> · Total Duration: <strong>${questionsData.durationMinutes || 65} minutes</strong> · Total Questions: <strong>${totalQuestions}</strong></p>
      </div>
      <div class="admin-toolbar">
        <button class="btn-delete-all" id="delete-all-questions-btn" type="button" title="Permanently delete all questions in database">
          ${ICONS.trash} <span>Delete All Questions</span>
        </button>
        <a class="btn-download-template" id="download-writing-template-btn" href="/api/admin/questions/template/writing" download="writing-topics-template.json" title="Download Selectable Writing Topics JSON Template" style="background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe">
          ${ICONS.penTool} <span>Download Writing Template</span>
        </a>
        <a class="btn-download-template" id="download-questions-template-btn" href="/api/admin/questions/template" download="question-bank-template.json" title="Download Complete Question Bank JSON Template">
          ${ICONS.download} <span>Download Full Bank</span>
        </a>
        <div class="file-upload-wrapper">
          <label class="file-upload-label" for="questions-upload-input" title="Upload custom Questions or Writing Topics JSON file">
            ${ICONS.upload} <span>Choose JSON to Upload</span>
            <input type="file" id="questions-upload-input" accept=".json">
          </label>
        </div>
      </div>
    </div>

    <div class="sections-preview">
      ${(questionsData.sections || []).map((sec, secIdx) => {
        const secLabel = sec.label || (sec.id === 'writing' ? 'Writing Placement Test' : (sec.id === 'speaking' ? 'Oral Placement Test' : (sec.id === 'grammar-vocabulary' ? 'Grammar & Vocabulary' : `Section ${secIdx + 1}`)));
        const secId = sec.id || `section-${secIdx + 1}`;
        const secLabelEsc = String(secLabel).replaceAll('"', '&quot;');
        return `
        <div class="section-group-card">
          <div class="section-group-header">
            <h3 class="section-group-title">
              <div class="skill-icon-badge ${sec.id === 'writing' || secLabel.toLowerCase().includes('writing') ? 'skill-icon-writing' : (sec.id === 'speaking' || secLabel.toLowerCase().includes('speaking') ? 'skill-icon-speaking' : (sec.id === 'reading' || secLabel.toLowerCase().includes('reading') ? 'skill-icon-reading' : (sec.id === 'listening' || secLabel.toLowerCase().includes('listening') ? 'skill-icon-listening' : 'skill-icon-grammar')))}" style="width:30px;height:30px">${sectionIcons[secLabel] || ICONS.fileText}</div>
              <span>Section ${secIdx + 1}: ${secLabel}</span>
              <span class="pill">${(sec.questions?.length || sec.topics?.length || 0)} ${sec.selectionType === 'single_choice' ? 'topics' : 'items'}</span>
              ${sec.selectionType === 'single_choice' ? '<span class="pill success" style="font-size:11px;font-weight:700">1 Essay Required</span>' : ''}
              <span class="pill pending">${sec.durationMinutes || 0} mins</span>
            </h3>
            <div class="section-header-actions">
              <button class="btn-delete-item delete-section-btn" data-sec-id="${secId}" data-sec-label="${secLabelEsc}" data-sec-count="${sec.questions?.length || sec.topics?.length || 0}" type="button" title="Delete all questions in Section ${secLabelEsc}">
                ${ICONS.trash} <span>Delete Section Questions</span>
              </button>
            </div>
          </div>

          ${(Array.isArray(sec.passages) && sec.passages.length > 0) ? `
            <div class="section-passages-list" style="display:flex;flex-direction:column;gap:12px;padding:16px 20px;background:#f1f5f9;border-bottom:1px solid var(--line)">
              ${sec.passages.map((p, pIdx) => {
                const passageTitle = p.title || `Passage ${pIdx + 1}`;
                const passageTitleEsc = String(passageTitle).replaceAll('"', '&quot;');
                return `
                <div class="reading-passage-preview-card" style="background:#ffffff;border:1px solid var(--line);border-radius:10px;padding:14px 18px">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
                    <div style="display:flex;align-items:center;gap:8px">
                      <div class="skill-icon-badge skill-icon-reading" style="width:24px;height:24px">${ICONS.book}</div>
                      <strong style="font-size:14px;color:var(--blue-dark)">${passageTitle}</strong>
                      ${p.questionRange ? `<span class="pill" style="font-size:11px">${p.questionRange}</span>` : ''}
                    </div>
                    <button class="btn-delete-item delete-passage-btn" data-sec-id="${secId}" data-sec-label="${secLabelEsc}" data-passage-idx="${pIdx}" data-passage-title="${passageTitleEsc}" type="button" title="Delete this passage">
                      ${ICONS.trash} <span>Delete Passage</span>
                    </button>
                  </div>
                  <div style="font-size:13px;line-height:1.6;color:var(--ink);max-height:160px;overflow-y:auto;white-space:pre-wrap;background:#f8fafc;padding:10px 14px;border-radius:6px;border:1px solid #e2e8f0">${p.content || p.text || ''}</div>
                </div>
              `; }).join('')}
            </div>
          ` : (sec.passage ? `
            <div class="section-passage-preview-card" style="padding:16px 20px;background:var(--blue-soft);border-bottom:1px solid var(--line)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="skill-icon-badge skill-icon-reading" style="width:24px;height:24px">${ICONS.book}</div>
                  <strong style="font-size:14px;color:var(--blue-dark)">Reading Passage</strong>
                </div>
                <button class="btn-delete-item delete-passage-btn" data-sec-id="${secId}" data-sec-label="${secLabelEsc}" type="button" title="Delete reading passage">
                  ${ICONS.trash} <span>Delete Passage</span>
                </button>
              </div>
              <div style="font-size:13px;line-height:1.6;color:var(--ink);white-space:pre-wrap;max-height:160px;overflow-y:auto;background:#ffffff;padding:10px 14px;border-radius:6px;border:1px solid #cbd5e1">${sec.passage}</div>
            </div>
          ` : '')}

          <div class="questions-list">
            ${((sec.questions && sec.questions.length > 0) ? sec.questions : (sec.topics || [])).map((q, qIdx) => {
              const audioScriptEsc = q.audioScript ? String(q.audioScript).replaceAll('"', '&quot;') : '';
              return `
              <div class="question-item-card" id="q-card-${q.id}">
                <div class="question-item-header">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span class="question-num-tag">${q.title ? `Topic ${qIdx + 1}` : `Q${qIdx + 1}`} · ${q.type || (sec.selectionType === 'single_choice' ? 'essay topic' : 'standard')}</span>
                    ${q.title ? `<strong style="font-size:13.5px;color:var(--blue-dark)">${q.title}</strong>` : ''}
                    ${q.passageRef ? `<span class="pill" style="font-size:11px;font-weight:600">${q.passageRef}</span>` : ''}
                    ${q.audioScript ? `<span class="pill success" style="display:inline-flex;align-items:center;gap:5px">${ICONS.headphones} Audio Script</span>` : ''}
                    ${q.guidingQuestions ? `<span class="pill" style="background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;font-size:11px">Guiding Questions (${q.guidingQuestions.length})</span>` : ''}
                  </div>
                  <button class="btn-delete-item delete-question-btn" data-sec-id="${secId}" data-sec-label="${secLabelEsc}" data-q-id="${q.id}" data-q-num="${q.title ? `Topic ${qIdx + 1}` : `Q${qIdx + 1}`}" type="button" title="Delete ${q.title || `Question ${q.id}`}">
                    ${ICONS.trash} <span>Delete</span>
                  </button>
                </div>

                ${q.audioScript ? `
                  <div class="audio-script-box" style="margin:10px 0;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:6px">
                      <span style="font-size:12px;font-weight:700;color:#166534;display:inline-flex;align-items:center;gap:5px">${ICONS.headphones} Audio Script Transcript:</span>
                      <button class="button button-sm play-audio-script-btn" data-qindex="${qIdx}" data-text="${audioScriptEsc}" type="button" style="padding:3px 10px;font-size:11.5px;background:#16a34a;color:#fff;border:none;display:inline-flex;align-items:center;gap:5px">
                        ${ICONS.volume2} <span>Listen Voice ${qIdx + 1} Preview</span>
                      </button>
                    </div>
                    <div style="font-size:12.5px;color:#1e293b;line-height:1.5;font-style:italic">"${q.audioScript}"</div>
                  </div>
                ` : ''}

                <p class="question-item-prompt" style="font-size:14.5px;line-height:1.5;margin:8px 0">${(q.prompt || '').replace(/\n/g, '<br>')}</p>

                ${q.guidingQuestions && q.guidingQuestions.length ? `
                  <div style="margin:10px 0;background:#f8fafc;border-left:3px solid var(--blue-dark);padding:10px 14px;border-radius:0 6px 6px 0">
                    <div style="font-size:12px;font-weight:700;color:var(--blue-dark);margin-bottom:4px">Guiding Questions & Ideas:</div>
                    <ul style="margin:0;padding-left:18px;font-size:12.5px;color:var(--ink);line-height:1.5">
                      ${q.guidingQuestions.map((g) => `<li>${g}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}

                ${q.options ? `
                  <div class="options-preview-grid">
                    ${q.options.map((opt) => {
                      const isCorrect = String(opt).trim().toLowerCase() === String(q.answer).trim().toLowerCase();
                      return `<div class="option-preview-pill ${isCorrect ? 'is-correct' : ''}">${opt}</div>`;
                    }).join('')}
                  </div>
                ` : (!q.guidingQuestions ? `
                  <div style="font-size:12px;color:var(--muted);background:#f8fafc;padding:8px 12px;border-radius:6px;border:1px dashed var(--line)">
                    Open-ended submission prompt (Candidate responds in writing/speech).
                  </div>
                ` : '')}
              </div>
            `; }).join('')}
            ${(!sec.questions || sec.questions.length === 0) && (!sec.topics || sec.topics.length === 0) ? `
              <div style="padding:24px;text-align:center;color:var(--muted);font-size:13px;background:#f8fafc;border-radius:8px;border:1px dashed var(--line);margin:12px 0">
                All questions have been deleted from this section.
              </div>
            ` : ''}
          </div>
        </div>
      `; }).join('')}
    </div>
  `;

  // Bind Delete All Questions Button
  const deleteAllQBtn = document.querySelector('#delete-all-questions-btn');
  if (deleteAllQBtn) {
    deleteAllQBtn.onclick = () => {
      if (isStaged) {
        (questionsData.sections || []).forEach((s) => {
          s.questions = [];
          delete s.passage;
          s.passages = [];
        });
        showToast('All draft questions and passages cleared.', 'info');
        renderAdmin('questions');
      } else {
        openDeleteAllQuestionsModal({ totalQuestions });
      }
    };
  }

  // Bind Listen Audio Preview Buttons (Multi-Voice per question)
  document.querySelectorAll('.play-audio-script-btn').forEach((btn) => {
    btn.onclick = () => {
      const text = btn.dataset.text;
      const qIndex = Number(btn.dataset.qindex) || 0;
      if (!text) return;
      speakQuestionAudio(
        text,
        qIndex,
        () => showToast(`Playing Question ${qIndex + 1} voice preview…`, 'info')
      );
    };
  });

  // Bind Delete Passage Buttons
  document.querySelectorAll('.delete-passage-btn').forEach((btn) => {
    btn.onclick = () => {
      const sectionId = btn.dataset.secId;
      const sectionLabel = btn.dataset.secLabel;
      const passageIndex = btn.dataset.passageIdx !== undefined ? Number(btn.dataset.passageIdx) : undefined;
      const passageTitle = btn.dataset.passageTitle || 'Reading Passage';

      if (isStaged) {
        const sec = (questionsData.sections || []).find((s) => s.id === sectionId);
        if (sec) {
          if (passageIndex !== undefined && Array.isArray(sec.passages)) {
            sec.passages.splice(passageIndex, 1);
          } else {
            delete sec.passage;
            sec.passages = [];
          }
          showToast(`Draft passage "${passageTitle}" removed.`, 'info');
          renderAdmin('questions');
        }
      } else {
        openDeletePassageModal({ sectionId, sectionLabel, passageIndex, passageTitle });
      }
    };
  });

  // Bind file upload for staged review
  const fileInput = document.querySelector('#questions-upload-input');
  if (fileInput) {
    fileInput.onchange = async () => {
      if (!fileInput.files.length) return;
      const file = fileInput.files[0];
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        // Check if user uploaded a standalone writing topics file
        const isWritingTemplate = parsed && (
          (Array.isArray(parsed.topics) && !parsed.sections) ||
          (parsed.id === 'writing' && Array.isArray(parsed.topics)) ||
          (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title && parsed[0].prompt)
        );

        if (isWritingTemplate) {
          const currentBank = adminState.stagedQuestions || await request('/api/admin/questions');
          const merged = JSON.parse(JSON.stringify(currentBank.sections ? currentBank : (await request('/api/admin/questions/template'))));
          let writingSec = merged.sections?.find((s) => s.id === 'writing');
          const topicsList = Array.isArray(parsed) ? parsed : parsed.topics;
          if (!writingSec) {
            writingSec = {
              id: 'writing',
              label: 'Writing Placement Test',
              durationMinutes: 20,
              selectionType: 'single_choice',
              requiredSelections: 1,
              instructions: 'Choose ONE of these topics and write about it. Create 1 Essay based on your selected topic (20 minutes).',
              topics: [],
              questions: []
            };
            merged.sections.push(writingSec);
          }
          writingSec.selectionType = parsed.selectionType || 'single_choice';
          writingSec.requiredSelections = parsed.requiredSelections || 1;
          if (parsed.instructions) writingSec.instructions = parsed.instructions;
          if (parsed.durationMinutes) writingSec.durationMinutes = parsed.durationMinutes;
          writingSec.topics = topicsList;
          writingSec.questions = [...topicsList];

          adminState.stagedQuestions = merged;
          showToast(`✓ Staged Writing Topics draft loaded from "${file.name}" (${topicsList.length} topics). Please review below.`, 'info');
          renderAdmin('questions');
          return;
        }

        if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
          showToast('Invalid JSON: Must contain "sections" array or "topics" array.', 'error');
          return;
        }
        parsed.sections.forEach((sec) => {
          if ((!sec.questions || !sec.questions.length) && Array.isArray(sec.topics) && sec.topics.length > 0) {
            sec.questions = [...sec.topics];
          }
          if ((!sec.topics || !sec.topics.length) && Array.isArray(sec.questions) && (sec.id === 'writing' || (sec.label && sec.label.toLowerCase().includes('writing')))) {
            sec.topics = [...sec.questions];
          }
        });
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
      approveBtn.innerHTML = 'Publishing to Database…';
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
        showToast('✓ Questions successfully published and saved to MySQL database!', 'success');
        renderAdmin('questions');
      }
    };
  }

  // Bind Section Delete Buttons
  document.querySelectorAll('.delete-section-btn').forEach((btn) => {
    btn.onclick = () => {
      const sectionId = btn.dataset.secId;
      const sectionLabel = btn.dataset.secLabel;
      const count = Number(btn.dataset.secCount) || 0;

      if (isStaged) {
        const sec = (questionsData.sections || []).find((s) => s.id === sectionId);
        if (sec) {
          sec.questions = [];
          if (sec.topics) sec.topics = [];
          delete sec.passage;
          sec.passages = [];
          showToast(`Draft questions & passages cleared for section ${sectionLabel}.`, 'info');
          renderAdmin('questions');
        }
      } else {
        openClearSectionModal({ sectionId, sectionLabel, count });
      }
    };
  });

  // Bind Individual Question Delete Buttons
  document.querySelectorAll('.delete-question-btn').forEach((btn) => {
    btn.onclick = () => {
      const sectionId = btn.dataset.secId;
      const sectionLabel = btn.dataset.secLabel;
      const questionId = btn.dataset.qId;
      const questionNum = btn.dataset.qNum;

      const sec = (questionsData.sections || []).find((s) => s.id === sectionId);
      const q = sec?.questions?.find((item) => item.id === questionId) || sec?.topics?.find((item) => item.id === questionId);

      if (isStaged) {
        if (sec) {
          if (Array.isArray(sec.questions)) {
            const idx = sec.questions.findIndex((item) => item.id === questionId);
            if (idx !== -1) sec.questions.splice(idx, 1);
          }
          if (Array.isArray(sec.topics)) {
            const tIdx = sec.topics.findIndex((item) => item.id === questionId);
            if (tIdx !== -1) sec.topics.splice(tIdx, 1);
          }
          showToast(`Draft question ${questionNum} removed.`, 'info');
          renderAdmin('questions');
        }
      } else {
        openDeleteQuestionModal({
          sectionId,
          sectionLabel,
          questionId,
          questionNum,
          prompt: q?.prompt || questionId
        });
      }
    };
  });
}

async function renderAdminRubricsTab(container) {
  let rubricsData = adminState.stagedRubrics;
  const isStaged = Boolean(rubricsData);

  if (!rubricsData) {
    rubricsData = await request('/api/admin/rubrics');
    if (rubricsData.error) return showToast(rubricsData.error, 'error');
  }

  const renderCriteriaList = (skillKey, skillTitle, criteria = []) => {
    if (!criteria.length) {
      return `<div style="grid-column:1/-1;text-align:center;padding:28px;color:var(--muted);font-size:13.5px;background:#f8fafc;border-radius:12px;border:1px dashed var(--line)">All criteria have been deleted for this skill.</div>`;
    }
    const skillClass = skillKey === 'grammarVocabulary' ? 'grammar' : skillKey;
    return criteria.map((c, idx) => `
      <div class="criterion-card criterion-card-${skillClass}">
        <div class="criterion-card-header">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
            <span class="criterion-num-badge">Criterion ${idx + 1}</span>
            <div class="criterion-card-title">${c.name}</div>
          </div>
          <button class="btn-delete-criterion delete-criterion-btn" data-skill-key="${skillKey}" data-skill-title="${skillTitle.replaceAll('"', '&quot;')}" data-criterion-idx="${idx}" data-criterion-name="${c.name.replaceAll('"', '&quot;')}" type="button" title="Delete Criterion: ${c.name.replaceAll('"', '&quot;')}">
            ${ICONS.trash}
          </button>
        </div>
        <p class="criterion-card-desc">${c.description}</p>
      </div>
    `).join('');
  };

  container.innerHTML = `
    ${isStaged ? `
      <div class="staged-review-banner">
        <div class="staged-banner-info">
          <div class="staged-banner-icon">⚠️</div>
          <div>
            <h3 class="staged-banner-title">Rubrics Draft Staged for Review</h3>
            <p class="staged-banner-desc">You are reviewing a draft upload for <strong>Writing & Speaking CEFR Rubrics</strong>. Review below and approve to make live in database.</p>
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
        <div class="eyebrow">${isStaged ? 'Draft Preview' : 'Active Evaluation Standard · MySQL Database'}</div>
        <h1 style="font:700 28px 'Space Grotesk';margin:4px 0;color:var(--ink)">${rubricsData.title || 'Teacher Placement CEFR Rubrics'}</h1>
        <p style="color:var(--muted);margin:0;font-size:14px">
          Version: <strong>${rubricsData.version || '2026.2'}</strong> · Benchmark Scale: <strong>${rubricsData.bandScale?.range || 'A1–C1'}</strong>
          ${rubricsData.bandScale?.overall ? ` · <span style="color:#475569">${rubricsData.bandScale.overall}</span>` : ''}
        </p>
      </div>
      <div class="admin-toolbar">
        <button class="btn-delete-all" id="delete-all-rubrics-btn" type="button" title="Permanently delete all rubrics in database">
          ${ICONS.trash} <span>Delete All Rubrics</span>
        </button>
        <a class="btn-download-template" id="download-rubrics-template-btn" href="/api/admin/rubrics/template" download="rubrics-template.json" title="Download Rubrics JSON Template">
          ${ICONS.download} <span>Download Template</span>
        </a>
        <div class="file-upload-wrapper">
          <label class="file-upload-label" for="rubrics-upload-input" title="Upload custom Rubrics JSON file">
            ${ICONS.upload} <span>Choose Rubrics JSON</span>
            <input type="file" id="rubrics-upload-input" accept=".json">
          </label>
        </div>
      </div>
    </div>

    <!-- 1. Grammar & Vocabulary Rubric -->
    <div class="rubric-skill-card">
      <div class="rubric-skill-title">
        <div class="rubric-title-wrap">
          <div class="skill-icon-badge skill-icon-grammar">${ICONS.edit}</div>
          <span>${rubricsData.grammarVocabulary?.title || 'Grammar & Vocabulary Evaluation Standard'}</span>
        </div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:10px">
          <span class="pill success rubric-pill-badge">${rubricsData.grammarVocabulary?.criteria?.length || 0} Criteria</span>
          <button class="btn-delete-item delete-skill-btn" data-skill-key="grammarVocabulary" data-skill-title="${(rubricsData.grammarVocabulary?.title || 'Grammar & Vocabulary').replaceAll('"', '&quot;')}" data-skill-count="${rubricsData.grammarVocabulary?.criteria?.length || 0}" type="button" title="Delete all grammar criteria">
            ${ICONS.trash} <span>Delete All Criteria</span>
          </button>
        </div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 18px;margin-bottom:16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;font-size:13px">
        <div style="display:flex;align-items:center;gap:6px;color:#0f172a">
          <span style="color:#0284c7">${ICONS.clock}</span>
          <span><strong>Format:</strong> ${rubricsData.grammarVocabulary?.format || '50 Contextual Objective Items (30 Mins)'}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;color:#0f172a">
          <span style="color:#16a34a">${ICONS.check}</span>
          <span><strong>CEFR Thresholds:</strong> ${rubricsData.grammarVocabulary?.thresholds || 'A1: 0–18 | A2: 19–25 | B1: 26–32 | B2: 33–39 | C1: 40–46 | C2: 47–50'}</span>
        </div>
        ${Array.isArray(rubricsData.grammarVocabulary?.scoreMapping) && rubricsData.grammarVocabulary.scoreMapping.length > 0 ? `
          <div style="width:100%;margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">
            ${rubricsData.grammarVocabulary.scoreMapping.map((m) => `
              <span class="pill" style="background:#f1f5f9;color:var(--ink);font-size:11.5px;padding:3px 8px;border:1px solid #cbd5e1">
                <strong>${m.level}</strong>: ${m.score}
              </span>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="rubric-criteria-grid">
        ${renderCriteriaList('grammarVocabulary', rubricsData.grammarVocabulary?.title || 'Grammar & Vocabulary', rubricsData.grammarVocabulary?.criteria || [])}
      </div>
    </div>

    <!-- 2. Writing Rubric -->
    <div class="rubric-skill-card">
      <div class="rubric-skill-title">
        <div class="rubric-title-wrap">
          <div class="skill-icon-badge skill-icon-writing">${ICONS.penTool}</div>
          <span>${(rubricsData.writing?.title || '').includes('Memo') ? 'Written Placement Essay Rubric (Single-Choice Topic)' : (rubricsData.writing?.title || 'Written Placement Essay Rubric (Single-Choice Topic)')}</span>
        </div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:10px">
          <span class="pill success rubric-pill-badge">${rubricsData.writing?.criteria?.length || 0} Criteria</span>
          <button class="btn-delete-item delete-skill-btn" data-skill-key="writing" data-skill-title="${(rubricsData.writing?.title || 'Writing').replaceAll('"', '&quot;')}" data-skill-count="${rubricsData.writing?.criteria?.length || 0}" type="button" title="Delete all writing criteria">
            ${ICONS.trash} <span>Delete All Criteria</span>
          </button>
        </div>
      </div>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 18px;margin-bottom:16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;font-size:13px">
        <div style="display:flex;align-items:center;gap:6px;color:#1e3a8a">
          <span style="color:#2563eb">${ICONS.penTool}</span>
          <span><strong>Format:</strong> ${(rubricsData.writing?.format || '').includes('Memo') ? '1 Selected Topic Essay (150–220 words · 20 Mins)' : (rubricsData.writing?.format || '1 Selected Topic Essay (150–220 words · 20 Mins)')}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;color:#1e3a8a">
          <span style="color:#2563eb">${ICONS.sliders}</span>
          <span><strong>Evaluation Weight:</strong> ${rubricsData.writing?.weight || 'Administrator scores each of 4 criteria from 1 (A1) to 5 (C1). Maximum score is 20.'}</span>
        </div>
      </div>
      <div class="rubric-criteria-grid">
        ${renderCriteriaList('writing', rubricsData.writing?.title || 'Writing Evaluation', rubricsData.writing?.criteria || [])}
      </div>
    </div>

    <!-- 3. Speaking Rubric -->
    <div class="rubric-skill-card">
      <div class="rubric-skill-title">
        <div class="rubric-title-wrap">
          <div class="skill-icon-badge skill-icon-speaking">${ICONS.mic}</div>
          <span>${rubricsData.speaking?.title || 'Speaking & Oral Interview Rubric'}</span>
        </div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:10px">
          <span class="pill success rubric-pill-badge">${rubricsData.speaking?.criteria?.length || 0} Criteria</span>
          <button class="btn-delete-item delete-skill-btn" data-skill-key="speaking" data-skill-title="${(rubricsData.speaking?.title || 'Speaking').replaceAll('"', '&quot;')}" data-skill-count="${rubricsData.speaking?.criteria?.length || 0}" type="button" title="Delete all speaking criteria">
            ${ICONS.trash} <span>Delete All Criteria</span>
          </button>
        </div>
      </div>
      <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:12px 18px;margin-bottom:16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;font-size:13px">
        <div style="display:flex;align-items:center;gap:6px;color:#581c87">
          <span style="color:#7c3aed">${ICONS.mic}</span>
          <span><strong>Format:</strong> ${rubricsData.speaking?.format || '2-Part Recorded Audio/Video Interview with Audio-Format Prompts (15 Mins)'}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;color:#581c87">
          <span style="color:#7c3aed">${ICONS.sliders}</span>
          <span><strong>Evaluation Weight:</strong> ${rubricsData.speaking?.weight || 'Administrator scores each of 4 criteria from 1 (A1) to 5 (C1). Maximum score is 20.'}</span>
        </div>
      </div>
      <div class="rubric-criteria-grid">
        ${renderCriteriaList('speaking', rubricsData.speaking?.title || 'Speaking Evaluation', rubricsData.speaking?.criteria || [])}
      </div>
    </div>

    ${rubricsData.listening?.criteria?.length ? `
      <!-- Optional Listening Rubric (if configured in custom rubrics) -->
      <div class="rubric-skill-card">
        <div class="rubric-skill-title">
          <div class="rubric-title-wrap">
            <div class="skill-icon-badge skill-icon-listening">${ICONS.headphones}</div>
            <span>${rubricsData.listening?.title || 'Listening Comprehension Rubric'}</span>
          </div>
          <div style="margin-left:auto;display:flex;align-items:center;gap:10px">
            <span class="pill success rubric-pill-badge">${rubricsData.listening?.criteria?.length || 0} Criteria</span>
            <button class="btn-delete-item delete-skill-btn" data-skill-key="listening" data-skill-title="${(rubricsData.listening?.title || 'Listening').replaceAll('"', '&quot;')}" data-skill-count="${rubricsData.listening?.criteria?.length || 0}" type="button" title="Delete all listening criteria">
              ${ICONS.trash} <span>Delete All Criteria</span>
            </button>
          </div>
        </div>
        <div class="rubric-criteria-grid">
          ${renderCriteriaList('listening', rubricsData.listening?.title || 'Listening Comprehension', rubricsData.listening?.criteria || [])}
        </div>
      </div>
    ` : ''}

    ${rubricsData.reading?.criteria?.length ? `
      <!-- Optional Reading Rubric (if configured in custom rubrics) -->
      <div class="rubric-skill-card">
        <div class="rubric-skill-title">
          <div class="rubric-title-wrap">
            <div class="skill-icon-badge skill-icon-reading">${ICONS.book}</div>
            <span>${rubricsData.reading?.title || 'Reading Comprehension Rubric'}</span>
          </div>
          <div style="margin-left:auto;display:flex;align-items:center;gap:10px">
            <span class="pill success rubric-pill-badge">${rubricsData.reading?.criteria?.length || 0} Criteria</span>
            <button class="btn-delete-item delete-skill-btn" data-skill-key="reading" data-skill-title="${(rubricsData.reading?.title || 'Reading').replaceAll('"', '&quot;')}" data-skill-count="${rubricsData.reading?.criteria?.length || 0}" type="button" title="Delete all reading criteria">
              ${ICONS.trash} <span>Delete All Criteria</span>
            </button>
          </div>
        </div>
        <div class="rubric-criteria-grid">
          ${renderCriteriaList('reading', rubricsData.reading?.title || 'Reading Comprehension', rubricsData.reading?.criteria || [])}
        </div>
      </div>
    ` : ''}

  `;

  // Bind Delete All Rubrics Button
  const deleteAllRBtn = document.querySelector('#delete-all-rubrics-btn');
  if (deleteAllRBtn) {
    deleteAllRBtn.onclick = () => {
      if (isStaged) {
        ['writing', 'speaking', 'listening', 'reading', 'grammarVocabulary'].forEach((k) => {
          if (rubricsData[k]) rubricsData[k].criteria = [];
        });
        showToast('All draft rubrics criteria cleared.', 'info');
        renderAdmin('rubrics');
      } else {
        openDeleteAllRubricsModal();
      }
    };
  }

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
      approveBtn.innerHTML = 'Publishing to Database…';
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
        showToast('✓ Rubrics successfully published and saved to MySQL database!', 'success');
        renderAdmin('rubrics');
      }
    };
  }

  // Bind Clear Skill Criteria Buttons
  document.querySelectorAll('.delete-skill-btn').forEach((btn) => {
    btn.onclick = () => {
      const skillKey = btn.dataset.skillKey;
      const skillTitle = btn.dataset.skillTitle;
      const count = Number(btn.dataset.skillCount) || 0;

      if (isStaged) {
        const skillObj = rubricsData[skillKey];
        if (skillObj) {
          skillObj.criteria = [];
          showToast(`Draft criteria cleared for ${skillTitle}.`, 'info');
          renderAdmin('rubrics');
        }
      } else {
        openClearSkillRubricModal({ skillKey, skillTitle, count });
      }
    };
  });

  // Bind Criteria Delete Buttons
  document.querySelectorAll('.delete-criterion-btn').forEach((btn) => {
    btn.onclick = () => {
      const skillKey = btn.dataset.skillKey;
      const skillTitle = btn.dataset.skillTitle;
      const criterionIndex = Number(btn.dataset.criterionIdx);
      const criterionName = btn.dataset.criterionName;
      const skillObj = rubricsData[skillKey];
      const crit = skillObj?.criteria?.[criterionIndex];

      if (isStaged) {
        if (skillObj?.criteria) {
          skillObj.criteria.splice(criterionIndex, 1);
          showToast(`Draft criterion "${criterionName}" removed.`, 'info');
          renderAdmin('rubrics');
        }
      } else {
        openDeleteCriterionModal({
          skillKey,
          skillTitle,
          criterionIndex,
          criterionName,
          description: crit?.description || ''
        });
      }
    };
  });
}

function openDeleteAllQuestionsModal({ totalQuestions }) {
  const modalContainer = document.querySelector('#modal-root') || document.body;
  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="delete-all-q-modal-backdrop" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.65);z-index:9999;backdrop-filter:blur(4px)">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:480px;background:#ffffff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.25);overflow:hidden;padding:0">
        <div style="padding:28px 24px 20px;text-align:center">
          <div class="modal-icon-danger" style="width:60px;height:60px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:24px;margin:0 auto 16px">
            ${ICONS.trash}
          </div>
          <h3 style="font:700 20px 'Space Grotesk';color:var(--ink);margin:0 0 8px">Delete Entire Question Bank?</h3>
          <p style="font-size:14px;color:var(--muted);margin:0;line-height:1.5">
            Are you sure you want to permanently delete <strong>all ${totalQuestions || ''} questions</strong> across all sections from the active database?
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12.5px;padding:12px;border-radius:8px;margin-top:14px;text-align:left;display:flex;align-items:flex-start;gap:8px">
            <span style="flex-shrink:0;color:#dc2626">${ICONS.alertTriangle}</span>
            <span><strong>High-risk action:</strong> All questions in the test bank will be permanently removed from MySQL. You will need to upload a new Questions JSON file.</span>
          </div>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="modal-cancel-delete-all-q" type="button" style="padding:8px 16px;font-size:13px">Cancel</button>
          <button class="button" id="confirm-delete-all-q-btn" type="button" style="background:#dc2626;border-color:#dc2626;color:#ffffff;padding:8px 18px;font-size:13px;font-weight:600">
            ${ICONS.trash} <span>Yes, Delete All Questions</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalContainer.innerHTML = ''; };
  document.querySelector('#modal-cancel-delete-all-q').onclick = closeModal;
  const backdrop = document.querySelector('#delete-all-q-modal-backdrop');
  if (backdrop) backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };

  document.querySelector('#confirm-delete-all-q-btn').onclick = async () => {
    const btn = document.querySelector('#confirm-delete-all-q-btn');
    btn.disabled = true;
    btn.textContent = 'Deleting All…';

    const res = await request('/api/admin/questions/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteAll: true })
    });
    closeModal();
    if (res.error) {
      showToast(`Error: ${res.error}`, 'error');
    } else {
      showToast('✓ Entire Question Bank permanently deleted from database.', 'success');
      renderAdmin('questions');
    }
  };
}

function openDeleteAllRubricsModal() {
  const modalContainer = document.querySelector('#modal-root') || document.body;
  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="delete-all-r-modal-backdrop" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.65);z-index:9999;backdrop-filter:blur(4px)">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:480px;background:#ffffff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.25);overflow:hidden;padding:0">
        <div style="padding:28px 24px 20px;text-align:center">
          <div class="modal-icon-danger" style="width:60px;height:60px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:24px;margin:0 auto 16px">
            ${ICONS.trash}
          </div>
          <h3 style="font:700 20px 'Space Grotesk';color:var(--ink);margin:0 0 8px">Delete All Evaluation Rubrics?</h3>
          <p style="font-size:14px;color:var(--muted);margin:0;line-height:1.5">
            Are you sure you want to permanently delete all rubric criteria across all skills from the active database?
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12.5px;padding:12px;border-radius:8px;margin-top:14px;text-align:left;display:flex;align-items:flex-start;gap:8px">
            <span style="flex-shrink:0;color:#dc2626">${ICONS.alertTriangle}</span>
            <span><strong>High-risk action:</strong> All rubric evaluation standards will be permanently wiped from MySQL. You will need to upload a new Rubrics JSON file.</span>
          </div>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="modal-cancel-delete-all-r" type="button" style="padding:8px 16px;font-size:13px">Cancel</button>
          <button class="button" id="confirm-delete-all-r-btn" type="button" style="background:#dc2626;border-color:#dc2626;color:#ffffff;padding:8px 18px;font-size:13px;font-weight:600">
            ${ICONS.trash} <span>Yes, Delete All Rubrics</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalContainer.innerHTML = ''; };
  document.querySelector('#modal-cancel-delete-all-r').onclick = closeModal;
  const backdrop = document.querySelector('#delete-all-r-modal-backdrop');
  if (backdrop) backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };

  document.querySelector('#confirm-delete-all-r-btn').onclick = async () => {
    const btn = document.querySelector('#confirm-delete-all-r-btn');
    btn.disabled = true;
    btn.textContent = 'Deleting All…';

    const res = await request('/api/admin/rubrics/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteAll: true })
    });
    closeModal();
    if (res.error) {
      showToast(`Error: ${res.error}`, 'error');
    } else {
      showToast('✓ All Evaluation Rubrics permanently deleted from database.', 'success');
      renderAdmin('rubrics');
    }
  };
}

function openDeleteQuestionModal({ sectionId, sectionLabel, questionId, questionNum, prompt }) {
  const isTopic = String(questionNum).toLowerCase().includes('topic');
  const labelText = isTopic ? questionNum : `Question ${questionNum}`;
  const modalContainer = document.querySelector('#modal-root') || document.body;
  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="delete-q-modal-backdrop" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;backdrop-filter:blur(4px)">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:480px;background:#ffffff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;padding:0">
        <div style="padding:28px 24px 20px;text-align:center">
          <div class="modal-icon-danger" style="width:56px;height:56px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:22px;margin:0 auto 16px">
            ${ICONS.trash}
          </div>
          <h3 style="font:700 20px 'Space Grotesk';color:var(--ink);margin:0 0 8px">Delete ${labelText}?</h3>
          <p style="font-size:14px;color:var(--muted);margin:0;line-height:1.5">
            Are you sure you want to delete this ${isTopic ? 'writing topic' : 'question'} from <strong>Section: ${sectionLabel}</strong>?
          </p>
          <div style="max-height:120px;overflow-y:auto;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:12px;margin:14px 0 0;font-size:13px;text-align:left;color:var(--ink);line-height:1.5">
            <strong>Prompt:</strong> ${prompt}
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12px;padding:10px 12px;border-radius:8px;margin-top:14px;text-align:left;display:flex;align-items:flex-start;gap:8px">
            <span style="flex-shrink:0;color:#dc2626">${ICONS.alertTriangle}</span>
            <span><strong>Database update:</strong> This ${isTopic ? 'topic' : 'question'} will be permanently deleted from the active MySQL database.</span>
          </div>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="modal-cancel-delete-q" type="button" style="padding:8px 16px;font-size:13px">Cancel</button>
          <button class="button" id="confirm-delete-q-btn" type="button" style="background:#dc2626;border-color:#dc2626;color:#ffffff;padding:8px 18px;font-size:13px;font-weight:600">
            ${ICONS.trash} <span>Delete ${isTopic ? 'Topic' : 'Question'}</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalContainer.innerHTML = ''; };
  document.querySelector('#modal-cancel-delete-q').onclick = closeModal;
  const backdrop = document.querySelector('#delete-q-modal-backdrop');
  if (backdrop) backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };

  document.querySelector('#confirm-delete-q-btn').onclick = async () => {
    const btn = document.querySelector('#confirm-delete-q-btn');
    btn.disabled = true;
    btn.textContent = 'Deleting…';

    const res = await request('/api/admin/questions/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, questionId })
    });
    closeModal();
    if (res.error) {
      showToast(`Error: ${res.error}`, 'error');
    } else {
      showToast(`✓ ${labelText} permanently deleted from database.`, 'success');
      renderAdmin('questions');
    }
  };
}

function openClearSectionModal({ sectionId, sectionLabel, count }) {
  const modalContainer = document.querySelector('#modal-root') || document.body;
  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="clear-sec-modal-backdrop" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;backdrop-filter:blur(4px)">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:480px;background:#ffffff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;padding:0">
        <div style="padding:28px 24px 20px;text-align:center">
          <div class="modal-icon-danger" style="width:56px;height:56px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:22px;margin:0 auto 16px">
            ${ICONS.trash}
          </div>
          <h3 style="font:700 20px 'Space Grotesk';color:var(--ink);margin:0 0 8px">Delete Section Items?</h3>
          <p style="font-size:14px;color:var(--muted);margin:0;line-height:1.5">
            Are you sure you want to permanently delete all questions and passages in <strong>Section: ${sectionLabel}</strong>?
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12px;padding:10px 12px;border-radius:8px;margin-top:14px;text-align:left;display:flex;align-items:flex-start;gap:8px">
            <span style="flex-shrink:0;color:#dc2626">${ICONS.alertTriangle}</span>
            <span><strong>Warning:</strong> All questions and reading passages in this section will be permanently erased from the active MySQL database.</span>
          </div>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="modal-cancel-clear-sec" type="button" style="padding:8px 16px;font-size:13px">Cancel</button>
          <button class="button" id="confirm-clear-sec-btn" type="button" style="background:#dc2626;border-color:#dc2626;color:#ffffff;padding:8px 18px;font-size:13px;font-weight:600">
            ${ICONS.trash} <span>Yes, Clear Section</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalContainer.innerHTML = ''; };
  document.querySelector('#modal-cancel-clear-sec').onclick = closeModal;
  const backdrop = document.querySelector('#clear-sec-modal-backdrop');
  if (backdrop) backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };

  document.querySelector('#confirm-clear-sec-btn').onclick = async () => {
    const btn = document.querySelector('#confirm-clear-sec-btn');
    btn.disabled = true;
    btn.textContent = 'Deleting…';

    const res = await request('/api/admin/questions/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, clearSection: true })
    });
    closeModal();
    if (res.error) {
      showToast(`Error: ${res.error}`, 'error');
    } else {
      showToast(`✓ All items and passages deleted from section ${sectionLabel}.`, 'success');
      renderAdmin('questions');
    }
  };
}

function openDeletePassageModal({ sectionId, sectionLabel, passageIndex, passageTitle }) {
  const modalContainer = document.querySelector('#modal-root') || document.body;
  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="delete-passage-modal-backdrop" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;backdrop-filter:blur(4px)">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:480px;background:#ffffff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;padding:0">
        <div style="padding:28px 24px 20px;text-align:center">
          <div class="modal-icon-danger" style="width:56px;height:56px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:22px;margin:0 auto 16px">
            ${ICONS.trash}
          </div>
          <h3 style="font:700 20px 'Space Grotesk';color:var(--ink);margin:0 0 8px">Delete ${passageTitle || 'Reading Passage'}?</h3>
          <p style="font-size:14px;color:var(--muted);margin:0;line-height:1.5">
            Are you sure you want to delete this reading passage from <strong>Section: ${sectionLabel}</strong>?
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12px;padding:10px 12px;border-radius:8px;margin-top:14px;text-align:left;display:flex;align-items:flex-start;gap:8px">
            <span style="flex-shrink:0;color:#dc2626">${ICONS.alertTriangle}</span>
            <span><strong>Database update:</strong> This reading passage text will be permanently removed from the active MySQL database.</span>
          </div>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="modal-cancel-delete-passage" type="button" style="padding:8px 16px;font-size:13px">Cancel</button>
          <button class="button" id="confirm-delete-passage-btn" type="button" style="background:#dc2626;border-color:#dc2626;color:#ffffff;padding:8px 18px;font-size:13px;font-weight:600">
            ${ICONS.trash} <span>Delete Passage</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalContainer.innerHTML = ''; };
  document.querySelector('#modal-cancel-delete-passage').onclick = closeModal;
  const backdrop = document.querySelector('#delete-passage-modal-backdrop');
  if (backdrop) backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };

  document.querySelector('#confirm-delete-passage-btn').onclick = async () => {
    const btn = document.querySelector('#confirm-delete-passage-btn');
    btn.disabled = true;
    btn.textContent = 'Deleting…';

    const res = await request('/api/admin/questions/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, deletePassage: true, passageIndex })
    });
    closeModal();
    if (res.error) {
      showToast(`Error: ${res.error}`, 'error');
    } else {
      showToast(`✓ Reading passage permanently deleted from database.`, 'success');
      renderAdmin('questions');
    }
  };
}

function openDeleteCriterionModal({ skillKey, skillTitle, criterionIndex, criterionName, description }) {
  const modalContainer = document.querySelector('#modal-root') || document.body;
  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="delete-c-modal-backdrop" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;backdrop-filter:blur(4px)">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:480px;background:#ffffff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;padding:0">
        <div style="padding:28px 24px 20px;text-align:center">
          <div class="modal-icon-danger" style="width:56px;height:56px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:22px;margin:0 auto 16px">
            ${ICONS.trash}
          </div>
          <h3 style="font:700 20px 'Space Grotesk';color:var(--ink);margin:0 0 8px">Delete Criterion?</h3>
          <p style="font-size:14px;color:var(--muted);margin:0;line-height:1.5">
            Are you sure you want to delete <strong>"${criterionName}"</strong> from <strong>${skillTitle}</strong>?
          </p>
          ${description ? `
            <div style="max-height:100px;overflow-y:auto;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:14px 0 0;font-size:12.5px;text-align:left;color:var(--ink-secondary);line-height:1.5">
              ${description}
            </div>
          ` : ''}
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12px;padding:10px 12px;border-radius:8px;margin-top:14px;text-align:left;display:flex;align-items:flex-start;gap:8px">
            <span style="flex-shrink:0;color:#dc2626">${ICONS.alertTriangle}</span>
            <span><strong>Database update:</strong> This criterion will be permanently deleted from the active MySQL database.</span>
          </div>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="modal-cancel-delete-c" type="button" style="padding:8px 16px;font-size:13px">Cancel</button>
          <button class="button" id="confirm-delete-c-btn" type="button" style="background:#dc2626;border-color:#dc2626;color:#ffffff;padding:8px 18px;font-size:13px;font-weight:600">
            ${ICONS.trash} <span>Delete Criterion</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalContainer.innerHTML = ''; };
  document.querySelector('#modal-cancel-delete-c').onclick = closeModal;
  const backdrop = document.querySelector('#delete-c-modal-backdrop');
  if (backdrop) backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };

  document.querySelector('#confirm-delete-c-btn').onclick = async () => {
    const btn = document.querySelector('#confirm-delete-c-btn');
    btn.disabled = true;
    btn.textContent = 'Deleting…';

    const res = await request('/api/admin/rubrics/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillKey, criterionIndex })
    });
    closeModal();
    if (res.error) {
      showToast(`Error: ${res.error}`, 'error');
    } else {
      showToast(`✓ Criterion "${criterionName}" permanently deleted from database.`, 'success');
      renderAdmin('rubrics');
    }
  };
}

function openClearSkillRubricModal({ skillKey, skillTitle, count }) {
  const modalContainer = document.querySelector('#modal-root') || document.body;
  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="clear-skill-modal-backdrop" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;backdrop-filter:blur(4px)">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:480px;background:#ffffff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;padding:0">
        <div style="padding:28px 24px 20px;text-align:center">
          <div class="modal-icon-danger" style="width:56px;height:56px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:22px;margin:0 auto 16px">
            ${ICONS.trash}
          </div>
          <h3 style="font:700 20px 'Space Grotesk';color:var(--ink);margin:0 0 8px">Delete All Criteria for ${skillTitle}?</h3>
          <p style="font-size:14px;color:var(--muted);margin:0;line-height:1.5">
            Are you sure you want to permanently delete all <strong>${count} criteria</strong> in <strong>${skillTitle}</strong>?
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12px;padding:10px 12px;border-radius:8px;margin-top:14px;text-align:left;display:flex;align-items:flex-start;gap:8px">
            <span style="flex-shrink:0;color:#dc2626">${ICONS.alertTriangle}</span>
            <span><strong>Warning:</strong> All criteria for this rubric skill will be permanently erased from the database.</span>
          </div>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="modal-cancel-clear-skill" type="button" style="padding:8px 16px;font-size:13px">Cancel</button>
          <button class="button" id="confirm-clear-skill-btn" type="button" style="background:#dc2626;border-color:#dc2626;color:#ffffff;padding:8px 18px;font-size:13px;font-weight:600">
            ${ICONS.trash} <span>Yes, Delete All Criteria</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalContainer.innerHTML = ''; };
  document.querySelector('#modal-cancel-clear-skill').onclick = closeModal;
  const backdrop = document.querySelector('#clear-skill-modal-backdrop');
  if (backdrop) backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };

  document.querySelector('#confirm-clear-skill-btn').onclick = async () => {
    const btn = document.querySelector('#confirm-clear-skill-btn');
    btn.disabled = true;
    btn.textContent = 'Deleting…';

    const res = await request('/api/admin/rubrics/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillKey, clearSkill: true })
    });
    closeModal();
    if (res.error) {
      showToast(`Error: ${res.error}`, 'error');
    } else {
      showToast(`✓ All criteria deleted for ${skillTitle}.`, 'success');
      renderAdmin('rubrics');
    }
  };
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
          <a class="btn-icon" href="/api/admin/results/export?format=pdf&ids=${row.id}" download="certificate-${row.id}.pdf" title="Download Candidate PDF Certificate" style="padding:6px 9px;border-radius:8px">
            ${ICONS.pdf}
          </a>
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
      const link = document.createElement('a');
      link.href = `/api/admin/results/export?format=xlsx&ids=${encodeURIComponent(ids.join(','))}`;
      link.setAttribute('download', `assessify-selected-results-${ids.length}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  }

  const bulkExportPdf = document.querySelector('#bulk-export-pdf-btn');
  if (bulkExportPdf) {
    bulkExportPdf.onclick = () => {
      const checked = Array.from(document.querySelectorAll('.attempt-row-checkbox:checked'));
      if (!checked.length) return showToast('Please select at least one candidate.', 'info');
      const ids = checked.map((cb) => cb.dataset.id);
      const link = document.createElement('a');
      link.href = `/api/admin/results/export?format=pdf&ids=${encodeURIComponent(ids.join(','))}`;
      link.setAttribute('download', `assessify-selected-results-${ids.length}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
// GRADING MODAL LOGIC (Integrated with Active Admin Rubrics)
// -------------------------------------------------------------

const calculateLevel = (total) => {
  if (total <= 6) return 'A1';
  if (total <= 9) return 'A2';
  if (total <= 13) return 'B1';
  if (total <= 17) return 'B2';
  return 'C1';
};

const getLevelBadgeClass = (level) => {
  switch (level) {
    case 'C2': return 'cefr-badge c2';
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
              <p>Loading candidate attempt and active rubrics…</p>
            </div>
          </div>
          <button class="modal-close" id="modal-close-btn" type="button" aria-label="Close modal">✕</button>
        </div>
        <div class="modal-body" style="min-height:280px;display:grid;place-items:center;">
          <p style="color:var(--muted)">Fetching assessment and evaluation criteria…</p>
        </div>
      </div>
    </div>
  `;

  document.querySelector('#modal-close-btn').onclick = closeGradingModal;

  const [data, rubricsData] = await Promise.all([
    request(`/api/admin/results/${attemptId}`),
    request('/api/admin/rubrics')
  ]);

  if (data.error || !data.attempt) {
    showToast(`Error: ${data.error || 'Attempt not found'}`, 'error');
    closeGradingModal();
    return;
  }

  const attempt = data.attempt;
  const existingWritingCriteria = attempt.manualReview?.writing?.criteria || {};
  const existingSpeakingCriteria = attempt.manualReview?.speaking?.criteria || {};

  // Active Rubrics Criteria from DB / Admin Upload
  const activeWritingCriteria = (rubricsData?.writing?.criteria && Array.isArray(rubricsData.writing.criteria) && rubricsData.writing.criteria.length > 0)
    ? rubricsData.writing.criteria
    : [
        { name: 'Task Achievement', description: 'How fully the essay addresses all elements of the prompt, sustains a focused pedagogical thesis, and substantiates claims with concrete examples.' },
        { name: 'Coherence and Cohesion', description: 'Clarity of essay structure, logical paragraph progression, effective use of transitional cohesive devices, and flow of argumentation.' },
        { name: 'Lexical Resource', description: 'Range, precision, sophistication, and stylistic appropriateness of academic vocabulary with minimal lexical inaccuracies.' },
        { name: 'Grammatical Range and Accuracy', description: 'Flexibility and accuracy of complex clause structures, punctuation mastery, grammatical control, and syntactic variety.' }
      ];

  const activeSpeakingCriteria = (rubricsData?.speaking?.criteria && Array.isArray(rubricsData.speaking.criteria) && rubricsData.speaking.criteria.length > 0)
    ? rubricsData.speaking.criteria
    : [
        { name: 'Fluency and Spontaneity', description: 'Natural speech rhythm, appropriate speaking rate, smooth transition between ideas, and effective hesitation management.' },
        { name: 'Listening Comprehension & Interaction', description: 'Accurate comprehension of spoken prompts, relevant topic engagement, and coherent communicative response.' },
        { name: 'Lexical & Idiomatic Range', description: 'Breadth, precision, and nuance of vocabulary used to discuss educational methodologies and abstract pedagogical issues.' },
        { name: 'Grammatical Complexity & Pronunciation', description: 'Accurate use of varied sentence structures, tense coordination, natural sentence intonation contours, and clear articulation.' }
      ];

  const hasC2 = Boolean(rubricsData?.bandScale?.range?.includes('C2') || rubricsData?.writing?.levels?.some((l) => l.level === 'C2'));
  const maxScore = hasC2 ? 6 : 5;

  const writingScale = hasC2 ? [
    { val: 1, code: 'A1', label: 'Minimal' },
    { val: 2, code: 'A2', label: 'Basic' },
    { val: 3, code: 'B1', label: 'Intermediate' },
    { val: 4, code: 'B2', label: 'Upper-Int' },
    { val: 5, code: 'C1', label: 'Advanced' },
    { val: 6, code: 'C2', label: 'Mastery' }
  ] : [
    { val: 1, code: 'A1', label: 'Minimal' },
    { val: 2, code: 'A2', label: 'Basic' },
    { val: 3, code: 'B1', label: 'Intermediate' },
    { val: 4, code: 'B2', label: 'Upper-Int' },
    { val: 5, code: 'C1', label: 'Advanced' }
  ];

  const speakingScale = hasC2 ? [
    { val: 1, code: 'Low (A1)', label: 'Low' },
    { val: 2, code: 'Fair (A2)', label: 'Fair' },
    { val: 3, code: 'Good (B1)', label: 'Good' },
    { val: 4, code: 'Very Good (B2)', label: 'Very Good' },
    { val: 5, code: 'Excellent (C1)', label: 'Excellent' },
    { val: 6, code: 'Mastery (C2)', label: 'Mastery' }
  ] : [
    { val: 1, code: 'Low (A1)', label: 'Low' },
    { val: 2, code: 'Fair (A2)', label: 'Fair' },
    { val: 3, code: 'Good (B1)', label: 'Good' },
    { val: 4, code: 'Very Good (B2)', label: 'Very Good' },
    { val: 5, code: 'Excellent (C1)', label: 'Excellent' }
  ];

  // Dynamic Form State keyed by active criterion name
  const scores = { writing: {}, speaking: {} };
  activeWritingCriteria.forEach((c) => {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    scores.writing[c.name] = existingWritingCriteria[c.name]
      ?? existingWritingCriteria[slug]
      ?? (c.name.includes('Task') ? existingWritingCriteria.taskAchievement : null)
      ?? (c.name.includes('Coher') ? (existingWritingCriteria.organization || existingWritingCriteria.coherence) : null)
      ?? (c.name.includes('Lexic') ? existingWritingCriteria.lexicalResource : null)
      ?? (c.name.includes('Grammar') || c.name.includes('Grammatical') ? existingWritingCriteria.grammaticalRangeAccuracy : null)
      ?? null;
  });

  activeSpeakingCriteria.forEach((c) => {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    scores.speaking[c.name] = existingSpeakingCriteria[c.name]
      ?? existingSpeakingCriteria[slug]
      ?? (c.name.includes('Fluency') ? existingSpeakingCriteria.fluency : null)
      ?? (c.name.includes('Listen') || c.name.includes('Comprehension') ? existingSpeakingCriteria.communication : null)
      ?? (c.name.includes('Lexic') || c.name.includes('Idiomatic') ? existingSpeakingCriteria.vocabulary : null)
      ?? (c.name.includes('Grammar') || c.name.includes('Complexity') ? existingSpeakingCriteria.grammar : null)
      ?? null;
  });

  // Extract candidate submission content
  const responses = attempt.responses || {};
  const selectedTopicTitle = responses['writing_selected_topic_title'] || responses['writing-topic'] || '';
  let task1Text = (responses['writing-0'] || responses['w-1'] || '').trim();
  let task2Text = (responses['writing-1'] || responses['w-2'] || '').trim();

  if (!task1Text && !task2Text && attempt.writing) {
    const rawParts = attempt.writing.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    if (rawParts.length >= 2) {
      task1Text = rawParts[0];
      task2Text = rawParts.slice(1).join('\n\n');
    } else if (rawParts.length === 1) {
      task1Text = rawParts[0];
    }
  }

  const countWords = (str) => (str ? str.trim().split(/\s+/).filter(Boolean).length : 0);
  const singleEssayCandidateText = (responses['writing-essay'] || (task1Text && !task2Text ? task1Text : '') || attempt.writing || '').trim();
  const isSingleEssay = Boolean(selectedTopicTitle || responses['writing-essay'] || (task1Text && !task2Text));
  const task1Words = countWords(task1Text);
  const task2Words = countWords(task2Text);
  const totalWords = isSingleEssay ? countWords(singleEssayCandidateText) : (task1Words + task2Words);
  const totalLetters = isSingleEssay ? singleEssayCandidateText.length : (task1Text.length + task2Text.length);

  const recordingInfo = attempt.speakingRecording ? `${attempt.speakingRecording.mimeType || 'audio/video'}, ${attempt.speakingRecording.durationSeconds || 0}s (${attempt.speakingRecording.transcriptSource || 'recorded'})` : 'No media record file attached';
  const gvBand = attempt.sectionScores?.['Grammar & Vocabulary'] || attempt.scoring?.grammarVocabulary?.level || '—';

  const computeTotals = () => {
    const wVals = Object.values(scores.writing).map(Number).filter((v) => Number.isInteger(v) && v >= 1);
    const sVals = Object.values(scores.speaking).map(Number).filter((v) => Number.isInteger(v) && v >= 1);

    const wCount = activeWritingCriteria.length;
    const sCount = activeSpeakingCriteria.length;

    const wComplete = wCount > 0 && wVals.length >= wCount;
    const sComplete = sCount > 0 && sVals.length >= sCount;

    const wTotal = wVals.reduce((a, b) => a + b, 0);
    const sTotal = sVals.reduce((a, b) => a + b, 0);

    const calcSkillLevel = (vals, count) => {
      if (vals.length < count || count === 0) return null;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (hasC2) {
        if (avg >= 5.5) return 'C2';
        if (avg >= 4.5) return 'C1';
        if (avg >= 3.5) return 'B2';
        if (avg >= 2.5) return 'B1';
        if (avg >= 1.5) return 'A2';
        return 'A1';
      }
      if (avg >= 4.5) return 'C1';
      if (avg >= 3.5) return 'B2';
      if (avg >= 2.5) return 'B1';
      if (avg >= 1.75) return 'A2';
      return 'A1';
    };

    return {
      writing: {
        total: wTotal,
        max: wCount * maxScore,
        level: calcSkillLevel(wVals, wCount),
        complete: wComplete,
        count: wCount,
        selected: wVals.length
      },
      speaking: {
        total: sTotal,
        max: sCount * maxScore,
        level: calcSkillLevel(sVals, sCount),
        complete: sComplete,
        count: sCount,
        selected: sVals.length
      }
    };
  };

  const renderModalContent = () => {
    const totals = computeTotals();

    const writingPill = totals.writing.complete
      ? `<span class="${getLevelBadgeClass(totals.writing.level)}">${totals.writing.level} (${totals.writing.total}/${totals.writing.max})</span>`
      : `<span class="pill pending">Incomplete (${totals.writing.selected}/${totals.writing.count} criteria)</span>`;
    const speakingPill = totals.speaking.complete
      ? `<span class="${getLevelBadgeClass(totals.speaking.level)}">${totals.speaking.level} (${totals.speaking.total}/${totals.speaking.max})</span>`
      : `<span class="pill pending">Incomplete (${totals.speaking.selected}/${totals.speaking.count} criteria)</span>`;

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
                <p style="margin:2px 0 0">Click any criterion rating below to grade using active evaluation rubrics. Changes auto-save instantly.</p>
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
                <span>Writing Grade</span>
                <strong id="w-summary-chip">${totals.writing.level ? `${totals.writing.level} (${totals.writing.total}/${totals.writing.max})` : (attempt.sectionScores?.Writing || 'Pending')}</strong>
              </div>
              <div class="band-mini-card">
                <span>Speaking Grade</span>
                <strong id="s-summary-chip">${totals.speaking.level ? `${totals.speaking.level} (${totals.speaking.total}/${totals.speaking.max})` : (attempt.sectionScores?.Speaking || 'Pending')}</strong>
              </div>
              <div class="band-mini-card" style="background:#eff6ff;border-color:#bfdbfe">
                <span style="color:#1d4ed8">Overall Placement</span>
                <strong style="color:#1e40af">${attempt.overall || (totals.writing.level && totals.speaking.level ? 'Ready to finalize' : 'Pending')}</strong>
              </div>
            </div>

            <!-- Candidate Written Submissions Preview -->
            ${isSingleEssay ? `
              <section class="submission-card">
                <div class="submission-header">
                  <div style="display:flex;align-items:center;gap:8px;color:var(--blue-dark)">
                    ${ICONS.fileText}
                    <strong>Candidate Written Essay (Selected Topic)</strong>
                  </div>
                  <span style="font-size:12px;color:var(--muted);font-weight:600">${countWords(singleEssayCandidateText)} words (${singleEssayCandidateText.length} letters)</span>
                </div>
                <div style="padding:14px">
                  <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:14px">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;padding-bottom:10px;border-bottom:1px solid #f1f5f9">
                      <div style="display:flex;align-items:center;gap:8px">
                        <span class="pill success" style="font-weight:700">Selected Question</span>
                        <strong style="color:var(--ink);font-size:14.5px">${selectedTopicTitle || 'Writing Placement Topic'}</strong>
                      </div>
                      <div style="display:flex;align-items:center;gap:8px">
                        <span style="font-size:12px;color:var(--muted)">Target: 150–220 words</span>
                        <span class="pill ${countWords(singleEssayCandidateText) >= 150 ? 'success' : 'pending'}" style="font-size:11px;font-weight:600">${countWords(singleEssayCandidateText)} words · ${singleEssayCandidateText.length} letters</span>
                      </div>
                    </div>
                    <div class="submission-content" style="white-space:pre-wrap;font-size:13.5px;line-height:1.65;color:var(--ink);background:#f8fafc;padding:12px 14px;border-radius:8px;border:1px solid #edf2f7;min-height:70px">
                      ${singleEssayCandidateText ? singleEssayCandidateText.replace(/</g, '&lt;') : '<em style="color:var(--muted)">No essay response recorded.</em>'}
                    </div>
                  </div>
                </div>
              </section>
            ` : `
              <section class="submission-card">
                <div class="submission-header">
                  <div style="display:flex;align-items:center;gap:8px;color:var(--blue-dark)">
                    ${ICONS.fileText}
                    <strong>Candidate Written Submissions (2 Writing Tasks)</strong>
                  </div>
                  <span style="font-size:12px;color:var(--muted);font-weight:600">${totalWords} total words (${totalLetters} letters)</span>
                </div>
                <div style="padding:14px;display:flex;flex-direction:column;gap:12px">
                  <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;padding-bottom:8px;border-bottom:1px solid #f1f5f9">
                      <div style="display:flex;align-items:center;gap:8px">
                        <span style="background:var(--blue-dark);color:#ffffff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:0.5px">TASK 1</span>
                        <strong style="color:var(--ink);font-size:13.5px">Question 1: Pedagogical Communication</strong>
                      </div>
                      <div style="display:flex;align-items:center;gap:8px">
                        <span style="font-size:12px;color:var(--muted)">Target: 120–150 words</span>
                        <span class="pill ${task1Words >= 120 ? 'success' : 'pending'}" style="font-size:11px;font-weight:600">${task1Words} words</span>
                      </div>
                    </div>
                    <div class="submission-content" style="white-space:pre-wrap;font-size:13.5px;line-height:1.6;color:var(--ink);background:#f8fafc;padding:10px 12px;border-radius:6px;border:1px solid #edf2f7;min-height:48px">
                      ${task1Text ? task1Text.replace(/</g, '&lt;') : '<em style="color:var(--muted)">No response recorded for Task 1.</em>'}
                    </div>
                  </div>
                  <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;padding-bottom:8px;border-bottom:1px solid #f1f5f9">
                      <div style="display:flex;align-items:center;gap:8px">
                        <span style="background:var(--blue-dark);color:#ffffff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:0.5px">TASK 2</span>
                        <strong style="color:var(--ink);font-size:13.5px">Question 2: Academic Discursive Essay</strong>
                      </div>
                      <div style="display:flex;align-items:center;gap:8px">
                        <span style="font-size:12px;color:var(--muted)">Target: 180–220 words</span>
                        <span class="pill ${task2Words >= 180 ? 'success' : 'pending'}" style="font-size:11px;font-weight:600">${task2Words} words</span>
                      </div>
                    </div>
                    <div class="submission-content" style="white-space:pre-wrap;font-size:13.5px;line-height:1.6;color:var(--ink);background:#f8fafc;padding:10px 12px;border-radius:6px;border:1px solid #edf2f7;min-height:48px">
                      ${task2Text ? task2Text.replace(/</g, '&lt;') : '<em style="color:var(--muted)">No response recorded for Task 2.</em>'}
                    </div>
                  </div>
                </div>
              </section>
            `}

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
              <span id="modal-validation-msg">Please select scores for all criteria before saving.</span>
            </div>

            <!-- Rubrics Evaluation Section (Synchronized with Uploaded Admin Rubrics) -->
            <div style="display:grid;grid-template-columns:1fr;gap:20px;">
              <!-- 1. Writing Rubric -->
              <section class="rubric-panel-card" id="writing-rubric-card">
                <div class="rubric-panel-header">
                  <div class="rubric-panel-title">
                    <div class="skill-icon-badge skill-icon-writing" style="width:28px;height:28px">${ICONS.penTool}</div>
                    <span>${rubricsData?.writing?.title || 'Writing Rubric Assessment'}</span>
                  </div>
                  <div id="w-calc-badge" class="rubric-panel-badge">
                    ${writingPill}
                  </div>
                </div>
                <div class="rubric-grid">
                  ${activeWritingCriteria.length === 0 ? `
                    <div style="padding:20px;text-align:center;color:var(--muted)">No criteria configured for Writing. Please add criteria in the Rubrics tab.</div>
                  ` : activeWritingCriteria.map((data, idx) => {
                    const selectedVal = scores.writing[data.name];
                    return `
                      <div class="rubric-item" data-skill="writing" data-field="${data.name.replaceAll('"', '&quot;')}">
                        <div class="rubric-item-header">
                          <div style="display:flex;align-items:center;gap:8px">
                            <span class="criterion-badge" style="background:#eff6ff;color:#2563eb;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">CRITERION ${idx + 1}</span>
                            <span class="rubric-item-title">${data.name}</span>
                          </div>
                          <span class="rubric-item-desc">${data.description || ''}</span>
                        </div>
                        <div class="scale-buttons">
                          ${writingScale.map((opt) => {
                            const isActive = selectedVal === opt.val;
                            return `
                              <button type="button" class="scale-btn ${isActive ? 'active' : ''}" data-skill="writing" data-field="${data.name.replaceAll('"', '&quot;')}" data-val="${opt.val}" title="${opt.label}">
                                <strong>${opt.val} — ${opt.code}</strong>
                                <span>${opt.label}</span>
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
                    <span>${rubricsData?.speaking?.title || 'Speaking Rubric Assessment'}</span>
                  </div>
                  <div id="s-calc-badge" class="rubric-panel-badge">
                    ${speakingPill}
                  </div>
                </div>
                <div class="rubric-grid">
                  ${activeSpeakingCriteria.length === 0 ? `
                    <div style="padding:20px;text-align:center;color:var(--muted)">No criteria configured for Speaking. Please add criteria in the Rubrics tab.</div>
                  ` : activeSpeakingCriteria.map((data, idx) => {
                    const selectedVal = scores.speaking[data.name];
                    return `
                      <div class="rubric-item" data-skill="speaking" data-field="${data.name.replaceAll('"', '&quot;')}">
                        <div class="rubric-item-header">
                          <div style="display:flex;align-items:center;gap:8px">
                            <span class="criterion-badge" style="background:#f5f3ff;color:#7c3aed;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">CRITERION ${idx + 1}</span>
                            <span class="rubric-item-title">${data.name}</span>
                          </div>
                          <span class="rubric-item-desc">${data.description || ''}</span>
                        </div>
                        <div class="scale-buttons">
                          ${speakingScale.map((opt) => {
                            const isActive = selectedVal === opt.val;
                            return `
                              <button type="button" class="scale-btn ${isActive ? 'active' : ''}" data-skill="speaking" data-field="${data.name.replaceAll('"', '&quot;')}" data-val="${opt.val}" title="${opt.label}">
                                <strong>${opt.val} — ${opt.code}</strong>
                                <span>${opt.label}</span>
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
                ? `<span>Ready to save: <strong>Writing ${totals.writing.level} (${totals.writing.total}/${totals.writing.max})</strong> · <strong>Speaking ${totals.speaking.level} (${totals.speaking.total}/${totals.speaking.max})</strong></span>`
                : `<span style="color:var(--warning)">⚠️ Please select a score for all ${activeWritingCriteria.length} Writing and ${activeSpeakingCriteria.length} Speaking criteria.</span>`}
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
        await request(`/api/admin/results/${attemptId}/review`, {
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
    }, 250);
  };

  // Scale Button Clicks (In-place DOM updates — NO modal refresh)
  document.querySelectorAll('.scale-btn').forEach((btn) => {
    btn.onclick = () => {
      const skill = btn.dataset.skill;
      const field = btn.dataset.field;
      const val = Number(btn.dataset.val);

      scores[skill][field] = val;

      // 1. In-place button active toggle
      const siblingBtns = document.querySelectorAll(`.scale-btn[data-skill="${skill}"][data-field="${field.replaceAll('"', '\\"')}"]`);
      siblingBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // 2. In-place summary calculations
      const totals = computeTotals();

      const wBadge = document.querySelector('#w-calc-badge');
      if (wBadge) {
        wBadge.innerHTML = totals.writing.complete
          ? `<span class="${getLevelBadgeClass(totals.writing.level)}">${totals.writing.level} (${totals.writing.total}/${totals.writing.max})</span>`
          : `<span class="pill pending">Incomplete (${totals.writing.selected}/${totals.writing.count} criteria)</span>`;
      }

      const sBadge = document.querySelector('#s-calc-badge');
      if (sBadge) {
        sBadge.innerHTML = totals.speaking.complete
          ? `<span class="${getLevelBadgeClass(totals.speaking.level)}">${totals.speaking.level} (${totals.speaking.total}/${totals.speaking.max})</span>`
          : `<span class="pill pending">Incomplete (${totals.speaking.selected}/${totals.speaking.count} criteria)</span>`;
      }

      const wSum = document.querySelector('#w-summary-chip');
      if (wSum) {
        wSum.textContent = totals.writing.level ? `${totals.writing.level} (${totals.writing.total}/${totals.writing.max})` : 'Pending';
      }

      const sSum = document.querySelector('#s-summary-chip');
      if (sSum) {
        sSum.textContent = totals.speaking.level ? `${totals.speaking.level} (${totals.speaking.total}/${totals.speaking.max})` : 'Pending';
      }

      const footSum = document.querySelector('#modal-footer-summary');
      if (footSum) {
        footSum.innerHTML = totals.writing.complete && totals.speaking.complete
          ? `<span>Ready to finalize: <strong>Writing ${totals.writing.level} (${totals.writing.total}/${totals.writing.max})</strong> · <strong>Speaking ${totals.speaking.level} (${totals.speaking.total}/${totals.speaking.max})</strong></span>`
          : `<span style="color:var(--warning)">⚠️ Please select a score for all ${activeWritingCriteria.length} Writing and ${activeSpeakingCriteria.length} Speaking criteria.</span>`;
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
        errorMsg.textContent = `Please select a rating for all ${activeWritingCriteria.length} Writing and ${activeSpeakingCriteria.length} Speaking criteria.`;
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
    showToast(`Grades finalized successfully for ${attempt.teacher}! Writing: ${result.manualReview.writing.level} (${result.manualReview.writing.total}/${totals.writing.max}), Speaking: ${result.manualReview.speaking.level} (${result.manualReview.speaking.total}/${totals.speaking.max}).`, 'success');
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
