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
  it("flags high remaining leave as amber or red", () => {
    expect(
      resolveAnnualLeaveBalanceStatus({
        [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 10,
        [ANNUAL_LEAVE_EMP.BALANCE]: 6,
      }),
    ).toBe("amber");

    expect(
      resolveAnnualLeaveBalanceStatus({
        [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 10,
        [ANNUAL_LEAVE_EMP.BALANCE]: 8,
      }),
    ).toBe("red");
  });

  it("marks reasonable remaining leave as green", () => {
    expect(
      resolveAnnualLeaveBalanceStatus({
        [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 10,
        [ANNUAL_LEAVE_EMP.BALANCE]: 4,
      }),
    ).toBe("green");
  });
});
