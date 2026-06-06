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

/** Vẽ lại đường line sau cột — đường NG luôn nổi trên biểu đồ cột. */
export const workplaceComboLineOnTopPlugin = {
  id: "workplaceComboLineOnTop",
  afterDatasetsDraw(chart) {
    chart.data.datasets.forEach((dataset, index) => {
      if (dataset.type !== "line") return;
      const meta = chart.getDatasetMeta(index);
      if (meta.hidden) return;
      meta.controller.draw();
    });
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
