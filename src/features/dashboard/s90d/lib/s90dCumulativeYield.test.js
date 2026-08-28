import { describe, expect, it } from "vitest";
import {
  applyS90dCodeSlotYieldMetrics,
  applyS90dCumulativeYieldPct,
  applyS90dDisplayYieldPct,
  applyS90dProcessYieldMetrics,
  applyS90dProductBoardYieldMetrics,
  computeS90dCumulativeYieldPct,
  computeS90dStraightYieldPct,
  roundYieldPct,
} from "./s90dCumulativeYield";

describe("s90dCumulativeYield", () => {
  it("computes straight yield as chain yield times previous straight yield", () => {
    expect(computeS90dStraightYieldPct(95, 94.7)).toBeCloseTo(90, 1);
    expect(computeS90dStraightYieldPct(92.9, 90)).toBeCloseTo(83.6, 1);
    expect(computeS90dStraightYieldPct(98, 83.6)).toBeCloseTo(81.9, 1);
  });

  it("keeps legacy cumulative helper for first-stage fallback", () => {
    expect(computeS90dCumulativeYieldPct(100, null)).toBe(100);
    expect(computeS90dCumulativeYieldPct(94.7, 95)).toBeCloseTo(90, 1);
  });

  it("applies display yield: PRESS step, HAIRLINE+ divided by previous", () => {
    const processRows = [
      { process: "PRESS", okQty: 95, totalQty: 100 },
      { process: "HAIRLINE", okQty: 90, totalQty: 100 },
      { process: "ANODIZING", okQty: 88, totalQty: 100 },
      { process: "ASSEMBLY", okQty: 91, totalQty: 100 },
    ];

    applyS90dDisplayYieldPct(processRows);

    expect(processRows[0].stepYieldPct).toBe(95);
    expect(processRows[0].yieldPct).toBe(95);
    expect(processRows[1].stepYieldPct).toBe(90);
    expect(processRows[1].yieldPct).toBe(94.7);
    expect(processRows[2].yieldPct).toBe(92.9);
    expect(processRows[3].yieldPct).toBe(98);
  });

  it("applies straight yield from chain yields on summary tabs", () => {
    const processRows = [
      { process: "PRESS", yieldPct: 95, stepYieldPct: 95, totalQty: 100 },
      { process: "HAIRLINE", yieldPct: 94.7, stepYieldPct: 90, totalQty: 100 },
      { process: "ANODIZING", yieldPct: 92.9, stepYieldPct: 88, totalQty: 100 },
      { process: "ASSEMBLY", yieldPct: 98, stepYieldPct: 91, totalQty: 100 },
    ];

    applyS90dCumulativeYieldPct(processRows);

    expect(processRows[0].cumulativeYieldPct).toBe(95);
    expect(processRows[1].cumulativeYieldPct).toBeCloseTo(90, 1);
    expect(processRows[2].cumulativeYieldPct).toBeCloseTo(83.6, 1);
    expect(processRows[3].cumulativeYieldPct).toBeCloseTo(81.9, 1);
  });

  it("applies full process yield metrics for daily/total tabs", () => {
    const processRows = [
      { process: "PRESS", okQty: 95, totalQty: 100 },
      { process: "HAIRLINE", okQty: 90, totalQty: 100 },
      { process: "ANODIZING", okQty: 88, totalQty: 100 },
      { process: "ASSEMBLY", okQty: 91, totalQty: 100 },
    ];

    applyS90dProcessYieldMetrics(processRows);

    expect(processRows[0].yieldPct).toBe(95);
    expect(processRows[1].yieldPct).toBe(94.7);
    expect(processRows[1].cumulativeYieldPct).toBeCloseTo(90, 1);
    expect(processRows[3].cumulativeYieldPct).toBeCloseTo(81.9, 1);
  });

  it("skips empty processes when chaining cumulative yield", () => {
    const processRows = [
      { process: "PRESS", okQty: 95, totalQty: 100 },
      { process: "MC", okQty: 0, totalQty: 0 },
      { process: "HAIRLINE", okQty: 90, totalQty: 100 },
    ];

    applyS90dProcessYieldMetrics(processRows);

    expect(processRows[0].cumulativeYieldPct).toBe(95);
    expect(processRows[1].cumulativeYieldPct).toBeNull();
    expect(processRows[2].cumulativeYieldPct).toBeCloseTo(90, 1);
    expect(processRows[2].yieldPct).toBe(94.7);
  });

  it("chains straight yield through MC for AP5", () => {
    const processRows = [
      { process: "PRESS", yieldPct: 95, totalQty: 100 },
      { process: "MC", yieldPct: 94.7, totalQty: 100 },
      { process: "HAIRLINE", yieldPct: 94.7, totalQty: 100 },
      { process: "ANODIZING", yieldPct: 92.9, totalQty: 100 },
      { process: "ASSEMBLY", yieldPct: 98, totalQty: 100 },
    ];

    applyS90dCumulativeYieldPct(processRows);

    expect(processRows[0].cumulativeYieldPct).toBe(95);
    expect(processRows[1].cumulativeYieldPct).toBeCloseTo(90, 1);
    expect(processRows[2].cumulativeYieldPct).toBeCloseTo(85.2, 1);
    expect(processRows[3].cumulativeYieldPct).toBeCloseTo(79.2, 1);
    expect(processRows[4].cumulativeYieldPct).toBeCloseTo(77.6, 1);
  });

  it("uses null for empty daily rows when requested", () => {
    const processRows = [
      { process: "PRESS", yieldPct: 0, totalQty: 0 },
      { process: "HAIRLINE", yieldPct: 80, totalQty: 10 },
    ];

    applyS90dProcessYieldMetrics(processRows, { emptyAsNull: true });

    expect(processRows[0].yieldPct).toBeNull();
    expect(processRows[0].cumulativeYieldPct).toBeNull();
    expect(processRows[1].yieldPct).toBeNull();
    expect(processRows[1].cumulativeYieldPct).toBeNull();
  });

  it("chains board yields separately for Code D and Code E", () => {
    const processDetails = [
      {
        process: "PRESS",
        boardRows: [
          { codeSlot: "D", okQty: 95, totalQty: 100 },
          { codeSlot: "E", okQty: 80, totalQty: 100 },
        ],
      },
      {
        process: "HAIRLINE",
        boardRows: [
          { codeSlot: "D", okQty: 94, totalQty: 100 },
          { codeSlot: "E", okQty: 72, totalQty: 100 },
        ],
      },
      {
        process: "ANODIZING",
        boardRows: [{ codeSlot: "D", okQty: 90, totalQty: 100 }],
      },
    ];
    const processRows = [
      { process: "PRESS", okQty: 175, totalQty: 200 },
      { process: "HAIRLINE", okQty: 166, totalQty: 200 },
      { process: "ANODIZING", okQty: 90, totalQty: 100 },
    ];

    applyS90dCodeSlotYieldMetrics(
      processDetails,
      processRows,
      ["PRESS", "HAIRLINE", "ANODIZING", "ASSEMBLY"],
    );

    const pressD = processDetails[0].boardRows[0];
    const pressE = processDetails[0].boardRows[1];
    const hairlineD = processDetails[1].boardRows[0];
    const hairlineE = processDetails[1].boardRows[1];
    const anodizingD = processDetails[2].boardRows[0];

    expect(pressD.yieldPct).toBe(95);
    expect(pressE.yieldPct).toBe(80);
    expect(hairlineD.yieldPct).toBe(98.9);
    expect(hairlineE.yieldPct).toBe(90);
    expect(anodizingD.yieldPct).toBe(91);
  });

  it("chains board yields separately per AP5 product code", () => {
    const processDetails = [
      {
        process: "PRESS",
        boardRows: [
          { productCode: "AP5FF", okQty: 100, totalQty: 100 },
          { productCode: "AP5FZ", okQty: 80, totalQty: 100 },
        ],
      },
      {
        process: "MC",
        boardRows: [
          { productCode: "AP5FF", okQty: 95, totalQty: 100 },
          { productCode: "AP5FZ", okQty: 72, totalQty: 80 },
        ],
      },
      {
        process: "HAIRLINE",
        boardRows: [
          { productCode: "AP5FF", okQty: 90, totalQty: 100 },
          { productCode: "AP5FZ", okQty: 60, totalQty: 80 },
        ],
      },
    ];
    const processRows = [
      { process: "PRESS", okQty: 180, totalQty: 200 },
      { process: "MC", okQty: 167, totalQty: 180 },
      { process: "HAIRLINE", okQty: 150, totalQty: 180 },
    ];

    applyS90dProductBoardYieldMetrics(
      processDetails,
      processRows,
      ["PRESS", "MC", "HAIRLINE", "ANODIZING", "ASSEMBLY"],
      ["AP5FF", "AP5FZ", "AP5FL"],
    );

    const hairlineFf = processDetails[2].boardRows[0];
    const hairlineFz = processDetails[2].boardRows[1];

    expect(processDetails[0].boardRows[0].yieldPct).toBe(100);
    expect(processDetails[0].boardRows[1].yieldPct).toBe(80);
    expect(hairlineFf.yieldPct).toBeCloseTo(94.7, 1);
    expect(hairlineFz.yieldPct).toBeCloseTo(75, 1);
  });

  it("caps display yield at 100% when step exceeds previous stage yield", () => {
    const processRows = [
      { process: "PRESS", okQty: 80, totalQty: 100 },
      { process: "MC", okQty: 95, totalQty: 100 },
    ];

    applyS90dDisplayYieldPct(processRows);

    expect(processRows[0].yieldPct).toBe(80);
    expect(processRows[1].stepYieldPct).toBe(95);
    expect(processRows[1].yieldPct).toBe(100);
  });

  it("caps roundYieldPct at 100%", () => {
    expect(roundYieldPct(118.75)).toBe(100);
    expect(roundYieldPct(-5)).toBe(0);
  });
});
