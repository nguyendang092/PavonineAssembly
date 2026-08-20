import ExcelJS from "exceljs";
import { formatDailyReportAbsentRate } from "./attendanceDailyReportStats";

function formatAbsentExcelCell(cell, pendingLabel) {
  const lines = [];
  if (cell.absent > 0) lines.push(String(cell.absent));
  if ((cell.pendingAttendance ?? 0) > 0) {
    lines.push(`${pendingLabel} ${cell.pendingAttendance}`);
  }
  if (!lines.length) return 0;
  return lines.join("\n");
}

function buildShiftMetricValues(cell = {}, pendingLabel) {
  return [
    cell.total || 0,
    formatAbsentExcelCell(cell, pendingLabel),
    cell.present || 0,
    formatDailyReportAbsentRate(cell.absentRate),
    cell.remarks || "—",
  ];
}

function appendWorkerRow(sheet, workerLabel, dayCell, nightCell, pendingLabel) {
  const row = sheet.addRow([
    null,
    workerLabel,
    ...buildShiftMetricValues(dayCell, pendingLabel),
    ...buildShiftMetricValues(nightCell, pendingLabel),
  ]);
  return row.number;
}

function mergeProcessCell(sheet, startRow, endRow, labelKo, labelEn) {
  sheet.mergeCells(startRow, 1, endRow, 1);
  const cell = sheet.getCell(startRow, 1);
  cell.value = `${labelKo}\n${labelEn}`;
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  cell.font = { bold: true };
}

function styleHeaderRow(row, fillArgb = "FF16303A") {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillArgb },
    };
    cell.font = { bold: true, color: { argb: "FFEAF2F1" }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

function styleSubHeaderRow(row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF7F8F5" },
    };
    cell.font = { bold: true, color: { argb: "FF16303A" }, size: 9 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

function styleDataRows(sheet, fromRow, toRow) {
  for (let r = fromRow; r <= toRow; r += 1) {
    const row = sheet.getRow(r);
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    sheet.getCell(r, 1).alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
    sheet.getCell(r, 2).alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    for (const col of [12]) {
      sheet.getCell(r, col).alignment = {
        vertical: "middle",
        horizontal: "left",
        wrapText: true,
      };
    }
    sheet.getCell(r, 7).alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
  }
}

function paintSubtotalRows(sheet, rowNumbers) {
  for (const rowNumber of rowNumbers) {
    sheet.getRow(rowNumber).eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFCBD8DB" },
      };
      cell.font = { bold: true, color: { argb: "FF16303A" } };
    });
  }
}

function paintGrandTotalRow(sheet, rowNumber, grandLabel) {
  sheet.mergeCells(rowNumber, 1, rowNumber, 2);
  const labelCell = sheet.getCell(rowNumber, 1);
  labelCell.value = grandLabel;
  labelCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(rowNumber).eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF16303A" },
    };
    cell.font = { bold: true, color: { argb: "FFEAF2F1" } };
  });
}

export function buildAttendanceDailyReportExportFilename(dateKey, ext) {
  const safeDate = String(dateKey || "report").replace(/[^\d-]/g, "") || "report";
  return `diem-danh-san-xuat_${safeDate}.${ext}`;
}

export async function exportAttendanceDailyReportExcel({
  dateKey,
  rows = [],
  summary = {},
  metrics = {},
  labels = {},
  title = "Điểm danh nhân sự SẢN XUẤT",
}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Bao cao", {
    views: [{ state: "frozen", ySplit: 6 }],
  });

  sheet.columns = [
    { width: 16 },
    { width: 11 },
    { width: 8 },
    { width: 11 },
    { width: 9 },
    { width: 10 },
    { width: 18 },
    { width: 8 },
    { width: 11 },
    { width: 9 },
    { width: 10 },
    { width: 16 },
  ];

  sheet.mergeCells("A1:L1");
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF16303A" } };

  sheet.mergeCells("A2:L2");
  sheet.getCell("A2").value = `${labels.dateLabel || "Ngày"}: ${dateKey}`;
  sheet.getCell("A2").font = { size: 11, color: { argb: "FF64748B" } };

  if (metrics) {
    sheet.addRow([]);
    sheet.addRow([
      labels.metricsTotalHeadcount || "Tổng nhân sự",
      metrics.totalHeadcount ?? 0,
      labels.metricsPresent || "Hiện diện",
      `${metrics.totalPresent ?? 0} / ${metrics.totalHeadcount ?? 0}`,
      labels.metricsAbsenceRate || "Tỷ lệ vắng",
      formatDailyReportAbsentRate(metrics.absenceRate),
    ]);
  }

  sheet.addRow([]);

  const headerDate = dateKey
    ? `${String(dateKey).slice(8, 10)}-${String(dateKey).slice(5, 7)}`
    : "";

  const mainHeader = sheet.addRow([
    `${labels.process || "Công đoạn"} / ${labels.category || "Phân loại"}`,
    null,
    labels.dayShift
      ? `${labels.dayShift}${headerDate ? ` (${headerDate})` : ""}`
      : "Ca ngày",
    null,
    null,
    null,
    null,
    labels.nightShift || "Ca đêm",
    null,
    null,
    null,
    null,
  ]);
  sheet.mergeCells(mainHeader.number, 1, mainHeader.number, 2);
  sheet.mergeCells(mainHeader.number, 3, mainHeader.number, 7);
  sheet.mergeCells(mainHeader.number, 8, mainHeader.number, 12);
  styleHeaderRow(mainHeader);

  const subHeader = sheet.addRow([
    labels.process || "Công đoạn",
    labels.category || "Phân loại",
    labels.headcount || "Tổng NS",
    labels.absence || "Vắng / phép",
    labels.present || "Hiện diện",
    labels.absenceRate || "Tỷ lệ vắng",
    labels.remarks || "Ghi chú",
    labels.headcount || "Tổng NS",
    labels.absence || "Vắng / phép",
    labels.present || "Hiện diện",
    labels.absenceRate || "Tỷ lệ vắng",
    labels.remarks || "Ghi chú",
  ]);
  styleSubHeaderRow(subHeader);

  const dataStartRow = subHeader.number + 1;
  const pendingLabel = labels.pendingShort || "Chưa đ.danh";

  for (const row of rows) {
    const regularRowNum = appendWorkerRow(
      sheet,
      labels.regularWorker || "Chính thức",
      row.regular.day,
      row.regular.night,
      pendingLabel,
    );
    const seasonalRowNum = appendWorkerRow(
      sheet,
      labels.dailyWorker || "Thời vụ",
      row.seasonal.day,
      row.seasonal.night,
      pendingLabel,
    );
    mergeProcessCell(
      sheet,
      regularRowNum,
      seasonalRowNum,
      row.labelKo,
      row.labelEn,
    );
  }

  const subtotalRegularRow = appendWorkerRow(
    sheet,
    labels.regularWorker || "Chính thức",
    summary.regular?.day,
    summary.regular?.night,
    pendingLabel,
  );
  const subtotalSeasonalRow = appendWorkerRow(
    sheet,
    labels.dailyWorker || "Thời vụ",
    summary.seasonal?.day,
    summary.seasonal?.night,
    pendingLabel,
  );
  mergeProcessCell(
    sheet,
    subtotalRegularRow,
    subtotalSeasonalRow,
    labels.total || "TỔNG",
    "TOTAL",
  );
  paintSubtotalRows(sheet, [subtotalRegularRow, subtotalSeasonalRow]);

  const grandRow = sheet.addRow([
    labels.grandTotal || "TỔNG CỘNG",
    null,
    ...buildShiftMetricValues(summary.grand?.day, pendingLabel),
    ...buildShiftMetricValues(summary.grand?.night, pendingLabel),
  ]);
  paintGrandTotalRow(sheet, grandRow.number, labels.grandTotal || "TỔNG CỘNG");

  styleDataRows(sheet, dataStartRow, grandRow.number);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildAttendanceDailyReportExportFilename(dateKey, "xlsx");
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportAttendanceDailyReportImage({
  node,
  dateKey,
  filterNoExport = true,
}) {
  const { toPng } = await import("html-to-image");
  if (!node) throw new Error("Missing export node");

  let scrollEl = null;
  let prevOverflow = "";

  try {
    scrollEl = node.querySelector(".adr-table-wrap");
    if (scrollEl) {
      prevOverflow = scrollEl.style.overflow;
      scrollEl.style.overflow = "visible";
    }

    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      filter: (el) => {
        if (!(el instanceof Element)) return true;
        if (filterNoExport && el.classList.contains("adr-no-export")) {
          return false;
        }
        return true;
      },
    });

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = buildAttendanceDailyReportExportFilename(dateKey, "png");
    link.click();
  } finally {
    if (scrollEl) {
      scrollEl.style.overflow = prevOverflow;
    }
  }
}
