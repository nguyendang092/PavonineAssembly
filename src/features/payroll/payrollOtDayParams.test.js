import { describe, expect, it } from "vitest";
import { payrollOtDayParamsFromMonthChunkEmp } from "./payrollOtDayParams";

describe("payrollOtDayParamsFromMonthChunkEmp", () => {
  it("gộp cờ TC sớm / muộn từ chunk._meta maps lên dòng slim", () => {
    const emp = { id: "key-1", gioVao: "06:00", gioRa: "18:00", caLamViec: "S1" };
    const chunk = {
      isOffDay: false,
      isHolidayDay: false,
      isCompensatoryDay: false,
      earlyOtPaperworkById: { "key-1": true },
      lateOtExcludedById: { "key-1": false },
    };
    const p = payrollOtDayParamsFromMonthChunkEmp(emp, chunk);
    expect(p.payrollEarlyOtPaperwork).toBe(true);
    expect(p.payrollLateOtExcluded).toBe(false);
    expect(p.timeIn).toBe("06:00");
  });

  it("giữ cờ đã có trên dòng payroll khi chunk không có map", () => {
    const emp = {
      id: "key-1",
      gioVao: "06:00",
      gioRa: "18:00",
      caLamViec: "S1",
      payrollEarlyOtPaperwork: true,
      payrollLateOtExcluded: true,
    };
    const p = payrollOtDayParamsFromMonthChunkEmp(emp, {
      isOffDay: false,
      isHolidayDay: false,
      isCompensatoryDay: false,
    });
    expect(p.payrollEarlyOtPaperwork).toBe(true);
    expect(p.payrollLateOtExcluded).toBe(true);
  });
});
