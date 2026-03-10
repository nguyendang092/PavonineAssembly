import React from "react";

/**
 * MissingEmployeesButton - Nút cảnh báo để hiển thị danh sách nhân viên bị mất
 * @param {Array} missingEmployees - Danh sách nhân viên bị mất so với ngày hôm trước
 * @param {Function} onOpen - Hàm callback khi click nút
 */
function MissingEmployeesButton({ missingEmployees = [], onOpen }) {
  // Không hiển thị nếu không có nhân viên bị mất
  if (missingEmployees.length === 0) {
    return null;
  }

  return (
    <button
      onClick={onOpen}
      className="relative flex items-center justify-center w-12 h-12 rounded-full bg-red-100 hover:bg-red-200 transition-colors shadow-md"
      title={`${missingEmployees.length} nhân viên bị mất so với ngày hôm trước`}
      aria-label={`${missingEmployees.length} nhân viên bị mất`}
    >
      <span className="text-xl">⚠️</span>
      <span className="absolute top-0 right-0 w-5 h-5 bg-red-600 text-white rounded-full text-xs font-bold flex items-center justify-center">
        {missingEmployees.length}
      </span>
    </button>
  );
}

export default MissingEmployeesButton;
