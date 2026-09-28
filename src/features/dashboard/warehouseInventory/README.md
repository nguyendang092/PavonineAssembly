# Báo cáo kiểm kê (`warehouseInventory`)

Route: `/stock-variance` · Firebase snapshot: `warehouseInventoryDashboard/latestSnapshot`

| Mục đích | File |
|----------|------|
| Layout trang | `WarehouseInventoryPage.jsx` |
| Upload Excel, lọc, phân trang | `hooks/useWarehouseInventoryDashboard.js` |
| Đọc file Excel | `lib/parse.js` |
| Gom bảng tháng × mã | `lib/buildStructuredRows.js` |
| Lọc / KPI bảng / so sánh 2 tháng | `lib/filterStructuredRows.js`, `lib/buildTwoMonthCompareRows.js` |
| Header / KPI / bộ lọc + bảng | `components/` |

Import route từ `@/features/dashboard/warehouseInventory`.
