import { describe, expect, it } from "vitest";
import {
  formatPayrollTableDayShiftOvertimeCell,
  formatPayrollTableNightShiftOvertimeCell,
  getNightShiftPayrollOvertimeHours,
  getNightShiftPayrollRegularHoursAndOtMinutes,
  getOvertimeHoursFromGioRa,
  getPayrollDayOvertimeHoursNumeric,
  isNightShiftCaLamViec,
} from "@/features/attendance/attendanceWorkingHours";

describe("isNightShiftCaLamViec", () => {
  it("chỉ S2 là ca đêm", () => {
    expect(isNightShiftCaLamViec("S2")).toBe(true);
    expect(isNightShiftCaLamViec("s2")).toBe(true);
    expect(isNightShiftCaLamViec("S1")).toBe(false);
    expect(isNightShiftCaLamViec("")).toBe(false);
  });
});

describe("getOvertimeHoursFromGioRa (ca ngày)", () => {
  it("ra trước hoặc bằng 17:30 → 0", () => {
    expect(getOvertimeHoursFromGioRa("17:30")).toBe(0);
    expect(getOvertimeHoursFromGioRa("08:00")).toBe(0);
  });

  it("ra sau 17:30 — block 30 phút từ 17:00", () => {
    expect(getOvertimeHoursFromGioRa("18:00")).toBe(1);
    expect(getOvertimeHoursFromGioRa("19:00")).toBe(2);
  });
});

describe("getPayrollDayOvertimeHoursNumeric", () => {
  it("ca đêm S2 → 0 (TC nằm cột TC ca đêm)", () => {
    expect(
      getPayrollDayOvertimeHoursNumeric(
        "22:00",
        "06:00",
        false,
        "S2",
        false,
        false,
        false,
      ),
    ).toBe(0);
  });

  it("ca ngày ra 18:00 → TC chiều", () => {
    expect(
      getPayrollDayOvertimeHoursNumeric(
        "08:00",
        "18:00",
        false,
        "S1",
        false,
        false,
        false,
      ),
    ).toBe(1);
  });

  it("lateOtExcluded → không tính TC chiều", () => {
    expect(
      getPayrollDayOvertimeHoursNumeric(
        "08:00",
        "18:00",
        false,
        "S1",
        false,
        false,
        true,
      ),
    ).toBe(0);
  });
});

describe("ca đêm S2 — GC / TC sau 05:00", () => {
  const gioVao = "22:00";
  const gioRa = "06:00";
  const ca = "S2";

  it("GC đến 05:00 tối đa 8h", () => {
    const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
      gioVao,
      gioRa,
      ca,
    );
    expect(parts).not.toBeNull();
    expect(parts.regularHours).toBe(7);
    expect(parts.otMinutes).toBe(60);
  });

  it("TC ca đêm = 1h (60 phút sau 05:00)", () => {
    expect(getNightShiftPayrollOvertimeHours(gioVao, gioRa, ca)).toBe(1);
  });
});

describe("hiển thị cột TC", () => {
  it("TC ca ngày: ca đêm → «-»", () => {
    expect(
      formatPayrollTableDayShiftOvertimeCell(
        "22:00",
        "06:00",
        false,
        "S2",
        false,
        false,
        false,
      ),
    ).toBe("-");
  });

  it("TC ca ngày: ca ngày ra 18:00 có số", () => {
    expect(
      formatPayrollTableDayShiftOvertimeCell(
        "08:00",
        "18:00",
        false,
        "S1",
        false,
        false,
        false,
      ),
    ).toBe("1");
  });

  it("TC ca đêm: ca S2 ra 06:00 có số", () => {
    expect(
      formatPayrollTableNightShiftOvertimeCell(
        "22:00",
        "06:00",
        false,
        "S2",
        undefined,
        false,
        false,
      ),
    ).toBe("1");
  });
});
