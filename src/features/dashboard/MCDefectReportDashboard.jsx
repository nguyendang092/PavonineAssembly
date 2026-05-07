import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "@e965/xlsx";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { db, onValue, push, ref, remove, set } from "@/services/firebase";

const DONUT_COLORS = ["#0f766e", "#0ea5e9", "#84cc16", "#f59e0b", "#ef4444"];
const MC_DEFECT_REPORT_PATH = "mcDefectReport/byDate";
const DEFAULT_DEPARTMENT = "Chưa phân loại";
const DEFAULT_ERROR_TYPE = "Chưa phân loại";

const toMonthKey = (date) => String(date || "").slice(0, 7);
const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const makeFirebaseSafeKey = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[.#$[\]/]/g, "_")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";

const makeCompositeKey = ({
  date,
  employee,
  department = DEFAULT_DEPARTMENT,
  errorType = DEFAULT_ERROR_TYPE,
}) =>
  [
    String(date || "").trim(),
    normalizeText(employee).toLowerCase(),
    normalizeText(department || DEFAULT_DEPARTMENT).toLowerCase(),
    normalizeText(errorType || DEFAULT_ERROR_TYPE).toLowerCase(),
  ].join("||");
const makeReadableRecordKey = ({ employee, department, errorType }) =>
  `${makeFirebaseSafeKey(employee)}__${makeFirebaseSafeKey(
    department || DEFAULT_DEPARTMENT,
  )}__${makeFirebaseSafeKey(errorType || DEFAULT_ERROR_TYPE)}`;

const heatColor = (value) => {
  if (value <= 0) return "#ffffff";
  if (value <= 1) return "#fef9c3";
  if (value <= 3) return "#fde68a";
  if (value <= 5) return "#fca5a5";
  return "#ef4444";
};

export default function MCDefectReportDashboard() {
  const ROWS_PER_PAGE = 10;
  const dashboardExportRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [reportMonth, setReportMonth] = useState("2026-05");
  const [reportDepartment, setReportDepartment] = useState("ALL");
  const [reportEmployee, setReportEmployee] = useState("ALL");
  const [reportErrorType, setReportErrorType] = useState("ALL");
  const [reportOwner, setReportOwner] = useState("Nguyễn Thị Diệu Hiền");
  const [currentRawPage, setCurrentRawPage] = useState(1);
  const [currentDetailPage, setCurrentDetailPage] = useState(1);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    employee: "",
    department: "MC",
    errorType: "Poorwork",
    errorCount: "",
    note: "",
  });

  useEffect(() => {
    const recordsRef = ref(db, MC_DEFECT_REPORT_PATH);
    const unsubscribe = onValue(
      recordsRef,
      (snapshot) => {
        const raw = snapshot.val();
        if (!raw || typeof raw !== "object") {
          setRows([]);
          setLoading(false);
          return;
        }
        const nextRows = Object.entries(raw)
          .flatMap(([dateKey, byRecordKey]) => {
            if (!byRecordKey || typeof byRecordKey !== "object") return [];
            return Object.entries(byRecordKey).map(([recordKey, value]) => {
              const v = value || {};
              return {
                id: `${dateKey}/${recordKey}`,
                date: String(v.date || dateKey || "").slice(0, 10),
                recordKey,
                employee: normalizeText(v.employee),
                department: normalizeText(v.department || DEFAULT_DEPARTMENT),
                errorType: normalizeText(v.errorType || DEFAULT_ERROR_TYPE),
                errorCount: Number(v.errorCount || 0),
                note: normalizeText(v.note),
                updatedAt: Number(v.updatedAt || 0),
              };
            });
          })
          .filter((row) => row.date && row.employee)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        setRows(nextRows);
        setLoading(false);
      },
      () => {
        setLoading(false);
        setMessageType("error");
        setMessage("Không tải được dữ liệu từ Firebase.");
      },
    );
    return () => unsubscribe();
  }, []);

  const monthOptions = useMemo(() => {
    const options = [
      ...new Set(rows.map((row) => toMonthKey(row.date)).filter(Boolean)),
    ].sort();
    if (!options.length) {
      const now = new Date();
      return [
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      ];
    }
    return options;
  }, [rows]);

  useEffect(() => {
    if (reportMonth === "ALL") return;
    if (!monthOptions.includes(reportMonth)) {
      setReportMonth(monthOptions[monthOptions.length - 1] || "ALL");
    }
  }, [monthOptions, reportMonth]);
  const departmentOptions = useMemo(
    () =>
      [...new Set(rows.map((row) => row.department).filter(Boolean))].sort(),
    [rows],
  );
  const employeeOptions = useMemo(
    () => [...new Set(rows.map((row) => row.employee).filter(Boolean))].sort(),
    [rows],
  );
  const errorTypeOptions = useMemo(
    () => [...new Set(rows.map((row) => row.errorType).filter(Boolean))].sort(),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (reportMonth !== "ALL" && toMonthKey(row.date) !== reportMonth)
          return false;
        if (reportDepartment !== "ALL" && row.department !== reportDepartment)
          return false;
        if (reportEmployee !== "ALL" && row.employee !== reportEmployee)
          return false;
        if (reportErrorType !== "ALL" && row.errorType !== reportErrorType)
          return false;
        return true;
      }),
    [rows, reportMonth, reportDepartment, reportEmployee, reportErrorType],
  );

  useEffect(() => {
    setCurrentRawPage(1);
    setCurrentDetailPage(1);
  }, [reportMonth, reportDepartment, reportEmployee, reportErrorType]);

  const totalErrorCount = useMemo(
    () =>
      filteredRows.reduce((sum, row) => sum + Number(row.errorCount || 0), 0),
    [filteredRows],
  );
  const employeeWithErrors = useMemo(
    () => new Set(filteredRows.map((row) => row.employee)).size,
    [filteredRows],
  );

  const byDateData = useMemo(() => {
    const dateMap = new Map();
    filteredRows.forEach((row) => {
      const key = row.date || "";
      dateMap.set(
        key,
        Number(dateMap.get(key) || 0) + Number(row.errorCount || 0),
      );
    });
    return [...dateMap.entries()]
      .map(([date, errorCount]) => ({ date, errorCount }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRows]);

  const byEmployeeData = useMemo(() => {
    const employeeMap = new Map();
    filteredRows.forEach((row) => {
      const key = (row.employee || "").trim() || "Unknown";
      employeeMap.set(
        key,
        Number(employeeMap.get(key) || 0) + Number(row.errorCount || 0),
      );
    });
    return [...employeeMap.entries()]
      .map(([employee, errorCount]) => ({ employee, errorCount }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 10);
  }, [filteredRows]);

  const donutData = useMemo(() => {
    const groupMap = new Map();
    filteredRows.forEach((row) => {
      const key = row.department || "Unknown";
      groupMap.set(
        key,
        Number(groupMap.get(key) || 0) + Number(row.errorCount || 0),
      );
    });
    return [...groupMap.entries()].map(([name, value]) => ({ name, value }));
  }, [filteredRows]);

  const dailyAverage = useMemo(() => {
    if (!byDateData.length) return 0;
    return (
      byDateData.reduce((sum, item) => sum + Number(item.errorCount || 0), 0) /
      byDateData.length
    );
  }, [byDateData]);

  const highestDay = useMemo(() => {
    if (!byDateData.length) return "-";
    const top = [...byDateData].sort((a, b) => b.errorCount - a.errorCount)[0];
    return `${top.date} (${top.errorCount})`;
  }, [byDateData]);

  const topEmployee = useMemo(() => {
    if (!byEmployeeData.length) return "-";
    return `${byEmployeeData[0].employee} (${byEmployeeData[0].errorCount})`;
  }, [byEmployeeData]);

  const previousMonthRows = useMemo(() => {
    if (reportMonth === "ALL") return [];
    const [yy, mm] = reportMonth.split("-").map(Number);
    const prevMonth =
      mm === 1 ? `${yy - 1}-12` : `${yy}-${String(mm - 1).padStart(2, "0")}`;
    return rows.filter((row) => toMonthKey(row.date) === prevMonth);
  }, [rows, reportMonth]);

  const improvementRate = useMemo(() => {
    const prevTotal = previousMonthRows.reduce(
      (sum, row) => sum + Number(row.errorCount || 0),
      0,
    );
    if (prevTotal <= 0) return 0;
    return ((prevTotal - totalErrorCount) / prevTotal) * 100;
  }, [previousMonthRows, totalErrorCount]);

  const heatmapData = useMemo(() => {
    const employees = byEmployeeData.slice(0, 8).map((x) => x.employee);
    const days = byDateData.map((x) => x.date).slice(-10);
    const map = new Map();
    filteredRows.forEach((row) => {
      const key = `${row.employee}__${row.date}`;
      map.set(key, Number(map.get(key) || 0) + Number(row.errorCount || 0));
    });
    return { employees, days, map };
  }, [filteredRows, byEmployeeData, byDateData]);

  const detailRows = useMemo(() => {
    const map = new Map();
    filteredRows.forEach((row) => {
      const key = `${row.employee}__${row.department}`;
      const prev = map.get(key) || {
        employee: row.employee,
        department: row.department,
        totalError: 0,
        latestDate: row.date,
        note: row.note || "",
      };
      prev.totalError += Number(row.errorCount || 0);
      if (String(row.date) > String(prev.latestDate))
        prev.latestDate = row.date;
      if (!prev.note && row.note) prev.note = row.note;
      map.set(key, prev);
    });
    return [...map.values()].sort((a, b) => b.totalError - a.totalError);
  }, [filteredRows]);

  const totalRawPages = Math.max(
    1,
    Math.ceil(filteredRows.length / ROWS_PER_PAGE),
  );
  const totalDetailPages = Math.max(
    1,
    Math.ceil(detailRows.length / ROWS_PER_PAGE),
  );
  const rawRowsPaged = useMemo(() => {
    const start = (currentRawPage - 1) * ROWS_PER_PAGE;
    return filteredRows.slice(start, start + ROWS_PER_PAGE);
  }, [filteredRows, currentRawPage, ROWS_PER_PAGE]);
  const detailRowsPaged = useMemo(() => {
    const start = (currentDetailPage - 1) * ROWS_PER_PAGE;
    return detailRows.slice(start, start + ROWS_PER_PAGE);
  }, [detailRows, currentDetailPage, ROWS_PER_PAGE]);

  useEffect(() => {
    if (currentRawPage > totalRawPages) setCurrentRawPage(totalRawPages);
  }, [currentRawPage, totalRawPages]);

  useEffect(() => {
    if (currentDetailPage > totalDetailPages)
      setCurrentDetailPage(totalDetailPages);
  }, [currentDetailPage, totalDetailPages]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const employee = normalizeText(form.employee);
    const department = normalizeText(form.department);
    const errorType = normalizeText(form.errorType);
    const errorCount = Number(form.errorCount);
    if (
      !form.date ||
      !employee ||
      !department ||
      !errorType ||
      !Number.isFinite(errorCount) ||
      errorCount < 0
    ) {
      return;
    }
    setSaving(true);
    const recordKey = makeReadableRecordKey({
      employee,
      department,
      errorType,
    });
    const targetRef = ref(
      db,
      `${MC_DEFECT_REPORT_PATH}/${form.date}/${recordKey}`,
    );
    set(targetRef, {
      date: form.date,
      employee,
      department,
      errorType,
      errorCount,
      note: normalizeText(form.note),
      updatedAt: Date.now(),
    })
      .then(() => {
        setMessageType("success");
        setMessage("Đã thêm dữ liệu thành công.");
        setForm((prev) => ({
          ...prev,
          employee: "",
          errorCount: "",
          note: "",
        }));
      })
      .catch(() => {
        setMessageType("error");
        setMessage("Không lưu được dữ liệu lên Firebase.");
      })
      .finally(() => setSaving(false));
  };

  const handleDelete = ({ date, recordKey }) => {
    if (!date || !recordKey) return;
    remove(ref(db, `${MC_DEFECT_REPORT_PATH}/${date}/${recordKey}`))
      .then(() => {
        setMessageType("success");
        setMessage("Đã xóa bản ghi.");
      })
      .catch(() => {
        setMessageType("error");
        setMessage("Không xóa được bản ghi.");
      });
  };

  const normalizeImportedDate = (value) => {
    if (typeof value === "number") {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (!parsed) return "";
      const yyyy = parsed.y;
      const mm = String(parsed.m).padStart(2, "0");
      const dd = String(parsed.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) return raw.replaceAll("/", "-");
    return "";
  };

  const findValueByAlias = (record, aliases) => {
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(record, alias))
        return record[alias];
    }
    return "";
  };

  const handleImportExcel = async (file) => {
    if (!file) return;
    try {
      setSaving(true);
      setMessage("");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) throw new Error("Không có sheet dữ liệu");
      const sheet = workbook.Sheets[sheetName];
      const records = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (!records.length) throw new Error("File Excel không có dữ liệu");

      const parsedRows = records
        .map((record) => {
          const date = normalizeImportedDate(
            findValueByAlias(record, ["Date", "Ngày", "date", "ngày"]),
          );
          const employee = normalizeText(
            findValueByAlias(record, [
              "Employee",
              "Nhân viên",
              "employee",
              "nhân viên",
            ]),
          );
          const department = normalizeText(
            findValueByAlias(record, [
              "Department",
              "Bộ phận",
              "department",
              "bộ phận",
            ]) || DEFAULT_DEPARTMENT,
          );
          const errorType = normalizeText(
            findValueByAlias(record, [
              "Error Type",
              "Loại lỗi",
              "errorType",
              "loại lỗi",
            ]) || DEFAULT_ERROR_TYPE,
          );
          const errorCountRaw = findValueByAlias(record, [
            "Error Count",
            "Số lỗi",
            "errorCount",
            "số lỗi",
          ]);
          const note = normalizeText(
            findValueByAlias(record, ["Note", "Ghi chú", "note", "ghi chú"]) ||
              "",
          );
          const errorCount = Number(errorCountRaw || 0);
          if (
            !date ||
            !employee ||
            !Number.isFinite(errorCount) ||
            errorCount < 0
          ) {
            return null;
          }
          return { date, employee, department, errorType, errorCount, note };
        })
        .filter(Boolean);

      if (!parsedRows.length) {
        throw new Error(
          "Không có dòng hợp lệ. Cần tối thiểu: Date, Employee, Error Count.",
        );
      }

      // Gộp các dòng trùng nhau ngay trong file import (last row wins).
      const parsedMap = new Map();
      parsedRows.forEach((row) => {
        parsedMap.set(makeCompositeKey(row), row);
      });
      const dedupedRows = [...parsedMap.values()];

      // Upsert: trùng khóa (Ngày + Nhân viên + Bộ phận + Loại lỗi) thì ghi đè.
      const existingByKey = new Map(
        rows.map((row) => [makeCompositeKey(row), row]),
      );
      await Promise.all(
        dedupedRows.map((row) => {
          const key = makeCompositeKey(row);
          const existingRow = existingByKey.get(key);
          const recordKey =
            existingRow?.recordKey ||
            makeReadableRecordKey({
              employee: row.employee,
              department: row.department,
              errorType: row.errorType,
            });
          const dateKey = row.date;
          const targetRef = ref(
            db,
            `${MC_DEFECT_REPORT_PATH}/${dateKey}/${recordKey}`,
          );
          return set(targetRef, { ...row, updatedAt: Date.now() });
        }),
      );
      setMessageType("success");
      setMessage(
        `Đã import ${dedupedRows.length} dòng (trùng khóa sẽ tự động ghi đè, không nhân bản).`,
      );
    } catch (error) {
      setMessageType("error");
      setMessage(`Import thất bại: ${error?.message || "Lỗi không xác định"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Date",
      "Employee",
      "Department",
      "Error Type",
      "Error Count",
      "Note",
    ];
    const sampleRows = [
      ["2026-05-07", "NGUYEN VAN A", "Lắp ráp", "Visual", 2, "Lỗi ngoại quan"],
      ["2026-05-07", "TRAN THI B", "QC", "Dimension", 1, ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MC_Defect_Template");
    XLSX.writeFile(wb, "MC_Defect_Template.xlsx");
  };

  const handleDownloadImage = async () => {
    if (!dashboardExportRef.current) return;
    try {
      const dataUrl = await toPng(dashboardExportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `Dashboard_Loi_Nhan_Su_${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      a.click();
      setMessageType("success");
      setMessage("Đã tải hình dashboard.");
    } catch {
      setMessageType("error");
      setMessage("Không thể xuất hình dashboard.");
    }
  };

  const handleDownloadPdf = async () => {
    if (!dashboardExportRef.current) return;
    try {
      const dataUrl = await toPng(dashboardExportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [img.width, img.height],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
      pdf.save(
        `Dashboard_Loi_Nhan_Su_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      setMessageType("success");
      setMessage("Đã xuất PDF dashboard.");
    } catch {
      setMessageType("error");
      setMessage("Không thể xuất PDF dashboard.");
    }
  };

  return (
    <div className="min-h-full bg-slate-100 px-4 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div ref={dashboardExportRef} className="w-full space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                Sản xuất / MC
              </p>
              <h1 className="text-2xl font-black tracking-wide text-slate-900 dark:text-slate-100">
                BÁO CÁO HÀNG LỖI BỘ PHẬN MC
              </h1>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
                <p className="text-[10px] uppercase text-slate-500">
                  Report Month
                </p>
                <p>{reportMonth === "ALL" ? "All" : reportMonth}</p>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
                <p className="text-[10px] uppercase text-slate-500">
                  Last Updated
                </p>
                <p>{new Date().toLocaleString("ko-KR")}</p>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
                <p className="text-[10px] uppercase text-slate-500">
                  Department
                </p>
                <p>{reportDepartment === "ALL" ? "All" : reportDepartment}</p>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
                <p className="text-[10px] uppercase text-slate-500">
                  Xuất báo cáo
                </p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadImage}
                    className="w-full rounded bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-700"
                  >
                    Tải hình
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="w-full rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                  >
                    Xuất PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Đang tải dữ liệu từ Firebase...
          </div>
        ) : null}

        {!loading && message ? (
          <div
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
              messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                : messageType === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {message}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500">
                Tháng
              </span>
              <select
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="ALL">Tất cả</option>
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500">
                Bộ phận
              </span>
              <select
                value={reportDepartment}
                onChange={(e) => setReportDepartment(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="ALL">Tất cả</option>
                {departmentOptions.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500">
                Nhân viên
              </span>
              <select
                value={reportEmployee}
                onChange={(e) => setReportEmployee(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="ALL">Tất cả</option>
                {employeeOptions.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500">
                Loại lỗi
              </span>
              <select
                value={reportErrorType}
                onChange={(e) => setReportErrorType(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="ALL">Tất cả</option>
                {errorTypeOptions.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500">
                Hành động
              </span>
              <button
                type="button"
                onClick={() => {
                  setReportMonth("ALL");
                  setReportDepartment("ALL");
                  setReportEmployee("ALL");
                  setReportErrorType("ALL");
                }}
                className="h-[42px] w-full rounded-lg bg-slate-800 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-500">
              Tổng lỗi trong tháng
            </p>
            <p className="mt-1 text-3xl font-black text-rose-600">
              {totalErrorCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-500">
              Số nhân viên có lỗi
            </p>
            <p className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">
              {employeeWithErrors}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-500">
              Ngày phát sinh lỗi nhiều nhất
            </p>
            <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
              {highestDay}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-500">
              Nhân viên lỗi cao nhất
            </p>
            <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
              {topEmployee}
            </p>
          </div>
          <div
            className={`rounded-xl border p-4 shadow-sm ${
              improvementRate >= 0
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                : "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30"
            }`}
          >
            <p className="text-xs font-semibold text-slate-500">
              Tỷ lệ cải thiện so với tháng trước
            </p>
            <p
              className={`mt-1 text-3xl font-black ${
                improvementRate >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {`${improvementRate >= 0 ? "+" : ""}${improvementRate.toFixed(1)}%`}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-900 xl:col-span-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              Top nhân viên lỗi cao
            </h3>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byEmployeeData}
                  layout="vertical"
                  margin={{ top: 6, right: 4, left: 1, bottom: 3 }}
                >
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="employee"
                    width={175}
                    interval={0}
                    tick={{ fontSize: 11, fill: "#0f172a", fontWeight: 600 }}
                    tickFormatter={(v) =>
                      String(v || "").length > 18
                        ? `${String(v).slice(0, 18)}...`
                        : String(v || "")
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(15, 23, 42, 0.06)" }}
                    formatter={(value) => [`${value}`, "Số lỗi"]}
                    labelFormatter={(label) => `Nhân viên: ${label}`}
                  />
                  <Bar
                    dataKey="errorCount"
                    name="Số lỗi"
                    fill="#1e3a8a"
                    radius={[0, 8, 8, 0]}
                    barSize={16}
                  >
                    <LabelList
                      dataKey="errorCount"
                      position="right"
                      fill="#0f172a"
                      fontSize={11}
                      fontWeight={700}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-4">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              Biểu đổ tổng số lỗi theo ngày
            </h3>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={byDateData}>
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <ReferenceLine
                    y={dailyAverage}
                    stroke="#16a34a"
                    strokeDasharray="4 4"
                    label={{ value: "Trung bình", position: "insideTopRight" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="errorCount"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    label={{
                      position: "top",
                      fill: "#1e293b",
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-3">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              Phân bổ lỗi theo bộ phận
            </h3>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={95}
                  >
                    {donutData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1 text-xs">
              {donutData.map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between"
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          DONUT_COLORS[index % DONUT_COLORS.length],
                      }}
                    />
                    {item.name}
                  </span>
                  <span className="font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            Lỗi theo ngày
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-slate-200 px-2 py-1 text-left dark:border-slate-700">
                    Nhân viên
                  </th>
                  {heatmapData.days.map((d) => (
                    <th
                      key={d}
                      className="border border-slate-200 px-2 py-1 dark:border-slate-700"
                    >
                      {d.slice(5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.employees.map((emp) => (
                  <tr key={emp}>
                    <td className="border border-slate-200 px-2 py-1 font-semibold dark:border-slate-700">
                      {emp}
                    </td>
                    {heatmapData.days.map((d) => {
                      const val = Number(
                        heatmapData.map.get(`${emp}__${d}`) || 0,
                      );
                      return (
                        <td
                          key={`${emp}-${d}`}
                          className="border border-slate-200 px-2 py-1 text-center font-bold dark:border-slate-700"
                          style={{ backgroundColor: heatColor(val) }}
                        >
                          {val || ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            Nhập liệu + Import Excel (3-6 cột)
          </h3>
          <div className="space-y-5">
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/40">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Tải template Excel để import dữ liệu.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Tải template
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                    {saving ? "Đang xử lý..." : "Import Excel"}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      disabled={saving}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        void handleImportExcel(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40 md:grid-cols-6"
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Ngày
                </span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => handleChange("date", e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Nhân viên
                </span>
                <input
                  type="text"
                  value={form.employee}
                  onChange={(e) => handleChange("employee", e.target.value)}
                  placeholder="Nhập tên nhân viên"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Bộ phận
                </span>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => handleChange("department", e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Loại lỗi
                </span>
                <input
                  type="text"
                  value={form.errorType}
                  onChange={(e) => handleChange("errorType", e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Số lỗi
                </span>
                <input
                  type="number"
                  min="0"
                  value={form.errorCount}
                  onChange={(e) => handleChange("errorCount", e.target.value)}
                  placeholder="0"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="h-[42px] w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  disabled={saving}
                >
                  {saving ? "Đang lưu..." : "Thêm bản ghi"}
                </button>
              </div>
              <label className="md:col-span-6">
                <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Ghi chú
                </span>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => handleChange("note", e.target.value)}
                  placeholder="Ghi chú xử lý / hành động khắc phục"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
            </form>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-center font-bold">STT</th>
                    <th className="px-3 py-2 text-center font-bold">Ngày</th>
                    <th className="px-3 py-2 text-center font-bold">
                      Nhân viên
                    </th>
                    <th className="px-3 py-2 text-center font-bold">Bộ phận</th>
                    <th className="px-3 py-2 text-center font-bold">
                      Loại lỗi
                    </th>
                    <th className="px-3 py-2 text-center font-bold">Số lỗi</th>
                    <th className="px-3 py-2 text-center font-bold">Note</th>
                    <th className="px-3 py-2 text-center font-bold">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rawRowsPaged.map((row, idx) => (
                    <tr
                      key={row.id}
                      className="border-t border-slate-200 dark:border-slate-700"
                    >
                      <td className="px-3 py-2 text-center">
                        {(currentRawPage - 1) * ROWS_PER_PAGE + idx + 1}
                      </td>
                      <td className="px-3 py-2 text-center">{row.date}</td>
                      <td className="px-3 py-2 text-center">{row.employee}</td>
                      <td className="px-3 py-2 text-center">
                        {row.department}
                      </td>
                      <td className="px-3 py-2 text-center">{row.errorType}</td>
                      <td className="px-3 py-2 text-center font-semibold">
                        {row.errorCount}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.note || "-"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleDelete({
                              date: row.date,
                              recordKey: row.recordKey,
                            })
                          }
                          className="rounded bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span>{`Hiển thị ${rawRowsPaged.length} / ${filteredRows.length} dòng`}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentRawPage <= 1}
                  onClick={() => setCurrentRawPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
                >
                  Trước
                </button>
                <span>{`Trang ${currentRawPage}/${totalRawPages}`}</span>
                <button
                  type="button"
                  disabled={currentRawPage >= totalRawPages}
                  onClick={() =>
                    setCurrentRawPage((p) => Math.min(totalRawPages, p + 1))
                  }
                  className="rounded border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
                >
                  Sau
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            Bảng chi tiết tổng hợp (Pivot)
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-center font-bold">STT</th>
                  <th className="px-3 py-2 text-center font-bold">Nhân viên</th>
                  <th className="px-3 py-2 text-center font-bold">Bộ phận</th>
                  <th className="px-3 py-2 text-center font-bold">Tổng lỗi</th>
                  <th className="px-3 py-2 text-center font-bold">
                    Ngày lỗi gần nhất
                  </th>
                  <th className="px-3 py-2 text-center font-bold">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {detailRowsPaged.map((row, idx) => (
                  <tr
                    key={`${row.employee}-${row.department}`}
                    className="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td className="px-3 py-2 text-center">
                      {(currentDetailPage - 1) * ROWS_PER_PAGE + idx + 1}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold">
                      {row.employee}
                    </td>
                    <td className="px-3 py-2 text-center">{row.department}</td>
                    <td className="px-3 py-2 text-center font-bold">
                      {row.totalError}
                    </td>
                    <td className="px-3 py-2 text-center">{row.latestDate}</td>
                    <td className="px-3 py-2 text-center">{row.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span>{`Hiển thị ${detailRowsPaged.length} / ${detailRows.length} dòng`}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentDetailPage <= 1}
                onClick={() => setCurrentDetailPage((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
              >
                Trước
              </button>
              <span>{`Trang ${currentDetailPage}/${totalDetailPages}`}</span>
              <button
                type="button"
                disabled={currentDetailPage >= totalDetailPages}
                onClick={() =>
                  setCurrentDetailPage((p) => Math.min(totalDetailPages, p + 1))
                }
                className="rounded border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
              >
                Sau
              </button>
            </div>
          </div>
        </section>

        <footer className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Người tạo báo cáo:{" "}
              <input
                value={reportOwner}
                onChange={(e) => setReportOwner(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
              />
            </p>
            <p>Cập nhật lúc: {new Date().toLocaleString("vi-VN")}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
