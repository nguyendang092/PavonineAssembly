import { useMemo } from "react";
import { formatKRW } from "../lib/parse";

function isDarkMode() {
  return document.documentElement.classList.contains("dark");
}

/**
 * Chart.js options ổn định reference — tránh Doughnut/Bar vẽ lại khi filter đổi nhẹ.
 */
export function useOverviewChartOptions({
  statusChart,
  whBar,
  overviewTopCodeDiffChart,
  overviewTopCodeAmountChart,
}) {
  const statusDoughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "56%",
      layout: {
        padding: { top: 4, bottom: 10, left: 4, right: 4 },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            padding: 14,
            font: { size: 11, weight: "700" },
            color: "#475569",
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const t = ctx.label ?? "";
              const v = ctx.parsed ?? 0;
              const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = sum > 0 ? ((v / sum) * 100).toFixed(1) : "0";
              return `${t}: ${v} (${pct}%)`;
            },
          },
        },
        datalabels: {
          display: (ctx) => {
            const raw = ctx.dataset.data[ctx.dataIndex];
            const n = Number(raw);
            return Number.isFinite(n) && n > 0;
          },
          backgroundColor: "rgba(255,255,255,0.96)",
          borderColor: "rgba(99,102,241,0.65)",
          borderWidth: 2,
          borderRadius: 12,
          padding: { top: 6, right: 9, bottom: 6, left: 9 },
          color: "#312e81",
          font: { size: 11, weight: "800" },
          formatter: (value, ctx) => {
            const arr = ctx.chart.data.datasets[0].data;
            const sum = arr.reduce((a, b) => Number(a) + Number(b), 0);
            const pct = sum > 0 ? Math.round((Number(value) / sum) * 100) : 0;
            return `${Number(value).toLocaleString("vi-VN")}\n${pct}%`;
          },
        },
      },
    }),
    [statusChart],
  );

  const whBarLabels = whBar?.labels;
  const whBarOptions = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, bottom: 4, left: 2, right: 188 } },
      datasets: {
        bar: { categoryPercentage: 0.78, barPercentage: 0.92 },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          titleFont: { size: 12, weight: "700" },
          bodyFont: { size: 12, weight: "600" },
          padding: 4,
          callbacks: {
            title: (items) =>
              items[0]?.label != null ? String(items[0].label) : "",
            label: (ctx) =>
              `${ctx.dataset.label ?? ""}: ${formatKRW(Number(ctx.parsed.x))}`,
          },
        },
        datalabels: {
          display: (ctx) =>
            Number.isFinite(Number(ctx.dataset.data[ctx.dataIndex])) &&
            Number(ctx.dataset.data[ctx.dataIndex]) !== 0,
          anchor: "end",
          align: "end",
          offset: 10,
          clamp: false,
          clip: false,
          textAlign: "end",
          backgroundColor: () => (isDarkMode() ? "#334155" : "#f1f5f9"),
          padding: { top: 3, right: 7, bottom: 3, left: 7 },
          color: () => (isDarkMode() ? "#f8fafc" : "#1e293b"),
          font: { size: 10, weight: "700" },
          formatter: (v) => formatKRW(Number(v)),
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { display: false, drawTicks: false },
          border: { display: false },
          ticks: {
            maxTicksLimit: 7,
            font: { size: 11, weight: "600" },
            color: "#64748b",
            callback: (v) => formatKRW(Number(v)),
          },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            font: { size: 11, weight: "600" },
            color: "#475569",
            padding: 10,
            callback: (_tickVal, idx) => {
              const label = String(whBarLabels?.[idx] ?? "");
              return label.length > 22 ? `${label.slice(0, 20)}…` : label;
            },
          },
        },
      },
    }),
    [whBarLabels],
  );

  const topCodeDiffOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 16, bottom: 8, left: 4, right: 6 } },
      plugins: {
        legend: { display: false },
        datalabels: {
          display: true,
          anchor: "end",
          align: "top",
          offset: 6,
          borderRadius: 10,
          padding: { top: 5, right: 8, bottom: 5, left: 8 },
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.55)",
          font: { size: 10, weight: "800" },
          color: "#ffffff",
          backgroundColor: (ctx) => {
            const v = Number(ctx.dataset.data[ctx.dataIndex]);
            return v >= 0 ? "rgba(29,78,216,0.94)" : "rgba(185,28,28,0.94)";
          },
          formatter: (v) =>
            Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 2 }),
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 9, weight: "700" },
            color: "#475569",
            maxRotation: 42,
            minRotation: 0,
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            font: { size: 10, weight: "600" },
            color: "#64748b",
            callback: (v) => Number(v).toLocaleString("vi-VN"),
          },
        },
      },
    }),
    [overviewTopCodeDiffChart],
  );

  const amountLabels = overviewTopCodeAmountChart?.labels;
  const topCodeAmountOptions = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, bottom: 4, left: 2, right: 188 } },
      datasets: {
        bar: { categoryPercentage: 0.78, barPercentage: 0.92 },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          titleFont: { size: 12, weight: "700" },
          bodyFont: { size: 12, weight: "600" },
          padding: 4,
          callbacks: {
            title: (items) =>
              items[0]?.label != null ? String(items[0].label) : "",
            label: (ctx) => {
              const signed = ctx.dataset.signedValues?.[ctx.dataIndex];
              const v =
                typeof signed === "number" ? signed : Number(ctx.parsed.x);
              return `${ctx.dataset.label ?? ""}: ${formatKRW(v)}`;
            },
          },
        },
        datalabels: {
          display: (ctx) =>
            Number.isFinite(Number(ctx.dataset.data[ctx.dataIndex])) &&
            Number(ctx.dataset.data[ctx.dataIndex]) !== 0,
          anchor: "end",
          align: "end",
          offset: 10,
          clamp: false,
          clip: false,
          textAlign: "end",
          borderRadius: 999,
          borderWidth: 1,
          borderColor: (ctx) => {
            const signed = ctx.dataset.signedValues?.[ctx.dataIndex];
            return signed < 0 ? "rgba(225, 29, 72, 0.85)" : "rgba(99, 102, 241, 0.85)";
          },
          backgroundColor: (ctx) => {
            const signed = ctx.dataset.signedValues?.[ctx.dataIndex];
            return signed < 0
              ? "rgba(255, 241, 242, 0.96)"
              : "rgba(238, 242, 255, 0.96)";
          },
          padding: { top: 3, right: 9, bottom: 3, left: 9 },
          color: (ctx) => {
            const signed = ctx.dataset.signedValues?.[ctx.dataIndex];
            return signed < 0 ? "#9f1239" : "#3730a3";
          },
          font: { size: 10, weight: "800" },
          formatter: (_v, ctx) => {
            const signed = ctx.dataset.signedValues?.[ctx.dataIndex];
            return formatKRW(
              Number(typeof signed === "number" ? signed : _v),
            );
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          min: 0,
          grid: { display: false, drawTicks: false },
          border: { display: false },
          ticks: {
            maxTicksLimit: 7,
            font: { size: 11, weight: "700" },
            color: "#6d28d9",
            callback: (v) => formatKRW(Number(v)),
          },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            font: { size: 11, weight: "700" },
            color: "#312e81",
            padding: 10,
            callback: (_tickVal, idx) => {
              const label = String(amountLabels?.[idx] ?? "");
              return label.length > 22 ? `${label.slice(0, 20)}…` : label;
            },
          },
        },
      },
    }),
    [amountLabels, overviewTopCodeAmountChart],
  );

  return {
    statusDoughnutOptions,
    whBarOptions,
    topCodeDiffOptions,
    topCodeAmountOptions,
  };
}
