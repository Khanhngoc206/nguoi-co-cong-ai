-- ============================================
-- Schema: Hỗ trợ Người có Công - Xã Dầu Tiếng
-- ============================================

CREATE DATABASE IF NOT EXISTS nguoi_co_cong
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

\c nguoi_co_cong;

-- Bảng thủ tục hành chính
CREATE TABLE IF NOT EXISTS tthc (
  id          SERIAL PRIMARY KEY,
  ten         TEXT NOT NULL,
  cap         VARCHAR(10) NOT NULL CHECK (cap IN ('xa','tinh','phi')),
  thoi_han    VARCHAR(100) DEFAULT 'Theo quy định',
  le_phi      VARCHAR(100) DEFAULT 'Không',
  doi_tuong   TEXT,
  co_quan     TEXT,
  trinh_tu    JSONB NOT NULL DEFAULT '[]',
  ho_so       JSONB NOT NULL DEFAULT '[]',
  can_cu      TEXT,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng tài khoản cán bộ quản trị
CREATE TABLE IF NOT EXISTS admins (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(50) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  ho_ten      VARCHAR(100),
  chuc_vu     VARCHAR(100),
  active      BOOLEAN DEFAULT TRUE,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng lịch sử chat (lưu để thống kê)
CREATE TABLE IF NOT EXISTS chat_logs (
  id          SERIAL PRIMARY KEY,
  session_id  VARCHAR(64),
  role        VARCHAR(10) CHECK (role IN ('user','assistant')),
  content     TEXT,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng thống kê truy cập
CREATE TABLE IF NOT EXISTS access_logs (
  id          SERIAL PRIMARY KEY,
  page        VARCHAR(50),  -- 'home','chat','lookup','detail'
  tthc_id     INT REFERENCES tthc(id) ON DELETE SET NULL,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index tối ưu
CREATE INDEX idx_tthc_cap ON tthc(cap);
CREATE INDEX idx_tthc_active ON tthc(active);
CREATE INDEX idx_chat_logs_session ON chat_logs(session_id);
CREATE INDEX idx_chat_logs_created ON chat_logs(created_at);
CREATE INDEX idx_access_logs_created ON access_logs(created_at);
CREATE INDEX idx_access_logs_page ON access_logs(page);

-- Trigger tự cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tthc_updated_at
  BEFORE UPDATE ON tthc
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Dữ liệu mẫu: 15 thủ tục hành chính
-- ============================================
INSERT INTO tthc (ten, cap, thoi_han, le_phi, doi_tuong, co_quan, trinh_tu, ho_so, can_cu) VALUES

('Thăm viếng mộ liệt sĩ', 'xa', '5 ngày làm việc', 'Không',
 'Thân nhân liệt sĩ',
 'UBND cấp xã',
 '["Nộp đơn theo Mẫu số 31 kèm giấy tờ chứng minh thân nhân đến UBND cấp xã nơi quản lý hồ sơ gốc của liệt sĩ.", "UBND cấp xã kiểm tra hồ sơ và cấp giấy giới thiệu thăm viếng mộ trong thời hạn 3 ngày làm việc.", "Người đi thăm gửi giấy giới thiệu đã xác nhận đến UBND xã quản lý mộ.", "UBND xã thực hiện chi hỗ trợ thăm viếng trong 2 ngày làm việc kể từ khi nhận giấy."]',
 '["Đơn đề nghị theo mẫu (bản chính)", "Giấy chứng nhận gia đình hoặc thân nhân liệt sĩ (bản sao công chứng)", "Giấy báo tin mộ của Sở Nội vụ nơi quản lý mộ hoặc Giấy xác nhận thông tin về nơi liệt sĩ hy sinh"]',
 'Pháp lệnh 02/2020/UBTVQH14; Nghị định 131/2021/NĐ-CP'),

('Giải quyết chế độ trợ cấp thờ cúng liệt sĩ', 'xa', 'Theo quy định', 'Không',
 'Người được chỉ định thờ cúng liệt sĩ',
 'UBND cấp xã → Sở Nội vụ',
 '["Người đề nghị lập hồ sơ gửi UBND cấp xã nơi thường trú.", "UBND xã xác minh, niêm yết công khai danh sách tối thiểu 30 ngày.", "UBND xã tổ chức họp Hội đồng xác nhận người có công cấp xã trong 10 ngày sau niêm yết.", "Chuyển hồ sơ lên Sở Nội vụ thẩm định và ra quyết định giải quyết chế độ."]',
 '["Tờ khai của người đề nghị thờ cúng liệt sĩ (theo mẫu)", "Biên bản họp gia đình hoặc xác nhận của UBND xã về người thờ cúng", "Giấy tờ chứng minh quan hệ với liệt sĩ"]',
 'Pháp lệnh 02/2020/UBTVQH14; Nghị định 131/2021/NĐ-CP Điều 23'),

('Giải quyết chế độ ưu đãi đối với Bà Mẹ Việt Nam Anh hùng', 'xa', 'Theo quy định', 'Không',
 'Bà Mẹ Việt Nam Anh hùng hoặc thân nhân',
 'UBND cấp xã → Sở Nội vụ → UBND TP',
 '["Lập hồ sơ theo hướng dẫn, nộp tại UBND cấp xã nơi thường trú.", "UBND xã xem xét, lập biên bản và chuyển hồ sơ lên Sở Nội vụ.", "Sở Nội vụ thẩm định và trình UBND Thành phố ra quyết định phong tặng và giải quyết chế độ."]',
 '["Tờ khai đề nghị (theo mẫu)", "Lý lịch cá nhân của người được đề nghị", "Giấy tờ chứng minh công lao, cống hiến"]',
 'Pháp lệnh 02/2020/UBTVQH14; Nghị định 131/2021/NĐ-CP'),

('Cấp bổ sung hoặc cấp lại giấy chứng nhận người có công', 'xa', 'Theo quy định', 'Không',
 'Người có công và thân nhân người có công',
 'UBND cấp xã → Sở Nội vụ',
 '["Nộp đơn đề nghị kèm các giấy tờ liên quan tại UBND cấp xã nơi thường trú.", "UBND xã xác nhận tính hợp lệ của hồ sơ và chuyển lên cơ quan có thẩm quyền.", "Sở Nội vụ kiểm tra, xác minh và cấp bổ sung hoặc cấp lại giấy chứng nhận."]',
 '["Đơn đề nghị cấp bổ sung hoặc cấp lại (theo mẫu)", "Giấy tờ chứng minh lý do cần cấp lại (mất, hỏng, sai thông tin)", "Bản sao các giấy tờ gốc liên quan"]',
 'Pháp lệnh 02/2020/UBTVQH14'),

('Giải quyết hỗ trợ học tập đến trình độ đại học', 'xa', 'Theo quy định', 'Không',
 'Con em người có công đang học từ mầm non đến đại học',
 'UBND cấp xã → Sở Nội vụ',
 '["Người đề nghị nộp hồ sơ tại UBND cấp xã nơi thường trú vào đầu mỗi năm học.", "UBND xã xác nhận đối tượng và chuyển danh sách lên Sở Nội vụ.", "Sở Nội vụ thẩm định và thực hiện cấp tiền hỗ trợ học tập."]',
 '["Đơn đề nghị hưởng trợ cấp ưu đãi giáo dục (theo mẫu)", "Giấy tờ chứng minh quan hệ với người có công", "Giấy xác nhận đang theo học tại cơ sở giáo dục"]',
 'Nghị định 131/2021/NĐ-CP Điều 18'),

('Công nhận người bị thương trong chiến tranh (không thuộc quân đội, công an)', 'xa', 'Theo quy định', 'Không',
 'Người bị thương trực tiếp khi tham gia chiến đấu hoặc phục vụ chiến đấu',
 'UBND cấp xã → Sở Nội vụ → Bộ Nội vụ',
 '["Lập bản khai theo Mẫu số 08 kèm giấy tờ chứng minh, nộp UBND cấp xã nơi thường trú.", "UBND xã xác nhận, niêm yết công khai tối thiểu 30 ngày.", "Tổ chức họp Hội đồng xác nhận cấp xã trong 10 ngày sau niêm yết.", "Chuyển hồ sơ lên Sở Nội vụ thẩm định và ban hành quyết định công nhận."]',
 '["Bản khai cá nhân Mẫu số 08 (bản chính)", "Giấy tờ chứng minh bị thương (giấy ra viện, bệnh án, nhân chứng)", "Biên bản của cơ quan, tổ chức nơi xảy ra sự kiện (nếu có)"]',
 'Pháp lệnh 02/2020/UBTVQH14 Điều 23; Thông tư 05/2013/TT-BLĐTBXH'),

('Giải quyết trợ cấp khi người có công từ trần', 'xa', 'Theo quy định', 'Không',
 'Thân nhân của người có công đang hưởng trợ cấp ưu đãi',
 'UBND cấp xã',
 '["Thân nhân thông báo và lập hồ sơ đề nghị gửi UBND cấp xã trong thời hạn quy định.", "UBND xã xác nhận thông tin và làm thủ tục dừng trợ cấp của người đã mất.", "Xem xét và giải quyết chế độ trợ cấp một lần hoặc mai táng phí cho thân nhân."]',
 '["Giấy báo tử hoặc trích lục khai tử (bản sao)", "Đơn đề nghị của thân nhân (theo mẫu)", "Giấy tờ chứng minh quan hệ thân nhân"]',
 'Nghị định 131/2021/NĐ-CP'),

('Giải quyết chế độ mai táng phí đối với Cựu chiến binh', 'xa', '60 ngày kể từ ngày CCB từ trần', 'Không',
 'Thân nhân Cựu chiến binh từ trần',
 'UBND cấp xã',
 '["Thân nhân nộp hồ sơ đề nghị tại UBND cấp xã trong 60 ngày kể từ ngày Cựu chiến binh từ trần.", "UBND xã kiểm tra hồ sơ và xác nhận đối tượng là Cựu chiến binh.", "Thực hiện chi trả mai táng phí theo mức quy định hiện hành."]',
 '["Đơn đề nghị mai táng phí (theo mẫu)", "Giấy báo tử hoặc trích lục khai tử (bản sao)", "Giấy tờ chứng nhận Cựu chiến binh"]',
 'Pháp lệnh Cựu chiến binh; Nghị định 150/2006/NĐ-CP'),

('Hưởng trợ cấp và phụ cấp ưu đãi đối với người hoạt động cách mạng trước ngày 01/01/1945', 'xa', 'Theo quy định', 'Không',
 'Người tham gia hoạt động cách mạng trước 01/01/1945 và thân nhân',
 'UBND cấp xã → Sở Nội vụ',
 '["Người đề nghị hoặc thân nhân lập hồ sơ và nộp tại UBND cấp xã.", "UBND xã xác nhận lý lịch và niêm yết công khai 30 ngày.", "Chuyển hồ sơ lên Sở Nội vụ thẩm định và ra quyết định."]',
 '["Bản khai lý lịch người hoạt động cách mạng (theo mẫu)", "Giấy tờ chứng minh thời gian tham gia hoạt động", "Xác nhận của cơ quan, tổ chức hoặc nhân chứng"]',
 'Pháp lệnh 02/2020/UBTVQH14'),

('Bổ sung tình hình thân nhân trong hồ sơ liệt sĩ', 'xa', 'Theo quy định', 'Không',
 'Thân nhân liệt sĩ cần cập nhật thông tin trong hồ sơ',
 'UBND cấp xã → Sở Nội vụ',
 '["Thân nhân nộp đề nghị bổ sung thông tin kèm giấy tờ chứng minh tại UBND cấp xã.", "UBND xã xác nhận và chuyển hồ sơ lên Sở Nội vụ.", "Sở Nội vụ cập nhật thông tin vào hồ sơ gốc và thông báo kết quả cho thân nhân."]',
 '["Đơn đề nghị bổ sung thông tin (theo mẫu)", "Giấy tờ chứng minh thân nhân (khai sinh, hôn thú...)", "Các tài liệu liên quan cần bổ sung vào hồ sơ"]',
 'Nghị định 131/2021/NĐ-CP'),

('Giải quyết chế độ trợ cấp ưu đãi đối với thân nhân liệt sĩ', 'phi', 'Theo quy định', 'Không',
 'Thân nhân liệt sĩ (cha mẹ, vợ/chồng, con)',
 'Sở Nội vụ (phi địa giới - nộp tại nơi đang cư trú)',
 '["Nộp hồ sơ tại Sở Nội vụ nơi thân nhân đang thường trú (không phụ thuộc địa giới hành chính).", "Sở Nội vụ kiểm tra, xác minh hồ sơ và đối chiếu với hồ sơ gốc liệt sĩ.", "Ra quyết định và thực hiện chi trả trợ cấp hàng tháng cho thân nhân."]',
 '["Tờ khai đề nghị hưởng trợ cấp ưu đãi (theo mẫu)", "Giấy tờ chứng minh quan hệ thân nhân với liệt sĩ", "Bản trích lục hồ sơ liệt sĩ"]',
 'Pháp lệnh 02/2020/UBTVQH14; Nghị định 131/2021/NĐ-CP'),

('Công nhận thương binh, người hưởng chính sách như thương binh', 'phi', 'Theo quy định', 'Không',
 'Người bị thương trong chiến đấu hoặc bảo vệ Tổ quốc',
 'Sở Nội vụ (phi địa giới)',
 '["Nộp hồ sơ tại Sở Nội vụ nơi cư trú hiện tại (không phụ thuộc địa giới hành chính).", "Sở Nội vụ kiểm tra hồ sơ và tổ chức giám định thương tật tại Hội đồng Y khoa có thẩm quyền.", "Sở Nội vụ ra quyết định công nhận thương binh và giải quyết chế độ trợ cấp theo tỷ lệ tổn thương."]',
 '["Bản khai cá nhân (theo mẫu)", "Giấy tờ chứng minh quá trình tham gia chiến đấu", "Kết quả giám định y tế về thương tích"]',
 'Pháp lệnh 02/2020/UBTVQH14 Điều 23'),

('Phụ cấp đặc biệt hằng tháng cho thương binh tổn thương từ 81% trở lên', 'phi', 'Theo quy định', 'Không',
 'Thương binh hoặc bệnh binh có tỷ lệ tổn thương cơ thể từ 81% trở lên',
 'Cơ quan đang chi trả trợ cấp (phi địa giới)',
 '["Nộp hồ sơ tại cơ quan đang thực hiện chi trả trợ cấp ưu đãi hàng tháng.", "Cơ quan xác minh kết quả giám định tỷ lệ tổn thương cơ thể từ Hội đồng Y khoa.", "Ra quyết định và thực hiện chi trả phụ cấp đặc biệt bổ sung hằng tháng."]',
 '["Đơn đề nghị hưởng phụ cấp đặc biệt (theo mẫu)", "Biên bản giám định y khoa xác nhận tỷ lệ tổn thương từ 81%", "Quyết định trợ cấp thương binh hoặc bệnh binh hiện hành"]',
 'Nghị định 131/2021/NĐ-CP Điều 42'),

('Cấp Bằng Tổ quốc ghi công (chưa được cấp)', 'tinh', 'Theo quy định', 'Không',
 'Thân nhân liệt sĩ hy sinh chưa từng được cấp Bằng Tổ quốc ghi công',
 'Sở Nội vụ TP.HCM → Bộ Nội vụ',
 '["Nộp hồ sơ đề nghị tại Sở Nội vụ Thành phố Hồ Chí Minh.", "Sở Nội vụ kiểm tra và xác minh thông tin liệt sĩ với hồ sơ gốc lưu trữ.", "Sở trình Bộ Nội vụ xét duyệt và tổ chức cấp Bằng Tổ quốc ghi công."]',
 '["Đơn đề nghị cấp Bằng Tổ quốc ghi công (theo mẫu)", "Bản trích lục hồ sơ liệt sĩ", "Giấy tờ chứng minh thân nhân liệt sĩ"]',
 'Pháp lệnh 02/2020/UBTVQH14 Điều 7'),

('Cấp đổi Bằng Tổ quốc ghi công (hỏng hoặc sai thông tin)', 'tinh', 'Theo quy định', 'Không',
 'Thân nhân liệt sĩ có Bằng cũ bị hỏng, mờ hoặc ghi sai thông tin',
 'Sở Nội vụ TP.HCM',
 '["Nộp hồ sơ kèm Bằng cũ tại Sở Nội vụ Thành phố Hồ Chí Minh.", "Sở Nội vụ kiểm tra Bằng cũ và đối chiếu với hồ sơ gốc liệt sĩ.", "Sở cấp đổi Bằng mới theo mẫu hiện hành và bàn giao cho thân nhân."]',
 '["Đơn đề nghị cấp đổi Bằng Tổ quốc ghi công (theo mẫu)", "Bằng Tổ quốc ghi công cũ (nộp lại)", "Giấy tờ chứng minh thân nhân liệt sĩ"]',
 'Pháp lệnh 02/2020/UBTVQH14; Thông tư 03/2021/TT-BNV');

