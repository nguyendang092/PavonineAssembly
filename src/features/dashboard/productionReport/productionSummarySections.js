import {
  buildCodeSlotScopedMonthDailySummaries,
  buildGrandTotalSummaryFromManual,
  buildProductScopedMonthDailySummaries,
  buildViewGroupScopedMonthDailySummaries,
} from "../s90d/lib/buildS90dFromManual";
import { filterSpecsBySummaryViewGroup } from "../s90d/lib/s90dManualEntryReportConfig";

export function pickVisibleSummarySpecs({
  typeSlotSpecs = [],
  productBoardSpecs = [],
  summaryViewGroups = [],
  activeSummaryViewGroup = "",
  usesSummaryBoardSpecs = false,
} = {}) {
  const hasViewFilter =
    summaryViewGroups.length >= 2 && Boolean(activeSummaryViewGroup);

  if (typeSlotSpecs.length >= 2) {
    if (!hasViewFilter) return typeSlotSpecs;
    const bySlot = typeSlotSpecs.filter(
      (spec) => String(spec.codeSlot ?? "") === String(activeSummaryViewGroup),
    );
    return bySlot.length ? bySlot : typeSlotSpecs;
  }

  if (productBoardSpecs.length < 2) return [];

  if (!hasViewFilter) return productBoardSpecs;

  if (usesSummaryBoardSpecs) {
    const byView = productBoardSpecs.filter(
      (spec) => String(spec.viewGroup ?? "") === String(activeSummaryViewGroup),
    );
    if (byView.length) return byView;
  }

  const allowed = filterSpecsBySummaryViewGroup(
    productBoardSpecs,
    activeSummaryViewGroup,
  );
  return allowed.length ? allowed : productBoardSpecs;
}

function buildSectionFromScopedDailies({
  productCode,
  label,
  extra,
  scopedDailies,
  manualEntryConfig,
}) {
  return {
    productCode,
    label,
    ...extra,
    monthDailySummaries: scopedDailies,
    grandTotalSummary: buildGrandTotalSummaryFromManual(
      scopedDailies,
      productCode,
      manualEntryConfig,
    ),
  };
}

/** Chỉ dựng section đang hiển thị — không scope sẵn mọi loại xem. */
export function buildVisibleProductSummarySections({
  typeSlotSpecs = [],
  productBoardSpecs = [],
  summaryViewGroups = [],
  activeSummaryViewGroup = "",
  monthDailySummaries,
  manualEntryConfig,
  enabled = true,
} = {}) {
  if (!enabled) return null;

  const usesSummaryBoardSpecs = Boolean(
    manualEntryConfig?.summaryBoardSpecs?.length,
  );
  const specs = pickVisibleSummarySpecs({
    typeSlotSpecs,
    productBoardSpecs,
    summaryViewGroups,
    activeSummaryViewGroup,
    usesSummaryBoardSpecs,
  });

  if (!specs.length) return null;

  if (typeSlotSpecs.length >= 2) {
    return specs.map((spec) =>
      buildSectionFromScopedDailies({
        productCode: spec.productCode,
        label: spec.label,
        extra: { codeSlot: spec.codeSlot },
        scopedDailies: buildCodeSlotScopedMonthDailySummaries(
          monthDailySummaries,
          spec.codeSlot,
          manualEntryConfig,
        ),
        manualEntryConfig,
      }),
    );
  }

  if (usesSummaryBoardSpecs) {
    return specs.map((spec) =>
      buildSectionFromScopedDailies({
        productCode: spec.productCode,
        label: spec.label ?? spec.productCode,
        extra: { viewGroup: spec.viewGroup },
        scopedDailies: buildViewGroupScopedMonthDailySummaries(
          monthDailySummaries,
          spec.viewGroup,
          manualEntryConfig,
        ),
        manualEntryConfig,
      }),
    );
  }

  return specs.map((spec) =>
    buildSectionFromScopedDailies({
      productCode: spec.productCode,
      label: spec.label ?? spec.productCode,
      extra: {},
      scopedDailies: buildProductScopedMonthDailySummaries(
        monthDailySummaries,
        spec.productCode,
        manualEntryConfig,
      ),
      manualEntryConfig,
    }),
  );
}
