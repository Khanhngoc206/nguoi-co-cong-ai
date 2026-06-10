const router = require('express').Router();
const fetch = require('node-fetch');
const db = require('../db');
const { logChat, logAccess } = require('../middleware/logger');

// ── Tìm TTHC liên quan ──
async function timTTHCLienQuan(cauHoi) {
  try {
    const q = cauHoi.toLowerCase().slice(0, 100);
    const result = await db.query(
      `SELECT id, ten, cap, thoi_han, le_phi, doi_tuong, co_quan, trinh_tu, ho_so, can_cu
       FROM tthc WHERE active = TRUE
         AND (ten ILIKE $1 OR doi_tuong ILIKE $1
           OR to_tsvector('simple', ten || ' ' || COALESCE(doi_tuong,''))
              @@ plainto_tsquery('simple', $2))
       LIMIT 3`,
      [`%${q}%`, q]
    );
    return result.rows;
  } catch (e) { return []; }
}

// ── Tìm chính sách / mức trợ cấp liên quan ──
async function timChinhSachLienQuan(cauHoi) {
  try {
    const q = cauHoi.toLowerCase().slice(0, 100);
    const result = await db.query(
      `SELECT nhom, doi_tuong, loai_tro_cap, muc_tien, don_vi, mo_ta, can_cu
       FROM chinh_sach WHERE active = TRUE
         AND (doi_tuong ILIKE $1 OR nhom ILIKE $1 OR mo_ta ILIKE $1
           OR to_tsvector('simple', doi_tuong || ' ' || COALESCE(mo_ta,''))
              @@ plainto_tsquery('simple', $2))
       ORDER BY nhom, loai_tro_cap
       LIMIT 5`,
      [`%${q}%`, q]
    );
    return result.rows;
  } catch (e) { return []; }
}

// ── Format TTHC ──
function formatTTHC(tthcs) {
  if (!tthcs.length) return '';
  const capLabel = { xa: 'Cấp xã', tinh: 'Cấp tỉnh', phi: 'Phi địa giới' };
  return tthcs.map(t => {
    const steps = Array.isArray(t.trinh_tu) ? t.trinh_tu : JSON.parse(t.trinh_tu || '[]');
    const docs  = Array.isArray(t.ho_so)    ? t.ho_so    : JSON.parse(t.ho_so   || '[]');
    return `
=== THỦ TỤC: ${t.ten} ===
- Cấp: ${capLabel[t.cap] || t.cap} | Thời hạn: ${t.thoi_han} | Phí: ${t.le_phi}
- Đối tượng: ${t.doi_tuong || '—'}
- Nơi nộp: ${t.co_quan || 'UBND cấp xã'}
- Trình tự: ${steps.map((s,i) => `Bước ${i+1}: ${s}`).join(' | ')}
- Hồ sơ: ${docs.join('; ')}
- Căn cứ: ${t.can_cu || '—'}`;
  }).join('\n');
}

// ── Format chính sách ──
function formatChinhSach(css) {
  if (!css.length) return '';
  const fmt = (n) => n ? n.toLocaleString('vi-VN') + ' đồng' : '—';
  return '\n=== MỨC TRỢ CẤP HIỆN HÀNH (NĐ 77/2024/NĐ-CP, từ 01/07/2024) ===\n' +
    css.map(c =>
      `• ${c.doi_tuong} — ${c.loai_tro_cap}: ${fmt(c.muc_tien)}/${c.don_vi?.replace('đồng/','') || 'tháng'} (${c.can_cu})`
    ).join('\n');
}

const SYSTEM_BASE = `Bạn là trợ lý AI chính thức của Phòng Văn hoá – Xã hội, UBND Xã Dầu Tiếng. Tư vấn chính sách ưu đãi và TTHC cho người có công và thân nhân.

Nguyên tắc:
- Trả lời tiếng Việt, ngắn gọn, dễ hiểu, phù hợp người cao tuổi
- Nếu có dữ liệu bên dưới, ƯU TIÊN dùng dữ liệu đó để trả lời — không tự bịa số tiền
- Nêu rõ mức tiền cụ thể nếu có trong dữ liệu, thời hạn, hồ sơ, nơi nộp
- Cuối câu trả lời luôn nhắc: đến Phòng VH-XH UBND Xã Dầu Tiếng để được hỗ trợ chính thức
- Tối đa 200 từ, dùng gạch đầu dòng cho danh sách`;

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { messages, session_id } = req.body;
    if (!messages || !Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'Thiếu nội dung tin nhắn.' });
    }

    const trimmed = messages.slice(-20);
    const lastUser = trimmed.filter(m => m.role === 'user').pop();

    if (lastUser) logChat(session_id || 'anon', 'user', lastUser.content, req);
    logAccess('chat', null, req);

    // ── Tìm dữ liệu liên quan song song ──
    let contextTTHC = '', contextCS = '';
    if (lastUser) {
      const [tthcs, css] = await Promise.all([
        timTTHCLienQuan(lastUser.content),
        timChinhSachLienQuan(lastUser.content),
      ]);
      if (tthcs.length) contextTTHC = '\n\n--- DỮ LIỆU THỦ TỤC TẠI XÃ DẦU TIẾNG ---' + formatTTHC(tthcs);
      if (css.length)   contextCS   = formatChinhSach(css);
    }

    const systemPrompt = SYSTEM_BASE
      + (contextTTHC || contextCS
          ? '\n\n' + contextTTHC + contextCS + '\n--- HẾT DỮ LIỆU — hãy trả lời dựa trên dữ liệu trên ---'
          : '');

    // ── Gọi API ──
    const useGroq = !!process.env.GROQ_API_KEY;
    let reply = '';

    if (useGroq) {
      const res2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          max_tokens: 1024,
          messages: [{ role: 'system', content: systemPrompt }, ...trimmed],
        }),
      });
      if (!res2.ok) { console.error('Groq error:', await res2.text()); return res.status(502).json({ error: 'Không thể kết nối AI.' }); }
      const d = await res2.json();
      reply = d.choices?.[0]?.message?.content || 'Xin lỗi, có lỗi xảy ra.';
    } else {
      const geminiContents = trimmed.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const res2 = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: geminiContents,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
      });
      if (!res2.ok) { console.error('Gemini error:', await res2.text()); return res.status(502).json({ error: 'Không thể kết nối AI.' }); }
      const d = await res2.json();
      reply = d.candidates?.[0]?.content?.parts?.[0]?.text || 'Xin lỗi, có lỗi xảy ra.';
    }

    logChat(session_id || 'anon', 'assistant', reply, req);
    res.json({ reply });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' });
  }
});

module.exports = router;
