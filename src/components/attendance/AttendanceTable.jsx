import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { db, ref, onValue } from "../../services/firebase";

function AttendanceTable() {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [departmentFilter, setDepartmentFilter] = useState("");

  // Get all dates in range
  const getDatesInRange = (start, end) => {
    const dates = [];
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);

    let currentDate = new Date(startDateObj);
    while (currentDate <= endDateObj) {
      const yyyy = currentDate.getFullYear();
      const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
      const dd = String(currentDate.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  // Load attendance data from Firebase for date range
  useEffect(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      setAttendanceData([]);
      setLoading(false);
      return;
    }

    const dates = getDatesInRange(startDate, endDate);
    if (!dates.length) {
      setAttendanceData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribers = [];
    const allData = {};
    let loadedCount = 0;
    const totalDates = dates.length;

    dates.forEach((date) => {
      const attendanceRef = ref(db, `attendance/${date}`);
      const unsubscribe = onValue(
        attendanceRef,
        (snapshot) => {
          const data = snapshot.val();
          if (data && typeof data === "object") {
            allData[date] = Object.entries(data).map(([id, record]) => ({
              id: `${date}-${id}`,
              date,
              ...record,
            }));
          } else {
            allData[date] = [];
          }

          loadedCount += 1;
          if (loadedCount === totalDates) {
            const merged = Object.values(allData)
              .flat()
              .sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                if (dateA.getTime() !== dateB.getTime()) {
                  return dateA - dateB;
                }
                return (a.hoVaTen || "").localeCompare(b.hoVaTen || "");
              });

            setAttendanceData(merged);
            setLoading(false);
          }
        },
        (error) => {
          console.error("Error fetching attendance data", error);
          loadedCount += 1;
          if (loadedCount === totalDates) {
            setLoading(false);
          }
        },
      );

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [startDate, endDate]);

  const filteredData = useMemo(() => {
    return attendanceData.filter((record) => {
      const matchesDepartment =
        !departmentFilter || record.boPhan === departmentFilter;
      return matchesDepartment;
    });
  }, [attendanceData, departmentFilter]);

  // Get unique departments for filter dropdown
  const departments = useMemo(() => {
    const deptSet = new Set();
    attendanceData.forEach((record) => {
      if (record.boPhan) deptSet.add(record.boPhan);
    });
    return Array.from(deptSet).sort();
  }, [attendanceData]);

  // Format time from HH:MM:SS to HH:MM
  const formatTime = (time) => {
    if (!time) return "-";
    const parts = time.split(":");
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const handleExport = () => {
    if (!filteredData.length) return;

    const rows = filteredData.map((record, idx) => ({
      STT: idx + 1,
      Ngay: formatDate(record.date),
      "Mã nhân viên": record.mnv || "",
      "Họ & tên": record.hoVaTen || "",
      "Bộ phận": record.boPhan || "",
      "Thời gian vào": formatTime(record.gioVao),
      "Thời gian ra": formatTime(record.gioRa),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 14 },
      { wch: 26 },

      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    const fileName = `attendance_${startDate}_to_${endDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-200 uppercase tracking-wide">
              Báo cáo thời gian
            </p>
            <h1 className="text-3xl font-bold text-gray-50 mt-1">
              Bảng Chấm Công
            </h1>
            <p className="text-gray-300">
              Xem chi tiết thời gian vào - ra của nhân viên
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-2 bg-white rounded-lg shadow-sm border border-slate-200 text-sm text-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {filteredData.length} bản ghi
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition disabled:opacity-60"
              disabled={!filteredData.length}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                />
              </svg>
              Xuất Excel
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-slate-100 p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Từ ngày
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Đến ngày
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                Bộ phận
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white shadow-sm"
              >
                <option value="">Tất cả bộ phận</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center p-4 rounded-md bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-center w-10 h-10 bg-white rounded-md mr-3 shadow-sm">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-700 font-semibold uppercase tracking-wide">
                  Tổng số bản ghi
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {filteredData.length}
                </p>
              </div>
            </div>
            <div className="flex items-center p-4 rounded-md bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-center w-10 h-10 bg-white rounded-md mr-3 shadow-sm">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-700 font-semibold uppercase tracking-wide">
                  Khoảng thời gian
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {formatDate(startDate)} - {formatDate(endDate)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block h-12 w-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-600 font-medium">
                Đang tải dữ liệu...
              </p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mt-4 text-slate-500 font-medium">
                Không có dữ liệu chấm công
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-[0.08em]">
                      STT
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-[0.08em]">
                      Ngày
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-[0.08em]">
                      Mã nhân viên
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-[0.08em]">
                      Họ & tên
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-[0.08em]">
                      Bộ phận
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-[0.08em]">
                      Thời gian vào
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-[0.08em]">
                      Thời gian ra
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredData.map((record, index) => (
                    <tr
                      key={record.id}
                      className={`${index % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-emerald-50 transition-colors duration-150`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                        {formatDate(record.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                        {record.mnv || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                        {record.hoVaTen || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                        {record.boPhan || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                        {formatTime(record.gioVao)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                        {formatTime(record.gioRa)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AttendanceTable;
