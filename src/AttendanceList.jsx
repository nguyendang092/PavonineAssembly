import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "./UserContext";
import { db, ref, set, onValue, push, remove, update } from "./firebase";
import * as XLSX from "xlsx";

function AttendanceList() {
  const { t } = useTranslation();
  const { user } = useUser();

  // Debug: Log user state
  useEffect(() => {
    console.log("AttendanceList - User:", user);
  }, [user]);

  const [employees, setEmployees] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    id: "",
    stt: "",
    mnv: "",
    mvt: "",
    hoVaTen: "",
    gioiTinh: "YES",
    ngayThangNamSinh: "",
    maBoPhan: "",
    boPhan: "",
    gioVao: "",
    gioRa: "",
    chamCong: "",
  });

  // Load data from Firebase
  useEffect(() => {
    const empRef = ref(db, `attendance/${selectedDate}`);
    const unsubscribe = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const arr = Object.entries(data).map(([id, emp]) => ({
          id,
          ...emp,
        }));
        arr.sort((a, b) => (a.stt || 0) - (b.stt || 0));
        setEmployees(arr);
      } else {
        setEmployees([]);
      }
    });
    return () => unsubscribe();
  }, [selectedDate]);

  // Auto-hide alert after 3s
  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => {
        setAlert((a) => ({ ...a, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return employees.filter((emp) => {
      if (departmentFilter && emp.boPhan !== departmentFilter) return false;
      if (!q) return true;
      return (
        (emp.hoVaTen || "").toLowerCase().includes(q) ||
        (emp.mnv || "").toLowerCase().includes(q) ||
        (emp.boPhan || "").toLowerCase().includes(q)
      );
    });
  }, [searchTerm, employees, departmentFilter]);

  // Get unique departments
  const departments = useMemo(() => {
    const depts = new Set();
    for (const emp of employees) {
      if (emp.boPhan) depts.add(emp.boPhan);
    }
    return Array.from(depts);
  }, [employees]);

  // Filter departments based on search
  const filteredDepartments = useMemo(() => {
    if (!departmentSearchTerm.trim()) return departments;
    const search = departmentSearchTerm.toLowerCase();
    return departments.filter((dept) => dept.toLowerCase().includes(search));
  }, [departments, departmentSearchTerm]);

  // Handle form input
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Handle submit (add/update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setAlert({
        show: true,
        type: "error",
        message: "Vui lòng đăng nhập để thực hiện thao tác này",
      });
      return;
    }

    try {
      if (editing) {
        const empRef = ref(db, `attendance/${selectedDate}/${editing}`);
        await set(empRef, { ...form, id: editing });
        setAlert({
          show: true,
          type: "success",
          message: "✅ Cập nhật thành công",
        });
        setEditing(null);
      } else {
        const newRef = push(ref(db, `attendance/${selectedDate}`));
        await set(newRef, { ...form, id: newRef.key });
        setAlert({
          show: true,
          type: "success",
          message: "✅ Thêm mới thành công",
        });
      }
      setForm({
        id: "",
        stt: "",
        mnv: "",
        mvt: "",
        hoVaTen: "",
        gioiTinh: "YES",
        ngayThangNamSinh: "",
        maBoPhan: "",
        boPhan: "",
        gioVao: "",
        gioRa: "",
        chamCong: "",
      });
      setShowModal(false);
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message: "❌ Có lỗi xảy ra!",
      });
    }
  };

  // Handle edit
  const handleEdit = useCallback(
    (emp) => {
      if (!user) {
        setAlert({
          show: true,
          type: "error",
          message: "Vui lòng đăng nhập để thực hiện thao tác này",
        });
        return;
      }
      setForm({ ...emp });
      setEditing(emp.id);
      setShowModal(true);
    },
    [user]
  );

  // Handle delete
  const handleDelete = useCallback(
    async (id) => {
      if (!user) {
        setAlert({
          show: true,
          type: "error",
          message: "Vui lòng đăng nhập để thực hiện thao tác này",
        });
        return;
      }
      if (!window.confirm("Bạn có chắc muốn xóa nhân viên này?")) return;

      try {
        await remove(ref(db, `attendance/${selectedDate}/${id}`));
        setAlert({
          show: true,
          type: "success",
          message: "✅ Xóa thành công",
        });
      } catch (err) {
        setAlert({
          show: true,
          type: "error",
          message: "❌ Xóa thất bại",
        });
      }
    },
    [user, selectedDate]
  );

  // Export to Excel
  const handleExportExcel = useCallback(() => {
    try {
      // Tạo dòng tiêu đề
      const headerVi = [
        "STT",
        "MNV",
        "MVT",
        "Họ và tên",
        "Giới tính",
        "Ngày tháng năm sinh",
        "Mã BP",
        "Bộ phận",
        "Thời gian vào",
        "Thời gian ra",
      ];

      // Tạo dữ liệu
      const dataRows = filteredEmployees.map((emp, idx) => [
        idx + 1,
        emp.mnv || "",
        emp.mvt || "",
        emp.hoVaTen || "",
        emp.gioiTinh === "YES" ? "YES" : "NO",
        emp.ngayThangNamSinh || "",
        emp.maBoPhan || "",
        emp.boPhan || "",
        emp.gioVao || "",
        emp.gioRa || "",
      ]);

      // Chỉ có 1 dòng tiêu đề, sau đó là dữ liệu
      const excelData = [headerVi, ...dataRows];

      const ws = XLSX.utils.aoa_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `attendance_${dateStr}.xlsx`);
      setAlert({
        show: true,
        type: "success",
        message: "✅ Xuất Excel thành công!",
      });
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message: "❌ Xuất Excel thất bại!",
      });
    }
  }, [filteredEmployees]);

  // Parse Excel date function (defined outside to avoid recreation)
  const parseExcelDate = useCallback((value) => {
    if (!value) return "";

    // Nếu là số (Excel serial date)
    if (typeof value === "number") {
      const date = new Date((value - 25569) * 86400 * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}/${month}/${day}`;
    }

    // Nếu là string, parse và format lại
    if (typeof value === "string") {
      // Thử parse các định dạng phổ biến
      const dateFormats = [
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // dd/mm/yyyy
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // yyyy-mm-dd
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // dd-mm-yyyy
      ];

      for (const format of dateFormats) {
        const match = value.match(format);
        if (match) {
          let year, month, day;
          if (format === dateFormats[0] || format === dateFormats[2]) {
            // dd/mm/yyyy hoặc dd-mm-yyyy
            day = match[1].padStart(2, "0");
            month = match[2].padStart(2, "0");
            year = match[3];
          } else {
            // yyyy-mm-dd
            year = match[1];
            month = match[2].padStart(2, "0");
            day = match[3].padStart(2, "0");
          }
          return `${year}/${month}/${day}`;
        }
      }
    }

    return String(value);
  }, []);

  // Upload Excel to Firebase
  const handleUploadExcel = useCallback(
    (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // Tìm dòng đầu tiên có STT là số
          let startIndex = jsonData.findIndex(
            (row) =>
              typeof row[0] === "number" ||
              (!isNaN(row[0]) && row[0] !== "" && row[0] !== null)
          );
          if (startIndex === -1) {
            // Nếu không tìm thấy, bỏ qua 1 dòng tiêu đề
            startIndex = 1;
          }
          const dataRows = jsonData.slice(startIndex);

          let uploadCount = 0;
          for (const row of dataRows) {
            // Bỏ qua dòng trống hoặc dòng có STT không phải là số
            if (!row[1] && !row[2]) continue;
            if (
              typeof row[0] !== "number" &&
              (isNaN(row[0]) || row[0] === "" || row[0] === null)
            )
              continue;

            const employeeData = {
              stt: row[0] || "",
              mnv: row[1] || "",
              mvt: row[2] || "",
              hoVaTen: row[3] || "",
              gioiTinh: row[4] || "NO",
              ngayThangNamSinh: parseExcelDate(row[5]),
              maBoPhan: row[6] || "",
              boPhan: row[7] || "",
              gioVao: row[8] || "",
              gioRa: row[9] || "",
            };

            const newRef = push(ref(db, `attendance/${selectedDate}`));
            await set(newRef, employeeData);
            uploadCount++;
          }

          setAlert({
            show: true,
            type: "success",
            message: `✅ Upload thành công ${uploadCount} nhân viên!`,
          });
          e.target.value = ""; // Reset input
        } catch (err) {
          console.error(err);
          setAlert({
            show: true,
            type: "error",
            message: "❌ Upload thất bại! Kiểm tra định dạng file.",
          });
          e.target.value = "";
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [selectedDate, parseExcelDate]
  );

  return (
    <div className="min-h-screen w-full bg-[#f1f5f9] lg:pl-64">
      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 z-50 w-64 h-screen bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Sidebar Header */}
          <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700">
            <h2 className="text-lg font-bold text-white">📊 Menu</h2>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Search Box for Departments */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="🔍 Tìm bộ phận..."
                value={departmentSearchTerm}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300"
                onChange={(e) => setDepartmentSearchTerm(e.target.value)}
              />
            </div>

            <nav className="space-y-2">
              <button
                onClick={() => setDepartmentFilter("")}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  departmentFilter === ""
                    ? "bg-blue-600 text-white font-semibold"
                    : "text-gray-700 hover:bg-blue-50"
                }`}
              >
                📋 Tất cả bộ phận
              </button>
              {filteredDepartments.map((dept) => (
                <button
                  key={dept}
                  onClick={() => setDepartmentFilter(dept)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    departmentFilter === dept
                      ? "bg-blue-600 text-white font-semibold"
                      : "text-gray-700 hover:bg-blue-50"
                  }`}
                >
                  🏢 {dept}
                </button>
              ))}
            </nav>
          </div>

          {/* Stats - Always at bottom */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-t">
            <h3 className="text-sm font-bold text-gray-700 mb-2">Thống kê</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tổng:</span>
                <span className="font-bold text-blue-600">
                  {employees.length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Hiển thị:</span>
                <span className="font-bold text-green-600">
                  {filteredEmployees.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="p-4 md:p-8">
        {/* Toggle Sidebar Button (Mobile) */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition"
        >
          {sidebarOpen ? "✕" : "☰"}
        </button>
        {/* Header */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-600">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-extrabold text-[#1e293b] uppercase tracking-wide">
                  DANH SÁCH NHÂN VIÊN HIỆN DIỆN
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  List of Active Employees
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Ngày/Date: {new Date().toLocaleDateString("vi-VN")}
                </p>
              </div>
              <div className="text-right text-xs text-gray-600">
                <p className="font-semibold">CÔNG TY TNHH PAVONINE VINA</p>
                <p className="mt-1">
                  Lots VII-3, VII-2, and part of Lot VII-3, My Xuan B1 - Tien
                  Hung
                </p>
                <p>Industrial Park, Phu My Ward, Ho Chi Minh City, Vietnam</p>
              </div>
            </div>
          </div>
        </div>

        {/* Alert */}
        {alert.show && (
          <div
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded font-semibold text-sm shadow transition-all duration-300 ${
              alert.type === "success"
                ? "bg-green-100 text-green-800 border border-green-300"
                : "bg-red-100 text-red-800 border border-red-300"
            }`}
          >
            {alert.message}
          </div>
        )}

        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mb-4">
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded-md h-9 px-3 text-sm bg-white font-semibold text-blue-700 focus:ring-2 focus:ring-blue-300"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 Tìm kiếm..."
              className="w-full sm:w-48 border rounded-md h-9 px-3 text-sm focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-600 text-white rounded font-bold text-sm shadow hover:bg-emerald-700 transition"
            >
              📥 Xuất Excel
            </button>
            {user && (
              <>
                <label className="px-4 py-2 bg-orange-600 text-white rounded font-bold text-sm shadow hover:bg-orange-700 transition cursor-pointer inline-flex items-center">
                  📤 Upload Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleUploadExcel}
                    className="hidden"
                  />
                </label>
              </>
            )}
            {user && (
              <button
                onClick={() => {
                  setForm({
                    id: "",
                    stt: "",
                    mnv: "",
                    mvt: "",
                    hoVaTen: "",
                    gioiTinh: "YES",
                    ngayThangNamSinh: "",
                    maBoPhan: "",
                    boPhan: "",
                    gioVao: "",
                    gioRa: "",
                    chamCong: "",
                  });
                  setEditing(null);
                  setShowModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm shadow hover:bg-blue-700 transition"
              >
                ➕ Thêm mới
              </button>
            )}
          </div>
        </div>

        {/* Modal Add/Edit */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl relative mx-4 overflow-y-auto max-h-[90vh]">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl font-bold"
              >
                ×
              </button>
              <h2 className="text-lg font-bold mb-4 text-[#1e293b]">
                {editing ? "Cập nhật nhân viên" : "Thêm nhân viên mới"}
              </h2>
              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    STT
                  </label>
                  <input
                    type="number"
                    name="stt"
                    value={form.stt}
                    onChange={handleChange}
                    className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    MNV *
                  </label>
                  <input
                    type="text"
                    name="mnv"
                    value={form.mnv}
                    onChange={handleChange}
                    required
                    className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    MVT
                  </label>
                  <input
                    type="text"
                    name="mvt"
                    value={form.mvt}
                    onChange={handleChange}
                    className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Họ và tên *
                  </label>
                  <input
                    type="text"
                    name="hoVaTen"
                    value={form.hoVaTen}
                    onChange={handleChange}
                    required
                    className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Giới tính
                  </label>
                  <select
                    name="gioiTinh"
                    value={form.gioiTinh}
                    onChange={handleChange}
                    className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="YES">YES (Nam)</option>
                    <option value="NO">NO (Nữ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Ngày tháng năm sinh
                  </label>
                  <input
                    type="date"
                    name="ngayThangNamSinh"
                    value={form.ngayThangNamSinh}
                    onChange={handleChange}
                    className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Mã bộ phận
                  </label>
                  <input
                    type="text"
                    name="maBoPhan"
                    value={form.maBoPhan}
                    onChange={handleChange}
                    className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Bộ phận *
                  </label>
                  <input
                    type="text"
                    name="boPhan"
                    value={form.boPhan}
                    onChange={handleChange}
                    required
                    className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Giờ vào
                  </label>
                  <input
                    type="time"
                    name="gioVao"
                    value={form.gioVao}
                    onChange={handleChange}
                    className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Giờ ra
                  </label>
                  <input
                    type="time"
                    name="gioRa"
                    value={form.gioRa}
                    onChange={handleChange}
                    className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <button
                  type="submit"
                  className="sm:col-span-2 bg-blue-600 text-white py-2 rounded font-bold text-sm mt-2 hover:bg-blue-700 transition"
                >
                  {editing ? "Cập nhật" : "Thêm mới"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
          <table className="w-full border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-gradient-to-r from-blue-600 to-blue-700">
                <th className="px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  STT
                </th>
                <th className="px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  MNV
                </th>
                <th className="px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  MVT
                </th>
                <th className="px-4 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  Họ và tên
                </th>
                <th className="px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  Giới tính
                </th>
                <th className="px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  Ngày tháng năm sinh
                </th>
                <th className="px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  Mã BP
                </th>
                <th className="px-4 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  Bộ phận
                </th>
                <th className="px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  Thời gian vào
                </th>
                <th className="px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  Thời gian ra
                </th>
                {user && (
                  <th className="px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                    Hành động
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp, idx) => (
                <tr
                  key={emp.id}
                  className={`transition-colors hover:bg-blue-200 ${
                    idx % 2 === 0 ? "bg-blue-100" : "bg-white"
                  }`}
                >
                  <td className="px-3 py-3 text-sm text-center font-bold text-gray-700">
                    {emp.stt || idx + 1}
                  </td>
                  <td className="px-3 py-3 text-sm text-center font-bold text-blue-600">
                    {emp.mnv}
                  </td>
                  <td className="px-3 py-3 text-sm text-center font-semibold text-gray-700">
                    {emp.mvt}
                  </td>
                  <td className="px-4 py-3 text-sm text-center font-bold text-gray-800">
                    {emp.hoVaTen}
                  </td>
                  <td className="px-3 py-3 text-sm text-center">
                    <span
                      className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                        emp.gioiTinh === "YES"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-pink-100 text-pink-700"
                      }`}
                    >
                      {emp.gioiTinh}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm text-center font-semibold text-gray-700">
                    {emp.ngayThangNamSinh}
                  </td>
                  <td className="px-3 py-3 text-sm text-center font-bold text-gray-700">
                    {emp.maBoPhan}
                  </td>
                  <td className="px-4 py-3 text-sm text-center font-semibold text-gray-700">
                    {emp.boPhan}
                  </td>
                  <td className="px-3 py-3 text-sm text-center">
                    {emp.gioVao ? (
                      <span className="text-green-600 font-bold text-base">
                        {emp.gioVao}
                      </span>
                    ) : user ? (
                      <select
                        className="border rounded px-2 py-1 text-sm text-green-700 font-bold focus:ring-2 focus:ring-green-300"
                        defaultValue=""
                        onBlur={async (e) => {
                          const value = e.target.value;
                          if (value) {
                            const empRef = ref(
                              db,
                              `attendance/${selectedDate}/${emp.id}`
                            );
                            await set(empRef, { ...emp, gioVao: value });
                          }
                        }}
                        onChange={async (e) => {
                          const value = e.target.value;
                          if (value) {
                            const empRef = ref(
                              db,
                              `attendance/${selectedDate}/${emp.id}`
                            );
                            await set(empRef, { ...emp, gioVao: value });
                          }
                        }}
                      >
                        <option value="">Chọn loại</option>
                        <option value="PN">PN</option>
                        <option value="KL">KL</option>
                        <option value="TN">TN</option>
                        <option value="PO">PO</option>
                      </select>
                    ) : (
                      <span className="text-gray-400 italic">--</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-center">
                    <span className="text-red-600 font-bold text-base">
                      {emp.gioRa}
                    </span>
                  </td>
                  {user && (
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(emp)}
                          className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-xs font-medium hover:bg-blue-600 transition-all shadow-sm hover:shadow-md"
                          title="Chỉnh sửa"
                        >
                          ✏️ Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(emp.id)}
                          className="px-3 py-1.5 bg-red-500 text-white rounded-md text-xs font-medium hover:bg-red-600 transition-all shadow-sm hover:shadow-md"
                          title="Xóa"
                        >
                          🗑️ Xóa
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-600">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-700">
              📊 Tổng số nhân viên:
              <span className="ml-2 text-lg text-blue-600">
                {filteredEmployees.length}
              </span>
            </p>
            <p className="text-xs text-gray-500">
              Ngày: {new Date(selectedDate).toLocaleDateString("vi-VN")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AttendanceList;
