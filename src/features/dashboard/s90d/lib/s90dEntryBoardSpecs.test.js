import { describe, expect, it } from "vitest";
import {
  buildS90dEntryBoardSpecs,
  inferCodeSlotFromBoardId,
} from "./s90dEntryBoardSpecs";
import { S90D_MANUAL_ENTRY_CONFIG } from "./s90dManualEntryReportConfig";
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
});
