import React, { useEffect, useState } from "react";
import { db } from "../../services/firebase";
import { ref, get } from "firebase/database";
import { getDay, getDaysInMonth } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";

const COLORS = [
  "#000000",
  "#fabb00",
  "#00FF00",
  "#0000FF",
  "#ff00ee",
  "#a83279",
];

const ChartView = ({ selectedArea, selectedMonth, machines, type }) => {
  const [chartData, setChartData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const { t } = useTranslation();

  const getThreshold = () => {
    if (type === "temperature") return { min: 17, max: 28 };
    if (type === "humidity") return { min: 40, max: 75 };
    return { min: -Infinity, max: Infinity };
  };

  const threshold = getThreshold();

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      const year = parseInt(selectedMonth.split("-")[0], 10);
      const month = parseInt(selectedMonth.split("-")[1], 10) - 1;
      const daysInMonth = getDaysInMonth(new Date(year, month));
      const newAlerts = [];
      const result = {};

      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        if (getDay(dateObj) === 0) continue;
        const dayKey = d.toString().padStart(2, "0");
        result[dayKey] = { day: dayKey };
        machines.forEach((machine) => {
          result[dayKey][machine] = null;
        });
      }

      const promises = machines.map((machine) =>
        get(
          ref(
            db,
            `temperature_monitor/${selectedArea}/${machine}/${selectedMonth}/${type}`,
          ),
        ).then((snapshot) => ({
          machine,
          data: snapshot.exists() ? snapshot.val() : null,
        })),
      );

      const results = await Promise.all(promises);

      results.forEach(({ machine, data }) => {
        if (!data) return;

        Object.entries(data).forEach(([day, value]) => {
          const dayKey = day.padStart(2, "0");
          const val = parseFloat(value);
          if (result[dayKey]) {
            result[dayKey][machine] = val;
            if (val < threshold.min || val > threshold.max) {
              newAlerts.push({
                day: `${dayKey}/${selectedMonth.split("-")[1]}`,
                machine,
                value: val,
                status:
                  val < threshold.min
                    ? t("chartView.underThreshold")
                    : t("chartView.overThreshold"),
              });
            }
          }
        });
      });

      const sortedData = Object.values(result).sort(
        (a, b) => parseInt(a.day) - parseInt(b.day),
      );
      if (isMounted) {
        setChartData(sortedData);
        setAlerts(newAlerts);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
      setChartData([]);
      setAlerts([]);
    };
  }, [selectedArea, selectedMonth, machines, type, t]);

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(chartData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chart");
    const fileName = `${selectedArea}_${selectedMonth}_${type}.xlsx`;
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, fileName);
  };

  const hasWarning = alerts.length > 0;

  return (
    <div className="overflow-x-auto">
      {hasWarning && (
        <div className="mb-4 rounded bg-red-100 p-3 font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
          ⚠️{" "}
          {t("chartView.warning", {
            count: alerts.length,
            min: threshold.min,
            max: threshold.max,
          })}
        </div>
      )}

      <div className="mb-4 text-right">
        <button
          onClick={handleExportExcel}
          className="px-4 py-2 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition"
        >
          📁 {t("chartView.export")}
        </button>
      </div>

      <div
        className="mx-auto"
        style={{ maxWidth: "1200px", overflowX: "auto" }}
      >
        <LineChart
          width={1200}
          height={420}
          data={chartData}
          margin={{ top: 20, right: 50, left: 30, bottom: 40 }}
        >
          <CartesianGrid vertical={false} horizontal={false} />
          <XAxis
            dataKey="day"
            tick={{
              fill: "#000",
              fontSize: 12,
              fontFamily: "sans-serif",
              angle: -45,
              textAnchor: "end",
            }}
            tickFormatter={(day) => {
              const [, month] = selectedMonth.split("-");
              return `${String(day).padStart(2, "0")}/${month}`;
            }}
            interval={0}
          />
          <YAxis
            domain={[threshold.min - 5, threshold.max + 5]}
            unit={type === "temperature" ? "°C" : "%"}
            tick={{
              fill: "#000",
              fontSize: 12,
              fontWeight: "bold",
              fontFamily: "sans-serif",
            }}
            axisLine={{ stroke: "#999" }}
            tickLine={{ stroke: "#999" }}
          />
          <ReferenceArea
            y1={threshold.min}
            y2={threshold.max}
            fill="rgba(214,175,163,0.4)"
          />
          <Tooltip
            contentStyle={{
              fontSize: 13,
              fontFamily: "sans-serif",
              borderRadius: 6,
            }}
            formatter={(value) =>
              value !== null && value !== undefined
                ? `${value}${type === "temperature" ? "°C" : "%"}`
                : t("chartView.noData")
            }
          />
          <Legend
            verticalAlign="top"
            wrapperStyle={{ fontSize: 15, fontFamily: "sans-serif" }}
          />
          <ReferenceLine
            y={threshold.min}
            stroke="red"
            strokeDasharray="3 3"
            label={({ viewBox }) => {
              const { x, y } = viewBox;
              return (
                <text
                  x={x - 80}
                  y={y - 8}
                  fill="red"
                  fontSize={12}
                  fontWeight="bold"
                  textAnchor="start"
                >
                  {`Min (${threshold.min})`}
                </text>
              );
            }}
          />
          <ReferenceLine
            y={threshold.max}
            stroke="red"
            strokeDasharray="3 3"
            label={({ viewBox }) => {
              const { x, y } = viewBox;
              return (
                <text
                  x={x - 80}
                  y={y - 8}
                  fill="red"
                  fontSize={12}
                  fontWeight="bold"
                  textAnchor="start"
                >
                  {`Max (${threshold.max})`}
                </text>
              );
            }}
          />
          {machines.map((machine, index) => (
            <Line
              key={`line-${machine}`}
              type="monotone"
              dataKey={machine}
              name={t(`machineNames.${machine}`)}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              connectNulls
              dot={({ cx, cy, payload }) => {
                const value = payload[machine];
                if (value == null) return null;
                const out = value < threshold.min || value > threshold.max;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={out ? "red" : "white"}
                    stroke={out ? "red" : COLORS[index % COLORS.length]}
                    strokeWidth={2}
                  />
                );
              }}
            />
          ))}
        </LineChart>
      </div>

      {hasWarning && (
        <div className="mt-2">
          <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            🔍 {t("chartView.alertDetail")}
          </h3>
          <div className="overflow-auto rounded border border-slate-200 dark:border-slate-600">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200">
                <tr>
                  <th className="border border-slate-200 px-4 py-2 dark:border-slate-600">
                    {t("chartView.date")}
                  </th>
                  <th className="border border-slate-200 px-4 py-2 dark:border-slate-600">
                    {t("chartView.machine")}
                  </th>
                  <th className="border border-slate-200 px-4 py-2 dark:border-slate-600">
                    {t("chartView.value")}
                  </th>
                  <th className="border border-slate-200 px-4 py-2 dark:border-slate-600">
                    {t("chartView.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert, i) => (
                  <tr
                    key={i}
                    className="bg-white even:bg-gray-50 dark:bg-slate-900 dark:even:bg-slate-800/80"
                  >
                    <td className="border border-slate-200 px-4 py-2 text-slate-800 dark:border-slate-600 dark:text-slate-200">
                      {alert.day}
                    </td>
                    <td className="border border-slate-200 px-4 py-2 text-slate-800 dark:border-slate-600 dark:text-slate-200">
                      {t(`machineNames.${alert.machine}`)}
                    </td>
                    <td className="border border-slate-200 px-4 py-2 text-slate-800 dark:border-slate-600 dark:text-slate-200">
                      {alert.value}
                      {type === "temperature" ? "°C" : "%"}
                    </td>
                    <td className="border border-slate-200 px-4 py-2 text-red-600 dark:border-slate-600 dark:text-red-400">
                      {alert.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartView;
