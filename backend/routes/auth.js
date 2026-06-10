const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
    }

    const result = await db.query(
      'SELECT * FROM admins WHERE username = $1 AND active = TRUE',
      [username]
    );
    const admin = result.rows[0];

    if (!admin) {
      return res.status(401).json({ error: 'Tên đăng nhập không tồn tại.' });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({ error: 'Mật khẩu không đúng.' });
    }

    // Cập nhật last_login
    await db.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);

    const token = jwt.sign(
      { id: admin.id, username: admin.username, ho_ten: admin.ho_ten },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      admin: { id: admin.id, username: admin.username, ho_ten: admin.ho_ten, chuc_vu: admin.chuc_vu }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
});

// POST /api/auth/change-password
const authMiddleware = require('../middleware/auth');
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
    }

    const result = await db.query('SELECT * FROM admins WHERE id = $1', [req.admin.id]);
    const admin = result.rows[0];
    const valid = await bcrypt.compare(old_password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Mật khẩu cũ không đúng.' });

    const hashed = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE admins SET password = $1 WHERE id = $2', [hashed, req.admin.id]);
    res.json({ message: 'Đổi mật khẩu thành công.' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
});

module.exports = router;
