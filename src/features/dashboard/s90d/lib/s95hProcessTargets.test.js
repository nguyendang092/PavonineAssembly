import { describe, expect, it } from "vitest";
import {
  formatS95hEfficiencyPct,
  resolveS95hEfficiencyPct,
  resolveS95hProcessDailyTarget,
  resolveS95hTargetQty,
} from "./s95hProcessTargets";

describe("s95hProcessTargets", () => {
  it("uses 120 for PRESS / MC / HAIRLINE and 100 for ANODIZING / ASSEMBLY", () => {
    expect(resolveS95hProcessDailyTarget("PRESS")).toBe(120);
    expect(resolveS95hProcessDailyTarget("MC")).toBe(120);
    expect(resolveS95hProcessDailyTarget("hairline")).toBe(120);
    expect(resolveS95hProcessDailyTarget("ANODIZING")).toBe(100);
    expect(resolveS95hProcessDailyTarget("ASSEMBLY")).toBe(100);
    expect(resolveS95hProcessDailyTarget("UNKNOWN")).toBe(0);
  });

  it("scales daily targets by day count and sums them on TOTAL", () => {
    expect(resolveS95hTargetQty("PRESS")).toBe(120);
    expect(resolveS95hTargetQty("ASSEMBLY", { dayCount: 3 })).toBe(300);
    expect(resolveS95hTargetQty("TOTAL", { isTotal: true })).toBe(560);
    expect(resolveS95hTargetQty("TOTAL", { isTotal: true, dayCount: 2 })).toBe(
      1120,
    );
  });

  it("computes efficiency as okQty / target", () => {
    expect(resolveS95hEfficiencyPct(120, 120)).toBe(100);
    expect(resolveS95hEfficiencyPct(90, 120)).toBe(75);
    expect(resolveS95hEfficiencyPct(150, 120)).toBe(125);
    expect(resolveS95hEfficiencyPct(95, 0)).toBeNull();
    expect(formatS95hEfficiencyPct(75)).toBe("75%");
    expect(formatS95hEfficiencyPct(null)).toBe("-");
  });
});
