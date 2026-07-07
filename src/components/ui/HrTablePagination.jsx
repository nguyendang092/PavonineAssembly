import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { HR_TABLE_PAGE_SIZE_OPTIONS } from "@/hooks/useHrTablePagination";
import "./hrTablePagination.css";

function NavButton({ label, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="hr-table-pagination__nav-btn"
    >
      {children}
    </button>
  );
}

function HrTablePagination({
  rangeStart,
  rangeEnd,
  totalItems,
  page,
  totalPages,
  pageNumbers,
  pageSize,
  onPageChange,
  onPageSizeChange,
  unitLabel,
}) {
  const { t } = useTranslation();
  const tp = useCallback(
    (key, defaultValue, opts) =>
      t(`hrTablePagination.${key}`, { defaultValue, ...opts }),
    [t],
  );

  const goFirst = () => onPageChange(1);
  const goPrev = () => onPageChange(Math.max(1, page - 1));
  const goNext = () => onPageChange(Math.min(totalPages, page + 1));
  const goLast = () => onPageChange(totalPages);

  const resolvedUnit =
    unitLabel ?? tp("unitEmployees", "nhân viên");

  return (
    <div
      className="hr-table-pagination"
      role="navigation"
      aria-label={tp("ariaLabel", "Phân trang bảng dữ liệu")}
    >
      <p className="hr-table-pagination__summary">
        <span className="hr-table-pagination__summary-label">
          {tp("showingLabel", "HIỂN THỊ")}
        </span>{" "}
        <span className="hr-table-pagination__summary-range">
          {rangeStart} - {rangeEnd}
        </span>{" "}
        <span className="hr-table-pagination__summary-slash">/</span>{" "}
        <span className="hr-table-pagination__summary-total">{totalItems}</span>{" "}
        <span className="hr-table-pagination__summary-unit">
          {resolvedUnit.toUpperCase()}
        </span>
      </p>

      <div className="hr-table-pagination__controls" aria-label={tp("pageNav", "Điều hướng trang")}>
        <NavButton
          label={tp("firstPage", "Trang đầu")}
          disabled={page <= 1}
          onClick={goFirst}
        >
          |&lt;
        </NavButton>
        <NavButton
          label={tp("prevPage", "Trang trước")}
          disabled={page <= 1}
          onClick={goPrev}
        >
          &lt;
        </NavButton>

        {pageNumbers.map((item, i) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${i}`}
              className="hr-table-pagination__ellipsis"
              aria-hidden
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-label={tp("pageNumber", "Trang {{n}}", { n: item })}
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPageChange(item)}
              className={`hr-table-pagination__page-btn${
                item === page ? " hr-table-pagination__page-btn--active" : ""
              }`}
            >
              {item}
            </button>
          ),
        )}

        <NavButton
          label={tp("nextPage", "Trang sau")}
          disabled={page >= totalPages}
          onClick={goNext}
        >
          &gt;
        </NavButton>
        <NavButton
          label={tp("lastPage", "Trang cuối")}
          disabled={page >= totalPages}
          onClick={goLast}
        >
          &gt;|
        </NavButton>
      </div>

      <label className="hr-table-pagination__page-size">
        <span className="hr-table-pagination__page-size-label">
          {tp("showingLabel", "HIỂN THỊ")}
        </span>
        <span className="hr-table-pagination__page-size-select-wrap">
          <select
            className="hr-table-pagination__page-size-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label={tp("rowsPerPage", "Số dòng mỗi trang")}
          >
            {HR_TABLE_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {tp("rowsOption", "{{count}} dòng", { count: size })}
              </option>
            ))}
          </select>
        </span>
      </label>
    </div>
  );
}

export default memo(HrTablePagination);
