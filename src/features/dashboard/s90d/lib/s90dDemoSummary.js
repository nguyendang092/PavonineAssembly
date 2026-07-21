import { createEmptyDefectCounts, S90D_PROCESSES } from "./s90dDefectColumns";
import { formatS90dDailyDateLabel } from "./s90dDateUtils";
import { buildS90dProcessShiftSummary } from "./buildS90dProcessShiftSummary";
import { S90D_SHIFT_SLOTS } from "./s90dShiftSlots";

/** Dữ liệu mẫu theo bảng Excel S90D (TOTAL) — hiển thị khi Firebase chưa có dữ liệu. */
function demoRow(process, fields) {
  return {
    process,
    classification: process,
    totalQty: fields.totalQty,
    okQty: fields.okQty,
    yieldPct: fields.yieldPct,
    cumulativeYieldPct: fields.cumulativeYieldPct,
    ngQty: fields.ngQty,
    ngRatePct: fields.ngRatePct,
    defects: { ...createEmptyDefectCounts(), ...fields.defects },
    defectTotal: fields.defectTotal,
  };
}

const DEMO_PROCESS_ROWS = [
  demoRow("PRESS", {
    totalQty: 16658,
    okQty: 16639,
    yieldPct: 100,
    cumulativeYieldPct: 100,
    ngQty: 19,
    ngRatePct: 0,
    defects: { pressDefect: 6, burr: 7, scratch: 4, dent: 2 },
    defectTotal: 19,
  }),
  demoRow("HAIRLINE", {
    totalQty: 16523,
    okQty: 16232,
    yieldPct: 98,
    cumulativeYieldPct: 98,
    ngQty: 291,
    ngRatePct: 2,
    defects: {
      scratch: 120,
      dent: 45,
      hairlineDefect: 80,
      sanding: 20,
      hole: 26,
    },
    defectTotal: 291,
  }),
  demoRow("ANODIZING", {
    totalQty: 16655,
    okQty: 16277,
    yieldPct: 98,
    cumulativeYieldPct: 96,
    ngQty: 378,
    ngRatePct: 2,
    defects: {
      scratch: 180,
      stain: 70,
      color: 40,
      tape: 83,
      whiteSpot: 5,
    },
    defectTotal: 378,
  }),
  demoRow("ASSEMBLY", {
    totalQty: 16560,
    okQty: 15113,
    yieldPct: 91,
    cumulativeYieldPct: 86,
    ngQty: 1447,
    ngRatePct: 9,
    defects: {
      scratch: 599,
      dent: 302,
      color: 255,
      pressDefect: 208,
      assemblyDefect: 46,
      bending: 23,
      breakage: 14,
    },
    defectTotal: 1447,
  }),
];

function sumDemoTotalRow(processRows) {
  const total = {
    process: "TOTAL",
    classification: "TOTAL",
    isTotal: true,
    totalQty: 0,
    okQty: 0,
    yieldPct: 97,
    cumulativeYieldPct: 86,
    ngQty: 0,
    ngRatePct: 3,
    defects: createEmptyDefectCounts(),
    defectTotal: 0,
  };

  processRows.forEach((row) => {
    total.totalQty += row.totalQty;
    total.okQty += row.okQty;
    total.ngQty += row.ngQty;
    Object.keys(row.defects).forEach((key) => {
      total.defects[key] += row.defects[key] ?? 0;
    });
  });

  total.defectTotal = Object.values(total.defects).reduce((s, n) => s + n, 0);
  return total;
}

function buildDemoPercentRow(totalRow) {
  const pct = (n) =>
    totalRow.totalQty
      ? Math.round((n / totalRow.totalQty) * 1000) / 10
      : 0;
  const defects = createEmptyDefectCounts();
  Object.keys(defects).forEach((key) => {
    defects[key] = pct(totalRow.defects[key] ?? 0);
  });
  return {
    process: "PERCENT",
    classification: "",
    isPercent: true,
    totalQty: 0,
    okQty: 0,
    yieldPct: 0,
    cumulativeYieldPct: 0,
    ngQty: 0,
    ngRatePct: 0,
    defects,
    defectTotal: pct(totalRow.defectTotal),
  };
}

export function getS90dDemoProcessShiftSummary(
  process,
  dateKey = "2026-07-01",
) {
  const shiftRows = S90D_SHIFT_SLOTS.map((shiftSlot) => ({
    shiftSlot,
    process,
    classification: process,
    productCode: "S90D",
    totalQty: 0,
    okQty: 0,
    yieldPct: null,
    ngQty: 0,
    ngRatePct: null,
    defects: createEmptyDefectCounts(),
    defectTotal: 0,
  }));

  if (process === "PRESS") {
    shiftRows[0] = {
      ...shiftRows[0],
      totalQty: 1,
      okQty: 1,
      yieldPct: 100,
      ngRatePct: 0,
    };
  }

  const totalRow = {
    shiftSlot: "TOTAL",
    process,
    classification: process,
    productCode: "S90D",
    isTotal: true,
    totalQty: process === "PRESS" ? 1 : 0,
    okQty: process === "PRESS" ? 1 : 0,
    yieldPct: process === "PRESS" ? 100 : null,
    ngQty: 0,
    ngRatePct: process === "PRESS" ? 0 : null,
    defects: createEmptyDefectCounts(),
    defectTotal: 0,
  };

  return {
    process,
    dateLabel: formatS90dDailyDateLabel(dateKey),
    shiftRows,
    totalRow,
    percentRow: {
      shiftSlot: "PERCENT",
      process,
      classification: "",
      productCode: "",
      isPercent: true,
      totalQty: 0,
      okQty: 0,
      yieldPct: null,
      ngQty: 0,
      ngRatePct: null,
      defects: createEmptyDefectCounts(),
      defectTotal: 0,
    },
    hasData: process === "PRESS",
  };
}

export function getS90dDemoAllProcessShiftSummaries(dateKey) {
  return S90D_PROCESSES.map((process) =>
    getS90dDemoProcessShiftSummary(process, dateKey),
  );
}

export function buildEmptyProcessShiftSummaries(dateLabel) {
  return S90D_PROCESSES.map((process) =>
    buildS90dProcessShiftSummary({
      process,
      barData: {},
      ngData: {},
      dateLabel,
    }),
  );
}

export function getS90dDemoDailySummary(dateKey = "2026-07-01") {
  const processRows = S90D_PROCESSES.map((process, index) => ({
    process,
    classification: process,
    totalQty: 1,
    okQty: 1,
    yieldPct: 100,
    cumulativeYieldPct: index === 0 ? null : 100,
    ngQty: 0,
    ngRatePct: 0,
    defects: createEmptyDefectCounts(),
    defectTotal: 0,
  }));

  const totalRow = {
    process: "TOTAL",
    classification: "TOTAL",
    isTotal: true,
    totalQty: 4,
    okQty: 4,
    yieldPct: 100,
    cumulativeYieldPct: 100,
    ngQty: 0,
    ngRatePct: 0,
    defects: createEmptyDefectCounts(),
    defectTotal: 0,
  };

  return {
    dateKey,
    dateLabel: formatS90dDailyDateLabel(dateKey),
    processRows,
    totalRow,
    percentRow: {
      process: "PERCENT",
      classification: "",
      isPercent: true,
      totalQty: 0,
      okQty: 0,
      yieldPct: 0,
      cumulativeYieldPct: 0,
      ngQty: 0,
      ngRatePct: 0,
      defects: createEmptyDefectCounts(),
      defectTotal: 0,
    },
    hasData: true,
    isDemo: true,
  };
}

export function getS90dDemoSummary() {
  const processRows = DEMO_PROCESS_ROWS;
  const totalRow = sumDemoTotalRow(processRows);
  const percentRow = buildDemoPercentRow(totalRow);

  return {
    processRows,
    totalRow,
    percentRow,
    hasData: true,
    isDemo: true,
  };
}
