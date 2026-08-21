import { describe, expect, it } from "vitest";
import { AP5_MANUAL_ENTRY_CONFIG } from "../s90d/lib/s90dManualEntryReportConfig";
import { normalizeManualStore } from "../s90d/lib/s90dManualEntries";
import {
  applyMonthSliceIfChanged,
  buildMonthMetaOnlyPatch,
  parseManualEntriesSnapshot,
} from "./manualEntriesFirebase";

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

describe("applyMonthSliceIfChanged", () => {
  it("skips merge when month checksum is unchanged", () => {
    const store = {
      "2026-08-01": { PRESS: { boards: [] } },
    };
    const monthSlice = { "2026-08-01": store["2026-08-01"] };
    const result = applyMonthSliceIfChanged(store, "2026-08", monthSlice);
    expect(result.changed).toBe(false);
    expect(result.store).toBe(store);
  });
});

describe("buildMonthMetaOnlyPatch", () => {
  it("writes checksum meta for touched months", () => {
    const store = {
      "2026-08-01": { PRESS: { boards: [{ id: "a", shifts: {} }] } },
    };
    const patch = buildMonthMetaOnlyPatch(store, ["2026-08"]);
    expect(patch["_meta/months/2026-08/checksum"]).toEqual(expect.any(String));
    expect(patch["_meta/months/2026-08/updatedAt"]).toEqual(expect.any(Number));
  });
});
