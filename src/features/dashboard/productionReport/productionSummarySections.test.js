import { describe, expect, it } from "vitest";
import {
  AP5_BOARD_SPECS,
  AP5_SUMMARY_VIEW_GROUPS,
  S90D_SIZE_BOARD_SPECS,
  S90D_SUMMARY_VIEW_GROUPS,
  S95H_BOARD_SPECS,
  S95H_SUMMARY_VIEW_GROUPS,
} from "../s90d/lib/s90dManualEntryReportConfig";
import { pickVisibleSummarySpecs } from "./productionSummarySections";

describe("pickVisibleSummarySpecs", () => {
  it("S90D chỉ giữ board của loại xem đang chọn", () => {
    const visible = pickVisibleSummarySpecs({
      productBoardSpecs: S90D_SIZE_BOARD_SPECS,
      summaryViewGroups: S90D_SUMMARY_VIEW_GROUPS,
      activeSummaryViewGroup: "55",
      usesSummaryBoardSpecs: true,
    });
    expect(visible.map((spec) => spec.viewGroup)).toEqual(["55"]);
  });

  it("AP5 chỉ giữ một mã hàng theo loại xem", () => {
    const visible = pickVisibleSummarySpecs({
      productBoardSpecs: AP5_BOARD_SPECS,
      summaryViewGroups: AP5_SUMMARY_VIEW_GROUPS,
      activeSummaryViewGroup: "ap5fz",
    });
    expect(visible.map((spec) => spec.productCode)).toEqual(["AP5FZ"]);
  });

  it("S95H chỉ giữ board Deco khi chọn deco", () => {
    const visible = pickVisibleSummarySpecs({
      productBoardSpecs: S95H_BOARD_SPECS,
      summaryViewGroups: S95H_SUMMARY_VIEW_GROUPS,
      activeSummaryViewGroup: "deco",
    });
    expect(visible.every((spec) => spec.viewGroup === "deco")).toBe(true);
    expect(visible).toHaveLength(2);
  });
});
