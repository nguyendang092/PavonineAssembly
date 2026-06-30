# Tổng hợp quy tắc tính giờ công

Tài liệu tham chiếu để **kiểm tra thủ công** logic giờ công hiện tại trong PavonineAssembly. Mọi quy tắc dưới đây được mô tả theo code thực tế (không phải quy định công ty trên giấy).

## Source of truth

| File                                                       | Nội dung                                        |
| ---------------------------------------------------------- | ----------------------------------------------- |
| `src/features/attendance/attendanceWorkingHours.js`        | GC, TC, làm tròn, cột bảng lương, off/lễ, 1/2PN |
| `src/features/payroll/payrollEarlyOvertimeWindows.js`      | Mốc khung TC sớm (có giấy) ca ngày & ca đêm     |
| `src/features/payroll/payrollMonthlyCoefficientBuckets.js` | Hệ số × giờ trên bảng chấm công tháng           |
| `src/features/attendance/employeeRegime.js`                | Cờ chế độ Tạp vụ / Thai sản / Tài xế            |
| `src/features/attendance/attendanceGioVaoTypeOptions.js`   | Loại phép, PN, BGC, …                           |

**Test tự động:** `src/features/attendance/attendanceWorkingHours.test.js`

```bash
npm test -- attendanceWorkingHours.test.js
```

---

## Đầu vào mỗi ngày

| Trường RTDB / UI                | Ý nghĩa                                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| `gioVao` / `timeIn`             | Giờ vào (`HH:MM` hoặc `HH:MM:SS`)                                 |
| `gioRa` / `timeOut`             | Giờ ra                                                            |
| `caLamViec` / `shiftCode`       | **S1** = ca ngày, **S2** = ca đêm                                 |
| `loaiPhep` / `leaveType`        | PN, 1/2PN, BGC, …                                                 |
| Ngày OFF / NL / nghỉ bù         | `isOffDay`, `isHolidayDay`, `isCompensatoryDay`                   |
| `_meta.payrollEarlyOtPaperwork` | User xác nhận **có giấy** TC sớm                                  |
| `_meta.payrollLateOtExcluded`   | User xác nhận **không** tính TC chiều (sau 17:30 / 16:30 / 19:30) |
| `tangCaTrua` / `lunchOtHours`   | TC trưa chọn tay (0.5, 0.833, 1, 1.5, 2 giờ)                      |

Cờ chế độ (từ hồ sơ NV, `employeeRegimeWorkingHoursFlags`):

- `includeTapVuInWorkingHours` — Tạp vụ
- `includeThaiSanInWorkingHours` — Thai sản
- `includeTaiXeInWorkingHours` — Tài xế
- `includeTaiXeTongInWorkingHours` — Tài xế tổng

---

## Quy ước chung

### Làm tròn

- GC và hầu hết TC: **làm tròn 0,1 giờ** (`roundHoursToTenths`) — half-up, ví dụ 3,5 giữ 3,5 không thành 4.
- TC chiều ca ngày / Tạp vụ / Tài xế: **block 30 phút = 0,5 giờ**, làm tròn **xuống** theo block (không làm tròn 0,1 trên phần này).

### Trần giờ công thường

- **Tối đa 8 giờ** cho GC mỗi ngày (`MAX_REGULAR_WORKING_HOURS`). Phần vượt (nếu có) không cộng vào GC mà sang TC (tùy loại ca).

### Qua đêm

- Nếu `giờ ra ≤ giờ vào` (vd. 22:00 → 06:00): coi là **qua nửa đêm** — `T1 = 24h + giờ ra` trên trục phút.

### Ô trống / 0 giờ

- Bảng lương hiển thị **«-»** thay vì 0 hoặc em-dash (`PAYROLL_CELL_DASH`).

### Ca đêm

- Chỉ **`caLamViec === "S2"`** (`isNightShiftCaLamViec`). **S1** luôn theo logic ca ngày.

---

## Ca ngày (S1) — Giờ công thường (GC)

### Khung làm việc mặc định

| Khung                | Giờ           |
| -------------------- | ------------- |
| Sáng                 | 08:00 – 12:00 |
| Chiều                | 13:00 – 17:00 |
| Nghỉ trưa (loại trừ) | 12:00 – 13:00 |

GC = giao `[giờ vào, giờ ra)` với các khung trên, làm tròn 0,1h, **max 8h**.

### Mốc vào hiệu lực khi chấm sớm

| Giờ chấm vào        | Mốc dùng để tính GC                                                              |
| ------------------- | -------------------------------------------------------------------------------- |
| Trước 06:00         | Giữ **giờ chấm thực** (phần trước 08:00 vẫn không nằm trong khung → thường 0 GC) |
| 06:00 – trước 08:00 | Đẩy mốc vào lên **08:00**                                                        |
| Từ 08:00            | Giữ giờ chấm                                                                     |

Hàm: `getEffectiveDayShiftClockInMinutes` → `getAttendanceWorkingHoursHours`.

---

## Ca ngày (S1) — Tăng ca chiều (TC)

| Chế độ               | Mốc TC       | Điều kiện có TC      |
| -------------------- | ------------ | -------------------- |
| Ca ngày thường       | Từ **17:00** | Giờ ra **sau 17:30** |
| Tạp vụ / Thai sản    | Từ **16:00** | Giờ ra **sau 16:30** |
| Tài xế / Tài xế tổng | Từ **19:00** | Giờ ra **sau 19:30** |

Công thức: `floor((giờ_ra - mốc_TC) / 30 phút) × 0,5 giờ`.

- Ca ngày: `getOvertimeHoursFromGioRa` (mốc 17:00 / eligible 17:30).
- Tạp vụ/Thai sản: `getTapVuThaiSanOvertimeHoursFromGioRa`.
- Tài xế: `getTaiXeOvertimeHoursFromGioRa`.

**Bắt buộc có giờ ra hợp lệ** mới tính TC (kể cả phần giấy sớm).

**`payrollLateOtExcluded === true`:** bỏ phần TC chiều; chỉ còn TC sớm (nếu có giấy) + TC trưa.

Cột «Giờ TC» / «TC ca ngày (×1.5)»: `getPayrollDayOvertimeHoursNumeric` = TC chiều + TC sớm (giấy) + `lunchOtHours`.

---

## Ca ngày — TC sớm có giấy

### Điều kiện hiện popup / xác nhận

- Vào **≤ 06:40** (`isEarlyArrivalFor0600PaperworkOvertime`).
- User chọn có giấy → `payrollEarlyOtPaperwork === true` (`effectivePayrollEarlyOtPaperwork`).

### Khung tính (luôn tính từ **mốc**, không trừ phút chấm sớm trong khung)

| Giờ vào         | TC được tính                                 |
| --------------- | -------------------------------------------- |
| Trước **06:00** | 05:40–06:40 **+** 06:40–07:40 → **2h** (max) |
| 06:00 – ≤ 06:40 | 06:40–07:40 → **1h**                         |
| Sau 06:40       | **0**                                        |

Hàm: `dayEarlyPaperworkOvertimeMinutes` / `getEarlyPaperworkOvertimeHours`. Max **2h** (`DAY_EARLY_OT_MAX_HOURS`).

---

## Ca đêm (S2) — GC ca đêm & TC ca đêm

### Mốc tách 05:00

- **05:00 cùng ngày** nếu giờ vào **trước 05:00**.
- **05:00 ngày hôm sau** nếu giờ vào **từ 05:00 trở đi**.

### Giờ vào hiệu lực (T0) cho GC

| Tình huống                                             | T0 (bắt đầu tính GC)                            |
| ------------------------------------------------------ | ----------------------------------------------- |
| Có giấy TC sớm, vào 16:00–18:40                        | **19:40** (`NIGHT_SHIFT_EARLY_OT_GC_START_MIN`) |
| Vào trước 18:40 (không giấy / không đủ điều kiện giấy) | **18:40** (`NIGHT_SHIFT_OFFICIAL_START_MIN`)    |
| Vào từ 18:40                                           | Giờ vào thực                                    |

GC ca đêm = thời lượng từ T0 đến `min(giờ ra, mốc 05:00)`, **max 8h**, làm tròn 0,1h.

TC ca đêm = phút làm **sau** mốc 05:00 → **30 phút = 0,5 giờ** (floor block).

Hàm: `getNightShiftPayrollRegularHoursAndOtMinutes`, `getNightShiftPayrollOvertimeHours`.

### Cột «Tổng thời gian ca đêm» (bảng tháng)

Khung **22:00 – 05:00** (qua đêm), max 8h — **khác** mốc payroll 05:00:

`getNightShiftTotalWindowHours22To05`.

---

## Ca đêm — TC sớm có giấy

### Điều kiện popup

- Vào từ **15:00** đến **≤ 18:40** (`isEarlyArrivalForNightShiftPaperworkOvertime`).
- User chọn có giấy → `payrollEarlyOtPaperwork === true`.

### Khung tính theo mốc (luôn tính từ **mốc**, max **4h**)

| Khung TC (mỗi khung 1h) |
|---------------------------|
| 15:40 – 16:40 |
| 16:40 – 17:40 |
| 17:40 – 18:40 |
| 18:40 – 19:40 |

| Giờ vào | TC được tính |
|--------|--------------|
| Trước **15:40** | **4h** (cả 4 khung) |
| **15:40 – 15:59** | 15:40–16:40 → **1h** |
| **16:00 – 16:39** | 16:40–17:40 + 17:40–18:40 + 18:40–19:40 → **3h** |
| **16:40 – 16:59** | 16:40–17:40 → **1h** |
| **17:00 – 17:39** | 17:40–18:40 + 18:40–19:40 → **2h** |
| **17:40 – 17:59** | 17:40–18:40 → **1h** |
| **18:00 – 18:40** | 18:40–19:40 → **1h** |
| Sau 18:40 | **0** |

Popup / giấy: vào từ **15:00** đến ≤ **18:40**.

Hàm: `nightEarlyPaperworkOvertimeMinutes` / `getNightShiftEarlyPaperworkOvertimeHours`.

**GC có giấy:** luôn bắt đầu từ **19:40** (`NIGHT_SHIFT_EARLY_OT_GC_START_MIN`), không phụ thuộc số khung TC sớm.

---

## Chế độ đặc biệt (chỉ ca ngày S1)

### Tạp vụ (`includeTapVuInWorkingHours`)

| Khung     | Giờ           | Max  |
| --------- | ------------- | ---- |
| Ca sáng   | 07:00 – 11:30 | 4,5h |
| Nghỉ trưa | 11:30 – 12:30 | —    |
| Ca chiều  | 12:30 – 16:00 | 3,5h |

- Chấm trước 07:00 → mốc vào **07:00**.
- Tổng GC max **8h**.
- TC chiều: từ **16:00**, ra sau **16:30** (block 30p).

### Thai sản (`includeThaiSanInWorkingHours`, **không** bật Tạp vụ)

- GC **liên tục** từ mốc vào hiệu lực ca ngày đến **16:00** hoặc giờ ra, max 8h.
- TC: giống Tạp vụ (từ 16:00).

### Tài xế / Tài xế tổng

- GC khung **07:00 – 19:00** (chấm trước 07:00 → 07:00), max 8h.
- TC từ **19:00**, ra sau **19:30** (block 30p).

**Thứ tự ưu tiên trong code:** Tạp vụ-only khung → Thai sản-only → Tài xế → ca ngày mặc định.

---

## Ngày OFF / ngày lễ / nghỉ bù

### Ca ngày

| Loại ngày     | Cột hiển thị GC thường | Cột gộp GC+TC          | Hệ số (bảng tháng) |
| ------------- | ---------------------- | ---------------------- | ------------------ |
| OFF / nghỉ bù | «-»                    | **TC off** (GC+TC gộp) | × **2,0**          |
| Ngày lễ (NL)  | «-»                    | **GC ngày lễ**         | × **3,0**          |

Quy tắc tính số giờ gộp **giống ngày thường** (GC + TC chiều + giấy sớm + trưa), chỉ gộp một ô.

Hàm: `getPayrollDayShiftOffHolidayMergedHoursNumeric`.

### Ca đêm S2

| Loại ngày     | GC ca đêm / TC ca đêm riêng | Cột gộp               | Hệ số     |
| ------------- | --------------------------- | --------------------- | --------- |
| OFF / nghỉ bù | «-»                         | **GC ca đêm off**     | × **2,7** |
| Ngày lễ       | «-»                         | **GC ca đêm ngày lễ** | × **3,9** |

Gộp GC + TC sau 05:00, cùng quy tắc mốc 05:00.

Hàm: `getNightShiftPayrollOffHolidayMergedHoursNumeric`.

---

## Nửa ngày phép năm (1/2PN)

- Hiển thị badge **1/2PN**; nếu vẫn đi làm nửa ngày → thêm **số giờ** trong ô.
- **Nghỉ buổi chiều**, làm buổi sáng (vào **trước 08:00**): **4h cố định**.
- **Nghỉ buổi sáng**, làm buổi chiều (vào **từ 12:00**): **4h cố định**.
- Trường hợp khác: tính GC thường nhưng **chặn trần 4h** (tránh 4,5).

Hàm: `getPayrollHalfDayLeaveWorkedHours`, `isHalfPnLeaveType`.

**Ca đêm:** 1/2PN không áp dụng logic half-day đặc biệt trên GC ca đêm.

---

## Loại phép khác

- **PN / phép thực** (`isAttendanceActualLeaveType`): cột GC thường «-» (trừ 1/2PN như trên).
- **BGC** (bù giờ công): badge khi chưa có giờ vào; có giờ → hiển thị số giờ tính được.

Chi tiết mã phép: `attendanceGioVaoTypeOptions.js`.

---

## TC trưa (`tangCaTrua`)

- Chọn tay trên form điểm danh: **0,5 | 0,833 | 1 | 1,5 | 2** giờ.
- Cộng vào TC ca ngày (×1,5), không tính lại từ giờ chấm.

`parseLunchOtHours`, `LUNCH_OT_HOUR_OPTIONS`.

---

## Ánh xạ cột bảng lương (ngày thường, không off/lễ)

| Cột UI                       | Ca ngày S1            | Ca đêm S2                |
| ---------------------------- | --------------------- | ------------------------ |
| **Giờ công**                 | GC 08–12, 13–17       | «-»                      |
| **Giờ TC** / TC ca ngày ×1,5 | TC chiều + sớm + trưa | «-» (TC đêm ở cột riêng) |
| **GC ca đêm**                | «-»                   | GC đến mốc 05:00         |
| **TC ca đêm** ×1,5           | «-»                   | TC sau 05:00             |
| **Tổng GC ca ngày**          | GC (cột tổng)         | «-»                      |
| **Tổng GC ca đêm**           | «-»                   | GC ca đêm                |

Hàm format ô: `formatPayrollTableWorkingHoursCell`, `formatPayrollTableDayShiftOvertimeCell`, `formatPayrollTableNightShiftWorkingCell`, `formatPayrollTableNightShiftOvertimeCell`, `formatPayrollTableTotalDayGcCell`, `formatPayrollTableTotalNightGcCell`, …

---

## Bảng chấm công tháng — hệ số

Dòng chính (hệ số **0**): phép hoặc GC ca ngày; OFF/NL/NB/ca đêm thường «-» + nhãn OFF/NL/NB.

Các dòng hệ số (`getPayrollMonthlyCoefficientLines`):

| Hệ số   | Key            | Nội dung                    |
| ------- | -------------- | --------------------------- |
| **0,3** | `nr03`         | GC ca đêm (ngày thường)     |
| **1,5** | `d15` / `nt15` | TC ca ngày hoặc TC ca đêm   |
| **2,0** | `off20`        | OFF/nghỉ bù — ca ngày (gộp) |
| **2,7** | `no27`         | OFF/nghỉ bù — ca đêm (gộp)  |
| **3,0** | `dh30`         | Ngày lễ — ca ngày (gộp)     |
| **3,9** | `nh39`         | Ngày lễ — ca đêm (gộp)      |

Thứ tự hiển thị: 0,3 → 1,5 → 2,0 → 2,7 → 3,0 → 3,9.

---

## Xác nhận tăng ca (UI)

Trang **Điểm danh – Lương** (`PayrollSalaryCalculator.jsx`):

1. **TC sớm có giấy** — NV vào sớm (ca ngày ≤ 06:40 hoặc ca đêm 15:00–18:40) → hỏi có giấy → lưu `_meta.payrollEarlyOtPaperwork`.
2. **Loại trừ TC chiều** — hỏi không tính TC sau giờ (17:30 / 16:30 / 19:30) → `_meta.payrollLateOtExcluded`.

Điều kiện hiện trong danh sách: `isEarlyArrivalForPaperworkOvertime`, `payrollEarlyOtMeta` (nếu có).

---

## Checklist kiểm tra nhanh

Dùng bảng dưới để so với UI (điểm danh + lương + bảng tháng).

| #   | Tình huống                   | Kỳ vọng                                                        |
| --- | ---------------------------- | -------------------------------------------------------------- |
| 1   | S1 08:00–17:00               | GC **8h**, TC **0**                                            |
| 2   | S1 07:00–17:00               | GC **8h** (mốc vào 08:00), TC **0** (ra 17:00 ≤ 17:30)         |
| 3   | S1 08:00–18:00               | GC **8h**, TC **0,5h** (17:00–18:00 = 1 block)                 |
| 4   | S1 08:00–19:00               | GC **8h**, TC **1,0h**                                         |
| 5   | S1 05:30–17:00, có giấy sớm  | TC sớm **2h** + TC chiều **0**                                 |
| 6   | S1 06:15–17:00, có giấy sớm  | TC sớm **1h** (06:40–07:40)                                    |
| 7   | S2 18:40–06:00               | GC ca đêm **8h**, TC ca đêm **0,5h** (05:00–06:00)             |
| 8   | S2 **15:30**–06:00, có giấy | TC sớm **4h**; GC từ **19:40** |
| 8a  | S2 **16:00**–06:00, có giấy | TC sớm **3h**; GC từ **19:40** |
| 8b  | S2 **17:40**–06:00, có giấy  | TC sớm **1h** (17:40–18:40); GC từ **19:40** |
| 8c  | S2 **18:00**–06:00, có giấy  | TC sớm **1h** (18:40–19:40); GC từ **19:40** |
| 9   | Tạp vụ full ngày 07:00–16:00 | GC **8h**, TC **0**                                            |
| 10  | Tạp vụ 07:00–17:00           | GC **8h**, TC từ 16:00 → **0,5h**                              |
| 11  | Tài xế 07:00–19:00           | GC **8h**, TC **0**                                            |
| 12  | Tài xế 07:00–20:00           | GC **8h**, TC **0,5h**                                         |
| 13  | 1/2PN, vào 07:30 ra 12:00    | **4h**                                                         |
| 14  | OFF + S1 08:00–18:00         | Cột GC «-», **TC off** gộp ≈ 8 + 0,5                           |
| 15  | NL + S1 08:00–18:00          | **GC ngày lễ** gộp, hệ số ×3,0 trên bảng tháng                 |

---

## Ghi chú / không nằm trong file này

- **Phép năm** (trừ phép, số dư PN): `annualLeave*`, `AnnualLeaveManager` — không thay đổi công thức GC/TC trên.
- **Combo KPI / thống kê combo**: `attendanceComboStats.js` — **tách** khỏi GC/TC lương.
- **Layout cột bảng điểm danh**: `src/features/attendance/attendanceTableRow/README.md`.

---

## Cập nhật tài liệu

Khi sửa quy tắc giờ công:

1. Sửa code + test trong `attendanceWorkingHours.test.js`.
2. Cập nhật comment header trong `attendanceWorkingHours.js`.
3. Cập nhật file này và checklist nếu có case mới.
