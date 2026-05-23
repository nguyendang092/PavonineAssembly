import * as XLSX from "@e965/xlsx";

export function exportProductionToExcel({
  chartData,
  dataMap,
  selectedArea,
  selectedWeek,
}) {
  if (!chartData?.labels?.length) return;
  const headers = ["Khu vực", "Ngày", "Normal", "Rework", "Tổng"];
  const rows = [];
  Object.entries(dataMap)
    .filter(([area]) => selectedArea === "" || selectedArea === area)
    .forEach(([area, dayArr]) => {
      dayArr.forEach((dayData, idx) => {
        const label = chartData.labels[idx];
        let normal;
        let rework;
        if (area === "CNC") {
          normal = dayData.Day.normal;
          rework = dayData.Day.rework;
        } else {
          normal = dayData.Day.normal + dayData.Night.normal;
          rework = dayData.Day.rework + dayData.Night.rework;
        }
        const total = normal + rework;
        if (total === 0) return;
        rows.push([area, label, normal, rework, total]);
      });
    });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sản lượng chi tiết");
  XLSX.writeFile(wb, `san_luong_chi_tiet_tuan_${selectedWeek}.xlsx`);
}
