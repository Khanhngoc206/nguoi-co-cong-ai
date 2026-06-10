require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const bcrypt    = require('bcryptjs');
const db        = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security & Middleware ──
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// ── Rate limiting ──
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Quá nhiều yêu cầu, thử lại sau.' }
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Quá nhiều câu hỏi, thử lại sau 1 phút.' }
});

app.use('/api/', apiLimiter);
app.use('/api/chat', chatLimiter);

// ── Routes ──
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/tthc',     require('./routes/tthc'));
app.use('/api/chat',     require('./routes/chat'));
app.use('/api/stats',    require('./routes/stats'));
app.use('/api/bieu-mau', require('./routes/bieu-mau'));

// ── Phục vụ frontend tĩnh ──
app.use(express.static(path.join(__dirname, '../frontend/public')));

// SPA fallback — tất cả URL khác trả về index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
  }
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Lỗi không xác định từ máy chủ.' });
});

// ── Khởi động server ──
async function start() {
  try {
    await db.query('SELECT 1');
    console.log('✅ Kết nối PostgreSQL thành công');

    const existing = await db.query('SELECT id FROM admins LIMIT 1');

    if (existing.rows.length === 0) {
      const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 12);
      await db.query(
        `INSERT INTO admins (username, password, ho_ten, chuc_vu)
         VALUES ($1, $2, $3, $4)`,
        [
          process.env.ADMIN_USERNAME || 'admin',
          hashed,
          'Quản trị viên',
          'Cán bộ Phòng VH-XH'
        ]
      );
      console.log(`✅ Tài khoản admin mặc định: ${process.env.ADMIN_USERNAME || 'admin'} / ${process.env.ADMIN_PASSWORD || 'Admin@123'}`);
      console.log('⚠️  Hãy đổi mật khẩu sau khi đăng nhập lần đầu!');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
      console.log(`📋 Admin panel: http://localhost:${PORT}/admin`);
      console.log(`📥 Biểu mẫu API: http://localhost:${PORT}/api/bieu-mau`);
    });

  } catch (err) {
    console.error('❌ Không thể khởi động server:', err.message);
    console.error('Kiểm tra lại cấu hình PostgreSQL trong file .env');
    process.exit(1);
  }
}

start();
