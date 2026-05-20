import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  readUnattendedSessionSuppressed,
  writeUnattendedSessionSuppressed,
} from "./attendanceUnattendedSession";
import { isEmployeeQuickUnattended } from "./attendanceListShared";

/**
 * State UI / toolbar / modal cho AttendanceList (không gồm dữ liệu Firebase ngày).
 */
export function useAttendanceListUiState(user) {
  const [filterDepartmentSearch, setFilterDepartmentSearch] = useState("");
  const [departmentListFilter, setDepartmentListFilter] = useState([]);
  const [loaiPhepFilter, setLoaiPhepFilter] = useState([]);
  const [showOnlyUnattendedFilter, setShowOnlyUnattendedFilter] =
    useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [showComboChartModal, setShowComboChartModal] = useState(false);
  const [comboDashboardGroup, setComboDashboardGroup] = useState("production");
  const [comboChartBodyReady, setComboChartBodyReady] = useState(false);
  const [comboChartCardsVisibleCount, setComboChartCardsVisibleCount] =
    useState(0);
  const [comboStatDetailKey, setComboStatDetailKey] = useState(null);
  const [comboChartDeptOrder, setComboChartDeptOrder] = useState([]);
  const [comboProductionDeptOrder, setComboProductionDeptOrder] = useState([]);
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
  const [unattendedSessionSuppressed, setUnattendedSessionSuppressed] =
    useState(false);
  const [
    unattendedSuppressSessionCheckbox,
    setUnattendedSuppressSessionCheckbox,
  ] = useState(false);
  const [filterMenuDropdownOpen, setFilterMenuDropdownOpen] = useState(false);
  const [offHolidayDropdownOpen, setOffHolidayDropdownOpen] = useState(false);
  const [navbarMobileMenuOpen, setNavbarMobileMenuOpen] = useState(false);

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
  const offHolidayDropdownAnchorRef = useRef(null);
  const offHolidayDropdownPanelRef = useRef(null);
  const exportRangeModalInitializedRef = useRef(false);
  const prevShowUnattendedPopupRef = useRef(false);

  const isQuickNoCheckInActive = showOnlyUnattendedFilter;

  const handleQuickNoCheckInFilter = useCallback(() => {
    setShowOnlyUnattendedFilter((v) => !v);
  }, []);

  const closeUnattendedPopup = useCallback(() => {
    setShowUnattendedPopup(false);
    setUnattendedPopupDismissed(true);
    if (unattendedSuppressSessionCheckbox) {
      setUnattendedSessionSuppressed(true);
      writeUnattendedSessionSuppressed(user?.uid, true);
    }
  }, [user?.uid, unattendedSuppressSessionCheckbox]);

  return {
    filterDepartmentSearch,
    setFilterDepartmentSearch,
    departmentListFilter,
    setDepartmentListFilter,
    loaiPhepFilter,
    setLoaiPhepFilter,
    showOnlyUnattendedFilter,
    setShowOnlyUnattendedFilter,
    expandedSections,
    setExpandedSections,
    showComboChartModal,
    setShowComboChartModal,
    comboDashboardGroup,
    setComboDashboardGroup,
    comboChartBodyReady,
    setComboChartBodyReady,
    comboChartCardsVisibleCount,
    setComboChartCardsVisibleCount,
    comboStatDetailKey,
    setComboStatDetailKey,
    comboChartDeptOrder,
    setComboChartDeptOrder,
    comboProductionDeptOrder,
    setComboProductionDeptOrder,
    printDropdownOpen,
    setPrintDropdownOpen,
    actionDropdownOpen,
    setActionDropdownOpen,
    isUploadingExcel,
    setIsUploadingExcel,
    showExportRangeModal,
    setShowExportRangeModal,
    exportRangeFrom,
    setExportRangeFrom,
    exportRangeTo,
    setExportRangeTo,
    exportRangeBusy,
    setExportRangeBusy,
    showUnattendedPopup,
    setShowUnattendedPopup,
    unattendedPopupDismissed,
    setUnattendedPopupDismissed,
    unattendedSessionSuppressed,
    setUnattendedSessionSuppressed,
    unattendedSuppressSessionCheckbox,
    setUnattendedSuppressSessionCheckbox,
    filterMenuDropdownOpen,
    setFilterMenuDropdownOpen,
    offHolidayDropdownOpen,
    setOffHolidayDropdownOpen,
    navbarMobileMenuOpen,
    setNavbarMobileMenuOpen,
    filterMenuRef,
    filterDropdownAnchorRef,
    filterMenuPanelRef,
    actionDropdownRef,
    printDropdownRef,
    actionDropdownAnchorRef,
    printDropdownAnchorRef,
    actionDropdownPanelRef,
    printDropdownPanelRef,
    offHolidayDropdownRef,
    offHolidayDropdownAnchorRef,
    offHolidayDropdownPanelRef,
    exportRangeModalInitializedRef,
    prevShowUnattendedPopupRef,
    isQuickNoCheckInActive,
    handleQuickNoCheckInFilter,
    closeUnattendedPopup,
  };
}

export function useAttendanceUnattendedPopupEffects({
  user,
  selectedDate,
  employees,
  showUnattendedPopup,
  setShowUnattendedPopup,
  unattendedPopupDismissed,
  unattendedSessionSuppressed,
  setUnattendedSessionSuppressed,
  setUnattendedPopupDismissed,
  setUnattendedSuppressSessionCheckbox,
  prevShowUnattendedPopupRef,
}) {
  const unattendedEmployees = useMemo(
    () => employees.filter((emp) => isEmployeeQuickUnattended(emp)),
    [employees],
  );

  useEffect(() => {
    setUnattendedSessionSuppressed(readUnattendedSessionSuppressed(user?.uid));
  }, [user?.uid, setUnattendedSessionSuppressed]);

  useEffect(() => {
    setShowUnattendedPopup(false);
    setUnattendedPopupDismissed(false);
  }, [selectedDate, setShowUnattendedPopup, setUnattendedPopupDismissed]);

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
    setShowUnattendedPopup,
  ]);

  useEffect(() => {
    if (showUnattendedPopup && !prevShowUnattendedPopupRef.current) {
      setUnattendedSuppressSessionCheckbox(false);
    }
    prevShowUnattendedPopupRef.current = showUnattendedPopup;
  }, [
    showUnattendedPopup,
    setUnattendedSuppressSessionCheckbox,
    prevShowUnattendedPopupRef,
  ]);

  return unattendedEmployees;
}
