/* LAYOUT — header, footer, modal, drawer */

function escapeHTML(str) {
  var m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return String(str).replace(/[&<>"']/g, function(c) { return m[c]; });
}

function escapeAttr(str) {
  var m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return String(str).replace(/[&<>"']/g, function(c) { return m[c]; });
}

function renderHeader(activePage) {
  var navItems = [
    { key: 'home', href: 'index.html' },
    { key: 'library', href: 'library.html' },
    { key: 'assistant', href: 'assistant.html' }
  ];
  var navHTML = navItems.map(function(item) {
    return '<a class="nav-link ' + (activePage === item.key ? 'active' : '') + '" href="' + item.href + '">' + t('nav.' + item.key) + '</a>';
  }).join('');

  return '' +
    '<header class="site-header">' +
      '<div class="container header-inner">' +
        '<a href="index.html" class="brand">' +
          '<span class="brand-name" style="font-weight:700;color:var(--green);font-size:1.3rem;">FP-SMART</span>' +
        '</a>' +
        '<nav class="main-nav" aria-label="Navigation principale">' + navHTML + '</nav>' +
        '<div class="header-controls">' +
          '<div class="lang-switch" role="group" aria-label="Langue">' +
            '<button class="lang-btn ' + (APP.lang === 'fr' ? 'active' : '') + '" data-lang="fr">FR</button>' +
            '<button class="lang-btn ' + (APP.lang === 'ar' ? 'active' : '') + '" data-lang="ar">ع</button>' +
            '<button class="lang-btn ' + (APP.lang === 'en' ? 'active' : '') + '" data-lang="en">EN</button>' +
          '</div>' +
          '<button class="icon-btn" id="theme-toggle" aria-label="Theme">' + icon(APP.theme === 'light' ? 'moon' : 'sun') + '</button>' +
          '<button class="icon-btn mobile-nav-toggle" id="mobile-nav-open" aria-label="Menu">' + icon('menu') + '</button>' +
        '</div>' +
      '</div>' +
    '</header>' +
    '<div class="mobile-drawer" id="mobile-drawer">' +
      '<div class="mobile-drawer-backdrop" id="mobile-drawer-backdrop"></div>' +
      '<div class="mobile-drawer-panel">' +
        '<button class="icon-btn" id="mobile-nav-close" style="align-self:flex-end;" aria-label="Close">' + icon('close') + '</button>' +
        navItems.map(function(item) {
          return '<a class="nav-link ' + (activePage === item.key ? 'active' : '') + '" href="' + item.href + '">' + t('nav.' + item.key) + '</a>';
        }).join('') +
      '</div>' +
    '</div>';
}

function renderFooter() {
  return '' +
    '<footer class="site-footer">' +
      '<div class="container footer-inner">' +
        '<p class="footer-about">' + (t('footer.about') || 'FP-SMART — Plateforme dédiée à la Formation Professionnelle en Algérie') + '</p>' +
        '<div class="footer-meta">' +
          '<div>&copy; ' + new Date().getFullYear() + ' FP-SMART</div>' +
          '<div>&#x1F1E9;&#x1F1FF; ' + (t('footer.madeWith') || 'Made for Algerian Vocational Training') + '</div>' +
        '</div>' +
      '</div>' +
    '</footer>';
}

function renderDocModal() {
  return '' +
    '<div class="modal-overlay" id="doc-modal">' +
      '<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<div class="modal-head">' +
          '<h3 id="modal-title"></h3>' +
          '<button class="modal-close" id="modal-close-btn" aria-label="' + (t('modal.close') || 'Fermer') + '">' + icon('close') + '</button>' +
        '</div>' +
        '<div class="modal-body" id="modal-body">' +
          '<div class="modal-preview" id="modal-preview"></div>' +
          '<div class="modal-resize-handle" id="modal-resize-handle"></div>' +
          '<div class="modal-info">' +
            '<div><div class="eyebrow">' + (t('modal.description') || 'Description') + '</div><p id="modal-description"></p></div>' +
            '<dl class="modal-detail-grid" id="modal-details"></dl>' +
            '<div class="modal-actions">' +
              '<a class="btn btn-primary" id="modal-download-btn" target="_blank" rel="noopener">' + icon('download') + ' <span>' + (t('card.download') || 'Télécharger') + '</span></a>' +
              '<a class="btn btn-secondary" id="modal-external-btn" target="_blank" rel="noopener">' + icon('external') + ' <span>' + (t('modal.openExternal') || 'Ouvrir') + '</span></a>' +
            '</div>' +
            '<div class="modal-ai-chat">' +
              '<div class="modal-ai-messages" id="modal-ai-messages"></div>' +
              '<div class="modal-ai-input-row">' +
                '<label class="btn-attach" id="modal-ai-attach-btn" title="' + (t('assistant.attach') || 'Joindre') + '">' + icon('paperclip') +
                  '<input type="file" id="modal-ai-file" accept="image/*,.pdf,.txt" style="display:none;">' +
                '</label>' +
                '<textarea id="modal-ai-input" rows="1" dir="auto" placeholder="' + (t('assistant.askAI') || 'Pose une question sur ce document…') + '"></textarea>' +
                '<button class="btn btn-primary btn-sm" id="modal-ai-send-btn">' + icon('send') + '</button>' +
              '</div>' +
              '<div class="modal-ai-tools">' +
                '<button class="btn btn-secondary btn-sm" id="modal-ai-img-btn">' + icon('image') + ' <span>Image</span></button>' +
                '<button class="btn btn-secondary btn-sm" id="modal-ai-canvas-btn">' + icon('feather') + ' <span>Canvas</span></button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-cite-apa" title="Citation APA">APA</button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-cite-mla" title="Citation MLA">MLA</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

/* ---- Wire layout events ---- */
function wireLayoutEvents() {
  document.querySelectorAll('.lang-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { setLang(btn.dataset.lang); });
  });

  var themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      toggleTheme();
      themeToggle.innerHTML = icon(APP.theme === 'light' ? 'moon' : 'sun');
    });
  }

  var drawer = document.getElementById('mobile-drawer');
  var openBtn = document.getElementById('mobile-nav-open');
  var closeBtn = document.getElementById('mobile-nav-close');
  var backdrop = document.getElementById('mobile-drawer-backdrop');
  if (openBtn) openBtn.addEventListener('click', function() { drawer.classList.add('open'); });
  if (closeBtn) closeBtn.addEventListener('click', function() { drawer.classList.remove('open'); });
  if (backdrop) backdrop.addEventListener('click', function() { drawer.classList.remove('open'); });

  var modal = document.getElementById('doc-modal');
  var modalCloseBtn = document.getElementById('modal-close-btn');
  if (modal && modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeDocModal);
    modal.addEventListener('click', function(e) { if (e.target === modal) closeDocModal(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && modal.classList.contains('open')) closeDocModal(); });
  }

  var handle = document.getElementById('modal-resize-handle');
  var preview = document.getElementById('modal-preview');
  if (handle && preview) {
    var isResizing = false;
    handle.addEventListener('mousedown', function(e) { isResizing = true; handle.classList.add('active'); e.preventDefault(); });
    document.addEventListener('mousemove', function(e) {
      if (!isResizing) return;
      var box = modal.querySelector('.modal-box');
      var rect = box.getBoundingClientRect();
      var pct = ((e.clientX - rect.left) / rect.width) * 100;
      pct = Math.max(20, Math.min(80, pct));
      preview.style.flex = '0 0 ' + pct + '%';
    });
    document.addEventListener('mouseup', function() { if (isResizing) { isResizing = false; handle.classList.remove('active'); } });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key.toLowerCase() === 'h' && e.ctrlKey && e.altKey) { e.preventDefault(); window.location.href = 'admin.html'; }
  });
}

/* ---- Modal open/close ---- */
var lastFocusedEl = null;
var modalDocContext = null;

function openDocModal(docId) {
  var doc = APP.db.documents.find(function(d) { return d.id === docId; });
  if (!doc) return;
  lastFocusedEl = document.activeElement;
  modalDocContext = doc;

  document.getElementById('modal-title').textContent = localized(doc.title);
  document.getElementById('modal-description').textContent = localized(doc.description);

  var preview = document.getElementById('modal-preview');
  var pUrl = doc.previewUrl || '';
  if (pUrl.includes('mega.nz')) {
    preview.innerHTML = '<div class="preview-fallback"><p>' + (t('modal.previewBlocked') || 'Aperçu non disponible') + '</p><p style="font-size:var(--fs-xs);color:var(--ink-soft);word-break:break-all;">' + escapeHTML(pUrl) + '</p></div>';
  } else {
    var embedUrl = pUrl;
    if (embedUrl.includes('drive.google.com')) {
      embedUrl = embedUrl.replace('/view?usp=drivesdk', '/preview').replace('/view', '/preview');
      if (!embedUrl.includes('/preview')) {
        var driveIdMatch = embedUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (driveIdMatch) embedUrl = 'https://drive.google.com/file/d/' + driveIdMatch[1] + '/preview';
      }
    }
    preview.innerHTML = '<iframe src="' + escapeAttr(embedUrl) + '" title="' + escapeAttr(localized(doc.title)) + '" loading="lazy" allow="autoplay"></iframe>';
  }

  var moduleName = APP.db.modules.find(function(m) { return m.id === doc.module; });
  var typeName = APP.db.documentTypes.find(function(ty) { return ty.id === doc.type; });
  var semesterObj = findSemester(doc.semester);
  var diplomaObj = findDiplomaBySemester(doc.semester);
  var specialtyObj = moduleName ? APP.db.specialties.find(function(s) { return s.id === moduleName.specialty; }) : null;

  var details = document.getElementById('modal-details');
  details.innerHTML = '' +
    '<div><dt>' + (t('modal.module') || 'Module') + '</dt><dd>' + escapeHTML(moduleName ? localized(moduleName.name) : '&mdash;') + '</dd></div>' +
    (specialtyObj ? '<div><dt>' + (t('modal.specialty') || 'Spécialité') + '</dt><dd>' + escapeHTML(localized(specialtyObj.name)) + '</dd></div>' : '') +
    '<div><dt>' + (t('admin.diploma') || 'Diplôme') + '</dt><dd>' + escapeHTML(diplomaObj ? localized(diplomaObj.name) : '&mdash;') + '</dd></div>' +
    '<div><dt>' + (t('admin.semester') || 'Semestre') + '</dt><dd>' + escapeHTML(semesterObj ? localized(semesterObj.name) : doc.semester || '&mdash;') + '</dd></div>' +
    '<div><dt>' + (t('modal.type') || 'Type') + '</dt><dd>' + escapeHTML(typeName ? localized(typeName.name) : '&mdash;') + '</dd></div>' +
    (doc.institution ? '<div><dt>' + (t('admin.institution') || 'Établissement') + '</dt><dd>' + escapeHTML(doc.institution) + '</dd></div>' : '') +
    (doc.wilaya ? '<div><dt>' + (t('admin.wilaya') || 'Wilaya') + '</dt><dd>' + escapeHTML(doc.wilaya) + '</dd></div>' : '') +
    '<div><dt>' + (t('modal.year') || 'Année') + '</dt><dd class="ltr-only">' + escapeHTML(doc.year || '&mdash;') + '</dd></div>' +
    '<div><dt>' + (t('modal.size') || 'Taille') + '</dt><dd class="ltr-only">' + escapeHTML(doc.size || '&mdash;') + '</dd></div>' +
    '<div><dt>' + (t('modal.pages') || 'Pages') + '</dt><dd class="ltr-only">' + escapeHTML(doc.pages || '&mdash;') + '</dd></div>' +
    '<div><dt>' + (t('modal.host') || 'Hébergeur') + '</dt><dd style="text-transform:capitalize">' + escapeHTML(doc.host || '&mdash;') + '</dd></div>';

  document.getElementById('modal-download-btn').href = doc.downloadUrl || '#';
  document.getElementById('modal-external-btn').href = doc.previewUrl || '#';

  document.getElementById('doc-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-close-btn').focus();
}

function closeDocModal() {
  var modal = document.getElementById('doc-modal');
  modal.classList.remove('open');
  document.getElementById('modal-preview').innerHTML = '';
  document.body.style.overflow = '';
  if (lastFocusedEl) lastFocusedEl.focus();
}

/* ---- initLayout (inject-based, for admin/library) ---- */
function injectHeader() {
  var root = document.getElementById('header-root');
  var page = 'home';
  var path = window.location.pathname.split('/').pop() || 'index.html';
  if (path.indexOf('library') === 0) page = 'library';
  else if (path.indexOf('assistant') === 0) page = 'assistant';
  else if (path.indexOf('admin') === 0) page = 'admin';
  if (root) root.innerHTML = renderHeader(page);
}

function injectFooter() {
  var root = document.getElementById('footer-root');
  if (root) root.innerHTML = renderFooter();
}

function initLayout() {
  injectHeader();
  injectFooter();
}

/* ---- FP helpers ---- */
function findSemester(semesterId) {
  if (!semesterId) return null;
  for (var i = 0; i < APP.db.diplomas.length; i++) {
    var dip = APP.db.diplomas[i];
    for (var j = 0; j < (dip.semesters || []).length; j++) {
      if (dip.semesters[j].id === semesterId) return dip.semesters[j];
    }
  }
  return null;
}

function findDiplomaBySemester(semesterId) {
  if (!semesterId) return null;
  for (var i = 0; i < APP.db.diplomas.length; i++) {
    var dip = APP.db.diplomas[i];
    if (dip.semesters && dip.semesters.some(function(s) { return s.id === semesterId; })) return dip;
  }
  return null;
}
