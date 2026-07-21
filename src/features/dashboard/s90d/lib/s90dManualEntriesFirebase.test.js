import { describe, expect, it } from "vitest";
import {
  buildS90dDefectImageUploadPrefix,
  parseS90dManualEntriesSnapshot,
  serializeS90dManualEntriesForFirebase,
  S90D_MANUAL_ENTRIES_FIREBASE_ROOT,
} from "./s90dManualEntriesFirebase";

describe("s90dManualEntriesFirebase", () => {
  it("uses dedicated firebase root separate from attendance", () => {
    expect(S90D_MANUAL_ENTRIES_FIREBASE_ROOT).toBe("s90d/manualEntries");
  });

  it("strips _meta when parsing snapshot", () => {
    const parsed = parseS90dManualEntriesSnapshot({
      _meta: { updatedAt: 1 },
      "2026-07-01": { processes: {} },
    });
    expect(parsed._meta).toBeUndefined();
    expect(parsed["2026-07-01"]).toBeDefined();
  });

  it("adds _meta when serializing", () => {
    const payload = serializeS90dManualEntriesForFirebase({
      "2026-07-01": { processes: {} },
    });
    expect(payload._meta?.updatedAt).toEqual(expect.any(Number));
    expect(payload["2026-07-01"]).toEqual({ processes: {} });
  });

  it("builds s90d-specific imgbb name prefix", () => {
    expect(
      buildS90dDefectImageUploadPrefix({
        dateKey: "2026-07-01",
        process: "PRESS",
        shiftSlot: "08-12",
        defectKey: "scratch",
      }),
    ).toBe("s90d_defect_2026-07-01_PRESS_08-12_scratch");
  });
});
