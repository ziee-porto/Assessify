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
    const fetchOptions = { ...options };
    if (fetchOptions.body && typeof fetchOptions.body === 'object' && !(fetchOptions.body instanceof FormData) && !(fetchOptions.body instanceof Blob)) {
      fetchOptions.body = JSON.stringify(fetchOptions.body);
      fetchOptions.headers = {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers || {})
      };
    }
    const response = await fetch(path, fetchOptions);
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
  clipboardCheck: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><polyline points="9 14 12 17 16 12"/></svg>`,
  shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  copy: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
};

function getLevelBadgeClass(level) {
  if (!level) return 'pill';
  const lvl = String(level).toUpperCase().trim();
  if (lvl.includes('C2') || lvl.includes('C1')) return 'pill success';
  if (lvl.includes('B2') || lvl.includes('B1')) return 'pill primary';
  if (lvl.includes('A2')) return 'pill warning';
  if (lvl.includes('A1')) return 'pill danger';
  return 'pill';
}

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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class RealtimeClient {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map();
    this.status = 'disconnected';
    this.attemptId = null;
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
    return () => this.off(eventType, callback);
  }

  off(eventType, callback) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(callback);
    }
  }

  emit(eventType, data) {
    if (this.listeners.has(eventType)) {
      for (const cb of this.listeners.get(eventType)) {
        try { cb(data); } catch (e) { console.error(`Realtime handler error for ${eventType}:`, e); }
      }
    }
  }

  updateIndicator(status) {
    this.status = status;
    let container = document.querySelector('#live-sync-indicator');
    if (!container) {
      const topActions = document.querySelector('.top-actions');
      if (topActions) {
        container = document.createElement('div');
        container.id = 'live-sync-indicator';
        topActions.insertBefore(container, topActions.firstChild);
      }
    }
    if (!container) return;

    if (status === 'connected') {
      container.innerHTML = `<div class="live-sync-pill" title="Connected to Assessify live real-time event bus"><span class="live-sync-dot"></span><span>Live Sync</span></div>`;
    } else if (status === 'reconnecting') {
      container.innerHTML = `<div class="live-sync-pill is-reconnecting" title="Reconnecting to real-time event stream..."><span class="live-sync-dot"></span><span>Reconnecting…</span></div>`;
    } else {
      container.innerHTML = `<div class="live-sync-pill is-offline" title="Live real-time sync is offline"><span class="live-sync-dot"></span><span>Offline</span></div>`;
    }
  }

  connect(attemptId = null) {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (attemptId) this.attemptId = attemptId;

    const url = `/api/realtime/events${this.attemptId ? `?attemptId=${encodeURIComponent(this.attemptId)}` : ''}`;
    this.updateIndicator('reconnecting');

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.updateIndicator('connected');
      };

      this.eventSource.onerror = () => {
        this.updateIndicator('reconnecting');
      };

      const eventTypes = [
        'CONNECTED',
        'CANDIDATE_PRESENCE_SYNC',
        'CANDIDATE_PRESENCE_UPDATE',
        'PROCTOR_MESSAGE',
        'TIME_EXTENDED',
        'FORCE_SUBMIT',
        'BROADCAST_ANNOUNCEMENT',
        'ATTEMPT_STARTED',
        'ATTEMPT_AUTOSAVED',
        'ANTI_CHEAT_VIOLATION',
        'ATTEMPT_SUBMITTED',
        'GRADING_PROGRESS',
        'ATTEMPT_GRADED',
        'ATTEMPT_DELETED',
        'AUDIT_LOG_ENTRY'
      ];

      for (const evType of eventTypes) {
        this.eventSource.addEventListener(evType, (event) => {
          try {
            const parsed = JSON.parse(event.data);
            this.emit(evType, parsed.data || parsed);
          } catch (e) {
            console.warn(`Could not parse event ${evType}:`, e);
          }
        });
      }
    } catch (err) {
      console.warn('EventSource connection error:', err);
      this.updateIndicator('offline');
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.updateIndicator('offline');
  }
}

const realtime = new RealtimeClient();

// Global Proctor Listeners
realtime.on('PROCTOR_MESSAGE', (data) => {
  const modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) return;
  const overlay = document.createElement('div');
  overlay.className = 'proctor-alert-backdrop';
  overlay.innerHTML = `
    <div class="proctor-alert-box">
      <div style="font-size:36px;margin-bottom:12px">⚠️</div>
      <h3 style="margin:0 0 10px 0;font-size:18px;font-weight:800;color:#991b1b">PROCTOR WARNING</h3>
      <p style="font-size:14px;color:#1e293b;line-height:1.5;margin-bottom:16px">${escapeHtml(data.message)}</p>
      <div style="font-size:12px;color:#64748b;margin-bottom:20px">Issued by <strong>${escapeHtml(data.sender || 'Exam Proctor')}</strong> at ${new Date(data.sentAt || Date.now()).toLocaleTimeString()}</div>
      <button class="button" id="btn-ack-proctor-alert" style="width:100%;padding:10px 18px;font-weight:700;background:#dc2626;color:#fff">Acknowledge & Return to Test</button>
    </div>
  `;
  modalRoot.appendChild(overlay);
  overlay.querySelector('#btn-ack-proctor-alert').onclick = () => overlay.remove();
});

realtime.on('BROADCAST_ANNOUNCEMENT', (data) => {
  const existing = document.querySelector('#proctor-broadcast-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'proctor-broadcast-banner';
  banner.className = 'proctor-broadcast-banner';
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">📢</span>
      <div>
        <div style="font-weight:700;font-size:13.5px">${escapeHtml(data.sender || 'Exam Announcement')}</div>
        <div style="font-size:13px;opacity:0.95">${escapeHtml(data.message)}</div>
      </div>
    </div>
    <button type="button" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;opacity:0.8" aria-label="Close">✕</button>
  `;
  document.body.appendChild(banner);
  banner.querySelector('button').onclick = () => banner.remove();
  setTimeout(() => { if (banner.parentElement) banner.remove(); }, 12000);
});

function openProctorWarningModal(attemptId, candidateName) {
  const modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) return;
  const overlay = document.createElement('div');
  overlay.className = 'proctor-alert-backdrop';
  overlay.innerHTML = `
    <div class="proctor-alert-box" style="border-top-color:#2563eb;text-align:left">
      <h3 style="margin:0 0 6px 0;font-size:17px;font-weight:800;color:var(--navy)">Send Live Proctor Warning</h3>
      <p style="margin:0 0 16px 0;font-size:13px;color:var(--muted)">Target: <strong>${escapeHtml(candidateName)}</strong> (<code>${attemptId}</code>)</p>
      
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--navy)">Preset Quick Notice:</label>
        <select id="preset-warning" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line);font-size:12.5px">
          <option value="">-- Choose template or type below --</option>
          <option value="Tab switching is strictly forbidden. Please stay focused on the assessment.">Tab switching forbidden</option>
          <option value="Please return to full-screen mode immediately to continue your assessment.">Return to full-screen mode</option>
          <option value="Ensure your microphone and camera remain unmuted and unobstructed.">Check camera & microphone</option>
          <option value="Multiple display or split-screen usage has been flagged by the proctoring engine.">Split screen detected</option>
        </select>
      </div>

      <div style="margin-bottom:18px">
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--navy)">Custom Warning Message:</label>
        <textarea id="proctor-warn-text" rows="3" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line);font-size:13px;font-family:inherit" placeholder="Enter instructions for candidate…"></textarea>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="ghost" id="btn-cancel-warn" type="button" style="padding:8px 14px">Cancel</button>
        <button class="button" id="btn-send-warn" type="button" style="padding:8px 18px;background:#dc2626;color:#fff;font-weight:600">Send Warning</button>
      </div>
    </div>
  `;
  modalRoot.appendChild(overlay);

  const preset = overlay.querySelector('#preset-warning');
  const txt = overlay.querySelector('#proctor-warn-text');
  preset.onchange = () => { if (preset.value) txt.value = preset.value; };
  overlay.querySelector('#btn-cancel-warn').onclick = () => overlay.remove();

  overlay.querySelector('#btn-send-warn').onclick = async () => {
    const msg = txt.value.trim();
    if (!msg) return showToast('Please enter a warning message', 'error');
    overlay.querySelector('#btn-send-warn').disabled = true;
    overlay.querySelector('#btn-send-warn').textContent = 'Sending…';

    const res = await request('/api/admin/proctor/message', {
      method: 'POST',
      body: { attemptId, message: msg }
    });
    overlay.remove();
    if (res.success) {
      showToast(`Warning sent to ${candidateName}`, 'success');
    } else {
      showToast(res.error || 'Failed to send warning', 'error');
    }
  };
}

function openProctorBroadcastModal() {
  const modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) return;
  const overlay = document.createElement('div');
  overlay.className = 'proctor-alert-backdrop';
  overlay.innerHTML = `
    <div class="proctor-alert-box" style="border-top-color:#1e3a8a;text-align:left">
      <h3 style="margin:0 0 6px 0;font-size:17px;font-weight:800;color:var(--navy)">Broadcast Live Announcement</h3>
      <p style="margin:0 0 16px 0;font-size:13px;color:var(--muted)">This notice will display instantly across all candidates currently taking an assessment.</p>

      <div style="margin-bottom:12px">
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--navy)">Quick Announcement Presets:</label>
        <select id="preset-broadcast" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line);font-size:12.5px">
          <option value="">-- Choose preset or type custom below --</option>
          <option value="15 minutes remaining in today's testing window. Please pace your remaining tasks.">15 minutes remaining</option>
          <option value="5 minutes remaining! All unsubmitted answers will automatically finalize at deadline.">5 minutes remaining</option>
          <option value="System announcement: Please review your written essays before proceeding to Speaking.">Review essays notice</option>
        </select>
      </div>

      <div style="margin-bottom:18px">
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--navy)">Broadcast Message:</label>
        <textarea id="proctor-broadcast-text" rows="3" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line);font-size:13px;font-family:inherit" placeholder="Type announcement for all candidates…"></textarea>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="ghost" id="btn-cancel-broadcast" type="button" style="padding:8px 14px">Cancel</button>
        <button class="button" id="btn-send-broadcast" type="button" style="padding:8px 18px;background:#2563eb;color:#fff;font-weight:600">Broadcast Now</button>
      </div>
    </div>
  `;
  modalRoot.appendChild(overlay);

  const preset = overlay.querySelector('#preset-broadcast');
  const txt = overlay.querySelector('#proctor-broadcast-text');
  preset.onchange = () => { if (preset.value) txt.value = preset.value; };
  overlay.querySelector('#btn-cancel-broadcast').onclick = () => overlay.remove();

  overlay.querySelector('#btn-send-broadcast').onclick = async () => {
    const msg = txt.value.trim();
    if (!msg) return showToast('Please enter an announcement message', 'error');
    overlay.querySelector('#btn-send-broadcast').disabled = true;
    overlay.querySelector('#btn-send-broadcast').textContent = 'Broadcasting…';

    const res = await request('/api/admin/proctor/broadcast', {
      method: 'POST',
      body: { message: msg }
    });
    overlay.remove();
    if (res.success) {
      showToast('Broadcast sent to all candidates', 'success');
    } else {
      showToast(res.error || 'Failed to broadcast', 'error');
    }
  };
}

function openProctorForceSubmitModal(attemptId, candidateName) {
  const modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) return;

  const submitIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;

  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="force-submit-modal-backdrop">
      <div class="modal-card" style="max-width:480px" role="dialog" aria-modal="true" aria-labelledby="force-submit-title">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <div class="modal-icon" style="background:rgba(220,38,38,0.1);color:#dc2626">${submitIcon}</div>
            <div>
              <h2 id="force-submit-title" style="margin:0;color:#dc2626">Force Submit Assessment</h2>
              <p style="margin:2px 0 0;font-size:13px;color:var(--muted)">Session proctoring override</p>
            </div>
          </div>
          <button class="modal-close" id="close-force-submit-btn" type="button" aria-label="Close modal">✕</button>
        </div>
        <div class="modal-body" style="padding:20px 24px">
          <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:var(--ink)">
            Are you sure you want to <strong>FORCE SUBMIT</strong> the assessment for <strong>${escapeHtml(candidateName)}</strong> (<code>${escapeHtml(attemptId)}</code>)?
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;padding:12px 14px;border-radius:8px;font-size:13px;color:#991b1b;margin-bottom:20px">
            ⚠️ <strong>Warning:</strong> This will immediately lock the candidate's active test session, finalize all recorded responses, and generate their provisional CEFR placement band. This action cannot be undone.
          </div>
          <div id="force-submit-error" style="color:#dc2626;font-size:13px;font-weight:600;display:none;margin-bottom:12px"></div>
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button type="button" class="button ghost" id="btn-cancel-force-submit" style="padding:10px 18px">Cancel</button>
            <button type="button" class="button" id="btn-confirm-force-submit" style="padding:10px 20px;background:#dc2626;border-color:#dc2626;color:#ffffff;display:flex;align-items:center;gap:6px">
              ${submitIcon} <span>Confirm Force Submit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const onKey = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  const closeModal = () => {
    modalRoot.innerHTML = '';
    window.removeEventListener('keydown', onKey);
  };
  window.addEventListener('keydown', onKey);

  modalRoot.querySelector('#close-force-submit-btn').onclick = closeModal;
  modalRoot.querySelector('#btn-cancel-force-submit').onclick = closeModal;
  modalRoot.querySelector('#force-submit-modal-backdrop').onclick = (e) => {
    if (e.target.id === 'force-submit-modal-backdrop') closeModal();
  };

  const confirmBtn = modalRoot.querySelector('#btn-confirm-force-submit');
  const errEl = modalRoot.querySelector('#force-submit-error');

  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Submitting…';

    const subRes = await request('/api/admin/proctor/force-submit', {
      method: 'POST',
      body: { attemptId, reason: 'Force submitted by exam proctor' }
    });

    if (subRes.error || !subRes.success) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `${submitIcon} <span>Confirm Force Submit</span>`;
      errEl.textContent = subRes.error || 'Failed to force submit';
      errEl.style.display = 'block';
      return;
    }

    closeModal();
    showToast(`Successfully force-submitted assessment for ${candidateName}`, 'success');
  };
}

function renderLogin(initialRole) {
  document.body.classList.remove('has-admin-sidebar', 'sidebar-open');
  const logoutBtn = document.querySelector('#logout');
  if (logoutBtn) logoutBtn.hidden = true;
  const burger = document.querySelector('#sidebar-burger');
  if (burger) burger.setAttribute('aria-expanded', 'false');
  const roleLabel = document.querySelector('#role-label');
  if (roleLabel) roleLabel.textContent = 'Secure school workspace';

  const savedRole = initialRole || localStorage.getItem('assessify_login_role') || (new URLSearchParams(window.location.search).get('role')) || 'teacher';
  const isAdminRole = savedRole === 'admin';

  app.innerHTML = `
    <div class="login-wrapper">
      <section class="panel login-panel">
        <div class="eyebrow">Karya Bangsa School</div>
        <h1 style="font:700 32px 'Space Grotesk';margin:8px 0;color:var(--ink)">Welcome to Assessify</h1>
        <p style="color:var(--muted);line-height:1.6;font-size:14px;margin-bottom:20px">Sign in with your student or educator credentials to begin a placement assessment or access administration reports.</p>
        
        <form id="login-form">
          <label style="display:block;font-size:13px;font-weight:700;margin:16px 0 6px;color:var(--ink)">Workspace</label>
          <select class="select-filter" id="login-role" name="role" style="width:100%;padding:12px;margin-bottom:6px">
            <option value="teacher" ${!isAdminRole ? 'selected' : ''}>Placement Candidate</option>
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
            const rosterLabel = res.role === 'student' ? 'Verified Student Roster' : 'Verified Educator Roster';
            const extra = res.grade ? ` • ${res.grade}` : (res.student_id ? ` • NISN: ${res.student_id}` : '');
            verifyBadge.innerHTML = `✓ ${rosterLabel}: <strong>${res.unit}</strong>${extra}`;
          }
          if (unitSelect) unitSelect.value = res.unit;
          if (nameInput && res.name) nameInput.value = res.name;
          const errEl = document.querySelector('#login-error');
          if (errEl) errEl.textContent = '';
        } else {
          if (verifyBadge) {
            verifyBadge.style.display = 'block';
            verifyBadge.style.color = '#dc2626';
            verifyBadge.innerHTML = `⚠ Email is not registered in the Karya Bangsa roster (Students or Teachers).`;
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
  document.querySelector('#role-label').textContent = user.role === 'admin' ? 'Admin workspace' : (user.role === 'student' ? 'Student workspace' : 'Placement Candidate workspace');
  realtime.connect();
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

  const schoolName = window.assessifySettings?.schoolName || 'Karya Bangsa School';
  const certIssuer = window.assessifySettings?.certificateIssuer || 'Pusat Bahasa & Asesmen Guru Karya Bangsa';

  const schoolPrefix = (schoolName || 'Karya Bangsa School').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 3).join('').toUpperCase() || 'KBS';
  const subDateObj = new Date(attempt.submittedAt || attempt.startedAt || Date.now());
  const year = !isNaN(subDateObj.getTime()) ? subDateObj.getUTCFullYear() : new Date().getUTCFullYear();
  const serialNumber = `${schoolPrefix}-EN-${year}-${String(attempt.id).replace(/^ATT-/, '')}`;

  const candidateName = user.name || attempt.teacher || 'Candidate';
  const candidateInitials = candidateName.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const analysisText = attempt.analysis || (
    isReviewed
      ? `Overall CEFR Placement: ${overallBand} — ${overallDesc}. Assessment has been officially graded and archived by ${schoolName} Academic Evaluation Board.`
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
              <span>${schoolName} · Faculty Placement Board</span>
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
              <span class="meta-label">${ICONS.pin} Serial Number</span>
              <div class="meta-value"><span class="attempt-pill">${serialNumber}</span></div>
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
                    ? `Evaluated across Grammar & Vocabulary, Writing, and Speaking according to ${schoolName} CEFR Placement Rubrics.`
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
              <span><strong>Single Assessment Policy:</strong> Record is officially sealed and locked under institutional academic governance. - <em>Issued by: ${certIssuer}</em></span>
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
  document.body.classList.remove('has-admin-sidebar', 'sidebar-open');
  const burger = document.querySelector('#sidebar-burger');
  if (burger) burger.setAttribute('aria-expanded', 'false');
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
      const durationMins = Number(test.durationMinutes) || 65;
      const expiresAt = new Date(new Date(inProgressAttempt.startedAt).getTime() + durationMins * 60 * 1000).toISOString();
      renderSectionFlow(test, expiresAt, inProgressAttempt.id, { ...inProgressAttempt, resumed: true }, user);
      return;
    } else {
      // Candidate data is not in progress (e.g. deleted by admin or fresh): purge any stale autosaves
      const userEmail = (user?.email || '').toLowerCase().trim();
      if (userEmail) {
        try {
          localStorage.removeItem(`assessify_autosave_${userEmail}`);
          const prefix = `assessify_autosave_${userEmail}`;
          const toRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) toRemove.push(k);
          }
          toRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {}
      }
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
    try {
      await loadPublicSettings();
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
      renderSectionFlow(test, result.expiresAt, result.attempt.id, { ...result.attempt, resumed: Boolean(result.resumed) }, user);
    } catch (err) {
      console.error('Failed to start section flow:', err);
      btn.disabled = false;
      btn.textContent = inProgressAttempt ? 'Resume Assessment →' : 'Start Assessment →';
      showToast('Error initializing assessment: ' + (err.message || err), 'error');
    }
  };
}

function renderSectionFlow(test, expiresAt, attemptId, attemptData = {}, user = {}) {
  // Normalize section labels so current.label is always defined
  (test.sections || []).forEach((sec) => {
    if (!sec.label) {
      sec.label = sec.title || (
        sec.id === 'grammar-vocabulary' ? 'Grammar & Vocabulary Placement Test' :
        sec.id === 'writing' ? 'Writing Placement Test' :
        sec.id === 'speaking' ? 'Oral Placement Test' :
        (sec.id ? sec.id.charAt(0).toUpperCase() + sec.id.slice(1) : 'Assessment Section')
      );
    }
  });

  let sectionIndex = 0;
  let mediaRecorder = null;
  let mediaStream = null;
  let recordingChunks = [];
  let recordingStartedAt = null;
  let speechRecognizer = null;
  let speakingStep = 0;
  let speakingRecordingState = 'idle'; // 'idle' | 'recording' | 'stopped'
  let isTerminated = false;
  let heartbeatInterval = null;
  const playedAudio = {};

  const userEmail = (user?.email || attemptData?.email || 'candidate').toLowerCase().trim();
  const STORAGE_KEY = `assessify_autosave_${userEmail}_${attemptId}`;
  const LEGACY_STORAGE_KEY = `assessify_autosave_${userEmail}`;

  // Only consider it a resume if candidate attempt exists in database and is flagged resumed or has active responses/timers
  const isResume = Boolean(attemptData?.resumed || (attemptData?.status === 'In progress' && (attemptData?.responses || attemptData?.sectionRemainingMs)));

  let localState = {};
  if (isResume) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) localState = JSON.parse(raw);
    } catch (err) {
      console.warn('Could not read from localStorage:', err);
    }
  } else {
    // If not a resume (new attempt after deletion or fresh start), completely wipe any stale autosaves
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      const prefix = `assessify_autosave_${userEmail}`;
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }

  // Ensure Grammar & Vocabulary questions follow the candidate's specific scrambled order
  const candidateOrder = isResume
    ? (attemptData?.grammarVocabularyOrder || localState?.grammarVocabularyOrder)
    : (attemptData?.grammarVocabularyOrder || null);
  if (Array.isArray(candidateOrder) && candidateOrder.length > 0) {
    const gvSec = (test.sections || []).find((s) => s.id === 'grammar-vocabulary');
    if (gvSec && Array.isArray(gvSec.questions)) {
      const qMap = new Map(gvSec.questions.map((q) => [q.id, q]));
      const ordered = candidateOrder.map((id) => qMap.get(id)).filter(Boolean);
      for (const q of gvSec.questions) {
        if (!candidateOrder.includes(q.id)) ordered.push(q);
      }
      if (ordered.length === gvSec.questions.length) {
        gvSec.questions = ordered;
      }
    }
  }

  // Restore answers: only restore if isResume is true. If fresh, start completely empty.
  const answers = isResume
    ? Object.assign({}, attemptData?.responses || {}, localState.answers || {})
    : {};
  if (isResume && attemptData?.writing && !answers['writing-essay'] && !answers['writing-0']) {
    answers['writing-essay'] = attemptData.writing;
  }

  // Restore section index
  if (isResume) {
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
  }

  const sectionDurations = {
    'grammar-vocabulary': 30 * 60 * 1000,
    'writing': 20 * 60 * 1000,
    'speaking': 15 * 60 * 1000
  };
  const sectionStartTimes = isResume
    ? Object.assign({}, attemptData?.sectionStartTimes || {}, localState?.sectionStartTimes || {})
    : { 0: new Date().toISOString() };
  if (!sectionStartTimes[0] && !sectionStartTimes['0']) {
    sectionStartTimes[0] = attemptData?.startedAt || new Date().toISOString();
  }
  const sectionRemainingMs = isResume
    ? Object.assign({}, attemptData?.sectionRemainingMs || {}, localState.sectionRemainingMs || {})
    : { 0: 30 * 60 * 1000, 1: 20 * 60 * 1000, 2: 15 * 60 * 1000 };
  const sectionEndTimes = isResume
    ? Object.assign({}, attemptData?.sectionEndTimes || {}, localState.sectionEndTimes || {})
    : {};
  let timerTimeoutId = null;
  let saveDebounceTimer = null;
  let hasRestoredToastShown = false;

  // Connect candidate to real-time telemetry channel
  realtime.connect(attemptId);

  const handleTimeExtended = (ev) => {
    const addedMinutes = Number(ev.minutes) || 5;
    const addedMs = Number(ev.addedMs) || (addedMinutes * 60 * 1000);
    if (sectionEndTimes[sectionIndex]) {
      sectionEndTimes[sectionIndex] = Number(sectionEndTimes[sectionIndex]) + addedMs;
    }
    if (sectionRemainingMs[sectionIndex] !== undefined) {
      sectionRemainingMs[sectionIndex] = Number(sectionRemainingMs[sectionIndex]) + addedMs;
    }
    persistProgress(true);
    showToast(`⏱️ Proctor Intervention: +${addedMinutes} minutes granted! ${ev.reason ? '(' + ev.reason + ')' : ''}`, 'success', 8000);
  };

  const handleForceSubmit = (ev) => {
    showToast(`⚠️ Proctor Intervention: Assessment submitted by proctor (${ev.reason || 'Proctor administrative action'})`, 'error', 10000);
    submitAssessment(true);
  };

  const handleCandidateAttemptDeleted = (ev) => {
    if (ev.attemptId === attemptId) {
      handleAttemptDeleted();
    }
  };

  realtime.on('TIME_EXTENDED', handleTimeExtended);
  realtime.on('FORCE_SUBMIT', handleForceSubmit);
  realtime.on('ATTEMPT_DELETED', handleCandidateAttemptDeleted);

  // ==========================================
  // ANTI-CHEAT CONTROLS ENGINE
  // ==========================================
  const getActiveRules = () => {
    // Current institutional system settings always takes authority
    const sysAc = window.assessifySettings?.antiCheat;
    const attemptAc = attemptData?.antiCheat?.rules;
    const base = sysAc || attemptAc || {
      enabled: false,
      tabSwitchDetection: false,
      requireFullscreen: false,
      splitScreenDetection: false,
      blockDevTools: false,
      blockCopyPaste: false
    };
    const isEnabled = Boolean(
      base.enabled !== false &&
      (
        Boolean(base.tabSwitchDetection) ||
        Boolean(base.requireFullscreen) ||
        Boolean(base.splitScreenDetection) ||
        Boolean(base.blockDevTools) ||
        Boolean(base.blockCopyPaste)
      )
    );
    return { ...base, enabled: isEnabled };
  };

  let activeAntiCheat = getActiveRules();
  const isAntiCheatActive = () => Boolean(activeAntiCheat && activeAntiCheat.enabled);

  const antiCheatTracker = Object.assign({
    tabSwitches: 0,
    fullscreenExits: 0,
    splitScreenDetections: 0,
    devToolsAttempts: 0,
    copyPasteAttempts: 0,
    totalCount: 0,
    violations: []
  }, attemptData?.antiCheat || {}, localState?.antiCheat || {});

  const updateSecurityPill = () => {
    const pill = document.querySelector('#anti-cheat-status-pill');
    if (!pill) return;
    activeAntiCheat = getActiveRules();
    const active = isAntiCheatActive();
    if (!active) {
      pill.className = 'anti-cheat-pill-badge inactive';
      pill.innerHTML = `🛡️ Anti-Cheat Inactive`;
      pill.title = `Proctoring protections are disabled in System Settings.`;
      return;
    }

    const total = (antiCheatTracker.tabSwitches || 0) +
      (antiCheatTracker.fullscreenExits || 0) +
      (antiCheatTracker.splitScreenDetections || 0) +
      (antiCheatTracker.devToolsAttempts || 0) +
      (antiCheatTracker.copyPasteAttempts || 0);

    if (total > 0) {
      pill.className = 'anti-cheat-pill-badge warning';
      pill.innerHTML = `⚠️ Anti-Cheat: ${total} Warning${total === 1 ? '' : 's'}`;
      pill.title = `Proctoring Warnings: ${antiCheatTracker.tabSwitches} Tab Switch, ${antiCheatTracker.fullscreenExits} Fullscreen Exit, ${antiCheatTracker.splitScreenDetections} Split Screen, ${antiCheatTracker.devToolsAttempts} DevTools, ${antiCheatTracker.copyPasteAttempts} Copy/Paste`;
    } else {
      pill.className = 'anti-cheat-pill-badge active';
      pill.innerHTML = `🛡️ Anti-Cheat Active`;
      pill.title = `Active Protections: Tab Switch, Mandatory Fullscreen, Split Screen, DevTools, Copy/Paste`;
    }
  };

  const reportAntiCheatViolation = async (type, message, details = {}) => {
    if (isTerminated || !isAntiCheatActive()) return;
    if (type === 'TAB_SWITCH') antiCheatTracker.tabSwitches = (antiCheatTracker.tabSwitches || 0) + 1;
    else if (type === 'FULLSCREEN_EXIT') antiCheatTracker.fullscreenExits = (antiCheatTracker.fullscreenExits || 0) + 1;
    else if (type === 'SPLIT_SCREEN') antiCheatTracker.splitScreenDetections = (antiCheatTracker.splitScreenDetections || 0) + 1;
    else if (type === 'DEVTOOLS_ATTEMPT') antiCheatTracker.devToolsAttempts = (antiCheatTracker.devToolsAttempts || 0) + 1;
    else if (type === 'COPY_PASTE_ATTEMPT') antiCheatTracker.copyPasteAttempts = (antiCheatTracker.copyPasteAttempts || 0) + 1;

    antiCheatTracker.totalCount = (antiCheatTracker.tabSwitches || 0) +
      (antiCheatTracker.fullscreenExits || 0) +
      (antiCheatTracker.splitScreenDetections || 0) +
      (antiCheatTracker.devToolsAttempts || 0) +
      (antiCheatTracker.copyPasteAttempts || 0);

    updateSecurityPill();
    if (typeof persistProgress === 'function') persistProgress(false);

    try {
      await request(`/api/attempts/${attemptId}/anti-cheat-event`, {
        method: 'POST',
        body: { type, message, details }
      });
    } catch (e) {
      console.warn('Anti-cheat reporting warning:', e.message);
    }
  };

  // 1. Tab Switch Detection
  let lastTabHiddenTime = null;
  let lastTabWarningShown = 0;
  const handleVisibilityChange = () => {
    if (isTerminated || !isAntiCheatActive() || activeAntiCheat.tabSwitchDetection === false) return;
    if (document.hidden) {
      lastTabHiddenTime = Date.now();
    } else {
      if (lastTabHiddenTime && (Date.now() - lastTabHiddenTime > 800) && (Date.now() - lastTabWarningShown > 2500)) {
        lastTabWarningShown = Date.now();
        lastTabHiddenTime = null;
        reportAntiCheatViolation('TAB_SWITCH', 'Candidate switched browser tab or minimized window');

        const warningDiv = document.createElement('div');
        warningDiv.id = 'tab-warning-overlay';
        warningDiv.className = 'fullscreen-lockdown-overlay';
        const currentViolations = (antiCheatTracker.tabSwitches || 1);
        warningDiv.innerHTML = `
          <div class="fullscreen-lockdown-card" style="border-top:6px solid #dc2626">
            <div class="fullscreen-lockdown-icon" style="background:#fee2e2;color:#dc2626">⚠️</div>
            <h2 style="font:700 22px 'Space Grotesk';color:#0f172a;margin:0 0 10px">Anti-Cheat Alert: Tab Switch Detected!</h2>
            <p style="font-size:14px;color:#475569;margin:0 0 16px;line-height:1.5">
              The system detected that you switched browser tabs or minimized the assessment window. This activity has been recorded in the proctoring audit log (Incident #<strong>${currentViolations}</strong>).
            </p>
            <div style="background:#fff7ed;border:1px solid #ffedd5;border-radius:10px;padding:12px;font-size:13px;color:#c2410c;margin-bottom:20px;text-align:left">
              ⓘ Please remain on this assessment tab until all your responses have been submitted.
            </div>
            <button type="button" class="btn-restore-fullscreen" id="btn-ack-tab-warning" style="background:#1e3a8a">
              I Understand &amp; Continue Assessment
            </button>
          </div>
        `;
        document.body.appendChild(warningDiv);
        document.querySelector('#btn-ack-tab-warning')?.addEventListener('click', () => {
          warningDiv.remove();
        });
      }
    }
  };

  // 2. Mandatory Fullscreen Mode
  let fullscreenLockdownEl = null;
  const handleFullscreenChange = () => {
    if (isTerminated || !isAntiCheatActive() || activeAntiCheat.requireFullscreen === false) return;
    if (!document.fullscreenElement) {
      reportAntiCheatViolation('FULLSCREEN_EXIT', 'Candidate exited fullscreen mode');
      if (!fullscreenLockdownEl) {
        fullscreenLockdownEl = document.createElement('div');
        fullscreenLockdownEl.className = 'fullscreen-lockdown-overlay';
        fullscreenLockdownEl.id = 'fullscreen-lockdown-overlay';
        fullscreenLockdownEl.innerHTML = `
          <div class="fullscreen-lockdown-card">
            <div class="fullscreen-lockdown-icon">🔒</div>
            <h2 style="font:700 22px 'Space Grotesk';color:#0f172a;margin:0 0 10px">Mandatory Fullscreen Mode Active</h2>
            <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.5">
              This assessment requires fullscreen mode. You must remain in fullscreen view to see and answer questions.
            </p>
            <button type="button" class="btn-restore-fullscreen" id="btn-enter-fullscreen-again">
              🖥️ Return to Fullscreen Mode
            </button>
          </div>
        `;
        document.body.appendChild(fullscreenLockdownEl);
        document.querySelector('#btn-enter-fullscreen-again')?.addEventListener('click', async () => {
          try {
            if (document.documentElement.requestFullscreen) {
              await document.documentElement.requestFullscreen();
            }
          } catch (e) {
            showToast('Click the screen to allow fullscreen mode', 'info');
          }
        });
      }
    } else {
      if (fullscreenLockdownEl) {
        fullscreenLockdownEl.remove();
        fullscreenLockdownEl = null;
      }
    }
  };

  // Initial Fullscreen Request
  if (isAntiCheatActive() && activeAntiCheat.requireFullscreen !== false) {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}
  }

  // 3. Split Screen Detection
  let splitScreenBannerEl = null;
  let lastSplitReport = 0;
  const handleWindowResize = () => {
    if (isTerminated || !isAntiCheatActive() || activeAntiCheat.splitScreenDetection === false) return;
    const baseW = window.screen.availWidth || window.outerWidth || 1280;
    const baseH = window.screen.availHeight || window.outerHeight || 800;
    const isSplit = (window.innerWidth < baseW * 0.65) || (window.innerHeight < baseH * 0.65);

    if (isSplit) {
      if (!splitScreenBannerEl) {
        splitScreenBannerEl = document.createElement('div');
        splitScreenBannerEl.className = 'anti-cheat-split-screen-banner';
        splitScreenBannerEl.innerHTML = `<span>⚠️</span> <span>Split Screen Detected (&lt; 65% Screen Width). Please maximize your browser window!</span>`;
        document.body.appendChild(splitScreenBannerEl);
      }
      if (Date.now() - lastSplitReport > 12000) {
        lastSplitReport = Date.now();
        reportAntiCheatViolation('SPLIT_SCREEN', `Split screen detected: ${window.innerWidth}x${window.innerHeight} vs ${baseW}x${baseH}`);
      }
    } else {
      if (splitScreenBannerEl) {
        splitScreenBannerEl.remove();
        splitScreenBannerEl = null;
      }
    }
  };

  // 4. Block DevTools & Shortcuts
  const handleKeyDownSecurity = (e) => {
    if (isTerminated || !isAntiCheatActive()) return;

    if (activeAntiCheat.blockDevTools !== false) {
      const isF12 = e.key === 'F12' || e.keyCode === 123;
      const isCtrlShiftI = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c');
      const isCtrlU = (e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U');
      if (isF12 || isCtrlShiftI || isCtrlU) {
        e.preventDefault();
        e.stopPropagation();
        showToast('🚫 Developer Tools access (F12 / Inspect) is disabled for assessment integrity.', 'warning');
        reportAntiCheatViolation('DEVTOOLS_ATTEMPT', `Blocked shortcut: ${e.key || e.keyCode}`);
        return false;
      }
    }

    if (activeAntiCheat.blockCopyPaste !== false) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V' || e.key === 'x' || e.key === 'X' || e.key === 'a' || e.key === 'A')) {
        const isTextarea = e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT');
        if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          e.stopPropagation();
          showToast('Pasting text is disabled. Please type your responses independently.', 'warning');
          reportAntiCheatViolation('COPY_PASTE_ATTEMPT', 'Blocked paste keyboard shortcut');
          return false;
        }
        if (!isTextarea && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X' || e.key === 'a' || e.key === 'A')) {
          e.preventDefault();
          e.stopPropagation();
          showToast('Copying question text is disabled for assessment integrity.', 'warning');
          reportAntiCheatViolation('COPY_PASTE_ATTEMPT', 'Blocked copy keyboard shortcut');
          return false;
        }
      }
    }
  };

  // 5. Block Copy/Paste & Context Menu
  const handleContextMenuSecurity = (e) => {
    if (isTerminated || !isAntiCheatActive() || activeAntiCheat.blockCopyPaste === false) return;
    e.preventDefault();
    showToast('Right-click context menu is disabled during the assessment.', 'warning');
    reportAntiCheatViolation('COPY_PASTE_ATTEMPT', 'Right click context menu blocked');
  };

  const handleCopySecurity = (e) => {
    if (isTerminated || !isAntiCheatActive() || activeAntiCheat.blockCopyPaste === false) return;
    e.preventDefault();
    showToast('Copying text is disabled for assessment integrity.', 'warning');
    reportAntiCheatViolation('COPY_PASTE_ATTEMPT', 'Text copy blocked');
  };

  const handleCutSecurity = (e) => {
    if (isTerminated || !isAntiCheatActive() || activeAntiCheat.blockCopyPaste === false) return;
    e.preventDefault();
    showToast('Cutting text is disabled.', 'warning');
    reportAntiCheatViolation('COPY_PASTE_ATTEMPT', 'Text cut blocked');
  };

  const handlePasteSecurity = (e) => {
    if (isTerminated || !isAntiCheatActive() || activeAntiCheat.blockCopyPaste === false) return;
    e.preventDefault();
    showToast('Pasting text is disabled. Please type your responses independently.', 'warning');
    reportAntiCheatViolation('COPY_PASTE_ATTEMPT', 'Text paste blocked');
  };

  // Attach Security Event Listeners
  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  window.addEventListener('resize', handleWindowResize);
  window.addEventListener('keydown', handleKeyDownSecurity, true);
  document.addEventListener('contextmenu', handleContextMenuSecurity, true);
  document.addEventListener('copy', handleCopySecurity, true);
  document.addEventListener('cut', handleCutSecurity, true);
  document.addEventListener('paste', handlePasteSecurity, true);

  const cleanupAntiCheat = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    window.removeEventListener('resize', handleWindowResize);
    window.removeEventListener('keydown', handleKeyDownSecurity, true);
    document.removeEventListener('contextmenu', handleContextMenuSecurity, true);
    document.removeEventListener('copy', handleCopySecurity, true);
    document.removeEventListener('cut', handleCutSecurity, true);
    document.removeEventListener('paste', handlePasteSecurity, true);
    if (fullscreenLockdownEl) { fullscreenLockdownEl.remove(); fullscreenLockdownEl = null; }
    if (splitScreenBannerEl) { splitScreenBannerEl.remove(); splitScreenBannerEl = null; }
    const warningDiv = document.querySelector('#tab-warning-overlay');
    if (warningDiv) warningDiv.remove();
    realtime.off('TIME_EXTENDED', handleTimeExtended);
    realtime.off('FORCE_SUBMIT', handleForceSubmit);
    realtime.off('ATTEMPT_DELETED', handleCandidateAttemptDeleted);
  };

  const handleAttemptDeleted = () => {
    if (isTerminated) return;
    isTerminated = true;

    cleanupAntiCheat();

    if (timerTimeoutId) clearTimeout(timerTimeoutId);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);

    window.removeEventListener('beforeunload', handlePageUnload);
    window.removeEventListener('pagehide', handlePageUnload);

    stopMedia().catch(() => {});

    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      const prefix = `assessify_autosave_${userEmail}`;
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {}

    const modalContainer = document.querySelector('#modal-root') || document.body;
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="attempt-deleted-modal" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.75);z-index:99999;backdrop-filter:blur(6px)">
        <div class="modal-card" role="dialog" aria-modal="true" style="max-width:480px;background:#ffffff;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden;padding:0;text-align:center">
          <div style="padding:32px 28px 24px">
            <div style="width:60px;height:60px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:26px;margin:0 auto 16px">
              ${ICONS.trash}
            </div>
            <h2 style="font:700 22px 'Space Grotesk';color:#0f172a;margin:0 0 10px">Assessment Session Terminated</h2>
            <p style="font-size:14px;color:#64748b;margin:0 0 16px;line-height:1.6">
              Your candidate assessment record (<strong style="color:#0f172a">${attemptId}</strong>) has been removed or reset by an administrator.
            </p>
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 16px;font-size:13px;color:#991b1b;text-align:left;line-height:1.5">
              The test record and timer have been stopped. Ongoing responses or recordings have been discontinued.
            </div>
          </div>
          <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;display:flex;justify-content:center">
            <button class="button" id="btn-return-home" type="button" style="background:#2563eb;color:#ffffff;padding:10px 24px;font-size:14px;font-weight:600;border-radius:8px">
              Return to Candidate Home →
            </button>
          </div>
        </div>
      </div>
    `;

    document.querySelector('#btn-return-home')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      renderTeacher(test, user);
    });
  };

  const updateSaveIndicator = (status = 'saved') => {
    if (isTerminated) return;
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
    if (isTerminated) return;
    // 1. Instantly save to local device storage (protects against browser crash, power loss, or tab close)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        attemptId,
        userEmail,
        answers,
        grammarVocabularyOrder: candidateOrder || attemptData?.grammarVocabularyOrder || localState?.grammarVocabularyOrder,
        sectionIndex,
        speakingStep,
        sectionStartTimes,
        sectionEndTimes,
        sectionRemainingMs,
        antiCheat: antiCheatTracker,
        savedAt: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // 2. Sync with database
    const syncServer = async () => {
      if (isTerminated) return;
      updateSaveIndicator('saving');
      try {
        const payload = {
          responses: answers,
          writing: answers['writing-essay'] || answers['writing-0'] || answers['writing'] || '',
          sectionIndex,
          speakingStep,
          sectionStartTimes,
          sectionRemainingMs,
          sectionEndTimes,
          antiCheat: antiCheatTracker
        };
        const res = await fetch(`/api/attempts/${attemptId}/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.status === 404) {
          handleAttemptDeleted();
          return;
        }
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
    if (isTerminated) return;
    try {
      if (sectionEndTimes[sectionIndex]) {
        sectionRemainingMs[sectionIndex] = Math.max(0, Number(sectionEndTimes[sectionIndex]) - Date.now());
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        attemptId,
        userEmail,
        answers,
        grammarVocabularyOrder: candidateOrder || attemptData?.grammarVocabularyOrder || localState?.grammarVocabularyOrder,
        sectionIndex,
        speakingStep,
        sectionStartTimes,
        sectionEndTimes,
        sectionRemainingMs,
        antiCheat: antiCheatTracker,
        savedAt: new Date().toISOString()
      }));
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({
          responses: answers,
          writing: answers['writing-essay'] || answers['writing-0'] || answers['writing'] || '',
          sectionIndex,
          speakingStep,
          sectionStartTimes,
          sectionRemainingMs,
          sectionEndTimes,
          antiCheat: antiCheatTracker
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
    try {
      if (mediaRecorder.state === 'recording') {
        try { mediaRecorder.requestData(); } catch { }
      }
      mediaRecorder.stop();
    } catch { resolve(); }
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
      <div class="teacher-shell submission-shell" style="max-width:620px;margin:60px auto">
        <div class="grading-pipeline-container">
          <div style="text-align:center">
            <div style="width:52px;height:52px;border-radius:50%;background:#eff6ff;color:#2563eb;display:grid;place-items:center;font-size:26px;margin:0 auto 16px">⚡</div>
            <h2 style="font:700 22px 'Space Grotesk';margin:0 0 8px;color:var(--ink)">Submitting Assessment Responses</h2>
            <p style="color:var(--muted);font-size:13.5px;margin:0">Live real-time grading and media upload pipeline</p>
          </div>
          <div class="grading-pipeline-steps" id="grading-pipeline-steps">
            <div class="grading-step-row active" id="g-step-1">
              <div class="grading-step-icon">⏳</div>
              <div style="flex:1;font-size:13.5px;font-weight:600">Securing exam responses and media buffer in database...</div>
            </div>
            <div class="grading-step-row" id="g-step-2">
              <div class="grading-step-icon">○</div>
              <div style="flex:1;font-size:13.5px;font-weight:600">Securing cloud archive in Google Drive...</div>
            </div>
            <div class="grading-step-row" id="g-step-3">
              <div class="grading-step-icon">○</div>
              <div style="flex:1;font-size:13.5px;font-weight:600">Calculating Grammar & Vocabulary CEFR benchmark...</div>
            </div>
            <div class="grading-step-row" id="g-step-4">
              <div class="grading-step-icon">○</div>
              <div style="flex:1;font-size:13.5px;font-weight:600">Evaluating Writing Task Response, Coherence & Lexical Resource...</div>
            </div>
            <div class="grading-step-row" id="g-step-5">
              <div class="grading-step-icon">○</div>
              <div style="flex:1;font-size:13.5px;font-weight:600">Finalizing CEFR & IELTS placement assessment...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const onGradingProgress = (ev) => {
      const stageNum = ev.stage;
      for (let s = 1; s <= 5; s++) {
        const row = document.querySelector(`#g-step-${s}`);
        if (!row) continue;
        if (s < stageNum || (s === stageNum && ev.status === 'completed')) {
          row.className = 'grading-step-row completed';
          const icon = row.querySelector('.grading-step-icon');
          if (icon) icon.textContent = '✓';
        } else if (s === stageNum) {
          row.className = 'grading-step-row active';
          const icon = row.querySelector('.grading-step-icon');
          if (icon) icon.textContent = '⏳';
        }
      }
    };
    realtime.on('GRADING_PROGRESS', onGradingProgress);

    await stopMedia();
    speakingRecordingState = 'stopped';
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
        earlyTermination: Boolean(isEarlyEnd),
        antiCheat: antiCheatTracker
      })
    });

    cleanupAntiCheat();
    realtime.off('GRADING_PROGRESS', onGradingProgress);

    if (result?.error) {
      if (result.error === 'Attempt not found' || result.attemptDeleted) {
        handleAttemptDeleted();
        return;
      }
      showToast(result.error, 'error');
      const nextBtn = document.querySelector('#next');
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Submit responses';
      }
      return;
    }

    // Brief pause to allow candidate to see completed pipeline status
    await new Promise((resolve) => setTimeout(resolve, 600));

    app.innerHTML = `
      <div class="teacher-shell submission-shell" style="max-width:680px;margin:50px auto;text-align:center">
        <div class="panel submission-panel" style="padding:48px 36px">
          <div style="width:64px;height:64px;border-radius:50%;background:#dcfce7;color:#16a34a;display:grid;place-items:center;font-size:32px;margin:0 auto 20px">✓</div>
          <h1 style="font:700 34px 'Space Grotesk';margin:0 0 12px;color:var(--ink)">Assessment Submitted!</h1>
          <p style="color:var(--muted);line-height:1.6;font-size:15px;margin-bottom:20px">
            Your placement responses have been securely recorded. Grammar & Vocabulary is scored automatically, and your Writing and Speaking (including auditory prompt comprehension) submissions are queued for admin rubric review.
          </p>
          ${isEarlyEnd ? `
            <div style="display:flex;justify-content:center;margin:0 auto 24px;width:100%">
              <span class="notice-pill notice-pill-danger">
                ⚠️ Notice: Speaking test was concluded early by examiner
              </span>
            </div>
          ` : ''}
          ${isAutoTimeLimit ? `
            <div style="display:flex;justify-content:center;margin:0 auto 24px;width:100%">
              <span class="notice-pill notice-pill-warning">
                ⏱ Notice: Concluded automatically at 15-minute time limit
              </span>
            </div>
          ` : ''}
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
    const nextSec = test.sections[sectionIndex];
    if (nextSec && sectionRemainingMs[sectionIndex] === undefined) {
      const nextDur = sectionDurations[nextSec.id] || (nextSec.durationMinutes || 15) * 60 * 1000;
      sectionRemainingMs[sectionIndex] = nextDur;
      sectionEndTimes[sectionIndex] = Date.now() + nextDur;
    }
    persistProgress(true);
    draw();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startSectionTimer = () => {
    if (timerTimeoutId) clearTimeout(timerTimeoutId);
    const currSec = section();
    if (!currSec) return;

    const defaultDur = sectionDurations[currSec.id] || (currSec.durationMinutes || 15) * 60 * 1000;

    // Check if we have remaining time saved from before (resume scenario)
    let remaining = sectionRemainingMs[sectionIndex];
    if (isResume && typeof remaining === 'number' && !isNaN(remaining) && remaining > 0) {
      // User is resuming with remaining time
      if (sectionEndTimes[sectionIndex]) {
        const wallClockLeft = sectionEndTimes[sectionIndex] - Date.now();
        if (wallClockLeft > 0 && wallClockLeft <= remaining) {
          remaining = wallClockLeft;
        }
      }
      remaining = Math.min(remaining, defaultDur);
      sectionEndTimes[sectionIndex] = Date.now() + remaining;
      sectionRemainingMs[sectionIndex] = remaining;
    } else if (isResume && remaining === 0) {
      remaining = 0;
      sectionEndTimes[sectionIndex] = Date.now();
    } else {
      // First time starting this section (or fresh test after deletion)
      remaining = defaultDur;
      sectionEndTimes[sectionIndex] = Date.now() + remaining;
      sectionRemainingMs[sectionIndex] = remaining;
    }

    // Persist immediately on timer start
    persistProgress(false);

    let lastTickSave = Date.now();

    const tick = () => {
      if (isTerminated) return;
      const end = sectionEndTimes[sectionIndex];
      const now = Date.now();
      const left = Math.max(0, end - now);
      sectionRemainingMs[sectionIndex] = left;

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

      // Periodically update local storage every 5 seconds so tab close/refresh has up-to-date remaining time
      if (now - lastTickSave >= 5000) {
        lastTickSave = now;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            attemptId,
            userEmail,
            answers,
            grammarVocabularyOrder: candidateOrder || attemptData?.grammarVocabularyOrder || localState?.grammarVocabularyOrder,
            sectionIndex,
            speakingStep,
            sectionEndTimes,
            sectionRemainingMs,
            savedAt: new Date().toISOString()
          }));
        } catch { }
      }

      if (left <= 0) {
        const secName = currSec.label || currSec.title || (
          currSec.id === 'grammar-vocabulary' ? 'Grammar & Vocabulary' :
          currSec.id === 'writing' ? 'Writing' : 'Speaking'
        );
        if (sectionIndex < test.sections.length - 1) {
          showToast(`Time limit reached for ${secName}. Advancing to next section...`, 'info', 4500);
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
    if (isTerminated) return;
    const current = section() || {};
    const currentLabel = current.label || current.title || (
      current.id === 'grammar-vocabulary' ? 'Grammar & Vocabulary Placement Test' :
      current.id === 'writing' ? 'Writing Placement Test' :
      current.id === 'speaking' ? 'Oral Placement Test' :
      'Assessment Section'
    );
    const speaking = current.id === 'speaking' || (current.label && current.label.toLowerCase().includes('speaking')) || currentLabel.toLowerCase().includes('speaking');
    const isLastSection = sectionIndex === test.sections.length - 1;

    let contentHtml = '';
    if (speaking) {
      const activePrompt = current.questions[speakingStep] || current.questions[0];
      contentHtml = `
        <div class="speaking-flow-container">
          <!-- 1. Camera Monitor Card (Teacher / Examiner Recording Station) ON TOP -->
          <div class="camera-monitor-card" style="background:#0f172a;border-radius:14px;padding:20px;margin-bottom:20px;box-shadow:0 8px 24px rgba(0,0,0,0.15)">
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
                  <span class="pill-dot" style="background:#fff;animation:pulse-dot 1s infinite"></span> Recording in progress
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
                  ${speakingRecordingState === 'idle' ? 'Camera & Mic Ready — Click Start Recording to record answer' : (speakingRecordingState === 'recording' ? '● Recording candidate response…' : '✓ Recording completed (auto-saved on submission)')}
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

          <!-- 2. Listening Stepper Chips AT THE BOTTOM OF THE CAMERA -->
          <div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <span style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;display:flex;align-items:center;gap:6px">
                🎧 Listening Parts:
              </span>
              <span style="font-size:12.5px;font-weight:600;color:var(--blue)">
                Part ${speakingStep + 1} of ${current.questions.length}
              </span>
            </div>
            <div class="speaking-stepper" style="margin-bottom:0">
              ${current.questions.map((q, idx) => `
                <div class="speaking-step-chip ${idx === speakingStep ? 'active' : (idx < speakingStep ? 'completed' : '')}" data-step="${idx}" role="button" tabindex="0" title="Go to Part ${idx + 1}">
                  <span class="step-num">${idx < speakingStep ? '✓' : idx + 1}</span>
                  <span>Part ${idx + 1}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 3. Listening Audio Prompt Card (NO QUESTION TEXT) -->
          <div class="speaking-audio-prompt-card" style="background:#ffffff;border:1.5px solid #e2e8f0;border-radius:14px;padding:22px;margin-bottom:20px;box-shadow:0 4px 16px rgba(0,0,0,0.04)">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #f1f5f9">
              <div style="display:flex;align-items:center;gap:10px">
                <span class="eyebrow" style="font-size:13px;font-weight:700;color:#1e40af">Listening Prompt ${speakingStep + 1} of ${current.questions.length}</span>
                <span class="attempt-pill" style="background:#f0fdf4;color:#166534;border:1px solid #bbf7d0">Part ${speakingStep + 1}</span>
              </div>
              <span style="font-size:12px;background:#f1f5f9;color:#475569;padding:4px 12px;border-radius:20px;font-weight:600;display:inline-flex;align-items:center;gap:5px">
                🎧 Listening Only · No Written Text
              </span>
            </div>

            <!-- Focused Listening Audio Centerpiece (Audio Only, No Written Question) -->
            <div style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;padding:26px 20px;text-align:center;margin-bottom:20px">
              <div style="width:54px;height:54px;border-radius:50%;background:#eff6ff;color:#2563eb;display:grid;place-items:center;font-size:24px;margin:0 auto 12px">
                ${ICONS.volume2}
              </div>
              <h3 style="font:700 17px 'Space Grotesk';margin:0 0 6px;color:var(--ink)">
                Spoken Audio Prompt (Listening Only)
              </h3>
              <p style="font-size:13px;color:var(--muted);margin:0 0 18px;max-width:520px;margin-left:auto;margin-right:auto;line-height:1.5">
                Listen carefully to the spoken prompt. The question text is not displayed so candidates rely on listening comprehension. Candidates respond orally.
              </p>

              <div style="display:flex;justify-content:center;align-items:center;gap:12px;flex-wrap:wrap">
                <button class="button" id="play-speaking-prompt-btn" data-text="${(activePrompt.audioScript || activePrompt.prompt).replaceAll('"', '&quot;')}" type="button" style="background:#16a34a;color:#fff;padding:12px 26px;font-size:14.5px;font-weight:600;border-radius:10px;display:inline-flex;align-items:center;gap:10px;box-shadow:0 4px 12px rgba(22,163,74,0.25)">
                  ${ICONS.volume2} <span id="play-speaking-btn-text">Play Spoken Prompt</span>
                </button>
              </div>
              <div id="speaking-audio-status" style="font-size:12.5px;color:#64748b;margin-top:12px;font-weight:500">
                Click button above to hear Part ${speakingStep + 1}
              </div>
            </div>

            <!-- Navigation between Parts & Early End -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding-top:14px;border-top:1px solid #f1f5f9">
              <button class="button" id="end-early-btn" type="button" style="background:#b91c1c;color:#fff;padding:9px 18px;font-size:13px;display:inline-flex;align-items:center;gap:6px">
                <span>⏹ End Test Early (Student Unable to Continue)</span>
              </button>

              <div style="display:flex;gap:10px;align-items:center;margin-left:auto">
                ${speakingStep > 0 ? `
                  <button class="ghost" id="speaking-prev-prompt-btn" type="button" style="padding:9px 18px;font-size:13px">
                    ← Previous Part
                  </button>
                ` : ''}

                ${speakingStep < current.questions.length - 1 ? `
                  <button class="button" id="speaking-next-prompt-btn" type="button" style="padding:10px 22px">
                    <span>Next Part</span> <span aria-hidden="true">→</span>
                  </button>
                ` : `
                  <span style="font-size:13px;color:#16a34a;font-weight:600;display:inline-flex;align-items:center;gap:6px">
                    ✓ Final Part Reached
                  </span>
                `}
              </div>
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
    const hasOptions = !speaking && current.questions && current.questions.length > 0 && current.questions[0].options;
    const answeredCount = hasOptions
      ? current.questions.filter((q) => answers[q.id] && String(answers[q.id]).trim() !== '').length
      : 0;

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
          <div style="display:flex;align-items:center;gap:10px">
            <div id="anti-cheat-status-pill" class="anti-cheat-pill-badge ${isAntiCheatActive() ? 'active' : 'inactive'}" title="${isAntiCheatActive() ? 'Anti-Cheat Protections Active' : 'Anti-Cheat Protections Inactive'}">
              🛡️ Anti-Cheat ${isAntiCheatActive() ? 'Active' : 'Inactive'}
            </div>
            <div id="autosave-indicator" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#16a34a;background:#f0fdf4;padding:6px 14px;border-radius:20px;border:1px solid #bbf7d0;box-shadow:0 1px 3px rgba(0,0,0,0.05);transition:all 0.2s ease">
              ${ICONS.check} <span>All answers saved</span>
            </div>
          </div>
        </div>

        <section class="hero">
          <div>
            <div class="eyebrow">Section ${sectionIndex + 1} of ${test.sections.length}</div>
            <h1>${currentLabel}</h1>
            <p>${current.instructions || 'Answer all questions carefully before proceeding.'}</p>
          </div>
          <div class="hero-note" id="timer-box">
            <strong id="timer">--:--</strong>
            <span id="timer-subtitle">${currentLabel} Remaining</span>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>${currentLabel} ${speaking ? 'Interview' : 'Questions'}</h2>
            <span class="status" id="section-status-counter">
              ${hasOptions ? `<strong id="live-answered-count" style="color:${answeredCount === current.questions.length ? '#16a34a' : 'var(--blue)'};font-weight:700">${answeredCount}/${current.questions.length} answered</strong> · ` : ''}
              ${current.questions.length} ${speaking ? 'interview prompts' : 'questions'} · ${current.durationMinutes} mins allocated
            </span>
          </div>

          ${contentHtml}

          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:28px;padding-top:20px;border-top:1px solid var(--line);flex-wrap:wrap">
            <button class="ghost" id="previous" ${sectionIndex === 0 || speaking ? 'hidden' : ''} type="button">
              ← Previous Section
            </button>
            <div style="display:flex;gap:10px;align-items:center;margin-left:auto">
              <button class="ghost" id="bottom-scroll-top" type="button" style="padding:10px 18px;font-size:13.5px;display:inline-flex;align-items:center;gap:6px" title="Scroll back to top of questions">
                <span>↑ Scroll to Top</span>
              </button>
              <button class="button" id="next" type="button" style="padding:12px 24px">
                ${isLastSection ? 'Submit Assessment ✓' : 'Next Section →'}
              </button>
            </div>
          </div>
        </section>

        <!-- Floating Action Button for Auto Scroll to Top -->
        <button id="btn-scroll-top" class="btn-scroll-top" type="button" title="Scroll to top of questions" aria-label="Scroll to top">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
          <span>Top</span>
        </button>
      </div>
    `;

    updateSecurityPill();

    document.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.addEventListener('change', () => {
        answers[input.name] = input.value;
        const parentTiles = input.closest('.options-container')?.querySelectorAll('.option-tile');
        parentTiles?.forEach((tile) => tile.classList.remove('selected'));
        input.closest('.option-tile')?.classList.add('selected');

        // Clear unanswered error highlight on this question
        const qWrap = input.closest('.question');
        if (qWrap) {
          qWrap.classList.remove('unanswered-highlight');
          qWrap.querySelector('.unanswered-badge')?.remove();
        }

        // Live update the answered count in panel header
        const countEl = document.querySelector('#live-answered-count');
        if (countEl && current.questions) {
          const c = current.questions.filter((q) => answers[q.id] && String(answers[q.id]).trim() !== '').length;
          countEl.textContent = `${c}/${current.questions.length} answered`;
          countEl.style.color = c === current.questions.length ? '#16a34a' : 'var(--blue)';
        }

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
      const audioStatusEl = document.querySelector('#speaking-audio-status');
      const audioBtnTextEl = document.querySelector('#play-speaking-btn-text');
      if (playSpeakingBtn) {
        playSpeakingBtn.onclick = () => {
          const textToSpeak = playSpeakingBtn.dataset.text || activePrompt.prompt;
          playSpeakingBtn.disabled = true;
          if (audioBtnTextEl) audioBtnTextEl.textContent = 'Playing Spoken Prompt…';
          playSpeakingBtn.style.background = '#fef3c7';
          playSpeakingBtn.style.color = '#92400e';
          if (audioStatusEl) {
            audioStatusEl.textContent = `🔊 Playing Part ${speakingStep + 1} audio prompt...`;
            audioStatusEl.style.color = '#2563eb';
          }
          speakQuestionAudio(
            textToSpeak,
            speakingStep,
            null,
            () => {
              playSpeakingBtn.disabled = false;
              if (audioBtnTextEl) audioBtnTextEl.textContent = 'Replay Spoken Prompt';
              playSpeakingBtn.style.background = '#16a34a';
              playSpeakingBtn.style.color = '#fff';
              if (audioStatusEl) {
                audioStatusEl.textContent = `✓ Audio finished. Click to replay Part ${speakingStep + 1}.`;
                audioStatusEl.style.color = '#16a34a';
              }
            },
            () => {
              playSpeakingBtn.disabled = false;
              if (audioBtnTextEl) audioBtnTextEl.textContent = 'Play Spoken Prompt';
              playSpeakingBtn.style.background = '#16a34a';
              playSpeakingBtn.style.color = '#fff';
              if (audioStatusEl) {
                audioStatusEl.textContent = `Click button above to hear Part ${speakingStep + 1}`;
                audioStatusEl.style.color = '#64748b';
              }
            }
          );
        };
      }

      // Step chip click handlers
      document.querySelectorAll('.speaking-step-chip').forEach((chip) => {
        chip.onclick = () => {
          const step = Number(chip.dataset.step);
          if (!isNaN(step) && step >= 0 && step < current.questions.length) {
            speakingStep = step;
            persistProgress(true);
            draw();
          }
        };
      });

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

      const prevPromptBtn = document.querySelector('#speaking-prev-prompt-btn');
      if (prevPromptBtn) {
        prevPromptBtn.onclick = () => {
          speakingStep = Math.max(speakingStep - 1, 0);
          persistProgress(true);
          draw();
        };
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

    // Scroll to Top Handlers
    const scrollTopBtn = document.querySelector('#btn-scroll-top');
    const bottomScrollBtn = document.querySelector('#bottom-scroll-top');
    const handleScrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    scrollTopBtn?.addEventListener('click', handleScrollToTop);
    bottomScrollBtn?.addEventListener('click', handleScrollToTop);

    const onWindowScroll = () => {
      const btn = document.querySelector('#btn-scroll-top');
      if (!btn) return;
      if (window.scrollY > 220) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    };
    window.removeEventListener('scroll', onWindowScroll);
    window.addEventListener('scroll', onWindowScroll, { passive: true });

    document.querySelector('#previous')?.addEventListener('click', async () => {
      await stopMedia();
      sectionIndex -= 1;
      speakingStep = 0;
      persistProgress(true);
      draw();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.querySelector('#next').onclick = async () => {
      // Validation before advancing to next section
      const currSec = section();
      if (currSec && !speaking) {
        // Multiple-choice questions validation (e.g., Grammar & Vocabulary)
        if (currSec.questions && currSec.questions.length > 0 && currSec.questions[0].options) {
          const unanswered = [];
          currSec.questions.forEach((q, idx) => {
            const val = answers[q.id];
            if (!val || String(val).trim() === '') {
              unanswered.push({ q, number: idx + 1 });
            }
          });

          if (unanswered.length > 0) {
            // Clear previous error highlights
            document.querySelectorAll('.question.unanswered-highlight').forEach((el) => {
              el.classList.remove('unanswered-highlight');
              el.querySelector('.unanswered-badge')?.remove();
            });

            // Highlight all unanswered questions
            unanswered.forEach(({ q, number }) => {
              const wrap = document.querySelector(`#q-wrap-${q.id}`);
              if (wrap) {
                wrap.classList.add('unanswered-highlight');
                if (!wrap.querySelector('.unanswered-badge')) {
                  const badge = document.createElement('span');
                  badge.className = 'unanswered-badge';
                  badge.innerHTML = `⚠️ Number ${number} is not answered yet`;
                  wrap.prepend(badge);
                }
              }
            });

            // Auto-scroll to the first unanswered question
            const firstUnfilled = document.querySelector(`#q-wrap-${unanswered[0].q.id}`);
            if (firstUnfilled) {
              firstUnfilled.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            const count = unanswered.length;
            const sampleNums = unanswered.slice(0, 6).map((u) => `#${u.number}`).join(', ');
            const moreStr = count > 6 ? ` and ${count - 6} more` : '';
            showToast(`⚠️ Please complete all questions before proceeding! ${count} question${count === 1 ? '' : 's'} still not answered: ${sampleNums}${moreStr}.`, 'error');
            return;
          }
        } else if (currSec.id === 'writing' || currSec.label?.toLowerCase().includes('writing')) {
          // Writing section validation
          const essayText = answers['writing-essay'] || answers['writing-0'] || answers['writing'] || '';
          const wordCount = essayText.trim() ? essayText.trim().split(/\s+/).filter(Boolean).length : 0;
          if (wordCount < 10) {
            const essayInput = document.querySelector('#writing-essay') || document.querySelector('.writing-input');
            if (essayInput) {
              essayInput.focus();
              essayInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
              essayInput.style.borderColor = '#ef4444';
              essayInput.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.15)';
            }
            showToast('⚠️ Please write your essay response before proceeding to the next section.', 'error');
            return;
          }
        }
      }

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

  // Live real-time heartbeat and candidate presence telemetry
  heartbeatInterval = setInterval(async () => {
    if (isTerminated || !document.querySelector('.test-screen')) {
      clearInterval(heartbeatInterval);
      return;
    }
    try {
      const curSection = section();
      const currentRemainingMs = sectionEndTimes[sectionIndex]
        ? Math.max(0, Number(sectionEndTimes[sectionIndex]) - Date.now())
        : (sectionRemainingMs[sectionIndex] || 0);

      // Send telemetry to real-time proctoring presence
      fetch('/api/realtime/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          sectionIndex,
          sectionName: curSection?.title || curSection?.label || `Section ${sectionIndex + 1}`,
          answeredCount: Object.keys(answers || {}).length,
          totalQuestions: curSection?.questions?.length || (sectionIndex === 0 ? 25 : (sectionIndex === 1 ? 2 : 1)),
          remainingMs: currentRemainingMs,
          antiCheat: antiCheatTracker
        })
      }).catch(() => {});

      const res = await fetch(`/api/attempts/${attemptId}/status`);
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        clearInterval(heartbeatInterval);
        if (res.status === 404) {
          handleAttemptDeleted();
        }
        return;
      }
      if (res.status === 200) {
        const sData = await res.json();
        if (sData && sData.antiCheat) {
          if (!window.assessifySettings) window.assessifySettings = {};
          window.assessifySettings.antiCheat = sData.antiCheat.rules || sData.antiCheat;
          activeAntiCheat = getActiveRules();
          updateSecurityPill();
        }
      }
    } catch {}
  }, 4000);
}

const getStoredAdminTab = () => {
  const hash = window.location.hash.replace('#', '').trim();
  if (['results', 'users', 'bulk-users', 'questions', 'rubrics', 'audit', 'settings'].includes(hash)) return hash;
  const stored = localStorage.getItem('assessify_admin_tab');
  if (['results', 'users', 'bulk-users', 'questions', 'rubrics', 'audit', 'settings'].includes(stored)) return stored;
  return 'results';
};

const adminState = {
  activeTab: getStoredAdminTab(),
  stagedQuestions: null,
  stagedRubrics: null
};

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '').trim();
  if (['live', 'results', 'users', 'bulk-users', 'questions', 'rubrics', 'audit', 'settings'].includes(hash) && adminState.activeTab !== hash) {
    renderAdmin(hash);
  }
});

async function renderAdmin(tab) {
  if (!tab || !['live', 'results', 'users', 'bulk-users', 'questions', 'rubrics', 'audit', 'settings'].includes(tab)) {
    tab = getStoredAdminTab();
  }
  adminState.activeTab = tab;
  localStorage.setItem('assessify_admin_tab', tab);
  if (window.location.hash !== `#${tab}`) {
    history.replaceState(null, '', `#${tab}`);
  }

  document.body.classList.add('has-admin-sidebar');
  const topbarBurger = document.querySelector('#sidebar-burger');
  if (topbarBurger) topbarBurger.hidden = false;

  // Render base shell with sidebar and backdrop
  app.innerHTML = `
    <div class="admin-shell">
      <div class="sidebar-backdrop" id="sidebar-backdrop" aria-hidden="true"></div>
      <aside class="admin-sidebar" id="admin-sidebar" aria-label="Admin Navigation">
        <div class="sidebar-mobile-header">
          <div class="sidebar-mobile-title">
            <span class="sidebar-mobile-badge">Assessify</span>
          </div>
          <button class="sidebar-close-btn" id="sidebar-close-btn" type="button" aria-label="Close navigation menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="sidebar-sections-wrapper">
          <!-- Main Menu -->
          <div class="sidebar-section">
            <div class="sidebar-title">Main Menu</div>
            <nav class="sidebar-nav">
              <button class="sidebar-btn ${tab === 'live' ? 'active' : ''}" id="nav-live" type="button">
                <span class="sidebar-icon">${ICONS.eye}</span>
                <span>Live Proctoring</span>
                <span class="sidebar-badge" style="background:#10b981;color:#fff;display:inline-flex;align-items:center;gap:4px">
                  <span style="width:6px;height:6px;border-radius:50%;background:#fff;animation:pulseLiveDot 1.5s infinite"></span>
                  Live
                </span>
              </button>
              <button class="sidebar-btn ${tab === 'results' ? 'active' : ''}" id="nav-results" type="button">
                <span class="sidebar-icon">${ICONS.results}</span>
                <span>Candidate Results</span>
              </button>
            </nav>
          </div>

          <!-- Academic & Content -->
          <div class="sidebar-section" style="border-top:1px solid var(--line);padding-top:16px">
            <div class="sidebar-title">Academic & Content</div>
            <nav class="sidebar-nav">
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

          <!-- User Management -->
          <div class="sidebar-section" style="border-top:1px solid var(--line);padding-top:16px">
            <div class="sidebar-title">User Management</div>
            <nav class="sidebar-nav">
              <button class="sidebar-btn ${tab === 'users' ? 'active' : ''}" id="nav-users" type="button">
                <span class="sidebar-icon">${ICONS.users}</span>
                <span>User Manager</span>
              </button>
              <button class="sidebar-btn ${tab === 'bulk-users' ? 'active' : ''}" id="nav-bulk-users" type="button">
                <span class="sidebar-icon">${ICONS.upload}</span>
                <span>Bulk Import Users</span>
              </button>
            </nav>
          </div>

          <!-- Security -->
          <div class="sidebar-section" style="border-top:1px solid var(--line);padding-top:16px">
            <div class="sidebar-title">Security</div>
            <nav class="sidebar-nav">
              <button class="sidebar-btn ${tab === 'audit' ? 'active' : ''}" id="nav-audit" type="button">
                <span class="sidebar-icon">${ICONS.shield}</span>
                <span>Audit Log</span>
              </button>
            </nav>
          </div>

          <!-- System -->
          <div class="sidebar-section" style="border-top:1px solid var(--line);padding-top:16px">
            <div class="sidebar-title">System</div>
            <nav class="sidebar-nav">
              <button class="sidebar-btn ${tab === 'settings' ? 'active' : ''}" id="nav-settings" type="button">
                <span class="sidebar-icon">${ICONS.settings}</span>
                <span>System Setting</span>
              </button>
            </nav>
          </div>
        </div>
        <div class="sidebar-footer">
          <div>English Assessment</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">Version: <strong>2026.1</strong></div>
        </div>
      </aside>
      <main class="admin-main" id="admin-content">
        <p style="color:var(--muted)">Loading workspace…</p>
      </main>
    </div>
  `;

  const closeMobileSidebar = () => {
    document.body.classList.remove('sidebar-open');
    const sb = document.querySelector('#admin-sidebar');
    if (sb) sb.classList.remove('open');
    const burger = document.querySelector('#sidebar-burger');
    if (burger) {
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Open navigation menu');
    }
  };

  const navTabClick = (tabKey) => {
    closeMobileSidebar();
    renderAdmin(tabKey);
  };

  const navLiveBtn = document.querySelector('#nav-live');
  if (navLiveBtn) navLiveBtn.onclick = () => navTabClick('live');
  document.querySelector('#nav-results').onclick = () => navTabClick('results');
  document.querySelector('#nav-questions').onclick = () => navTabClick('questions');
  document.querySelector('#nav-rubrics').onclick = () => navTabClick('rubrics');
  document.querySelector('#nav-users').onclick = () => navTabClick('users');
  document.querySelector('#nav-bulk-users').onclick = () => navTabClick('bulk-users');
  document.querySelector('#nav-audit').onclick = () => navTabClick('audit');
  document.querySelector('#nav-settings').onclick = () => navTabClick('settings');

  const closeBtn = document.querySelector('#sidebar-close-btn');
  if (closeBtn) closeBtn.onclick = closeMobileSidebar;

  const backdrop = document.querySelector('#sidebar-backdrop');
  if (backdrop) backdrop.onclick = closeMobileSidebar;

  // Clear active background live polling timers and realtime listeners from previous tabs
  if (window._adminTabUnsubs && Array.isArray(window._adminTabUnsubs)) {
    window._adminTabUnsubs.forEach(unsub => {
      try { unsub(); } catch {}
    });
  }
  window._adminTabUnsubs = [];

  if (window.adminAuditLiveTimer) {
    clearInterval(window.adminAuditLiveTimer);
    window.adminAuditLiveTimer = null;
  }
  if (window.adminResultsLiveTimer) {
    clearInterval(window.adminResultsLiveTimer);
    window.adminResultsLiveTimer = null;
  }
  if (window.proctorTickInterval) {
    clearInterval(window.proctorTickInterval);
    window.proctorTickInterval = null;
  }

  const mainContainer = document.querySelector('#admin-content');

  if (tab === 'live') {
    await renderAdminLiveTab(mainContainer);
  } else if (tab === 'results') {
    await renderAdminResultsTab(mainContainer);
  } else if (tab === 'users') {
    await renderAdminUsersTab(mainContainer);
  } else if (tab === 'bulk-users') {
    await renderAdminBulkUsersTab(mainContainer);
  } else if (tab === 'questions') {
    await renderAdminQuestionsTab(mainContainer);
  } else if (tab === 'rubrics') {
    await renderAdminRubricsTab(mainContainer);
  } else if (tab === 'audit') {
    await renderAdminAuditTab(mainContainer);
  } else if (tab === 'settings') {
    await renderAdminSettingsTab(mainContainer);
  }
}

async function renderAdminLiveTab(container) {
  // Clean up any existing listeners and timer for live proctoring tab
  if (window._adminTabUnsubs && Array.isArray(window._adminTabUnsubs)) {
    window._adminTabUnsubs.forEach(unsub => {
      try { unsub(); } catch {}
    });
  }
  window._adminTabUnsubs = [];
  if (window.proctorTickInterval) {
    clearInterval(window.proctorTickInterval);
    window.proctorTickInterval = null;
  }

  container.innerHTML = `
    <div class="proctor-header">
      <div>
        <div class="eyebrow" style="display:inline-flex;align-items:center;gap:6px">
          <span style="width:7px;height:7px;border-radius:50%;background:#10b981;animation:pulseLiveDot 1.6s infinite"></span>
          Live Session Telemetry
        </div>
        <h1 style="font:700 28px 'Space Grotesk';margin:6px 0 4px;color:var(--navy)">Exam Proctoring & Telemetry Center</h1>
        <p style="margin:0;font-size:13.5px;color:var(--muted)">Active candidate telemetry, real-time anti-cheat detection, time extensions, and session proctoring controls.</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <button class="btn-icon" id="btn-broadcast-open" type="button" style="padding:9px 16px;background:linear-gradient(135deg,#1e40af,#2563eb);color:#fff;border-radius:10px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:7px;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(37,99,235,0.25)">
          <span>📢</span> <span>Broadcast to Candidates</span>
        </button>
      </div>
    </div>

    <!-- Overview Metrics -->
    <div class="proctor-metrics-grid">
      <div class="proctor-stat-card">
        <div class="proctor-stat-icon" style="background:#eff6ff;color:#2563eb">${ICONS.users}</div>
        <div>
          <div class="proctor-stat-num" id="stat-active-candidates">0</div>
          <div class="proctor-stat-label">Active Test-Takers Now</div>
        </div>
      </div>
      <div class="proctor-stat-card">
        <div class="proctor-stat-icon" style="background:#fef2f2;color:#dc2626">${ICONS.alertTriangle}</div>
        <div>
          <div class="proctor-stat-num" id="stat-security-alerts">0</div>
          <div class="proctor-stat-label">Security Incidents Today</div>
        </div>
      </div>
      <div class="proctor-stat-card">
        <div class="proctor-stat-icon" style="background:#f0fdf4;color:#16a34a">${ICONS.checkCircle}</div>
        <div>
          <div class="proctor-stat-num" id="stat-completed-today">0</div>
          <div class="proctor-stat-label">Completed Tests Today</div>
        </div>
      </div>
    </div>

    <!-- Active Candidates Grid Section -->
    <div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">
      <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:8px">
        <span>👨‍💻</span> <span>Live Test-Takers Cockpit</span>
      </h3>
      <div style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px">
        <span class="live-sync-dot"></span> <span>Reactive stream active</span>
      </div>
    </div>
    <div class="proctor-candidates-grid" id="proctor-candidates-container">
      <div style="grid-column:1/-1;text-align:center;padding:40px;background:#fff;border-radius:12px;border:1px dashed var(--line);color:var(--muted)">
        Connecting to active test sessions…
      </div>
    </div>

    <!-- Real-Time Proctoring Feed -->
    <div class="proctor-live-feed">
      <div class="proctor-feed-header">
        <h4 style="margin:0;font-size:14.5px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:8px">
          <span>⚡</span> Real-Time Proctor & Security Feed
        </h4>
        <span style="font-size:11.5px;color:var(--muted)">Live telemetry stream</span>
      </div>
      <div class="proctor-feed-list" id="proctor-live-feed-list">
        <div class="proctor-feed-empty" style="text-align:center;padding:16px;font-size:12px;color:var(--muted)">Proctor event feed initialized. Monitoring candidate activity…</div>
      </div>
    </div>
  `;

  // Fetch initial candidates snapshot
  const res = await request('/api/admin/proctor/candidates');
  let candidates = res.candidates || [];
  const resultsData = await request('/api/admin/results');
  const allResults = resultsData.results || [];
  const completedToday = allResults.filter(r => r.status === 'Completed').length;
  const compEl = document.querySelector('#stat-completed-today');
  if (compEl) compEl.textContent = completedToday;

  const updateSecurityAlertsStat = () => {
    const sum = candidates.reduce((total, c) => total + (c.antiCheat?.totalCount || 0), 0);
    const alertsEl = document.querySelector('#stat-security-alerts');
    if (alertsEl) alertsEl.textContent = sum;
  };
  updateSecurityAlertsStat();

  // Populate initial feed entries from candidates' violation history
  const feedList = document.querySelector('#proctor-live-feed-list');
  const initialEntries = [];
  for (const c of candidates) {
    const candName = c.name || c.teacher || c.email;
    if (Array.isArray(c.antiCheat?.violations) && c.antiCheat.violations.length > 0) {
      c.antiCheat.violations.forEach(v => {
        initialEntries.push({
          candidateName: candName,
          type: v.type,
          message: v.message || 'Candidate switched browser tab or minimized window',
          timestamp: v.timestamp || new Date().toISOString()
        });
      });
    }
  }

  if (feedList) {
    if (initialEntries.length === 0) {
      feedList.innerHTML = `<div class="proctor-feed-empty" style="text-align:center;padding:24px 16px;font-size:12.5px;color:var(--muted)">No security violations detected. Telemetry monitoring active.</div>`;
    } else {
      initialEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      feedList.innerHTML = initialEntries.slice(0, 30).map(entry => {
        const timeStr = new Date(entry.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
        return `
          <div class="proctor-feed-entry security-alert">
            <div>⚠️ <strong>SECURITY ALERT:</strong> ${escapeHtml(entry.candidateName)} triggered <code>${entry.type}</code> - ${escapeHtml(entry.message)}</div>
            <span style="font-size:11px;opacity:0.75;white-space:nowrap">${timeStr}</span>
          </div>
        `;
      }).join('');
    }
  }

  function renderCandidatesGrid() {
    const grid = document.querySelector('#proctor-candidates-container');
    if (!grid) return;

    const activeList = candidates.filter(c => c.status !== 'completed');
    const actEl = document.querySelector('#stat-active-candidates');
    if (actEl) actEl.textContent = activeList.length;

    if (activeList.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:48px 24px;background:#fff;border-radius:14px;border:1px dashed var(--line)">
          <div style="font-size:32px;margin-bottom:8px">👨‍🏫</div>
          <h4 style="margin:0 0 6px 0;font-size:15px;color:var(--navy);font-weight:700">No Active Test-Takers At This Moment</h4>
          <p style="margin:0;font-size:13px;color:var(--muted)">When a candidate starts an assessment, their real-time screen telemetry, countdown timer, question progress, and anti-cheat events will populate here live.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = activeList.map(cand => {
      const pct = Math.min(100, Math.round(((cand.answeredCount || 0) / (cand.totalQuestions || 25)) * 100));
      const violations = cand.antiCheat?.totalCount || 0;
      const remSecs = Math.max(0, Math.floor((cand.remainingMs || 0) / 1000));
      const remMins = Math.floor(remSecs / 60);
      const remSecRemainder = remSecs % 60;
      const timeDisplay = `${remMins}:${String(remSecRemainder).padStart(2, '0')}`;

      return `
        <div class="proctor-candidate-card ${violations > 0 ? 'has-alert' : ''}" data-attempt-id="${cand.attemptId}">
          <div>
            <div class="proctor-candidate-header">
              <div class="proctor-candidate-info">
                <h4>${escapeHtml(cand.name || cand.email)}</h4>
                <div class="proctor-candidate-meta">${escapeHtml(cand.unit || 'School')} • <span style="font-family:monospace">${cand.attemptId}</span></div>
              </div>
              <span class="proctor-status-chip ${cand.status}">
                <span style="width:6px;height:6px;border-radius:50%;background:currentColor"></span>
                ${cand.status.toUpperCase()}
              </span>
            </div>

            <div class="proctor-progress-wrapper">
              <div class="proctor-progress-label">
                <span>${escapeHtml(cand.sectionName || 'Grammar & Vocabulary')}</span>
                <span>${cand.answeredCount || 0} / ${cand.totalQuestions || 25} (${pct}%)</span>
              </div>
              <div class="proctor-progress-bar">
                <div class="proctor-progress-fill" style="width:${pct}%"></div>
              </div>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;font-size:12px">
              <div class="proctor-time-tag">
                ${ICONS.clock} <span class="cand-timer">${timeDisplay}</span>
              </div>
              <div class="anti-cheat-pill-badge ${violations > 0 ? 'warning' : 'active'}" title="Tab switches: ${cand.antiCheat?.tabSwitches || 0}, Fullscreen exits: ${cand.antiCheat?.fullscreenExits || 0}">
                ${ICONS.shield} <span>${violations} Violation${violations === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>

          <div class="proctor-card-footer">
            <span style="font-size:11px;color:var(--muted)">Proctor Control</span>
            <div class="proctor-action-buttons">
              <button class="btn-proctor-action btn-proctor-warn" data-id="${cand.attemptId}" data-name="${escapeHtml(cand.name || cand.email)}" type="button" title="Send Proctor Warning">
                ⚠️ Warn
              </button>
              <button class="btn-proctor-action btn-proctor-extend" data-id="${cand.attemptId}" type="button" title="Extend Time by 5 minutes">
                +5m
              </button>
              <button class="btn-proctor-action danger btn-proctor-submit" data-id="${cand.attemptId}" data-name="${escapeHtml(cand.name || cand.email)}" type="button" title="Force Submit Assessment">
                Submit
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.btn-proctor-warn').forEach(btn => {
      btn.onclick = () => openProctorWarningModal(btn.dataset.id, btn.dataset.name);
    });
    grid.querySelectorAll('.btn-proctor-extend').forEach(btn => {
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = '…';
        const extRes = await request('/api/admin/proctor/extend-time', {
          method: 'POST',
          body: { attemptId: btn.dataset.id, additionalMinutes: 5 }
        });
        btn.disabled = false;
        btn.textContent = '+5m';
        if (extRes.success) {
          showToast(`Extended time by 5 minutes for candidate ${btn.dataset.id}`, 'success');
        } else {
          showToast(extRes.error || 'Failed to extend time', 'error');
        }
      };
    });
    grid.querySelectorAll('.btn-proctor-submit').forEach(btn => {
      btn.onclick = () => {
        openProctorForceSubmitModal(btn.dataset.id, btn.dataset.name);
      };
    });
  }

  renderCandidatesGrid();

  const recentFeedKeys = new Map();
  function appendProctorFeed(text, type = 'info', timestamp = null) {
    const list = document.querySelector('#proctor-live-feed-list');
    if (!list) return;

    // Deduplicate identical alerts within 2500ms
    const alertKey = `${type}_${text}`;
    const now = Date.now();
    if (recentFeedKeys.has(alertKey) && (now - recentFeedKeys.get(alertKey) < 2500)) {
      return;
    }
    recentFeedKeys.set(alertKey, now);

    const emptyEl = list.querySelector('.proctor-feed-empty');
    if (emptyEl) emptyEl.remove();

    const timeStr = timestamp
      ? new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });

    const item = document.createElement('div');
    item.className = `proctor-feed-entry ${type === 'alert' ? 'security-alert' : (type === 'submission' ? 'submission' : '')}`;
    item.innerHTML = `
      <div>${text}</div>
      <span style="font-size:11px;opacity:0.75;white-space:nowrap">${timeStr}</span>
    `;
    list.insertBefore(item, list.firstChild);
    while (list.children.length > 30) list.removeChild(list.lastChild);
  }

  // Ticking interval for candidate remaining times
  window.proctorTickInterval = setInterval(() => {
    if (localStorage.getItem('assessify_admin_tab') !== 'live') {
      clearInterval(window.proctorTickInterval);
      window.proctorTickInterval = null;
      return;
    }
    let anyChanged = false;
    for (const c of candidates) {
      if (c.status === 'active' && c.remainingMs > 1000) {
        c.remainingMs -= 1000;
        anyChanged = true;
      }
    }
    if (anyChanged) {
      candidates.forEach(c => {
        const card = document.querySelector(`.proctor-candidate-card[data-attempt-id="${c.attemptId}"]`);
        if (card) {
          const remSecs = Math.max(0, Math.floor((c.remainingMs || 0) / 1000));
          const remMins = Math.floor(remSecs / 60);
          const remSecRemainder = remSecs % 60;
          const timerEl = card.querySelector('.cand-timer');
          if (timerEl) timerEl.textContent = `${remMins}:${String(remSecRemainder).padStart(2, '0')}`;
        }
      });
    }
  }, 1000);

  // Subscribe to real-time events and register unsubs
  window._adminTabUnsubs.push(
    realtime.on('CANDIDATE_PRESENCE_SYNC', (syncData) => {
      if (Array.isArray(syncData.candidates)) {
        candidates = syncData.candidates;
        renderCandidatesGrid();
        updateSecurityAlertsStat();
      }
    }),
    realtime.on('CANDIDATE_PRESENCE_UPDATE', (presence) => {
      const idx = candidates.findIndex(c => c.attemptId === presence.attemptId);
      if (idx !== -1) {
        candidates[idx] = presence;
      } else {
        candidates.push(presence);
      }
      renderCandidatesGrid();
      updateSecurityAlertsStat();
    }),
    realtime.on('ATTEMPT_STARTED', (evData) => {
      appendProctorFeed(`Candidate <strong>${escapeHtml(evData.teacher || evData.email)}</strong> (${evData.unit || 'School'}) started assessment.`, 'info', evData.startedAt);
      showToast(`Candidate started assessment: ${evData.teacher || evData.email}`, 'info', 3000);
    }),
    realtime.on('ANTI_CHEAT_VIOLATION', (evData) => {
      // 1. Update candidate violation count in memory
      const cand = candidates.find(c => c.attemptId === evData.attemptId);
      if (cand) {
        if (!cand.antiCheat) cand.antiCheat = { totalCount: 0, violations: [] };
        cand.antiCheat.totalCount = evData.totalCount || ((cand.antiCheat.totalCount || 0) + 1);
        cand.antiCheat.violations = Array.isArray(cand.antiCheat.violations) ? cand.antiCheat.violations : [];
        cand.antiCheat.violations.push({
          type: evData.type,
          message: evData.message,
          timestamp: evData.timestamp || new Date().toISOString()
        });
        renderCandidatesGrid();
      }

      // 2. Security Incidents Today is strictly synchronized to total violation count
      updateSecurityAlertsStat();

      // 3. Append to proctor feed with deduplication
      appendProctorFeed(`⚠️ <strong>SECURITY ALERT:</strong> ${escapeHtml(evData.teacher || evData.email)} triggered <code>${evData.type}</code> - ${escapeHtml(evData.message)}`, 'alert', evData.timestamp);
      showToast(`Proctor Alert: ${evData.teacher || evData.email} (${evData.type})`, 'error', 5000);
    }),
    realtime.on('ATTEMPT_SUBMITTED', (evData) => {
      const att = evData.attempt || {};
      appendProctorFeed(`✓ Assessment submitted by <strong>${escapeHtml(att.teacher || att.email)}</strong>. Provisional Band: ${att.overall || 'Pending'}`, 'submission');
      showToast(`Assessment submitted: ${att.teacher || att.email}`, 'success', 4000);
      const completedEl = document.querySelector('#stat-completed-today');
      if (completedEl) completedEl.textContent = Number(completedEl.textContent || 0) + 1;
    }),
    realtime.on('ATTEMPT_DELETED', (evData) => {
      candidates = candidates.filter(c => c.attemptId !== evData.attemptId);
      renderCandidatesGrid();
      updateSecurityAlertsStat();
    })
  );

  const bBtn = document.querySelector('#btn-broadcast-open');
  if (bBtn) bBtn.onclick = () => openProctorBroadcastModal();
}

async function renderAdminResultsTab(container) {
  const data = await request('/api/admin/results');
  if (data.error) return renderLogin();

  const completedCount = data.results.filter((item) => item.status === 'Completed').length;
  const pendingCount = data.results.filter((item) => item.review === 'Pending' || item.review?.includes('required')).length;

  // Real-time live polling for candidate assessments without page refresh
  if (window.adminResultsLiveTimer) clearInterval(window.adminResultsLiveTimer);
  window.adminResultsLiveTimer = setInterval(async () => {
    if (localStorage.getItem('assessify_admin_tab') !== 'results') {
      clearInterval(window.adminResultsLiveTimer);
      window.adminResultsLiveTimer = null;
      return;
    }
    const isSearching = document.activeElement && document.activeElement.id === 'search';
    const isModalOpen = Boolean(modalRoot && modalRoot.innerHTML !== '');
    const hasChecked = document.querySelectorAll('.attempt-checkbox:checked').length > 0;
    if (isSearching || isModalOpen || hasChecked) return;

    const liveData = await request('/api/admin/results');
    if (liveData.error || !Array.isArray(liveData.results)) return;

    const currentTotalEl = document.querySelector('.kpi-indigo strong');
    if (currentTotalEl && currentTotalEl.textContent !== String(liveData.total)) {
      renderAdminResultsTab(container);
    }
  }, 4000);

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
              <th style="width:23%">Teacher Candidate</th>
              <th style="width:14%">School Unit</th>
              <th style="width:10%">Attempt ID</th>
              <th style="width:11%">Status</th>
              <th style="width:10%">Overall Band</th>
              <th style="width:11%">Review Status</th>
              <th style="width:11%">Anti-Cheat</th>
              <th style="width:10%;text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody id="results">${renderTableRows(data.results)}</tbody>
        </table>
      </div>
    </div>
  `;

  function renderRow(row) {
    const isReviewed = row.review === 'Teacher reviewed';
    const isCompleted = row.status === 'Completed';
    const initials = (row.teacher || 'T').split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'T';
    const overallBand = row.overall || row.overallBand || (isCompleted ? 'Pending' : '—');
    const ac = row.antiCheat || row.raw_data?.antiCheat || null;
    const violations = ac ? (ac.totalCount || (ac.violations?.length) || (ac.tabSwitches || 0) + (ac.fullscreenExits || 0) + (ac.splitScreenDetections || 0) + (ac.devToolsAttempts || 0) + (ac.copyPasteAttempts || 0)) : 0;

    return `
      <tr data-attempt-id="${row.id}">
        <td style="text-align:center;padding:12px 8px">
          <input type="checkbox" class="attempt-checkbox custom-table-checkbox" data-id="${row.id}" data-name="${(row.teacher || '').replaceAll('"', '&quot;')}">
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg, #1e40af, #3b82f6);color:#fff;display:inline-grid;place-items:center;font-size:12px;font-weight:700;flex-shrink:0">${initials}</span>
            <div>
              <div style="font-weight:700;color:var(--ink);font-size:13.5px">${row.teacher || 'Candidate'}</div>
              <div style="font-size:12px;color:var(--muted)">${row.email || 'No email'}</div>
            </div>
          </div>
        </td>
        <td><span class="unit-pill">${row.unit || 'SMK KARYA BANGSA'}</span></td>
        <td><span class="attempt-pill">${row.id}</span></td>
        <td><span class="pill ${isCompleted ? 'success' : 'pending'}">${row.status || 'In progress'}</span></td>
        <td>
          ${overallBand !== '—' && overallBand !== 'Pending'
            ? `<span class="${getLevelBadgeClass(overallBand)}" style="font-size:12.5px;font-weight:700">${overallBand}</span>`
            : `<span style="color:var(--muted);font-size:12.5px">${overallBand}</span>`}
        </td>
        <td><span class="pill ${isReviewed ? 'success' : 'pending'}">${row.review || 'Pending'}</span></td>
        <td>
          ${violations === 0
            ? '<span class="pill success" style="font-size:11.5px;white-space:nowrap">🛡️ 0 Violations</span>'
            : `<span class="pill" style="font-size:11.5px;background:#fef2f2;color:#dc2626;border-color:#fecaca;white-space:nowrap" title="${violations} anti-cheat incident(s) recorded">⚠️ ${violations} Violation${violations === 1 ? '' : 's'}</span>`}
        </td>
        <td style="text-align:right">
          <div style="display:inline-flex;align-items:center;gap:6px">
            <button type="button" class="button button-sm detail" data-id="${row.id}" style="padding:6px 12px;font-size:12.5px" title="Evaluate and grade candidate responses">
              <span>Grade</span>
            </button>
            <a class="btn-action-icon" href="/api/attempts/${row.id}/certificate" target="_blank" title="Download Official Placement Certificate">
              ${ICONS.pdf}
            </a>
            <button type="button" class="btn-delete-ghost btn-delete-attempt" data-id="${row.id}" data-name="${(row.teacher || '').replaceAll('"', '&quot;')}" title="Delete candidate attempt">
              ${ICONS.trash}
            </button>
          </div>
        </td>
      </tr>
    `;
  }

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

  function bindDetails() {
    const selectAllCb = document.querySelector('#select-all-attempts');
    const checkboxes = document.querySelectorAll('.attempt-checkbox');
    const bulkBar = document.querySelector('#bulk-actions-bar');
    const countBadge = document.querySelector('#bulk-selected-count');

    const updateBulkBar = () => {
      const checked = document.querySelectorAll('.attempt-checkbox:checked');
      const count = checked.length;
      if (countBadge) countBadge.textContent = String(count);
      if (bulkBar) bulkBar.style.display = count > 0 ? 'flex' : 'none';
      if (selectAllCb) {
        selectAllCb.checked = checkboxes.length > 0 && count === checkboxes.length;
        selectAllCb.indeterminate = count > 0 && count < checkboxes.length;
      }
    };

    if (selectAllCb) {
      selectAllCb.onchange = () => {
        checkboxes.forEach((cb) => { cb.checked = selectAllCb.checked; });
        updateBulkBar();
      };
    }

    checkboxes.forEach((cb) => {
      cb.onchange = updateBulkBar;
    });

    const deselectBtn = document.querySelector('#bulk-deselect-btn');
    if (deselectBtn) {
      deselectBtn.onclick = () => {
        checkboxes.forEach((cb) => { cb.checked = false; });
        updateBulkBar();
      };
    }

    const bulkExportExcel = document.querySelector('#bulk-export-excel-btn');
    if (bulkExportExcel) {
      bulkExportExcel.onclick = () => {
        const ids = Array.from(document.querySelectorAll('.attempt-checkbox:checked')).map((cb) => cb.dataset.id);
        if (!ids.length) return;
        window.open(`/api/admin/results/export?format=xlsx&ids=${encodeURIComponent(ids.join(','))}`, '_blank');
      };
    }

    const bulkExportPdf = document.querySelector('#bulk-export-pdf-btn');
    if (bulkExportPdf) {
      bulkExportPdf.onclick = () => {
        const ids = Array.from(document.querySelectorAll('.attempt-checkbox:checked')).map((cb) => cb.dataset.id);
        if (!ids.length) return;
        window.open(`/api/admin/results/export?format=pdf&ids=${encodeURIComponent(ids.join(','))}`, '_blank');
      };
    }

    const bulkDeleteBtn = document.querySelector('#bulk-delete-btn');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.onclick = () => {
        const checkboxes = Array.from(document.querySelectorAll('.attempt-checkbox:checked'));
        const ids = checkboxes.map((cb) => cb.dataset.id);
        if (!ids.length) return;
        const names = checkboxes.map((cb) => cb.dataset.name || cb.closest('tr')?.querySelector('strong')?.textContent?.trim() || cb.dataset.id);
        openBulkDeleteModal(ids, names, () => renderAdminResultsTab(container));
      };
    }

    document.querySelectorAll('.detail').forEach((btn) => {
      btn.onclick = () => {
        const attemptId = btn.dataset.id;
        if (attemptId) openGradingModal(attemptId);
      };
    });

    document.querySelectorAll('.btn-delete-attempt').forEach((btn) => {
      btn.onclick = () => {
        const attemptId = btn.dataset.id;
        const teacherName = btn.dataset.name || btn.closest('tr')?.querySelector('strong')?.textContent?.trim() || '';
        openDeleteModal(attemptId, teacherName, () => renderAdminResultsTab(container));
      };
    });

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

  // Reactive real-time event listeners for live candidate results
  const updateResultsLive = async () => {
    if (localStorage.getItem('assessify_admin_tab') !== 'results') return;
    const isSearching = document.activeElement && document.activeElement.id === 'search';
    const isModalOpen = Boolean(modalRoot && modalRoot.innerHTML !== '');
    const hasChecked = document.querySelectorAll('.attempt-checkbox:checked').length > 0;
    if (isSearching || isModalOpen || hasChecked) return;

    const fresh = await request('/api/admin/results');
    if (!fresh || !fresh.results) return;
    data.results = fresh.results;
    data.total = fresh.total;

    const compCount = data.results.filter((item) => item.status === 'Completed').length;
    const pendCount = data.results.filter((item) => item.review === 'Pending' || item.review?.includes('required')).length;

    const kpiTotal = container.querySelector('.kpi-indigo strong');
    const kpiComp = container.querySelector('.kpi-green strong');
    const kpiPend = container.querySelector('.kpi-amber strong');
    if (kpiTotal) kpiTotal.textContent = data.total;
    if (kpiComp) kpiComp.textContent = compCount;
    if (kpiPend) kpiPend.textContent = pendCount;

    filter();
  };

  window._adminTabUnsubs = window._adminTabUnsubs || [];
  window._adminTabUnsubs.push(
    realtime.on('ATTEMPT_STARTED', updateResultsLive),
    realtime.on('ATTEMPT_SUBMITTED', updateResultsLive),
    realtime.on('ATTEMPT_GRADED', updateResultsLive),
    realtime.on('ATTEMPT_DELETED', updateResultsLive),
    realtime.on('ANTI_CHEAT_VIOLATION', (ev) => {
      const rowEl = container.querySelector(`tr[data-attempt-id="${ev.attemptId}"]`);
      if (rowEl) {
        const cell = rowEl.querySelector('td:nth-child(8)');
        if (cell) {
          cell.innerHTML = `<span class="pill" style="font-size:11.5px;background:#fef2f2;color:#dc2626;border-color:#fecaca;white-space:nowrap;box-shadow:0 0 0 2px rgba(239,68,68,0.2)" title="${ev.totalCount} incident(s)">⚠️ ${ev.totalCount} Violations</span>`;
        }
      }
    })
  );
}

async function renderAdminUsersTab(container) {
  const [teachersRes, adminsRes, studentsRes] = await Promise.all([
    request('/api/admin/teachers'),
    request('/api/admin/admins'),
    request('/api/admin/students')
  ]);

  if (teachersRes.error) return showToast(teachersRes.error, 'error');

  const students = (studentsRes?.students || []).map((s) => ({
    ...s,
    role: 'students',
    roleLabel: 'Student',
    unit: s.unit || 'Unassigned Unit',
    status: s.status || 'active'
  }));
  const teachers = (teachersRes.teachers || []).map((t) => ({
    ...t,
    role: 'authorized_teacher',
    roleLabel: 'Teacher Candidate',
    unit: t.unit || 'Unassigned Unit',
    status: t.status || 'active'
  }));
  const admins = (adminsRes.admins || []).map((a) => ({
    ...a,
    role: 'admin_user',
    roleLabel: 'Administrator',
    unit: 'All School Units',
    status: a.status || 'active'
  }));
  const allUsers = [...students, ...teachers, ...admins];

  const selectedKeys = new Set();

  const renderDashboard = () => {
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:24px">
        <div>
          <div class="eyebrow">School Administration</div>
          <h1 style="font:700 32px 'Space Grotesk';margin:6px 0 4px;color:var(--ink)">User Manager</h1>
          <p style="color:var(--muted);font-size:14px;margin:0">Manage students, teacher candidates, and administrators across Karya Bangsa School.</p>
        </div>
        <div class="admin-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="button" id="btn-add-user" type="button" style="display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:10px;font-weight:600;font-size:13.5px">
            <span>+</span> <span>Add Single User</span>
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
        <div class="kpi-card kpi-green">
          <div class="kpi-card-info">
            <strong>${students.length}</strong>
            <span>Students</span>
          </div>
          <div class="kpi-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          </div>
        </div>
        <div class="kpi-card kpi-blue">
          <div class="kpi-card-info">
            <strong>${teachers.length}</strong>
            <span>Teacher Candidates</span>
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

      <!-- User Accounts Table Card -->
      <div class="panel" style="padding:24px 28px">
        <div class="table-toolbar">
          <div class="search-wrap">
            <span class="search-icon-prefix">${ICONS.search}</span>
            <input id="user-search" placeholder="Search by name, email, or unit…">
          </div>
          <select class="select-filter" id="user-role-filter">
            <option value="">All Roles (${allUsers.length})</option>
            <option value="students">Students (${students.length})</option>
            <option value="authorized_teacher">Teacher Candidates (${teachers.length})</option>
            <option value="admin_user">Administrators (${admins.length})</option>
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
                <th style="width:22%">Account / Identifier</th>
                <th style="width:16%">System Role</th>
                <th style="width:16%">Assigned Unit / Scope</th>
                <th style="width:10%">Status</th>
                <th style="width:10%;text-align:right">Actions</th>
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
    if (addUserBtn) addUserBtn.onclick = () => openUserModal(null, roleFilter?.value || 'students');

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
        let matchRole = true;
        if (r) {
          if (r === 'students' || r === 'student') matchRole = user.role === 'students' || user.role === 'student';
          else if (r === 'authorized_teacher' || r === 'candidate' || r === 'teacher') matchRole = user.role === 'authorized_teacher' || user.role === 'candidate' || user.role === 'teacher';
          else if (r === 'admin_user' || r === 'admin') matchRole = user.role === 'admin_user' || user.role === 'admin';
          else matchRole = user.role === r;
        }
        const matchStatus = !s || (user.status || 'active') === s;
        const matchUnit = !u || (user.unit || '').trim().toLowerCase() === u.toLowerCase();
        const searchStr = `${user.name || ''} ${user.email || ''} ${user.username || ''} ${user.student_id || ''} ${user.grade || ''} ${user.unit || ''}`.toLowerCase();
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
        const isAdminUser = item.role === 'admin_user' || item.role === 'admin';
        const isStudent = item.role === 'students' || item.role === 'student';
        const key = `${item.role}_${item.id}`;
        const isChecked = selectedKeys.has(key);

        let rolePill = `<span class="pill" style="background:#eff6ff;color:#1d4ed8;border:1px solid #dbeafe;font-weight:700">Teacher</span>`;
        let avatarStyle = '';
        let identifier = `<span style="font-family:monospace;font-size:12.5px;color:var(--ink);background:#f1f5f9;padding:3px 8px;border-radius:4px">${item.email}</span>`;

        if (isAdminUser) {
          rolePill = `<span class="pill" style="background:#f3e8ff;color:#7e22ce;border:1px solid #e9d5ff;font-weight:700">Administrator</span>`;
          avatarStyle = 'background:#f3e8ff;color:#7e22ce;border-color:#e9d5ff;';
          identifier = `<span style="font-family:monospace;font-size:12.5px;color:#7e22ce;background:#faf5ff;border:1px solid #e9d5ff;padding:3px 8px;border-radius:4px">@${item.username || 'admin'}</span>`;
        } else if (isStudent) {
          rolePill = `<span class="pill" style="background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-weight:700">Student</span>`;
          avatarStyle = 'background:#ecfdf5;color:#047857;border-color:#a7f3d0;';
          identifier = `<span style="font-family:monospace;font-size:12.5px;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;padding:3px 8px;border-radius:4px">${item.email}</span>`;
        }

        const unitPill = isAdminUser
          ? `<span class="unit-pill" style="background:#faf5ff;color:#6b21a8;border-color:#e9d5ff;font-weight:600">All Units (Full Access)</span>`
          : `<span class="unit-pill">${item.unit}</span>`;

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
          if (target) openSuspendUserModal(target, () => updateTable());
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
          if (target) openArchiveUserModal(target, () => updateTable());
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
      if (role === 'admin_user' || role === 'admin') {
        return admins.find((a) => String(a.id) === String(id));
      }
      if (role === 'students' || role === 'student') {
        return students.find((s) => String(s.id) === String(id));
      }
      return teachers.find((t) => String(t.id) === String(id));
    };

    const changeUserStatus = async (user, newStatus) => {
      let endpoint = `/api/admin/teachers/${user.id}/status`;
      if (user.role === 'admin_user' || user.role === 'admin') {
        endpoint = `/api/admin/admins/${user.id}/status`;
      } else if (user.role === 'students' || user.role === 'student') {
        endpoint = `/api/admin/students/${user.id}/status`;
      }

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
          let matchRole = true;
          if (r) {
            if (r === 'students' || r === 'student') matchRole = user.role === 'students' || user.role === 'student';
            else if (r === 'authorized_teacher' || r === 'candidate' || r === 'teacher') matchRole = user.role === 'authorized_teacher' || user.role === 'candidate' || user.role === 'teacher';
            else if (r === 'admin_user' || r === 'admin') matchRole = user.role === 'admin_user' || user.role === 'admin';
            else matchRole = user.role === r;
          }
          const matchStatus = !s || (user.status || 'active') === s;
          const matchUnit = !u || (user.unit || '').trim().toLowerCase() === u.toLowerCase();
          const searchStr = `${user.name || ''} ${user.email || ''} ${user.username || ''} ${user.student_id || ''} ${user.grade || ''} ${user.unit || ''}`.toLowerCase();
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
    container.querySelector('#btn-bulk-suspend').onclick = () => {
      const targets = getSelectedTargets();
      if (!targets.length) return;
      openBulkStatusUsersModal(targets, findUser, 'suspended', () => applyBulkStatus('suspended'));
    };
    container.querySelector('#btn-bulk-archive').onclick = () => {
      const targets = getSelectedTargets();
      if (!targets.length) return;
      openBulkStatusUsersModal(targets, findUser, 'archived', () => applyBulkStatus('archived'));
    };
    container.querySelector('#btn-bulk-delete').onclick = () => {
      const targets = getSelectedTargets();
      if (!targets.length) return;
      openBulkDeleteUsersModal(targets, findUser);
    };

    if (searchInput) searchInput.oninput = updateTable;
    if (roleFilter) roleFilter.onchange = updateTable;
    if (statusFilter) statusFilter.onchange = updateTable;
    if (unitFilter) unitFilter.onchange = updateTable;
    updateTable();
  };

  renderDashboard();
}

function openUserModal(user = null, defaultRole = 'students') {
  const isEdit = Boolean(user);
  let selectedRole = 'students';
  if (isEdit && user) {
    if (user.role === 'admin' || user.role === 'admin_user') selectedRole = 'admin_user';
    else if (user.role === 'authorized_teacher' || user.role === 'candidate' || user.role === 'teacher') selectedRole = 'authorized_teacher';
    else selectedRole = 'students';
  } else {
    if (defaultRole === 'admin' || defaultRole === 'admin_user') selectedRole = 'admin_user';
    else if (defaultRole === 'authorized_teacher' || defaultRole === 'candidate' || defaultRole === 'teacher') selectedRole = 'authorized_teacher';
    else selectedRole = 'students';
  }

  const modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) return;

  const roleMeta = {
    students: {
      title: isEdit ? 'Edit Student Account' : 'Add New Student',
      subtitle: isEdit ? 'Update student account and academic unit details.' : 'Register a new student account for placement assessment.',
      badgeText: 'Student',
      iconBg: 'rgba(5,150,105,0.1)',
      iconColor: '#059669',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
      btnLabel: isEdit ? 'Save Changes' : 'Add Student'
    },
    authorized_teacher: {
      title: isEdit ? 'Edit Teacher Candidate' : 'Add Teacher Candidate',
      subtitle: isEdit ? 'Update educator credentials and assigned school unit.' : 'Register a new educator for English assessment.',
      badgeText: 'Teacher Candidate',
      iconBg: 'rgba(37,99,235,0.1)',
      iconColor: '#2563eb',
      icon: ICONS.users,
      btnLabel: isEdit ? 'Save Changes' : 'Add Candidate'
    },
    admin_user: {
      title: isEdit ? 'Edit Administrator' : 'Add Administrator',
      subtitle: isEdit ? 'Update administrator credentials and security permissions.' : 'Create a portal administrator with management privileges.',
      badgeText: 'Administrator',
      iconBg: 'rgba(126,34,206,0.1)',
      iconColor: '#7e22ce',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      btnLabel: isEdit ? 'Save Changes' : 'Create Administrator'
    }
  };

  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="user-modal-backdrop">
      <div class="modal-card" style="max-width:580px;width:100%;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
        <div class="modal-header" style="padding:20px 24px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between">
          <div class="modal-title-wrap" style="display:flex;align-items:center;gap:12px">
            <div class="modal-icon" id="um-modal-icon" style="background:${roleMeta[selectedRole].iconBg};color:${roleMeta[selectedRole].iconColor};width:42px;height:42px;border-radius:10px;display:grid;place-items:center">
              ${roleMeta[selectedRole].icon}
            </div>
            <div>
              <h2 id="user-modal-title" style="margin:0;font:700 20px 'Space Grotesk';color:var(--ink)">${roleMeta[selectedRole].title}</h2>
              <p id="user-modal-subtitle" style="margin:2px 0 0;font-size:13px;color:var(--muted)">${roleMeta[selectedRole].subtitle}</p>
            </div>
          </div>
          <button class="modal-close" id="close-user-modal" type="button" aria-label="Close modal" style="background:none;border:none;font-size:22px;cursor:pointer;color:#64748b">✕</button>
        </div>
        <div class="modal-body" style="padding:20px 24px;max-height:80vh;overflow-y:auto">
          <form id="user-modal-form">
            <!-- Role Selector (Only when creating new user) -->
            ${!isEdit ? `
              <label style="display:block;font-size:13px;font-weight:700;margin-bottom:8px;color:var(--ink)">Account Role</label>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px">
                <label id="card-role-students" class="role-select-card" style="display:flex;align-items:flex-start;gap:8px;padding:12px;border:1.5px solid var(--line);border-radius:10px;cursor:pointer;background:var(--white);transition:all 0.2s ease">
                  <input type="radio" name="modal-role" value="students" ${selectedRole === 'students' ? 'checked' : ''} style="accent-color:#059669;margin-top:2px">
                  <div>
                    <div style="font-weight:700;font-size:13px;color:var(--ink)">Students</div>
                    <div style="font-size:11px;color:var(--muted)">Student Account</div>
                  </div>
                </label>
                <label id="card-role-teacher" class="role-select-card" style="display:flex;align-items:flex-start;gap:8px;padding:12px;border:1.5px solid var(--line);border-radius:10px;cursor:pointer;background:var(--white);transition:all 0.2s ease">
                  <input type="radio" name="modal-role" value="authorized_teacher" ${selectedRole === 'authorized_teacher' ? 'checked' : ''} style="accent-color:#2563eb;margin-top:2px">
                  <div>
                    <div style="font-weight:700;font-size:13px;color:var(--ink)">Teacher</div>
                    <div style="font-size:11px;color:var(--muted)">Educator / Candidate</div>
                  </div>
                </label>
                <label id="card-role-admin" class="role-select-card" style="display:flex;align-items:flex-start;gap:8px;padding:12px;border:1.5px solid var(--line);border-radius:10px;cursor:pointer;background:var(--white);transition:all 0.2s ease">
                  <input type="radio" name="modal-role" value="admin_user" ${selectedRole === 'admin_user' ? 'checked' : ''} style="accent-color:#7e22ce;margin-top:2px">
                  <div>
                    <div style="font-weight:700;font-size:13px;color:var(--ink)">Admin</div>
                    <div style="font-size:11px;color:var(--muted)">Full Access</div>
                  </div>
                </label>
              </div>
            ` : ''}

            <!-- Common Field: Full Name -->
            <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
              Full Name <span id="um-name-hint" style="font-weight:400;color:var(--muted)">(student full name)</span>
            </label>
            <input type="text" id="um-name" name="name" value="${user?.name || ''}" placeholder="e.g. Siti Aminah, S.Pd." required style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">

            <!-- Student Specific Fields -->
            <div id="um-fields-student" style="display:none">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                  <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                    Student ID / NISN <span style="font-weight:400;color:var(--muted)">(optional)</span>
                  </label>
                  <input type="text" id="um-student-id" name="student_id" value="${user?.student_id || ''}" placeholder="e.g. 0081234567" style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">
                </div>
                <div>
                  <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                    Grade / Class <span style="font-weight:400;color:var(--muted)">(optional)</span>
                  </label>
                  <input type="text" id="um-student-grade" name="grade" value="${user?.grade || ''}" placeholder="e.g. 10-A / 7-B" style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">
                </div>
              </div>

              <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                Student Official Email <span style="font-weight:400;color:var(--muted)">(@karyabangsa.sch.id)</span>
              </label>
              <input type="email" id="um-student-email" name="student_email" value="${user?.email || ''}" placeholder="student@karyabangsa.sch.id" style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">

              <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                Assigned School Unit
              </label>
              <select id="um-student-unit" name="student_unit" class="select-filter" style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">
                <option value="" disabled ${!user?.unit ? 'selected' : ''}>Select School Unit</option>
                <option value="KB-TK GOLDEN BEE" ${user?.unit === 'KB-TK GOLDEN BEE' ? 'selected' : ''}>KB-TK GOLDEN BEE</option>
                <option value="SD KARYA BANGSA" ${user?.unit === 'SD KARYA BANGSA' ? 'selected' : ''}>SD KARYA BANGSA</option>
                <option value="SMP KARYA BANGSA" ${user?.unit === 'SMP KARYA BANGSA' ? 'selected' : ''}>SMP KARYA BANGSA</option>
                <option value="SMA KARYA BANGSA" ${user?.unit === 'SMA KARYA BANGSA' ? 'selected' : ''}>SMA KARYA BANGSA</option>
                <option value="SMK KARYA BANGSA" ${user?.unit === 'SMK KARYA BANGSA' ? 'selected' : ''}>SMK KARYA BANGSA</option>
              </select>
            </div>

            <!-- Teacher Specific Fields -->
            <div id="um-fields-teacher" style="display:none">
              <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                Official School Email <span style="font-weight:400;color:var(--muted)">(@karyabangsa.sch.id)</span>
              </label>
              <input type="email" id="um-teacher-email" name="teacher_email" value="${user?.email || ''}" placeholder="teacher@karyabangsa.sch.id" style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">

              <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                Assigned School Unit
              </label>
              <select id="um-teacher-unit" name="teacher_unit" class="select-filter" style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">
                <option value="" disabled ${!user?.unit ? 'selected' : ''}>Select School Unit</option>
                <option value="KB-TK GOLDEN BEE" ${user?.unit === 'KB-TK GOLDEN BEE' ? 'selected' : ''}>KB-TK GOLDEN BEE</option>
                <option value="SD KARYA BANGSA" ${user?.unit === 'SD KARYA BANGSA' ? 'selected' : ''}>SD KARYA BANGSA</option>
                <option value="SMP KARYA BANGSA" ${user?.unit === 'SMP KARYA BANGSA' ? 'selected' : ''}>SMP KARYA BANGSA</option>
                <option value="SMA KARYA BANGSA" ${user?.unit === 'SMA KARYA BANGSA' ? 'selected' : ''}>SMA KARYA BANGSA</option>
                <option value="SMK KARYA BANGSA" ${user?.unit === 'SMK KARYA BANGSA' ? 'selected' : ''}>SMK KARYA BANGSA</option>
              </select>
            </div>

            <!-- Administrator Specific Fields -->
            <div id="um-fields-admin" style="display:none">
              <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                Admin Username <span style="font-weight:400;color:var(--muted)">(used for admin sign-in)</span>
              </label>
              <input type="text" id="um-admin-username" name="admin_username" value="${user?.username || ''}" placeholder="e.g. refka_admin" style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">

              <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                ${isEdit ? 'New Password <span style="font-weight:400;color:var(--muted)">(leave blank to keep current)</span>' : 'Password <span style="font-weight:400;color:var(--muted)">(min. 4 characters)</span>'}
              </label>
              <input type="password" id="um-admin-password" name="admin_password" placeholder="${isEdit ? '••••••••' : 'Enter admin password'}" style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">

              <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)">
                Email Address <span style="font-weight:400;color:var(--muted)">(optional)</span>
              </label>
              <input type="email" id="um-admin-email" name="admin_email" value="${user?.email || ''}" placeholder="admin@karyabangsa.sch.id" style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font:14px 'DM Sans',sans-serif;margin-bottom:16px">
            </div>

            <!-- Common Field: Account Status -->
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
                ${ICONS.check} <span id="btn-save-um-text">${roleMeta[selectedRole].btnLabel}</span>
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

  // IN-PLACE ROLE SWITCHING: Never wipes innerHTML, loads smoothly in-place
  const switchRole = (role) => {
    selectedRole = role;
    const meta = roleMeta[role] || roleMeta.students;

    // 1. Header updates
    const iconEl = modalRoot.querySelector('#um-modal-icon');
    const titleEl = modalRoot.querySelector('#user-modal-title');
    const subEl = modalRoot.querySelector('#user-modal-subtitle');
    const saveBtnText = modalRoot.querySelector('#btn-save-um-text');
    const nameHint = modalRoot.querySelector('#um-name-hint');

    if (iconEl) {
      iconEl.style.background = meta.iconBg;
      iconEl.style.color = meta.iconColor;
      iconEl.innerHTML = meta.icon;
    }
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.subtitle;
    if (saveBtnText) saveBtnText.textContent = meta.btnLabel;
    if (nameHint) {
      nameHint.textContent = role === 'authorized_teacher'
        ? '(with academic title)'
        : (role === 'students' ? '(student full name)' : '(administrator name)');
    }

    // 2. Role radio card border and highlight updates
    if (!isEdit) {
      const cardStudents = modalRoot.querySelector('#card-role-students');
      const cardTeacher = modalRoot.querySelector('#card-role-teacher');
      const cardAdmin = modalRoot.querySelector('#card-role-admin');

      if (cardStudents) {
        cardStudents.style.borderColor = role === 'students' ? '#059669' : 'var(--line)';
        cardStudents.style.background = role === 'students' ? '#ecfdf5' : 'var(--white)';
      }
      if (cardTeacher) {
        cardTeacher.style.borderColor = role === 'authorized_teacher' ? 'var(--blue)' : 'var(--line)';
        cardTeacher.style.background = role === 'authorized_teacher' ? '#eff6ff' : 'var(--white)';
      }
      if (cardAdmin) {
        cardAdmin.style.borderColor = role === 'admin_user' ? '#7e22ce' : 'var(--line)';
        cardAdmin.style.background = role === 'admin_user' ? '#faf5ff' : 'var(--white)';
      }
    }

    // 3. Field sections visibility
    const studentFields = modalRoot.querySelector('#um-fields-student');
    const teacherFields = modalRoot.querySelector('#um-fields-teacher');
    const adminFields = modalRoot.querySelector('#um-fields-admin');

    if (studentFields) studentFields.style.display = role === 'students' ? 'block' : 'none';
    if (teacherFields) teacherFields.style.display = role === 'authorized_teacher' ? 'block' : 'none';
    if (adminFields) adminFields.style.display = role === 'admin_user' ? 'block' : 'none';

    // 4. Update input required flags so hidden fields don't prevent form submission
    const studentEmail = modalRoot.querySelector('#um-student-email');
    const studentUnit = modalRoot.querySelector('#um-student-unit');
    const teacherEmail = modalRoot.querySelector('#um-teacher-email');
    const teacherUnit = modalRoot.querySelector('#um-teacher-unit');
    const adminUsername = modalRoot.querySelector('#um-admin-username');
    const adminPassword = modalRoot.querySelector('#um-admin-password');

    if (studentEmail) studentEmail.required = (role === 'students');
    if (studentUnit) studentUnit.required = (role === 'students');
    if (teacherEmail) teacherEmail.required = (role === 'authorized_teacher');
    if (teacherUnit) teacherUnit.required = (role === 'authorized_teacher');
    if (adminUsername) adminUsername.required = (role === 'admin_user');
    if (adminPassword) adminPassword.required = (role === 'admin_user' && !isEdit);

    // 5. Cross-field value retention
    if (role === 'authorized_teacher' && studentEmail && teacherEmail && !teacherEmail.value && studentEmail.value) {
      teacherEmail.value = studentEmail.value;
    } else if (role === 'students' && teacherEmail && studentEmail && !studentEmail.value && teacherEmail.value) {
      studentEmail.value = teacherEmail.value;
    }
    if (role === 'authorized_teacher' && studentUnit && teacherUnit && !teacherUnit.value && studentUnit.value) {
      teacherUnit.value = studentUnit.value;
    } else if (role === 'students' && teacherUnit && studentUnit && !studentUnit.value && teacherUnit.value) {
      studentUnit.value = teacherUnit.value;
    }

    // 6. Clear error alert
    const errEl = modalRoot.querySelector('#um-error');
    if (errEl) errEl.style.display = 'none';
  };

  // Set initial state
  switchRole(selectedRole);

  // Wire radio buttons to switch in-place without page or modal reload
  if (!isEdit) {
    modalRoot.querySelectorAll('input[name="modal-role"]').forEach((radio) => {
      radio.onchange = () => {
        switchRole(radio.value);
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
    const status = modalRoot.querySelector('#um-status')?.value || 'active';

    if (!name) {
      errEl.textContent = 'Please provide full name.';
      errEl.style.display = 'block';
      return;
    }

    // Role 1: Students
    if (selectedRole === 'students') {
      const email = (modalRoot.querySelector('#um-student-email')?.value || '').trim().toLowerCase();
      const unit = (modalRoot.querySelector('#um-student-unit')?.value || '').trim();
      const student_id = (modalRoot.querySelector('#um-student-id')?.value || '').trim();
      const grade = (modalRoot.querySelector('#um-student-grade')?.value || '').trim();

      if (!email || !unit) {
        errEl.textContent = 'Student email and school unit are required.';
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

      const url = isEdit ? `/api/admin/students/${user.id}` : '/api/admin/students';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await request(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, unit, student_id: student_id || null, grade: grade || null, status })
      });

      if (res.error) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `${ICONS.check} <span id="btn-save-um-text">${isEdit ? 'Save Changes' : 'Add Student'}</span>`;
        errEl.textContent = res.error;
        errEl.style.display = 'block';
        return;
      }

      closeModal();
      showToast(isEdit ? `✓ Student "${name}" updated successfully!` : `✓ Student "${name}" registered successfully!`, 'success');
      renderAdmin('users');
    }
    // Role 2: Teacher Candidate
    else if (selectedRole === 'authorized_teacher') {
      const email = (modalRoot.querySelector('#um-teacher-email')?.value || '').trim().toLowerCase();
      const unit = (modalRoot.querySelector('#um-teacher-unit')?.value || '').trim();

      if (!email || !unit) {
        errEl.textContent = 'Official teacher email and school unit are required.';
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

      const url = isEdit ? `/api/admin/teachers/${user.id}` : '/api/admin/teachers';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await request(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, unit, status })
      });

      if (res.error) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `${ICONS.check} <span id="btn-save-um-text">${isEdit ? 'Save Changes' : 'Add Candidate'}</span>`;
        errEl.textContent = res.error;
        errEl.style.display = 'block';
        return;
      }

      closeModal();
      showToast(isEdit ? `✓ Teacher candidate "${name}" updated successfully!` : `✓ Teacher candidate "${name}" added to roster!`, 'success');
      renderAdmin('users');
    }
    // Role 3: Administrator
    else {
      const username = (modalRoot.querySelector('#um-admin-username')?.value || '').trim().toLowerCase();
      const password = (modalRoot.querySelector('#um-admin-password')?.value || '').trim();
      const email = (modalRoot.querySelector('#um-admin-email')?.value || '').trim().toLowerCase();

      if (!username) {
        errEl.textContent = 'Admin username is required.';
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
        saveBtn.innerHTML = `${ICONS.check} <span id="btn-save-um-text">${isEdit ? 'Save Changes' : 'Create Administrator'}</span>`;
        errEl.textContent = res.error;
        errEl.style.display = 'block';
        return;
      }

      closeModal();
      showToast(isEdit ? `✓ Administrator "${name}" updated successfully!` : `✓ Administrator "${name}" created!`, 'success');
      renderAdmin('users');
    }
  };
}

function openBulkUserModal(onSuccess) {
  renderAdmin('bulk-users');
}

async function renderAdminBulkUsersTab(container) {
  let activeRole = 'students';
  let activeUploadTab = 'csv';
  let parsedUsers = [];
  let selectedUnit = '';
  let selectedFileName = '';

  const schoolDomain = 'karyabangsa.sch.id';

  const getTemplates = () => {
    if (activeRole === 'students') {
      const csv = `student_id,name,email,unit,grade,status\r\n202601001,Ananda Pratama,ananda@${schoolDomain},SMA KARYA BANGSA,Kelas 10-A,active\r\n202601002,Clarissa Putri,clarissa@${schoolDomain},SMA KARYA BANGSA,Kelas 10-A,active\r\n202601003,Dimas Anggara,dimas@${schoolDomain},SMA KARYA BANGSA,Kelas 10-B,active`;
      const json = JSON.stringify([
        { student_id: '202601001', name: 'Ananda Pratama', email: `ananda@${schoolDomain}`, unit: selectedUnit || 'SMA KARYA BANGSA', grade: 'Kelas 10-A', status: 'active' },
        { student_id: '202601002', name: 'Clarissa Putri', email: `clarissa@${schoolDomain}`, unit: selectedUnit || 'SMA KARYA BANGSA', grade: 'Kelas 10-A', status: 'active' },
        { student_id: '202601003', name: 'Dimas Anggara', email: `dimas@${schoolDomain}`, unit: selectedUnit || 'SMA KARYA BANGSA', grade: 'Kelas 10-B', status: 'active' }
      ], null, 2);
      return { csv, json };
    } else if (activeRole === 'authorized_teacher') {
      const csv = `name,email,unit,status\r\nBudi Santoso,budi.santoso@${schoolDomain},SMA KARYA BANGSA,active\r\nSiti Rahmawati,siti.rahma@${schoolDomain},SMA KARYA BANGSA,active\r\nAhmad Fauzi,ahmad.fauzi@${schoolDomain},SMA KARYA BANGSA,active`;
      const json = JSON.stringify([
        { name: 'Budi Santoso', email: `budi.santoso@${schoolDomain}`, unit: selectedUnit || 'SMA KARYA BANGSA', status: 'active' },
        { name: 'Siti Rahmawati', email: `siti.rahma@${schoolDomain}`, unit: selectedUnit || 'SMA KARYA BANGSA', status: 'active' },
        { name: 'Ahmad Fauzi', email: `ahmad.fauzi@${schoolDomain}`, unit: selectedUnit || 'SMA KARYA BANGSA', status: 'active' }
      ], null, 2);
      return { csv, json };
    } else {
      const csv = `username,name,email,password,status\r\nadmin_smp,Dewi Lestari,dewi.admin@${schoolDomain},admin123,active\r\nadmin_sma,Fajar Nugraha,fajar.admin@${schoolDomain},admin123,active`;
      const json = JSON.stringify([
        { username: 'admin_smp', name: 'Dewi Lestari', email: `dewi.admin@${schoolDomain}`, password: 'password123', status: 'active' },
        { username: 'admin_sma', name: 'Fajar Nugraha', email: `fajar.admin@${schoolDomain}`, password: 'password123', status: 'active' }
      ], null, 2);
      return { csv, json };
    }
  };

  function triggerDownload(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function parseCSVText(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map((c) => c.replace(/^["']|["']$/g, '').trim());
    };

    const headers = parseLine(firstLine).map((h) => h.toLowerCase());
    const nameIdx = headers.findIndex((h) => ['name', 'nama', 'fullname', 'full name', 'nama lengkap'].includes(h));
    const emailIdx = headers.findIndex((h) => ['email', 'email address', 'surel'].includes(h));
    const unitIdx = headers.findIndex((h) => ['unit', 'sekolah', 'school unit'].includes(h));
    const statusIdx = headers.findIndex((h) => ['status'].includes(h));
    const studentIdIdx = headers.findIndex((h) => ['student_id', 'nisn', 'nis', 'no_induk', 'id'].includes(h));
    const gradeIdx = headers.findIndex((h) => ['grade', 'kelas', 'class', 'tingkat'].includes(h));
    const usernameIdx = headers.findIndex((h) => ['username', 'user', 'login'].includes(h));
    const passwordIdx = headers.findIndex((h) => ['password', 'pass', 'pwd'].includes(h));

    const users = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

      if (activeRole === 'admin_user') {
        const username = usernameIdx !== -1 ? cols[usernameIdx] : (cols[0] || '');
        const name = nameIdx !== -1 ? cols[nameIdx] : (cols[1] || username);
        const email = emailIdx !== -1 ? cols[emailIdx] : '';
        const password = passwordIdx !== -1 ? cols[passwordIdx] : 'admin123';
        const status = statusIdx !== -1 ? cols[statusIdx] : 'active';
        if (username && name) {
          users.push({ username, name, email, password, status });
        }
      } else {
        const name = nameIdx !== -1 ? cols[nameIdx] : cols[0];
        const email = emailIdx !== -1 ? cols[emailIdx] : (cols[1] || '');
        const unit = unitIdx !== -1 ? cols[unitIdx] : selectedUnit;
        const status = statusIdx !== -1 ? cols[statusIdx] : 'active';
        const student_id = studentIdIdx !== -1 ? cols[studentIdIdx] : null;
        const grade = gradeIdx !== -1 ? cols[gradeIdx] : null;
        if (name && email) {
          users.push({ name, email, unit, status, student_id, grade });
        }
      }
    }
    return users;
  }

  function parseJSONText(text) {
    try {
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : (data.users || data.students || data.teachers || data.admins || []);
      return arr.map((u) => {
        if (activeRole === 'admin_user') {
          return {
            username: String(u.username || u.user || '').toLowerCase().trim(),
            name: String(u.name || u.Nama || u.fullName || u.username || '').trim(),
            email: String(u.email || u.Email || '').toLowerCase().trim(),
            password: String(u.password || 'admin123').trim(),
            status: String(u.status || 'active').toLowerCase().trim()
          };
        }
        return {
          name: String(u.name || u.Nama || u.fullName || u['Nama Lengkap'] || '').trim(),
          email: String(u.email || u.Email || u['Email Address'] || '').toLowerCase().trim(),
          unit: String(u.unit || u.Unit || selectedUnit || '').trim(),
          status: String(u.status || 'active').toLowerCase().trim(),
          student_id: u.student_id || u.nisn || u.NISN || null,
          grade: u.grade || u.kelas || u.Kelas || null
        };
      }).filter((u) => (activeRole === 'admin_user' ? (u.username && u.name) : (u.name && u.email)));
    } catch {
      return [];
    }
  }

  const renderModule = () => {
    const roleBadges = {
      students: { name: 'Student Accounts', color: '#059669', bg: '#ecfdf5', icon: '🧑‍🎓' },
      authorized_teacher: { name: 'Teacher Candidates', color: '#2563eb', bg: '#eff6ff', icon: '👨‍🏫' },
      admin_user: { name: 'Administrators', color: '#7e22ce', bg: '#faf5ff', icon: '🛡️' }
    };

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:24px">
        <div>
          <div class="eyebrow">School Administration</div>
          <h1 style="font:700 32px 'Space Grotesk';margin:6px 0 4px;color:var(--ink)">Bulk User Import</h1>
          <p style="color:var(--muted);font-size:14px;margin:0">Dedicated bulk management module: import students, teacher candidates, or administrators via CSV or JSON files.</p>
        </div>
      </div>

      <!-- 2-Column Responsive Setup Grid -->
      <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:24px;margin-bottom:24px" class="bulk-import-layout">
        
        <!-- Left Column: Step Workflow -->
        <div class="panel" style="padding:24px 28px;background:#ffffff;border-radius:16px;border:1px solid var(--line)">
          
          <!-- STEP 1: Select School Unit -->
          <div style="margin-bottom:22px">
            <label for="bulk-unit-select" style="display:flex;align-items:center;justify-content:space-between;font-size:13.5px;font-weight:700;color:#0f172a;margin-bottom:8px">
              <span style="display:flex;align-items:center;gap:8px">
                <span style="display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#2563eb;color:#fff;font-size:12px;font-weight:700">1</span>
                Select School Unit First *
              </span>
              <span style="font-size:11.5px;font-weight:600;color:#2563eb;background:#eff6ff;padding:2px 8px;border-radius:10px">Required</span>
            </label>
            <select id="bulk-unit-select" class="select-filter" style="width:100%;padding:11px 14px;border:1.5px solid #cbd5e1;border-radius:10px;font:14px 'DM Sans',sans-serif;background:#ffffff">
              <option value="" disabled ${!selectedUnit ? 'selected' : ''}>-- Select Assigned School Unit --</option>
              <option value="KB-TK GOLDEN BEE" ${selectedUnit === 'KB-TK GOLDEN BEE' ? 'selected' : ''}>KB-TK GOLDEN BEE</option>
              <option value="SD KARYA BANGSA" ${selectedUnit === 'SD KARYA BANGSA' ? 'selected' : ''}>SD KARYA BANGSA</option>
              <option value="SMP KARYA BANGSA" ${selectedUnit === 'SMP KARYA BANGSA' ? 'selected' : ''}>SMP KARYA BANGSA</option>
              <option value="SMA KARYA BANGSA" ${selectedUnit === 'SMA KARYA BANGSA' ? 'selected' : ''}>SMA KARYA BANGSA</option>
              <option value="SMK KARYA BANGSA" ${selectedUnit === 'SMK KARYA BANGSA' ? 'selected' : ''}>SMK KARYA BANGSA</option>
            </select>
            <div style="font-size:12px;color:#64748b;margin-top:6px">
              All imported accounts will automatically be assigned to this target school unit.
            </div>
          </div>

          <!-- STEP 2: Select Role -->
          <div style="margin-bottom:22px">
            <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;color:#0f172a;margin-bottom:10px">
              <span style="display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#2563eb;color:#fff;font-size:12px;font-weight:700">2</span>
              Select Target User Role *
            </label>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
              <label id="role-btn-students" class="role-select-card" style="display:flex;flex-direction:column;gap:4px;padding:12px 14px;border:1.5px solid ${activeRole === 'students' ? '#059669' : '#e2e8f0'};border-radius:10px;cursor:pointer;background:${activeRole === 'students' ? '#ecfdf5' : '#ffffff'};transition:all 0.2s ease">
                <div style="display:flex;align-items:center;gap:6px">
                  <input type="radio" name="bulk-target-role" value="students" ${activeRole === 'students' ? 'checked' : ''} style="accent-color:#059669">
                  <span style="font-size:15px">🧑‍🎓</span>
                  <strong style="font-size:13px;color:#0f172a">Students</strong>
                </div>
                <span style="font-size:11px;color:#64748b;padding-left:22px">Enrolled Students</span>
              </label>

              <label id="role-btn-teachers" class="role-select-card" style="display:flex;flex-direction:column;gap:4px;padding:12px 14px;border:1.5px solid ${activeRole === 'authorized_teacher' ? '#2563eb' : '#e2e8f0'};border-radius:10px;cursor:pointer;background:${activeRole === 'authorized_teacher' ? '#eff6ff' : '#ffffff'};transition:all 0.2s ease">
                <div style="display:flex;align-items:center;gap:6px">
                  <input type="radio" name="bulk-target-role" value="authorized_teacher" ${activeRole === 'authorized_teacher' ? 'checked' : ''} style="accent-color:#2563eb">
                  <span style="font-size:15px">👨‍🏫</span>
                  <strong style="font-size:13px;color:#0f172a">Teachers</strong>
                </div>
                <span style="font-size:11px;color:#64748b;padding-left:22px">Educators & Candidates</span>
              </label>

              <label id="role-btn-admins" class="role-select-card" style="display:flex;flex-direction:column;gap:4px;padding:12px 14px;border:1.5px solid ${activeRole === 'admin_user' ? '#7e22ce' : '#e2e8f0'};border-radius:10px;cursor:pointer;background:${activeRole === 'admin_user' ? '#faf5ff' : '#ffffff'};transition:all 0.2s ease">
                <div style="display:flex;align-items:center;gap:6px">
                  <input type="radio" name="bulk-target-role" value="admin_user" ${activeRole === 'admin_user' ? 'checked' : ''} style="accent-color:#7e22ce">
                  <span style="font-size:15px">🛡️</span>
                  <strong style="font-size:13px;color:#0f172a">Admins</strong>
                </div>
                <span style="font-size:11px;color:#64748b;padding-left:22px">Administrator Portal</span>
              </label>
            </div>
          </div>

          <!-- STEP 3: Choose Format & Upload -->
          <div>
            <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;color:#0f172a;margin-bottom:10px">
              <span style="display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#2563eb;color:#fff;font-size:12px;font-weight:700">3</span>
              Format & Upload Method (CSV or JSON) *
            </label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
              <button type="button" class="btn-bulk-method ${activeUploadTab === 'csv' ? 'active' : ''}" id="bulk-method-csv" style="padding:10px;border-radius:8px;border:1.5px solid ${activeUploadTab === 'csv' ? '#2563eb' : '#cbd5e1'};background:${activeUploadTab === 'csv' ? '#eff6ff' : '#fff'};font-weight:600;font-size:13px;cursor:pointer">
                📄 CSV File (.csv)
              </button>
              <button type="button" class="btn-bulk-method ${activeUploadTab === 'json' ? 'active' : ''}" id="bulk-method-json" style="padding:10px;border-radius:8px;border:1.5px solid ${activeUploadTab === 'json' ? '#2563eb' : '#cbd5e1'};background:${activeUploadTab === 'json' ? '#eff6ff' : '#fff'};font-weight:600;font-size:13px;cursor:pointer">
                📋 JSON File (.json)
              </button>
            </div>

            <!-- Drag & Drop Zone -->
            <div id="bulk-page-dropzone" class="bulk-drop-zone" style="border:2px dashed #94a3b8;border-radius:12px;padding:28px 20px;text-align:center;background:#f8fafc;cursor:pointer">
              <input type="file" id="bulk-page-file-input" accept="${activeUploadTab === 'csv' ? '.csv,text/csv' : '.json,application/json'}" style="display:none">
              <div style="font-size:36px;margin-bottom:8px">📂</div>
              <div style="font-weight:700;font-size:14.5px;color:#0f172a;margin-bottom:4px">
                Drag & drop ${activeUploadTab.toUpperCase()} file here or <span style="color:#2563eb;text-decoration:underline">Browse from Computer</span>
              </div>
              <div style="font-size:12px;color:#64748b">
                ${activeUploadTab === 'csv' ? 'Supports .csv format (comma or semicolon delimited, UTF-8 encoding)' : 'Supports valid .json files with an array of objects'}
              </div>
              ${selectedFileName ? `
                <div style="display:inline-flex;margin-top:12px;padding:6px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;font-size:12.5px;color:#1e40af;font-weight:600;align-items:center;gap:6px">
                  <span>📄 ${selectedFileName} (${parsedUsers.length} accounts detected)</span>
                  <button type="button" id="btn-clear-file" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:14px;padding:0 4px">✕</button>
                </div>
              ` : ''}
            </div>
          </div>

        </div>

        <!-- Right Column: Panduan & Download Template -->
        <div class="panel" style="padding:24px 28px;background:#f8fafc;border-radius:16px;border:1px solid #e2e8f0;display:flex;flex-direction:column;justify-content:space-between">
          <div>
            <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;color:#1e293b;margin-bottom:12px">
              <span style="color:#f59e0b;font-size:18px">💡</span>
              <span>File Format Guide (${roleBadges[activeRole].name})</span>
            </div>

            ${activeRole === 'students' ? `
              <ul style="margin:0 0 16px 18px;padding:0;font-size:13px;color:#475569;line-height:1.65">
                <li><strong>Required Fields:</strong> <code>name</code> (Full Name) and <code>email</code> (Official student email <code>@${schoolDomain}</code>).</li>
                <li><strong>Optional Fields:</strong> <code>student_id</code> (NISN / Student ID), <code>grade</code> (Class/Grade, e.g. 10-A), <code>unit</code>, and <code>status</code> (default: <code>active</code>).</li>
                <li><strong>CSV Format:</strong> Header row: <code>student_id,name,email,unit,grade,status</code>.</li>
                <li><strong>JSON Format:</strong> Array of objects, e.g. <code>[{"student_id":"...", "name":"...", "email":"..."}]</code>.</li>
              </ul>
            ` : (activeRole === 'authorized_teacher' ? `
              <ul style="margin:0 0 16px 18px;padding:0;font-size:13px;color:#475569;line-height:1.65">
                <li><strong>Required Fields:</strong> <code>name</code> (Teacher Name + Academic Title) and <code>email</code> (Official school email <code>@${schoolDomain}</code>).</li>
                <li><strong>Optional Fields:</strong> <code>unit</code> (School unit name) and <code>status</code> (default: <code>active</code>).</li>
                <li><strong>CSV Format:</strong> Header row: <code>name,email,unit,status</code>.</li>
                <li><strong>JSON Format:</strong> Array of objects, e.g. <code>[{"name":"...", "email":"..."}]</code>.</li>
              </ul>
            ` : `
              <ul style="margin:0 0 16px 18px;padding:0;font-size:13px;color:#475569;line-height:1.65">
                <li><strong>Required Fields:</strong> <code>username</code> (Used for admin login) and <code>name</code> (Admin Full Name).</li>
                <li><strong>Optional Fields:</strong> <code>password</code> (Min 4 chars, default: admin123), <code>email</code>, and <code>status</code>.</li>
                <li><strong>CSV Format:</strong> Header row: <code>username,name,email,password,status</code>.</li>
                <li><strong>JSON Format:</strong> Array of objects, e.g. <code>[{"username":"...", "name":"...", "password":"..."}]</code>.</li>
              </ul>
            `)}

            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:16px">
              <div style="font-weight:700;font-size:12px;color:#0f172a;margin-bottom:4px">Character Encoding Note</div>
              <div style="font-size:12px;color:#64748b">
                Save files with <strong>UTF-8</strong> encoding to preserve special characters and academic titles properly.
              </div>
            </div>
          </div>

          <!-- Download Template Buttons -->
          <div style="border-top:1px dashed #cbd5e1;padding-top:16px">
            <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:10px">Download Ready-to-Use Templates:</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button type="button" class="button button-sm" id="btn-bulk-dl-csv" style="background:#0284c7;color:#fff;font-size:12.5px;padding:8px 14px;border-radius:8px;display:inline-flex;align-items:center;gap:6px">
                ${ICONS.download} <span>Download CSV Template</span>
              </button>
              <button type="button" class="button button-sm" id="btn-bulk-dl-json" style="background:#334155;color:#fff;font-size:12.5px;padding:8px 14px;border-radius:8px;display:inline-flex;align-items:center;gap:6px">
                ${ICONS.download} <span>Download JSON Template</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      <!-- Preview Table & Submission Bar -->
      <div class="panel" style="padding:24px 28px;background:#ffffff;border-radius:16px;border:1px solid var(--line);margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
          <div>
            <h3 style="font:700 18px 'Space Grotesk';margin:0;color:#0f172a">
              Live Data Preview (${parsedUsers.length} candidate accounts detected)
            </h3>
            <p style="font-size:13px;color:#64748b;margin:2px 0 0">
              Review parsed data below before importing to the database.
            </p>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:12.5px;font-weight:600;padding:5px 12px;border-radius:20px;background:${selectedUnit ? '#ecfdf5' : '#fef2f2'};color:${selectedUnit ? '#047857' : '#b91c1c'};border:1px solid ${selectedUnit ? '#a7f3d0' : '#fecaca'}">
              ${selectedUnit ? `✓ Target Unit: ${selectedUnit}` : '⚠️ Select school unit in Step 1'}
            </span>
          </div>
        </div>

        <!-- Table Container -->
        <div class="table-responsive" style="max-height:300px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:20px">
          <table style="width:100%;font-size:13px">
            <thead style="background:#f8fafc;position:sticky;top:0;z-index:2">
              <tr>
                <th style="padding:10px 14px;text-align:left;width:50px">#</th>
                <th style="padding:10px 14px;text-align:left">${activeRole === 'admin_user' ? 'Username' : 'Full Name'}</th>
                <th style="padding:10px 14px;text-align:left">${activeRole === 'admin_user' ? 'Full Name' : 'Email'}</th>
                ${activeRole === 'students' ? `<th style="padding:10px 14px;text-align:left">Student ID / Grade</th>` : ''}
                <th style="padding:10px 14px;text-align:left">School Unit</th>
                <th style="padding:10px 14px;text-align:left">Status</th>
              </tr>
            </thead>
            <tbody>
              ${parsedUsers.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align:center;padding:36px 16px;color:#64748b">
                    <div style="font-size:28px;margin-bottom:6px">📁</div>
                    <div style="font-weight:600;font-size:14px;color:#0f172a">No file uploaded yet</div>
                    <div style="font-size:12.5px;color:#64748b;margin-top:2px">Please upload a CSV or JSON file in Step 3 above.</div>
                  </td>
                </tr>
              ` : parsedUsers.slice(0, 20).map((u, idx) => `
                <tr style="border-bottom:1px solid #f1f5f9">
                  <td style="padding:10px 14px;color:#64748b">${idx + 1}</td>
                  <td style="padding:10px 14px;font-weight:600;color:#0f172a">${activeRole === 'admin_user' ? `@${u.username}` : u.name}</td>
                  <td style="padding:10px 14px;color:#2563eb">${activeRole === 'admin_user' ? u.name : u.email}</td>
                  ${activeRole === 'students' ? `
                    <td style="padding:10px 14px;color:#047857;font-family:monospace;font-size:12px">
                      ${u.student_id ? `ID: ${u.student_id}` : '-'}${u.grade ? ` · ${u.grade}` : ''}
                    </td>
                  ` : ''}
                  <td style="padding:10px 14px;color:#475569">${u.unit || selectedUnit || '-'}</td>
                  <td style="padding:10px 14px">
                    <span style="background:#dcfce7;color:#166534;padding:3px 8px;border-radius:10px;font-size:11.5px;font-weight:600">
                      ${u.status || 'active'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${parsedUsers.length > 20 ? `
          <div style="font-size:12.5px;color:#64748b;text-align:center;margin-bottom:16px">
            Showing first 20 of <strong>${parsedUsers.length}</strong> accounts detected. All rows will be processed when clicking Import.
          </div>
        ` : ''}

        <!-- Error Alert -->
        <div id="bulk-page-error" style="display:none;padding:12px 16px;background:#fef2f2;border:1.5px solid #fecaca;border-radius:10px;font-size:13px;color:#dc2626;margin-bottom:16px"></div>

        <!-- Submission Buttons -->
        <div style="display:flex;justify-content:flex-end;gap:12px;align-items:center">
          ${parsedUsers.length > 0 ? `
            <button type="button" class="button ghost" id="btn-reset-bulk-data" style="padding:10px 18px">
              Reset Data
            </button>
          ` : ''}
          <button type="button" class="button" id="btn-execute-bulk-import" ${(!selectedUnit || parsedUsers.length === 0) ? 'disabled' : ''} style="padding:11px 26px;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:8px;background:${(!selectedUnit || parsedUsers.length === 0) ? '#94a3b8' : '#2563eb'};color:#ffffff">
            ${ICONS.upload}
            <span id="btn-execute-text">
              ${parsedUsers.length > 0 ? `Import ${parsedUsers.length} ${roleBadges[activeRole].name} to Database` : 'Import to Database'}
            </span>
          </button>
        </div>

      </div>
    `;

    bindModuleEvents();
  };

  const bindModuleEvents = () => {
    const backBtn = container.querySelector('#btn-back-to-users');
    const unitSelect = container.querySelector('#bulk-unit-select');
    const methodCsvBtn = container.querySelector('#bulk-method-csv');
    const methodJsonBtn = container.querySelector('#bulk-method-json');
    const dropzone = container.querySelector('#bulk-page-dropzone');
    const fileInput = container.querySelector('#bulk-page-file-input');
    const dlCsvBtn = container.querySelector('#btn-bulk-dl-csv');
    const dlJsonBtn = container.querySelector('#btn-bulk-dl-json');
    const submitBtn = container.querySelector('#btn-execute-bulk-import');
    const resetBtn = container.querySelector('#btn-reset-bulk-data');
    const errorAlert = container.querySelector('#bulk-page-error');
    const clearFileBtn = container.querySelector('#btn-clear-file');

    if (backBtn) backBtn.onclick = () => renderAdmin('users');

    if (unitSelect) {
      unitSelect.onchange = (e) => {
        selectedUnit = e.target.value;
        renderModule();
      };
    }

    container.querySelectorAll('input[name="bulk-target-role"]').forEach((r) => {
      r.onchange = () => {
        activeRole = r.value;
        parsedUsers = [];
        selectedFileName = '';
        renderModule();
      };
    });

    if (methodCsvBtn) {
      methodCsvBtn.onclick = () => {
        activeUploadTab = 'csv';
        renderModule();
      };
    }
    if (methodJsonBtn) {
      methodJsonBtn.onclick = () => {
        activeUploadTab = 'json';
        renderModule();
      };
    }

    if (dlCsvBtn) {
      dlCsvBtn.onclick = () => {
        const { csv } = getTemplates();
        triggerDownload(csv, `assessify_bulk_${activeRole}_template.csv`, 'text/csv;charset=utf-8;');
      };
    }
    if (dlJsonBtn) {
      dlJsonBtn.onclick = () => {
        const { json } = getTemplates();
        triggerDownload(json, `assessify_bulk_${activeRole}_template.json`, 'application/json');
      };
    }

    const processFile = (content, fileName) => {
      selectedFileName = fileName;
      let users = [];
      if (activeUploadTab === 'csv') {
        users = parseCSVText(content);
      } else {
        users = parseJSONText(content);
      }

      if (users.length === 0) {
        if (errorAlert) {
          errorAlert.textContent = `File "${fileName}" does not contain a valid format for "${activeRole}". Please check the header columns according to the guide.`;
          errorAlert.style.display = 'block';
        }
        parsedUsers = [];
      } else {
        parsedUsers = users;
      }
      renderModule();
    };

    if (dropzone && fileInput) {
      dropzone.onclick = (e) => {
        if (e.target.id === 'btn-clear-file') return;
        fileInput.click();
      };
      dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#2563eb';
        dropzone.style.background = '#eff6ff';
      };
      dropzone.ondragleave = () => {
        dropzone.style.borderColor = '#94a3b8';
        dropzone.style.background = '#f8fafc';
      };
      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#94a3b8';
        dropzone.style.background = '#f8fafc';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          const reader = new FileReader();
          reader.onload = (evt) => processFile(evt.target.result, file.name);
          reader.readAsText(file);
        }
      };
      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (evt) => processFile(evt.target.result, file.name);
          reader.readAsText(file);
        }
      };
    }

    if (clearFileBtn) {
      clearFileBtn.onclick = (e) => {
        e.stopPropagation();
        parsedUsers = [];
        selectedFileName = '';
        renderModule();
      };
    }

    if (resetBtn) {
      resetBtn.onclick = () => {
        parsedUsers = [];
        selectedFileName = '';
        renderModule();
      };
    }

    if (submitBtn) {
      submitBtn.onclick = async () => {
        if (!selectedUnit) {
          if (errorAlert) {
            errorAlert.textContent = 'Please select a school unit first in Step 1.';
            errorAlert.style.display = 'block';
          }
          return;
        }
        if (parsedUsers.length === 0) {
          if (errorAlert) {
            errorAlert.textContent = 'No valid account data found to import.';
            errorAlert.style.display = 'block';
          }
          return;
        }

        submitBtn.disabled = true;
        const textSpan = container.querySelector('#btn-execute-text');
        if (textSpan) textSpan.textContent = 'Importing data into database…';

        try {
          let endpoint = '/api/admin/teachers/bulk';
          let payload = { unit: selectedUnit, teachers: parsedUsers };

          if (activeRole === 'students') {
            endpoint = '/api/admin/students/bulk';
            payload = { unit: selectedUnit, students: parsedUsers };
          } else if (activeRole === 'admin_user') {
            endpoint = '/api/admin/admins/bulk';
            payload = { admins: parsedUsers };
          }

          const res = await request(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.error) {
            submitBtn.disabled = false;
            if (textSpan) textSpan.textContent = `Import ${parsedUsers.length} Accounts to Database`;
            if (errorAlert) {
              errorAlert.textContent = res.error;
              errorAlert.style.display = 'block';
            }
            return;
          }

          showToast(`✓ Successfully processed ${res.total || parsedUsers.length} accounts (${res.added || 0} added, ${res.updated || 0} updated)!`, 'success', 5000);
          renderAdmin('users');
        } catch (err) {
          submitBtn.disabled = false;
          if (textSpan) textSpan.textContent = `Import ${parsedUsers.length} Accounts to Database`;
          if (errorAlert) {
            errorAlert.textContent = `Failed to save to database: ${err.message}`;
            errorAlert.style.display = 'block';
          }
        }
      };
    }
  };

  renderModule();
}

function openDeleteUserModal(user) {
  const modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) return;

  const isAdminUser = user.role === 'admin' || user.role === 'admin_user';
  const isStudent = user.role === 'students' || user.role === 'student';

  let roleLabel = 'Teacher Candidate';
  let deleteUrl = `/api/admin/teachers/${user.id}`;
  let warningText = 'This candidate will no longer be authorized to take placement assessments.';

  if (isAdminUser) {
    roleLabel = 'Administrator';
    deleteUrl = `/api/admin/admins/${user.id}`;
    warningText = 'This administrator will permanently lose access to the administration portal.';
  } else if (isStudent) {
    roleLabel = 'Student Account';
    deleteUrl = `/api/admin/students/${user.id}`;
    warningText = 'This student account will be permanently removed from the assessment roster.';
  }

  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="delete-user-modal-backdrop">
      <div class="modal-card" style="max-width:480px" role="dialog" aria-modal="true" aria-labelledby="delete-um-title">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <div class="modal-icon" style="background:rgba(220,38,38,0.1);color:#dc2626">${ICONS.trash}</div>
            <div>
              <h2 id="delete-um-title" style="margin:0;color:#dc2626">Delete ${roleLabel}</h2>
              <p style="margin:2px 0 0;font-size:13px;color:var(--muted)">Remove user account from system</p>
            </div>
          </div>
          <button class="modal-close" id="close-delete-um" type="button" aria-label="Close modal">✕</button>
        </div>
        <div class="modal-body" style="padding:20px 24px">
          <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:var(--ink)">
            Are you sure you want to remove ${roleLabel.toLowerCase()} <strong>${user.name}</strong> (${isAdminUser ? `@${user.username}` : user.email})?
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;padding:12px 14px;border-radius:8px;font-size:13px;color:#991b1b;margin-bottom:20px">
            ⚠️ <strong>Warning:</strong> ${warningText}
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

    const res = await request(deleteUrl, { method: 'DELETE' });
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

function openSuspendUserModal(user, onStatusChanged) {
  const modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) return;

  const isAdminUser = user.role === 'admin' || user.role === 'admin_user';
  const isStudent = user.role === 'students' || user.role === 'student';

  let roleLabel = 'Teacher Candidate';
  let statusUrl = `/api/admin/teachers/${user.id}/status`;
  let warningText = 'This candidate will no longer be authorized to take placement assessments.';

  if (isAdminUser) {
    roleLabel = 'Administrator';
    statusUrl = `/api/admin/admins/${user.id}/status`;
    warningText = 'This administrator will temporarily lose access to the administration portal until reactivated.';
  } else if (isStudent) {
    roleLabel = 'Student Account';
    statusUrl = `/api/admin/students/${user.id}/status`;
    warningText = 'This student account will temporarily be unable to take placement assessments.';
  }

  const pauseIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="10" y1="15" x2="10" y2="9"></line><line x1="14" y1="15" x2="14" y2="9"></line></svg>`;
  const pauseBtnIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="10" y1="15" x2="10" y2="9"></line><line x1="14" y1="15" x2="14" y2="9"></line></svg>`;

  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="suspend-user-modal-backdrop">
      <div class="modal-card" style="max-width:480px" role="dialog" aria-modal="true" aria-labelledby="suspend-um-title">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <div class="modal-icon" style="background:rgba(217,119,6,0.12);color:#d97706">${pauseIcon}</div>
            <div>
              <h2 id="suspend-um-title" style="margin:0;color:#d97706">Suspend ${roleLabel}</h2>
              <p style="margin:2px 0 0;font-size:13px;color:var(--muted)">Temporarily restrict user access</p>
            </div>
          </div>
          <button class="modal-close" id="close-suspend-um" type="button" aria-label="Close modal">✕</button>
        </div>
        <div class="modal-body" style="padding:20px 24px">
          <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:var(--ink)">
            Are you sure you want to suspend ${roleLabel.toLowerCase()} <strong>${user.name}</strong> (${isAdminUser ? `@${user.username}` : user.email})?
          </p>
          <div style="background:#fffbeb;border:1px solid #fde68a;padding:12px 14px;border-radius:8px;font-size:13px;color:#92400e;margin-bottom:20px">
            ⚠️ <strong>Warning:</strong> ${warningText}
          </div>
          <div id="suspend-um-error" style="color:#dc2626;font-size:13px;font-weight:600;display:none;margin-bottom:12px"></div>
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button type="button" class="button ghost" id="btn-cancel-suspend-um" style="padding:10px 18px">Cancel</button>
            <button type="button" class="button" id="btn-confirm-suspend-um" style="padding:10px 20px;background:#d97706;border-color:#d97706;color:#ffffff;display:flex;align-items:center;gap:6px">
              ${pauseBtnIcon} <span>Confirm Suspend</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalRoot.innerHTML = ''; };
  modalRoot.querySelector('#close-suspend-um').onclick = closeModal;
  modalRoot.querySelector('#btn-cancel-suspend-um').onclick = closeModal;
  modalRoot.querySelector('#suspend-user-modal-backdrop').onclick = (e) => {
    if (e.target.id === 'suspend-user-modal-backdrop') closeModal();
  };

  const confirmBtn = modalRoot.querySelector('#btn-confirm-suspend-um');
  const errEl = modalRoot.querySelector('#suspend-um-error');

  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Suspending…';

    const res = await request(statusUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'suspended' })
    });

    if (res.error) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `${pauseBtnIcon} <span>Confirm Suspend</span>`;
      errEl.textContent = res.error;
      errEl.style.display = 'block';
      return;
    }

    closeModal();
    user.status = 'suspended';
    showToast(`✓ Account "${user.name}" marked as suspended.`, 'success');
    if (typeof onStatusChanged === 'function') {
      onStatusChanged();
    } else {
      renderAdmin('users');
    }
  };
}

function openArchiveUserModal(user, onStatusChanged) {
  const modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) return;

  const isAdminUser = user.role === 'admin' || user.role === 'admin_user';
  const isStudent = user.role === 'students' || user.role === 'student';

  let roleLabel = 'Teacher Candidate';
  let statusUrl = `/api/admin/teachers/${user.id}/status`;
  let warningText = 'This candidate account will be archived and deactivated from active testing rosters. Historical assessment records will remain preserved.';

  if (isAdminUser) {
    roleLabel = 'Administrator';
    statusUrl = `/api/admin/admins/${user.id}/status`;
    warningText = 'This administrator account will be moved to archives and access permissions will be revoked.';
  } else if (isStudent) {
    roleLabel = 'Student Account';
    statusUrl = `/api/admin/students/${user.id}/status`;
    warningText = 'This student account will be archived and removed from active rosters. Assessment history will remain preserved.';
  }

  const archiveIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`;
  const archiveBtnIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`;

  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="archive-user-modal-backdrop">
      <div class="modal-card" style="max-width:480px" role="dialog" aria-modal="true" aria-labelledby="archive-um-title">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <div class="modal-icon" style="background:rgba(71,85,105,0.12);color:#475569">${archiveIcon}</div>
            <div>
              <h2 id="archive-um-title" style="margin:0;color:#334155">Archive ${roleLabel}</h2>
              <p style="margin:2px 0 0;font-size:13px;color:var(--muted)">Move user account to archived records</p>
            </div>
          </div>
          <button class="modal-close" id="close-archive-um" type="button" aria-label="Close modal">✕</button>
        </div>
        <div class="modal-body" style="padding:20px 24px">
          <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:var(--ink)">
            Are you sure you want to archive ${roleLabel.toLowerCase()} <strong>${user.name}</strong> (${isAdminUser ? `@${user.username}` : user.email})?
          </p>
          <div style="background:#f8fafc;border:1px solid #cbd5e1;padding:12px 14px;border-radius:8px;font-size:13px;color:#334155;margin-bottom:20px">
            📦 <strong>Notice:</strong> ${warningText}
          </div>
          <div id="archive-um-error" style="color:#dc2626;font-size:13px;font-weight:600;display:none;margin-bottom:12px"></div>
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button type="button" class="button ghost" id="btn-cancel-archive-um" style="padding:10px 18px">Cancel</button>
            <button type="button" class="button" id="btn-confirm-archive-um" style="padding:10px 20px;background:#475569;border-color:#475569;color:#ffffff;display:flex;align-items:center;gap:6px">
              ${archiveBtnIcon} <span>Confirm Archive</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalRoot.innerHTML = ''; };
  modalRoot.querySelector('#close-archive-um').onclick = closeModal;
  modalRoot.querySelector('#btn-cancel-archive-um').onclick = closeModal;
  modalRoot.querySelector('#archive-user-modal-backdrop').onclick = (e) => {
    if (e.target.id === 'archive-user-modal-backdrop') closeModal();
  };

  const confirmBtn = modalRoot.querySelector('#btn-confirm-archive-um');
  const errEl = modalRoot.querySelector('#archive-um-error');

  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Archiving…';

    const res = await request(statusUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' })
    });

    if (res.error) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `${archiveBtnIcon} <span>Confirm Archive</span>`;
      errEl.textContent = res.error;
      errEl.style.display = 'block';
      return;
    }

    closeModal();
    user.status = 'archived';
    showToast(`✓ Account "${user.name}" marked as archived.`, 'success');
    if (typeof onStatusChanged === 'function') {
      onStatusChanged();
    } else {
      renderAdmin('users');
    }
  };
}

function openBulkDeleteUsersModal(targets, findUser) {
  const modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) return;

  const names = targets.map((t) => {
    const u = typeof findUser === 'function' ? findUser(t.id, t.role) : null;
    return u ? `${u.name} (${u.role === 'admin' ? `@${u.username}` : u.email || u.unit || 'Candidate'})` : `${t.role} #${t.id}`;
  });

  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="delete-bulk-users-backdrop" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;backdrop-filter:blur(4px)">
      <div class="modal-card" style="max-width:480px;background:#ffffff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;padding:0" role="dialog" aria-modal="true">
        <div style="padding:28px 24px 20px;text-align:center">
          <div class="modal-icon-danger" style="width:56px;height:56px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:22px;margin:0 auto 16px">
            ${ICONS.trash}
          </div>
          <h3 style="font:700 20px 'Space Grotesk';color:var(--ink);margin:0 0 8px">Delete ${targets.length} User Accounts?</h3>
          <p style="font-size:14px;color:var(--muted);margin:0;line-height:1.5">
            Are you sure you want to permanently delete <strong>${targets.length} selected account${targets.length > 1 ? 's' : ''}</strong>?
          </p>
          <div style="max-height:120px;overflow-y:auto;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin:12px 0 0;font-size:12px;text-align:left;color:var(--ink)">
            ${names.map((n) => `<div>• <strong>${n}</strong></div>`).join('')}
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12px;padding:10px 12px;border-radius:8px;margin-top:14px;text-align:left;display:flex;align-items:flex-start;gap:8px">
            <span style="flex-shrink:0;color:#dc2626">${ICONS.alertTriangle}</span>
            <span><strong>Warning:</strong> Selected administrator and candidate accounts will be permanently removed. This cannot be undone.</span>
          </div>
          <div id="delete-bulk-users-error" style="color:#dc2626;font-size:13px;font-weight:600;display:none;margin-top:12px"></div>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="btn-cancel-bulk-del-users" type="button" style="padding:8px 16px;font-size:13px">Cancel</button>
          <button class="button" id="btn-confirm-bulk-del-users" type="button" style="background:#dc2626;border-color:#dc2626;color:#ffffff;padding:8px 18px;font-size:13px;font-weight:600">
            ${ICONS.trash} <span>Yes, Delete ${targets.length} Accounts</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalRoot.innerHTML = ''; };
  modalRoot.querySelector('#btn-cancel-bulk-del-users').onclick = closeModal;
  modalRoot.querySelector('#delete-bulk-users-backdrop').onclick = (e) => {
    if (e.target.id === 'delete-bulk-users-backdrop') closeModal();
  };

  const confirmBtn = modalRoot.querySelector('#btn-confirm-bulk-del-users');
  const errEl = modalRoot.querySelector('#delete-bulk-users-error');

  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting…';

    const res = await request('/api/admin/users/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets })
    });

    if (res.error) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `${ICONS.trash} <span>Yes, Delete ${targets.length} Accounts</span>`;
      errEl.textContent = res.error;
      errEl.style.display = 'block';
      return;
    }

    closeModal();
    showToast(`✓ Deleted ${res.deletedCount || targets.length} accounts.`, 'success');
    renderAdmin('users');
  };
}

function openBulkStatusUsersModal(targets, findUser, newStatus, onCompleted) {
  const modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) return;

  const isSuspend = newStatus === 'suspended';
  const actionTitle = isSuspend ? 'Suspend' : 'Archive';
  const actionColor = isSuspend ? '#d97706' : '#475569';
  const actionBg = isSuspend ? '#fffbeb' : '#f8fafc';
  const actionBorder = isSuspend ? '#fde68a' : '#cbd5e1';
  const actionText = isSuspend ? '#92400e' : '#334155';
  const iconColor = isSuspend ? '#d97706' : '#475569';
  const iconBg = isSuspend ? 'rgba(217,119,6,0.12)' : 'rgba(71,85,105,0.12)';

  const iconSvg = isSuspend
    ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="10" y1="15" x2="10" y2="9"></line><line x1="14" y1="15" x2="14" y2="9"></line></svg>`
    : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`;

  const btnIconSvg = isSuspend
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="10" y1="15" x2="10" y2="9"></line><line x1="14" y1="15" x2="14" y2="9"></line></svg>`
    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`;

  const noticeMessage = isSuspend
    ? '⚠️ <strong>Warning:</strong> Selected accounts will be suspended and will temporarily lose access to the portal or assessments.'
    : '📦 <strong>Notice:</strong> Selected accounts will be archived and removed from active testing rosters.';

  const names = targets.map((t) => {
    const u = typeof findUser === 'function' ? findUser(t.id, t.role) : null;
    return u ? `${u.name} (${u.role === 'admin' ? `@${u.username}` : u.email || u.unit || 'Candidate'})` : `${t.role} #${t.id}`;
  });

  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="bulk-status-users-backdrop" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;backdrop-filter:blur(4px)">
      <div class="modal-card" style="max-width:480px;background:#ffffff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;padding:0" role="dialog" aria-modal="true">
        <div style="padding:28px 24px 20px;text-align:center">
          <div style="width:56px;height:56px;border-radius:50%;background:${iconBg};color:${iconColor};display:grid;place-items:center;margin:0 auto 16px">
            ${iconSvg}
          </div>
          <h3 style="font:700 20px 'Space Grotesk';color:var(--ink);margin:0 0 8px">${actionTitle} ${targets.length} User Accounts?</h3>
          <p style="font-size:14px;color:var(--muted);margin:0;line-height:1.5">
            Are you sure you want to ${actionTitle.toLowerCase()} <strong>${targets.length} selected account${targets.length > 1 ? 's' : ''}</strong>?
          </p>
          <div style="max-height:120px;overflow-y:auto;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin:12px 0 0;font-size:12px;text-align:left;color:var(--ink)">
            ${names.map((n) => `<div>• <strong>${n}</strong></div>`).join('')}
          </div>
          <div style="background:${actionBg};border:1px solid ${actionBorder};color:${actionText};font-size:12px;padding:10px 12px;border-radius:8px;margin-top:14px;text-align:left">
            ${noticeMessage}
          </div>
          <div id="bulk-status-users-error" style="color:#dc2626;font-size:13px;font-weight:600;display:none;margin-top:12px"></div>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="btn-cancel-bulk-status-users" type="button" style="padding:8px 16px;font-size:13px">Cancel</button>
          <button class="button" id="btn-confirm-bulk-status-users" type="button" style="background:${actionColor};border-color:${actionColor};color:#ffffff;padding:8px 18px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px">
            ${btnIconSvg} <span>Yes, ${actionTitle} ${targets.length} Accounts</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalRoot.innerHTML = ''; };
  modalRoot.querySelector('#btn-cancel-bulk-status-users').onclick = closeModal;
  modalRoot.querySelector('#bulk-status-users-backdrop').onclick = (e) => {
    if (e.target.id === 'bulk-status-users-backdrop') closeModal();
  };

  const confirmBtn = modalRoot.querySelector('#btn-confirm-bulk-status-users');
  const errEl = modalRoot.querySelector('#bulk-status-users-error');

  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = `${actionTitle}ing…`;

    const res = await request('/api/admin/users/bulk-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets, status: newStatus })
    });

    if (res.error) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `${btnIconSvg} <span>Yes, ${actionTitle} ${targets.length} Accounts</span>`;
      errEl.textContent = res.error;
      errEl.style.display = 'block';
      return;
    }

    closeModal();
    if (typeof onCompleted === 'function') {
      onCompleted();
    } else {
      targets.forEach((t) => {
        const u = typeof findUser === 'function' ? findUser(t.id, t.role) : null;
        if (u) u.status = newStatus;
      });
      showToast(`✓ Updated ${res.updatedCount || targets.length} accounts to ${newStatus}.`, 'success');
      renderAdmin('users');
    }
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

function openBulkDeleteModal(selectedIds, selectedNames, onSuccess) {
  const modalContainer = document.querySelector('#modal-root') || document.body;
  const names = (selectedNames && selectedNames.length) ? selectedNames : selectedIds;
  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="delete-modal-backdrop" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;backdrop-filter:blur(4px)">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:480px;background:#ffffff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;padding:0">
        <div style="padding:28px 24px 20px;text-align:center">
          <div class="modal-icon-danger" style="width:56px;height:56px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:22px;margin:0 auto 16px">
            ${ICONS.trash}
          </div>
          <h3 style="font:700 20px 'Space Grotesk';color:var(--ink);margin:0 0 8px">Delete ${selectedIds.length} Assessment Record${selectedIds.length > 1 ? 's' : ''}?</h3>
          <p style="font-size:14px;color:var(--muted);margin:0;line-height:1.5">
            Are you sure you want to permanently delete <strong>${selectedIds.length} candidate attempt${selectedIds.length > 1 ? 's' : ''}</strong>?
          </p>
          <div style="max-height:120px;overflow-y:auto;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin:12px 0 0;font-size:12px;text-align:left;color:var(--ink)">
            ${names.map((n, i) => `<div>• <strong>${n || selectedIds[i]}</strong> <span style="color:var(--muted)">(${selectedIds[i]})</span></div>`).join('')}
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12px;padding:10px 12px;border-radius:8px;margin-top:14px;text-align:left;display:flex;align-items:flex-start;gap:8px">
            <span style="flex-shrink:0;color:#dc2626">${ICONS.alertTriangle}</span>
            <span><strong>Warning:</strong> All answers, scores, and recordings for these candidates will be permanently erased. This cannot be undone.</span>
          </div>
          <div id="bulk-delete-error" style="color:#dc2626;font-size:13px;font-weight:600;display:none;margin-top:12px"></div>
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
    const errEl = document.querySelector('#bulk-delete-error');
    btn.disabled = true;
    btn.textContent = 'Deleting…';

    const res = await request('/api/admin/results/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds })
    });
    if (res.error) {
      btn.disabled = false;
      btn.innerHTML = `${ICONS.trash} <span>Yes, Delete ${selectedIds.length} Records</span>`;
      if (errEl) {
        errEl.textContent = res.error;
        errEl.style.display = 'block';
      } else {
        showToast(`Error: ${res.error}`, 'error');
      }
      return;
    }
    closeModal();
    showToast(`✓ ${selectedIds.length} candidate attempts deleted successfully.`, 'success');
    if (typeof onSuccess === 'function') {
      onSuccess();
    } else {
      renderAdmin('results');
    }
  };
}

function openDeleteModal(attemptId, teacherName, onSuccess) {
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
          <div id="single-delete-error" style="color:#dc2626;font-size:13px;font-weight:600;display:none;margin-top:12px"></div>
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
    const errEl = document.querySelector('#single-delete-error');
    btn.disabled = true;
    btn.textContent = 'Deleting…';

    const res = await request(`/api/admin/results/${attemptId}`, { method: 'DELETE' });
    if (res.error) {
      btn.disabled = false;
      btn.innerHTML = `${ICONS.trash} <span>Delete Permanently</span>`;
      if (errEl) {
        errEl.textContent = res.error;
        errEl.style.display = 'block';
      } else {
        showToast(`Error: ${res.error}`, 'error');
      }
      return;
    }
    closeModal();
    showToast(`✓ Candidate attempt ${attemptId} deleted successfully.`, 'success');
    if (typeof onSuccess === 'function') {
      onSuccess();
    } else {
      renderAdmin('results');
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


async function openGradingModal(attemptInput) {
  const attemptId = typeof attemptInput === 'object' && attemptInput !== null ? (attemptInput.id || attemptInput.attemptId) : attemptInput;
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

  const recordingInfo = attempt.speakingRecording
    ? `${attempt.speakingRecording.mimeType || 'audio/video'}, ${attempt.speakingRecording.durationSeconds || 0}s${attempt.speakingRecording.driveViewLink ? ' · Google Drive' : ''} (${attempt.speakingRecording.transcriptSource || 'recorded'})`
    : 'No media record file attached';
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

    const ac = attempt.antiCheat || attempt.raw_data?.antiCheat || null;
    const totalViolations = ac ? (ac.totalCount || (ac.violations?.length) || (ac.tabSwitches || 0) + (ac.fullscreenExits || 0) + (ac.splitScreenDetections || 0) + (ac.devToolsAttempts || 0) + (ac.copyPasteAttempts || 0)) : 0;

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
              <div class="candidate-tags" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span class="pill">Attempt: ${attempt.id}</span>
                <span class="pill ${attempt.status === 'Completed' ? 'success' : 'pending'}">${attempt.status}</span>
                <span class="pill ${attempt.review === 'Teacher reviewed' ? 'success' : 'pending'}">${attempt.review || 'Pending'}</span>
                <span class="pill ${totalViolations === 0 ? 'success' : 'pending'}" style="${totalViolations > 0 ? 'background:#fef2f2;color:#dc2626;border-color:#fecaca;' : ''}">
                  ${totalViolations === 0 ? '🛡️ Anti-Cheat: 0 Violations' : `⚠️ Anti-Cheat: ${totalViolations} Violation${totalViolations === 1 ? '' : 's'}`}
                </span>
                <button class="btn-ai-grade" id="modal-ai-grade-btn" type="button" title="Auto-grade Writing & Speaking responses using Google Gemini AI">
                  <span class="ai-sparkle-icon">✨</span>
                  <span>Auto-Grade with Gemini AI</span>
                </button>
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

            <!-- Anti-Cheat Audit Record Card -->
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.02)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:18px">${totalViolations === 0 ? '🛡️' : '⚠️'}</span>
                  <strong style="font-size:14px;color:#0f172a">Assessment Anti-Cheat &amp; Integrity Record</strong>
                </div>
                <span class="pill ${totalViolations === 0 ? 'success' : 'pending'}" style="${totalViolations > 0 ? 'background:#fef2f2;color:#dc2626;border-color:#fecaca;' : ''}">
                  ${totalViolations === 0 ? 'Clean Assessment (0 Violations)' : `${totalViolations} Violation Incident${totalViolations === 1 ? '' : 's'}`}
                </span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;font-size:12px">
                <div style="background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #f1f5f9">
                  <span style="color:#64748b;display:block;margin-bottom:2px">Tab Switches</span>
                  <strong style="font-size:15px;color:${(ac?.tabSwitches || 0) > 0 ? '#dc2626' : '#16a34a'}">${ac?.tabSwitches || 0}x</strong>
                </div>
                <div style="background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #f1f5f9">
                  <span style="color:#64748b;display:block;margin-bottom:2px">Fullscreen Exits</span>
                  <strong style="font-size:15px;color:${(ac?.fullscreenExits || 0) > 0 ? '#dc2626' : '#16a34a'}">${ac?.fullscreenExits || 0}x</strong>
                </div>
                <div style="background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #f1f5f9">
                  <span style="color:#64748b;display:block;margin-bottom:2px">Split Screen (&lt;65%)</span>
                  <strong style="font-size:15px;color:${(ac?.splitScreenDetections || 0) > 0 ? '#dc2626' : '#16a34a'}">${ac?.splitScreenDetections || 0}x</strong>
                </div>
                <div style="background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #f1f5f9">
                  <span style="color:#64748b;display:block;margin-bottom:2px">DevTools Access</span>
                  <strong style="font-size:15px;color:${(ac?.devToolsAttempts || 0) > 0 ? '#dc2626' : '#16a34a'}">${ac?.devToolsAttempts || 0}x</strong>
                </div>
                <div style="background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #f1f5f9">
                  <span style="color:#64748b;display:block;margin-bottom:2px">Copy / Paste</span>
                  <strong style="font-size:15px;color:${(ac?.copyPasteAttempts || 0) > 0 ? '#dc2626' : '#16a34a'}">${ac?.copyPasteAttempts || 0}x</strong>
                </div>
              </div>
            </div>

            <!-- AI Evaluation Results Container -->
            <div id="ai-evaluation-results-container"></div>

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
              ${(attempt.speakingRecording?.fileUrl || attempt.speakingRecording?.dataUrl || attempt.speakingRecording?.driveViewLink) ? `
                <div class="recording-meta" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                  <div><span class="rec-dot"></span> Spoken audio/video recording — ${attempt.speakingRecording.durationSeconds || 0}s · ${attempt.speakingRecording.mimeType || 'video/webm'}</div>
                  ${attempt.speakingRecording?.driveViewLink ? `
                    <a href="${attempt.speakingRecording.driveViewLink}" target="_blank" rel="noopener noreferrer" class="pill success" style="display:inline-flex;align-items:center;gap:5px;text-decoration:none;font-size:12px;font-weight:700">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      Open in Google Drive
                    </a>
                  ` : ''}
                </div>
                <video class="speaking-playback" id="review-speaking-video" controls playsinline preload="auto" src="${attempt.speakingRecording.fileUrl || attempt.speakingRecording.dataUrl || attempt.speakingRecording.driveViewLink}"></video>
                <div style="display:flex;align-items:center;gap:10px;margin:6px 0 8px;flex-wrap:wrap">
                  <button type="button" class="button button-sm" id="btn-force-play-video" style="padding:6px 14px;font-size:12px">▶ Play Recording with Audio</button>
                  ${attempt.speakingRecording?.driveViewLink ? `
                    <a href="${attempt.speakingRecording.driveViewLink}" target="_blank" rel="noopener noreferrer" class="ghost" style="padding:4px 10px;font-size:12px;text-decoration:none;display:inline-flex;align-items:center;gap:4px">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      View in Google Drive
                    </a>
                  ` : ''}
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

  // Auto-Grade with Gemini AI
  const aiGradeBtn = document.querySelector('#modal-ai-grade-btn');
  if (aiGradeBtn) {
    aiGradeBtn.onclick = async () => {
      aiGradeBtn.disabled = true;
      const originalHtml = aiGradeBtn.innerHTML;
      aiGradeBtn.innerHTML = '<span class="ai-sparkle-icon">⏳</span> <span>Gemini AI is analyzing…</span>';

      try {
        const res = await request(`/api/admin/results/${attemptId}/ai-grade`, { method: 'POST' });
        if (res.error) {
          showToast(res.error, 'error');
          aiGradeBtn.disabled = false;
          aiGradeBtn.innerHTML = originalHtml;
          return;
        }

        // 1. Populate Writing scores if available
        if (res.writing && res.writing.scores) {
          Object.entries(res.writing.scores).forEach(([field, val]) => {
            scores.writing[field] = Number(val);
            const siblingBtns = document.querySelectorAll(`.scale-btn[data-skill="writing"][data-field="${field.replaceAll('"', '\\"')}"]`);
            siblingBtns.forEach((b) => {
              b.classList.toggle('active', Number(b.dataset.val) === Number(val));
            });
          });
        }

        // 2. Populate Speaking scores if available
        if (res.speaking && res.speaking.scores) {
          Object.entries(res.speaking.scores).forEach(([field, val]) => {
            scores.speaking[field] = Number(val);
            const siblingBtns = document.querySelectorAll(`.scale-btn[data-skill="speaking"][data-field="${field.replaceAll('"', '\\"')}"]`);
            siblingBtns.forEach((b) => {
              b.classList.toggle('active', Number(b.dataset.val) === Number(val));
            });
          });
        }

        // 3. Update summary badges and chip totals
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

        const footerSummary = document.querySelector('#modal-footer-summary');
        if (footerSummary) {
          footerSummary.innerHTML = totals.writing.complete && totals.speaking.complete
            ? `<span>Ready to save: <strong>Writing ${totals.writing.level} (${totals.writing.total}/${totals.writing.max})</strong> · <strong>Speaking ${totals.speaking.level} (${totals.speaking.total}/${totals.speaking.max})</strong></span>`
            : `<span style="color:var(--warning)">⚠️ Please select a score for all criteria.</span>`;
        }

        // 4. Render AI Feedback Box in Modal
        const resultsBox = document.querySelector('#ai-evaluation-results-container');
        if (resultsBox) {
          resultsBox.innerHTML = `
            <div class="ai-evaluation-box">
              <div class="ai-box-header">
                <div class="ai-box-title">
                  <span class="ai-sparkle-icon">✨</span>
                  <span>Google Gemini AI Evaluation Report</span>
                </div>
                <span class="ai-box-badge">Suggested Placement: ${res.suggestedOverall || 'Evaluated'}</span>
              </div>

              <!-- Writing Feedback -->
              <div style="margin-bottom:14px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                  <strong style="color:#4338ca;font-size:13px">Writing Assessment (Band ${res.writing.level || 'Evaluated'})</strong>
                </div>
                <div class="ai-feedback-text">${res.writing.feedback || 'Completed against CEFR writing criteria.'}</div>
                ${(res.writing.strengths?.length > 0 || res.writing.improvements?.length > 0) ? `
                  <div class="ai-bullets-grid">
                    ${res.writing.strengths?.length > 0 ? `
                      <div class="ai-bullet-col">
                        <div class="ai-bullet-col-title strengths"><span>✓</span> Strengths</div>
                        <ul class="ai-bullet-list">
                          ${res.writing.strengths.map((s) => `<li>${s.replace(/</g, '&lt;')}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                    ${res.writing.improvements?.length > 0 ? `
                      <div class="ai-bullet-col">
                        <div class="ai-bullet-col-title improvements"><span>↑</span> Areas for Growth</div>
                        <ul class="ai-bullet-list">
                          ${res.writing.improvements.map((i) => `<li>${i.replace(/</g, '&lt;')}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                  </div>
                ` : ''}
              </div>

              <!-- Speaking Feedback -->
              <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                  <strong style="color:#4338ca;font-size:13px">Speaking Assessment (Band ${res.speaking.level || 'Evaluated'})</strong>
                </div>
                <div class="ai-feedback-text">${res.speaking.feedback || 'Completed against CEFR speaking criteria.'}</div>
                ${(res.speaking.strengths?.length > 0 || res.speaking.improvements?.length > 0) ? `
                  <div class="ai-bullets-grid">
                    ${res.speaking.strengths?.length > 0 ? `
                      <div class="ai-bullet-col">
                        <div class="ai-bullet-col-title strengths"><span>✓</span> Strengths</div>
                        <ul class="ai-bullet-list">
                          ${res.speaking.strengths.map((s) => `<li>${s.replace(/</g, '&lt;')}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                    ${res.speaking.improvements?.length > 0 ? `
                      <div class="ai-bullet-col">
                        <div class="ai-bullet-col-title improvements"><span>↑</span> Areas for Growth</div>
                        <ul class="ai-bullet-list">
                          ${res.speaking.improvements.map((i) => `<li>${i.replace(/</g, '&lt;')}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }

        // Trigger autosave with populated scores
        triggerAutoSave();
        showToast('✨ Gemini AI populated rubric ratings and feedback successfully!', 'success');
      } catch (err) {
        showToast(err.message || 'AI grading failed', 'error');
      } finally {
        aiGradeBtn.disabled = false;
        aiGradeBtn.innerHTML = originalHtml;
      }
    };
  }

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

// ==========================================================================
// Security & Audit Log Tab
// ==========================================================================
let auditFilterState = {
  search: '',
  category: 'all',
  status: 'all',
  actorType: 'all'
};

async function renderAdminAuditTab(container) {
  // Clear any existing live audit timer before starting fresh
  if (window.adminAuditLiveTimer) {
    clearInterval(window.adminAuditLiveTimer);
    window.adminAuditLiveTimer = null;
  }

  const query = new URLSearchParams({
    category: auditFilterState.category,
    status: auditFilterState.status,
    actorType: auditFilterState.actorType,
    search: auditFilterState.search,
    limit: '150'
  });

  const res = await request(`/api/admin/audit-logs?${query.toString()}`);
  if (res.error) {
    if (res.error === 'Unauthorized' || res.error.includes('access')) return renderLogin('admin');
    return showToast(res.error, 'error');
  }

  let currentLogs = res.logs || [];
  let stats = res.stats || {
    total: currentLogs.length,
    todayCount: 0,
    securityAlertsCount: 0,
    activeActorsCount: 0
  };



  const hasActiveFilters = () =>
    auditFilterState.category !== 'all' ||
    auditFilterState.status !== 'all' ||
    auditFilterState.actorType !== 'all' ||
    auditFilterState.search.trim() !== '';

  const formatDateTimeParts = (ts) => {
    if (!ts) return { date: '-', time: '' };
    try {
      const d = new Date(ts);
      const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      return { date, time };
    } catch {
      return { date: ts, time: '' };
    }
  };

  const getActionClass = (cat) => {
    switch (cat) {
      case 'AUTH': return 'audit-act-auth';
      case 'ASSESSMENT': return 'audit-act-assess';
      case 'EVALUATION': return 'audit-act-eval';
      case 'USER_MGMT': return 'audit-act-user';
      case 'CONTENT': return 'audit-act-content';
      case 'SECURITY': return 'audit-act-security';
      default: return 'audit-act-system';
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'SUCCESS') {
      return `<span class="audit-status-badge audit-status-success">${ICONS.check} Success</span>`;
    }
    if (status === 'WARNING') {
      return `<span class="audit-status-badge audit-status-warning">${ICONS.alertTriangle} Warning</span>`;
    }
    return `<span class="audit-status-badge audit-status-failure">${ICONS.x} Failed</span>`;
  };

  const getActorAvatarClass = (role) => {
    if (role === 'admin') return 'audit-avatar-admin';
    if (role === 'teacher') return 'audit-avatar-teacher';
    return 'audit-avatar-system';
  };

  const getInitials = (name) => {
    if (!name) return 'SYS';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const formatCleanIp = (ip) => {
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') return '127.0.0.1 (Local)';
    return ip.replace(/^::ffff:/, '');
  };

  const getCategoryLabel = (cat) => {
    const c = (cat || 'SYSTEM').toUpperCase();
    switch (c) {
      case 'AUTH': return 'Authentication';
      case 'ASSESSMENT': return 'Assessment Taking';
      case 'MONITORING': return 'Live Proctoring';
      case 'EVALUATION': return 'Rubrics & Scoring';
      case 'USER_MGMT': return 'User Management';
      case 'CONTENT': return 'Question Bank';
      case 'SECURITY': return 'Security & Access';
      case 'SYSTEM': return 'System Engine';
      default: return c;
    }
  };

  const getActorRoleLabel = (role, id) => {
    const r = (role || 'system').toLowerCase();
    if (r === 'admin') return id ? `Admin · @${id}` : 'Administrator';
    if (r === 'teacher') return id ? `Teacher · ${id}` : 'Teacher Candidate';
    if (r === 'candidate' || r === 'student') return id ? `Student · #${id}` : 'Student';
    return 'System Engine';
  };

  const renderRowHtml = (log) => {
    const dt = formatDateTimeParts(log.timestamp);
    const actorRole = (log.actorType || 'system').toLowerCase();
    const isAdminUser = actorRole === 'admin';
    const isTeacher = actorRole === 'teacher';
    const isCandidate = actorRole === 'candidate' || actorRole === 'student';

    // 1. Avatar Style & Initials (exact match to User Manager table in Image 1)
    let avatarStyle = 'background:#f1f5f9;color:#475569;border:1.5px solid #cbd5e1;';
    if (isAdminUser) {
      avatarStyle = 'background:#f3e8ff;color:#7e22ce;border:1.5px solid #e9d5ff;';
    } else if (isTeacher) {
      avatarStyle = 'background:#eff6ff;color:#1d4ed8;border:1.5px solid #dbeafe;';
    } else if (isCandidate) {
      avatarStyle = 'background:#ecfdf5;color:#047857;border:1.5px solid #a7f3d0;';
    }

    const initials = getInitials(log.actorName || log.actorId);
    const roleSub = getActorRoleLabel(log.actorType, log.actorId);

    // 2. Action Badge & Category
    const cat = (log.category || 'SYSTEM').toUpperCase();
    let actionStyle = 'background:#f8fafc;color:#334155;border:1px solid #cbd5e1;';
    if (cat === 'SECURITY') {
      actionStyle = 'background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;';
    } else if (cat === 'AUTH') {
      actionStyle = 'background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;';
    } else if (cat === 'ASSESSMENT') {
      actionStyle = 'background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;';
    } else if (cat === 'MONITORING') {
      actionStyle = 'background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;';
    } else if (cat === 'EVALUATION') {
      actionStyle = 'background:#faf5ff;color:#7e22ce;border:1px solid #e9d5ff;';
    } else if (cat === 'USER_MGMT') {
      actionStyle = 'background:#fff7ed;color:#c2410c;border:1px solid #ffedd5;';
    } else if (cat === 'CONTENT') {
      actionStyle = 'background:#fdf4ff;color:#a21caf;border:1px solid #fae8ff;';
    }
    const catLabel = getCategoryLabel(log.category);

    // 3. Target Scope & IP
    const scopeVal = log.target && log.target !== '-' ? log.target : (log.category || 'System');
    const isAttempt = scopeVal.startsWith('ATT-');
    const unitBadge = isAttempt
      ? `<span class="attempt-pill" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${escapeHtml(scopeVal)}</span>`
      : `<span class="unit-pill" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${escapeHtml(scopeVal)}</span>`;
    const cleanIp = formatCleanIp(log.ipAddress);

    // 4. Status Pill
    const st = (log.status || 'SUCCESS').toUpperCase();
    let statusPill = `<span class="pill success"><span class="pill-dot"></span> Success</span>`;
    if (st === 'WARNING') {
      statusPill = `<span class="pill" style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;font-weight:600"><span class="pill-dot" style="background:#f59e0b"></span> Warning</span>`;
    } else if (st === 'FAILURE' || st === 'FAILED') {
      statusPill = `<span class="pill" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;font-weight:600"><span class="pill-dot" style="background:#ef4444"></span> Failed</span>`;
    }

    return `
      <tr data-log-id="${log.id}">
        <!-- Col 1: User / Actor -->
        <td class="audit-cell-actor" style="overflow:hidden">
          <div class="teacher-cell" style="overflow:hidden;gap:12px">
            <div class="teacher-avatar-sm" style="${avatarStyle};width:36px;height:36px;min-width:36px;font-size:13px">${initials}</div>
            <div style="min-width:0;overflow:hidden">
              <div class="teacher-meta-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13.5px;font-weight:600;color:var(--ink)" title="${escapeHtml(log.actorName || log.actorId || 'System')}">
                ${escapeHtml(log.actorName || log.actorId || 'System')}
              </div>
              <div style="font-size:11.5px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(roleSub)}">
                ${escapeHtml(roleSub)}
              </div>
            </div>
          </div>
        </td>

        <!-- Col 2: Action / Event -->
        <td class="audit-cell-action" style="overflow:hidden">
          <div class="audit-action-meta-wrap">
            <div style="max-width:100%;overflow:hidden;text-overflow:ellipsis">
              <span class="audit-action-chip" style="${actionStyle}" title="${escapeHtml(log.action)}">
                ${escapeHtml(log.action)}
              </span>
            </div>
            <div class="audit-cat-sub" title="${escapeHtml(catLabel)}">
              ${escapeHtml(catLabel)}
            </div>
          </div>
        </td>

        <!-- Col 3: Target / Scope -->
        <td class="audit-cell-target" style="overflow:hidden">
          <div class="audit-target-wrap">
            <div style="max-width:100%;overflow:hidden;text-overflow:ellipsis">
              ${unitBadge}
            </div>
            <div class="audit-ip-sub" title="${escapeHtml(cleanIp)}">
              ${escapeHtml(cleanIp)}
            </div>
          </div>
        </td>

        <!-- Col 4: Timestamp -->
        <td class="audit-cell-time" style="overflow:hidden">
          <div class="audit-time-wrap">
            <div class="audit-time-date">${dt.date}</div>
            <div class="audit-time-clock">${dt.time}</div>
          </div>
        </td>

        <!-- Col 5: Status -->
        <td class="audit-cell-status" style="text-align:right;white-space:nowrap;padding-right:16px">
          <div class="audit-status-cell-wrap">
            ${statusPill}
            <button type="button" class="btn-action-icon btn-inspect-audit" data-id="${log.id}" title="Inspect full audit details">
              ${ICONS.eye}
            </button>
          </div>
        </td>
      </tr>
    `;
  };

  const renderEmptyHtml = () => `
    <tr class="audit-empty-row">
      <td colspan="5" class="audit-empty-cell" style="text-align:center;padding:48px 16px;color:var(--muted)">
        <div style="font-size:32px;margin-bottom:8px">📋</div>
        <div style="font-weight:700;font-size:15px;color:var(--ink)">No Audit Events Found</div>
        <div style="font-size:13px;color:var(--muted);margin-top:4px">Try adjusting your search query, role, status, or category filter.</div>
      </td>
    </tr>
  `;

  const showInspectModal = (entry) => {
    const dt = formatDateTimeParts(entry.timestamp);

    // Clean formatted detail rows if any extra details exist (NO raw JSON!)
    let extraDetailsHtml = '';
    if (entry.details && typeof entry.details === 'object' && Object.keys(entry.details).length > 0) {
      const labels = {
        unit: 'School Unit',
        overallBand: 'Overall Band Score',
        earlyTermination: 'Early Termination',
        durationMinutes: 'Duration (Minutes)',
        passingBand: 'Passing Band Threshold',
        schoolName: 'School Name',
        maintenanceMode: 'Maintenance Mode',
        username: 'Username',
        name: 'Full Name',
        email: 'Email Address',
        count: 'Record Count',
        reason: 'Reason'
      };

      const rows = Object.entries(entry.details)
        .filter(([k, v]) => v !== null && v !== undefined && typeof v !== 'object')
        .map(([k, v]) => {
          const title = labels[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
          const displayVal = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
          return `
            <div>
              <span style="color:var(--muted);font-size:11.5px;display:block;margin-bottom:2px">${title}:</span>
              <strong style="color:var(--ink)">${displayVal}</strong>
            </div>
          `;
        }).join('');

      if (rows) {
        extraDetailsHtml = rows;
      }
    }

    modalRoot.innerHTML = `
      <div class="modal-backdrop" id="audit-detail-modal">
        <div class="modal-card audit-detail-modal-card" style="max-width:520px;padding:24px;border-radius:14px;margin:auto;box-shadow:var(--shadow-lg)">
          <!-- Centered Modal Header -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;border-bottom:1px solid var(--line);padding-bottom:14px">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <span class="audit-cat-tag">${entry.category}</span>
                ${getStatusBadge(entry.status)}
              </div>
              <h2 style="font:700 20px 'Space Grotesk';margin:0;color:var(--ink)">${entry.action}</h2>
            </div>
            <button class="ghost" id="modal-close-audit" type="button" style="padding:6px 10px;font-size:16px;border-radius:8px">✕</button>
          </div>

          <!-- Clean Info Grid (NO RAW JSON DISPLAYED) -->
          <div class="audit-modal-info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #e2e8f0;font-size:13px">
            <div>
              <span style="color:var(--muted);font-size:11.5px;display:block;margin-bottom:2px">Timestamp:</span>
              <strong style="color:var(--ink)">${dt.date} <span style="font-family:'SFMono-Regular',Consolas,monospace;color:#64748b">${dt.time}</span></strong>
            </div>
            <div>
              <span style="color:var(--muted);font-size:11.5px;display:block;margin-bottom:2px">Client IP Address:</span>
              <span style="font-family:'SFMono-Regular',Consolas,monospace;font-weight:600;color:var(--ink)">${formatCleanIp(entry.ipAddress)}</span>
            </div>
            <div>
              <span style="color:var(--muted);font-size:11.5px;display:block;margin-bottom:2px">Actor Identity:</span>
              <strong style="color:var(--ink)">${entry.actorName || 'System'}</strong>
              <div style="font-size:11.5px;color:var(--muted)">${entry.actorId || 'system'} (${entry.actorType || 'system'})</div>
            </div>
            <div>
              <span style="color:var(--muted);font-size:11.5px;display:block;margin-bottom:2px">Target Resource:</span>
              <strong style="color:var(--ink)">${entry.target || '-'}</strong>
            </div>
            ${extraDetailsHtml}
          </div>

          <!-- Modal Action Footer -->
          <div style="display:flex;justify-content:flex-end;margin-top:20px">
            <button class="button" id="modal-ok-audit" type="button" style="min-width:110px">Close</button>
          </div>
        </div>
      </div>
    `;

    document.querySelector('#modal-close-audit').onclick = () => { modalRoot.innerHTML = ''; };
    document.querySelector('#modal-ok-audit').onclick = () => { modalRoot.innerHTML = ''; };
  };

  const bindTableEvents = () => {
    container.querySelectorAll('.btn-inspect-audit').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const entry = currentLogs.find((l) => String(l.id) === String(id));
        if (entry) showInspectModal(entry);
      };
    });
  };

  container.innerHTML = `
    <!-- Header with Live Pulse & Export Actions -->
    <div class="audit-header-wrap">
      <div>
        <div class="eyebrow" style="display:inline-flex;align-items:center;gap:8px">
          <span>SECURITY & GOVERNANCE</span>
          <span class="audit-live-status-pill" title="Live stream is active and updating automatically">
            <span class="audit-live-dot"></span> Live Real-time Stream
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin:6px 0 4px;flex-wrap:wrap">
          <h1 style="font:700 32px 'Space Grotesk';margin:0;color:var(--ink)">Audit Log</h1>
          <span class="audit-count-pill" id="audit-total-pill">${stats.total} Total Events</span>
        </div>
        <p style="color:var(--muted);font-size:14px;margin:0">Real-time immutable audit trail capturing authentication, candidate tests, evaluations, and system configurations.</p>
      </div>
      <div class="admin-toolbar audit-action-toolbar">
        <a class="btn-icon audit-btn-export" id="btn-export-audit" href="/api/admin/audit-logs/export?${query.toString()}" download="assessify-audit-logs.xlsx" title="Export audit logs to Excel (.xlsx)">
          ${ICONS.excel} <span>Export Audit (.xlsx)</span>
        </a>
        <button class="button ghost" id="btn-refresh-audit" type="button" title="Refresh audit log feed" style="display:flex;align-items:center;gap:6px">
          ${ICONS.refresh} <span>Refresh</span>
        </button>
        <button class="button danger" id="btn-clear-audit" type="button" title="Clear all audit logs to null / empty" style="display:flex;align-items:center;gap:6px;background:#ef4444;color:#fff;border:none">
          ${ICONS.trash} <span>Clear Logs</span>
        </button>
      </div>
    </div>

    <!-- 4-Column KPI Summary Grid -->
    <div class="admin-kpis-grid cols-4">
      <div class="kpi-card kpi-indigo">
        <div class="kpi-card-info">
          <strong id="kpi-audit-total">${stats.total}</strong>
          <span>Total Events</span>
        </div>
        <div class="kpi-card-icon">${ICONS.fileText}</div>
      </div>
      <div class="kpi-card kpi-blue">
        <div class="kpi-card-info">
          <strong id="kpi-audit-today">${stats.todayCount}</strong>
          <span>Recorded Today</span>
        </div>
        <div class="kpi-card-icon">${ICONS.clock}</div>
      </div>
      <div class="kpi-card kpi-amber">
        <div class="kpi-card-info">
          <strong id="kpi-audit-alerts">${stats.securityAlertsCount}</strong>
          <span>Security & Warnings</span>
        </div>
        <div class="kpi-card-icon">${ICONS.alertTriangle}</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-card-info">
          <strong id="kpi-audit-actors">${stats.activeActorsCount}</strong>
          <span>Unique Actors</span>
        </div>
        <div class="kpi-card-icon">${ICONS.users}</div>
      </div>
    </div>

    <!-- Audit Records Table Card (Responsive: 5-column table on desktop, clean cards on mobile) -->
    <div class="panel audit-panel-card" style="overflow:hidden">
      <div class="table-toolbar audit-toolbar-container">
        <div class="search-wrap audit-search-wrap">
          <span class="search-icon-prefix">${ICONS.search}</span>
          <input id="audit-search" placeholder="Search by name, ID, action, target…" value="${escapeHtml(auditFilterState.search)}">
          ${auditFilterState.search ? `<button id="audit-clear-search" class="audit-search-clear" type="button" title="Clear search">✕</button>` : ''}
        </div>
        <div class="audit-filters-group">
          <select class="select-filter audit-filter-select" id="audit-actor-filter">
            <option value="all" ${auditFilterState.actorType === 'all' ? 'selected' : ''}>All Roles (${stats.total})</option>
            <option value="admin" ${auditFilterState.actorType === 'admin' ? 'selected' : ''}>Administrators</option>
            <option value="teacher" ${auditFilterState.actorType === 'teacher' ? 'selected' : ''}>Teachers / Candidates</option>
            <option value="system" ${auditFilterState.actorType === 'system' ? 'selected' : ''}>System Engine</option>
          </select>
          <select class="select-filter audit-filter-select" id="audit-status-filter">
            <option value="all" ${auditFilterState.status === 'all' ? 'selected' : ''}>All Statuses</option>
            <option value="SUCCESS" ${auditFilterState.status === 'SUCCESS' ? 'selected' : ''}>Success Only</option>
            <option value="WARNING" ${auditFilterState.status === 'WARNING' ? 'selected' : ''}>Warnings Only</option>
            <option value="FAILURE" ${auditFilterState.status === 'FAILURE' ? 'selected' : ''}>Failures Only</option>
          </select>
          <select class="select-filter audit-filter-select audit-filter-category" id="audit-category-filter">
            <option value="all" ${auditFilterState.category === 'all' ? 'selected' : ''}>All Categories</option>
            <option value="AUTH" ${auditFilterState.category === 'AUTH' ? 'selected' : ''}>Authentication (AUTH)</option>
            <option value="ASSESSMENT" ${auditFilterState.category === 'ASSESSMENT' ? 'selected' : ''}>Assessment Taking</option>
            <option value="MONITORING" ${auditFilterState.category === 'MONITORING' ? 'selected' : ''}>Live Proctoring</option>
            <option value="EVALUATION" ${auditFilterState.category === 'EVALUATION' ? 'selected' : ''}>Rubrics & Scoring</option>
            <option value="USER_MGMT" ${auditFilterState.category === 'USER_MGMT' ? 'selected' : ''}>User Management</option>
            <option value="CONTENT" ${auditFilterState.category === 'CONTENT' ? 'selected' : ''}>Questions & Bank</option>
            <option value="SECURITY" ${auditFilterState.category === 'SECURITY' ? 'selected' : ''}>Security & Anti-Cheat</option>
            <option value="SYSTEM" ${auditFilterState.category === 'SYSTEM' ? 'selected' : ''}>System Engine</option>
          </select>
          ${hasActiveFilters() ? `
            <button class="button ghost audit-reset-filter-btn" id="btn-reset-filters" type="button" title="Reset all active filters">
              ✕ Reset
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Data Table: 5 clean balanced columns matching User Manager style -->
      <div class="audit-table-responsive">
        <table class="audit-table-fixed">
          <thead>
            <tr>
              <th style="width:23%;min-width:150px">User / Actor</th>
              <th style="width:23%;min-width:150px">Action / Event</th>
              <th style="width:19%;min-width:120px">Target / Scope</th>
              <th style="width:15%;min-width:105px">Timestamp</th>
              <th style="width:20%;min-width:145px;text-align:right;padding-right:16px">Status</th>
            </tr>
          </thead>
          <tbody id="audit-table-body">
            ${currentLogs.length === 0 ? renderEmptyHtml() : currentLogs.map(renderRowHtml).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  bindTableEvents();

  // Filter Listeners
  let searchTimer = null;
  const searchInput = document.querySelector('#audit-search');
  if (searchInput) {
    searchInput.oninput = (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        auditFilterState.search = e.target.value.trim();
        renderAdminAuditTab(container);
      }, 300);
    };
  }

  const clearSearchBtn = document.querySelector('#audit-clear-search');
  if (clearSearchBtn) {
    clearSearchBtn.onclick = () => {
      auditFilterState.search = '';
      renderAdminAuditTab(container);
    };
  }

  const catFilter = document.querySelector('#audit-category-filter');
  if (catFilter) {
    catFilter.onchange = (e) => {
      auditFilterState.category = e.target.value;
      renderAdminAuditTab(container);
    };
  }

  const statusFilter = document.querySelector('#audit-status-filter');
  if (statusFilter) {
    statusFilter.onchange = (e) => {
      auditFilterState.status = e.target.value;
      renderAdminAuditTab(container);
    };
  }

  const actorFilter = document.querySelector('#audit-actor-filter');
  if (actorFilter) {
    actorFilter.onchange = (e) => {
      auditFilterState.actorType = e.target.value;
      renderAdminAuditTab(container);
    };
  }

  const resetFilterBtn = document.querySelector('#btn-reset-filters') || document.querySelector('#btn-reset-filters-empty');
  if (resetFilterBtn) {
    resetFilterBtn.onclick = () => {
      auditFilterState.category = 'all';
      auditFilterState.status = 'all';
      auditFilterState.actorType = 'all';
      auditFilterState.search = '';
      renderAdminAuditTab(container);
    };
  }

  const refreshBtn = document.querySelector('#btn-refresh-audit');
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      renderAdminAuditTab(container);
    };
  }

  const clearBtn = document.querySelector('#btn-clear-audit');
  if (clearBtn) {
    clearBtn.onclick = () => {
      const modal = document.querySelector('#modal-root') || document.body;
      modal.innerHTML = `
        <div class="modal-backdrop" id="clear-audit-backdrop">
          <div class="modal-card" style="max-width:480px">
            <div class="modal-header">
              <div class="modal-title-wrap">
                <div class="modal-icon danger" style="background:#fee2e2;color:#dc2626">${ICONS.alertTriangle}</div>
                <div>
                  <h2 style="color:#b91c1c;margin:0 0 4px">Clear Audit Trail</h2>
                  <p style="margin:0;font-size:13px;color:var(--muted)">Reset audit log history to null / empty (0 events)</p>
                </div>
              </div>
              <button class="modal-close" id="modal-close-clear-audit" type="button">✕</button>
            </div>
            <div class="modal-body" style="padding:16px 20px">
              <p style="font-size:14px;color:var(--ink);line-height:1.5;margin:0 0 12px">
                Are you sure you want to completely clear the entire audit trail? All historical records will be deleted, and only real new events will be logged.
              </p>
              <div style="background:#fef2f2;border:1px solid #fecaca;padding:10px 14px;border-radius:8px;font-size:12.5px;color:#991b1b">
                This action is permanent and cannot be undone.
              </div>
            </div>
            <div class="modal-actions" style="display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid var(--line)">
              <button class="button ghost" id="modal-cancel-clear-audit" type="button">Cancel</button>
              <button class="button danger" id="modal-confirm-clear-audit" type="button" style="background:#dc2626;color:#fff">Yes, Clear All Logs</button>
            </div>
          </div>
        </div>
      `;

      const closeModal = () => { modal.innerHTML = ''; };
      document.querySelector('#modal-close-clear-audit').onclick = closeModal;
      document.querySelector('#modal-cancel-clear-audit').onclick = closeModal;
      document.querySelector('#clear-audit-backdrop').onclick = (e) => {
        if (e.target.id === 'clear-audit-backdrop') closeModal();
      };

      document.querySelector('#modal-confirm-clear-audit').onclick = async () => {
        const btn = document.querySelector('#modal-confirm-clear-audit');
        btn.disabled = true;
        btn.textContent = 'Clearing…';
        const res = await request('/api/admin/audit-logs/clear', { method: 'POST' });
        closeModal();
        if (res.error) {
          showToast(`Error: ${res.error}`, 'error');
        } else {
          showToast('Audit log repository cleared to null.', 'success');
          renderAdminAuditTab(container);
        }
      };
    };
  }


  // Real-time Live Update Engine (Auto-sync without page refresh)
  window.adminAuditLiveTimer = setInterval(async () => {
    if (localStorage.getItem('assessify_admin_tab') !== 'audit') {
      clearInterval(window.adminAuditLiveTimer);
      window.adminAuditLiveTimer = null;
      return;
    }

    // Skip DOM update if user is actively searching or has modal open
    const isSearching = document.activeElement && document.activeElement.id === 'audit-search';
    const isModalOpen = Boolean(modalRoot && modalRoot.innerHTML !== '');
    if (isSearching || isModalOpen) return;

    const liveQuery = new URLSearchParams({
      category: auditFilterState.category,
      status: auditFilterState.status,
      actorType: auditFilterState.actorType,
      search: auditFilterState.search,
      limit: '150'
    });

    const liveRes = await request(`/api/admin/audit-logs?${liveQuery.toString()}`);
    if (liveRes.error || !Array.isArray(liveRes.logs)) return;

    const liveLogs = liveRes.logs;
    const lStats = liveRes.stats || { total: liveLogs.length, todayCount: 0, securityAlertsCount: 0, activeActorsCount: 0 };

    // Update KPI numbers smoothly
    const elTotal = document.querySelector('#kpi-audit-total');
    if (elTotal && elTotal.textContent !== String(lStats.total)) elTotal.textContent = lStats.total;
    const elToday = document.querySelector('#kpi-audit-today');
    if (elToday && elToday.textContent !== String(lStats.todayCount)) elToday.textContent = lStats.todayCount;
    const elAlerts = document.querySelector('#kpi-audit-alerts');
    if (elAlerts && elAlerts.textContent !== String(lStats.securityAlertsCount)) elAlerts.textContent = lStats.securityAlertsCount;
    const elActors = document.querySelector('#kpi-audit-actors');
    if (elActors && elActors.textContent !== String(lStats.activeActorsCount)) elActors.textContent = lStats.activeActorsCount;
    const elPill = document.querySelector('#audit-total-pill');
    if (elPill) elPill.textContent = `${lStats.total} Total Events`;

    // Compare with current table rows
    const tableBody = document.querySelector('#audit-table-body');
    if (!tableBody) return;

    const firstRowId = tableBody.querySelector('tr[data-log-id]')?.dataset?.logId;
    const newFirstId = liveLogs[0] ? String(liveLogs[0].id) : null;
    const currentRowsCount = tableBody.querySelectorAll('tr[data-log-id]').length;

    if (firstRowId !== newFirstId || currentRowsCount !== liveLogs.length) {
      currentLogs = liveLogs;
      stats = lStats;
      if (liveLogs.length === 0) {
        tableBody.innerHTML = renderEmptyHtml();
      } else {
        tableBody.innerHTML = liveLogs.map(renderRowHtml).join('');
        bindTableEvents();
      }
    }
  }, 2500);

  // Live real-time audit event stream listener
  const handleLiveAuditEntry = (entry) => {
    if (localStorage.getItem('assessify_admin_tab') !== 'audit') return;

    stats.total = (stats.total || 0) + 1;
    stats.todayCount = (stats.todayCount || 0) + 1;
    if (entry.status === 'WARNING' || entry.status === 'FAILURE') {
      stats.securityAlertsCount = (stats.securityAlertsCount || 0) + 1;
    }

    const elTotal = document.querySelector('#kpi-audit-total');
    if (elTotal) elTotal.textContent = stats.total;
    const elToday = document.querySelector('#kpi-audit-today');
    if (elToday) elToday.textContent = stats.todayCount;
    const elAlerts = document.querySelector('#kpi-audit-alerts');
    if (elAlerts) elAlerts.textContent = stats.securityAlertsCount;
    const elPill = document.querySelector('#audit-total-pill');
    if (elPill) elPill.textContent = `${stats.total} Total Events`;

    const matchesCategory = auditFilterState.category === 'all' || entry.category === auditFilterState.category;
    const matchesStatus = auditFilterState.status === 'all' || entry.status === auditFilterState.status;
    const matchesActor = auditFilterState.actorType === 'all' || entry.actorType === auditFilterState.actorType;
    const matchesSearch = !auditFilterState.search ||
      (entry.action && entry.action.toLowerCase().includes(auditFilterState.search.toLowerCase())) ||
      (entry.actorName && entry.actorName.toLowerCase().includes(auditFilterState.search.toLowerCase())) ||
      (entry.target && entry.target.toLowerCase().includes(auditFilterState.search.toLowerCase()));

    if (!matchesCategory || !matchesStatus || !matchesActor || !matchesSearch) return;

    const tableBody = document.querySelector('#audit-table-body');
    if (!tableBody) return;

    if (tableBody.querySelector('.audit-empty-state')) {
      tableBody.innerHTML = '';
    }

    currentLogs.unshift(entry);
    const tempDiv = document.createElement('tbody');
    tempDiv.innerHTML = renderRowHtml(entry);
    const newRow = tempDiv.firstElementChild;
    if (newRow) {
      newRow.style.animation = 'highlightRow 1.8s ease-out';
      tableBody.insertBefore(newRow, tableBody.firstChild);
      bindTableEvents();
    }
  };

  window._adminTabUnsubs = window._adminTabUnsubs || [];
  window._adminTabUnsubs.push(realtime.on('AUDIT_LOG_ENTRY', handleLiveAuditEntry));
}

// ==========================================================================
// System Setting Tab
// ==========================================================================
async function renderAdminSettingsTab(container) {
  const [data, aiDataRes] = await Promise.all([
    request('/api/admin/settings'),
    request('/api/admin/ai-settings').catch(() => ({ configured: false, model: 'gemini-1.5-flash' }))
  ]);
  if (data.error) {
    if (data.error === 'Unauthorized' || data.error.includes('access')) return renderLogin('admin');
    return showToast(data.error, 'error');
  }

  const s = data.settings || {};
  const acSettings = s.antiCheat || {
    enabled: true,
    tabSwitchDetection: true,
    requireFullscreen: true,
    splitScreenDetection: true,
    blockDevTools: true,
    blockCopyPaste: true
  };
  const activeCount = [acSettings.tabSwitchDetection, acSettings.requireFullscreen, acSettings.splitScreenDetection, acSettings.blockDevTools, acSettings.blockCopyPaste].filter((x) => x !== false).length;
  const isAllActive = activeCount === 5;
  const aiData = aiDataRes || { configured: false, model: 'gemini-1.5-flash' };
  const storageMode = data.storageMode || 'mysql';

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:24px">
      <div>
        <div class="eyebrow">System Management</div>
        <h1 style="font:700 32px 'Space Grotesk';margin:6px 0 4px;color:var(--ink)">System Setting</h1>
        <p style="color:var(--muted);font-size:14px;margin:0">Configure institutional assessment duration, passing thresholds, access policies, and platform maintenance mode.</p>
      </div>
      <div class="admin-toolbar">
        <button class="button ghost" id="btn-reset-settings" type="button" style="display:flex;align-items:center;gap:6px">
          ${ICONS.refresh} <span>Reset to Defaults</span>
        </button>
        <button class="button" id="btn-save-settings" type="button" style="display:flex;align-items:center;gap:6px">
          ${ICONS.save} <span>Save Settings</span>
        </button>
      </div>
    </div>

    <div class="settings-container">
      <!-- Status Notice Banner -->
      <div class="system-status-banner ${s.maintenanceMode ? 'system-status-warning' : 'system-status-healthy'}">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:18px">${s.maintenanceMode ? '⚠️' : '✅'}</span>
          <div>
            <strong>${s.maintenanceMode ? 'Maintenance Mode is Active' : 'System Operating Normally'}</strong>
            <span style="display:block;font-size:12px;opacity:0.9">
              ${s.maintenanceMode ? 'Teachers and candidates cannot start new placement assessments while maintenance is active.' : 'All services, teacher assessments, and automatic grading engines are accessible.'}
            </span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;font-weight:600;padding:3px 8px;border-radius:4px;background:rgba(0,0,0,0.06)">Storage: ${storageMode.toUpperCase()}</span>
          <span style="font-size:12px;font-weight:600;padding:3px 8px;border-radius:4px;background:rgba(0,0,0,0.06)">v2026.1</span>
        </div>
      </div>

      <!-- Settings Cards Grid -->
      <div class="settings-grid">
        <!-- 1. Assessment Rules -->
        <div class="setting-card">
          <div class="setting-card-header">
            <div class="setting-card-icon">${ICONS.clock}</div>
            <div>
              <h2 class="setting-card-title">Assessment Session Rules</h2>
              <p class="setting-card-subtitle">Timing and candidate progress enforcement</p>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Assessment Time Limit (Minutes)</label>
              <span class="setting-desc">Total assessment limit (allocated across Grammar, Writing, and Speaking).</span>
            </div>
            <div class="setting-control" style="max-width:120px">
              <input class="setting-input-text" id="setting-duration" type="number" min="15" max="180" step="5" value="${s.durationMinutes || 65}">
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Allow In-Progress Assessment Resume</label>
              <span class="setting-desc">Enables disconnected candidates to resume their existing timer without restarting.</span>
            </div>
            <div class="setting-control">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-allow-resume" ${s.allowResume !== false ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Draft Autosave Frequency</label>
              <span class="setting-desc">Interval for background responses draft synchronization to server.</span>
            </div>
            <div class="setting-control">
              <select class="setting-select" id="setting-autosave-interval">
                <option value="15" ${s.autosaveIntervalSeconds === 15 ? 'selected' : ''}>Every 15 seconds</option>
                <option value="30" ${s.autosaveIntervalSeconds === 30 || !s.autosaveIntervalSeconds ? 'selected' : ''}>Every 30 seconds</option>
                <option value="60" ${s.autosaveIntervalSeconds === 60 ? 'selected' : ''}>Every 60 seconds</option>
              </select>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Require Camera & Microphone</label>
              <span class="setting-desc">Enforces webcam and audio recording capture during Speaking module.</span>
            </div>
            <div class="setting-control">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-require-camera" ${s.requireCameraAudio !== false ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Listening Audio Replays</label>
              <span class="setting-desc">Maximum times candidate may play question speech synthesis.</span>
            </div>
            <div class="setting-control">
              <select class="setting-select" id="setting-audio-plays">
                <option value="1" ${s.maxAudioPlayCount === 1 ? 'selected' : ''}>1 Play (Strict Exam)</option>
                <option value="2" ${s.maxAudioPlayCount === 2 || !s.maxAudioPlayCount ? 'selected' : ''}>2 Plays (Standard)</option>
                <option value="0" ${s.maxAudioPlayCount === 0 ? 'selected' : ''}>Unlimited</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Anti-Cheat & Proctoring Rules -->
        <div class="setting-card">
          <div class="setting-card-header">
            <div class="setting-card-icon" style="background:#eff6ff;color:#1e40af">${ICONS.shield}</div>
            <div>
              <h2 class="setting-card-title">Anti-Cheat & Proctoring</h2>
              <p class="setting-card-subtitle">Active assessment security and integrity rules</p>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Master Anti-Cheat Protection</label>
              <span class="setting-desc" id="sys-anti-cheat-status-desc">${activeCount === 5 ? 'All proctoring rules active across candidate assessments.' : (activeCount === 0 ? 'All proctoring protections disabled.' : `Partially active (${activeCount}/5 rules enabled).`)}</span>
            </div>
            <div class="setting-control">
              <label class="toggle-switch">
                <input type="checkbox" id="sys-anti-cheat-master" ${isAllActive ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Tab Switch Detection</label>
              <span class="setting-desc">Record violations when candidate switches tabs or minimizes the window.</span>
            </div>
            <div class="setting-control">
              <label class="toggle-switch">
                <input type="checkbox" class="sys-anti-cheat-subtoggle" id="sys-ac-tab-switch" ${acSettings.tabSwitchDetection !== false ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Mandatory Fullscreen Mode</label>
              <span class="setting-desc">Enforce fullscreen view throughout assessment with exit lockdown screen.</span>
            </div>
            <div class="setting-control">
              <label class="toggle-switch">
                <input type="checkbox" class="sys-anti-cheat-subtoggle" id="sys-ac-fullscreen" ${acSettings.requireFullscreen !== false ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Split Screen Detection</label>
              <span class="setting-desc">Detect and alert when screen viewport is reduced to &lt; 65% of screen size.</span>
            </div>
            <div class="setting-control">
              <label class="toggle-switch">
                <input type="checkbox" class="sys-anti-cheat-subtoggle" id="sys-ac-split-screen" ${acSettings.splitScreenDetection !== false ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Block Developer Tools</label>
              <span class="setting-desc">Prevent F12, Ctrl+Shift+I, and shortcut inspection utilities.</span>
            </div>
            <div class="setting-control">
              <label class="toggle-switch">
                <input type="checkbox" class="sys-anti-cheat-subtoggle" id="sys-ac-dev-tools" ${acSettings.blockDevTools !== false ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Block Copy & Paste</label>
              <span class="setting-desc">Disable right-click context menu, clipboard cut, copy, and paste actions.</span>
            </div>
            <div class="setting-control">
              <label class="toggle-switch">
                <input type="checkbox" class="sys-anti-cheat-subtoggle" id="sys-ac-copy-paste" ${acSettings.blockCopyPaste !== false ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- 2. Standards & Certification -->
        <div class="setting-card">
          <div class="setting-card-header">
            <div class="setting-card-icon" style="background:#f0fdf4;color:#16a34a">${ICONS.award}</div>
            <div>
              <h2 class="setting-card-title">Placement Standards & Rubrics</h2>
              <p class="setting-card-subtitle">CEFR benchmark and automatic scoring</p>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Passing CEFR / Band Threshold</label>
              <span class="setting-desc">Minimum target placement recommended for school certification.</span>
            </div>
            <div class="setting-control">
              <select class="setting-select" id="setting-passing-band">
                <option value="5.5" ${s.passingBand === '5.5' ? 'selected' : ''}>Band 5.5 (B2 Foundation)</option>
                <option value="6.0" ${s.passingBand === '6.0' ? 'selected' : ''}>Band 6.0 (Competent B2)</option>
                <option value="6.5" ${s.passingBand === '6.5' || !s.passingBand ? 'selected' : ''}>Band 6.5 (Proficient B2/C1)</option>
                <option value="7.0" ${s.passingBand === '7.0' ? 'selected' : ''}>Band 7.0 (Good User C1)</option>
                <option value="7.5" ${s.passingBand === '7.5' ? 'selected' : ''}>Band 7.5 (Advanced C1)</option>
              </select>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Automated Provisional Placement</label>
              <span class="setting-desc">Calculates provisional placement instantly upon candidate test submission.</span>
            </div>
            <div class="setting-control">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-auto-score" ${s.provisionalScoringAuto !== false ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Certificate Issuing Body</label>
              <span class="setting-desc">Official institution entity printed on PDF placement records.</span>
            </div>
            <div class="setting-control" style="width:100%;max-width:240px">
              <input class="setting-input-text" id="setting-issuer" type="text" value="${s.certificateIssuer || 'Pusat Bahasa & Asesmen Guru Karya Bangsa'}">
            </div>
          </div>
        </div>

        <!-- 3. Institution Policy & Whitelist -->
        <div class="setting-card">
          <div class="setting-card-header">
            <div class="setting-card-icon" style="background:#fef3c7;color:#d97706">${ICONS.school}</div>
            <div>
              <h2 class="setting-card-title">Institution & Access Policy</h2>
              <p class="setting-card-subtitle">Identity verification and domain validation</p>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">School Name</label>
              <span class="setting-desc">Primary institution branding displayed in headers and certificates.</span>
            </div>
            <div class="setting-control" style="width:100%;max-width:220px">
              <input class="setting-input-text" id="setting-school-name" type="text" value="${s.schoolName || 'Karya Bangsa School'}">
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">School Email Domain</label>
              <span class="setting-desc">Strict domain required for candidate logins.</span>
            </div>
            <div class="setting-control" style="width:100%;max-width:220px">
              <input class="setting-input-text" id="setting-school-domain" type="text" value="${s.schoolDomain || 'karyabangsa.sch.id'}">
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Support Email Contact</label>
              <span class="setting-desc">Contact email presented when candidates face issues.</span>
            </div>
            <div class="setting-control" style="width:100%;max-width:220px">
              <input class="setting-input-text" id="setting-support-email" type="email" value="${s.supportEmail || 'admin@karyabangsa.sch.id'}">
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Strict Teacher Whitelist</label>
              <span class="setting-desc">Only pre-authorized teachers in User Manager may take the test.</span>
            </div>
            <div class="setting-control">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-enforce-whitelist" ${s.enforceTeacherWhitelist !== false ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Strict School Unit Matching</label>
              <span class="setting-desc">Candidate must select the exact school unit they are registered under.</span>
            </div>
            <div class="setting-control">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-enforce-unit" ${s.enforceUnitMatch !== false ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- 4. System Maintenance & Availability -->
        <div class="setting-card">
          <div class="setting-card-header">
            <div class="setting-card-icon" style="background:#fee2e2;color:#dc2626">${ICONS.lock}</div>
            <div>
              <h2 class="setting-card-title">Maintenance & Availability</h2>
              <p class="setting-card-subtitle">Control candidate access during maintenance</p>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">System Maintenance Mode</label>
              <span class="setting-desc">Immediately pauses test taking. Administrators retain full access.</span>
            </div>
            <div class="setting-control">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-maintenance-mode" ${s.maintenanceMode ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row" style="flex-direction:column;align-items:stretch">
            <div class="setting-info" style="margin-bottom:8px">
              <label class="setting-label">Maintenance Announcement Notice</label>
              <span class="setting-desc">Message displayed to candidates trying to start an assessment.</span>
            </div>
            <textarea class="setting-textarea" id="setting-maintenance-msg">${s.maintenanceMessage || 'Assessify is currently undergoing scheduled maintenance. Candidate assessments will resume shortly.'}</textarea>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Session Timeout</label>
              <span class="setting-desc">Duration of user session authentication cookie validity.</span>
            </div>
            <div class="setting-control">
              <select class="setting-select" id="setting-session-timeout">
                <option value="6" ${s.sessionTimeoutHours === 6 ? 'selected' : ''}>6 Hours</option>
                <option value="12" ${s.sessionTimeoutHours === 12 || !s.sessionTimeoutHours ? 'selected' : ''}>12 Hours (Default)</option>
                <option value="24" ${s.sessionTimeoutHours === 24 ? 'selected' : ''}>24 Hours</option>
                <option value="168" ${s.sessionTimeoutHours === 168 ? 'selected' : ''}>7 Days</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 5. Google Gemini AI Evaluation -->
        <div class="setting-card">
          <div class="setting-card-header">
            <div class="setting-card-icon" style="background:#ede9fe;color:#7c3aed">✨</div>
            <div>
              <h2 class="setting-card-title">Google Gemini AI Evaluation</h2>
              <p class="setting-card-subtitle">AI-assisted CEFR scoring for Writing essays and Speaking audio/video</p>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Gemini API Status</label>
              <span class="setting-desc">State of institutional Google Gemini AI evaluation engine.</span>
            </div>
            <div class="setting-control">
              <span class="pill ${aiData.configured ? 'success' : 'pending'}">${aiData.configured ? 'Active & Configured' : 'Key Not Set'}</span>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Gemini API Key</label>
              <span class="setting-desc">Google AI Studio API key. Stored securely and masked.</span>
            </div>
            <div class="setting-control" style="width:100%;max-width:240px">
              <input class="setting-input-text" id="setting-gemini-key" type="password" placeholder="${aiData.configured ? aiData.maskedKey : 'Enter Gemini API key…'}" autocomplete="off">
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Gemini Multimodal Model</label>
              <span class="setting-desc">Model used to grade essays and listen to candidate oral speech.</span>
            </div>
            <div class="setting-control">
              <select class="setting-select" id="setting-gemini-model">
                <option value="gemini-flash-latest" ${(aiData.model === 'gemini-flash-latest' || !aiData.model) ? 'selected' : ''}>Gemini Flash (Fast & Multimodal - Recommended)</option>
                <option value="gemini-3.6-flash" ${aiData.model === 'gemini-3.6-flash' ? 'selected' : ''}>Gemini 3.6 Flash</option>
                <option value="gemini-pro-latest" ${aiData.model === 'gemini-pro-latest' ? 'selected' : ''}>Gemini Pro Latest (Deep Reasoning)</option>
              </select>
            </div>
          </div>

          <div class="setting-row" style="border-top:1px solid var(--line);padding-top:14px;justify-content:flex-end">
            <button class="button ghost" id="btn-test-ai-key" type="button" style="display:flex;align-items:center;gap:6px">
              <span>⚡ Test Gemini Connection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Test Gemini Connection
  const testAiBtn = document.querySelector('#btn-test-ai-key');
  if (testAiBtn) {
    testAiBtn.onclick = async () => {
      testAiBtn.disabled = true;
      testAiBtn.innerHTML = '<span>Testing connection…</span>';
      try {
        const testRes = await request('/api/admin/ai-settings/test', { method: 'POST' });
        if (testRes.error) {
          showToast(testRes.error, 'error');
        } else {
          showToast(testRes.message || 'Gemini API connection succeeded!', 'success');
        }
      } catch (err) {
        showToast(err.message || 'Connection test failed', 'error');
      } finally {
        testAiBtn.disabled = false;
        testAiBtn.innerHTML = '<span>⚡ Test Gemini Connection</span>';
      }
    };
  }

  // Anti-Cheat master & sub-toggles synchronization
  const masterToggle = document.querySelector('#sys-anti-cheat-master');
  const subToggles = document.querySelectorAll('.sys-anti-cheat-subtoggle');
  const statusDesc = document.querySelector('#sys-anti-cheat-status-desc');

  const updateMasterStatus = () => {
    const total = subToggles.length;
    const checked = Array.from(subToggles).filter((t) => t.checked).length;
    if (masterToggle) {
      masterToggle.checked = checked > 0;
      masterToggle.indeterminate = (checked > 0 && checked < total);
    }
    if (statusDesc) {
      if (checked === total) statusDesc.textContent = 'All proctoring rules active across candidate assessments.';
      else if (checked === 0) statusDesc.textContent = 'All proctoring protections disabled.';
      else statusDesc.textContent = `Partially active (${checked}/${total} rules enabled).`;
    }
  };

  if (masterToggle) {
    masterToggle.addEventListener('change', (e) => {
      subToggles.forEach((st) => { st.checked = e.target.checked; });
      updateMasterStatus();
    });
  }
  subToggles.forEach((st) => st.addEventListener('change', updateMasterStatus));

  // Save Settings
  document.querySelector('#btn-save-settings').onclick = async () => {
    const saveBtn = document.querySelector('#btn-save-settings');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span>Saving…</span>`;

    const payload = {
      antiCheat: {
        enabled: document.querySelector('#sys-anti-cheat-master')?.checked || false,
        tabSwitchDetection: document.querySelector('#sys-ac-tab-switch')?.checked || false,
        requireFullscreen: document.querySelector('#sys-ac-fullscreen')?.checked || false,
        splitScreenDetection: document.querySelector('#sys-ac-split-screen')?.checked || false,
        blockDevTools: document.querySelector('#sys-ac-dev-tools')?.checked || false,
        blockCopyPaste: document.querySelector('#sys-ac-copy-paste')?.checked || false
      },
      durationMinutes: Number(document.querySelector('#setting-duration').value) || 65,
      allowResume: document.querySelector('#setting-allow-resume').checked,
      autosaveIntervalSeconds: Number(document.querySelector('#setting-autosave-interval').value) || 30,
      requireCameraAudio: document.querySelector('#setting-require-camera').checked,
      maxAudioPlayCount: Number(document.querySelector('#setting-audio-plays').value),
      passingBand: document.querySelector('#setting-passing-band').value,
      provisionalScoringAuto: document.querySelector('#setting-auto-score').checked,
      certificateIssuer: document.querySelector('#setting-issuer').value.trim(),
      schoolName: document.querySelector('#setting-school-name').value.trim(),
      schoolDomain: document.querySelector('#setting-school-domain').value.trim(),
      supportEmail: document.querySelector('#setting-support-email').value.trim(),
      enforceTeacherWhitelist: document.querySelector('#setting-enforce-whitelist').checked,
      enforceUnitMatch: document.querySelector('#setting-enforce-unit').checked,
      maintenanceMode: document.querySelector('#setting-maintenance-mode').checked,
      maintenanceMessage: document.querySelector('#setting-maintenance-msg').value.trim(),
      sessionTimeoutHours: Number(document.querySelector('#setting-session-timeout').value) || 12
    };

    const geminiKeyInput = document.querySelector('#setting-gemini-key');
    if (geminiKeyInput && geminiKeyInput.value.trim()) {
      payload.gemini_api_key = geminiKeyInput.value.trim();
    }
    const geminiModelSelect = document.querySelector('#setting-gemini-model');
    if (geminiModelSelect) {
      payload.gemini_model = geminiModelSelect.value;
    }

    const res = await request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    saveBtn.disabled = false;
    saveBtn.innerHTML = `${ICONS.save} <span>Save Settings</span>`;

    if (res.error) {
      showToast(res.error, 'error');
    } else {
      if (res.settings) window.assessifySettings = res.settings;
      showToast('System settings saved successfully', 'success');
      renderAdminSettingsTab(container);
    }
  };

  // Reset to Defaults
  document.querySelector('#btn-reset-settings').onclick = () => {
    modalRoot.innerHTML = `
      <div class="modal-overlay" id="confirm-reset-settings-modal">
        <div class="modal-card" style="max-width:440px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
            <div style="width:40px;height:40px;border-radius:50%;background:#fef3c7;color:#d97706;display:flex;align-items:center;justify-content:center">
              ${ICONS.alertTriangle}
            </div>
            <div>
              <h2 style="font:700 18px 'Space Grotesk';margin:0;color:var(--ink)">Reset System Settings?</h2>
              <span style="font-size:12px;color:var(--muted)">Restore default institutional configuration.</span>
            </div>
          </div>
          <p style="font-size:13.5px;line-height:1.5;color:#475569;margin-bottom:20px">
            This will reset all timing, passing bands, and access rules to the standard Karya Bangsa School defaults. Are you sure you wish to proceed?
          </p>
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button class="button ghost" id="modal-cancel-reset" type="button">Cancel</button>
            <button class="button" id="modal-confirm-reset" type="button" style="background:#d97706;border-color:#d97706">Reset to Defaults</button>
          </div>
        </div>
      </div>
    `;

    document.querySelector('#modal-cancel-reset').onclick = () => { modalRoot.innerHTML = ''; };
    document.querySelector('#modal-confirm-reset').onclick = async () => {
      const resetBtn = document.querySelector('#modal-confirm-reset');
      resetBtn.disabled = true;
      resetBtn.textContent = 'Resetting…';
      const rRes = await request('/api/admin/settings/reset', { method: 'POST' });
      modalRoot.innerHTML = '';
      if (rRes.error) {
        showToast(rRes.error, 'error');
      } else {
        if (rRes.settings) window.assessifySettings = rRes.settings;
        showToast('System settings restored to defaults', 'success');
        renderAdminSettingsTab(container);
      }
    };
  };
}

// Mobile Sidebar Controls
const sidebarBurger = document.querySelector('#sidebar-burger');
if (sidebarBurger) {
  sidebarBurger.onclick = (e) => {
    e.stopPropagation();
    const isOpen = document.body.classList.toggle('sidebar-open');
    const sb = document.querySelector('#admin-sidebar');
    if (sb) sb.classList.toggle('open', isOpen);
    sidebarBurger.setAttribute('aria-expanded', String(isOpen));
    sidebarBurger.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
  };
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
    document.body.classList.remove('sidebar-open');
    const sb = document.querySelector('#admin-sidebar');
    if (sb) sb.classList.remove('open');
    const burger = document.querySelector('#sidebar-burger');
    if (burger) {
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Open navigation menu');
    }
  }
});

// Global Auth & Logout
document.querySelector('#logout').onclick = async () => {
  realtime.disconnect();
  await request('/api/auth/logout', { method: 'POST' });
  document.querySelector('#logout').hidden = true;
  document.body.classList.remove('has-admin-sidebar', 'sidebar-open');
  localStorage.removeItem('assessify_admin_tab');
  localStorage.removeItem('assessify_user');
  history.replaceState(null, '', window.location.pathname);
  renderLogin();
};

async function loadPublicSettings() {
  try {
    const s = await request('/api/public-settings');
    if (s) window.assessifySettings = s;
  } catch {}
}

async function init() {
  await loadPublicSettings();
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
