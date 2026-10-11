import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  COMBO_DASHBOARD_TILES,
  COMBO_DASHBOARD_TILE_KEYS_PRODUCTION,
  COMBO_DASHBOARD_TILE_KEYS_PRODUCTION_DETAIL,
  COMBO_STATS_PRODUCTION_DEPT_PICKER_LABELS,
  mergeComboProductionDeptPickerKeys,
  filterEmployeesByComboDepartment,
} from "./attendanceComboChartConfig";
import { sortEmployeesStableAsc } from "./attendanceListSort";
import { getAttendanceLeaveTypeColorClassNameForComboStatKey } from "./attendanceGioVaoTypeOptions";
import { isSeasonalAttendanceRoot } from "./attendanceSeasonalStt";
import AttendanceComboDeptChartCard from "./AttendanceComboDeptChartCard";
import AttendanceComboStatDetailPanel from "./AttendanceComboStatDetailPanel";
import AttendanceComboProductionDeptPicker from "./AttendanceComboProductionDeptPicker";
import "../dashboard/dashboard.css";

function AttendanceComboChartModal({
  open,
  onClose,
  comboDashboardGroup,
  setComboDashboardGroup,
  comboProductionDeptCatalog = [],
  comboProductionDeptOrder = [],
  onPersistComboProductionDeptOrder,
  getComboProductionDeptChartRank,
  selectedDate,
  setSelectedDate,
  tl,
  t,
  comboDashboardStats,
  comboChartData,
  comboChartBodyReady,
  comboChartRowsVisible,
  comboChartCardsVisibleCount,
  comboChartDataOrdered,
  comboStatDetailKey,
  setComboStatDetailKey,
  comboStatLabelByKey,
  comboStatDetailEmployees = [],
  attendanceRootPath = "attendance",
  compareEmployeesBusy = false,
  onCompareEmployees,
  normalizeDepartment,
  onEditEmployee,
  canEditEmployee,
}) {
  const isSeasonalAttendance = isSeasonalAttendanceRoot(attendanceRootPath);
  const comboGroupMetricKeys = useMemo(
    () =>
      comboDashboardGroup === "production"
        ? COMBO_DASHBOARD_TILE_KEYS_PRODUCTION_DETAIL
        : COMBO_DASHBOARD_TILE_KEYS_PRODUCTION,
    [comboDashboardGroup],
  );
  const comboDashboardTileKeySet = useMemo(
    () => new Set(comboGroupMetricKeys),
    [comboGroupMetricKeys],
  );

  const [productionDeptPickerOpen, setProductionDeptPickerOpen] =
    useState(false);
  const [productionDeptPickerDraft, setProductionDeptPickerDraft] = useState(
    [],
  );
  const [showDetailTiles, setShowDetailTiles] = useState(false);
  const [comboStatDetailDepartment, setComboStatDetailDepartment] =
    useState(null);

  const handleCompareEmployeesClick = useCallback(() => {
    void onCompareEmployees?.();
  }, [onCompareEmployees]);

  const unknownDepartmentLabel = tl(
    "unknownDepartment",
    "Chưa phân bộ phận",
  );

  const openMetricDetail = useCallback(
    (key) => {
      setComboStatDetailDepartment(null);
      setComboStatDetailKey(key);
    },
    [setComboStatDetailKey],
  );

  const openDeptAttendance = useCallback(
    (department) => {
      setComboStatDetailDepartment(department || null);
      setComboStatDetailKey("total");
    },
    [setComboStatDetailKey],
  );

  const closeStatDetail = useCallback(() => {
    setComboStatDetailDepartment(null);
    setComboStatDetailKey(null);
  }, [setComboStatDetailKey]);

  useEffect(() => {
    if (!comboStatDetailKey) setComboStatDetailDepartment(null);
  }, [comboStatDetailKey]);

  const detailEmployees = useMemo(() => {
    const filtered = filterEmployeesByComboDepartment(
      comboStatDetailEmployees,
      comboStatDetailDepartment,
      normalizeDepartment,
      unknownDepartmentLabel,
    );
    return sortEmployeesStableAsc(filtered, {
      seasonal: isSeasonalAttendance,
    });
  }, [
    comboStatDetailEmployees,
    comboStatDetailDepartment,
    normalizeDepartment,
    unknownDepartmentLabel,
    isSeasonalAttendance,
  ]);

  const productionDeptLabelForPicker = useCallback(
    (mk) =>
      comboProductionDeptCatalog.find((c) => c.matchKey === mk)?.label ??
      COMBO_STATS_PRODUCTION_DEPT_PICKER_LABELS[mk] ??
      mk,
    [comboProductionDeptCatalog],
  );

  const openProductionDeptPicker = useCallback(() => {
    const base =
      comboProductionDeptOrder.length > 0
        ? [...comboProductionDeptOrder]
        : mergeComboProductionDeptPickerKeys(comboProductionDeptCatalog);
    setProductionDeptPickerDraft(base);
    setProductionDeptPickerOpen(true);
  }, [comboProductionDeptOrder, comboProductionDeptCatalog]);

  const toggleProductionDeptDraftKey = useCallback((mk) => {
    setProductionDeptPickerDraft((prev) => {
      const i = prev.indexOf(mk);
      if (i >= 0) return prev.filter((_, j) => j !== i);
      return [...prev, mk];
    });
  }, []);

  const moveProductionDeptDraftKey = useCallback((index, dir) => {
    setProductionDeptPickerDraft((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }, []);

  const saveProductionDeptPicker = useCallback(() => {
    const list =
      productionDeptPickerDraft.length > 0
        ? [...productionDeptPickerDraft]
        : mergeComboProductionDeptPickerKeys(comboProductionDeptCatalog);
    onPersistComboProductionDeptOrder?.(list);
    setProductionDeptPickerOpen(false);
  }, [
    productionDeptPickerDraft,
    comboProductionDeptCatalog,
    onPersistComboProductionDeptOrder,
  ]);

  if (!open) return null;

  const detailMetricLabel = comboStatDetailDepartment
    ? `${comboStatDetailDepartment}${selectedDate ? ` · ${selectedDate}` : ""}`
    : comboStatDetailKey != null
      ? (comboStatLabelByKey[comboStatDetailKey] ?? "")
      : "";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4"
      style={{ zIndex: "var(--z-modal-backdrop, 1200)" }}
    >
      <div className="dashboard-chart-panel relative flex h-[94vh] w-[min(100vw,1700px)] max-w-none flex-col overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-300/80 bg-gradient-to-b from-slate-200/95 to-slate-100 px-4 pb-3 pt-5 sm:pt-4 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-400">
                {tl("comboChartBadge", "Dashboard điểm danh nhân viên")}
              </p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 sm:text-xl">
                {tl(
                  "comboChartTitle",
                  "Thống kê toàn bộ nhân viên theo bộ phận",
                )}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-300/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label={t("attendanceList.close")}
            >
              ✕
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 items-stretch gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            <button
              type="button"
              onClick={() => setComboDashboardGroup("production")}
              className={`flex h-8 min-w-0 w-full items-center justify-center overflow-hidden whitespace-nowrap rounded-lg border px-0.5 py-1 text-[7px] font-bold uppercase tracking-tight transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:w-auto sm:px-3 sm:text-xs sm:tracking-wide ${
                comboDashboardGroup === "production"
                  ? "border-amber-500 bg-amber-500/15 text-amber-950 shadow-sm dark:border-amber-400 dark:bg-amber-500/15 dark:text-amber-100"
                  : "border-slate-300/90 bg-white/70 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {tl("comboDashboardGroupProduction", "Sản xuất")}
            </button>
            <button
              type="button"
              onClick={() => setComboDashboardGroup("hr")}
              className={`flex h-8 min-w-0 w-full items-center justify-center overflow-hidden whitespace-nowrap rounded-lg border px-0.5 py-1 text-[7px] font-bold uppercase tracking-tight transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:w-auto sm:px-3 sm:text-xs sm:tracking-wide ${
                comboDashboardGroup === "hr"
                  ? "border-sky-500 bg-sky-500/15 text-sky-900 shadow-sm dark:border-sky-400 dark:bg-sky-500/20 dark:text-sky-100"
                  : "border-slate-300/90 bg-white/70 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {tl("comboDashboardGroupHr", "Nhân sự")}
            </button>
            <div
              className={`${
                comboDashboardGroup === "production"
                  ? "col-span-1"
                  : "col-span-2"
              } sm:col-span-1`}
            >
              <label className="flex h-8 w-full min-w-0 items-center gap-1 rounded-lg border border-slate-300/90 bg-white/70 px-1 text-[7px] font-bold uppercase tracking-tight text-slate-700 shadow-sm transition focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/35 sm:rounded-md sm:border-slate-300 sm:bg-white sm:px-2 sm:text-xs sm:font-semibold sm:normal-case sm:tracking-normal dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 sm:dark:bg-slate-900">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[7px] font-bold uppercase tracking-tight text-slate-700 outline-none [appearance:textfield] sm:text-xs sm:font-semibold sm:normal-case sm:tracking-normal dark:text-slate-100"
                />
              </label>
            </div>
            {comboDashboardGroup === "production" ? (
              <button
                type="button"
                onClick={openProductionDeptPicker}
                className="col-span-1 flex h-8 min-w-0 w-full items-center justify-center overflow-hidden whitespace-nowrap rounded-lg border border-emerald-600/85 px-1 py-1 text-[8px] font-bold uppercase tracking-tight text-emerald-950 shadow-sm transition hover:bg-emerald-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 sm:col-span-1 sm:w-auto sm:px-3 sm:text-xs sm:tracking-wide dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-100 dark:hover:bg-emerald-500/20"
              >
                {tl("comboProductionDeptPickerButton", "STT")}
              </button>
            ) : null}
            {comboDashboardGroup === "production" ? (
              <button
                type="button"
                onClick={handleCompareEmployeesClick}
                disabled={compareEmployeesBusy}
                className="col-span-2 flex h-8 min-w-0 w-full items-center justify-center overflow-hidden whitespace-nowrap rounded-lg border border-indigo-300 bg-indigo-600 px-1 py-1 text-[8px] font-bold uppercase tracking-tight text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1 sm:w-auto sm:px-3 sm:text-xs sm:tracking-wide dark:border-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600"
              >
                {tl("compareEmployeesButton", "So sánh")}
              </button>
            ) : null}
          </div>

          <div className="mt-2 flex w-full items-center justify-end">
            <button
              type="button"
              onClick={() => setShowDetailTiles((v) => !v)}
              className="rounded-lg border border-slate-300/90 bg-white/75 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100 sm:text-[10px] dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {showDetailTiles
                ? tl("collapseDetailTiles", "Thu gọn")
                : tl("expandDetailTiles", "Xem chi tiết")}
            </button>
          </div>

          {showDetailTiles ? (
            <div className="mt-2 flex gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {comboDashboardGroup === "production" &&
              comboDashboardStats.total > 0 ? (
                <button
                  type="button"
                  onClick={() => openMetricDetail("total")}
                  className="min-w-[118px] shrink-0 rounded-lg border border-slate-300/80 bg-slate-50/90 px-1.5 py-1.5 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[100px] sm:max-w-[156px] sm:flex-1 sm:basis-[108px] dark:border-slate-700/90 dark:bg-slate-900/95"
                >
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600 sm:text-[10px] dark:text-slate-400">
                    {tl("totalEmployees", "Tổng số nhân viên")}
                  </p>
                  <p className="text-sm font-bold text-slate-900 sm:text-base dark:text-slate-50">
                    {comboDashboardStats.total}
                  </p>
                </button>
              ) : null}
              {COMBO_DASHBOARD_TILES.filter((tile) =>
                comboDashboardTileKeySet.has(tile.key),
              ).map((tile) => {
                const v = comboDashboardStats[tile.key];
                if (!v || v <= 0) return null;
                const label = comboStatLabelByKey[tile.key] ?? tile.key;
                return (
                  <button
                    key={tile.key}
                    type="button"
                    onClick={() => openMetricDetail(tile.key)}
                    className="min-w-[118px] shrink-0 rounded-lg border border-slate-300/80 bg-slate-50/90 px-1.5 py-1.5 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[100px] sm:max-w-[156px] sm:flex-1 sm:basis-[108px] dark:border-slate-700/90 dark:bg-slate-900/95"
                  >
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600 sm:text-[10px] dark:text-slate-400">
                      {label}
                    </p>
                    <p
                      className={`text-sm font-bold sm:text-base ${getAttendanceLeaveTypeColorClassNameForComboStatKey(tile.key)}`}
                    >
                      {v}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-200/35 p-3 dark:bg-black/35 sm:p-5">
          {comboChartData.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-600 dark:text-slate-400">
              {tl("noData", "Không có dữ liệu")}
            </div>
          ) : !comboChartBodyReady ||
            (comboChartRowsVisible.length === 0 &&
              comboChartData.length > 0) ? (
            <div
              className="flex min-h-0 flex-1 flex-col"
              aria-busy="true"
              aria-live="polite"
            >
              <p className="mb-3 text-center text-xs text-slate-500 dark:text-slate-400">
                {tl("comboChartLoading", "Đang tải biểu đồ theo bộ phận…")}
              </p>
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={`combo-skel-${i}`}
                    className="animate-pulse rounded-xl border border-slate-300/60 bg-slate-100/90 p-2 dark:border-slate-700/80 dark:bg-slate-900/80"
                  >
                    <div className="mb-2 h-3 w-2/3 rounded bg-slate-300 dark:bg-slate-600" />
                    <div className="h-[180px] rounded-lg bg-slate-200/80 dark:bg-slate-800/80 sm:h-[190px]" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1 transition-opacity duration-200">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {comboChartRowsVisible.map((row) => (
                  <AttendanceComboDeptChartCard
                    key={row.department}
                    row={row}
                    comboDashboardGroup={comboDashboardGroup}
                    getComboProductionDeptChartRank={
                      getComboProductionDeptChartRank
                    }
                    activeComboMetricKeys={comboGroupMetricKeys}
                    comboStatLabelByKey={comboStatLabelByKey}
                    tl={tl}
                    onOpenDeptAttendance={openDeptAttendance}
                  />
                ))}
              </div>
              {comboChartCardsVisibleCount < comboChartDataOrdered.length ? (
                <div className="flex justify-center py-3 text-xs text-slate-500 dark:text-slate-400">
                  {tl("comboChartLoadingMore", "Đang tải thêm biểu đồ…")}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <AttendanceComboStatDetailPanel
          comboStatDetailKey={comboStatDetailKey}
          detailMetricLabel={detailMetricLabel}
          detailEmployees={detailEmployees}
          isSeasonalAttendance={isSeasonalAttendance}
          setComboStatDetailKey={closeStatDetail}
          tl={tl}
          t={t}
          onEditEmployee={onEditEmployee}
          canEditEmployee={canEditEmployee}
        />
        <AttendanceComboProductionDeptPicker
          open={productionDeptPickerOpen}
          onClose={() => setProductionDeptPickerOpen(false)}
          tl={tl}
          comboProductionDeptCatalog={comboProductionDeptCatalog}
          productionDeptPickerDraft={productionDeptPickerDraft}
          setProductionDeptPickerDraft={setProductionDeptPickerDraft}
          productionDeptLabelForPicker={productionDeptLabelForPicker}
          toggleProductionDeptDraftKey={toggleProductionDeptDraftKey}
          moveProductionDeptDraftKey={moveProductionDeptDraftKey}
          onPersistComboProductionDeptOrder={onPersistComboProductionDeptOrder}
          onSave={saveProductionDeptPicker}
        />
      </div>
    </div>
  );
}

export default memo(AttendanceComboChartModal);
