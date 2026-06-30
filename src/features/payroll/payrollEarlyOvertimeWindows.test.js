import { describe, expect, it } from "vitest";
import {
  DAY_EARLY_OT_SECOND_TIER_MIN,
  NIGHT_EARLY_OT_SECOND_TIER_MIN,
  dayEarlyPaperworkOvertimeMinutes,
  nightEarlyPaperworkOvertimeMinutes,
} from "./payrollEarlyOvertimeWindows";

describe("payrollEarlyOvertimeWindows", () => {
  it("ca ngày — trước 06:00: 2h; từ 06:00: khung 06:40", () => {
    expect(dayEarlyPaperworkOvertimeMinutes(5 * 60 + 30)).toBe(120);
    expect(dayEarlyPaperworkOvertimeMinutes(5 * 60 + 40)).toBe(120);
    expect(dayEarlyPaperworkOvertimeMinutes(5 * 60 + 45)).toBe(120);
    expect(dayEarlyPaperworkOvertimeMinutes(DAY_EARLY_OT_SECOND_TIER_MIN)).toBe(
      60,
    );
    expect(dayEarlyPaperworkOvertimeMinutes(6 * 60 + 40)).toBe(60);
  });

  it("ca đêm — trước 18:00: 2h; từ 18:00: khung 18:40–19:40", () => {
    expect(nightEarlyPaperworkOvertimeMinutes(15 * 60 + 30)).toBe(120);
    expect(nightEarlyPaperworkOvertimeMinutes(16 * 60 + 56)).toBe(120);
    expect(nightEarlyPaperworkOvertimeMinutes(17 * 60)).toBe(120);
    expect(nightEarlyPaperworkOvertimeMinutes(17 * 60 + 40)).toBe(120);
    expect(nightEarlyPaperworkOvertimeMinutes(NIGHT_EARLY_OT_SECOND_TIER_MIN)).toBe(
      60,
    );
    expect(nightEarlyPaperworkOvertimeMinutes(18 * 60 + 40)).toBe(60);
    expect(nightEarlyPaperworkOvertimeMinutes(19 * 60)).toBe(0);
  });
});
