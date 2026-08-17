import React from "react";
import { FiRefreshCw, FiSearch } from "react-icons/fi";
import { useTranslation } from "react-i18next";

export default function MoldFilterBar({
  searchTerm,
  onSearchChange,
  subsidiaryFilter,
  onSubsidiaryChange,
  typeFilter,
  onTypeChange,
  statusFilter,
  onStatusChange,
  subsidiaryOptions,
  typeOptions,
  onReset,
}) {
  const { t } = useTranslation();

  return (
    <div className="mold-filter-bar">
      <div className="mold-filter-search">
        <FiSearch className="mold-filter-search-icon" size={14} aria-hidden="true" />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t(
            "moldManager.searchPlaceholderLong",
            "Tìm theo mã khuôn, model, tên sản phẩm, code…",
          )}
        />
      </div>

      <select
        className="mold-filter-select"
        value={subsidiaryFilter}
        onChange={(e) => onSubsidiaryChange(e.target.value)}
        aria-label={t("moldManager.columns.subsidiary")}
      >
        <option value="">
          {t("moldManager.filterBranchAll", "Chi nhánh: Tất cả")}
        </option>
        {subsidiaryOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      <select
        className="mold-filter-select"
        value={typeFilter}
        onChange={(e) => onTypeChange(e.target.value)}
        aria-label={t("moldManager.columns.type")}
      >
        <option value="">
          {t("moldManager.filterTypeAll", "Loại: Tất cả")}
        </option>
        {typeOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      <select
        className="mold-filter-select"
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        aria-label={t("moldManager.filterStatus", "Trạng thái")}
      >
        <option value="">
          {t("moldManager.filterStatusAll", "Trạng thái: Tất cả")}
        </option>
        <option value="active">
          {t("moldManager.statusActive", "Đang dùng")}
        </option>
        <option value="maintenance">
          {t("moldManager.statusMaintenance", "Bảo trì")}
        </option>
        <option value="stopped">
          {t("moldManager.statusStopped", "Ngừng dùng")}
        </option>
      </select>

      <button
        type="button"
        className="mold-btn mold-btn--ghost mold-btn--reset"
        onClick={onReset}
        title={t("moldManager.resetFilters", "Đặt lại")}
        aria-label={t("moldManager.resetFilters", "Đặt lại")}
      >
        <FiRefreshCw size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
