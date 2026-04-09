import React from "react";
import UnifiedModal from "@/components/ui/UnifiedModal";

export default function AttendanceExportRangeModal({
  isOpen,
  onClose,
  exportRangeBusy,
  exportRangeFrom,
  exportRangeTo,
  onChangeFrom,
  onChangeTo,
  onConfirmExport,
  tl,
}) {
  return (
    <UnifiedModal
      isOpen={isOpen}
      onClose={() => {
        if (exportRangeBusy) return;
        onClose();
      }}
      variant="info"
      title={tl("exportRangeModalTitle", "Xuất Excel theo khoảng ngày")}
      size="md"
      showCloseButton={!exportRangeBusy}
      actions={[
        {
          label: tl("cancel", "Hủy"),
          onClick: () => {
            if (exportRangeBusy) return;
            onClose();
          },
          variant: "secondary",
          disabled: exportRangeBusy,
        },
        {
          label: exportRangeBusy
            ? tl("exportRangeWorking", "Đang tải…")
            : tl("exportRangeConfirm", "Xuất file"),
          onClick: () => {
            void onConfirmExport();
          },
          variant: "primary",
          disabled: exportRangeBusy,
        },
      ]}
    >
      <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
        {tl(
          "exportRangeModalHint",
          "Dữ liệu mỗi ngày được gộp hồ sơ giống màn hình điểm danh. Bộ lọc tìm kiếm / bộ phận / giới tính / trạng thái chấm công hiện tại cũng áp dụng cho từng ngày trong file.",
        )}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-800 dark:text-slate-200">
          {tl("exportRangeFromLabel", "Từ ngày")}
          <input
            type="date"
            value={exportRangeFrom}
            onChange={(e) => onChangeFrom(e.target.value)}
            disabled={exportRangeBusy}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-800 dark:text-slate-200">
          {tl("exportRangeToLabel", "Đến ngày")}
          <input
            type="date"
            value={exportRangeTo}
            onChange={(e) => onChangeTo(e.target.value)}
            disabled={exportRangeBusy}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
      </div>
    </UnifiedModal>
  );
}
