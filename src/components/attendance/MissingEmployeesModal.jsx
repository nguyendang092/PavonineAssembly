import React from "react";
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
  previousDayEmployees = [],
  employees = [],
  selectedDate = "",
}) {
  const { t } = useTranslation();
  // Hàm tính ngày hôm trước
  const getPreviousDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    date.setDate(date.getDate() - 1);
    return new Date(
      date.getTime() - date.getTimezoneOffset() * 60000,
    ).toLocaleDateString("vi-VN");
  };

  const previousDateStr = getPreviousDate(selectedDate);
  const currentDateStr = selectedDate
    ? new Date(selectedDate).toLocaleDateString("vi-VN")
    : "";

  return (
    <UnifiedModal
      isOpen={isOpen}
      onClose={onClose}
      variant="warning"
      title={t("missingEmployees.modalTitle", {
        count: missingEmployees.length,
      })}
      size="lg"
      actions={[
        {
          label: t("common.close"),
          onClick: onClose,
          variant: "secondary",
        },
      ]}
    >
      {/* Thông tin tóm tắt */}
      <p className="text-sm text-gray-700 mb-4">
        {t("missingEmployees.prevDay", { date: previousDateStr })}{" "}
        <span className="font-bold text-red-600">
          {previousDayEmployees.length}
        </span>{" "}
        {t("missingEmployees.employees")}
      </p>
      <p className="text-sm text-gray-700 mb-4">
        {t("missingEmployees.today", { date: currentDateStr })}{" "}
        <span className="font-bold text-green-600">{employees.length}</span>{" "}
        {t("missingEmployees.employees")}
      </p>
      <p className="text-sm text-gray-700 mb-6 pb-4 border-b border-gray-200">
        {t("missingEmployees.resignedEmployees")}{" "}
        <span className="font-bold text-red-600">
          {missingEmployees.length}
        </span>
        {missingEmployees.length > 0 && (
          <span className="text-xs text-gray-500 ml-2">
            {t("missingEmployees.mayHaveResigned")}
          </span>
        )}
      </p>

      {/* Nội dung chính */}
      {missingEmployees.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {t("missingEmployees.noMissing")}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-red-700 to-red-400 text-white sticky top-0">
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {missingEmployees.map((emp, idx) => (
                <tr
                  key={emp.id}
                  className={`transition-colors hover:bg-red-50 ${
                    idx % 2 === 0 ? "bg-red-50" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3 text-red-600 font-semibold">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </UnifiedModal>
  );
}

export default MissingEmployeesModal;
