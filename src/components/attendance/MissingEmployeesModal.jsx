import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import UnifiedModal from "../common/UnifiedModal";

/**
 * MissingEmployeesModal - Modal hiển thị danh sách nhân viên bị mất so với ngày hôm trước
 * @param {Boolean} isOpen - Trạng thái modal
 * @param {Function} onClose - Hàm callback đóng modal
 * @param {Array} missingEmployees - Danh sách nhân viên bị mất
 * @param {Array} previousDayEmployees - Danh sách nhân viên ngày hôm trước
 * @param {Array} employees - Danh sách nhân viên hôm nay
 * @param {String} selectedDate - Ngày được chọn (format: YYYY-MM-DD)
 */
function MissingEmployeesModal({
  isOpen = false,
  onClose = () => {},
  missingEmployees = [],
  suspectedEmployees = [],
  confirmedEmployees = [],
  previousDayEmployees = [],
  previousComparisonDate = "",
  employees = [],
  selectedDate = "",
  confirmationMap = {},
  canManageConfirmation = false,
  onConfirmEmployee = () => {},
  onUnconfirmEmployee = () => {},
  historicalThresholdDays = 3,
  onHistoricalThresholdChange = () => {},
  onScanHistorical = () => {},
  historicalScanLoading = false,
  historicalScannedAt = "",
  historicalLatestDate = "",
  historicalSuspectedEmployees = [],
  onBulkConfirmHistorical = () => {},
}) {
  const { t } = useTranslation();
  const [selectedHistoricalCodes, setSelectedHistoricalCodes] = useState({});

  const normalizeEmployeeCode = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (/^\d+$/.test(raw)) {
      const asNumber = Number(raw);
      return Number.isFinite(asNumber) ? String(asNumber) : raw;
    }
    return raw.toUpperCase();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("vi-VN");
  };

  const previousDateStr = formatDate(previousComparisonDate);
  const currentDateStr = selectedDate
    ? new Date(selectedDate).toLocaleDateString("vi-VN")
    : "";

  const historicalItems = useMemo(() => {
    return historicalSuspectedEmployees
      .map((emp) => {
        const code = normalizeEmployeeCode(emp.employeeCode || emp.mnv);
        const isConfirmed =
          !!code && confirmationMap[code]?.status === "confirmed";
        return {
          ...emp,
          employeeCode: code,
          isConfirmed,
        };
      })
      .filter((emp) => !emp.isConfirmed);
  }, [historicalSuspectedEmployees, confirmationMap]);

  const selectedHistoricalCodeList = useMemo(() => {
    return Object.entries(selectedHistoricalCodes)
      .filter(([, checked]) => checked)
      .map(([code]) => code);
  }, [selectedHistoricalCodes]);

  useEffect(() => {
    setSelectedHistoricalCodes({});
  }, [historicalSuspectedEmployees, historicalThresholdDays]);

  const toggleHistoricalSelection = (employeeCode) => {
    if (!employeeCode) return;
    setSelectedHistoricalCodes((prev) => ({
      ...prev,
      [employeeCode]: !prev[employeeCode],
    }));
  };

  const toggleSelectAllHistorical = () => {
    const selectableItems = historicalItems.filter((item) => !item.isConfirmed);
    if (selectableItems.length === 0) return;

    const allSelected = selectableItems.every(
      (item) => item.employeeCode && selectedHistoricalCodes[item.employeeCode],
    );

    if (allSelected) {
      const next = { ...selectedHistoricalCodes };
      selectableItems.forEach((item) => {
        if (item.employeeCode) delete next[item.employeeCode];
      });
      setSelectedHistoricalCodes(next);
      return;
    }

    const next = { ...selectedHistoricalCodes };
    selectableItems.forEach((item) => {
      if (item.employeeCode) next[item.employeeCode] = true;
    });
    setSelectedHistoricalCodes(next);
  };

  const handleBulkConfirm = () => {
    onBulkConfirmHistorical(selectedHistoricalCodeList);
  };

  const getEmployeeRowKey = (emp, idx, prefix) => {
    const code = normalizeEmployeeCode(emp?.employeeCode || emp?.mnv);
    const id = String(emp?.id ?? "").trim();
    const name = String(emp?.hoVaTen ?? "").trim();
    const dept = String(emp?.boPhan ?? "").trim();

    return `${prefix}-${id || code || "unknown"}-${name}-${dept}-${idx}`;
  };

  const renderTable = ({
    title,
    description,
    employeesToRender,
    variant,
    actionLabel,
    onAction,
    isConfirmedTable = false,
  }) => {
    const headerClass =
      variant === "amber"
        ? "bg-gradient-to-r from-amber-600 to-orange-400 text-white"
        : "bg-gradient-to-r from-emerald-700 to-emerald-400 text-white";
    const rowAccentClass =
      variant === "amber" ? "bg-amber-50" : "bg-emerald-50";
    const actionClass =
      variant === "amber"
        ? "bg-red-600 hover:bg-red-700 text-white"
        : "bg-slate-700 hover:bg-slate-800 text-white";

    return (
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {employeesToRender.length} người
          </span>
        </div>

        {employeesToRender.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Không có dữ liệu.
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg shadow-sm">
            <table className="w-full text-sm">
              <thead className={headerClass}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                    STT
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                    MNV
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                    Họ và tên
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                    Ngày sinh
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                    Bộ phận
                  </th>
                  {isConfirmedTable && (
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                      Xác nhận
                    </th>
                  )}
                  {canManageConfirmation && (
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                      Thao tác
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employeesToRender.map((emp, idx) => {
                  const confirmation =
                    confirmationMap[String(emp.mnv ?? "").trim()] ||
                    confirmationMap[String(Number(emp.mnv ?? ""))] ||
                    {};

                  return (
                    <tr
                      key={getEmployeeRowKey(emp, idx, "main")}
                      className={`transition-colors hover:brightness-95 ${
                        idx % 2 === 0 ? rowAccentClass : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-700 font-medium">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-semibold">
                        {emp.mnv || "--"}
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium">
                        {emp.hoVaTen || "--"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        {emp.ngayThangNamSinh || "--"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {emp.boPhan || "--"}
                      </td>
                      {isConfirmedTable && (
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {confirmation.confirmedAt
                            ? new Date(confirmation.confirmedAt).toLocaleString(
                                "vi-VN",
                              )
                            : "--"}
                        </td>
                      )}
                      {canManageConfirmation && (
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => onAction(emp)}
                            className={`rounded-md px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${actionClass}`}
                          >
                            {actionLabel}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <UnifiedModal
      isOpen={isOpen}
      onClose={onClose}
      variant="blue"
      title={`Danh sách nhân viên nghỉ việc`}
      size="lg"
      actions={[
        {
          label: t("common.close"),
          onClick: onClose,
          variant: "secondary",
        },
      ]}
    >
      <p className="text-sm text-gray-700 mb-4">
        Lấy dữ liệu gần nhất: {previousDateStr || "--"}:{" "}
        <span className="font-bold text-red-600">
          {previousDayEmployees.length}
        </span>{" "}
        nhân viên
      </p>
      <p className="text-sm text-gray-700 mb-4">
        Ngày đang kiểm tra {currentDateStr || "--"}:{" "}
        <span className="font-bold text-green-600">{employees.length}</span>{" "}
        nhân viên
      </p>

      {missingEmployees.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          Không có nhân viên.
        </div>
      ) : (
        renderTable({
          title: "Danh sách nhân viên nghỉ việc",
          description:
            "Từ dữ liệu chấm công: không có chấm công trong ngày hiện tại.",
          employeesToRender: suspectedEmployees,
          variant: "slate",
          actionLabel: "Xác nhận nghỉ ngang",
          onAction: onConfirmEmployee,
        })
      )}
      {renderTable({
        title: "Đã xác nhận nghỉ việc",
        description:
          "Danh sách toàn bộ nhân viên đã được HR/Admin xác nhận nghỉ không thông báo.",
        employeesToRender: confirmedEmployees,
        variant: "green",
        actionLabel: "Hủy",
        onAction: onUnconfirmEmployee,
        isConfirmedTable: true,
      })}

      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Quét dữ liệu cũ hàng loạt
            </h3>
            <input
              type="number"
              min={1}
              value={historicalThresholdDays}
              onChange={(e) =>
                onHistoricalThresholdChange(Number(e.target.value) || 1)
              }
              className="w-24 rounded-md border px-3 py-2 text-sm font-semibold text-blue-700"
            />
            <button
              type="button"
              onClick={onScanHistorical}
              disabled={historicalScanLoading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {historicalScanLoading ? "Đang quét..." : "Quét toàn bộ lịch sử"}
            </button>
            {historicalLatestDate && (
              <span className="text-xs text-slate-500">
                Mốc dữ liệu mới nhất: {formatDate(historicalLatestDate)}
              </span>
            )}
          </div>

          {historicalItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Quét toàn bộ lịch sử.
            </div>
          ) : (
            <>
              {canManageConfirmation && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAllHistorical}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Chọn/Bỏ tất cả
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkConfirm}
                    disabled={selectedHistoricalCodeList.length === 0}
                    className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Xác nhận nhanh ({selectedHistoricalCodeList.length})
                  </button>
                </div>
              )}

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-200/60">
                <table className="w-full table-fixed text-xs sm:text-sm">
                  <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-800 text-white">
                    <tr>
                      {canManageConfirmation && (
                        <th className="w-10 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-white/90">
                          Chọn
                        </th>
                      )}
                      <th className="w-10 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-white/90">
                        STT
                      </th>
                      <th className="w-16 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-white/90">
                        MNV
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-white/90">
                        Họ và tên
                      </th>
                      <th className="hidden px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-white/90 md:table-cell">
                        Bộ phận
                      </th>
                      <th className="hidden px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-white/90 lg:table-cell">
                        Lần cuối xuất hiện
                      </th>
                      <th className="w-20 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-white/90">
                        Số ngày vắng
                      </th>
                      {canManageConfirmation && (
                        <th className="w-20 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-white/90">
                          Thao tác
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {historicalItems.map((emp, idx) => (
                      <tr
                        key={getEmployeeRowKey(emp, idx, "historical")}
                        className={`transition-colors duration-150 hover:bg-indigo-50/70 ${
                          idx % 2 === 0 ? "bg-slate-50/50" : "bg-white"
                        }`}
                      >
                        {canManageConfirmation && (
                          <td className="px-2 py-2 align-middle">
                            <input
                              type="checkbox"
                              checked={
                                !!selectedHistoricalCodes[emp.employeeCode]
                              }
                              onChange={() =>
                                toggleHistoricalSelection(emp.employeeCode)
                              }
                              disabled={emp.isConfirmed}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                            />
                          </td>
                        )}
                        <td className="px-2 py-2 align-top text-[11px] font-semibold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] font-semibold text-slate-900 break-words">
                          {emp.mnv || "--"}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-slate-700 break-words leading-5">
                          {emp.hoVaTen || "--"}
                        </td>
                        <td className="hidden px-2 py-2 align-top text-[11px] text-slate-700 break-words leading-5 md:table-cell">
                          {emp.boPhan || "--"}
                        </td>
                        <td className="hidden px-2 py-2 align-top text-[11px] text-slate-600 break-words leading-5 lg:table-cell">
                          {formatDate(emp.lastSeenDate) || "--"}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-100">
                            {emp.missingWorkingDays}
                          </span>
                        </td>
                        {canManageConfirmation && (
                          <td className="px-2 py-2 align-top">
                            {!emp.isConfirmed ? (
                              <button
                                type="button"
                                onClick={() => onConfirmEmployee(emp)}
                                className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow"
                              >
                                Xác nhận
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onUnconfirmEmployee(emp)}
                                className="inline-flex w-full items-center justify-center rounded-lg bg-slate-700 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow"
                              >
                                Hủy
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </UnifiedModal>
  );
}

export default MissingEmployeesModal;
