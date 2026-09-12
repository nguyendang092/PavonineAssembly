import { describe, expect, it } from "vitest";
import { S95H_MANUAL_ENTRY_CONFIG } from "./s90dManualEntryReportConfig";
import {
  createEmptyProcessDayEntry,
  resolveProcessBoards,
  updateProcessMonthShiftField,
} from "./s90dManualEntries";

describe("s90dManualEntries S95H two-board edits", () => {
  it("keeps S95H65 and S95H55 when updating one board", () => {
    const config = S95H_MANUAL_ENTRY_CONFIG;
    const localByDate = {
      "2026-09-01": createEmptyProcessDayEntry("PRESS", config),
    };

    const next = updateProcessMonthShiftField(
      localByDate,
      "2026-09-01",
      "PRESS",
      "s95h65",
      "08~10",
      "okQty",
      80,
      config,
    );

    const boards = resolveProcessBoards(next["2026-09-01"], "PRESS", config);
    expect(boards).toHaveLength(2);
    expect(boards.map((board) => board.id)).toEqual(["s95h65", "s95h55"]);
    expect(boards.find((board) => board.id === "s95h65")?.shifts["08~10"].okQty).toBe(
      80,
    );
    expect(boards.find((board) => board.id === "s95h55")?.shifts["08~10"].okQty).toBe(
      0,
    );
  });

  it("uses the same two boards on MC (no extra GE board)", () => {
    const config = S95H_MANUAL_ENTRY_CONFIG;
    const boards = resolveProcessBoards(
      createEmptyProcessDayEntry("MC", config),
      "MC",
      config,
    );
    expect(boards).toHaveLength(2);
    expect(boards.map((board) => board.productCode)).toEqual([
      "S95H65",
      "S95H55",
    ]);
  });
});
