// Component: OvertimeModal
// Chức năng: Modal đăng ký tăng ca
import React from "react";

const OvertimeModal = ({ isOpen, onClose, children }) =>
  isOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-slideUp border border-gray-100">
        {children}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 px-4 pb-4">
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

export default OvertimeModal;
