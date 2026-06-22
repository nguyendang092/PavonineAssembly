import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { canManageAnnualLeave } from "@/config/authRoles";
import { db, ref, set } from "@/services/firebase";
import AlertMessage from "@/components/ui/AlertMessage";
import LoadingBlock from "@/components/ui/LoadingBlock";
import {
  ANNUAL_LEAVE_EMP,
  ANNUAL_LEAVE_META_KEY,
  ANNUAL_LEAVE_RTDB_ROOT,
  ANNUAL_LEAVE_MANAGER_MIN_YEAR,
} from "./annualLeaveFields";
import { normalizeAnnualLeaveRowLive } from "./annualLeaveDerived";
import { parseAnnualLeaveExcelFile } from "./annualLeaveExcelImport";
import { exportAnnualLeaveExcel } from "./annualLeaveExcelExport";
import { useAnnualLeaveLiveData } from "./useAnnualLeaveLiveData";
import { useAnnualLeaveYearReconcile } from "./useAnnualLeaveYearReconcile";
import { persistAnnualLeaveYearFromAttendance } from "./annualLeaveAttendanceSync";
import { indexAnnualLeaveYearByEmpKey } from "./annualLeaveEmpKey";
import AnnualLeaveManagerTableRow from "./AnnualLeaveManagerTableRow";
import {
  attendanceListDateForAnnualLeaveYear,
  attendanceListPathForAnnualLeaveYear,
  payrollPathForDateKey,
} from "./annualLeaveCrossLinks";
import "./annualLeaveManager.css";

function currentYear() {
  return new Date().getFullYear();
}

function clampAnnualLeaveManagerYear(value) {
  const y = Number(value);
  const max = Math.max(currentYear(), ANNUAL_LEAVE_MANAGER_MIN_YEAR) + 2;
  if (!Number.isFinite(y)) return Math.max(currentYear(), ANNUAL_LEAVE_MANAGER_MIN_YEAR);
  return Math.min(Math.max(y, ANNUAL_LEAVE_MANAGER_MIN_YEAR), max);
}

function listAnnualLeaveManagerYearOptions() {
  const max = Math.max(currentYear(), ANNUAL_LEAVE_MANAGER_MIN_YEAR) + 2;
  return Array.from(
    { length: max - ANNUAL_LEAVE_MANAGER_MIN_YEAR + 1 },
    (_, i) => ANNUAL_LEAVE_MANAGER_MIN_YEAR + i,
  );
}

function normalizeAnnualLeaveRow(id, raw, deductionsByMnv) {
  return normalizeAnnualLeaveRowLive(id, raw, deductionsByMnv);
}

export default function AnnualLeaveManager() {
  const { t } = useTranslation();
  const { user, userRole } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const yearFromUrl = Number(searchParams.get("year"));
  const [year, setYear] = useState(() =>
    clampAnnualLeaveManagerYear(yearFromUrl),
  );
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [actionsOpen, setActionsOpen] = useState(false);
  const fileInputRef = useRef(null);
  const actionsMenuRef = useRef(null);

  const canManage = canManageAnnualLeave(user, userRole);

  const { yearData, deductionsByEmpKey, loading } =
    useAnnualLeaveLiveData(year, {
      includeUsageDetail: false,
      includeBalanceMap: false,
    });

  useAnnualLeaveYearReconcile({
    attendanceRootPath: "attendance",
    year,
    userEmail: user?.email ?? "",
    enabled: canManage,
  });

  useEffect(() => {
    const raw = searchParams.get("year");
    if (!raw) return;
    const y = clampAnnualLeaveManagerYear(Number(raw));
    setYear(y);
    if (String(y) !== raw) {
      setSearchParams({ year: String(y) }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const attendanceListPath = useMemo(
    () => attendanceListPathForAnnualLeaveYear(year),
    [year],
  );
  const payrollPath = useMemo(
    () => payrollPathForDateKey(attendanceListDateForAnnualLeaveYear(year)),
    [year],
  );

  const { rows, meta } = useMemo(() => {
    const list = [];
    let nextMeta = null;
    if (yearData && typeof yearData === "object") {
      if (yearData[ANNUAL_LEAVE_META_KEY]) {
        nextMeta = yearData[ANNUAL_LEAVE_META_KEY];
      }
      const indexed = indexAnnualLeaveYearByEmpKey(yearData);
      for (const [empKey, { raw }] of Object.entries(indexed)) {
        const row = normalizeAnnualLeaveRow(empKey, raw, deductionsByEmpKey);
        if (row) list.push(row);
      }
    }
    list.sort((a, b) => {
      const na = Number(a.rowNo);
      const nb = Number(b.rowNo);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return String(a.rowNo ?? "").localeCompare(
        String(b.rowNo ?? ""),
        undefined,
        { numeric: true },
      );
    });
    return { rows: list, meta: nextMeta };
  }, [yearData, deductionsByEmpKey]);

  const deferredSearch = useDeferredValue(search);

  const detailThroughDateKey = useMemo(
    () => attendanceListDateForAnnualLeaveYear(year),
    [year],
  );

  useEffect(() => {
    if (!alert.show) return;
    const timer = setTimeout(
      () => setAlert((a) => ({ ...a, show: false })),
      4000,
    );
    return () => clearTimeout(timer);
  }, [alert.show]);

  useEffect(() => {
    if (!actionsOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setActionsOpen(false);
    };
    const onPointerDown = (e) => {
      if (actionsMenuRef.current?.contains(e.target)) return;
      setActionsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [actionsOpen]);

  const departments = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const d = r[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT];
      if (d) set.add(String(d));
    });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (deptFilter && r[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] !== deptFilter) {
        return false;
      }
      if (!q) return true;
      const name = String(r[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "").toLowerCase();
      const mnv = String(r[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? "").trim();
      return name.includes(q) || mnv.includes(q);
    });
  }, [rows, deferredSearch, deptFilter]);

  const handleRecalculate = useCallback(async () => {
    if (!canManage || syncing) return;
    setSyncing(true);
    try {
      const { appliedCount } = await persistAnnualLeaveYearFromAttendance(db, {
        year,
        attendanceRootPath: "attendance",
        updatedBy: user?.email ?? "",
      });
      setAlert({
        show: true,
        type: "success",
        message: t("annualLeave.recalculateSuccess", {
          defaultValue: "Đã cập nhật {{count}} bản ghi phép năm từ điểm danh.",
          count: appliedCount,
        }),
      });
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message: err?.message || t("annualLeave.recalculateError", {
          defaultValue: "Không thể tính lại phép năm.",
        }),
      });
    } finally {
      setSyncing(false);
    }
  }, [canManage, syncing, year, user?.email, t]);

  const handleUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (e.target) e.target.value = "";
      if (!file || !canManage) return;

      setUploading(true);
      try {
        const { records, errors } = await parseAnnualLeaveExcelFile(file);
        if (errors.length > 0 && records.length === 0) {
          setAlert({ show: true, type: "error", message: errors.join(" ") });
          return;
        }

        const payload = {
          [ANNUAL_LEAVE_META_KEY]: {
            updatedAt: new Date().toISOString(),
            updatedBy: user?.email ?? "",
            rowCount: records.length,
          },
        };
        for (const rec of records) {
          const { id, rowNo, ...rest } = rec;
          payload[id] = { ...rest, rowNo };
        }

        await set(ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`), payload);
        await persistAnnualLeaveYearFromAttendance(db, {
          year,
          attendanceRootPath: "attendance",
          updatedBy: user?.email ?? "",
        });
        setAlert({
          show: true,
          type: "success",
          message: t("annualLeave.uploadSuccess", {
            count: records.length,
            year,
          }),
        });
        if (errors.length > 0) {
          setAlert({
            show: true,
            type: "warning",
            message: errors.join(" "),
          });
        }
      } catch (err) {
        setAlert({
          show: true,
          type: "error",
          message: err?.message || t("annualLeave.uploadError"),
        });
      } finally {
        setUploading(false);
      }
    },
    [canManage, year, user?.email, t],
  );

  const handleExport = useCallback(async () => {
    try {
      const buffer = await exportAnnualLeaveExcel(filteredRows, year);
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PAVONINE_annual_leave_${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message: err?.message || t("annualLeave.exportError"),
      });
    }
  }, [filteredRows, year, t]);

  const yearOptions = useMemo(() => listAnnualLeaveManagerYearOptions(), []);

  if (!user) {
    return (
      <div className="annual-leave-page p-4">
        <p>{t("annualLeave.pleaseLogin")}</p>
      </div>
    );
  }

  return (
    <div className="annual-leave-page annual-leave-page--main w-full bg-slate-100 dark:bg-slate-950">
      <div className="annual-leave-shell">
        <div className="annual-leave-top">
          <div className="annual-leave-top-head">
            <div className="annual-leave-top-head-main">
              <h1 className="annual-leave-hero-title">
                {t("annualLeave.title")}
              </h1>
              {meta?.updatedAt && (
                <span className="annual-leave-meta">
                  {t("annualLeave.lastUpdated")}:{" "}
                  {new Date(meta.updatedAt).toLocaleString()}
                  {meta.updatedBy ? ` · ${meta.updatedBy}` : ""}
                </span>
              )}
            </div>
            <nav
              className="annual-leave-quick-links"
              aria-label={t("attendanceList.headerQuickLinks")}
            >
              <Link to={attendanceListPath} className="annual-leave-quick-link">
                <span aria-hidden>←</span>
                {t("annualLeave.linkToAttendanceListShort")}
              </Link>
              <Link to={payrollPath} className="annual-leave-quick-link">
                <span aria-hidden>→</span>
                {t("attendanceList.linkToAttendanceSalaryShort")}
              </Link>
            </nav>
          </div>

          <div className="annual-leave-toolbar-row">
            <div className="annual-leave-toolbar-filters">
              <label className="annual-leave-field">
                <span className="annual-leave-field-label">
                  {t("annualLeave.year")}
                </span>
                <select
                  className="annual-leave-control"
                  value={year}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setYear(y);
                    setSearchParams({ year: String(y) }, { replace: true });
                  }}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>

              <input
                type="search"
                placeholder={t("annualLeave.searchPlaceholder")}
                className="annual-leave-control annual-leave-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="annual-leave-control annual-leave-dept-select"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="">{t("annualLeave.allDepartments")}</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="annual-leave-toolbar-actions">
              <span className="annual-leave-count">
                {t("annualLeave.rowCount", { count: filteredRows.length })}
              </span>

              <div
                ref={actionsMenuRef}
                className="annual-leave-actions-dropdown"
              >
                <button
                  type="button"
                  className="annual-leave-btn annual-leave-actions-trigger"
                  onClick={() => setActionsOpen((open) => !open)}
                  aria-expanded={actionsOpen}
                  aria-haspopup="menu"
                >
                  <span className="annual-leave-actions-trigger-icon" aria-hidden>
                    ⚙️
                  </span>
                  {t("annualLeave.actionsMenu", { defaultValue: "Chức năng" })}
                  <span className="annual-leave-actions-caret" aria-hidden>
                    {actionsOpen ? "▲" : "▼"}
                  </span>
                </button>

                {actionsOpen ? (
                  <div className="annual-leave-actions-menu" role="menu">
                    {canManage ? (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={syncing}
                        className="annual-leave-actions-menu-item annual-leave-actions-menu-item-sync"
                        onClick={() => {
                          setActionsOpen(false);
                          handleRecalculate();
                        }}
                      >
                        <span
                          className="annual-leave-actions-menu-icon"
                          aria-hidden
                        >
                          🔄
                        </span>
                        <span className="annual-leave-actions-menu-text">
                          {syncing
                            ? t("annualLeave.recalculating", {
                                defaultValue: "Đang tính lại…",
                              })
                            : t("annualLeave.recalculate", {
                                defaultValue: "Tính lại từ điểm danh",
                              })}
                        </span>
                      </button>
                    ) : null}

                    {canManage ? (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={(e) => {
                            setActionsOpen(false);
                            handleUpload(e);
                          }}
                        />
                        <button
                          type="button"
                          role="menuitem"
                          disabled={uploading}
                          className="annual-leave-actions-menu-item annual-leave-actions-menu-item-upload"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <span
                            className="annual-leave-actions-menu-icon"
                            aria-hidden
                          >
                            📤
                          </span>
                          <span className="annual-leave-actions-menu-text">
                            {uploading
                              ? t("annualLeave.uploading")
                              : t("annualLeave.uploadExcel")}
                          </span>
                        </button>
                      </>
                    ) : null}

                    <button
                      type="button"
                      role="menuitem"
                      className="annual-leave-actions-menu-item annual-leave-actions-menu-item-export"
                      onClick={() => {
                        setActionsOpen(false);
                        handleExport();
                      }}
                      disabled={filteredRows.length === 0}
                    >
                      <span
                        className="annual-leave-actions-menu-icon"
                        aria-hidden
                      >
                        📥
                      </span>
                      <span className="annual-leave-actions-menu-text">
                        {t("annualLeave.exportExcel")}
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <AlertMessage alert={alert} />

        {loading ? (
          <LoadingBlock />
        ) : (
          <div className="annual-leave-table-card">
            <table className="annual-leave-table">
              <colgroup>
                <col className="annual-leave-col-no" />
                <col className="annual-leave-col-code" />
                <col className="annual-leave-col-code" />
                <col className="annual-leave-name" />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col className="annual-leave-col-detail" />
              </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2} className="annual-leave-col-no">
                      No
                    </th>
                    <th colSpan={2} className="annual-leave-th-empl">
                      EMPL. CODE
                    </th>
                    <th rowSpan={2} className="annual-leave-name annual-leave-th-name">
                      Full Name
                    </th>
                    <th rowSpan={2}>Date of Birth</th>
                    <th rowSpan={2} className="annual-leave-dept">
                      SUB-DEPARTMENT
                    </th>
                    <th rowSpan={2}>START WORKING DATE</th>
                    <th rowSpan={2}>ANNUAL LEAVE IN CURRENT YEAR</th>
                    <th rowSpan={2} className="annual-leave-th-bonus">
                      BONUS ANNUAL LEAVE (Environment)
                    </th>
                    <th rowSpan={2}>Compensatory day off NGHỈ BÙ</th>
                    <th rowSpan={2}>TOTAL ANNUAL LEAVE</th>
                    <th rowSpan={2}>ANNUAL LEAVE USED</th>
                    <th rowSpan={2} className="annual-leave-th-balance">
                      BALANCE
                    </th>
                    <th rowSpan={2} className="annual-leave-th-detail">
                      {t("annualLeave.detailColumn", {
                        defaultValue: "DETAIL",
                      })}
                    </th>
                  </tr>
                  <tr>
                    <th className="annual-leave-th-sub annual-leave-col-code">
                      MNV
                    </th>
                    <th className="annual-leave-th-sub annual-leave-col-code">
                      MVT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="annual-leave-empty">
                        {t("annualLeave.noData")}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <AnnualLeaveManagerTableRow
                        key={row.id}
                        row={row}
                        index={idx}
                        year={year}
                        throughDateKey={detailThroughDateKey}
                      />
                    ))
                  )}
                </tbody>
              </table>
          </div>
        )}
      </div>
    </div>
  );
}
