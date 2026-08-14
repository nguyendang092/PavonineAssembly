import { describe, expect, it } from "vitest";
import {
  applyBrokenChainBoardYieldInvalidation,
  applyBrokenChainYieldInvalidation,
  isProductProcessChainComplete,
  isS90dProcessChainComplete,
} from "./s90dProcessChain";

describe("s90dProcessChain", () => {
  const processes = ["PRESS", "MC", "HAIRLINE", "ANODIZING", "ASSEMBLY"];

  it("detects incomplete chain when MC has no quantity", () => {
    const processRows = [
      { process: "PRESS", totalQty: 100, yieldPct: 95 },
      { process: "MC", totalQty: 0, yieldPct: null },
      { process: "HAIRLINE", totalQty: 90, yieldPct: 90 },
      { process: "ANODIZING", totalQty: 88, yieldPct: 88 },
      { process: "ASSEMBLY", totalQty: 85, yieldPct: 85 },
    ];

    expect(isS90dProcessChainComplete(processRows, processes)).toBe(false);

    applyBrokenChainYieldInvalidation(processRows, processes);

    expect(processRows[0].yieldPct).toBe(95);
    expect(processRows[1].yieldPct).toBeNull();
    expect(processRows[4].yieldPct).toBeNull();
    expect(processRows[4].cumulativeYieldPct).toBeNull();
  });

  it("invalidates board yields from the first missing process onward", () => {
    const processDetails = [
      {
        process: "PRESS",
        boardRows: [
          { productCode: "AP5FF", totalQty: 100, okQty: 95, yieldPct: 95 },
        ],
      },
      {
        process: "MC",
        boardRows: [
          { productCode: "AP5FF", totalQty: 0, okQty: 0, yieldPct: null },
        ],
      },
      {
        process: "ASSEMBLY",
        boardRows: [
          { productCode: "AP5FF", totalQty: 90, okQty: 81, yieldPct: 90 },
        ],
      },
    ];

    applyBrokenChainBoardYieldInvalidation(processDetails, [
      "PRESS",
      "MC",
      "ASSEMBLY",
    ]);

    expect(processDetails[0].boardRows[0].yieldPct).toBe(95);
    expect(processDetails[2].boardRows[0].yieldPct).toBeNull();
  });

  it("requires every process stage for product chain completion", () => {
    const stages = [
      { process: "PRESS", totalQty: 100 },
      { process: "MC", totalQty: 0 },
      { process: "ASSEMBLY", totalQty: 90 },
    ];

    expect(
      isProductProcessChainComplete(stages, ["PRESS", "MC", "ASSEMBLY"]),
    ).toBe(false);
  });
});
