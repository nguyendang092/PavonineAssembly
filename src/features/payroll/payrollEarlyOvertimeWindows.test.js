import { describe, expect, it } from "vitest";
import {
  DAY_EARLY_OT_MARKER_SPLIT_MIN,
  NIGHT_EARLY_OT_SEGMENTS,
  dayEarlyPaperworkOvertimeMinutes,
  sumPaperworkOvertimeSegmentMinutes,
} from "./payrollEarlyOvertimeWindows";

describe("payrollEarlyOvertimeWindows", () => {
  it("ca ngày — một khung: trước 05:40 vs từ 05:40", () => {
    expect(dayEarlyPaperworkOvertimeMinutes(5 * 60 + 30)).toBe(60);
    expect(dayEarlyPaperworkOvertimeMinutes(DAY_EARLY_OT_MARKER_SPLIT_MIN)).toBe(
      60,
    );
    expect(dayEarlyPaperworkOvertimeMinutes(6 * 60)).toBe(60);
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
