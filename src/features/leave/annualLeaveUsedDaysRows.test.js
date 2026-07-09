import { describe, expect, it } from "vitest";
import { buildAnnualLeaveUsedDayRows } from "./annualLeaveUsedDaysRows";

describe("buildAnnualLeaveUsedDayRows", () => {
  it("returns counted leave days newest first, skips displayOnly", () => {
    const rows = buildAnnualLeaveUsedDayRows({
      months: [
        {
          yearMonth: "2026-07",
          days: [
            { dateKey: "2026-07-05", type: "PN", deduction: 1 },
          ],
        },
        {
          yearMonth: "2026-06",
          days: [
            { dateKey: "2026-06-03", type: "PN", deduction: 1 },
            { dateKey: "2026-06-10", type: "1/2PN", deduction: 0.5 },
          ],
        },
        {
          yearMonth: "2026-05",
          displayOnly: true,
          days: [
            { dateKey: "2026-05-20", type: "PN", deduction: 1, displayOnly: true },
          ],
        },
      ],
    });

    expect(rows.map((r) => r.dateKey)).toEqual([
      "2026-07-05",
      "2026-06-10",
      "2026-06-03",
    ]);
    expect(rows[1]).toMatchObject({ type: "1/2PN", deduction: 0.5 });
  });

  it("returns empty array when detail is missing", () => {
    expect(buildAnnualLeaveUsedDayRows(null)).toEqual([]);
  });
});
