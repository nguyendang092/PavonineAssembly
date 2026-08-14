import { describe, expect, it } from "vitest";
import { AP5_MANUAL_ENTRY_CONFIG } from "../s90d/lib/s90dManualEntryReportConfig";
import { normalizeManualStore } from "../s90d/lib/s90dManualEntries";
import { parseManualEntriesSnapshot } from "./manualEntriesFirebase";

describe("parseManualEntriesSnapshot", () => {
  it("preserves AP5 ASSEMBLY board data when normalized with AP5 config", () => {
    const firebaseRaw = {
      _meta: { updatedAt: 1_700_000_000_000 },
      "2026-08-01": {
        ASSEMBLY: {
          boards: [
            {
              id: "ap5ff",
              label: "AP5FF",
              productCode: "AP5FF",
              shifts: {
                "08~10": {
                  okQty: 88,
                  ngQty: 0,
                  defects: {},
                  defectImages: {},
                },
              },
            },
          ],
        },
      },
    };

    const store = normalizeManualStore(
      parseManualEntriesSnapshot(firebaseRaw),
      AP5_MANUAL_ENTRY_CONFIG,
    );

    const boards = store["2026-08-01"]?.ASSEMBLY?.boards ?? [];
    expect(boards.find((board) => board.id === "ap5ff")?.shifts["08~10"].okQty).toBe(
      88,
    );
  });
});
