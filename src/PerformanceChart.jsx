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
  LabelList,
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

  // Tính phần trăm total vs target
  const calculatePercentage = (total, target) => {
    if (target === 0) return 0;
    return ((total / target) * 100).toFixed(1);
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 overflow-hidden">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-block">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-1">
              개선된 대시보드
            </h1>
            <p className="text-xs text-gray-500 tracking-wide">
              Improved Dashboard
            </p>
          </div>
        </div>

        {/* Bảng nhập liệu */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-4 border border-gray-100 flex-shrink-0">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <span>📊</span>
              <span>데이터 입력 테이블</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-slate-50">
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider border-b border-indigo-200">
                    TEAM
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-700 uppercase tracking-wider border-b border-indigo-200">
                    TARGET
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-700 uppercase tracking-wider border-b border-indigo-200">
                    TOTAL (W1~W{currentWeekNumber - 1}/{currentYear})
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-700 uppercase tracking-wider border-b border-indigo-200">
                    % TOTAL/TARGET
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-700 uppercase tracking-wider border-b border-indigo-200">
                    WEEK {currentWeekNumber}/{currentYear}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, i) => (
                  <tr
                    key={i}
                    className="hover:bg-indigo-50/50 transition-all duration-200"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800">
                        {row.team}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        value={row.target}
                        onChange={(e) =>
                          handleChange(i, "target", e.target.value)
                        }
                        className="w-16 px-2 py-1 text-center text-xs border border-gray-200 rounded focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-all outline-none font-medium text-gray-700"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        value={row.total}
                        onChange={(e) =>
                          handleChange(i, "total", e.target.value)
                        }
                        className="w-16 px-2 py-1 text-center text-xs border border-gray-200 rounded focus:border-purple-400 focus:ring-1 focus:ring-purple-200 transition-all outline-none font-medium text-gray-700"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <div
                          className={`px-2 py-1 rounded-full font-bold text-[11px] ${
                            calculatePercentage(row.total, row.target) >= 100
                              ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-sm"
                              : calculatePercentage(row.total, row.target) >= 75
                              ? "bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-sm"
                              : "bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-sm"
                          }`}
                        >
                          {calculatePercentage(row.total, row.target)}%
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        value={row.currentWeek}
                        onChange={(e) =>
                          handleChange(i, "currentWeek", e.target.value)
                        }
                        className="w-16 px-2 py-1 text-center text-xs border border-gray-200 rounded focus:border-pink-400 focus:ring-1 focus:ring-pink-200 transition-all outline-none font-medium text-gray-700"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Biểu đồ */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-pink-500 to-rose-600 px-4 py-2">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <span>📈</span>
              <span>성과 비교 차트</span>
            </h3>
          </div>

          <div className="h-96 bg-gradient-to-br from-slate-50 to-indigo-50 rounded-lg p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.map((row) => ({
                  ...row,
                  percentage: parseFloat(
                    calculatePercentage(row.total, row.target)
                  ),
                }))}
                margin={{ top: 30, right: 30, left: 20, bottom: 20 }}
                barGap={6}
                barCategoryGap={15}
              >
                <defs>
                  <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.9} />
                  </linearGradient>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.9} />
                  </linearGradient>
                  <linearGradient
                    id="colorPercentage"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0.9} />
                  </linearGradient>
                  <linearGradient id="colorWeek" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#db2777" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  strokeOpacity={0.5}
                />
                <XAxis
                  dataKey="team"
                  tick={{ fill: "#1e293b", fontSize: 12, fontWeight: 700 }}
                  axisLine={{ stroke: "#cbd5e1" }}
                />
                <YAxis
                  tick={{ fill: "#1e293b", fontSize: 12, fontWeight: 700 }}
                  axisLine={{ stroke: "#cbd5e1" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    padding: "8px",
                  }}
                  labelStyle={{
                    fontWeight: "bold",
                    color: "#1e293b",
                    marginBottom: "4px",
                    fontSize: "11px",
                  }}
                  itemStyle={{ padding: "2px 0", fontSize: "10px" }}
                />
                <Legend
                  wrapperStyle={{
                    paddingTop: "8px",
                    fontSize: "10px",
                    fontWeight: 600,
                  }}
                  iconType="circle"
                />
                <Bar
                  dataKey="target"
                  fill="url(#colorTarget)"
                  name="🎯 Target"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={50}
                >
                  <LabelList
                    dataKey="target"
                    position="top"
                    style={{
                      fill: "#059669",
                      fontWeight: "bold",
                      fontSize: 12,
                    }}
                  />
                </Bar>
                <Bar
                  dataKey="total"
                  fill="url(#colorTotal)"
                  name="📊 Total"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={50}
                >
                  <LabelList
                    dataKey="total"
                    position="top"
                    style={{
                      fill: "#4f46e5",
                      fontWeight: "bold",
                      fontSize: 12,
                    }}
                  />
                </Bar>
                <Bar
                  dataKey="percentage"
                  fill="url(#colorPercentage)"
                  name="📈 % Achievement"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={50}
                >
                  <LabelList
                    dataKey="percentage"
                    position="top"
                    formatter={(value) => `${value}%`}
                    style={{
                      fill: "#d97706",
                      fontWeight: "bold",
                      fontSize: 12,
                    }}
                  />
                </Bar>
                <Bar
                  dataKey="currentWeek"
                  fill="url(#colorWeek)"
                  name="⭐ Current Week"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={50}
                >
                  <LabelList
                    dataKey="currentWeek"
                    position="top"
                    style={{
                      fill: "#db2777",
                      fontWeight: "bold",
                      fontSize: 12,
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
