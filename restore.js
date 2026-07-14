const fs = require('fs');
const path = require('path');

const dir = 'E:/Docs_Win10_JUIN_2025/0_JUIN_2026/openclaude/29062026/11072026/fp-smart-v2-blogger';
const xmlPath = path.join(dir, 'fp-smart-blogger-theme.xml');

let xml = fs.readFileSync(xmlPath, 'utf8');

// Step 1: Replace inline doc-manager with CDN tag
const startMarker = '<script>//<![CDATA[var LOCAL_DOCS_KEY';
const startIdx = xml.indexOf(startMarker);
if (startIdx === -1) { console.error('Start not found'); process.exit(1); }

const cdEnd = xml.indexOf('//]]></script>', startIdx);
if (cdEnd === -1) { console.error('End not found'); process.exit(1); }
const afterEnd = cdEnd + '//]]></script>'.length;

const cdnTag = '<script src="https://cdn.jsdelivr.net/gh/droidapk1002-beep/fp-smart-assets@main/repo/js/doc-manager.js"></script>';

xml = xml.substring(0, startIdx) + cdnTag + xml.substring(afterEnd);

// Step 2: Now add back the missing homeRender/router script block before </body>
// The content that was lost was everything between the doc-manager script close and </body>
const bodyIdx = xml.indexOf('</body>');
const routerBlock = `
<script>
//<![CDATA[
function homeRender() {
  document.title = t('siteName') + ' — ' + t('tagline');

  const hiddenDocIds = new Set((function() { try { return JSON.parse(localStorage.getItem('fp_hidden_doc_ids') || '[]'); } catch { return []; } })());
  const hiddenDipIds = new Set((function() { try { return JSON.parse(localStorage.getItem('fp_hidden_diploma_ids') || '[]'); } catch { return []; } })());
  const hiddenSemIds = new Set((function() { try { return JSON.parse(localStorage.getItem('fp_hidden_semester_ids') || '[]'); } catch { return []; } })());
  const hiddenModIds = new Set((function() { try { return JSON.parse(localStorage.getItem('fp_hidden_module_ids') || '[]'); } catch { return []; } })());
  const hiddenSpecIds = new Set((function() { try { return JSON.parse(localStorage.getItem('fp_hidden_specialty_ids') || '[]'); } catch { return []; } })());

  const visibleDocs = APP.db.documents.filter(function(d) { return !hiddenDocIds.has(d.id); });
  document.getElementById('stat-docs').textContent = visibleDocs.length + '+';
  document.getElementById('stat-modules').textContent = APP.db.modules.length;
  document.getElementById('stat-diplotmes').textContent = APP.db.diplomas.length;

  document.getElementById('hero-stamp').textContent = '\\ud83c\\udde9\\ud83c\\udff3 ' + t('siteName');

  var cascadeData = { diploma: null, specialty: null, semester: null, module: null };
  var diplomasGrid = document.getElementById('diplomas-grid');
  diplomasGrid.innerHTML = APP.db.diplomas.filter(function(d) { return !hiddenDipIds.has(d.id); }).map(function(dip) {
    var count = APP.db.documents.filter(function(d) { return d.diploma === dip.id && !hiddenDocIds.has(d.id); }).length;
    return '<div class="quick-tile cascade-diploma-tile" data-diploma="' + escapeAttr(dip.id) + '" style="cursor:pointer;">' +
      '<div class="quick-tile-icon">' + icon('book') + '</div>' +
      '<div>' +
        '<div class="quick-tile-name">' + escapeHTML(localized(dip.name)) + '</div>' +
        '<div class="quick-tile-count">' + count + ' ' + (t('filters.results') || 'resultat(s)') + '</div>' +
      '</div></div>';
  }).join('');

  function renderCascadePanel() {
    var panel = document.getElementById('cascade-panel');
    if (!cascadeData.diploma) { panel.style.display = 'none'; return; }
    var dip = APP.db.diplomas.find(function(d) { return d.id === cascadeData.diploma; });
    if (!dip) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';

    var hiddenDocIds = new Set(getHiddenIds());
    var dipName = escapeHTML(localized(dip.name));
    var html = '';
    var backBtn = '<button class="btn btn-ghost btn-sm cascade-back" style="margin-bottom:var(--space-2);">&larr; ' + (t('card.viewDetails') || 'Retour') + '</button>';

    if (!cascadeData.specialty) {
      var specIds = [];
      APP.db.documents.forEach(function(d) {
        if (d.diploma === cascadeData.diploma && d.specialty && !hiddenDocIds.has(d.id) && specIds.indexOf(d.specialty) < 0) {
          specIds.push(d.specialty);
        }
      });
      var specialties = APP.db.specialties.filter(function(s) { return !hiddenSpecIds.has(s.id) && specIds.indexOf(s.id) >= 0; });
      if (specialties.length === 0) { cascadeData.specialty = ''; renderCascadePanel(); return; }
      html = '<div class="cascade-level">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-3);">' +
          '<h3 style="font-size:var(--fs-lg);margin:0;">' + dipName + ' — ' + (t('allSpecialties') || 'Specialites') + '</h3>' +
        '</div>' +
        '<div class="quick-grid">';
      specialties.forEach(function(s) {
        var cnt = APP.db.documents.filter(function(d) { return d.diploma === cascadeData.diploma && d.specialty === s.id && !hiddenDocIds.has(d.id); }).length;
        html += '<div class="quick-tile cascade-specialty-tile" data-specialty="' + escapeAttr(s.id) + '" style="cursor:pointer;">' +
          '<div class="quick-tile-icon">' + icon(s.icon || 'map') + '</div>' +
          '<div>' +
            '<div class="quick-tile-name">' + escapeHTML(localized(s.name)) + '</div>' +
            '<div class="quick-tile-count">' + cnt + ' ' + (t('filters.results') || 'doc.') + '</div>' +
          '</div></div>';
      });
      html += '</div></div>';
    } else if (!cascadeData.semester) {
      var specObj = cascadeData.specialty ? APP.db.specialties.find(function(s) { return s.id === cascadeData.specialty; }) : null;
      var specName = escapeHTML(specObj ? localized(specObj.name) : cascadeData.specialty);
      var semesters = (dip.semesters || []).filter(function(s) { return !hiddenSemIds.has(s.id); });
      html = '<div class="cascade-level">' + backBtn +
        '<h3 style="font-size:var(--fs-lg);margin-bottom:var(--space-3);">' + dipName + (specName ? ' &rsaquo; ' + specName : '') + ' — ' + (t('filters.semester') || 'Semestres') + '</h3>' +
        '<div class="quick-grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));">';
      semesters.forEach(function(s) {
        var docCount = cascadeData.specialty
          ? APP.db.documents.filter(function(d) { return d.diploma === cascadeData.diploma && d.specialty === cascadeData.specialty && d.semester === s.id && !hiddenDocIds.has(d.id); }).length
          : APP.db.documents.filter(function(d) { return d.diploma === cascadeData.diploma && d.semester === s.id && !hiddenDocIds.has(d.id); }).length;
        if (docCount > 0) {
          html += '<div class="quick-tile cascade-semester-tile" data-semester="' + escapeAttr(s.id) + '" style="cursor:pointer;text-align:center;">' +
            '<div class="quick-tile-icon">' + icon('calendar') + '</div>' +
            '<div>' +
              '<div class="quick-tile-name">' + escapeHTML(localized(s.name)) + '</div>' +
              '<div class="quick-tile-count">' + docCount + ' ' + (t('filters.results') || 'doc.') + '</div>' +
            '</div></div>';
        }
      });
      html += '</div></div>';
    } else if (!cascadeData.module) {
      var specObj = cascadeData.specialty ? APP.db.specialties.find(function(s) { return s.id === cascadeData.specialty; }) : null;
      var specName = escapeHTML(specObj ? localized(specObj.name) : cascadeData.specialty);
      var semObj = (dip.semesters || []).find(function(s) { return s.id === cascadeData.semester; });
      var semName = escapeHTML(semObj ? localized(semObj.name) : cascadeData.semester);
      var docModules = {};
      APP.db.documents.forEach(function(d) {
        var match = d.semester === cascadeData.semester && d.diploma === cascadeData.diploma && !hiddenDocIds.has(d.id);
        if (cascadeData.specialty) match = match && d.specialty === cascadeData.specialty;
        if (match) { if (d.module) docModules[d.module] = (docModules[d.module] || 0) + 1; }
      });
      var relevantModIds = Object.keys(docModules);
      APP.db.modules.forEach(function(m) {
        var matches = !hiddenModIds.has(m.id) && m.semesters && m.semesters.indexOf(cascadeData.semester) >= 0 && relevantModIds.indexOf(m.id) < 0;
        if (cascadeData.specialty) matches = matches && m.specialty === cascadeData.specialty;
        if (matches) relevantModIds.push(m.id);
      });
      var relevantMods = APP.db.modules.filter(function(m) { return !hiddenModIds.has(m.id) && relevantModIds.indexOf(m.id) >= 0; });
      html = '<div class="cascade-level">' + backBtn +
        '<h3 style="font-size:var(--fs-lg);margin-bottom:var(--space-3);">' + dipName + (specName ? ' &rsaquo; ' + specName : '') + ' &rsaquo; ' + semName + '</h3>';
      if (relevantMods.length) {
        html += '<div class="quick-grid">';
        relevantMods.forEach(function(m) {
          var cnt = docModules[m.id] || 0;
          html += '<div class="quick-tile cascade-module-tile" data-module="' + escapeAttr(m.id) + '" style="cursor:pointer;">' +
            '<div class="quick-tile-icon">' + icon('fileText') + '</div>' +
            '<div>' +
              '<div class="quick-tile-name">' + escapeHTML(localized(m.name)) + '</div>' +
              '<div class="quick-tile-count">' + cnt + ' ' + (t('filters.results') || 'doc.') + '</div>' +
            '</div></div>';
        });
        html += '</div>';
      } else {
        html += '<p style="color:var(--ink-soft);">' + (t('empty.title') || 'Aucun module') + '</p>';
      }
      html += '</div>';
    } else {
      var specObj = cascadeData.specialty ? APP.db.specialties.find(function(s) { return s.id === cascadeData.specialty; }) : null;
      var specName = escapeHTML(specObj ? localized(specObj.name) : cascadeData.specialty);
      var semObj = (dip.semesters || []).find(function(s) { return s.id === cascadeData.semester; });
      var semName = escapeHTML(semObj ? localized(semObj.name) : cascadeData.semester);
      var modObj = APP.db.modules.find(function(m) { return m.id === cascadeData.module; });
      var modName = escapeHTML(modObj ? localized(modObj.name) : cascadeData.module);
      var docs = APP.db.documents.filter(function(d) {
        return d.module === cascadeData.module && d.semester === cascadeData.semester && !hiddenDocIds.has(d.id);
      });
      html = '<div class="cascade-level">' + backBtn +
        '<h3 style="font-size:var(--fs-lg);margin-bottom:var(--space-3);">' + dipName + (specName ? ' &rsaquo; ' + specName : '') + ' &rsaquo; ' + semName + ' &rsaquo; ' + modName + '</h3>';
      if (docs.length) {
        html += '<div class="doc-grid">' + docs.map(compactDocCardHTML).join('') + '</div>';
      } else {
        html += '<p style="color:var(--ink-soft);">' + (t('admin.docsEmpty') || 'Aucun document trouve pour ce module.') + '</p>';
      }
      html += '</div>';
    }
    panel.innerHTML = html;
    wireCascadeEvents();
  }

  function wireCascadeEvents() {
    var panel = document.getElementById('cascade-panel');
    panel.querySelectorAll('.cascade-specialty-tile').forEach(function(tile) {
      tile.addEventListener('click', function() {
        cascadeData.specialty = tile.dataset.specialty;
        cascadeData.semester = null;
        cascadeData.module = null;
        renderCascadePanel();
      });
    });
    panel.querySelectorAll('.cascade-semester-tile').forEach(function(tile) {
      tile.addEventListener('click', function() {
        cascadeData.semester = tile.dataset.semester;
        cascadeData.module = null;
        renderCascadePanel();
      });
    });
    panel.querySelectorAll('.cascade-module-tile').forEach(function(tile) {
      tile.addEventListener('click', function() {
        cascadeData.module = tile.dataset.module;
        renderCascadePanel();
      });
    });
    panel.querySelectorAll('.cascade-back').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (cascadeData.module) { cascadeData.module = null; renderCascadePanel(); return; }
        if (cascadeData.semester) { cascadeData.semester = null; renderCascadePanel(); return; }
        if (cascadeData.specialty) { cascadeData.specialty = null; renderCascadePanel(); return; }
        cascadeData.diploma = null;
        renderCascadePanel();
      });
    });
    panel.querySelectorAll('.doc-preview-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { addRecentDoc(btn.dataset.docId); openDocModal(btn.dataset.docId); });
    });
    panel.querySelectorAll('.doc-fav-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) { e.stopPropagation(); var id = btn.dataset.docId; var isNowFav = toggleFavorite(id); btn.style.color = isNowFav ? 'var(--red-stamp)' : 'var(--ink-soft)'; });
    });
    panel.querySelectorAll('.doc-card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('button') || e.target.closest('a')) return;
        addRecentDoc(card.dataset.docId);
        openDocModal(card.dataset.docId);
      });
    });
  }

  diplomasGrid.querySelectorAll('.cascade-diploma-tile').forEach(function(tile) {
    tile.addEventListener('click', function() {
      var dipId = tile.dataset.diploma;
      if (cascadeData.diploma === dipId) {
        cascadeData.diploma = null; cascadeData.specialty = null; cascadeData.semester = null; cascadeData.module = null;
        renderCascadePanel();
      } else {
        cascadeData.diploma = dipId; cascadeData.specialty = null; cascadeData.semester = null; cascadeData.module = null;
        renderCascadePanel();
      }
    });
  });

  var specialtiesGrid = document.getElementById('specialties-grid');
  if (specialtiesGrid) {
    specialtiesGrid.innerHTML = APP.db.specialties.filter(function(s) { return !hiddenSpecIds.has(s.id); }).map(function(spec) {
      var count = APP.db.documents.filter(function(d) { return d.specialty === spec.id && !hiddenDocIds.has(d.id); }).length;
      return '<a class="quick-tile" href="library.html?specialty=' + escapeAttr(spec.id) + '">' +
        '<div class="quick-tile-icon">' + icon(spec.icon || 'map') + '</div>' +
        '<div>' +
          '<div class="quick-tile-name">' + escapeHTML(localized(spec.name)) + '</div>' +
          '<div class="quick-tile-count">' + count + ' ' + (t('filters.results') || 'doc.') + '</div>' +
        '</div></a>';
    }).join('');
  }

  var semCatGrid = document.getElementById('semesters-cat-grid');
  semCatGrid.innerHTML = '';
  var semNameOrder = [];
  var semNameSeen = {};
  var semNameDiplomas = {};
  APP.db.diplomas.forEach(function(dip) {
    if (hiddenDipIds.has(dip.id)) return;
    (dip.semesters || []).forEach(function(s) {
      var sName = localized(s.name);
      if (!semNameSeen[sName]) { semNameSeen[sName] = true; semNameOrder.push(sName); }
      if (!semNameDiplomas[sName]) semNameDiplomas[sName] = {};
      semNameDiplomas[sName][dip.id] = (semNameDiplomas[sName][dip.id] || 0);
    });
  });
  APP.db.documents.forEach(function(d) {
    if (hiddenDocIds.has(d.id) || !d.semester || !d.diploma) return;
    for (var i = 0; i < APP.db.diplomas.length; i++) {
      var found = (APP.db.diplomas[i].semesters || []).find(function(s) { return String(s.id) === String(d.semester); });
      if (found) {
        var sName = localized(found.name);
        if (semNameDiplomas[sName] && semNameDiplomas[sName][d.diploma] !== undefined) { semNameDiplomas[sName][d.diploma]++; }
        break;
      }
    }
  });
  semNameOrder.forEach(function(semName) {
    var totalCount = 0;
    var dipCount = 0;
    Object.keys(semNameDiplomas[semName]).forEach(function(dipId) {
      if (!hiddenDipIds.has(dipId)) { totalCount += semNameDiplomas[semName][dipId]; dipCount++; }
    });
    var isEmpty = totalCount === 0;
    semCatGrid.innerHTML += '<div class="level-category' + (isEmpty ? ' cat-empty' : '') + '">' +
      '<a class="quick-tile' + (isEmpty ? ' tile-empty' : '') + '" href="javascript:void(0)" ' + (isEmpty ? '' : 'onclick="toggleSemCategoryByName(\'' + semName.replace(/'/g, "\\\\'") + '\')"') + ' data-sem-name="' + semName.replace(/'/g, "&#39;") + '">' +
        '<div class="quick-tile-icon">' + icon('calendar') + '</div>' +
        '<div>' +
          '<div class="quick-tile-name">' + escapeHTML(semName) + '</div>' +
          '<div class="quick-tile-count">' + (isEmpty ? t('admin.docsEmpty') || 'Aucun document' : totalCount + ' ' + (t('filters.results') || 'doc.') + ' — ' + dipCount + ' ' + (t('filters.diploma') || 'diplome(s)')) + '</div>' +
        '</div>' +
        (isEmpty ? '' : '<span class="expand-icon">' + icon('chevronDown') + '</span>') +
      '</a>' +
      '<div class="level-subgrid" id="sem-name-grid-' + semName.replace(/\\s+/g, '-') + '" style="display:none;"></div>' +
    '</div>';
  });

  var modulesGrid = document.getElementById('modules-grid');
  modulesGrid.innerHTML = APP.db.modules.filter(function(m) { return !hiddenModIds.has(m.id); }).map(function(mod) {
    var count = APP.db.documents.filter(function(d) { return d.module === mod.id && !hiddenDocIds.has(d.id); }).length;
    return '<a class="quick-tile" href="library.html?module=' + escapeAttr(mod.id) + '">' +
      '<div class="quick-tile-icon">' + icon('fileText') + '</div>' +
      '<div>' +
        '<div class="quick-tile-name">' + escapeHTML(localized(mod.name)) + '</div>' +
        '<div class="quick-tile-count">' + count + ' ' + (t('filters.results') || 'doc.') + '</div>' +
      '</div></a>';
  }).join('');

  ;(function() {
    var recentIds = getRecentDocs();
    var recentDocs = [];
    recentIds.forEach(function(id) {
      var d = APP.db.documents.find(function(x) { return x.id === id; });
      if (d && !hiddenDocIds.has(d.id)) recentDocs.push(d);
    });
    if (recentDocs.length) {
      var recentGrid = document.getElementById('recent-grid');
      recentGrid.innerHTML = recentDocs.slice(0, 6).map(compactDocCardHTML).join('');
    }
  })();

  var featuredGrid = document.getElementById('featured-grid');
  if (featuredGrid) {
    var featured = APP.db.documents
      .filter(function(d) { return !hiddenDocIds.has(d.id); })
      .sort(function(a, b) { return b.downloads - a.downloads; })
      .slice(0, 6);
    renderDocGrid('featured-grid', featured);
  }

  var generalGrid = document.getElementById('general-grid');
  if (generalGrid) {
    var generalDocs = APP.db.documents.filter(function(d) { return !hiddenDocIds.has(d.id) && !d.diploma; });
    if (generalDocs.length) {
      generalGrid.innerHTML = generalDocs.slice(0, 6).map(compactDocCardHTML).join('');
      generalGrid.querySelectorAll('.doc-preview-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) { e.stopPropagation(); addRecentDoc(btn.dataset.docId); openDocModal(btn.dataset.docId); });
      });
      generalGrid.querySelectorAll('.doc-fav-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) { e.stopPropagation(); var id = btn.dataset.docId; var isNowFav = toggleFavorite(id); btn.style.color = isNowFav ? 'var(--red-stamp)' : 'var(--ink-soft)'; });
      });
      generalGrid.querySelectorAll('.doc-card').forEach(function(card) {
        card.addEventListener('click', function(e) { if (e.target.closest('button') || e.target.closest('a')) return; addRecentDoc(card.dataset.docId); openDocModal(card.dataset.docId); });
      });
    }
  }

  document.getElementById('hero-search-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var q = document.getElementById('hero-search-input').value.trim();
    window.location.hash = 'library' + (q ? '?q=' + encodeURIComponent(q) : '');
  });
}

function toggleSemCategoryByName(semName) {
  var gridId = 'sem-name-grid-' + semName.replace(/\\s+/g, '-');
  var subgrid = document.getElementById(gridId);
  if (!subgrid) return;
  var isHidden = subgrid.style.display === 'none' || !subgrid.style.display;
  if (isHidden) {
    var hiddenDocIds = new Set((function() { try { return JSON.parse(localStorage.getItem('fp_hidden_doc_ids') || '[]'); } catch { return []; } })());
    var hiddenDipIds = new Set((function() { try { return JSON.parse(localStorage.getItem('fp_hidden_diploma_ids') || '[]'); } catch { return []; } })());
    function semIdsForName(name) {
      var ids = [];
      APP.db.diplomas.forEach(function(dip) {
        (dip.semesters || []).forEach(function(s) {
          if (localized(s.name) === name && ids.indexOf(s.id) < 0) ids.push(s.id);
        });
      });
      return ids;
    }
    var matchingSemIds = semIdsForName(semName);
    var dipDocs = {};
    APP.db.documents.forEach(function(d) {
      if (!hiddenDocIds.has(d.id) && d.diploma && matchingSemIds.indexOf(d.semester) >= 0) {
        dipDocs[d.diploma] = (dipDocs[d.diploma] || 0) + 1;
      }
    });
    subgrid.style.display = 'grid';
    var html = '';
    Object.keys(dipDocs).forEach(function(dipId) {
      if (hiddenDipIds.has(dipId)) return;
      var dip = APP.db.diplomas.find(function(d) { return d.id === dipId; });
      if (!dip) return;
      html += '<div class="level-category">' +
        '<a class="quick-tile" href="javascript:void(0)" onclick="toggleSemDipCategoryByName(\'' + semName.replace(/'/g, "\\\\'") + '\',\'' + dipId + '\')" data-sem-dip="' + semName.replace(/\\s+/g, '-') + '-' + dipId + '">' +
          '<div class="quick-tile-icon">' + icon('book') + '</div>' +
          '<div>' +
            '<div class="quick-tile-name">' + escapeHTML(localized(dip.name)) + '</div>' +
            '<div class="quick-tile-count">' + dipDocs[dipId] + ' ' + (t('filters.results') || 'doc.') + '</div>' +
          '</div>' +
          '<span class="expand-icon">' + icon('chevronDown') + '</span>' +
        '</a>' +
        '<div class="level-subgrid" id="sem-dip-docs-' + semName.replace(/\\s+/g, '-') + '-' + dipId + '" style="display:none;"></div>' +
      '</div>';
    });
    subgrid.innerHTML = html;
  } else {
    subgrid.style.display = 'none';
  }
  var tile = document.querySelector('[data-sem-name="' + semName.replace(/'/g, "&#39;") + '"]');
  if (tile) tile.classList.toggle('expanded', isHidden);
}

function toggleSemDipCategoryByName(semName, dipId) {
  var subgrid = document.getElementById('sem-dip-docs-' + semName.replace(/\\s+/g, '-') + '-' + dipId);
  if (!subgrid) return;
  var isHidden = subgrid.style.display === 'none' || !subgrid.style.display;
  if (isHidden) {
    var hiddenDocIds = new Set((function() { try { return JSON.parse(localStorage.getItem('fp_hidden_doc_ids') || '[]'); } catch { return []; } })());
    function semIdsForName(name) {
      var ids = [];
      APP.db.diplomas.forEach(function(dip) {
        (dip.semesters || []).forEach(function(s) {
          if (localized(s.name) === name && ids.indexOf(s.id) < 0) ids.push(s.id);
        });
      });
      return ids;
    }
    var matchingSemIds = semIdsForName(semName);
    var docs = APP.db.documents.filter(function(d) {
      return matchingSemIds.indexOf(d.semester) >= 0 && String(d.diploma) === dipId && !hiddenDocIds.has(d.id);
    });
    subgrid.style.display = 'grid';
    subgrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(260px, 1fr))';
    subgrid.innerHTML = docs.length ? docs.map(compactDocCardHTML).join('') : '<p style="grid-column:1/-1;color:var(--ink-soft);padding:var(--space-3);">' + (t('admin.docsEmpty') || 'Aucun document') + '</p>';
    subgrid.querySelectorAll('.doc-preview-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) { e.stopPropagation(); addRecentDoc(btn.dataset.docId); openDocModal(btn.dataset.docId); });
    });
    subgrid.querySelectorAll('.doc-fav-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) { e.stopPropagation(); var id = btn.dataset.docId; var isNowFav = toggleFavorite(id); btn.style.color = isNowFav ? 'var(--red-stamp)' : 'var(--ink-soft)'; });
    });
    subgrid.querySelectorAll('.doc-card').forEach(function(card) {
      card.addEventListener('click', function(e) { if (e.target.closest('button') || e.target.closest('a')) return; addRecentDoc(card.dataset.docId); openDocModal(card.dataset.docId); });
    });
  } else {
    subgrid.style.display = 'none';
  }
  var tile = document.querySelector('[data-sem-dip="' + semName.replace(/\\s+/g, '-') + '-' + dipId + '"]');
  if (tile) tile.classList.toggle('expanded', isHidden);
}

function fpCurrentView() {
  var h = (window.location.hash || '').replace(/^#\\/?/, '').split(/[/?]/)[0];
  if (h === 'library' || h === 'assistant' || h === 'admin') return h;
  return 'home';
}

function fpRoute() {
  var view = fpCurrentView();
  ['home', 'library', 'assistant', 'admin'].forEach(function (v) {
    var el = document.getElementById('fp-view-' + v);
    if (el) el.style.display = (v === view) ? '' : 'none';
  });

  document.title = (view === 'assistant' ? t('assistant.title') + ' — ' : '') + t('siteName') + (view === 'home' ? ' — ' + t('tagline') : '');
  document.getElementById('header-root').innerHTML = renderHeader(view);
  document.getElementById('footer-root').innerHTML = renderFooter();
  translateStaticDOM();
  wireLayoutEvents();
  var themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.innerHTML = icon(APP.theme === 'light' ? 'moon' : 'sun');
  window.scrollTo(0, 0);

  try {
    if (view === 'home') homeRender();
    else if (view === 'library') initLibraryPage();
    else if (view === 'assistant') initAssistant();
    else if (view === 'admin') initAdminPanel();
  } catch (e) {
    console.error('[fpRoute:' + view + ']', e);
  }
}

async function fpBoot() {
  try {
    await loadData();
    applyLocalDocOverrides();
    applyStructuralOverrides();
    applyLangToDocument();
    document.getElementById('modal-root').innerHTML = renderDocModal();
    window.addEventListener('hashchange', fpRoute);
    fpRoute();
  } catch (e) {
    console.error('[fpBoot]', e);
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ef4444;color:#fff;padding:8px;z-index:9999;font-size:14px;';
    d.textContent = 'Erreur de demarrage FP-SMART : ' + e.message;
    document.body.prepend(d);
  }
}

function onLangChange() { fpRoute(); }

fpBoot();

//]]>
</script>
`;

// Insert before </body>
xml = xml.substring(0, bodyIdx) + routerBlock + xml.substring(bodyIdx);

fs.writeFileSync(xmlPath, xml, 'utf8');
console.log('Done. New XML length:', xml.length);
console.log('Lines:', xml.split('\n').length);
