import { describe, expect, it } from "vitest";
import { getDateKeyBySubtractDays } from "@/utils/dateKey";

describe("annual leave daily rollover date", () => {
  it("yesterday of 2026-09-22 is 2026-09-21", () => {
    expect(getDateKeyBySubtractDays("2026-09-22", 1)).toBe("2026-09-21");
  });

  it("yesterday of 2027-01-01 is previous year", () => {
    expect(getDateKeyBySubtractDays("2027-01-01", 1)).toBe("2026-12-31");
  });
});
