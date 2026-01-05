import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getISOWeek, parseISO, startOfWeek, endOfWeek, format } from "date-fns";

const ModelProductionChart = () => {
  const [rawData, setRawData] = useState([]);
  // chartData được tính toán qua useMemo bên dưới
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [filterMode, setFilterMode] = useState("current");

  // Lấy tuần hiện tại
  const currentDate = new Date();
  const currentWeek = getISOWeek(currentDate);
  const weekStart = format(
    startOfWeek(currentDate, { weekStartsOn: 1 }),
    "yyyy-MM-dd"
  );
  const weekEnd = format(
    endOfWeek(currentDate, { weekStartsOn: 1 }),
    "yyyy-MM-dd"
  );
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  const todayStr = currentDate.toLocaleDateString("vi-VN");

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);
      // Lọc bỏ dòng thiếu trường cần thiết
      const validRows = json.filter(
        (row) => row.WorkplaceName && row.ItemCode && row.Week
      );
      setRawData(validRows);
      const areaList = [...new Set(validRows.map((row) => row.WorkplaceName))];
      setAreas(areaList);
      const initialArea = areaList[0] || "";
      setSelectedArea(initialArea);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAreaChange = (e) => {
    setSelectedArea(e.target.value);
  };

  const handleFilterChange = (e) => {
    setFilterMode(e.target.value);
  };

  const handleWeekChange = (e) => {
    const weekStr = e.target.value;
    const date = new Date(weekStr + "-1");
    setSelectedWeek(getISOWeek(date));
  };

  const chartData = useMemo(() => {
    if (!selectedArea) return [];
    const filtered = rawData.filter((row) => {
      if (row.WorkplaceName !== selectedArea) return false;
      if (filterMode === "current" && parseInt(row.Week) !== selectedWeek)
        return false;
      return true;
    });
    const grouped = {};
    filtered.forEach((row) => {
      const model = row.ItemCode;
      const weekKey = `Week_${row.Week}`;
      const qty = parseInt(row.GoodProductEfficiency || 0);
      if (!model || isNaN(qty)) return;
      if (!grouped[model]) grouped[model] = { model };
      grouped[model][weekKey] = (grouped[model][weekKey] || 0) + qty;
    });
    return Object.values(grouped);
  }, [rawData, selectedArea, filterMode, selectedWeek]);

  const allWeeks = useMemo(() => {
    return Array.from(
      new Set(
        chartData.flatMap((row) =>
          Object.keys(row).filter((k) => k.startsWith("Week_"))
        )
      )
    ).sort();
  }, [chartData]);

  const colors = [
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff7f50",
    "#a28edb",
    "#f08fc0",
    "#8dd1e1",
    "#ffbb28",
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-2 text-blue-600">
        📦 Biểu đồ Sản lượng theo Khu vực & Model
      </h2>
      <p className="text-gray-500 mb-4">
        📅 Hôm nay: {todayStr} | Tuần hiện tại (Tuần {currentWeek}): {weekStart}{" "}
        ~ {weekEnd}
      </p>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          className="border p-2 rounded bg-white"
        />

        {areas.length > 0 && (
          <>
            <select
              value={selectedArea}
              onChange={handleAreaChange}
              className="border p-2 rounded bg-white"
            >
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>

            <select
              value={filterMode}
              onChange={handleFilterChange}
              className="border p-2 rounded bg-white"
            >
              <option value="current">
                📆 Tuần hiện tại (Tuần {currentWeek})
              </option>
              <option value="all">📂 Tất cả tuần</option>
            </select>

            <input
              type="week"
              onChange={handleWeekChange}
              className="border p-2 rounded"
              disabled={filterMode === "current"}
              title="Chỉ có thể chọn tuần khi chế độ là 'Tất cả tuần'"
            />
          </>
        )}
      </div>

      {chartData.length > 0 ? (
        <div>
          <p className="text-sm text-gray-600 mb-2">
            ℹ️ Đang hiển thị dữ liệu tuần {selectedWeek}
            {filterMode === "current" &&
              ` (tuần hiện tại: ${weekStart} ~ ${weekEnd})`}
          </p>
          <ResponsiveContainer width="100%" height={600}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 30, bottom: 100 }}
            >
              <XAxis
                dataKey="model"
                type="category"
                angle={-45}
                textAnchor="end"
                interval={0}
                height={80}
              />
              <YAxis type="number" />
              <Tooltip />
              <Legend />
              {allWeeks.map((week, index) => (
                <Bar
                  key={week}
                  dataKey={week}
                  stackId="a"
                  fill={colors[index % colors.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-gray-500 italic mt-4">
          Vui lòng chọn file Excel để xem biểu đồ sản lượng tuần hiện tại (Tuần{" "}
          {currentWeek}).
        </p>
      )}
    </div>
  );
};

export default ModelProductionChart;
