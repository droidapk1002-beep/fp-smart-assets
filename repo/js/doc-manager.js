var LOCAL_DOCS_KEY = 'fp_local_docs';
var DELETED_DOCS_KEY = 'fp_deleted_doc_ids';
var PENDING_DOCS_KEY = 'fp_pending_docs';
var HIDDEN_DOCS_KEY = 'fp_hidden_doc_ids';

let sortState = { key: 'id', dir: 'desc' };

function getLocalDocs() {
  try { return JSON.parse(localStorage.getItem(LOCAL_DOCS_KEY) || '[]'); }
  catch { return []; }
}
function saveLocalDocs(docs) {
  localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(docs));
}
function getDeletedIds() {
  try { return JSON.parse(localStorage.getItem(DELETED_DOCS_KEY) || '[]'); }
  catch { return []; }
}
function saveDeletedIds(ids) {
  localStorage.setItem(DELETED_DOCS_KEY, JSON.stringify(ids));
}
function getPendingDocs() {
  try { return JSON.parse(localStorage.getItem(PENDING_DOCS_KEY) || '[]'); }
  catch { return []; }
}
function savePendingDocs(docs) {
  localStorage.setItem(PENDING_DOCS_KEY, JSON.stringify(docs));
}
function getHiddenIds() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_DOCS_KEY) || '[]'); }
  catch { return []; }
}
function saveHiddenIds(ids) {
  localStorage.setItem(HIDDEN_DOCS_KEY, JSON.stringify(ids));
}

function approvePendingDoc(docId) {
  const pending = getPendingDocs();
  const idx = pending.findIndex(d => d.id === docId);
  if (idx === -1) return;
  const [doc] = pending.splice(idx, 1);
  savePendingDocs(pending);
  upsertLocalDoc(doc);
  applyLocalDocOverrides();
  renderAdminDocTable();
}
function rejectPendingDoc(docId) {
  savePendingDocs(getPendingDocs().filter(d => d.id !== docId));
  renderAdminDocTable();
}
function approveAllPending() {
  const pending = getPendingDocs();
  if (!pending.length) return;
  pending.forEach(d => upsertLocalDoc(d));
  savePendingDocs([]);
  applyLocalDocOverrides();
  renderAdminDocTable();
  showToast(pending.length + ' document(s) validé(s)');
}

function applyLocalDocOverrides() {
  if (!APP.db || !APP.db.documents) return;
  const deleted = new Set(getDeletedIds());
  const localDocs = getLocalDocs();
  const localIds = new Set(localDocs.map(d => d.id));
  const base = APP.db.documents.filter(d => !deleted.has(d.id) && !localIds.has(d.id));
  APP.db.documents = [...base, ...localDocs.filter(d => !deleted.has(d.id))];
}

function upsertLocalDoc(doc) {
  const docs = getLocalDocs();
  const idx = docs.findIndex(d => d.id === doc.id);
  if (idx >= 0) docs[idx] = doc;
  else docs.push(doc);
  saveLocalDocs(docs);
  const deleted = getDeletedIds().filter(id => id !== doc.id);
  saveDeletedIds(deleted);
}

function deleteDocEverywhere(id) {
  saveLocalDocs(getLocalDocs().filter(d => d.id !== id));
  const deleted = getDeletedIds();
  if (!deleted.includes(id)) { deleted.push(id); saveDeletedIds(deleted); }
}

function nextDocId(allDocs) {
  const nums = allDocs.map(d => parseInt((d.id || '').replace('doc-', ''), 10)).filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return 'doc-' + String(max + 1).padStart(4, '0');
}

let editingDocId = null;
let editingIsPending = false;
let titleAutoFill = true;
let descAutoFill = true;
let titleTimer = null;
let descTimer = null;

function initDocManager() {
  if (!APP.db) return;
  populateDocFormSelects();
  renderAdminDocTable();
  wireDocManagerEvents();
  wireImportBackupUI();
  wireAutoBackupUI();
  startAutoBackup();
}

function populateDocFormSelects() {
  const diplomaSel = document.getElementById('doc-form-diploma');
  const semesterSel = document.getElementById('doc-form-semester');
  const moduleSel = document.getElementById('doc-form-module');
  const specialtySel = document.getElementById('doc-form-specialty');
  const typeSel = document.getElementById('doc-form-type');
  const hostSel = document.getElementById('doc-form-host');
  const wilayaSel = document.getElementById('doc-form-wilaya');
  const institutionSel = document.getElementById('doc-form-institution');

  if (!diplomaSel) return;

  diplomaSel.innerHTML = '<option value="">' + (t('filters.noDiploma') || 'Sans diplôme') + '</option>' +
    APP.db.diplomas.map(d => `<option value="${escapeAttr(d.id)}">${escapeHTML(localized(d.name))}</option>`).join('');

  semesterSel.innerHTML = '<option value="">—</option>';

  specialtySel.innerHTML = '<option value="">—</option>' +
    APP.db.specialties.map(s => `<option value="${escapeAttr(s.id)}">${escapeHTML(localized(s.name))}</option>`).join('');

  moduleSel.innerHTML = '<option value="">—</option>';

  typeSel.innerHTML = APP.db.documentTypes.map(ty => `<option value="${escapeAttr(ty.id)}">${escapeHTML(localized(ty.name))}</option>`).join('');

  hostSel.innerHTML = '<option value="drive">Google Drive</option><option value="mega">Mega</option><option value="other">Autre</option>';

  if (wilayaSel) {
    const wilayasList = APP.db.wilayas || [];
    wilayaSel.innerHTML = '<option value="">— ' + t('admin.noWilaya') + '</option>' +
      '<option value="National">' + t('admin.nationalWilaya') + '</option>' +
      wilayasList.map(w => '<option value="' + escapeAttr(localized(w.name)) + '">' + escapeHTML(w.code) + ' — ' + escapeHTML(localized(w.name)) + '</option>').join('');
  }

  if (institutionSel) {
    institutionSel.innerHTML = '<option value="">—</option>' +
      APP.db.institutions.map(i => `<option value="${escapeAttr(i.id)}">${escapeHTML(localized(i.name))}</option>`).join('');
  }

  // Wire diploma change → populate semesters
  diplomaSel.addEventListener('change', () => {
    const dip = APP.db.diplomas.find(d => d.id === diplomaSel.value);
    semesterSel.innerHTML = '<option value="">—</option>';
    if (dip && dip.semesters) {
      semesterSel.innerHTML += dip.semesters.map(s =>
        `<option value="${escapeAttr(s.id)}">${escapeHTML(localized(s.name))}</option>`
      ).join('');
    }
  });

  // Wire specialty change → populate modules
  specialtySel.addEventListener('change', () => {
    const filtered = APP.db.modules.filter(m => m.specialty === specialtySel.value);
    moduleSel.innerHTML = '<option value="">—</option>';
    filtered.forEach(m => {
      moduleSel.innerHTML += `<option value="${escapeAttr(m.id)}">${escapeHTML(localized(m.name))}</option>`;
    });
  });
}

function renderAdminDocTable() {
  const tbody = document.getElementById('admin-doc-table-body');
  const searchVal = (document.getElementById('admin-doc-search')?.value || '').toLowerCase().trim();

  const pendingDocs = getPendingDocs();
  const hiddenIds = getHiddenIds();
  let docs = [...APP.db.documents];
  const sk = sortState.key, sd = sortState.dir;
  docs.sort((a, b) => {
    let va, vb;
    if (sk === 'id') {
      va = parseInt(a.id.replace('doc-',''), 10) || 0;
      vb = parseInt(b.id.replace('doc-',''), 10) || 0;
    } else if (sk === 'title') {
      va = (localized(a.title) || '').toLowerCase();
      vb = (localized(b.title) || '').toLowerCase();
    } else {
      va = (a[sk] != null ? String(a[sk]) : '').toLowerCase();
      vb = (b[sk] != null ? String(b[sk]) : '').toLowerCase();
    }
    if (va < vb) return sd === 'asc' ? -1 : 1;
    if (va > vb) return sd === 'asc' ? 1 : -1;
    return 0;
  });
  if (searchVal) {
    docs = docs.filter(d => {
      const hay = [localized(d.title), d.id, d.module, d.diploma, d.semester].join(' ').toLowerCase();
      return hay.includes(searchVal);
    });
  }

  const selAllChecked = localStorage.getItem('_fp_select_all') === 'true' ? 'checked' : '';

  let html = '';

  // Toolbar
  html += '<tr class="selection-toolbar"><td colspan="10" style="padding:0.5rem 1rem;background:var(--surface);border-bottom:1px solid var(--kraft-line);">' +
    '<div style="display:flex;gap:var(--space-2);align-items:center;justify-content:center;flex-wrap:wrap;">' +
      '<button class="btn btn-ghost btn-xs" id="select-all-btn">☐ Tout</button>' +
      '<button class="btn btn-ghost btn-xs" id="deselect-all-btn">☐ Aucun</button>' +
      '<span style="color:var(--ink-soft);font-size:var(--fs-xs);" id="sel-count"></span>' +
      '<button class="btn btn-danger btn-xs" id="delete-selected-btn" style="display:none;">🗑 Supprimer</button>' +
      '<button class="btn btn-secondary btn-xs" id="hide-selected-btn" style="display:none;">👁 Masquer</button>' +
      '<button class="btn btn-secondary btn-xs" id="unhide-selected-btn" style="display:none;">👁 Afficher</button>' +
      '<button class="btn btn-primary btn-xs" id="bulk-edit-btn" style="display:none;">✏️ Modifier</button>' +
    '</div></td></tr>';

  // Bulk edit panel
  html += '<tr id="bulk-edit-panel" style="display:none;"><td colspan="10" style="padding:0.75rem 1rem;background:var(--surface-alt,#f0f4ff);border-bottom:2px solid var(--kraft-line);"><div style="display:flex;gap:var(--space-3);align-items:flex-end;flex-wrap:wrap;"><div style="font-weight:700;font-size:var(--fs-sm);width:100%;">✏️ Modifier la sélection — ne coche que les champs à changer :</div><label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-diploma"> Diplôme <select id="bulk-val-diploma" disabled="disabled" style="display:block;margin-top:2px;"></select></label><label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-semester"> Semestre <select id="bulk-val-semester" disabled="disabled" style="display:block;margin-top:2px;"></select></label><label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-specialty"> Spécialité <select id="bulk-val-specialty" disabled="disabled" style="display:block;margin-top:2px;"></select></label><label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-module"> Module <select id="bulk-val-module" disabled="disabled" style="display:block;margin-top:2px;"></select></label><label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-type"> Type <select id="bulk-val-type" disabled="disabled" style="display:block;margin-top:2px;"></select></label><label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-year"> Année <input type="number" id="bulk-val-year" disabled="disabled" placeholder="2025" min="2000" max="2099" style="display:block;margin-top:2px;width:90px;"></label><label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-institution"> Établissement <select id="bulk-val-institution" disabled="disabled" style="display:block;margin-top:2px;"></select></label><label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-wilaya"> Wilaya <select id="bulk-val-wilaya" disabled="disabled" style="display:block;margin-top:2px;"></select></label><label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-host"> Hébergement <input type="text" id="bulk-val-host" disabled="disabled" list="bulk-datalist-host" placeholder="Google Drive / Mega…" style="display:block;margin-top:2px;width:140px;"></label><label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-source"> Source <input type="text" id="bulk-val-source" disabled="disabled" placeholder="dzexams…" style="display:block;margin-top:2px;width:120px;"></label><label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-url-source"> URL Source <input type="url" id="bulk-val-url-source" disabled="disabled" list="bulk-datalist-url-source" placeholder="https://…" style="display:block;margin-top:2px;width:180px;"></label><label style="font-size:var(--fs-xs);"><input type="checkbox" id="bulk-chk-url-pdf"> URL PDF <input type="url" id="bulk-val-url-pdf" disabled="disabled" list="bulk-datalist-url-pdf" placeholder="https://…" style="display:block;margin-top:2px;width:180px;"></label><button class="btn btn-primary btn-xs" id="bulk-apply-btn">✅ Appliquer</button><button class="btn btn-ghost btn-xs" id="bulk-cancel-btn">✖ Annuler</button><span id="bulk-confirm" style="color:var(--green);font-size:var(--fs-xs);font-weight:600;"></span><datalist id="bulk-datalist-host"><option value="Google Drive"><option value="Mega"><option value="Autre"></datalist><datalist id="bulk-datalist-url-source"></datalist><datalist id="bulk-datalist-url-pdf"></datalist></div></td></tr>';

  // Pending section
  if (pendingDocs.length) {
    html += '<tr class="pending-section-header"><td colspan="10" style="padding:0.75rem 1rem;background:var(--gold);color:var(--ink);font-weight:700;">⏳ ' + pendingDocs.length + ' ' + t('admin.pendingValidation') + '</td></tr>';
    pendingDocs.forEach(doc => {
      const moduleName = APP.db.modules.find(m => m.id === doc.module);
      const typeName = APP.db.documentTypes.find(ty => ty.id === doc.type);
      const isHidden = hiddenIds.includes(doc.id);
      html += '<tr data-doc-id="' + escapeAttr(doc.id) + '"' + (isHidden ? ' style="opacity:0.5;"' : '') + '>' +
        '<td><input type="checkbox" class="doc-select-cb" data-doc-id="' + escapeAttr(doc.id) + '" ' + selAllChecked + '></td>' +
        '<td class="doc-table-title">' + escapeHTML(localized(doc.title)) + ' <span class="local-tag" style="background:var(--gold);color:var(--ink);">' + t('admin.pendingValidation') + '</span>' + (isHidden ? ' <span class="local-tag" style="background:var(--ink-soft);">masqué</span>' : '') + '</td>' +
        '<td>' + escapeHTML(moduleName ? localized(moduleName.name) : (doc.module || '—')) + '</td>' +
        '<td>' + escapeHTML(typeName ? localized(typeName.name) : doc.type) + '</td>' +
        '<td>' + escapeHTML(doc.semester || '—') + '</td>' +
        '<td class="ltr-only">' + escapeHTML(doc.year || '—') + '</td>' +
        '<td style="text-transform:capitalize;">' + escapeHTML(doc.host) + '</td>' +
        '<td style="text-transform:capitalize;">' + escapeHTML(doc.source || '—') + '</td>' +
        '<td style="white-space:nowrap;">' + (doc.urlSource ? '<button class="btn-source-eye" data-url="' + escapeAttr(doc.urlSource) + '" title="Voir la source">📄</button>' : '') + (doc.previewUrl || doc.downloadUrl ? '<button class="btn-preview-pdf" data-url="' + escapeAttr(doc.previewUrl || doc.downloadUrl) + '" title="Aperçu PDF">👁</button>' : '') + (!doc.urlSource && !doc.previewUrl && !doc.downloadUrl ? '—' : '') + '</td>' +
        '<td class="doc-table-actions">' +
          '<button class="btn btn-secondary btn-sm edit-pending-btn" data-doc-id="' + escapeAttr(doc.id) + '">' + icon('settings') + '</button>' +
          '<button class="btn btn-primary btn-sm approve-pending-btn" data-doc-id="' + escapeAttr(doc.id) + '">✓ ' + t('admin.validate') + '</button>' +
          '<button class="btn btn-danger btn-sm reject-pending-btn" data-doc-id="' + escapeAttr(doc.id) + '">✕ ' + t('admin.reject') + '</button>' +
        '</td></tr>';
    });
    html += '<tr><td colspan="10" style="padding:0.5rem 1rem;"><button class="btn btn-primary btn-sm" id="approve-all-pending-btn">✓ ' + t('admin.validateAll') + '</button></td></tr>';
  }

  // Published section
  if (docs.length) {
    html += '<tr class="pending-section-header"><td colspan="10" style="padding:0.75rem 1rem;background:var(--kraft);font-weight:600;">✅ ' + t('admin.tabDocs') + ' (' + docs.length + ')</td></tr>';
    html += docs.map(doc => {
      const moduleName = APP.db.modules.find(m => m.id === doc.module);
      const typeName = APP.db.documentTypes.find(ty => ty.id === doc.type);
      const isLocal = getLocalDocs().some(d => d.id === doc.id);
      const isHidden = hiddenIds.includes(doc.id);
      return '<tr data-doc-id="' + escapeAttr(doc.id) + '"' + (isHidden ? ' style="opacity:0.5;"' : '') + '>' +
        '<td><input type="checkbox" class="doc-select-cb" data-doc-id="' + escapeAttr(doc.id) + '" ' + selAllChecked + '></td>' +
        '<td class="doc-table-title">' + escapeHTML(localized(doc.title)) + (isLocal ? ' <span class="local-tag">local</span>' : '') + (isHidden ? ' <span class="local-tag" style="background:var(--ink-soft);">masqué</span>' : '') + '</td>' +
        '<td>' + escapeHTML(moduleName ? localized(moduleName.name) : '—') + '</td>' +
        '<td>' + escapeHTML(typeName ? localized(typeName.name) : doc.type) + '</td>' +
        '<td>' + escapeHTML(doc.semester || '—') + '</td>' +
        '<td class="ltr-only">' + escapeHTML(doc.year || '—') + '</td>' +
        '<td style="text-transform:capitalize;">' + escapeHTML(doc.host) + '</td>' +
        '<td style="text-transform:capitalize;">' + escapeHTML(doc.source || '—') + '</td>' +
        '<td style="white-space:nowrap;">' + (doc.urlSource ? '<button class="btn-source-eye" data-url="' + escapeAttr(doc.urlSource) + '" title="Voir la source">📄</button>' : '') + (doc.previewUrl || doc.downloadUrl ? '<button class="btn-preview-pdf" data-url="' + escapeAttr(doc.previewUrl || doc.downloadUrl) + '" title="Aperçu PDF">👁</button>' : '') + (!doc.urlSource && !doc.previewUrl && !doc.downloadUrl ? '—' : '') + '</td>' +
        '<td class="doc-table-actions">' +
          '<button class="btn btn-secondary btn-sm edit-doc-btn" data-doc-id="' + escapeAttr(doc.id) + '">' + icon('settings') + '</button>' +
          '<button class="btn btn-danger btn-sm delete-doc-btn" data-doc-id="' + escapeAttr(doc.id) + '">' + icon('trash') + '</button>' +
        '</td></tr>';
    }).join('');
  }

  if (!html) {
    html = '<tr><td colspan="10" style="text-align:center; padding:1.5rem; color:var(--ink-soft);">' + t('empty.title') + '</td></tr>';
  }

  tbody.innerHTML = html;
  wireTableEvents(tbody);
  updateSortIndicators();
  wireSortHeaders();
}

function wireTableEvents(tbody) {
  const selCountEl = document.getElementById('sel-count');
  const deleteSelBtn = document.getElementById('delete-selected-btn');
  const hideSelBtn = document.getElementById('hide-selected-btn');
  const unhideSelBtn = document.getElementById('unhide-selected-btn');
  const bulkEditBtn = document.getElementById('bulk-edit-btn');
  const bulkPanel = document.getElementById('bulk-edit-panel');

  function updateSelectionUI() {
    const checked = tbody.querySelectorAll('.doc-select-cb:checked');
    const count = checked.length;
    const hiddenIds = getHiddenIds();
    const hasHidden = [...checked].some(cb => hiddenIds.includes(cb.dataset.docId));
    const hasVisible = [...checked].some(cb => !hiddenIds.includes(cb.dataset.docId));
    if (selCountEl) selCountEl.textContent = count ? count + ' sélectionné(s)' : '';
    if (deleteSelBtn) { deleteSelBtn.disabled = count === 0; deleteSelBtn.style.display = count === 0 ? 'none' : ''; }
    if (hideSelBtn) { hideSelBtn.disabled = count === 0; hideSelBtn.style.display = hasVisible && count > 0 ? '' : 'none'; }
    if (unhideSelBtn) { unhideSelBtn.style.display = hasHidden ? '' : 'none'; }
    if (bulkEditBtn) { bulkEditBtn.disabled = count === 0; bulkEditBtn.style.display = count === 0 ? 'none' : ''; }
  }

  tbody.querySelectorAll('.doc-select-cb').forEach(cb => cb.addEventListener('change', updateSelectionUI));

  document.getElementById('select-all-btn')?.addEventListener('click', () => {
    tbody.querySelectorAll('.doc-select-cb').forEach(cb => { cb.checked = true; });
    localStorage.setItem('_fp_select_all', 'true');
    updateSelectionUI();
  });
  document.getElementById('deselect-all-btn')?.addEventListener('click', () => {
    tbody.querySelectorAll('.doc-select-cb').forEach(cb => { cb.checked = false; });
    localStorage.setItem('_fp_select_all', 'false');
    updateSelectionUI();
  });

  if (deleteSelBtn) {
    deleteSelBtn.addEventListener('click', () => {
      const ids = [...tbody.querySelectorAll('.doc-select-cb:checked')].map(cb => cb.dataset.docId);
      if (!confirm('Supprimer ' + ids.length + ' document(s) définitivement ?')) return;
      ids.forEach(id => { deleteDocEverywhere(id); savePendingDocs(getPendingDocs().filter(d => d.id !== id)); });
      applyLocalDocOverrides();
      renderAdminDocTable();
      showToast(ids.length + ' document(s) supprimé(s)');
    });
  }

  if (hideSelBtn) {
    hideSelBtn.addEventListener('click', () => {
      const ids = [...tbody.querySelectorAll('.doc-select-cb:checked')].map(cb => cb.dataset.docId);
      const hidden = getHiddenIds();
      ids.forEach(id => { if (!hidden.includes(id)) hidden.push(id); });
      saveHiddenIds(hidden);
      renderAdminDocTable();
      showToast(ids.length + ' document(s) masqué(s)');
    });
  }

  if (unhideSelBtn) {
    unhideSelBtn.addEventListener('click', () => {
      const ids = [...tbody.querySelectorAll('.doc-select-cb:checked')].map(cb => cb.dataset.docId);
      saveHiddenIds(getHiddenIds().filter(id => !ids.includes(id)));
      renderAdminDocTable();
      showToast(ids.length + ' document(s) ré-affiché(s)');
    });
  }

  // Bulk edit panel
  if (bulkEditBtn && bulkPanel) {
    const bulkDiplomas = document.getElementById('bulk-val-diploma');
    const bulkSemesters = document.getElementById('bulk-val-semester');
    const bulkSpecialties = document.getElementById('bulk-val-specialty');
    const bulkModules = document.getElementById('bulk-val-module');
    const bulkTypes = document.getElementById('bulk-val-type');
    const bulkYear = document.getElementById('bulk-val-year');
    const bulkInstitutions = document.getElementById('bulk-val-institution');
    const bulkWilayas = document.getElementById('bulk-val-wilaya');
    const bulkHost = document.getElementById('bulk-val-host');
    const bulkSource = document.getElementById('bulk-val-source');
    const bulkUrlSource = document.getElementById('bulk-val-url-source');
    const bulkUrlPdf = document.getElementById('bulk-val-url-pdf');

    if (bulkDiplomas) bulkDiplomas.innerHTML = '<option value="">— choisir —</option>' + (APP.db.diplomas || []).map(d => '<option value="' + escapeAttr(d.id) + '">' + escapeHTML(localized(d.name)) + '</option>').join('');
    if (bulkSemesters) {
      let semOpts = '';
      (APP.db.diplomas || []).forEach(dip => {
        (dip.semesters || []).forEach(s => {
          semOpts += '<option value="' + escapeAttr(s.id) + '">' + escapeHTML(localized(dip.name)) + ' — ' + escapeHTML(localized(s.name)) + '</option>';
        });
      });
      bulkSemesters.innerHTML = '<option value="">— choisir —</option>' + semOpts;
    }
    if (bulkSpecialties) bulkSpecialties.innerHTML = '<option value="">— choisir —</option>' + (APP.db.specialties || []).map(s => '<option value="' + escapeAttr(s.id) + '">' + escapeHTML(localized(s.name)) + '</option>').join('');
    if (bulkModules) bulkModules.innerHTML = '<option value="">— choisir —</option>' + (APP.db.modules || []).map(m => '<option value="' + escapeAttr(m.id) + '">' + escapeHTML(localized(m.name)) + '</option>').join('');
    if (bulkTypes) bulkTypes.innerHTML = '<option value="">— choisir —</option>' + (APP.db.documentTypes || []).map(ty => '<option value="' + escapeAttr(ty.id) + '">' + escapeHTML(localized(ty.name)) + '</option>').join('');
    if (bulkInstitutions) bulkInstitutions.innerHTML = '<option value="">— choisir —</option>' + (APP.db.institutions || []).map(i => '<option value="' + escapeAttr(i.id) + '">' + escapeHTML(localized(i.name)) + '</option>').join('');
    if (bulkWilayas) {
      const wOpts = (APP.db.wilayas || []).map(w => '<option value="' + escapeAttr(w.code || w.id) + '">' + escapeAttr(w.code || w.id) + ' — ' + escapeHTML(localized(w.name)) + '</option>').join('');
      bulkWilayas.innerHTML = '<option value="">— choisir —</option>' + wOpts;
    }
    if (bulkHost) bulkHost.innerHTML = '<option value="">— choisir —</option>' + (APP.db.hosts || []).map(h => '<option value="' + escapeAttr(h.id) + '">' + escapeHTML(localized(h.name)) + '</option>').join('');

    // Populate URL datalists from existing documents
    const urlSourceVals = [...new Set((APP.db.documents || []).map(d => d.urlSource).filter(Boolean))];
    const urlPdfVals = [...new Set((APP.db.documents || []).map(d => d.previewUrl || d.downloadUrl || d.urlPdf).filter(Boolean))];
    const dlUrlSource = document.getElementById('bulk-datalist-url-source');
    const dlUrlPdf = document.getElementById('bulk-datalist-url-pdf');
    if (dlUrlSource) dlUrlSource.innerHTML = urlSourceVals.map(u => '<option value="' + escapeAttr(u) + '">').join('');
    if (dlUrlPdf) dlUrlPdf.innerHTML = urlPdfVals.map(u => '<option value="' + escapeAttr(u) + '">').join('');

    ['bulk-chk-diploma','bulk-chk-semester','bulk-chk-specialty','bulk-chk-module','bulk-chk-type','bulk-chk-year','bulk-chk-institution','bulk-chk-wilaya','bulk-chk-host','bulk-chk-source','bulk-chk-url-source','bulk-chk-url-pdf'].forEach(cId => {
      const c = document.getElementById(cId);
      if (c) c.addEventListener('change', () => {
        const ctrl = c.parentElement.querySelector('select, input[type="number"], input[type="text"], input[type="url"]');
        if (ctrl) ctrl.disabled = !c.checked;
      });
    });

    bulkEditBtn.addEventListener('click', () => {
      bulkPanel.style.display = bulkPanel.style.display === 'none' ? '' : 'none';
      const bc = document.getElementById('bulk-confirm');
      if (bc) bc.textContent = '';
    });

    document.getElementById('bulk-cancel-btn')?.addEventListener('click', () => {
      bulkPanel.style.display = 'none';
    });

    document.getElementById('bulk-apply-btn')?.addEventListener('click', () => {
      const ids = [...tbody.querySelectorAll('.doc-select-cb:checked')].map(cb => cb.dataset.docId);
      if (!ids.length) return;
      const fields = {};
      if (document.getElementById('bulk-chk-diploma')?.checked) fields.diploma = bulkDiplomas.value;
      if (document.getElementById('bulk-chk-semester')?.checked) fields.semester = bulkSemesters.value || null;
      if (document.getElementById('bulk-chk-specialty')?.checked) fields.specialty = bulkSpecialties.value || null;
      if (document.getElementById('bulk-chk-module')?.checked) fields.module = bulkModules.value || null;
      if (document.getElementById('bulk-chk-type')?.checked) fields.type = bulkTypes.value;
      if (document.getElementById('bulk-chk-year')?.checked && bulkYear.value) fields.year = parseInt(bulkYear.value, 10);
      if (document.getElementById('bulk-chk-institution')?.checked) fields.institution = bulkInstitutions.value || null;
      if (document.getElementById('bulk-chk-wilaya')?.checked) fields.wilaya = bulkWilayas.value || null;
      if (document.getElementById('bulk-chk-host')?.checked) fields.host = bulkHost.value.trim() || null;
      if (document.getElementById('bulk-chk-source')?.checked && bulkSource.value.trim()) fields.source = bulkSource.value.trim();
      if (document.getElementById('bulk-chk-url-source')?.checked && bulkUrlSource.value.trim()) fields.urlSource = bulkUrlSource.value.trim();
      if (document.getElementById('bulk-chk-url-pdf')?.checked && bulkUrlPdf.value.trim()) fields.urlPdf = bulkUrlPdf.value.trim();
      if (!Object.keys(fields).length) { showToast('Coche au moins un champ'); return; }
      let count = 0;
      (APP.db.documents || []).forEach(doc => {
        if (ids.includes(doc.id)) { Object.assign(doc, fields); count++; }
      });
      try {
        const pending = getPendingDocs();
        if (pending.length) {
          pending.forEach(doc => { if (ids.includes(doc.id)) { Object.assign(doc, fields); count++; } });
          savePendingDocs(pending);
        }
      } catch(e) { console.error('Bulk edit pending error:', e); }
      renderAdminDocTable();
      const bc = document.getElementById('bulk-confirm');
      if (bc) bc.textContent = '✅ ' + count + ' document(s) modifié(s)';
      showToast(count + ' document(s) modifié(s)');
    });
  }

  tbody.querySelectorAll('.edit-doc-btn').forEach(btn => btn.addEventListener('click', () => openDocFormForEdit(btn.dataset.docId)));
  tbody.querySelectorAll('.delete-doc-btn').forEach(btn => btn.addEventListener('click', () => confirmDeleteDoc(btn.dataset.docId)));
  tbody.querySelectorAll('.edit-pending-btn').forEach(btn => btn.addEventListener('click', () => openDocFormForEdit(btn.dataset.docId)));
  tbody.querySelectorAll('.approve-pending-btn').forEach(btn => btn.addEventListener('click', () => approvePendingDoc(btn.dataset.docId)));
  tbody.querySelectorAll('.reject-pending-btn').forEach(btn => btn.addEventListener('click', () => rejectPendingDoc(btn.dataset.docId)));
  document.getElementById('approve-all-pending-btn')?.addEventListener('click', approveAllPending);

  tbody.querySelectorAll('.btn-source-eye').forEach(btn => btn.addEventListener('click', () => window.open(btn.dataset.url, '_blank')));
  tbody.querySelectorAll('.btn-preview-pdf').forEach(btn => btn.addEventListener('click', () => window.open(btn.dataset.url, '_blank')));

  updateSelectionUI();
}

function updateSortIndicators() {
  document.querySelectorAll('.admin-doc-table th.sortable').forEach(th => {
    const key = th.dataset.sort;
    const text = th.textContent.replace(/[▲▼].*$/, '').trim();
    th.textContent = text + (key === sortState.key ? ' ' + (sortState.dir === 'asc' ? '▲' : '▼') : '');
  });
}

function wireSortHeaders() {
  document.querySelectorAll('.admin-doc-table th.sortable').forEach(th => {
    th.removeEventListener('click', sortClickHandler);
    th.addEventListener('click', sortClickHandler);
  });
}

function sortClickHandler(e) {
  const key = e.currentTarget.dataset.sort;
  if (sortState.key === key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  else { sortState.key = key; sortState.dir = 'asc'; }
  renderAdminDocTable();
}

function openDocFormForEdit(docId) {
  let doc = APP.db.documents.find(d => d.id === docId);
  editingIsPending = false;
  if (!doc) {
    doc = getPendingDocs().find(d => d.id === docId);
    if (!doc) return;
    editingIsPending = true;
  }
  editingDocId = docId;
  titleAutoFill = true;
  descAutoFill = true;

  document.getElementById('doc-form-title-fr').value = doc.title?.fr || '';
  document.getElementById('doc-form-title-ar').value = doc.title?.ar || '';
  document.getElementById('doc-form-title-en').value = doc.title?.en || '';
  document.getElementById('doc-form-desc-fr').value = doc.description?.fr || '';
  document.getElementById('doc-form-desc-ar').value = doc.description?.ar || '';
  document.getElementById('doc-form-desc-en').value = doc.description?.en || '';

  // Set diploma and trigger semester population
  const diplomaSel = document.getElementById('doc-form-diploma');
  diplomaSel.value = doc.diploma || '';
  diplomaSel.dispatchEvent(new Event('change'));
  document.getElementById('doc-form-semester').value = doc.semester || '';

  const specialtySel = document.getElementById('doc-form-specialty');
  specialtySel.value = doc.specialty || '';
  specialtySel.dispatchEvent(new Event('change'));
  document.getElementById('doc-form-module').value = doc.module || '';

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

  document.getElementById('doc-form-title-heading').textContent = t('admin.editDoc');
  document.getElementById('doc-form-submit-btn').textContent = t('admin.saveChanges');

  document.querySelectorAll('.admin-sub-tab').forEach(b => b.classList.remove('active'));
  document.querySelector('.admin-sub-tab[data-subtab="docs-add"]')?.classList.add('active');
  document.querySelectorAll('#tab-panel-docs .admin-sub-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('sub-panel-docs-add')?.classList.remove('hidden');
}

function resetDocForm() {
  editingDocId = null;
  editingIsPending = false;
  document.getElementById('doc-form').reset();
  document.getElementById('doc-form-title-heading').textContent = t('admin.addDoc');
  document.getElementById('doc-form-submit-btn').textContent = t('admin.save');
}

function confirmDeleteDoc(docId) {
  let doc = APP.db.documents.find(d => d.id === docId);
  if (!doc) doc = getPendingDocs().find(d => d.id === docId);
  if (!doc) return;
  if (!confirm(t('admin.confirmDelete') + '\n\n"' + localized(doc.title) + '"')) return;
  deleteDocEverywhere(docId);
  applyLocalDocOverrides();
  renderAdminDocTable();
  showToast(t('admin.docDeleted'));
  if (editingDocId === docId) resetDocForm();
}

function wireDocManagerEvents() {
  const form = document.getElementById('doc-form');

  const titleFr = document.getElementById('doc-form-title-fr');
  const titleAr = document.getElementById('doc-form-title-ar');
  const titleEn = document.getElementById('doc-form-title-en');
  titleTimer = null;

  titleFr.addEventListener('input', () => {
    clearTimeout(titleTimer);
    const val = titleFr.value;
    if (!val) { titleAr.value = ''; titleEn.value = ''; return; }
    titleTimer = setTimeout(async () => {
      if (titleAr.value === '' && val) titleAr.value = await translateText(val, 'ar');
      if (titleEn.value === '' && val) titleEn.value = await translateText(val, 'en');
    }, 600);
  });

  const previewUrl = document.getElementById('doc-form-preview-url');
  const sizeField = document.getElementById('doc-form-size');
  const pagesField = document.getElementById('doc-form-pages');
  async function autoDetectPdfFields(field) {
    const url = (field && field.value.trim()) || '';
    if (!url) return;
    try {
      const meta = await detectPdfMeta(url);
      if (!meta) return;
      if (!sizeField.value && meta.size) sizeField.value = meta.size;
      if (!pagesField.value && meta.pages > 0) pagesField.value = String(meta.pages);
    } catch {}
  }
  [previewUrl, document.getElementById('doc-form-download-url')].forEach(field => {
    if (!field) return;
    field.addEventListener('paste', () => setTimeout(() => autoDetectPdfFields(field), 150));
    field.addEventListener('blur', () => {
      if (!sizeField.value || !pagesField.value) autoDetectPdfFields(field);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sizeField.value || !pagesField.value) await autoDetectPdfFields(previewUrl);
    const titleFrVal = document.getElementById('doc-form-title-fr').value.trim();
    const previewUrlVal = document.getElementById('doc-form-preview-url').value.trim();
    const downloadUrlVal = document.getElementById('doc-form-download-url').value.trim();
    if (!titleFrVal || !previewUrlVal || !downloadUrlVal) {
      showToast(t('admin.requiredFieldsMissing'));
      return;
    }

    const id = editingDocId || nextDocId(APP.db.documents);
    const doc = {
      id,
      title: {
        fr: titleFrVal,
        ar: document.getElementById('doc-form-title-ar').value.trim() || titleFrVal,
        en: document.getElementById('doc-form-title-en').value.trim() || titleFrVal
      },
      diploma: document.getElementById('doc-form-diploma').value,
      semester: document.getElementById('doc-form-semester').value || null,
      specialty: document.getElementById('doc-form-specialty').value || null,
      module: document.getElementById('doc-form-module').value,
      type: document.getElementById('doc-form-type').value,
      year: parseInt(document.getElementById('doc-form-year').value, 10) || '',
      institution: document.getElementById('doc-form-institution').value || null,
      wilaya: document.getElementById('doc-form-wilaya').value.trim() || null,
      description: {
        fr: document.getElementById('doc-form-desc-fr').value.trim(),
        ar: document.getElementById('doc-form-desc-ar').value.trim(),
        en: document.getElementById('doc-form-desc-en').value.trim()
      },
      fileType: 'pdf',
      pages: parseInt(document.getElementById('doc-form-pages').value, 10) || 1,
      size: document.getElementById('doc-form-size').value.trim() || '—',
      previewUrl: previewUrlVal,
      downloadUrl: downloadUrlVal,
      host: document.getElementById('doc-form-host').value,
      source: document.getElementById('doc-form-source').value.trim() || '',
      urlSource: document.getElementById('doc-form-url-source').value.trim() || '',
      urlPdf: document.getElementById('doc-form-url-pdf').value.trim() || '',
      downloads: 0,
      rating: 0,
      tags: []
    };

    if (editingIsPending) {
      const pending = getPendingDocs();
      const idx = pending.findIndex(d => d.id === id);
      if (idx >= 0) pending[idx] = doc;
      else pending.push(doc);
      savePendingDocs(pending);
    } else {
      upsertLocalDoc(doc);
      applyLocalDocOverrides();
    }
    renderAdminDocTable();
    resetDocForm();
    showToast(editingDocId ? t('admin.docUpdated') : t('admin.docAdded'));
  });

  document.getElementById('doc-form-cancel-btn')?.addEventListener('click', resetDocForm);

  const searchInput = document.getElementById('admin-doc-search');
  if (searchInput) searchInput.addEventListener('input', debounce(renderAdminDocTable, 200));

  document.getElementById('export-db-btn')?.addEventListener('click', exportDbJson);
}

async function translateText(text, targetLang) {
  if (!text.trim()) return '';
  try {
    const res = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 500)) + '&langpair=fr|' + targetLang);
    const data = await res.json();
    return data.responseData?.translatedText || text;
  } catch { return text; }
}

// Détection best-effort (taille + nombre de pages réel) d'un PDF depuis son URL, 100 % côté
// navigateur (aucun backend). Google Drive : l'URL de téléchargement uc?export=download
// renvoie 403 aux fetchs cross-origin du navigateur, donc on lit la taille RÉELLE du fichier
// dans la page viewer (/preview, lisible en CORS) via itemJson. Les pages d'un PDF Drive ne
// sont lues par requêtes Range sur drive.usercontent.google.com (comptage PDF intégré). Sinon : HEAD
// pour la taille puis téléchargement + pdfjs-dist (CDN) pour les pages, avec repli sur le
// /Count de l'en-tête du PDF. pages vaut 0 si le comptage a échoué (jamais d'estimation).
function normalizePdfUrl(url) {
  const u = url.trim();
  const gdMatch = u.match(/drive\.google\.com\/file\/d\/([^/?#&]+)/);
  if (gdMatch) return 'https://drive.google.com/uc?export=download&id=' + gdMatch[1];
  return u;
}

function extractDriveSizeFromViewerHtml(html) {
  const item = html.match(/itemJson:\s*\[([\s\S]*?)\]\s*\};/);
  if (!item) return null;
  const sizeMatch = item[1].match(/\[null,null,"(\d+)"\]/);
  if (!sizeMatch) return null;
  const bytes = parseInt(sizeMatch[1], 10);
  return bytes > 0 ? bytes : null;
}

const PDF_PAGES_PROXY = 'https://script.google.com/macros/s/AKfycbx9Ax9k1WG187KJ5nivTT-dUC_07vFkF7A9IHXcxqafeWbyE0rpc7XKFlUJ280DcYQcUw/exec';

async function detectPdfMeta(url) {
  if (!url || !url.trim()) return null;
  const gdMatch = url.trim().match(/drive\.google\.com\/file\/d\/([^/?#&]+)/);
  if (gdMatch) {
    const fileId = gdMatch[1];
    try {
      const res = await fetch('https://drive.google.com/file/d/' + fileId + '/preview', { signal: AbortSignal.timeout(20000) });
      if (res.ok) {
        const bytes = extractDriveSizeFromViewerHtml(await res.text());
        if (bytes) {
          const pages = await countDrivePdfPages(fileId);
          return { size: formatFileSize(bytes), pages };
        }
      }
    } catch { /* ignore CORS/network errors */ }
    return null;
  }
  const target = normalizePdfUrl(url);
  let bytes = null;
  try {
    const headRes = await fetch(target, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
    const len = headRes.headers.get('Content-Length');
    if (len && parseInt(len, 10) > 0) bytes = parseInt(len, 10);
  } catch { /* ignore CORS/network errors */ }
  let pages = 0;
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(25000) });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (!bytes) bytes = buf.byteLength;
      if (buf.byteLength >= 5 && new TextDecoder('latin1').decode(buf.slice(0, 5)) === '%PDF-') {
        try {
          const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/legacy/build/pdf.min.mjs');
          const doc = await pdfjs.getDocument({ data: buf, disableWorker: true, isEvalSupported: false }).promise;
          if (doc && typeof doc.numPages === 'number' && doc.numPages > 0) pages = doc.numPages;
          if (typeof doc.destroy === 'function') doc.destroy();
        } catch {
          const text = new TextDecoder('latin1').decode(buf.slice(0, 16384));
          const m = text.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/);
          if (m && m[1]) {
            const c = parseInt(m[1], 10);
            if (c > 0 && c < 500) pages = c;
          }
        }
      }
    }
  } catch { /* ignore CORS/network errors */ }
  if (!bytes) return null;
  return { size: formatFileSize(bytes), pages };
}

function pdfInflateRaw(data) {
  data = new Uint8Array(data);
  const out = [];
  let bitPos = 0;
  function bits(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byteIdx = bitPos >> 3, bitIdx = bitPos & 7;
      if (byteIdx < data.length) v |= ((data[byteIdx] >> bitIdx) & 1) << i;
      bitPos++;
    }
    return v;
  }
  function buildCanonical(lengths) {
    const maxBits = Math.max(0, ...lengths);
    const counts = new Array(maxBits + 1).fill(0);
    for (const l of lengths) if (l > 0) counts[l]++;
    const first = new Array(maxBits + 1).fill(0);
    let code = 0;
    for (let l = 1; l <= maxBits; l++) { code = (code + counts[l - 1]) << 1; first[l] = code; }
    const symbolsByLen = new Array(maxBits + 1).fill(null).map(() => []);
    for (let sym = 0; sym < lengths.length; sym++) { const l = lengths[sym]; if (l > 0) symbolsByLen[l].push(sym); }
    return { counts, first, symbolsByLen, maxBits };
  }
  function decodeSym(t) {
    let code = 0, first = 0;
    for (let l = 1; l <= t.maxBits; l++) {
      code |= bits(1);
      const c = t.counts[l];
      if (code - first < c) return t.symbolsByLen[l][code - first];
      first = (first + c) << 1;
      code <<= 1;
    }
    throw new Error('bad huffman code');
  }
  const LEN_BASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LEN_EXT  = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DIST_BASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DIST_EXT  = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const FIX_LEN = new Array(288);
  for (let i = 0; i < 144; i++) FIX_LEN[i] = 8;
  for (let i = 144; i < 256; i++) FIX_LEN[i] = 9;
  for (let i = 256; i < 280; i++) FIX_LEN[i] = 7;
  for (let i = 280; i < 288; i++) FIX_LEN[i] = 8;
  const FIX_DIST = new Array(30).fill(5);
  const CLEN_ORDER = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  let last = false;
  do {
    last = bits(1) === 1;
    const btype = bits(2);
    if (btype === 0) {
      bitPos = (bitPos + 7) & ~7;
      const len = bits(16), nlen = bits(16);
      if ((len ^ 0xFFFF) !== nlen) throw new Error('stored block length mismatch');
      const base = bitPos >> 3;
      for (let i = 0; i < len; i++) out.push(data[base + i]);
      bitPos += len * 8;
      continue;
    }
    let litLen, dist;
    if (btype === 1) { litLen = buildCanonical(FIX_LEN); dist = buildCanonical(FIX_DIST); }
    else if (btype === 2) {
      const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
      const clenLens = new Array(19).fill(0);
      for (let i = 0; i < hclen; i++) clenLens[CLEN_ORDER[i]] = bits(3);
      const clenT = buildCanonical(clenLens);
      const allLens = [];
      while (allLens.length < hlit + hdist) {
        const s = decodeSym(clenT);
        if (s < 16) allLens.push(s);
        else if (s === 16) { const r = bits(2) + 3; const prev = allLens[allLens.length - 1]; for (let i = 0; i < r; i++) allLens.push(prev); }
        else if (s === 17) { const r = bits(3) + 3; for (let i = 0; i < r; i++) allLens.push(0); }
        else { const r = bits(7) + 11; for (let i = 0; i < r; i++) allLens.push(0); }
      }
      litLen = buildCanonical(allLens.slice(0, hlit));
      dist = buildCanonical(allLens.slice(hlit, hlit + hdist));
    } else throw new Error('bad block type');
    while (true) {
      const s = decodeSym(litLen);
      if (s < 256) out.push(s);
      else if (s === 256) break;
      else {
        const li = s - 257;
        const len = LEN_BASE[li] + bits(LEN_EXT[li]);
        const ds = decodeSym(dist);
        const d = DIST_BASE[ds] + bits(DIST_EXT[ds]);
        const start = out.length - d;
        for (let i = 0; i < len; i++) out.push(out[start + i]);
      }
    }
  } while (!last);
  return Uint8Array.from(out);
}

function pdfToLatin1(s) { let out = ''; for (let i = 0; i < s.length; i += 8000) out += String.fromCharCode.apply(null, s.subarray(i, i + 8000)); return out; }
function pdfInflateFlate(raw) {
  const z = new Uint8Array(Math.max(0, raw.length - 6));
  for (let i = 0; i < z.length; i++) z[i] = raw.charCodeAt(i + 2) & 0xff;
  return pdfToLatin1(pdfInflateRaw(z));
}
function pdfGetDict(text, fromIdx) {
  const s = text.indexOf('<<', fromIdx);
  if (s < 0) return null;
  let depth = 0, i = s;
  for (; i < text.length; i++) {
    if (text[i] === '<' && text[i + 1] === '<') depth++;
    else if (text[i] === '>' && text[i + 1] === '>') { depth--; i++; if (depth === 0) break; }
  }
  return { dict: text.slice(s, i + 1) };
}
function pdfDictValue(dict, key) {
  const m = dict.match(new RegExp('/' + key + '\\s+([^\\s\\[\\]<>]+)'));
  if (m) return m[1];
  const arr = dict.match(new RegExp('/' + key + '\\s*(\\[[^\\]]*\\])'));
  if (arr) return arr[1];
  return null;
}
function pdfParseXrefTable(chunk) {
  const map = {};
  const re = /xref\s+(\d+)\s+(\d+)\s+((?:(?:\d{10})\s+\d{5}\s+[nf]\s*)+)/g;
  let m;
  while ((m = re.exec(chunk))) {
    const start = parseInt(m[1], 10), count = parseInt(m[2], 10);
    const entries = m[3].trim().split(/\s+/);
    for (let i = 0; i < count; i++) {
      if (entries[i * 3 + 2] === 'n') map[start + i] = { offset: parseInt(entries[i * 3], 10) };
    }
  }
  return map;
}
function pdfParseXrefStream(chunk) {
  const objStart = chunk.search(/\d+\s+\d+\s+obj\s*<<[\s\S]*?\/Type\s*\/XRef/);
  if (objStart < 0) return null;
  const dd = pdfGetDict(chunk, objStart);
  if (!dd) return null;
  const w = pdfDictValue(dd.dict, 'W');
  if (!w) return null;
  const ws = w.slice(1, -1).trim().split(/\s+/).map(Number);
  let idxPairs = [];
  const index = pdfDictValue(dd.dict, 'Index');
  if (index) {
    const arr = index.slice(1, -1).trim().split(/\s+/).map(Number);
    for (let i = 0; i + 1 < arr.length; i += 2) idxPairs.push([arr[i], arr[i + 1]]);
  } else {
    idxPairs = [[0, parseInt(pdfDictValue(dd.dict, 'Size'), 10)]];
  }
  const sm = chunk.match(/stream\r?\n([\s\S]*?)\r?\n?endstream/);
  if (!sm) return null;
  let raw = sm[1];
  if (pdfDictValue(dd.dict, 'Filter') === '/FlateDecode') raw = pdfInflateFlate(raw);
  const [w0, w1, w2] = ws;
  const map = {};
  for (const [istart, icount] of idxPairs) {
    for (let i = 0; i < icount; i++) {
      const off = istart + i;
      const base = i * (w0 + w1 + w2);
      const t = raw.charCodeAt(base) & 0xff;
      if (w1 > 0) {
        let f1 = 0;
        for (let b = 0; b < w1; b++) f1 = (f1 << 8) | (raw.charCodeAt(base + 1 + b) & 0xff);
        if (t === 1) map[off] = { offset: f1 };
        else if (t === 2) {
          let f2 = 0;
          for (let b = 0; b < w2; b++) f2 = (f2 << 8) | (raw.charCodeAt(base + 1 + w1 + b) & 0xff);
          map[off] = { stream: f1, index: f2 };
        }
      }
    }
  }
  return map;
}
function pdfExtractEmbedded(data, first, targetIndex) {
  let pos = first, idx = 0;
  const len = data.length;
  while (pos < len && idx <= targetIndex) {
    while (pos < len && /\s/.test(data[pos])) pos++;
    const lastStart = pos;
    while (pos < len && /\d/.test(data[pos])) pos++;
    while (pos < len && /\s/.test(data[pos])) pos++;
    let end;
    if (data[pos] === '<' && data[pos + 1] === '<') {
      let depth = 0;
      for (; pos < len; pos++) {
        if (data[pos] === '<' && data[pos + 1] === '<') depth++;
        else if (data[pos] === '>' && data[pos + 1] === '>') { depth--; pos++; if (depth === 0) break; }
      }
      end = pos + 1;
    } else if (data.substr(pos, 6) === 'stream') {
      const e = data.indexOf('endstream', pos);
      end = e >= 0 ? e + 9 : len;
      pos = end;
    } else {
      const m2 = /([\s<])/.exec(data.slice(pos));
      end = m2 ? pos + m2.index : len;
      pos = end;
    }
    if (idx === targetIndex) return data.slice(lastStart, end);
    idx++;
  }
  return null;
}
async function countDrivePdfPages(fileId) {
  if (!PDF_PAGES_PROXY) return 0;
  try {
    const res = await fetch(PDF_PAGES_PROXY + '?id=' + encodeURIComponent(fileId), { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return 0;
    const j = await res.json();
    const p = parseInt(j && j.pages, 10);
    return Number.isFinite(p) && p > 0 && p < 5000 ? p : 0;
  } catch { return 0; }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

async function exportDbJson() {
  try {
    const exportObj = await buildExportObj();
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'db.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    saveDbBackup('db.json', exportObj);
    renderDbBackupList();
    showToast(t('admin.exported'));
  } catch (err) {
    showToast('Erreur export: ' + err.message);
  }
}

/* ---- PAT Encryption (AES-GCM) ---- */
var GH_PAT_KEY_STORAGE = 'fp_gh_pat_key';

function getOrCreatePatKey() {
  var stored = localStorage.getItem(GH_PAT_KEY_STORAGE);
  if (stored) return stored;
  var arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  var key = btoa(String.fromCharCode.apply(null, arr));
  localStorage.setItem(GH_PAT_KEY_STORAGE, key);
  return key;
}

async function encryptPat(pat) {
  if (!pat) return null;
  try {
    var keyB64 = getOrCreatePatKey();
    var keyBytes = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0));
    var cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
    var iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    var encoded = new TextEncoder().encode(pat);
    var encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, cryptoKey, encoded);
    return { iv: btoa(String.fromCharCode.apply(null, iv)), data: btoa(String.fromCharCode.apply(null, new Uint8Array(encrypted))) };
  } catch(e) { console.error('PAT encrypt error:', e); return null; }
}

async function buildExportObj() {
  var ghCfg = getGithubConfig();
  return {
    meta: APP.db.meta,
    diplomas: APP.db.diplomas,
    specialties: APP.db.specialties,
    modules: APP.db.modules,
    documentTypes: APP.db.documentTypes,
    institutions: APP.db.institutions,
    wilayas: APP.db.wilayas,
    hosts: APP.db.hosts,
    documents: APP.db.documents,
    hidden: {
      docIds: getHiddenIds(),
      diplomaIds: getEntityHiddenIds('diplomas'),
      semesterIds: getEntityHiddenIds('semesters'),
      moduleIds: getEntityHiddenIds('modules'),
      specialtyIds: getEntityHiddenIds('specialties')
    },
    githubSync: {
      encryptedPAT: await encryptPat(ghCfg.pat),
      patKey: localStorage.getItem(GH_PAT_KEY_STORAGE) || '',
      repo: ghCfg.repo || '',
      branch: ghCfg.branch || 'main',
      path: ghCfg.path || 'repo/data/db.json',
      autoPush: getGithubAutoPush()
    }
  };
}

/* ---- Import & Backups ---- */
const DB_BACKUPS_KEY = 'fp_db_backups';
const MAX_BACKUPS = 5;

function computeDbStats(data) {
  const docs = data.documents || [];
  return { total: docs.length };
}

function getDbBackups() {
  try { return JSON.parse(localStorage.getItem(DB_BACKUPS_KEY)) || []; } catch { return []; }
}

function saveDbBackup(name, data) {
  const json = JSON.stringify(data);
  const sizeBytes = new Blob([json]).size;
  const sizeLabel = sizeBytes < 1024 ? sizeBytes + ' o' : sizeBytes < 1048576 ? (sizeBytes / 1024).toFixed(1) + ' Ko' : (sizeBytes / 1048576).toFixed(1) + ' Mo';
  const stats = computeDbStats(data);
  const backups = getDbBackups();
  backups.unshift({ id: Date.now(), name, timestamp: new Date().toISOString(), size: sizeLabel, stats, data });
  if (backups.length > MAX_BACKUPS) backups.length = MAX_BACKUPS;
  try { localStorage.setItem(DB_BACKUPS_KEY, JSON.stringify(backups)); } catch { showToast('Stockage local saturé'); }
}

function renderDbBackupList() {
  const el = document.getElementById('db-backup-list');
  if (!el) return;
  const backups = getDbBackups();
  if (!backups.length) {
    el.innerHTML = '<div style="padding:var(--space-3);font-size:var(--fs-xs);color:var(--ink-soft);text-align:center;">Aucune sauvegarde locale</div>';
    return;
  }
  el.innerHTML = '<div style="font-size:var(--fs-xs);font-weight:600;margin-bottom:var(--space-1);">Sauvegardes locales :</div>' +
    backups.map(b => {
      const s = b.stats || {};
      const info = (s.total ? '📄 ' + s.total + ' document(s)' : '') + (b.size ? ' 💾 ' + b.size : '');
      return '<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2);border:1px solid var(--kraft-line);border-radius:var(--radius-sm);margin-bottom:var(--space-1);">' +
        '<span style="flex:1;font-size:var(--fs-xs);"><strong>' + escapeHTML(b.name) + '</strong> ' + (b.size ? '<span style="color:var(--ink-soft);font-size:9px;">(' + escapeHTML(b.size) + ')</span>' : '') + '<br><span style="color:var(--ink-soft);font-size:10px;">' + new Date(b.timestamp).toLocaleString() + '</span>' + (info ? '<br><span style="font-size:9px;color:var(--ink-soft);">' + info + '</span>' : '') + '</span>' +
        '<button class="btn btn-primary btn-sm db-backup-restore-btn" data-backup-id="' + b.id + '">Restaurer</button>' +
        '<button class="btn btn-ghost btn-sm db-backup-del-btn" data-backup-id="' + b.id + '" title="Supprimer">✕</button></div>';
    }).join('');
  el.querySelectorAll('.db-backup-restore-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const backup = getDbBackups().find(b => b.id === parseInt(btn.dataset.backupId));
      if (!backup || !confirm('Restaurer la sauvegarde "' + (backup.name || 'db.json') + '" du ' + new Date(backup.timestamp).toLocaleString() + ' ?')) return;
      importDbData(backup.data);
    });
  });
  el.querySelectorAll('.db-backup-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const backups = getDbBackups().filter(b => b.id !== parseInt(btn.dataset.backupId));
      localStorage.setItem(DB_BACKUPS_KEY, JSON.stringify(backups));
      renderDbBackupList();
    });
  });
}

function importDbData(data) {
  try {
    if (!data || !data.meta || !data.documents) { showToast('Fichier invalide'); return; }
    localStorage.setItem('fp_custom_db', JSON.stringify(data));
    localStorage.removeItem('fp_local_docs');
    localStorage.removeItem('fp_deleted_ids');
    showToast('Base importée ! Rechargement…');
    setTimeout(() => location.reload(), 800);
  } catch (err) { showToast('Erreur: ' + err.message); }
}

/* ---- Auto-backup ---- */
let autoBackupTimer = null;
const AUTO_BACKUP_KEY = 'fp_auto_backup';
const AUTO_BACKUP_LAST_KEY = 'fp_auto_backup_last';

function getAutoBackupConfig() {
  try { const raw = localStorage.getItem(AUTO_BACKUP_KEY); return raw ? JSON.parse(raw) : { mode: 'off' }; } catch { return { mode: 'off' }; }
}
function setAutoBackupConfig(cfg) {
  try { localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(cfg)); } catch {}
}
function stopAutoBackup() { if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; } }
function getDbDataForBackup() {
  const custom = localStorage.getItem('fp_custom_db');
  if (custom) { try { return JSON.parse(custom); } catch {} }
  return { meta: APP.db?.meta || { version: 1 }, documents: APP.db?.documents || [], diplomas: APP.db?.diplomas || [], modules: APP.db?.modules || [], documentTypes: APP.db?.documentTypes || [] };
}
function shouldRunBackup(cfg) {
  const now = Date.now();
  let last = 0;
  try { last = parseInt(localStorage.getItem(AUTO_BACKUP_LAST_KEY)) || 0; } catch {}
  if (cfg.mode === 'interval') {
    const ms = parseInt(cfg.value) * (cfg.unit === 'minutes' ? 60000 : cfg.unit === 'hours' ? 3600000 : 86400000);
    if (isNaN(ms) || ms <= 0) return false;
    return (now - last) >= ms;
  }
  if (cfg.mode === 'fixed') {
    const d = new Date();
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate(), parseInt(cfg.hour) || 0, parseInt(cfg.minute) || 0);
    if (target <= new Date(last)) return false;
    return now >= target.getTime();
  }
  return false;
}
function performAutoBackup() {
  const cfg = getAutoBackupConfig();
  if (cfg.mode === 'off' || !shouldRunBackup(cfg)) return;
  try { localStorage.setItem(AUTO_BACKUP_LAST_KEY, String(Date.now())); } catch {}
  saveDbBackup('auto-' + new Date().toISOString().slice(0,10), getDbDataForBackup());
}
function startAutoBackup() {
  stopAutoBackup();
  const cfg = getAutoBackupConfig();
  if (cfg.mode === 'off') return;
  performAutoBackup();
  autoBackupTimer = setInterval(performAutoBackup, 30000);
}
function wireAutoBackupUI() {
  const cfg = getAutoBackupConfig();
  const modeRadios = document.querySelectorAll('input[name="auto-backup-mode"]');
  if (!modeRadios.length) return;
  modeRadios.forEach(r => r.checked = r.value === cfg.mode);
  document.querySelectorAll('input[name="auto-backup-mode"]').forEach(r => r.addEventListener('change', function() {
    const ig = document.getElementById('auto-backup-interval-group');
    const fg = document.getElementById('auto-backup-fixed-group');
    if (ig) ig.style.display = this.value === 'interval' ? 'flex' : 'none';
    if (fg) fg.style.display = this.value === 'fixed' ? 'flex' : 'none';
  }));
  const iv = document.getElementById('auto-backup-interval-val');
  if (iv) iv.value = cfg.value || 1;
  const iu = document.getElementById('auto-backup-interval-unit');
  if (iu) iu.value = cfg.unit || 'hours';
  const fh = document.getElementById('auto-backup-fixed-hour');
  if (fh) fh.value = ('0' + (cfg.hour || 8)).slice(-2) + ':' + ('0' + (cfg.minute || 0)).slice(-2);
  document.getElementById('auto-backup-save')?.addEventListener('click', () => {
    const mode = document.querySelector('input[name="auto-backup-mode"]:checked');
    if (!mode) return;
    const newCfg = { mode: mode.value };
    if (mode.value === 'interval') {
      newCfg.value = parseInt(document.getElementById('auto-backup-interval-val')?.value) || 1;
      newCfg.unit = document.getElementById('auto-backup-interval-unit')?.value || 'hours';
    } else if (mode.value === 'fixed') {
      const timeParts = (document.getElementById('auto-backup-fixed-hour')?.value || '08:00').split(':');
      newCfg.hour = parseInt(timeParts[0]) || 0;
      newCfg.minute = parseInt(timeParts[1]) || 0;
    }
    setAutoBackupConfig(newCfg);
    startAutoBackup();
    showToast(mode.value === 'off' ? 'Sauvegarde auto désactivée' : 'Sauvegarde auto activée');
  });
}
function wireImportBackupUI() {
  document.getElementById('import-db-btn')?.addEventListener('click', () => {
    const file = document.getElementById('import-db-file-input')?.files?.[0];
    if (!file) { showToast('Sélectionne un fichier db.json'); return; }
    const reader = new FileReader();
    reader.onload = e => { try { importDbData(JSON.parse(e.target.result)); } catch(err) { showToast('Erreur: ' + err.message); } };
    reader.readAsText(file);
  });
  document.getElementById('reset-db-btn')?.addEventListener('click', () => {
    if (!confirm('Réinitialiser la base ? Toute modification locale sera perdue.')) return;
    localStorage.removeItem('fp_custom_db');
    localStorage.removeItem('fp_local_docs');
    localStorage.removeItem('fp_deleted_ids');
    localStorage.removeItem('fp_hidden_doc_ids');
    localStorage.removeItem('fp_pending_docs');
    showToast('Base réinitialisée ! Rechargement…');
    setTimeout(() => location.reload(), 800);
  });
  renderDbBackupList();
}
