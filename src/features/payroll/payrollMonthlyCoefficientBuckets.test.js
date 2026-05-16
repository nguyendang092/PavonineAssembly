import { describe, expect, it } from "vitest";
import {
  getPayrollMonthlyCoefficientLines,
  getPayrollMonthlyCoeffHoursMap,
} from "@/features/payroll/payrollMonthlyCoefficientBuckets";

function coeffHours(lines, coeff) {
  return lines.find((l) => l.coeff === coeff)?.hours ?? 0;
}

describe("getPayrollMonthlyCoefficientLines", () => {
  it("ca ngày thường — TC ×1.5 sau 17:30", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      gioVao: "08:00",
      gioRa: "18:00",
      isOffDay: false,
      isHolidayDay: false,
      caLamViec: "S1",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(coeffHours(lines, 1.5)).toBe(1);
    expect(coeffHours(lines, 2.0)).toBe(0);
  });

  it("ca đêm thường — ×0.3 + TC ×1.5 (không ×2.0)", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      gioVao: "22:00",
      gioRa: "06:00",
      isOffDay: false,
      isHolidayDay: false,
      caLamViec: "S2",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(coeffHours(lines, 0.3)).toBe(7);
    expect(coeffHours(lines, 1.5)).toBe(1);
    expect(coeffHours(lines, 2.0)).toBe(0);
    expect(coeffHours(lines, 2.7)).toBe(0);
  });

  it("ngày OFF ca ngày — ×2.0 gộp", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      gioVao: "08:00",
      gioRa: "17:00",
      isOffDay: true,
      isHolidayDay: false,
      caLamViec: "S1",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(coeffHours(lines, 2.0)).toBeGreaterThan(0);
    expect(coeffHours(lines, 1.5)).toBe(0);
  });

  it("ngày OFF ca đêm — ×2.7 gộp", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      gioVao: "22:00",
      gioRa: "06:00",
      isOffDay: true,
      isHolidayDay: false,
      caLamViec: "S2",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(coeffHours(lines, 2.7)).toBeGreaterThan(0);
    expect(coeffHours(lines, 2.0)).toBe(0);
  });
});

describe("getPayrollMonthlyCoeffHoursMap", () => {
  it("map hệ số → giờ (một giá trị / coeff)", () => {
    const m = getPayrollMonthlyCoeffHoursMap({
      gioVao: "22:00",
      gioRa: "06:00",
      isOffDay: false,
      isHolidayDay: false,
      caLamViec: "S2",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(m.get(0.3)).toBe(7);
    expect(m.get(1.5)).toBe(1);
  });
});
