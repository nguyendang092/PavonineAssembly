// Danh sách các bộ phận thuộc sản xuất
export const PRODUCTION_DEPARTMENTS = [
  "Press",
  "MC",
  "Hairline",
  "Anodizing",
  "Assembly",
  "Deco",
  "TU",
  "Komsa",
  "OHF",
  "Flip",
  "PMF",
  "Assy-1",
];
// Danh sách các bộ phận ưu tiên hiển thị lên trước
export const PRIORITY_DEPARTMENTS = [
  "Press",
  "MC",
  "Hairline",
  "Anodizing",
  "Assembly",
  "Deco",
  "TU",
  "Komsa",
  "OHF",
  "Flip",
  "PMF",
  "Assy-1",
];
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "./UserContext";
import { db, ref, onValue } from "./firebase";

function AttendanceDashboard() {
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [globalFilter, setGlobalFilter] = useState("all"); // 'all' | 'sanxuat'
  const { t } = useTranslation();
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load attendance data
  useEffect(() => {
    setLoading(true);
    const empRef = ref(db, `attendance/${selectedDate}`);
    const unsubscribe = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const arr = Object.entries(data).map(([id, emp]) => ({
          id,
          ...emp,
        }));
        setEmployees(arr);
      } else {
        setEmployees([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedDate]);

  // Tạo filteredEmployees dựa trên globalFilter
  const filteredEmployees = useMemo(() => {
    if (globalFilter === "all") return employees;
    // Sản xuất: chỉ lấy các bộ phận thuộc PRODUCTION_DEPARTMENTS
    return employees.filter((e) => PRODUCTION_DEPARTMENTS.includes(e.boPhan));
  }, [employees, globalFilter]);

  // Tính toán thống kê từ filteredEmployees
  const stats = useMemo(() => {
    const total = filteredEmployees.length;
    const present = filteredEmployees.filter(
      (e) => e.gioVao && e.gioVao !== ""
    ).length;
    const absent = total - present;
    const presentRate = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

    // Statistics by department (chuẩn hóa tên bộ phận)
    const byDepartment = {};
    filteredEmployees.forEach((emp) => {
      let dept = emp.boPhan || "Chưa phân bộ phận";
      dept = String(dept).trim(); // loại bỏ dấu cách đầu/cuối
      if (!byDepartment[dept]) {
        byDepartment[dept] = { total: 0, present: 0, absent: 0 };
      }
      byDepartment[dept].total++;
      if (emp.gioVao && emp.gioVao !== "") {
        byDepartment[dept].present++;
      } else {
        byDepartment[dept].absent++;
      }
    });

    // Statistics by shift
    const byShift = {};
    filteredEmployees.forEach((emp) => {
      let shift;
      if (emp.gioVao && emp.gioVao !== "") {
        const timePattern = /^(\d{1,2}):(\d{2})$/;
        if (timePattern.test(emp.gioVao)) {
          shift = "Ca hành chính";
        } else {
          shift = emp.caLamViec || "Khác";
        }
      } else {
        shift = emp.caLamViec || "Chưa có ca";
      }
      if (!byShift[shift]) {
        byShift[shift] = 0;
      }
      byShift[shift]++;
    });

    // Statistics by gender
    const male = filteredEmployees.filter((e) => e.gioiTinh === "NO").length;
    const female = filteredEmployees.filter((e) => e.gioiTinh === "YES").length;

    // Statistics by attendance status with time grouping
    const statusCount = {};
    let onTime = 0;
    let late = 0;
    filteredEmployees.forEach((emp) => {
      const gioVao = emp.gioVao;
      if (!gioVao || gioVao === "") {
        if (!statusCount["Vắng"]) statusCount["Vắng"] = 0;
        statusCount["Vắng"]++;
        return;
      }
      const timePattern = /^(\d{1,2}):(\d{2})$/;
      const match = gioVao.match(timePattern);
      if (match) {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const totalMinutes = hours * 60 + minutes;
        const cutoffTime = 7 * 60 + 35;
        if (totalMinutes <= cutoffTime) {
          onTime++;
        } else {
          late++;
        }
      } else {
        if (!statusCount[gioVao]) statusCount[gioVao] = 0;
        statusCount[gioVao]++;
      }
    });
    if (onTime > 0) statusCount["Đúng giờ (≤07:35)"] = onTime;
    if (late > 0) statusCount["Trễ giờ (>07:35)"] = late;

    return {
      total,
      present,
      absent,
      presentRate,
      byDepartment,
      byShift,
      male,
      female,
      statusCount,
    };
  }, [filteredEmployees]);

  // Derived helpers for UI rendering
  const genderTotal = stats.male + stats.female;
  const shiftEntries = Object.entries(stats.byShift || {});
  const maxShiftCount =
    shiftEntries.length > 0
      ? Math.max(...shiftEntries.map(([, count]) => count))
      : 1;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <p className="text-gray-600">Vui lòng đăng nhập để xem dashboard</p>

          {/* Bộ lọc tổng/production */}
          <div className="flex gap-2 mt-4">
            <button
              className={`px-4 py-2 rounded-full font-semibold border transition-all duration-200 ${
                globalFilter === "all"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-blue-700 border-blue-300 hover:bg-blue-50"
              }`}
              onClick={() => setGlobalFilter("all")}
            >
              Tổng tất cả
            </button>
            <button
              className={`px-4 py-2 rounded-full font-semibold border transition-all duration-200 ${
                globalFilter === "sanxuat"
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-green-700 border-green-300 hover:bg-green-50"
              }`}
              onClick={() => setGlobalFilter("sanxuat")}
            >
              Sản xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                📊 Dashboard Báo Cáo Điểm Danh
              </h1>
              <p className="text-gray-600">
                Tổng quan thống kê chấm công theo ngày
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-700">
                Ngày:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          {/* Bộ lọc tổng/production đặt ngay dưới tiêu đề */}
          <div className="flex gap-2 mt-4">
            <button
              className={`px-4 py-2 rounded-full font-semibold border transition-all duration-200 ${
                globalFilter === "all"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-blue-700 border-blue-300 hover:bg-blue-50"
              }`}
              onClick={() => setGlobalFilter("all")}
            >
              Tổng tất cả
            </button>
            <button
              className={`px-4 py-2 rounded-full font-semibold border transition-all duration-200 ${
                globalFilter === "sanxuat"
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-green-700 border-green-300 hover:bg-green-50"
              }`}
              onClick={() => setGlobalFilter("sanxuat")}
            >
              Sản xuất
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
          </div>
        ) : (
          <>
            {/* Overall Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* Total Card */}
              <div className="group relative bg-gradient-to-br from-gray-50 to-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border-2 border-gray-200 hover:border-gray-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-200 to-transparent rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-300"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                      <span className="text-4xl">👥</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Tổng số
                      </p>
                      <p className="text-4xl font-bold text-gray-800 group-hover:scale-110 transition-transform">
                        {stats.total}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-600">
                      Tổng nhân viên hôm nay
                    </p>
                  </div>
                </div>
              </div>

              {/* Present Card */}
              <div className="group relative bg-gradient-to-br from-green-50 to-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border-2 border-green-200 hover:border-green-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-200 to-transparent rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-300"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                      <span className="text-4xl">✅</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">
                        Có mặt
                      </p>
                      <p className="text-4xl font-bold text-green-600 group-hover:scale-110 transition-transform">
                        {stats.present}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-green-200">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600">Đã điểm danh</p>
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                        {stats.total > 0
                          ? ((stats.present / stats.total) * 100).toFixed(0)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Absent Card */}
              <div className="group relative bg-gradient-to-br from-red-50 to-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border-2 border-red-200 hover:border-red-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-200 to-transparent rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-300"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                      <span className="text-4xl">❌</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">
                        Vắng mặt
                      </p>
                      <p className="text-4xl font-bold text-red-600 group-hover:scale-110 transition-transform">
                        {stats.absent}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-red-200">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600">Chưa điểm danh</p>
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                        {stats.total > 0
                          ? ((stats.absent / stats.total) * 100).toFixed(0)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rate Card */}
              <div className="group relative bg-gradient-to-br from-blue-50 to-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border-2 border-blue-200 hover:border-blue-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200 to-transparent rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-300"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                      <span className="text-4xl">📈</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                        Tỷ lệ
                      </p>
                      <p className="text-4xl font-bold text-blue-600 group-hover:scale-110 transition-transform">
                        {stats.presentRate}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-blue-200">
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-700"
                        style={{ width: `${stats.presentRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Gender & Shift Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Gender */}
              <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    👫 Thống kê theo giới tính
                  </h2>
                  <span className="px-3 py-1 text-xs font-bold bg-gray-100 text-gray-600 rounded-full">
                    Tổng: {genderTotal}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      label: "Nam",
                      value: stats.male,
                      color: "from-blue-500 to-blue-600",
                      bg: "bg-blue-50",
                      text: "text-blue-700",
                      icon: "👨",
                    },
                    {
                      label: "Nữ",
                      value: stats.female,
                      color: "from-pink-500 to-pink-600",
                      bg: "bg-pink-50",
                      text: "text-pink-700",
                      icon: "👩",
                    },
                  ].map((g) => {
                    const percent =
                      genderTotal > 0
                        ? ((g.value / genderTotal) * 100).toFixed(1)
                        : 0;
                    return (
                      <div
                        key={g.label}
                        className={`group relative rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 bg-white overflow-hidden`}
                      >
                        <div
                          className="absolute inset-0 opacity-60 pointer-events-none"
                          style={{
                            background:
                              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.6), transparent 45%)",
                          }}
                        ></div>
                        <div className="flex items-center justify-between mb-3 relative z-10">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${g.bg}`}
                          >
                            {g.icon}
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              {g.label}
                            </p>
                            <p className={`text-3xl font-bold ${g.text}`}>
                              {g.value}
                            </p>
                          </div>
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-600">Tỷ lệ</span>
                            <span className={`font-bold ${g.text}`}>
                              {percent}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-2 bg-gradient-to-r ${g.color} rounded-full transition-all duration-500`}
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Shift */}
              <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    🕐 Thống kê theo ca làm việc
                  </h2>
                  <span className="px-3 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-full">
                    {shiftEntries.length} ca
                  </span>
                </div>

                <div className="space-y-3">
                  {shiftEntries
                    .sort((a, b) => b[1] - a[1])
                    .map(([shift, count]) => {
                      const percentTotal =
                        stats.total > 0
                          ? ((count / stats.total) * 100).toFixed(1)
                          : 0;
                      const width =
                        maxShiftCount > 0 ? (count / maxShiftCount) * 100 : 0;
                      return (
                        <div
                          key={shift}
                          className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-800">
                                {shift}
                              </span>
                              <span className="px-2 py-0.5 text-[11px] font-bold bg-gray-100 text-gray-600 rounded-full">
                                {count} người
                              </span>
                            </div>
                            <span className="text-xs font-bold text-blue-600">
                              {percentTotal}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-2.5 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 rounded-full transition-all duration-500"
                              style={{ width: `${width}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Attendance Status Statistics */}
            {/* <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  📊 Dashboard TRẠNG THÁI ĐIỂM DANH
                </h2>
                <div className="text-sm text-gray-500">
                  Tổng: {stats.total} người
                </div>
              </div>

              <div className="relative bg-white rounded-xl p-6 shadow-inner">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none px-6 py-6">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="border-t border-gray-200"></div>
                  ))}
                </div>

                <div className="relative flex items-end justify-center gap-6 min-h-[350px] pt-4">
                  {Object.entries(stats.statusCount)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => {
                      const maxCount = Math.max(
                        ...Object.values(stats.statusCount)
                      );
                      const heightPercent =
                        maxCount > 0 ? (count / maxCount) * 100 : 0;
                      const percentage =
                        stats.total > 0
                          ? ((count / stats.total) * 100).toFixed(1)
                          : 0;

                      let colorClasses =
                        "from-blue-400 via-blue-500 to-blue-600";
                      let hoverClasses =
                        "hover:from-blue-500 hover:via-blue-600 hover:to-blue-700";
                      let shadowColor = "shadow-blue-200";

                      if (status.includes("Đúng giờ")) {
                        colorClasses =
                          "from-green-400 via-green-500 to-green-600";
                        hoverClasses =
                          "hover:from-green-500 hover:via-green-600 hover:to-green-700";
                        shadowColor = "shadow-green-200";
                      } else if (status.includes("Trễ giờ")) {
                        colorClasses =
                          "from-orange-400 via-orange-500 to-orange-600";
                        hoverClasses =
                          "hover:from-orange-500 hover:via-orange-600 hover:to-orange-700";
                        shadowColor = "shadow-orange-200";
                      } else if (status === "Vắng") {
                        colorClasses = "from-red-400 via-red-500 to-red-600";
                        hoverClasses =
                          "hover:from-red-500 hover:via-red-600 hover:to-red-700";
                        shadowColor = "shadow-red-200";
                      } else if (status === "CDL") {
                        colorClasses =
                          "from-purple-400 via-purple-500 to-purple-600";
                        hoverClasses =
                          "hover:from-purple-500 hover:via-purple-600 hover:to-purple-700";
                        shadowColor = "shadow-purple-200";
                      } else if (status === "PN" || status === "PN1/2") {
                        colorClasses = "from-cyan-400 via-cyan-500 to-cyan-600";
                        hoverClasses =
                          "hover:from-cyan-500 hover:via-cyan-600 hover:to-cyan-700";
                        shadowColor = "shadow-cyan-200";
                      } else if (status === "VT") {
                        colorClasses =
                          "from-yellow-400 via-yellow-500 to-yellow-600";
                        hoverClasses =
                          "hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700";
                        shadowColor = "shadow-yellow-200";
                      }

                      return (
                        <div
                          key={status}
                          className="flex flex-col items-center gap-3 group"
                        >
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-semibold whitespace-nowrap mb-2">
                            {count} người ({percentage}%)
                          </div>

                          <div className="text-xl font-bold text-gray-800 mb-1 group-hover:scale-110 transition-transform duration-200">
                            {count}
                          </div>

                          <div className="relative">
                            <div
                              className={`w-20 bg-gradient-to-t ${colorClasses} ${hoverClasses} rounded-t-xl shadow-lg ${shadowColor} transition-all duration-300 group-hover:shadow-xl group-hover:scale-105 relative overflow-hidden`}
                              style={{
                                height: `${Math.max(
                                  heightPercent * 2.5,
                                  30
                                )}px`,
                                minHeight: "30px",
                              }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white to-transparent opacity-20"></div>
                            </div>

                            <div className="w-20 h-1 bg-gray-300 rounded-b"></div>
                          </div>

                          <div className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600 group-hover:bg-gray-200 transition-colors">
                            {percentage}%
                          </div>

                          <div className="text-sm font-bold text-gray-700 text-center max-w-[100px] break-words leading-tight group-hover:text-gray-900 transition-colors">
                            {status}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-4 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-br from-green-400 to-green-600 rounded"></div>
                  <span className="text-xs text-gray-600">Đúng giờ</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-br from-orange-400 to-orange-600 rounded"></div>
                  <span className="text-xs text-gray-600">Trễ giờ</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-br from-red-400 to-red-600 rounded"></div>
                  <span className="text-xs text-gray-600">Vắng</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-br from-purple-400 to-purple-600 rounded"></div>
                  <span className="text-xs text-gray-600">CDL</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded"></div>
                  <span className="text-xs text-gray-600">Phép</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-br from-blue-400 to-blue-600 rounded"></div>
                  <span className="text-xs text-gray-600">Khác</span>
                </div>
              </div>
            </div> */}

            {/* Department Statistics */}
            <div className="bg-gradient-to-br from-black to-gray-800 rounded-xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  🏢 Biểu Đồ Theo Bộ Phận
                </h2>
                <div className="text-sm text-gray-500">
                  {Object.keys(stats.byDepartment).length} bộ phận
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(() => {
                  // Sử dụng danh sách ưu tiên từ PRIORITY_DEPARTMENTS
                  const customOrder = PRIORITY_DEPARTMENTS;
                  let entries = Object.entries(stats.byDepartment);
                  if (departmentFilter === "sanxuat") {
                    // Luôn hiển thị tất cả bộ phận thuộc PRODUCTION_DEPARTMENTS, giữ nguyên thứ tự
                    entries = PRODUCTION_DEPARTMENTS.map((dept) => [
                      dept,
                      entries.find(([d]) => d === dept)?.[1] || {
                        total: 0,
                        present: 0,
                        absent: 0,
                      },
                    ]);
                    // KHÔNG sort lại!
                  } else if (departmentFilter !== "all") {
                    entries = entries.filter(
                      ([dept]) => dept === departmentFilter
                    );
                    entries.sort((a, b) => {
                      const idxA = customOrder.indexOf(a[0]);
                      const idxB = customOrder.indexOf(b[0]);
                      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                      if (idxA !== -1) return -1;
                      if (idxB !== -1) return 1;
                      return a[0].localeCompare(b[0]);
                    });
                  } else {
                    entries.sort((a, b) => {
                      const idxA = customOrder.indexOf(a[0]);
                      const idxB = customOrder.indexOf(b[0]);
                      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                      if (idxA !== -1) return -1;
                      if (idxB !== -1) return 1;
                      return a[0].localeCompare(b[0]);
                    });
                  }
                  return entries;
                })().map(([dept, data], index) => {
                  const rate =
                    data.total > 0
                      ? ((data.present / data.total) * 100).toFixed(1)
                      : 0;
                  const maxTotal = Math.max(
                    ...Object.values(stats.byDepartment).map((d) => d.total)
                  );
                  const widthPercent =
                    maxTotal > 0 ? (data.total / maxTotal) * 100 : 0;

                  // Rotating colors for departments
                  const colors = [
                    {
                      bg: "from-blue-400 to-blue-600",
                      shadow: "shadow-blue-200",
                      text: "text-blue-700",
                    },
                    {
                      bg: "from-purple-400 to-purple-600",
                      shadow: "shadow-purple-200",
                      text: "text-purple-700",
                    },
                    {
                      bg: "from-pink-400 to-pink-600",
                      shadow: "shadow-pink-200",
                      text: "text-pink-700",
                    },
                    {
                      bg: "from-indigo-400 to-indigo-600",
                      shadow: "shadow-indigo-200",
                      text: "text-indigo-700",
                    },
                    {
                      bg: "from-cyan-400 to-cyan-600",
                      shadow: "shadow-cyan-200",
                      text: "text-cyan-700",
                    },
                    {
                      bg: "from-teal-400 to-teal-600",
                      shadow: "shadow-teal-200",
                      text: "text-teal-700",
                    },
                    {
                      bg: "from-emerald-400 to-emerald-600",
                      shadow: "shadow-emerald-200",
                      text: "text-emerald-700",
                    },
                    {
                      bg: "from-amber-400 to-amber-600",
                      shadow: "shadow-amber-200",
                      text: "text-amber-700",
                    },
                    {
                      bg: "from-orange-400 to-orange-600",
                      shadow: "shadow-orange-200",
                      text: "text-orange-700",
                    },
                    {
                      bg: "from-rose-400 to-rose-600",
                      shadow: "shadow-rose-200",
                      text: "text-rose-700",
                    },
                  ];
                  const color = colors[index % colors.length];

                  return (
                    <div
                      key={dept}
                      className="group bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100"
                    >
                      {/* Department header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-3 h-3 rounded-full bg-gradient-to-br ${color.bg} shadow-lg ${color.shadow}`}
                          ></div>
                          <h3 className="text-lg font-bold text-gray-800 group-hover:text-gray-900 transition-colors">
                            {dept}
                          </h3>
                        </div>
                        <div
                          className={`px-4 py-2 rounded-full bg-gradient-to-r ${color.bg} text-white font-bold text-sm shadow-md`}
                        >
                          {rate}%
                        </div>
                      </div>

                      {/* Stats cards */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 text-center border border-gray-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Tổng số
                          </div>
                          <div className="text-2xl font-bold text-gray-800">
                            {data.total}
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 text-center border border-green-200">
                          <div className="text-xs text-green-700 mb-1">
                            Có mặt
                          </div>
                          <div className="text-2xl font-bold text-green-600">
                            {data.present}
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 text-center border border-red-200">
                          <div className="text-xs text-red-700 mb-1">Vắng</div>
                          <div className="text-2xl font-bold text-red-600">
                            {data.absent}
                          </div>
                        </div>
                      </div>

                      {/* Progress bars */}
                      <div className="space-y-2">
                        {/* Attendance rate bar */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-gray-600">
                              Tỷ lệ có mặt
                            </span>
                            <span className="text-xs font-bold text-green-600">
                              {rate}%
                            </span>
                          </div>
                          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-700 ease-out shadow-md"
                              style={{ width: `${rate}%` }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white to-transparent opacity-30"></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Detailed breakdown */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-gray-600">
                              Có mặt:{" "}
                              <span className="font-bold text-green-600">
                                {data.present}/{data.total}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className="text-gray-600">
                              Vắng:{" "}
                              <span className="font-bold text-red-600">
                                {data.absent}/{data.total}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AttendanceDashboard;
