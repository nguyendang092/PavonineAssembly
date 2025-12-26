// Component: SummarySection
// Chức năng: Hiển thị tổng số nhân viên và ngày
import React from "react";

const SummarySection = ({ filteredEmployees, selectedDate }) => (
  <div className="mt-6 bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-600">
    <div className="flex items-center justify-between">
      <p className="text-sm font-bold text-gray-700">
        📊 Tổng số nhân viên:
        <span className="ml-2 text-lg text-blue-600">
          {filteredEmployees.length}
        </span>
      </p>
      <p className="text-xs text-gray-500">
        Ngày: {new Date(selectedDate).toLocaleDateString("vi-VN")}
      </p>
    </div>
  </div>
);

export default SummarySection;
