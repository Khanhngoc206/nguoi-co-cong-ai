const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// File biểu mẫu đang nằm trong:
// frontend/public/bieu-mau/cap-xa
// frontend/public/bieu-mau/cap-so
const BIEU_MAU_DIR = path.join(__dirname, '../../frontend/public/bieu-mau');

// Hàm chuẩn hóa tên file: bỏ dấu tiếng Việt, đưa về chữ thường
function normalizeFileName(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

// Tìm file thật trong thư mục, kể cả khi DB không dấu còn file thật có dấu
function findRealFile(fileName) {
  const dirs = ['cap-xa', 'cap-so'];
  const dbFileName = normalizeFileName(fileName);

  for (const dir of dirs) {
    const folderPath = path.join(BIEU_MAU_DIR, dir);

    if (!fs.existsSync(folderPath)) {
      continue;
    }

    const files = fs.readdirSync(folderPath);

    // Ưu tiên tìm đúng tuyệt đối trước
    const exactFile = files.find(f => f === fileName);
    if (exactFile) {
      return {
        filePath: path.join(folderPath, exactFile),
        realFileName: exactFile
      };
    }

    // Nếu không đúng tuyệt đối thì tìm bằng tên đã bỏ dấu
    const matchedFile = files.find(f => normalizeFileName(f) === dbFileName);
    if (matchedFile) {
      return {
        filePath: path.join(folderPath, matchedFile),
        realFileName: matchedFile
      };
    }
  }

  return null;
}

// GET /api/bieu-mau
router.get('/', async (req, res) => {
  try {
    const { cap, nhom, q } = req.query;

    let sql = 'SELECT * FROM bieu_mau WHERE active = TRUE';
    const params = [];

    if (cap && ['xa', 'so', 'ca'].includes(cap)) {
      params.push(cap);
      sql += ` AND (cap = $${params.length} OR cap = 'ca')`;
    }

    if (nhom) {
      params.push(`%${nhom}%`);
      sql += ` AND nhom ILIKE $${params.length}`;
    }

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (
        ten ILIKE $${params.length}
        OR mo_ta ILIKE $${params.length}
        OR nhom ILIKE $${params.length}
        OR ten_file ILIKE $${params.length}
      )`;
    }

    sql += `
      ORDER BY 
        cap,
        NULLIF(regexp_replace(ma_so, '[^0-9.]', '', 'g'), '')::float NULLS LAST,
        ma_so
    `;

    const result = await db.query(sql, params);
    res.json(result.rows);

  } catch (err) {
    console.error('Lỗi tải danh sách biểu mẫu:', err);
    res.status(500).json({ error: 'Lỗi tải danh sách biểu mẫu.' });
  }
});

// GET /api/bieu-mau/nhom-list
router.get('/nhom-list', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT nhom 
       FROM bieu_mau 
       WHERE active = TRUE AND nhom IS NOT NULL AND nhom <> ''
       ORDER BY nhom`
    );

    res.json(result.rows.map(r => r.nhom));

  } catch (err) {
    console.error('Lỗi tải nhóm biểu mẫu:', err);
    res.status(500).json({ error: 'Lỗi tải nhóm biểu mẫu.' });
  }
});

// GET /api/bieu-mau/by-tthc/:tthc_id
router.get('/by-tthc/:tthc_id', async (req, res) => {
  try {
    const tthcId = parseInt(req.params.tthc_id, 10);

    if (Number.isNaN(tthcId)) {
      return res.status(400).json({ error: 'Mã thủ tục không hợp lệ.' });
    }

    const result = await db.query(
      `SELECT bm.*
       FROM bieu_mau bm
       JOIN tthc_bieu_mau tbm ON bm.id = tbm.bieu_mau_id
       WHERE tbm.tthc_id = $1 AND bm.active = TRUE
       ORDER BY bm.ma_so`,
      [tthcId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('Lỗi tải biểu mẫu theo TTHC:', err);
    res.status(500).json({ error: 'Lỗi tải biểu mẫu.' });
  }
});

// GET /api/bieu-mau/tai/:id
router.get('/tai/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Mã biểu mẫu không hợp lệ.' });
    }

    const result = await db.query(
      'SELECT * FROM bieu_mau WHERE id = $1 AND active = TRUE',
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Không tìm thấy biểu mẫu.' });
    }

    const bm = result.rows[0];

    if (!bm.ten_file) {
      return res.status(404).json({ error: 'Biểu mẫu chưa có tên file.' });
    }

    const found = findRealFile(bm.ten_file);

    if (!found) {
      console.log('Không tìm thấy file:', bm.ten_file);
      console.log('Thư mục đang kiểm tra:', BIEU_MAU_DIR);

      return res.status(404).json({
        error: 'File biểu mẫu chưa được tải lên server.',
        ten_file_trong_database: bm.ten_file
      });
    }

    await db.query(
      'UPDATE bieu_mau SET luot_tai = COALESCE(luot_tai, 0) + 1 WHERE id = $1',
      [bm.id]
    );

    return res.download(found.filePath, found.realFileName);

  } catch (err) {
    console.error('Lỗi tải file:', err);
    res.status(500).json({ error: 'Lỗi tải file.' });
  }
});

// GET /api/bieu-mau/admin/all
router.get('/admin/all', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * 
       FROM bieu_mau 
       ORDER BY cap, ma_so`
    );

    res.json(result.rows);

  } catch (err) {
    console.error('Lỗi tải admin biểu mẫu:', err);
    res.status(500).json({ error: 'Lỗi tải dữ liệu biểu mẫu.' });
  }
});

// POST /api/bieu-mau/lien-ket
router.post('/lien-ket', authMiddleware, async (req, res) => {
  try {
    const { tthc_id, bieu_mau_ids } = req.body;

    await db.query('DELETE FROM tthc_bieu_mau WHERE tthc_id = $1', [tthc_id]);

    for (const bmId of (bieu_mau_ids || [])) {
      await db.query(
        `INSERT INTO tthc_bieu_mau (tthc_id, bieu_mau_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [tthc_id, bmId]
      );
    }

    res.json({
      message: `Đã liên kết ${bieu_mau_ids?.length || 0} biểu mẫu.`
    });

  } catch (err) {
    console.error('Lỗi liên kết biểu mẫu:', err);
    res.status(500).json({ error: 'Lỗi liên kết.' });
  }
});

// PUT /api/bieu-mau/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { ten, nhom, cap, mo_ta, active } = req.body;
    const id = parseInt(req.params.id, 10);

    const result = await db.query(
      `UPDATE bieu_mau
       SET ten = $1,
           nhom = $2,
           cap = $3,
           mo_ta = $4,
           active = $5
       WHERE id = $6
       RETURNING *`,
      [ten, nhom, cap, mo_ta, active, id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Không tìm thấy biểu mẫu.' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Lỗi cập nhật biểu mẫu:', err);
    res.status(500).json({ error: 'Lỗi cập nhật.' });
  }
});

module.exports = router;