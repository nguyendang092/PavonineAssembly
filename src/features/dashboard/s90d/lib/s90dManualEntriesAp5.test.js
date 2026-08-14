import { describe, expect, it } from "vitest";
import {
  AP5_MANUAL_ENTRY_CONFIG,
} from "./s90dManualEntryReportConfig";
import {
  createEmptyProcessDayEntry,
  resolveProcessBoards,
  updateProcessMonthShiftField,
} from "./s90dManualEntries";

describe("s90dManualEntries AP5 multi-board edits", () => {
  it("keeps all 3 AP5 boards when updating one board shift field", () => {
    const config = AP5_MANUAL_ENTRY_CONFIG;
    const localByDate = {
      "2026-07-01": createEmptyProcessDayEntry("PRESS", config),
    };

    const next = updateProcessMonthShiftField(
      localByDate,
      "2026-07-01",
      "PRESS",
      "ap5ff",
      "08~10",
      "okQty",
      120,
      config,
    );

    const boards = resolveProcessBoards(next["2026-07-01"], "PRESS", config);
    expect(boards).toHaveLength(3);
    expect(boards.find((board) => board.id === "ap5ff")?.shifts["08~10"].okQty).toBe(
      120,
    );
    expect(boards.find((board) => board.id === "ap5fz")?.shifts["08~10"].okQty).toBe(
      0,
    );
    expect(boards.find((board) => board.id === "ap5fl")?.shifts["08~10"].okQty).toBe(
      0,
    );
  });

  it("preserves prior board data when editing another AP5 board", () => {
    const config = AP5_MANUAL_ENTRY_CONFIG;
    let localByDate = {
      "2026-07-01": createEmptyProcessDayEntry("PRESS", config),
    };

    localByDate = updateProcessMonthShiftField(
      localByDate,
      "2026-07-01",
      "PRESS",
      "ap5ff",
      "08~10",
      "okQty",
      100,
      config,
    );
    localByDate = updateProcessMonthShiftField(
      localByDate,
      "2026-07-01",
      "PRESS",
      "ap5fz",
      "08~10",
      "okQty",
      50,
      config,
    );

    const boards = resolveProcessBoards(localByDate["2026-07-01"], "PRESS", config);
    expect(boards.find((board) => board.id === "ap5ff")?.shifts["08~10"].okQty).toBe(
      100,
    );
    expect(boards.find((board) => board.id === "ap5fz")?.shifts["08~10"].okQty).toBe(
      50,
    );
  });
});
