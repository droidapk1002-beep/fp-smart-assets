/* LAYOUT — header, footer, modal, drawer */

function escapeHTML(str) {
  var m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return String(str).replace(/[&<>"']/g, function(c) { return m[c]; });
}

function escapeAttr(str) {
  var m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return String(str).replace(/[&<>"']/g, function(c) { return m[c]; });
}

/* ---- Markdown renderer (for bot messages) ---- */
function renderMarkdown(text) {
  if (!text) return '';
  var html = escapeHTML(text);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, lang, code) {
    return '<pre><code class="lang-' + (lang || 'text') + '">' + code.trim() + '</code></pre>';
  });
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^---+$/gm, '<hr>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, function(match) {
    if (match.indexOf('<ul>') >= 0) return match;
    return '<ol>' + match + '</ol>';
  });
  html = html.replace(/(\|.+\|\n)+/g, function(tableBlock) {
    var rows = tableBlock.trim().split('\n');
    if (rows.length < 2) return tableBlock;
    var headerCells = rows[0].split('|').filter(function(c) { return c.trim(); });
    var bodyStart = 1;
    if (rows.length > 1 && rows[1].split('|').filter(function(c) { return c.trim(); }).every(function(c) { return /^[\s:-]+$/.test(c); })) bodyStart = 2;
    var table = '<table><thead><tr>' + headerCells.map(function(c) { return '<th>' + c.trim() + '</th>'; }).join('') + '</tr></thead><tbody>';
    for (var i = bodyStart; i < rows.length; i++) {
      var cells = rows[i].split('|').filter(function(c) { return c.trim(); });
      table += '<tr>' + cells.map(function(c) { return '<td>' + c.trim() + '</td>'; }).join('') + '</tr>';
    }
    table += '</tbody></table>';
    return table;
  });
  html = html.replace(/\n\n(?!<)/g, '</p><p>');
  html = html.replace(/\n(?!<)/g, '<br>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>(<h[1-3]>)/g, '$1');
  html = html.replace(/(<\/h[1-3]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ol>)/g, '$1');
  html = html.replace(/(<\/ol>)<\/p>/g, '$1');
  html = html.replace(/<p>(<table>)/g, '$1');
  html = html.replace(/(<\/table>)<\/p>/g, '$1');
  html = html.replace(/<p>(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
  return html;
}

/* FP_ROUTES : URLs réelles des pages (utile sur Blogger, où les pages ne
   s'appellent pas index.html/library.html mais ont une URL du type
   /p/library.html). Laisser tel quel pour un usage local/standalone. */
var FP_ROUTES = (typeof window !== 'undefined' && window.FP_ROUTES) || {
  home: 'index.html', library: 'library.html', assistant: 'assistant.html', admin: 'admin.html'
};

function renderHeader(activePage) {
  var navItems = [
    { key: 'home', href: FP_ROUTES.home },
    { key: 'library', href: FP_ROUTES.library },
    { key: 'assistant', href: FP_ROUTES.assistant }
  ];
  var navHTML = navItems.map(function(item) {
    return '<a class="nav-link ' + (activePage === item.key ? 'active' : '') + '" href="' + item.href + '">' + t('nav.' + item.key) + '</a>';
  }).join('');

  return '' +
    '<header class="site-header">' +
      '<div class="container header-inner">' +
        '<a href="' + FP_ROUTES.home + '" class="brand">' +
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
                '<textarea id="modal-ai-input" rows="1" dir="auto" placeholder="' + (t('assistant.askAI') || 'Pose une question sur ce document\u2026') + '"></textarea>' +
                '<button class="btn btn-primary btn-sm" id="modal-ai-send-btn">' + icon('send') + '</button>' +
              '</div>' +
              '<div class="modal-ai-tools">' +
                '<button class="btn btn-secondary btn-sm" id="modal-ai-img-btn">' + icon('image') + ' <span>Image</span></button>' +
                '<button class="btn btn-secondary btn-sm" id="modal-ai-canvas-btn">' + icon('feather') + ' <span>Canvas</span></button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-cite-apa" title="Citation APA">APA</button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-cite-mla" title="Citation MLA">MLA</button>' +
                '<input type="text" id="modal-ai-search-inp" placeholder="\uD83D\uDD0D Rechercher\u2026" style="display:none;flex:1;max-width:140px;padding:var(--space-1)var(--space-2);border:2px solid var(--kraft);border-radius:var(--radius-md);background:var(--surface);color:var(--ink);font-size:var(--fs-xs);">' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-export-btn" title="Exporter le chat">\u2193</button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-save-prompt-btn" title="Sauvegarder le prompt">\uD83D\uDCBE</button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-view-prompts-btn" title="Prompts sauvegard\u00e9s">\uD83D\uDCCB</button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-search-toggle" title="Rechercher dans le chat">\uD83D\uDD0D</button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-key-btn" title="Cl\u00e9 API">\uD83D\uDD11</button>' +
                '<button class="btn btn-ghost btn-sm" id="modal-ai-fullscreen-btn" title="Plein \u00e9cran">\u21F1</button>' +
              '</div>' +
              '<div class="modal-ai-key-panel" id="modal-ai-key-panel" style="display:none;margin-top:var(--space-2);border:var(--border-w) solid var(--kraft-line);border-radius:var(--radius-md);background:var(--surface);max-height:260px;overflow-y:auto;">' +
                '<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);border-bottom:var(--border-w) solid var(--kraft-line);">' +
                  '<strong style="font-size:var(--fs-xs);flex:1;">Cl\u00e9s API</strong>' +
                  '<button style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--ink-soft);" id="modal-ai-close-key-btn">\u2715</button>' +
                '</div>' +
                '<div id="modal-ai-key-list" style="padding:var(--space-2);"></div>' +
                '<div style="border-top:var(--border-w) solid var(--kraft-line);padding:var(--space-2) var(--space-3);display:flex;flex-direction:column;gap:var(--space-1);">' +
                  '<input type="password" id="modal-ai-key-add-input" placeholder="Nouvelle cl\u00e9 API\u2026" style="padding:var(--space-1) var(--space-2);border:2px solid var(--kraft);border-radius:var(--radius-sm);font-size:var(--fs-xs);">' +
                  '<div style="display:flex;gap:var(--space-1);">' +
                    '<select id="modal-ai-key-add-provider" style="flex:1;padding:var(--space-1) var(--space-2);border:2px solid var(--kraft);border-radius:var(--radius-sm);font-size:var(--fs-xs);background:var(--surface);color:var(--ink);"></select>' +
                    '<button class="btn btn-primary btn-sm" id="modal-ai-key-add-btn">+</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<div class="modal-ai-suggestions" id="modal-ai-suggestions" style="display:none;margin-top:var(--space-2);"></div>' +
              '<div class="modal-ai-prompts-panel" id="modal-ai-prompts-panel" style="display:none;margin-top:var(--space-2);border:var(--border-w) solid var(--kraft-line);border-radius:var(--radius-md);background:var(--surface);max-height:200px;overflow-y:auto;">' +
                '<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);border-bottom:var(--border-w) solid var(--kraft-line);">' +
                  '<strong style="font-size:var(--fs-xs);flex:1;">Prompts sauvegard\u00e9s</strong>' +
                  '<button style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--ink-soft);" id="modal-ai-close-prompts-btn">\u2715</button>' +
                '</div>' +
                '<div id="modal-ai-prompts-list" style="padding:var(--space-2);"></div>' +
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
    if (e.key.toLowerCase() === 'h' && e.ctrlKey && e.altKey) { e.preventDefault(); window.location.href = FP_ROUTES.admin; }
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
    preview.innerHTML = '<div class="preview-fallback"><p>' + (t('modal.previewBlocked') || 'Aper\u00e7u non disponible') + '</p><p style="font-size:var(--fs-xs);color:var(--ink-soft);word-break:break-all;">' + escapeHTML(pUrl) + '</p></div>';
  } else {
    var embedUrl = pUrl;
    if (embedUrl.includes('drive.google.com')) embedUrl = embedUrl.replace('/view?usp=drivesdk', '/preview').replace('/view', '/preview');
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
    (specialtyObj ? '<div><dt>' + (t('modal.specialty') || 'Sp\u00e9cialit\u00e9') + '</dt><dd>' + escapeHTML(localized(specialtyObj.name)) + '</dd></div>' : '') +
    '<div><dt>' + (t('admin.diploma') || 'Dipl\u00f4me') + '</dt><dd>' + escapeHTML(diplomaObj ? localized(diplomaObj.name) : '&mdash;') + '</dd></div>' +
    '<div><dt>' + (t('admin.semester') || 'Semestre') + '</dt><dd>' + escapeHTML(semesterObj ? localized(semesterObj.name) : doc.semester || '&mdash;') + '</dd></div>' +
    '<div><dt>' + (t('modal.type') || 'Type') + '</dt><dd>' + escapeHTML(typeName ? localized(typeName.name) : '&mdash;') + '</dd></div>' +
    (doc.institution ? '<div><dt>' + (t('admin.institution') || '\u00c9tablissement') + '</dt><dd>' + escapeHTML(doc.institution) + '</dd></div>' : '') +
    (doc.wilaya ? '<div><dt>' + (t('admin.wilaya') || 'Wilaya') + '</dt><dd>' + escapeHTML(doc.wilaya) + '</dd></div>' : '') +
    '<div><dt>' + (t('modal.year') || 'Ann\u00e9e') + '</dt><dd class="ltr-only">' + escapeHTML(doc.year || '&mdash;') + '</dd></div>' +
    '<div><dt>' + (t('modal.size') || 'Taille') + '</dt><dd class="ltr-only">' + escapeHTML(doc.size || '&mdash;') + '</dd></div>' +
    '<div><dt>' + (t('modal.pages') || 'Pages') + '</dt><dd class="ltr-only">' + escapeHTML(doc.pages || '&mdash;') + '</dd></div>' +
    '<div><dt>' + (t('modal.host') || 'H\u00e9bergeur') + '</dt><dd style="text-transform:capitalize">' + escapeHTML(doc.host || '&mdash;') + '</dd></div>';

  document.getElementById('modal-download-btn').href = doc.downloadUrl || '#';
  document.getElementById('modal-external-btn').href = doc.previewUrl || '#';

  // Wire modal AI chat
  wireModalAIChat(doc);

  document.getElementById('doc-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-close-btn').focus();
}

/* ---- Saved Prompts ---- */
var FP_PROMPTS_KEY = 'fp_saved_prompts';
var savedPrompts = [];
function loadSavedPrompts() { try { savedPrompts = JSON.parse(localStorage.getItem(FP_PROMPTS_KEY) || '[]'); } catch(e) { savedPrompts = []; } }
function saveSavedPrompts() { localStorage.setItem(FP_PROMPTS_KEY, JSON.stringify(savedPrompts)); }
function addSavedPrompt(title, text) { savedPrompts.push({ id: 'prompt-' + Date.now(), title: title || 'Sans titre', text: text }); saveSavedPrompts(); }
function deleteSavedPrompt(id) { savedPrompts = savedPrompts.filter(function(p) { return p.id !== id; }); saveSavedPrompts(); }

/* ---- Export chat ---- */
function showExportMenu(anchor, cb) {
  var existing = document.getElementById('export-format-menu');
  if (existing) { existing.remove(); return; }
  var menu = document.createElement('div');
  menu.id = 'export-format-menu';
  menu.style.cssText = 'position:fixed;z-index:9999;background:var(--surface);border:2px solid var(--kraft);border-radius:var(--radius-md);box-shadow:0 4px 16px rgba(0,0,0,.12);padding:var(--space-1);display:flex;flex-direction:column;gap:2px;min-width:140px;';
  var rect = anchor.getBoundingClientRect();
  var items = [
    { icon: '\uD83D\uDCDD', label: 'Markdown (.md)', fmt: 'md' },
    { icon: '\uD83D\uDCC4', label: 'Texte (.txt)', fmt: 'txt' }
  ];
  items.forEach(function(it) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-3);border:none;border-radius:var(--radius-sm);background:transparent;color:var(--ink);font-size:var(--fs-xs);cursor:pointer;text-align:start;white-space:nowrap;';
    btn.innerHTML = '<span style="font-size:14px;">' + it.icon + '</span> ' + it.label;
    btn.onmouseover = function() { this.style.background = 'var(--cream-card)'; };
    btn.onmouseout = function() { this.style.background = 'transparent'; };
    btn.onclick = function() { menu.remove(); cb(it.fmt); };
    menu.appendChild(btn);
  });
  document.body.appendChild(menu);
  var top = Math.max(4, Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - 4));
  menu.style.top = top + 'px';
  menu.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 160)) + 'px';
  setTimeout(function() {
    document.addEventListener('click', function closeMenu(e2) {
      if (!menu.contains(e2.target)) { menu.remove(); document.removeEventListener('click', closeMenu); }
    });
  }, 10);
}

function exportChat(format, msgs) {
  if (!msgs || !msgs.length) { if (typeof showToast === 'function') showToast('Rien \u00e0 exporter.'); return; }
  var lines = msgs.map(function(m) {
    var role = m.role === 'user' ? 'Vous' : 'Assistant';
    return role + ': ' + m.content;
  }).join('\n---\n');
  var blob, ext, mime;
  if (format === 'md') {
    blob = new Blob(['# Conversation FP-SMART\n# ' + new Date().toLocaleString() + '\n\n' + lines], { type: 'text/markdown' });
    ext = 'md'; mime = 'text/markdown';
  } else {
    blob = new Blob(['Conversation FP-SMART\n' + new Date().toLocaleString() + '\n\n' + lines], { type: 'text/plain' });
    ext = 'txt'; mime = 'text/plain';
  }
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'chat-fp-smart-' + new Date().toISOString().slice(0, 10) + '.' + ext;
  a.click();
  URL.revokeObjectURL(a.href);
  if (typeof showToast === 'function') showToast('Export t\u00e9l\u00e9charg\u00e9 !');
}

/* ---- Modal AI Chat ---- */
function wireModalAIChat(doc) {
  var messages = document.getElementById('modal-ai-messages');
  var input = document.getElementById('modal-ai-input');
  var sendBtn = document.getElementById('modal-ai-send-btn');
  if (!messages || !input || !sendBtn) return;

  messages.innerHTML = '';
  window._modalChatMsgs = [];

  var docTitle = localized(doc.title || '');
  if (docTitle) {
    var ctx = document.createElement('div');
    ctx.className = 'chat-msg context';
    ctx.style.cssText = 'font-size:var(--fs-xs);color:var(--ink-soft);text-align:center;padding:var(--space-2);background:var(--kraft);border-radius:var(--radius-sm);margin-bottom:var(--space-2);';
    ctx.textContent = '\uD83D\uDCCB ' + docTitle;
    messages.appendChild(ctx);
  }

  input.onkeydown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendModalMessage(doc); }
  };
  input.value = '';
  sendBtn.onclick = function() { sendModalMessage(doc); };

  // Fullscreen toggle
  var fsBtn = document.getElementById('modal-ai-fullscreen-btn');
  if (fsBtn) {
    fsBtn.onclick = function() {
      var modalBox = document.querySelector('.modal-box');
      modalBox.classList.toggle('chat-full');
      fsBtn.textContent = modalBox.classList.contains('chat-full') ? '\u2715' : '\u21F1';
      setTimeout(function() { messages.scrollTop = messages.scrollHeight; }, 100);
    };
  }

  // Search toggle
  var searchInp = document.getElementById('modal-ai-search-inp');
  var searchToggle = document.getElementById('modal-ai-search-toggle');
  if (searchInp && searchToggle) {
    searchToggle.onclick = function() {
      searchInp.style.display = searchInp.style.display === 'none' ? '' : 'none';
      if (searchInp.style.display === 'none') {
        searchInp.value = '';
        messages.querySelectorAll('.chat-msg').forEach(function(m) { m.style.display = ''; });
      } else {
        searchInp.focus();
      }
    };
    searchInp.oninput = function() {
      var q = this.value.trim().toLowerCase();
      messages.querySelectorAll('.chat-msg').forEach(function(m) {
        if (!q) { m.style.display = ''; return; }
        m.style.display = m.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    };
  }

  // Export chat
  var exportBtn = document.getElementById('modal-ai-export-btn');
  if (exportBtn) {
    exportBtn.onclick = function(e) {
      var msgs = (window._modalChatMsgs || []).map(function(m) { return { role: m.role, content: m.content }; });
      if (!msgs.length) { if (typeof showToast === 'function') showToast('Aucun message \u00e0 exporter.'); return; }
      showExportMenu(e.target || e.currentTarget, function(fmt) { exportChat(fmt, msgs); });
    };
  }

  // Save prompt
  var savePromptBtn = document.getElementById('modal-ai-save-prompt-btn');
  if (savePromptBtn) {
    savePromptBtn.onclick = function() {
      var txt = input.value.trim();
      if (!txt) { if (typeof showToast === 'function') showToast('Le champ est vide.'); return; }
      var title = prompt('Nom du prompt :', txt.slice(0, 40));
      if (title) {
        addSavedPrompt(title.trim(), txt);
        if (typeof showToast === 'function') showToast('Prompt sauvegard\u00e9 !');
      }
    };
  }

  // View prompts panel
  var viewPromptsBtn = document.getElementById('modal-ai-view-prompts-btn');
  var promptsPanel = document.getElementById('modal-ai-prompts-panel');
  var promptsList = document.getElementById('modal-ai-prompts-list');
  var closePromptsBtn = document.getElementById('modal-ai-close-prompts-btn');
  if (viewPromptsBtn && promptsPanel && promptsList) {
    viewPromptsBtn.onclick = function() {
      if (promptsPanel.style.display !== 'none') { promptsPanel.style.display = 'none'; return; }
      renderModalPrompts();
      promptsPanel.style.display = '';
    };
    if (closePromptsBtn) closePromptsBtn.onclick = function() { promptsPanel.style.display = 'none'; };
  }
  function renderModalPrompts() {
    if (!promptsList) return;
    if (!savedPrompts.length) {
      promptsList.innerHTML = '<div style="padding:var(--space-2);font-size:var(--fs-xs);color:var(--ink-soft);text-align:center;">Aucun prompt sauvegard\u00e9</div>';
      return;
    }
    promptsList.innerHTML = savedPrompts.map(function(p) {
      return '<div class="modal-prompt-item" style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-2);cursor:pointer;border-radius:var(--radius-sm);" data-text="' + escapeAttr(p.text) + '">' +
        '<span style="flex:1;font-size:var(--fs-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHTML(p.title) + '</span>' +
        '<button class="modal-prompt-del" style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--red-stamp);padding:0 4px;">\u2715</button></div>';
    }).join('');
    promptsList.querySelectorAll('.modal-prompt-item').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (e.target.closest('.modal-prompt-del')) return;
        input.value = el.dataset.text;
        input.focus();
        promptsPanel.style.display = 'none';
      });
    });
    promptsList.querySelectorAll('.modal-prompt-del').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var el = btn.closest('.modal-prompt-item');
        var found = savedPrompts.findIndex(function(p) { return p.text === el.dataset.text; });
        if (found >= 0) deleteSavedPrompt(savedPrompts[found].id);
        setTimeout(renderModalPrompts, 50);
      });
    });
  }

  // API key panel
  var keyBtn = document.getElementById('modal-ai-key-btn');
  var keyPanel = document.getElementById('modal-ai-key-panel');
  var keyList = document.getElementById('modal-ai-key-list');
  var closeKeyBtn = document.getElementById('modal-ai-close-key-btn');
  var keyAddInput = document.getElementById('modal-ai-key-add-input');
  var keyAddProv = document.getElementById('modal-ai-key-add-provider');
  var keyAddBtn = document.getElementById('modal-ai-key-add-btn');
  if (keyBtn && keyPanel) {
    keyBtn.onclick = function() {
      if (keyPanel.style.display !== 'none') { keyPanel.style.display = 'none'; return; }
      if (keyAddProv && typeof PROVIDERS !== 'undefined') {
        keyAddProv.innerHTML = Object.keys(PROVIDERS).map(function(k) { return '<option value="' + k + '">' + escapeHTML(PROVIDERS[k].label) + '</option>'; }).join('');
      }
      renderModalKeyList();
      keyPanel.style.display = '';
    };
    if (closeKeyBtn) closeKeyBtn.onclick = function() { keyPanel.style.display = 'none'; };
    if (keyAddBtn && keyAddInput && keyAddProv) {
      keyAddBtn.onclick = function() {
        var apiKey = typeof sanitizeApiKey === 'function' ? sanitizeApiKey(keyAddInput.value) : keyAddInput.value.trim();
        if (!apiKey) { if (typeof showToast === 'function') showToast('Cl\u00e9 requise'); return; }
        var provider = keyAddProv.value;
        var model = (typeof PROVIDERS !== 'undefined' && PROVIDERS[provider]) ? PROVIDERS[provider].defaultModel : '';
        var keys = typeof getStoredKeys === 'function' ? getStoredKeys() : [];
        keys.push({ id: 'key-' + Date.now(), provider: provider, apiKey: apiKey, model: model, active: keys.length === 0 });
        if (typeof saveStoredKeys === 'function') saveStoredKeys(keys);
        keyAddInput.value = '';
        renderModalKeyList();
        if (typeof showToast === 'function') showToast('Cl\u00e9 ajout\u00e9e !');
      };
    }
  }
  function renderModalKeyList() {
    if (!keyList) return;
    var keys = typeof getStoredKeys === 'function' ? getStoredKeys() : [];
    if (!keys.length) {
      keyList.innerHTML = '<div style="padding:var(--space-2);font-size:var(--fs-xs);color:var(--ink-soft);text-align:center;">Aucune cl\u00e9 enregistr\u00e9e</div>';
      return;
    }
    keyList.innerHTML = keys.map(function(k) {
      var label = (typeof PROVIDERS !== 'undefined' && PROVIDERS[k.provider] ? PROVIDERS[k.provider].label : k.provider) + ' (' + (k.model || '') + ')';
      var isActive = k.active;
      return '<div class="modal-key-item" data-key-id="' + escapeAttr(k.id) + '" style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-2);cursor:pointer;border-radius:var(--radius-sm);' + (isActive ? 'background:var(--cream-card);font-weight:600;' : '') + '">' +
        '<span style="flex:1;font-size:var(--fs-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHTML(label) + '</span>' +
        (isActive ? '<span style="font-size:10px;color:var(--green);">\u2713</span>' : '') +
        '<button class="modal-key-del" style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--red-stamp);padding:0 4px;">\u2715</button></div>';
    }).join('');
    keyList.querySelectorAll('.modal-key-item').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (e.target.closest('.modal-key-del')) return;
        var kid = el.dataset.keyId;
        var keys2 = (typeof getStoredKeys === 'function' ? getStoredKeys() : []).map(function(k) { k.active = (k.id === kid); return k; });
        if (typeof saveStoredKeys === 'function') saveStoredKeys(keys2);
        renderModalKeyList();
      });
    });
    keyList.querySelectorAll('.modal-key-del').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var el = btn.closest('.modal-key-item');
        var keys2 = (typeof getStoredKeys === 'function' ? getStoredKeys() : []).filter(function(k) { return k.id !== el.dataset.keyId; });
        if (keys2.length && !keys2.some(function(k) { return k.active; })) keys2[0].active = true;
        if (typeof saveStoredKeys === 'function') saveStoredKeys(keys2);
        renderModalKeyList();
      });
    });
  }
}

function sendModalMessage(doc) {
  var messages = document.getElementById('modal-ai-messages');
  var input = document.getElementById('modal-ai-input');
  if (!messages || !input) return;
  var text = input.value.trim();
  if (!text) return;

  if (!window._modalChatMsgs) window._modalChatMsgs = [];
  window._modalChatMsgs.push({ role: 'user', content: text, timestamp: Date.now() });

  var userDiv = document.createElement('div');
  userDiv.className = 'chat-msg user';
  userDiv.dir = 'auto';
  userDiv.textContent = text;
  messages.appendChild(userDiv);
  input.value = '';
  messages.scrollTop = messages.scrollHeight;

  var keyConfig = typeof getSelectedKey === 'function' ? getSelectedKey() : null;
  if (!keyConfig) {
    var keys = [];
    try { keys = JSON.parse(localStorage.getItem('fp_api_keys') || '[]'); } catch(e) {}
    keyConfig = keys[0] || null;
  }
  if (!keyConfig) {
    var noKey = document.createElement('div');
    noKey.className = 'chat-msg assistant';
    noKey.dir = 'auto';
    noKey.textContent = '\u26A0\uFE0F Aucune cl\u00e9 API configur\u00e9e. Va dans l\'onglet Assistant IA pour en ajouter une.';
    messages.appendChild(noKey);
    messages.scrollTop = messages.scrollHeight;
    return;
  }

  var docTitle = localized(doc.title || '');
  var docDesc = localized(doc.description || '');
  var systemMsg = 'Tu es un assistant p\u00e9dagogique. Analyse le document "' + docTitle + '"' + (docDesc ? ' (' + docDesc + ')' : '') + '. R\u00e9ponds en fran\u00e7ais ou en arabe selon la question.';

  var thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'chat-msg assistant thinking';
  thinkingDiv.dir = 'auto';
  thinkingDiv.textContent = '\u23F3 R\u00e9flexion\u2026';
  messages.appendChild(thinkingDiv);
  messages.scrollTop = messages.scrollHeight;

  (async function() {
    try {
      var history = [{ role: 'user', content: text }];
      var reply = await callProvider(keyConfig, history, systemMsg);
      thinkingDiv.remove();
      window._modalChatMsgs.push({ role: 'assistant', content: reply, timestamp: Date.now() });
      var replyDiv = document.createElement('div');
      replyDiv.className = 'chat-msg assistant';
      replyDiv.dir = 'auto';
      replyDiv.innerHTML = renderMarkdown(reply);
      messages.appendChild(replyDiv);
      messages.scrollTop = messages.scrollHeight;
    } catch (err) {
      thinkingDiv.remove();
      var errDiv = document.createElement('div');
      errDiv.className = 'chat-msg assistant';
      errDiv.dir = 'auto';
      errDiv.textContent = '\u26A0\uFE0F Erreur: ' + err.message;
      messages.appendChild(errDiv);
      messages.scrollTop = messages.scrollHeight;
    }
  })();
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
  var hashKey = (window.location.hash || '').replace(/^#\/?/, '').split(/[/?]/)[0];
  if (hashKey === 'library' || hashKey === 'assistant' || hashKey === 'admin') {
    page = hashKey;
  } else {
    var path = window.location.pathname.split('/').pop() || 'index.html';
    if (path.indexOf('library') === 0) page = 'library';
    else if (path.indexOf('assistant') === 0) page = 'assistant';
    else if (path.indexOf('admin') === 0) page = 'admin';
  }
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

loadSavedPrompts();
