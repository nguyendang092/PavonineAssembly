import { describe, expect, it } from "vitest";
import {
  buildS90dEntryBoardSpecs,
  inferCodeSlotFromBoardId,
} from "./s90dEntryBoardSpecs";
import {
  R95D_MANUAL_ENTRY_CONFIG,
  S90D_MANUAL_ENTRY_CONFIG,
  filterSpecsBySummaryViewGroup,
} from "./s90dManualEntryReportConfig";
import { resolveProcessBoards } from "./s90dManualEntries";

describe("s90dEntryBoardSpecs", () => {
  it("creates two entry boards for regular S90D processes", () => {
    const specs = buildS90dEntryBoardSpecs("PRESS", S90D_MANUAL_ENTRY_CONFIG);
    expect(specs).toHaveLength(2);
    expect(specs[0]).toMatchObject({
      id: "press-coded",
      label: "Type D",
      codeSlot: "D",
    });
    expect(specs[1]).toMatchObject({
      id: "press-codee",
      label: "Type E",
      codeSlot: "E",
    });
  });

  it("creates four entry boards for assembly INZI/MXC x Code D/E", () => {
    const specs = buildS90dEntryBoardSpecs("ASSEMBLY", S90D_MANUAL_ENTRY_CONFIG);
    expect(specs).toHaveLength(4);
    expect(specs.map((spec) => spec.id)).toEqual([
      "assembly-inzi-coded",
      "assembly-inzi-codee",
      "assembly-mxc-coded",
      "assembly-mxc-codee",
    ]);
  });

  it("migrates legacy assembly boards into code D entry boards", () => {
    const boards = resolveProcessBoards(
      {
        boards: [
          {
            id: "assembly-inzi",
            productCode: "S90D INZI",
            shifts: {
              "08~10": { okQty: 10, ngQty: 0, defects: {} },
            },
          },
          {
            id: "assembly-mxc",
            productCode: "S90D MXC",
            shifts: {
              "08~10": { okQty: 5, ngQty: 0, defects: {} },
            },
          },
        ],
      },
      "ASSEMBLY",
      S90D_MANUAL_ENTRY_CONFIG,
    );

    expect(boards).toHaveLength(4);
    expect(boards[0].shifts["08~10"].okQty).toBe(10);
    expect(boards[1].shifts["08~10"].okQty).toBe(0);
    expect(boards[2].shifts["08~10"].okQty).toBe(5);
    expect(boards[3].shifts["08~10"].okQty).toBe(0);
  });

  it("infers code slot from board id suffix", () => {
    expect(inferCodeSlotFromBoardId("assembly-inzi-coded")).toBe("D");
    expect(inferCodeSlotFromBoardId("press-codee")).toBe("E");
  });

  it("creates R95D PRESS boards labeled 65, 75 and 85", () => {
    const specs = buildS90dEntryBoardSpecs("PRESS", R95D_MANUAL_ENTRY_CONFIG);
    expect(specs).toHaveLength(3);
    expect(specs.map((spec) => spec.label)).toEqual(["65", "75", "85"]);
    expect(specs.map((spec) => spec.codeSlot)).toEqual(["65", "75", "85"]);
    expect(specs.map((spec) => spec.id)).toEqual([
      "press-code65",
      "press-code75",
      "press-code85",
    ]);
  });

  it("uses the same 65/75/85 boards on R95D ASSEMBLY", () => {
    const specs = buildS90dEntryBoardSpecs("ASSEMBLY", R95D_MANUAL_ENTRY_CONFIG);
    expect(specs).toHaveLength(3);
    expect(specs.map((spec) => spec.label)).toEqual(["65", "75", "85"]);
    expect(specs.map((spec) => spec.id)).toEqual([
      "assembly-code65",
      "assembly-code75",
      "assembly-code85",
    ]);
  });

  it("migrates legacy R95D 55 boards onto 75", () => {
    const boards = resolveProcessBoards(
      {
        boards: [
          {
            id: "press-code65",
            productCode: "R95D",
            codeSlot: "65",
            shifts: { "08~10": { okQty: 10, ngQty: 0, defects: {} } },
          },
          {
            id: "press-code55",
            productCode: "R95D",
            codeSlot: "55",
            shifts: { "08~10": { okQty: 8, ngQty: 1, defects: {} } },
          },
        ],
      },
      "PRESS",
      R95D_MANUAL_ENTRY_CONFIG,
    );

    expect(boards.map((board) => board.id)).toEqual([
      "press-code65",
      "press-code75",
      "press-code85",
    ]);
    expect(boards.map((board) => board.codeSlot)).toEqual(["65", "75", "85"]);
    expect(
      boards.find((board) => board.id === "press-code75")?.shifts["08~10"].okQty,
    ).toBe(8);
  });

  it("filters R95D process boards by 65 / 75 / 85 view groups", () => {
    const boards = resolveProcessBoards(
      { boards: [] },
      "PRESS",
      R95D_MANUAL_ENTRY_CONFIG,
    );
    expect(
      filterSpecsBySummaryViewGroup(boards, "65").map((board) => board.codeSlot),
    ).toEqual(["65"]);
    expect(
      filterSpecsBySummaryViewGroup(boards, "75").map((board) => board.codeSlot),
    ).toEqual(["75"]);
    expect(
      filterSpecsBySummaryViewGroup(boards, "85").map((board) => board.codeSlot),
    ).toEqual(["85"]);
  });
});
