import { parsePayrollDayFromAttendanceRaw } from "@/features/payroll/buildPayrollDayFromRaw";
import {
  buildPayrollSalaryExcelWorkbookMultiDay,
  downloadPayrollSalaryExcel,
  downloadPayrollWorkbookToFile,
  formatPayrollExcelDateCell,
  PAYROLL_EXCEL_MAX_RANGE_DAYS,
} from "@/features/payroll/payrollExcelExport";
import { payrollExportDepartmentFilenameSuffix } from "@/features/payroll/payrollExportDepartmentFilter";
import {
  filterPayrollEmployeesForTimesheetExport,
  hasActivePayrollTimesheetToolbarExportFilters,
  PAYROLL_TIMESHEET_EXPORT_FILTER_DEFAULTS,
} from "@/features/payroll/payrollTimesheetExportFilters";
import { enumerateDateKeysInclusive } from "@/utils/dateKey";
import { isKoreanAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";

function payrollOffLikeDayMeta({ isOffDay, isHolidayDay, isCompensatoryDay, koreanTimesheetRules }) {
  if (koreanTimesheetRules) {
    return isOffDay || isHolidayDay;
  }
  return isOffDay || isHolidayDay || isCompensatoryDay;
}

function buildDayMetaFromParsed(parsed, koreanTimesheetRules) {
  const { isOffDay, isHolidayDay, isCompensatoryDay } = parsed;
  return {
    isPayrollOffLikeDay: payrollOffLikeDayMeta({
      isOffDay,
      isHolidayDay,
      isCompensatoryDay,
      koreanTimesheetRules,
    }),
    isOffDay,
    isHolidayDay,
    isCompensatoryDay,
    earlyOtPaperworkById: parsed.earlyOtPaperworkById || {},
    lateOtExcludedById: parsed.lateOtExcludedById || {},
    nightOtPaperworkById: parsed.nightOtPaperworkById || {},
  };
}

function resolveExportEmptyMessage({
  tlPage,
  selectedDepartments,
  toolbarFilters,
}) {
  if (selectedDepartments?.length) {
    return tlPage(
      "exportDepartmentFilteredEmpty",
      "Không có nhân viên thuộc bộ phận đã chọn trong ngày này.",
    );
  }
  if (hasActivePayrollTimesheetToolbarExportFilters(toolbarFilters)) {
    return tlPage(
      "exportToolbarFilteredEmpty",
      "Không có nhân viên khớp bộ lọc trên toolbar trong ngày này.",
    );
  }
  return tlPage(
    "exportExcelEmpty",
    "Không có dữ liệu điểm danh trong ngày để xuất.",
  );
}

function resolveExportRangeEmptyMessage({
  tlPage,
  selectedDepartments,
  toolbarFilters,
}) {
  if (selectedDepartments?.length) {
    return tlPage(
      "exportDepartmentFilteredEmpty",
      "Không có nhân viên thuộc bộ phận đã chọn trong khoảng ngày.",
    );
  }
  if (hasActivePayrollTimesheetToolbarExportFilters(toolbarFilters)) {
    return tlPage(
      "exportToolbarFilteredEmpty",
      "Không có nhân viên khớp bộ lọc trên toolbar trong khoảng ngày đã chọn.",
    );
  }
  return tlPage(
    "exportRangePayrollEmpty",
    "Không có dữ liệu điểm danh trong khoảng ngày đã chọn.",
  );
}

function filterDayEmployeesForExport(
  dayEmployees,
  {
    selectedDepartments,
    toolbarFilters,
    normalizeDepartment,
    dayMeta,
    dateKey,
  },
) {
  const filters = {
    ...PAYROLL_TIMESHEET_EXPORT_FILTER_DEFAULTS,
    ...toolbarFilters,
  };

  return filterPayrollEmployeesForTimesheetExport(dayEmployees, {
    ...filters,
    exportDepartments: selectedDepartments,
    normalizeDepartment,
    dayCtx: {
      isOffDay: dayMeta.isOffDay,
      isHolidayDay: dayMeta.isHolidayDay,
      isCompensatoryDay: dayMeta.isCompensatoryDay,
      dateKey,
    },
    earlyOtPaperworkById: dayMeta.earlyOtPaperworkById,
    lateOtExcludedById: dayMeta.lateOtExcludedById,
    nightOtPaperworkById: dayMeta.nightOtPaperworkById,
  });
}

/**
 * Xuất Excel bảng giờ công 1 ngày / nhiều ngày (Giờ công & Korean Timesheet).
 */
export async function executePayrollSalaryExcelExportRange({
  rangeFrom,
  rangeTo,
  selectedDepartments = [],
  attendanceRootPath = "attendance",
  selectedDate,
  currentDayEmployees = null,
  currentDayMeta = null,
  toolbarFilters = null,
  db,
  ref,
  get,
  displayLocale,
  tlPage,
  tlTable,
  normalizeDepartment,
  sheetTitleBase,
  singleDaySheetTitle = null,
  filenamePrefix = "Bang-gio-cong",
}) {
  const keys = enumerateDateKeysInclusive(rangeFrom, rangeTo);
  const resolvedToolbarFilters = toolbarFilters ?? null;
  if (!keys.length) {
    return {
      ok: false,
      alert: {
        type: "error",
        message: tlPage(
          "exportRangeInvalid",
          "Khoảng ngày không hợp lệ hoặc từ ngày lớn hơn đến ngày.",
        ),
      },
    };
  }
  if (keys.length > PAYROLL_EXCEL_MAX_RANGE_DAYS) {
    return {
      ok: false,
      alert: {
        type: "error",
        message: tlPage(
          "exportRangeTooLong",
          "Tối đa 366 ngày mỗi lần xuất. Vui lòng thu hẹp khoảng ngày.",
        ),
      },
    };
  }

  const koreanTimesheetRules = isKoreanAttendanceRoot(attendanceRootPath);
  const deptSuffix = payrollExportDepartmentFilenameSuffix(selectedDepartments);
  const deptSheetSuffix =
    selectedDepartments?.length > 0
      ? ` — ${selectedDepartments.join(", ")}`
      : "";

  if (keys.length === 1) {
    const dateKey = keys[0];
    let dayEmployees = [];
    let dayMeta = buildDayMetaFromParsed(
      {
        isOffDay: false,
        isHolidayDay: false,
        isCompensatoryDay: false,
        earlyOtPaperworkById: {},
        lateOtExcludedById: {},
        nightOtPaperworkById: {},
      },
      koreanTimesheetRules,
    );

    if (
      dateKey === selectedDate &&
      Array.isArray(currentDayEmployees) &&
      currentDayEmployees.length &&
      currentDayMeta
    ) {
      dayEmployees = currentDayEmployees;
      dayMeta = {
        ...currentDayMeta,
        isPayrollOffLikeDay: payrollOffLikeDayMeta({
          isOffDay: currentDayMeta.isOffDay,
          isHolidayDay: currentDayMeta.isHolidayDay,
          isCompensatoryDay: currentDayMeta.isCompensatoryDay,
          koreanTimesheetRules,
        }),
        earlyOtPaperworkById: currentDayMeta.earlyOtPaperworkById || {},
        lateOtExcludedById: currentDayMeta.lateOtExcludedById || {},
        nightOtPaperworkById: currentDayMeta.nightOtPaperworkById || {},
      };
    } else {
      const snap = await get(ref(db, `${attendanceRootPath}/${dateKey}`));
      const parsed = parsePayrollDayFromAttendanceRaw(snap.val());
      dayEmployees = parsed.baseEmployees;
      dayMeta = buildDayMetaFromParsed(parsed, koreanTimesheetRules);
    }

    const filteredEmployees = resolvedToolbarFilters
      ? filterDayEmployeesForExport(dayEmployees, {
          selectedDepartments,
          toolbarFilters: resolvedToolbarFilters,
          normalizeDepartment,
          dayMeta,
          dateKey,
        })
      : filterPayrollEmployeesForTimesheetExport(dayEmployees, {
          exportDepartments: selectedDepartments,
          normalizeDepartment,
        });

    if (!filteredEmployees.length) {
      return {
        ok: false,
        alert: {
          type: "error",
          message: resolveExportEmptyMessage({
            tlPage,
            selectedDepartments,
            toolbarFilters: resolvedToolbarFilters,
          }),
        },
      };
    }

    const sheetTitleBaseResolved =
      sheetTitleBase ||
      tlPage("exportSheetTitle", "Bảng giờ công nhân viên");
    const sheetTitle = singleDaySheetTitle
      ? `${singleDaySheetTitle}${deptSheetSuffix}`
      : `${sheetTitleBaseResolved} — ${formatPayrollExcelDateCell(dateKey, displayLocale)}${deptSheetSuffix}`;

    await downloadPayrollSalaryExcel({
      employees: filteredEmployees,
      selectedDate: dateKey,
      isPayrollOffLikeDay: dayMeta.isPayrollOffLikeDay,
      isOffDay: dayMeta.isOffDay,
      isHolidayDay: dayMeta.isHolidayDay,
      isCompensatoryDay: dayMeta.isCompensatoryDay,
      koreanTimesheetRules,
      tlTable,
      sheetTitle,
      earlyOtPaperworkById: dayMeta.earlyOtPaperworkById,
      lateOtExcludedById: dayMeta.lateOtExcludedById,
      nightOtPaperworkById: dayMeta.nightOtPaperworkById,
      filename: `${filenamePrefix}_${dateKey}${deptSuffix}.xlsx`,
    });

    return {
      ok: true,
      alert: {
        type: "success",
        message: tlPage("exportExcelSuccess", "✅ Đã xuất Excel.", {
          rows: filteredEmployees.length,
        }),
      },
    };
  }

  const dayChunks = [];
  for (const dateKey of keys) {
    let parsed;
    if (
      dateKey === selectedDate &&
      Array.isArray(currentDayEmployees) &&
      currentDayEmployees.length &&
      currentDayMeta
    ) {
      parsed = {
        baseEmployees: currentDayEmployees,
        isOffDay: currentDayMeta.isOffDay,
        isHolidayDay: currentDayMeta.isHolidayDay,
        isCompensatoryDay: currentDayMeta.isCompensatoryDay,
        earlyOtPaperworkById: currentDayMeta.earlyOtPaperworkById || {},
        lateOtExcludedById: currentDayMeta.lateOtExcludedById || {},
        nightOtPaperworkById: currentDayMeta.nightOtPaperworkById || {},
      };
    } else {
      const snap = await get(ref(db, `${attendanceRootPath}/${dateKey}`));
      parsed = parsePayrollDayFromAttendanceRaw(snap.val());
    }

    const meta = buildDayMetaFromParsed(parsed, koreanTimesheetRules);
    const filteredEmployees = resolvedToolbarFilters
      ? filterDayEmployeesForExport(parsed.baseEmployees, {
          selectedDepartments,
          toolbarFilters: resolvedToolbarFilters,
          normalizeDepartment,
          dayMeta: meta,
          dateKey,
        })
      : filterPayrollEmployeesForTimesheetExport(parsed.baseEmployees, {
          exportDepartments: selectedDepartments,
          normalizeDepartment,
        });

    if (!filteredEmployees.length) continue;

    dayChunks.push({
      dateKey,
      employees: filteredEmployees,
      koreanTimesheetRules,
      ...meta,
    });
  }

  if (!dayChunks.length) {
    return {
      ok: false,
      alert: {
        type: "error",
        message: resolveExportRangeEmptyMessage({
          tlPage,
          selectedDepartments,
          toolbarFilters: resolvedToolbarFilters,
        }),
      },
    };
  }

  const fromKey = keys[0];
  const toKey = keys[keys.length - 1];
  const sheetTitleBaseResolved =
    sheetTitleBase || tlPage("exportSheetTitle", "Bảng giờ công nhân viên");
  const sheetTitle = `${sheetTitleBaseResolved} — ${formatPayrollExcelDateCell(fromKey, displayLocale)} – ${formatPayrollExcelDateCell(toKey, displayLocale)}${deptSheetSuffix}`;
  const workbook = await buildPayrollSalaryExcelWorkbookMultiDay({
    dayChunks,
    tlTable,
    sheetTitle,
  });
  await downloadPayrollWorkbookToFile({
    workbook,
    filename: `${filenamePrefix}_${fromKey}_den_${toKey}${deptSuffix}.xlsx`,
  });

  const totalRows = dayChunks.reduce((s, d) => s + d.employees.length, 0);
  return {
    ok: true,
    alert: {
      type: "success",
      message: tlPage(
        "exportRangeExcelSuccess",
        "✅ Đã xuất Excel (nhiều ngày).",
        {
          days: dayChunks.length,
          rows: totalRows,
        },
      ),
    },
  };
}
