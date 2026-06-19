import { describe, expect, it } from "vitest";
import {
  DAY_EARLY_OT_SECOND_TIER_MIN,
  NIGHT_EARLY_OT_SEGMENTS,
  dayEarlyPaperworkOvertimeMinutes,
  sumPaperworkOvertimeSegmentMinutes,
} from "./payrollEarlyOvertimeWindows";

describe("payrollEarlyOvertimeWindows", () => {
  it("ca ngày — trước 05:40: 2h; 05:40–05:59: 1h; từ 06:00: khung 06:40", () => {
    expect(dayEarlyPaperworkOvertimeMinutes(5 * 60 + 30)).toBe(120);
    expect(dayEarlyPaperworkOvertimeMinutes(5 * 60 + 40)).toBe(60);
    expect(dayEarlyPaperworkOvertimeMinutes(5 * 60 + 45)).toBe(60);
    expect(dayEarlyPaperworkOvertimeMinutes(DAY_EARLY_OT_SECOND_TIER_MIN)).toBe(
      60,
    );
    expect(dayEarlyPaperworkOvertimeMinutes(6 * 60 + 40)).toBe(60);
  });

  it("ca đêm — khung 18:40–19:40 cố định 60 phút khi đủ điều kiện", () => {
    expect(sumPaperworkOvertimeSegmentMinutes(17 * 60, NIGHT_EARLY_OT_SEGMENTS)).toBe(
      60,
    );
    expect(
      sumPaperworkOvertimeSegmentMinutes(18 * 60 + 40, NIGHT_EARLY_OT_SEGMENTS),
    ).toBe(60);
  });
});
