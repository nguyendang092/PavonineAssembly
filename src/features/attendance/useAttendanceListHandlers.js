import { useCallback, useEffect } from "react";
import { canEditAttendanceForEmployee } from "@/config/authRoles";
import { getFirstDayOfMonthKey } from "@/utils/dateKey";
import { db, ref, get } from "@/services/firebase";
import { handleUploadExcel } from "./AttendanceUploadHandler";
import { downloadAttendanceDiemDanhTemplate } from "./attendanceDiemDanhExcelExport";
import {
  getAttendanceDateRangeExportPlan,
  executeAttendanceDateRangeExport,
} from "./attendanceDateRangeExport";
import {
  openAttendanceOvertimePrintWindow,
  openAttendanceListPrintWindow,
} from "./attendanceListPrint";
import { exportAttendanceBuCongExcel } from "./attendanceListBuCongExport";
import { mergeAttendanceDayRowsFromRaw } from "./mergeAttendanceDayRows";

/**
 * Handlers upload/export/in/sửa — logic giữ nguyên từ AttendanceList.
 */
export function useAttendanceListHandlers({
  user,
  userRole,
  userDepartments,
  t,
  tl,
  displayLocale,
  selectedDate,
  attendanceRootPath,
  setAlert,
  setShowEmployeeModal,
  setEmployeeModalRecord,
  setIsUploadingExcel,
  filteredEmployees,
  filterAttendanceListRows,
  exportRangeBusy,
  exportRangeFrom,
  exportRangeTo,
  setExportRangeBusy,
  setShowExportRangeModal,
  showExportRangeModal,
  exportRangeModalInitializedRef,
  setExportRangeFrom,
  setExportRangeTo,
  buCongEmployees,
}) {
  useEffect(() => {
    if (!showExportRangeModal) {
      exportRangeModalInitializedRef.current = false;
      return;
    }
    if (exportRangeModalInitializedRef.current) return;
    exportRangeModalInitializedRef.current = true;
    setExportRangeFrom(getFirstDayOfMonthKey(selectedDate));
    setExportRangeTo(selectedDate);
  }, [
    showExportRangeModal,
    selectedDate,
    exportRangeModalInitializedRef,
    setExportRangeFrom,
    setExportRangeTo,
  ]);

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
        attendanceRootPath,
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
    filterAttendanceListRows,
    displayLocale,
    tl,
    attendanceRootPath,
    setAlert,
    setExportRangeBusy,
    setShowExportRangeModal,
  ]);

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
    [user, userRole, userDepartments, t, setAlert, setEmployeeModalRecord, setShowEmployeeModal],
  );

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
    [user, selectedDate, setAlert, setIsUploadingExcel, t, attendanceRootPath],
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

  const handlePrintOvertimeList = useCallback(() => {
    if (filteredEmployees.length === 0) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.noEmployees"),
      });
      return;
    }
    const result = openAttendanceOvertimePrintWindow({
      filteredEmployees,
      selectedDate,
      displayLocale,
    });
    if (!result.ok) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.printWindowBlocked"),
      });
      return;
    }
    setAlert({
      show: true,
      type: "success",
      message: t("attendanceList.printOvertimeOpened", {
        count: filteredEmployees.length,
      }),
    });
  }, [filteredEmployees, selectedDate, displayLocale, t, setAlert]);

  const handlePrintAttendanceList = useCallback(() => {
    if (filteredEmployees.length === 0) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.noEmployees"),
      });
      return;
    }
    const result = openAttendanceListPrintWindow({
      filteredEmployees,
      selectedDate,
      displayLocale,
    });
    if (!result.ok) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.printWindowBlocked"),
      });
      return;
    }
    setAlert({
      show: true,
      type: "success",
      message: t("attendanceList.printAttendanceOpened", {
        count: filteredEmployees.length,
      }),
    });
  }, [filteredEmployees, selectedDate, displayLocale, t, setAlert]);

  const handleExportBuCongExcel = useCallback(async () => {
    try {
      const count = await exportAttendanceBuCongExcel({
        buCongEmployees,
        selectedDate,
      });
      setAlert({
        show: true,
        type: "success",
        message: `✅ Xuất danh sách bù công thành công! ${count} nhân viên.`,
      });
    } catch (error) {
      console.error("Error exporting Bu Cong Excel:", error);
      setAlert({
        show: true,
        type: "error",
        message: `❌ Xuất danh sách bù công thất bại! ${error.message || ""}`,
      });
    }
  }, [buCongEmployees, selectedDate, setAlert]);

  return {
    handleExportAttendanceDateRange,
    handleEdit,
    handleUploadExcelWrapper,
    handleDownloadAttendanceExcelTemplate,
    handlePrintOvertimeList,
    handlePrintAttendanceList,
    handleExportBuCongExcel,
  };
}
