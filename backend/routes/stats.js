const router = require('express').Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/stats — Thống kê tổng quan (yêu cầu đăng nhập)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
    const dateTo   = to   || new Date().toISOString().split('T')[0];

    const [
      totalVisits, pageBreakdown, topTTHC,
      chatCount, dailyVisits, tthcCount
    ] = await Promise.all([

      // Tổng lượt truy cập
      db.query(
        `SELECT COUNT(*) as total FROM access_logs
         WHERE created_at BETWEEN $1 AND $2::date + interval '1 day'`,
        [dateFrom, dateTo]
      ),

      // Phân tích theo trang
      db.query(
        `SELECT page, COUNT(*) as count FROM access_logs
         WHERE created_at BETWEEN $1 AND $2::date + interval '1 day'
         GROUP BY page ORDER BY count DESC`,
        [dateFrom, dateTo]
      ),

      // Top thủ tục được xem nhiều nhất
      db.query(
        `SELECT t.ten, t.cap, COUNT(a.id) as views
         FROM access_logs a
         JOIN tthc t ON a.tthc_id = t.id
         WHERE a.created_at BETWEEN $1 AND $2::date + interval '1 day'
           AND a.tthc_id IS NOT NULL
         GROUP BY t.id, t.ten, t.cap
         ORDER BY views DESC LIMIT 10`,
        [dateFrom, dateTo]
      ),

      // Tổng lượt chat
      db.query(
        `SELECT COUNT(*) as total FROM chat_logs
         WHERE role = 'user'
         AND created_at BETWEEN $1 AND $2::date + interval '1 day'`,
        [dateFrom, dateTo]
      ),

      // Truy cập theo ngày (30 ngày gần nhất)
      db.query(
        `SELECT DATE(created_at) as ngay, COUNT(*) as luot
         FROM access_logs
         WHERE created_at BETWEEN $1 AND $2::date + interval '1 day'
         GROUP BY DATE(created_at) ORDER BY ngay`,
        [dateFrom, dateTo]
      ),

      // Số thủ tục hiện có
      db.query('SELECT COUNT(*) as total FROM tthc WHERE active = TRUE'),
    ]);

    res.json({
      period: { from: dateFrom, to: dateTo },
      tong_luot_truy_cap: parseInt(totalVisits.rows[0].total),
      tong_luot_chat: parseInt(chatCount.rows[0].total),
      so_tthc: parseInt(tthcCount.rows[0].total),
      theo_trang: pageBreakdown.rows,
      top_tthc: topTTHC.rows,
      theo_ngay: dailyVisits.rows,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Lỗi tải thống kê.' });
  }
});

// GET /api/stats/chat-history — Xem lịch sử chat gần đây
router.get('/chat-history', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await db.query(
      `SELECT session_id, role, LEFT(content,200) as content, ip_address, created_at
       FROM chat_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải lịch sử chat.' });
  }
});

module.exports = router;
