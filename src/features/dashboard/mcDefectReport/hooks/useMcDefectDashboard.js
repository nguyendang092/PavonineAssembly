import { useEffect, useMemo, useRef, useState } from "react";
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

/** State, Firebase, derived data, CRUD — dùng trong McDefectReportPage. */
export function useMcDefectDashboard() {
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
        setMessage("Không tải được dữ liệu từ Firebase.");
      },
    );
    return () => unsubscribe();
  }, []);

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
    return `${top.date} (${top.errorCount})`;
  }, [byDateData]);

  const topEmployee = useMemo(() => {
    if (!byEmployeeData.length) return "-";
    return `${byEmployeeData[0].employee} (${byEmployeeData[0].errorCount})`;
  }, [byEmployeeData]);

  const topEmployeeYAxisWidth = useMemo(
    () =>
      estimateMcDefectEmployeeAxisWidth(byEmployeeData.map((d) => d.employee)),
    [byEmployeeData],
  );

  const chartByDatePeriodLabel = useMemo(
    () => formatMcDefectChartPeriodLabel(reportMonth, byDateData),
    [reportMonth, byDateData],
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

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetFilters = () => {
    resetMcDefectFilters({
      setReportMonth,
      setReportDepartment,
      setReportEmployee,
      setReportErrorType,
    });
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

  const handleImportExcel = async (file) => {
    if (!file) return;
    try {
      setSaving(true);
      setMessage("");
      const count = await importMcDefectExcelFile(file, rows);
      setMessageType("success");
      setMessage(
        `Đã import ${count} dòng (trùng khóa sẽ tự động ghi đè, không nhân bản).`,
      );
    } catch (error) {
      setMessageType("error");
      setMessage(`Import thất bại: ${error?.message || "Lỗi không xác định"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    downloadMcDefectExcelTemplate();
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
    },
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
    },
    form: {
      form,
      handleChange,
      handleSubmit,
    },
    actions: {
      handleDelete,
      handleImportExcel,
      handleDownloadTemplate,
      handleDownloadImage,
      handleDownloadPdf,
    },
  };
}
