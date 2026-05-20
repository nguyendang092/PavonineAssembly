import React, { memo } from "react";
import UnifiedModal from "@/components/ui/UnifiedModal";

function AttendanceUnattendedModal({
  showUnattendedPopup,
  unattendedEmployees,
  closeUnattendedPopup,
  unattendedSuppressSessionCheckbox,
  setUnattendedSuppressSessionCheckbox,
  setShowOnlyUnattendedFilter,
  selectedDate,
  displayLocale,
  tl,
  t,
}) {
  return (
    <UnifiedModal
      isOpen={showUnattendedPopup && unattendedEmployees.length > 0}
      onClose={closeUnattendedPopup}
      variant="primary"
      title={tl("unattendedTitle", "Nhân viên chưa điểm danh")}
      size="lg"
      footerStart={
        <label className="flex cursor-pointer items-center gap-2.5 text-left">
          <input
            type="checkbox"
            checked={unattendedSuppressSessionCheckbox}
            onChange={() => setUnattendedSuppressSessionCheckbox((v) => !v)}
            className="h-[18px] w-[18px] shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-300/70 dark:border-slate-600 dark:text-indigo-500 dark:focus:ring-indigo-800/60"
          />
          <span className="min-w-0 text-[11px] font-medium leading-snug text-slate-700 dark:text-slate-300">
            {tl(
              "unattendedSuppressSession",
              "Không tự hiển thị lại hộp thoại này trong phiên đăng nhập hiện tại",
            )}
          </span>
        </label>
      }
      actions={[
        {
          label: t("attendanceList.close"),
          onClick: closeUnattendedPopup,
          variant: "secondary",
        },
        {
          label: t("attendanceList.quickFilter"),
          onClick: () => {
            setShowOnlyUnattendedFilter(true);
            closeUnattendedPopup();
          },
          variant: "primary",
        },
      ]}
    >
      <p className="text-sm text-gray-700 mb-4">
        {tl(
          "unattendedSummary",
          "Hiện có {{count}} nhân viên chưa có thời gian vào trong ngày {{date}}.",
          {
            count: unattendedEmployees.length,
            date: new Date(selectedDate).toLocaleDateString(displayLocale),
          },
        )}
      </p>

      <div className="overflow-x-auto border rounded-lg shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-blue-700 to-blue-400 text-white sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                {tl("colIndex", "STT")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                {tl("colCode", "MNV")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                {tl("colName", "Họ và tên")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                {tl("colDepartment", "Bộ phận")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
            {unattendedEmployees.map((emp, idx) => (
              <tr
                key={emp.id}
                className={`transition-colors hover:bg-blue-50 ${
                  idx % 2 === 0
                    ? "bg-gray-50 dark:bg-slate-800/60"
                    : "bg-white dark:bg-slate-900"
                }`}
              >
                <td className="px-4 py-3 text-gray-700 font-medium">
                  {idx + 1}
                </td>
                <td className="px-4 py-3 text-blue-600 font-semibold">
                  {emp.mnv || "--"}
                </td>
                <td className="px-4 py-3 text-gray-800 font-medium">
                  {emp.hoVaTen || "--"}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {emp.boPhan || "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UnifiedModal>
  );
}

export default memo(AttendanceUnattendedModal);
