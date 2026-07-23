const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const router = Router();

const KEYS_PATH = path.join(__dirname, '../../data/keys.json');

function readKeys() {
  try { return JSON.parse(fs.readFileSync(KEYS_PATH, 'utf-8') || '[]'); } catch { return []; }
}

function writeKeys(keys) {
  fs.writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2), 'utf-8');
}

function maskKey(key) {
  if (!key || key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

router.get('/', (req, res) => {
  const keys = readKeys();
  const masked = keys.map(k => ({ ...k, apiKey: maskKey(k.apiKey) }));
  res.json(masked);
});

router.get('/available', (req, res) => {
  const keys = readKeys();
  const envProviders = [];
  if (process.env.OPENAI_API_KEY) envProviders.push('openai');
  if (process.env.ANTHROPIC_API_KEY) envProviders.push('anthropic');
  if (process.env.GOOGLE_API_KEY) envProviders.push('google');

  const dbProviders = [...new Set(keys.map(k => k.provider))];
  const allProviders = [...new Set([...dbProviders, ...envProviders])];

  res.json({
    providers: allProviders,
    hasCustomKeys: keys.length > 0
  });
});

router.post('/', (req, res) => {
  const { provider, model, apiKey, endpoint } = req.body;
  if (!provider || !apiKey) {
    return res.status(400).json({ error: 'Fournisseur et clé API requis.' });
  }
  const keys = readKeys();
  const newKey = {
    id: 'key-' + Date.now(),
    provider,
    model: model || '',
    apiKey: apiKey.trim(),
    endpoint: endpoint || '',
    active: keys.length === 0
  };
  keys.push(newKey);
  writeKeys(keys);
  res.json({ ok: true, id: newKey.id, apiKey: maskKey(newKey.apiKey) });
});

router.put('/:id', (req, res) => {
  const { provider, model, apiKey, endpoint } = req.body;
  let keys = readKeys();
  const idx = keys.findIndex(k => k.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Clé introuvable.' });

  if (provider) keys[idx].provider = provider;
  if (model !== undefined) keys[idx].model = model;
  if (apiKey) keys[idx].apiKey = apiKey.trim();
  if (endpoint !== undefined) keys[idx].endpoint = endpoint;

  writeKeys(keys);
  res.json({ ok: true, apiKey: maskKey(keys[idx].apiKey) });
});

router.delete('/:id', (req, res) => {
  let keys = readKeys();
  keys = keys.filter(k => k.id !== req.params.id);
  if (keys.length > 0 && !keys.some(k => k.active)) keys[0].active = true;
  writeKeys(keys);
  res.json({ ok: true });
});

router.put('/:id/activate', (req, res) => {
  let keys = readKeys().map(k => ({ ...k, active: k.id === req.params.id }));
  writeKeys(keys);
  res.json({ ok: true });
});

module.exports = router;
