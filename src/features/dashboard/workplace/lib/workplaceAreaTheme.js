/** Màu định danh khu vực + trạng thái NG cho dashboard sản lượng. */

const AREA_PALETTE = Object.freeze({
  PRESS: { accent: "#2563EB", bar: "rgba(28, 140, 153, 0.82)", barBorder: "#1C8C99" },
  MC: { accent: "#1C8C99", bar: "rgba(28, 140, 153, 0.82)", barBorder: "#1C8C99" },
  CNC: { accent: "#1C8C99", bar: "rgba(28, 140, 153, 0.82)", barBorder: "#1C8C99" },
  HAIRLINE: { accent: "#7C3AED", bar: "rgba(124, 58, 237, 0.78)", barBorder: "#7C3AED" },
  "Hair Line": { accent: "#7C3AED", bar: "rgba(124, 58, 237, 0.78)", barBorder: "#7C3AED" },
  ANODIZING: { accent: "#E8871E", bar: "rgba(232, 135, 30, 0.78)", barBorder: "#E8871E" },
  Anodizing: { accent: "#E8871E", bar: "rgba(232, 135, 30, 0.78)", barBorder: "#E8871E" },
  ASSEMBLY: { accent: "#059669", bar: "rgba(5, 150, 105, 0.78)", barBorder: "#059669" },
  Assembly: { accent: "#059669", bar: "rgba(5, 150, 105, 0.78)", barBorder: "#059669" },
  EXTRUCSION: { accent: "#0891B2", bar: "rgba(8, 145, 178, 0.78)", barBorder: "#0891B2" },
  GE: { accent: "#DB2777", bar: "rgba(219, 39, 119, 0.72)", barBorder: "#DB2777" },
  PURCHASING: { accent: "#64748B", bar: "rgba(100, 116, 139, 0.72)", barBorder: "#64748B" },
  WAREHOUSE: { accent: "#475569", bar: "rgba(71, 85, 105, 0.72)", barBorder: "#475569" },
});

const DEFAULT_PALETTE = Object.freeze({
  accent: "#1C8C99",
  bar: "rgba(28, 140, 153, 0.82)",
  barBorder: "#1C8C99",
});

const NG_LINE = Object.freeze({
  color: "#E8871E",
  fill: "rgba(232, 135, 30, 0.08)",
});

export function resolveWorkplaceAreaTheme(area) {
  const key = String(area ?? "").trim();
  return AREA_PALETTE[key] ?? DEFAULT_PALETTE;
}

export function resolveWorkplaceNgLineTheme() {
  return NG_LINE;
}

/** @returns {"stable"|"watch"|"warning"|"empty"} */
export function resolveWorkplaceAreaStatus(ngRatePct) {
  if (ngRatePct == null || Number.isNaN(ngRatePct)) return "empty";
  if (ngRatePct < 3) return "stable";
  if (ngRatePct <= 8) return "watch";
  return "warning";
}

export function buildWorkplaceAreaMetrics(chartData, dataMap, dayNormalTotal, dayNGTotal, formatDayLabelShort) {
  if (!chartData?.labels?.length || !chartData?.areas?.length) return {};

  const out = {};
  chartData.areas.forEach((area) => {
    const dayArr = dataMap[area];
    let totalGood = 0;
    let totalNG = 0;
    let peakGood = 0;
    let peakDay = "";

    chartData.labels.forEach((label, idx) => {
      const good = dayNormalTotal(area, dayArr, idx);
      const ng = dayNGTotal(area, dayArr, idx);
      totalGood += good;
      totalNG += ng;
      if (good > peakGood) {
        peakGood = good;
        peakDay = formatDayLabelShort(label);
      }
    });

    const total = totalGood + totalNG;
    out[area] = {
      totalGood,
      totalNG,
      peakDay,
      peakGood,
      ngRate: total > 0 ? (totalNG / total) * 100 : 0,
    };
  });

  return out;
}
