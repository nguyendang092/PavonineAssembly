import { describe, expect, it } from "vitest";
import {
  isMondayDateKey,
  isSundayDateKey,
  resolveTaiXeTongEffectiveIsOffDay,
  shouldTaiXeTongTreatSundayAsNormalWeekday,
  shouldUsePayrollMonthSundayMergedRules,
} from "./taiXeTongPayrollDay";
import { getPayrollMonthlyCoefficientLines } from "./payrollMonthlyCoefficientBuckets";
import { payrollOtDayParamsFromEmp } from "./payrollOtDayParams";

describe("taiXeTongPayrollDay", () => {
  it("nhận diện thứ 2 / Chủ nhật", () => {
    expect(isMondayDateKey("2026-06-01")).toBe(true);
    expect(isMondayDateKey("2026-06-02")).toBe(false);
    expect(isSundayDateKey("2026-06-07")).toBe(true);
  });

  it("Tài xế tổng — Thứ 2 luôn off", () => {
    expect(
      resolveTaiXeTongEffectiveIsOffDay({
        includeTaiXeTongInWorkingHours: true,
        dateKey: "2026-06-01",
        isOffDay: false,
      }),
    ).toBe(true);
  });

  it("Tài xế thường — Thứ 2 không tự off", () => {
    expect(
      resolveTaiXeTongEffectiveIsOffDay({
        includeTaiXeTongInWorkingHours: false,
        dateKey: "2026-06-01",
        isOffDay: false,
      }),
    ).toBe(false);
  });

  it("Tài xế tổng — Chủ nhật như ngày thường", () => {
    expect(
      shouldTaiXeTongTreatSundayAsNormalWeekday({
        includeTaiXeTongInWorkingHours: true,
        dateKey: "2026-06-07",
      }),
    ).toBe(true);
    expect(
      shouldUsePayrollMonthSundayMergedRules({
        includeTaiXeTongInWorkingHours: true,
        dateKey: "2026-06-07",
      }),
    ).toBe(false);
    expect(
      resolveTaiXeTongEffectiveIsOffDay({
        includeTaiXeTongInWorkingHours: true,
        dateKey: "2026-06-07",
        isOffDay: true,
      }),
    ).toBe(false);
  });
});

describe("getPayrollMonthlyCoefficientLines — Tài xế tổng", () => {
  const taiXeTongEmp = {
    gioVao: "07:00",
    gioRa: "21:00",
    caLamViec: "S1",
    includeTaiXeTongInWorkingHours: "YES",
  };

  it("Thứ 2 — hệ số ×2.0 (off)", () => {
    const p = payrollOtDayParamsFromEmp(taiXeTongEmp, {
      isOffDay: false,
      dateKey: "2026-06-01",
    });
    const lines = getPayrollMonthlyCoefficientLines(p);
    expect(lines.some((ln) => ln.coeff === 2.0 && ln.hours > 0)).toBe(true);
    expect(lines.some((ln) => ln.coeff === 1.5)).toBe(false);
  });

  it("Chủ nhật — tách ×1.5 như ngày thường", () => {
    const p = payrollOtDayParamsFromEmp(taiXeTongEmp, {
      isOffDay: true,
      dateKey: "2026-06-07",
    });
    expect(p.isOffDay).toBe(false);
    const lines = getPayrollMonthlyCoefficientLines(p);
    expect(lines.some((ln) => ln.coeff === 2.0)).toBe(false);
    expect(lines.some((ln) => ln.coeff === 1.5 && ln.hours > 0)).toBe(true);
  });
});
