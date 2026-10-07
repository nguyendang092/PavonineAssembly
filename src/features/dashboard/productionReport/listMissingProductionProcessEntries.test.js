import { describe, expect, it } from "vitest";
import {
  groupMissingProductionEntriesByDate,
  listMissingProductionProcessEntries,
} from "./listMissingProductionProcessEntries";

describe("listMissingProductionProcessEntries", () => {
  const processes = ["PRESS", "ASSEMBLY"];

  it("lists process+date with zero qty and skips future days", () => {
    const missing = listMissingProductionProcessEntries({
      processes,
      throughDateKey: "2026-10-02",
      monthDailySummaries: [
        {
          dateKey: "2026-10-01",
          dateLabel: "01/10",
          processRows: [
            { process: "PRESS", totalQty: 10 },
            { process: "ASSEMBLY", totalQty: 0 },
          ],
        },
        {
          dateKey: "2026-10-02",
          dateLabel: "02/10",
          processRows: [{ process: "PRESS", totalQty: 0 }],
        },
        {
          dateKey: "2026-10-03",
          dateLabel: "03/10",
          processRows: [
            { process: "PRESS", totalQty: 0 },
            { process: "ASSEMBLY", totalQty: 0 },
          ],
        },
      ],
    });

    expect(missing).toEqual([
      { dateKey: "2026-10-01", dateLabel: "01/10", process: "ASSEMBLY" },
      { dateKey: "2026-10-02", dateLabel: "02/10", process: "PRESS" },
      { dateKey: "2026-10-02", dateLabel: "02/10", process: "ASSEMBLY" },
    ]);
  });

  it("groups by date for the notify list", () => {
    const groups = groupMissingProductionEntriesByDate([
      { dateKey: "2026-10-01", dateLabel: "01/10", process: "PRESS" },
      { dateKey: "2026-10-01", dateLabel: "01/10", process: "MC" },
      { dateKey: "2026-10-02", dateLabel: "02/10", process: "PRESS" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].processes.map((item) => item.process)).toEqual([
      "PRESS",
      "MC",
    ]);
  });
});
