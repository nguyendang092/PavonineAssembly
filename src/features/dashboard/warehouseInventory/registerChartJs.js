import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  BarController,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  PieController,
  LineElement,
  LineController,
  PointElement,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(
  ArcElement,
  BarElement,
  BarController,
  CategoryScale,
  LinearScale,
  PieController,
  LineElement,
  LineController,
  PointElement,
  Tooltip,
  Legend,
  ChartDataLabels,
);

ChartJS.defaults.plugins.datalabels = {
  ...(ChartJS.defaults.plugins.datalabels ?? {}),
  display: false,
};
