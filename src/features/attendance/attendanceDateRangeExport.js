import ExcelJS from "exceljs";
import { enumerateDateKeysInclusive } from "@/utils/dateKey";
import {
  formatAttendanceTimeInColumnDisplay,
  formatAttendanceLeaveTypeColumnForEmployee,
} from "./attendanceGioVaoTypeOptions";
const MAX_DAYS = 366;

/**
 * Kiểm tra đồng bộ trước khi bật trạng thái "đang xuất".
 * @returns {{ ok: true, from: string, to: string, keys: string[] } | { ok: false, alert: { type: string, message: string } }}
 */
export function getAttendanceDateRangeExportPlan(
  exportRangeFrom,
  exportRangeTo,
  tl,
) {
  const from = exportRangeFrom?.trim();
  const to = exportRangeTo?.trim();
  if (!from || !to) {
    return {
      ok: false,
      alert: {
        type: "error",
        message: tl(
          "exportRangeFillDates",
          "Chọn đủ từ ngày và đến ngày (YYYY-MM-DD).",
        ),
      },
    };
  }
  const keys = enumerateDateKeysInclusive(from, to);
  if (keys.length === 0) {
    return {
      ok: false,
      alert: {
        type: "error",
        message: tl(
          "exportRangeInvalid",
          "Khoảng ngày không hợp lệ hoặc từ ngày lớn hơn đến ngày.",
        ),
      },
    };
  }
  if (keys.length > MAX_DAYS) {
    return {
      ok: false,
      alert: {
        type: "error",
        message: tl(
          "exportRangeTooLong",
          "Tối đa 366 ngày mỗi lần xuất. Vui lòng thu hẹp khoảng ngày.",
        ),
      },
    };
  }
  return { ok: true, from, to, keys };
}

/**
 * Tải từng ngày, gộp hồ sơ, lọc như màn hình; build workbook Excel.
 * @returns {Promise<
 *   | { ok: false; alert: { type: string; message: string } }
 *   | { ok: true; buffer: ArrayBuffer; filename: string; days: number; rows: number }
 * >}
 */
export async function executeAttendanceDateRangeExport({
  keys,
  from,
  to,
  db,
  ref,
  get,
  applyAttendanceMerge,
  filterAttendanceListRows,
  displayLocale,
  tl,
}) {
  const allRows = [];
  for (const dateKey of keys) {
    const snap = await get(ref(db, `attendance/${dateKey}`));
    const merged = applyAttendanceMerge(snap.val());
    const filtered = filterAttendanceListRows(merged);
    let stt = 1;
    for (const emp of filtered) {
      allRows.push({ dateKey, stt: stt++, emp });
    }
  }
  if (allRows.length === 0) {
    return {
      ok: false,
      alert: {
        type: "info",
        message: tl(
          "exportRangeNoData",
          "Không có dòng dữ liệu trong khoảng đã chọn (hoặc bộ lọc hiện tại đã loại hết).",
        ),
      },
    };
  }

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Attendance");

  const fromFmt = new Date(`${from}T12:00:00`).toLocaleDateString(
    displayLocale,
  );
  const toFmt = new Date(`${to}T12:00:00`).toLocaleDateString(displayLocale);

  // —— Cùng bố cục trang với xuất Excel 1 ngày (ExportExcelButton.jsx) ——
  ws.mergeCells("B1:F1");
  const companyName = ws.getCell("B1");
  companyName.value = "CÔNG TY TNHH PAVONINE VINA";
  companyName.font = { bold: true, size: 10 };
  companyName.alignment = { vertical: "top", horizontal: "left" };

  ws.mergeCells("B2:F2");
  const companyAddr1 = ws.getCell("B2");
  companyAddr1.value =
    "Lots VII-3, VII-2, and part of Lot VII-3, My Xuan B1 - Tien Hung";
  companyAddr1.font = { size: 8, italic: true };
  companyAddr1.alignment = { vertical: "top", horizontal: "left" };

  ws.mergeCells("B3:F3");
  const companyAddr2 = ws.getCell("B3");
  companyAddr2.value =
    "Industrial Park, Phu My Ward, Ho Chi Minh City, Vietnam";
  companyAddr2.font = { size: 8, italic: true };
  companyAddr2.alignment = { vertical: "top", horizontal: "left" };

  const approvalHeaders = [
    "Người lập /\nPrepared by",
    "Kiểm tra /\nReviewed by",
    "Phê duyệt /\nApproved by",
  ];
  ["I1", "J1", "K1"].forEach((addr, idx) => {
    const cell = ws.getCell(addr);
    cell.value = approvalHeaders[idx];
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.font = { bold: true, size: 8 };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  ["I2", "J2", "K2"].forEach((addr) => {
    const c = ws.getCell(addr);
    c.value = "";
    c.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  ws.getRow(1).height = 18;
  ws.getRow(2).height = 28;

  ws.mergeCells("A4:M4");
  const mainTitle = ws.getCell("A4");
  mainTitle.value = "DANH SÁCH NHÂN VIÊN HIỆN DIỆN";
  mainTitle.font = { size: 14, bold: true, color: { argb: "FF000000" } };
  mainTitle.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(4).height = 22;

  ws.mergeCells("A5:M5");
  const subTitle = ws.getCell("A5");
  subTitle.value = "List of Active Employees";
  subTitle.font = { size: 11, bold: true };
  subTitle.alignment = { vertical: "middle", horizontal: "center" };

  ws.mergeCells("A6:M6");
  const dateCell = ws.getCell("A6");
  dateCell.value = tl(
    "exportRangeExcelDateLine",
    "Ngày/Date: Từ {{from}} đến {{to}}",
    { from: fromFmt, to: toFmt },
  );
  dateCell.font = { size: 9, bold: true };
  dateCell.alignment = { vertical: "middle", horizontal: "center" };

  ws.addRow([]);

  ws.addRow([
    "Ca ngày",
    "S1",
    "1.Phép năm/Annual Leave",
    "PN",
    "6.Không Lương/Unpaid Leave",
    "KL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  ws.addRow([
    "Ca đêm",
    "S2",
    "2.1/2 ngày phép năm/1/2 day annual Leave",
    "1/2 PN",
    "7.Không phép/Illegal Leave",
    "KP",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  ws.addRow([
    "",
    "",
    "3.Nghỉ TNLĐ/Labor accident",
    "TN",
    "8.Nghỉ ốm/Sick Leave",
    "PO",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  ws.addRow([
    "",
    "",
    "4.Phép cưới/Wedding Leave",
    "PC",
    "9.Thai sản/Maternity",
    "TS",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  ws.addRow([
    "",
    "",
    "5.Phép tang/Funeral Leave",
    "PT",
    "10.Dưỡng sức/Recovery health",
    "DS",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  [8, 9, 10, 11, 12].forEach((rowNum) => {
    const row = ws.getRow(rowNum);
    row.height = 15;
    row.eachCell((cell, colNumber) => {
      cell.font = { size: 8 };
      cell.alignment = {
        vertical: "top",
        horizontal: "left",
        wrapText: true,
      };
      if (colNumber <= 6) {
        cell.border = {
          top: { style: "hair" },
          left: { style: "hair" },
          bottom: { style: "hair" },
          right: { style: "hair" },
        };
      }
    });
  });

  ws.addRow([]);

  ws.mergeCells("E14:I14");
  const mealCountCell = ws.getCell("E14");
  mealCountCell.value = "Số lượng cơm ca trưa:";
  mealCountCell.font = {
    size: 10,
    color: { argb: "FFC41E3A" },
    italic: true,
    bold: true,
  };
  mealCountCell.alignment = { vertical: "middle", horizontal: "left" };

  ws.addRow([]);

  const headerVi = [
    "STT",
    tl("exportRangeColDate", "Ngày"),
    "MNV",
    "MVT",
    "Họ và tên",
    "Giới tính",
    "Ngày vào làm",
    "Mã BP",
    "Bộ phận",
    "Thời gian vào",
    "Thời gian ra",
    "Ca làm việc",
    "Loại phép",
  ];
  const headerEn = [
    "STT",
    "Date",
    "Code",
    "MVT",
    "Full name",
    "Gender",
    "Start date",
    "Code-Dept",
    "Department",
    "Time in",
    "Time out",
    "Current shift",
    "Leave type",
  ];

  ws.addRow(headerVi);
  ws.addRow(headerEn);

  [16, 17].forEach((rowNum) => {
    const row = ws.getRow(rowNum);
    row.height = 25;
    row.eachCell((cell) => {
      cell.font = { bold: true, size: 9, color: { argb: "FF000000" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFB0B0B0" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "hair" },
        bottom: { style: "hair" },
        right: { style: "hair" },
      };
    });
  });

  allRows.forEach(({ dateKey, stt, emp }, idx) => {
    const dateDisplay = new Date(`${dateKey}T12:00:00`).toLocaleDateString(
      displayLocale,
    );
    const row = ws.addRow([
      stt,
      dateDisplay,
      emp.mnv || "",
      emp.mvt || "",
      emp.hoVaTen || "",
      emp.gioiTinh === "YES" ? "YES" : "NO",
      emp.ngayVaoLam || "",
      emp.maBoPhan || "",
      emp.boPhan || "",
      formatAttendanceTimeInColumnDisplay(emp.gioVao),
      emp.gioRa || "",
      emp.caLamViec || "",
      formatAttendanceLeaveTypeColumnForEmployee(emp) || "",
    ]);
    const isEvenRow = idx % 2 === 0;
    row.eachCell((cell, colNumber) => {
      cell.font = { size: 9 };
      if (colNumber === 5 || colNumber === 9) {
        cell.alignment = {
          vertical: "middle",
          horizontal: "left",
          indent: 1,
        };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
      cell.border = {
        top: { style: "hair" },
        left: { style: "hair" },
        bottom: { style: "hair" },
        right: { style: "hair" },
      };
      if (isEvenRow) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0F8FF" },
        };
      }
      if (colNumber === 10 && cell.value) {
        cell.font = { size: 9, color: { argb: "FF006400" }, bold: true };
      }
      if (colNumber === 11 && cell.value) {
        cell.font = { size: 9, color: { argb: "FFDC143C" }, bold: true };
      }
    });
  });

  ws.columns = [
    { width: 5 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 25 },
    { width: 8 },
    { width: 15 },
    { width: 10 },
    { width: 15 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const now = new Date();
  const dateOut = now.toISOString().slice(0, 10);
  const timeOut = now.toTimeString().slice(0, 8).replace(/:/g, "-");
  const filename = `PAVONINE_diemDanh_${from}_${to}_${dateOut}_${timeOut}.xlsx`;

  return {
    ok: true,
    buffer,
    filename,
    days: keys.length,
    rows: allRows.length,
  };
}
