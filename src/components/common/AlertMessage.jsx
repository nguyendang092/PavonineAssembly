// Component: AlertMessage
// Chức năng: Hiển thị thông báo thành công/lỗi
import React from "react";

const AlertMessage = ({ alert }) =>
  alert.show && (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded font-semibold text-sm shadow transition-all duration-300 ${
        alert.type === "success"
          ? "bg-green-100 text-green-800 border border-green-300"
          : "bg-red-100 text-red-800 border border-red-300"
      }`}
    >
      {alert.message}
    </div>
  );

export default AlertMessage;
