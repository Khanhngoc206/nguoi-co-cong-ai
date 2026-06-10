const db = require('../db');

// Ghi log truy cập trang
async function logAccess(page, tthcId, req) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    await db.query(
      'INSERT INTO access_logs (page, tthc_id, ip_address, user_agent) VALUES ($1, $2, $3, $4)',
      [page, tthcId || null, ip.slice(0, 45), ua.slice(0, 500)]
    );
  } catch (e) {
    // Log lỗi nhưng không block request
    console.error('Access log error:', e.message);
  }
}

// Ghi log chat
async function logChat(sessionId, role, content, req) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    await db.query(
      'INSERT INTO chat_logs (session_id, role, content, ip_address) VALUES ($1, $2, $3, $4)',
      [sessionId, role, content.slice(0, 5000), ip.slice(0, 45)]
    );
  } catch (e) {
    console.error('Chat log error:', e.message);
  }
}

module.exports = { logAccess, logChat };
