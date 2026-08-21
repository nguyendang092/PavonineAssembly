import { describe, expect, it } from "vitest";
import {
  AP5_MANUAL_ENTRY_CONFIG,
} from "./s90dManualEntryReportConfig";
import {
  createEmptyProcessDayEntry,
  mergeProcessMonthIntoStore,
  normalizeManualStore,
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

  it("creates 4 AP5 boards on MC process tab", () => {
    const config = AP5_MANUAL_ENTRY_CONFIG;
    const boards = resolveProcessBoards(
      createEmptyProcessDayEntry("MC", config),
      "MC",
      config,
    );

    expect(boards).toHaveLength(4);
    expect(boards.map((board) => board.id)).toEqual([
      "ap5ff",
      "ap5fz",
      "ap5fl",
      "ap5fl-mc",
    ]);
    expect(boards.filter((board) => board.productCode === "AP5FL")).toHaveLength(2);
  });

  it("migrates legacy GE day entries to MC with AP5FL boards", () => {
    const config = AP5_MANUAL_ENTRY_CONFIG;
    const store = normalizeManualStore(
      {
        "2026-07-01": {
          GE: {
            boards: [
              {
                id: "ap5ff",
                label: "AP5FF",
                productCode: "AP5FF",
                shifts: { "08~10": { okQty: 10, ngQty: 0, defects: {} } },
              },
              {
                id: "ap5fz",
                label: "AP5FZ",
                productCode: "AP5FZ",
                shifts: { "08~10": { okQty: 8, ngQty: 0, defects: {} } },
              },
            ],
          },
        },
      },
      config,
    );

    const boards = resolveProcessBoards(store["2026-07-01"].MC, "MC", config);
    expect(boards).toHaveLength(4);
    expect(boards.find((board) => board.id === "ap5ff")?.shifts["08~10"].okQty).toBe(
      10,
    );
    expect(boards.find((board) => board.id === "ap5fz")?.shifts["08~10"].okQty).toBe(
      8,
    );
    expect(boards.find((board) => board.id === "ap5fl")?.productCode).toBe("AP5FL");
    expect(boards.find((board) => board.id === "ap5fl-mc")?.label).toBe("AP5FL GE");
    expect(boards.find((board) => board.id === "ap5fl-mc")?.productCode).toBe(
      "AP5FL",
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

  it("mergeProcessMonthIntoStore keeps untouched dates from store when localByDate is sparse", () => {
    const config = AP5_MANUAL_ENTRY_CONFIG;
    let store = normalizeManualStore({}, config);

    store = mergeProcessMonthIntoStore(
      store,
      ["2026-07-01", "2026-07-02"],
      "PRESS",
      {
        "2026-07-01": updateProcessMonthShiftField(
          {},
          "2026-07-01",
          "PRESS",
          "ap5ff",
          "08~10",
          "okQty",
          77,
          config,
        )["2026-07-01"],
        "2026-07-02": updateProcessMonthShiftField(
          {},
          "2026-07-02",
          "PRESS",
          "ap5ff",
          "08~10",
          "okQty",
          11,
          config,
        )["2026-07-02"],
      },
      config,
    );

    const localByDate = updateProcessMonthShiftField(
      {},
      "2026-07-02",
      "PRESS",
      "ap5ff",
      "08~10",
      "okQty",
      99,
      config,
    );

    const next = mergeProcessMonthIntoStore(
      store,
      ["2026-07-01", "2026-07-02"],
      "PRESS",
      localByDate,
      config,
    );

    expect(
      resolveProcessBoards(next["2026-07-01"].PRESS, "PRESS", config).find(
        (board) => board.id === "ap5ff",
      )?.shifts["08~10"].okQty,
    ).toBe(77);
    expect(
      resolveProcessBoards(next["2026-07-02"].PRESS, "PRESS", config).find(
        (board) => board.id === "ap5ff",
      )?.shifts["08~10"].okQty,
    ).toBe(99);
  });
});
