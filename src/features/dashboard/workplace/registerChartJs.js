import {
  Chart as ChartJS,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

function readBarLabelStyle(dataset) {
  const dl = dataset.datalabels ?? {};
  const font = dl.font ?? {};
  return {
    offset: dl.offset ?? -16,
    color: dl.color ?? "#111827",
    fontSize: font.size ?? 12,
    fontWeight: font.weight ?? "600",
    fontFamily: String(font.family ?? "Inter, Segoe UI, sans-serif").replace(
      /"/g,
      "",
    ),
  };
}

function drawWorkplaceBarValueLabels(chart) {
  const { ctx, chartArea } = chart;
  if (!chartArea) return;

  chart.data.datasets.forEach((dataset, datasetIndex) => {
    if (dataset.type !== "bar") return;
    if (!chart.isDatasetVisible(datasetIndex)) return;

    const meta = chart.getDatasetMeta(datasetIndex);
    const style = readBarLabelStyle(dataset);

    meta.data.forEach((element, dataIndex) => {
      if (!element || element.skip) return;
      const n = Number(dataset.data[dataIndex]);
      if (!Number.isFinite(n) || n <= 0) return;

      const { x, y } = element.getProps(["x", "y"], true);
      const labelY = y + style.offset;
      if (labelY < chartArea.top - 2) return;

      const text = n.toLocaleString();

      ctx.save();
      ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.strokeText(text, x, labelY);
      ctx.fillStyle = style.color;
      ctx.fillText(text, x, labelY);
      ctx.restore();
    });
  });
}

/** Line NG trên cột; nhãn số cột vẽ sau cùng (afterDraw) để không bị line che. */
export const workplaceComboLineOnTopPlugin = {
  id: "workplaceComboLineOnTop",
  afterDatasetsDraw(chart, _args, options) {
    if (options === false) return;
    chart.data.datasets.forEach((dataset, index) => {
      if (dataset.type !== "line") return;
      const meta = chart.getDatasetMeta(index);
      if (meta.hidden) return;
      meta.controller.draw();
    });
  },
  afterDraw(chart, _args, options) {
    if (options === false) return;
    drawWorkplaceBarValueLabels(chart);
  },
};

ChartJS.register(
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  ChartDataLabels,
  workplaceComboLineOnTopPlugin,
);
