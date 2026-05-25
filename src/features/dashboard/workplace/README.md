# Workplace dashboard (`/normal`)

Dashboard sản lượng theo khu vực/tuần — dữ liệu Firebase `bar`, upload Excel, biểu đồ combo Chart.js.

## Cấu trúc

| Phần | File |
|------|------|
| Entry (CSS + Chart.js register) | `WorkplaceDashboardPage.jsx` |
| Shell (hook + `useMemo` props) | `WorkplaceProductionPage.jsx` |
| Sidebar + upload | `components/WorkplaceProductionSidebar.jsx` |
| KPI + lưới chart | `components/WorkplaceProductionMainPanel.jsx` |
| Modal bảng dữ liệu | `components/WorkplaceProductionDataTableModal.jsx` |
| Thẻ chart từng khu | `components/WorkplaceAreaChartCard.jsx` |
| State / Firebase / upload | `hooks/useWorkplaceProductionDashboard.js` |
| Hằng số, tuần ISO | `lib/constants.js` |
| Tổng Normal/NG theo ngày | `lib/dayTotals.js` |
| Nhóm tuần từ Excel | `lib/processExcelData.js` |
| Snapshot `bar` → rows | `lib/barFirebase.js` |
| Build `chartData` / `dataMap` | `lib/buildChartFromWeekRows.js` |
| Xuất Excel | `lib/exportProductionExcel.js` |
| `ChartJS.register` | `registerChartJs.js` |

## Import

```js
import WorkplaceDashboard from "@/features/dashboard/workplace";
```

## Tối ưu render

- `WorkplaceProductionShell` + sidebar / main / modal: `memo`
- Props từng khối gói `useMemo` trên `WorkplaceProductionPage` — mở modal bảng không re-render sidebar khi props sidebar không đổi
- `useMemo` options chart trong hook (giống warehouse)
