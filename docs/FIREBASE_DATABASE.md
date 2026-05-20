# Firebase Realtime Database — cấu trúc & security rules

## So sánh rules tối thiểu vs đủ nhánh

| Bạn chỉ có | Thiếu (app sẽ lỗi PERMISSION_DENIED) |
|------------|--------------------------------------|
| `internalAnnouncements` | `attendance`, `seasonalAttendance`, `performanceData`, `bar`, `ng`, `mcDefectReport`, `areas`, `temperature_monitor`, `details`, `molds`, `honorBoard`, `downloads`, `warehouseInventoryDashboard`, `logs`, `userPreferences` |

File đầy đủ: `firebase/database.rules.json` — mọi nhánh `.read` / `.write`: `auth != null`.

| Rules cũ (root `.read/.write: true`) | Rủi ro |
|--------------------------------------|--------|
| Mở toàn DB | Chưa đăng nhập vẫn đọc/ghi được |

## Cây dữ liệu (theo code app)

```
/
├── attendance/{yyyy-MM-dd}/
│   ├── _meta/                    # OFF / lễ / nghỉ bù (AttendanceOffDaysModal)
│   └── {empKey}/                 # Bản ghi NV ngày (emp_{mnv} hoặc legacy key)
├── seasonalAttendance/           # Cùng cấu trúc — NV thời vụ
├── userDepartments/{mappingId}/  # email, role, departments[], description, …
├── internalAnnouncements/{id}/   # title, body, visibility, authorEmail, …
├── performanceData/{year}/       # Biểu đồ cải tiến
├── bar/{workplace}/{week}/{rework}/{day}/{shift}/  # Sản lượng tổng
├── ng/{workplace}/{week}/{rework}/{day}/{model}/Day/  # NG chi tiết
├── mcDefectReport/byDate/{date}/{recordKey}/
├── areas/{area}/                 # Danh sách máy (TemperatureMonitor)
├── temperature_monitor/{area}/{machine}/{yyyy-MM}/
├── details/{area}/               # Chi tiết sản lượng (DetailedModal)
├── molds/{id}/
├── honorBoard/{id}/
├── downloads/stats/{fileId}/     # Số lần tải file tĩnh
├── warehouseInventoryDashboard/latestSnapshot/
├── logs/{pushId}/                # userLog — append only
└── userPreferences/{safeEmail}/chartOrder_v1/{kind}/
```

### `attendance` / `seasonalAttendance` — ô NV (ví dụ)

- `hoVaTen`, `mnv`, `boPhan`, `gioVao`, `gioRa`, `caLamViec`, `loaiPhep`, …
- `id`: id bản ghi (trùng key con)
- Không ghi đè mất field ẩn: app dùng merge (`mergeAttendanceDayNodeForPersist`)

### `userDepartments`

```json
{
  "email": "user@company.com",
  "role": "manager",
  "departments": ["Lắp ráp"],
  "description": "",
  "updatedAt": "ISO-8601",
  "updatedBy": "admin@gmail.com"
}
```

Role: `admin` | `hr` | `manager` | `staff` (khớp `authRoles.js`).

Email hệ thống full quyền (không cần dòng mapping): `admin@gmail.com`, `hr@pavonine.net`.

## Quyền trên rules (tóm tắt)

| Nhánh | Đọc | Ghi |
|-------|-----|-----|
| attendance, seasonalAttendance | Đã đăng nhập | Đã đăng nhập |
| userDepartments | Đã đăng nhập | Admin/HR email hệ thống |
| internalAnnouncements | Đã đăng nhập | Tạo = đúng authorEmail; sửa/xóa = tác giả hoặc Admin/HR |
| performanceData | Đã đăng nhập | Admin/HR |
| honorBoard | Đã đăng nhập | Admin/HR |
| bar, ng, molds, areas, temperature_monitor, details, warehouse… | Đã đăng nhập | Đã đăng nhập |
| logs | Admin/HR | Mọi user đăng nhập — **chỉ thêm** (không sửa/xóa) |
| userPreferences | Chính user (hoặc Admin/HR đọc) | Chỉ path `safeEmail` của mình |

**Lọc theo bộ phận (manager chỉ sửa BP mình)** vẫn do app (`canEditAttendanceForEmployee`). RTDB rules **chưa** ép theo `boPhan` vì cần index phụ (xem bên dưới).

## Triển khai rules

```bash
# Cần Firebase CLI + đăng nhập
firebase deploy --only database
```

File: `firebase/database.rules.json` (kèm `firebase.json`).

Trước khi bật production: dùng **Rules Playground** trên Firebase Console — test path `attendance/2026-05-19`, `userDepartments`, user chưa auth (phải bị từ chối).

## Hạn chế & bước tiếp theo (khuyến nghị)

1. **Phân quyền theo BP trên attendance**  
   Thêm nhánh mirror khi lưu mapping, ví dụ:
   `accessByEmail/{safeEmail}` → `{ role, departments }`  
   Rules có thể đọc `root.child('accessByEmail').child(authEmailSafeKey())` và so `newData.child('boPhan')`.

2. **Custom claims**  
   Cloud Function sau login set `admin` / `hr` / `manager` → rules gọn, không hard-code email.

3. **App Check**  
   Giảm abuse REST API dù đã có rules.

4. **Không dùng session chỉ localStorage**  
   App đã gọi `signInWithEmailAndPassword`; mọi request RTDB phải có `auth` (SDK tự gắn). User giả trong `localStorage` không qua được rules mới.

5. **Đồng bộ email Admin/HR**  
   Nếu đổi `ADMIN_OR_HR_EMAILS` trong `authRoles.js`, cập nhật luôn hàm `isAdminOrHr` trong `database.rules.json`.

6. **`userPreferences` safe key**  
   Rules dùng `replace` cho `. # $ [ ]`. Email có ký tự lạ (sau `replace(/[^a-z0-9@._-]/g,'_')` trong JS) có thể lệch — nên chuẩn hóa email công ty hoặc dùng `auth.uid` làm key.

## Kiểm tra sau deploy

- [ ] Đăng nhập → mở điểm danh / lương (đọc `attendance`)
- [ ] Manager sửa NV đúng BP (app; rules cho phép nếu đã login)
- [ ] User thường không vào `/user-department` ghi mapping (rules chặn)
- [ ] Chưa login: không đọc được `attendance` (Postman / REST)
- [ ] Xuất Excel / upload Excel vẫn OK (cùng path `attendance`)
