import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import {
  isAdminAccess,
  canEditAttendanceForEmployee,
  canAddAttendanceForDepartment,
  canDeleteEmployeeData,
  ROLES,
} from "@/config/authRoles";
import { getUploadErrorMessage } from "@/utils/uploadErrorMessage";
import {
  db,
  ref,
  set,
  onValue,
  push,
  remove,
  update,
  get,
} from "@/services/firebase";
import * as XLSX from "@e965/xlsx";
import ExcelJS from "exceljs";
import ExportExcelButton from "@/components/ui/ExportExcelButton";
// import BirthdayCake from "./BirthdayCake";
import NotificationBell from "@/components/ui/NotificationBell";
import AlertMessage from "@/components/ui/AlertMessage";
import {
  sanitizeAttendanceDayNodeForUi,
  mergeAttendanceDayNodeForPersist,
} from "@/utils/employeeRosterRecord";
import {
  ATTENDANCE_LOAI_PHEP_OPTIONS,
  formatAttendanceGioVaoDisplay,
  formatAttendanceLeaveTypeColumnForEmployee,
  formatAttendanceTimeInColumnDisplay,
  getAttendanceLeaveTypeBadgeClassName,
  getAttendanceLeaveTypeColorClassNameForEmployee,
  getAttendanceLeaveTypePrintStyleAttrForEmployee,
  getAttendanceLeaveTypeRaw,
  isGioVaoLeaveOrStatusType,
} from "./attendanceGioVaoTypeOptions";
import {
  getIsOffDayFromRaw,
  getIsHolidayDayFromRaw,
} from "./attendanceDayMeta";
import { ATTENDANCE_CA_LAM_VIEC_OPTIONS } from "./attendanceCaLamViecOptions";
import {
  looksLikeGioVaoTime,
  normalizeTimeForHtmlInput,
  canonicalAttendanceLoaiPhep,
  findGioVaoTypeOptionMatch,
} from "./attendanceGioVaoModalHelpers";
import {
  hasAttendanceExcelCellValue,
  mergeAttendanceExcelIntoExistingRecord,
  stripAttendanceExcelUploadInternalFields,
} from "./attendanceExcelUploadMerge";
import { getAttendanceColWidthPercents } from "./AttendanceTableRow";
import { useAttendanceColumnPlan } from "./useAttendanceBirthDeptColumns";
import {
  ATTENDANCE_LEAVE_FILTER_NONE,
  employeeMatchesLoaiPhepFilter,
  isEmployeeQuickUnattended,
} from "./attendanceListShared";

function SeasonalAttendanceColgroup({
  showRowModalActions,
  columnPlan = "full",
}) {
  const widths = getAttendanceColWidthPercents(
    showRowModalActions,
    columnPlan,
    "attendance",
    columnPlan === "full" ? { seasonalOmitWorkStatus: true } : {},
  );
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: `${w}%` }} />
      ))}
    </colgroup>
  );
}

function seasonalTableMinWidthClass(columnPlan) {
  /** Full: không cột «Trạng thái LV» như điểm danh chính — bảng hẹp hơn một chút. */
  if (columnPlan === "full") return "min-w-[1180px]";
  if (columnPlan === "compact") return "min-w-[1000px]";
  if (columnPlan === "narrow") return "min-w-[840px]";
  if (columnPlan === "minimal") return "min-w-[600px]";
  return "min-w-[920px]";
}

function SeasonalStaffAttendance() {
  // State for alert messages
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  // State for add/edit modal open/close
  const [showModal, setShowModal] = useState(false);
  // State for main filter modal open/close
  const [filterOpen, setFilterOpen] = useState(false);
  // State for department search input in filter
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState("");
  // State for single department filter (if used)
  const [departmentFilter, setDepartmentFilter] = useState("");
  // State for main search input
  const [searchTerm, setSearchTerm] = useState("");
  // State for selected date (default to today)
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [isOffDay, setIsOffDay] = useState(false);
  const [isHolidayDay, setIsHolidayDay] = useState(false);
  const { t, i18n } = useTranslation();
  const tl = useCallback(
    (key, defaultValue, options = {}) =>
      t(`attendanceList.${key}`, { defaultValue, ...options }),
    [t],
  );
  const displayLocale = i18n.language?.startsWith("ko") ? "ko-KR" : "vi-VN";
  const { user, userDepartments, userRole } = useUser();

  const [loaiPhepFilter, setLoaiPhepFilter] = useState([]);
  const [showOnlyUnattendedFilter, setShowOnlyUnattendedFilter] =
    useState(false);

  const normalizeDepartment = useCallback((value) => {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }, []);

  const handleQuickNoCheckInFilter = useCallback(() => {
    setShowOnlyUnattendedFilter((v) => !v);
  }, []);

  const allLeaveTypeFilterValues = useMemo(
    () => ATTENDANCE_LOAI_PHEP_OPTIONS.map((o) => o.value),
    [],
  );

  const isQuickNoCheckInActive = showOnlyUnattendedFilter;

  const [employees, setEmployees] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filterDepartmentSearch, setFilterDepartmentSearch] = useState("");
  const [filterSearchTerm, setFilterSearchTerm] = useState("");
  const [departmentListFilter, setDepartmentListFilter] = useState([]); // Filter by department in filter section
  const [expandedSections, setExpandedSections] = useState({}); // Track which sections are expanded
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  // Overtime modal-specific filters
  const [modalFilterOpen, setModalFilterOpen] = useState(false);
  const [modalDepartmentListFilter, setModalDepartmentListFilter] = useState(
    [],
  );
  const [modalExpandedSections, setModalExpandedSections] = useState({});
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false);
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
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
    loaiPhep: "",
    gioRa: "",
    caLamViec: "",
  });

  // Load data from Firebase
  useEffect(() => {
    const empRef = ref(db, `seasonalAttendance/${selectedDate}`);
    const unsubscribe = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const arr = Object.entries(data).map(([id, emp]) =>
          sanitizeAttendanceDayNodeForUi(emp, id),
        );
        arr.sort((a, b) => (a.stt || 0) - (b.stt || 0));
        setEmployees(arr);
      } else {
        setEmployees([]);
      }
    });
    return () => unsubscribe();
  }, [selectedDate]);

  // Dùng chung cờ Ngày off / lễ với màn điểm danh nhân viên.
  useEffect(() => {
    const dayRef = ref(db, `attendance/${selectedDate}`);
    const unsubscribe = onValue(dayRef, (snapshot) => {
      const v = snapshot.val();
      setIsOffDay(getIsOffDayFromRaw(v));
      setIsHolidayDay(getIsHolidayDayFromRaw(v));
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

  // Check if user can edit this employee's data
  const canEditEmployee = useCallback(
    (employee) =>
      canEditAttendanceForEmployee({
        user,
        userRole,
        userDepartments,
        employee,
      }),
    [user, userRole, userDepartments],
  );

  /** Thêm mới: admin hoặc manager đúng bộ phận; staff không thêm */
  const canAddEmployeeForDepartment = useCallback(
    (boPhan) =>
      canAddAttendanceForDepartment({
        user,
        userRole,
        userDepartments,
        boPhan,
      }),
    [user, userRole, userDepartments],
  );

  const showRowModalActions = user && userRole && userRole !== ROLES.STAFF;
  const columnPlan = useAttendanceColumnPlan();

  const canDeleteSeasonalRecord = canDeleteEmployeeData(user, userRole);

  // Close print dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (printDropdownOpen && !event.target.closest(".relative")) {
        setPrintDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [printDropdownOpen]);

  // Close action dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionDropdownOpen && !event.target.closest(".action-dropdown")) {
        setActionDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [actionDropdownOpen]);

  useEffect(() => {
    if (!filterOpen) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [filterOpen]);

  const filterSeasonalAttendanceRows = useCallback(
    (list) => {
      const q = searchTerm.trim().toLowerCase();
      const selectedDeptKeys = new Set(
        departmentListFilter.map((dept) => normalizeDepartment(dept)),
      );
      return list.filter((emp) => {
        const empDeptKey = normalizeDepartment(emp.boPhan);
        const departmentFilterKey = normalizeDepartment(departmentFilter);
        if (departmentFilterKey && empDeptKey !== departmentFilterKey)
          return false;
        if (selectedDeptKeys.size > 0 && !selectedDeptKeys.has(empDeptKey))
          return false;
        if (showOnlyUnattendedFilter && !isEmployeeQuickUnattended(emp))
          return false;
        if (!employeeMatchesLoaiPhepFilter(emp, loaiPhepFilter)) return false;
        if (!q) return true;
        return (
          (emp.hoVaTen || "").toLowerCase().includes(q) ||
          (emp.mnv || "").toLowerCase().includes(q) ||
          (emp.boPhan || "").toLowerCase().includes(q)
        );
      });
    },
    [
      searchTerm,
      departmentFilter,
      departmentListFilter,
      showOnlyUnattendedFilter,
      loaiPhepFilter,
      normalizeDepartment,
    ],
  );

  const filteredEmployees = useMemo(
    () => filterSeasonalAttendanceRows(employees),
    [employees, filterSeasonalAttendanceRows],
  );

  // Overtime modal: derive unique options and apply modal filters from filteredEmployees
  const modalUniqueDepartments = useMemo(
    () =>
      Array.from(
        new Set(filteredEmployees.map((e) => e.boPhan).filter(Boolean)),
      ),
    [filteredEmployees],
  );
  const modalFilteredEmployees = useMemo(() => {
    return filteredEmployees.filter((emp) => {
      if (
        modalDepartmentListFilter.length > 0 &&
        !modalDepartmentListFilter.includes(emp.boPhan)
      )
        return false;
      return true;
    });
  }, [filteredEmployees, modalDepartmentListFilter]);

  // Get unique departments (cascading filter - based on other selected filters)
  const departments = useMemo(() => {
    const depts = new Set();
    for (const emp of employees) {
      if (showOnlyUnattendedFilter && !isEmployeeQuickUnattended(emp)) continue;
      if (!employeeMatchesLoaiPhepFilter(emp, loaiPhepFilter)) continue;
      if (emp.boPhan) depts.add(emp.boPhan);
    }
    return Array.from(depts);
  }, [employees, showOnlyUnattendedFilter, loaiPhepFilter]);

  // Filtered list for 'bù công' (gioVao là giờ, không phải loại như PN, PO...)
  const buCongEmployees = useMemo(() => {
    // Strictly matches hh:mm or hh:mm:ss (no extra chars, no spaces)
    const timeRegex = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
    return filteredEmployees.filter((emp) => {
      const gioVaoRaw = (emp.gioVao || "").trim();
      const gioRa = (emp.gioRa || "").trim();
      if (!gioVaoRaw || isGioVaoLeaveOrStatusType(gioVaoRaw)) return false;
      // Chỉ nhận giá trị giờ vào hợp lệ
      if (!timeRegex.test(gioVaoRaw)) return false;
      // Nếu có cả giờ vào và giờ ra (đều hợp lệ) thì không phải bù công
      if (gioVaoRaw && gioRa && timeRegex.test(gioRa)) return false;
      // Nếu chỉ có giờ vào hoặc chỉ có giờ ra (1 trong 2), thì là bù công
      if ((gioVaoRaw && !gioRa) || (!gioVaoRaw && gioRa)) return true;
      // Nếu không có giờ vào và không có giờ ra thì không phải bù công
      return false;
    });
  }, [filteredEmployees]);

  // Get unique mã BP codes (cascading filter - based on other selected filters)
  // Get unique shifts (cascading filter - based on other selected filters)
  const shiftList = useMemo(() => {
    const shifts = new Set();
    const selectedDeptKeys = new Set(
      departmentListFilter.map((dept) => normalizeDepartment(dept)),
    );
    for (const emp of employees) {
      const empDeptKey = normalizeDepartment(emp.boPhan);
      if (selectedDeptKeys.size > 0 && !selectedDeptKeys.has(empDeptKey))
        continue;
      if (showOnlyUnattendedFilter && !isEmployeeQuickUnattended(emp)) continue;
      if (!employeeMatchesLoaiPhepFilter(emp, loaiPhepFilter)) continue;
      if (emp.caLamViec) shifts.add(emp.caLamViec);
    }
    return Array.from(shifts).sort();
  }, [
    employees,
    departmentListFilter,
    normalizeDepartment,
    showOnlyUnattendedFilter,
    loaiPhepFilter,
  ]);

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

  const seasonalModalFieldClass =
    "w-full rounded-lg border-2 border-blue-200 bg-white p-2 text-sm font-bold shadow-sm transition focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-blue-800 dark:bg-slate-950 dark:text-slate-100";

  const handleGioVaoTimeInput = useCallback((e) => {
    setForm((prev) => ({ ...prev, gioVao: e.target.value || "" }));
  }, []);

  const handleLoaiPhepSelect = useCallback((e) => {
    const v = e.target.value;
    setForm((prev) => ({
      ...prev,
      loaiPhep: v === "" ? "" : canonicalAttendanceLoaiPhep(v),
    }));
  }, []);

  // Handle submit (add/update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.pleaseLogin"),
      });
      return;
    }

    if (editing) {
      const existing = employees.find((emp) => emp.id === editing);
      if (!existing) {
        setAlert({
          show: true,
          type: "error",
          message: t("attendanceList.error"),
        });
        return;
      }
      if (!canEditEmployee(existing)) {
        setAlert({
          show: true,
          type: "error",
          message: t("attendanceList.error"),
        });
        return;
      }
    } else if (!canAddEmployeeForDepartment(form.boPhan)) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.error"),
      });
      return;
    }

    try {
      const payload = { ...form };
      delete payload.chamCong;
      if (editing) {
        const empRef = ref(db, `seasonalAttendance/${selectedDate}/${editing}`);
        const snap = await get(empRef);
        const existingRaw = snap.val() || {};
        await set(
          empRef,
          mergeAttendanceDayNodeForPersist(existingRaw, payload, editing),
        );
        setShowModal(false); // Đóng popup sau khi cập nhật thành công
        setAlert({
          show: true,
          type: "success",
          message: "✅ Cập nhật thành công",
        });
        setEditing(null);
      } else {
        const newRef = push(ref(db, `seasonalAttendance/${selectedDate}`));
        const newKey = newRef.key;
        await set(
          newRef,
          mergeAttendanceDayNodeForPersist({}, payload, newKey),
        );
        setShowModal(false); // Đóng popup sau khi thêm mới thành công
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
        loaiPhep: "",
        gioRa: "",
        caLamViec: "",
      });
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
          message: t("attendanceList.pleaseLogin"),
        });
        return;
      }
      if (
        !canEditAttendanceForEmployee({
          user,
          userRole,
          userDepartments,
          employee: emp,
        })
      ) {
        setAlert({
          show: true,
          type: "error",
          message: t("attendanceList.error"),
        });
        return;
      }
      let next = { ...emp };
      const gv = String(next.gioVao ?? "").trim();
      const lp = String(next.loaiPhep ?? "").trim();
      if (!lp && gv && !looksLikeGioVaoTime(gv)) {
        next = { ...next, loaiPhep: gv, gioVao: "" };
      }
      next = { ...next, loaiPhep: canonicalAttendanceLoaiPhep(next.loaiPhep) };
      setEditing(emp.id);
      setForm(next);
      setShowModal(true);
    },
    [user, userRole, userDepartments, t],
  );

  // Handle delete
  const handleDelete = useCallback(
    async (id) => {
      if (!user) {
        setAlert({
          show: true,
          type: "error",
          message: t("attendanceList.pleaseLogin"),
        });
        return;
      }
      const emp = employees.find((e) => e.id === id);
      if (!emp || !canDeleteEmployeeData(user, userRole)) {
        setAlert({
          show: true,
          type: "error",
          message: t("attendanceList.error"),
        });
        return;
      }
      if (
        !canEditAttendanceForEmployee({
          user,
          userRole,
          userDepartments,
          employee: emp,
        })
      ) {
        setAlert({
          show: true,
          type: "error",
          message: t("attendanceList.error"),
        });
        return;
      }
      if (!window.confirm(t("attendanceList.deleteConfirm"))) return;

      try {
        await remove(ref(db, `seasonalAttendance/${selectedDate}/${id}`));
        setAlert({
          show: true,
          type: "success",
          message: t("attendanceList.deleteSuccess", {
            component: "attendance",
          }),
        });
      } catch (err) {
        setAlert({
          show: true,
          type: "error",
          message: t("common.deleteFail"),
        });
      }
    },
    [user, userRole, userDepartments, employees, selectedDate, t],
  );

  // Handle upload Excel
  const handleUploadExcel = useCallback(
    async (e) => {
      if (!user) {
        setAlert({
          show: true,
          type: "error",
          message: "Vui lòng đăng nhập để thực hiện thao tác này",
        });
        return;
      }
      if (!isAdminAccess(user, userRole)) {
        setAlert({
          show: true,
          type: "error",
          message: "Chỉ admin mới được upload Excel!",
        });
        return;
      }

      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const data = await file.arrayBuffer();
        // ⚠️ KHÔNG dùng cellDates: true để tránh lỗi timezone
        const workbook = XLSX.read(data, {
          type: "array",
          cellDates: false, // Giữ nguyên số serial, tự parse sau
        });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error("File Excel không có sheet");
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Đọc dạng mảng để bỏ qua 2 dòng header (VN + EN)
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          raw: false, // Trả về giá trị đã format
        });

        if (!Array.isArray(rows) || rows.length <= 2) {
          throw new Error("File trống hoặc không đọc được dữ liệu");
        }

        // Bỏ 2 dòng tiêu đề, phần còn lại là dữ liệu
        const dataRows = rows.slice(2);

        // ✅ Hàm parse ngày CHUẨN - tránh lệch timezone
        const normalizeDate = (value) => {
          if (value == null || value === "") return "";

          const fmt = (y, m, d) =>
            y && m && d
              ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(
                  2,
                  "0",
                )}`
              : "";

          // 1️⃣ Số serial Excel (QUAN TRỌNG NHẤT)
          if (typeof value === "number" && Number.isFinite(value)) {
            // Parse trực tiếp từ serial number
            const parsed = XLSX.SSF.parse_date_code(value, {
              date1904: workbook?.Workbook?.WBProps?.date1904 || false,
            });
            if (parsed?.y && parsed?.m && parsed?.d) {
              return fmt(parsed.y, parsed.m, parsed.d);
            }
          }

          // 2️⃣ Date object (nếu có - nhưng không nên xảy ra với cellDates: false)
          if (value instanceof Date && !isNaN(value)) {
            return fmt(
              value.getUTCFullYear(),
              value.getUTCMonth() + 1,
              value.getUTCDate(),
            );
          }

          // 3️⃣ Chuỗi ngày đã được format
          if (typeof value === "string") {
            const str = value.trim();
            if (!str) return "";

            // yyyy-mm-dd hoặc yyyy/mm/dd
            const iso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
            if (iso) return fmt(+iso[1], +iso[2], +iso[3]);

            // dd-mm-yyyy hoặc dd/mm/yyyy
            const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
            if (dmy) return fmt(+dmy[3], +dmy[2], +dmy[1]);

            // dd-MMM-yy (9-Feb-96)
            const monthNames = {
              jan: 1,
              feb: 2,
              mar: 3,
              apr: 4,
              may: 5,
              jun: 6,
              jul: 7,
              aug: 8,
              sep: 9,
              oct: 10,
              nov: 11,
              dec: 12,
            };
            const dmyText = str.match(
              /^(\d{1,2})[-\s]?([a-zA-Z]{3})[-\s]?(\d{2,4})$/i,
            );
            if (dmyText) {
              const day = +dmyText[1];
              const mon = monthNames[dmyText[2].toLowerCase()];
              if (mon) {
                let year = +dmyText[3];
                // Pivot year: 70-99 -> 1970-1999, 00-69 -> 2000-2069
                if (year < 100) {
                  year = year >= 70 ? 1900 + year : 2000 + year;
                }
                return fmt(year, mon, day);
              }
            }
          }

          return "";
        };

        // Prepare data for Firebase
        // Use the selectedDate from the date picker, not the current date
        const attendanceRef = ref(db, `seasonalAttendance/${selectedDate}`);
        const dataToUpload = {};

        // Chuẩn hóa MNV để tránh lệch kiểu dữ liệu (number/string) gây trùng.
        const normalizeMNV = (value) => {
          if (value === undefined || value === null) return "";
          const strValue = String(value).trim();
          if (!strValue) return "";
          const numericValue = Number(strValue);
          return Number.isFinite(numericValue)
            ? String(numericValue)
            : strValue;
        };

        const trimCell = (value) =>
          value === undefined || value === null ? "" : String(value).trim();

        dataRows.forEach((row, index) => {
          // Kỳ vọng thứ tự cột: STT, MNV, MVT, Họ và tên, Giới tính, Ngày bắt đầu, Mã BP, Bộ phận, Thời gian vào, Thời gian ra, Ca làm việc
          const [
            stt,
            mnv,
            mvt,
            hoVaTen,
            gioiTinh,
            ngayThangNamSinh,
            maBoPhan,
            boPhan,
            gioVao,
            gioRa,
            caLamViec,
          ] = row;

          // Bỏ qua dòng trống hoàn toàn
          const hasValue = row.some((cell) => String(cell || "").trim() !== "");
          if (!hasValue) return;

          // Chỉ giữ các dòng có MNV là số
          const mnvNum = Number(mnv);
          if (!Number.isFinite(mnvNum) || mnvNum === 0) return;

          const normalizedMNV = normalizeMNV(mnvNum);
          if (!normalizedMNV) return;

          // Trong cùng 1 file, nếu trùng MNV thì lấy dòng xuất hiện sau cùng.
          const existingUploadKey = Object.keys(dataToUpload).find(
            (k) => normalizeMNV(dataToUpload[k]?.mnv) === normalizedMNV,
          );
          if (existingUploadKey) {
            delete dataToUpload[existingUploadKey];
          }

          const empKey = `emp_${index}`;
          const excelHasStt =
            trimCell(stt) !== "" && Number.isFinite(Number(stt));
          const sttNum = excelHasStt
            ? Number(stt)
            : Object.keys(dataToUpload).length + 1;

          dataToUpload[empKey] = {
            id: empKey,
            stt: sttNum,
            mnv: normalizedMNV,
            mvt: mvt || "",
            hoVaTen: hoVaTen || "",
            gioiTinh: gioiTinh || "YES",
            ngayThangNamSinh: normalizeDate(ngayThangNamSinh),
            maBoPhan: maBoPhan || "",
            boPhan: boPhan || "",
            gioVao: gioVao || "",
            gioRa: gioRa || "",
            caLamViec: caLamViec || "",
            _excelHasStt: excelHasStt,
          };
        });
        // Upload: chỉ merge Excel + `seasonalAttendance/{ngày}` đã có (một snapshot), không trộn nguồn khác.
        let uploadedCount = 0;
        let duplicateCount = 0;

        const snapshot = await get(attendanceRef);
        const existingData = snapshot.val() || {};
        const existingKeyByMNV = {};
        Object.entries(existingData).forEach(([key, emp]) => {
          const normalizedMNV = normalizeMNV(emp?.mnv);
          if (normalizedMNV && !existingKeyByMNV[normalizedMNV]) {
            existingKeyByMNV[normalizedMNV] = key;
          }
        });

        // Merge new data with existing data, avoiding duplicates
        const mergedData = { ...existingData };

        Object.entries(dataToUpload).forEach(([key, newEmp]) => {
          const normalizedNewMNV = normalizeMNV(newEmp?.mnv);
          const existingKey = existingKeyByMNV[normalizedNewMNV];
          const isDuplicate = Boolean(existingKey);

          if (isDuplicate) {
            if (existingKey) {
              const oldEmp = mergedData[existingKey] || {};
              const mergedEmp = mergeAttendanceExcelIntoExistingRecord(
                oldEmp,
                newEmp,
              );
              mergedData[existingKey] = mergedEmp;
            }
            duplicateCount++;
          } else {
            let rec = stripAttendanceExcelUploadInternalFields({ ...newEmp });
            if (!hasAttendanceExcelCellValue(rec.gioiTinh))
              rec.gioiTinh = "YES";
            mergedData[key] = rec;
            if (normalizedNewMNV) {
              existingKeyByMNV[normalizedNewMNV] = key;
            }
            uploadedCount++;
          }
        });

        const payload = {};
        Object.entries(mergedData).forEach(([k, v]) => {
          payload[k] = stripAttendanceExcelUploadInternalFields(v);
        });
        await set(attendanceRef, payload);

        // Show result message
        let message = `✅ Upload thành công ${uploadedCount} nhân viên mới`;
        if (duplicateCount > 0) {
          message += `, cập nhật ${duplicateCount} nhân viên đã tồn tại`;
        }
        setAlert({
          show: true,
          type: "success",
          message: message,
        });
      } catch (err) {
        console.error("Upload Excel error:", err);
        setAlert({
          show: true,
          type: "error",
          message:
            "❌ Lỗi khi upload file: " +
            getUploadErrorMessage(err, "Vui lòng kiểm tra định dạng file"),
        });
      } finally {
        resetInput();
        setIsUploadingExcel(false);
      }
    },
    [user, userRole, selectedDate, isUploadingExcel],
  );

  // Handle delete all data for selected date
  const handleDeleteAllData = useCallback(async () => {
    if (!user) {
      setAlert({
        show: true,
        type: "error",
        message: "Vui lòng đăng nhập để thực hiện thao tác này",
      });
      return;
    }
    if (!isAdminAccess(user, userRole)) {
      setAlert({
        show: true,
        type: "error",
        message: "Chỉ admin mới được phép xóa toàn bộ dữ liệu!",
      });
      return;
    }
    // Hiển thị dialog xác nhận với thông tin ngày
    const confirmMessage = `⚠️ CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu chấm công ngày ${selectedDate}?\n\nNhánh bị xóa: Nhân viên thời vụ/${selectedDate}\nSố lượng: ${employees.length} nhân viên\n\nThao tác này CHỈ xóa DS ở Nhân viên thời vụ/${selectedDate}, không xóa nhánh khác.\n\nHành động này KHÔNG THỂ HOÀN TÁC!`;
    if (!window.confirm(confirmMessage)) return;
    // Xác nhận lần 2
    const finalConfirm = `Nhập 'XOA' (viết hoa) để xác nhận xóa nhánh Nhân viên thời vụ/${selectedDate}:`;
    const userInput = window.prompt(finalConfirm);
    if (userInput !== "XOA") {
      setAlert({
        show: true,
        type: "info",
        message: "❌ Đã hủy thao tác xóa",
      });
      return;
    }
    try {
      // Xóa toàn bộ dữ liệu của ngày đã chọn
      await remove(ref(db, `seasonalAttendance/${selectedDate}`));
      setAlert({
        show: true,
        type: "success",
        message: `✅ Đã xóa toàn bộ ${employees.length} bản ghi trong seasonalAttendance/${selectedDate}`,
      });
    } catch (err) {
      console.error("Delete all data error:", err);
      setAlert({
        show: true,
        type: "error",
        message:
          "❌ Lỗi khi xóa dữ liệu: " + (err?.message || "Vui lòng thử lại"),
      });
    }
  }, [user, userRole, selectedDate, employees.length]);

  // Export to Excel (moved to external component)

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
        "vi-VN",
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
          emp.ngayVaoLam || "",
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
      // Excel serial date: 1 = 1900-01-01, JS Date: 1970-01-01
      // Remove -1 day offset (was causing -1 day bug)
      const date = new Date((value - 25569) * 86400 * 1000 + 0.5); // +0.5 to avoid timezone issues
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
        margin: 1;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
      }
      html {
        margin: 0 !important;
        padding: 0 !important;
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
      margin: 0;
      padding: 5mm;
      width: 100%;
      max-width: 210mm;
      box-sizing: border-box;
    }
    
    .header {
      text-align: center;
      margin-bottom: 8px;
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
      margin: 2px 0;
      color: #000;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 5px;
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
      margin-top: 8px;
      display: flex;
      justify-content: space-around;
    }
    
    .signature {
      text-align: center;
      width: 30%;
    }
    
    .signature-title {
      font-weight: bold;
      margin-bottom: 20px;
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
            <td style="height: 50px;">&nbsp;</td>
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
      <tr style="height: 70px;">
        <th style="width: 3%;">STT</th>
        <th style="width: 5%;">MNV</th>
        <th style="width: 26%;">Họ và tên</th>
        <th style="width: 7%;">Ngày bắt đầu</th>
        <th style="width: 5%;">Mã BP</th>
        <th style="width: 11%;">Bộ phận</th>
        <th style="width: 7%;">Tổng thời gian tăng ca</th>
        <th style="width: 8%;">Thời gian dự kiến<br/>Từ …h đến …h</th>
        <th style="width: 5%;">Thời gian làm thêm<br/>(Hrs)</th>
        <th style="width: 9%;">Chữ ký người lao động</th>
        <th style="width: 8%;">Thời gian thực tế<br/>Từ …h đến …h</th>
        <th style="width: 5%;">Số giờ làm thêm/ ngày</th>
        <th style="width: 5%;">Ghi chú</th>
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
        <td>${emp.ngayVaoLam || ""}</td>
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

  // Print main attendance list (using current filters)
  const handlePrintAttendanceList = useCallback(() => {
    if (filteredEmployees.length === 0) {
      setAlert({
        show: true,
        type: "error",
        message: "⚠️ Không có nhân viên trong danh sách!",
      });
      return;
    }

    const dateStr = new Date(selectedDate).toLocaleDateString("vi-VN");
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

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Danh sách chấm công - ${dateStr}</title>
  <style>
    @media print {
      @page { size: A4 portrait; margin: 5mm; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
      body { margin: 0; padding: 0; }
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 9pt;
      line-height: 1.25;
      color: #000;
      background: #fff;
      margin: 0 auto;
      padding: 6mm;
      width: 100%;
      max-width: 210mm;
      box-sizing: border-box;
    }
    .top-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .company-header { 
      display: flex; 
      align-items: flex-start;
      flex: 1;
    }
    .company-logo { 
      width: 70px; 
      height: auto; 
      margin-right: 12px;
      flex-shrink: 0;
    }
    .company-info { 
      flex: 1; 
      text-align: left;
    }
    .company-info .company-name { 
      font-size: 10pt; 
      font-weight: bold; 
      margin: 0 0 3px 0;
      color: #000;
    }
    .company-info .company-address { 
      font-size: 7.5pt; 
      margin: 1px 0;
      line-height: 1.2;
      font-style: italic;
    }
    .approval-table {
      width: 280px;
      border-collapse: collapse;
      font-size: 7pt;
      margin-left: 15px;
    }
    .approval-table th {
      border: 1px solid #000;
      padding: 6px 5px;
      text-align: center;
      font-weight: bold;
      background: #fff;
    }
    .approval-table td {
      border: 1px solid #000;
      padding: 15px 3px;
      text-align: center;
    }
    .detail-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 6.5pt;
      margin-bottom: 8px;
      table-layout: fixed;
    }
    .detail-table td {
      border: 1px solid #000;
      padding: 2px 4px;
      text-align: left;
    }
    .detail-table .label-col {
      width: 8%;
      font-weight: bold;
    }
    .detail-table .value-col {
      width: 2%;
      text-align: center;
    }
    .detail-table .desc-col {
      width: 18%;
    }
    .red-text {
      color: #c41e3a;
      font-weight: bold;
      font-size: 8.5pt;
      margin: 6px 0;
    }
    .header { text-align: center; margin-bottom: 8px; margin-top: 5px; }
    .header h1 { margin: 0; font-size: 12pt; font-weight: bold; color: #000; letter-spacing: .3px; text-transform: uppercase; }
    .header .subtitle { font-size: 10pt; font-weight: bold; margin: 2px 0; }
    .header .date { margin-top: 3px; font-weight: bold; font-size: 9pt; }
    table.data-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7pt; border: 1px solid #000; }
    table.data-table th, table.data-table td { border: 1px dashed rgba(0,0,0,0.5); padding: 3px 2px; text-align: center; vertical-align: middle; }
    table.data-table th { background: #b0b0b0; font-weight: bold; }
    table.data-table .name { text-align: left; padding-left: 4px; }
    table.data-table .dept { text-align: left; padding-left: 4px; }
    table.data-table tbody tr:nth-child(even) { background: #e8f4f8; }
    .print-button { position: fixed; top: 10px; right: 10px; padding: 8px 14px; background: #2196F3; color: #fff; border: none; border-radius: 5px; font-size: 12px; font-weight: bold; cursor: pointer; z-index: 1000; }
    .close-button { position: fixed; top: 10px; right: 72px; padding: 8px 14px; background: #f44336; color: #fff; border: none; border-radius: 5px; font-size: 12px; font-weight: bold; cursor: pointer; z-index: 1000; }
  </style>
  <script>
    function doPrint(){ window.print(); }
    function doClose(){ window.close(); }
  </script>
  </head>
  <body>
    <button class="print-button no-print" onclick="doPrint()">🖨️ In</button>
    <button class="close-button no-print" onclick="doClose()">✕ Đóng</button>
    
    <div class="top-section">
      <div class="company-header">
        <img src="/picture/logo/logo.png" alt="Pavonine Logo" class="company-logo" onerror="this.style.display='none'">
        <div class="company-info">
          <div class="company-name">CÔNG TY TNHH PAVONINE VINA</div>
          <div class="company-address">Lots VII-1, VII-2, and part of Lot VII-3, My Xuan B1 – Tien Hung</div>
          <div class="company-address">Industrial Park, Phu My Ward, Ho Chi Minh City, Vietnam</div>
        </div>
      </div>
      
      <table class="approval-table">
        <tr>
          <th>Người lập /<br/>Prepared by</th>
          <th>Kiểm tra /<br/>Reviewed by</th>
          <th>Phê duyệt /<br/>Approved by</th>
        </tr>
        <tr>
          <td style="height: 40px;"></td>
          <td style="height: 40px;"></td>
          <td style="height: 40px;"></td>
        </tr>
      </table>
    </div>

    <table class="detail-table">
      <tr>
        <td class="label-col">Ca ngày</td>
        <td class="value-col">S1</td>
        <td class="desc-col">1.Phép năm/Annual Leave</td>
        <td class="value-col">PN</td>
        <td class="desc-col">6.Không Lương/Unpaid Leave</td>
        <td class="value-col">KL</td>
      </tr>
      <tr>
        <td class="label-col">Ca đêm</td>
        <td class="value-col">S2</td>
        <td class="desc-col">2.1/2 ngày phép năm/1/2 day annual Leave</td>
        <td class="value-col">1/2 PN</td>
        <td class="desc-col">7.Không phép/Illegal Leave</td>
        <td class="value-col">KP</td>
      </tr>
      <tr>
        <td class="label-col"></td>
        <td class="value-col"></td>
        <td class="desc-col">3.Nghỉ TNLĐ/Labor accident</td>
        <td class="value-col">TN</td>
        <td class="desc-col">8.Nghỉ ốm/Sick Leave</td>
        <td class="value-col">PO</td>
      </tr>
      <tr>
        <td class="label-col"></td>
        <td class="value-col"></td>
        <td class="desc-col">4.Phép cưới/Wedding Leave</td>
        <td class="value-col">PC</td>
        <td class="desc-col">9.Thai sản/Maternity</td>
        <td class="value-col">TS</td>
      </tr>
      <tr>
        <td class="label-col"></td>
        <td class="value-col"></td>
        <td class="desc-col">5.Phép tang/Funeral Leave</td>
        <td class="value-col">PT</td>
        <td class="desc-col">10.Dưỡng sức/Recovery health</td>
        <td class="value-col">DS</td>
      </tr>
      <tr>
        <td class="label-col"></td>
        <td class="value-col"></td>
        <td class="desc-col"></td>
        <td class="value-col"></td>
        <td class="desc-col">11.Nghỉ việc/Resignation</td>
        <td class="value-col">NV</td>
      </tr>
    </table>
    
    <div class="header">
      <h1>DANH SÁCH NHÂN VIÊN THỜI VỤ HIỆN DIỆN</h1>
      <div class="subtitle">List of Active Seasonal Employees</div>
      <div class="date">Ngày/Date: ${dateStr}</div>
    </div>

    <div class="red-text">Số lượng cơm ca trưa:</div>
    
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:4%">STT</th>
          <th style="width:7%">MNV</th>
          <th style="width:7%">MVT</th>
          <th style="width:34%">Họ và tên</th>
          <th style="width:8%">Giới tính</th>
          <th style="width:12%">Ngày vào làm</th>
          <th style="width:7%">Mã BP</th>
          <th style="width:14%">Bộ phận</th>
          <th style="width:7%">Thời gian vào</th>
          <th style="width:8%">Thời gian ra</th>
          <th style="width:7%">Loại phép</th>
          <th style="width:7%">Ca làm việc</th>
        </tr>
      </thead>
      <tbody>`;

    // Hàm kiểm tra sinh nhật trong tháng
    function isBirthdayThisMonth(ngayThangNamSinh) {
      if (!ngayThangNamSinh) return false;
      let dateObj;
      if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(ngayThangNamSinh)) {
        const [y, m, d] = ngayThangNamSinh.split(/[-\/]/);
        dateObj = new Date(Number(y), Number(m) - 1, Number(d));
      } else if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(ngayThangNamSinh)) {
        const [d, m, y] = ngayThangNamSinh.split(/[-\/]/);
        dateObj = new Date(Number(y), Number(m) - 1, Number(d));
      } else {
        return false;
      }
      const now = new Date();
      return (
        dateObj &&
        dateObj.getMonth() === now.getMonth() &&
        !isNaN(dateObj.getTime())
      );
    }

    filteredEmployees.forEach((emp, idx) => {
      const gioiTinh = emp.gioiTinh || "";
      const isBirthday = isBirthdayThisMonth(emp.ngayThangNamSinh);
      html += `
        <tr>
          <td>${emp.stt || idx + 1}</td>
          <td>${emp.mnv || ""}</td>
          <td>${emp.mvt || ""}</td>
          <td class="name">${emp.hoVaTen || ""}${
            isBirthday
              ? ' <span title="Sinh nhật tháng này" style="margin-left:4px;font-size:8px;">🎂</span>'
              : ""
          }</td>
            <td>${gioiTinh}</td>
            <td>${emp.ngayVaoLam || ""}</td>
            <td>${emp.maBoPhan || ""}</td>
            <td class="dept">${emp.boPhan || ""}</td>
            <td style="${
              formatAttendanceTimeInColumnDisplay(emp.gioVao || "")
                ? "color:#15803d;font-weight:bold;"
                : ""
            }">${formatAttendanceTimeInColumnDisplay(emp.gioVao || "")}</td>
            <td>${emp.gioRa || ""}</td>
            <td style="${getAttendanceLeaveTypePrintStyleAttrForEmployee(emp)}">${formatAttendanceLeaveTypeColumnForEmployee(emp)}</td>
            <td>${emp.caLamViec || ""}</td>
        </tr>`;
    });

    html += `
      </tbody>
    </table>
    <script>
      window.onload = function(){ document.querySelector('.print-button').focus(); };
    <\/script>
  </body>
  </html>`;

    printWindow.document.write(html);
    printWindow.document.close();

    setAlert({
      show: true,
      type: "success",
      message: `✅ Mở cửa sổ in danh sách chấm công (${filteredEmployees.length} nhân viên)`,
    });
  }, [filteredEmployees, selectedDate]);

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
        "vi-VN",
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
        "Thời gian làm thêm giờ",
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
          emp.ngayVaoLam || "",
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

  // Export Bu Cong Excel
  const handleExportBuCongExcel = useCallback(async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Danh Sach Bu Cong");

      // Set column widths
      worksheet.columns = [
        { width: 8 },
        { width: 12 },
        { width: 20 },
        { width: 20 },
        { width: 12 },
        { width: 12 },
      ];

      // Add header row
      const headerRow = worksheet.addRow([
        "STT",
        "MNV",
        "Họ và tên",
        "Bộ phận",
        "Giờ vào",
        "Giờ ra",
      ]);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1976D2" },
      };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      headerRow.height = 18;

      // Add data rows
      buCongEmployees.forEach((emp, idx) => {
        const dataRow = worksheet.addRow([
          idx + 1,
          emp.mnv || "",
          emp.hoVaTen || "",
          emp.boPhan || "",
          formatAttendanceTimeInColumnDisplay(emp.gioVao),
          emp.gioRa || "",
        ]);
        dataRow.alignment = { horizontal: "center", vertical: "middle" };
        dataRow.height = 16;
      });

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bu-cong-${selectedDate}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      setAlert({
        show: true,
        type: "success",
        message: `✅ Xuất danh sách bù công thành công! ${buCongEmployees.length} nhân viên.`,
      });
    } catch (error) {
      console.error("Error exporting Bu Cong Excel:", error);
      setAlert({
        show: true,
        type: "error",
        message: `❌ Xuất danh sách bù công thất bại! ${error.message || ""}`,
      });
    }
  }, [buCongEmployees, selectedDate]);

  return (
    <>
      {/* Main Content */}
      <div className="p-2 md:p-4 transition-all duration-300">
        {/* Header */}
        <div className="mb-2 md:mb-3">
          <div className="rounded-lg border-t-4 border-blue-600 bg-white px-3 py-2 md:px-4 md:py-2 shadow-md dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
            <div>
              <div className="flex flex-wrap items-end gap-2">
                <h1 className="text-xl md:text-2xl font-extrabold leading-tight text-[#1e293b] uppercase tracking-wide">
                  {tl(
                    "seasonalActiveEmployeesTitle",
                    "DANH SÁCH NHÂN VIÊN THỜI VỤ HIỆN DIỆN",
                  )}
                </h1>
                <Link
                  to="/attendance-list"
                  className="mb-0.5 ml-10 inline-flex items-center gap-1 text-xs md:text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <span aria-hidden>→</span>
                  {tl("activeEmployeesTitle", "DANH SÁCH NHÂN VIÊN HIỆN DIỆN")}
                </Link>
              </div>
              <p className="text-sm text-gray-600 mt-0.5 leading-snug">
                {tl(
                  "seasonalActiveEmployeesSubtitle",
                  "List of Active Seasonal Employees",
                )}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {tl("dateLabel", "Ngày/Date")}:{" "}
                {new Date(selectedDate).toLocaleDateString(displayLocale)}
              </p>
            </div>
          </div>
        </div>

        <AlertMessage alert={alert} />

        {/* Filters and Actions */}
        <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 w-full shrink-0 rounded-md border bg-white px-2 text-sm font-semibold text-blue-700 focus:ring-2 focus:ring-blue-300 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-300 sm:w-auto"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("attendanceList.searchPlaceholder")}
              className="h-8 w-full min-w-0 rounded-md border px-2 text-sm focus:ring-2 focus:ring-blue-200 sm:w-48"
            />
          </div>
          <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:shrink-0 sm:justify-end">
            {/* Filter Button */}
            <div className="relative z-40 shrink-0">
              <button
                type="button"
                onClick={() => setFilterOpen(!filterOpen)}
                className={`inline-flex h-8 w-auto max-w-full items-center justify-center gap-0.5 whitespace-nowrap rounded-lg border border-slate-300 px-1 text-xs font-bold shadow transition sm:text-sm ${
                  departmentListFilter.length > 0 ||
                  loaiPhepFilter.length > 0 ||
                  isQuickNoCheckInActive
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
              >
                🔽 {tl("filter", "Bộ lọc")}
                <span className="text-xs">
                  {departmentListFilter.length > 0 ||
                  loaiPhepFilter.length > 0 ||
                  isQuickNoCheckInActive
                    ? "✓"
                    : ""}
                </span>
              </button>

              {/* Bộ lọc nâng cao — portal + layout giống Điểm danh NV chính thức */}
              {filterOpen &&
                createPortal(
                  <div
                    className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm animate-fadeIn"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="seasonal-advanced-filter-title"
                  >
                    <div className="flex h-[min(620px,85vh)] w-full max-w-md min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl animate-slideUp dark:border-slate-600 dark:bg-slate-900 dark:shadow-black/40">
                      <div className="shrink-0 border-b border-blue-100/80 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 px-4 py-2.5 relative overflow-hidden">
                        <div className="absolute inset-0 bg-white opacity-10"></div>
                        <div className="relative z-10">
                          <h3
                            id="seasonal-advanced-filter-title"
                            className="font-bold text-white text-lg flex items-center gap-1.5 leading-tight"
                          >
                            <span className="text-xl shrink-0">🔍</span>
                            {t("attendanceList.advancedFilter")}
                          </h3>
                          <p className="text-[11px] text-blue-50/95 mt-1 font-medium leading-snug">
                            {tl(
                              "advancedFilterAutoUpdate",
                              "Chọn điều kiện lọc • Kết quả tự động cập nhật",
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
                        {/* Department — giống AttendanceList */}
                        <div className="mb-3">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedSections((prev) => ({
                                ...prev,
                                department: !prev.department,
                              }));
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-orange-200 dark:border-orange-900/40 dark:from-orange-950/40 dark:to-amber-950/30"
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-orange-500 text-base">
                                🏢
                              </span>
                              <span>{tl("department", "Bộ phận")}</span>
                            </span>
                            <span className="text-orange-600 font-bold">
                              {expandedSections.department ? "▼" : "▶"}
                            </span>
                          </button>
                          {expandedSections.department && (
                            <div className="border-2 border-orange-100 rounded-lg mt-2 bg-gradient-to-b from-white to-orange-50/30 shadow-inner dark:border-orange-900/35">
                              <input
                                type="text"
                                value={filterDepartmentSearch}
                                onChange={(e) =>
                                  setFilterDepartmentSearch(e.target.value)
                                }
                                placeholder={t(
                                  "attendanceList.searchDepartment",
                                )}
                                className="w-full border-b border-orange-200 h-8 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:border-orange-800 dark:bg-slate-900/80"
                              />
                              <div className="max-h-84 overflow-y-auto">
                                {departments.length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-gray-500 italic dark:text-slate-400">
                                    {tl("noData", "Không có dữ liệu")}
                                  </div>
                                ) : (
                                  <>
                                    <label className="flex items-center px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm border-b-2 border-orange-200 bg-orange-50/50 font-semibold">
                                      <input
                                        type="checkbox"
                                        checked={
                                          departmentListFilter.length ===
                                          departments.filter((dept) =>
                                            dept
                                              .toLowerCase()
                                              .includes(
                                                filterDepartmentSearch.toLowerCase(),
                                              ),
                                          ).length
                                        }
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setDepartmentListFilter([
                                              ...departments.filter((dept) =>
                                                dept
                                                  .toLowerCase()
                                                  .includes(
                                                    filterDepartmentSearch.toLowerCase(),
                                                  ),
                                              ),
                                            ]);
                                          } else {
                                            setDepartmentListFilter([]);
                                          }
                                        }}
                                        className="mr-2 w-4 h-4 cursor-pointer"
                                      />
                                      ✓ {tl("selectAll", "Chọn tất cả")}
                                    </label>
                                    {departments
                                      .filter((dept) =>
                                        dept
                                          .toLowerCase()
                                          .includes(
                                            filterDepartmentSearch.toLowerCase(),
                                          ),
                                      )
                                      .map((dept) => (
                                        <label
                                          key={dept}
                                          className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0 dark:hover:bg-slate-800/80"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={departmentListFilter.includes(
                                              dept,
                                            )}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setDepartmentListFilter([
                                                  ...departmentListFilter,
                                                  dept,
                                                ]);
                                              } else {
                                                setDepartmentListFilter(
                                                  departmentListFilter.filter(
                                                    (d) => d !== dept,
                                                  ),
                                                );
                                              }
                                            }}
                                            className="mr-2 w-4 h-4 cursor-pointer"
                                          />
                                          {dept}
                                        </label>
                                      ))}
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Loại phép — giống AttendanceList */}
                        <div className="mb-3">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedSections((prev) => ({
                                ...prev,
                                leaveType: !prev.leaveType,
                              }));
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-50 to-teal-50 hover:from-green-100 hover:to-teal-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-green-200"
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-green-500 text-base">
                                📋
                              </span>
                              <span>{tl("leaveTypeFilter", "Loại phép")}</span>
                            </span>
                            <span className="text-green-600 font-bold">
                              {expandedSections.leaveType ? "▼" : "▶"}
                            </span>
                          </button>
                          {expandedSections.leaveType && (
                            <div className="border-2 border-green-100 rounded-lg mt-2 bg-gradient-to-b from-white to-green-50/30 shadow-inner">
                              <div className="max-h-80 overflow-y-auto">
                                <label className="flex items-center px-3 py-2 hover:bg-green-50 cursor-pointer text-sm border-b-2 border-green-200 bg-green-50/50 font-semibold">
                                  <input
                                    type="checkbox"
                                    checked={
                                      allLeaveTypeFilterValues.length > 0 &&
                                      allLeaveTypeFilterValues.every((v) =>
                                        loaiPhepFilter.includes(v),
                                      )
                                    }
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setLoaiPhepFilter([
                                          ...allLeaveTypeFilterValues,
                                        ]);
                                      } else {
                                        setLoaiPhepFilter((prev) =>
                                          prev.filter(
                                            (x) =>
                                              !allLeaveTypeFilterValues.includes(
                                                x,
                                              ),
                                          ),
                                        );
                                      }
                                    }}
                                    className="mr-2 w-4 h-4 cursor-pointer"
                                  />
                                  ✓ {tl("selectAll", "Chọn tất cả")}
                                </label>
                                <label className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100">
                                  <input
                                    type="checkbox"
                                    checked={loaiPhepFilter.includes(
                                      ATTENDANCE_LEAVE_FILTER_NONE,
                                    )}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setLoaiPhepFilter((prev) => [
                                          ...prev,
                                          ATTENDANCE_LEAVE_FILTER_NONE,
                                        ]);
                                      } else {
                                        setLoaiPhepFilter((prev) =>
                                          prev.filter(
                                            (x) =>
                                              x !==
                                              ATTENDANCE_LEAVE_FILTER_NONE,
                                          ),
                                        );
                                      }
                                    }}
                                    className="mr-2 w-4 h-4 cursor-pointer"
                                  />
                                  {tl(
                                    "leaveTypeFilterNone",
                                    "Không có loại phép (chỉ giờ / trống)",
                                  )}
                                </label>
                                {ATTENDANCE_LOAI_PHEP_OPTIONS.map((opt) => (
                                  <label
                                    key={opt.value}
                                    className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={loaiPhepFilter.includes(
                                        opt.value,
                                      )}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setLoaiPhepFilter((prev) => [
                                            ...prev,
                                            opt.value,
                                          ]);
                                        } else {
                                          setLoaiPhepFilter((prev) =>
                                            prev.filter((v) => v !== opt.value),
                                          );
                                        }
                                      }}
                                      className="mr-2 w-4 h-4 cursor-pointer"
                                    />
                                    <span className="tabular-nums font-semibold text-gray-700">
                                      {opt.shortLabel}
                                    </span>
                                    <span className="ml-1.5 text-gray-600">
                                      — {opt.value}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Lọc nhanh — đồng bộ Điểm danh NV chính thức */}
                        <div className="mb-3 rounded-xl border-2 border-amber-200/90 bg-gradient-to-r from-amber-50/95 to-orange-50/80 p-3 shadow-sm dark:border-amber-800/50 dark:from-amber-950/30 dark:to-orange-950/20">
                          <button
                            type="button"
                            onClick={() => handleQuickNoCheckInFilter()}
                            className={`flex w-full items-center gap-3 text-left transition ${
                              isQuickNoCheckInActive
                                ? "text-amber-800 dark:text-amber-200"
                                : "text-gray-800 dark:text-slate-200"
                            }`}
                          >
                            <span className="text-xl" aria-hidden>
                              ⚡
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-sm">
                                {t("attendanceList.quickFilter")}
                              </span>
                              <span className="mt-0.5 block text-xs text-gray-600 dark:text-slate-400">
                                {tl(
                                  "notCheckedIn",
                                  "Nhân viên chưa điểm danh (không giờ vào, loại phép, ca)",
                                )}
                              </span>
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                isQuickNoCheckInActive
                                  ? "bg-amber-500 text-white"
                                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {isQuickNoCheckInActive
                                ? tl("filterOn", "Bật")
                                : tl("filterOff", "Tắt")}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="shrink-0 p-5 border-t-2 border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50 flex flex-wrap gap-3 justify-end dark:border-slate-700 dark:from-slate-900 dark:to-slate-900/95">
                        <button
                          type="button"
                          onClick={() => {
                            setDepartmentListFilter([]);
                            setLoaiPhepFilter([]);
                            setShowOnlyUnattendedFilter(false);
                            setExpandedSections({});
                            setFilterSearchTerm("");
                          }}
                          className="px-5 py-2.5 rounded-lg text-sm text-gray-700 border-2 border-gray-300 hover:border-red-400 hover:bg-red-50 hover:text-red-600 font-semibold transition-all duration-200 shadow-sm hover:shadow dark:border-slate-600 dark:text-slate-200 dark:hover:bg-red-950/40"
                        >
                          🗑️ {tl("clearAll", "Xóa tất cả")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFilterOpen(false);
                            setFilterSearchTerm("");
                          }}
                          className="px-5 py-2.5 rounded-lg text-sm bg-gradient-to-r from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                          ✖️{" "}
                          {t("attendanceList.cancel", { defaultValue: "Hủy" })}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFilterOpen(false);
                            setFilterSearchTerm("");
                          }}
                          className="px-5 py-2.5 rounded-lg text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                          ✓ {tl("apply", "Áp dụng")}
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )}
            </div>

            <button
              type="button"
              onClick={handleOvertimeButton}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-0.5 whitespace-nowrap rounded bg-orange-600 px-1 text-xs font-bold text-white shadow transition hover:bg-orange-700 sm:text-sm"
            >
              ⏰ {t("attendanceList.overtime")}
            </button>

            {/* Action Dropdown (Upload/Export/Add) */}
            {user && (
              <div className="relative action-dropdown z-40 shrink-0">
                <button
                  type="button"
                  onClick={() => setActionDropdownOpen(!actionDropdownOpen)}
                  className="inline-flex h-8 w-auto max-w-full items-center justify-center gap-0.5 whitespace-nowrap rounded bg-emerald-600 px-1 text-xs font-bold text-white shadow transition hover:bg-emerald-700 sm:text-sm"
                >
                  ⚙️ {tl("actionsMenu", "Chức năng")}
                  <span className="text-xs">
                    {actionDropdownOpen ? "▲" : "▼"}
                  </span>
                </button>
                {actionDropdownOpen && (
                  <div className="absolute left-0 top-full z-[100] mt-1.5 max-w-[calc(100vw-2rem)] w-[min(100vw-2rem,18rem)] animate-fadeIn overflow-hidden rounded-lg border-2 border-emerald-200 bg-white shadow-2xl dark:border-emerald-800 dark:bg-slate-900 sm:left-auto sm:right-0 sm:w-64">
                    {isAdminAccess(user, userRole) && (
                      <label className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group cursor-pointer">
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                          📤
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
                            {isUploadingExcel
                              ? "Đang upload..."
                              : "Upload Excel theo ngày"}
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5">
                            Import dữ liệu cho ngày:{" "}
                            <span className="font-bold text-blue-600">
                              {selectedDate}
                            </span>
                          </span>
                        </div>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          disabled={isUploadingExcel}
                          onChange={(e) => {
                            handleUploadExcel(e);
                            setActionDropdownOpen(false);
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                    <button
                      onClick={() => {
                        const exportButton = document.querySelector(
                          '[title="Xuất Excel"]',
                        );
                        if (exportButton) exportButton.click();
                        setActionDropdownOpen(false);
                      }}
                      className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group"
                    >
                      <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                        📥
                      </span>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
                          Xuất Excel
                        </span>
                        <span className="text-xs text-gray-500 mt-0.5">
                          Export to Excel file
                        </span>
                      </div>
                    </button>
                    {showRowModalActions && (
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
                            loaiPhep: "",
                            gioRa: "",
                            caLamViec: "",
                          });
                          setEditing(null);
                          setShowModal(true);
                          setActionDropdownOpen(false);
                        }}
                        className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group"
                      >
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                          ➕
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
                            {tl("addNew", "Thêm mới")}
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5">
                            Add new employee
                          </span>
                        </div>
                      </button>
                    )}
                    {user && isAdminAccess(user, userRole) && (
                      <button
                        onClick={() => {
                          handleDeleteAllData();
                          setActionDropdownOpen(false);
                        }}
                        className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-red-50 hover:to-rose-50 transition-all duration-200 flex items-center gap-3 group"
                      >
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                          🗑️
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-red-600 text-sm group-hover:text-red-700 transition-colors">
                            {tl("deleteAllData", "Xóa toàn bộ dữ liệu")}
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5">
                            Delete all data for {selectedDate}
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                )}
                {/* Hidden ExportExcelButton for functionality */}
                <div className="hidden">
                  <ExportExcelButton
                    data={filteredEmployees}
                    selectedDate={selectedDate}
                    omitWorkStatusColumn
                    title="Xuất Excel"
                    onSuccess={(msg) =>
                      setAlert({ show: true, type: "success", message: msg })
                    }
                    onError={(msg) =>
                      setAlert({ show: true, type: "error", message: msg })
                    }
                  />
                </div>
              </div>
            )}

            {/* Print Dropdown */}
            <div className="print-dropdown-menu relative z-40 shrink-0">
              <button
                type="button"
                onClick={() => setPrintDropdownOpen(!printDropdownOpen)}
                className="inline-flex h-8 w-auto max-w-full items-center justify-center gap-0.5 whitespace-nowrap rounded bg-blue-600 px-1 text-xs font-bold text-white shadow transition hover:bg-blue-700 sm:text-sm"
              >
                🖨️ {tl("print", "In")}
                <span className="text-xs">{printDropdownOpen ? "▲" : "▼"}</span>
              </button>
              {printDropdownOpen && (
                <div className="absolute left-0 top-full z-[100] mt-1.5 max-w-[calc(100vw-2rem)] w-[min(100vw-2rem,18rem)] animate-fadeIn overflow-hidden rounded-lg border-2 border-blue-200 bg-white shadow-2xl dark:border-blue-800 dark:bg-slate-900 sm:left-auto sm:right-0 sm:w-64">
                  <button
                    onClick={() => {
                      handlePrintOvertimeList();
                      setPrintDropdownOpen(false);
                    }}
                    className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                      📋
                    </span>
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800 text-sm group-hover:text-blue-700 transition-colors">
                        {tl("printOvertimeRegistration", "In đăng ký tăng ca")}
                      </span>
                      <span className="text-xs text-gray-500 mt-0.5">
                        Overtime registration form
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      handlePrintAttendanceList();
                      setPrintDropdownOpen(false);
                    }}
                    className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 flex items-center gap-3 group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                      📝
                    </span>
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800 text-sm group-hover:text-blue-700 transition-colors">
                        {tl("printAttendanceList", "In danh sách chấm công")}
                      </span>
                      <span className="text-xs text-gray-500 mt-0.5">
                        Attendance list report
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Add/Edit */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-3 sm:p-4">
            <div className="bg-gradient-to-br from-purple-50 via-white to-purple-200 rounded-2xl shadow-2xl px-4 py-4 sm:px-5 sm:py-5 w-full max-w-2xl relative mx-auto overflow-y-auto max-h-[90vh] border-2 border-blue-200 animate-fadeIn">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditing(null);
                }}
                className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-transparent p-0 text-2xl font-bold leading-none text-gray-400 transition-colors hover:bg-slate-200/80 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 dark:hover:bg-slate-700 dark:hover:text-slate-100 dark:focus-visible:ring-blue-500"
                aria-label={t("attendanceList.close")}
              >
                ×
              </button>
              <h2 className="text-xl font-extrabold mb-4 text-black tracking-wide text-center drop-shadow uppercase">
                {editing
                  ? tl("updateEmployee", "Cập nhật nhân viên")
                  : tl("addEmployee", "Thêm nhân viên mới")}
              </h2>
              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <div className="sm:col-span-2 grid min-w-0 grid-cols-3 gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                      STT
                    </label>
                    <input
                      type="number"
                      name="stt"
                      value={form.stt}
                      onChange={handleChange}
                      className="w-full rounded-lg border-2 border-blue-200 bg-white p-2 text-sm font-bold shadow-sm transition focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-blue-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                      MNV *
                    </label>
                    <input
                      type="text"
                      name="mnv"
                      value={form.mnv}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border-2 border-blue-200 bg-white p-2 text-sm font-bold shadow-sm transition focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-blue-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                      MVT
                    </label>
                    <input
                      type="text"
                      name="mvt"
                      value={form.mvt}
                      onChange={handleChange}
                      className="w-full rounded-lg border-2 border-blue-200 bg-white p-2 text-sm font-bold shadow-sm transition focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-blue-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    Họ và tên *
                  </label>
                  <input
                    type="text"
                    name="hoVaTen"
                    value={form.hoVaTen}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border-2 border-blue-200 bg-white p-2 text-sm font-bold shadow-sm transition focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-blue-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    Giới tính
                  </label>
                  <select
                    name="gioiTinh"
                    value={form.gioiTinh}
                    onChange={handleChange}
                    className="w-full rounded-lg border-2 border-blue-200 bg-white p-2 text-sm font-bold shadow-sm transition focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-blue-800 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="YES">YES (Nữ)</option>
                    <option value="NO">NO (Nam)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    Ngày vào làm
                  </label>
                  <input
                    type="date"
                    name="ngayThangNamSinh"
                    value={form.ngayThangNamSinh}
                    onChange={handleChange}
                    className="w-full rounded-lg border-2 border-blue-200 bg-white p-2 text-sm font-bold shadow-sm transition focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-blue-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    Mã bộ phận
                  </label>
                  <input
                    type="text"
                    name="maBoPhan"
                    value={form.maBoPhan}
                    onChange={handleChange}
                    className="w-full rounded-lg border-2 border-blue-200 bg-white p-2 text-sm font-bold shadow-sm transition focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-blue-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    Bộ phận *
                  </label>
                  <input
                    type="text"
                    name="boPhan"
                    value={form.boPhan}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border-2 border-blue-200 bg-white p-2 text-sm font-bold shadow-sm transition focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-blue-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("timeIn", "Giờ vào")}
                  </label>
                  <div className="flex flex-wrap items-stretch gap-2">
                    <input
                      type="time"
                      value={normalizeTimeForHtmlInput(form.gioVao) || ""}
                      onChange={handleGioVaoTimeInput}
                      className={`${seasonalModalFieldClass} min-w-0 flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, gioVao: "" }))
                      }
                      disabled={!String(form.gioVao ?? "").trim()}
                      className="shrink-0 rounded-lg border-2 border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      title={tl("timeInClearHint", "Xóa giờ vào (để trống)")}
                    >
                      {tl("clearTimeIn", "Xóa giờ vào")}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-purple-600/90">
                    {tl(
                      "gioVaoTimeOnlyHint",
                      "Giờ chấm HH:MM — có thể kết hợp với loại phép bên dưới.",
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    Giờ ra
                  </label>
                  <input
                    type="time"
                    name="gioRa"
                    value={form.gioRa}
                    onChange={handleChange}
                    className="w-full rounded-lg border-2 border-blue-200 bg-white p-2 text-sm font-bold shadow-sm transition focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-blue-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("leaveTypeColumn", "Loại phép")}
                  </label>
                  <select
                    value={String(form.loaiPhep ?? "").trim()}
                    onChange={handleLoaiPhepSelect}
                    className={seasonalModalFieldClass}
                  >
                    <option value="">
                      {tl("leaveTypePlaceholder", "— Không chọn —")}
                    </option>
                    {(() => {
                      const raw = String(form.loaiPhep ?? "").trim();
                      const isStd = Boolean(findGioVaoTypeOptionMatch(raw));
                      return !isStd && raw ? (
                        <option value={raw}>
                          {raw}{" "}
                          {tl("leaveTypeCurrentValue", "(giá trị hiện tại)")}
                        </option>
                      ) : null;
                    })()}
                    {ATTENDANCE_LOAI_PHEP_OPTIONS.map(
                      ({ value, shortLabel }) => (
                        <option key={value} value={value}>
                          {shortLabel} — {value}
                        </option>
                      ),
                    )}
                  </select>
                  <p className="mt-1 text-[11px] text-purple-600/90">
                    {tl(
                      "loaiPhepModalHint",
                      "Chọn loại phép / trạng thái — có thể vừa có giờ vào vừa có loại.",
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("workShift", "Ca làm việc")}
                  </label>
                  <select
                    name="caLamViec"
                    value={form.caLamViec ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        caLamViec: e.target.value,
                      }))
                    }
                    className={seasonalModalFieldClass}
                  >
                    <option value="">{tl("chooseShift", "Chọn ca")}</option>
                    {(() => {
                      const raw = String(form.caLamViec ?? "").trim();
                      const isStd = ATTENDANCE_CA_LAM_VIEC_OPTIONS.some(
                        (o) => o.value === raw,
                      );
                      return !isStd && raw ? (
                        <option value={raw}>
                          {raw} {tl("shiftCurrentValue", "(giá trị hiện tại)")}
                        </option>
                      ) : null;
                    })()}
                    {ATTENDANCE_CA_LAM_VIEC_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-blue-600/90">
                    {tl(
                      "caLamViecModalHint",
                      "Chọn ca chuẩn để đồng bộ với bảng điểm danh và thống kê.",
                    )}
                  </p>
                </div>
                <button
                  type="submit"
                  className="sm:col-span-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 rounded-lg font-extrabold text-sm sm:text-base mt-1 shadow-lg hover:from-blue-700 hover:to-purple-700 active:scale-95 transition-all duration-150 tracking-wide"
                >
                  {editing
                    ? t("attendanceList.update")
                    : t("attendanceList.add")}
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
                    modalDepartmentListFilter.length > 0
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800"
                      : "bg-gradient-to-r from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700"
                  }`}
                >
                  🔍 Lọc
                  {modalDepartmentListFilter.length > 0 && (
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
                    🖨️ {tl("printList", "In danh sách")}
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
                              <div className="px-3 py-2 text-sm text-gray-500 italic">
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
                                      dept,
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
                                            (d) => d !== dept,
                                          ),
                                        );
                                      }
                                    }}
                                    className="mr-2 w-4 h-4 cursor-pointer"
                                  />
                                  {dept || tl("unknown", "(Không rõ)")}
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
                        Thời gian làm thêm giờ
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
                          idx % 2 === 0
                            ? "bg-blue-50 dark:bg-slate-800/70"
                            : "bg-white dark:bg-slate-900"
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
                          {emp.ngayVaoLam || ""}
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
        <div className="min-w-0 w-full max-w-full overflow-x-hidden bg-white rounded-lg shadow-lg">
          <table
            className={`w-full table-fixed border-collapse min-w-0 max-w-full ${seasonalTableMinWidthClass(columnPlan)}`}
          >
            <SeasonalAttendanceColgroup
              showRowModalActions={showRowModalActions}
              columnPlan={columnPlan}
            />
            <thead>
              <tr
                style={{
                  background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
                }}
              >
                {columnPlan === "minimal" ? (
                  <>
                    <th className="px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                      MNV
                    </th>
                    <th className="px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                      Họ và tên
                    </th>
                    <th className="px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                      Thời gian vào
                    </th>
                    <th
                      className="px-1 md:px-1.5 py-0.5 md:py-1 text-[10px] md:text-sm font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                      title={tl(
                        "leaveTypeColumnHint",
                        "Loại phép / trạng thái (PN, …) — tách khỏi giờ vào.",
                      )}
                    >
                      {tl("leaveTypeColumn", "Loại phép")}
                    </th>
                    <th className="px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                      Ca làm việc
                    </th>
                    <th
                      className="px-1 md:px-1.5 py-0.5 md:py-1 text-[10px] md:text-sm font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                      title="Khi ngày được đánh dấu Ngày off: hiển thị OFF."
                    >
                      Ngày off
                    </th>
                    <th
                      className="px-1 md:px-1.5 py-0.5 md:py-1 text-[10px] md:text-sm font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                      title="Khi ngày được đánh dấu Ngày lễ: hiển thị HOLIDAY."
                    >
                      Ngày lễ
                    </th>
                    {showRowModalActions && (
                      <th className="px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                        {canDeleteSeasonalRecord ? "Sửa / Xóa" : "Sửa"}
                      </th>
                    )}
                  </>
                ) : (
                  <>
                    <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                      STT
                    </th>
                    <th className="px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                      MNV
                    </th>
                    <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                      MVT
                    </th>
                    <th className="px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                      Họ và tên
                    </th>
                    <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                      Giới tính
                    </th>
                    {columnPlan === "full" ? (
                      <>
                        <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                          Ngày vào làm
                        </th>
                        <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                          Mã BP
                        </th>
                      </>
                    ) : null}
                    {(columnPlan === "full" || columnPlan === "compact") && (
                      <th className="hidden md:table-cell px-1.5 md:px-2 py-0.5 md:py-1 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                        Bộ phận
                      </th>
                    )}
                    <th className="px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                      Thời gian vào
                    </th>
                    <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                      Thời gian ra
                    </th>
                    <th
                      className="px-1 md:px-1.5 py-0.5 md:py-1 text-[10px] md:text-sm font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                      title={tl(
                        "leaveTypeColumnHint",
                        "Loại phép / trạng thái (PN, …) — sau giờ ra.",
                      )}
                    >
                      {tl("leaveTypeColumn", "Loại phép")}
                    </th>
                    <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                      Ca làm việc
                    </th>
                    <th
                      className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-[10px] md:text-sm font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                      title="Khi ngày được đánh dấu Ngày off: hiển thị OFF."
                    >
                      Ngày off
                    </th>
                    <th
                      className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-[10px] md:text-sm font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                      title="Khi ngày được đánh dấu Ngày lễ: hiển thị HOLIDAY."
                    >
                      Ngày lễ
                    </th>
                    {showRowModalActions && (
                      <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                        {canDeleteSeasonalRecord ? "Sửa / Xóa" : "Sửa"}
                      </th>
                    )}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp, idx) => (
                <tr
                  key={emp.id}
                  className={`transition-colors hover:bg-blue-200 border-b border-slate-100 dark:border-slate-700/40 ${
                    idx % 2 === 0
                      ? "bg-blue-100 dark:bg-slate-800"
                      : "bg-white dark:bg-slate-900"
                  }`}
                >
                  {columnPlan !== "minimal" ? (
                    <td className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center font-bold text-gray-700">
                      {emp.stt || idx + 1}
                    </td>
                  ) : null}
                  <td className="px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center font-bold text-blue-600">
                    {emp.mnv}
                  </td>
                  {columnPlan !== "minimal" ? (
                    <td className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm text-center font-semibold text-gray-700">
                      {emp.mvt}
                    </td>
                  ) : null}
                  <td className="px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-sm text-left md:text-center font-bold text-gray-800 break-words whitespace-normal leading-tight">
                    {emp.hoVaTen}
                  </td>
                  {columnPlan !== "minimal" ? (
                    <td className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm text-center">
                      <span
                        className={`inline-flex items-center justify-center px-1 py-px text-[10px] font-bold leading-none rounded-full ${
                          emp.gioiTinh === "YES"
                            ? "bg-pink-100 text-pink-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {emp.gioiTinh}
                      </span>
                    </td>
                  ) : null}
                  {columnPlan === "full" ? (
                    <>
                      <td className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm text-center font-semibold text-gray-700">
                        {emp.ngayVaoLam}
                      </td>
                      <td className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm text-center font-bold text-gray-700">
                        {emp.maBoPhan}
                      </td>
                    </>
                  ) : null}
                  {columnPlan === "full" || columnPlan === "compact" ? (
                    <td className="hidden md:table-cell px-1.5 md:px-2 py-0.5 md:py-1 text-sm text-center font-semibold text-gray-700">
                      {emp.boPhan}
                    </td>
                  ) : null}
                  {(() => {
                    const gv = String(emp.gioVao ?? "").trim();
                    const timeCol = formatAttendanceTimeInColumnDisplay(gv);
                    const leaveCol =
                      formatAttendanceLeaveTypeColumnForEmployee(emp);
                    const leaveTypeColorClass =
                      getAttendanceLeaveTypeColorClassNameForEmployee(emp);
                    const canEdit = canEditEmployee(emp);

                    const timeTd = (
                      <td className="px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center">
                        {timeCol ? (
                          <span className="font-bold text-sm md:text-base text-green-600">
                            {timeCol}
                          </span>
                        ) : canEdit ? (
                          <span
                            className="tabular-nums font-semibold text-gray-600"
                            title={tl(
                              "gioVaoEditOnlyViaModalHint",
                              "Chưa có giờ vào — chỉnh sửa qua nút Sửa.",
                            )}
                          >
                            -
                          </span>
                        ) : user ? (
                          <span className="text-gray-400 italic text-xs">
                            🔒 Không được phép chỉnh sửa
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">--</span>
                        )}
                      </td>
                    );

                    const leaveTd = (
                      <td className="px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center">
                        {leaveCol ? (
                          <span
                            className={`font-bold text-sm md:text-base ${leaveTypeColorClass}`}
                          >
                            {leaveCol}
                          </span>
                        ) : canEdit ? (
                          <span
                            className="tabular-nums font-semibold text-gray-600"
                            title={tl(
                              "leaveTypeEditViaModalHint",
                              "Chưa có loại phép — chỉnh sửa qua nút Sửa.",
                            )}
                          >
                            -
                          </span>
                        ) : user ? (
                          <span className="text-gray-400 italic text-xs">
                            🔒 Không được phép chỉnh sửa
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">--</span>
                        )}
                      </td>
                    );

                    if (columnPlan === "minimal") {
                      return (
                        <>
                          {timeTd}
                          {leaveTd}
                        </>
                      );
                    }

                    return (
                      <>
                        {timeTd}
                        <td className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center min-w-0">
                          <span className="text-red-600 font-bold text-base">
                            {emp.gioRa}
                          </span>
                        </td>
                        {leaveTd}
                      </>
                    );
                  })()}
                  <td
                    className={
                      columnPlan === "minimal"
                        ? "px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center min-w-0"
                        : "hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center min-w-0"
                    }
                  >
                    {emp.caLamViec ? (
                      <span className="text-blue-600 font-bold text-base">
                        {emp.caLamViec}
                      </span>
                    ) : canEditEmployee(emp) ? (
                      <span
                        className="tabular-nums font-semibold text-gray-600"
                        title={tl(
                          "shiftEditViaModalHint",
                          "Chưa chọn ca — chỉnh sửa qua nút Sửa.",
                        )}
                      >
                        -
                      </span>
                    ) : user ? (
                      <span className="text-gray-400 italic text-xs">
                        🔒 Không được phép chỉnh sửa
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">--</span>
                    )}
                  </td>
                  <td
                    className={
                      columnPlan === "minimal"
                        ? "px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center min-w-0 font-bold text-slate-800 dark:text-slate-100"
                        : "hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center min-w-0 font-bold text-slate-800 dark:text-slate-100"
                    }
                    title="Khi ngày được đánh dấu Ngày off: hiển thị OFF."
                  >
                    {isOffDay ? (
                      <span className="tabular-nums text-rose-700 dark:text-rose-300">
                        OFF
                      </span>
                    ) : null}
                  </td>
                  <td
                    className={
                      columnPlan === "minimal"
                        ? "px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center min-w-0 font-bold text-slate-800 dark:text-slate-100"
                        : "hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center min-w-0 font-bold text-slate-800 dark:text-slate-100"
                    }
                    title="Khi ngày được đánh dấu Ngày lễ: hiển thị HOLIDAY."
                  >
                    {isHolidayDay ? (
                      <span className="tabular-nums text-amber-800 dark:text-amber-200">
                        HOLIDAY
                      </span>
                    ) : (
                      <span className="tabular-nums font-semibold text-gray-600 dark:text-slate-400">
                        -
                      </span>
                    )}
                  </td>
                  {showRowModalActions && (
                    <td
                      className={
                        columnPlan === "minimal"
                          ? "px-1 text-center min-w-0"
                          : "hidden md:table-cell px-1 text-center min-w-0"
                      }
                    >
                      {canEditEmployee(emp) ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(emp)}
                            className="px-2 py-1 bg-blue-500 text-white rounded-md text-xs font-medium hover:bg-blue-600 transition-all shadow-sm hover:shadow-md"
                            title="Chỉnh sửa"
                          >
                            ✏️
                          </button>
                          {canDeleteSeasonalRecord ? (
                            <button
                              onClick={() => handleDelete(emp.id)}
                              className="px-2 py-1 bg-red-500 text-white rounded-md text-xs font-medium hover:bg-red-600 transition-all shadow-sm hover:shadow-md"
                              title="Xóa"
                            >
                              🗑️
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-2 rounded-lg border-l-4 border-blue-600 bg-white p-4 shadow-md dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="w-full">
              <div className="flex flex-wrap items-center gap-4 border border-blue-100 rounded-lg px-3 py-2 bg-gradient-to-r from-blue-50 to-blue-100 shadow-sm">
                <span className="flex items-center gap-1 text-sm font-bold text-gray-700">
                  <span className="text-blue-600 text-lg">📊</span>
                  Tổng số nhân viên:
                  <span className="ml-1 text-lg text-blue-700">
                    {filteredEmployees.length}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-sm font-bold text-gray-700 border-l border-blue-200 pl-4">
                  <span className="text-indigo-500 text-base">🏷️</span>
                  Phân loại:
                  <span className="flex flex-wrap gap-1 ml-1">
                    {(() => {
                      const timeCounts = {};
                      filteredEmployees.forEach((emp) => {
                        const time = formatAttendanceGioVaoDisplay(
                          getAttendanceLeaveTypeRaw(emp),
                        );
                        if (time && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) {
                          timeCounts[time] = (timeCounts[time] || 0) + 1;
                        }
                      });
                      return Object.entries(timeCounts).length > 0 ? (
                        Object.entries(timeCounts).map(([time, count]) => (
                          <span
                            key={time}
                            className={`px-2 py-0.5 rounded font-bold text-2xs border ${getAttendanceLeaveTypeBadgeClassName(time)}`}
                          >
                            {time}: {count}
                          </span>
                        ))
                      ) : (
                        <span className="italic text-gray-400">
                          Không có phân loại
                        </span>
                      );
                    })()}
                  </span>
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 whitespace-nowrap">
              Ngày: {new Date(selectedDate).toLocaleDateString("vi-VN")}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default SeasonalStaffAttendance;
