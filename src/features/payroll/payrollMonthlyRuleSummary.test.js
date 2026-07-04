import { describe, expect, it } from "vitest";
import {
  buildMonthlyDetailFlatValues,
  buildMonthlyRuleSummary,
  fmtPayrollMonthlySummaryCell,
  isPayrollMonthDayCellBeforeJoinWithoutAttendance,
  isPayrollSaturdayOffWorkDay,
} from "@/features/payroll/payrollMonthlyRuleSummary";
import {
  MONTH_DETAIL_COLS_PER_BLOCK,
  MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
} from "@/features/payroll/payrollMonthlyTimesheetLayout";

/** 2026-01-10 là thứ Bảy. */
const SAT_OFF_KEY = "2026-01-10";

function makeChunk({ isOffDay, isHolidayDay, isCompensatoryDay, employees }) {
  const byId = new Map();
  const byMonthEmployeeKey = new Map();
  for (const emp of employees) {
    byId.set(emp.id, emp);
    byMonthEmployeeKey.set(emp.monthEmployeeKey || emp.mnv || emp.id, emp);
  }
  return {
    isOffDay: Boolean(isOffDay),
    isHolidayDay: Boolean(isHolidayDay),
    isCompensatoryDay: Boolean(isCompensatoryDay),
    byId,
    byMonthEmployeeKey,
  };
}

describe("isPayrollSaturdayOffWorkDay", () => {
  it("thứ Bảy + OFF, không lễ", () => {
    expect(
      isPayrollSaturdayOffWorkDay(SAT_OFF_KEY, {
        isOffDay: true,
        isHolidayDay: false,
      }),
    ).toBe(true);
  });

  it("thứ Hai OFF → false", () => {
    expect(
      isPayrollSaturdayOffWorkDay("2026-01-12", {
        isOffDay: true,
        isHolidayDay: false,
      }),
    ).toBe(false);
  });

  it("thứ Bảy lễ → false", () => {
    expect(
      isPayrollSaturdayOffWorkDay(SAT_OFF_KEY, {
        isOffDay: true,
        isHolidayDay: true,
      }),
    ).toBe(false);
  });
});

describe("buildMonthlyRuleSummary — SAT.S thứ Bảy OFF", () => {
  const empId = "e1";
  const nightEmp = {
    id: empId,
    gioVao: "22:00",
    gioRa: "06:00",
    caLamViec: "S2",
    loaiPhep: "",
    duocNghiBu: "",
    includeTapVuInWorkingHours: false,
    includeThaiSanInWorkingHours: false,
    payrollEarlyOtPaperwork: false,
    payrollLateOtExcluded: false,
  };

  it("ca đêm: giờ vẫn vào coeff27 và sats27; +1 ngày công SAT.S", () => {
    const dayChunks = new Map([
      [
        SAT_OFF_KEY,
        makeChunk({
          isOffDay: true,
          isHolidayDay: false,
          isCompensatoryDay: false,
          employees: [nightEmp],
        }),
      ],
    ]);
    const { total } = buildMonthlyRuleSummary(
      dayChunks,
      [SAT_OFF_KEY],
      empId,
      { ngayVaoLam: "2020-01-01" },
    );

    expect(total.coeff27).toBeGreaterThan(0);
    expect(total.sats27).toBe(total.coeff27);
    expect(total.satsWorkDays).toBe(1);
    expect(total.workDays).toBe(1);
    expect(total.nightShiftWindowHours).toBe(8);
  });

  it("ca ngày OFF thứ Bảy: coeff20 có giờ; sats27 = 0", () => {
    const dayEmp = {
      ...nightEmp,
      gioVao: "08:00",
      gioRa: "17:00",
      caLamViec: "S1",
    };
    const dayChunks = new Map([
      [
        SAT_OFF_KEY,
        makeChunk({
          isOffDay: true,
          employees: [dayEmp],
        }),
      ],
    ]);
    const { total } = buildMonthlyRuleSummary(
      dayChunks,
      [SAT_OFF_KEY],
      empId,
      { ngayVaoLam: "2020-01-01" },
    );

    expect(total.coeff20).toBeGreaterThan(0);
    expect(total.sats27).toBe(0);
    expect(total.satsWorkDays).toBe(1);
  });
});

describe("buildMonthlyDetailFlatValues", () => {
  it("dòng đầu (si=0) hiển thị tổng giờ TC theo hệ số ở cả 3 khối", () => {
    const summaries = {
      total: {
        standardWorkDays: 26,
        workHours: 0,
        workDays: 0,
        unpaidDays: 0,
        pnDays: 0,
        nbDays: 0,
        klDays: 0,
        kpDays: 0,
        coeff03: 0,
        coeff15: 6,
        coeff20: 16,
        coeff27: 0,
        coeff30: 8,
        coeff39: 0,
        satsWorkDays: 0,
        sats20: 0,
        sats27: 0,
      },
      trial: {
        standardWorkDays: 0,
        workHours: 0,
        workDays: 0,
        unpaidDays: 0,
        pnDays: 0,
        nbDays: 0,
        klDays: 0,
        kpDays: 0,
        coeff03: 0,
        coeff15: 2,
        coeff20: 0,
        coeff27: 0,
        coeff30: 0,
        coeff39: 0,
        satsWorkDays: 0,
        sats20: 0,
        sats27: 0,
      },
      official: {
        standardWorkDays: 26,
        workHours: 0,
        workDays: 0,
        unpaidDays: 0,
        pnDays: 0,
        nbDays: 0,
        klDays: 0,
        kpDays: 0,
        coeff03: 0,
        coeff15: 4,
        coeff20: 16,
        coeff27: 0,
        coeff30: 8,
        coeff39: 0,
        satsWorkDays: 0,
        sats20: 0,
        sats27: 0,
      },
    };

    const flat = buildMonthlyDetailFlatValues({
      si: 0,
      summaries,
      coeffColBySubrow: MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
      fmt: fmtPayrollMonthlySummaryCell,
      colsPerBlock: MONTH_DETAIL_COLS_PER_BLOCK,
    });

    expect(flat[8]).toBe("6");
    expect(flat[MONTH_DETAIL_COLS_PER_BLOCK + 8]).toBe("2");
    expect(flat[2 * MONTH_DETAIL_COLS_PER_BLOCK + 8]).toBe("4");
  });

  it("dòng 1.5 (si=2) mirror cùng summary.coeff15 — không phải tổng riêng", () => {
    const summaries = {
      total: {
        standardWorkDays: 26,
        workHours: 0,
        workDays: 0,
        unpaidDays: 0,
        pnDays: 0,
        nbDays: 0,
        klDays: 0,
        kpDays: 0,
        coeff03: 0,
        coeff15: 6,
        coeff20: 0,
        coeff27: 0,
        coeff30: 0,
        coeff39: 0,
        satsWorkDays: 0,
        sats20: 0,
        sats27: 0,
      },
      trial: {
        standardWorkDays: 0,
        workHours: 0,
        workDays: 0,
        unpaidDays: 0,
        pnDays: 0,
        nbDays: 0,
        klDays: 0,
        kpDays: 0,
        coeff03: 0,
        coeff15: 0,
        coeff20: 0,
        coeff27: 0,
        coeff30: 0,
        coeff39: 0,
        satsWorkDays: 0,
        sats20: 0,
        sats27: 0,
      },
      official: {
        standardWorkDays: 0,
        workHours: 0,
        workDays: 0,
        unpaidDays: 0,
        pnDays: 0,
        nbDays: 0,
        klDays: 0,
        kpDays: 0,
        coeff03: 0,
        coeff15: 0,
        coeff20: 0,
        coeff27: 0,
        coeff30: 0,
        coeff39: 0,
        satsWorkDays: 0,
        sats20: 0,
        sats27: 0,
      },
    };

    const mainRow = buildMonthlyDetailFlatValues({
      si: 0,
      summaries,
      coeffColBySubrow: MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
      fmt: fmtPayrollMonthlySummaryCell,
      colsPerBlock: MONTH_DETAIL_COLS_PER_BLOCK,
    });
    const row15 = buildMonthlyDetailFlatValues({
      si: 2,
      summaries,
      coeffColBySubrow: MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
      fmt: fmtPayrollMonthlySummaryCell,
      colsPerBlock: MONTH_DETAIL_COLS_PER_BLOCK,
    });

    expect(mainRow[8]).toBe("6");
    expect(row15[8]).toBe("6");
  });

  it("buildMonthlyRuleSummary: coeff* cộng theo ngày; mọi dòng con mirror cùng ô tổng", () => {
    const empId = "e-sat";
    const dayEmp = {
      id: empId,
      gioVao: "07:30",
      gioRa: "17:30",
      caLamViec: "S1",
    };
    const dayChunks = new Map([
      [
        SAT_OFF_KEY,
        makeChunk({
          isOffDay: true,
          employees: [dayEmp],
        }),
      ],
    ]);
    const { total } = buildMonthlyRuleSummary(
      dayChunks,
      [SAT_OFF_KEY],
      empId,
      { ngayVaoLam: "2020-01-01" },
    );

    expect(total.coeff20).toBeGreaterThan(0);
    const summaries = { total, trial: total, official: total };
    const flatMain = buildMonthlyDetailFlatValues({
      si: 0,
      summaries,
      coeffColBySubrow: MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
      fmt: fmtPayrollMonthlySummaryCell,
      colsPerBlock: MONTH_DETAIL_COLS_PER_BLOCK,
    });
    for (let si = 1; si <= 6; si += 1) {
      const coeffIdx = MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW[si];
      if (coeffIdx == null) continue;
      const flatSub = buildMonthlyDetailFlatValues({
        si,
        summaries,
        coeffColBySubrow: MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
        fmt: fmtPayrollMonthlySummaryCell,
        colsPerBlock: MONTH_DETAIL_COLS_PER_BLOCK,
      });
      expect(flatSub[7 + coeffIdx]).toBe(flatMain[7 + coeffIdx]);
    }
  });
});

describe("buildMonthlyRuleSummary — 1/2PN + TC", () => {
  const empId = "e-half";
  const weekdayKey = "2026-01-13"; // thứ Ba

  it("Tổng GC thực tế = giờ nửa ngày + TC ×1.5", () => {
    const halfPnEmp = {
      id: empId,
      gioVao: "07:30",
      gioRa: "18:00",
      caLamViec: "S1",
      loaiPhep: "1/2 Phép năm",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    };
    const dayChunks = new Map([
      [
        weekdayKey,
        makeChunk({
          isOffDay: false,
          isHolidayDay: false,
          employees: [halfPnEmp],
        }),
      ],
    ]);
    const { total } = buildMonthlyRuleSummary(
      dayChunks,
      [weekdayKey],
      empId,
      { ngayVaoLam: "2020-01-01" },
    );

    expect(total.workHours).toBe(5);
    expect(total.coeff15).toBe(1);
    expect(total.pnDays).toBe(0.5);
  });
});

describe("buildMonthlyRuleSummary — Tổng GC thực tế vs cộng ô ngày", () => {
  const empId = "e-gc";
  const dk = "2026-01-14";

  it("workHours = GC dòng chính + TC (dòng hệ số) — không chỉ dòng chính", () => {
    const emp = {
      id: empId,
      gioVao: "08:00",
      gioRa: "18:00",
      caLamViec: "S1",
      loaiPhep: "",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    };
    const dayChunks = new Map([
      [dk, makeChunk({ isOffDay: false, isHolidayDay: false, employees: [emp] })],
    ]);
    const { total } = buildMonthlyRuleSummary(
      dayChunks,
      [dk],
      empId,
      { ngayVaoLam: "2020-01-01" },
    );
    // Dòng chính chỉ GC 8; TC ×1.5 = 1 trên dòng hệ số.
    expect(total.workHours).toBe(9);
    expect(total.coeff15).toBe(1);
  });
});

describe("buildMonthlyRuleSummary — đồng bộ bảng ngày", () => {
  const empId = "200611";
  const workKey = "2026-06-12";

  it("vẫn tính giờ khi ngày chấm công trước ngày vào làm trên hồ sơ gộp", () => {
    const emp = {
      id: "-OxEmp1",
      mnv: empId,
      monthEmployeeKey: empId,
      gioVao: "07:34",
      gioRa: "20:03",
      caLamViec: "S1",
      loaiPhep: "",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    };
    const dayChunks = new Map([
      [
        workKey,
        makeChunk({
          isOffDay: false,
          isHolidayDay: false,
          employees: [emp],
        }),
      ],
    ]);
    const { total } = buildMonthlyRuleSummary(
      dayChunks,
      [workKey],
      empId,
      { ngayVaoLam: "2026-07-01", mnv: empId, id: "-OxEmp1" },
    );

    expect(total.workHours).toBeGreaterThan(0);
    expect(total.coeff15).toBeGreaterThan(0);
  });
});

describe("isPayrollMonthDayCellBeforeJoinWithoutAttendance", () => {
  it("có điểm danh → không ẩn dù trước ngày vào làm", () => {
    expect(
      isPayrollMonthDayCellBeforeJoinWithoutAttendance(
        "2026-06-12",
        "2026-07-01",
        { gioVao: "07:34" },
      ),
    ).toBe(false);
  });

  it("không điểm danh + trước ngày vào làm → ẩn", () => {
    expect(
      isPayrollMonthDayCellBeforeJoinWithoutAttendance(
        "2026-06-12",
        "2026-07-01",
        null,
      ),
    ).toBe(true);
  });
});

describe("buildMonthlyRuleSummary — cột PN / KL / KP", () => {
  const empId = "e-leave-cols";
  const dayKey = "2026-03-10";

  it("đếm PN=1, 1/2PN=0,5, KL=1, KP=1 theo loaiPhep", () => {
    const cases = [
      { loaiPhep: "Phép năm", pn: 1, kl: 0, kp: 0 },
      { loaiPhep: "1/2 Phép năm", pn: 0.5, kl: 0, kp: 0 },
      { loaiPhep: "Không lương", pn: 0, kl: 1, kp: 0 },
      { loaiPhep: "Không phép", pn: 0, kl: 0, kp: 1 },
    ];
    for (const c of cases) {
      const emp = {
        id: empId,
        loaiPhep: c.loaiPhep,
        gioVao: "",
        gioRa: "",
        caLamViec: "S1",
      };
      const dayChunks = new Map([
        [dayKey, makeChunk({ employees: [emp] })],
      ]);
      const { total } = buildMonthlyRuleSummary(
        dayChunks,
        [dayKey],
        empId,
        { ngayVaoLam: "2020-01-01" },
      );
      expect(total.pnDays).toBe(c.pn);
      expect(total.klDays).toBe(c.kl);
      expect(total.kpDays).toBe(c.kp);
    }
  });
});

describe("buildMonthlyRuleSummary — Tổng ngày công", () => {
  const empId = "e-workdays";
  const dayKey = "2026-04-15";

  it("cộng ngày công + phép có lương; trừ PO, KL, KP", () => {
    const cases = [
      { loaiPhep: "Phép năm", gioVao: "", gioRa: "", workDays: 1 },
      { loaiPhep: "1/2 Phép năm", gioVao: "", gioRa: "", workDays: 0.5 },
      { loaiPhep: "Phép ốm", gioVao: "", gioRa: "", workDays: 0 },
      { loaiPhep: "Không lương", gioVao: "", gioRa: "", workDays: 0 },
      { loaiPhep: "Không phép", gioVao: "", gioRa: "", workDays: 0 },
      { loaiPhep: "Phép cưới", gioVao: "", gioRa: "", workDays: 1 },
      { loaiPhep: "", gioVao: "07:30", gioRa: "16:30", workDays: 1 },
    ];
    for (const c of cases) {
      const emp = {
        id: empId,
        loaiPhep: c.loaiPhep,
        gioVao: c.gioVao,
        gioRa: c.gioRa,
        caLamViec: "S1",
      };
      const dayChunks = new Map([
        [dayKey, makeChunk({ employees: [emp] })],
      ]);
      const { total } = buildMonthlyRuleSummary(
        dayChunks,
        [dayKey],
        empId,
        { ngayVaoLam: "2020-01-01" },
      );
      expect(total.workDays).toBe(c.workDays);
    }
  });

  it("Tổng ngày nghỉ không lương = Ngày công chuẩn − Tổng ngày công", () => {
    const keys = ["2026-04-14", "2026-04-15", "2026-04-16"];
    const workEmp = {
      id: empId,
      loaiPhep: "",
      gioVao: "07:30",
      gioRa: "16:30",
      caLamViec: "S1",
    };
    const dayChunks = new Map([
      [keys[0], makeChunk({ employees: [workEmp] })],
      [keys[1], makeChunk({ employees: [] })],
      [keys[2], makeChunk({ employees: [] })],
    ]);
    const { total } = buildMonthlyRuleSummary(dayChunks, keys, empId, {
      ngayVaoLam: "2020-01-01",
    });
    expect(total.standardWorkDays).toBe(3);
    expect(total.workDays).toBe(1);
    expect(total.unpaidDays).toBe(2);
  });
});

describe("buildMonthlyRuleSummary — Nghỉ bù (NB)", () => {
  const empId = "e-nb";
  const trialKey = "2026-01-14";
  const officialKey = "2026-01-16";

  it("đếm NB theo cờ ngày nghỉ bù ở cả 3 khối tháng", () => {
    const emp = {
      id: empId,
      gioVao: "08:00",
      gioRa: "17:00",
      caLamViec: "S1",
      duocNghiBu: "YES",
      loaiPhep: "",
    };
    const dayChunks = new Map([
      [
        trialKey,
        makeChunk({
          isOffDay: false,
          isHolidayDay: false,
          isCompensatoryDay: true,
          employees: [emp],
        }),
      ],
      [
        officialKey,
        makeChunk({
          isOffDay: false,
          isHolidayDay: false,
          isCompensatoryDay: true,
          employees: [emp],
        }),
      ],
    ]);
    const summaries = buildMonthlyRuleSummary(
      dayChunks,
      [trialKey, officialKey],
      empId,
      { ngayVaoLam: "2020-01-01", ngayHopDong: officialKey },
    );

    expect(summaries.total.nbDays).toBe(2);
    expect(summaries.trial.nbDays).toBe(1);
    expect(summaries.official.nbDays).toBe(1);
  });

  it("không đếm NB khi nhân viên bị đặt duocNghiBu = NO", () => {
    const emp = {
      id: empId,
      gioVao: "08:00",
      gioRa: "17:00",
      caLamViec: "S1",
      duocNghiBu: "NO",
      loaiPhep: "",
    };
    const dayChunks = new Map([
      [
        trialKey,
        makeChunk({
          isOffDay: false,
          isHolidayDay: false,
          isCompensatoryDay: true,
          employees: [emp],
        }),
      ],
    ]);
    const { total } = buildMonthlyRuleSummary(
      dayChunks,
      [trialKey],
      empId,
      { ngayVaoLam: "2020-01-01" },
    );

    expect(total.nbDays).toBe(0);
  });
});
