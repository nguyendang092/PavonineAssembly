import { describe, expect, it } from "vitest";
import {
  formatPayrollMonthlyCoeffSubrowDayCell,
  getPayrollMonthlyCoefficientLines,
  getPayrollMonthlyCoeffHoursMap,
  getPayrollMonthlyMainRowCell,
  PAYROLL_MONTHLY_SUBROWS,
} from "@/features/payroll/payrollMonthlyCoefficientBuckets";
import {
  getAttendanceWorkingHoursHours,
  getPayrollDayShiftOffHolidayMergedHoursNumeric,
} from "@/features/attendance/attendanceWorkingHours";
import { formatPayrollTableNightShiftOffDayWorkingCellFromEmp } from "@/features/payroll/payrollTableOtCells";

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

  it("getPayrollMonthlyMainRowCell: 1/2PN — badge (workedHours nội bộ)", () => {
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

  it("getPayrollMonthlyMainRowCell: ngày NB có giờ — dòng chính hiển thị giờ công", () => {
    const ch = { isOffDay: false, isHolidayDay: false, isCompensatoryDay: true };
    const emp = {
      gioVao: "08:00",
      gioRa: "17:00",
      caLamViec: "S1",
      duocNghiBu: "YES",
    };
    const main = getPayrollMonthlyMainRowCell(emp, ch);
    expect(main.kind).toBe("hours");
    expect(main.hours).toBe(8);
  });

  it("getPayrollMonthlyMainRowCell: ngày NB không có giờ — dash (UI hiển thị NB)", () => {
    const ch = { isOffDay: false, isHolidayDay: false, isCompensatoryDay: true };
    const emp = { gioVao: "", gioRa: "", caLamViec: "S1", duocNghiBu: "YES" };
    const main = getPayrollMonthlyMainRowCell(emp, ch);
    expect(main.kind).toBe("dash");
  });

  it("getPayrollMonthlyMainRowCell: ngày NB ca đêm có giờ — gộp max 8h dòng chính", () => {
    const ch = { isOffDay: false, isHolidayDay: false, isCompensatoryDay: true };
    const emp = {
      gioVao: "22:00",
      gioRa: "06:00",
      caLamViec: "S2",
      duocNghiBu: "YES",
    };
    const main = getPayrollMonthlyMainRowCell(emp, ch);
    expect(main.kind).toBe("hours");
    expect(main.hours).toBe(8);
    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "22:00",
      timeOut: "06:00",
      isOffDay: false,
      isHolidayDay: false,
      isCompensatoryDay: true,
      shiftCode: "S2",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(coeffHours(lines, 2.7)).toBe(0);
  });

  it("ngày NB ca ngày + TC — dòng chính max 8h, phần TC ×2.0", () => {
    const ch = { isOffDay: false, isHolidayDay: false, isCompensatoryDay: true };
    const emp = {
      gioVao: "08:00",
      gioRa: "18:00",
      caLamViec: "S1",
      duocNghiBu: "YES",
    };
    const main = getPayrollMonthlyMainRowCell(emp, ch);
    expect(main.kind).toBe("hours");
    expect(main.hours).toBe(8);
    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "08:00",
      timeOut: "18:00",
      isOffDay: false,
      isHolidayDay: false,
      isCompensatoryDay: true,
      shiftCode: "S1",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(coeffHours(lines, 2.0)).toBe(1);
    expect(coeffHours(lines, 1.5)).toBe(0);
  });

  it("ngày NB ca ngày 08–17 — chỉ dòng chính 8h, không ×2.0", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "08:00",
      timeOut: "17:00",
      isOffDay: false,
      isHolidayDay: false,
      isCompensatoryDay: true,
      shiftCode: "S1",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(coeffHours(lines, 2.0)).toBe(0);
  });

  it("ngày NB + TC sớm — gộp TC vào dòng chính (≤8h), không tách ×2.0", () => {
    const ch = { isOffDay: false, isHolidayDay: false, isCompensatoryDay: true };
    const emp = {
      gioVao: "06:00",
      gioRa: "12:00",
      caLamViec: "S1",
      duocNghiBu: "YES",
      payrollEarlyOtPaperwork: true,
    };
    const merged = getPayrollDayShiftOffHolidayMergedHoursNumeric(
      "06:00",
      "12:00",
      true,
      false,
      "S1",
      true,
    );
    const regular = getAttendanceWorkingHoursHours("06:00", "12:00", "S1");
    expect(merged).toBeGreaterThan(regular);

    const main = getPayrollMonthlyMainRowCell(emp, ch);
    expect(main.kind).toBe("hours");
    expect(main.hours).toBe(Math.min(merged, 8));

    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "06:00",
      timeOut: "12:00",
      isOffDay: false,
      isHolidayDay: false,
      isCompensatoryDay: true,
      shiftCode: "S1",
      payrollEarlyOtPaperwork: true,
      payrollLateOtExcluded: false,
    });
    expect(coeffHours(lines, 2.0)).toBe(Math.max(0, merged - 8));
  });

  it("ca đêm thường — GC dòng chính, ×0.3 hiển thị S2, TC ×1.5", () => {
    const ch = { isOffDay: false, isHolidayDay: false, isCompensatoryDay: false };
    const emp = {
      gioVao: "22:00",
      gioRa: "06:00",
      caLamViec: "S2",
    };
    const main = getPayrollMonthlyMainRowCell(emp, ch);
    expect(main.kind).toBe("hours");
    expect(main.hours).toBe(7);

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

    const coeffMap = getPayrollMonthlyCoeffHoursMap({
      timeIn: "22:00",
      timeOut: "06:00",
      isOffDay: false,
      isHolidayDay: false,
      shiftCode: "S2",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    });
    expect(
      formatPayrollMonthlyCoeffSubrowDayCell({
        emp,
        ch,
        sr: PAYROLL_MONTHLY_SUBROWS[1],
        coeffMap,
        main,
      }),
    ).toBe("S2");
    expect(
      formatPayrollMonthlyCoeffSubrowDayCell({
        emp,
        ch,
        sr: PAYROLL_MONTHLY_SUBROWS[2],
        coeffMap,
        main,
      }),
    ).toBe("1");
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

  it("Chủ nhật OFF ca ngày — giờ ở ×2.0, dòng chính trống", () => {
    const sundayKey = "2026-06-07";
    const ch = {
      dateKey: sundayKey,
      isOffDay: true,
      isHolidayDay: false,
      isCompensatoryDay: false,
    };
    const emp = {
      gioVao: "08:00",
      gioRa: "17:00",
      caLamViec: "S1",
    };
    const main = getPayrollMonthlyMainRowCell(emp, ch);
    expect(main.kind).toBe("dash");

    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "08:00",
      timeOut: "17:00",
      isOffDay: true,
      isHolidayDay: false,
      shiftCode: "S1",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
      dateKey: sundayKey,
    });
    expect(coeffHours(lines, 2.0)).toBeGreaterThan(0);
  });

  it("Thứ Bảy OFF ca ngày — vẫn ×2.0", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "08:00",
      timeOut: "17:00",
      isOffDay: true,
      isHolidayDay: false,
      shiftCode: "S1",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
      dateKey: "2026-06-06",
    });
    expect(coeffHours(lines, 2.0)).toBeGreaterThan(0);
  });

  it("Chủ nhật OFF ca đêm — giờ ở ×2.7, không S2, dòng chính trống", () => {
    const sundayKey = "2026-06-07";
    const ch = {
      dateKey: sundayKey,
      isOffDay: true,
      isHolidayDay: false,
      isCompensatoryDay: false,
    };
    const emp = {
      gioVao: "22:00",
      gioRa: "06:00",
      caLamViec: "S2",
    };
    const main = getPayrollMonthlyMainRowCell(emp, ch);
    expect(main.kind).toBe("dash");

    const coeffMap = getPayrollMonthlyCoeffHoursMap({
      timeIn: "22:00",
      timeOut: "06:00",
      isOffDay: true,
      isHolidayDay: false,
      shiftCode: "S2",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
      dateKey: sundayKey,
    });
    expect(coeffMap.get(2.7)).toBeGreaterThan(0);

    const coeffTxt = formatPayrollMonthlyCoeffSubrowDayCell({
      emp,
      ch,
      sr: PAYROLL_MONTHLY_SUBROWS[4],
      coeffMap,
      main,
    });
    expect(coeffTxt).not.toBe("S2");
    expect(Number(coeffTxt)).toBeGreaterThan(0);
  });

  it("Chủ nhật ca đêm thường — gộp toàn bộ ở ×2.7, không tách ×0.3/×1.5", () => {
    const sundayKey = "2026-06-07";
    const ch = {
      dateKey: sundayKey,
      isOffDay: false,
      isHolidayDay: false,
      isCompensatoryDay: false,
    };
    const emp = {
      gioVao: "22:00",
      gioRa: "06:00",
      caLamViec: "S2",
    };
    const main = getPayrollMonthlyMainRowCell(emp, ch);
    expect(main.kind).toBe("dash");

    const coeffMap = getPayrollMonthlyCoeffHoursMap({
      timeIn: "22:00",
      timeOut: "06:00",
      isOffDay: false,
      isHolidayDay: false,
      shiftCode: "S2",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
      dateKey: sundayKey,
    });
    expect(coeffMap.get(2.7)).toBeGreaterThan(0);
    expect(coeffMap.get(0.3) ?? 0).toBe(0);
    expect(coeffMap.get(1.5) ?? 0).toBe(0);

    const coeffTxt = formatPayrollMonthlyCoeffSubrowDayCell({
      emp,
      ch,
      sr: PAYROLL_MONTHLY_SUBROWS[4],
      coeffMap,
      main,
    });
    expect(coeffTxt).not.toBe("S2");
    expect(Number(coeffTxt)).toBeGreaterThan(0);
  });

  it("Chủ nhật ca ngày thường — gộp toàn bộ ở ×2.0, dòng chính trống", () => {
    const sundayKey = "2026-06-07";
    const ch = {
      dateKey: sundayKey,
      isOffDay: false,
      isHolidayDay: false,
      isCompensatoryDay: false,
    };
    const emp = {
      gioVao: "08:00",
      gioRa: "17:00",
      caLamViec: "S1",
    };
    const main = getPayrollMonthlyMainRowCell(emp, ch);
    expect(main.kind).toBe("dash");

    const coeffMap = getPayrollMonthlyCoeffHoursMap({
      timeIn: "08:00",
      timeOut: "17:00",
      isOffDay: false,
      isHolidayDay: false,
      shiftCode: "S1",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
      dateKey: sundayKey,
    });
    expect(coeffMap.get(2.0)).toBeGreaterThan(0);
    expect(coeffMap.get(1.5) ?? 0).toBe(0);
  });

  it("ngày OFF + tangCaTrua — cộng vào ×2.0 gộp", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "08:00",
      timeOut: "17:00",
      isOffDay: true,
      isHolidayDay: false,
      shiftCode: "S1",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
      lunchOtHours: 1,
    });
    expect(coeffHours(lines, 2.0)).toBe(9);
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

  it("ngày OFF ca đêm + giấy TC sớm — ×2.7 đồng bộ bảng ngày (16:56→09:31)", () => {
    const lines = getPayrollMonthlyCoefficientLines({
      timeIn: "16:56",
      timeOut: "09:31",
      isOffDay: true,
      isHolidayDay: false,
      shiftCode: "S2",
      payrollEarlyOtPaperwork: true,
      payrollLateOtExcluded: false,
    });
    expect(coeffHours(lines, 2.7)).toBe(14.5);

    const emp = {
      id: "e1",
      gioVao: "16:56",
      gioRa: "09:31",
      caLamViec: "S2",
      payrollEarlyOtPaperwork: true,
    };
    const dayCtx = { isOffDay: true, isHolidayDay: false, isCompensatoryDay: false };
    expect(formatPayrollTableNightShiftOffDayWorkingCellFromEmp(emp, dayCtx)).toBe(
      "14.5",
    );
    expect(
      getPayrollMonthlyCoeffHoursMap({
        timeIn: "16:56",
        timeOut: "09:31",
        isOffDay: true,
        isHolidayDay: false,
        shiftCode: "S2",
        payrollEarlyOtPaperwork: true,
        payrollLateOtExcluded: false,
      }).get(2.7),
    ).toBe(14.5);
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
