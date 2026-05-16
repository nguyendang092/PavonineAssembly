import { describe, expect, it } from "vitest";
import {
  buildMonthlyRuleSummary,
  isPayrollSaturdayOffWorkDay,
} from "@/features/payroll/payrollMonthlyRuleSummary";

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
