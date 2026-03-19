import React, { useState } from "react";

/**
 * AnnualLeaveDetail
 *
 * Renders a single <td> cell showing the employee's annual leave quota.
 * A "Xem chi tiết" button opens a compact modal with:
 *   - Phép năm (quota)
 *   - Phép đã dùng (used)
 *   - Phép còn lại (remaining, colour-coded)
 *
 * Props:
 *   emp                   – attendance record object
 *   allEmployeesByMnv     – map of normalised MNV → employee record (contains phepNam)
 *   leaveUsed             – map of normalised MNV → days used (number)
 *   normalizeEmployeeCode – optional function(value) → normalised string
 */
function AnnualLeaveDetail({
  emp,
  allEmployeesByMnv,
  leaveUsed,
  normalizeEmployeeCode,
}) {
  const [showDetail, setShowDetail] = useState(false);

  const mnvKey = normalizeEmployeeCode
    ? normalizeEmployeeCode(emp?.mnv)
    : String(emp?.mnv || "").trim();

  const employeeInfo = allEmployeesByMnv[mnvKey] || {};
  const quotaRaw = employeeInfo?.phepNam;
  const quota = Number(quotaRaw);
  const used = leaveUsed[mnvKey];
  const hasQuota = !isNaN(quota) && quotaRaw != null;
  const remaining = hasQuota ? quota - (used ?? 0) : null;

  const remainingColor =
    remaining === null
      ? "text-gray-400"
      : remaining < 0
        ? "text-red-600"
        : remaining === 0
          ? "text-gray-400"
          : "text-green-600";

  return (
    <td className="px-3 py-3 text-sm text-center">
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => setShowDetail(true)}
          className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
        >
          Xem chi tiết
        </button>
      </div>

      {showDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-80 max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-blue-800 mb-2 text-center uppercase bg-blue-50 border border-blue-100 rounded-lg py-2">
              Chi tiết phép năm
            </h3>
            <p className="text-lg font-bold text-black text-center mb-1 truncate">
              {emp.hoVaTen || emp.mnv || ""}
            </p>
            <p className="text-sm font-semibold text-black text-center mb-1 truncate">
              MNV: {emp.mnv || ""}
            </p>
            <p className="text-sm font-semibold text-black text-center mb-1 truncate">
              Bộ phận: {emp.boPhan || ""}
            </p>

            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-600">Phép năm</td>
                  <td className="py-2 text-right font-bold text-blue-700">
                    {quotaRaw ?? "--"}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-600">Đã dùng</td>
                  <td className="py-2 text-right font-bold text-orange-600">
                    {used != null ? used : "--"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Còn lại</td>
                  <td className={`py-2 text-right font-bold ${remainingColor}`}>
                    {remaining !== null ? remaining : "--"}
                  </td>
                </tr>
              </tbody>
            </table>

            <button
              onClick={() => setShowDetail(false)}
              className="mt-5 w-full py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </td>
  );
}

export default AnnualLeaveDetail;
