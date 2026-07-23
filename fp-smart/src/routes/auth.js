const { Router } = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives. Réessaie dans 15 minutes.' }
});

function simpleHash(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

const hash = simpleHash(ADMIN_PASSWORD);

router.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Mot de passe requis.' });
  }
  if (simpleHash(password) !== hash) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }
  req.session.authenticated = true;
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/check', (req, res) => {
  res.json({ authenticated: !!req.session?.authenticated });
});

module.exports = router;
