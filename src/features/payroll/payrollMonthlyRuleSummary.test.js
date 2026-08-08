import { describe, expect, it } from "vitest";
import {
  buildMonthlyDetailFlatValues,
  buildMonthlyRuleSummary,
  countMonthlyStandardWorkDays,
  fmtPayrollMonthlySummaryCell,
  fmtPayrollMonthlySummaryHoursCell,
  isPayrollMonthDayCellBeforeJoinWithoutAttendance,
  isPayrollSaturdayOffWorkDay,
  payrollMonthlyJoinMonthMeetsAnnualLeaveAccrual,
  pickPayrollMonthlyTimesheetTotalWorkColumns,
} from "@/features/payroll/payrollMonthlyRuleSummary";
import { listCalendarDateKeysForYearMonth } from "@/features/leave/annualLeavePayrollAccrual";
import {
  MONTH_DETAIL_COLS_PER_BLOCK,
  MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
  resolveMonthlyDetailFlatIndex,
} from "@/features/payroll/payrollMonthlyTimesheetLayout";

/** 2026-01-10 là thứ Bảy. */
const SAT_OFF_KEY = "2026-01-10";

describe("countMonthlyStandardWorkDays", () => {
  it("counts month days minus Sundays (full calendar month)", () => {
    expect(
      countMonthlyStandardWorkDays(listCalendarDateKeysForYearMonth("2026-02")),
    ).toBe(24);
    expect(
      countMonthlyStandardWorkDays(listCalendarDateKeysForYearMonth("2026-01")),
    ).toBe(27);
  });
});

describe("buildMonthlyRuleSummary — Ngày thực tế làm việc", () => {
  it("shows full-month standard days even when join date is mid-month", () => {
    const monthKeys = listCalendarDateKeysForYearMonth("2026-07");
    const { total } = buildMonthlyRuleSummary(new Map(), monthKeys, "e1", {
      ngayVaoLam: "2026-07-10",
    });
    expect(total.standardWorkDays).toBe(27);
    expect(total.workDays).toBe(0);
    expect(total.unpaidDays).toBe(19);
  });
});

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

  it("Tài xế tổng — Thứ 7 OFF lịch không thuộc SAT.S", () => {
    expect(
      isPayrollSaturdayOffWorkDay(
        SAT_OFF_KEY,
        { isOffDay: true, isHolidayDay: false },
        { includeTaiXeTongInWorkingHours: "YES" },
      ),
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

  it("ngày thường S2 22:00–06:00 — khung 22–06 tối đa 8h", () => {
    const workKey = "2026-03-04";
    const dayChunks = new Map([
      [
        workKey,
        makeChunk({
          isOffDay: false,
          isHolidayDay: false,
          isCompensatoryDay: false,
          employees: [nightEmp],
        }),
      ],
    ]);
    const { total } = buildMonthlyRuleSummary(
      dayChunks,
      [workKey],
      empId,
      { ngayVaoLam: "2020-01-01" },
    );

    expect(total.nightShiftWindowHours).toBe(8);
    const flat = buildMonthlyDetailFlatValues({
      si: 0,
      summaries: { total },
      fmt: fmtPayrollMonthlySummaryCell,
    });
    expect(String(flat[resolveMonthlyDetailFlatIndex(0, 17)]).trim()).not.toBe(
      "",
    );
  });

  it("S2 19:40–06:00 — chỉ tính khung 22–06 (= 8h), không cộng GC trước 22h", () => {
    const workKey = "2026-03-05";
    const dayChunks = new Map([
      [
        workKey,
        makeChunk({
          isOffDay: false,
          isHolidayDay: false,
          isCompensatoryDay: false,
          employees: [
            {
              ...nightEmp,
              gioVao: "19:40",
              gioRa: "06:00",
            },
          ],
        }),
      ],
    ]);
    const { total } = buildMonthlyRuleSummary(
      dayChunks,
      [workKey],
      empId,
      { ngayVaoLam: "2020-01-01" },
    );

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
    expect(flat[MONTH_DETAIL_COLS_PER_BLOCK + 7]).toBe("2");
    expect(
      flat[MONTH_DETAIL_COLS_PER_BLOCK + MONTH_DETAIL_COLS_PER_BLOCK - 1 + 7],
    ).toBe("4");
  });

  it("fmtHours — giờ TC khối THỜI GIAN LÀM VIỆC & HỢP ĐỒNG: 2 số thập phân", () => {
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
        coeff15: 0.53,
        coeff20: 0,
        coeff27: 0,
        coeff30: 0,
        coeff39: 0,
        satsWorkDays: 0,
        sats20: 0,
        sats27: 0,
        nightShiftWindowHours: 0,
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
        coeff15: 1.5,
        coeff20: 0,
        coeff27: 0,
        coeff30: 0,
        coeff39: 0,
        satsWorkDays: 0,
        sats20: 0,
        sats27: 0,
        nightShiftWindowHours: 0,
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
        coeff15: 1,
        coeff20: 0,
        coeff27: 0,
        coeff30: 0,
        coeff39: 0,
        satsWorkDays: 0,
        sats20: 0,
        sats27: 0,
        nightShiftWindowHours: 0,
      },
    };

    const flat = buildMonthlyDetailFlatValues({
      si: 0,
      summaries,
      coeffColBySubrow: MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
      fmt: fmtPayrollMonthlySummaryCell,
      fmtHours: fmtPayrollMonthlySummaryHoursCell,
      colsPerBlock: MONTH_DETAIL_COLS_PER_BLOCK,
    });

    expect(flat[8]).toBe("0.53");
    expect(flat[MONTH_DETAIL_COLS_PER_BLOCK + 7]).toBe("1.5");
    expect(
      flat[MONTH_DETAIL_COLS_PER_BLOCK + MONTH_DETAIL_COLS_PER_BLOCK - 1 + 7],
    ).toBe("1.00");
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

  it("không tính giờ khi ngày chấm công trước ngày vào làm trên hồ sơ gộp", () => {
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

    expect(total.workHours).toBe(0);
    expect(total.coeff15).toBe(0);
  });
});

describe("isPayrollMonthDayCellBeforeJoinWithoutAttendance", () => {
  it("có điểm danh nhưng trước ngày vào làm → vẫn ẩn", () => {
    expect(
      isPayrollMonthDayCellBeforeJoinWithoutAttendance(
        "2026-06-12",
        "2026-07-01",
        { gioVao: "07:34" },
      ),
    ).toBe(true);
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

  it("từ ngày vào làm trở đi → không ẩn", () => {
    expect(
      isPayrollMonthDayCellBeforeJoinWithoutAttendance(
        "2026-07-01",
        "2026-07-01",
        null,
      ),
    ).toBe(false);
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

describe("buildMonthlyRuleSummary — khối THỜI GIAN THỬ VIỆC (ngày vào làm → trước ngày HĐ)", () => {
  const empId = "e-trial-wd";
  const trialKey = "2026-01-14";
  const officialKey = "2026-01-16";
  const joinKey = "2026-01-10";
  const preJoinKey = "2026-01-08";

  it("chỉ cộng ngày công từ ngày vào làm đến trước ngày HĐ vào trial.workDays", () => {
    const workEmp = {
      id: empId,
      loaiPhep: "",
      gioVao: "07:30",
      gioRa: "16:30",
      caLamViec: "S1",
    };
    const dayChunks = new Map([
      [trialKey, makeChunk({ employees: [workEmp] })],
      [officialKey, makeChunk({ employees: [workEmp] })],
    ]);
    const { total, trial, official } = buildMonthlyRuleSummary(
      dayChunks,
      [trialKey, officialKey],
      empId,
      { ngayVaoLam: "2020-01-01", ngayHopDong: officialKey },
    );

    expect(total.workDays).toBe(2);
    expect(trial.workDays).toBe(1);
    expect(official.workDays).toBe(1);
    expect(trial.standardWorkDays).toBe(1);
    expect(official.standardWorkDays).toBe(1);
  });

  it("bỏ qua ngày trước ngày vào làm trong khối thử việc", () => {
    const workEmp = {
      id: empId,
      loaiPhep: "",
      gioVao: "07:30",
      gioRa: "16:30",
      caLamViec: "S1",
    };
    const dayChunks = new Map([
      [preJoinKey, makeChunk({ employees: [workEmp] })],
      [joinKey, makeChunk({ employees: [workEmp] })],
      [trialKey, makeChunk({ employees: [workEmp] })],
      [officialKey, makeChunk({ employees: [workEmp] })],
    ]);
    const { total, trial, official } = buildMonthlyRuleSummary(
      dayChunks,
      [preJoinKey, joinKey, trialKey, officialKey],
      empId,
      { ngayVaoLam: joinKey, ngayHopDong: officialKey },
    );

    expect(total.workDays).toBe(3);
    expect(trial.workDays).toBe(2);
    expect(official.workDays).toBe(1);
    expect(trial.standardWorkDays).toBe(2);
  });

  it("lưới tháng: cột Tổng ngày công khối thử việc = trial.workDays", () => {
    const workEmp = {
      id: empId,
      loaiPhep: "",
      gioVao: "07:30",
      gioRa: "16:30",
      caLamViec: "S1",
    };
    const dayChunks = new Map([
      [trialKey, makeChunk({ employees: [workEmp] })],
      [officialKey, makeChunk({ employees: [workEmp] })],
    ]);
    const summaries = buildMonthlyRuleSummary(
      dayChunks,
      [trialKey, officialKey],
      empId,
      { ngayVaoLam: "2020-01-01", ngayHopDong: officialKey },
    );
    const flat = buildMonthlyDetailFlatValues({
      si: 0,
      summaries,
      coeffColBySubrow: MONTHLY_TIMESHEET_COEFF_COL_BY_SUBROW,
      fmt: fmtPayrollMonthlySummaryCell,
      fmtLeave: (n) => String(n),
      colsPerBlock: MONTH_DETAIL_COLS_PER_BLOCK,
    });

    const trialWorkDaysIdx = resolveMonthlyDetailFlatIndex(1, 0);
    expect(flat[trialWorkDaysIdx]).toBe("1");
    expect(flat[resolveMonthlyDetailFlatIndex(0, 1)]).toBe("2");
  });

  it("cả tháng làm việc: trial ≠ total khi ngày HĐ giữa tháng (vd. 6 vs 20 ngày công)", () => {
    const monthKeys = listCalendarDateKeysForYearMonth("2026-07");
    const workEmp = {
      id: empId,
      loaiPhep: "",
      gioVao: "07:30",
      gioRa: "16:30",
      caLamViec: "S1",
    };
    const dayChunks = new Map();
    for (const dk of monthKeys) {
      const pd = new Date(`${dk}T12:00:00`);
      if (pd.getDay() === 0) continue;
      dayChunks.set(dk, makeChunk({ employees: [workEmp] }));
    }
    const { total, trial, official } = buildMonthlyRuleSummary(
      dayChunks,
      monthKeys,
      empId,
      { ngayVaoLam: "2026-01-01", ngayHopDong: "2026-07-07" },
    );

    expect(total.workDays).toBeGreaterThan(10);
    expect(trial.workDays).toBe(5);
    expect(official.workDays).toBeGreaterThan(10);
    expect(trial.workDays).toBeLessThan(total.workDays);
  });

  it("đọc ngày HĐ từ dòng điểm danh khi rep thiếu ngày HĐ", () => {
    const workEmp = {
      id: empId,
      loaiPhep: "",
      gioVao: "07:30",
      gioRa: "16:30",
      caLamViec: "S1",
      ngayHopDong: officialKey,
    };
    const dayChunks = new Map([
      [trialKey, makeChunk({ employees: [workEmp] })],
      [officialKey, makeChunk({ employees: [workEmp] })],
    ]);
    const { total, trial, official } = buildMonthlyRuleSummary(
      dayChunks,
      [trialKey, officialKey],
      empId,
      { ngayVaoLam: "2020-01-01" },
    );

    expect(total.workDays).toBe(2);
    expect(trial.workDays).toBe(1);
    expect(official.workDays).toBe(1);
  });

  it("mọi NV có HĐ giữa tháng — trial ≠ total (không chỉ một MNV cụ thể)", () => {
    const monthKeys = listCalendarDateKeysForYearMonth("2026-07");
    const cases = [
      { rowId: "NV-A", join: "2026-07-01", contract: "2026-07-11" },
      { rowId: "NV-B", join: "2026-07-05", contract: "2026-07-20" },
      { rowId: "NV-C", join: "2026-07-09", contract: "2026-07-16" },
    ];

    for (const { rowId, join, contract } of cases) {
      const workEmp = {
        id: rowId,
        mnv: rowId,
        loaiPhep: "",
        gioVao: "07:30",
        gioRa: "16:30",
        caLamViec: "S1",
      };
      const dayChunks = new Map();
      for (const dk of monthKeys) {
        if (dk < join) continue;
        const pd = new Date(`${dk}T12:00:00`);
        if (pd.getDay() === 0) continue;
        const emp = {
          ...workEmp,
          ngayHopDong:
            dk === contract ? contract : dk === monthKeys[monthKeys.length - 1] ? "2026-12-01" : "",
        };
        dayChunks.set(dk, makeChunk({ employees: [emp] }));
      }

      const { total, trial, official } = buildMonthlyRuleSummary(
        dayChunks,
        monthKeys,
        rowId,
        { ngayVaoLam: join, ngayHopDong: "2026-12-01", mnv: rowId },
      );

      expect(trial.workDays).toBeGreaterThan(0);
      expect(official.workDays).toBeGreaterThan(0);
      expect(trial.workDays).toBeLessThan(total.workDays);
      expect(trial.workDays + official.workDays).toBe(total.workDays);
    }
  });

  it("NV 260714 — vào 9/7, HĐ 16/7: trial ≈ 6, total ≈ 20 (không bị chunk ghi đè ngày HĐ)", () => {
    const monthKeys = listCalendarDateKeysForYearMonth("2026-07");
    const rowId = "260714";
    const workEmp = {
      id: rowId,
      mnv: "260714",
      loaiPhep: "",
      gioVao: "07:30",
      gioRa: "16:30",
      caLamViec: "S1",
    };
    const dayChunks = new Map();
    for (const dk of monthKeys) {
      if (dk < "2026-07-09") continue;
      const pd = new Date(`${dk}T12:00:00`);
      if (pd.getDay() === 0) continue;
      const emp = {
        ...workEmp,
        ngayHopDong: dk === "2026-07-31" ? "2026-12-01" : "",
      };
      dayChunks.set(dk, makeChunk({ employees: [emp] }));
    }
    const { total, trial, official } = buildMonthlyRuleSummary(
      dayChunks,
      monthKeys,
      rowId,
      { ngayVaoLam: "9/7/2026", ngayHopDong: "16/7/2026", mnv: "260714" },
    );

    expect(total.workDays).toBe(20);
    expect(trial.workDays).toBe(6);
    expect(official.workDays).toBe(14);
    expect(trial.workDays).toBeLessThan(total.workDays);
  });

  it("NV 260714 — rep bị ngày HĐ sai: vẫn trial ≈ 6 khi chunk giữa tháng có 16/7", () => {
    const monthKeys = listCalendarDateKeysForYearMonth("2026-07");
    const rowId = "260714";
    const workEmp = {
      id: rowId,
      mnv: "260714",
      loaiPhep: "",
      gioVao: "07:30",
      gioRa: "16:30",
      caLamViec: "S1",
    };
    const dayChunks = new Map();
    for (const dk of monthKeys) {
      if (dk < "2026-07-09") continue;
      const pd = new Date(`${dk}T12:00:00`);
      if (pd.getDay() === 0) continue;
      const emp = {
        ...workEmp,
        ngayVaoLam: dk === "2026-07-09" ? "9/7/2026" : "",
        ngayHopDong:
          dk === "2026-07-16"
            ? "16/7/2026"
            : dk === "2026-07-31"
              ? "2026-12-01"
              : "",
      };
      dayChunks.set(dk, makeChunk({ employees: [emp] }));
    }
    const { total, trial, official } = buildMonthlyRuleSummary(
      dayChunks,
      monthKeys,
      rowId,
      { ngayHopDong: "2026-12-01", mnv: "260714" },
    );

    expect(total.workDays).toBe(20);
    expect(trial.workDays).toBe(6);
    expect(official.workDays).toBe(14);
  });
});

describe("pickPayrollMonthlyTimesheetTotalWorkColumns", () => {
  it("maps khối TỔNG → +1 phép khi tổng ngày công ≥ ½ ngày thực tế làm việc", () => {
    const monthKeys = listCalendarDateKeysForYearMonth("2026-06");
    const { total } = buildMonthlyRuleSummary(new Map(), monthKeys, "e1", {
      ngayVaoLam: "2026-06-25",
    });
    const cols = pickPayrollMonthlyTimesheetTotalWorkColumns(total);

    expect(cols.standardWorkDays).toBe(countMonthlyStandardWorkDays(monthKeys));
    expect(cols.workDays).toBe(0);
    expect(payrollMonthlyJoinMonthMeetsAnnualLeaveAccrual(total)).toBe(false);

    total.workDays = Math.ceil(total.standardWorkDays / 2);
    expect(payrollMonthlyJoinMonthMeetsAnnualLeaveAccrual(total)).toBe(true);
  });
});

describe("buildMonthlyRuleSummary — Nghỉ bù (NB)", () => {
  const empId = "e-nb";
  const trialKey = "2026-01-14";
  const officialKey = "2026-01-16";

  it("không đếm NB khi ngày nghỉ bù có giờ công — chỉ đếm khi ô lưới là NB", () => {
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

    expect(summaries.total.nbDays).toBe(0);
    expect(summaries.trial.nbDays).toBe(0);
    expect(summaries.official.nbDays).toBe(0);
    expect(summaries.total.workHours).toBeGreaterThan(0);
  });

  it("đếm NB khi ngày nghỉ bù không có giờ công ở cả 3 khối tháng", () => {
    const emp = {
      id: empId,
      gioVao: "",
      gioRa: "",
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

  it("không đếm NB khi ngày nghỉ bù trước ngày vào làm", () => {
    const nbKey = "2026-07-05";
    const dayChunks = new Map([
      [
        nbKey,
        makeChunk({
          isOffDay: false,
          isHolidayDay: false,
          isCompensatoryDay: true,
          employees: [],
        }),
      ],
    ]);
    const { total } = buildMonthlyRuleSummary(dayChunks, [nbKey], empId, {
      ngayVaoLam: "2026-07-10",
    });

    expect(total.nbDays).toBe(0);
    expect(total.workDays).toBe(0);
  });

  it("đếm NB khi ngày nghỉ bù từ ngày vào làm trở đi", () => {
    const nbKey = "2026-07-10";
    const dayChunks = new Map([
      [
        nbKey,
        makeChunk({
          isOffDay: false,
          isHolidayDay: false,
          isCompensatoryDay: true,
          employees: [],
        }),
      ],
    ]);
    const { total } = buildMonthlyRuleSummary(dayChunks, [nbKey], empId, {
      ngayVaoLam: "2026-07-10",
    });

    expect(total.nbDays).toBe(1);
    expect(total.workDays).toBe(1);
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

  it("không đếm NB khi loại phép NV trên ngày nghỉ bù", () => {
    const emp = {
      id: empId,
      loaiPhep: "Nghỉ việc",
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

  it("không đếm NB khi loại phép TS trên ngày nghỉ bù", () => {
    const emp = {
      id: empId,
      loaiPhep: "Thai sản",
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

  it("tách giờ NB ca ngày (×2.0) và ca đêm S2 (×2.7) vào cột riêng", () => {
    const dayKey = "2026-02-10";
    const nightKey = "2026-02-11";
    const dayEmp = {
      id: empId,
      gioVao: "08:00",
      gioRa: "18:00",
      caLamViec: "S1",
      duocNghiBu: "YES",
      loaiPhep: "",
    };
    const nightEmp = {
      id: empId,
      gioVao: "22:00",
      gioRa: "08:00",
      caLamViec: "S2",
      duocNghiBu: "YES",
      loaiPhep: "",
    };
    const dayChunks = new Map([
      [
        dayKey,
        makeChunk({
          isCompensatoryDay: true,
          employees: [dayEmp],
        }),
      ],
      [
        nightKey,
        makeChunk({
          isCompensatoryDay: true,
          employees: [nightEmp],
        }),
      ],
    ]);
    const summaries = buildMonthlyRuleSummary(
      dayChunks,
      [dayKey, nightKey],
      empId,
      { ngayVaoLam: "2020-01-01" },
    );

    expect(summaries.total.nbDayCoeff20).toBeGreaterThan(0);
    expect(summaries.total.nbNightCoeff27).toBeGreaterThan(0);
    expect(summaries.total.coeff20).toBeGreaterThan(0);
    expect(summaries.total.coeff27).toBeGreaterThan(0);

    const flat = buildMonthlyDetailFlatValues({
      si: 0,
      summaries,
      fmt: fmtPayrollMonthlySummaryCell,
      fmtHours: fmtPayrollMonthlySummaryHoursCell,
      colsPerBlock: MONTH_DETAIL_COLS_PER_BLOCK,
    });
    expect(flat[13]).not.toBe(" ");
    expect(flat[14]).not.toBe(" ");
  });

  it("đếm TS và phụ cấp ca đêm S2 vào cột chi tiết lưới tháng", () => {
    const tsKey = "2026-02-10";
    const s2Key = "2026-02-11";
    const dayChunks = new Map([
      [
        tsKey,
        makeChunk({
          employees: [{ id: empId, loaiPhep: "Thai sản", caLamViec: "S1" }],
        }),
      ],
      [
        s2Key,
        makeChunk({
          employees: [
            {
              id: empId,
              loaiPhep: "",
              caLamViec: "S2",
              gioVao: "22:00",
              gioRa: "06:00",
            },
          ],
        }),
      ],
    ]);
    const summaries = buildMonthlyRuleSummary(
      dayChunks,
      [tsKey, s2Key],
      empId,
      { ngayVaoLam: "2020-01-01" },
    );

    expect(summaries.total.tsDays).toBe(1);
    expect(summaries.total.nightShiftAllowanceDays).toBe(1);
    expect(summaries.official.tsDays).toBe(1);
    expect(summaries.official.nightShiftAllowanceDays).toBe(1);
    expect(summaries.trial.tsDays).toBe(0);

    const flat = buildMonthlyDetailFlatValues({
      si: 0,
      summaries,
      fmt: fmtPayrollMonthlySummaryCell,
      fmtHours: fmtPayrollMonthlySummaryHoursCell,
      colsPerBlock: MONTH_DETAIL_COLS_PER_BLOCK,
    });
    expect(flat[resolveMonthlyDetailFlatIndex(0, 15)]).toBe("1");
    expect(flat[resolveMonthlyDetailFlatIndex(0, 16)]).toBe("50.000");
    expect(flat[resolveMonthlyDetailFlatIndex(2, 14)]).toBe("1");
    expect(flat[resolveMonthlyDetailFlatIndex(2, 15)]).toBe("50.000");
  });
});
