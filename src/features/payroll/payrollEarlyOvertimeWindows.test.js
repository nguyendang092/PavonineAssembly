import { describe, expect, it } from "vitest";
import {
  DAY_EARLY_OT_SECOND_TIER_MIN,
  NIGHT_EARLY_OT_TIER_START_MINUTES,
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

  it("ca đêm — 4 khung mốc; tier 16:00 / 17:00 / 18:00", () => {
    expect(nightEarlyPaperworkOvertimeMinutes(15 * 60 + 30)).toBe(240);
    expect(nightEarlyPaperworkOvertimeMinutes(15 * 60 + 45)).toBe(60);
    expect(nightEarlyPaperworkOvertimeMinutes(16 * 60)).toBe(180);
    expect(nightEarlyPaperworkOvertimeMinutes(16 * 60 + 40)).toBe(60);
    expect(nightEarlyPaperworkOvertimeMinutes(17 * 60)).toBe(120);
    expect(nightEarlyPaperworkOvertimeMinutes(17 * 60 + 40)).toBe(60);
    expect(nightEarlyPaperworkOvertimeMinutes(17 * 60 + 45)).toBe(60);
    expect(
      nightEarlyPaperworkOvertimeMinutes(NIGHT_EARLY_OT_TIER_START_MINUTES[2]),
    ).toBe(60);
    expect(nightEarlyPaperworkOvertimeMinutes(18 * 60 + 40)).toBe(60);
  });
});
