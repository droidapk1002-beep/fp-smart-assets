/* ============================================================
   ASSISTANT — AI chat interface (full-featured)
   Features: callProvider, markdown rendering, RTL, conv sidebar,
   toolbar buttons, suggestions, saved prompts, image preview
   ============================================================ */

var FP_SYSTEM_PROMPT = 'Tu es un assistant pédagogique spécialisé dans la Formation Professionnelle en Algérie. Réponds en français ou en arabe selon la langue de la question. Formate ta réponse en markdown si nécessaire (titres, listes, gras, code).';

var PROVIDERS = {
  openai: { label: 'OpenAI', defaultModel: 'gpt-4.1', icon: '\uD83E\uDD16' },
  anthropic: { label: 'Anthropic', defaultModel: 'claude-sonnet-4-6', icon: '\uD83E\uDDE0' },
  google: { label: 'Google Gemini', defaultModel: 'gemini-2.0-flash', icon: '\u2728' },
  custom: { label: 'Personnalisé', defaultModel: '', icon: '\u2699\uFE0F', endpoint: '' }
};

/* ---- Key management ---- */
function getStoredKeys() {
  try { return JSON.parse(localStorage.getItem('fp_api_keys') || '[]'); } catch { return []; }
}
function saveStoredKeys(keys) { localStorage.setItem('fp_api_keys', JSON.stringify(keys)); }
function getSelectedKey() {
  const keys = getStoredKeys();
  const active = keys.find(k => k.active);
  return active || keys[0] || null;
}
function sanitizeApiKey(key) {
  if (typeof key !== 'string') return '';
  return key.replace(/[\u200B\u200C\u200D\uFEFF\u00A0\s]/g, '').trim();
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

/* ---- API call ---- */
async function callProvider(keyConfig, history, systemOverride, signal) {
  const systemPrompt = systemOverride || FP_SYSTEM_PROMPT;
  const apiKey = sanitizeApiKey(keyConfig.apiKey || '');
  const defaultModel = (PROVIDERS[keyConfig.provider] ? PROVIDERS[keyConfig.provider].defaultModel : '');
  var model = keyConfig.model || defaultModel;
  if (keyConfig.provider === 'google' && model === 'gemini-2.5-flash') model = defaultModel;

  if (keyConfig.provider === 'anthropic') {
    const messages = history.map(m => ({ role: m.role, content: m.content }));
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      signal,
      body: JSON.stringify({ model, max_tokens: 1500, system: systemPrompt, messages })
    });
    if (!res.ok) { let errText = ''; try { errText = (await res.text()).slice(0, 200); } catch(e) {} throw new Error('HTTP ' + res.status + (errText ? ' — ' + errText : '')); }
    const data = await res.json();
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') || '…';
  }

  if (keyConfig.provider === 'openai') {
    const messages = [{ role: 'system', content: systemPrompt }];
    history.forEach(m => messages.push({ role: m.role, content: m.content }));
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      signal,
      body: JSON.stringify({ model, messages, max_tokens: 1500 })
    });
    if (!res.ok) { let errText = ''; try { errText = (await res.text()).slice(0, 200); } catch(e) {} throw new Error('HTTP ' + res.status + (errText ? ' — ' + errText : '')); }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '…';
  }

  if (keyConfig.provider === 'google') {
    const contents = history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + apiKey;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents })
    });
    if (!res.ok) { let errText = ''; try { errText = (await res.text()).slice(0, 200); } catch(e) {} throw new Error('HTTP ' + res.status + (errText ? ' — ' + errText : '')); }
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts || []).map(p => p.text).join('\n').trim() || '…';
  }

  if (keyConfig.provider === 'custom') {
    const endpoint = keyConfig.endpoint || (PROVIDERS.custom ? PROVIDERS.custom.endpoint : '');
    if (!endpoint) throw new Error('Endpoint manquant pour le fournisseur personnalisé');
    const messages = [{ role: 'system', content: systemPrompt }];
    history.forEach(m => messages.push({ role: m.role, content: m.content }));
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      signal,
      body: JSON.stringify({ model, messages, max_tokens: 1500 })
    });
    if (!res.ok) { let errText = ''; try { errText = (await res.text()).slice(0, 200); } catch(e) {} throw new Error('HTTP ' + res.status + (errText ? ' — ' + errText : '')); }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '…';
  }

  throw new Error('Fournisseur non supporté: ' + keyConfig.provider);
}

/* ---- Main init ---- */
function initAssistant() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const output = document.getElementById('chat-output');
  const clearBtn = document.getElementById('clear-chat-btn');
  const keySelect = document.getElementById('key-select');
  const providerLabel = document.getElementById('provider-label');

  if (!form || !input || !output) return;

  window._chatHistory = [];
  loadSavedPrompts();
  loadConversation();
  populateKeySelect();
  wireInlineKeyManager();
  wireToolbarButtons();

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      var docModal = document.getElementById('doc-modal');
      if (docModal && docModal.classList.contains('open')) {
        var modalSearchInp = document.getElementById('modal-ai-search-inp');
        var modalSearchToggle = document.getElementById('modal-ai-search-toggle');
        if (modalSearchInp && modalSearchToggle) {
          if (modalSearchInp.style.display === 'none') { modalSearchInp.style.display = ''; }
          modalSearchInp.focus();
          e.preventDefault();
        }
        return;
      }
      var searchInput = document.getElementById('chat-search-inp');
      if (searchInput) {
        if (searchInput.style.display === 'none') searchInput.style.display = '';
        searchInput.focus();
        e.preventDefault();
      }
    }
    if (e.key === 'Escape') {
      var docModal2 = document.getElementById('doc-modal');
      if (docModal2 && docModal2.classList.contains('open')) {
        var mSearchInp = document.getElementById('modal-ai-search-inp');
        if (mSearchInp && mSearchInp.style.display !== 'none') {
          mSearchInp.style.display = 'none';
          mSearchInp.value = '';
          var mMsgs = document.getElementById('modal-ai-messages');
          if (mMsgs) mMsgs.querySelectorAll('.chat-msg').forEach(m => { m.style.display = ''; });
          return;
        }
        var mKeyPanel = document.getElementById('modal-ai-key-panel');
        if (mKeyPanel && mKeyPanel.style.display !== 'none') { mKeyPanel.style.display = 'none'; return; }
        var mPrompts = document.getElementById('modal-ai-prompts-panel');
        if (mPrompts && mPrompts.style.display !== 'none') { mPrompts.style.display = 'none'; return; }
        return;
      }
      var conv = document.getElementById('conv-sidebar');
      if (conv && conv.style.display !== 'none') conv.style.display = 'none';
      var prompts = document.getElementById('saved-prompts-panel');
      if (prompts && prompts.style.display !== 'none') prompts.style.display = 'none';
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    window._chatHistory.push({ role: 'user', content: text, timestamp: Date.now() });
    input.value = '';
    input.style.height = 'auto';
    saveConversation();

    let keyConfig = getSelectedKey();
    if (!keyConfig) {
      const keys = getStoredKeys();
      if (!keys.length) {
        appendMessage('assistant', '\u26A0\uFE0F ' + (t('assistant.noProvider') || 'Aucune clé API configurée.'));
        saveConversation();
        return;
      }
      keyConfig = keys[0];
    }

    const thinkingId = appendMessage('assistant', '\u23F3 ' + (t('assistant.thinking') || 'Réflexion…'));

    try {
      const history = [{ role: 'user', content: text }];
      const reply = await callProvider(keyConfig, history);
      document.getElementById(thinkingId)?.remove();
      appendMessage('assistant', reply);
      window._chatHistory.push({ role: 'assistant', content: reply, timestamp: Date.now() });
      generateSuggestions(text, reply);
    } catch (err) {
      document.getElementById(thinkingId)?.remove();
      let hint = '';
      if (/401/.test(err.message)) hint = '\n\n\u2753 Vérifie ta clé API.';
      else if (/404/.test(err.message)) hint = '\n\n\u2753 Vérifie le nom du modèle.';
      else if (/429/.test(err.message)) hint = '\n\n\u23F3 Trop de requêtes — attends.';
      appendMessage('assistant', '\u26A0\uFE0F Erreur: ' + err.message + hint);
    }
    saveConversation();
  });

  clearBtn?.addEventListener('click', () => {
    output.innerHTML = '';
    window._chatHistory = [];
    var convId = localStorage.getItem('fp_current_conv') || '';
    if (convId) {
      var convs = [];
      try { convs = JSON.parse(localStorage.getItem('fp_conversations') || '[]'); } catch(e) {}
      var conv = convs.find(function(c) { return c.id === convId; });
      if (conv) { conv.messages = []; localStorage.setItem('fp_conversations', JSON.stringify(convs)); }
    }
    localStorage.removeItem('fp_conversation');
  });

  /* ---- Inline key manager (on assistant page) ---- */
  function wireInlineKeyManager() {
    var section = document.getElementById('assistant-key-section');
    if (!section) return;
    var list = document.getElementById('assistant-key-list');
    var addForm = document.getElementById('assistant-key-add-form');
    if (!list || !addForm) return;

    renderInlineKeyList();

    addForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var provider = document.getElementById('assistant-key-provider').value;
      var apiKey = sanitizeApiKey(document.getElementById('assistant-key-apikey').value);
      var model = document.getElementById('assistant-key-model').value.trim() || (PROVIDERS[provider] ? PROVIDERS[provider].defaultModel : '');
      if (!apiKey) { showToast('Clé API requise'); return; }
      var keys = getStoredKeys();
      keys.push({ id: 'key-' + Date.now(), provider: provider, apiKey: apiKey, model: model, active: keys.length === 0 });
      saveStoredKeys(keys);
      addForm.reset();
      document.getElementById('assistant-key-model').placeholder = 'Modèle: ' + (PROVIDERS[provider] ? PROVIDERS[provider].defaultModel : '');
      renderInlineKeyList();
      populateKeySelect();
      showToast('Clé ajoutée !');
    });

    var apiKeyInput = document.getElementById('assistant-key-apikey');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('input', function() {
        var val = apiKeyInput.value.trim();
        var detected = detectProvider(val);
        if (detected) {
          document.getElementById('assistant-key-provider').value = detected;
          var modelInput = document.getElementById('assistant-key-model');
          if (modelInput && !modelInput.value) modelInput.placeholder = 'Modèle: ' + (PROVIDERS[detected] ? PROVIDERS[detected].defaultModel : '');
        }
      });
    }

    function renderInlineKeyList() {
      var keys = getStoredKeys();
      if (!keys.length) {
        list.innerHTML = '<p style="color:var(--ink-soft);font-size:var(--fs-sm);">Aucune clé configurée. Ajoute une clé pour utiliser l\'assistant IA.</p>';
        return;
      }
      list.innerHTML = keys.map(function(k, i) {
        var provLabel = (PROVIDERS[k.provider] ? PROVIDERS[k.provider].label : k.provider);
        var model = k.model || (PROVIDERS[k.provider] ? PROVIDERS[k.provider].defaultModel : '');
        var activeBadge = k.active ? ' <span style="background:var(--green);color:#fff;padding:1px 6px;border-radius:8px;font-size:var(--fs-xs);">Actif</span>' : '';
        return '<div class="key-row" style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid var(--kraft-line);">' +
          '<span style="font-size:var(--fs-xs);font-weight:600;color:var(--green);">' + escapeHTML(provLabel) + activeBadge + '</span>' +
          '<code style="font-size:var(--fs-xs);color:var(--ink-soft);">' + escapeHTML(maskKey(k.apiKey)) + '</code>' +
          '<span style="font-size:var(--fs-xs);background:var(--kraft);padding:1px 6px;border-radius:8px;">' + escapeHTML(model) + '</span>' +
          '<button class="btn btn-danger btn-xs assistant-key-del" data-idx="' + i + '" title="Supprimer">✕</button>' +
        '</div>';
      }).join('');
      list.querySelectorAll('.assistant-key-del').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var idx = parseInt(btn.dataset.idx);
          var keys = getStoredKeys();
          keys.splice(idx, 1);
          if (keys.length && !keys.some(function(k) { return k.active; })) keys[0].active = true;
          saveStoredKeys(keys);
          renderInlineKeyList();
          populateKeySelect();
          showToast('Clé supprimée');
        });
      });
    }

    var provSelect = document.getElementById('assistant-key-provider');
    if (provSelect && typeof PROVIDERS !== 'undefined') {
      provSelect.innerHTML = Object.keys(PROVIDERS).map(function(k) {
        return '<option value="' + k + '">' + escapeHTML(PROVIDERS[k].label) + '</option>';
      }).join('');
    }
  }

  /* ---- Toolbar ---- */
  function wireToolbarButtons() {
    var convToggle = document.getElementById('conv-toggle-btn');
    var convSidebar = document.getElementById('conv-sidebar');
    var convList = document.getElementById('conv-list');
    var convNewBtn = document.getElementById('conv-new-btn');
    if (convToggle && convSidebar) {
      convToggle.onclick = function() {
        convSidebar.style.display = convSidebar.style.display === 'none' ? '' : 'none';
        if (convSidebar.style.display !== 'none') renderConvList();
      };
    }

    function getConversations() {
      try { return JSON.parse(localStorage.getItem('fp_conversations') || '[]'); } catch(e) { return []; }
    }
    function saveConversations(list) { localStorage.setItem('fp_conversations', JSON.stringify(list)); }
    function getCurrentConvId() { return localStorage.getItem('fp_current_conv') || ''; }
    function setCurrentConvId(id) { localStorage.setItem('fp_current_conv', id); }

    function renderConvList() {
      if (!convList) return;
      var convs = getConversations();
      var currentId = getCurrentConvId();
      if (!convs.length) {
        convList.innerHTML = '<div style="padding:var(--space-2);font-size:var(--fs-xs);color:var(--ink-soft);text-align:center;">Aucune conversation</div>';
        return;
      }
      convList.innerHTML = convs.map(function(c) {
        var isActive = c.id === currentId;
        return '<div class="conv-item' + (isActive ? ' active' : '') + '" data-conv-id="' + escapeAttr(c.id) + '">' +
          '<span class="conv-item-title">' + escapeHTML(c.title || 'Nouvelle conversation') + '</span>' +
          '<span class="conv-item-actions">' +
            '<button class="conv-rename" title="Renommer">✏</button>' +
            '<button class="conv-delete" title="Supprimer">✕</button>' +
          '</span></div>';
      }).join('');
      convList.querySelectorAll('.conv-item').forEach(function(el) {
        el.addEventListener('click', function(e) {
          if (e.target.closest('.conv-rename') || e.target.closest('.conv-delete')) return;
          switchConversation(el.dataset.convId);
        });
      });
      convList.querySelectorAll('.conv-rename').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var el = btn.closest('.conv-item');
          var convs = getConversations();
          var conv = convs.find(function(c) { return c.id === el.dataset.convId; });
          if (!conv) return;
          var newTitle = prompt('Nom de la conversation :', conv.title || '');
          if (newTitle !== null && newTitle.trim()) {
            conv.title = newTitle.trim();
            saveConversations(convs);
            renderConvList();
          }
        });
      });
      convList.querySelectorAll('.conv-delete').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var el = btn.closest('.conv-item');
          var convs = getConversations().filter(function(c) { return c.id !== el.dataset.convId; });
          saveConversations(convs);
          if (getCurrentConvId() === el.dataset.convId && convs.length) {
            switchConversation(convs[0].id);
          } else {
            renderConvList();
          }
        });
      });
    }

    function switchConversation(id) {
      var convs = getConversations();
      var conv = convs.find(function(c) { return c.id === id; });
      if (!conv) return;
      setCurrentConvId(id);
      output.innerHTML = '';
      window._chatHistory = [];
      if (conv.messages && conv.messages.length) {
        conv.messages.forEach(function(m) { appendMessage(m.role, m.content); window._chatHistory.push(m); });
      }
      saveConversation();
      renderConvList();
    }

    if (convNewBtn) {
      convNewBtn.onclick = function() {
        var convs = getConversations();
        var newConv = { id: 'conv-' + Date.now(), title: 'Nouvelle conversation', messages: [], created: Date.now() };
        convs.unshift(newConv);
        saveConversations(convs);
        switchConversation(newConv.id);
      };
    }

    var searchInp = document.getElementById('chat-search-inp');
    var searchToggle = document.getElementById('toggle-search-btn');
    if (searchInp && searchToggle) {
      searchToggle.onclick = function() {
        searchInp.style.display = searchInp.style.display === 'none' ? '' : 'none';
        if (searchInp.style.display === 'none') { searchInp.value = ''; renderChatHistory(); }
        else searchInp.focus();
      };
      searchInp.oninput = function() { renderFilteredChat(searchInp.value.trim()); };
    }

    var exportBtn = document.getElementById('export-chat-btn');
    if (exportBtn) {
      exportBtn.onclick = function(e) {
        var msgs = (window._chatHistory || []).map(function(m) { return { role: m.role, content: m.content }; });
        if (!msgs.length) { if (typeof showToast === 'function') showToast('Aucun message à exporter.'); return; }
        showExportMenu(e.target || e.currentTarget, function(fmt) { exportChat(fmt, msgs); });
      };
    }

    var promptsBtn = document.getElementById('saved-prompts-btn');
    var promptsPanel = document.getElementById('saved-prompts-panel');
    var promptsList = document.getElementById('prompts-list');
    var closePromptsBtn = document.getElementById('close-prompts-btn');
    if (promptsBtn && promptsPanel && promptsList) {
      promptsBtn.onclick = function() {
        if (promptsPanel.style.display !== 'none') { promptsPanel.style.display = 'none'; return; }
        renderPromptsList();
        promptsPanel.style.display = '';
      };
      if (closePromptsBtn) closePromptsBtn.onclick = function() { promptsPanel.style.display = 'none'; };
    }
    function renderPromptsList() {
      if (!promptsList) return;
      if (!savedPrompts.length) { promptsList.innerHTML = '<div style="padding:var(--space-2);font-size:var(--fs-xs);color:var(--ink-soft);text-align:center;">Aucun prompt sauvegardé</div>'; return; }
      promptsList.innerHTML = savedPrompts.map(function(p) {
        return '<div class="prompt-item" data-text="' + escapeAttr(p.text) + '">' +
          '<span class="prompt-item-text">' + escapeHTML(p.title) + '</span>' +
          '<button class="prompt-del" style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--red-stamp);padding:0 4px;">\u2715</button></div>';
      }).join('');
      promptsList.querySelectorAll('.prompt-item').forEach(function(el) {
        el.addEventListener('click', function(e) { if (e.target.closest('.prompt-del')) return; input.value = el.dataset.text; input.focus(); promptsPanel.style.display = 'none'; });
      });
      promptsList.querySelectorAll('.prompt-del').forEach(function(btn) {
        btn.addEventListener('click', function(e) { e.stopPropagation(); var el = btn.closest('.prompt-item'); var found = savedPrompts.findIndex(function(p) { return p.text === el.dataset.text; }); if (found >= 0) deleteSavedPrompt(savedPrompts[found].id); setTimeout(renderPromptsList, 50); });
      });
    }

    var fileInput = document.getElementById('chat-file-input');
    var attachBtn = document.getElementById('chat-attach-btn');
    var attachmentsDiv = document.getElementById('chat-attachments');
    var imgPreview = document.getElementById('chat-img-preview');
    var imgRemove = document.getElementById('chat-img-remove');
    if (fileInput && attachBtn) {
      fileInput.onchange = function() {
        var file = fileInput.files[0];
        if (!file) return;
        if (attachmentsDiv) {
          attachmentsDiv.innerHTML = '<div class="file-tag">\uD83D\uDCCE ' + escapeHTML(file.name) + ' <button class="file-remove" style="background:none;border:none;cursor:pointer;color:var(--red-stamp);">\u2715</button></div>';
          attachmentsDiv.querySelector('.file-remove').onclick = function() { fileInput.value = ''; attachmentsDiv.innerHTML = ''; if (imgPreview) imgPreview.style.display = 'none'; };
        }
        if (imgPreview && file.type && file.type.startsWith('image/')) {
          var reader = new FileReader();
          reader.onload = function(ev) { imgPreview.querySelector('img').src = ev.target.result; imgPreview.style.display = ''; };
          reader.readAsDataURL(file);
        } else if (imgPreview) { imgPreview.style.display = 'none'; }
      };
    }
    if (imgRemove) imgRemove.onclick = function() { fileInput.value = ''; attachmentsDiv.innerHTML = ''; imgPreview.style.display = 'none'; };
  }

  /* ---- Suggestions ---- */
  function generateSuggestions(userText, reply) {
    const chipsEl = document.getElementById('suggestion-chips');
    if (!chipsEl) return;
    const keyConfig = getSelectedKey();
    if (!keyConfig) return;
    (async () => {
      try {
        const prompt = 'Basé sur cette conversation, génère 3 questions courtes (1 ligne chacune, séparées par "||") que l\'utilisateur pourrait poser.\n\nMessage: ' + userText.slice(0, 200) + '\nRéponse: ' + reply.slice(0, 300);
        const sugReply = await callProvider(keyConfig, [{ role: 'user', content: prompt }]);
        const questions = sugReply.split('||').map(s => s.trim()).filter(s => s.length > 5).slice(0, 3);
        if (questions.length) {
          chipsEl.style.display = 'flex';
          chipsEl.innerHTML = questions.map(q => '<button type="button" class="chip" data-prompt="' + escapeAttr(q) + '">' + escapeHTML(q) + '</button>').join('');
          chipsEl.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => { input.value = chip.dataset.prompt || chip.textContent; input.focus(); chipsEl.innerHTML = ''; chipsEl.style.display = 'none'; });
          });
        }
      } catch {}
    })();
  }

  /* ---- Key select ---- */
  function populateKeySelect() {
    const keys = getStoredKeys();
    if (!keySelect) return;
    keySelect.innerHTML = keys.length
      ? keys.map((k, i) => '<option value="' + k.id + '">' + escapeHTML(PROVIDERS[k.provider]?.label || k.provider) + ' — ' + escapeHTML(k.model || '') + '</option>').join('')
      : '<option value="">' + (t('assistant.noProvider') || 'Aucune clé configurée') + '</option>';
    if (providerLabel) {
      const active = getSelectedKey();
      providerLabel.textContent = active ? (PROVIDERS[active.provider]?.label || active.provider) + ' / ' + (active.model || '') : (t('assistant.noProvider') || 'Aucune clé');
    }
    keySelect.addEventListener('change', () => {
      const keys = getStoredKeys();
      const k = keys.find(k => k.id === keySelect.value);
      if (k) { saveStoredKeys(keys.map(x => ({ ...x, active: x.id === k.id }))); }
      if (providerLabel && k) providerLabel.textContent = (PROVIDERS[k.provider]?.label || k.provider) + ' / ' + (k.model || '');
    });
  }

  /* ---- Message rendering (with RTL + markdown) ---- */
  function appendMessage(role, content) {
    const id = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const div = document.createElement('div');
    div.id = id;
    div.className = 'chat-msg ' + (role === 'assistant' ? 'bot' : role);
    div.dir = 'auto';

    if (role === 'assistant') {
      div.innerHTML = renderMarkdown(content);
    } else {
      div.textContent = content;
    }

    if (role === 'assistant') {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.innerHTML = '<span class="icon">' + (typeof icon === 'function' ? icon('copy') : '\uD83D\uDCCB') + '</span> Copier';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(content).then(() => {
          copyBtn.classList.add('copied');
          copyBtn.textContent = '\u2713 Copié';
          setTimeout(() => { copyBtn.classList.remove('copied'); copyBtn.innerHTML = '<span class="icon">' + (typeof icon === 'function' ? icon('copy') : '\uD83D\uDCCB') + '</span> Copier'; }, 2000);
        });
      };
      div.appendChild(copyBtn);
    }

    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
    return id;
  }

  /* ---- Conversation persistence ---- */
  function saveConversation() {
    var msgs = [];
    output.querySelectorAll('.chat-msg').forEach(function(el) {
      msgs.push({ role: el.classList.contains('user') ? 'user' : 'assistant', content: el.textContent });
    });
    var convId = localStorage.getItem('fp_current_conv') || '';
    if (convId) {
      var convs = [];
      try { convs = JSON.parse(localStorage.getItem('fp_conversations') || '[]'); } catch(e) {}
      var conv = convs.find(function(c) { return c.id === convId; });
      if (conv) {
        conv.messages = msgs;
        if (msgs.length && conv.title === 'Nouvelle conversation') {
          conv.title = msgs[0].content.slice(0, 60) + (msgs[0].content.length > 60 ? '…' : '');
        }
        localStorage.setItem('fp_conversations', JSON.stringify(convs));
      }
    }
    localStorage.setItem('fp_conversation', JSON.stringify(msgs));
  }

  function loadConversation() {
    try {
      var convId = localStorage.getItem('fp_current_conv') || '';
      var msgs = [];
      if (convId) {
        var convs = JSON.parse(localStorage.getItem('fp_conversations') || '[]');
        var conv = convs.find(function(c) { return c.id === convId; });
        if (conv && conv.messages) msgs = conv.messages;
      }
      if (!msgs.length) msgs = JSON.parse(localStorage.getItem('fp_conversation') || '[]');
      msgs.forEach(function(m) { appendMessage(m.role, m.content); window._chatHistory.push(m); });
    } catch(e) {}
  }

  function renderChatHistory() {
    output.innerHTML = '';
    window._chatHistory.forEach(m => { appendMessage(m.role, m.content); });
  }

  function renderFilteredChat(query) {
    if (!query) { renderChatHistory(); return; }
    const lower = query.toLowerCase();
    const filtered = window._chatHistory.filter(m => (m.content || '').toLowerCase().includes(lower));
    if (!filtered.length) {
      output.innerHTML = '<div style="padding:var(--space-4);text-align:center;color:var(--ink-soft);font-size:var(--fs-sm);">Aucun message trouvé pour « ' + escapeHTML(query) + ' »</div>';
      return;
    }
    output.innerHTML = '';
    filtered.forEach(m => {
      const div = document.createElement('div');
      div.className = 'chat-msg ' + (m.role === 'user' ? 'user' : 'bot');
      div.dir = 'auto';
      if (m.role === 'assistant' || m.role === 'bot') {
        div.innerHTML = renderMarkdown(m.content);
        if (query) {
          const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
          div.innerHTML = div.innerHTML.replace(re, '<mark style="background:var(--gold);color:var(--ink);padding:0 2px;border-radius:2px;">$1</mark>');
        }
      } else {
        div.textContent = m.content;
      }
      output.appendChild(div);
    });
  }
}

loadSavedPrompts();
