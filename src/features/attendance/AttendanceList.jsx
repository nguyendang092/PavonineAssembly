import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
  useDeferredValue,
  startTransition,
  lazy,
  Suspense,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useUser } from "@/contexts/UserContext";
import {
  isAdminAccess,
  canEditAttendanceForEmployee,
  canDeleteEmployeeData,
  ROLES,
} from "@/config/authRoles";
import { getFirstDayOfMonthKey } from "@/utils/dateKey";
import {
  CHART_ORDER_KIND,
  hydrateChartOrder,
  persistChartOrder,
  applyOrderToAttendanceRows,
} from "@/utils/chartOrderStorage";
import { db, ref, get, onValue, remove } from "@/services/firebase";
import ExcelJS from "exceljs";
import { handleUploadExcel } from "./AttendanceUploadHandler";
import { downloadAttendanceDiemDanhTemplate } from "./attendanceDiemDanhExcelExport";
import AttendanceTableRow, {
  ATTENDANCE_VIRTUAL_THRESHOLD,
  AttendanceTableColgroup,
  AttendanceTableThead,
  AttendanceVirtualHeader,
  getAttendanceGridTemplateColumns,
} from "./AttendanceTableRow";
import { useAttendanceColumnPlan } from "./useAttendanceBirthDeptColumns";
import ExportExcelButton from "@/components/ui/ExportExcelButton";
import UnifiedModal from "@/components/ui/UnifiedModal";
import {
  readUnattendedSessionSuppressed,
  writeUnattendedSessionSuppressed,
} from "@/features/attendance/attendanceUnattendedSession";
import AlertMessage from "@/components/ui/AlertMessage";
import NotificationBell from "@/components/ui/NotificationBell";
import {
  getAttendanceDateRangeExportPlan,
  executeAttendanceDateRangeExport,
} from "./attendanceDateRangeExport";
import AttendanceExportRangeModal from "./AttendanceExportRangeModal";
import AttendanceEmployeeFormModal from "./AttendanceEmployeeFormModal";
import AttendanceOffDaysModal from "./AttendanceOffDaysModal";
import {
  getIsOffDayFromRaw,
  getIsHolidayDayFromRaw,
} from "./attendanceDayMeta";
import { fetchOffAndHolidayDateKeysInMonth } from "./attendanceMonthOffDays";
import {
  normalizeTextValue,
  getAttendanceComboFlags,
} from "./attendanceComboStats";
import {
  ATTENDANCE_LOAI_PHEP_OPTIONS,
  formatAttendanceGioVaoDisplay,
  formatAttendanceLeaveTypeColumnForEmployee,
  formatAttendanceTimeInColumnDisplay,
  getAttendanceLeaveTypeBadgeClassName,
  getAttendanceLeaveTypeColorClassName,
  getAttendanceLeaveTypePrintStyleAttrForEmployee,
  getAttendanceLeaveTypeRaw,
  isGioVaoLeaveOrStatusType,
} from "./attendanceGioVaoTypeOptions";
import {
  COMBO_CHART_METRIC_KEYS,
  COMBO_STAT_LABEL_DEFAULTS,
  attendanceProductionDeptMatchKey,
  applyProductionStatsRowOrder,
} from "./attendanceComboChartConfig";
import {
  ATTENDANCE_LEAVE_FILTER_NONE,
  ATTENDANCE_FILTER_DROPDOWN_HEIGHT_PX,
  ISO_DATE_KEY_RE,
  attendanceTableWrapperMinWidthClass,
  employeeMatchesLoaiPhepFilter,
  isEmployeeQuickUnattended,
} from "./attendanceListShared";
import { mergeAttendanceDayRowsFromRaw } from "./mergeAttendanceDayRows";
import AttendanceSearchActionsBar from "./AttendanceSearchActionsBar";

const AttendanceComboChartModal = lazy(
  () => import("./AttendanceComboChartModal"),
);

function AttendanceList({
  attendanceRootPath = "attendance",
  headerTitle,
  headerSubtitle,
  counterpartLinkTo = "/seasonal-staff-attendance",
  counterpartLinkLabelKey = "seasonalActiveEmployeesTitleShort",
  counterpartLinkLabelDefault = "Điểm danh nhân viên thời vụ",
  forceVirtualizedRows = false,
}) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeModalRecord, setEmployeeModalRecord] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [isOffDay, setIsOffDay] = useState(false);
  const [isHolidayDay, setIsHolidayDay] = useState(false);
  const [offDaysModalOpen, setOffDaysModalOpen] = useState(false);
  const [monthOffAndHoliday, setMonthOffAndHoliday] = useState({
    off: [],
    holiday: [],
  });
  const [monthOffDaysLoading, setMonthOffDaysLoading] = useState(false);
  const { t, i18n } = useTranslation();
  const { user, userDepartments, userRole } = useUser();
  const userEmailKey = useMemo(
    () => user?.email?.trim().toLowerCase() || "anonymous",
    [user?.email],
  );
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const d = searchParams.get("date");
    if (d && ISO_DATE_KEY_RE.test(d)) setSelectedDate(d);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const order = await hydrateChartOrder(
        userEmailKey,
        CHART_ORDER_KIND.ATTENDANCE_DEPT,
      );
      if (!cancelled) setComboChartDeptOrder(order);
    })();
    return () => {
      cancelled = true;
    };
  }, [userEmailKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const order = await hydrateChartOrder(
        userEmailKey,
        CHART_ORDER_KIND.COMBO_PRODUCTION_DEPT_ORDER,
      );
      if (!cancelled) setComboProductionDeptOrder(order);
    })();
    return () => {
      cancelled = true;
    };
  }, [userEmailKey]);
  const tl = useCallback(
    (key, defaultValue, options = {}) =>
      t(`attendanceList.${key}`, { defaultValue, ...options }),
    [t],
  );
  const displayLocale = i18n.language?.startsWith("ko") ? "ko-KR" : "vi-VN";

  const refreshMonthOffDays = useCallback(async () => {
    if (!user || !isAdminAccess(user, userRole)) {
      setMonthOffAndHoliday({ off: [], holiday: [] });
      return;
    }
    if (!selectedDate || !ISO_DATE_KEY_RE.test(selectedDate)) {
      setMonthOffAndHoliday({ off: [], holiday: [] });
      return;
    }
    setMonthOffDaysLoading(true);
    setMonthOffAndHoliday({ off: [], holiday: [] });
    try {
      const oh = await fetchOffAndHolidayDateKeysInMonth(selectedDate);
      setMonthOffAndHoliday(oh);
    } catch (err) {
      console.error("refreshMonthOffDays:", err);
      setMonthOffAndHoliday({ off: [], holiday: [] });
    } finally {
      setMonthOffDaysLoading(false);
    }
  }, [user, userRole, selectedDate]);

  useEffect(() => {
    void refreshMonthOffDays();
  }, [refreshMonthOffDays]);

  const dayOffToolbarButtonTitle = useMemo(() => {
    const hint = tl(
      "dayOffToolbarHint",
      "Mở danh sách ngày off và ngày lễ trong tháng; chỉnh sửa trong cửa sổ đầy đủ.",
    );
    const { off, holiday } = monthOffAndHoliday;
    if (off.length === 0 && holiday.length === 0) return hint;
    return `${hint}\n${tl(
      "dayOffToolbarTitleDates",
      "Ngày off trong tháng (YYYY-MM-DD):",
    )} ${off.join(", ")}\n${tl(
      "dayOffToolbarTitleHolidayDates",
      "Ngày lễ trong tháng (YYYY-MM-DD):",
    )} ${holiday.join(", ")}`;
  }, [monthOffAndHoliday, tl]);

  const [employees, setEmployees] = useState([]);
  const [filterDepartmentSearch, setFilterDepartmentSearch] = useState("");
  const [filterSearchTerm, setFilterSearchTerm] = useState("");
  const [departmentListFilter, setDepartmentListFilter] = useState([]);
  /** Các `value` trong `ATTENDANCE_LOAI_PHEP_OPTIONS` + `ATTENDANCE_LEAVE_FILTER_NONE` */
  const [loaiPhepFilter, setLoaiPhepFilter] = useState([]);
  /** Lọc nhanh: chỉ người chưa có giờ vào, loại phép và ca làm việc (cả ba trống = chưa điểm danh). */
  const [showOnlyUnattendedFilter, setShowOnlyUnattendedFilter] =
    useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [showComboChartModal, setShowComboChartModal] = useState(false);
  const [comboDashboardGroup, setComboDashboardGroup] = useState("production");
  const [comboChartBodyReady, setComboChartBodyReady] = useState(false);
  const [comboChartCardsVisibleCount, setComboChartCardsVisibleCount] =
    useState(0);
  const [comboStatDetailKey, setComboStatDetailKey] = useState(null);
  const [comboChartDeptOrder, setComboChartDeptOrder] = useState([]);
  const [comboProductionDeptOrder, setComboProductionDeptOrder] = useState([]);
  const [modalFilterOpen, setModalFilterOpen] = useState(false);
  const [modalGioiTinhFilter, setModalGioiTinhFilter] = useState([]);
  const [modalDepartmentListFilter, setModalDepartmentListFilter] = useState(
    [],
  );
  const [modalExpandedSections, setModalExpandedSections] = useState({});
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false);
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [showExportRangeModal, setShowExportRangeModal] = useState(false);
  const [exportRangeFrom, setExportRangeFrom] = useState("");
  const [exportRangeTo, setExportRangeTo] = useState("");
  const [exportRangeBusy, setExportRangeBusy] = useState(false);
  const [showUnattendedPopup, setShowUnattendedPopup] = useState(false);
  const [unattendedPopupDismissed, setUnattendedPopupDismissed] =
    useState(false);
  /** Tự động mở popup: không bật lại khi user đã chọn «không hiển thị trong phiên» (sessionStorage). */
  const [unattendedSessionSuppressed, setUnattendedSessionSuppressed] =
    useState(false);
  const [
    unattendedSuppressSessionCheckbox,
    setUnattendedSuppressSessionCheckbox,
  ] = useState(false);
  const [filterMenuDropdownOpen, setFilterMenuDropdownOpen] = useState(false);
  const [offHolidayDropdownOpen, setOffHolidayDropdownOpen] = useState(false);
  const filterMenuRef = useRef(null);
  const filterDropdownAnchorRef = useRef(null);
  const filterMenuPanelRef = useRef(null);
  const actionDropdownRef = useRef(null);
  const printDropdownRef = useRef(null);
  const actionDropdownAnchorRef = useRef(null);
  const printDropdownAnchorRef = useRef(null);
  const actionDropdownPanelRef = useRef(null);
  const printDropdownPanelRef = useRef(null);
  const offHolidayDropdownRef = useRef(null);
  const exportRangeModalInitializedRef = useRef(false);
  const prevShowUnattendedPopupRef = useRef(false);
  const [filterDropdownPlacement, setFilterDropdownPlacement] = useState(null);
  const [actionDropdownPlacement, setActionDropdownPlacement] = useState(null);
  const [printDropdownPlacement, setPrintDropdownPlacement] = useState(null);

  const isQuickNoCheckInActive = showOnlyUnattendedFilter;

  // Chuẩn hóa tên bộ phận để lọc ổn định (tránh lệch hoa/thường, khoảng trắng).
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

  const unattendedEmployees = useMemo(
    () => employees.filter((emp) => isEmployeeQuickUnattended(emp)),
    [employees],
  );

  useEffect(() => {
    setUnattendedSessionSuppressed(readUnattendedSessionSuppressed(user?.uid));
  }, [user?.uid]);

  const closeUnattendedPopup = useCallback(() => {
    setShowUnattendedPopup(false);
    setUnattendedPopupDismissed(true);
    if (unattendedSuppressSessionCheckbox) {
      setUnattendedSessionSuppressed(true);
      writeUnattendedSessionSuppressed(user?.uid, true);
    }
  }, [user?.uid, unattendedSuppressSessionCheckbox]);

  const attendanceRawRef = useRef(undefined);

  useEffect(() => {
    attendanceRawRef.current = undefined;
    setEmployees([]);
    const empRef = ref(db, `${attendanceRootPath}/${selectedDate}`);
    const unsubscribe = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      attendanceRawRef.current = data;
      setIsOffDay(getIsOffDayFromRaw(data));
      setIsHolidayDay(getIsHolidayDayFromRaw(data));
      setEmployees(mergeAttendanceDayRowsFromRaw(data));
    });
    return () => unsubscribe();
  }, [selectedDate]);

  useEffect(() => {
    setShowUnattendedPopup(false);
    setUnattendedPopupDismissed(false);
  }, [selectedDate]);

  useEffect(() => {
    if (unattendedPopupDismissed || unattendedSessionSuppressed) return;

    if (unattendedEmployees.length === 0) {
      setShowUnattendedPopup(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowUnattendedPopup(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [
    unattendedEmployees,
    unattendedPopupDismissed,
    unattendedSessionSuppressed,
  ]);

  useEffect(() => {
    if (showUnattendedPopup && !prevShowUnattendedPopupRef.current) {
      setUnattendedSuppressSessionCheckbox(false);
    }
    prevShowUnattendedPopupRef.current = showUnattendedPopup;
  }, [showUnattendedPopup]);

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

  const showRowModalActions = Boolean(
    user && userRole && userRole !== ROLES.STAFF,
  );

  const canDeleteDayRecord = canDeleteEmployeeData(user, userRole);

  const columnPlan = useAttendanceColumnPlan();

  const attendanceGridTemplateColumns = useMemo(
    () => getAttendanceGridTemplateColumns(showRowModalActions, columnPlan),
    [showRowModalActions, columnPlan],
  );

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
      const maxAvail = Math.max(120, window.innerHeight - top - 12);
      const height = Math.min(ATTENDANCE_FILTER_DROPDOWN_HEIGHT_PX, maxAvail);
      setFilterDropdownPlacement({ top, left, width: w, height });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [filterMenuDropdownOpen]);

  // Chức năng / In — portal + fixed (thanh công cụ có overflow-x-auto → cắt menu absolute).
  // Trên mobile hai nút bị «hidden sm:block» (display:none) — rect = 0: phải đóng menu,
  // không return sớm để tránh giữ placement cũ → menu portal treo / lệch sau khi responsive.
  useLayoutEffect(() => {
    if (!actionDropdownOpen) {
      setActionDropdownPlacement(null);
      return;
    }
    const update = () => {
      const btn = actionDropdownAnchorRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      if (r.width <= 0 && r.height <= 0) {
        setActionDropdownPlacement(null);
        setActionDropdownOpen(false);
        return;
      }
      const w = Math.min(288, window.innerWidth - 16);
      let left =
        window.innerWidth < 640
          ? Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
          : Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
      const top = r.bottom + 6;
      const maxHeight = Math.max(160, window.innerHeight - top - 12);
      setActionDropdownPlacement({ top, left, width: w, maxHeight });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [actionDropdownOpen]);

  useLayoutEffect(() => {
    if (!printDropdownOpen) {
      setPrintDropdownPlacement(null);
      return;
    }
    const update = () => {
      const btn = printDropdownAnchorRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      if (r.width <= 0 && r.height <= 0) {
        setPrintDropdownPlacement(null);
        setPrintDropdownOpen(false);
        return;
      }
      const w = Math.min(288, window.innerWidth - 16);
      let left =
        window.innerWidth < 640
          ? Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
          : Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
      const top = r.bottom + 6;
      const maxHeight = Math.max(160, window.innerHeight - top - 12);
      setPrintDropdownPlacement({ top, left, width: w, maxHeight });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [printDropdownOpen]);

  /** Dưới breakpoint sm nút Chức năng/In không mount hiển thị — đóng menu portal nếu còn mở (xoay máy / resize). */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => {
      if (mq.matches) return;
      setActionDropdownOpen(false);
      setPrintDropdownOpen(false);
      setActionDropdownPlacement(null);
      setPrintDropdownPlacement(null);
    };
    mq.addEventListener("change", sync);
    sync();
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Đóng menu khi click ra ngoài — dùng «click» (không dùng mousedown).
  // mousedown chạy trước onClick của nút; đóng menu khác + re-render cùng lúc có thể làm mất sự kiện click (Chức năng / In tưởng như hỏng).
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (event.button != null && event.button !== 0) return;
      const raw = event.target;
      const target =
        raw instanceof Element
          ? raw
          : raw instanceof Node && raw.parentElement
            ? raw.parentElement
            : null;
      if (!target) return;

      if (
        filterMenuDropdownOpen &&
        filterMenuRef.current &&
        !filterMenuRef.current.contains(target) &&
        !filterMenuPanelRef.current?.contains(target)
      ) {
        setFilterMenuDropdownOpen(false);
      }

      if (
        printDropdownOpen &&
        printDropdownRef.current &&
        !printDropdownRef.current.contains(target) &&
        !printDropdownPanelRef.current?.contains(target)
      ) {
        setPrintDropdownOpen(false);
      }

      if (
        actionDropdownOpen &&
        actionDropdownRef.current &&
        !actionDropdownRef.current.contains(target) &&
        !actionDropdownPanelRef.current?.contains(target)
      ) {
        setActionDropdownOpen(false);
      }

      if (
        offHolidayDropdownOpen &&
        offHolidayDropdownRef.current &&
        !offHolidayDropdownRef.current.contains(target)
      ) {
        setOffHolidayDropdownOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [
    filterMenuDropdownOpen,
    printDropdownOpen,
    actionDropdownOpen,
    offHolidayDropdownOpen,
  ]);

  // Always close menus when route changes (pathname/query/hash).
  useEffect(() => {
    setFilterMenuDropdownOpen(false);
    setOffHolidayDropdownOpen(false);
    setActionDropdownOpen(false);
    setPrintDropdownOpen(false);
  }, [location.pathname, location.search, location.hash]);

  // Khóa scroll nền khi mở modal «Bộ lọc nâng cao» (portal ra body).
  useEffect(() => {
    if (!filterOpen) return;
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

  const filterAttendanceListRows = useCallback(
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
      loaiPhepFilter,
      showOnlyUnattendedFilter,
      normalizeDepartment,
    ],
  );

  const filteredEmployees = useMemo(
    () => filterAttendanceListRows(employees),
    [employees, filterAttendanceListRows],
  );

  useEffect(() => {
    if (!showExportRangeModal) {
      exportRangeModalInitializedRef.current = false;
      return;
    }
    if (exportRangeModalInitializedRef.current) return;
    exportRangeModalInitializedRef.current = true;
    setExportRangeFrom(getFirstDayOfMonthKey(selectedDate));
    setExportRangeTo(selectedDate);
  }, [showExportRangeModal, selectedDate]);

  const handleExportAttendanceDateRange = useCallback(async () => {
    if (exportRangeBusy) return;
    const plan = getAttendanceDateRangeExportPlan(
      exportRangeFrom,
      exportRangeTo,
      tl,
    );
    if (!plan.ok) {
      setAlert({ show: true, ...plan.alert });
      return;
    }
    setExportRangeBusy(true);
    try {
      const result = await executeAttendanceDateRangeExport({
        keys: plan.keys,
        from: plan.from,
        to: plan.to,
        db,
        ref,
        get,
        applyAttendanceMerge: mergeAttendanceDayRowsFromRaw,
        filterAttendanceListRows,
        displayLocale,
        tl,
      });
      if (!result.ok) {
        setAlert({ show: true, ...result.alert });
        return;
      }
      const blob = new Blob([result.buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      window.URL.revokeObjectURL(url);

      setShowExportRangeModal(false);
      setAlert({
        show: true,
        type: "success",
        message: tl(
          "exportRangeSuccess",
          "✅ Đã xuất Excel: {{days}} ngày, {{rows}} dòng.",
          { days: result.days, rows: result.rows },
        ),
      });
    } catch (err) {
      console.error("Export attendance range:", err);
      setAlert({
        show: true,
        type: "error",
        message: tl("exportRangeError", "❌ Xuất Excel thất bại: {{error}}", {
          error: err?.message || String(err),
        }),
      });
    } finally {
      setExportRangeBusy(false);
    }
  }, [
    exportRangeBusy,
    exportRangeFrom,
    exportRangeTo,
    db,
    ref,
    get,
    mergeAttendanceDayRowsFromRaw,
    filterAttendanceListRows,
    displayLocale,
    tl,
  ]);

  /** Giảm tải main thread khi gõ lọc: bảng cập nhật ngay, biểu đồ combo theo sau */
  const deferredFilteredForCharts = useDeferredValue(filteredEmployees);

  /** Mọi bộ phận có trong dữ liệu điểm danh (sau bộ lọc) — dùng cho picker BP sản xuất / STT. */
  const comboProductionDeptCatalog = useMemo(() => {
    const byMk = new Map();
    for (const emp of deferredFilteredForCharts) {
      const label = normalizeTextValue(emp.boPhan);
      if (!label) continue;
      const mk = attendanceProductionDeptMatchKey(
        normalizeDepartment,
        emp.boPhan,
      );
      if (!mk) continue;
      if (!byMk.has(mk)) byMk.set(mk, { matchKey: mk, label });
    }
    return Array.from(byMk.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "vi", { sensitivity: "base" }),
    );
  }, [deferredFilteredForCharts, normalizeDepartment]);

  const deferredFilteredForComboStats = useMemo(() => {
    if (comboDashboardGroup !== "production") return deferredFilteredForCharts;
    const catalogKeys = new Set(
      comboProductionDeptCatalog.map((c) => c.matchKey),
    );
    if (comboProductionDeptOrder.length === 0) {
      return deferredFilteredForCharts.filter((emp) => {
        const mk = attendanceProductionDeptMatchKey(
          normalizeDepartment,
          emp.boPhan,
        );
        return mk && catalogKeys.has(mk);
      });
    }
    const allow = new Set(comboProductionDeptOrder);
    return deferredFilteredForCharts.filter((emp) => {
      const mk = attendanceProductionDeptMatchKey(
        normalizeDepartment,
        emp.boPhan,
      );
      return mk && allow.has(mk);
    });
  }, [
    deferredFilteredForCharts,
    comboDashboardGroup,
    comboProductionDeptOrder,
    comboProductionDeptCatalog,
    normalizeDepartment,
  ]);

  const effectiveProductionDeptOrderForSort = useMemo(
    () =>
      comboProductionDeptOrder.length > 0
        ? comboProductionDeptOrder
        : comboProductionDeptCatalog.map((c) => c.matchKey),
    [comboProductionDeptOrder, comboProductionDeptCatalog],
  );

  const comboProductionDeptRankByMk = useMemo(() => {
    const m = new Map();
    effectiveProductionDeptOrderForSort.forEach((mk, i) => {
      m.set(mk, i + 1);
    });
    return m;
  }, [effectiveProductionDeptOrderForSort]);

  const getComboProductionDeptChartRank = useCallback(
    (departmentLabel) => {
      const mk = attendanceProductionDeptMatchKey(
        normalizeDepartment,
        departmentLabel,
      );
      if (!mk) return null;
      return comboProductionDeptRankByMk.get(mk) ?? null;
    },
    [comboProductionDeptRankByMk, normalizeDepartment],
  );

  const persistComboProductionDeptOrder = useCallback(
    (keys) => {
      const list = Array.isArray(keys)
        ? keys.filter((x) => typeof x === "string")
        : [];
      setComboProductionDeptOrder(list);
      void persistChartOrder(
        userEmailKey,
        CHART_ORDER_KIND.COMBO_PRODUCTION_DEPT_ORDER,
        list,
      );
    },
    [userEmailKey],
  );

  const comboChartData = useMemo(() => {
    const map = new Map();
    const emptyMetrics = () =>
      Object.fromEntries(COMBO_CHART_METRIC_KEYS.map((k) => [k, 0]));
    deferredFilteredForComboStats.forEach((emp) => {
      const flags = getAttendanceComboFlags(emp);
      const department =
        normalizeTextValue(emp.boPhan) ||
        tl("unknownDepartment", "Chưa phân bộ phận");
      const row = map.get(department) || {
        department,
        total: 0,
        ...emptyMetrics(),
      };
      row.total += 1;
      for (const k of COMBO_CHART_METRIC_KEYS) {
        if (flags[k]) row[k] += 1;
      }
      map.set(department, row);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [deferredFilteredForComboStats, tl]);

  const comboChartDataOrdered = useMemo(() => {
    if (comboDashboardGroup !== "production") {
      return applyOrderToAttendanceRows(comboChartData, comboChartDeptOrder);
    }
    return applyProductionStatsRowOrder(
      comboChartData,
      effectiveProductionDeptOrderForSort,
      normalizeDepartment,
    );
  }, [
    comboChartData,
    comboChartDeptOrder,
    comboDashboardGroup,
    effectiveProductionDeptOrderForSort,
    normalizeDepartment,
  ]);

  const comboDashboardStats = useMemo(() => {
    const zero = () =>
      Object.fromEntries(COMBO_CHART_METRIC_KEYS.map((k) => [k, 0]));
    const stats = comboChartData.reduce(
      (acc, row) => {
        acc.total += row.total;
        for (const k of COMBO_CHART_METRIC_KEYS) {
          acc[k] += row[k];
        }
        return acc;
      },
      { total: 0, ...zero() },
    );
    return stats;
  }, [comboChartData]);

  const comboChartRowsVisible = useMemo(
    () => comboChartDataOrdered.slice(0, comboChartCardsVisibleCount),
    [comboChartDataOrdered, comboChartCardsVisibleCount],
  );

  const comboStatEmployeesByKey = useMemo(() => {
    const list = deferredFilteredForComboStats;
    const buckets = {
      total: [...list],
      ...Object.fromEntries(COMBO_CHART_METRIC_KEYS.map((k) => [k, []])),
    };
    for (const emp of list) {
      const f = getAttendanceComboFlags(emp);
      for (const k of COMBO_CHART_METRIC_KEYS) {
        if (f[k]) buckets[k].push(emp);
      }
    }
    return buckets;
  }, [deferredFilteredForComboStats]);

  const comboStatLabelByKey = useMemo(() => {
    const fromKeys = Object.fromEntries(
      COMBO_CHART_METRIC_KEYS.map((k) => [
        k,
        tl(k, COMBO_STAT_LABEL_DEFAULTS[k]),
      ]),
    );
    return {
      total: tl("totalEmployees", "Tổng số nhân viên"),
      ...fromKeys,
    };
  }, [tl]);

  useEffect(() => {
    if (!showComboChartModal) {
      setComboStatDetailKey(null);
      setComboChartBodyReady(false);
      setComboChartCardsVisibleCount(0);
      return;
    }
    setComboChartBodyReady(false);
    setComboChartCardsVisibleCount(0);
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        startTransition(() => {
          if (!cancelled) setComboChartBodyReady(true);
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [showComboChartModal, comboDashboardGroup]);

  useLayoutEffect(() => {
    if (!comboChartBodyReady) return;
    const total = comboChartDataOrdered.length;
    if (total === 0) {
      setComboChartCardsVisibleCount(0);
      return undefined;
    }
    const batch = 6;
    let count = Math.min(batch, total);
    setComboChartCardsVisibleCount(count);
    if (count >= total) return undefined;
    let cancelled = false;
    const ric =
      typeof window !== "undefined" && window.requestIdleCallback
        ? window.requestIdleCallback.bind(window)
        : (cb) => setTimeout(cb, 48);
    const tick = () => {
      if (cancelled) return;
      count = Math.min(count + batch, total);
      setComboChartCardsVisibleCount(count);
      if (count < total) ric(tick, { timeout: 120 });
    };
    ric(tick, { timeout: 120 });
    return () => {
      cancelled = true;
    };
  }, [comboChartBodyReady, comboChartDataOrdered]);

  useEffect(() => {
    if (!showComboChartModal) return;
    const html = document.documentElement;
    const body = document.body;
    const mainScroll = document.getElementById("app-main-scroll");
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevMainOverflow = mainScroll?.style.overflow ?? "";
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (mainScroll) mainScroll.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      if (mainScroll) mainScroll.style.overflow = prevMainOverflow;
    };
  }, [showComboChartModal]);

  useEffect(() => {
    if (!comboStatDetailKey) return;
    const onKey = (e) => {
      if (e.key === "Escape") setComboStatDetailKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [comboStatDetailKey]);

  useEffect(() => {
    if (!showComboChartModal || !comboStatDetailKey) return;
    const s = comboDashboardStats;
    const key = comboStatDetailKey;
    const n =
      key === "total"
        ? s.total
        : Object.prototype.hasOwnProperty.call(s, key)
          ? s[key]
          : -1;
    if (n === 0) setComboStatDetailKey(null);
  }, [showComboChartModal, comboStatDetailKey, comboDashboardStats]);

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
      if (showOnlyUnattendedFilter && !isEmployeeQuickUnattended(emp)) continue;
      if (!employeeMatchesLoaiPhepFilter(emp, loaiPhepFilter)) continue;
      const deptLabel = String(emp.boPhan || "").trim();
      const deptKey = normalizeDepartment(deptLabel);
      if (!deptKey) continue;
      if (!deptMap.has(deptKey)) {
        deptMap.set(deptKey, deptLabel);
      }
    }
    return Array.from(deptMap.values());
  }, [
    employees,
    loaiPhepFilter,
    showOnlyUnattendedFilter,
    normalizeDepartment,
  ]);

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
      // Apply other filters except Shift
      if (showOnlyUnattendedFilter && !isEmployeeQuickUnattended(emp)) continue;
      if (!employeeMatchesLoaiPhepFilter(emp, loaiPhepFilter)) continue;
      const empDeptKey = normalizeDepartment(emp.boPhan);
      if (selectedDeptKeys.size > 0 && !selectedDeptKeys.has(empDeptKey))
        continue;
      if (emp.caLamViec) shifts.add(emp.caLamViec);
    }
    return Array.from(shifts).sort();
  }, [
    employees,
    loaiPhepFilter,
    showOnlyUnattendedFilter,
    departmentListFilter,
    normalizeDepartment,
  ]);

  // Filter departments based on search
  const filteredDepartments = useMemo(() => {
    if (!departmentSearchTerm.trim()) return departments;
    const search = departmentSearchTerm.toLowerCase();
    return departments.filter((dept) => dept.toLowerCase().includes(search));
  }, [departments, departmentSearchTerm]);

  // Handle edit — mở AttendanceEmployeeFormModal
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
      setEmployeeModalRecord({ ...emp });
      setShowEmployeeModal(true);
    },
    [user, userRole, userDepartments, t],
  );

  /** Mở sửa từ URL ?edit=<id> (vd. từ trang Lương). Xóa `edit` sau khi xử lý để không lặp. */
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || !user) return;
    if (employees.length === 0) return;

    const emp = employees.find((e) => String(e.id) === String(editId));

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("edit");
        return next;
      },
      { replace: true },
    );

    if (emp) handleEdit(emp);
  }, [searchParams, employees, user, handleEdit, setSearchParams]);

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
        await remove(ref(db, `${attendanceRootPath}/${selectedDate}/${id}`));
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

  const tableScrollParentRef = useRef(null);
  const shouldVirtualizeTable =
    forceVirtualizedRows ||
    filteredEmployees.length > ATTENDANCE_VIRTUAL_THRESHOLD;
  const rowEstimatePx = 36;

  const rowVirtualizer = useVirtualizer({
    count: filteredEmployees.length,
    getScrollElement: () => tableScrollParentRef.current,
    // Đồng bộ mật độ hiển thị với chiều cao hàng thực tế.
    estimateSize: () => rowEstimatePx,
    overscan: 10,
  });

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
        attendanceRootPath,
      });
    },
    [
      user,
      selectedDate,
      setAlert,
      setIsUploadingExcel,
      t,
      db,
      attendanceRootPath,
    ],
  );

  const handleDownloadAttendanceExcelTemplate = useCallback(async () => {
    try {
      await downloadAttendanceDiemDanhTemplate({ selectedDate });
      setAlert({
        show: true,
        type: "success",
        message: tl(
          "downloadExcelTemplateOk",
          "Đã tải mẫu Excel — cùng form xuất; điền dữ liệu phía dưới hai dòng tiêu đề rồi upload.",
        ),
      });
    } catch (err) {
      console.error(err);
      setAlert({
        show: true,
        type: "error",
        message: tl(
          "downloadExcelTemplateFail",
          "Không tạo được file mẫu Excel.",
        ),
      });
    }
  }, [selectedDate, setAlert, tl]);

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
      await remove(ref(db, `${attendanceRootPath}/${selectedDate}`));
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
          <th style="width:25%">Họ và tên</th>
          <th style="width:8%">Giới tính</th>
          <th style="width:7%">Mã BP</th>
          <th style="width:10%">Bộ phận</th>
          <th style="width:8%">Thời gian vào</th>
          <th style="width:8%">Thời gian ra</th>
          <th style="width:8%">Loại phép</th>
          <th style="width:8%">Ca làm việc</th>
        </tr>
      </thead>
      <tbody>`;

    filteredEmployees.forEach((emp, idx) => {
      const gioiTinh = emp.gioiTinh || "";
      html += `
        <tr>
          <td>${emp.stt || idx + 1}</td>
          <td>${emp.mnv || ""}</td>
          <td>${emp.mvt || ""}</td>
          <td class="name">${emp.hoVaTen || ""}</td>
            <td>${gioiTinh}</td>
            <td>${emp.maBoPhan || ""}</td>
            <td class="dept">${emp.boPhan || ""}</td>
            <td style="${
              formatAttendanceTimeInColumnDisplay(emp.gioVao)
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
        <div className="mb-1.5 md:mb-2">
          <div className="rounded-lg border-t-4 border-blue-600 bg-white px-2 py-1 shadow-md md:px-3 md:py-1.5 dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-2">
              <div className="min-w-0 text-left">
                <h1 className="text-balance text-sm font-bold uppercase leading-snug tracking-wide text-[#1e293b] md:text-base dark:text-slate-100">
                  {headerTitle ??
                    tl("activeEmployeesTitle", "DANH SÁCH NHÂN VIÊN HIỆN DIỆN")}
                </h1>
                <p className="mt-0.5 hidden text-[11px] leading-snug text-gray-600 md:mt-0.5 md:block md:text-xs">
                  {headerSubtitle ??
                    tl("activeEmployeesSubtitle", "List of Active Employees")}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-gray-500 md:mt-0.5 md:text-[11px]">
                  {tl("headerDateLabel", "Ngày")}:{" "}
                  {new Date(selectedDate).toLocaleDateString(displayLocale)}
                </p>
              </div>
              <nav
                className="flex w-full shrink-0 flex-row flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-slate-100 pt-1 text-left sm:mb-0.5 sm:w-auto sm:flex-nowrap sm:items-end sm:border-0 sm:pt-0 sm:text-right"
                aria-label={tl("headerQuickLinks", "Liên kết nhanh")}
              >
                <Link
                  to={counterpartLinkTo}
                  className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:underline sm:justify-end md:text-xs"
                >
                  <span aria-hidden>→</span>
                  {tl(counterpartLinkLabelKey, counterpartLinkLabelDefault)}
                </Link>
                <Link
                  to={`/attendance-salary?date=${encodeURIComponent(selectedDate)}`}
                  className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300 sm:justify-end md:text-xs"
                >
                  <span aria-hidden>→</span>
                  {tl("linkToAttendanceSalaryShort", "Giờ công / Lương")}
                </Link>
              </nav>
            </div>
          </div>
        </div>

        <AlertMessage alert={alert} />

        {/* Popup nhân viên chưa điểm danh - sử dụng UnifiedModal */}
        <UnifiedModal
          isOpen={showUnattendedPopup && unattendedEmployees.length > 0}
          onClose={closeUnattendedPopup}
          variant="primary"
          title={tl("unattendedTitle", "Nhân viên chưa điểm danh")}
          size="lg"
          footerStart={
            <label className="flex cursor-pointer items-center gap-2.5 text-left">
              <input
                type="checkbox"
                checked={unattendedSuppressSessionCheckbox}
                onChange={() => setUnattendedSuppressSessionCheckbox((v) => !v)}
                className="h-[18px] w-[18px] shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-300/70 dark:border-slate-600 dark:text-indigo-500 dark:focus:ring-indigo-800/60"
              />
              <span className="min-w-0 text-[11px] font-medium leading-snug text-slate-700 dark:text-slate-300">
                {tl(
                  "unattendedSuppressSession",
                  "Không tự hiển thị lại hộp thoại này trong phiên đăng nhập hiện tại",
                )}
              </span>
            </label>
          }
          actions={[
            {
              label: t("attendanceList.close"),
              onClick: closeUnattendedPopup,
              variant: "secondary",
            },
            {
              label: t("attendanceList.quickFilter"),
              onClick: () => {
                setShowOnlyUnattendedFilter(true);
                closeUnattendedPopup();
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
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                {unattendedEmployees.map((emp, idx) => (
                  <tr
                    key={emp.id}
                    className={`transition-colors hover:bg-blue-50 ${
                      idx % 2 === 0
                        ? "bg-gray-50 dark:bg-slate-800/60"
                        : "bg-white dark:bg-slate-900"
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

        <AttendanceExportRangeModal
          isOpen={showExportRangeModal}
          onClose={() => setShowExportRangeModal(false)}
          exportRangeBusy={exportRangeBusy}
          exportRangeFrom={exportRangeFrom}
          exportRangeTo={exportRangeTo}
          onChangeFrom={setExportRangeFrom}
          onChangeTo={setExportRangeTo}
          onConfirmExport={handleExportAttendanceDateRange}
          tl={tl}
        />

        {/* Filters and Actions — shrink-0 tránh co mất nút khi danh sách ít / màn hẹp */}
        <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid min-w-0 flex-1 grid-cols-2 items-center gap-5 px-1 sm:flex sm:flex-nowrap sm:gap-1.5 sm:px-0 sm:overflow-x-auto sm:whitespace-nowrap">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 w-full min-w-0 rounded-md border bg-white px-2.5 text-sm font-semibold text-blue-700 focus:ring-2 focus:ring-blue-300 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-300 sm:w-auto"
            />
            {user && isAdminAccess(user, userRole) ? (
              <div
                className="relative min-w-0 pl-1 sm:pl-0"
                ref={offHolidayDropdownRef}
              >
                <button
                  type="button"
                  aria-expanded={offHolidayDropdownOpen}
                  aria-haspopup="menu"
                  onClick={() => setOffHolidayDropdownOpen((open) => !open)}
                  className={`inline-flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-lg border-2 px-3 text-sm font-bold tracking-tight shadow-md transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-300/70 dark:focus-visible:ring-violet-600/50 sm:px-3 sm:max-w-[min(100vw-10rem,19rem)] ${
                    offHolidayDropdownOpen
                      ? "border-violet-500 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/35 ring-2 ring-violet-400/90 ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
                      : "border-violet-400/90 bg-gradient-to-br from-white to-violet-50 text-violet-950 hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/20 dark:border-violet-500/70 dark:from-slate-900 dark:to-violet-950/80 dark:text-violet-50 dark:hover:border-violet-400 dark:hover:shadow-violet-900/40"
                  }`}
                  title={dayOffToolbarButtonTitle}
                >
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-sm ${
                      offHolidayDropdownOpen
                        ? "bg-white/25 text-lg leading-none"
                        : "bg-violet-600/15 dark:bg-white/10"
                    }`}
                  >
                    📅
                  </span>
                  <span className="min-w-0 shrink truncate">
                    {tl("dayOffHolidayDropdownTrigger", "Ngày OFF / LỄ")}
                  </span>
                  {isHolidayDay ? (
                    <span className="shrink-0 rounded-md border border-amber-300/80 bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wide text-white shadow-sm dark:border-amber-400/60">
                      Lễ
                    </span>
                  ) : isOffDay ? (
                    <span className="shrink-0 rounded-md border border-rose-300/80 bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wide text-white shadow-sm dark:border-rose-400/60">
                      OFF
                    </span>
                  ) : null}
                  <svg
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      offHolidayDropdownOpen
                        ? "rotate-180 text-white"
                        : "text-violet-700 dark:text-violet-200"
                    }`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {offHolidayDropdownOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-[130] mt-2 w-[min(100vw-1rem,23rem)] max-w-[calc(100vw-1rem)] origin-top overflow-hidden rounded-2xl border-2 border-violet-400/70 bg-white text-left shadow-2xl shadow-violet-900/20 ring-4 ring-violet-500/15 backdrop-blur-sm sm:left-0 sm:right-auto dark:border-violet-500/50 dark:bg-slate-900 dark:shadow-black/50 dark:ring-violet-400/20"
                  >
                    <div className="border-b border-violet-200/80 bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-700 px-4 py-3 dark:border-violet-500/40 dark:from-violet-700 dark:via-indigo-700 dark:to-violet-800">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/90">
                        {tl("dayOffDropdownSelectedLabel", "Ngày đang xem")}
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm leading-snug text-white">
                        <span className="rounded-lg bg-black/20 px-2 py-1 font-mono text-sm font-bold tabular-nums tracking-tight">
                          {selectedDate}
                        </span>
                        <span className="text-white/70">—</span>
                        {isHolidayDay ? (
                          <span className="rounded-lg border border-amber-300/60 bg-amber-500/95 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-white shadow-inner">
                            HOLIDAY
                          </span>
                        ) : isOffDay ? (
                          <span className="rounded-lg border border-rose-300/60 bg-rose-600 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-white shadow-inner">
                            OFF
                          </span>
                        ) : (
                          <span className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold">
                            {tl("dayKindNormal", "Ngày bình thường")}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="max-h-[min(46vh,280px)] overflow-y-auto bg-slate-50/90 px-4 py-3 dark:bg-slate-950/80">
                      {monthOffDaysLoading ? (
                        <p className="rounded-lg border border-violet-200/80 bg-white px-3 py-4 text-center text-xs font-medium text-violet-800 dark:border-violet-700/60 dark:bg-slate-900 dark:text-violet-200">
                          {tl(
                            "dayOffToolbarLoading",
                            "Đang tải danh sách ngày off trong tháng…",
                          )}
                        </p>
                      ) : (
                        <div className="space-y-4 text-xs">
                          <div className="rounded-xl border border-rose-200/90 bg-white p-3 shadow-sm dark:border-rose-900/60 dark:bg-slate-900">
                            <p className="flex items-center gap-2 border-l-4 border-rose-500 pl-2 text-[13px] font-extrabold uppercase tracking-wide text-rose-800 dark:border-rose-400 dark:text-rose-100">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-[11px] font-black text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                                O
                              </span>
                              {tl("dayOffDropdownSectionOff", "Ngày off")}
                            </p>
                            {monthOffAndHoliday.off.length === 0 ? (
                              <p className="mt-2 rounded-lg bg-rose-50/80 px-2 py-2 italic text-rose-700/90 dark:bg-rose-950/40 dark:text-rose-200/90">
                                {tl(
                                  "dayOffDropdownEmptyOff",
                                  "Chưa có ngày off trong tháng này.",
                                )}
                              </p>
                            ) : (
                              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                                {monthOffAndHoliday.off.map((k) => (
                                  <li key={k}>
                                    <span className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 font-mono text-[11px] font-bold tabular-nums text-rose-950 shadow-sm dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-50">
                                      {k}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="rounded-xl border border-amber-200/90 bg-white p-3 shadow-sm dark:border-amber-900/60 dark:bg-slate-900">
                            <p className="flex items-center gap-2 border-l-4 border-amber-500 pl-2 text-[13px] font-extrabold uppercase tracking-wide text-amber-950 dark:border-amber-400 dark:text-amber-50">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[11px] dark:bg-amber-950">
                                ★
                              </span>
                              {tl("dayOffDropdownSectionHoliday", "Ngày lễ")}
                            </p>
                            {monthOffAndHoliday.holiday.length === 0 ? (
                              <p className="mt-2 rounded-lg bg-amber-50/90 px-2 py-2 italic text-amber-900/90 dark:bg-amber-950/40 dark:text-amber-100/90">
                                {tl(
                                  "dayOffDropdownEmptyHoliday",
                                  "Chưa có ngày lễ trong tháng này.",
                                )}
                              </p>
                            ) : (
                              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                                {monthOffAndHoliday.holiday.map((k) => (
                                  <li key={k}>
                                    <span className="inline-flex items-center rounded-lg border border-amber-300/80 bg-amber-50 px-2 py-1 font-mono text-[11px] font-bold tabular-nums text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-50">
                                      {k}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-violet-200/80 bg-gradient-to-b from-violet-50/90 to-white px-3 py-3 dark:border-violet-800/80 dark:from-slate-900 dark:to-slate-950">
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full rounded-lg bg-gradient-to-r from-violet-600 via-violet-600 to-indigo-600 py-2.5 text-center text-xs font-extrabold uppercase tracking-wide text-white shadow-lg shadow-violet-600/40 transition hover:from-violet-500 hover:to-indigo-500 hover:shadow-xl hover:shadow-violet-500/45 active:scale-[0.99] dark:shadow-violet-900/50"
                        onClick={() => {
                          setOffHolidayDropdownOpen(false);
                          setOffDaysModalOpen(true);
                        }}
                      >
                        {tl(
                          "dayOffDropdownOpenModal",
                          "Chỉnh sửa ngày OFF / LỄ",
                        )}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <AttendanceSearchActionsBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={t("attendanceList.searchPlaceholder")}
            layout="three"
            showSearchOnDesktop
          >
            <div className="hidden shrink-0 sm:block">
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
                            {tl("colLeaveType", "Loại phép")}
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
                              {formatAttendanceTimeInColumnDisplay(emp.gioVao)}
                            </td>
                            <td style={{ textAlign: "center", padding: 8 }}>
                              <span
                                className={`font-semibold ${getAttendanceLeaveTypeColorClassName(
                                  getAttendanceLeaveTypeRaw(emp),
                                )}`}
                              >
                                {formatAttendanceLeaveTypeColumnForEmployee(
                                  emp,
                                )}
                              </span>
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
            <button
              type="button"
              onClick={() =>
                startTransition(() => {
                  setComboDashboardGroup("production");
                  setShowComboChartModal(true);
                })
              }
              className="inline-flex h-8 w-full min-w-0 items-center justify-center gap-0.5 rounded-lg border border-emerald-300 bg-emerald-600 px-1 text-xs font-bold text-white shadow transition hover:bg-emerald-700 sm:w-auto sm:text-sm dark:border-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              📊 {tl("comboChart", "Thống kê")}
            </button>

            <div
              ref={filterMenuRef}
              className="attendance-filter-menu relative z-50 min-w-0"
            >
              <button
                ref={filterDropdownAnchorRef}
                type="button"
                onClick={() =>
                  setFilterMenuDropdownOpen(!filterMenuDropdownOpen)
                }
                className={`inline-flex h-8 w-full max-w-full items-center justify-center gap-0.5 whitespace-nowrap rounded-lg border border-slate-300 px-1 text-xs font-bold shadow transition sm:w-auto sm:text-sm ${
                  loaiPhepFilter.length > 0 ||
                  departmentListFilter.length > 0 ||
                  isQuickNoCheckInActive
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
              >
                🔽 {tl("filter", "Bộ lọc")}
                <span className="text-xs">
                  {loaiPhepFilter.length > 0 ||
                  departmentListFilter.length > 0 ||
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
                    className="fixed z-[100] flex flex-col overflow-hidden overscroll-contain rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
                    style={{
                      top: filterDropdownPlacement.top,
                      left: filterDropdownPlacement.left,
                      width: filterDropdownPlacement.width,
                      height: filterDropdownPlacement.height,
                    }}
                  >
                    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
                      {/* Bộ lọc nâng cao */}
                      <button
                        type="button"
                        onClick={() => {
                          setFilterOpen(true);
                          setFilterMenuDropdownOpen(false);
                        }}
                        className={`w-full shrink-0 text-left px-4 py-3 hover:bg-blue-50 border-b flex items-center gap-3 transition ${
                          loaiPhepFilter.length > 0 ||
                          departmentListFilter.length > 0
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
                            {tl("advancedFilterDesc", "Bộ phận, Loại phép")}
                          </div>
                        </div>
                      </button>

                      {/* Lọc nhanh */}
                      <button
                        type="button"
                        onClick={() => {
                          handleQuickNoCheckInFilter();
                          setFilterMenuDropdownOpen(false);
                        }}
                        className={`w-full shrink-0 text-left px-4 py-3 hover:bg-amber-50 border-b flex items-center gap-3 transition ${
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
                        type="button"
                        onClick={() => {
                          handleOvertimeButton();
                          setFilterMenuDropdownOpen(false);
                        }}
                        className="w-full shrink-0 text-left px-4 py-3 hover:bg-orange-50 border-t flex items-center gap-3 transition text-gray-700"
                      >
                        <span className="text-lg">⏰</span>
                        <div className="flex-1">
                          <div className="font-semibold">
                            {t("attendanceList.overtime")}
                          </div>
                          <div className="text-xs text-gray-500">
                            {tl(
                              "registerDailyOvertime",
                              "Đăng ký tăng ca ngày",
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Clear Filter — luôn hiển thị để chiều cao menu không nhảy */}
                      <button
                        type="button"
                        disabled={
                          loaiPhepFilter.length === 0 &&
                          departmentListFilter.length === 0 &&
                          !isQuickNoCheckInActive
                        }
                        onClick={() => {
                          if (
                            loaiPhepFilter.length === 0 &&
                            departmentListFilter.length === 0 &&
                            !isQuickNoCheckInActive
                          ) {
                            return;
                          }
                          setLoaiPhepFilter([]);
                          setDepartmentListFilter([]);
                          setShowOnlyUnattendedFilter(false);
                          setSearchTerm("");
                          setFilterMenuDropdownOpen(false);
                        }}
                        className="w-full shrink-0 border-t px-4 py-3 text-left flex items-center gap-3 transition disabled:cursor-not-allowed disabled:opacity-45 text-gray-700 hover:bg-red-50 enabled:hover:text-red-800"
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
                    </div>
                  </div>,
                  document.body,
                )}

              {/* Filter Modal — portal + z cao: tránh nằm trong .attendance-filter-menu nên bị cắt hoặc đè bởi sibling cùng stacking */}
              {filterOpen &&
                createPortal(
                  <div
                    className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm animate-fadeIn"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="attendance-advanced-filter-title"
                  >
                    <div className="flex h-[min(620px,85vh)] w-full max-w-md min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl animate-slideUp dark:border-slate-600 dark:bg-slate-900 dark:shadow-black/40">
                      {/* Header */}
                      <div className="shrink-0 border-b border-blue-100/80 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 px-4 py-2.5 relative overflow-hidden">
                        <div className="absolute inset-0 bg-white opacity-10"></div>
                        <div className="relative z-10">
                          <h3
                            id="attendance-advanced-filter-title"
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

                      {/* Content — chiều cao cố định theo khung modal; cuộn bên trong */}
                      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
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
                                placeholder={t(
                                  "attendanceList.searchDepartment",
                                )}
                                className="w-full border-b border-orange-200 h-8 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                              />
                              <div className="max-h-84 overflow-y-auto">
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

                        {/* Loại phép */}
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
                      </div>

                      {/* Footer - Buttons */}
                      <div className="shrink-0 p-3 sm:p-5 border-t-2 border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3 sm:justify-end">
                        <button
                          onClick={() => {
                            setLoaiPhepFilter([]);
                            setDepartmentListFilter([]);
                            setShowOnlyUnattendedFilter(false);
                            setExpandedSections({});
                            setFilterSearchTerm("");
                          }}
                          className="w-full px-2 py-2 sm:px-5 sm:py-2.5 rounded-lg text-xs sm:text-sm text-gray-700 border-2 border-gray-300 hover:border-red-400 hover:bg-red-50 hover:text-red-600 font-semibold transition-all duration-200 shadow-sm hover:shadow"
                        >
                          🗑️ {tl("clearAll", "Xóa tất cả")}
                        </button>
                        <button
                          onClick={() => {
                            setFilterOpen(false);
                            setFilterSearchTerm("");
                          }}
                          className="w-full px-2 py-2 sm:px-5 sm:py-2.5 rounded-lg text-xs sm:text-sm bg-gradient-to-r from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                          ✖️{" "}
                          {t("attendanceList.cancel", { defaultValue: "Hủy" })}
                        </button>
                        <button
                          onClick={() => {
                            setFilterOpen(false);
                            setFilterSearchTerm("");
                          }}
                          className="w-full px-2 py-2 sm:px-5 sm:py-2.5 rounded-lg text-xs sm:text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                          ✓ {tl("apply", "Áp dụng")}
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )}
            </div>

            {/* Action Dropdown (Upload/Export/Add) */}
            {user && (
              <div
                ref={actionDropdownRef}
                className="relative action-dropdown z-50 shrink-0 hidden sm:block"
              >
                <button
                  ref={actionDropdownAnchorRef}
                  type="button"
                  onClick={() => setActionDropdownOpen(!actionDropdownOpen)}
                  className="inline-flex h-8 w-auto max-w-full items-center justify-center gap-0.5 whitespace-nowrap rounded bg-emerald-600 px-1 text-xs font-bold text-white shadow transition hover:bg-emerald-700 sm:text-sm"
                >
                  ⚙️ {tl("actionsMenu", "Chức năng")}
                  <span className="text-xs">
                    {actionDropdownOpen ? "▲" : "▼"}
                  </span>
                </button>
                {actionDropdownOpen &&
                  actionDropdownPlacement &&
                  createPortal(
                    <div
                      ref={actionDropdownPanelRef}
                      className="fixed z-[120] max-w-[calc(100vw-2rem)] animate-fadeIn overflow-hidden rounded-lg border-2 border-emerald-200 bg-white shadow-2xl dark:border-emerald-800 dark:bg-slate-900 sm:w-64"
                      style={{
                        top: actionDropdownPlacement.top,
                        left: actionDropdownPlacement.left,
                        width: actionDropdownPlacement.width,
                        maxHeight: actionDropdownPlacement.maxHeight,
                      }}
                    >
                      <div className="min-h-0 max-h-full overflow-y-auto overflow-x-hidden overscroll-contain">
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
                    {isAdminAccess(user, userRole) && (
                      <button
                        type="button"
                        onClick={() => {
                          void handleDownloadAttendanceExcelTemplate();
                          setActionDropdownOpen(false);
                        }}
                        className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group"
                      >
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                          📄
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
                            {tl(
                              "downloadExcelTemplate",
                              "Tải mẫu Excel (đồng bộ xuất)",
                            )}
                          </span>
                        </div>
                      </button>
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
                          {t("attendanceList.export", {
                            defaultValue: "Xuất Excel",
                          })}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportRangeModal(true);
                        setActionDropdownOpen(false);
                      }}
                      className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group"
                    >
                      <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                        📅
                      </span>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
                          {tl("exportExcelDateRange")}
                        </span>
                      </div>
                    </button>
                    {showRowModalActions && (
                      <>
                        <button
                          onClick={() => {
                            setEmployeeModalRecord(null);
                            setShowEmployeeModal(true);
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
                      </>
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
                    </div>,
                    document.body,
                  )}
                {/* Hidden ExportExcelButton for functionality */}
                <div className="hidden">
                  <ExportExcelButton
                    data={filteredEmployees}
                    selectedDate={selectedDate}
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
            <div
              ref={printDropdownRef}
              className="print-dropdown-menu relative z-50 shrink-0 hidden sm:block"
            >
              <button
                ref={printDropdownAnchorRef}
                type="button"
                onClick={() => setPrintDropdownOpen(!printDropdownOpen)}
                className="inline-flex h-8 w-auto max-w-full items-center justify-center gap-0.5 whitespace-nowrap rounded bg-blue-600 px-1 text-xs font-bold text-white shadow transition hover:bg-blue-700 sm:text-sm"
              >
                🖨️ {tl("print", "In")}
                <span className="text-xs">{printDropdownOpen ? "▲" : "▼"}</span>
              </button>
              {printDropdownOpen &&
                printDropdownPlacement &&
                createPortal(
                  <div
                    ref={printDropdownPanelRef}
                    className="fixed z-[120] max-w-[calc(100vw-2rem)] animate-fadeIn overflow-hidden rounded-lg border-2 border-blue-200 bg-white shadow-2xl dark:border-blue-800 dark:bg-slate-900 sm:w-64"
                    style={{
                      top: printDropdownPlacement.top,
                      left: printDropdownPlacement.left,
                      width: printDropdownPlacement.width,
                      maxHeight: printDropdownPlacement.maxHeight,
                    }}
                  >
                    <div className="min-h-0 max-h-full overflow-y-auto overflow-x-hidden overscroll-contain">
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
                  </div>,
                  document.body,
                )}
            </div>
          </AttendanceSearchActionsBar>
        </div>

        <AttendanceEmployeeFormModal
          open={showEmployeeModal}
          onClose={() => {
            setShowEmployeeModal(false);
            setEmployeeModalRecord(null);
          }}
          initialRecord={employeeModalRecord}
          selectedDate={selectedDate}
          employees={employees}
          user={user}
          userRole={userRole}
          userDepartments={userDepartments}
          attendanceRootPath={attendanceRootPath}
          onAlert={setAlert}
        />

        <AttendanceOffDaysModal
          open={offDaysModalOpen}
          onClose={() => setOffDaysModalOpen(false)}
          selectedDate={selectedDate}
          user={user}
          tl={tl}
          onSaved={refreshMonthOffDays}
        />

        {/* Overtime Modal */}
        {showOvertimeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="relative mx-4 max-h-[90vh] w-full max-w-8xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
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
                  <div className="flex max-h-[85vh] w-full max-w-md flex-col animate-slideUp rounded-2xl border border-gray-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
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
                              <div className="px-3 py-2 text-sm text-gray-500 italic">
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
                              <div className="px-3 py-2 text-sm text-gray-500 italic">
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
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
              <div className="mt-6 flex max-h-[500px] flex-col overflow-x-auto rounded-lg bg-white shadow-lg dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
                <table className="w-full border-collapse min-w-[1400px]">
                  <thead>
                    <tr
                      className="sticky top-0 z-10"
                      style={{
                        background:
                          "linear-gradient(to right, #3b82f6, #8b5cf6)",
                      }}
                    >
                      <th className="px-3 py-2 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[40px]">
                        STT
                      </th>
                      <th className="px-3 py-2 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[70px]">
                        MNV
                      </th>
                      <th className="px-3 py-2 text-xs font-extrabold text-white uppercase tracking-wide text-left border-r border-blue-400 min-w-[150px]">
                        Họ và tên
                      </th>
                      <th className="px-3 py-2 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[100px]">
                        Ngày bắt đầu
                      </th>
                      <th className="px-3 py-2 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[60px]">
                        Mã BP
                      </th>
                      <th className="px-3 py-2 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[100px]">
                        {t("attendanceList.excelHeaderDept")}
                      </th>
                      <th className="px-3 py-2 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[110px]">
                        Tổng thời gian làm thêm giờ
                      </th>
                      <th className="px-3 py-2 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[130px]">
                        Thời gian dự kiến
                        <br />
                        Từ ...h đến ...h
                      </th>
                      <th className="px-3 py-2 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[110px]">
                        Thời gian làm thêm giờ
                      </th>
                      <th className="px-3 py-2 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[120px]">
                        Chữ ký người lao động
                      </th>
                      <th className="px-3 py-2 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[130px]">
                        Thời gian thực tế
                        <br />
                        Từ ...h đến ...h
                      </th>
                      <th className="px-3 py-2 text-xs font-extrabold text-white uppercase tracking-wide text-center border-r border-blue-400 min-w-[100px]">
                        Số giờ làm thêm
                      </th>
                      <th className="px-3 py-2 text-xs font-extrabold text-white uppercase tracking-wide text-center min-w-[100px]">
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
                          idx % 2 === 0
                            ? "bg-blue-50 dark:bg-slate-800/70"
                            : "bg-white dark:bg-slate-900"
                        }`}
                      >
                        <td className="px-3 py-2 text-xs text-gray-800 text-center font-bold border-r border-gray-300">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-800 text-center font-semibold border-r border-gray-300">
                          {emp.mnv || ""}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-900 font-medium text-left border-r border-gray-300">
                          {emp.hoVaTen || ""}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 text-center border-r border-gray-300">
                          {emp.ngayVaoLam || ""}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 text-center border-r border-gray-300">
                          {emp.maBoPhan || ""}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 text-center border-r border-gray-300">
                          {emp.boPhan || ""}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 text-center border-r border-gray-300">
                          {/* Để trống cho người dùng điền */}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 text-center border-r border-gray-300">
                          {/* Để trống cho người dùng điền */}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 text-center border-r border-gray-300">
                          {/* Để trống cho người dùng điền */}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 text-center border-r border-gray-300">
                          {/* Để trống cho người dùng điền */}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 text-center border-r border-gray-300">
                          {/* Để trống cho người dùng điền */}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 text-center border-r border-gray-300">
                          {/* Để trống cho người dùng điền */}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 text-center">
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

        {showComboChartModal ? (
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4">
                <p className="rounded-lg bg-slate-900/80 px-4 py-2 text-sm text-white">
                  {tl("comboChartLoading", "Đang tải biểu đồ theo bộ phận…")}
                </p>
              </div>
            }
          >
            <AttendanceComboChartModal
              open
              onClose={() => setShowComboChartModal(false)}
              comboDashboardGroup={comboDashboardGroup}
              setComboDashboardGroup={setComboDashboardGroup}
              comboProductionDeptCatalog={comboProductionDeptCatalog}
              comboProductionDeptOrder={comboProductionDeptOrder}
              onPersistComboProductionDeptOrder={
                persistComboProductionDeptOrder
              }
              getComboProductionDeptChartRank={getComboProductionDeptChartRank}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              tl={tl}
              t={t}
              comboDashboardStats={comboDashboardStats}
              comboChartData={comboChartData}
              comboChartBodyReady={comboChartBodyReady}
              comboChartRowsVisible={comboChartRowsVisible}
              comboChartCardsVisibleCount={comboChartCardsVisibleCount}
              comboChartDataOrdered={comboChartDataOrdered}
              comboStatDetailKey={comboStatDetailKey}
              setComboStatDetailKey={setComboStatDetailKey}
              comboStatLabelByKey={comboStatLabelByKey}
              comboStatEmployeesByKey={comboStatEmployeesByKey}
            />
          </Suspense>
        ) : null}

        {/* Table — virtual: CSS Grid (header + hàng) cùng grid-template-columns; <tr> absolute không bám colgroup */}
        <div
          className={`min-w-0 w-full max-w-full bg-white rounded-lg shadow-lg ${
            columnPlan === "minimal" ? "overflow-x-hidden" : "overflow-x-auto"
          }`}
        >
          {shouldVirtualizeTable ? (
            <div
              ref={tableScrollParentRef}
              className={`max-h-[min(82vh,900px)] w-full min-w-0 max-w-full overflow-y-auto ${
                columnPlan === "minimal"
                  ? "overflow-x-hidden"
                  : "overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]"
              }`}
            >
              <div
                className={`w-full max-w-none ${attendanceTableWrapperMinWidthClass(columnPlan)}`}
                role="table"
              >
                <AttendanceVirtualHeader
                  tl={tl}
                  showRowModalActions={showRowModalActions}
                  gridTemplateColumns={attendanceGridTemplateColumns}
                  canDeleteRow={canDeleteDayRecord}
                  columnPlan={columnPlan}
                />
                <div
                  role="rowgroup"
                  className="w-full"
                  style={{
                    position: "relative",
                    height: `${rowVirtualizer.getTotalSize()}px`,
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const emp = filteredEmployees[virtualRow.index];
                    const idx = virtualRow.index;
                    return (
                      <AttendanceTableRow
                        key={emp.id}
                        emp={emp}
                        idx={idx}
                        virtualRow={virtualRow}
                        showRowModalActions={showRowModalActions}
                        user={user}
                        canEdit={canEditEmployee(emp)}
                        tl={tl}
                        t={t}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        canDeleteRow={canDeleteDayRecord}
                        measureElementRef={rowVirtualizer.measureElement}
                        gridTemplateColumns={attendanceGridTemplateColumns}
                        columnPlan={columnPlan}
                        isOffDay={isOffDay}
                        isHolidayDay={isHolidayDay}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={tableScrollParentRef}
              className={`min-w-0 w-full max-w-full ${
                columnPlan === "minimal"
                  ? "overflow-x-hidden"
                  : "overflow-x-auto"
              }`}
            >
              <table
                className={`w-full table-fixed border-collapse max-w-none ${attendanceTableWrapperMinWidthClass(columnPlan)}`}
              >
                <AttendanceTableColgroup
                  showRowModalActions={showRowModalActions}
                  columnPlan={columnPlan}
                />
                <AttendanceTableThead
                  tl={tl}
                  showRowModalActions={showRowModalActions}
                  stickyHeader={true}
                  canDeleteRow={canDeleteDayRecord}
                  columnPlan={columnPlan}
                />
                <tbody>
                  {filteredEmployees.map((emp, idx) => {
                    return (
                      <AttendanceTableRow
                        key={emp.id}
                        emp={emp}
                        idx={idx}
                        virtualRow={undefined}
                        showRowModalActions={showRowModalActions}
                        user={user}
                        canEdit={canEditEmployee(emp)}
                        tl={tl}
                        t={t}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        canDeleteRow={canDeleteDayRecord}
                        columnPlan={columnPlan}
                        isOffDay={isOffDay}
                        isHolidayDay={isHolidayDay}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}

        <div className="mt-2 rounded-lg border-l-4 border-blue-600 bg-white p-4 shadow-md dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
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
