import { downloadXlsxBuffer } from "@/utils/downloadXlsxBuffer";
import { formatAttendanceLeaveTypeColumnForEmployee } from "./attendanceGioVaoTypeOptions";
import { resolveAttendanceDisplayStt } from "./attendanceSeasonalStt";

export function buildComboStatDetailExportFileBase(comboStatDetailKey) {
  const metric = String(comboStatDetailKey ?? "detail")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `thong-ke-chi-tiet_${metric || "detail"}_${stamp}`;
}

export async function exportComboStatDetailImage(node, fileBase, onFail) {
  if (!node) return;
  try {
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: Math.min(2, window.devicePixelRatio || 1.5),
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${fileBase}.png`;
    a.click();
  } catch {
    onFail?.();
  }
}

export async function exportComboStatDetailExcel({
  employees,
  fileBase,
  tl,
  isSeasonalAttendance,
  onFail,
}) {
  try {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Detail");
    ws.addRow([
      tl("colIndex", "STT"),
      tl("colCode", "MNV"),
      tl("colName", "Họ và tên"),
      tl("colDepartment", "Bộ phận"),
      tl("colTimeIn", "Giờ vào"),
      tl("leaveTypeColumn", "Loại phép"),
      tl("comboStatColShift", "Ca làm việc"),
    ]);
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" },
    };
    employees.forEach((emp, idx) => {
      ws.addRow([
        resolveAttendanceDisplayStt(emp, idx + 1, isSeasonalAttendance) ??
          idx + 1,
        emp.mnv ?? "",
        emp.hoVaTen ?? "",
        emp.boPhan ?? "",
        emp.gioVao ?? "",
        formatAttendanceLeaveTypeColumnForEmployee(emp) || "",
        emp.caLamViec ?? "",
      ]);
    });
    ws.columns = [
      { width: 6 },
      { width: 14 },
      { width: 28 },
      { width: 24 },
      { width: 14 },
      { width: 16 },
      { width: 14 },
    ];
    const buffer = await workbook.xlsx.writeBuffer();
    downloadXlsxBuffer(buffer, `${fileBase}.xlsx`);
  } catch {
    onFail?.();
  }
}
