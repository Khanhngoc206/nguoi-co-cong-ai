// ── STATE ──
let autoRead = true;
let selectedVoiceName = '';
let globalSpeed = 1;
let activeFilter = '';
let allProcs = [];
let chatHistory = [];
const SESSION_ID = Math.random().toString(36).slice(2);
let detailSpeechText = '';

// ── NAVIGATION ──
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  stopSpeech();
  if (id === 'lookup') loadProcs();
  if (id === 'bieumau') loadBieuMau();
}

function goChat(msg) {
  showPage('chat', document.querySelectorAll('.nav-btn')[1]);
  setTimeout(() => { document.getElementById('chat-input').value = msg; sendMsg(); }, 300);
}

// ================================================================
// ── SPEECH (TTS) — Phiên bản ổn định cho production HTTPS ──
// ================================================================
let voicesLoaded = false;
let pendingSpeak = null;
let resumeTimer = null;

function initTTS() {
  if (!window.speechSynthesis) return;

  const tryLoad = () => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      voicesLoaded = true;
      if (pendingSpeak) {
        const p = pendingSpeak;
        pendingSpeak = null;
        _doSpeak(p.text, p.rate, p.onEnd);
      }
    }
  };

  tryLoad();
  window.speechSynthesis.onvoiceschanged = tryLoad;
  setTimeout(tryLoad, 500);
  setTimeout(tryLoad, 1500);
}

function _doSpeak(text, rate, onEnd) {
  if (!window.speechSynthesis) return null;
  window.speechSynthesis.cancel();
  if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null; }

  const safeText = text.length > 500 ? text.substring(0, 500) + '.' : text;
  const u = new SpeechSynthesisUtterance(safeText);
  u.lang = 'vi-VN';
  u.rate = rate || globalSpeed;
  u.volume = 1;

  const voices = window.speechSynthesis.getVoices();
  const viVoice = selectedVoiceName
    ? voices.find(v => v.name === selectedVoiceName)
    : voices.find(v => v.lang === 'vi-VN')
      || voices.find(v => v.lang === 'vi')
      || voices.find(v => v.lang && v.lang.startsWith('vi'));
  if (viVoice) u.voice = viVoice;

  // Fix Chrome bug: TTS dừng sau ~15 giây
  resumeTimer = setInterval(() => {
    if (!window.speechSynthesis.speaking) {
      clearInterval(resumeTimer);
      resumeTimer = null;
      return;
    }
    window.speechSynthesis.pause();
    window.speechSynthesis.resume();
  }, 10000);

  u.onend = () => {
    if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null; }
    if (onEnd) onEnd();
  };
  u.onerror = () => {
    if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null; }
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(u);
  return u;
}

function speak(text, rate, onEnd) {
  if (!window.speechSynthesis || !text || !text.trim()) return null;

  if (!voicesLoaded) {
    pendingSpeak = { text, rate, onEnd };
    initTTS();
    // Fallback: đọc sau 2 giây dù giọng chưa load
    setTimeout(() => {
      if (pendingSpeak) {
        const p = pendingSpeak;
        pendingSpeak = null;
        _doSpeak(p.text, p.rate, p.onEnd);
      }
    }, 2000);
    return null;
  }

  return _doSpeak(text, rate, onEnd);
}

function stopSpeech() {
  pendingSpeak = null;
  if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null; }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  document.querySelectorAll('.read-btn.reading').forEach(b => {
    b.classList.remove('reading');
    b.textContent = '🔊 Nghe';
  });
  const rb = document.getElementById('d-read-btn');
  if (rb) rb.textContent = '▶ Nghe';
}

function readText(text, btn) {
  const wasReading = btn && btn.classList.contains('reading');
  stopSpeech();
  if (wasReading) return;
  if (btn) { btn.classList.add('reading'); btn.innerHTML = '<span class="pulse-dot"></span>Đang đọc...'; }
  speak(text, globalSpeed, () => {
    if (btn) { btn.classList.remove('reading'); btn.textContent = '🔊 Nghe'; }
  });
}

function readDetail() {
  const rate = parseFloat(document.getElementById('d-speed')?.value) || 1;
  const btn = document.getElementById('d-read-btn');
  if (btn) btn.innerHTML = '<span class="pulse-dot"></span>Đang đọc...';
  speak(detailSpeechText, rate, () => {
    if (btn) btn.textContent = '▶ Nghe';
  });
}

function toggleTTS() {
  autoRead = !autoRead;
  const sw = document.getElementById('tts-sw');
  if (sw) sw.classList.toggle('on', autoRead);
  if (autoRead) {
    initTTS();
    // Unlock audio trên iOS/mobile bằng utterance im lặng
    if (window.speechSynthesis) {
      const silent = new SpeechSynthesisUtterance(' ');
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
    }
  }
}

// Khởi động TTS khi trang load
window.addEventListener('load', initTTS);

// Unlock audio khi user tương tác lần đầu (bắt buộc trên iOS Safari)
document.addEventListener('click', function unlockAudio() {
  if (window.speechSynthesis) {
    const silent = new SpeechSynthesisUtterance(' ');
    silent.volume = 0;
    window.speechSynthesis.speak(silent);
    window.speechSynthesis.cancel();
  }
  if (!voicesLoaded) initTTS();
  document.removeEventListener('click', unlockAudio);
}, { once: true });

// ── VOICE INPUT ──
function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('Trình duyệt không hỗ trợ nhận diện giọng nói.\nVui lòng dùng Chrome hoặc Edge.'); return; }
  const r = new SR();
  r.lang = 'vi-VN'; r.interimResults = false;
  const btn = document.getElementById('mic-btn');
  btn.classList.add('active');
  r.start();
  r.onresult = e => { document.getElementById('chat-input').value = e.results[0][0].transcript; btn.classList.remove('active'); };
  r.onerror = () => btn.classList.remove('active');
  r.onend = () => btn.classList.remove('active');
}

// ── CHATBOT ──
async function sendMsg() {
  const inp = document.getElementById('chat-input');
  const txt = inp.value.trim();
  if (!txt) return;
  inp.value = '';
  addMsg('user', txt);
  document.getElementById('qpills').style.display = 'none';
  addTyping();
  chatHistory.push({ role: 'user', content: txt });

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory, session_id: SESSION_ID }),
    });
    const data = await res.json();
    removeTyping();
    const reply = data.reply || data.error || 'Xin lỗi, có lỗi xảy ra.';
    chatHistory.push({ role: 'assistant', content: reply });
    addMsg('bot', reply);
    if (autoRead) speak(reply);
  } catch (e) {
    removeTyping();
    addMsg('bot', 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng.');
  }
}

function sendQ(t) { document.getElementById('chat-input').value = t; sendMsg(); }

function addMsg(role, text) {
  const msgs = document.getElementById('chat-msgs');
  const d = document.createElement('div');
  d.className = 'msg-row ' + role;
  const clean = text.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  if (role === 'bot') {
    d.innerHTML = `<div class="msg-av bot-av">🤖</div>
      <div class="msg-group">
        <div class="bubble bot-bubble">${clean}</div>
        <button class="read-btn" onclick="readText(${JSON.stringify(text)},this)">🔊 Nghe</button>
      </div>`;
  } else {
    d.innerHTML = `<div class="msg-av user-av">B</div><div class="msg-group"><div class="bubble user-bubble">${clean}</div></div>`;
  }
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

function addTyping() {
  const msgs = document.getElementById('chat-msgs');
  const d = document.createElement('div');
  d.className = 'msg-row'; d.id = 'typing-row';
  d.innerHTML = '<div class="msg-av bot-av">🤖</div><div class="bubble bot-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
}
function removeTyping() { const t = document.getElementById('typing-row'); if (t) t.remove(); }

// ── LOOKUP ──
async function loadProcs() {
  const list = document.getElementById('proc-list');
  list.innerHTML = '<div class="loading">Đang tải danh sách thủ tục...</div>';
  try {
    const res = await fetch('/api/tthc');
    allProcs = await res.json();
    const el = document.getElementById('stat-tthc');
    if (el) el.textContent = allProcs.length;
    renderList();
  } catch (e) {
    list.innerHTML = '<div class="loading">Không thể tải danh sách. Vui lòng thử lại.</div>';
  }
}

function setFilter(f, el) {
  activeFilter = f;
  document.querySelectorAll('.fpill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  renderList();
}

function filterList() { renderList(); }

function renderList() {
  const q = (document.getElementById('s-input').value || '').toLowerCase();
  const capLabel = { xa: 'Cấp xã', tinh: 'Cấp tỉnh', phi: 'Phi địa giới' };
  const filtered = allProcs.filter(p =>
    (!activeFilter || p.cap === activeFilter) &&
    (!q || p.ten.toLowerCase().includes(q) || (p.doi_tuong||'').toLowerCase().includes(q))
  );
  if (!filtered.length) {
    document.getElementById('proc-list').innerHTML = '<div class="loading">Không tìm thấy thủ tục phù hợp</div>';
    return;
  }
  document.getElementById('proc-list').innerHTML = filtered.map(p => `
    <div class="proc-item" onclick="openDetail(${p.id})">
      <div class="proc-item-top">
        <div class="proc-item-name">${p.ten}</div>
        <div class="cap-badge cap-${p.cap}">${capLabel[p.cap]}</div>
      </div>
      <div class="proc-item-meta">
        <span>⏱ ${p.thoi_han}</span>
        <span>👥 ${(p.doi_tuong||'').substring(0,40)}${(p.doi_tuong||'').length>40?'...':''}</span>
      </div>
    </div>`).join('');
}

async function openDetail(id) {
  try {
    const res = await fetch(`/api/tthc/${id}`);
    const p = await res.json();
    const capLabel = { xa: 'Cấp xã — UBND xã tiếp nhận', tinh: 'Cấp tỉnh — Sở Nội vụ', phi: 'Phi địa giới' };
    const capClass = { xa: 'cap-xa', tinh: 'cap-tinh', phi: 'cap-phi' };
    const steps = Array.isArray(p.trinh_tu) ? p.trinh_tu : JSON.parse(p.trinh_tu || '[]');
    const docs  = Array.isArray(p.ho_so)    ? p.ho_so    : JSON.parse(p.ho_so  || '[]');

    document.getElementById('d-name').textContent = p.ten;
    document.getElementById('d-cap-badge').className = 'cap-badge ' + capClass[p.cap];
    document.getElementById('d-cap-badge').textContent = capLabel[p.cap];
    document.getElementById('d-time-badge').textContent = '⏱ ' + p.thoi_han;
    document.getElementById('d-time2').textContent = p.thoi_han;
    document.getElementById('d-phi').textContent = p.le_phi;
    document.getElementById('d-coquan').textContent = p.co_quan || '—';
    document.getElementById('d-doi').textContent = p.doi_tuong || '—';
    document.getElementById('d-steps').innerHTML = steps.map((s,i)=>
      `<div class="step-row"><div class="step-num">${i+1}</div><div class="step-text">${s}</div></div>`).join('');
    document.getElementById('d-docs').innerHTML = docs.length
      ? docs.map(d=>`<div class="doc-item"><div class="doc-dot"></div><span>${d}</span></div>`).join('')
      : '<div style="font-size:12px;color:#888">Liên hệ cơ quan để biết danh sách hồ sơ cụ thể.</div>';
    document.getElementById('d-cancu').textContent = p.can_cu || '—';
    document.getElementById('d-ai-btn').onclick = () => goChat(`Tôi cần hỗ trợ thêm về thủ tục: ${p.ten}`);

    detailSpeechText = `Thủ tục: ${p.ten}. Đối tượng: ${p.doi_tuong}. Cơ quan tiếp nhận: ${p.co_quan}. Thời hạn: ${p.thoi_han}. Lệ phí: ${p.le_phi}. Trình tự thực hiện: ${steps.map((s,i)=>`Bước ${i+1}: ${s}`).join('. ')}.`;

    document.getElementById('list-view').style.display = 'none';
    document.getElementById('detail-view').style.display = '';
    window.scrollTo(0,0);

    const detailBody = document.querySelector('.detail-body');
    if (detailBody) {
      let bmContainer = document.getElementById('bm-in-detail');
      if (bmContainer) bmContainer.remove();
      bmContainer = document.createElement('div');
      bmContainer.id = 'bm-in-detail';
      detailBody.appendChild(bmContainer);
      loadBieuMauForTTHC(id, bmContainer);
    }
  } catch(e) {
    alert('Không thể tải chi tiết thủ tục. Vui lòng thử lại.');
  }
}

function closeDetail() {
  stopSpeech();
  document.getElementById('list-view').style.display = '';
  document.getElementById('detail-view').style.display = 'none';
}

// ── BIỂU MẪU ──
let allBieuMau = [];
let bmFilter = { cap: '', nhom: '', q: '' };

async function loadBieuMau() {
  const list = document.getElementById('bm-list');
  if (!list) return;
  list.innerHTML = '<div class="loading">Đang tải danh sách biểu mẫu...</div>';
  try {
    const res = await fetch('/api/bieu-mau');
    allBieuMau = await res.json();
    await loadNhomFilter();
    renderBieuMau();
  } catch (e) {
    list.innerHTML = '<div class="loading">Không thể tải danh sách. Vui lòng thử lại.</div>';
  }
}

async function loadNhomFilter() {
  try {
    const res = await fetch('/api/bieu-mau/nhom-list');
    const nhoms = await res.json();
    const sel = document.getElementById('bm-nhom-filter');
    if (!sel) return;
    sel.innerHTML = '<option value="">Tất cả nhóm</option>' +
      nhoms.map(n => `<option value="${n}">${n}</option>`).join('');
  } catch(e) {}
}

function renderBieuMau() {
  const { cap, nhom, q } = bmFilter;
  const capLabel = { xa: 'Cấp xã', so: 'Cấp sở', ca: 'Cả hai cấp' };
  const filtered = allBieuMau.filter(bm =>
    (!cap || bm.cap === cap || bm.cap === 'ca') &&
    (!nhom || bm.nhom === nhom) &&
    (!q || bm.ten.toLowerCase().includes(q.toLowerCase()) ||
           (bm.mo_ta||'').toLowerCase().includes(q.toLowerCase()))
  );
  const list = document.getElementById('bm-list');
  if (!filtered.length) {
    list.innerHTML = '<div class="loading">Không tìm thấy biểu mẫu phù hợp.</div>';
    return;
  }
  const groups = {};
  filtered.forEach(bm => {
    const g = capLabel[bm.cap] || bm.cap;
    if (!groups[g]) groups[g] = [];
    groups[g].push(bm);
  });
  list.innerHTML = Object.entries(groups).map(([groupName, items]) => `
    <div class="bm-group">
      <div class="bm-group-title">${groupName} — ${items.length} biểu mẫu</div>
      ${items.map(bm => `
        <div class="bm-card">
          <div class="bm-card-left">
            <div class="bm-so">Mẫu ${bm.ma_so}</div>
            <div class="bm-ten">${bm.ten}</div>
            <div class="bm-meta">
              <span class="bm-nhom-tag">${bm.nhom}</span>
              ${bm.luot_tai > 0 ? `<span class="bm-luot">⬇ ${bm.luot_tai} lượt tải</span>` : ''}
              ${bm.mo_ta ? `<span class="bm-mota">${bm.mo_ta}</span>` : ''}
            </div>
          </div>
          <div class="bm-card-right">
            <a href="/api/bieu-mau/tai/${bm.id}"
               class="bm-download-btn"
               onclick="countDownload(${bm.id})"
               download>📥 Tải về</a>
          </div>
        </div>`).join('')}
    </div>`).join('');
}

function setBmFilter(key, value, el) {
  bmFilter[key] = value;
  if (el) {
    const group = el.closest('.bm-filter-group');
    if (group) group.querySelectorAll('.fpill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
  }
  renderBieuMau();
}

function filterBieuMau() {
  bmFilter.q = document.getElementById('bm-search')?.value || '';
  bmFilter.nhom = document.getElementById('bm-nhom-filter')?.value || '';
  renderBieuMau();
}

function countDownload(id) {
  const bm = allBieuMau.find(b => b.id === id);
  if (bm) bm.luot_tai = (bm.luot_tai || 0) + 1;
}

async function loadBieuMauForTTHC(tthcId, containerEl) {
  try {
    const res = await fetch(`/api/bieu-mau/by-tthc/${tthcId}`);
    const maus = await res.json();
    if (!maus.length) {
      containerEl.innerHTML = `
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid #eee">
          <div class="steps-title">📥 Biểu mẫu liên quan</div>
          <a href="#" onclick="showPage('bieumau',document.querySelectorAll('.nav-btn')[3]);return false;"
             style="font-size:13px;color:#1A2744;text-decoration:none;display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:8px 14px;background:#EAF0FF;border-radius:8px">
            🗂️ Xem tất cả biểu mẫu
          </a>
        </div>`;
      return;
    }
    containerEl.innerHTML = `
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid #eee">
        <div class="steps-title">📥 Biểu mẫu cần tải (${maus.length} file)</div>
        <div style="display:flex;flex-direction:column;gap:7px;margin-top:10px">
          ${maus.map(bm => `
            <a href="/api/bieu-mau/tai/${bm.id}" download
               style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#F7F6F3;border:1px solid #E5E2DC;border-radius:8px;text-decoration:none;color:#1C1C1C;transition:all .2s"
               onmouseover="this.style.borderColor='#1A2744'"
               onmouseout="this.style.borderColor='#E5E2DC'">
              <div>
                <div style="font-size:13px;font-weight:500">Mẫu ${bm.ma_so} — ${bm.ten}</div>
                ${bm.mo_ta ? `<div style="font-size:11px;color:#888;margin-top:2px">${bm.mo_ta}</div>` : ''}
              </div>
              <span style="background:#1A2744;color:#fff;padding:5px 12px;border-radius:6px;font-size:12px;white-space:nowrap;margin-left:10px">📥 Tải .doc</span>
            </a>`).join('')}
        </div>
      </div>`;
  } catch(e) {}
}

// ── INIT ──
(async () => {
  try {
    const res = await fetch('/api/tthc');
    const data = await res.json();
    const el = document.getElementById('stat-tthc');
    if (el) el.textContent = data.length;
  } catch(e) {}
})();
