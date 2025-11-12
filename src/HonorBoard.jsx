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
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterAward, setFilterAward] = useState("");

  const [form, setForm] = useState({
    name: "",
    employeeId: "",
    department: "",
    position: "",
    awardType: "Ưu tú nhất",
    month: "",
    year: new Date().getFullYear().toString(),
    achievement: "",
    photo: "",
  });

  // Form nhập hàng loạt
  const [bulkForm, setBulkForm] = useState({
    awardType: "Ưu tú nhất",
    month: "",
    year: new Date().getFullYear().toString(),
    department: "",
    employeeList: "", // Danh sách nhân viên, mỗi dòng 1 người
  });

  const awardTypes = ["Ưu tú nhất", "Ưu tú"];
  const departments = [
    "Assembly",
    "CNC",
    "Metandeco",
    "Logistic",
    "Quality",
    "Admin",
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
      position: emp.position || "",
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
      position: "",
      awardType: "Ưu tú nhất",
      month: "",
      year: new Date().getFullYear().toString(),
      achievement: "",
      photo: "",
    });
    setEditingId(null);
    setShowModal(false);
  };

  // Reset bulk form
  const resetBulkForm = () => {
    setBulkForm({
      awardType: "Ưu tú nhất",
      month: "",
      year: new Date().getFullYear().toString(),
      department: "",
      employeeList: "",
    });
    setShowBulkModal(false);
  };

  // Xử lý submit bulk form
  const handleBulkSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("Vui lòng đăng nhập để thực hiện thao tác này");
      return;
    }

    if (!bulkForm.employeeList.trim()) {
      alert("Vui lòng nhập danh sách nhân viên");
      return;
    }

    try {
      // Parse danh sách nhân viên
      const lines = bulkForm.employeeList
        .split("\n")
        .filter((line) => line.trim());
      let successCount = 0;
      let errorCount = 0;

      for (const line of lines) {
        try {
          // Format: Tên|Mã NV|Chức vụ|Thành tích (các trường phân cách bằng |)
          const parts = line.split("|").map((p) => p.trim());

          if (parts.length < 1) continue;

          const employeeData = {
            name: parts[0] || "",
            employeeId: parts[1] || "",
            department: bulkForm.department || "",
            position: parts[2] || "",
            awardType: bulkForm.awardType,
            month: bulkForm.month,
            year: bulkForm.year,
            achievement: parts[3] || "",
            photo: "",
          };

          // Thêm vào Firebase
          const newRef = push(ref(db, "honorBoard"));
          await set(newRef, employeeData);
          successCount++;
        } catch (error) {
          console.error("Error adding employee:", line, error);
          errorCount++;
        }
      }

      alert(
        `Hoàn tất!\n✅ Thêm thành công: ${successCount}\n❌ Lỗi: ${errorCount}`
      );
      resetBulkForm();
    } catch (error) {
      console.error("Error:", error);
      alert("Có lỗi xảy ra: " + error.message);
    }
  };

  // Xuất Excel
  const handleExportExcel = () => {
    const data = filteredEmployees.map((emp, index) => ({
      STT: index + 1,
      "Họ và tên": emp.name,
      "Mã NV": emp.employeeId,
      "Phòng ban": emp.department,
      "Chức vụ": emp.position,
      "Loại giải thưởng": emp.awardType,
      Tháng: emp.month,
      Năm: emp.year,
      "Thành tích": emp.achievement,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex">
      {/* Sidebar */}
      <div className="w-72 bg-white shadow-2xl min-h-screen p-6 flex-shrink-0 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-indigo-600 mb-2">🏆 Menu</h2>
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
                ➕ Thêm 1 nhân viên
              </button>
              <button
                onClick={() => {
                  resetBulkForm();
                  setShowBulkModal(true);
                }}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition shadow-md text-sm"
              >
                📝 Thêm nhiều nhân viên
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
          {(filterYear || filterMonth || filterDepartment || filterAward) && (
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
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-indigo-600">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 flex items-center gap-3">
              🏆 Bảng Vinh Danh Nhân Viên Ưu Tú
            </h1>
            <p className="text-gray-600 mt-2">
              Ghi nhận và tôn vinh những cá nhân có thành tích xuất sắc
            </p>
          </div>
        </div>

        {/* Employee Cards */}
        <div>
          {filteredEmployees.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-gray-500 text-lg">
                Không tìm thấy nhân viên nào
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Ưu tú nhất Section */}
              {filteredEmployees.filter((emp) => emp.awardType === "Ưu tú nhất")
                .length > 0 && (
                <div>
                  <div className="flex flex-wrap gap-6 justify-center">
                    {filteredEmployees
                      .filter((emp) => emp.awardType === "Ưu tú nhất")
                      .map((emp) => (
                        <div
                          key={emp.id}
                          className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition transform hover:-translate-y-1 w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] xl:w-[calc(25%-18px)]"
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
                            <span className="ml-2 font-bold text-lg">
                              {emp.awardType}
                            </span>
                          </div>

                          {/* Photo */}
                          <div className="p-6 pb-3">
                            {emp.photo ? (
                              <img
                                src={emp.photo}
                                alt={emp.name}
                                className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-indigo-200 shadow-lg"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  e.target.nextSibling.style.display = "flex";
                                }}
                              />
                            ) : null}
                            <div
                              className="w-32 h-32 rounded-full mx-auto bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-4xl font-bold shadow-lg"
                              style={{ display: emp.photo ? "none" : "flex" }}
                            >
                              {emp.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                          </div>

                          {/* Info */}
                          <div className="px-6 pb-6">
                            <h3 className="text-xl font-bold text-gray-800 text-center mb-2">
                              {emp.name}
                            </h3>
                            <div className="space-y-1 text-sm text-gray-600">
                              {emp.employeeId && (
                                <p>
                                  <span className="font-semibold">Mã NV:</span>{" "}
                                  {emp.employeeId}
                                </p>
                              )}
                              <p>
                                <span className="font-semibold">
                                  Phòng ban:
                                </span>{" "}
                                {emp.department}
                              </p>
                              {emp.position && (
                                <p>
                                  <span className="font-semibold">
                                    Chức vụ:
                                  </span>{" "}
                                  {emp.position}
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
              )}

              {/* Ưu tú Section */}
              {filteredEmployees.filter((emp) => emp.awardType === "Ưu tú")
                .length > 0 && (
                <div>
                  <div className="flex flex-wrap gap-6 justify-center">
                    {filteredEmployees
                      .filter((emp) => emp.awardType === "Ưu tú")
                      .map((emp) => (
                        <div
                          key={emp.id}
                          className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition transform hover:-translate-y-1 w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] xl:w-[calc(25%-18px)]"
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
                            <span className="ml-2 font-bold text-lg">
                              {emp.awardType}
                            </span>
                          </div>

                          {/* Photo */}
                          <div className="p-6 pb-3">
                            {emp.photo ? (
                              <img
                                src={emp.photo}
                                alt={emp.name}
                                className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-indigo-200 shadow-lg"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  e.target.nextSibling.style.display = "flex";
                                }}
                              />
                            ) : null}
                            <div
                              className="w-32 h-32 rounded-full mx-auto bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-4xl font-bold shadow-lg"
                              style={{ display: emp.photo ? "none" : "flex" }}
                            >
                              {emp.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                          </div>

                          {/* Info */}
                          <div className="px-6 pb-6">
                            <h3 className="text-xl font-bold text-gray-800 text-center mb-2">
                              {emp.name}
                            </h3>
                            <div className="space-y-1 text-sm text-gray-600">
                              {emp.employeeId && (
                                <p>
                                  <span className="font-semibold">Mã NV:</span>{" "}
                                  {emp.employeeId}
                                </p>
                              )}
                              <p>
                                <span className="font-semibold">
                                  Phòng ban:
                                </span>{" "}
                                {emp.department}
                              </p>
                              {emp.position && (
                                <p>
                                  <span className="font-semibold">
                                    Chức vụ:
                                  </span>{" "}
                                  {emp.position}
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
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-indigo-600 text-white p-6 rounded-t-xl">
              <h2 className="text-2xl font-bold">
                {editingId ? "✏️ Cập nhật thông tin" : "➕ Thêm nhân viên mới"}
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
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                    Chức vụ
                  </label>
                  <input
                    type="text"
                    value={form.position}
                    onChange={(e) =>
                      setForm({ ...form, position: e.target.value })
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
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
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
                  Thành tích
                </label>
                <textarea
                  value={form.achievement}
                  onChange={(e) =>
                    setForm({ ...form, achievement: e.target.value })
                  }
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Mô tả ngắn về thành tích xuất sắc..."
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

      {/* Bulk Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-purple-600 text-white p-6 rounded-t-xl">
              <h2 className="text-2xl font-bold">
                📝 Thêm nhiều nhân viên ưu tú
              </h2>
              <p className="text-sm mt-1 opacity-90">
                Nhập danh sách nhân viên, mỗi dòng 1 người
              </p>
            </div>

            <form onSubmit={handleBulkSubmit} className="p-6 space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <h3 className="font-semibold text-blue-800 mb-2">
                  📋 Hướng dẫn nhập liệu:
                </h3>
                <p className="text-sm text-blue-700 mb-2">
                  Mỗi dòng nhập 1 nhân viên theo định dạng:
                </p>
                <code className="block bg-white p-2 rounded text-xs font-mono border">
                  Họ tên | Mã NV | Chức vụ | Thành tích
                </code>
                <p className="text-xs text-blue-600 mt-2">
                  <strong>Ví dụ:</strong>
                </p>
                <code className="block bg-white p-2 rounded text-xs font-mono border mt-1">
                  Nguyễn Văn A | NV001 | Nhân viên | Hoàn thành xuất sắc KPI
                  tháng 10
                  <br />
                  Trần Thị B | NV002 | Tổ trưởng | Cải tiến quy trình sản xuất
                </code>
                <p className="text-xs text-blue-600 mt-2">
                  💡 <strong>Lưu ý:</strong> Nếu không có thông tin, để trống
                  giữa các dấu |
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Loại giải thưởng <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={bulkForm.awardType}
                    onChange={(e) =>
                      setBulkForm({ ...bulkForm, awardType: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                    Phòng ban <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={bulkForm.department}
                    onChange={(e) =>
                      setBulkForm({ ...bulkForm, department: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                    Tháng
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={bulkForm.month}
                    onChange={(e) =>
                      setBulkForm({ ...bulkForm, month: e.target.value })
                    }
                    placeholder="1-12"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                    value={bulkForm.year}
                    onChange={(e) =>
                      setBulkForm({ ...bulkForm, year: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Danh sách nhân viên <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={bulkForm.employeeList}
                  onChange={(e) =>
                    setBulkForm({ ...bulkForm, employeeList: e.target.value })
                  }
                  rows="12"
                  required
                  placeholder="Họ tên | Mã NV | Chức vụ | Thành tích&#10;Nguyễn Văn A | NV001 | Nhân viên | Hoàn thành tốt nhiệm vụ&#10;Trần Thị B | NV002 | Tổ trưởng | Cải tiến quy trình"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Đã nhập:{" "}
                  {
                    bulkForm.employeeList.split("\n").filter((l) => l.trim())
                      .length
                  }{" "}
                  nhân viên
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetBulkForm}
                  className="flex-1 px-6 py-3 bg-gray-400 text-white rounded-lg font-semibold hover:bg-gray-500 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition"
                >
                  ✅ Thêm tất cả
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default HonorBoard;
