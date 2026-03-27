import React, { useMemo, useState } from "react";
import UnifiedModal from "../common/UnifiedModal";

const normalizeEmployeeCode = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (/^\d+$/.test(raw)) {
    const asNumber = Number(raw);
    return Number.isFinite(asNumber) ? String(asNumber) : raw;
  }

  return raw.toUpperCase();
};

function NewEmployeesSummary({
  employees = [],
  previousDayEmployees = [],
  previousComparisonDate = "",
  selectedDate = "",
  mode = "card",
  onMenuClick = () => {},
  isDetailsOpen,
  onDetailsOpenChange,
}) {
  const [internalShowDetailsModal, setInternalShowDetailsModal] =
    useState(false);

  const { newEmployees, newEmployeeCount } = useMemo(() => {
    const previousCodes = new Set(
      previousDayEmployees
        .map((emp) => normalizeEmployeeCode(emp?.mnv))
        .filter((code) => code),
    );

    const rows = employees.filter((emp) => {
      const code = normalizeEmployeeCode(emp?.mnv);
      if (!code) return false;
      return !previousCodes.has(code);
    });

    return {
      newEmployees: rows,
      newEmployeeCount: rows.length,
    };
  }, [employees, previousDayEmployees]);

  const compareDateLabel = previousComparisonDate
    ? new Date(previousComparisonDate).toLocaleDateString("vi-VN")
    : "Không có dữ liệu trước đó";

  const selectedDateLabel = selectedDate
    ? new Date(selectedDate).toLocaleDateString("vi-VN")
    : "--";

  const showDetailsModal =
    typeof isDetailsOpen === "boolean"
      ? isDetailsOpen
      : internalShowDetailsModal;

  const setShowDetailsModal = (next) => {
    if (typeof isDetailsOpen !== "boolean") {
      setInternalShowDetailsModal(next);
    }
    if (onDetailsOpenChange) {
      onDetailsOpenChange(next);
    }
  };

  const renderDetailsModal = () => (
    <UnifiedModal
      isOpen={showDetailsModal}
      onClose={() => setShowDetailsModal(false)}
      title={`Danh sách nhân viên mới (${newEmployeeCount})`}
      size="lg"
      variant="info"
      actions={[
        {
          label: "Đóng",
          onClick: () => setShowDetailsModal(false),
          variant: "secondary",
        },
      ]}
    >
      <div className="mb-3 text-xs text-slate-600">
        So sánh {selectedDateLabel} với {compareDateLabel}
      </div>

      {newEmployeeCount === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Không có nhân viên mới trong ngày này.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[55vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-800 text-white">
                <tr>
                  <th className="w-14 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/90">
                    STT
                  </th>
                  <th className="w-24 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/90">
                    MNV
                  </th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/90">
                    Họ và tên
                  </th>
                  <th className="w-24 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/90">
                    Giới tính
                  </th>
                  <th className="w-32 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/90">
                    Ngày sinh
                  </th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/90">
                    Bộ phận
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {newEmployees.map((emp, idx) => (
                  <tr
                    key={emp.id || `${emp.mnv}-${idx}`}
                    className={`transition-colors hover:bg-sky-50 ${
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                    }`}
                  >
                    <td className="px-3 py-2.5 text-xs font-semibold text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-slate-800">
                      {emp.mnv || "--"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-700">
                      {emp.hoVaTen || "--"}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-slate-700">
                      {emp.gioiTinh || "--"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {emp.ngayThangNamSinh || "--"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {emp.boPhan || "--"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </UnifiedModal>
  );

  if (mode === "menu") {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setShowDetailsModal(true);
            onMenuClick();
          }}
          className="w-full text-left px-4 py-3 hover:bg-sky-50 border-t flex items-center gap-3 transition text-gray-700"
        >
          <span className="text-lg">🆕</span>
          <div className="flex-1">
            <div className="font-semibold">Nhân viên mới</div>
            <div className="text-xs text-gray-500">
              {newEmployeeCount > 0
                ? `${newEmployeeCount} người mới trong ngày`
                : "Không có nhân viên mới"}
            </div>
          </div>
          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">
            {newEmployeeCount}
          </span>
        </button>
      </>
    );
  }

  return <div> {renderDetailsModal()}</div>;
}

export default NewEmployeesSummary;
