import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { canManageAnnualLeave } from "@/config/authRoles";
import { db, ref, onValue, set } from "@/services/firebase";
import AlertMessage from "@/components/ui/AlertMessage";
import LoadingBlock from "@/components/ui/LoadingBlock";
import {
  ANNUAL_LEAVE_EMP,
  ANNUAL_LEAVE_META_KEY,
  ANNUAL_LEAVE_RTDB_ROOT,
} from "./annualLeaveFields";
import {
  computeAnnualLeaveTotals,
  formatAnnualLeaveDecimal,
  formatAnnualLeaveDisplayDate,
} from "./annualLeaveCalculated";
import { parseAnnualLeaveExcelFile } from "./annualLeaveExcelImport";
import { exportAnnualLeaveExcel } from "./annualLeaveExcelExport";
import "./annualLeaveManager.css";

function currentYear() {
  return new Date().getFullYear();
}

function normalizeAnnualLeaveRow(id, raw) {
  if (!raw || typeof raw !== "object") return null;
  const totals = computeAnnualLeaveTotals(raw);
  return {
    id,
    ...raw,
    ...totals,
  };
}

export default function AnnualLeaveManager() {
  const { t } = useTranslation();
  const { user, userRole } = useUser();
  const [year, setYear] = useState(currentYear());
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const fileInputRef = useRef(null);

  const canManage = canManageAnnualLeave(user, userRole);

  useEffect(() => {
    const yearRef = ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`);
    setLoading(true);
    const unsubscribe = onValue(yearRef, (snapshot) => {
      const data = snapshot.val();
      const list = [];
      let nextMeta = null;
      if (data && typeof data === "object") {
        for (const [id, val] of Object.entries(data)) {
          if (id === ANNUAL_LEAVE_META_KEY) {
            nextMeta = val;
            continue;
          }
          const row = normalizeAnnualLeaveRow(id, val);
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
      setRows(list);
      setMeta(nextMeta);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [year]);

  useEffect(() => {
    if (!alert.show) return;
    const timer = setTimeout(
      () => setAlert((a) => ({ ...a, show: false })),
      4000,
    );
    return () => clearTimeout(timer);
  }, [alert.show]);

  const departments = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const d = r[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT];
      if (d) set.add(String(d));
    });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (deptFilter && r[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] !== deptFilter) {
        return false;
      }
      if (!q) return true;
      const name = String(r[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "").toLowerCase();
      const mnv = `${r[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? ""}${r[ANNUAL_LEAVE_EMP.MNV_SUFFIX] ?? ""}`;
      return name.includes(q) || mnv.includes(q);
    });
  }, [rows, search, deptFilter]);

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

  const yearOptions = useMemo(() => {
    const y = currentYear();
    return Array.from({ length: 5 }, (_, i) => y - 2 + i);
  }, []);

  if (!user) {
    return (
      <div className="annual-leave-page p-4">
        <p>{t("annualLeave.pleaseLogin")}</p>
      </div>
    );
  }

  return (
    <div className="annual-leave-page w-full bg-slate-100 dark:bg-slate-950">
      <div className="annual-leave-shell">
        <div className="annual-leave-top">
          <div className="annual-leave-top-head">
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

          <div className="annual-leave-toolbar-row">
            <label className="annual-leave-field">
              <span className="annual-leave-field-label">
                {t("annualLeave.year")}
              </span>
              <select
                className="annual-leave-control"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
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

            {canManage && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleUpload}
                />
                <button
                  type="button"
                  disabled={uploading}
                  className="annual-leave-btn annual-leave-btn-upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading
                    ? t("annualLeave.uploading")
                    : t("annualLeave.uploadExcel")}
                </button>
              </>
            )}

            <button
              type="button"
              className="annual-leave-btn annual-leave-btn-export"
              onClick={handleExport}
              disabled={filteredRows.length === 0}
            >
              {t("annualLeave.exportExcel")}
            </button>

            <span className="annual-leave-count">
              {t("annualLeave.rowCount", { count: filteredRows.length })}
            </span>
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
                <col />
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
                      <td colSpan={13} className="annual-leave-empty">
                        {t("annualLeave.noData")}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <tr key={row.id}>
                        <td className="annual-leave-col-no">
                          {row.rowNo ?? idx + 1}
                        </td>
                        <td className="annual-leave-col-code">
                          {row[ANNUAL_LEAVE_EMP.MNV_PREFIX]}
                        </td>
                        <td className="annual-leave-col-code">
                          {row[ANNUAL_LEAVE_EMP.MNV_SUFFIX]}
                        </td>
                        <td className="annual-leave-name">
                          {row[ANNUAL_LEAVE_EMP.FULL_NAME]}
                        </td>
                        <td className="annual-leave-col-date">
                          {formatAnnualLeaveDisplayDate(
                            row[ANNUAL_LEAVE_EMP.DATE_OF_BIRTH],
                          )}
                        </td>
                        <td className="annual-leave-dept">
                          {row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]}
                        </td>
                        <td className="annual-leave-col-date">
                          {formatAnnualLeaveDisplayDate(
                            row[ANNUAL_LEAVE_EMP.START_WORKING_DATE],
                            { fullYear: true },
                          )}
                        </td>
                        <td className="annual-leave-col-num">
                          {row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]}
                        </td>
                        <td className="annual-leave-dash">
                          {row[ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV]
                            ? row[ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV]
                            : "-"}
                        </td>
                        <td className="annual-leave-dash">
                          {row[ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF]
                            ? row[ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF]
                            : "-"}
                        </td>
                        <td className="annual-leave-col-num annual-leave-total">
                          {formatAnnualLeaveDecimal(
                            row[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE],
                          )}
                        </td>
                        <td className="annual-leave-col-num annual-leave-used">
                          {formatAnnualLeaveDecimal(
                            row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED],
                          )}
                        </td>
                        <td className="annual-leave-balance">
                          {formatAnnualLeaveDecimal(
                            row[ANNUAL_LEAVE_EMP.BALANCE],
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
          </div>
        )}

        {!canManage && (
          <p className="annual-leave-view-hint">
            {t("annualLeave.viewOnlyHint")}
          </p>
        )}
      </div>
    </div>
  );
}
