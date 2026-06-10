const router = require('express').Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { logAccess } = require('../middleware/logger');

// GET /api/tthc — Tra cứu công khai
router.get('/', async (req, res) => {
  try {
    const { cap, q } = req.query;
    let sql = 'SELECT id, ten, cap, thoi_han, le_phi, doi_tuong, co_quan FROM tthc WHERE active = TRUE';
    const params = [];

    if (cap && ['xa','tinh','phi'].includes(cap)) {
      params.push(cap);
      sql += ` AND cap = $${params.length}`;
    }
    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      sql += ` AND (ten ILIKE $${params.length} OR doi_tuong ILIKE $${params.length})`;
    }
    sql += ' ORDER BY cap, ten';

    const result = await db.query(sql, params);
    logAccess('lookup', null, req);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi tải danh sách thủ tục.' });
  }
});

// GET /api/tthc/:id — Chi tiết thủ tục
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM tthc WHERE id = $1 AND active = TRUE',
      [parseInt(id)]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Không tìm thấy thủ tục.' });
    logAccess('detail', parseInt(id), req);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải chi tiết thủ tục.' });
  }
});

// ── ADMIN: Quản trị TTHC ──

// GET /api/tthc/admin/all — Lấy tất cả (kể cả inactive)
router.get('/admin/all', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tthc ORDER BY cap, ten');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải danh sách.' });
  }
});

// POST /api/tthc — Thêm mới
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { ten, cap, thoi_han, le_phi, doi_tuong, co_quan, trinh_tu, ho_so, can_cu } = req.body;
    if (!ten || !cap || !trinh_tu) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: tên, cấp, trình tự.' });
    }
    const result = await db.query(
      `INSERT INTO tthc (ten, cap, thoi_han, le_phi, doi_tuong, co_quan, trinh_tu, ho_so, can_cu)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [ten, cap, thoi_han||'Theo quy định', le_phi||'Không', doi_tuong, co_quan,
       JSON.stringify(trinh_tu), JSON.stringify(ho_so||[]), can_cu]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi thêm thủ tục.' });
  }
});

// PUT /api/tthc/:id — Cập nhật
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { ten, cap, thoi_han, le_phi, doi_tuong, co_quan, trinh_tu, ho_so, can_cu, active } = req.body;
    const result = await db.query(
      `UPDATE tthc SET ten=$1, cap=$2, thoi_han=$3, le_phi=$4, doi_tuong=$5, co_quan=$6,
       trinh_tu=$7, ho_so=$8, can_cu=$9, active=$10
       WHERE id=$11 RETURNING *`,
      [ten, cap, thoi_han, le_phi, doi_tuong, co_quan,
       JSON.stringify(trinh_tu), JSON.stringify(ho_so||[]), can_cu,
       active !== undefined ? active : true, parseInt(req.params.id)]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Không tìm thấy thủ tục.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật thủ tục.' });
  }
});

// DELETE /api/tthc/:id — Ẩn thủ tục (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await db.query('UPDATE tthc SET active = FALSE WHERE id = $1', [parseInt(req.params.id)]);
    res.json({ message: 'Đã ẩn thủ tục.' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xóa thủ tục.' });
  }
});

module.exports = router;
