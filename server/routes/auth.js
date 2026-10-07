const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let refreshTokens = new Set();

function signAccess(user) {

  return jwt.sign(

    { id: user._id, role: user.role },
    process.env.ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_EXPIRES || '15m' }
  );
}


function signRefresh(user) {

  return jwt.sign(
    { id: user._id },
    process.env.REFRESH_SECRET,

    { expiresIn: process.env.REFRESH_EXPIRES || '7d' }
  );
}


router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

    const exists = await User.findOne({ email });

    if (exists) return res.status(409).json({ error: 'Email in use' });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name, email, password: hashed,
      role: role === 'admin' ? 'admin' : 'member' 
    });
    res.status(201).json({ id: user._id, email: user.email, role: user.role });

  } catch (e) {
    res.status(500).json({ error: e.message });

  }
});


router.post('/login', async (req, res) => {

  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const accessToken = signAccess(user);

  const refreshToken = signRefresh(user);
  refreshTokens.add(refreshToken);

  res.json({ accessToken, refreshToken, role: user.role });
});


router.post('/refresh', (req, res) => {

  const { refreshToken } = req.body;

  if (!refreshToken || !refreshTokens.has(refreshToken)) {

    return res.status(401).json({ error: 'Invalid refresh token' });

  }
  try {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

    const newAccess = jwt.sign(
      { id: payload.id, role: payload.role || 'member' },
      process.env.ACCESS_SECRET,

      { expiresIn: process.env.ACCESS_EXPIRES || '15m' }
    );


    User.findById(payload.id).then(u => {
      const token = jwt.sign(
        { id: u._id, role: u.role },
        process.env.ACCESS_SECRET,
        { expiresIn: process.env.ACCESS_EXPIRES || '15m' }
      );

      res.json({ accessToken: token });

    });

  } catch (e) {
    return res.status(401).json({ error: 'Refresh expired' });
  }
});


router.post('/logout', (req, res) => {

  const { refreshToken } = req.body;
  refreshTokens.delete(refreshToken);
  
  res.json({ ok: true });
});

module.exports = router;
module.exports.refreshTokens = refreshTokens;