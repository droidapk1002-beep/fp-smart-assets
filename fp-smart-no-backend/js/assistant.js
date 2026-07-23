/* ============================================================
   ASSISTANT — AI chat interface
   ============================================================ */

function initAssistant() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const output = document.getElementById('chat-output');
  const clearBtn = document.getElementById('clear-chat-btn');
  const keySelect = document.getElementById('key-select');
  const providerLabel = document.getElementById('provider-label');

  if (!form || !input || !output) return;

  loadConversation();
  populateKeySelect();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    input.value = '';
    saveConversation();

    const keys = getStoredKeys();
    if (!keys.length) {
      appendMessage('assistant', t('assistant.noProvider'));
      saveConversation();
      return;
    }

    const idx = parseInt(keySelect?.value) || 0;
    const keyConfig = keys[idx] || keys[0];
    const thinkingId = appendMessage('assistant', '⏳ ' + t('assistant.thinking'));

    try {
      let reply = '';
      if (keyConfig.provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sanitizeApiKey(keyConfig.apiKey) },
          body: JSON.stringify({
            model: keyConfig.model || 'gpt-4o',
            messages: [{ role: 'system', content: 'Tu es un assistant pédagogique spécialisé dans la Formation Professionnelle en Algérie. Réponds en français ou en arabe selon la langue de la question.' }, { role: 'user', content: text }],
            max_tokens: 1024
          })
        });
        if (!res.ok) { reply = getErrorHint(res.status); } else {
          const data = await res.json();
          reply = data.choices?.[0]?.message?.content?.trim() || '⚠️ Pas de réponse';
        }
      } else if (keyConfig.provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': sanitizeApiKey(keyConfig.apiKey), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: keyConfig.model || 'claude-sonnet-4-20250514', max_tokens: 1024, system: 'Tu es un assistant pédagogique spécialisé dans la Formation Professionnelle en Algérie.', messages: [{ role: 'user', content: text }] })
        });
        if (!res.ok) { reply = getErrorHint(res.status); } else {
          const data = await res.json();
          reply = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || '⚠️ Pas de réponse';
        }
      } else if (keyConfig.provider === 'google') {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + keyConfig.model + ':generateContent?key=' + sanitizeApiKey(keyConfig.apiKey), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ system_instruction: { parts: [{ text: 'Tu es un assistant pédagogique spécialisé dans la Formation Professionnelle en Algérie.' }] }, contents: [{ role: 'user', parts: [{ text }] }] })
        });
        if (!res.ok) { reply = getErrorHint(res.status); } else {
          const data = await res.json();
          reply = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n').trim() || '⚠️ Pas de réponse';
        }
      } else {
        reply = 'Fournisseur non supporté: ' + keyConfig.provider;
      }
      document.getElementById(thinkingId)?.remove();
      appendMessage('assistant', reply);
    } catch (err) {
      document.getElementById(thinkingId)?.remove();
      appendMessage('assistant', '⚠️ Erreur: ' + err.message);
    }
    saveConversation();
  });

  clearBtn?.addEventListener('click', () => {
    output.innerHTML = '';
    localStorage.removeItem('fp_conversation');
  });

  function populateKeySelect() {
    const keys = getStoredKeys();
    if (!keySelect) return;
    keySelect.innerHTML = keys.map((k, i) =>
      '<option value="' + i + '">' + escapeHTML(k.provider) + ' — ' + escapeHTML(k.model) + '</option>'
    ).join('');
    if (providerLabel) {
      providerLabel.textContent = keys.length ? (keys[0].provider + ' / ' + keys[0].model) : t('assistant.noProvider');
    }
    keySelect.addEventListener('change', () => {
      const idx = parseInt(keySelect.value);
      const keys = getStoredKeys();
      if (providerLabel && keys[idx]) {
        providerLabel.textContent = keys[idx].provider + ' / ' + keys[idx].model;
      }
    });
  }

  function appendMessage(role, content) {
    const id = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const div = document.createElement('div');
    div.id = id;
    div.className = 'chat-msg ' + role;
    div.textContent = content;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
    return id;
  }

  function saveConversation() {
    const msgs = [];
    output.querySelectorAll('.chat-msg').forEach(el => {
      msgs.push({ role: el.classList.contains('user') ? 'user' : 'assistant', content: el.textContent });
    });
    localStorage.setItem('fp_conversation', JSON.stringify(msgs));
  }

  function loadConversation() {
    try {
      const saved = JSON.parse(localStorage.getItem('fp_conversation') || '[]');
      saved.forEach(m => appendMessage(m.role, m.content));
    } catch {}
  }

  function getErrorHint(status) {
    const hints = {
      400: '⚠️ Requête invalide',
      401: '⚠️ ' + t('assistant.hint401'),
      404: '⚠️ ' + t('assistant.hint404'),
      429: '⚠️ ' + t('assistant.hint429'),
    };
    return hints[status] || '⚠️ Erreur HTTP ' + status;
  }
}
