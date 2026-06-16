/**
 * Kiểm tra `tangCaTrua` (TC trưa) được cộng đồng bộ trên mọi bề mặt hiển thị / tổng hợp.
 */
import { describe, expect, it } from "vitest";
import {
  formatPayrollTableHolidayDayWorkingCell,
  formatPayrollTableOffDayTcCell,
  formatPayrollTableTotalDayGcCell,
} from "@/features/attendance/attendanceWorkingHours";
import { buildMonthlyRuleSummary } from "@/features/payroll/payrollMonthlyRuleSummary";
import { getPayrollMonthlyCoeffHoursMap } from "@/features/payroll/payrollMonthlyCoefficientBuckets";
import {
  formatPayrollTableDayShiftOvertimeCellFromEmp,
  formatPayrollTableHolidayDayWorkingCellFromEmp,
  formatPayrollTableOffDayTcCellFromEmp,
  formatPayrollTableTotalDayGcCellFromEmp,
} from "@/features/payroll/payrollTableOtCells";
import { payrollOtDayParamsFromMonthChunkEmp } from "@/features/payroll/payrollOtDayParams";

const EMP_ID = "e-lunch";

function makeEmp(overrides = {}) {
  return {
    id: EMP_ID,
    gioVao: "08:00",
    gioRa: "17:00",
    caLamViec: "S1",
    loaiPhep: "",
    tangCaTrua: 1,
    payrollEarlyOtPaperwork: false,
    payrollLateOtExcluded: false,
    ...overrides,
  };
}

function makeDayCtx(overrides = {}) {
  return {
    isOffDay: false,
    isHolidayDay: false,
    isCompensatoryDay: false,
    earlyOtPaperworkById: {},
    lateOtExcludedById: {},
    ...overrides,
  };
}

function makeChunk(employees, dayOverrides = {}) {
  const byId = new Map();
  for (const emp of employees) {
    byId.set(emp.id, emp);
  }
  return {
    isOffDay: false,
    isHolidayDay: false,
    isCompensatoryDay: false,
    earlyOtPaperworkById: {},
    lateOtExcludedById: {},
    byId,
    byMonthEmployeeKey: byId,
    ...dayOverrides,
  };
}

describe("tangCaTrua — payrollOtDayParams", () => {
  it("đọc tangCaTrua từ dòng NV", () => {
    const p = payrollOtDayParamsFromMonthChunkEmp(makeEmp(), makeDayCtx());
    expect(p.lunchOtHours).toBe(1);
  });
});

describe("tangCaTrua — bảng lương ngày (FromEmp)", () => {
  const emp = makeEmp();
  const normalCtx = makeDayCtx();
  const offCtx = makeDayCtx({ isOffDay: true });
  const holidayCtx = makeDayCtx({ isHolidayDay: true });
  const compCtx = makeDayCtx({ isCompensatoryDay: true });

  it("TC ca ngày ×1.5 — chỉ TC trưa (không TC chiều)", () => {
    expect(
      formatPayrollTableDayShiftOvertimeCellFromEmp(emp, normalCtx),
    ).toBe("1");
  });

  it("TC off — GC 8 + TC trưa 1", () => {
    expect(formatPayrollTableOffDayTcCellFromEmp(emp, offCtx)).toBe("9");
  });

  it("GC ngày lễ — GC 8 + TC trưa 1", () => {
    expect(
      formatPayrollTableHolidayDayWorkingCellFromEmp(emp, holidayCtx),
    ).toBe("9");
  });

  it("nghỉ bù — gộp như OFF", () => {
    expect(formatPayrollTableOffDayTcCellFromEmp(emp, compCtx)).toBe("9");
  });

  it("Tổng GC — ngày thường / OFF / lễ", () => {
    expect(formatPayrollTableTotalDayGcCellFromEmp(emp, normalCtx)).toBe("9");
    expect(formatPayrollTableTotalDayGcCellFromEmp(emp, offCtx)).toBe("9");
    expect(formatPayrollTableTotalDayGcCellFromEmp(emp, holidayCtx)).toBe("9");
    expect(formatPayrollTableTotalDayGcCellFromEmp(emp, compCtx)).toBe("9");
  });
});

describe("tangCaTrua — format trực tiếp (TC off / GC lễ)", () => {
  it("formatPayrollTableOffDayTcCell nhận lunchOtHours", () => {
    expect(
      formatPayrollTableOffDayTcCell(
        "08:00",
        "17:00",
        true,
        "S1",
        false,
        undefined,
        false,
        false,
        false,
        false,
        false,
        1,
      ),
    ).toBe("9");
  });

  it("formatPayrollTableHolidayDayWorkingCell nhận lunchOtHours", () => {
    expect(
      formatPayrollTableHolidayDayWorkingCell(
        "08:00",
        "17:00",
        true,
        "S1",
        false,
        undefined,
        false,
        false,
        false,
        false,
        false,
        1,
      ),
    ).toBe("9");
  });
});

describe("tangCaTrua — lưới tháng (hệ số)", () => {
  const base = {
    timeIn: "08:00",
    timeOut: "17:00",
    shiftCode: "S1",
    payrollEarlyOtPaperwork: false,
    payrollLateOtExcluded: false,
    lunchOtHours: 1,
  };

  it("ngày thường → ×1.5", () => {
    const m = getPayrollMonthlyCoeffHoursMap({
      ...base,
      isOffDay: false,
      isHolidayDay: false,
    });
    expect(m.get(1.5)).toBe(1);
    expect(m.get(2.0) ?? 0).toBe(0);
  });

  it("OFF / nghỉ bù → ×2.0", () => {
    const off = getPayrollMonthlyCoeffHoursMap({
      ...base,
      isOffDay: true,
      isHolidayDay: false,
    });
    expect(off.get(2.0)).toBe(9);
    expect(off.get(1.5) ?? 0).toBe(0);

    const comp = getPayrollMonthlyCoeffHoursMap({
      ...base,
      isOffDay: false,
      isHolidayDay: false,
      isCompensatoryDay: true,
    });
    expect(comp.get(2.0)).toBe(9);
  });

  it("ngày lễ → ×3.0", () => {
    const m = getPayrollMonthlyCoeffHoursMap({
      ...base,
      isOffDay: false,
      isHolidayDay: true,
    });
    expect(m.get(3.0)).toBe(9);
    expect(m.get(1.5) ?? 0).toBe(0);
  });
});

describe("tangCaTrua — buildMonthlyRuleSummary (Tổng GC thực tế)", () => {
  const dk = "2026-01-14";
  const satOff = "2026-01-10"; // thứ Bảy

  it("ngày thường: workHours = 8 + 1", () => {
    const { total } = buildMonthlyRuleSummary(
      new Map([
        [dk, makeChunk([makeEmp()], { isOffDay: false, isHolidayDay: false })],
      ]),
      [dk],
      EMP_ID,
      { ngayVaoLam: "2020-01-01" },
    );
    expect(total.workHours).toBe(9);
    expect(total.coeff15).toBe(1);
  });

  it("OFF thứ Bảy: workHours = 9, coeff20 = 9", () => {
    const { total } = buildMonthlyRuleSummary(
      new Map([
        [
          satOff,
          makeChunk([makeEmp()], {
            isOffDay: true,
            isHolidayDay: false,
          }),
        ],
      ]),
      [satOff],
      EMP_ID,
      { ngayVaoLam: "2020-01-01" },
    );
    expect(total.workHours).toBe(9);
    expect(total.coeff20).toBe(9);
    expect(total.coeff15).toBe(0);
  });

  it("ngày lễ: workHours = 9, coeff30 = 9", () => {
    const { total } = buildMonthlyRuleSummary(
      new Map([
        [
          dk,
          makeChunk([makeEmp()], {
            isOffDay: false,
            isHolidayDay: true,
          }),
        ],
      ]),
      [dk],
      EMP_ID,
      { ngayVaoLam: "2020-01-01" },
    );
    expect(total.workHours).toBe(9);
    expect(total.coeff30).toBe(9);
  });

  it("1/2PN + tangCaTrua: workHours = 4 + 1", () => {
    const half = makeEmp({
      gioVao: "07:30",
      gioRa: "17:00",
      loaiPhep: "1/2 Phép năm",
    });
    const { total } = buildMonthlyRuleSummary(
      new Map([
        [dk, makeChunk([half], { isOffDay: false, isHolidayDay: false })],
      ]),
      [dk],
      EMP_ID,
      { ngayVaoLam: "2020-01-01" },
    );
    expect(total.workHours).toBe(5);
    expect(total.coeff15).toBe(1);
  });
});

describe("tangCaTrua — 1/2PN Tổng GC", () => {
  it("formatPayrollTableTotalDayGcCell — ngày thường", () => {
    expect(
      formatPayrollTableTotalDayGcCell(
        "07:30",
        "17:00",
        false,
        false,
        "S1",
        false,
        "1/2PN",
        false,
        false,
        false,
        false,
        false,
        1,
      ),
    ).toBe("5");
  });

  it("formatPayrollTableTotalDayGcCell — OFF + tangCaTrua", () => {
    expect(
      formatPayrollTableTotalDayGcCell(
        "07:30",
        "17:00",
        true,
        false,
        "S1",
        false,
        "1/2PN",
        false,
        false,
        false,
        false,
        false,
        1,
      ),
    ).toBe("5");
  });

  it("formatPayrollTableOffDayTcCell — 1/2PN OFF + tangCaTrua", () => {
    expect(
      formatPayrollTableOffDayTcCell(
        "07:30",
        "17:00",
        true,
        "S1",
        false,
        "1/2PN",
        false,
        false,
        false,
        false,
        false,
        1,
      ),
    ).toBe("5");
  });
});

describe("tangCaTrua — 1/2PN OFF (FromEmp + lưới + tổng tháng)", () => {
  const halfOff = makeEmp({
    gioVao: "07:30",
    gioRa: "17:00",
    loaiPhep: "1/2 Phép năm",
  });
  const offCtx = makeDayCtx({ isOffDay: true });
  const satOff = "2026-01-10";

  it("TC off + Tổng GC = 4 + tangCaTrua", () => {
    expect(formatPayrollTableOffDayTcCellFromEmp(halfOff, offCtx)).toBe("5");
    expect(formatPayrollTableTotalDayGcCellFromEmp(halfOff, offCtx)).toBe("5");
  });

  it("lưới tháng ×2.0 gộp (không ×1.5)", () => {
    const m = getPayrollMonthlyCoeffHoursMap({
      timeIn: "07:30",
      timeOut: "17:00",
      isOffDay: true,
      isHolidayDay: false,
      shiftCode: "S1",
      leaveType: "1/2 Phép năm",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
      lunchOtHours: 1,
    });
    expect(m.get(2.0)).toBe(5);
    expect(m.get(1.5) ?? 0).toBe(0);
  });

  it("buildMonthlyRuleSummary — không cộng đôi giờ nửa ngày", () => {
    const { total } = buildMonthlyRuleSummary(
      new Map([
        [
          satOff,
          makeChunk([halfOff], {
            isOffDay: true,
            isHolidayDay: false,
          }),
        ],
      ]),
      [satOff],
      EMP_ID,
      { ngayVaoLam: "2020-01-01" },
    );
    expect(total.workHours).toBe(5);
    expect(total.coeff20).toBe(5);
    expect(total.pnDays).toBe(0.5);
  });
});
