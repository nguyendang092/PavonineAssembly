import ExcelJS from "exceljs";
import {
  formatOvertimeHoursLabel,
  formatPayrollTableNightShiftOffDayWorkingCell,
  formatPayrollTableNightShiftOvertimeCell,
  formatPayrollTableNightShiftWorkingCell,
  formatPayrollTableOffDayTcCell,
  formatPayrollTableTotalDayGcCell,
  formatPayrollTableTotalNightGcCell,
  formatPayrollTableWorkingHoursCell,
} from "@/features/attendance/attendanceWorkingHours";

const COL_COUNT = 19;

/**
 * Xuất Excel bảng lương: đủ cột giống bảng desktop (full), cùng logic format với màn hình.
 * @param {{ employees: object[], selectedDate: string, isOffDay: boolean, tlTable: function, sheetTitle: string }} opts
 */
export async function buildPayrollSalaryExcelWorkbook({
  employees,
  selectedDate,
  isOffDay,
  tlTable,
  sheetTitle,
}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Payroll", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  worksheet.mergeCells(1, 1, 1, COL_COUNT);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = sheetTitle;
  titleCell.font = { bold: true, size: 12, color: { argb: "FF1E293B" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  worksheet.getRow(1).height = 22;

  const headers = [
    tlTable("stt", "STT"),
    tlTable("mnv", "MNV"),
    tlTable("mvt", "MVT"),
    tlTable("fullName", "Họ và tên"),
    tlTable("gender", "Giới tính"),
    tlTable("dateOfBirth", "Ngày tháng năm sinh"),
    tlTable("departmentCode", "Mã BP"),
    tlTable("department", "Bộ phận"),
    tlTable("timeIn", "Thời gian vào"),
    tlTable("timeOut", "Thời gian ra"),
    tlTable("workShift", "Ca làm việc"),
    tlTable("workingHours", "Giờ công"),
    tlTable("overtimeHours", "Giờ TC"),
    tlTable("offDayOvertimeHours", "TC off"),
    tlTable("payrollTotalGcDay", "Tổng GC"),
    tlTable("nightShiftWorkingHours", "GC ca đêm"),
    tlTable("nightShiftOvertimeHours", "TC ca đêm"),
    tlTable("nightShiftOffDayWorkingHours", "GC ca đêm off"),
    tlTable("payrollTotalGcNight", "Tổng GC ca đêm"),
  ];

  const headerRow = worksheet.getRow(2);
  headers.forEach((text, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = text;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF6366F1" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 18;

  employees.forEach((emp, idx) => {
    const stt =
      emp.stt != null && String(emp.stt).trim() !== ""
        ? emp.stt
        : idx + 1;
    const values = [
      stt,
      emp.mnv ?? "",
      emp.mvt ?? "",
      emp.hoVaTen ?? "",
      emp.gioiTinh ?? "",
      emp.ngayThangNamSinh ?? "",
      emp.maBoPhan ?? "",
      emp.boPhan ?? "",
      emp.gioVao ?? "",
      emp.gioRa ?? "",
      emp.caLamViec ?? "",
      formatPayrollTableWorkingHoursCell(
        emp.gioVao,
        emp.gioRa,
        isOffDay,
        emp.caLamViec,
      ),
      formatOvertimeHoursLabel(emp.gioRa),
      formatPayrollTableOffDayTcCell(
        emp.gioVao,
        emp.gioRa,
        isOffDay,
        emp.caLamViec,
      ),
      formatPayrollTableTotalDayGcCell(
        emp.gioVao,
        emp.gioRa,
        isOffDay,
        emp.caLamViec,
      ),
      formatPayrollTableNightShiftWorkingCell(
        emp.gioVao,
        emp.gioRa,
        isOffDay,
        emp.caLamViec,
      ),
      formatPayrollTableNightShiftOvertimeCell(
        emp.gioVao,
        emp.gioRa,
        isOffDay,
        emp.caLamViec,
      ),
      formatPayrollTableNightShiftOffDayWorkingCell(
        emp.gioVao,
        emp.gioRa,
        isOffDay,
        emp.caLamViec,
      ),
      formatPayrollTableTotalNightGcCell(
        emp.gioVao,
        emp.gioRa,
        isOffDay,
        emp.caLamViec,
      ),
    ];
    const row = worksheet.addRow(values);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      const isHoursCol = colNumber >= 12;
      cell.font = { size: 10, bold: isHoursCol };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber === 4 ? "left" : "center",
        wrapText: false,
      };
    });
  });

  worksheet.columns = [
    { width: 5 },
    { width: 10 },
    { width: 8 },
    { width: 22 },
    { width: 8 },
    { width: 14 },
    { width: 10 },
    { width: 18 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
    { width: 10 },
    { width: 9 },
    { width: 10 },
    { width: 10 },
    { width: 11 },
    { width: 11 },
    { width: 12 },
    { width: 12 },
  ];

  return workbook;
}

export async function downloadPayrollSalaryExcel(opts) {
  const { selectedDate } = opts;
  const workbook = await buildPayrollSalaryExcelWorkbook(opts);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Bang-gio-cong_${selectedDate}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
