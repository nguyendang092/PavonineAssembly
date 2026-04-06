import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useLocation, useSearchParams } from "react-router-dom";
import { useUser } from "../../contexts/UserContext";
import {
  isAdminAccess,
  canEditAttendanceForEmployee,
  canAddAttendanceForDepartment,
  ROLES,
} from "../../config/authRoles";
import { getDateKeyBySubtractDays } from "../../utils/dateKey";
import {
  db,
  ref,
  set,
  onValue,
  push,
  remove,
  update,
  get,
} from "../../services/firebase";
import {
  EMPLOYEE_PROFILES_PATH,
  buildEmployeeProfileDocument,
  buildEmployeeAttendanceDayDocument,
  mergeEmployeeProfileAndDay,
  employeeProfileStorageKeyFromMnv,
  slugifyDepartmentKey,
} from "../../utils/employeeRosterRecord";
import {
  appendEmployeeProfileHistory,
  diffEmployeeProfileDocs,
} from "../../utils/employeeProfileHistory";
import ExcelJS from "exceljs";
import { handleUploadExcel } from "./AttendanceUploadHandler";
import ExportExcelButton from "../common/ExportExcelButton";
import UnifiedModal from "../common/UnifiedModal";
import AlertMessage from "../common/AlertMessage";
import BirthdayCakeBell from "../employee/BirthdayCakeBell";
import NotificationBell from "../common/NotificationBell";
const normalizeEmployeeCode = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // Keep a stable key across number/string formats (e.g. "0012" and 12).
  if (/^\d+$/.test(raw)) {
    const asNumber = Number(raw);
    return Number.isFinite(asNumber) ? String(asNumber) : raw;
  }

  return raw.toUpperCase();
};

const normalizeTextValue = (value) => String(value ?? "").trim();

function AttendanceList() {
  const todayKey = new Date().toISOString().slice(0, 10);
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
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const { t, i18n } = useTranslation();
  const { user, userDepartments, userRole } = useUser();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const d = searchParams.get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setSelectedDate(d);
  }, [searchParams]);
  const tl = useCallback(
    (key, defaultValue, options = {}) =>
      t(`attendanceList.${key}`, { defaultValue, ...options }),
    [t],
  );
  const displayLocale = i18n.language?.startsWith("ko") ? "ko-KR" : "vi-VN";

  const [employees, setEmployees] = useState([]);
  const [savingCaLamViec, setSavingCaLamViec] = useState({});
  const [editing, setEditing] = useState(null);
  const [editingCaLamViec, setEditingCaLamViec] = useState({}); // Track temporary caLamViec edits
  const [editingGioVao, setEditingGioVao] = useState({}); // Track temporary gioVao edits
  const [savingGioVao, setSavingGioVao] = useState({}); // Track which gioVao is being saved
  const [filterDepartmentSearch, setFilterDepartmentSearch] = useState("");
  const [filterGenderSearch, setFilterGenderSearch] = useState("");
  const [filterSearchTerm, setFilterSearchTerm] = useState("");
  const [gioiTinhFilter, setGioiTinhFilter] = useState([]); // Filter by gender
  const [departmentListFilter, setDepartmentListFilter] = useState([]); // Filter by department in filter section
  const [gioVaoFilter, setGioVaoFilter] = useState([]); // Filter by entry time status (chưa chấm công, đã chấm công)
  const [expandedSections, setExpandedSections] = useState({}); // Track which sections are expanded
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  // Overtime modal-specific filters
  const [modalFilterOpen, setModalFilterOpen] = useState(false);
  const [modalGioiTinhFilter, setModalGioiTinhFilter] = useState([]);
  const [modalDepartmentListFilter, setModalDepartmentListFilter] = useState(
    [],
  );
  const [modalExpandedSections, setModalExpandedSections] = useState({});
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false);
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [showUnattendedPopup, setShowUnattendedPopup] = useState(false);
  const [unattendedPopupDismissed, setUnattendedPopupDismissed] =
    useState(false);
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
    pnTon: "",
  });

  const [filterMenuDropdownOpen, setFilterMenuDropdownOpen] = useState(false);
  const filterMenuRef = useRef(null);
  const filterDropdownAnchorRef = useRef(null);
  const filterMenuPanelRef = useRef(null);
  const actionDropdownRef = useRef(null);
  const printDropdownRef = useRef(null);
  const [filterDropdownPlacement, setFilterDropdownPlacement] = useState(null);

  const quickNoCheckInFilterValue = "chưa_chấm_công";
  const isQuickNoCheckInActive =
    gioVaoFilter.length === 1 &&
    gioVaoFilter.includes(quickNoCheckInFilterValue);

  // mnv (chuẩn hóa) → pnTon từ đúng ngày liền trước trên lịch (không dùng "ngày gần nhất có dữ liệu")
  const [prevCalendarDayPnTonByMnv, setPrevCalendarDayPnTonByMnv] = useState(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const yesterdayKey = getDateKeyBySubtractDays(selectedDate, 1);
        const snap = await get(ref(db, `attendance/${yesterdayKey}`));
        if (cancelled) return;
        const data = snap.val();
        const map = {};
        if (data && typeof data === "object") {
          Object.values(data).forEach((emp) => {
            const key = normalizeEmployeeCode(emp?.mnv);
            const val = String(emp?.pnTon ?? emp?.phepNam ?? "").trim();
            if (key && val) map[key] = val;
          });
        }
        setPrevCalendarDayPnTonByMnv(map);
      } catch {
        if (!cancelled) setPrevCalendarDayPnTonByMnv({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  // Chuẩn hóa tên bộ phận để lọc ổn định (tránh lệch hoa/thường, khoảng trắng).
  const normalizeDepartment = useCallback((value) => {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }, []);

  const handleQuickNoCheckInFilter = () => {
    if (isQuickNoCheckInActive) {
      setGioVaoFilter([]);
      return;
    }
    setGioVaoFilter([quickNoCheckInFilterValue]);
  };

  const unattendedEmployees = useMemo(
    () =>
      employees.filter((emp) => {
        const hasGioVao = normalizeTextValue(emp.gioVao) !== "";
        const hasCaLamViec = normalizeTextValue(emp.caLamViec) !== "";
        return !hasGioVao && !hasCaLamViec;
      }),
    [employees],
  );

  const [employeeProfilesMap, setEmployeeProfilesMap] = useState({});

  useEffect(() => {
    const profRef = ref(db, EMPLOYEE_PROFILES_PATH);
    const unsubscribe = onValue(profRef, (snapshot) => {
      const v = snapshot.val();
      setEmployeeProfilesMap(v && typeof v === "object" ? v : {});
    });
    return () => unsubscribe();
  }, []);

  // Load attendance/{date} + gộp employeeProfiles (scale / tách hồ sơ)
  useEffect(() => {
    const empRef = ref(db, `attendance/${selectedDate}`);
    const unsubscribe = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const arr = Object.entries(data).map(([id, emp]) => {
          const pk = employeeProfileStorageKeyFromMnv(
            normalizeEmployeeCode(emp?.mnv),
          );
          const prof = pk ? employeeProfilesMap[pk] : null;
          return mergeEmployeeProfileAndDay(
            { ...emp, id },
            prof,
            null,
          );
        });
        arr.sort((a, b) => (a.stt || 0) - (b.stt || 0));
        setEmployees(arr);
      } else {
        setEmployees([]);
      }
    });
    return () => unsubscribe();
  }, [selectedDate, employeeProfilesMap]);

  useEffect(() => {
    setShowUnattendedPopup(false);
    setUnattendedPopupDismissed(false);
  }, [selectedDate]);

  useEffect(() => {
    if (unattendedPopupDismissed) return;

    if (unattendedEmployees.length === 0) {
      setShowUnattendedPopup(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowUnattendedPopup(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [unattendedEmployees, unattendedPopupDismissed]);

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

  const showRowModalActions =
    Boolean(user && userRole && userRole !== ROLES.STAFF);

  // Vị trí menu bộ lọc (fixed + portal) — không bị cắt bởi overflow / footer
  useLayoutEffect(() => {
    if (!filterMenuDropdownOpen) {
      setFilterDropdownPlacement(null);
      return;
    }
    const update = () => {
      const btn = filterDropdownAnchorRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const w = Math.min(288, window.innerWidth - 16);
      let left =
        window.innerWidth < 640
          ? Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
          : Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
      const top = r.bottom + 6;
      const maxHeight = Math.max(160, window.innerHeight - top - 12);
      setFilterDropdownPlacement({ top, left, width: w, maxHeight });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [filterMenuDropdownOpen]);

  // Unified outside-click handler for top action menus.
  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;

      if (
        filterMenuDropdownOpen &&
        filterMenuRef.current &&
        !filterMenuRef.current.contains(target) &&
        !(filterMenuPanelRef.current?.contains(target))
      ) {
        setFilterMenuDropdownOpen(false);
      }

      if (
        printDropdownOpen &&
        printDropdownRef.current &&
        !printDropdownRef.current.contains(target)
      ) {
        setPrintDropdownOpen(false);
      }

      if (
        actionDropdownOpen &&
        actionDropdownRef.current &&
        !actionDropdownRef.current.contains(target)
      ) {
        setActionDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterMenuDropdownOpen, printDropdownOpen, actionDropdownOpen]);

  // Always close filter menu when route changes (pathname/query/hash).
  useEffect(() => {
    setFilterMenuDropdownOpen(false);
  }, [location.pathname, location.search, location.hash]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const selectedDeptKeys = new Set(
      departmentListFilter.map((dept) => normalizeDepartment(dept)),
    );
    return employees.filter((emp) => {
      const empDeptKey = normalizeDepartment(emp.boPhan);
      const departmentFilterKey = normalizeDepartment(departmentFilter);

      if (departmentFilterKey && empDeptKey !== departmentFilterKey)
        return false;
      if (gioiTinhFilter.length > 0 && !gioiTinhFilter.includes(emp.gioiTinh))
        return false;
      if (selectedDeptKeys.size > 0 && !selectedDeptKeys.has(empDeptKey))
        return false;
      // Filter by entry time status
      if (gioVaoFilter.length > 0) {
        const hasGioVao = normalizeTextValue(emp.gioVao) !== "";
        const hasCaLamViec = normalizeTextValue(emp.caLamViec) !== "";
        const isCheckedIn = "đã_chấm_công";
        const isNotCheckedIn = !hasGioVao && !hasCaLamViec;

        if (hasGioVao && !gioVaoFilter.includes(isCheckedIn)) return false;
        if (isNotCheckedIn && !gioVaoFilter.includes("chưa_chấm_công"))
          return false;
        if (!hasGioVao && !isNotCheckedIn) return false;
      }
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
    gioiTinhFilter,
    departmentListFilter,
    gioVaoFilter,
    normalizeDepartment,
  ]);

  // Overtime modal: derive unique options and apply modal filters from filteredEmployees
  const modalUniqueGenders = useMemo(
    () =>
      Array.from(
        new Set(filteredEmployees.map((e) => e.gioiTinh).filter(Boolean)),
      ),
    [filteredEmployees],
  );
  const modalUniqueDepartments = useMemo(
    () =>
      Array.from(
        new Set(filteredEmployees.map((e) => e.boPhan).filter(Boolean)),
      ),
    [filteredEmployees],
  );
  const modalFilteredEmployees = useMemo(() => {
    const modalSelectedDeptKeys = new Set(
      modalDepartmentListFilter.map((dept) => normalizeDepartment(dept)),
    );
    return filteredEmployees.filter((emp) => {
      const empDeptKey = normalizeDepartment(emp.boPhan);
      if (
        modalGioiTinhFilter.length > 0 &&
        !modalGioiTinhFilter.includes(emp.gioiTinh)
      )
        return false;
      if (
        modalSelectedDeptKeys.size > 0 &&
        !modalSelectedDeptKeys.has(empDeptKey)
      )
        return false;
      return true;
    });
  }, [
    filteredEmployees,
    modalGioiTinhFilter,
    modalDepartmentListFilter,
    normalizeDepartment,
  ]);

  // Get unique departments (cascading filter - based on other selected filters)
  const departments = useMemo(() => {
    const deptMap = new Map();
    for (const emp of employees) {
      // Apply other filters except Department
      if (gioiTinhFilter.length > 0 && !gioiTinhFilter.includes(emp.gioiTinh))
        continue;
      const deptLabel = String(emp.boPhan || "").trim();
      const deptKey = normalizeDepartment(deptLabel);
      if (!deptKey) continue;
      if (!deptMap.has(deptKey)) {
        deptMap.set(deptKey, deptLabel);
      }
    }
    return Array.from(deptMap.values());
  }, [employees, gioiTinhFilter, normalizeDepartment]);

  // Filtered list for 'bù công' (gioVao là giờ, không phải loại như PN, PO...)
  const buCongEmployees = useMemo(() => {
    // Strictly matches hh:mm or hh:mm:ss (no extra chars, no spaces)
    const timeRegex = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
    // Danh sách các loại cần loại ra khỏi bù công (không phân biệt hoa thường, loại bỏ khoảng trắng)
    const excludeTypes = [
      "PN",
      "PN1/2",
      "PO",
      "TS",
      "KL",
      "KP",
      "CDL",
      "VT",
      "TN",
      "PC",
      "PT",
      "DS",
      "NV",
    ];
    return filteredEmployees.filter((emp) => {
      const gioVao = (emp.gioVao || "").trim().toUpperCase();
      const gioRa = (emp.gioRa || "").trim();
      // Loại các loại đặc biệt
      if (!gioVao || excludeTypes.includes(gioVao)) return false;
      // Chỉ nhận giá trị giờ vào hợp lệ
      if (!timeRegex.test(gioVao)) return false;
      // Nếu có cả giờ vào và giờ ra (đều hợp lệ) thì không phải bù công
      if (gioVao && gioRa && timeRegex.test(gioRa)) return false;
      // Nếu chỉ có giờ vào hoặc chỉ có giờ ra (1 trong 2), thì là bù công
      if ((gioVao && !gioRa) || (!gioVao && gioRa)) return true;
      // Nếu không có giờ vào và không có giờ ra thì không phải bù công
      return false;
    });
  }, [filteredEmployees]);

  // Get unique genders (cascading filter - based on other selected filters)
  const genderList = useMemo(() => {
    const genders = new Set();
    const selectedDeptKeys = new Set(
      departmentListFilter.map((dept) => normalizeDepartment(dept)),
    );
    for (const emp of employees) {
      // Apply other filters except Gender
      const empDeptKey = normalizeDepartment(emp.boPhan);
      if (selectedDeptKeys.size > 0 && !selectedDeptKeys.has(empDeptKey))
        continue;
      if (emp.gioiTinh) genders.add(emp.gioiTinh);
    }
    return Array.from(genders).sort();
  }, [employees, departmentListFilter, normalizeDepartment]);

  // Get unique mã BP codes (cascading filter - based on other selected filters)
  // Get unique shifts (cascading filter - based on other selected filters)
  const shiftList = useMemo(() => {
    const shifts = new Set();
    const selectedDeptKeys = new Set(
      departmentListFilter.map((dept) => normalizeDepartment(dept)),
    );
    for (const emp of employees) {
      // Apply other filters except Shift
      if (gioiTinhFilter.length > 0 && !gioiTinhFilter.includes(emp.gioiTinh))
        continue;
      const empDeptKey = normalizeDepartment(emp.boPhan);
      if (selectedDeptKeys.size > 0 && !selectedDeptKeys.has(empDeptKey))
        continue;
      if (emp.caLamViec) shifts.add(emp.caLamViec);
    }
    return Array.from(shifts).sort();
  }, [employees, gioiTinhFilter, departmentListFilter, normalizeDepartment]);

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

  // Handle submit (add/update) — employeeProfiles + attendance/{date} (tách tầng)
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

    const storageKey = employeeProfileStorageKeyFromMnv(form.mnv);
    if (!storageKey) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.error"),
      });
      return;
    }

    try {
      if (editing) {
        const existing = employees.find((emp) => emp.id === editing);
        if (
          !existing ||
          !canEditAttendanceForEmployee({
            user,
            userRole,
            userDepartments,
            employee: existing,
          })
        ) {
          setAlert({
            show: true,
            type: "error",
            message: t("attendanceList.error"),
          });
          return;
        }
        const daySnap = await get(
          ref(db, `attendance/${selectedDate}/${editing}`),
        );
        const existingRaw = daySnap.val() || {};
        const profSnap = await get(
          ref(db, `${EMPLOYEE_PROFILES_PATH}/${storageKey}`),
        );
        const existingProfile = profSnap.val() || {};
        const deptKey =
          String(existingProfile.departmentKey ?? "").trim() ||
          slugifyDepartmentKey(form.boPhan);
        const mergedForm = {
          ...existingProfile,
          ...form,
          businessId: storageKey,
          departmentKey: deptKey,
        };
        const profileDoc = buildEmployeeProfileDocument({
          form: mergedForm,
          existingProfile,
          departmentDisplayName: form.boPhan,
          departmentKey: deptKey,
        });
        const dayDoc = buildEmployeeAttendanceDayDocument({
          form: mergedForm,
          existing: existingRaw,
        });
        await update(ref(db), {
          [`${EMPLOYEE_PROFILES_PATH}/${storageKey}`]: profileDoc,
          [`attendance/${selectedDate}/${editing}`]: { ...dayDoc, id: editing },
        });
        const profileChanges = diffEmployeeProfileDocs(
          existingProfile,
          profileDoc,
        );
        if (profileChanges.length > 0) {
          void appendEmployeeProfileHistory({
            by: user?.email || "",
            action: "update",
            source: "attendance",
            profileKey: storageKey,
            mnv: String(profileDoc.mnv || form.mnv || ""),
            hoVaTen: String(profileDoc.hoVaTen || form.hoVaTen || ""),
            changes: profileChanges,
          });
        }
        setShowModal(false);
        setAlert({
          show: true,
          type: "success",
          message: t("attendanceList.updateSuccess"),
        });
        setEditing(null);
      } else {
        if (
          !canAddAttendanceForDepartment({
            user,
            userRole,
            userDepartments,
            boPhan: form.boPhan,
          })
        ) {
          setAlert({
            show: true,
            type: "error",
            message: t("attendanceList.error"),
          });
          return;
        }
        const profSnap = await get(
          ref(db, `${EMPLOYEE_PROFILES_PATH}/${storageKey}`),
        );
        const existingProfile = profSnap.val() || {};
        const deptKey =
          String(existingProfile.departmentKey ?? "").trim() ||
          slugifyDepartmentKey(form.boPhan);
        const mergedForm = {
          ...existingProfile,
          ...form,
          businessId: storageKey,
          departmentKey: deptKey,
        };
        const profileDoc = buildEmployeeProfileDocument({
          form: mergedForm,
          existingProfile,
          departmentDisplayName: form.boPhan,
          departmentKey: deptKey,
        });
        const newRef = push(ref(db, `attendance/${selectedDate}`));
        const newKey = newRef.key;
        const dayDoc = buildEmployeeAttendanceDayDocument({
          form: mergedForm,
          existing: {},
        });
        await update(ref(db), {
          [`${EMPLOYEE_PROFILES_PATH}/${storageKey}`]: profileDoc,
          [`attendance/${selectedDate}/${newKey}`]: { ...dayDoc, id: newKey },
        });
        void appendEmployeeProfileHistory({
          by: user?.email || "",
          action: "create",
          source: "attendance",
          profileKey: storageKey,
          mnv: String(profileDoc.mnv || form.mnv || ""),
          hoVaTen: String(profileDoc.hoVaTen || form.hoVaTen || ""),
        });
        setShowModal(false);
        setAlert({
          show: true,
          type: "success",
          message: t("attendanceList.addSuccess"),
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
        pnTon: "",
      });
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.error"),
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
      setForm({ ...emp });
      setEditing(emp.id);
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
      if (
        !emp ||
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
        await remove(ref(db, `attendance/${selectedDate}/${id}`));
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

  // Use the extracted upload handler
  const handleUploadExcelWrapper = useCallback(
    (e) => {
      handleUploadExcel({
        e,
        user,
        selectedDate,
        setAlert,
        setIsUploadingExcel,
        t,
        db,
        employeeProfilesMap,
      });
    },
    [
      user,
      selectedDate,
      setAlert,
      setIsUploadingExcel,
      t,
      db,
      employeeProfilesMap,
    ],
  );

  // Handle delete all data for selected date
  const handleDeleteAllData = useCallback(async () => {
    if (!user) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.pleaseLogin"),
      });
      return;
    }
    if (!isAdminAccess(user, userRole)) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.adminOrHROnly"),
      });
      return;
    }
    // Hiển thị dialog xác nhận với thông tin ngày
    const confirmMessage = t("attendanceList.deleteAllConfirm", {
      date: selectedDate,
      count: employees.length,
    });
    if (!window.confirm(confirmMessage)) return;
    // Xác nhận lần 2
    const finalConfirm = t("attendanceList.deleteAllConfirm2");
    const userInput = window.prompt(finalConfirm);
    if (userInput !== "XOA") {
      setAlert({
        show: true,
        type: "info",
        message: t("attendanceList.cancelDelete"),
      });
      return;
    }
    try {
      // Xóa toàn bộ dữ liệu của ngày đã chọn
      await remove(ref(db, `attendance/${selectedDate}`));
      setAlert({
        show: true,
        type: "success",
        message: t("attendanceList.deleteAllSuccess", {
          count: employees.length,
          date: selectedDate,
        }),
      });
    } catch (err) {
      console.error("Delete all data error:", err);
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.deleteAllError", {
          error: err?.message || t("attendanceList.tryAgain"),
        }),
      });
    }
  }, [user, userRole, selectedDate, employees.length, t]);

  // Export to Excel (moved to external component)

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
        message: t("attendanceList.noEmployees"),
      });
      return;
    }
    setShowOvertimeModal(true);
  }, [filteredEmployees, t]);

  // Print overtime list (from modal)
  const handlePrintOvertimeList = useCallback(() => {
    if (modalFilteredEmployees.length === 0) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.noEmployees"),
      });
      return;
    }

    const overtimeDate = new Date(selectedDate).toLocaleDateString(
      displayLocale,
    );

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.printWindowBlocked"),
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
      message: t("attendanceList.printOvertimeOpened", {
        count: modalFilteredEmployees.length,
      }),
    });
  }, [modalFilteredEmployees, selectedDate]);

  // Print main attendance list (using current filters)
  const handlePrintAttendanceList = useCallback(() => {
    if (filteredEmployees.length === 0) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.noEmployees"),
      });
      return;
    }

    const dateStr = new Date(selectedDate).toLocaleDateString(displayLocale);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.printWindowBlocked"),
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
      <h1>DANH SÁCH NHÂN VIÊN HIỆN DIỆN</h1>
      <div class="subtitle">List of Active Employees</div>
      <div class="date">Ngày/Date: ${dateStr}</div>
    </div>

    <div class="red-text">Số lượng cơm ca trưa:</div>
    
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:4%">STT</th>
          <th style="width:7%">MNV</th>
          <th style="width:7%">MVT</th>
          <th style="width:26%">Họ và tên</th>
          <th style="width:8%">Giới tính</th>
          <th style="width:12%">Ngày sinh</th>
          <th style="width:7%">Mã BP</th>
          <th style="width:14%">Bộ phận</th>
          <th style="width:8%">Thời gian vào</th>
          <th style="width:8%">Thời gian ra</th>
          <th style="width:7%">Ca làm việc</th>
          <th style="width:8%">Chấm công</th>
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
            <td>${emp.ngayThangNamSinh || ""}</td>
            <td>${emp.maBoPhan || ""}</td>
            <td class="dept">${emp.boPhan || ""}</td>
            <td style="${
              ["PN", "TS", "PO", "NV"].includes(emp.gioVao)
                ? "color:#c41e3a;font-weight:bold;"
                : ""
            }">${emp.gioVao || ""}</td>
            <td>${emp.gioRa || ""}</td>
            <td>${emp.caLamViec || ""}</td>
            <td>${emp.chamCong || ""}</td>
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
      message: t("attendanceList.printAttendanceOpened", {
        count: filteredEmployees.length,
      }),
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
          emp.gioVao || "",
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
      <div className="p-4 md:p-8 transition-all duration-300">
        {/* Header */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-600">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-extrabold text-[#1e293b] uppercase tracking-wide">
                  {tl("activeEmployeesTitle", "DANH SÁCH NHÂN VIÊN HIỆN DIỆN")}
                </h1>
                <p className="text-base text-gray-600 mt-1">
                  {tl("activeEmployeesSubtitle", "List of Active Employees")}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {tl("dateLabel", "Ngày/Date")}:{" "}
                  {new Date(selectedDate).toLocaleDateString(displayLocale)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <AlertMessage alert={alert} />

        {/* Popup nhân viên chưa điểm danh - sử dụng UnifiedModal */}
        <UnifiedModal
          isOpen={showUnattendedPopup && unattendedEmployees.length > 0}
          onClose={() => {
            setShowUnattendedPopup(false);
            setUnattendedPopupDismissed(true);
          }}
          variant="primary"
          title={tl("unattendedTitle", "Nhân viên chưa điểm danh")}
          size="lg"
          actions={[
            {
              label: t("attendanceList.close"),
              onClick: () => {
                setShowUnattendedPopup(false);
                setUnattendedPopupDismissed(true);
              },
              variant: "secondary",
            },
            {
              label: t("attendanceList.quickFilter"),
              onClick: () => {
                setGioVaoFilter([quickNoCheckInFilterValue]);
                setShowUnattendedPopup(false);
                setUnattendedPopupDismissed(true);
              },
              variant: "primary",
            },
          ]}
        >
          <p className="text-sm text-gray-700 mb-4">
            {tl(
              "unattendedSummary",
              "Hiện có {{count}} nhân viên chưa có thời gian vào trong ngày {{date}}.",
              {
                count: unattendedEmployees.length,
                date: new Date(selectedDate).toLocaleDateString(displayLocale),
              },
            )}
          </p>

          <div className="overflow-x-auto border rounded-lg shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-blue-700 to-blue-400 text-white sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                    {tl("colIndex", "STT")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                    {tl("colCode", "MNV")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                    {tl("colName", "Họ và tên")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                    {tl("colDepartment", "Bộ phận")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {unattendedEmployees.map((emp, idx) => (
                  <tr
                    key={emp.id}
                    className={`transition-colors hover:bg-blue-50 ${
                      idx % 2 === 0 ? "bg-gray-50" : "bg-white"
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 text-blue-600 font-semibold">
                      {emp.mnv || "--"}
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium">
                      {emp.hoVaTen || "--"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {emp.boPhan || "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </UnifiedModal>

        {/* Filters and Actions — shrink-0 tránh co mất nút khi danh sách ít / màn hẹp */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-start sm:justify-between mb-4">
          <div className="flex flex-wrap gap-2 min-w-0 flex-1">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-auto border rounded-md h-9 px-3 text-sm bg-white font-semibold text-blue-700 focus:ring-2 focus:ring-blue-300 shrink-0"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("attendanceList.searchPlaceholder")}
              className="w-full sm:w-48 min-w-0 border rounded-md h-9 px-3 text-sm focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end sm:shrink-0">
            <div className="shrink-0">
              <BirthdayCakeBell selectedDate={selectedDate} inline />
            </div>
            <div className="shrink-0">
              <NotificationBell
                inline
                count={buCongEmployees.length}
                onExport={handleExportBuCongExcel}
                exportLabel={t("attendanceList.export")}
              >
                {buCongEmployees.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#888",
                      fontSize: 14,
                      padding: 20,
                    }}
                  >
                    {t("attendanceList.noCompensationEmployees", {
                      defaultValue: "Không có nhân viên bù công nào",
                    })}
                  </div>
                ) : (
                  <div style={{ maxHeight: 600, overflow: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        minWidth: 600,
                        borderCollapse: "collapse",
                        fontSize: 14,
                      }}
                    >
                      <thead
                        style={{
                          position: "sticky",
                          top: 0,
                          background: "#e3f2fd",
                          zIndex: 1,
                        }}
                      >
                        <tr>
                          <th style={{ padding: 8 }}>
                            {tl("colIndex", "STT")}
                          </th>
                          <th style={{ padding: 8 }}>{tl("colCode", "MNV")}</th>
                          <th style={{ padding: 8 }}>
                            {tl("colName", "Họ và tên")}
                          </th>
                          <th style={{ padding: 8 }}>
                            {tl("colDepartment", "Bộ phận")}
                          </th>
                          <th style={{ padding: 8 }}>
                            {tl("colTimeIn", "Giờ vào")}
                          </th>
                          <th style={{ padding: 8 }}>
                            {tl("colTimeOut", "Giờ ra")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {buCongEmployees.map((emp, idx) => (
                          <tr
                            key={emp.id}
                            style={{
                              background: idx % 2 === 0 ? "#f8fbff" : "#fff",
                            }}
                          >
                            <td style={{ textAlign: "center", padding: 8 }}>
                              {idx + 1}
                            </td>
                            <td style={{ textAlign: "center", padding: 8 }}>
                              {emp.mnv}
                            </td>
                            <td style={{ padding: 8 }}>{emp.hoVaTen}</td>
                            <td style={{ padding: 8 }}>{emp.boPhan}</td>
                            <td style={{ textAlign: "center", padding: 8 }}>
                              {emp.gioVao}
                            </td>
                            <td style={{ textAlign: "center", padding: 8 }}>
                              {emp.gioRa || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </NotificationBell>
            </div>

            {/* Filter Dropdown Menu */}
            <div
              ref={filterMenuRef}
              className="attendance-filter-menu relative shrink-0 z-50 min-w-[10.5rem] sm:min-w-[11rem]"
            >
              <button
                ref={filterDropdownAnchorRef}
                type="button"
                onClick={() =>
                  setFilterMenuDropdownOpen(!filterMenuDropdownOpen)
                }
                className={`w-full min-h-[2.25rem] px-3 py-2 rounded-lg border border-slate-300 font-bold text-sm shadow transition flex items-center justify-center gap-2 whitespace-nowrap ${
                  gioiTinhFilter.length > 0 ||
                  departmentListFilter.length > 0 ||
                  gioVaoFilter.length > 0 ||
                  isQuickNoCheckInActive
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
              >
                🔽 {tl("filter", "Bộ lọc")}
                <span className="text-xs">
                  {gioiTinhFilter.length > 0 ||
                  departmentListFilter.length > 0 ||
                  gioVaoFilter.length > 0 ||
                  isQuickNoCheckInActive
                    ? "✓"
                    : ""}
                </span>
              </button>

              {/* Dropdown: portal + fixed để luôn nổi trên footer / vùng scroll */}
              {filterMenuDropdownOpen &&
                filterDropdownPlacement &&
                createPortal(
                  <div
                    ref={filterMenuPanelRef}
                    className="fixed z-[1100] bg-white rounded-lg shadow-2xl border border-gray-200 overflow-y-auto overscroll-contain"
                    style={{
                      top: filterDropdownPlacement.top,
                      left: filterDropdownPlacement.left,
                      width: filterDropdownPlacement.width,
                      maxHeight: filterDropdownPlacement.maxHeight,
                    }}
                  >
                  {/* Bộ lọc nâng cao */}
                  <button
                    onClick={() => {
                      setFilterOpen(true);
                      setFilterMenuDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 border-b flex items-center gap-3 transition ${
                      gioiTinhFilter.length > 0 ||
                      departmentListFilter.length > 0 ||
                      gioVaoFilter.length > 0
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-gray-700"
                    }`}
                  >
                    <span className="text-lg">🔍</span>
                    <div className="flex-1">
                      <div className="font-semibold">
                        {t("attendanceList.advancedFilter")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {tl(
                          "advancedFilterDesc",
                          "Bộ phận, Giới tính, Thời gian",
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Lọc nhanh */}
                  <button
                    onClick={() => {
                      handleQuickNoCheckInFilter();
                      setFilterMenuDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-amber-50 border-b flex items-center gap-3 transition ${
                      isQuickNoCheckInActive
                        ? "bg-amber-50 text-amber-700 font-semibold"
                        : "text-gray-700"
                    }`}
                  >
                    <span className="text-lg">⚡</span>
                    <div className="flex-1">
                      <div className="font-semibold">
                        {t("attendanceList.quickFilter")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {tl("notCheckedIn", "Nhân viên chưa điểm danh")}
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleOvertimeButton();
                      setFilterMenuDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-orange-50 border-t flex items-center gap-3 transition text-gray-700"
                  >
                    <span className="text-lg">⏰</span>
                    <div className="flex-1">
                      <div className="font-semibold">
                        {t("attendanceList.overtime")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {tl("registerDailyOvertime", "Đăng ký tăng ca ngày")}
                      </div>
                    </div>
                  </button>

                  {/* Clear Filter */}
                  {(gioiTinhFilter.length > 0 ||
                    departmentListFilter.length > 0 ||
                    gioVaoFilter.length > 0) && (
                    <button
                      onClick={() => {
                        setGioiTinhFilter([]);
                        setDepartmentListFilter([]);
                        setGioVaoFilter([]);
                        setSearchTerm("");
                        setFilterMenuDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-red-50 border-t flex items-center gap-3 transition text-gray-700"
                    >
                      <span className="text-lg">🗑️</span>
                      <div className="flex-1">
                        <div className="font-semibold">
                          {t("attendanceList.clearFilter")}
                        </div>
                        <div className="text-xs text-gray-500">
                          {tl("resetAllFilters", "Reset tất cả bộ lọc")}
                        </div>
                      </div>
                    </button>
                  )}
                  </div>,
                  document.body,
                )}

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
                          {t("attendanceList.advancedFilter")}
                        </h3>
                        <p className="text-xs text-blue-50 mt-1.5 font-medium">
                          {tl(
                            "advancedFilterAutoUpdate",
                            "Chọn điều kiện lọc • Kết quả tự động cập nhật",
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 overflow-y-auto flex-1">
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
                            <span>{tl("department", "Bộ phận")}</span>
                          </span>
                          <span className="text-orange-600 font-bold">
                            {expandedSections.department ? "▼" : "▶"}
                          </span>
                        </button>
                        {expandedSections.department && (
                          <div className="border-2 border-orange-100 rounded-lg mt-2 bg-gradient-to-b from-white to-orange-50/30 shadow-inner">
                            <input
                              type="text"
                              value={filterDepartmentSearch}
                              onChange={(e) =>
                                setFilterDepartmentSearch(e.target.value)
                              }
                              placeholder={t("attendanceList.searchDepartment")}
                              className="w-full border-b border-orange-200 h-8 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            />
                            <div className="max-h-40 overflow-y-auto">
                              {departments.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-gray-500 italic">
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
                                    ✓ Chọn tất cả
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
                                        className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
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
                            <span>{tl("gender", "Giới tính")}</span>
                          </span>
                          <span className="text-green-600 font-bold">
                            {expandedSections.gender ? "▼" : "▶"}
                          </span>
                        </button>
                        {expandedSections.gender && (
                          <div className="border-2 border-green-100 rounded-lg mt-2 bg-gradient-to-b from-white to-green-50/30 shadow-inner">
                            <input
                              type="text"
                              value={filterGenderSearch}
                              onChange={(e) =>
                                setFilterGenderSearch(e.target.value)
                              }
                              placeholder={t("attendanceList.searchGender")}
                              className="w-full border-b border-green-200 h-8 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                            <div className="max-h-40 overflow-y-auto">
                              {genderList.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-gray-500 italic">
                                  {tl("noData", "Không có dữ liệu")}
                                </div>
                              ) : (
                                <>
                                  <label className="flex items-center px-3 py-2 hover:bg-green-50 cursor-pointer text-sm border-b-2 border-green-200 bg-green-50/50 font-semibold">
                                    <input
                                      type="checkbox"
                                      checked={
                                        gioiTinhFilter.length ===
                                        genderList.length
                                      }
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setGioiTinhFilter([...genderList]);
                                        } else {
                                          setGioiTinhFilter([]);
                                        }
                                      }}
                                      className="mr-2 w-4 h-4 cursor-pointer"
                                    />
                                    ✓ Chọn tất cả
                                  </label>
                                  {genderList
                                    .filter((gender) =>
                                      gender
                                        .toLowerCase()
                                        .includes(
                                          filterGenderSearch.toLowerCase(),
                                        ),
                                    )
                                    .map((gender) => (
                                      <label
                                        key={gender}
                                        className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={gioiTinhFilter.includes(
                                            gender,
                                          )}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setGioiTinhFilter([
                                                ...gioiTinhFilter,
                                                gender,
                                              ]);
                                            } else {
                                              setGioiTinhFilter(
                                                gioiTinhFilter.filter(
                                                  (g) => g !== gender,
                                                ),
                                              );
                                            }
                                          }}
                                          className="mr-2 w-4 h-4 cursor-pointer"
                                        />
                                        {gender === "YES"
                                          ? t("attendanceList.femaleLabel")
                                          : t("attendanceList.maleLabel")}
                                      </label>
                                    ))}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Entry Time Filter Section */}
                      <div className="mb-3">
                        <button
                          onClick={() => {
                            setExpandedSections((prev) => ({
                              ...prev,
                              gioVao: !prev.gioVao,
                            }));
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-indigo-200"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-indigo-500 text-base">
                              ⏰
                            </span>
                            <span>{tl("timeIn", "Thời gian vào")}</span>
                          </span>
                          <span className="text-indigo-600 font-bold">
                            {expandedSections.gioVao ? "▼" : "▶"}
                          </span>
                        </button>
                        {expandedSections.gioVao && (
                          <div className="border-2 border-indigo-100 rounded-lg mt-2 bg-gradient-to-b from-white to-indigo-50/30 shadow-inner">
                            <div className="max-h-40 overflow-y-auto">
                              <label className="flex items-center px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm border-b border-indigo-200 bg-indigo-50/50 font-semibold">
                                <input
                                  type="checkbox"
                                  checked={gioVaoFilter.includes(
                                    "đã_chấm_công",
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setGioVaoFilter([
                                        ...gioVaoFilter,
                                        "đã_chấm_công",
                                      ]);
                                    } else {
                                      setGioVaoFilter(
                                        gioVaoFilter.filter(
                                          (g) => g !== "đã_chấm_công",
                                        ),
                                      );
                                    }
                                  }}
                                  className="mr-2 w-4 h-4 cursor-pointer"
                                />
                                ✅ {tl("checkedIn", "Đã chấm công")}
                              </label>
                              <label className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100">
                                <input
                                  type="checkbox"
                                  checked={gioVaoFilter.includes(
                                    "chưa_chấm_công",
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setGioVaoFilter([
                                        ...gioVaoFilter,
                                        "chưa_chấm_công",
                                      ]);
                                    } else {
                                      setGioVaoFilter(
                                        gioVaoFilter.filter(
                                          (g) => g !== "chưa_chấm_công",
                                        ),
                                      );
                                    }
                                  }}
                                  className="mr-2 w-4 h-4 cursor-pointer"
                                />
                                ❎ {tl("notCheckedInShort", "Chưa chấm công")}
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer - Buttons */}
                    <div className="p-5 border-t-2 border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50 flex gap-3 justify-end">
                      <button
                        onClick={() => {
                          setGioiTinhFilter([]);
                          setDepartmentListFilter([]);
                          setGioVaoFilter([]);
                          setExpandedSections({});
                          setFilterSearchTerm("");
                        }}
                        className="px-5 py-2.5 rounded-lg text-sm text-gray-700 border-2 border-gray-300 hover:border-red-400 hover:bg-red-50 hover:text-red-600 font-semibold transition-all duration-200 shadow-sm hover:shadow"
                      >
                        🗑️ {tl("clearAll", "Xóa tất cả")}
                      </button>
                      <button
                        onClick={() => {
                          setFilterOpen(false);
                          setFilterSearchTerm("");
                        }}
                        className="px-5 py-2.5 rounded-lg text-sm bg-gradient-to-r from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        ✖️ {t("attendanceList.cancel", { defaultValue: "Hủy" })}
                      </button>
                      <button
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
                </div>
              )}
            </div>

            {/* Action Dropdown (Upload/Export/Add) */}
            {user && (
              <div
                ref={actionDropdownRef}
                className="relative action-dropdown shrink-0 z-40 min-w-[10rem] sm:min-w-[11rem]"
              >
                <button
                  type="button"
                  onClick={() => setActionDropdownOpen(!actionDropdownOpen)}
                  className="w-full min-h-[2.25rem] px-3 py-2 bg-emerald-600 text-white rounded font-bold text-sm shadow hover:bg-emerald-700 transition flex items-center justify-center gap-1 whitespace-nowrap"
                >
                  ⚙️ {tl("actionsMenu", "Chức năng")}
                  <span className="text-xs">
                    {actionDropdownOpen ? "▲" : "▼"}
                  </span>
                </button>
                {actionDropdownOpen && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-[min(100vw-2rem,18rem)] sm:w-64 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-2xl border-2 border-emerald-200 z-[100] overflow-hidden animate-fadeIn">
                    {isAdminAccess(user, userRole) && (
                      <label className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group cursor-pointer">
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                          📤
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
                            {isUploadingExcel
                              ? "Đang upload..."
                              : tl(
                                  "uploadExcelByDate",
                                  "Upload Excel theo ngày",
                                )}
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5">
                            {tl("importDataForDate", "Import dữ liệu cho ngày")}
                            :{" "}
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
                            handleUploadExcelWrapper(e);
                            setActionDropdownOpen(false);
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                    <button
                      onClick={() => {
                        const exportButton = document.querySelector(
                          '[title="📥 Xuất Excel"]',
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
                          {t("attendanceList.export", {
                            defaultValue: "Xuất Excel",
                          })}
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
                            gioRa: "",
                            caLamViec: "",
                            chamCong: "",
                            pnTon: "",
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
                    title="📥 Xuất Excel"
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
            <div
              ref={printDropdownRef}
              className="print-dropdown-menu relative shrink-0 z-40 min-w-[8.5rem] sm:min-w-[9rem]"
            >
              <button
                type="button"
                onClick={() => setPrintDropdownOpen(!printDropdownOpen)}
                className="w-full min-h-[2.25rem] px-3 py-2 bg-blue-600 text-white rounded font-bold text-sm shadow hover:bg-blue-700 transition flex items-center justify-center gap-1 whitespace-nowrap"
              >
                🖨️ {tl("print", "In")}
                <span className="text-xs">{printDropdownOpen ? "▲" : "▼"}</span>
              </button>
              {printDropdownOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-[min(100vw-2rem,18rem)] sm:w-64 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-2xl border-2 border-blue-200 z-[100] overflow-hidden animate-fadeIn">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-gradient-to-br from-purple-50 via-white to-purple-200 rounded-2xl shadow-2xl p-8 w-full max-w-2xl relative mx-4 overflow-y-auto max-h-[90vh] border-2 border-blue-200 animate-fadeIn">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-full transition"
                aria-label="Đóng"
              >
                ×
              </button>
              <h2 className="text-xl font-extrabold mb-6 text-black tracking-wide text-center drop-shadow uppercase">
                {editing
                  ? tl("updateEmployee", "Cập nhật nhân viên")
                  : tl("addEmployee", "Thêm nhân viên mới")}
              </h2>
              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 sm:grid-cols-2 gap-6"
              >
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("stt", "STT")}
                  </label>
                  <input
                    type="number"
                    name="stt"
                    value={form.stt}
                    onChange={handleChange}
                    className="w-full border-2 border-blue-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("mnv", "MNV")} *
                  </label>
                  <input
                    type="text"
                    name="mnv"
                    value={form.mnv}
                    onChange={handleChange}
                    required
                    className="w-full border-2 border-blue-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("mvt", "MVT")}
                  </label>
                  <input
                    type="text"
                    name="mvt"
                    value={form.mvt}
                    onChange={handleChange}
                    className="w-full border-2 border-blue-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("fullName", "Họ và tên")}
                  </label>
                  <input
                    type="text"
                    name="hoVaTen"
                    value={form.hoVaTen}
                    onChange={handleChange}
                    required
                    className="w-full border-2 border-blue-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("gender", "Giới tính")}
                  </label>
                  <select
                    name="gioiTinh"
                    value={form.gioiTinh}
                    onChange={handleChange}
                    className="w-full border-2 border-blue-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm bg-white"
                  >
                    <option value="YES">{t("attendanceList.female")}</option>
                    <option value="NO">{t("attendanceList.male")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("dateOfBirth", "Ngày sinh")}
                  </label>
                  <input
                    type="date"
                    name="ngayThangNamSinh"
                    value={form.ngayThangNamSinh}
                    onChange={handleChange}
                    className="w-full border-2 border-blue-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("departmentCode", "Mã BP")}
                  </label>
                  <input
                    type="text"
                    name="maBoPhan"
                    value={form.maBoPhan}
                    onChange={handleChange}
                    className="w-full border-2 border-blue-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("departmentRequired", "Bộ phận")}
                  </label>
                  <input
                    type="text"
                    name="boPhan"
                    value={form.boPhan}
                    onChange={handleChange}
                    required
                    className="w-full border-2 border-blue-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("timeIn", "Giờ vào")}
                  </label>
                  <input
                    type="text"
                    name="gioVao"
                    value={form.gioVao}
                    onChange={handleChange}
                    placeholder="HH:MM hoặc mã phép (PN, KP,...)"
                    className="w-full border-2 border-blue-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("timeOut", "Giờ ra")}
                  </label>
                  <input
                    type="time"
                    name="gioRa"
                    value={form.gioRa}
                    onChange={handleChange}
                    className="w-full border-2 border-blue-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("workShift", "Ca làm việc")}
                  </label>
                  <input
                    type="text"
                    name="caLamViec"
                    value={form.caLamViec}
                    onChange={handleChange}
                    className="w-full border-2 border-blue-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 uppercase mb-1 tracking-wide">
                    {tl("attendance", "Chấm công")}
                  </label>
                  <input
                    type="text"
                    name="chamCong"
                    value={form.chamCong}
                    onChange={handleChange}
                    className="w-full border-2 border-blue-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition shadow-sm bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="sm:col-span-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-extrabold text-base mt-2 shadow-lg hover:from-blue-700 hover:to-purple-700 active:scale-95 transition-all duration-150 tracking-wide"
                >
                  {editing
                    ? t("attendanceList.btnUpdate")
                    : t("attendanceList.btnAdd")}
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
                {t("attendanceList.overtimeFormTitle", {
                  defaultValue: "Biểu mẫu đăng ký tăng ca",
                })}
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                {tl("dateLabel", "Ngày/Date")}:{" "}
                {new Date(selectedDate).toLocaleDateString(displayLocale)}
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
                    className="px-2 py-2 bg-blue-600 text-white rounded font-bold text-sm shadow hover:bg-blue-700 transition whitespace-nowrap"
                  >
                    🖨️ {tl("printList", "In danh sách")}
                  </button>
                  <button
                    onClick={handleExportOvertimeForm}
                    className="px-2 py-2 bg-orange-600 text-white rounded font-bold text-sm shadow hover:bg-orange-700 transition whitespace-nowrap"
                  >
                    ⬇️ {tl("exportOvertimeExcel", "Xuất biểu mẫu Excel")}
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
                          {t("attendanceList.advancedFilter")}
                        </h3>
                        <p className="text-xs text-blue-50 mt-1.5 font-medium">
                          {tl(
                            "advancedFilterModalDesc",
                            "Chọn điều kiện lọc • Áp dụng cho danh sách trong modal",
                          )}
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
                            <span>{tl("department", "Bộ phận")}</span>
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
                                {tl("noData", "Không có dữ liệu")}
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
                            <span>{tl("gender", "Giới tính")}</span>
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
                                {tl("noData", "Không có dữ liệu")}
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
                                      gender,
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
                                            (g) => g !== gender,
                                          ),
                                        );
                                      }
                                    }}
                                    className="mr-2 w-4 h-4 cursor-pointer"
                                  />
                                  {gender || tl("unknown", "(Không rõ)")}
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
                        {tl("clearFilter", "Xóa bộ lọc")}
                      </button>
                      <button
                        onClick={() => setModalFilterOpen(false)}
                        className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow font-medium"
                      >
                        {t("attendanceList.close")}
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
                        {t("attendanceList.excelHeaderDept")}
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
                        {t("attendanceList.excelHeaderRemark", {
                          defaultValue: "Ghi chú",
                        })}
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
        <div className="overflow-x-hidden md:overflow-x-auto bg-white rounded-lg shadow-lg">
          <p className="px-4 pb-2 text-xs font-medium text-amber-500 text-end">
            {tl("yearLeaveNote", "Lưu ý: Phép năm chưa tính tháng hiện tại.")}
          </p>
          <table className="w-full table-fixed md:table-auto border-collapse min-w-full md:min-w-[1200px]">
            <thead>
              <tr
                style={{
                  background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
                }}
              >
                <th className="hidden md:table-cell px-2 md:px-3 py-3 md:py-4 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  {tl("stt", "STT")}
                </th>
                <th className="px-2 md:px-3 py-3 md:py-4 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  {tl("mnv", "MNV")}
                </th>
                <th className="hidden md:table-cell px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  {tl("mvt", "MVT")}
                </th>
                <th className="px-2 md:px-4 py-3 md:py-4 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  {tl("fullName", "Họ và tên")}
                </th>
                <th className="hidden md:table-cell px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  {tl("gender", "Giới tính")}
                </th>
                <th className="hidden md:table-cell px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  {tl("dateOfBirth", "Ngày tháng năm sinh")}
                </th>
                <th className="hidden lg:table-cell px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  {tl("departmentCode", "Mã BP")}
                </th>
                <th className="hidden md:table-cell px-4 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  {tl("department", "Bộ phận")}
                </th>
                <th className="px-2 md:px-3 py-3 md:py-4 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  {tl("timeIn", "Thời gian vào")}
                </th>
                <th className="hidden md:table-cell px-2 md:px-3 py-3 md:py-4 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  {tl("timeOut", "Thời gian ra")}
                </th>
                <th className="px-2 md:px-3 py-3 md:py-4 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  {tl("annualLeave", "Phép năm")}
                </th>
                <th className="hidden md:table-cell px-2 md:px-3 py-3 md:py-4 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  {tl("workShift", "Ca làm việc")}
                </th>
                <th className="hidden md:table-cell px-3 py-4 text-sm font-extrabold text-white uppercase tracking-wide text-center">
                  {tl("attendance", "Chấm công")}
                </th>
                {showRowModalActions && (
                  <th className="hidden md:table-cell px-2 md:px-3 py-3 md:py-4 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
                    {tl("actions", "Sửa / Xóa")}
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
                  <td className="hidden md:table-cell px-2 md:px-3 py-2.5 md:py-3 text-xs md:text-sm text-center font-bold text-gray-700">
                    {emp.stt || idx + 1}
                  </td>
                  <td className="px-2 md:px-3 py-2.5 md:py-3 text-xs md:text-sm text-center font-bold text-blue-600 whitespace-nowrap">
                    {emp.mnv}
                  </td>
                  <td className="hidden md:table-cell px-3 py-3 text-sm text-center font-semibold text-gray-700">
                    {emp.mvt}
                  </td>
                  <td className="px-2 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-left md:text-center font-bold text-gray-800 break-words whitespace-normal leading-tight">
                    {emp.hoVaTen}
                  </td>
                  <td className="hidden md:table-cell px-3 py-3 text-sm text-center">
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
                  <td className="hidden md:table-cell px-3 py-3 text-sm text-center font-semibold text-gray-700">
                    {emp.ngayThangNamSinh}
                  </td>
                  <td className="hidden lg:table-cell px-3 py-3 text-sm text-center font-bold text-gray-700">
                    {emp.maBoPhan}
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-sm text-center font-semibold text-gray-700">
                    {emp.boPhan}
                  </td>
                  <td className="px-2 md:px-3 py-2.5 md:py-3 text-xs md:text-sm text-center">
                    {emp.gioVao ? (
                      <span
                        className={`font-bold text-sm md:text-base ${
                          /^\d{1,2}:\d{2}$/.test(emp.gioVao)
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {emp.gioVao}
                      </span>
                    ) : canEditEmployee(emp) ? (
                      <div className="flex items-center justify-center gap-1 md:gap-2">
                        <select
                          disabled={savingGioVao[emp.id]}
                          className="w-full max-w-[94px] md:max-w-none border rounded px-1.5 md:px-2 py-1 text-[11px] md:text-sm text-red-700 font-bold focus:ring-2 focus:ring-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          value={editingGioVao[emp.id] || ""}
                          onChange={(e) => {
                            setEditingGioVao((prev) => ({
                              ...prev,
                              [emp.id]: e.target.value,
                            }));
                          }}
                        >
                          <option value="">
                            {tl("chooseType", "Chọn loại")}
                          </option>
                          <option value="Có đi làm">Có</option>
                          <option value="Vào trễ">Vào trễ</option>
                          <option value="Phép năm">PN</option>
                          <option value="1/2 Phép năm">1/2 PN</option>
                          <option value="Không lương">KL</option>
                          <option value="Không phép">KP</option>
                          <option value="Thai sản">TS</option>
                          <option value="Phép ốm">PO</option>
                          <option value="Tai nạn">TN</option>
                          <option value="Phép cưới">PC</option>
                          <option value="Phép tang">PT</option>
                          <option value="Dưỡng sức">DS</option>
                          <option value="Phép công tác">PCT</option>
                          <option value="Nghỉ việc">NV</option>
                        </select>
                        {editingGioVao[emp.id] && (
                          <button
                            disabled={savingGioVao[emp.id]}
                            onClick={async () => {
                              const value = editingGioVao[emp.id];
                              if (value) {
                                setSavingGioVao((prev) => ({
                                  ...prev,
                                  [emp.id]: true,
                                }));
                                try {
                                  const empRef = ref(
                                    db,
                                    `attendance/${selectedDate}/${emp.id}`,
                                  );
                                  await update(empRef, { gioVao: value });
                                  setEditingGioVao((prev) => {
                                    const newState = { ...prev };
                                    delete newState[emp.id];
                                    return newState;
                                  });
                                  setAlert({
                                    show: true,
                                    type: "success",
                                    message: t("attendanceList.updateSuccess"),
                                  });
                                } catch (err) {
                                  console.error("Save gioVao error:", err);
                                  setAlert({
                                    show: true,
                                    type: "error",
                                    message: tl(
                                      "updateFail",
                                      "❌ Cập nhật thất bại",
                                    ),
                                  });
                                } finally {
                                  setSavingGioVao((prev) => {
                                    const newState = { ...prev };
                                    delete newState[emp.id];
                                    return newState;
                                  });
                                }
                              }
                            }}
                            className="px-1.5 md:px-2 py-1 bg-green-500 text-white rounded text-[10px] md:text-xs hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {savingGioVao[emp.id] ? "⏳" : "✓"}
                          </button>
                        )}
                      </div>
                    ) : user ? (
                      <span className="text-gray-400 italic text-xs">
                        🔒 {tl("cannotEdit", "Không được phép chỉnh sửa")}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">--</span>
                    )}
                  </td>
                  <td className="hidden md:table-cell px-2 md:px-3 py-2.5 md:py-3 text-xs md:text-sm text-center min-w-[90px]">
                    <span className="text-red-600 font-bold text-base">
                      {emp.gioRa}
                    </span>
                  </td>
                  <td className="px-2 md:px-3 py-2.5 md:py-3 text-xs md:text-sm text-center">
                    <span className="text-xs md:text-sm text-gray-700 font-bold">
                      {String(emp.pnTon ?? emp.phepNam ?? "").trim() ||
                        prevCalendarDayPnTonByMnv[
                          normalizeEmployeeCode(emp.mnv)
                        ] ||
                        "--"}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-2 md:px-3 py-2.5 md:py-3 text-xs md:text-sm text-center min-w-[130px]">
                    {emp.caLamViec ? (
                      <span className="text-blue-600 font-bold text-base">
                        {emp.caLamViec}
                      </span>
                    ) : canEditEmployee(emp) ? (
                      <div className="flex items-center justify-center gap-2">
                        <select
                          disabled={savingCaLamViec[emp.id]}
                          className="border rounded px-2 py-1 text-sm text-blue-700 font-bold focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          value={editingCaLamViec[emp.id] || ""}
                          onChange={(e) => {
                            setEditingCaLamViec((prev) => ({
                              ...prev,
                              [emp.id]: e.target.value,
                            }));
                          }}
                        >
                          <option value="">
                            {tl("chooseShift", "Chọn ca")}
                          </option>
                          <option value="Ca đêm">Ca đêm</option>
                          <option value="Ca 1">Ca 1</option>
                          <option value="Ca 2">Ca 2</option>
                          <option value="Ca hành chính">Ca hành chính</option>
                        </select>
                        {editingCaLamViec[emp.id] && (
                          <button
                            disabled={savingCaLamViec[emp.id]}
                            onClick={async () => {
                              const value = editingCaLamViec[emp.id];
                              if (value) {
                                setSavingCaLamViec((prev) => ({
                                  ...prev,
                                  [emp.id]: true,
                                }));
                                try {
                                  const empRef = ref(
                                    db,
                                    `attendance/${selectedDate}/${emp.id}`,
                                  );
                                  await update(empRef, { caLamViec: value });
                                  setEditingCaLamViec((prev) => {
                                    const newState = { ...prev };
                                    delete newState[emp.id];
                                    return newState;
                                  });
                                  setAlert({
                                    show: true,
                                    type: "success",
                                    message: t("attendanceList.updateSuccess"),
                                  });
                                } catch (err) {
                                  console.error("Save caLamViec error:", err);
                                  setAlert({
                                    show: true,
                                    type: "error",
                                    message: tl(
                                      "updateFail",
                                      "❌ Cập nhật thất bại",
                                    ),
                                  });
                                } finally {
                                  setSavingCaLamViec((prev) => {
                                    const newState = { ...prev };
                                    delete newState[emp.id];
                                    return newState;
                                  });
                                }
                              }
                            }}
                            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {savingCaLamViec[emp.id] ? "⏳" : "✓"}
                          </button>
                        )}
                      </div>
                    ) : user ? (
                      <span className="text-gray-400 italic text-xs">
                        🔒 {tl("cannotEdit", "Không được phép chỉnh sửa")}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">--</span>
                    )}
                  </td>
                  <td className="hidden md:table-cell px-3 py-3 text-sm text-center">
                    <span className="text-gray-700 font-medium">
                      {emp.chamCong || "--"}
                    </span>
                  </td>
                  {showRowModalActions && (
                    <td className="hidden md:table-cell px-2 py-2 text-center min-w-[120px]">
                      {canEditEmployee(emp) ? (
                        <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-2">
                          <button
                            onClick={() => handleEdit(emp)}
                            className="w-full md:w-auto px-2.5 md:px-3 py-1.5 bg-blue-500 text-white rounded-md text-[11px] md:text-xs font-medium hover:bg-blue-600 transition-all shadow-sm hover:shadow-md whitespace-nowrap"
                            title="Chỉnh sửa"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id)}
                            className="w-full md:w-auto px-2.5 md:px-3 py-1.5 bg-red-500 text-white rounded-md text-[11px] md:text-xs font-medium hover:bg-red-600 transition-all shadow-sm hover:shadow-md whitespace-nowrap"
                            title="Xóa"
                          >
                            🗑️
                          </button>
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

        <div className="mt-6 bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-600">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="w-full">
              <div className="flex flex-wrap items-center gap-4 border border-blue-100 rounded-lg px-3 py-2 bg-gradient-to-r from-blue-50 to-blue-100 shadow-sm">
                {/* Tổng số nhân viên */}
                <span className="flex items-center gap-1 text-sm font-bold text-gray-700">
                  <span className="text-blue-600 text-lg">📊</span>
                  {tl("totalEmployees", "Tổng số nhân viên")}:
                  <span className="ml-1 text-lg text-blue-700">
                    {filteredEmployees.length}
                  </span>
                </span>
                {/* Phân loại phép */}
                <span className="flex items-center gap-1 text-sm font-bold text-gray-700 border-l border-blue-200 pl-4">
                  <span className="text-indigo-500 text-base">🏷️</span>
                  {tl("classification", "Phân loại phép")}:
                  <span className="flex flex-wrap gap-1 ml-1">
                    {(() => {
                      const timeCounts = {};
                      filteredEmployees.forEach((emp) => {
                        const time = emp.gioVao;
                        if (time && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) {
                          timeCounts[time] = (timeCounts[time] || 0) + 1;
                        }
                      });
                      return Object.entries(timeCounts).length > 0 ? (
                        Object.entries(timeCounts).map(([time, count]) => (
                          <span
                            key={time}
                            className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold text-2xs border border-indigo-200"
                          >
                            {time}: {count}
                          </span>
                        ))
                      ) : (
                        <span className="italic text-gray-400">
                          {tl("noClassification", "Không có phân loại")}
                        </span>
                      );
                    })()}
                  </span>
                </span>
                {/* Thống kê ca làm việc */}
                <span className="flex items-center gap-1 text-sm font-bold text-gray-700 border-l border-blue-200 pl-4">
                  <span className="text-amber-500 text-base">🕒</span>
                  {tl("workShiftStats", "Thống kê ca làm việc")}:
                  <span className="flex flex-wrap gap-1 ml-1">
                    {(() => {
                      const shiftCounts = {};
                      filteredEmployees.forEach((emp) => {
                        const shift = emp.caLamViec;
                        if (shift) {
                          shiftCounts[shift] = (shiftCounts[shift] || 0) + 1;
                        }
                      });
                      return Object.entries(shiftCounts).length > 0 ? (
                        Object.entries(shiftCounts).map(([shift, count]) => (
                          <span
                            key={shift}
                            className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-bold text-2xs border border-amber-200"
                          >
                            {shift}: {count}
                          </span>
                        ))
                      ) : (
                        <span className="italic text-gray-400">
                          {tl("noShiftStats", "Không có ca làm việc")}
                        </span>
                      );
                    })()}
                  </span>
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 self-start sm:self-auto">
              {tl("date", "Ngày")}:{" "}
              {new Date(selectedDate).toLocaleDateString(displayLocale)}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default AttendanceList;
