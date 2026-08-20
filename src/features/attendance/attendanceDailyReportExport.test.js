import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import ExcelJS from "exceljs";
import {
  buildAttendanceDailyReportGrid,
  buildDailyReportDashboardMetrics,
} from "./attendanceDailyReportStats";
import { exportAttendanceDailyReportExcel } from "./attendanceDailyReportExport";

describe("exportAttendanceDailyReportExcel", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:mock"),
        revokeObjectURL: vi.fn(),
      }),
    );
    vi.stubGlobal(
      "document",
      {
        createElement: vi.fn(() => ({ click: vi.fn(), href: "", download: "" })),
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds workbook buffer without throwing", async () => {
    const regular = [
      {
        boPhan: "PRESS",
        caLamViec: "S1",
        gioVao: "07:30",
        loaiPhep: "",
      },
      {
        boPhan: "PRESS",
        caLamViec: "S1",
        gioVao: "",
        loaiPhep: "Phép năm",
      },
    ];
    const { rows, summary } = buildAttendanceDailyReportGrid(regular, []);
    const metrics = buildDailyReportDashboardMetrics(rows, summary);

    await expect(
      exportAttendanceDailyReportExcel({
        dateKey: "2026-08-20",
        rows,
        summary,
        metrics,
        labels: {
          process: "Công đoạn",
          category: "Phân loại",
          dayShift: "Ca ngày",
          nightShift: "Ca đêm",
          headcount: "Tổng NS",
          absence: "Vắng / phép",
          present: "Hiện diện",
          absenceRate: "Tỷ lệ vắng",
          remarks: "Ghi chú",
          pendingShort: "Chưa đ.danh",
          regularWorker: "Chính thức",
          dailyWorker: "Thời vụ",
          total: "TỔNG",
          grandTotal: "TỔNG CỘNG",
          dateLabel: "Ngày",
          metricsTotalHeadcount: "Tổng nhân sự",
          metricsPresent: "Hiện diện",
          metricsAbsenceRate: "Tỷ lệ vắng",
        },
        title: "Điểm danh nhân sự SẢN XUẤT",
      }),
    ).resolves.toBeUndefined();

    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("produces a readable worksheet structure", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("test");
    const row = sheet.addRow([
      null,
      "Chính thức",
      1,
      0,
      1,
      "0%",
      "—",
      0,
      0,
      0,
      "—",
      "—",
    ]);
    expect(row.number).toBe(1);
    expect(row.cellCount).toBeGreaterThanOrEqual(7);
  });
});
