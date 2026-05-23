# Bảng điểm danh — hàng & layout (`attendanceTableRow`)

Dùng bởi `AttendanceListTableSection` (virtual / full table).

## Muốn sửa gì → file nào

| Mục đích | File |
|----------|------|
| Một hàng NV (ô giờ, phép, nút Sửa/Xóa) | `AttendanceTableRowBody.jsx` |
| So sánh props `memo` (tránh re-render) | `propsAreEqual.js` |
| % cột, `grid-template-columns` | `gridLayout.js` |
| Map chỉ số cột grid (full/compact/…) | `gridColumnMaps.js` |
| Chuẩn hóa % cột (off day, bỏ giờ lương) | `gridColumnHelpers.js` |
| Header virtual (grid) | `AttendanceVirtualHeader.jsx` |
| `<thead>` bảng HTML | `AttendanceTableThead.jsx` |
| `<colgroup>` | `AttendanceTableColgroup.jsx` |
| Ô OFF / HOLIDAY | `AttendanceOffHolidayCellContent.jsx` |
| `-` ô trống payroll | `payrollDash.js`, `constants.js` |
| Class ẩn cột trên grid virtual | `cellClassNames.js` |

## Tối ưu render

- `AttendanceTableRowBody`, header, colgroup, off-holiday cell: **`React.memo`**
- Virtual list: chỉ mount hàng trong viewport (`AttendanceListTableSection`)

## Import

```js
import AttendanceTableRow, {
  getAttendanceGridTemplateColumns,
  ATTENDANCE_VIRTUAL_THRESHOLD,
} from "@/features/attendance/attendanceTableRow";
```

File `AttendanceTableRow.jsx` (cùng thư mục `attendance/`) chỉ re-export.
