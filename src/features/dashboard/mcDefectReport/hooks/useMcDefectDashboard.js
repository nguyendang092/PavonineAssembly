import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { db, onValue, ref, remove, set } from "@/services/firebase";
import {
  INITIAL_MC_DEFECT_FORM,
  MC_DEFECT_FILTER_ALL,
  MC_DEFECT_REPORT_PATH,
  MC_DEFECT_ROWS_PER_PAGE,
} from "../lib/constants";
import {
  downloadMcDefectExcelTemplate,
  importMcDefectExcelFile,
} from "../lib/excelImport";
import {
  buildByDateData,
  buildByEmployeeData,
  buildDetailRows,
  buildDonutByErrorTypeData,
  buildHeatmapData,
  buildMonthOptions,
  buildPreviousMonthRows,
  estimateMcDefectEmployeeAxisWidth,
  estimateMcDefectHeatmapTableHeightPx,
  filterMcDefectRows,
  formatMcDefectChartPeriodLabel,
  makeReadableRecordKey,
  normalizeText,
  parseMcDefectReportSnapshot,
  resetMcDefectFilters,
} from "../lib/dataAggregations";
import { useMcDefectA3ManualEmployees } from "./useMcDefectA3ManualEmployees";

/** State, Firebase, derived data, CRUD — dùng trong McDefectReportPage. */
export function useMcDefectDashboard() {
  const { t, i18n } = useTranslation();
  const tl = useCallback(
    (key, defaultValue, opts) =>
      t(`mcDefectReport.${key}`, { defaultValue, ...opts }),
    [t],
  );
  const dashboardExportRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [reportMonth, setReportMonth] = useState("2026-05");
  const [reportDepartment, setReportDepartment] = useState(MC_DEFECT_FILTER_ALL);
  const [reportEmployee, setReportEmployee] = useState(MC_DEFECT_FILTER_ALL);
  const [reportErrorType, setReportErrorType] = useState(MC_DEFECT_FILTER_ALL);
  const [reportOwner, setReportOwner] = useState("Nguyễn Thị Diệu Hiền");
  const [currentRawPage, setCurrentRawPage] = useState(1);
  const [currentDetailPage, setCurrentDetailPage] = useState(1);
  const [form, setForm] = useState(INITIAL_MC_DEFECT_FORM);
  /** { date, recordKey } khi đang sửa một dòng từ bảng raw */
  const [editingRecord, setEditingRecord] = useState(null);

  const notifyA3ManualLoadError = useCallback(() => {
    setMessageType("error");
    setMessage(
      tl("loadFirebaseError", "Không tải được dữ liệu từ Firebase."),
    );
  }, [tl]);

  const notifyA3ManualSaveError = useCallback(() => {
    setMessageType("error");
    setMessage(tl("saveError", "Không lưu được dữ liệu lên Firebase."));
  }, [tl]);

  const a3Manual = useMcDefectA3ManualEmployees(
    reportMonth,
    reportDepartment,
    {
      onLoadError: notifyA3ManualLoadError,
      onSaveError: notifyA3ManualSaveError,
    },
  );

  useEffect(() => {
    const recordsRef = ref(db, MC_DEFECT_REPORT_PATH);
    const unsubscribe = onValue(
      recordsRef,
      (snapshot) => {
        setRows(parseMcDefectReportSnapshot(snapshot.val()));
        setLoading(false);
      },
      () => {
        setLoading(false);
        setMessageType("error");
        setMessage(tl("loadFirebaseError", "Không tải được dữ liệu từ Firebase."));
      },
    );
    return () => unsubscribe();
  }, [tl]);

  const monthOptions = useMemo(() => buildMonthOptions(rows), [rows]);

  useEffect(() => {
    if (reportMonth === MC_DEFECT_FILTER_ALL) return;
    if (!monthOptions.includes(reportMonth)) {
      setReportMonth(monthOptions[monthOptions.length - 1] || MC_DEFECT_FILTER_ALL);
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

  const filterState = useMemo(
    () => ({ reportMonth, reportDepartment, reportEmployee, reportErrorType }),
    [reportMonth, reportDepartment, reportEmployee, reportErrorType],
  );

  const filteredRows = useMemo(
    () => filterMcDefectRows(rows, filterState),
    [rows, filterState],
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

  const byDateData = useMemo(
    () => buildByDateData(filteredRows),
    [filteredRows],
  );
  const byEmployeeData = useMemo(
    () => buildByEmployeeData(filteredRows),
    [filteredRows],
  );
  const employeeAnnouncementSourceRows = useMemo(
    () =>
      filterMcDefectRows(rows, {
        reportMonth,
        reportDepartment,
        reportEmployee: MC_DEFECT_FILTER_ALL,
        reportErrorType,
      }),
    [rows, reportMonth, reportDepartment, reportErrorType],
  );
  const employeeAnnouncementRows = useMemo(
    () =>
      buildByEmployeeData(
        employeeAnnouncementSourceRows,
        Number.POSITIVE_INFINITY,
      ),
    [employeeAnnouncementSourceRows],
  );
  const announcementEmployeePickerOptions = useMemo(() => {
    const scopedRows = filterMcDefectRows(rows, {
      reportMonth,
      reportDepartment,
      reportEmployee: MC_DEFECT_FILTER_ALL,
      reportErrorType: MC_DEFECT_FILTER_ALL,
    });
    return [...new Set(scopedRows.map((row) => row.employee).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
  }, [rows, reportMonth, reportDepartment]);
  const employeeAnnouncementPeriodLabel = useMemo(() => {
    const announcementByDateData = buildByDateData(employeeAnnouncementSourceRows);
    return formatMcDefectChartPeriodLabel(
      reportMonth,
      announcementByDateData,
      i18n.language,
    );
  }, [employeeAnnouncementSourceRows, reportMonth, i18n.language]);
  const donutByErrorTypeData = useMemo(
    () => buildDonutByErrorTypeData(filteredRows),
    [filteredRows],
  );

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
    return tl("dateWithCount", "{{date}} ({{count}})", {
      date: top.date,
      count: top.errorCount,
    });
  }, [byDateData, tl]);

  const topEmployee = useMemo(() => {
    if (!byEmployeeData.length) return "-";
    return tl("employeeWithCount", "{{employee}} ({{count}})", {
      employee: byEmployeeData[0].employee,
      count: byEmployeeData[0].errorCount,
    });
  }, [byEmployeeData, tl]);

  const topEmployeeYAxisWidth = useMemo(
    () =>
      estimateMcDefectEmployeeAxisWidth(byEmployeeData.map((d) => d.employee)),
    [byEmployeeData],
  );

  const chartByDatePeriodLabel = useMemo(
    () => formatMcDefectChartPeriodLabel(reportMonth, byDateData, i18n.language),
    [reportMonth, byDateData, i18n.language],
  );

  const previousMonthRows = useMemo(
    () => buildPreviousMonthRows(rows, reportMonth),
    [rows, reportMonth],
  );

  const improvementRate = useMemo(() => {
    const prevTotal = previousMonthRows.reduce(
      (sum, row) => sum + Number(row.errorCount || 0),
      0,
    );
    if (prevTotal <= 0) return 0;
    return ((prevTotal - totalErrorCount) / prevTotal) * 100;
  }, [previousMonthRows, totalErrorCount]);

  const heatmapData = useMemo(
    () => buildHeatmapData(filteredRows, byEmployeeData, byDateData),
    [filteredRows, byEmployeeData, byDateData],
  );

  const heatmapTableHeightPx = useMemo(
    () => estimateMcDefectHeatmapTableHeightPx(heatmapData.employees.length),
    [heatmapData.employees.length],
  );

  const donutPlotHeightPx = useMemo(
    () => Math.max(220, heatmapTableHeightPx + 16),
    [heatmapTableHeightPx],
  );

  const donutRadii = useMemo(
    () => ({
      inner: Math.round(Math.min(65, donutPlotHeightPx * 0.22)),
      outer: Math.round(Math.min(95, donutPlotHeightPx * 0.34)),
    }),
    [donutPlotHeightPx],
  );

  const detailRows = useMemo(
    () => buildDetailRows(filteredRows),
    [filteredRows],
  );

  const totalRawPages = Math.max(
    1,
    Math.ceil(filteredRows.length / MC_DEFECT_ROWS_PER_PAGE),
  );
  const totalDetailPages = Math.max(
    1,
    Math.ceil(detailRows.length / MC_DEFECT_ROWS_PER_PAGE),
  );

  const rawRowsPaged = useMemo(() => {
    const start = (currentRawPage - 1) * MC_DEFECT_ROWS_PER_PAGE;
    return filteredRows.slice(start, start + MC_DEFECT_ROWS_PER_PAGE);
  }, [filteredRows, currentRawPage]);

  const detailRowsPaged = useMemo(() => {
    const start = (currentDetailPage - 1) * MC_DEFECT_ROWS_PER_PAGE;
    return detailRows.slice(start, start + MC_DEFECT_ROWS_PER_PAGE);
  }, [detailRows, currentDetailPage]);

  useEffect(() => {
    if (currentRawPage > totalRawPages) setCurrentRawPage(totalRawPages);
  }, [currentRawPage, totalRawPages]);

  useEffect(() => {
    if (currentDetailPage > totalDetailPages)
      setCurrentDetailPage(totalDetailPages);
  }, [currentDetailPage, totalDetailPages]);

  const handleChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleResetFilters = useCallback(() => {
    resetMcDefectFilters({
      setReportMonth,
      setReportDepartment,
      setReportEmployee,
      setReportErrorType,
    });
  }, []);

  const resetFormAfterSave = () => {
    setEditingRecord(null);
    setForm((prev) => ({
      ...INITIAL_MC_DEFECT_FORM,
      date: prev.date,
      department: prev.department,
      errorType: prev.errorType,
    }));
  };

  const handleEdit = useCallback((row) => {
    setForm({
      date: row.date,
      employee: row.employee,
      department: row.department,
      errorType: row.errorType,
      errorCount: String(row.errorCount ?? ""),
      note: row.note || "",
    });
    setEditingRecord({ date: row.date, recordKey: row.recordKey });
    setMessageType("info");
    setMessage(tl("editModeMessage", "Đang chỉnh sửa — thay đổi form phía trên rồi bấm «Cập nhật»."));
  }, [tl]);

  const handleCancelEdit = useCallback(() => {
    setEditingRecord(null);
    setForm(INITIAL_MC_DEFECT_FORM);
    setMessage("");
  }, []);

  const handleSubmit = useCallback((e) => {
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
      setMessageType("error");
      setMessage(tl("validationError", "Vui lòng điền đủ ngày, nhân viên, bộ phận, loại lỗi và số lỗi hợp lệ."));
      return;
    }
    setSaving(true);
    const recordKey = makeReadableRecordKey({
      employee,
      department,
      errorType,
    });
    const newPath = `${MC_DEFECT_REPORT_PATH}/${form.date}/${recordKey}`;
    const payload = {
      date: form.date,
      employee,
      department,
      errorType,
      errorCount,
      note: normalizeText(form.note),
      updatedAt: Date.now(),
    };
    const isUpdate = Boolean(editingRecord);
    const oldPath = isUpdate
      ? `${MC_DEFECT_REPORT_PATH}/${editingRecord.date}/${editingRecord.recordKey}`
      : null;
    const pathChanged = isUpdate && oldPath !== newPath;

    const savePromise = pathChanged
      ? remove(ref(db, oldPath)).then(() => set(ref(db, newPath), payload))
      : set(ref(db, newPath), payload);

    savePromise
      .then(() => {
        setMessageType("success");
        setMessage(
          isUpdate
            ? tl("recordUpdated", "Đã cập nhật bản ghi.")
            : tl("recordAdded", "Đã thêm dữ liệu thành công."),
        );
        resetFormAfterSave();
      })
      .catch(() => {
        setMessageType("error");
        setMessage(tl("saveError", "Không lưu được dữ liệu lên Firebase."));
      })
      .finally(() => setSaving(false));
  }, [form, editingRecord, tl]);

  const handleDelete = useCallback(({ date, recordKey }) => {
    if (!date || !recordKey) return;
    remove(ref(db, `${MC_DEFECT_REPORT_PATH}/${date}/${recordKey}`))
      .then(() => {
        if (
          editingRecord?.date === date &&
          editingRecord?.recordKey === recordKey
        ) {
          setEditingRecord(null);
          setForm(INITIAL_MC_DEFECT_FORM);
        }
        setMessageType("success");
        setMessage(tl("recordDeleted", "Đã xóa bản ghi."));
      })
      .catch(() => {
        setMessageType("error");
        setMessage(tl("deleteError", "Không xóa được bản ghi."));
      });
  }, [editingRecord, tl]);

  const handleImportExcel = useCallback(async (file) => {
    if (!file) return;
    try {
      setSaving(true);
      setMessage("");
      const count = await importMcDefectExcelFile(file, rows, tl);
      setMessageType("success");
      setMessage(
        tl("importSuccess", "Đã import {{count}} dòng (trùng khóa sẽ tự động ghi đè, không nhân bản).", { count }),
      );
    } catch (error) {
      setMessageType("error");
      setMessage(
        tl("importFailed", "Import thất bại: {{message}}", {
          message: error?.message || tl("unknownError", "Lỗi không xác định"),
        }),
      );
    } finally {
      setSaving(false);
    }
  }, [rows, tl]);

  const handleDownloadTemplate = useCallback(() => {
    downloadMcDefectExcelTemplate(tl);
  }, [tl]);

  const handleDownloadImage = useCallback(async () => {
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
      setMessage(tl("imageDownloaded", "Đã tải hình dashboard."));
    } catch {
      setMessageType("error");
      setMessage(tl("imageExportError", "Không thể xuất hình dashboard."));
    }
  }, [tl]);

  const handleDownloadPdf = useCallback(async () => {
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
      setMessage(tl("pdfExported", "Đã xuất PDF dashboard."));
    } catch {
      setMessageType("error");
      setMessage(tl("pdfExportError", "Không thể xuất PDF dashboard."));
    }
  }, [tl]);

  const onPrevRawPage = useCallback(() => {
    setCurrentRawPage((p) => Math.max(1, p - 1));
  }, []);

  const onNextRawPage = useCallback(() => {
    setCurrentRawPage((p) => Math.min(totalRawPages, p + 1));
  }, [totalRawPages]);

  const onPrevDetailPage = useCallback(() => {
    setCurrentDetailPage((p) => Math.max(1, p - 1));
  }, []);

  const onNextDetailPage = useCallback(() => {
    setCurrentDetailPage((p) => Math.min(totalDetailPages, p + 1));
  }, [totalDetailPages]);

  return {
    dashboardExportRef,
    loading,
    message,
    messageType,
    saving,
    reportOwner,
    setReportOwner,
    filters: {
      reportMonth,
      setReportMonth,
      reportDepartment,
      setReportDepartment,
      reportEmployee,
      setReportEmployee,
      reportErrorType,
      setReportErrorType,
      monthOptions,
      departmentOptions,
      employeeOptions,
      errorTypeOptions,
      handleResetFilters,
    },
    kpi: {
      totalErrorCount,
      employeeWithErrors,
      highestDay,
      topEmployee,
      improvementRate,
    },
    charts: {
      byDateData,
      byEmployeeData,
      donutByErrorTypeData,
      dailyAverage,
      topEmployeeYAxisWidth,
      chartByDatePeriodLabel,
      heatmapData,
      heatmapTableHeightPx,
      donutPlotHeightPx,
      donutRadii,
      employeeAnnouncementRows,
      employeeAnnouncementPeriodLabel,
      announcementEmployeePickerOptions,
    },
    a3Manual,
    tables: {
      filteredRows,
      detailRows,
      rawRowsPaged,
      detailRowsPaged,
      currentRawPage,
      setCurrentRawPage,
      currentDetailPage,
      setCurrentDetailPage,
      totalRawPages,
      totalDetailPages,
      rowsPerPage: MC_DEFECT_ROWS_PER_PAGE,
      onPrevRawPage,
      onNextRawPage,
      onPrevDetailPage,
      onNextDetailPage,
    },
    form: {
      form,
      editingRecord,
      handleChange,
      handleSubmit,
      handleCancelEdit,
    },
    actions: {
      handleEdit,
      handleDelete,
      handleImportExcel,
      handleDownloadTemplate,
      handleDownloadImage,
      handleDownloadPdf,
    },
  };
}
