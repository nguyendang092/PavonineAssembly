import { describe, expect, it } from "vitest";
import {
  compareMoneyDelta,
  formatInventoryAmount,
  formatInventoryAmountDelta,
  formatInventoryAmountParts,
  formatInventoryQty,
  formatInventoryQtyDelta,
  formatPctChange,
  formatSignedKRW,
  formatSignedQty,
  signedDeltaClass,
} from "./formatDelta";

describe("formatDelta", () => {
  it("signs qty and percent", () => {
    expect(formatSignedQty(12.5)).toMatch(/^\+/);
    expect(formatSignedQty(-3)).toMatch(/^−3/);
    expect(formatSignedQty(0)).toBe("0");
    expect(formatPctChange(10, 5)).toBe("+50%");
    expect(formatPctChange(10, -2.5)).toBe("−25%");
    expect(formatPctChange(0, 5)).toBe("");
  });

  it("marks up/down classes", () => {
    expect(signedDeltaClass(2)).toContain("up");
    expect(signedDeltaClass(-1)).toContain("down");
    expect(signedDeltaClass(0)).toContain("flat");
  });

  it("splits inventory amount parts for the won badge", () => {
    expect(formatInventoryAmountParts(0)).toBeNull();
    expect(formatInventoryAmountParts(1500.5)).toEqual({
      sign: "",
      body: "1,500.50",
    });
    expect(formatInventoryAmountParts(-12.3, { signed: true })).toEqual({
      sign: "−",
      body: "12.30",
    });
  });

  it("formats inventory pivot amounts", () => {
    expect(formatInventoryAmount(0)).toBe("—");
    expect(formatInventoryAmount(380398.53)).toBe("₩ 380,398.53");
    expect(formatInventoryAmountDelta(-437764712.54)).toMatch(
      /^−₩ 437,764,712\.54$/,
    );
    expect(formatInventoryQtyDelta(-73)).toBe("−73");
    expect(formatInventoryQtyDelta(0)).toBe("0");
    expect(formatInventoryQty(12.3456, { maxFractionDigits: 2 })).toBe("12.35");
    expect(formatInventoryQtyDelta(-1.239, { maxFractionDigits: 2 })).toBe(
      "−1.24",
    );
    expect(
      compareMoneyDelta({
        amountErpFrom: 100,
        amountErpTo: 40,
        amountActual: 9,
      }),
    ).toBe(-60);
    expect(
      compareMoneyDelta({
        amountErpFrom: 0,
        amountErpTo: 0,
        amountActual: 9,
      }),
    ).toBe(9);
  });

  it("signs KRW", () => {
    expect(formatSignedKRW(1500)).toMatch(/^\+/);
    expect(formatSignedKRW(-200)).toMatch(/^−/);
  });
});
