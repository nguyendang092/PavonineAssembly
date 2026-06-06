import { describe, expect, it } from "vitest";
import {
  formatAttendanceGenderDisplay,
  normalizeAttendanceGioiTinhValue,
} from "./attendanceGender";

describe("normalizeAttendanceGioiTinhValue", () => {
  it("maps Vietnamese labels to YES/NO", () => {
    expect(normalizeAttendanceGioiTinhValue("Nữ")).toBe("YES");
    expect(normalizeAttendanceGioiTinhValue("Nam")).toBe("NO");
    expect(normalizeAttendanceGioiTinhValue("YES")).toBe("YES");
    expect(normalizeAttendanceGioiTinhValue("NO")).toBe("NO");
    expect(normalizeAttendanceGioiTinhValue("YES (Nữ)")).toBe("YES");
    expect(normalizeAttendanceGioiTinhValue("NO (Nam)")).toBe("NO");
  });
});

describe("formatAttendanceGenderDisplay", () => {
  it("shows Nữ/Nam for storage codes", () => {
    expect(
      formatAttendanceGenderDisplay("YES", { female: "Nữ", male: "Nam" }),
    ).toBe("Nữ");
    expect(
      formatAttendanceGenderDisplay("NO", { female: "Nữ", male: "Nam" }),
    ).toBe("Nam");
    expect(
      formatAttendanceGenderDisplay("Nam", { female: "Nữ", male: "Nam" }),
    ).toBe("Nam");
  });
});
