const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token tidak ditemukan' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.merchant = decoded;
    next();

  } catch (err) {
    res.status(401).json({ error: 'Token tidak valid' });
  }
};

module.exports = authMiddleware;