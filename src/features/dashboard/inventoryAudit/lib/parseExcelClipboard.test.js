import { describe, expect, it } from "vitest";
import {
  isExcelGridClipboard,
  parseExcelClipboardText,
} from "./parseExcelClipboard";

describe("parseExcelClipboardText", () => {
  it("splits Excel rows and columns", () => {
    expect(parseExcelClipboardText("WH039\tA\nWH040\tB\r\n")).toEqual([
      ["WH039", "A"],
      ["WH040", "B"],
    ]);
  });

  it("detects a multi-row paste", () => {
    expect(isExcelGridClipboard("a\nb")).toBe(true);
    expect(isExcelGridClipboard("only")).toBe(false);
    expect(isExcelGridClipboard("a\tb")).toBe(true);
  });
});
