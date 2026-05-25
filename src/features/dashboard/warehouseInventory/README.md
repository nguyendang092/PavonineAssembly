# Dashboard chênh lệch kho (`warehouseInventory`)

Route: `/stock-variance` · Firebase snapshot: `warehouseInventoryDashboard/latestSnapshot`

## Muốn sửa gì → mở file nào

| Mục đích | File |
|----------|------|
| Layout trang, ghép header + báo cáo | `WarehouseInventoryPage.jsx` |
| Upload Excel, filter, chart data, phân trang | `hooks/useWarehouseInventoryDashboard.js` |
| Đọc / parse file Excel, KPI thống kê | `lib/parse.js` |
| Gom bảng tháng × mã | `lib/buildStructuredRows.js` |
| Lọc, sắp xếp, tổng KPI bảng | `lib/filterStructuredRows.js` |
| Màu chart, path Firebase, page size | `lib/constants.js` |
| Đăng ký Chart.js | `registerChartJs.js` |
| Header upload / empty / lỗi | `components/PageHeader.jsx` |
| KPI + ghép chart & bảng | `components/ReportKpiSection.jsx` |
| Donut STATUS, bar kho, TOP mã | `components/OverviewChartsSection.jsx` |
| Bộ lọc + bảng chi tiết | `components/FiltersAndTableSection.jsx` |
| Thẻ KPI nhỏ | `components/KpiCard.jsx` |

## Cấu trúc

```
warehouseInventory/
  WarehouseInventoryPage.jsx
  index.js
  registerChartJs.js
  hooks/
    useWarehouseInventoryDashboard.js
  lib/
    parse.js
    buildStructuredRows.js
    filterStructuredRows.js
    constants.js
    chartBarGradient.js
  components/
    PageHeader.jsx
    ReportKpiSection.jsx
    OverviewChartsSection.jsx
    FiltersAndTableSection.jsx
    KpiCard.jsx
```

## Ghi chú

- Import route từ `@/features/dashboard/warehouseInventory`.
