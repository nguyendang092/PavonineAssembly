// File: UnifiedModal.example.jsx
// Chức năng: Ví dụ sử dụng UnifiedModal component

import React, { useState } from "react";
import UnifiedModal from "./UnifiedModal";

const UnifiedModalExample = () => {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDangerModal, setShowDangerModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-3xl font-bold mb-6">Ví dụ UnifiedModal</h1>

      <div className="flex flex-wrap gap-4">
        {/* Info Modal */}
        <button
          onClick={() => setShowInfoModal(true)}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:shadow-lg"
        >
          Mở Modal Thông tin (Info)
        </button>

        {/* Warning Modal */}
        <button
          onClick={() => setShowWarningModal(true)}
          className="px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:shadow-lg"
        >
          Mở Modal Cảnh báo (Warning)
        </button>

        {/* Success Modal */}
        <button
          onClick={() => setShowSuccessModal(true)}
          className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold hover:shadow-lg"
        >
          Mở Modal Thành công (Success)
        </button>

        {/* Danger Modal */}
        <button
          onClick={() => setShowDangerModal(true)}
          className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:shadow-lg"
        >
          Mở Modal Nguy hiểm (Danger)
        </button>

        {/* Custom Content Modal */}
        <button
          onClick={() => setShowCustomModal(true)}
          className="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:shadow-lg"
        >
          Mở Modal Tùy chỉnh
        </button>
      </div>

      {/* Info Modal Example */}
      <UnifiedModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        variant="info"
        title="Thông tin"
        message="Đây là modal thông tin với màu xanh indigo-purple gradient."
        actions={[
          {
            label: "Đóng",
            onClick: () => setShowInfoModal(false),
            variant: "secondary",
          },
          {
            label: "Xác nhận",
            onClick: () => {
              console.log("Đã xác nhận!");
              setShowInfoModal(false);
            },
            variant: "primary",
          },
        ]}
      />

      {/* Warning Modal Example */}
      <UnifiedModal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        variant="warning"
        title="Cảnh báo công việc chưa hoàn tất"
        message="Bạn có 5 công việc bảo trì chưa được hoàn tất. Vui lòng kiểm tra và xử lý."
        size="md"
        actions={[
          {
            label: "Để sau",
            onClick: () => setShowWarningModal(false),
            variant: "secondary",
          },
          {
            label: "Xem ngay",
            onClick: () => {
              console.log("Chuyển đến danh sách công việc");
              setShowWarningModal(false);
            },
            variant: "primary",
          },
        ]}
      />

      {/* Success Modal Example */}
      <UnifiedModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        variant="success"
        title="Thao tác thành công"
        message="Dữ liệu đã được lưu thành công vào hệ thống!"
        size="sm"
        actions={[
          {
            label: "Đóng",
            onClick: () => setShowSuccessModal(false),
            variant: "primary",
          },
        ]}
      />

      {/* Danger Modal Example */}
      <UnifiedModal
        isOpen={showDangerModal}
        onClose={() => setShowDangerModal(false)}
        variant="danger"
        title="Xác nhận xóa"
        message="Bạn có chắc chắn muốn xóa bản ghi này? Hành động này không thể hoàn tác!"
        size="md"
        actions={[
          {
            label: "Hủy",
            onClick: () => setShowDangerModal(false),
            variant: "secondary",
          },
          {
            label: "Xóa",
            onClick: () => {
              console.log("Đã xóa!");
              setShowDangerModal(false);
            },
            variant: "danger",
          },
        ]}
      />

      {/* Custom Content Modal */}
      <UnifiedModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        variant="info"
        title="Danh sách nhân viên chưa điểm danh"
        size="xl"
        actions={[
          {
            label: "Đóng",
            onClick: () => setShowCustomModal(false),
            variant: "secondary",
          },
          {
            label: "Lọc nhân viên",
            onClick: () => {
              console.log("Áp dụng filter");
              setShowCustomModal(false);
            },
            variant: "primary",
          },
        ]}
      >
        {/* Custom content - Table example */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                  Mã NV
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                  Họ và tên
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                  Bộ phận
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="hover:bg-blue-50">
                <td className="px-4 py-3 text-sm font-medium">NV001</td>
                <td className="px-4 py-3 text-sm">Nguyễn Văn A</td>
                <td className="px-4 py-3 text-sm">Sản xuất</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                    Chưa chấm công
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-blue-50">
                <td className="px-4 py-3 text-sm font-medium">NV002</td>
                <td className="px-4 py-3 text-sm">Trần Thị B</td>
                <td className="px-4 py-3 text-sm">Kinh doanh</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                    Chưa chấm công
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-blue-50">
                <td className="px-4 py-3 text-sm font-medium">NV003</td>
                <td className="px-4 py-3 text-sm">Lê Văn C</td>
                <td className="px-4 py-3 text-sm">Hành chính</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                    Chưa chấm công
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UnifiedModal>
    </div>
  );
};

export default UnifiedModalExample;
