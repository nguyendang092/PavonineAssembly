import { describe, expect, it } from "vitest";
import {
  buildAttendanceDashboardSnapshot,
  classifyAttendanceDashboardEmployee,
  extractNvResignationDateDisplay,
  isAttendanceLateByClock,
  isAttendanceOnTimeByClock,
  parseAttendanceNoteDateDisplay,
} from "./attendanceDashboardMetrics";

describe("attendanceDashboardMetrics", () => {
  it("classifies on-time by clock <= 07:40", () => {
    expect(isAttendanceOnTimeByClock("07:40")).toBe(true);
    expect(isAttendanceOnTimeByClock("07:41")).toBe(false);
    expect(isAttendanceLateByClock("07:41")).toBe(true);
  });

  it("classifies late when clock after cutoff", () => {
    const row = classifyAttendanceDashboardEmployee({
      gioVao: "07:55",
      loaiPhep: "",
      caLamViec: "S1",
    });
    expect(row.category).toBe("late");
  });

  it("S2 night shift is late only after 19:40", () => {
    expect(
      classifyAttendanceDashboardEmployee({
        gioVao: "19:30",
        loaiPhep: "",
        caLamViec: "S2",
      }).category,
    ).toBe("onTime");
    expect(
      classifyAttendanceDashboardEmployee({
        gioVao: "19:40",
        loaiPhep: "",
        caLamViec: "S2",
      }).category,
    ).toBe("onTime");
    expect(
      classifyAttendanceDashboardEmployee({
        gioVao: "19:41",
        loaiPhep: "",
        caLamViec: "S2",
      }).category,
    ).toBe("late");
    expect(
      classifyAttendanceDashboardEmployee({
        gioVao: "18:00",
        loaiPhep: "VT",
        caLamViec: "S2",
      }).category,
    ).toBe("onTime");
  });

  it("classifies approved leave separately from absent", () => {
    const row = classifyAttendanceDashboardEmployee({
      gioVao: "",
      loaiPhep: "PN",
      caLamViec: "",
    });
    expect(row.category).toBe("onLeave");
  });

  it("builds snapshot totals", () => {
    const snap = buildAttendanceDashboardSnapshot(
      [
        { hoVaTen: "A", mnv: "1", boPhan: "QC", gioVao: "07:30", caLamViec: "S1" },
        { hoVaTen: "B", mnv: "2", boPhan: "QC", gioVao: "07:50", caLamViec: "S1" },
        { hoVaTen: "C", mnv: "3", boPhan: "HR", loaiPhep: "PN" },
        { hoVaTen: "D", mnv: "4", boPhan: "HR" },
      ],
      "2026-07-13",
    );
    expect(snap.summary.total).toBe(4);
    expect(snap.summary.onTime).toBe(1);
    expect(snap.summary.late).toBe(1);
    expect(snap.summary.onLeave).toBe(1);
    expect(snap.summary.absent).toBe(1);
  });

  it("marks departments at 100% on-time separately", () => {
    const employees = [
      { hoVaTen: "A", mnv: "1", boPhan: "QC", gioVao: "07:30", caLamViec: "S1" },
      { hoVaTen: "B", mnv: "2", boPhan: "QC", gioVao: "07:35", caLamViec: "S1" },
      { hoVaTen: "C", mnv: "3", boPhan: "HR", gioVao: "07:50", caLamViec: "S1" },
    ];
    const snap = buildAttendanceDashboardSnapshot(employees, "2026-07-13");
    const qc = snap.deptWatchlist.find((r) => r.dept === "QC");
    const hr = snap.deptWatchlist.find((r) => r.dept === "HR");
    expect(qc?.onTime).toBe(2);
    expect(qc?.total).toBe(2);
    expect(qc?.isFullOnTime).toBe(true);
    expect(hr?.isFullOnTime).toBe(false);
  });

  it("includes every department in dept watchlist (no top-N cap)", () => {
    const employees = Array.from({ length: 12 }, (_, i) => ({
      hoVaTen: `E${i}`,
      mnv: String(i),
      boPhan: `Dept${i}`,
      gioVao: i % 2 === 0 ? "07:30" : "07:50",
      caLamViec: "S1",
    }));
    const snap = buildAttendanceDashboardSnapshot(employees, "2026-07-13");
    expect(snap.deptWatchlist).toHaveLength(12);
    expect(snap.deptWatchlist.map((r) => r.dept).sort()).toEqual(
      employees.map((e) => e.boPhan).sort(),
    );
  });

  it("builds dept resignation rate from resigned leave flags", () => {
    const employees = [
      {
        hoVaTen: "A",
        mnv: "1",
        boPhan: "QC",
        loaiPhep: "Nghỉ việc",
        chamCong: "15/07/2026",
        _dashboardDate: "2026-07-10",
      },
      { hoVaTen: "B", mnv: "2", boPhan: "QC", gioVao: "07:30", caLamViec: "S1" },
      {
        hoVaTen: "C",
        mnv: "3",
        boPhan: "HR",
        loaiPhep: "Nghỉ việc",
        _dashboardDate: "2026-07-08",
      },
      { hoVaTen: "D", mnv: "4", boPhan: "HR", gioVao: "07:30", caLamViec: "S1" },
      { hoVaTen: "E", mnv: "5", boPhan: "HR", gioVao: "07:35", caLamViec: "S1" },
    ];
    const snap = buildAttendanceDashboardSnapshot(employees, "2026-07-13");
    const qc = snap.deptResignationRate.find((r) => r.dept === "QC");
    const hr = snap.deptResignationRate.find((r) => r.dept === "HR");
    expect(qc?.resigned).toBe(1);
    expect(qc?.total).toBe(2);
    expect(qc?.rate).toBe(50);
    expect(hr?.resigned).toBe(1);
    expect(hr?.total).toBe(3);
    expect(hr?.rate).toBe(33.3);
    expect(snap.resignationSummary.resignedRecords).toBe(2);
    expect(snap.resignationSummary.uniqueResigned).toBe(2);
    expect(snap.resignedEmployees).toHaveLength(2);
    expect(snap.resignedEmployees.find((r) => r.mnv === "1")?.resignationDate).toBe(
      "15/07/2026",
    );
    expect(snap.resignedEmployees.find((r) => r.mnv === "3")?.resignationDate).toBe(
      "08/07/2026",
    );
  });

  it("extracts resignation date from NV note fields", () => {
    expect(parseAttendanceNoteDateDisplay("15/07/2026")).toBe("15/07/2026");
    expect(parseAttendanceNoteDateDisplay("2026-07-08")).toBe("08/07/2026");
    expect(parseAttendanceNoteDateDisplay("07:30")).toBe(null);

    expect(
      extractNvResignationDateDisplay({
        loaiPhep: "Nghỉ việc",
        chamCong: "20/06/2026",
      }),
    ).toBe("20/06/2026");

    expect(
      extractNvResignationDateDisplay({
        loaiPhep: "Nghỉ việc",
        _dashboardDate: "2026-07-13",
      }),
    ).toBe("13/07/2026");
  });

  it("morning buckets run 05:00–08:10 without 08:20/08:30", () => {
    const snap = buildAttendanceDashboardSnapshot([], "2026-07-13");
    const labels = snap.morningBuckets.map((b) => b.label);
    expect(labels[0]).toBe("05:00");
    expect(labels.at(-1)).toBe("08:10");
    expect(labels).toContain("05:50");
    expect(labels).toContain("06:00");
    expect(labels).not.toContain("08:20");
    expect(labels).not.toContain("08:30");
  });

  it("includes every department in dept headcount (no top-N cap)", () => {
    const employees = Array.from({ length: 14 }, (_, i) => ({
      hoVaTen: `E${i}`,
      mnv: String(i),
      boPhan: `Dept${i}`,
      gioVao: "07:30",
      caLamViec: "S1",
    }));
    const snap = buildAttendanceDashboardSnapshot(employees, "2026-07-13");
    expect(snap.deptHeadcount).toHaveLength(14);
  });

  it("builds seven seniority buckets including month ranges", () => {
    const snap = buildAttendanceDashboardSnapshot(
      [
        {
          hoVaTen: "New",
          mnv: "1",
          boPhan: "QC",
          ngayVaoLam: "2026-05-01",
          gioVao: "07:30",
          caLamViec: "S1",
        },
        {
          hoVaTen: "Mid",
          mnv: "2",
          boPhan: "QC",
          ngayVaoLam: "2024-01-01",
          gioVao: "07:30",
          caLamViec: "S1",
        },
        {
          hoVaTen: "Vet",
          mnv: "3",
          boPhan: "HR",
          ngayVaoLam: "2010-01-01",
          gioVao: "07:30",
          caLamViec: "S1",
        },
      ],
      "2026-07-13",
    );
    expect(snap.seniority.buckets).toHaveLength(7);
    expect(snap.seniority.buckets.map((b) => b.key)).toEqual([
      "lt3m",
      "m3_6",
      "m6_1y",
      "y1_3",
      "y3_5",
      "y5_10",
      "gt10",
    ]);
    expect(snap.seniority.buckets.find((b) => b.key === "lt3m")?.count).toBe(1);
    expect(snap.seniority.buckets.find((b) => b.key === "y1_3")?.count).toBe(1);
    expect(snap.seniority.buckets.find((b) => b.key === "gt10")?.count).toBe(1);
  });

  it("groups new hires by join year from ngayVaoLam", () => {
    const snap = buildAttendanceDashboardSnapshot(
      [
        {
          hoVaTen: "A",
          mnv: "1",
          boPhan: "QC",
          ngayVaoLam: "2024-03-15",
          gioVao: "07:30",
          caLamViec: "S1",
        },
        {
          hoVaTen: "B",
          mnv: "2",
          boPhan: "HR",
          ngayVaoLam: "2024-08-01",
          gioVao: "07:30",
          caLamViec: "S1",
        },
        {
          hoVaTen: "C",
          mnv: "3",
          boPhan: "MC",
          ngayVaoLam: "2026-01-10",
          gioVao: "07:30",
          caLamViec: "S1",
        },
      ],
      "2026-07-13",
    );
    expect(snap.newHiresByYear).toEqual([
      { year: 2024, count: 2 },
      { year: 2026, count: 1 },
    ]);
  });
});
