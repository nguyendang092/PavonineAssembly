import { describe, expect, it } from "vitest";
import {
  getPayrollMonthlyCoefficientLines,
  getPayrollMonthlyCoeffHoursMap,
  getPayrollMonthlyMainRowCell,
} from "@/features/payroll/payrollMonthlyCoefficientBuckets";

function coeffHours(lines, coeff) {
  return lines.find((l) => l.coeff === coeff)?.hours ?? 0;
}

describe("getPayrollMonthlyCoefficientLines", () => {
  it("tangCaTrua — hiển thị hệ số ×1.5 (gộp TC chiều)", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "08:00",
      timeOut: "18:00",
      isOffDay: false,
      isHolidayDay: false,
      shiftCode: "S1",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
      lunchOtHours: 1,
    });
    expect(coeffHours(lines, 1.5)).toBe(2);
  });

  it("tangCaTrua chỉ — vẫn ×1.5 khi không có TC chiều", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "08:00",
      timeOut: "17:00",
      isOffDay: false,
      isHolidayDay: false,
      shiftCode: "S1",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
      lunchOtHours: 1.5,
    });
    expect(coeffHours(lines, 1.5)).toBe(1.5);
  });

  it("ca ngày thường — TC ×1.5 sau 17:30", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "08:00",
      timeOut: "18:00",
      isOffDay: false,
      isHolidayDay: false,
      shiftCode: "S1",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(coeffHours(lines, 1.5)).toBe(1);
    expect(coeffHours(lines, 2.0)).toBe(0);
  });

  it("1/2PN + ra 18:00 — TC ×1.5 như ngày thường", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "07:30",
      timeOut: "18:00",
      isOffDay: false,
      isHolidayDay: false,
      shiftCode: "S1",
      leaveType: "1/2 Phép năm",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(coeffHours(lines, 1.5)).toBe(1);
  });

  it("getPayrollMonthlyMainRowCell: 1/2PN — badge + workedHours", () => {
    const main = getPayrollMonthlyMainRowCell(
      {
        gioVao: "07:30",
        gioRa: "12:00",
        caLamViec: "S1",
        loaiPhep: "1/2 Phép năm",
      },
      { isOffDay: false, isHolidayDay: false, isCompensatoryDay: false },
    );
    expect(main.kind).toBe("leave");
    expect(main.leaveShort).toBe("1/2PN");
    expect(main.workedHours).toBe(4);
  });

  it("ca đêm thường — ×0.3 + TC ×1.5 (không ×2.0)", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "22:00",
      timeOut: "06:00",
      isOffDay: false,
      isHolidayDay: false,
      shiftCode: "S2",
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
      timeIn: "08:00",
      timeOut: "17:00",
      isOffDay: true,
      isHolidayDay: false,
      shiftCode: "S1",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(coeffHours(lines, 2.0)).toBeGreaterThan(0);
    expect(coeffHours(lines, 1.5)).toBe(0);
  });

  it("ngày OFF ca đêm — ×2.7 gộp", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "22:00",
      timeOut: "06:00",
      isOffDay: true,
      isHolidayDay: false,
      shiftCode: "S2",
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
      timeIn: "22:00",
      timeOut: "06:00",
      isOffDay: false,
      isHolidayDay: false,
      shiftCode: "S2",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(m.get(0.3)).toBe(7);
    expect(m.get(1.5)).toBe(1);
  });

  it("có loại phép PN + giờ ra muộn — vẫn ×1.5 (đồng bộ bảng ngày)", () => {
    const m = getPayrollMonthlyCoeffHoursMap({
      timeIn: "08:00",
      timeOut: "18:00",
      isOffDay: false,
      isHolidayDay: false,
      shiftCode: "S1",
      leaveType: "PN",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(m.get(1.5)).toBe(1);
  });

  it("tangCaTrua — ×1.5 gộp vào map", () => {
    const m = getPayrollMonthlyCoeffHoursMap({
      timeIn: "08:00",
      timeOut: "17:00",
      isOffDay: false,
      isHolidayDay: false,
      shiftCode: "S1",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
      lunchOtHours: 1.5,
    });
    expect(m.get(1.5)).toBe(1.5);
  });
});
