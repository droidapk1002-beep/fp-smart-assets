const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const router = Router();

const KEYS_PATH = path.join(__dirname, '../../data/keys.json');

function getKeys() {
  try { return JSON.parse(fs.readFileSync(KEYS_PATH, 'utf-8') || '[]'); } catch { return []; }
}

function getApiKey(provider) {
  const keys = getKeys();
  const managed = keys.filter(k => k.provider === provider);
  if (managed.length > 0) {
    const active = managed.find(k => k.active) || managed[0];
    return active.apiKey;
  }
  if (provider === 'openai') return process.env.OPENAI_API_KEY;
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY;
  if (provider === 'google') return process.env.GOOGLE_API_KEY;
  return null;
}

router.post('/fetch-head', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requise.' });
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
    const len = response.headers.get('Content-Length');
    res.json({ contentLength: len ? parseInt(len, 10) : null });
  } catch (err) {
    res.json({ contentLength: null, error: err.message });
  }
});

router.post('/fetch-range', async (req, res) => {
  const { url, range } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requise.' });
  try {
    const headers = {};
    if (range) headers['Range'] = range;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(buffer);
    res.json({ text, contentType: response.headers.get('Content-Type') || '' });
  } catch (err) {
    res.json({ text: '', error: err.message });
  }
});

router.post('/image/:provider', async (req, res) => {
  const { provider } = req.params;
  const { prompt } = req.body;
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    return res.status(500).json({ error: `Clé API ${provider} non configurée.` });
  }
  try {
    let url, headers = { 'Content-Type': 'application/json' }, body;
    if (provider === 'openai') {
      url = 'https://api.openai.com/v1/images/generations';
      headers['Authorization'] = 'Bearer ' + apiKey;
      body = { model: 'dall-e-3', prompt, n: 1, size: '1024x1024' };
    } else if (provider === 'google') {
      url = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=' + encodeURIComponent(apiKey);
      body = { instances: [{ prompt }], parameters: { sampleCount: 1 } };
    } else {
      return res.status(400).json({ error: 'Fournisseur d\'image non supporté. Utilise openai ou google.' });
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000)
    });
    const data = await response.json();
    if (!response.ok) {
      const msg = data?.error?.message || data?.error?.type || `HTTP ${response.status}`;
      return res.status(response.status).json({ error: msg });
    }
    res.json(data);
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({ error: 'Génération d\'image trop longue (timeout).' });
    }
    console.error(`[PROXY IMAGE] ${provider}:`, err.message);
    res.status(502).json({ error: `Erreur proxy image : ${err.message}` });
  }
});

router.post('/:provider', async (req, res) => {
  const { provider } = req.params;
  const { endpoint, body } = req.body;
  if (!provider) {
    return res.status(400).json({ error: 'Fournisseur requis (openai, anthropic, google, custom).' });
  }
  const apiKey = getApiKey(provider) || (provider === 'custom' ? req.body.apiKey : null);
  if (!apiKey && provider !== 'custom') {
    return res.status(500).json({ error: `Clé API ${provider} non configurée sur le serveur.` });
  }
  try {
    let url = endpoint;
    const headers = { 'Content-Type': 'application/json' };
    if (provider === 'openai') {
      url = endpoint || 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = 'Bearer ' + apiKey;
    } else if (provider === 'anthropic') {
      url = endpoint || 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else if (provider === 'google') {
      if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint requis pour Google.' });
      }
      url = endpoint + '?key=' + encodeURIComponent(apiKey);
    } else if (provider === 'custom') {
      if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint requis pour un fournisseur personnalisé.' });
      }
      headers['Authorization'] = 'Bearer ' + apiKey;
      url = endpoint;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    });
    const data = await response.json();
    if (!response.ok) {
      const msg = data?.error?.message || data?.error?.type || `HTTP ${response.status}`;
      return res.status(response.status).json({ error: msg });
    }
    res.json(data);
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({ error: 'L\'API du fournisseur ne répond pas (timeout).' });
    }
    console.error(`[PROXY] ${provider}:`, err.message);
    res.status(502).json({ error: `Erreur de proxy ${provider} : ${err.message}` });
  }
});

module.exports = router;
