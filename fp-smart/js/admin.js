/* ============================================================
   ADMIN – API keys management
   ============================================================ */
const STORAGE_KEYS_KEY = 'fp_api_keys';
const ADMIN_PW_KEY = 'fp_admin_password';

function getStoredKeys() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS_KEY) || '[]'); } catch { return []; }
}
function saveStoredKeys(keys) {
  localStorage.setItem(STORAGE_KEYS_KEY, JSON.stringify(keys));
}
function getSelectedKey() {
  const keys = getStoredKeys();
  const active = keys.find(k => k.active);
  return active || keys[0] || null;
}
function setSelectedKey(idx) {
  localStorage.setItem('fp_selected_key_idx', idx);
}

function sanitizeApiKey(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u200B\u200C\u200D\uFEFF\u00A0\s]/g, '').replace(/^(['"])(.*)\1$/, '$2').trim();
}
function maskKey(key) {
  if (!key || key.length < 8) return '••••••••';
  return key.slice(0, 4) + '••••' + key.slice(-4);
}
function detectProvider(key) {
  if (!key) return '';
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-')) return 'openai';
  if (/^AIza[A-Za-z0-9_-]{30,}$/.test(key)) return 'google';
  if (key.length > 30 && !key.includes('-') && !key.includes(' ')) return 'google';
  return '';
}

function initAdminPanel() {
  const lockScreen = document.getElementById('admin-lock-screen');
  const content = document.getElementById('admin-content');
  const storedPw = localStorage.getItem(ADMIN_PW_KEY);

  if (!storedPw) {
    // First visit: show setup
    document.getElementById('admin-login-form').style.display = 'none';
    document.getElementById('admin-setup-form').style.display = 'block';
  } else {
    document.getElementById('admin-setup-form').style.display = 'none';
    lockScreen.style.display = '';
  }

  document.getElementById('admin-setup-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = document.getElementById('admin-setup-password').value;
    if (pw.length < 4) { alert(t('admin.passwordMinChars')); return; }
    localStorage.setItem(ADMIN_PW_KEY, pw);
    lockScreen.style.display = 'none';
    content.classList.remove('hidden');
    showToast(t('admin.passwordUpdated'));
    initAdminContent();
  });

  document.getElementById('admin-login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('admin-password-input');
    if (input.value === localStorage.getItem(ADMIN_PW_KEY)) {
      lockScreen.style.display = 'none';
      content.classList.remove('hidden');
      initAdminContent();
    } else {
      document.getElementById('admin-error').textContent = t('admin.wrongPassword');
    }
  });

  document.getElementById('admin-logout-btn')?.addEventListener('click', () => {
    document.getElementById('admin-content').classList.add('hidden');
    document.getElementById('admin-lock-screen').style.display = '';
  });
}

function initAdminContent() {
  // Tabs
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById('tab-panel-' + btn.dataset.tab).classList.remove('hidden');
    });
  });

  // Docs sub-tab switching
  var docsSubTabs = document.querySelectorAll('#tab-panel-docs .admin-sub-tab');
  docsSubTabs.forEach(function(btn) {
    btn.addEventListener('click', function() {
      docsSubTabs.forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('#tab-panel-docs .admin-sub-panel').forEach(function(p) { p.classList.add('hidden'); });
      btn.classList.add('active');
      var panel = document.getElementById('sub-panel-' + btn.dataset.subtab);
      if (panel) panel.classList.remove('hidden');
    });
  });

  // Init documents
  initDocManager();
  initImportTab();

  // Init structure (diplomas, semesters, modules, specialties)
  initStructureTab();

  // Init keys
  renderKeys();

  document.getElementById('add-key-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const provider = document.getElementById('key-provider').value;
    const apiKey = sanitizeApiKey(document.getElementById('key-api-key').value);
    const model = document.getElementById('key-model').value.trim();
    if (!apiKey || !model) { showToast('Champs obligatoires'); return; }
    const keys = getStoredKeys();
    keys.push({ provider, apiKey, model });
    saveStoredKeys(keys);
    renderKeys();
    document.getElementById('add-key-form').reset();
    showToast(t('admin.keyAdded'));
  });

  // Change password
  document.getElementById('change-password-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const old = document.getElementById('change-password-old').value;
    const newPw = document.getElementById('change-password-new').value;
    if (old !== localStorage.getItem(ADMIN_PW_KEY)) { showToast(t('admin.wrongPassword')); return; }
    if (newPw.length < 4) { alert(t('admin.passwordMinChars')); return; }
    localStorage.setItem(ADMIN_PW_KEY, newPw);
    showToast(t('admin.passwordUpdated'));
    document.getElementById('change-password-form').reset();
  });

  // Tab-to-fill: pressing Tab on an empty field with placeholder fills it
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Tab') return;
    var el = document.activeElement;
    if (!el || el.tagName === 'SELECT' || el.tagName === 'BUTTON') return;
    if (!el.closest('#doc-form')) return;
    if (el.value || !el.placeholder) return;
    e.preventDefault();
    el.value = el.placeholder;
    var form = el.closest('form');
    if (!form) return;
    var inputs = Array.from(form.querySelectorAll('input, textarea, select'));
    var idx = inputs.indexOf(el);
    if (idx >= 0 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
    }
  });
}

/* ============================================================
   STRUCTURE – Entity overrides (diplomas, semesters, specialties, modules)
   ============================================================ */
const CUSTOM_DIPLOMAS_KEY = 'fp_custom_diplomas';
const DELETED_DIPLOMAS_KEY = 'fp_deleted_diploma_ids';
const CUSTOM_SPECIALTIES_KEY = 'fp_custom_specialties';
const DELETED_SPECIALTIES_KEY = 'fp_deleted_specialty_ids';
const CUSTOM_MODULES_KEY = 'fp_custom_modules';
const DELETED_MODULES_KEY = 'fp_deleted_module_ids';

function getCustomDiplomas() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_DIPLOMAS_KEY) || '[]'); } catch { return []; }
}
function saveCustomDiplomas(arr) {
  localStorage.setItem(CUSTOM_DIPLOMAS_KEY, JSON.stringify(arr));
}
function getDeletedDiplomaIds() {
  try { return JSON.parse(localStorage.getItem(DELETED_DIPLOMAS_KEY) || '[]'); } catch { return []; }
}
function saveDeletedDiplomaIds(arr) {
  localStorage.setItem(DELETED_DIPLOMAS_KEY, JSON.stringify(arr));
}
function getCustomSpecialties() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_SPECIALTIES_KEY) || '[]'); } catch { return []; }
}
function saveCustomSpecialties(arr) {
  localStorage.setItem(CUSTOM_SPECIALTIES_KEY, JSON.stringify(arr));
}
function getDeletedSpecialtyIds() {
  try { return JSON.parse(localStorage.getItem(DELETED_SPECIALTIES_KEY) || '[]'); } catch { return []; }
}
function saveDeletedSpecialtyIds(arr) {
  localStorage.setItem(DELETED_SPECIALTIES_KEY, JSON.stringify(arr));
}
function getCustomModules() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_MODULES_KEY) || '[]'); } catch { return []; }
}
function saveCustomModules(arr) {
  localStorage.setItem(CUSTOM_MODULES_KEY, JSON.stringify(arr));
}
function getDeletedModuleIds() {
  try { return JSON.parse(localStorage.getItem(DELETED_MODULES_KEY) || '[]'); } catch { return []; }
}
function saveDeletedModuleIds(arr) {
  localStorage.setItem(DELETED_MODULES_KEY, JSON.stringify(arr));
}

function applyStructuralOverrides() {
  if (!APP.db) return;
  var customDip = getCustomDiplomas();
  var delDip = new Set(getDeletedDiplomaIds());
  if (customDip.length) {
    customDip.forEach(function(cd) {
      var idx = APP.db.diplomas.findIndex(function(d) { return d.id === cd.id; });
      if (idx >= 0) APP.db.diplomas[idx] = cd;
      else APP.db.diplomas.push(cd);
    });
  }
  APP.db.diplomas = APP.db.diplomas.filter(function(d) { return !delDip.has(d.id); });

  var customSpec = getCustomSpecialties();
  var delSpec = new Set(getDeletedSpecialtyIds());
  if (customSpec.length) {
    customSpec.forEach(function(cs) {
      var idx = APP.db.specialties.findIndex(function(s) { return s.id === cs.id; });
      if (idx >= 0) APP.db.specialties[idx] = cs;
      else APP.db.specialties.push(cs);
    });
  }
  APP.db.specialties = APP.db.specialties.filter(function(s) { return !delSpec.has(s.id); });

  var customMod = getCustomModules();
  var delMod = new Set(getDeletedModuleIds());
  if (customMod.length) {
    customMod.forEach(function(cm) {
      var idx = APP.db.modules.findIndex(function(m) { return m.id === cm.id; });
      if (idx >= 0) APP.db.modules[idx] = cm;
      else APP.db.modules.push(cm);
    });
  }
  APP.db.modules = APP.db.modules.filter(function(m) { return !delMod.has(m.id); });
}

/* ---- Structure tab sub-navigation ---- */
function initStructureTab() {
  document.querySelectorAll('#tab-panel-structure .admin-sub-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#tab-panel-structure .admin-sub-tab').forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('#tab-panel-structure .admin-sub-panel').forEach(function(p) { p.classList.add('hidden'); });
      btn.classList.add('active');
      document.getElementById('sub-panel-' + btn.dataset.subtab).classList.remove('hidden');
    });
  });
  renderDiplomasTable();
  renderSpecialtiesTable();
  wireSemesterSelect();
  wireModuleSelect();
  wireEntityForms();
}

/* ---- HIDE / UNHIDE for structure entities ---- */
var ENTITY_HIDDEN_KEYS = {
  diplomas: 'fp_hidden_diploma_ids',
  semesters: 'fp_hidden_semester_ids',
  modules: 'fp_hidden_module_ids',
  specialties: 'fp_hidden_specialty_ids'
};

function getEntityHiddenIds(type) {
  var key = ENTITY_HIDDEN_KEYS[type];
  if (!key) return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function saveEntityHiddenIds(type, ids) {
  var key = ENTITY_HIDDEN_KEYS[type];
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(ids));
}

function toggleEntityVisibility(type, id) {
  var hidden = getEntityHiddenIds(type);
  var idx = hidden.indexOf(id);
  if (idx >= 0) { hidden.splice(idx, 1); } else { hidden.push(id); }
  saveEntityHiddenIds(type, hidden);
  return idx < 0; // returns true if now hidden
}

/* ---- DIPLOMAS ---- */
var editingDiplomaId = null;

function renderDiplomasTable() {
  var tbody = document.getElementById('diplomas-table-body');
  if (!tbody) return;
  var hidden = getEntityHiddenIds('diplomas');
  var html = APP.db.diplomas.map(function(d) {
    var isHidden = hidden.indexOf(d.id) >= 0;
    var sc = (d.semesters || []).length;
    return '<tr' + (isHidden ? ' style="opacity:0.5;"' : '') + '>' +
      '<td><code>' + escapeHTML(d.id) + '</code></td>' +
      '<td>' + escapeHTML(localized(d.name)) + (isHidden ? ' <span class="local-tag" style="background:var(--ink-soft);">masqué</span>' : '') + '</td>' +
      '<td>Niveau ' + escapeHTML(String(d.level || '')) + '</td>' +
      '<td>' + escapeHTML(d.duration || '—') + '</td>' +
      '<td>' + sc + '</td>' +
      '<td class="doc-table-actions">' +
        '<button class="btn btn-ghost btn-sm toggle-visibility-btn" data-type="diplomas" data-id="' + escapeAttr(d.id) + '" title="' + (isHidden ? 'Afficher' : 'Masquer') + '">' + (isHidden ? '👁' : '🙈') + '</button>' +
        '<button class="btn btn-secondary btn-sm edit-diploma-btn" data-id="' + escapeAttr(d.id) + '">' + icon('settings') + '</button>' +
        '<button class="btn btn-danger btn-sm delete-diploma-btn" data-id="' + escapeAttr(d.id) + '">' + icon('trash') + '</button>' +
      '</td></tr>';
  }).join('');
  if (!html) html = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--ink-soft);">' + (t('empty.title') || 'Aucun diplôme') + '</td></tr>';
  tbody.innerHTML = html;
}

function wireEntityForms() {
  // Diploma
  document.getElementById('add-diploma-btn')?.addEventListener('click', function() {
    editingDiplomaId = null;
    document.getElementById('diploma-form').reset();
    document.getElementById('diploma-form-code').readOnly = false;
    document.getElementById('diploma-form-title').textContent = t('admin.addDiploma');
    document.getElementById('diploma-form-submit').textContent = t('admin.save');
    document.getElementById('diploma-form-section').style.display = 'block';
  });
  document.getElementById('diploma-form-cancel')?.addEventListener('click', function() {
    document.getElementById('diploma-form-section').style.display = 'none';
  });
  document.getElementById('diploma-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = editingDiplomaId || document.getElementById('diploma-form-code').value.trim();
    var semCount = parseInt(document.getElementById('diploma-form-sem-count').value, 10) || 4;
    var existingSemesters = [];
    if (editingDiplomaId) {
      var existing = APP.db.diplomas.find(function(d) { return d.id === editingDiplomaId; });
      if (existing) existingSemesters = existing.semesters || [];
    }
    var semesters = [];
    for (var i = 0; i < semCount; i++) {
      var n = i + 1;
      var sid = id + '-s' + n;
      var oldSem = existingSemesters.find(function(s) { return s.id === sid; });
      if (oldSem) {
        semesters.push(oldSem);
      } else {
        semesters.push({
          id: sid,
          name: { fr: 'Semestre ' + n, ar: 'الفصل ' + n, en: 'Semester ' + n },
          label: 'S' + n
        });
      }
    }
    var dip = {
      id: id,
      name: {
        fr: document.getElementById('diploma-form-name-fr').value.trim(),
        ar: document.getElementById('diploma-form-name-ar').value.trim() || document.getElementById('diploma-form-name-fr').value.trim(),
        en: document.getElementById('diploma-form-name-en').value.trim() || document.getElementById('diploma-form-name-fr').value.trim()
      },
      level: parseInt(document.getElementById('diploma-form-level').value, 10) || 3,
      duration: document.getElementById('diploma-form-duration').value.trim() || '',
      semesters: semesters
    };
    var custom = getCustomDiplomas();
    if (editingDiplomaId) {
      var idx = custom.findIndex(function(d) { return d.id === editingDiplomaId; });
      if (idx >= 0) custom[idx] = dip;
      else custom.push(dip);
      var baseIdx = APP.db.diplomas.findIndex(function(d) { return d.id === editingDiplomaId; });
      if (baseIdx >= 0) APP.db.diplomas[baseIdx] = dip;
    } else {
      custom.push(dip);
      APP.db.diplomas.push(dip);
    }
    saveCustomDiplomas(custom);
    document.getElementById('diploma-form-section').style.display = 'none';
    renderDiplomasTable();
    wireSemesterSelect();
    showToast((editingDiplomaId ? t('admin.entityUpdated') : t('admin.entityAdded')) + ' : ' + localized(dip.name));
  });

  // Semester
  document.getElementById('add-semester-btn')?.addEventListener('click', function() {
    var dipId = document.getElementById('semester-diploma-select').value;
    if (!dipId) return;
    editingSemesterDiploma = dipId;
    editingSemesterId = null;
    document.getElementById('semester-form').reset();
    var n = (APP.db.diplomas.find(function(d) { return d.id === dipId; })?.semesters?.length || 0) + 1;
    document.getElementById('semester-form-name-fr').value = 'Semestre ' + n;
    document.getElementById('semester-form-name-ar').value = '';
    document.getElementById('semester-form-name-en').value = '';
    document.getElementById('semester-form-label').value = 'S' + n;
    document.getElementById('semester-form-order').value = n;
    document.getElementById('semester-form-title').textContent = t('admin.addSemester');
    document.getElementById('semester-form-section').style.display = 'block';
  });
  document.getElementById('semester-form-cancel')?.addEventListener('click', function() {
    document.getElementById('semester-form-section').style.display = 'none';
  });
  document.getElementById('semester-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    var dipId = document.getElementById('semester-diploma-select').value;
    if (!dipId) return;
    var order = parseInt(document.getElementById('semester-form-order').value, 10) || 1;
    var nameFr = document.getElementById('semester-form-name-fr').value.trim();
    var nameAr = document.getElementById('semester-form-name-ar').value.trim();
    var nameEn = document.getElementById('semester-form-name-en').value.trim();
    var label = document.getElementById('semester-form-label').value.trim() || 'S' + order;
    var semId = dipId + '-s' + order;
    var semester = {
      id: semId,
      name: { fr: nameFr, ar: nameAr || nameFr, en: nameEn || nameFr },
      label: label
    };
    var dip = APP.db.diplomas.find(function(d) { return d.id === dipId; });
    if (!dip) return;
    if (!dip.semesters) dip.semesters = [];
    var custom = getCustomDiplomas();
    var cDip = custom.find(function(d) { return d.id === dipId; });
    if (!cDip) {
      cDip = JSON.parse(JSON.stringify(dip));
      custom.push(cDip);
    }
    if (editingSemesterId) {
      var sIdx = cDip.semesters.findIndex(function(s) { return s.id === editingSemesterId; });
      if (sIdx >= 0) cDip.semesters[sIdx] = semester;
      var baseIdx = dip.semesters.findIndex(function(s) { return s.id === editingSemesterId; });
      if (baseIdx >= 0) dip.semesters[baseIdx] = semester;
    } else {
      cDip.semesters.push(semester);
      dip.semesters.push(semester);
    }
    saveCustomDiplomas(custom);
    document.getElementById('semester-form-section').style.display = 'none';
    renderSemestersTable(dipId);
    showToast((editingSemesterId ? t('admin.entityUpdated') : t('admin.entityAdded')) + ' : ' + nameFr);
  });

  // Module
  document.getElementById('add-module-btn')?.addEventListener('click', function() {
    var specId = document.getElementById('module-specialty-select').value;
    if (!specId) return;
    editingModuleId = null;
    document.getElementById('module-form').reset();
    document.getElementById('module-form-specialty').value = specId;
    refreshModuleSemesterCheckboxes(specId);
    document.getElementById('module-form-title').textContent = t('admin.addModule');
    document.getElementById('module-form-submit').textContent = t('admin.save');
    document.getElementById('module-form-section').style.display = 'block';
  });
  document.getElementById('module-form-cancel')?.addEventListener('click', function() {
    document.getElementById('module-form-section').style.display = 'none';
  });
  document.getElementById('module-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = editingModuleId || document.getElementById('module-form-id').value.trim();
    var specId = document.getElementById('module-form-specialty').value;
    var selectedSems = [];
    document.querySelectorAll('#module-form-semesters-checkboxes input:checked').forEach(function(cb) {
      selectedSems.push(cb.value);
    });
    var mod = {
      id: id,
      name: {
        fr: document.getElementById('module-form-name-fr').value.trim(),
        ar: document.getElementById('module-form-name-ar').value.trim() || document.getElementById('module-form-name-fr').value.trim(),
        en: document.getElementById('module-form-name-en').value.trim() || document.getElementById('module-form-name-fr').value.trim()
      },
      specialty: specId,
      semesters: selectedSems
    };
    var custom = getCustomModules();
    if (editingModuleId) {
      var idx = custom.findIndex(function(m) { return m.id === editingModuleId; });
      if (idx >= 0) custom[idx] = mod;
      else custom.push(mod);
      var baseIdx = APP.db.modules.findIndex(function(m) { return m.id === editingModuleId; });
      if (baseIdx >= 0) APP.db.modules[baseIdx] = mod;
    } else {
      custom.push(mod);
      APP.db.modules.push(mod);
    }
    saveCustomModules(custom);
    document.getElementById('module-form-section').style.display = 'none';
    renderModulesTable(specId);
    showToast((editingModuleId ? t('admin.entityUpdated') : t('admin.entityAdded')) + ' : ' + localized(mod.name));
  });

  // Specialty
  document.getElementById('add-specialty-btn')?.addEventListener('click', function() {
    editingSpecialtyId = null;
    document.getElementById('specialty-form').reset();
    document.getElementById('specialty-form-title').textContent = t('admin.addSpecialty');
    document.getElementById('specialty-form-submit').textContent = t('admin.save');
    document.getElementById('specialty-form-section').style.display = 'block';
  });
  document.getElementById('specialty-form-cancel')?.addEventListener('click', function() {
    document.getElementById('specialty-form-section').style.display = 'none';
  });
  document.getElementById('specialty-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = editingSpecialtyId || document.getElementById('specialty-form-id').value.trim();
    var spec = {
      id: id,
      name: {
        fr: document.getElementById('specialty-form-name-fr').value.trim(),
        ar: document.getElementById('specialty-form-name-ar').value.trim() || document.getElementById('specialty-form-name-fr').value.trim(),
        en: document.getElementById('specialty-form-name-en').value.trim() || document.getElementById('specialty-form-name-fr').value.trim()
      },
      color: document.getElementById('specialty-form-color').value || '#2563eb',
      icon: document.getElementById('specialty-form-icon').value.trim() || 'book'
    };
    var custom = getCustomSpecialties();
    if (editingSpecialtyId) {
      var idx = custom.findIndex(function(s) { return s.id === editingSpecialtyId; });
      if (idx >= 0) custom[idx] = spec;
      else custom.push(spec);
      var baseIdx = APP.db.specialties.findIndex(function(s) { return s.id === editingSpecialtyId; });
      if (baseIdx >= 0) APP.db.specialties[baseIdx] = spec;
    } else {
      custom.push(spec);
      APP.db.specialties.push(spec);
    }
    saveCustomSpecialties(custom);
    document.getElementById('specialty-form-section').style.display = 'none';
    renderSpecialtiesTable();
    wireModuleSelect();
    showToast((editingSpecialtyId ? t('admin.entityUpdated') : t('admin.entityAdded')) + ' : ' + localized(spec.name));
  });

  // Table action buttons (delegated via event listeners on table bodies)
  // Shared visibility toggle handler
  function handleVisibilityToggle(btn) {
    if (btn.classList.contains('toggle-visibility-btn')) {
      var type = btn.dataset.type;
      var id = btn.dataset.id;
      toggleEntityVisibility(type, id);
      // Re-render the appropriate table
      if (type === 'diplomas') renderDiplomasTable();
      else if (type === 'semesters') {
        var dipId = document.getElementById('semester-diploma-select')?.value;
        renderSemestersTable(dipId);
      } else if (type === 'modules') {
        var specId = document.getElementById('module-specialty-select')?.value;
        renderModulesTable(specId);
      } else if (type === 'specialties') renderSpecialtiesTable();
      showToast(id + ' ' + (getEntityHiddenIds(type).indexOf(id) >= 0 ? 'masqué' : 'ré-affiché'));
    }
  }

  document.getElementById('diplomas-table-body')?.addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('toggle-visibility-btn')) { handleVisibilityToggle(btn); return; }
    if (btn.classList.contains('edit-diploma-btn')) openDiplomaForm(btn.dataset.id);
    if (btn.classList.contains('delete-diploma-btn')) deleteDiploma(btn.dataset.id);
  });
  document.getElementById('semesters-table-body')?.addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('toggle-visibility-btn')) { handleVisibilityToggle(btn); return; }
    if (btn.classList.contains('edit-semester-btn')) editSemester(btn.dataset.id, btn.dataset.diploma);
    if (btn.classList.contains('delete-semester-btn')) deleteSemester(btn.dataset.id, btn.dataset.diploma);
  });
  document.getElementById('modules-table-body')?.addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('toggle-visibility-btn')) { handleVisibilityToggle(btn); return; }
    if (btn.classList.contains('edit-module-btn')) openModuleForm(btn.dataset.id);
    if (btn.classList.contains('delete-module-btn')) deleteModule(btn.dataset.id);
  });
  document.getElementById('specialties-table-body')?.addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('toggle-visibility-btn')) { handleVisibilityToggle(btn); return; }
    if (btn.classList.contains('edit-specialty-btn')) openSpecialtyForm(btn.dataset.id);
    if (btn.classList.contains('delete-specialty-btn')) deleteSpecialty(btn.dataset.id);
  });

  // Auto-translate: FR → AR/EN for entity name fields
  function wireAutoTranslateEntity(frId, arId, enId) {
    var fr = document.getElementById(frId);
    var ar = document.getElementById(arId);
    var en = document.getElementById(enId);
    if (!fr || !ar || !en) return;
    var timer = null;
    var autoFill = true;
    fr.addEventListener('input', function() {
      if (!autoFill) return;
      clearTimeout(timer);
      var val = fr.value;
      if (!val) { ar.value = ''; en.value = ''; return; }
      timer = setTimeout(async function() {
        if (ar.value === '' || ar.dataset.autofilled === 'true') {
          ar.dataset.autofilled = 'true';
          ar.value = await translateText(val, 'ar');
        }
        if (en.value === '' || en.dataset.autofilled === 'true') {
          en.dataset.autofilled = 'true';
          en.value = await translateText(val, 'en');
        }
      }, 600);
    });
    ar.addEventListener('input', function() { ar.dataset.autofilled = 'false'; autoFill = false; });
    en.addEventListener('input', function() { en.dataset.autofilled = 'false'; autoFill = false; });
  }
  wireAutoTranslateEntity('diploma-form-name-fr', 'diploma-form-name-ar', 'diploma-form-name-en');
  wireAutoTranslateEntity('semester-form-name-fr', 'semester-form-name-ar', 'semester-form-name-en');
  wireAutoTranslateEntity('module-form-name-fr', 'module-form-name-ar', 'module-form-name-en');
  wireAutoTranslateEntity('specialty-form-name-fr', 'specialty-form-name-ar', 'specialty-form-name-en');
}

function openDiplomaForm(id) {
  editingDiplomaId = id;
  var d = APP.db.diplomas.find(function(d) { return d.id === id; });
  if (!d) return;
  document.getElementById('diploma-form-code').value = d.id;
  document.getElementById('diploma-form-code').readOnly = true;
  document.getElementById('diploma-form-name-fr').value = d.name?.fr || '';
  document.getElementById('diploma-form-name-ar').value = d.name?.ar || '';
  document.getElementById('diploma-form-name-en').value = d.name?.en || '';
  document.getElementById('diploma-form-level').value = String(d.level || 3);
  document.getElementById('diploma-form-duration').value = d.duration || '';
  document.getElementById('diploma-form-sem-count').value = (d.semesters || []).length;
  document.getElementById('diploma-form-title').textContent = t('admin.editDiploma');
  document.getElementById('diploma-form-submit').textContent = t('admin.saveChanges');
  document.getElementById('diploma-form-section').style.display = 'block';
}

function deleteDiploma(id) {
  var d = APP.db.diplomas.find(function(d) { return d.id === id; });
  if (!d) return;
  var msg = (t('admin.confirmDelete') || 'Confirmer la suppression de') + ' "' + localized(d.name) + '" ?\n' + (t('admin.confirmDeleteDiploma') || '');
  if (!confirm(msg)) return;
  var deleted = getDeletedDiplomaIds();
  if (!deleted.includes(id)) { deleted.push(id); saveDeletedDiplomaIds(deleted); }
  APP.db.diplomas = APP.db.diplomas.filter(function(d) { return d.id !== id; });
  renderDiplomasTable();
  wireSemesterSelect();
  showToast(t('admin.entityDeleted') + ' : ' + localized(d.name));
}

/* ---- SEMESTERS ---- */
var editingSemesterId = null;
var editingSemesterDiploma = null;

function wireSemesterSelect() {
  var sel = document.getElementById('semester-diploma-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— ' + (t('admin.selectDiploma') || 'Sélectionner un diplôme') + '</option>' +
    APP.db.diplomas.map(function(d) { return '<option value="' + escapeAttr(d.id) + '">' + escapeHTML(localized(d.name)) + '</option>'; }).join('');
  sel.addEventListener('change', function() {
    var val = sel.value;
    document.getElementById('add-semester-btn').disabled = !val;
    renderSemestersTable(val);
  });
}

function renderSemestersTable(dipId) {
  var tbody = document.getElementById('semesters-table-body');
  if (!tbody) return;
  if (!dipId) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:var(--ink-soft);">' + (t('admin.selectDiploma') || 'Sélectionne un diplôme') + '</td></tr>';
    return;
  }
  var dip = APP.db.diplomas.find(function(d) { return d.id === dipId; });
  if (!dip || !dip.semesters || !dip.semesters.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:var(--ink-soft);">Aucun semestre</td></tr>';
    return;
  }
  var hidden = getEntityHiddenIds('semesters');
  tbody.innerHTML = dip.semesters.map(function(s) {
    var isHidden = hidden.indexOf(s.id) >= 0;
    return '<tr' + (isHidden ? ' style="opacity:0.5;"' : '') + '>' +
      '<td><code>' + escapeHTML(s.id) + '</code></td>' +
      '<td>' + escapeHTML(localized(s.name)) + (isHidden ? ' <span class="local-tag" style="background:var(--ink-soft);">masqué</span>' : '') + '</td>' +
      '<td>' + escapeHTML(s.label || '—') + '</td>' +
      '<td class="doc-table-actions">' +
        '<button class="btn btn-ghost btn-sm toggle-visibility-btn" data-type="semesters" data-id="' + escapeAttr(s.id) + '" title="' + (isHidden ? 'Afficher' : 'Masquer') + '">' + (isHidden ? '👁' : '🙈') + '</button>' +
        '<button class="btn btn-secondary btn-sm edit-semester-btn" data-id="' + escapeAttr(s.id) + '" data-diploma="' + escapeAttr(dipId) + '">' + icon('settings') + '</button>' +
        '<button class="btn btn-danger btn-sm delete-semester-btn" data-id="' + escapeAttr(s.id) + '" data-diploma="' + escapeAttr(dipId) + '">' + icon('trash') + '</button>' +
      '</td></tr>';
  }).join('');
}

function editSemester(semId, dipId) {
  editingSemesterDiploma = dipId;
  editingSemesterId = semId;
  var dip = APP.db.diplomas.find(function(d) { return d.id === dipId; });
  if (!dip) return;
  var sem = (dip.semesters || []).find(function(s) { return s.id === semId; });
  if (!sem) return;
  document.getElementById('semester-form-name-fr').value = sem.name?.fr || localized(sem.name);
  document.getElementById('semester-form-name-ar').value = sem.name?.ar || '';
  document.getElementById('semester-form-name-en').value = sem.name?.en || '';
  document.getElementById('semester-form-label').value = sem.label || '';
  var order = parseInt(semId.split('-s').pop(), 10) || 1;
  document.getElementById('semester-form-order').value = order;
  document.getElementById('semester-form-title').textContent = t('admin.editDiploma') + ' — ' + localized(sem.name);
  document.getElementById('semester-form-submit').textContent = t('admin.saveChanges');
  document.getElementById('semester-form-section').style.display = 'block';
}

function deleteSemester(semId, dipId) {
  if (!confirm('Supprimer ce semestre ?')) return;
  var dip = APP.db.diplomas.find(function(d) { return d.id === dipId; });
  if (!dip) return;
  if (!dip.semesters) dip.semesters = [];
  dip.semesters = dip.semesters.filter(function(s) { return s.id !== semId; });
  var custom = getCustomDiplomas();
  var cDip = custom.find(function(d) { return d.id === dipId; });
  if (cDip) { cDip.semesters = (cDip.semesters || []).filter(function(s) { return s.id !== semId; }); }
  else { var cp = JSON.parse(JSON.stringify(dip)); cp.semesters = dip.semesters; custom.push(cp); }
  saveCustomDiplomas(custom);
  renderSemestersTable(dipId);
  showToast(t('admin.entityDeleted'));
}

/* ---- MODULES ---- */
var editingModuleId = null;

function wireModuleSelect() {
  var sel = document.getElementById('module-specialty-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— ' + (t('admin.selectSpecialty') || 'Sélectionner une spécialité') + '</option>' +
    APP.db.specialties.map(function(s) { return '<option value="' + escapeAttr(s.id) + '">' + escapeHTML(localized(s.name)) + '</option>'; }).join('');
  sel.addEventListener('change', function() {
    var val = sel.value;
    document.getElementById('add-module-btn').disabled = !val;
    renderModulesTable(val);
  });
  // Also update the module form specialty select
  var formSpec = document.getElementById('module-form-specialty');
  if (formSpec) {
    formSpec.innerHTML = APP.db.specialties.map(function(s) { return '<option value="' + escapeAttr(s.id) + '">' + escapeHTML(localized(s.name)) + '</option>'; }).join('');
    formSpec.addEventListener('change', function() {
      refreshModuleSemesterCheckboxes(formSpec.value);
    });
  }
}

function refreshModuleSemesterCheckboxes(specId) {
  var container = document.getElementById('module-form-semesters-checkboxes');
  if (!container) return;
  var allSemesters = [];
  APP.db.diplomas.forEach(function(d) {
    if (d.semesters) {
      d.semesters.forEach(function(s) {
        allSemesters.push({ dipId: d.id, dipName: localized(d.name), sem: s });
      });
    }
  });
  if (!allSemesters.length) {
    container.innerHTML = '<span style="color:var(--ink-soft);font-size:var(--fs-xs);">Aucun semestre disponible</span>';
    return;
  }
  container.innerHTML = allSemesters.map(function(item) {
    var checked = '';
    if (editingModuleId) {
      var mod = APP.db.modules.find(function(m) { return m.id === editingModuleId; });
      if (mod && mod.semesters && mod.semesters.indexOf(item.sem.id) >= 0) checked = ' checked';
    }
    // Pre-select semesters that have documents for this specialty
    return '<label style="display:flex;align-items:center;gap:var(--space-1);font-size:var(--fs-xs);cursor:pointer;">' +
      '<input type="checkbox" value="' + escapeAttr(item.sem.id) + '"' + checked + '> ' +
      escapeHTML(item.dipName) + ' — ' + escapeHTML(localized(item.sem.name)) +
      '</label>';
  }).join('');
}

function renderModulesTable(specId) {
  var tbody = document.getElementById('modules-table-body');
  if (!tbody) return;
  if (!specId) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:var(--ink-soft);">' + (t('admin.selectSpecialty') || 'Sélectionne une spécialité') + '</td></tr>';
    return;
  }
  var filtered = APP.db.modules.filter(function(m) { return m.specialty === specId; });
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:var(--ink-soft);">' + (t('empty.title') || 'Aucun module') + '</td></tr>';
    return;
  }
  var hidden = getEntityHiddenIds('modules');
  tbody.innerHTML = filtered.map(function(m) {
    var isHidden = hidden.indexOf(m.id) >= 0;
    var sems = (m.semesters || []).join(', ');
    return '<tr' + (isHidden ? ' style="opacity:0.5;"' : '') + '>' +
      '<td><code>' + escapeHTML(m.id) + '</code></td>' +
      '<td>' + escapeHTML(localized(m.name)) + (isHidden ? ' <span class="local-tag" style="background:var(--ink-soft);">masqué</span>' : '') + '</td>' +
      '<td style="font-size:var(--fs-xs);">' + escapeHTML(sems || '—') + '</td>' +
      '<td class="doc-table-actions">' +
        '<button class="btn btn-ghost btn-sm toggle-visibility-btn" data-type="modules" data-id="' + escapeAttr(m.id) + '" title="' + (isHidden ? 'Afficher' : 'Masquer') + '">' + (isHidden ? '👁' : '🙈') + '</button>' +
        '<button class="btn btn-secondary btn-sm edit-module-btn" data-id="' + escapeAttr(m.id) + '">' + icon('settings') + '</button>' +
        '<button class="btn btn-danger btn-sm delete-module-btn" data-id="' + escapeAttr(m.id) + '">' + icon('trash') + '</button>' +
      '</td></tr>';
  }).join('');
}

function openModuleForm(id) {
  editingModuleId = id;
  var m = APP.db.modules.find(function(m) { return m.id === id; });
  if (!m) return;
  document.getElementById('module-form-id').value = m.id;
  document.getElementById('module-form-id').readOnly = true;
  document.getElementById('module-form-name-fr').value = m.name?.fr || '';
  document.getElementById('module-form-name-ar').value = m.name?.ar || '';
  document.getElementById('module-form-name-en').value = m.name?.en || '';
  document.getElementById('module-form-specialty').value = m.specialty || '';
  refreshModuleSemesterCheckboxes(m.specialty);
  document.getElementById('module-form-title').textContent = t('admin.editDiploma') + ' — ' + localized(m.name);
  document.getElementById('module-form-submit').textContent = t('admin.saveChanges');
  document.getElementById('module-form-section').style.display = 'block';
}

function deleteModule(id) {
  var m = APP.db.modules.find(function(m) { return m.id === id; });
  if (!m) return;
  if (!confirm((t('admin.confirmDelete') || 'Confirmer la suppression') + ' "' + localized(m.name) + '" ?')) return;
  var deleted = getDeletedModuleIds();
  if (!deleted.includes(id)) { deleted.push(id); saveDeletedModuleIds(deleted); }
  APP.db.modules = APP.db.modules.filter(function(m) { return m.id !== id; });
  var specId = document.getElementById('module-specialty-select')?.value;
  renderModulesTable(specId);
  showToast(t('admin.entityDeleted') + ' : ' + localized(m.name));
}

/* ---- SPECIALTIES ---- */
var editingSpecialtyId = null;

function renderSpecialtiesTable() {
  var tbody = document.getElementById('specialties-table-body');
  if (!tbody) return;
  var hidden = getEntityHiddenIds('specialties');
  var html = APP.db.specialties.map(function(s) {
    var isHidden = hidden.indexOf(s.id) >= 0;
    return '<tr' + (isHidden ? ' style="opacity:0.5;"' : '') + '>' +
      '<td><code>' + escapeHTML(s.id) + '</code></td>' +
      '<td>' + escapeHTML(localized(s.name)) + (isHidden ? ' <span class="local-tag" style="background:var(--ink-soft);">masqué</span>' : '') + '</td>' +
      '<td>' + escapeHTML(s.icon || '—') + '</td>' +
      '<td><span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:' + escapeAttr(s.color || '#2563eb') + ';"></span> ' + escapeHTML(s.color || '—') + '</td>' +
      '<td class="doc-table-actions">' +
        '<button class="btn btn-ghost btn-sm toggle-visibility-btn" data-type="specialties" data-id="' + escapeAttr(s.id) + '" title="' + (isHidden ? 'Afficher' : 'Masquer') + '">' + (isHidden ? '👁' : '🙈') + '</button>' +
        '<button class="btn btn-secondary btn-sm edit-specialty-btn" data-id="' + escapeAttr(s.id) + '">' + icon('settings') + '</button>' +
        '<button class="btn btn-danger btn-sm delete-specialty-btn" data-id="' + escapeAttr(s.id) + '">' + icon('trash') + '</button>' +
      '</td></tr>';
  }).join('');
  if (!html) html = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--ink-soft);">' + (t('empty.title') || 'Aucune spécialité') + '</td></tr>';
  tbody.innerHTML = html;
}

function openSpecialtyForm(id) {
  editingSpecialtyId = id;
  var s = APP.db.specialties.find(function(s) { return s.id === id; });
  if (!s) return;
  document.getElementById('specialty-form-id').value = s.id;
  document.getElementById('specialty-form-id').readOnly = true;
  document.getElementById('specialty-form-name-fr').value = s.name?.fr || '';
  document.getElementById('specialty-form-name-ar').value = s.name?.ar || '';
  document.getElementById('specialty-form-name-en').value = s.name?.en || '';
  document.getElementById('specialty-form-icon').value = s.icon || '';
  document.getElementById('specialty-form-color').value = s.color || '#2563eb';
  document.getElementById('specialty-form-title').textContent = t('admin.editDiploma') + ' — ' + localized(s.name);
  document.getElementById('specialty-form-submit').textContent = t('admin.saveChanges');
  document.getElementById('specialty-form-section').style.display = 'block';
}

function deleteSpecialty(id) {
  var s = APP.db.specialties.find(function(s) { return s.id === id; });
  if (!s) return;
  if (!confirm((t('admin.confirmDelete') || 'Confirmer la suppression') + ' "' + localized(s.name) + '" ?')) return;
  var deleted = getDeletedSpecialtyIds();
  if (!deleted.includes(id)) { deleted.push(id); saveDeletedSpecialtyIds(deleted); }
  APP.db.specialties = APP.db.specialties.filter(function(s) { return s.id !== id; });
  renderSpecialtiesTable();
  wireModuleSelect();
  showToast(t('admin.entityDeleted') + ' : ' + localized(s.name));
}

function renderKeys() {
  const container = document.getElementById('keys-container');
  const keys = getStoredKeys();
  if (!keys.length) {
    container.innerHTML = '<p style="color:var(--ink-soft);">' + t('admin.noKeys') + '</p>';
    return;
  }
  container.innerHTML = keys.map((k, i) => {
    const prov = PROVIDERS[k.provider] || { label: k.provider, icon: '?' };
    const active = k.active ? ' key-row--active' : '';
    return '<div class="key-row' + active + '" data-idx="' + i + '">' +
      '<div class="key-info">' +
        '<span class="provider-pill"><span class="dot"></span>' + escapeHTML(prov.label) + '</span>' +
        '<code>' + escapeHTML(maskKey(sanitizeApiKey(k.apiKey || ''))) + '</code>' +
        '<span>' + escapeHTML(k.model || prov.defaultModel || '') + '</span>' +
      '</div>' +
      '<div class="key-actions">' +
        (!k.active ? '<button class="btn btn-sm btn-ghost set-active-key-btn" data-idx="' + i + '">Activer</button>' : '<span class="badge-ok">Actif</span>') +
        '<button class="btn btn-sm btn-ghost edit-key-btn" data-idx="' + i + '">Modifier</button>' +
        '<button class="btn btn-sm btn-ghost duplicate-key-btn" data-idx="' + i + '">Dupliquer</button>' +
        '<button class="btn btn-danger btn-sm delete-key-btn" data-idx="' + i + '">' + icon('trash') + '</button>' +
      '</div>' +
    '</div>';
  }).join('');
  container.querySelectorAll('.delete-key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const keys = getStoredKeys();
      keys.splice(idx, 1);
      saveStoredKeys(keys);
      renderKeys();
      showToast(t('admin.keyDeleted'));
    });
  });
  container.querySelectorAll('.set-active-key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const keys = getStoredKeys().map((k, i) => ({ ...k, active: i === idx }));
      saveStoredKeys(keys);
      renderKeys();
      showToast('Clé active mise à jour');
    });
  });
  container.querySelectorAll('.edit-key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const k = getStoredKeys()[idx];
      if (!k) return;
      const newLabel = prompt('Nom du fournisseur:', k.provider);
      if (newLabel !== null) k.provider = newLabel;
      const newModel = prompt('Modèle:', k.model || '');
      if (newModel !== null) k.model = newModel;
      const newApiKey = prompt('Clé API:', k.apiKey || '');
      if (newApiKey !== null) k.apiKey = sanitizeApiKey(newApiKey);
      const keys = getStoredKeys();
      keys[idx] = k;
      saveStoredKeys(keys);
      renderKeys();
    });
  });
  container.querySelectorAll('.duplicate-key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const k = getStoredKeys()[idx];
      if (!k) return;
      const keys = getStoredKeys();
      keys.push({ ...k, id: 'key-' + Date.now(), active: false });
      saveStoredKeys(keys);
      renderKeys();
    });
  });
}

/* ============================================================
   IMPORT – manifest.json (dzexams-style) import
   ============================================================ */
function getFieldValue(item, aliases) {
  for (var i = 0; i < aliases.length; i++) {
    var alias = aliases[i];
    var val;
    if (alias.indexOf('.') >= 0) {
      var parts = alias.split('.');
      val = item;
      for (var j = 0; j < parts.length; j++) {
        if (val == null) break;
        val = val[parts[j]];
      }
    } else {
      val = item[alias];
    }
    if (val != null && val !== '') return val;
  }
  return '';
}

var IMPORT_ALIASES = {
  'title.ar': ['titre', 'title.ar', 'title', 'العنوان'],
  'title.fr': ['title.fr', 'titreFr', 'titre_fr'],
  'title.en': ['title.en', 'titreEn', 'titre_en'],
  'diploma': ['diplome', 'diploma', 'niveau', 'level', 'grade', 'شهادة', 'المستوى'],
  'semester': ['semestre', 'semester', 'trimestre', 'trimester', 'term', 'الفصل'],
  'specialty': ['specialite', 'specialty', 'filiere', 'stream', 'branch', 'تخصص', 'الشعبة'],
  'module': ['module', 'matiere', 'subject', 'subjectName', 'المادة', 'الوحدة'],
  'institution': ['etablissement', 'institution', 'institute', 'centre', 'établissement', 'مؤسسة'],
  'type': ['type_doc_label', 'type', 'type_doc', 'docType', 'النوع'],
  'year': ['annee', 'year', 'année', 'السنة'],
  'wilaya': ['wilaya', 'codeWilaya', 'ولاية'],
  'size': ['tailleFichier', 'taille_octets', 'tailleOctets', 'size', 'fileSize', 'filesize', 'الحجم'],
  'pages': ['pages', 'nbrPages', 'pageCount', 'عدد الصفحات'],
  'previewUrl': ['urlCloud', 'url_cloud', 'previewUrl', 'cloudUrl', 'preview'],
  'downloadUrl': ['urlPartage', 'url_partage', 'downloadUrl', 'shareUrl', 'downloadLink'],
  'host': ['provider', 'site', 'host', 'website', 'platform'],
  'source': ['source', 'siteSource', 'origin'],
  'urlSource': ['urlSource', 'url_source', 'sourceUrl'],
  'urlPdf': ['urlPdf', 'url_pdf', 'pdfUrl'],
  'urlPdf2': ['fichier_pdf', 'lien_pdf', 'pdfLink', 'fichier']
};

function guessDiplomaName(raw) {
  var rawVal = getFieldValue(raw, IMPORT_ALIASES.diploma);
  if (!rawVal) return '';
  var lower = String(rawVal).toLowerCase().trim();
  var dip = APP.db.diplomas.find(function(d) {
    var n = localized(d.name).toLowerCase();
    return d.id === lower || n === lower;
  });
  if (dip) return dip.id;
  dip = APP.db.diplomas.find(function(d) {
    var n = localized(d.name).toLowerCase();
    return n.indexOf(lower) >= 0 || lower.indexOf(n) >= 0;
  });
  return dip ? dip.id : rawVal;
}

function guessSemesterName(raw, diplomaId) {
  var rawVal = getFieldValue(raw, IMPORT_ALIASES.semester);
  if (!rawVal) return '';
  var lower = String(rawVal).toLowerCase().trim();
  var numMatch = lower.match(/(\d+)/);
  var bareNum = numMatch ? numMatch[1] : null;
  if (diplomaId && bareNum) {
    var compositeId = diplomaId + '-s' + bareNum;
    for (var i = 0; i < APP.db.diplomas.length; i++) {
      var sems = APP.db.diplomas[i].semesters || [];
      for (var j = 0; j < sems.length; j++) {
        if (sems[j].id === compositeId) return sems[j].id;
      }
    }
  }
  for (var i = 0; i < APP.db.diplomas.length; i++) {
    var sems = APP.db.diplomas[i].semesters || [];
    for (var j = 0; j < sems.length; j++) {
      var s = sems[j];
      var slabel = s.label ? s.label.toLowerCase() : '';
      if (s.id === lower || slabel === lower || localized(s.name).toLowerCase() === lower) {
        return s.id;
      }
    }
  }
  for (var i = 0; i < APP.db.diplomas.length; i++) {
    var sems = APP.db.diplomas[i].semesters || [];
    for (var j = 0; j < sems.length; j++) {
      var s = sems[j];
      var slabel = s.label ? s.label.toLowerCase() : '';
      if (localized(s.name).toLowerCase().indexOf(lower) >= 0 || lower.indexOf(slabel) >= 0) {
        return s.id;
      }
    }
  }
  return rawVal;
}

function guessSpecialtyName(raw) {
  var rawVal = getFieldValue(raw, IMPORT_ALIASES.specialty);
  if (!rawVal) return '';
  var lower = String(rawVal).toLowerCase().trim();
  var spec = APP.db.specialties.find(function(s) {
    return localized(s.name).toLowerCase().indexOf(lower) >= 0 || s.id.indexOf(lower) >= 0;
  });
  if (spec) return spec.id;
  return rawVal;
}

function guessModuleName(raw) {
  var rawVal = getFieldValue(raw, IMPORT_ALIASES.module);
  if (!rawVal) return '';
  var lower = String(rawVal).toLowerCase().trim();
  var mod = APP.db.modules.find(function(m) {
    return localized(m.name).toLowerCase().indexOf(lower) >= 0 || m.id.indexOf(lower) >= 0;
  });
  if (mod) return mod.id;
  return rawVal;
}

function guessTypeName(raw) {
  var rawVal = getFieldValue(raw, IMPORT_ALIASES.type);
  if (!rawVal) return '';
  var lower = String(rawVal).toLowerCase().trim();
  if (!lower) return '';
  var map = {
    'cours': 'cours', 'lesson': 'cours', 'course': 'cours', 'درس': 'cours',
    'td': 'td', 'exercice': 'td', 'exercise': 'td', 'تمرين': 'td',
    'tp': 'tp', 'pratique': 'tp', 'practical': 'tp', 'تطبيقي': 'tp',
    'examen': 'examen', 'exam': 'examen', 'devoir': 'examen', 'test': 'examen', 'امتحان': 'examen',
    'corrige': 'corrige', 'correction': 'corrige', 'solution': 'corrige', 'تصحيح': 'corrige',
    'projet': 'projet', 'project': 'projet', 'مشروع': 'projet',
    'resume': 'resume', 'synthese': 'resume', 'summary': 'resume', 'ملخص': 'resume',
    'guide': 'guide', 'manuel': 'guide', 'manual': 'guide', 'دليل': 'guide'
  };
  if (map[lower]) return map[lower];
  var typeObj = APP.db.documentTypes.find(function(t) {
    return localized(t.name).toLowerCase().indexOf(lower) >= 0;
  });
  return typeObj ? typeObj.id : rawVal;
}

function guessInstitutionName(raw) {
  var rawVal = getFieldValue(raw, IMPORT_ALIASES.institution);
  if (!rawVal) return '';
  var lower = String(rawVal).toLowerCase().trim();
  var inst = APP.db.institutions.find(function(i) {
    return localized(i.name).toLowerCase().indexOf(lower) >= 0 || i.id.indexOf(lower) >= 0;
  });
  return inst ? inst.id : rawVal;
}

function normalizeImportItem(item) {
  var size = getFieldValue(item, IMPORT_ALIASES.size);
  var sizeNum = parseInt(size, 10);
  var sizeStr = !isNaN(sizeNum) && sizeNum > 0
    ? (sizeNum >= 1048576 ? (sizeNum / 1048576).toFixed(1) + ' MB' : Math.round(sizeNum / 1024) + ' KB')
    : String(size || '');

  var titleAr = getFieldValue(item, IMPORT_ALIASES['title.ar']);
  var titleFr = getFieldValue(item, IMPORT_ALIASES['title.fr']);
  var titleEn = getFieldValue(item, IMPORT_ALIASES['title.en']);

  var previewUrl = getFieldValue(item, IMPORT_ALIASES.previewUrl);
  var downloadUrl = getFieldValue(item, IMPORT_ALIASES.downloadUrl);
  if (!downloadUrl && previewUrl) {
    var pid = extractDriveId(previewUrl);
    if (pid) downloadUrl = toDriveDownload(pid);
  }
  if (!previewUrl && downloadUrl) {
    var did = extractDriveId(downloadUrl);
    if (did) previewUrl = toDrivePreview(did);
  }

  var urlPdf = getFieldValue(item, IMPORT_ALIASES.urlPdf);
  if (!urlPdf) urlPdf = getFieldValue(item, IMPORT_ALIASES.urlPdf2);

  var pages = parseInt(getFieldValue(item, IMPORT_ALIASES.pages), 10) || '';

  var resolvedDiploma = guessDiplomaName(item);
  return {
    title: { ar: titleAr, fr: titleFr, en: titleEn },
    diploma: resolvedDiploma,
    semester: guessSemesterName(item, resolvedDiploma),
    specialty: guessSpecialtyName(item),
    module: guessModuleName(item),
    type: guessTypeName(item),
    year: getFieldValue(item, IMPORT_ALIASES.year) || '',
    institution: guessInstitutionName(item),
    wilaya: getFieldValue(item, IMPORT_ALIASES.wilaya) || '',
    size: sizeStr,
    pages: pages,
    previewUrl: previewUrl,
    downloadUrl: downloadUrl,
    host: getFieldValue(item, IMPORT_ALIASES.host) || 'drive',
    source: getFieldValue(item, IMPORT_ALIASES.source) || '',
    urlSource: getFieldValue(item, IMPORT_ALIASES.urlSource) || '',
    urlPdf: urlPdf || '',
    tags: []
  };
}

function renderImportPreview(parsedDocs, rawDocs) {
  var container = document.getElementById('import-preview-container');
  container.style.display = 'block';
  if (!parsedDocs.length) {
    container.innerHTML = '<p style="color:var(--ink-soft);">' + (t('admin.importNoDocs') || 'Aucun document trouvé.') + '</p>';
    return;
  }
  var html = '<div style="margin-bottom:var(--space-3);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2);">' +
    '<span style="font-weight:600;font-size:var(--fs-sm);">' + parsedDocs.length + ' ' + (t('admin.importDocsAnalyzed') || 'document(s) analysé(s)') + '</span>' +
    '<button class="btn btn-primary btn-sm" id="import-add-all-btn">📥 ' + (t('admin.importAddAll') || 'Tout ajouter en une fois') + '</button>' +
    '</div>' +
    '<div class="admin-doc-table-wrap" style="max-height:400px;overflow-y:auto;">' +
    '<table class="admin-doc-table"><thead><tr>' +
    '<th>' + (t('admin.importColTitle') || 'Titre') + '</th><th>' + (t('admin.diploma') || 'Diplôme') + '</th><th>' + (t('admin.semester') || 'Semestre') + '</th><th>' + (t('admin.module') || 'Module') + '</th><th>' + (t('admin.type') || 'Type') + '</th><th>' + (t('admin.size') || 'Taille') + '</th><th style="width:80px;"></th>' +
    '</tr></thead><tbody>';
  parsedDocs.forEach(function(d, i) {
    html += '<tr>' +
      '<td style="font-size:var(--fs-xs);">' + escapeHTML(d.title.ar || d.title.fr || '—') + '</td>' +
      '<td style="font-size:var(--fs-xs);">' + escapeHTML(d.diploma || '—') + '</td>' +
      '<td style="font-size:var(--fs-xs);">' + escapeHTML(d.semester || '—') + '</td>' +
      '<td style="font-size:var(--fs-xs);">' + escapeHTML(d.module || '—') + '</td>' +
      '<td style="font-size:var(--fs-xs);">' + escapeHTML(d.type || '—') + '</td>' +
      '<td style="font-size:var(--fs-xs);">' + escapeHTML(d.size || '—') + '</td>' +
      '<td><button class="btn btn-secondary btn-xs prefill-from-import-btn" data-index="' + i + '">' + (t('admin.importPrefill') || 'Pré-remplir') + '</button></td>' +
      '</tr>';
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;

  container.querySelectorAll('.prefill-from-import-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(btn.dataset.index, 10);
      prefillFormFromImport(parsedDocs[idx], rawDocs[idx]);
    });
  });
  document.getElementById('import-add-all-btn').addEventListener('click', function() {
    batchAddAll(parsedDocs, rawDocs);
  });
}

function prefillFormFromImport(doc, raw) {
  document.getElementById('doc-form-title-ar').value = doc.title.ar || '';
  document.getElementById('doc-form-title-fr').value = doc.title.fr || doc.title.ar || '';
  document.getElementById('doc-form-title-en').value = doc.title.en || '';

  var desc = doc.title.ar || doc.title.fr || '';
  document.getElementById('doc-form-desc-ar').value = desc;
  document.getElementById('doc-form-desc-fr').value = desc;
  document.getElementById('doc-form-desc-en').value = desc;

  document.getElementById('doc-form-diploma').value = doc.diploma || '';
  if (doc.diploma) {
    document.getElementById('doc-form-diploma').dispatchEvent(new Event('change'));
    document.getElementById('doc-form-semester').value = doc.semester || '';
  }
  document.getElementById('doc-form-specialty').value = doc.specialty || '';
  if (doc.specialty) {
    document.getElementById('doc-form-specialty').dispatchEvent(new Event('change'));
    document.getElementById('doc-form-module').value = doc.module || '';
  }

  document.getElementById('doc-form-type').value = doc.type || '';
  document.getElementById('doc-form-year').value = doc.year || '';
  document.getElementById('doc-form-institution').value = doc.institution || '';
  document.getElementById('doc-form-wilaya').value = doc.wilaya || '';
  document.getElementById('doc-form-pages').value = doc.pages || '';
  document.getElementById('doc-form-size').value = doc.size || '';
  document.getElementById('doc-form-host').value = doc.host || 'drive';
  document.getElementById('doc-form-preview-url').value = doc.previewUrl || '';
  document.getElementById('doc-form-download-url').value = doc.downloadUrl || '';
  document.getElementById('doc-form-source').value = doc.source || '';
  document.getElementById('doc-form-url-source').value = doc.urlSource || '';
  document.getElementById('doc-form-url-pdf').value = doc.urlPdf || '';

  document.querySelectorAll('#tab-panel-docs .admin-sub-tab').forEach(function(b) { b.classList.remove('active'); });
  document.querySelector('#tab-panel-docs .admin-sub-tab[data-subtab="docs-add"]')?.classList.add('active');
  document.querySelectorAll('#tab-panel-docs .admin-sub-panel').forEach(function(p) { p.classList.add('hidden'); });
  document.getElementById('sub-panel-docs-add')?.classList.remove('hidden');
}

function batchAddAll(parsedDocs, rawDocs) {
  var pending = getPendingDocs();
  var existingIds = APP.db.documents.map(function(d) { return d.id; });
  pending.forEach(function(d) { existingIds.push(d.id); });
  var maxNum = 0;
  existingIds.forEach(function(id) {
    var n = parseInt((id || '').replace('doc-', ''), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  });
  var count = 0;
  parsedDocs.forEach(function(d, i) {
    maxNum++;
    var doc = {
      id: 'doc-' + String(maxNum).padStart(4, '0'),
      title: { fr: d.title.fr || '', ar: d.title.ar || '', en: d.title.en || '' },
      description: { fr: d.title.fr || '', ar: d.title.ar || '', en: d.title.en || '' },
      diploma: d.diploma || '',
      semester: d.semester || null,
      specialty: d.specialty || null,
      module: d.module || '',
      type: d.type || '',
      year: d.year || '',
      institution: d.institution || null,
      wilaya: d.wilaya || null,
      fileType: 'pdf',
      pages: parseInt(d.pages, 10) || 1,
      size: d.size || '—',
      previewUrl: d.previewUrl || '',
      downloadUrl: d.downloadUrl || '',
      host: d.host || 'drive',
      source: d.source || '',
      urlSource: d.urlSource || '',
      urlPdf: d.urlPdf || '',
      downloads: 0,
      rating: 0,
      tags: d.tags || []
    };
    pending.push(doc);
    count++;
  });
  savePendingDocs(pending);
  renderAdminDocTable();
  showToast(count + ' document(s) importé(s) — en attente de validation');
}

function extractDriveId(url) {
  if (!url) return null;
  var m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function toDrivePreview(id) {
  return 'https://drive.google.com/file/d/' + id + '/preview';
}

function toDriveDownload(id) {
  return 'https://drive.google.com/uc?export=download&id=' + id;
}

function detectProviderFromUrl(url) {
  if (!url) return '';
  var u = url.toLowerCase();
  if (u.indexOf('drive.google.com') >= 0) return 'google-drive';
  if (u.indexOf('mega.nz') >= 0) return 'mega';
  if (u.indexOf('dropbox.com') >= 0) return 'dropbox';
  if (u.indexOf('onedrive.live.com') >= 0) return 'onedrive';
  return '';
}

function wireImportUI() {
  var importBtn = document.getElementById('import-analyze-btn');
  var importInput = document.getElementById('import-manifest-input');
  if (!importBtn || !importInput) return;

  importBtn.addEventListener('click', function() {
    var file = importInput.files[0];
    if (!file) { showToast('Sélectionne un fichier JSON d\'abord.'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var raw = JSON.parse(e.target.result);
        var items = raw.items || raw.documents || raw.fichiers || raw.data || (Array.isArray(raw) ? raw : [raw]);
        if (!items.length) { showToast('Aucun document trouvé dans le fichier.'); return; }
        var normalized = items.map(normalizeImportItem);
        renderImportPreview(normalized, items);
      } catch(err) { showToast('Erreur de lecture: ' + err.message); }
    };
    reader.readAsText(file);
  });

  document.getElementById('migrate-host-btn')?.addEventListener('click', function() {
    var pending = getPendingDocs();
    var localDocs = getLocalDocs();
    var changed = 0;
    pending.forEach(function(d) {
      var url = d.previewUrl || d.downloadUrl || '';
      var prov = detectProviderFromUrl(url);
      if (prov) { d.host = prov; changed++; }
    });
    localDocs.forEach(function(d) {
      var url = d.previewUrl || d.downloadUrl || '';
      var prov = detectProviderFromUrl(url);
      if (prov) { d.host = prov; changed++; }
    });
    savePendingDocs(pending);
    saveLocalDocs(localDocs);
    showToast(changed + ' document(s) mis à jour (hébergeur)');
  });
}

function generateManifestJSON() {
  var docs = getLocalDocs();
  var items = docs.map(function(d) {
    return {
      titre: d.title ? (d.title.ar || d.title.fr || d.title.en || '') : '',
      titreAr: d.title ? d.title.ar || '' : '',
      titreFr: d.title ? d.title.fr || '' : '',
      titreEn: d.title ? d.title.en || '' : '',
      diplome: d.diploma || '',
      semestre: d.semester || '',
      specialite: d.specialty || '',
      module: d.module || '',
      type_doc_label: d.type || '',
      annee: d.year || '',
      etablissement: d.institution || '',
      wilaya: d.wilaya || '',
      tailleFichier: d.size || '',
      pages: d.pages || '',
      urlCloud: d.previewUrl || '',
      urlPartage: d.downloadUrl || '',
      provider: d.host || '',
      source: d.source || '',
      urlSource: d.urlSource || '',
      urlPdf: d.urlPdf || ''
    };
  });
  return { items: items, generatedAt: new Date().toISOString(), count: items.length, source: 'fp-smart' };
}

function downloadManifestJSON() {
  var manifest = generateManifestJSON();
  if (!manifest.items.length) { showToast(t('admin.importNoDocs') || 'Aucun document à exporter.'); return; }
  var blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'manifest-fp-smart-' + Date.now() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  document.getElementById('export-manifest-stats').textContent = manifest.items.length + ' document(s) exporté(s) — ' + manifest.generatedAt;
  showToast(manifest.items.length + ' document(s) téléchargé(s)');
}

function copyManifestToClipboard() {
  var manifest = generateManifestJSON();
  if (!manifest.items.length) { showToast(t('admin.importNoDocs') || 'Aucun document à exporter.'); return; }
  var text = JSON.stringify(manifest, null, 2);
  navigator.clipboard.writeText(text).then(function() {
    document.getElementById('export-manifest-stats').textContent = manifest.items.length + ' document(s) copiés — ' + manifest.generatedAt;
    showToast(manifest.items.length + ' document(s) copiés dans le presse-papier');
  }).catch(function() {
    showToast('Erreur: impossible de copier');
  });
}

function initImportTab() {
  wireImportUI();
  document.getElementById('export-manifest-download-btn')?.addEventListener('click', downloadManifestJSON);
  document.getElementById('export-manifest-copy-btn')?.addEventListener('click', copyManifestToClipboard);
}
