import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const initialData = [
  { team: "PRESS", target: 58, total: 21, currentWeek: 0 },
  { team: "MC", target: 173, total: 150, currentWeek: 0 },
  { team: "H/L", target: 92, total: 6, currentWeek: 0 },
  { team: "ANOD", target: 69, total: 13, currentWeek: 0 },
  { team: "ASSY", target: 127, total: 21, currentWeek: 0 },
  { team: "QC", target: 150, total: 63, currentWeek: 0 },
  { team: "지원부서", target: 35, total: 7, currentWeek: 0 },
];

export default function PerformanceChart() {
  const [data, setData] = useState(initialData);

  // Tính số tuần hiện tại trong năm
  const getCurrentWeek = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now - startOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  };

  const currentWeekNumber = getCurrentWeek();
  const currentYear = new Date().getFullYear();

  const handleChange = (index, field, value) => {
    const updated = [...data];
    updated[index][field] = Number(value);
    setData(updated);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4 text-center">
        📊 Team Performance Input & Chart
      </h2>

      {/* Bảng nhập liệu */}
      <table className="w-full border mb-6 text-sm text-center border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">TEAM</th>
            <th className="border p-2">TARGET</th>
            <th className="border p-2">
              TOTAL (W1~W{currentWeekNumber - 1}/{currentYear})
            </th>
            <th className="border p-2">
              WEEK {currentWeekNumber}/{currentYear}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td className="border p-2 font-medium">{row.team}</td>
              <td className="border p-2">
                <input
                  type="number"
                  value={row.target}
                  onChange={(e) => handleChange(i, "target", e.target.value)}
                  className="w-20 border rounded px-2 text-center"
                />
              </td>
              <td className="border p-2">
                <input
                  type="number"
                  value={row.total}
                  onChange={(e) => handleChange(i, "total", e.target.value)}
                  className="w-20 border rounded px-2 text-center"
                />
              </td>
              <td className="border p-2">
                <input
                  type="number"
                  value={row.currentWeek}
                  onChange={(e) =>
                    handleChange(i, "currentWeek", e.target.value)
                  }
                  className="w-20 border rounded px-2 text-center"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Biểu đồ */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="team" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="target" fill="#82ca9d" name="Target" />
            <Bar dataKey="total" fill="#8884d8" name="Total (W1~W42)" />
            <Bar dataKey="currentWeek" fill="#ffc658" name="Tuần hiện tại" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
