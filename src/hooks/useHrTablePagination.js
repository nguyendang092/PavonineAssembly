import { useEffect, useMemo, useState } from "react";

export const HR_TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export const HR_TABLE_DEFAULT_PAGE_SIZE = 25;

/** Sinh dãy số trang + «…» cho thanh phân trang HR. */
export function buildHrTablePageNumbers(currentPage, totalPages) {
  const total = Math.max(1, Number(totalPages) || 1);
  const current = Math.min(Math.max(1, Number(currentPage) || 1), total);
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

/**
 * Phân trang client-side cho bảng HR (Điểm danh / Giờ công / Phép năm).
 * @param {unknown[]} items — danh sách đã lọc
 * @param {{ resetDeps?: unknown[], defaultPageSize?: number }} [options]
 */
export function useHrTablePagination(items, options = {}) {
  const { resetDeps = [], defaultPageSize = HR_TABLE_DEFAULT_PAGE_SIZE } =
    options;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalItems = items?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);

  useEffect(() => {
    setPage(1);
  }, [pageSize, ...resetDeps]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedItems = useMemo(() => {
    if (!items?.length) return [];
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);
  const rowIndexOffset = totalItems === 0 ? 0 : (page - 1) * pageSize;
  const pageNumbers = useMemo(
    () => buildHrTablePageNumbers(page, totalPages),
    [page, totalPages],
  );

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,
    pagedItems,
    rangeStart,
    rangeEnd,
    rowIndexOffset,
    pageNumbers,
  };
}
