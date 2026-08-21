import { describe, expect, it } from "vitest";
import {
  computeMonthChecksum,
  extractMonthSlice,
  listArchivableMonthKeys,
  mergeMonthSliceIntoStore,
  monthKeyToDateRange,
  subscriptionMonthKeys,
} from "./manualEntriesMonthUtils";
import { mergeDayEntryOnConflict, readDayUpdatedAt } from "./manualEntriesDayMerge";
import { buildArchiveMonthPatch } from "./manualEntriesArchive";

describe("manualEntriesMonthUtils", () => {
  it("monthKeyToDateRange returns first and last day of month", () => {
    expect(monthKeyToDateRange("2026-08")).toEqual({
      start: "2026-08-01",
      end: "2026-08-31",
    });
  });

  it("subscriptionMonthKeys includes adjacent months", () => {
    expect(subscriptionMonthKeys("2026-08")).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("computeMonthChecksum changes when day data changes", () => {
    const slice = {
      "2026-08-01": { PRESS: { boards: [] } },
    };
    const checksumA = computeMonthChecksum(slice);
    const checksumB = computeMonthChecksum({
      "2026-08-01": { PRESS: { boards: [{ id: "a" }] } },
    });
    expect(checksumA).not.toBe(checksumB);
  });

  it("mergeMonthSliceIntoStore replaces only target month", () => {
    const store = {
      "2026-07-01": { PRESS: { boards: [] } },
      "2026-08-01": { PRESS: { boards: [] } },
    };
    const next = mergeMonthSliceIntoStore(store, "2026-08", {
      "2026-08-01": { PRESS: { boards: [{ id: "new" }] } },
    });
    expect(next["2026-07-01"]).toEqual(store["2026-07-01"]);
    expect(next["2026-08-01"].PRESS.boards[0].id).toBe("new");
  });

  it("listArchivableMonthKeys finds months older than threshold", () => {
    const store = {
      "2024-01-01": { PRESS: { boards: [] } },
      "2026-08-01": { PRESS: { boards: [] } },
    };
    const archivable = listArchivableMonthKeys(
      store,
      new Date("2026-08-21"),
      12,
    );
    expect(archivable).toContain("2024-01");
    expect(archivable).not.toContain("2026-08");
  });
});

describe("manualEntriesDayMerge", () => {
  it("mergeDayEntryOnConflict keeps remote process and merges saved process boards", () => {
    const remoteDay = {
      _updatedAt: 100,
      PRESS: { boards: [{ id: "ap5ff", shifts: { "08~10": { okQty: 5 } } }] },
      MC: { boards: [{ id: "ap5ff", shifts: { "08~10": { okQty: 9 } } }] },
    };
    const localProcessDay = {
      boards: [{ id: "ap5ff", shifts: { "08~10": { okQty: 99 } } }],
    };
    const merged = mergeDayEntryOnConflict(
      remoteDay,
      { PRESS: localProcessDay, MC: remoteDay.MC },
      "PRESS",
      localProcessDay,
    );
    expect(merged.MC.boards[0].shifts["08~10"].okQty).toBe(9);
    expect(merged.PRESS.boards[0].shifts["08~10"].okQty).toBe(99);
  });

  it("readDayUpdatedAt returns 0 when missing", () => {
    expect(readDayUpdatedAt({})).toBe(0);
    expect(readDayUpdatedAt({ _updatedAt: 42 })).toBe(42);
  });
});

describe("manualEntriesArchive", () => {
  it("buildArchiveMonthPatch moves month days to archive root", () => {
    const store = {
      "2026-01-01": { PRESS: { boards: [] } },
      "2026-08-01": { PRESS: { boards: [] } },
    };
    const patch = buildArchiveMonthPatch("ap5/manualEntries", "2026-01", store);
    expect(patch["ap5/manualEntriesArchive/2026-01/2026-01-01"]).toEqual(
      store["2026-01-01"],
    );
    expect(patch["ap5/manualEntries/2026-01-01"]).toBeNull();
    expect(extractMonthSlice(store, "2026-08")).toEqual({
      "2026-08-01": store["2026-08-01"],
    });
  });
});
