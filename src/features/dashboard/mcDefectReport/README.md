# Báo cáo hàng lỗi MC (`mcDefectReport`)

Route: `/mc-defect-report` · Firebase: `mcDefectReport/byDate`

## Muốn sửa gì → mở file nào

| Mục đích | File |
|----------|------|
| Bố cục trang, header, ghép các khối UI | `McDefectReportPage.jsx` |
| Bộ lọc sidebar (tháng, BP, NV, loại lỗi) | `components/FiltersSidebar.jsx` |
| 5 thẻ KPI | `components/KpiCards.jsx` |
| Biểu đồ cột top NV + đường theo ngày | `components/ChartsTopRow.jsx` |
| Heatmap + donut theo loại lỗi | `components/ChartsHeatmapDonutRow.jsx` |
| Form nhập, sửa/xóa dòng, import Excel, bảng raw | `components/DataTables.jsx` → `MCDefectReportEntrySection` |
| Logic sửa (điền form, cập nhật Firebase) | `hooks/useMcDefectDashboard.js` → `handleEdit`, `handleSubmit` |
| Bảng pivot tổng hợp | `components/DataTables.jsx` → `MCDefectReportPivotSection` |
| State, Firebase, filter, CRUD, export PDF/ảnh | `hooks/useMcDefectDashboard.js` |
| Gom dữ liệu (KPI, theo ngày, heatmap, donut…) | `lib/dataAggregations.js` |
| Import / export template Excel | `lib/excelImport.js` |
| Màu chart, path Firebase, form mặc định | `lib/constants.js` |
| Nhãn % trên donut | `lib/pieChartLabel.jsx` |

## Cấu trúc thư mục

```
mcDefectReport/
  McDefectReportPage.jsx   ← entry UI
  index.js                 ← export cho App.jsx
  hooks/
    useMcDefectDashboard.js
  lib/
    constants.js
    dataAggregations.js
    excelImport.js
    pieChartLabel.jsx
  components/
    FiltersSidebar.jsx
    KpiCards.jsx
    ChartsTopRow.jsx
    ChartsHeatmapDonutRow.jsx
    DataTables.jsx
```

## Ghi chú nhanh

- **Đường trung bình** (line chart): `dailyAverage` = tổng lỗi các ngày có trong `byDateData` ÷ số ngày có dữ liệu (xem `buildByDateData` trong `dataAggregations.js`).
- **Donut**: phân bổ theo **loại lỗi**, không theo bộ phận.
- Import từ `@/features/dashboard/mcDefectReport` hoặc file cũ `MCDefectReportDashboard.jsx` (re-export).
