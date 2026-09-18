import { describe, expect, it } from "vitest";
import {
  S95H_MANUAL_ENTRY_CONFIG,
  filterSpecsBySummaryViewGroup,
} from "./s90dManualEntryReportConfig";
import {
  createEmptyProcessDayEntry,
  resolveProcessBoards,
  updateProcessMonthShiftField,
} from "./s90dManualEntries";

describe("s90dManualEntries S95H Deco/Chassis boards", () => {
  it("keeps 4 S95H boards when updating one board", () => {
    const config = S95H_MANUAL_ENTRY_CONFIG;
    const localByDate = {
      "2026-09-01": createEmptyProcessDayEntry("PRESS", config),
    };

    const next = updateProcessMonthShiftField(
      localByDate,
      "2026-09-01",
      "PRESS",
      "s95h65-deco",
      "08~10",
      "okQty",
      80,
      config,
    );

    const boards = resolveProcessBoards(next["2026-09-01"], "PRESS", config);
    expect(boards).toHaveLength(4);
    expect(boards.map((board) => board.id)).toEqual([
      "s95h65-deco",
      "s95h65-chassis",
      "s95h55-deco",
      "s95h55-chassis",
    ]);
    expect(
      boards.find((board) => board.id === "s95h65-deco")?.shifts["08~10"].okQty,
    ).toBe(80);
    expect(
      boards.find((board) => board.id === "s95h65-chassis")?.shifts["08~10"]
        .okQty,
    ).toBe(0);
  });

  it("uses the same 4 boards on MC", () => {
    const config = S95H_MANUAL_ENTRY_CONFIG;
    const boards = resolveProcessBoards(
      createEmptyProcessDayEntry("MC", config),
      "MC",
      config,
    );
    expect(boards).toHaveLength(4);
    expect(boards.map((board) => board.productCode)).toEqual([
      "S95H65 Deco",
      "S95H65 Chassis",
      "S95H55 Deco",
      "S95H55 Chassis",
    ]);
  });

  it("migrates legacy S95H65 / S95H55 boards onto Deco", () => {
    const config = S95H_MANUAL_ENTRY_CONFIG;
    const boards = resolveProcessBoards(
      {
        boards: [
          {
            id: "s95h65",
            productCode: "S95H65",
            shifts: { "08~10": { okQty: 12, ngQty: 0, defects: {} } },
          },
          {
            id: "s95h55",
            productCode: "S95H55",
            shifts: { "08~10": { okQty: 7, ngQty: 0, defects: {} } },
          },
        ],
      },
      "PRESS",
      config,
    );

    expect(boards).toHaveLength(4);
    expect(
      boards.find((board) => board.id === "s95h65-deco")?.shifts["08~10"].okQty,
    ).toBe(12);
    expect(
      boards.find((board) => board.id === "s95h55-deco")?.shifts["08~10"].okQty,
    ).toBe(7);
    expect(
      boards.find((board) => board.id === "s95h65-chassis")?.shifts["08~10"]
        .okQty,
    ).toBe(0);
  });

  it("filters S95H boards into Deco or Chassis view groups", () => {
    const deco = filterSpecsBySummaryViewGroup(
      S95H_MANUAL_ENTRY_CONFIG.fixedBoardSpecs,
      "deco",
    );
    const chassis = filterSpecsBySummaryViewGroup(
      S95H_MANUAL_ENTRY_CONFIG.fixedBoardSpecs,
      "chassis",
    );

    expect(deco.map((spec) => spec.productCode)).toEqual([
      "S95H65 Deco",
      "S95H55 Deco",
    ]);
    expect(chassis.map((spec) => spec.productCode)).toEqual([
      "S95H65 Chassis",
      "S95H55 Chassis",
    ]);
  });

  it("filters S95H process boards the same way as summary view groups", () => {
    const boards = resolveProcessBoards(
      createEmptyProcessDayEntry("PRESS", S95H_MANUAL_ENTRY_CONFIG),
      "PRESS",
      S95H_MANUAL_ENTRY_CONFIG,
    );
    expect(
      filterSpecsBySummaryViewGroup(boards, "deco").map((board) => board.productCode),
    ).toEqual(["S95H65 Deco", "S95H55 Deco"]);
    expect(
      filterSpecsBySummaryViewGroup(boards, "chassis").map(
        (board) => board.productCode,
      ),
    ).toEqual(["S95H65 Chassis", "S95H55 Chassis"]);
  });

  it("lists MC before PRESS on S95H", () => {
    expect(S95H_MANUAL_ENTRY_CONFIG.processes).toEqual([
      "MC",
      "PRESS",
      "HAIRLINE",
      "ANODIZING",
      "ASSEMBLY",
    ]);
  });
});
