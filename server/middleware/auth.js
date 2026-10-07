const jwt = require('jsonwebtoken');

function auth(requiredRole) {
  return (req, res, next) => {

    const header = req.headers.authorization || '';

    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) return res.status(401).json({ error: 'No token' });

    try {
      const payload = jwt.verify(token, process.env.ACCESS_SECRET);

      req.user = payload; 
      if (requiredRole && payload.role !== requiredRole) {

        return res.status(403).json({ error: 'Forbidden: insufficient role' });

      }
      next();

    } catch (e) {
        
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

module.exports = auth;