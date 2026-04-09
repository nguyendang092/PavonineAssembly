import ExcelJS from "exceljs";
import { enumerateDateKeysInclusive } from "@/utils/dateKey";

const MAX_DAYS = 366;

/**
 * Kiểm tra đồng bộ trước khi bật trạng thái "đang xuất".
 * @returns {{ ok: true, from: string, to: string, keys: string[] } | { ok: false, alert: { type: string, message: string } }}
 */
export function getAttendanceDateRangeExportPlan(exportRangeFrom, exportRangeTo, tl) {
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
  employeeProfilesMap,
  applyAttendanceMerge,
  filterAttendanceListRows,
  displayLocale,
  tl,
}) {
  const profMap = employeeProfilesMap;
  const allRows = [];
  for (const dateKey of keys) {
    const snap = await get(ref(db, `attendance/${dateKey}`));
    const merged = applyAttendanceMerge(snap.val(), profMap);
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
  const ws = workbook.addWorksheet("DiemDanh");
  ws.mergeCells("A1:L1");
  const mainTitle = ws.getCell("A1");
  mainTitle.value = "DANH SÁCH ĐIỂM DANH";
  mainTitle.font = { size: 14, bold: true, color: { argb: "FF000000" } };
  mainTitle.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 22;

  const fromFmt = new Date(`${from}T12:00:00`).toLocaleDateString(displayLocale);
  const toFmt = new Date(`${to}T12:00:00`).toLocaleDateString(displayLocale);
  ws.mergeCells("A2:L2");
  const sub = ws.getCell("A2");
  sub.value = tl("exportRangeSheetSubtitle", "Từ {{from}} đến {{to}}", {
    from: fromFmt,
    to: toFmt,
  });
  sub.font = { size: 10, bold: true };
  sub.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 20;

  ws.addRow([]);

  const headerVi = [
    tl("exportRangeColDate", "Ngày"),
    tl("colIndex", "STT"),
    tl("colCode", "MNV"),
    "MVT",
    tl("excelHeaderName", "Họ và tên"),
    tl("gender", "Giới tính"),
    tl("exportRangeColDOB", "Ngày tháng năm sinh"),
    tl("departmentCode", "Mã BP"),
    tl("department", "Bộ phận"),
    tl("timeIn", "Thời gian vào"),
    tl("timeOut", "Thời gian ra"),
    tl("comboStatColShift", "Ca làm việc"),
  ];
  const headerEn = [
    "Date",
    "",
    "Code",
    "",
    "Full name",
    "Gender",
    "DoB",
    "Code-Dept",
    "Department",
    "Time in",
    "Time out",
    "Shift",
  ];

  ws.addRow(headerVi);
  ws.addRow(headerEn);

  [4, 5].forEach((rowNum) => {
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
      dateDisplay,
      stt,
      emp.mnv || "",
      emp.mvt || "",
      emp.hoVaTen || "",
      emp.gioiTinh === "YES" ? "YES" : "NO",
      emp.ngayThangNamSinh || "",
      emp.maBoPhan || "",
      emp.boPhan || "",
      emp.gioVao || "",
      emp.gioRa || "",
      emp.caLamViec || "",
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
    { width: 12 },
    { width: 5 },
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
