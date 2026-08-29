import { describe, expect, it } from "vitest";
import {
  aggregateBoardRowsByProductGroup,
  formatS90dBoardDisplayName,
  resolveS90dChainYieldPct,
  resolveS90dCumulativeYieldPct,
  resolveS90dStepYieldPct,
  resolveS90dTotalYieldPct,
} from "./s90dDisplayUtils";

describe("aggregateBoardRowsByProductGroup", () => {
  it("merges Type D and Type E into one row per product", () => {
    const merged = aggregateBoardRowsByProductGroup([
      {
        boardId: "press-coded",
        productCode: "S90D",
        codeSlot: "D",
        totalQty: 100,
        okQty: 95,
        ngQty: 5,
        defects: { scratch: 5 },
      },
      {
        boardId: "press-codee",
        productCode: "S90D",
        codeSlot: "E",
        totalQty: 80,
        okQty: 70,
        ngQty: 10,
        defects: { scratch: 10 },
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].productCode).toBe("S90D");
    expect(merged[0].codeSlot).toBeNull();
    expect(merged[0].totalQty).toBe(180);
    expect(merged[0].okQty).toBe(165);
    expect(merged[0].ngQty).toBe(15);
    expect(merged[0].defects.scratch).toBe(15);
  });

  it("keeps separate rows for different assembly products", () => {
    const merged = aggregateBoardRowsByProductGroup([
      {
        boardId: "assembly-inzi-coded",
        productCode: "S90D INZI",
        codeSlot: "D",
        totalQty: 100,
        okQty: 90,
        ngQty: 10,
        defects: {},
      },
      {
        boardId: "assembly-inzi-codee",
        productCode: "S90D INZI",
        codeSlot: "E",
        totalQty: 100,
        okQty: 80,
        ngQty: 20,
        defects: {},
      },
      {
        boardId: "assembly-mxc-coded",
        productCode: "S90D MXC",
        codeSlot: "D",
        totalQty: 50,
        okQty: 45,
        ngQty: 5,
        defects: {},
      },
      {
        boardId: "assembly-mxc-codee",
        productCode: "S90D MXC",
        codeSlot: "E",
        totalQty: 50,
        okQty: 40,
        ngQty: 10,
        defects: {},
      },
    ]);

    expect(merged).toHaveLength(2);
    expect(merged.map((row) => row.productCode).sort()).toEqual([
      "S90D INZI",
      "S90D MXC",
    ]);
    expect(merged.find((row) => row.productCode === "S90D INZI")?.totalQty).toBe(
      200,
    );
  });
});

describe("resolveS90dStepYieldPct", () => {
  it("computes okQty / totalQty", () => {
    expect(
      resolveS90dStepYieldPct({ okQty: 90, totalQty: 100 }),
    ).toBe(90);
    expect(resolveS90dStepYieldPct({ okQty: 0, totalQty: 0 })).toBeNull();
  });
});

describe("resolveS90dCumulativeYieldPct", () => {
  it("uses cumulativeYieldPct for process rows", () => {
    expect(
      resolveS90dCumulativeYieldPct({
        okQty: 90,
        totalQty: 100,
        yieldPct: 94.4,
        cumulativeYieldPct: 92.9,
      }),
    ).toBe(92.9);
  });

  it("does not fall back to yieldPct when cumulative is missing", () => {
    expect(
      resolveS90dCumulativeYieldPct({
        okQty: 90,
        totalQty: 100,
        yieldPct: 94.4,
      }),
    ).toBeNull();
  });
});

describe("resolveS90dChainYieldPct", () => {
  it("uses yieldPct for process rows (legacy Hiệu suất)", () => {
    expect(
      resolveS90dChainYieldPct({
        okQty: 90,
        totalQty: 100,
        yieldPct: 94.4,
        cumulativeYieldPct: 89.9,
      }),
    ).toBe(94.4);
  });

  it("uses okQty over totalQty for TOTAL rows", () => {
    expect(
      resolveS90dChainYieldPct(
        {
          okQty: 5974,
          totalQty: 6124,
          yieldPct: 94.4,
          cumulativeYieldPct: 89.9,
        },
        { isTotal: true },
      ),
    ).toBeCloseTo(97.6, 1);
  });
});

describe("resolveS90dTotalYieldPct", () => {
  it("uses okQty over totalQty for TOTAL rows", () => {
    expect(
      resolveS90dTotalYieldPct({
        yieldPct: 94.4,
        cumulativeYieldPct: 89.9,
        totalQty: 6124,
        okQty: 5974,
      }),
    ).toBeCloseTo(97.6, 1);
  });

  it("returns null when totalQty is zero", () => {
    expect(
      resolveS90dTotalYieldPct({
        cumulativeYieldPct: 89.9,
        totalQty: 0,
        okQty: 0,
      }),
    ).toBeNull();
  });
});

describe("formatS90dBoardDisplayName", () => {
  it("formats S90D Type D/E from codeSlot", () => {
    expect(
      formatS90dBoardDisplayName({
        productCode: "S90D",
        codeSlot: "D",
      }),
    ).toBe("S90D Type D");
    expect(
      formatS90dBoardDisplayName({
        productCode: "S90D",
        codeSlot: "E",
      }),
    ).toBe("S90D Type E");
  });

  it("infers Type D/E from board id when codeSlot is missing", () => {
    expect(
      formatS90dBoardDisplayName({
        boardId: "press-coded",
        productCode: "S90D",
      }),
    ).toBe("S90D Type D");
  });

  it("includes assembly product prefix with type slot", () => {
    expect(
      formatS90dBoardDisplayName({
        productCode: "S90D INZI",
        codeSlot: "E",
      }),
    ).toBe("S90D INZI Type E");
  });
});
