/* ============================================================
   ASSISTANT — AI chat interface
   ============================================================ */

var FP_SYSTEM_PROMPT = 'Tu es un assistant p\u00e9dagogique sp\u00e9cialis\u00e9 dans la Formation Professionnelle en Alg\u00e9rie. R\u00e9ponds en fran\u00e7ais ou en arabe selon la langue de la question.';

async function callProvider(keyConfig, history, systemOverride, signal) {
  var systemPrompt = systemOverride || FP_SYSTEM_PROMPT;
  var apiKey = (typeof sanitizeApiKey === 'function')
    ? sanitizeApiKey(keyConfig.apiKey || '')
    : (keyConfig.apiKey || '').trim();
  var model = keyConfig.model || (PROVIDERS[keyConfig.provider] ? PROVIDERS[keyConfig.provider].defaultModel : '');

  if (keyConfig.provider === 'anthropic') {
    var messages = history.map(function(m) { return { role: m.role, content: m.content }; });
    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      signal: signal,
      body: JSON.stringify({ model: model, max_tokens: 1500, system: systemPrompt, messages: messages })
    });
    if (!res.ok) { var errText = ''; try { errText = (await res.text()).slice(0, 200); } catch(e) {} throw new Error('HTTP ' + res.status + (errText ? ' \u2014 ' + errText : '')); }
    var data = await res.json();
    return (data.content || []).filter(function(b) { return b.type === 'text'; }).map(function(b) { return b.text; }).join('\n') || '\u2026';
  }

  if (keyConfig.provider === 'openai') {
    var messages = [{ role: 'system', content: systemPrompt }];
    history.forEach(function(m) { messages.push({ role: m.role, content: m.content }); });
    var res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      signal: signal,
      body: JSON.stringify({ model: model, messages: messages, max_tokens: 1500 })
    });
    if (!res.ok) { var errText = ''; try { errText = (await res.text()).slice(0, 200); } catch(e) {} throw new Error('HTTP ' + res.status + (errText ? ' \u2014 ' + errText : '')); }
    var data = await res.json();
    return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '\u2026';
  }

  if (keyConfig.provider === 'google') {
    var contents = history.map(function(m) {
      return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
    });
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + apiKey;
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: signal,
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: contents })
    });
    if (!res.ok) { var errText = ''; try { errText = (await res.text()).slice(0, 200); } catch(e) {} throw new Error('HTTP ' + res.status + (errText ? ' \u2014 ' + errText : '')); }
    var data = await res.json();
    return (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts || []).map(function(p) { return p.text; }).join('\n') || '\u2026';
  }

  if (keyConfig.provider === 'custom') {
    var endpoint = keyConfig.endpoint || (PROVIDERS.custom ? PROVIDERS.custom.endpoint : '');
    if (!endpoint) throw new Error('Endpoint manquant pour le fournisseur personnalis\u00e9');
    var messages = [{ role: 'system', content: systemPrompt }];
    history.forEach(function(m) { messages.push({ role: m.role, content: m.content }); });
    var res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      signal: signal,
      body: JSON.stringify({ model: model, messages: messages, max_tokens: 1500 })
    });
    if (!res.ok) { var errText = ''; try { errText = (await res.text()).slice(0, 200); } catch(e) {} throw new Error('HTTP ' + res.status + (errText ? ' \u2014 ' + errText : '')); }
    var data = await res.json();
    return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '\u2026';
  }

  throw new Error('Fournisseur non support\u00e9: ' + keyConfig.provider);
}

function initAssistant() {
  var form = document.getElementById('chat-form');
  var input = document.getElementById('chat-input');
  var output = document.getElementById('chat-output');
  var clearBtn = document.getElementById('clear-chat-btn');
  var keySelect = document.getElementById('key-select');
  var providerLabel = document.getElementById('provider-label');

  if (!form || !input || !output) return;

  window._chatHistory = [];
  loadConversation();
  populateKeySelect();
  wireInlineKeyManager();
  wireToolbarButtons();

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener('input', function() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    window._chatHistory.push({ role: 'user', content: text, timestamp: Date.now() });
    input.value = '';
    input.style.height = 'auto';
    saveConversation();

    var keyConfig = typeof getSelectedKey === 'function' ? getSelectedKey() : null;
    if (!keyConfig) {
      var keys = getStoredKeys();
      if (!keys.length) {
        appendMessage('assistant', '\u26A0\uFE0F ' + (t('assistant.noProvider') || 'Aucune cl\u00e9 API configur\u00e9e. Ajoute une cl\u00e9 ci-dessous ou dans l\'onglet Administration \u2192 Cl\u00e9s API.'));
        saveConversation();
        return;
      }
      keyConfig = keys[0];
    }

    var thinkingId = appendMessage('assistant', '\u23F3 ' + (t('assistant.thinking') || 'R\u00e9flexion\u2026'));

    try {
      var history = [{ role: 'user', content: text }];
      var reply = await callProvider(keyConfig, history);
      document.getElementById(thinkingId) ? document.getElementById(thinkingId).remove() : null;
      appendMessage('assistant', reply);
      window._chatHistory.push({ role: 'assistant', content: reply, timestamp: Date.now() });
      generateSuggestions(text, reply);
    } catch (err) {
      document.getElementById(thinkingId) ? document.getElementById(thinkingId).remove() : null;
      var hint = '';
      if (/401/.test(err.message)) hint = '\n\n\u2753 V\u00e9rifie ta cl\u00e9 API.';
      else if (/404/.test(err.message)) hint = '\n\n\u2753 V\u00e9rifie le nom du mod\u00e8le (ex: gemini-2.5-flash, gpt-4.1, claude-sonnet-4-6).';
      else if (/429/.test(err.message)) hint = '\n\n\u23F3 Trop de requ\u00eates \u2014 attends quelques secondes.';
      appendMessage('assistant', '\u26A0\uFE0F Erreur: ' + err.message + hint);
    }
    saveConversation();
  });

  clearBtn ? clearBtn.addEventListener('click', function() {
    output.innerHTML = '';
    window._chatHistory = [];
    localStorage.removeItem('fp_conversation');
  }) : null;

  function wireToolbarButtons() {
    // Conversation sidebar toggle
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

    // Conversation management
    function getConversations() {
      try { return JSON.parse(localStorage.getItem('fp_conversations') || '[]'); } catch(e) { return []; }
    }
    function saveConversations(list) {
      localStorage.setItem('fp_conversations', JSON.stringify(list));
    }
    function getCurrentConvId() {
      return localStorage.getItem('fp_current_conv') || '';
    }
    function setCurrentConvId(id) {
      localStorage.setItem('fp_current_conv', id);
    }

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

    // Search toggle
    var searchInp = document.getElementById('chat-search-inp');
    var searchToggle = document.getElementById('toggle-search-btn');
    if (searchInp && searchToggle) {
      searchToggle.onclick = function() {
        searchInp.style.display = searchInp.style.display === 'none' ? '' : 'none';
        if (searchInp.style.display === 'none') {
          searchInp.value = '';
          output.querySelectorAll('.chat-msg').forEach(function(m) { m.style.display = ''; });
        } else {
          searchInp.focus();
        }
      };
      searchInp.oninput = function() {
        var q = this.value.trim().toLowerCase();
        output.querySelectorAll('.chat-msg').forEach(function(m) {
          if (!q) { m.style.display = ''; return; }
          m.style.display = m.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      };
    }

    // Export chat
    var exportBtn = document.getElementById('export-chat-btn');
    if (exportBtn) {
      exportBtn.onclick = function(e) {
        var msgs = (window._chatHistory || []).map(function(m) { return { role: m.role, content: m.content }; });
        if (!msgs.length) { if (typeof showToast === 'function') showToast('Aucun message \u00e0 exporter.'); return; }
        showExportMenu(e.target || e.currentTarget, function(fmt) { exportChat(fmt, msgs); });
      };
    }

    // Saved prompts
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
      if (!savedPrompts.length) {
        promptsList.innerHTML = '<div style="padding:var(--space-2);font-size:var(--fs-xs);color:var(--ink-soft);text-align:center;">Aucun prompt sauvegard\u00e9</div>';
        return;
      }
      promptsList.innerHTML = savedPrompts.map(function(p) {
        return '<div class="prompt-item" style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-2);cursor:pointer;border-radius:var(--radius-sm);" data-text="' + escapeAttr(p.text) + '">' +
          '<span style="flex:1;font-size:var(--fs-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHTML(p.title) + '</span>' +
          '<button class="prompt-del" style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--red-stamp);padding:0 4px;">\u2715</button></div>';
      }).join('');
      promptsList.querySelectorAll('.prompt-item').forEach(function(el) {
        el.addEventListener('click', function(e) {
          if (e.target.closest('.prompt-del')) return;
          input.value = el.dataset.text;
          input.focus();
          promptsPanel.style.display = 'none';
        });
      });
      promptsList.querySelectorAll('.prompt-del').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var el = btn.closest('.prompt-item');
          var found = savedPrompts.findIndex(function(p) { return p.text === el.dataset.text; });
          if (found >= 0) deleteSavedPrompt(savedPrompts[found].id);
          setTimeout(renderPromptsList, 50);
        });
      });
    }

    // File attachment
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
          attachmentsDiv.innerHTML = '<div class="file-tag" style="display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1) var(--space-2);background:var(--kraft);border-radius:var(--radius-sm);font-size:var(--fs-xs);">\uD83D\uDCCE ' + escapeHTML(file.name) + ' <button class="file-remove" style="background:none;border:none;cursor:pointer;color:var(--red-stamp);">\u2715</button></div>';
          attachmentsDiv.querySelector('.file-remove').onclick = function() {
            fileInput.value = '';
            attachmentsDiv.innerHTML = '';
            if (imgPreview) imgPreview.style.display = 'none';
          };
        }
        // Show image preview
        if (imgPreview && file.type && file.type.startsWith('image/')) {
          var reader = new FileReader();
          reader.onload = function(ev) {
            imgPreview.querySelector('img').src = ev.target.result;
            imgPreview.style.display = '';
          };
          reader.readAsDataURL(file);
        } else if (imgPreview) {
          imgPreview.style.display = 'none';
        }
      };
    }
    if (imgRemove) {
      imgRemove.onclick = function() {
        fileInput.value = '';
        attachmentsDiv.innerHTML = '';
        imgPreview.style.display = 'none';
      };
    }
  }

  function generateSuggestions(userText, reply) {
    var chipsEl = document.getElementById('suggestion-chips');
    if (!chipsEl) return;
    var keyConfig = typeof getSelectedKey === 'function' ? getSelectedKey() : null;
    if (!keyConfig) return;
    (async function() {
      try {
        var prompt = 'Bas\u00e9 sur cette conversation, g\u00e9n\u00e8re 3 questions courtes (1 ligne chacune, s\u00e9par\u00e9es par "||") que l\'utilisateur pourrait poser.\n\nMessage: ' + userText.slice(0, 200) + '\nR\u00e9ponse: ' + reply.slice(0, 300);
        var sugReply = await callProvider(keyConfig, [{ role: 'user', content: prompt }]);
        var questions = sugReply.split('||').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 5; }).slice(0, 3);
        if (questions.length) {
          chipsEl.style.display = 'flex';
          chipsEl.innerHTML = questions.map(function(q) { return '<button type="button" class="chip" data-prompt="' + escapeAttr(q) + '">' + escapeHTML(q) + '</button>'; }).join('');
          chipsEl.querySelectorAll('.chip').forEach(function(chip) {
            chip.addEventListener('click', function() {
              input.value = chip.dataset.prompt || chip.textContent;
              input.focus();
              chipsEl.innerHTML = '';
              chipsEl.style.display = 'none';
            });
          });
        }
      } catch(e) {}
    })();
  }

  function populateKeySelect() {
    var keys = getStoredKeys();
    if (!keySelect) return;
    keySelect.innerHTML = keys.length
      ? keys.map(function(k, i) {
          var label = (PROVIDERS[k.provider] ? PROVIDERS[k.provider].label : k.provider);
          var model = k.model || (PROVIDERS[k.provider] ? PROVIDERS[k.provider].defaultModel : '');
          return '<option value="' + k.id + '">' + escapeHTML(label) + ' \u2014 ' + escapeHTML(model) + '</option>';
        }).join('')
      : '<option value="">' + (t('assistant.noProvider') || 'Aucune cl\u00e9 configur\u00e9e') + '</option>';
    if (providerLabel) {
      var active = getSelectedKey();
      if (active) {
        var lbl = (PROVIDERS[active.provider] ? PROVIDERS[active.provider].label : active.provider);
        providerLabel.textContent = lbl + ' / ' + (active.model || (PROVIDERS[active.provider] ? PROVIDERS[active.provider].defaultModel : ''));
      } else {
        providerLabel.textContent = (t('assistant.noProvider') || 'Aucune cl\u00e9');
      }
    }
    keySelect.addEventListener('change', function() {
      var keys = getStoredKeys();
      var k = keys.find(function(k) { return k.id === keySelect.value; });
      if (k) {
        k.active = true;
        saveStoredKeys(keys.map(function(x) { x.active = (x.id === k.id); return x; }));
      }
      if (providerLabel && k) {
        var lbl = (PROVIDERS[k.provider] ? PROVIDERS[k.provider].label : k.provider);
        providerLabel.textContent = lbl + ' / ' + (k.model || (PROVIDERS[k.provider] ? PROVIDERS[k.provider].defaultModel : ''));
      }
    });
  }

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
      if (!apiKey) { showToast('Cl\u00e9 API requise'); return; }
      var keys = getStoredKeys();
      keys.push({ id: 'key-' + Date.now(), provider: provider, apiKey: apiKey, model: model, active: keys.length === 0 });
      saveStoredKeys(keys);
      addForm.reset();
      document.getElementById('assistant-key-model').placeholder = 'Mod\u00e8le: ' + (PROVIDERS[provider] ? PROVIDERS[provider].defaultModel : '');
      renderInlineKeyList();
      populateKeySelect();
      showToast('Cl\u00e9 ajout\u00e9e !');
    });

    var apiKeyInput = document.getElementById('assistant-key-apikey');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('input', function() {
        var val = apiKeyInput.value.trim();
        var detected = detectProvider(val);
        if (detected) {
          document.getElementById('assistant-key-provider').value = detected;
          var modelInput = document.getElementById('assistant-key-model');
          if (modelInput && !modelInput.value) modelInput.placeholder = 'Mod\u00e8le: ' + (PROVIDERS[detected] ? PROVIDERS[detected].defaultModel : '');
        }
      });
    }

    function renderInlineKeyList() {
      var keys = getStoredKeys();
      if (!keys.length) {
        list.innerHTML = '<p style="color:var(--ink-soft);font-size:var(--fs-sm);">Aucune cl\u00e9 configur\u00e9e. Ajoute une cl\u00e9 pour utiliser l\'assistant IA.</p>';
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
          '<button class="btn btn-danger btn-xs assistant-key-del" data-idx="' + i + '" title="Supprimer">\u2715</button>' +
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
          showToast('Cl\u00e9 supprim\u00e9e');
        });
      });
    }
  }

  function appendMessage(role, content) {
    var id = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    var div = document.createElement('div');
    div.id = id;
    div.className = 'chat-msg ' + role;
    div.textContent = content;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
    return id;
  }

  function saveConversation() {
    var msgs = [];
    output.querySelectorAll('.chat-msg').forEach(function(el) {
      msgs.push({ role: el.classList.contains('user') ? 'user' : 'assistant', content: el.textContent });
    });
    localStorage.setItem('fp_conversation', JSON.stringify(msgs));
    // Also save to conversation list
    var convs = [];
    try { convs = JSON.parse(localStorage.getItem('fp_conversations') || '[]'); } catch(e) {}
    var currentId = localStorage.getItem('fp_current_conv') || '';
    var conv = convs.find(function(c) { return c.id === currentId; });
    if (conv) {
      conv.messages = msgs;
      if (!conv.title || conv.title === 'Nouvelle conversation') {
        var firstUser = msgs.find(function(m) { return m.role === 'user'; });
        if (firstUser) conv.title = firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? '...' : '');
      }
    } else if (msgs.length) {
      var newConv = { id: currentId || 'conv-' + Date.now(), title: msgs.find(function(m) { return m.role === 'user'; }) ? msgs.find(function(m) { return m.role === 'user'; }).content.slice(0, 50) : 'Nouvelle conversation', messages: msgs, created: Date.now() };
      convs.unshift(newConv);
      localStorage.setItem('fp_current_conv', newConv.id);
    }
    localStorage.setItem('fp_conversations', JSON.stringify(convs));
  }

  function loadConversation() {
    try {
      var saved = JSON.parse(localStorage.getItem('fp_conversation') || '[]');
      saved.forEach(function(m) { appendMessage(m.role, m.content); window._chatHistory.push(m); });
    } catch (e) {}
  }
}

/* ---- Shared helpers ---- */
function getDefaultModel(provider) {
  if (PROVIDERS && PROVIDERS[provider]) return PROVIDERS[provider].defaultModel;
  var defaults = { openai: 'gpt-4.1', anthropic: 'claude-sonnet-4-6', google: 'gemini-2.5-flash', custom: '' };
  return defaults[provider] || '';
}

function getProviderIcon(provider) {
  var icons = { openai: '\uD83E\uDD16', anthropic: '\uD83E\uDDE0', google: '\u2728', custom: '\u2699\uFE0F' };
  return icons[provider] || '\uD83D\uDD11';
}

function detectProvider(key) {
  if (!key) return '';
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-')) return 'openai';
  if (/^AIza[A-Za-z0-9_-]{30,}$/.test(key)) return 'google';
  if (key.length > 30 && !key.includes('-') && !key.includes(' ')) return 'google';
  return '';
}
