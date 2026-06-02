import React, { memo, startTransition } from "react";
import { createPortal } from "react-dom";
import { ATTENDANCE_LOAI_PHEP_OPTIONS } from "./attendanceGioVaoTypeOptions";
import { ATTENDANCE_LEAVE_FILTER_NONE } from "./attendanceListShared";

function AttendanceListFilterMenus({
  tl,
  t,
  navbarMobileMenuOpen,
  filterMenuRef,
  filterDropdownAnchorRef,
  filterMenuPanelRef,
  filterMenuDropdownOpen,
  setFilterMenuDropdownOpen,
  filterDropdownPlacement,
  filterOpen,
  setFilterOpen,
  loaiPhepFilter,
  setLoaiPhepFilter,
  joinDateYearFilter,
  setJoinDateYearFilter,
  joinDateMonthFilter,
  setJoinDateMonthFilter,
  joinDateYearOptions,
  joinDateMonthOptions,
  departmentListFilter,
  setDepartmentListFilter,
  isQuickNoCheckInActive,
  handleQuickNoCheckInFilter,
  setShowOnlyUnattendedFilter,
  setSearchTerm,
  setComboDashboardGroup,
  setShowComboChartModal,
  expandedSections,
  setExpandedSections,
  filterDepartmentSearch,
  setFilterDepartmentSearch,
  departments,
  allLeaveTypesSelectAllChecked,
  allLeaveTypeFilterValues,
}) {
  const hasAdvancedFilters =
    loaiPhepFilter.length > 0 ||
    departmentListFilter.length > 0 ||
    Boolean(joinDateYearFilter) ||
    Boolean(joinDateMonthFilter);
  const hasAnyFilters = hasAdvancedFilters || isQuickNoCheckInActive;

  return (
    <>
      <div className="flex min-w-0 w-full flex-col gap-1 sm:w-auto sm:flex-row sm:gap-1">
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
      </div>

      <div
        ref={filterMenuRef}
        className="attendance-filter-menu relative min-w-0"
      >
        <button
          ref={filterDropdownAnchorRef}
          type="button"
          onClick={() => setFilterMenuDropdownOpen(!filterMenuDropdownOpen)}
          className={`inline-flex h-8 w-full max-w-full items-center justify-center gap-0.5 whitespace-nowrap rounded-lg border border-slate-300 px-1 text-xs font-bold shadow transition sm:w-auto sm:text-sm ${
            hasAnyFilters
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-600 text-white hover:bg-gray-700"
          }`}
        >
          🔽 {tl("filter", "Bộ lọc")}
          <span className="text-xs">{hasAnyFilters ? "✓" : ""}</span>
        </button>

        {/* Dropdown: portal + fixed để luôn nổi trên footer / vùng scroll */}
        {!navbarMobileMenuOpen &&
          filterMenuDropdownOpen &&
          filterDropdownPlacement &&
          createPortal(
            <div
              ref={filterMenuPanelRef}
              className="fixed flex flex-col overflow-hidden overscroll-contain rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
              style={{
                zIndex: "var(--z-modal-backdrop, 1200)",
                top: filterDropdownPlacement.top,
                left: filterDropdownPlacement.left,
                width: filterDropdownPlacement.width,
                maxHeight: filterDropdownPlacement.maxHeight,
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
                      hasAdvancedFilters
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
                        "Bộ phận, Loại phép, Ngày vào làm",
                      )}
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

                {/* Clear Filter — luôn hiển thị để chiều cao menu không nhảy */}
                <button
                  type="button"
                  disabled={
                      !hasAnyFilters
                  }
                  onClick={() => {
                      if (!hasAnyFilters) return;
                    setLoaiPhepFilter([]);
                    setDepartmentListFilter([]);
                    setJoinDateYearFilter("");
                    setJoinDateMonthFilter("");
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
              className="fixed inset-0 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm animate-fadeIn"
              style={{ zIndex: "var(--z-modal-content, 1210)" }}
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
                        <span className="text-orange-500 text-base">🏢</span>
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
                        <span className="text-green-500 text-base">📋</span>
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
                              checked={allLeaveTypesSelectAllChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  startTransition(() => {
                                    setLoaiPhepFilter([
                                      ...allLeaveTypeFilterValues,
                                    ]);
                                  });
                                } else {
                                  const remove = allLeaveTypeFilterValues;
                                  startTransition(() => {
                                    setLoaiPhepFilter((prev) => {
                                      if (remove.length === 0) return prev;
                                      const rm = new Set(remove);
                                      return prev.filter((x) => !rm.has(x));
                                    });
                                  });
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
                                      (x) => x !== ATTENDANCE_LEAVE_FILTER_NONE,
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
                                checked={loaiPhepFilter.includes(opt.value)}
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

                  {/* Ngày vào làm */}
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedSections((prev) => ({
                          ...prev,
                          joinDate: !prev.joinDate,
                        }));
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-indigo-200"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-indigo-500 text-base">📅</span>
                        <span>{tl("joinDate", "Ngày vào làm")}</span>
                      </span>
                      <span className="text-indigo-600 font-bold">
                        {expandedSections.joinDate ? "▼" : "▶"}
                      </span>
                    </button>

                    {expandedSections.joinDate && (
                      <div className="border-2 border-indigo-200 rounded-xl mt-2 bg-gradient-to-b from-indigo-50/70 via-white to-sky-50/60 shadow-inner ring-1 ring-indigo-100/80">
                        <div className="px-3 pt-2 pb-1">
                          <p className="text-[11px] font-medium text-indigo-700/90">
                            {tl(
                              "joinDateFilterHint",
                              "Chọn năm trước sau đó chọn tháng.",
                            )}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                          <div className="rounded-lg border border-indigo-200 bg-white/90 px-2 py-2 shadow-sm">
                            <div className="text-[11px] font-bold text-indigo-800 mb-1 tracking-wide uppercase">
                              {tl("joinDateYear", "Năm vào làm")}
                            </div>
                            <select
                              value={joinDateYearFilter}
                              onChange={(e) => {
                                const nextYear = e.target.value;
                                setJoinDateYearFilter(nextYear);
                                if (!nextYear) {
                                  setJoinDateMonthFilter("");
                                }
                              }}
                              className="w-full h-9 rounded-md border border-indigo-300 bg-white px-2 text-sm font-semibold text-indigo-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="">
                                {tl("joinDateAllYears", "Tất cả")}
                              </option>
                              {joinDateYearOptions.map((y) => (
                                <option key={y} value={y}>
                                  {y}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="rounded-lg border border-sky-200 bg-white/90 px-2 py-2 shadow-sm">
                            <div className="text-[11px] font-bold text-sky-800 mb-1 tracking-wide uppercase">
                              {tl("joinDateMonth", "Tháng vào làm")}
                            </div>
                            <select
                              value={joinDateMonthFilter}
                              onChange={(e) =>
                                setJoinDateMonthFilter(e.target.value)
                              }
                              disabled={!joinDateYearFilter}
                              className={`w-full h-9 rounded-md border border-sky-300 bg-white px-2 text-sm font-semibold text-sky-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${
                                !joinDateYearFilter
                                  ? "cursor-not-allowed opacity-55 bg-slate-100 text-slate-500 border-slate-300"
                                  : ""
                              }`}
                            >
                              <option value="">
                                {tl("joinDateAllMonths", "Tất cả")}
                              </option>
                              {joinDateMonthOptions.map((m) => (
                                <option key={m} value={m}>
                                  Tháng {Number(m)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer — luôn một hàng (tránh sm:flex + w-full làm nút chồng dọc) */}
                <div className="shrink-0 flex flex-row flex-nowrap items-stretch gap-2 border-t-2 border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50 p-3 sm:gap-3 sm:p-5">
                  <button
                    onClick={() => {
                      setLoaiPhepFilter([]);
                      setDepartmentListFilter([]);
                      setJoinDateYearFilter("");
                      setJoinDateMonthFilter("");
                      setShowOnlyUnattendedFilter(false);
                      setExpandedSections({});
                    }}
                    className="min-w-0 flex-1 px-1.5 py-2 text-center text-[11px] font-semibold leading-tight text-gray-700 shadow-sm transition-all duration-200 hover:shadow sm:px-3 sm:py-2.5 sm:text-sm rounded-lg border-2 border-gray-300 hover:border-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    🗑️ {tl("clearAll", "Xóa tất cả")}
                  </button>
                  <button
                    onClick={() => {
                      setFilterOpen(false);
                    }}
                    className="min-w-0 flex-1 px-1.5 py-2 text-center text-[11px] font-semibold leading-tight text-white shadow-md transition-all duration-200 hover:shadow-lg sm:px-3 sm:py-2.5 sm:text-sm rounded-lg bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700"
                  >
                    ✖️ {t("attendanceList.cancel", { defaultValue: "Hủy" })}
                  </button>
                  <button
                    onClick={() => {
                      setFilterOpen(false);
                    }}
                    className="min-w-0 flex-1 px-1.5 py-2 text-center text-[11px] font-semibold leading-tight text-white shadow-md transition-all duration-200 hover:shadow-lg sm:px-3 sm:py-2.5 sm:text-sm rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    ✓ {tl("apply", "Áp dụng")}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </>
  );
}

export default memo(AttendanceListFilterMenus);
