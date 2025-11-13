import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { db, ref, onValue, set } from "./firebase";
import { push, remove } from "firebase/database";
import { useUser } from "./UserContext";
import * as XLSX from "xlsx";

function HonorBoard() {
  const { t } = useTranslation();
  const { user } = useUser();

  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterAward, setFilterAward] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    employeeId: "",
    department: "",
    startDate: "",
    awardType: "Ưu tú nhất",
    month: "",
    year: new Date().getFullYear().toString(),
    achievement: "",
    photo: "",
  });

  const awardTypes = ["Ưu tú nhất", "Ưu tú"];
  const departments = [
    "Assembly",
    "CNC",
    "Press",
    "Hairline",
    "Anodizing",
    "Production",
    "Accounting",
    "QC",
    "Human Resources",
    "Purchasing",
    "EHS",
    "Sales",
  ];

  // Lấy dữ liệu từ Firebase
  useEffect(() => {
    const honorRef = ref(db, "honorBoard");
    onValue(honorRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({
          id,
          ...val,
        }));
        // Sắp xếp theo năm, tháng, loại giải thưởng (Ưu tú nhất trước, Ưu tú sau)
        list.sort((a, b) => {
          if (b.year !== a.year) return b.year - a.year;
          if (b.month !== a.month) return b.month - a.month;
          // Sắp xếp theo loại giải thưởng: Ưu tú nhất (0) trước Ưu tú (1)
          const awardOrder = { "Ưu tú nhất": 0, "Ưu tú": 1 };
          const aOrder = awardOrder[a.awardType] ?? 2;
          const bOrder = awardOrder[b.awardType] ?? 2;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.name.localeCompare(b.name);
        });
        setEmployees(list);
        setFilteredEmployees(list);
      } else {
        setEmployees([]);
        setFilteredEmployees([]);
      }
    });
  }, []);

  // Lọc và tìm kiếm
  useEffect(() => {
    let result = [...employees];

    // Tìm kiếm theo tên hoặc mã NV
    if (searchTerm) {
      result = result.filter(
        (emp) =>
          emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Lọc theo tháng
    if (filterMonth) {
      result = result.filter((emp) => emp.month === filterMonth);
    }

    // Lọc theo năm
    if (filterYear) {
      result = result.filter((emp) => emp.year === filterYear);
    }

    // Lọc theo phòng ban
    if (filterDepartment) {
      result = result.filter((emp) => emp.department === filterDepartment);
    }

    // Lọc theo loại giải thưởng
    if (filterAward) {
      result = result.filter((emp) => emp.awardType === filterAward);
    }

    setFilteredEmployees(result);
  }, [
    searchTerm,
    filterMonth,
    filterYear,
    filterDepartment,
    filterAward,
    employees,
  ]);

  // Tạo timeline từ filteredEmployees (danh sách phẳng)
  const timeline = React.useMemo(() => {
    const timeMap = new Map();
    filteredEmployees.forEach((emp) => {
      const key = `${emp.year}-${emp.month}`;
      if (!timeMap.has(key)) {
        timeMap.set(key, { year: emp.year, month: emp.month, count: 0 });
      }
      timeMap.get(key).count++;
    });
    return Array.from(timeMap.values()).sort(
      (a, b) =>
        parseInt(b.year) - parseInt(a.year) ||
        parseInt(b.month) - parseInt(a.month)
    );
  }, [filteredEmployees]);

  // Xử lý thêm/sửa
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("Vui lòng đăng nhập để thực hiện thao tác này");
      return;
    }

    if (!form.name || !form.department || !form.awardType) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    try {
      if (editingId) {
        // Cập nhật
        await set(ref(db, `honorBoard/${editingId}`), form);
        alert("Cập nhật thành công!");
      } else {
        // Thêm mới
        const newRef = push(ref(db, "honorBoard"));
        await set(newRef, form);
        alert("Thêm mới thành công!");
      }
      resetForm();
    } catch (error) {
      console.error("Error:", error);
      alert("Có lỗi xảy ra: " + error.message);
    }
  };

  // Xử lý xóa
  const handleDelete = async (id) => {
    if (!user) {
      alert("Vui lòng đăng nhập để thực hiện thao tác này");
      return;
    }

    if (
      window.confirm("Bạn có chắc muốn xóa nhân viên này khỏi bảng vinh danh?")
    ) {
      try {
        await remove(ref(db, `honorBoard/${id}`));
        alert("Xóa thành công!");
      } catch (error) {
        console.error("Error:", error);
        alert("Có lỗi xảy ra: " + error.message);
      }
    }
  };

  // Xử lý sửa
  const handleEdit = (emp) => {
    if (!user) {
      alert("Vui lòng đăng nhập để thực hiện thao tác này");
      return;
    }

    setForm({
      name: emp.name || "",
      employeeId: emp.employeeId || "",
      department: emp.department || "",
      startDate: emp.startDate || "",
      awardType: emp.awardType || "Ưu tú nhất",
      month: emp.month || "",
      year: emp.year || new Date().getFullYear().toString(),
      achievement: emp.achievement || "",
      photo: emp.photo || "",
    });
    setEditingId(emp.id);
    setShowModal(true);
  };

  // Reset form
  const resetForm = () => {
    setForm({
      name: "",
      employeeId: "",
      department: "",
      startDate: "",
      awardType: "Ưu tú nhất",
      month: "",
      year: new Date().getFullYear().toString(),
      achievement: "",
      photo: "",
    });
    setEditingId(null);
    setShowModal(false);
  };

  // Xuất Excel
  const handleExportExcel = () => {
    const data = filteredEmployees.map((emp, index) => ({
      STT: index + 1,
      "Họ và tên": emp.name,
      "Mã NV": emp.employeeId,
      "Phòng ban": emp.department,
      "Ngày bắt đầu": emp.startDate,
      "Loại giải thưởng": emp.awardType,
      Tháng: emp.month,
      Năm: emp.year,
      "Lời cám ơn": emp.achievement,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bảng vinh danh");
    XLSX.writeFile(
      wb,
      `bang_vinh_danh_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  // Lấy danh sách năm từ dữ liệu
  const availableYears = [...new Set(employees.map((emp) => emp.year))].sort(
    (a, b) => b - a
  );
  const availableMonths = [...new Set(employees.map((emp) => emp.month))].sort(
    (a, b) => a - b
  );

  // Màu sắc theo loại giải thưởng
  const getAwardColor = (awardType) => {
    switch (awardType) {
      case "Ưu tú nhất":
        return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
      case "Ưu tú":
        return "bg-gradient-to-r from-blue-400 to-blue-600 text-white";
      case "Tiến bộ":
        return "bg-gradient-to-r from-green-400 to-green-600 text-white";
      case "Cống hiến":
        return "bg-gradient-to-r from-purple-400 to-purple-600 text-white";
      default:
        return "bg-gray-400 text-white";
    }
  };

  // Icon theo loại giải thưởng
  const getAwardIcon = (awardType) => {
    switch (awardType) {
      case "Ưu tú nhất":
        return "🏆";
      case "Ưu tú":
        return "🥇";
      case "Tiến bộ":
        return "📈";
      case "Cống hiến":
        return "⭐";
      default:
        return "🎖️";
    }
  };

  // Lấy đường dẫn ảnh từ mã NV
  const getEmployeePhoto = (employeeId, customPhoto) => {
    // Nếu có custom photo thì dùng custom photo
    if (customPhoto) return customPhoto;

    // Nếu không có mã NV thì return null
    if (!employeeId) return null;

    // Chuẩn hóa mã NV: thêm "NV" nếu chưa có
    const normalizedId = employeeId.startsWith("NV")
      ? employeeId
      : `NV${employeeId}`;

    // Tự động tạo đường dẫn từ mã NV - thử .png trước, fallback sang .jpg
    return `/picture/employees/${normalizedId}.png`;
  };

  // Sparkle configuration (denser)
  const sparkleStars = React.useMemo(() => {
    const chars = ["✨", "⭐", "✦", "✧", "💫"];
    const arr = [];
    for (let i = 0; i < 150; i++) {
      const top = `${Math.floor(5 + Math.random() * 90)}%`;
      const left = `${Math.floor(5 + Math.random() * 90)}%`;
      const size = Math.floor(14 + Math.random() * 14); // 14-28px
      const delay = `${(Math.random() * 6).toFixed(2)}s`;
      const char = chars[Math.floor(Math.random() * chars.length)];
      arr.push({ top, left, size, delay, char });
    }
    return arr;
  }, []);

  const glowDots = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 36; i++) {
      const top = `${Math.floor(Math.random() * 100)}%`;
      const left = `${Math.floor(Math.random() * 100)}%`;
      const size = Math.floor(4 + Math.random() * 7); // 4-10px
      const delay = `${(Math.random() * 5).toFixed(2)}s`;
      arr.push({ top, left, size, delay });
    }
    return arr;
  }, []);

  return (
    <>
      <style>{`
        @keyframes sparkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.06); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-18px) rotate(4deg); }
        }
        @keyframes twinkle {
          0% { opacity: .2; transform: scale(0.9) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(10deg); }
          100% { opacity: .2; transform: scale(0.9) rotate(0deg); }
        }
        @keyframes driftUp {
          0% { transform: translateY(20px); opacity: 0; }
          50% { opacity: .6; }
          100% { transform: translateY(-40px); opacity: 0; }
        }
        .sparkle-bg { animation: sparkle 3.2s ease-in-out infinite; }
        .float-star { animation: float 6s ease-in-out infinite; }
        .twinkle-star {
          animation: twinkle 3s ease-in-out infinite;
          text-shadow: 0 0 8px rgba(250, 204, 21, .8), 0 0 14px rgba(250, 204, 21, .5);
          filter: drop-shadow(0 0 6px rgba(250, 204, 21, .6));
        }
        .glow-dot {
          position: absolute;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,0.0) 70%);
          animation: driftUp 5s ease-in-out infinite;
          filter: blur(0.5px);
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0 sparkle-bg"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.4) 0%, transparent 50%),
                           radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.4) 0%, transparent 50%),
                           radial-gradient(circle at 40% 20%, rgba(59, 130, 246, 0.4) 0%, transparent 50%)`,
            }}
          ></div>
        </div>

        {/* Sparkle Stars */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {sparkleStars.map((s, idx) => (
            <div
              key={`star-${idx}`}
              className="absolute twinkle-star"
              style={{
                top: s.top,
                left: s.left,
                animationDelay: s.delay,
                color: "#FACC15",
                fontSize: `${s.size}px`,
              }}
            >
              {s.char}
            </div>
          ))}

          {glowDots.map((d, idx) => (
            <div
              key={`dot-${idx}`}
              className="glow-dot"
              style={{
                top: d.top,
                left: d.left,
                width: `${d.size}px`,
                height: `${d.size}px`,
                animationDelay: d.delay,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Toggle Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="fixed left-4 top-20 z-50 bg-indigo-600 text-white p-3 rounded-lg shadow-lg hover:bg-indigo-700 transition"
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>

          {/* Sidebar */}
          <div
            className={`fixed left-0 top-16 w-72 bg-white shadow-2xl h-[calc(100vh-4rem)] p-6 overflow-y-auto z-40 transition-transform duration-300 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-indigo-600 mb-2">
                🏆 Menu
              </h2>
              <p className="text-sm text-gray-500">Quản lý bảng vinh danh</p>
            </div>

            {/* Search in Sidebar */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                Tìm kiếm
              </h3>
              <input
                type="text"
                placeholder="🔍 Tên hoặc mã NV..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            {/* Actions in Sidebar */}
            <div className="mb-6 space-y-2">
              <button
                onClick={handleExportExcel}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition shadow-md text-sm"
              >
                📊 Xuất Excel
              </button>
              {user?.email === "admin@gmail.com" && (
                <>
                  <button
                    onClick={() => {
                      resetForm();
                      setShowModal(true);
                    }}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-md text-sm"
                  >
                    ➕ Thêm nhân viên
                  </button>
                </>
              )}
            </div>

            {/* Statistics in Sidebar */}
            <div className="space-y-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                Thống kê
              </h3>
              {awardTypes.map((award) => {
                const count = filteredEmployees.filter(
                  (emp) => emp.awardType === award
                ).length;
                return (
                  <div
                    key={award}
                    className={`${getAwardColor(
                      award
                    )} rounded-lg p-3 shadow-md cursor-pointer hover:scale-105 transition`}
                    onClick={() =>
                      setFilterAward(filterAward === award ? "" : award)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getAwardIcon(award)}</span>
                        <span className="text-sm font-medium">{award}</span>
                      </div>
                      <span className="text-2xl font-bold">{count}</span>
                    </div>
                    {filterAward === award && (
                      <div className="text-xs mt-1 opacity-90">✓ Đang lọc</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Filters in Sidebar */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                Bộ lọc
              </h3>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Năm
                </label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="">Tất cả</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tháng
                </label>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="">Tất cả</option>
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>
                      Tháng {month}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Phòng ban
                </label>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="">Tất cả</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear Filters */}
              {(filterYear ||
                filterMonth ||
                filterDepartment ||
                filterAward) && (
                <button
                  onClick={() => {
                    setFilterYear("");
                    setFilterMonth("");
                    setFilterDepartment("");
                    setFilterAward("");
                  }}
                  className="w-full px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition"
                >
                  🔄 Xóa bộ lọc
                </button>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div
            className={`transition-all duration-300 p-4 sm:p-6 overflow-y-auto ${
              sidebarOpen ? "ml-72" : "ml-0"
            }`}
          >
            {/* Header */}
            <div className="mb-1">
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                  🏆 Nhân Viên Ưu Tú
                </h1>
                <p className="text-sm text-gray-500">Employee of Excellence</p>
              </div>
            </div>

            {/* Employee Cards by Month */}
            <div className="space-y-8">
              {filteredEmployees.length === 0 ? (
                <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                  <div className="text-6xl mb-4">🔍</div>
                  <p className="text-gray-500 text-lg">
                    Không tìm thấy nhân viên nào
                  </p>
                </div>
              ) : (
                timeline.map((timeData) => {
                  const monthEmployees = filteredEmployees.filter(
                    (emp) =>
                      emp.year === timeData.year && emp.month === timeData.month
                  );
                  return (
                    <div key={`${timeData.year}-${timeData.month}`}>
                      {/* Month Header */}
                      <div className="mb-6 relative">
                        <div className="flex items-center gap-4">
                          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg shadow-md">
                            <span className="text-xl font-bold">
                              {String(timeData.month).padStart(2, "0")}/
                              {timeData.year}
                            </span>
                          </div>
                          <div className="flex-1 h-0.5 bg-gradient-to-r from-indigo-400 to-transparent"></div>
                        </div>
                      </div>

                      {/* Cards for this month */}
                      <div className="flex flex-wrap gap-6 justify-center mb-8">
                        {monthEmployees.map((emp) => (
                          <div
                            key={emp.id}
                            className={`bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition transform hover:-translate-y-1 w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] xl:w-[calc(25%-18px)] ${
                              emp.awardType === "Ưu tú" ? "scale-90" : ""
                            }`}
                          >
                            {/* Award Badge */}
                            <div
                              className={`${getAwardColor(
                                emp.awardType
                              )} p-3 text-center`}
                            >
                              <span className="text-2xl">
                                {getAwardIcon(emp.awardType)}
                              </span>
                              <span className="ml-2 text-2xl uppercase">
                                {emp.awardType}
                              </span>
                            </div>

                            {/* Photo with overlay frame */}
                            <div className="p-6 pb-3">
                              <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                                {(() => {
                                  const photoUrl = getEmployeePhoto(
                                    emp.employeeId,
                                    emp.photo
                                  );

                                  return photoUrl ? (
                                    <>
                                      <img
                                        src={photoUrl}
                                        alt={emp.name}
                                        className="w-32 h-32 rounded-full object-cover border-4 border-indigo-200 shadow-lg"
                                        onError={(e) => {
                                          // Thử .jpg nếu .png không tồn tại
                                          if (e.target.src.endsWith(".png")) {
                                            e.target.src = e.target.src.replace(
                                              ".png",
                                              ".jpg"
                                            );
                                          } else {
                                            // Nếu cả 2 đều không có, ẩn ảnh và hiện avatar
                                            e.target.style.display = "none";
                                            e.target.nextSibling.style.display =
                                              "flex";
                                          }
                                        }}
                                      />
                                      <div
                                        className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 items-center justify-center text-white text-4xl font-bold shadow-lg"
                                        style={{ display: "none" }}
                                      >
                                        {emp.name?.charAt(0)?.toUpperCase() ||
                                          "?"}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                                      {emp.name?.charAt(0)?.toUpperCase() ||
                                        "?"}
                                    </div>
                                  );
                                })()}
                                {/* Frame overlay from public */}
                                <img
                                  src="/picture/logo/avatar.png"
                                  alt=""
                                  aria-hidden="true"
                                  className="absolute inset-0 w-36 h-36 object-contain pointer-events-none"
                                />
                              </div>
                            </div>

                            {/* Info */}
                            <div className="px-6 pb-6">
                              <h3 className="text-3xl font-bold text-gray-800 text-center mb-2 uppercase">
                                {emp.name}
                              </h3>
                              <div className="space-y-1 text-sm text-gray-600">
                                {emp.employeeId && (
                                  <p>
                                    <span className="font-semibold">
                                      Mã NV:
                                    </span>{" "}
                                    {emp.employeeId}
                                  </p>
                                )}
                                <p>
                                  <span className="font-semibold">
                                    Phòng ban:
                                  </span>{" "}
                                  {emp.department}
                                </p>
                                {emp.startDate && (
                                  <p>
                                    <span className="font-semibold">
                                      Ngày bắt đầu:
                                    </span>{" "}
                                    {emp.startDate}
                                  </p>
                                )}
                                <p>
                                  <span className="font-semibold">
                                    Thời gian:
                                  </span>{" "}
                                  Tháng {emp.month}/{emp.year}
                                </p>
                                {emp.achievement && (
                                  <p className="mt-2 p-2 bg-gray-50 rounded text-xs italic">
                                    "{emp.achievement}"
                                  </p>
                                )}
                              </div>

                              {/* Actions */}
                              {user?.email === "admin@gmail.com" && (
                                <div className="flex gap-2 mt-4">
                                  <button
                                    onClick={() => handleEdit(emp)}
                                    className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition"
                                  >
                                    ✏️ Sửa
                                  </button>
                                  <button
                                    onClick={() => handleDelete(emp.id)}
                                    className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition"
                                  >
                                    🗑️ Xóa
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-indigo-600 text-white p-6 rounded-t-xl">
                  <h2 className="text-2xl font-bold">
                    {editingId
                      ? "✏️ Cập nhật thông tin"
                      : "➕ Thêm nhân viên mới"}
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Họ và tên <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Mã nhân viên
                      </label>
                      <input
                        type="text"
                        value={form.employeeId}
                        onChange={(e) =>
                          setForm({ ...form, employeeId: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Phòng ban <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.department}
                        onChange={(e) =>
                          setForm({ ...form, department: e.target.value })
                        }
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Chọn phòng ban</option>
                        {departments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Ngày bắt đầu
                      </label>
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) =>
                          setForm({ ...form, startDate: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Loại giải thưởng <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.awardType}
                        onChange={(e) =>
                          setForm({ ...form, awardType: e.target.value })
                        }
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        {awardTypes.map((award) => (
                          <option key={award} value={award}>
                            {getAwardIcon(award)} {award}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tháng
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={form.month}
                        onChange={(e) =>
                          setForm({ ...form, month: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Năm
                      </label>
                      <input
                        type="number"
                        min="2020"
                        max="2100"
                        value={form.year}
                        onChange={(e) =>
                          setForm({ ...form, year: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        URL hình ảnh
                      </label>
                      <input
                        type="text"
                        value={form.photo}
                        onChange={(e) =>
                          setForm({ ...form, photo: e.target.value })
                        }
                        placeholder="/picture/employees/ten-file.jpg"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Lời cám ơn
                    </label>
                    <textarea
                      value={form.achievement}
                      onChange={(e) =>
                        setForm({ ...form, achievement: e.target.value })
                      }
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Gửi lời cám ơn đến nhân viên..."
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 px-6 py-3 bg-gray-400 text-white rounded-lg font-semibold hover:bg-gray-500 transition"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
                    >
                      {editingId ? "Cập nhật" : "Thêm mới"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default HonorBoard;
