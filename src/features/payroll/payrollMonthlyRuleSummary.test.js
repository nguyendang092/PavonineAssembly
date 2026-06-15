import { describe, expect, it } from "vitest";
import {
  buildMonthlyDetailFlatValues,
  buildMonthlyRuleSummary,
  fmtPayrollMonthlySummaryCell,
  isPayrollSaturdayOffWorkDay,
} from "@/features/payroll/payrollMonthlyRuleSummary";
import { MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW } from "@/features/payroll/payrollMonthlyTimesheetLayout";

/** 2026-01-10 là thứ Bảy. */
const SAT_OFF_KEY = "2026-01-10";

function makeChunk({ isOffDay, isHolidayDay, isCompensatoryDay, employees }) {
  const byId = new Map();
  for (const emp of employees) {
    byId.set(emp.id, emp);
  }
  return {
    isOffDay: Boolean(isOffDay),
    isHolidayDay: Boolean(isHolidayDay),
    isCompensatoryDay: Boolean(isCompensatoryDay),
    byId,
    byMonthEmployeeKey: byId,
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
    expect(total.nightShiftWindowHours).toBe(7);
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
      colsPerBlock: 17,
    });

    expect(flat[10]).toBe("6");
    expect(flat[17 + 10]).toBe("2");
    expect(flat[34 + 10]).toBe("4");
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
      colsPerBlock: 17,
    });
    const row15 = buildMonthlyDetailFlatValues({
      si: 2,
      summaries,
      coeffColBySubrow: MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
      fmt: fmtPayrollMonthlySummaryCell,
      colsPerBlock: 17,
    });

    expect(mainRow[10]).toBe("6");
    expect(row15[10]).toBe("6");
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
      colsPerBlock: 17,
    });
    for (let si = 1; si <= 6; si += 1) {
      const coeffIdx = MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW[si];
      if (coeffIdx == null) continue;
      const flatSub = buildMonthlyDetailFlatValues({
        si,
        summaries,
        coeffColBySubrow: MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
        fmt: fmtPayrollMonthlySummaryCell,
        colsPerBlock: 17,
      });
      expect(flatSub[9 + coeffIdx]).toBe(flatMain[9 + coeffIdx]);
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
