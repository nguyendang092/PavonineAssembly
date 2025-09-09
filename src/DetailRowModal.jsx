import React from "react";

export default function DetailRowModal({ open, onClose, row, allLoiKeys }) {
  if (!open || !row) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 min-w-[340px] max-w-[90vw] max-h-[90vh] overflow-auto relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-red-500 font-bold text-lg hover:underline"
        >
          ×
        </button>
        <h2 className="text-xl font-bold mb-4 text-center uppercase">Chi tiết dòng dữ liệu</h2>
        <table className="w-full text-sm border-collapse mb-2">
          <tbody>
            {Object.entries(row).map(([key, value]) =>
              key !== "Lỗi" ? (
                <tr key={key}>
                  <td className="font-semibold pr-2 py-1 text-right text-gray-700 whitespace-nowrap">{key}</td>
                  <td className="pl-2 py-1 text-left text-gray-900">{String(value)}</td>
                </tr>
              ) : null
            )}
            {row.Lỗi && allLoiKeys && (
              <tr>
                <td className="font-semibold pr-2 py-1 text-right text-gray-700 align-top">Lỗi</td>
                <td className="pl-2 py-1 text-left text-gray-900">
                  <table className="w-full text-xs border-collapse">
                    <tbody>
                      {allLoiKeys.map((loi) => (
                        <tr key={loi}>
                          <td className="pr-2 py-0.5 text-right text-gray-600 whitespace-nowrap">{loi}</td>
                          <td className="pl-2 py-0.5 text-left text-gray-900">{row.Lỗi[loi] ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
