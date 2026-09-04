import { describe, expect, it } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  annualLeaveDeptPillStyle,
  annualLeaveEmployeeAvatarStyle,
  annualLeaveEmployeeInitials,
  annualLeaveHeatmapCellStyle,
  resolveAnnualLeaveBalanceStatus,
} from "./annualLeaveManagerTheme";

describe("annualLeaveEmployeeInitials", () => {
  it("uses the last two name parts for Vietnamese full names", () => {
    expect(annualLeaveEmployeeInitials("Phạm Công Thành")).toBe("CT");
  });
});

describe("annualLeaveEmployeeAvatarStyle", () => {
  it("uses department tone for avatar background when available", () => {
    expect(annualLeaveEmployeeAvatarStyle("Phạm Công Thành", "Anodizing")).toEqual({
      initials: "CT",
      backgroundColor: "#5A3E9E",
      color: "#FFFFFF",
    });
  });
});

describe("annualLeaveHeatmapCellStyle", () => {
  it("returns null for zero or invalid usage", () => {
    expect(annualLeaveHeatmapCellStyle(0)).toBeNull();
    expect(annualLeaveHeatmapCellStyle("")).toBeNull();
  });

  it("interpolates toward primary and switches text at high usage", () => {
    const mid = annualLeaveHeatmapCellStyle(3);
    const high = annualLeaveHeatmapCellStyle(6);

    expect(mid?.color).toBe("#16221D");
    expect(high?.backgroundColor).toBe("rgb(31, 92, 78)");
    expect(high?.color).toBe("#FFFFFF");
    expect(annualLeaveHeatmapCellStyle(4)?.color).toBe("#FFFFFF");
  });
});

describe("annualLeaveDeptPillStyle", () => {
  it("maps known departments case-insensitively", () => {
    expect(annualLeaveDeptPillStyle("qc").text).toBe("#1F5C4E");
    expect(annualLeaveDeptPillStyle("EHS").bg).toBe("#FBE9E4");
  });

  it("falls back to primary soft for unknown departments", () => {
    expect(annualLeaveDeptPillStyle("UNKNOWN")).toEqual({
      bg: "#E4F0EC",
      text: "#1F5C4E",
    });
  });
});

describe("resolveAnnualLeaveBalanceStatus", () => {
  it("colors balance by absolute days: red < 1, amber 1–6, green > 6", () => {
    expect(
      resolveAnnualLeaveBalanceStatus({
        [ANNUAL_LEAVE_EMP.BALANCE]: 0,
      }),
    ).toBe("red");
    expect(
      resolveAnnualLeaveBalanceStatus({
        [ANNUAL_LEAVE_EMP.BALANCE]: 0.5,
      }),
    ).toBe("red");
    expect(
      resolveAnnualLeaveBalanceStatus({
        [ANNUAL_LEAVE_EMP.BALANCE]: 1,
      }),
    ).toBe("amber");
    expect(
      resolveAnnualLeaveBalanceStatus({
        [ANNUAL_LEAVE_EMP.BALANCE]: 6,
      }),
    ).toBe("amber");
    expect(
      resolveAnnualLeaveBalanceStatus({
        [ANNUAL_LEAVE_EMP.BALANCE]: 6.5,
      }),
    ).toBe("green");
    expect(
      resolveAnnualLeaveBalanceStatus({
        [ANNUAL_LEAVE_EMP.BALANCE]: 12,
      }),
    ).toBe("green");
  });

  it("returns neutral when balance is missing", () => {
    expect(resolveAnnualLeaveBalanceStatus({})).toBe("neutral");
  });
});
