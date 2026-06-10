# Hệ thống hỗ trợ Người có Công — UBND Xã Dầu Tiếng

## Kiến trúc hệ thống

```
project/
├── backend/                  # Node.js + Express
│   ├── db/
│   │   ├── index.js          # PostgreSQL connection pool
│   │   └── schema.sql        # Schema + dữ liệu mẫu 15 TTHC
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication
│   │   └── logger.js         # Ghi log truy cập & chat
│   ├── routes/
│   │   ├── auth.js           # Đăng nhập, đổi mật khẩu
│   │   ├── tthc.js           # CRUD thủ tục hành chính
│   │   ├── chat.js           # Proxy Anthropic API
│   │   └── stats.js          # Thống kê truy cập
│   ├── server.js             # Entry point Express
│   ├── package.json
│   └── .env.example          # Cấu hình môi trường
│
└── frontend/
    └── public/
        ├── index.html        # Trang người dân (SPA)
        ├── css/main.css      # Style toàn bộ trang
        ├── js/app.js         # Logic frontend
        └── admin/
            └── index.html    # Admin panel quản trị
```

## Tính năng

### Trang người dân (`/`)
- **Chatbot AI** tư vấn 24/7, tích hợp Claude API
- **Tra cứu TTHC** với lọc theo cấp, tìm kiếm
- **Đọc to (TTS)** hỗ trợ người cao tuổi
- **Nhận giọng nói** thay vì gõ bàn phím
- Responsive trên mobile

### Admin panel (`/admin`)
- **Đăng nhập** bằng JWT, bảo mật
- **Quản lý TTHC**: thêm, sửa, ẩn/hiện thủ tục
- **Thống kê** lượt truy cập, tư vấn AI theo ngày
- **Lịch sử chat** giữa người dân và AI

---

## Hướng dẫn cài đặt

### Yêu cầu hệ thống
- Node.js >= 18
- PostgreSQL >= 14
- npm >= 9

### Bước 1 — Tạo database PostgreSQL

```sql
-- Kết nối vào PostgreSQL với quyền admin
psql -U postgres

-- Tạo database
CREATE DATABASE nguoi_co_cong;

-- Chạy schema
\c nguoi_co_cong
\i backend/db/schema.sql
```

### Bước 2 — Cấu hình môi trường

```bash
cd backend
cp .env.example .env
```

Mở file `.env` và điền thông tin:

```env
PORT=3000
NODE_ENV=production

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nguoi_co_cong
DB_USER=postgres
DB_PASSWORD=MẬT_KHẨU_POSTGRESQL_CỦA_BẠN

# JWT (đổi thành chuỗi ngẫu nhiên dài ít nhất 32 ký tự)
JWT_SECRET=thay_bang_chuoi_ngau_nhien_rat_dai_va_phuc_tap_o_day

# Anthropic API Key (lấy tại console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-...

# Tài khoản admin mặc định (đổi sau khi cài)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@2025
```

### Bước 3 — Cài đặt và chạy

```bash
cd backend
npm install
npm start
```

Truy cập:
- **Trang người dân**: http://localhost:3000
- **Admin panel**: http://localhost:3000/admin
- **API**: http://localhost:3000/api/tthc

### Bước 4 — Đăng nhập admin lần đầu

1. Mở http://localhost:3000/admin
2. Đăng nhập bằng username/password đã đặt trong `.env`
3. **Ngay sau khi đăng nhập, đổi mật khẩu** tại phần cài đặt

---

## API Reference

### Công khai (không cần đăng nhập)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/tthc` | Lấy danh sách TTHC (`?cap=xa&q=từ_khóa`) |
| GET | `/api/tthc/:id` | Chi tiết 1 thủ tục |
| POST | `/api/chat` | Gửi câu hỏi cho AI |

### Cần đăng nhập (Header: `Authorization: Bearer <token>`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/login` | Đăng nhập, nhận JWT |
| POST | `/api/auth/change-password` | Đổi mật khẩu |
| GET | `/api/tthc/admin/all` | Lấy tất cả TTHC (kể cả ẩn) |
| POST | `/api/tthc` | Thêm thủ tục mới |
| PUT | `/api/tthc/:id` | Cập nhật thủ tục |
| DELETE | `/api/tthc/:id` | Ẩn thủ tục (soft delete) |
| GET | `/api/stats` | Thống kê (`?from=YYYY-MM-DD&to=YYYY-MM-DD`) |
| GET | `/api/stats/chat-history` | Lịch sử chat AI |

---

## Deploy lên server thực tế (Ubuntu/VPS)

### Cài đặt PM2 để chạy nền

```bash
npm install -g pm2
pm2 start backend/server.js --name nguoi-co-cong
pm2 startup    # Tự khởi động khi server reboot
pm2 save
```

### Cấu hình Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name ten-domain-cua-ban.vn;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Bật HTTPS miễn phí với Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d ten-domain-cua-ban.vn
```

---

## Bổ sung đầy đủ 44 TTHC

File `backend/db/schema.sql` hiện có sẵn 15 thủ tục mẫu.  
Để thêm 29 thủ tục còn lại từ Sổ tay hướng dẫn:

**Cách 1 — Qua Admin panel** (khuyến nghị):
1. Đăng nhập vào `/admin`
2. Chọn "Quản lý TTHC" → "+ Thêm thủ tục"
3. Điền thông tin và lưu

**Cách 2 — Thêm vào schema.sql**:
Copy theo cú pháp INSERT có sẵn trong file `schema.sql`

---

## Lưu ý bảo mật

- ❌ Không commit file `.env` lên Git
- ✅ Đổi `JWT_SECRET` thành chuỗi ngẫu nhiên dài (dùng `openssl rand -base64 32`)
- ✅ Đổi mật khẩu admin ngay sau khi cài
- ✅ Dùng HTTPS khi deploy thật
- ✅ API key Anthropic chỉ lưu trong `.env` phía server, không để trong frontend

---

## Liên hệ hỗ trợ kỹ thuật

Phòng Văn hoá – Xã hội, UBND Xã Dầu Tiếng  
Sáng kiến ứng dụng AI hỗ trợ người có công — 2025
