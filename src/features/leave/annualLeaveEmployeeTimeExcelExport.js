import ExcelJS from "exceljs";

function formatDateKeyForExcel(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return dateKey;
  const [y, m, d] = dateKey.split("-");
  if (!y || !m || !d) return dateKey;
  return `${d}/${m}/${y}`;
}

function sanitizeFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Xuất Excel giờ vào/ra từ popup chấm công chi tiết phép năm.
 * @param {{
 *   rows: Array<{ dateKey: string, timeIn: string, timeOut: string, leaveType: string, shift: string }>,
 *   employeeName: string,
 *   mnv: string,
 *   year: number,
 *   month: string,
 *   headers: { date: string, timeIn: string, timeOut: string, leaveType: string, shift: string },
 * }} params
 */
export async function exportEmployeeAttendanceTimeExcel({
  rows,
  employeeName,
  mnv,
  year,
  month = "",
  headers,
}) {
  const workbook = new ExcelJS.Workbook();
  const sheetTitle = month ? `${year}-${month}` : String(year);
  const sheet = workbook.addWorksheet(sheetTitle.slice(0, 31));

  sheet.addRow([employeeName, mnv ? `MNV ${mnv}` : ""]);
  sheet.addRow([
    headers.date,
    headers.timeIn,
    headers.timeOut,
    headers.leaveType,
    headers.shift,
  ]);

  const headerRow = sheet.getRow(2);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  for (const row of rows) {
    sheet.addRow([
      formatDateKeyForExcel(row.dateKey),
      row.timeIn,
      row.timeOut,
      row.leaveType,
      row.shift,
    ]);
  }

  sheet.columns = [
    { width: 14 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
    { width: 8 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const namePart = sanitizeFilePart(employeeName) || "employee";
  const mnvPart = sanitizeFilePart(mnv) || "mnv";
  const monthPart = month ? `_${month}` : "_all";
  a.download = `PAVONINE_cham_cong_${mnvPart}_${year}${monthPart}_${namePart}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
