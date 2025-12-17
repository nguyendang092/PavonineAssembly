import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "./UserContext";
import { db, ref, set, onValue, push, remove, update } from "./firebase";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import Sidebar from "./Sidebar";

function AttendanceList() {
  const { t } = useTranslation();
  const { user } = useUser();

  // Debug: Log user state
  // useEffect(() => {
  //   console.log("AttendanceList - User:", user);
  // }, [user]);

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
  const [editingGioVao, setEditingGioVao] = useState({}); // Track temporary gioVao edits
  const [filterOpen, setFilterOpen] = useState(false);
  const [mnvFilter, setMnvFilter] = useState([]); // Filter by MNV (array for multiple selection)
  const [mvtFilter, setMvtFilter] = useState([]); // Filter by MVT (array for multiple selection)
  const [gioiTinhFilter, setGioiTinhFilter] = useState([]); // Filter by gender
  const [departmentListFilter, setDepartmentListFilter] = useState([]); // Filter by department in filter section
  const [caLamViecFilter, setCaLamViecFilter] = useState([]); // Filter by shift
  const [expandedSections, setExpandedSections] = useState({}); // Track which sections are expanded
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  // Overtime modal-specific filters
  const [modalFilterOpen, setModalFilterOpen] = useState(false);
  const [modalGioiTinhFilter, setModalGioiTinhFilter] = useState([]);
  const [modalDepartmentListFilter, setModalDepartmentListFilter] = useState(
    []
  );
  const [modalExpandedSections, setModalExpandedSections] = useState({});
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
    caLamViec: "",
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
      if (mnvFilter.length > 0 && !mnvFilter.includes(emp.mnv)) return false;
      if (mvtFilter.length > 0 && !mvtFilter.includes(emp.mvt)) return false;
      if (gioiTinhFilter.length > 0 && !gioiTinhFilter.includes(emp.gioiTinh))
        return false;
      if (
        departmentListFilter.length > 0 &&
        !departmentListFilter.includes(emp.boPhan)
      )
        return false;
      if (
        caLamViecFilter.length > 0 &&
        !caLamViecFilter.includes(emp.caLamViec)
      )
        return false;
      if (!q) return true;
      return (
        (emp.hoVaTen || "").toLowerCase().includes(q) ||
        (emp.mnv || "").toLowerCase().includes(q) ||
        (emp.boPhan || "").toLowerCase().includes(q)
      );
    });
  }, [
    searchTerm,
    employees,
    departmentFilter,
    mnvFilter,
    mvtFilter,
    gioiTinhFilter,
    departmentListFilter,
    caLamViecFilter,
  ]);

  // Overtime modal: derive unique options and apply modal filters from filteredEmployees
  const modalUniqueGenders = useMemo(
    () =>
      Array.from(
        new Set(filteredEmployees.map((e) => e.gioiTinh).filter(Boolean))
      ),
    [filteredEmployees]
  );
  const modalUniqueDepartments = useMemo(
    () =>
      Array.from(
        new Set(filteredEmployees.map((e) => e.boPhan).filter(Boolean))
      ),
    [filteredEmployees]
  );
  const modalFilteredEmployees = useMemo(() => {
    return filteredEmployees.filter((emp) => {
      if (
        modalGioiTinhFilter.length > 0 &&
        !modalGioiTinhFilter.includes(emp.gioiTinh)
      )
        return false;
      if (
        modalDepartmentListFilter.length > 0 &&
        !modalDepartmentListFilter.includes(emp.boPhan)
      )
        return false;
      return true;
    });
  }, [filteredEmployees, modalGioiTinhFilter, modalDepartmentListFilter]);

  // Get unique departments (cascading filter - based on other selected filters)
  const departments = useMemo(() => {
    const depts = new Set();
    for (const emp of employees) {
      // Apply other filters except Department
      if (mnvFilter.length > 0 && !mnvFilter.includes(emp.mnv)) continue;
      if (mvtFilter.length > 0 && !mvtFilter.includes(emp.mvt)) continue;
      if (gioiTinhFilter.length > 0 && !gioiTinhFilter.includes(emp.gioiTinh))
        continue;
      if (
        caLamViecFilter.length > 0 &&
        !caLamViecFilter.includes(emp.caLamViec)
      )
        continue;
      if (emp.boPhan) depts.add(emp.boPhan);
    }
    return Array.from(depts);
  }, [employees, mnvFilter, mvtFilter, gioiTinhFilter, caLamViecFilter]);

  // Get unique MNV codes (cascading filter - based on other selected filters)
  const mnvList = useMemo(() => {
    const mnvs = new Set();
    for (const emp of employees) {
      // Apply other filters except MNV
      if (mvtFilter.length > 0 && !mvtFilter.includes(emp.mvt)) continue;
      if (gioiTinhFilter.length > 0 && !gioiTinhFilter.includes(emp.gioiTinh))
        continue;
      if (
        departmentListFilter.length > 0 &&
        !departmentListFilter.includes(emp.boPhan)
      )
        continue;
      if (
        caLamViecFilter.length > 0 &&
        !caLamViecFilter.includes(emp.caLamViec)
      )
        continue;
      if (emp.mnv) mnvs.add(emp.mnv);
    }
    return Array.from(mnvs).sort();
  }, [
    employees,
    mvtFilter,
    gioiTinhFilter,
    departmentListFilter,
    caLamViecFilter,
  ]);

  // Get unique MVT codes (cascading filter - based on other selected filters)
  const mvtList = useMemo(() => {
    const mvts = new Set();
    for (const emp of employees) {
      // Apply other filters except MVT
      if (mnvFilter.length > 0 && !mnvFilter.includes(emp.mnv)) continue;
      if (gioiTinhFilter.length > 0 && !gioiTinhFilter.includes(emp.gioiTinh))
        continue;
      if (
        departmentListFilter.length > 0 &&
        !departmentListFilter.includes(emp.boPhan)
      )
        continue;
      if (
        caLamViecFilter.length > 0 &&
        !caLamViecFilter.includes(emp.caLamViec)
      )
        continue;
      if (emp.mvt) mvts.add(emp.mvt);
    }
    return Array.from(mvts).sort();
  }, [
    employees,
    mnvFilter,
    gioiTinhFilter,
    departmentListFilter,
    caLamViecFilter,
  ]);

  // Get unique genders (cascading filter - based on other selected filters)
  const genderList = useMemo(() => {
    const genders = new Set();
    for (const emp of employees) {
      // Apply other filters except Gender
      if (mnvFilter.length > 0 && !mnvFilter.includes(emp.mnv)) continue;
      if (mvtFilter.length > 0 && !mvtFilter.includes(emp.mvt)) continue;
      if (
        departmentListFilter.length > 0 &&
        !departmentListFilter.includes(emp.boPhan)
      )
        continue;
      if (
        caLamViecFilter.length > 0 &&
        !caLamViecFilter.includes(emp.caLamViec)
      )
        continue;
      if (emp.gioiTinh) genders.add(emp.gioiTinh);
    }
    return Array.from(genders).sort();
  }, [employees, mnvFilter, mvtFilter, departmentListFilter, caLamViecFilter]);

  // Get unique shifts (cascading filter - based on other selected filters)
  const shiftList = useMemo(() => {
    const shifts = new Set();
    for (const emp of employees) {
      // Apply other filters except Shift
      if (mnvFilter.length > 0 && !mnvFilter.includes(emp.mnv)) continue;
      if (mvtFilter.length > 0 && !mvtFilter.includes(emp.mvt)) continue;
      if (gioiTinhFilter.length > 0 && !gioiTinhFilter.includes(emp.gioiTinh))
        continue;
      if (
        departmentListFilter.length > 0 &&
        !departmentListFilter.includes(emp.boPhan)
      )
        continue;
      if (emp.caLamViec) shifts.add(emp.caLamViec);
    }
    return Array.from(shifts).sort();
  }, [employees, mnvFilter, mvtFilter, gioiTinhFilter, departmentListFilter]);

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
        caLamViec: "",
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
  const handleExportExcel = useCallback(async () => {
    try {
      {
        modalFilterOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-slideUp border border-gray-100">
              {/* Header */}
              <div className="p-5 border-b-2 border-blue-100 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 relative overflow-hidden">
                <div className="absolute inset-0 bg-white opacity-10"></div>
                <div className="relative z-10">
                  <h3 className="font-bold text-white text-xl flex items-center gap-2">
                    <span className="text-2xl">🔍</span>
                    Bộ lọc nâng cao
                  </h3>
                  <p className="text-xs text-blue-50 mt-1.5 font-medium">
                    Chọn điều kiện lọc • Áp dụng cho danh sách trong modal
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {/* Department Filter */}
                <div className="mb-1">
                  <button
                    onClick={() => {
                      setModalExpandedSections((prev) => ({
                        ...prev,
                        dept: !prev.dept,
                      }));
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-blue-200"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-blue-500 text-base">🏢</span>
                      <span>Bộ phận</span>
                    </span>
                    <span className="text-blue-600 font-bold">
                      {modalExpandedSections.dept ? "▼" : "▶"}
                    </span>
                  </button>
                  {modalExpandedSections.dept && (
                    <div className="border-2 border-blue-100 rounded-lg mt-2 max-h-40 overflow-y-auto bg-gradient-to-b from-white to-blue-50/30 shadow-inner">
                      {modalUniqueDepartments.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500 italic flex items-center gap-2">
                          <span className="animate-spin">⏳</span>
                          Không có dữ liệu
                        </div>
                      ) : (
                        modalUniqueDepartments.map((dept) => (
                          <label
                            key={dept || "dept-empty"}
                            className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                          >
                            <input
                              type="checkbox"
                              checked={modalDepartmentListFilter.includes(dept)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setModalDepartmentListFilter([
                                    ...modalDepartmentListFilter,
                                    dept,
                                  ]);
                                } else {
                                  setModalDepartmentListFilter(
                                    modalDepartmentListFilter.filter(
                                      (d) => d !== dept
                                    )
                                  );
                                }
                              }}
                              className="mr-2 w-4 h-4 cursor-pointer"
                            />
                            {dept || "(Không rõ)"}
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Gender Filter */}
                <div className="mb-1">
                  <button
                    onClick={() => {
                      setModalExpandedSections((prev) => ({
                        ...prev,
                        gender: !prev.gender,
                      }));
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-50 to-teal-50 hover:from-green-100 hover:to-teal-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-green-200"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-green-500 text-base">⚧️</span>
                      <span>Giới tính</span>
                    </span>
                    <span className="text-green-600 font-bold">
                      {modalExpandedSections.gender ? "▼" : "▶"}
                    </span>
                  </button>
                  {modalExpandedSections.gender && (
                    <div className="border-2 border-green-100 rounded-lg mt-2 max-h-40 overflow-y-auto bg-gradient-to-b from-white to-green-50/30 shadow-inner">
                      {modalUniqueGenders.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500 italic flex items-center gap-2">
                          <span className="animate-spin">⏳</span>
                          Không có dữ liệu
                        </div>
                      ) : (
                        modalUniqueGenders.map((gender) => (
                          <label
                            key={gender || "gender-empty"}
                            className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                          >
                            <input
                              type="checkbox"
                              checked={modalGioiTinhFilter.includes(gender)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setModalGioiTinhFilter([
                                    ...modalGioiTinhFilter,
                                    gender,
                                  ]);
                                } else {
                                  setModalGioiTinhFilter(
                                    modalGioiTinhFilter.filter(
                                      (g) => g !== gender
                                    )
                                  );
                                }
                              }}
                              className="mr-2 w-4 h-4 cursor-pointer"
                            />
                            {gender || "(Không rõ)"}
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => {
                    setModalGioiTinhFilter([]);
                    setModalDepartmentListFilter([]);
                  }}
                  className="px-3 py-2 text-xs rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                >
                  Xóa bộ lọc
                </button>
                <button
                  onClick={() => setModalFilterOpen(false)}
                  className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      }
      worksheet.mergeCells("E6:I6");
      const countCell = worksheet.getCell("E6");
      countCell.value = "Số lượng cơm ca trưa:";
      countCell.font = { size: 10, color: { argb: "FFFF0000" }, italic: true };
      countCell.alignment = { vertical: "middle", horizontal: "left" };
      countCell.border = {
        top: { style: "thin", color: { argb: "FFFFFFFF" } },
        left: { style: "thin", color: { argb: "FFFFFFFF" } },
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
      };

      // Thêm các dòng trống để tránh bị che bởi ảnh attendance
      worksheet.addRow([]);
      worksheet.addRow([]);
      worksheet.addRow([]);

      // Xóa border của các dòng trống 8, 9, 10
      [7, 8, 9, 10].forEach((rowNum) => {
        const row = worksheet.getRow(rowNum);
        for (let col = 1; col <= 12; col++) {
          const cell = worksheet.getCell(rowNum, col);
          cell.border = {
            top: { style: "thin", color: { argb: "FFFFFFFF" } },
            left: { style: "thin", color: { argb: "FFFFFFFF" } },
            right: { style: "thin", color: { argb: "FFFFFFFF" } },
            bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
          };
        }
      });

      // Tạo 2 dòng tiêu đề bảng (giờ là row 11 và 12)
      const headerVi = [
        "STT",
        "MNV",
        "MVT",
        "Họ và tên",
        "Giới tính",
        "Ngày bắt đầu",
        "Mã BP",
        "Bộ phận",
        "Thời gian vào",
        "Thời gian ra",
        "Ca làm việc",
        "Chấm công",
      ];

      const headerEn = [
        "",
        "Code",
        "",
        "Full name",
        "Gender",
        "Start working",
        "Code-Dept",
        "Department",
        "Time in",
        "Time out",
        "Current shift",
        "Timekeeping",
      ];

      // Thêm header rows
      worksheet.addRow(headerVi);
      worksheet.addRow(headerEn);

      // Style cho header (giờ là row 11 và 12)
      [11, 12].forEach((rowNum) => {
        const row = worksheet.getRow(rowNum);
        row.height = 30;
        row.eachCell((cell) => {
          cell.font = { bold: true, size: 9, color: { argb: "FF000000" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD3D3D3" },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "hair" },
            bottom: { style: "hair" },
            right: { style: "hair" },
          };
        });
      });

      // Thêm dữ liệu
      filteredEmployees.forEach((emp, idx) => {
        const row = worksheet.addRow([
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
          "",
          "",
        ]);

        // Style cho data rows với zebra striping
        const isEvenRow = idx % 2 === 0;
        row.eachCell((cell, colNumber) => {
          cell.font = { size: 9 };

          // Căn lề: STT, số, mã căn giữa; tên căn trái
          if (colNumber === 4 || colNumber === 8) {
            cell.alignment = {
              vertical: "middle",
              horizontal: "left",
              indent: 1,
            };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          }

          cell.border = {
            top: { style: "hair" },
            left: { style: "hair" },
            bottom: { style: "hair" },
            right: { style: "hair" },
          };

          // Zebra striping
          if (isEvenRow) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF0F8FF" },
            };
          }

          // Highlight thời gian vào/ra
          if (colNumber === 9 && cell.value) {
            cell.font = { size: 9, color: { argb: "FF006400" }, bold: true };
          }
          if (colNumber === 10 && cell.value) {
            cell.font = { size: 9, color: { argb: "FFDC143C" }, bold: true };
          }
        });
      });

      // Set độ rộng cột
      worksheet.columns = [
        { width: 5 }, // STT
        { width: 10 }, // MNV
        { width: 10 }, // MVT
        { width: 25 }, // Họ và tên
        { width: 8 }, // Giới tính
        { width: 12 }, // Ngày bắt đầu
        { width: 10 }, // Mã BP
        { width: 15 }, // Bộ phận
        { width: 10 }, // Thời gian vào
        { width: 10 }, // Thời gian ra
        { width: 12 }, // Ca làm việc
        { width: 14 }, // Chấm công (cột L - rộng hơn để bao hình)
      ];

      // Border ngoài cho toàn bộ bảng
      const lastRow = worksheet.rowCount;
      const lastCol = 12;

      // Top border
      for (let col = 1; col <= lastCol; col++) {
        worksheet.getCell(1, col).border = {
          ...worksheet.getCell(1, col).border,
          top: { style: "thin" },
        };
      }

      // Bottom border
      for (let col = 1; col <= lastCol; col++) {
        worksheet.getCell(lastRow, col).border = {
          ...worksheet.getCell(lastRow, col).border,
          bottom: { style: "thin" },
        };
      }

      // Left border
      for (let row = 1; row <= lastRow; row++) {
        worksheet.getCell(row, 1).border = {
          ...worksheet.getCell(row, 1).border,
          left: { style: "thin" },
        };
      }

      // Right border
      for (let row = 1; row <= lastRow; row++) {
        worksheet.getCell(row, lastCol).border = {
          ...worksheet.getCell(row, lastCol).border,
          right: { style: "thin" },
        };
      }

      // Xuất file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "-");
      a.download = `PAVONINE_diemDanh_${dateStr}_${timeStr}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      setAlert({
        show: true,
        type: "success",
        message: "✅ Xuất Excel thành công!",
      });
    } catch (err) {
      console.error("Export Excel Error:", err);
      setAlert({
        show: true,
        type: "error",
        message: `❌ Xuất Excel thất bại! ${err.message || ""}`,
      });
    }
  }, [filteredEmployees]);

  // Handle Overtime button - Export overtime form
  const handleOvertimeButton_OLD = useCallback(async () => {
    try {
      if (filteredEmployees.length === 0) {
        setAlert({
          show: true,
          type: "error",
          message: "⚠️ Không có nhân viên trong danh sách!",
        });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Overtime Form");

      // Load logo
      const logoResponse = await fetch("/picture/logo/logo_pavo.jpg");
      const logoBlob = await logoResponse.blob();
      const logoArrayBuffer = await logoBlob.arrayBuffer();
      const logoId = workbook.addImage({
        buffer: logoArrayBuffer,
        extension: "jpeg",
      });

      worksheet.addImage(logoId, {
        tl: { col: 0, row: 0 },
        ext: { width: 80, height: 40 },
      });

      // Title and date info
      worksheet.mergeCells("A1:M1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "ĐĂNG KÝ LÀM THÊM GIỜ / OVERTIME REGISTRATION";
      titleCell.font = { bold: true, size: 14, color: { argb: "FFFF0000" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };

      worksheet.mergeCells("A2:M2");
      const dateInfoCell = worksheet.getCell("A2");
      const overtimeDate = new Date(selectedDate);
      dateInfoCell.value = `Ngày/Date: ${overtimeDate.toLocaleDateString(
        "vi-VN"
      )}`;
      dateInfoCell.font = { bold: true, size: 11 };
      dateInfoCell.alignment = { vertical: "middle", horizontal: "center" };

      worksheet.addRow([]);

      // Header row 1 (Vietnamese)
      const headerRow1 = worksheet.addRow([
        "STT",
        "MNV",
        "Họ và tên",
        "Ngày bắt đầu",
        "Mã BP",
        "Bộ phận",
        "Tổng thời gian làm thêm giờ",
        "Thời gian dự kiến\\nTừ ...h đến ...h",
        "Thời gian làm thêm giờ ký",
        "Chữ ký người lao động",
        "Thời gian thực tế\\nTừ ...h đến ...h",
        "Số giờ làm thêm",
        "Ghi chú",
      ]);

      // Header row 2 (English)
      const headerRow2 = worksheet.addRow([
        "No.",
        "Code",
        "Full name",
        "Start working date",
        "Code-Dept",
        "Department",
        "Total overtime hours",
        "Estimated Time OT\\n(From..... To....)",
        "Total hours OT\\n(Hrs)",
        "Employees sign",
        "Fact Time OT\\n(From..... To....)",
        "Total hours OT\\n(Hrs)",
        "Remark",
      ]);

      // Style headers
      [headerRow1, headerRow2].forEach((row, idx) => {
        row.height = 40;
        row.eachCell((cell, colNumber) => {
          cell.font = { bold: true, size: 9 };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD3D3D3" },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Add employee data
      filteredEmployees.forEach((emp, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          emp.mnv || "",
          emp.hoVaTen || "",
          emp.ngayThangNamSinh || "",
          emp.maBoPhan || "",
          emp.boPhan || "",
          "", // Total overtime hours
          "", // Estimated Time
          "", // Total hours OT
          "", // Employee sign
          "", // Fact Time OT
          "", // Total hours OT
          "", // Remark
        ]);

        row.height = 30;
        row.eachCell((cell, colNumber) => {
          cell.font = { size: 9 };
          cell.alignment = {
            vertical: "middle",
            horizontal: colNumber <= 6 ? "center" : "center",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
          // Zebra striping
          if (idx % 2 === 0) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF0F8FF" },
            };
          }
        });
      });

      // Set column widths
      worksheet.columns = [
        { width: 5 }, // STT
        { width: 10 }, // MNV
        { width: 25 }, // Full name
        { width: 12 }, // Start date
        { width: 10 }, // Code BP
        { width: 15 }, // Department
        { width: 12 }, // Total OT hours
        { width: 15 }, // Estimated Time
        { width: 10 }, // Total hours OT
        { width: 15 }, // Employee sign
        { width: 15 }, // Fact Time OT
        { width: 10 }, // Total hours OT
        { width: 15 }, // Remark
      ];

      // Export file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = selectedDate;
      a.download = `PAVONINE_DangKyTangCa_${dateStr}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      setAlert({
        show: true,
        type: "success",
        message: `✅ Xuất biểu mẫu tăng ca thành công! ${filteredEmployees.length} nhân viên.`,
      });
    } catch (err) {
      console.error("Export Overtime Form Error:", err);
      setAlert({
        show: true,
        type: "error",
        message: `❌ Xuất biểu mẫu tăng ca thất bại! ${err.message || ""}`,
      });
    }
  }, [filteredEmployees, selectedDate]);

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

  // Handle Overtime button - open modal
  const handleOvertimeButton = useCallback(() => {
    if (filteredEmployees.length === 0) {
      setAlert({
        show: true,
        type: "error",
        message: "⚠️ Không có nhân viên trong danh sách!",
      });
      return;
    }
    setShowOvertimeModal(true);
  }, [filteredEmployees]);

  // Print overtime list (from modal)
  const handlePrintOvertimeList = useCallback(() => {
    if (modalFilteredEmployees.length === 0) {
      setAlert({
        show: true,
        type: "error",
        message: "⚠️ Không có nhân viên trong danh sách!",
      });
      return;
    }

    const overtimeDate = new Date(selectedDate).toLocaleDateString("vi-VN");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setAlert({
        show: true,
        type: "error",
        message:
          "❌ Không thể mở cửa sổ in. Vui lòng kiểm tra cài đặt trình duyệt!",
      });
      return;
    }

    let htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Danh sách tăng ca - ${overtimeDate}</title>
  <style>
    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      body {
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
    
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    html {
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 9pt;
      line-height: 1.2;
      color: #000;
      background: white;
      margin: 0 auto;
      padding: 10mm;
      width: 100%;
      max-width: 210mm;
      box-sizing: border-box;
    }
    
    .header {
      text-align: center;
      margin-bottom: 12px;
      margin-left: auto;
      margin-right: auto;
    }
    
    .header h1 {
      color: #c41e3a;
      font-size: 12pt;
      font-weight: bold;
      margin: 2px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .header .date {
      font-size: 9pt;
      font-weight: bold;
      margin: 3px 0;
      color: #000;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 7pt;
      table-layout: fixed;
      margin-left: auto;
      margin-right: auto;
    }
    
    th, td {
      border: 1px solid #000;
      padding: 3px 1px;
      text-align: center;
      vertical-align: middle;
      color: #000;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    th {
      background-color: #b0b0b0;
      font-weight: bold;
      font-size: 6.5pt;
    }
    
    .name-col, .dept-col {
      text-align: left;
      padding-left: 5px;
    }
    
    tbody tr:nth-child(even) {
      background-color: #e8f4f8;
    }
    
    .footer {
      margin-top: 15px;
      display: flex;
      justify-content: space-around;
    }
    
    .signature {
      text-align: center;
      width: 30%;
    }
    
    .signature-title {
      font-weight: bold;
      margin-bottom: 30px;
      font-size: 8pt;
    }
    
    .print-button {
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 10px 20px;
      background-color: #2196F3;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      z-index: 1000;
    }
    
    .close-button {
      position: fixed;
      top: 10px;
      right: 85px;
      padding: 10px 20px;
      background-color: #f44336;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">🖨️ In</button>
  <button class="close-button no-print" onclick="window.close()">✕ Đóng</button>
  
  <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 12px; max-width: 210mm; margin-left: auto; margin-right: auto;">
    <!-- Bên trái: Header + bảng nhỏ -->
    <div style="flex: 1;">
      <h1 style="color: #c41e3a; font-size: 12pt; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">ĐĂNG KÝ LÀM THÊM GIỜ</h1>
      <div style="font-size: 9pt; margin: 3px 0; color: #000;">OVERTIME REGISTRATION</div>
      <div style="font-size: 8pt; font-weight: bold; margin-top: 5px;">Ngày/Date: ${overtimeDate}</div>
    </div>
    
    <!-- Bên phải: Bảng Pavonine + thỏa thuận + nguyên tắc -->
    <div style="flex: 1;">
      <div style="border: 1.5px solid #000; padding: 5px; margin: 0 0 5px 0; background: #fff;">
        <h2 style="margin: 0 0 3px 0; font-size: 9pt; font-weight: bold; text-align: center;">PAVONINE VINA CO.,LTD</h2>
        <h3 style="margin: 0 0 2px 0; font-size: 8pt; font-weight: bold; text-align: center;">VĂN BẢN THỎA THUẬN CỦA NGƯỜI LAO ĐỘNG LÀM THÊM GIỜ</h3>
        <p style="margin: 0 0 3px 0; font-size: 7pt; text-align: center;">DAILY ATTENDANCE & AGREEMENT FOR LABOR TO WORK OVER TIME (OT)</p>
        
        <table style="font-size: 6.5pt; width: 100%;">
          <tr>
            <td colspan="3" style="text-align: center; font-weight: bold;">TRƯỚC KHI TĂNG CA/ BEFORE OT</td>
            <td colspan="3" style="text-align: center; font-weight: bold;">SAU TĂNG CA/ AFTER OT</td>
          </tr>
          <tr>
            <td>Người lập</td>
            <td>Kiểm tra</td>
            <td>Phê duyệt</td>
            <td>Người lập</td>
            <td>Kiểm tra</td>
            <td>Phê duyệt</td>
          </tr>
          <tr>
            <td style="height: 20px;">&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
        </table>
      </div>
    </div>
  </div>
  
  <div style="border: 1.5px solid #000; padding: 5px; margin: 12px auto; background: #f9f9f9; max-width: 210mm;">
    <h4 style="margin: 0 0 4px 0; text-align: center; font-size: 8pt; font-weight: bold;">NGUYÊN TẮC THỎA THUẬN LÀM THÊM GIỜ</h4>
    <ol style="margin: 0; padding-left: 15px; font-size: 7pt; line-height: 1.3;">
      <li>Người lao động ký tên bên dưới là đăng ký làm thêm giờ hoàn toàn tự nguyện không ép buộc.</li>
      <li>Thời gian tăng ca phải được chính xác rõ ràng.</li>
      <li>Thời gian tăng ca không được vượt quá 04 giờ/ngày.</li>
      <li>Trường hợp đã đăng ký làm thêm giờ mà có việc đột xuất phải báo cáo quản lý.</li>
    </ol>
  </div>
  
  <table>
    <thead>
      <tr>
        <th style="width: 4%;">STT</th>
        <th style="width: 6%;">MNV</th>
        <th style="width: 14%;">Họ và tên</th>
        <th style="width: 7%;">Ngày bắt đầu</th>
        <th style="width: 4%;">Mã BP</th>
        <th style="width: 9%;">Bộ phận</th>
        <th style="width: 7%;">Tổng thời gian tăng ca</th>
        <th style="width: 7%;">Thời gian dự kiến<br/>Từ …h đến …h</th>
        <th style="width: 7%;">Thời gian làm thêm ký<br/>(Hrs)</th>
        <th style="width: 8%;">Chữ ký người lao động</th>
        <th style="width: 7%;">Thời gian thực tế<br/>Từ …h đến …h</th>
        <th style="width: 6%;">Số giờ làm thêm/ ngày</th>
        <th style="width: 7%;">Ghi chú</th>
      </tr>
    </thead>
    <tbody>
`;

    modalFilteredEmployees.forEach((emp, idx) => {
      htmlContent += `
      <tr>
        <td>${idx + 1}</td>
        <td>${emp.mnv || ""}</td>
        <td class="name-col">${emp.hoVaTen || ""}</td>
        <td>${emp.ngayThangNamSinh || ""}</td>
        <td>${emp.maBoPhan || ""}</td>
        <td class="dept-col">${emp.boPhan || ""}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
      `;
    });

    htmlContent += `
    </tbody>
  </table>
  <script>
    window.onload = function() {
      document.querySelector('.print-button').focus();
    };
  </script>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setAlert({
      show: true,
      type: "success",
      message: `✅ Mở cửa sổ in danh sách tăng ca (${modalFilteredEmployees.length} nhân viên)`,
    });
  }, [modalFilteredEmployees, selectedDate]);

  // Export overtime form (from modal)
  const handleExportOvertimeForm = useCallback(async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Overtime Form");

      const logoResponse = await fetch("/picture/logo/logo_pavo.jpg");
      const logoBlob = await logoResponse.blob();
      const logoArrayBuffer = await logoBlob.arrayBuffer();
      const logoId = workbook.addImage({
        buffer: logoArrayBuffer,
        extension: "jpeg",
      });
      worksheet.addImage(logoId, {
        tl: { col: 0, row: 0 },
        ext: { width: 80, height: 40 },
      });

      worksheet.mergeCells("A1:M1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "ĐĂNG KÝ LÀM THÊM GIỜ / OVERTIME REGISTRATION";
      titleCell.font = { bold: true, size: 14, color: { argb: "FFFF0000" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };

      worksheet.mergeCells("A2:M2");
      const dateInfoCell = worksheet.getCell("A2");
      const overtimeDate = new Date(selectedDate);
      dateInfoCell.value = `Ngày/Date: ${overtimeDate.toLocaleDateString(
        "vi-VN"
      )}`;
      dateInfoCell.font = { bold: true, size: 11 };
      dateInfoCell.alignment = { vertical: "middle", horizontal: "center" };

      worksheet.addRow([]);

      const headerRow1 = worksheet.addRow([
        "STT",
        "MNV",
        "Họ và tên",
        "Ngày bắt đầu",
        "Mã BP",
        "Bộ phận",
        "Tổng thời gian làm thêm giờ",
        "Thời gian dự kiến\nTừ ...h đến ...h",
        "Thời gian làm thêm giờ ký",
        "Chữ ký người lao động",
        "Thời gian thực tế\nTừ ...h đến ...h",
        "Số giờ làm thêm",
        "Ghi chú",
      ]);
      const headerRow2 = worksheet.addRow([
        "No.",
        "Code",
        "Full name",
        "Start working date",
        "Code-Dept",
        "Department",
        "Total overtime hours",
        "Estimated Time OT\n(From..... To....)",
        "Total hours OT\n(Hrs)",
        "Employees sign",
        "Fact Time OT\n(From..... To....)",
        "Total hours OT\n(Hrs)",
        "Remark",
      ]);

      [headerRow1, headerRow2].forEach((row) => {
        row.height = 40;
        row.eachCell((cell) => {
          cell.font = { bold: true, size: 9 };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD3D3D3" },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Sử dụng modalFilteredEmployees (đã lọc theo bộ phận & giới tính)
      modalFilteredEmployees.forEach((emp, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          emp.mnv || "",
          emp.hoVaTen || "",
          emp.ngayThangNamSinh || "",
          emp.maBoPhan || "",
          emp.boPhan || "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
        row.height = 30;
        row.eachCell((cell, colNumber) => {
          cell.font = { size: 9 };

          // Căn chỉnh: tên căn trái, còn lại căn giữa
          if (colNumber === 3) {
            cell.alignment = {
              vertical: "middle",
              horizontal: "left",
              indent: 1,
              wrapText: true,
            };
          } else {
            cell.alignment = {
              vertical: "middle",
              horizontal: "center",
              wrapText: true,
            };
          }

          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };

          if (idx % 2 === 0) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF0F8FF" },
            };
          }
        });
      });

      worksheet.columns = [
        { width: 5 },
        { width: 10 },
        { width: 25 },
        { width: 12 },
        { width: 10 },
        { width: 15 },
        { width: 12 },
        { width: 15 },
        { width: 10 },
        { width: 15 },
        { width: 15 },
        { width: 10 },
        { width: 15 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PAVONINE_DangKyTangCa_${selectedDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      setAlert({
        show: true,
        type: "success",
        message: `✅ Xuất biểu mẫu tăng ca thành công! ${modalFilteredEmployees.length} nhân viên.`,
      });
    } catch (err) {
      console.error("Export Overtime Form Error:", err);
      setAlert({
        show: true,
        type: "error",
        message: `❌ Xuất biểu mẫu tăng ca thất bại! ${err.message || ""}`,
      });
    }
  }, [modalFilteredEmployees, selectedDate]);

  return (
    <>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed left-4 top-20 z-50 w-12 h-12 flex items-center justify-center rounded-full shadow-lg bg-black text-white hover:bg-gray-900 transition"
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {/* Main Content */}
      <div
        className={`p-4 md:p-8 transition-all duration-300 ${
          sidebarOpen ? "ml-72" : "ml-0"
        }`}
      >
        {/* Header */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-600">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-extrabold text-[#1e293b] uppercase tracking-wide">
                  DANH SÁCH NHÂN VIÊN HIỆN DIỆN
                </h1>
                <p className="text-base text-gray-600 mt-1">
                  List of Active Employees
                </p>
                <p className="text-sm text-gray-500 mt-2">
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
            {/* Filter Button */}
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className={`px-4 py-2 rounded font-bold text-sm shadow transition flex items-center gap-2 ${
                  mnvFilter.length > 0 ||
                  mvtFilter.length > 0 ||
                  gioiTinhFilter.length > 0 ||
                  departmentListFilter.length > 0 ||
                  caLamViecFilter.length > 0
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
              >
                🔍 Lọc
                <span className="text-xs">
                  {mnvFilter.length > 0 ||
                  mvtFilter.length > 0 ||
                  gioiTinhFilter.length > 0 ||
                  departmentListFilter.length > 0 ||
                  caLamViecFilter.length > 0
                    ? "✓"
                    : ""}
                </span>
              </button>

              {/* Filter Modal Dialog */}
              {filterOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-slideUp border border-gray-100">
                    {/* Header */}
                    <div className="p-5 border-b-2 border-blue-100 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 relative overflow-hidden">
                      <div className="absolute inset-0 bg-white opacity-10"></div>
                      <div className="relative z-10">
                        <h3 className="font-bold text-white text-xl flex items-center gap-2">
                          <span className="text-2xl">🔍</span>
                          Bộ lọc nâng cao
                        </h3>
                        <p className="text-xs text-blue-50 mt-1.5 font-medium">
                          Chọn điều kiện lọc • Kết quả tự động cập nhật
                        </p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 overflow-y-auto flex-1">
                      {/* MNV Filter Section */}
                      <div className="mb-3">
                        <button
                          onClick={() => {
                            setExpandedSections((prev) => ({
                              ...prev,
                              mnv: !prev.mnv,
                            }));
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-blue-200"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-blue-500 text-base">👤</span>
                            <span>Mã nhân viên (MNV)</span>
                          </span>
                          <span className="text-blue-600 font-bold">
                            {expandedSections.mnv ? "▼" : "▶"}
                          </span>
                        </button>
                        {expandedSections.mnv && (
                          <div className="border-2 border-blue-100 rounded-lg mt-2 max-h-40 overflow-y-auto bg-gradient-to-b from-white to-blue-50/30 shadow-inner">
                            {employees.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500 italic flex items-center gap-2">
                                <span className="animate-spin">⏳</span>
                                Đang tải dữ liệu...
                              </div>
                            ) : (
                              mnvList.map((mnv) => (
                                <label
                                  key={mnv}
                                  className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                                >
                                  <input
                                    type="checkbox"
                                    checked={mnvFilter.includes(mnv)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setMnvFilter([...mnvFilter, mnv]);
                                      } else {
                                        setMnvFilter(
                                          mnvFilter.filter((m) => m !== mnv)
                                        );
                                      }
                                    }}
                                    className="mr-2 w-4 h-4 cursor-pointer"
                                  />
                                  {mnv}
                                </label>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* MVT Filter Section */}
                      <div className="mb-3">
                        <button
                          onClick={() => {
                            setExpandedSections((prev) => ({
                              ...prev,
                              mvt: !prev.mvt,
                            }));
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-purple-200"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-purple-500 text-base">
                              🔑
                            </span>
                            <span>Mã vân tay (MVT)</span>
                          </span>
                          <span className="text-purple-600 font-bold">
                            {expandedSections.mvt ? "▼" : "▶"}
                          </span>
                        </button>
                        {expandedSections.mvt && (
                          <div className="border-2 border-purple-100 rounded-lg mt-2 max-h-40 overflow-y-auto bg-gradient-to-b from-white to-purple-50/30 shadow-inner">
                            {employees.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500 italic flex items-center gap-2">
                                <span className="animate-spin">⏳</span>
                                Đang tải dữ liệu...
                              </div>
                            ) : (
                              mvtList.map((mvt) => (
                                <label
                                  key={mvt}
                                  className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                                >
                                  <input
                                    type="checkbox"
                                    checked={mvtFilter.includes(mvt)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setMvtFilter([...mvtFilter, mvt]);
                                      } else {
                                        setMvtFilter(
                                          mvtFilter.filter((m) => m !== mvt)
                                        );
                                      }
                                    }}
                                    className="mr-2 w-4 h-4 cursor-pointer"
                                  />
                                  {mvt}
                                </label>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Gender Filter Section */}
                      <div className="mb-3">
                        <button
                          onClick={() => {
                            setExpandedSections((prev) => ({
                              ...prev,
                              gender: !prev.gender,
                            }));
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-50 to-teal-50 hover:from-green-100 hover:to-teal-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-green-200"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-green-500 text-base">⚧️</span>
                            <span>Giới tính</span>
                          </span>
                          <span className="text-green-600 font-bold">
                            {expandedSections.gender ? "▼" : "▶"}
                          </span>
                        </button>
                        {expandedSections.gender && (
                          <div className="border-2 border-green-100 rounded-lg mt-2 bg-gradient-to-b from-white to-green-50/30 shadow-inner">
                            {genderList.map((gender) => (
                              <label
                                key={gender}
                                className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                              >
                                <input
                                  type="checkbox"
                                  checked={gioiTinhFilter.includes(gender)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setGioiTinhFilter([
                                        ...gioiTinhFilter,
                                        gender,
                                      ]);
                                    } else {
                                      setGioiTinhFilter(
                                        gioiTinhFilter.filter(
                                          (g) => g !== gender
                                        )
                                      );
                                    }
                                  }}
                                  className="mr-2 w-4 h-4 cursor-pointer"
                                />
                                {gender === "YES" ? "Nữ" : "Nam"}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Department Filter Section */}
                      <div className="mb-3">
                        <button
                          onClick={() => {
                            setExpandedSections((prev) => ({
                              ...prev,
                              department: !prev.department,
                            }));
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-orange-200"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-orange-500 text-base">
                              🏢
                            </span>
                            <span>Bộ phận</span>
                          </span>
                          <span className="text-orange-600 font-bold">
                            {expandedSections.department ? "▼" : "▶"}
                          </span>
                        </button>
                        {expandedSections.department && (
                          <div className="border-2 border-orange-100 rounded-lg mt-2 max-h-40 overflow-y-auto bg-gradient-to-b from-white to-orange-50/30 shadow-inner">
                            {departments.map((dept) => (
                              <label
                                key={dept}
                                className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                              >
                                <input
                                  type="checkbox"
                                  checked={departmentListFilter.includes(dept)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setDepartmentListFilter([
                                        ...departmentListFilter,
                                        dept,
                                      ]);
                                    } else {
                                      setDepartmentListFilter(
                                        departmentListFilter.filter(
                                          (d) => d !== dept
                                        )
                                      );
                                    }
                                  }}
                                  className="mr-2 w-4 h-4 cursor-pointer"
                                />
                                {dept}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Shift Filter Section */}
                      <div className="mb-3">
                        <button
                          onClick={() => {
                            setExpandedSections((prev) => ({
                              ...prev,
                              shift: !prev.shift,
                            }));
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-red-200"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-red-500 text-base">🕐</span>
                            <span>Ca làm việc</span>
                          </span>
                          <span className="text-red-600 font-bold">
                            {expandedSections.shift ? "▼" : "▶"}
                          </span>
                        </button>
                        {expandedSections.shift && (
                          <div className="border-2 border-red-100 rounded-lg mt-2 max-h-40 overflow-y-auto bg-gradient-to-b from-white to-red-50/30 shadow-inner">
                            {shiftList.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500 italic">
                                Không có dữ liệu
                              </div>
                            ) : (
                              shiftList.map((shift) => (
                                <label
                                  key={shift}
                                  className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                                >
                                  <input
                                    type="checkbox"
                                    checked={caLamViecFilter.includes(shift)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setCaLamViecFilter([
                                          ...caLamViecFilter,
                                          shift,
                                        ]);
                                      } else {
                                        setCaLamViecFilter(
                                          caLamViecFilter.filter(
                                            (s) => s !== shift
                                          )
                                        );
                                      }
                                    }}
                                    className="mr-2 w-4 h-4 cursor-pointer"
                                  />
                                  {shift}
                                </label>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer - Buttons */}
                    <div className="p-5 border-t-2 border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50 flex gap-3 justify-end">
                      <button
                        onClick={() => {
                          setMnvFilter([]);
                          setMvtFilter([]);
                          setGioiTinhFilter([]);
                          setDepartmentListFilter([]);
                          setCaLamViecFilter([]);
                          setExpandedSections({});
                        }}
                        className="px-5 py-2.5 rounded-lg text-sm text-gray-700 border-2 border-gray-300 hover:border-red-400 hover:bg-red-50 hover:text-red-600 font-semibold transition-all duration-200 shadow-sm hover:shadow"
                      >
                        🗑️ Xóa tất cả
                      </button>
                      <button
                        onClick={() => setFilterOpen(false)}
                        className="px-5 py-2.5 rounded-lg text-sm bg-gradient-to-r from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        ✖️ Hủy
                      </button>
                      <button
                        onClick={() => setFilterOpen(false)}
                        className="px-5 py-2.5 rounded-lg text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        ✓ Áp dụng
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-600 text-white rounded font-bold text-sm shadow hover:bg-emerald-700 transition"
            >
              📥 Xuất Excel
            </button>

            <button
              onClick={handleOvertimeButton}
              className="px-4 py-2 bg-orange-600 text-white rounded font-bold text-sm shadow hover:bg-orange-700 transition"
            >
              ⏰ Tăng ca
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
                    caLamViec: "",
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
                    <option value="YES">YES (Nữ)</option>
                    <option value="NO">NO (Nam)</option>
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
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Ca làm việc
                  </label>
                  <input
                    type="text"
                    name="caLamViec"
                    value={form.caLamViec}
                    onChange={handleChange}
                    className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Chấm công
                  </label>
                  <input
                    type="text"
                    name="chamCong"
                    value={form.chamCong}
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

        {/* Overtime Modal */}
        {showOvertimeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-8xl relative mx-4 overflow-y-auto max-h-[90vh]">
              <button
                onClick={() => setShowOvertimeModal(false)}
                className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white text-2xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 z-20"
              >
                ×
              </button>
              <h2 className="text-lg font-bold mb-4 text-[#1e293b]">
                Biểu mẫu đăng ký tăng ca
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Ngày: {new Date(selectedDate).toLocaleDateString("vi-VN")}
              </p>

              {/* Filter and Export */}
              <div className="mb-4 flex flex-wrap gap-3 items-center justify-between">
                <button
                  onClick={() => setModalFilterOpen(!modalFilterOpen)}
                  className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg ${
                    modalGioiTinhFilter.length > 0 ||
                    modalDepartmentListFilter.length > 0
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800"
                      : "bg-gradient-to-r from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700"
                  }`}
                >
                  🔍 Lọc
                  {(modalGioiTinhFilter.length > 0 ||
                    modalDepartmentListFilter.length > 0) && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-xs font-bold">
                      ✓
                    </span>
                  )}
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handlePrintOvertimeList}
                    className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm shadow hover:bg-blue-700 transition whitespace-nowrap"
                  >
                    🖨️ In danh sách
                  </button>
                  <button
                    onClick={handleExportOvertimeForm}
                    className="px-4 py-2 bg-orange-600 text-white rounded font-bold text-sm shadow hover:bg-orange-700 transition whitespace-nowrap"
                  >
                    ⬇️ Xuất biểu mẫu Excel
                  </button>
                </div>
              </div>
              {/* Popup Filter Panel */}
              {modalFilterOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-slideUp border border-gray-100">
                    {/* Header */}
                    <div className="p-5 border-b-2 border-blue-100 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 relative overflow-hidden">
                      <div className="absolute inset-0 bg-white opacity-10"></div>
                      <div className="relative z-10">
                        <h3 className="font-bold text-white text-xl flex items-center gap-2">
                          <span className="text-2xl">🔍</span>
                          Bộ lọc nâng cao
                        </h3>
                        <p className="text-xs text-blue-50 mt-1.5 font-medium">
                          Chọn điều kiện lọc • Áp dụng cho danh sách trong modal
                        </p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 overflow-y-auto flex-1 space-y-3">
                      {/* Department Filter */}
                      <div className="mb-1">
                        <button
                          onClick={() => {
                            setModalExpandedSections((prev) => ({
                              ...prev,
                              dept: !prev.dept,
                            }));
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-blue-200"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-blue-500 text-base">🏢</span>
                            <span>Bộ phận</span>
                          </span>
                          <span className="text-blue-600 font-bold">
                            {modalExpandedSections.dept ? "▼" : "▶"}
                          </span>
                        </button>
                        {modalExpandedSections.dept && (
                          <div className="border-2 border-blue-100 rounded-lg mt-2 max-h-40 overflow-y-auto bg-gradient-to-b from-white to-blue-50/30 shadow-inner">
                            {modalUniqueDepartments.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500 italic flex items-center gap-2">
                                <span className="animate-spin">⏳</span>
                                Không có dữ liệu
                              </div>
                            ) : (
                              modalUniqueDepartments.map((dept) => (
                                <label
                                  key={dept || "dept-empty"}
                                  className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                                >
                                  <input
                                    type="checkbox"
                                    checked={modalDepartmentListFilter.includes(
                                      dept
                                    )}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setModalDepartmentListFilter([
                                          ...modalDepartmentListFilter,
                                          dept,
                                        ]);
                                      } else {
                                        setModalDepartmentListFilter(
                                          modalDepartmentListFilter.filter(
                                            (d) => d !== dept
                                          )
                                        );
                                      }
                                    }}
                                    className="mr-2 w-4 h-4 cursor-pointer"
                                  />
                                  {dept || "(Không rõ)"}
                                </label>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Gender Filter */}
                      <div className="mb-1">
                        <button
                          onClick={() => {
                            setModalExpandedSections((prev) => ({
                              ...prev,
                              gender: !prev.gender,
                            }));
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-50 to-teal-50 hover:from-green-100 hover:to-teal-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-green-200"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-green-500 text-base">⚧️</span>
                            <span>Giới tính</span>
                          </span>
                          <span className="text-green-600 font-bold">
                            {modalExpandedSections.gender ? "▼" : "▶"}
                          </span>
                        </button>
                        {modalExpandedSections.gender && (
                          <div className="border-2 border-green-100 rounded-lg mt-2 max-h-40 overflow-y-auto bg-gradient-to-b from-white to-green-50/30 shadow-inner">
                            {modalUniqueGenders.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500 italic flex items-center gap-2">
                                <span className="animate-spin">⏳</span>
                                Không có dữ liệu
                              </div>
                            ) : (
                              modalUniqueGenders.map((gender) => (
                                <label
                                  key={gender || "gender-empty"}
                                  className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                                >
                                  <input
                                    type="checkbox"
                                    checked={modalGioiTinhFilter.includes(
                                      gender
                                    )}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setModalGioiTinhFilter([
                                          ...modalGioiTinhFilter,
                                          gender,
                                        ]);
                                      } else {
                                        setModalGioiTinhFilter(
                                          modalGioiTinhFilter.filter(
                                            (g) => g !== gender
                                          )
                                        );
                                      }
                                    }}
                                    className="mr-2 w-4 h-4 cursor-pointer"
                                  />
                                  {gender || "(Không rõ)"}
                                </label>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 px-4 pb-4">
                      <button
                        onClick={() => {
                          setModalGioiTinhFilter([]);
                          setModalDepartmentListFilter([]);
                        }}
                        className="px-3 py-2 text-xs rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 font-medium"
                      >
                        Xóa bộ lọc
                      </button>
                      <button
                        onClick={() => setModalFilterOpen(false)}
                        className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow font-medium"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Table with consistent styling */}
              <div className="overflow-x-auto bg-white rounded-lg shadow-lg mt-6 max-h-[500px] flex flex-col">
                <table className="w-full border-collapse min-w-[1400px]">
                  <thead>
                    <tr
                      className="sticky top-0 z-10"
                      style={{
                        background:
                          "linear-gradient(to right, #3b82f6, #8b5cf6)",
                      }}
                    >
                      <th className="px-3 py-3 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[40px]">
                        STT
                      </th>
                      <th className="px-3 py-3 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[70px]">
                        MNV
                      </th>
                      <th className="px-3 py-3 text-xs font-extrabold text-white uppercase tracking-wide text-left border-r border-blue-400 min-w-[150px]">
                        Họ và tên
                      </th>
                      <th className="px-3 py-3 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[100px]">
                        Ngày bắt đầu
                      </th>
                      <th className="px-3 py-3 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[60px]">
                        Mã BP
                      </th>
                      <th className="px-3 py-3 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[100px]">
                        Bộ phận
                      </th>
                      <th className="px-3 py-3 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[110px]">
                        Tổng thời gian làm thêm giờ
                      </th>
                      <th className="px-3 py-3 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[130px]">
                        Thời gian dự kiến
                        <br />
                        Từ ...h đến ...h
                      </th>
                      <th className="px-3 py-3 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[110px]">
                        Thời gian làm thêm giờ ký
                      </th>
                      <th className="px-3 py-3 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[120px]">
                        Chữ ký người lao động
                      </th>
                      <th className="px-3 py-3 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[130px]">
                        Thời gian thực tế
                        <br />
                        Từ ...h đến ...h
                      </th>
                      <th className="px-3 py-3 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[100px]">
                        Số giờ làm thêm
                      </th>
                      <th className="px-3 py-3 text-xs font-extrabold text-white uppercase tracking-wide text-center min-w-[100px]">
                        Ghi chú
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalFilteredEmployees.map((emp, idx) => (
                      <tr
                        key={emp.id || idx}
                        className={`border-b transition-colors hover:bg-blue-100 ${
                          idx % 2 === 0 ? "bg-blue-50" : "bg-white"
                        }`}
                      >
                        <td className="px-3 py-3 text-xs text-gray-800 text-center font-bold border-r border-gray-300">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-800 text-center font-semibold border-r border-gray-300">
                          {emp.mnv || ""}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-900 font-medium text-left border-r border-gray-300">
                          {emp.hoVaTen || ""}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 text-center border-r border-gray-300">
                          {emp.ngayThangNamSinh || ""}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 text-center border-r border-gray-300">
                          {emp.maBoPhan || ""}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 text-center border-r border-gray-300">
                          {emp.boPhan || ""}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 text-center border-r border-gray-300">
                          {/* Để trống cho người dùng điền */}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 text-center border-r border-gray-300">
                          {/* Để trống cho người dùng điền */}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 text-center border-r border-gray-300">
                          {/* Để trống cho người dùng điền */}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 text-center border-r border-gray-300">
                          {/* Để trống cho người dùng điền */}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 text-center border-r border-gray-300">
                          {/* Để trống cho người dùng điền */}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 text-center border-r border-gray-300">
                          {/* Để trống cho người dùng điền */}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 text-center">
                          {/* Để trống cho người dùng điền */}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
          <table className="w-full border-collapse min-w-[1200px]">
            <thead>
              <tr
                style={{
                  background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
                }}
              >
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
                <th className="px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  Ca làm việc
                </th>
                <th className="px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  Chấm công
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
                          ? "bg-pink-100 text-pink-700"
                          : "bg-blue-100 text-blue-700"
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
                      <div className="flex items-center justify-center gap-2">
                        <select
                          className="border rounded px-2 py-1 text-sm text-green-700 font-bold focus:ring-2 focus:ring-green-300"
                          value={editingGioVao[emp.id] || ""}
                          onChange={(e) => {
                            setEditingGioVao((prev) => ({
                              ...prev,
                              [emp.id]: e.target.value,
                            }));
                          }}
                        >
                          <option value="">Chọn loại</option>
                          <option value="CDL">Có</option>
                          <option value="VT">Vào trễ</option>
                          <option value="PN">PN</option>
                          <option value="PN1/2">1/2 PN</option>
                          <option value="KL">KL</option>
                          <option value="KP">KP</option>
                          <option value="PO">PO</option>
                          <option value="TN">TN</option>
                          <option value="PC">PC</option>
                          <option value="PT">PT</option>
                          <option value="DS">DS</option>
                        </select>
                        {editingGioVao[emp.id] && (
                          <button
                            onClick={async () => {
                              const value = editingGioVao[emp.id];
                              if (value) {
                                const empRef = ref(
                                  db,
                                  `attendance/${selectedDate}/${emp.id}`
                                );
                                await set(empRef, { ...emp, gioVao: value });
                                setEditingGioVao((prev) => {
                                  const newState = { ...prev };
                                  delete newState[emp.id];
                                  return newState;
                                });
                              }
                            }}
                            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                          >
                            ✓
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">--</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-center">
                    <span className="text-red-600 font-bold text-base">
                      {emp.gioRa}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm text-center">
                    <span className="text-gray-700 font-medium">
                      {emp.caLamViec || "--"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm text-center">
                    <span className="text-gray-700 font-medium">
                      {emp.chamCong || "--"}
                    </span>
                  </td>
                  {user &&
                    (user.email === "admin@gmail.com" ||
                      user.email === "hr@pavonine.net") && (
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
    </>
  );
}

export default AttendanceList;
