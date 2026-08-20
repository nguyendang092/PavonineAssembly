import { describe, expect, it } from "vitest";
import {
  buildAttendanceDailyReportGrid,
  buildDailyReportDashboardMetrics,
  formatDailyReportRemarkCounts,
  getDailyReportAndonTier,
  getDailyReportProcessMaxAbsentRate,
  getDailyReportRateBarWidth,
  getDailyReportRemarkTags,
} from "./attendanceDailyReportStats";
import {
  resolveDailyReportEmployeeProcessId,
  resolveDailyReportProcessId,
} from "./attendanceDailyReportConfig";

describe("resolveDailyReportProcessId", () => {
  it("maps known departments", () => {
    expect(resolveDailyReportProcessId("PRESS")).toBe("press");
    expect(resolveDailyReportProcessId("EXTRUCSION")).toBe("extrusion");
    expect(resolveDailyReportProcessId("MC")).toBe("mc");
    expect(resolveDailyReportProcessId("HAIRLINE")).toBe("hairline");
    expect(resolveDailyReportProcessId("ANODIZING_1")).toBe("anodizing");
    expect(resolveDailyReportProcessId("ASSEMBLY")).toBe("assembly");
    expect(resolveDailyReportProcessId("QC")).toBeNull();
  });

  it("maps all ASSY department variants to assembly", () => {
    expect(resolveDailyReportProcessId("ASSY")).toBe("assembly");
    expect(resolveDailyReportProcessId("ASSY_3 CỬA RA VÀO")).toBe("assembly");
    expect(resolveDailyReportProcessId("ASSY_5 CỬA RA VÀO")).toBe("assembly");
    expect(resolveDailyReportProcessId("ASSY-5 LINE")).toBe("assembly");
    expect(resolveDailyReportProcessId("ASSY - PACKING")).toBe("assembly");
  });
});

describe("resolveDailyReportEmployeeProcessId", () => {
  it("falls back to maBoPhan when boPhan is empty", () => {
    expect(
      resolveDailyReportEmployeeProcessId({
        boPhan: "",
        maBoPhan: "PRESS",
      }),
    ).toBe("press");
  });
});

describe("buildAttendanceDailyReportGrid", () => {
  it("counts present vs absence by process, worker type, and shift", () => {
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
      {
        boPhan: "PRESS",
        caLamViec: "S2",
        gioVao: "19:30",
        loaiPhep: "",
      },
    ];
    const seasonal = [
      {
        boPhan: "PRESS",
        caLamViec: "S1",
        gioVao: "",
        loaiPhep: "",
      },
    ];

    const { rows, summary } = buildAttendanceDailyReportGrid(regular, seasonal);
    const press = rows.find((r) => r.processId === "press");

    expect(press.regular.day).toMatchObject({
      total: 2,
      absent: 1,
      present: 1,
    });
    expect(press.regular.night).toMatchObject({
      total: 1,
      absent: 0,
      present: 1,
    });
    expect(press.seasonal.day).toMatchObject({
      total: 1,
      absent: 0,
      pendingAttendance: 1,
      present: 0,
    });
    expect(press.seasonal.day.remarks).toBe("");
    expect(press.regular.day.remarks).toContain("PN");
    expect(summary.grand.day.total).toBe(3);
    expect(summary.grand.day.absent).toBe(1);
    expect(summary.grand.day.pendingAttendance).toBe(1);
    expect(summary.grand.night.total).toBe(1);
  });

  it("counts seasonal absence using maBoPhan and chamCong leave", () => {
    const seasonal = [
      {
        boPhan: "",
        maBoPhan: "PRESS",
        caLamViec: "S1",
        gioVao: "",
        loaiPhep: "",
        chamCong: "Phép năm",
      },
    ];

    const { rows } = buildAttendanceDailyReportGrid([], seasonal);
    const press = rows.find((r) => r.processId === "press");

    expect(press.seasonal.day).toMatchObject({
      total: 1,
      absent: 1,
      present: 0,
    });
    expect(press.seasonal.day.remarks).toContain("PN");
    expect(press.regular.day.total).toBe(0);
  });

  it("does not count empty leave type in absence or remarks", () => {
    const regular = [
      {
        boPhan: "PRESS",
        caLamViec: "S1",
        gioVao: "",
        loaiPhep: "",
      },
      {
        boPhan: "PRESS",
        caLamViec: "S1",
        gioVao: "",
        loaiPhep: "Không lương",
      },
    ];

    const { rows } = buildAttendanceDailyReportGrid(regular, []);
    const press = rows.find((r) => r.processId === "press");

    expect(press.regular.day).toMatchObject({
      total: 2,
      absent: 1,
      pendingAttendance: 1,
      present: 0,
    });
    expect(press.regular.day.remarks).toContain("KL");
    expect(press.regular.day.remarks).not.toMatch(/\bKL 2\b/);
  });

  it("excludes resigned leave from headcount, absence, and remarks", () => {
    const regular = [
      {
        boPhan: "PRESS",
        caLamViec: "S1",
        gioVao: "",
        loaiPhep: "Nghỉ việc",
      },
      {
        boPhan: "PRESS",
        caLamViec: "S1",
        gioVao: "",
        loaiPhep: "Phép năm",
      },
    ];

    const { rows } = buildAttendanceDailyReportGrid(regular, []);
    const press = rows.find((r) => r.processId === "press");

    expect(press.regular.day).toMatchObject({
      total: 1,
      absent: 1,
      present: 0,
    });
    expect(press.regular.day.remarks).toContain("PN");
    expect(press.regular.day.remarks).not.toContain("NV");
  });
});

describe("formatDailyReportRemarkCounts", () => {
  it("formats Korean remark fragments", () => {
    expect(
      formatDailyReportRemarkCounts(
        { annualLeave: 1, sickLeave: 1 },
        "ko-KR",
      ),
    ).toBe("연차 1 - 병가 1");
  });

  it("uses official Korean labels for absent and maternity", () => {
    expect(
      formatDailyReportRemarkCounts(
        { absent: 2, maternity: 1, recuperationLeave: 1 },
        "ko-KR",
      ),
    ).toBe("배우자 출산으로 휴가 1 - 몸조리 1 - 결근 2");
  });

  it("formats Vietnamese remark fragments with short codes", () => {
    expect(
      formatDailyReportRemarkCounts(
        { annualLeave: 1, sickLeave: 1 },
        "vi-VN",
      ),
    ).toBe("PN 1 - PO 1");
  });

  it("formats single remark without suffix", () => {
    expect(formatDailyReportRemarkCounts({ annualLeave: 1 }, "vi-VN")).toBe(
      "PN 1",
    );
  });
});

describe("daily report dashboard helpers", () => {
  it("classifies andon tiers by absence rate", () => {
    expect(getDailyReportAndonTier(0)).toBe("ok");
    expect(getDailyReportAndonTier(4.9)).toBe("ok");
    expect(getDailyReportAndonTier(5)).toBe("warn");
    expect(getDailyReportAndonTier(15)).toBe("warn");
    expect(getDailyReportAndonTier(15.1)).toBe("bad");
  });

  it("scales rate bar width with 20% cap", () => {
    expect(getDailyReportRateBarWidth(0)).toBe(0);
    expect(getDailyReportRateBarWidth(10)).toBe(50);
    expect(getDailyReportRateBarWidth(20)).toBe(100);
    expect(getDailyReportRateBarWidth(40)).toBe(100);
  });

  it("builds remark tags from counts", () => {
    expect(getDailyReportRemarkTags({ annualLeave: 1, sickLeave: 2 }, "vi-VN")).toEqual([
      { key: "annualLeave", code: "PN", count: 1 },
      { key: "sickLeave", code: "PO", count: 2 },
    ]);
  });

  it("builds dashboard metrics from summary", () => {
    const rows = [
      {
        labelKo: "프레스",
        regular: {
          day: { absentRate: 12.5 },
          night: { absentRate: 0 },
        },
        seasonal: {
          day: { absentRate: 20 },
          night: { absentRate: 0 },
        },
      },
      {
        labelKo: "압출",
        regular: {
          day: { absentRate: 0 },
          night: { absentRate: 0 },
        },
        seasonal: {
          day: { absentRate: 0 },
          night: { absentRate: 0 },
        },
      },
    ];
    const summary = {
      regular: {
        day: { total: 10, present: 9, absent: 1, pendingAttendance: 0 },
        night: { total: 2, present: 2, absent: 0, pendingAttendance: 0 },
      },
      seasonal: {
        day: { total: 5, present: 4, absent: 0, pendingAttendance: 1 },
        night: { total: 1, present: 1, absent: 0, pendingAttendance: 0 },
      },
      grand: {
        day: { total: 15, present: 13, absent: 1, pendingAttendance: 1 },
        night: { total: 3, present: 3, absent: 0, pendingAttendance: 0 },
      },
    };

    const metrics = buildDailyReportDashboardMetrics(rows, summary);

    expect(metrics.totalHeadcount).toBe(15);
    expect(metrics.regularHeadcount).toBe(10);
    expect(metrics.seasonalHeadcount).toBe(5);
    expect(metrics.totalPresent).toBe(16);
    expect(metrics.totalAbsent).toBe(1);
    expect(metrics.totalPending).toBe(1);
    expect(metrics.attentionCount).toBe(1);
    expect(metrics.attentionLabels).toEqual(["프레스"]);
    expect(getDailyReportProcessMaxAbsentRate(rows[0])).toBe(20);
  });
});
