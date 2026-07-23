/* DOCUMENTS — cards, filtering, favorites, library page */

var FAV_KEY = 'fp_favorites';
var RECENT_KEY = 'fp_recent';
var HIDDEN_DOCS_KEY = 'fp_hidden_doc_ids';

function getHiddenIds() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_DOCS_KEY) || '[]'); } catch { return []; }
}
function saveHiddenIds(ids) {
  localStorage.setItem(HIDDEN_DOCS_KEY, JSON.stringify(ids));
}

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}
function saveFavorites(ids) {
  localStorage.setItem(FAV_KEY, JSON.stringify(ids));
}
function toggleFavorite(docId) {
  var favs = getFavorites();
  var idx = favs.indexOf(docId);
  if (idx >= 0) { favs.splice(idx, 1); } else { favs.push(docId); }
  saveFavorites(favs);
  return idx < 0;
}
function isFavorite(docId) {
  return getFavorites().indexOf(docId) >= 0;
}

function getRecentDocs() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecentDoc(docId) {
  var recent = getRecentDocs();
  var idx = recent.indexOf(docId);
  if (idx >= 0) recent.splice(idx, 1);
  recent.unshift(docId);
  if (recent.length > 20) recent = recent.slice(0, 20);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

/* ---- Document card HTML ---- */
function docCardHTML(doc) {
  var moduleName = APP.db.modules.find(function(m) { return m.id === doc.module; });
  var typeName = APP.db.documentTypes.find(function(ty) { return ty.id === doc.type; });
  var isFav = isFavorite(doc.id);

  return '' +
    '<article class="doc-card" data-doc-id="' + escapeAttr(doc.id) + '">' +
      '<span class="host-tag">' + escapeHTML(doc.host) + '</span>' +
      '<div class="doc-card-head">' +
        '<span class="doc-badge type-' + escapeAttr(doc.type) + '">' + escapeHTML(typeName ? localized(typeName.name) : doc.type) + '</span>' +
        '<span class="doc-year ltr-only">' + escapeHTML(doc.year || '') + '</span>' +
      '</div>' +
      '<div class="doc-card-body">' +
        '<h3 class="doc-title">' + escapeHTML(localized(doc.title)) + '</h3>' +
        '<div class="doc-meta-row">' +
          icon('fileText') + ' ' + escapeHTML('' + (doc.pages || '--')) + ' ' + (t('card.pages') || 'p.') +
          ' &middot; ' + icon('download') + ' <span class="ltr-only">' + escapeHTML((doc.downloads || 0).toLocaleString()) + '</span> ' + (t('card.downloads') || 'tél.') +
        '</div>' +
        '<div class="doc-meta-row">' +
          (moduleName ? '<span style="font-weight:700;">' + escapeHTML(localized(moduleName.name)) + '</span>' : '') +
          (doc.semester ? '<span> &middot; ' + escapeHTML(doc.semester) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="doc-card-foot">' +
        '<button class="btn btn-secondary doc-fav-btn" data-doc-id="' + escapeAttr(doc.id) + '" title="' + (isFav ? 'Retirer des favoris' : 'Ajouter aux favoris') + '" style="padding:var(--space-2);flex:0;color:' + (isFav ? 'var(--red-stamp)' : 'var(--ink-soft)') + ';">' + icon('heart') + '</button>' +
        '<button class="btn btn-secondary doc-preview-btn" data-doc-id="' + escapeAttr(doc.id) + '">' + icon('eye') + ' ' + (t('card.preview') || 'Aperçu') + '</button>' +
        '<a class="btn btn-primary" href="' + escapeAttr(doc.downloadUrl) + '" target="_blank" rel="noopener">' + icon('download') + ' ' + (t('card.download') || 'Télécharger') + '</a>' +
      '</div>' +
    '</article>';
}

function getDocBreadcrumb(doc) {
  if (!doc.diploma) return escapeHTML(t('hero.generalHeading') || '📚 Général');
  var dip = APP.db.diplomas.find(function(x) { return x.id === doc.diploma; });
  var dipName = dip ? localized(dip.name) : doc.diploma;
  var semObj = dip ? (dip.semesters || []).find(function(s) { return s.id === doc.semester; }) : null;
  var semName = semObj ? localized(semObj.name) : doc.semester;
  var mod = APP.db.modules.find(function(m) { return m.id === doc.module; });
  var modName = mod ? localized(mod.name) : doc.module;
  return escapeHTML(dipName) + (semName ? ' › ' + escapeHTML(semName) : '') + (modName ? ' › ' + escapeHTML(modName) : '');
}

function compactDocCardHTML(doc) {
  var typeName = APP.db.documentTypes.find(function(ty) { return ty.id === doc.type; });
  var isFav = isFavorite(doc.id);
  var mod = APP.db.modules.find(function(m) { return m.id === doc.module; });
  var modName = mod ? localized(mod.name) : doc.module;
  var dip = APP.db.diplomas.find(function(x) { return x.id === doc.diploma; });
  var semObj = dip ? (dip.semesters || []).find(function(s) { return s.id === doc.semester; }) : null;
  var semName = semObj ? localized(semObj.name) : doc.semester;
  var breadcrumb = getDocBreadcrumb(doc);

  return '' +
    '<article class="doc-card doc-card-compact" data-doc-id="' + escapeAttr(doc.id) + '">' +
      '<span class="host-tag">' + escapeHTML(doc.host) + '</span>' +
      '<div class="doc-card-body">' +
        '<div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;">' +
          '<span class="doc-badge type-' + escapeAttr(doc.type) + '">' + escapeHTML(typeName ? localized(typeName.name) : doc.type) + '</span>' +
          '<span class="doc-year ltr-only">' + escapeHTML(doc.year || '') + '</span>' +
        '</div>' +
        '<h3 class="doc-title" style="font-size:var(--fs-sm);">' + escapeHTML(localized(doc.title)) + '</h3>' +
        '<div style="font-size:var(--fs-xs);color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">📂 ' + breadcrumb + '</div>' +
        '<div class="doc-meta-row">' +
          (modName ? '<span style="font-weight:700;">' + icon('fileText') + ' ' + escapeHTML(modName) + '</span>' : '') +
          (semName ? '<span> · ' + escapeHTML(semName) + '</span>' : '') +
          ' <span>· ' + icon('download') + ' <span class="ltr-only">' + escapeHTML((doc.downloads || 0).toLocaleString()) + '</span></span>' +
        '</div>' +
      '</div>' +
      '<div class="doc-card-foot">' +
        '<button class="btn btn-secondary doc-fav-btn" data-doc-id="' + escapeAttr(doc.id) + '" title="' + (isFav ? 'Retirer des favoris' : 'Ajouter aux favoris') + '" style="padding:var(--space-2);flex:0;color:' + (isFav ? 'var(--red-stamp)' : 'var(--ink-soft)') + ';">' + icon('heart') + '</button>' +
        '<button class="btn btn-secondary doc-preview-btn" data-doc-id="' + escapeAttr(doc.id) + '">' + icon('eye') + ' ' + (t('card.preview') || 'Aperçu') + '</button>' +
        '<a class="btn btn-primary" href="' + escapeAttr(doc.downloadUrl) + '" target="_blank" rel="noopener">' + icon('download') + ' ' + (t('card.download') || 'Télécharger') + '</a>' +
      '</div>' +
    '</article>';
}

function emptyStateHTML() {
  return '' +
    '<div class="empty-state">' +
      icon('search') +
      '<h3>' + (t('empty.title') || 'Aucun résultat') + '</h3>' +
      '<p>' + (t('empty.subtitle') || 'Essaie de modifier tes filtres.') + '</p>' +
    '</div>';
}

/* ---- Filtering ---- */
function getFilteredDocs() {
  var f = APP.filters;
  var hiddenIds = new Set(getHiddenIds());
  var deletedIds = new Set(typeof getDeletedIds === 'function' ? getDeletedIds() : []);
  return APP.db.documents.filter(function(doc) {
    if (deletedIds.has(doc.id)) return false;
    if (hiddenIds.has(doc.id)) return false;
    if (f.diploma === '__none__' && doc.diploma) return false;
    if (f.diploma && f.diploma !== '__none__' && doc.diploma !== f.diploma) return false;
    if (f.semester && doc.semester !== f.semester) return false;
    if (f.module && doc.module !== f.module) return false;
    if (f.specialty) {
      var mod = APP.db.modules.find(function(m) { return m.id === doc.module; });
      if (!mod || mod.specialty !== f.specialty) return false;
    }
    if (f.type && doc.type !== f.type) return false;
    if (f.institution && doc.institution !== f.institution) return false;
    if (f.year && String(doc.year) !== String(f.year)) return false;
    if (f.search) {
      var q = f.search.trim().toLowerCase();
      var haystack = [localized(doc.title), doc.title.fr, doc.title.ar, doc.title.en, localized(doc.description)].join(' ').toLowerCase();
      if (haystack.indexOf(q) < 0) return false;
    }
    if (f.favoritesOnly && !isFavorite(doc.id)) return false;
    return true;
  });
}

function renderDocGrid(containerId, docs, cardFn) {
  var el = document.getElementById(containerId);
  if (!docs.length) {
    el.innerHTML = emptyStateHTML();
    return;
  }
  var fn = cardFn || docCardHTML;
  el.innerHTML = docs.map(fn).join('');
  el.querySelectorAll('.doc-preview-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      addRecentDoc(btn.dataset.docId);
      openDocModal(btn.dataset.docId);
    });
  });
  el.querySelectorAll('.doc-fav-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = btn.dataset.docId;
      var isNowFav = toggleFavorite(id);
      btn.title = isNowFav ? 'Retirer des favoris' : 'Ajouter aux favoris';
      btn.style.color = isNowFav ? 'var(--red-stamp)' : 'var(--ink-soft)';
    });
  });
  el.querySelectorAll('.doc-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('button') || e.target.closest('a')) return;
      addRecentDoc(card.dataset.docId);
      openDocModal(card.dataset.docId);
    });
  });
}

/* ---- Filter bar builder (for library.html) ---- */
function populateFilterBarFP() {
  var diplomaSel = document.getElementById('filter-diploma');
  var semesterSel = document.getElementById('filter-semester');
  var specialtySel = document.getElementById('filter-specialty');
  var moduleSel = document.getElementById('filter-module');
  var typeSel = document.getElementById('filter-type');
  var yearSel = document.getElementById('filter-year');

  if (diplomaSel) {
    diplomaSel.innerHTML = '<option value="">' + (t('filters.allDiplomas') || 'Tous les diplômes') + '</option>' +
      '<option value="__none__">' + (t('filters.noDiploma') || 'Sans diplôme') + '</option>' +
      APP.db.diplomas.map(function(d) { return '<option value="' + escapeAttr(d.id) + '">' + escapeHTML(localized(d.name)) + '</option>'; }).join('');
    diplomaSel.addEventListener('change', function() {
      var dip = APP.db.diplomas.find(function(d) { return d.id === diplomaSel.value; });
      if (semesterSel) {
        semesterSel.innerHTML = '<option value="">' + (t('filters.allSemesters') || 'Tous les semestres') + '</option>';
        if (dip && dip.semesters) {
          semesterSel.innerHTML += dip.semesters.map(function(s) {
            return '<option value="' + escapeAttr(s.id) + '">' + escapeHTML(localized(s.name)) + '</option>';
          }).join('');
        }
      }
      APP.filters.diploma = diplomaSel.value;
      if (typeof onFilterChange === 'function') onFilterChange();
    });
  }

  if (semesterSel) {
    semesterSel.addEventListener('change', function() {
      APP.filters.semester = semesterSel.value;
      if (typeof onFilterChange === 'function') onFilterChange();
    });
  }

  if (specialtySel) {
    specialtySel.innerHTML = '<option value="">' + (t('filters.allSpecialties') || 'Toutes les spécialités') + '</option>' +
      APP.db.specialties.map(function(s) { return '<option value="' + escapeAttr(s.id) + '">' + escapeHTML(localized(s.name)) + '</option>'; }).join('');
    specialtySel.addEventListener('change', function() {
      var spec = specialtySel.value;
      if (moduleSel) {
        moduleSel.innerHTML = '<option value="">' + (t('filters.allModules') || 'Tous les modules') + '</option>';
        APP.db.modules.filter(function(m) { return !spec || m.specialty === spec; }).forEach(function(m) {
          moduleSel.innerHTML += '<option value="' + escapeAttr(m.id) + '">' + escapeHTML(localized(m.name)) + '</option>';
        });
      }
      APP.filters.specialty = spec;
      if (typeof onFilterChange === 'function') onFilterChange();
    });
  }

  if (moduleSel) {
    moduleSel.addEventListener('change', function() {
      APP.filters.module = moduleSel.value;
      if (typeof onFilterChange === 'function') onFilterChange();
    });
  }

  if (typeSel) {
    typeSel.innerHTML = '<option value="">' + (t('filters.allTypes') || 'Tous les types') + '</option>' +
      APP.db.documentTypes.map(function(ty) { return '<option value="' + escapeAttr(ty.id) + '">' + escapeHTML(localized(ty.name)) + '</option>'; }).join('');
    typeSel.addEventListener('change', function() {
      APP.filters.type = typeSel.value;
      if (typeof onFilterChange === 'function') onFilterChange();
    });
  }

  if (yearSel) {
    var yearsSet = {};
    APP.db.documents.forEach(function(d) { if (d.year) yearsSet[d.year] = true; });
    var years = Object.keys(yearsSet).sort(function(a, b) { return b - a; });
    yearSel.innerHTML = '<option value="">' + (t('filters.allYears') || 'Toutes les années') + '</option>' +
      years.map(function(y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
    yearSel.addEventListener('change', function() {
      APP.filters.year = yearSel.value;
      if (typeof onFilterChange === 'function') onFilterChange();
    });
  }

  var searchInput = document.getElementById('filter-search');
  if (searchInput) {
    searchInput.value = APP.filters.search || '';
    searchInput.addEventListener('input', debounce(function() {
      APP.filters.search = searchInput.value;
      if (typeof onFilterChange === 'function') onFilterChange();
    }, 250));
  }

  var resetBtn = document.getElementById('filter-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      APP.filters = { diploma: '', semester: '', specialty: '', module: '', type: '', year: '', institution: '', search: '', favoritesOnly: false };
      populateFilterBarFP();
      if (typeof onFilterChange === 'function') onFilterChange();
    });
  }
}

/* ---- Library page init ---- */
function initLibraryPage() {
  if (!APP.db) return;
  function renderGrouped() {
    var el = document.getElementById('documents-container');
    if (!el) return;
    var allDocs = getFilteredDocs();
    if (!allDocs.length) { el.innerHTML = emptyStateHTML(); return; }
    var hiddenDocIds = new Set((function() { try { return JSON.parse(localStorage.getItem('fp_hidden_doc_ids') || '[]'); } catch { return []; } })());
    var hiddenDipIds = new Set((function() { try { return JSON.parse(localStorage.getItem('fp_hidden_diploma_ids') || '[]'); } catch { return []; } })());
    var html = '';
    APP.db.diplomas.forEach(function(dip) {
      if (hiddenDipIds.has(dip.id)) return;
      var dipDocs = allDocs.filter(function(d) { return d.diploma === dip.id; });
      if (!dipDocs.length) return;
      html += '<div class="library-group">' +
        '<div class="library-group-header">' +
          '<h3>' + escapeHTML(localized(dip.name)) + '</h3>' +
          '<span class="library-group-count">' + dipDocs.length + ' ' + (t('filters.results') || 'doc.') + '</span>' +
        '</div>' +
        '<div class="doc-grid">' + dipDocs.map(compactDocCardHTML).join('') + '</div>' +
      '</div>';
    });
    // General docs (no diploma)
    var generalDocs = allDocs.filter(function(d) { return !d.diploma; });
    if (generalDocs.length) {
      html += '<div class="library-group">' +
        '<div class="library-group-header">' +
          '<h3>' + (t('hero.generalHeading') || '📚 Général') + '</h3>' +
          '<span class="library-group-count">' + generalDocs.length + ' ' + (t('filters.results') || 'doc.') + '</span>' +
        '</div>' +
        '<div class="doc-grid">' + generalDocs.map(compactDocCardHTML).join('') + '</div>' +
      '</div>';
    }
    if (!html) { el.innerHTML = emptyStateHTML(); return; }
    el.innerHTML = html;
    el.querySelectorAll('.doc-preview-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { addRecentDoc(btn.dataset.docId); openDocModal(btn.dataset.docId); });
    });
    el.querySelectorAll('.doc-fav-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) { e.stopPropagation(); var id = btn.dataset.docId; var isNowFav = toggleFavorite(id); btn.style.color = isNowFav ? 'var(--red-stamp)' : 'var(--ink-soft)'; });
    });
    el.querySelectorAll('.doc-card').forEach(function(card) {
      card.addEventListener('click', function(e) { if (e.target.closest('button') || e.target.closest('a')) return; addRecentDoc(card.dataset.docId); openDocModal(card.dataset.docId); });
    });
  }
  window.onFilterChange = renderGrouped;
  populateFilterBarFP();
  renderGrouped();
}
