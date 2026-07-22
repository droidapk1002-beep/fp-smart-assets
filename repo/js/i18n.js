/* FP_BASE_URL : préfixe vers les assets (utile quand ce script est chargé
   depuis un CDN comme jsDelivr, ex. sur Blogger). Laisser vide pour un
   usage local/standalone classique (chemins relatifs "data/..."). */
var FP_BASE_URL = (typeof window !== 'undefined' && window.FP_BASE_URL) || '';

const APP = {
  lang: localStorage.getItem('fp_lang') || 'fr',
  theme: localStorage.getItem('fp_theme') || 'light',
  db: null,
  i18n: null,
  filters: {
    diploma: '',
    semester: '',
    specialty: '',
    module: '',
    type: '',
    year: '',
    institution: '',
    search: ''
  }
};

function t(path) {
  const dict = APP.i18n[APP.lang];
  const parts = path.split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
    else return path;
  }
  return cur;
}

function localized(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[APP.lang] || field.fr || Object.values(field)[0] || '';
}

async function loadData() {
  var ghRaw = 'https://raw.githubusercontent.com/droidapk1002-beep/fp-smart-assets/main/repo/';
  var dayStamp = new Date().toISOString().slice(0, 10);
  var [dbRes, i18nRes] = await Promise.all([
    fetch(ghRaw + 'data/db.json?t=' + dayStamp),
    fetch(FP_BASE_URL + 'data/i18n.json?v=3')
  ]);
  const defaultDb = await dbRes.json();
  const customDb = localStorage.getItem('fp_custom_db');
  if (customDb) {
    try { APP.db = JSON.parse(customDb); } catch(e) { APP.db = defaultDb; }
  } else {
    APP.db = defaultDb;
  }
  if (defaultDb.hidden) {
    var h = defaultDb.hidden;
    if (h.docIds && !localStorage.getItem('fp_hidden_doc_ids')) localStorage.setItem('fp_hidden_doc_ids', JSON.stringify(h.docIds));
    if (h.diplomaIds && !localStorage.getItem('fp_hidden_diploma_ids')) localStorage.setItem('fp_hidden_diploma_ids', JSON.stringify(h.diplomaIds));
    if (h.semesterIds && !localStorage.getItem('fp_hidden_semester_ids')) localStorage.setItem('fp_hidden_semester_ids', JSON.stringify(h.semesterIds));
    if (h.moduleIds && !localStorage.getItem('fp_hidden_module_ids')) localStorage.setItem('fp_hidden_module_ids', JSON.stringify(h.moduleIds));
    if (h.specialtyIds && !localStorage.getItem('fp_hidden_specialty_ids')) localStorage.setItem('fp_hidden_specialty_ids', JSON.stringify(h.specialtyIds));
  }
  APP.i18n = await i18nRes.json();
}

function applyLangToDocument() {
  const dir = APP.i18n[APP.lang].dir;
  document.documentElement.lang = APP.lang;
  document.documentElement.dir = dir;
  document.documentElement.setAttribute('data-theme', APP.theme);
}

function setLang(lang) {
  APP.lang = lang;
  localStorage.setItem('fp_lang', lang);
  applyLangToDocument();
  if (typeof onLangChange === 'function') onLangChange();
}

function setTheme(theme) {
  APP.theme = theme;
  localStorage.setItem('fp_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  setTheme(APP.theme === 'light' ? 'dark' : 'light');
}

function translateStaticDOM(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val !== key) el.textContent = val;
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = t(key);
    if (val !== key) el.setAttribute('placeholder', val);
  });
}

function showToast(msg) {
  let toastEl = document.getElementById('global-toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'global-toast';
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function applyLocalDocOverrides() {
  var custom = localStorage.getItem('fp_custom_db');
  if (custom) {
    try { var parsed = JSON.parse(custom); if (parsed.documents) APP.db = parsed; } catch(e) {}
  }
}
