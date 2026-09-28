# Workplace dashboard (`/normal`)

Dashboard sản lượng theo khu vực/tuần — dữ liệu Firebase `bar`, upload Excel, biểu đồ combo Chart.js.

| Phần | File |
|------|------|
| Entry + Chart.js | `WorkplaceDashboardPage.jsx`, `registerChartJs.js` |
| Shell | `WorkplaceProductionPage.jsx` |
| Sidebar / KPI / chart | `components/WorkplaceProductionSidebar.jsx`, `WorkplaceProductionMainPanel.jsx`, `WorkplaceAreaChartCard.jsx` |
| Modal chi tiết | `components/WorkplaceProductionDetailModal.jsx` |
| State / Firebase / upload | `hooks/useWorkplaceProductionDashboard.js` |
| Dữ liệu tuần / chart | `lib/` |

```js
import WorkplaceDashboard from "@/features/dashboard/workplace";
```
