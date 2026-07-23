function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Authentification requise. Connecte-toi d\'abord via /api/auth/login.' });
}

module.exports = { requireAuth };
