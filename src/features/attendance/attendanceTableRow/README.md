# Bảng điểm danh — hàng & layout (`attendanceTableRow`)

Module dùng chung cho **màn điểm danh** (HTML `<table>`) và **bảng lương** (CSS grid + virtual scroll).

## Hai chế độ render

| Màn hình | Component bọc | Virtual scroll | `virtualRow` |
|----------|---------------|----------------|--------------|
| Điểm danh chính thức / thời vụ | `AttendanceListTableSection` | **Không** — render đủ hàng | Không truyền |
| Tính lương | `PayrollSalaryCalculator` | **Có** khi `filteredEmployees.length > ATTENDANCE_VIRTUAL_THRESHOLD` (300) | Truyền từ `@tanstack/react-virtual` |

`AttendanceTableRowBody` nhận `virtualRow`:

- `virtualRow == null` → hàng `<tr>` trong bảng HTML (điểm danh).
- `virtualRow` có giá trị → hàng `display: grid` + `translateY` (lương).

STT cột:

- Chính thức: `emp.stt`
- Thời vụ: `emp.sttThoiVu` qua prop `isSeasonalAttendance` + `resolveAttendanceDisplayStt` (`attendanceSeasonalStt.js`)

## Muốn sửa gì → file nào

| Mục đích | File |
|----------|------|
| Một hàng NV (ô giờ, phép, cờ bộ phận, nút Sửa/Xóa) | `AttendanceTableRowBody.jsx` |
| So sánh props `memo` (tránh re-render, gồm `virtualRow`) | `propsAreEqual.js` |
| % cột, `grid-template-columns` (lương / grid) | `gridLayout.js` |
| Map chỉ số cột grid (full / compact / narrow / minimal) | `gridColumnMaps.js` |
| Chuẩn hóa % cột (off day, bỏ giờ lương) | `gridColumnHelpers.js` |
| Header grid virtual (lương) | `AttendanceVirtualHeader.jsx` — qua `payrollSalaryTableUi.jsx` |
| `<thead>` bảng HTML (điểm danh) | `AttendanceTableThead.jsx` |
| `<colgroup>` | `AttendanceTableColgroup.jsx` |
| Ô OFF / HOLIDAY | `AttendanceOffHolidayCellContent.jsx` |
| `-` ô trống payroll | `payrollDash.js`, `constants.js` |
| Class ẩn cột trên grid virtual | `cellClassNames.js` |
| Kế hoạch cột theo viewport (`columnPlan`) | `useAttendanceBirthDeptColumns.js` |

## Tối ưu render

- `AttendanceTableRowBody`, header, colgroup, off-holiday cell: **`React.memo`** + `propsAreEqual`
- **Điểm danh:** `AttendanceListTableSection` map toàn bộ `deferredFilteredEmployees` — tránh chỉ thấy ~10–15 dòng khi virtualizer lỗi viewport
- **Lương:** `@tanstack/react-virtual` chỉ mount hàng trong viewport khi danh sách > 300

## Import

Điểm danh (bảng HTML):

```js
import AttendanceTableRow, {
  AttendanceTableColgroup,
  AttendanceTableThead,
} from "@/features/attendance/attendanceTableRow";
```

Lương (grid + virtual):

```js
import AttendanceTableRow, {
  getAttendanceGridTemplateColumns,
  ATTENDANCE_VIRTUAL_THRESHOLD,
} from "@/features/attendance/attendanceTableRow";
```

## Shim tương thích

`AttendanceTableRow.jsx` (thư mục cha) re-export từ `./attendanceTableRow/index.js` — giữ cho cache module Vite/HMR cũ; ưu tiên import từ `@/features/attendance/attendanceTableRow`.
