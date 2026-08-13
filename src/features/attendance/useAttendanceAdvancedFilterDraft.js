import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const EMPTY_ADVANCED_FILTERS = {
  departmentListFilter: [],
  loaiPhepFilter: [],
  joinDateYearFilter: "",
  joinDateMonthFilter: "",
};

function cloneAdvancedFilters(source) {
  return {
    departmentListFilter: Array.isArray(source.departmentListFilter)
      ? [...source.departmentListFilter]
      : [],
    loaiPhepFilter: Array.isArray(source.loaiPhepFilter)
      ? [...source.loaiPhepFilter]
      : [],
    joinDateYearFilter: String(source.joinDateYearFilter || ""),
    joinDateMonthFilter: String(source.joinDateMonthFilter || ""),
  };
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function advancedFiltersEqual(a, b) {
  return (
    arraysEqual(a.departmentListFilter, b.departmentListFilter) &&
    arraysEqual(a.loaiPhepFilter, b.loaiPhepFilter) &&
    a.joinDateYearFilter === b.joinDateYearFilter &&
    a.joinDateMonthFilter === b.joinDateMonthFilter
  );
}

/**
 * Bộ lọc nâng cao: chỉnh trong modal (draft) — áp dụng lên bảng khi gọi applyDraft().
 */
export function useAttendanceAdvancedFilterDraft({
  filterOpen,
  departmentListFilter,
  loaiPhepFilter,
  joinDateYearFilter,
  joinDateMonthFilter,
  setDepartmentListFilter,
  setLoaiPhepFilter,
  setJoinDateYearFilter,
  setJoinDateMonthFilter,
}) {
  const [draft, setDraft] = useState(() =>
    cloneAdvancedFilters({
      departmentListFilter,
      loaiPhepFilter,
      joinDateYearFilter,
      joinDateMonthFilter,
    }),
  );
  const prevFilterOpenRef = useRef(false);

  const applied = useMemo(
    () =>
      cloneAdvancedFilters({
        departmentListFilter,
        loaiPhepFilter,
        joinDateYearFilter,
        joinDateMonthFilter,
      }),
    [
      departmentListFilter,
      loaiPhepFilter,
      joinDateYearFilter,
      joinDateMonthFilter,
    ],
  );

  useEffect(() => {
    const justOpened = filterOpen && !prevFilterOpenRef.current;
    prevFilterOpenRef.current = filterOpen;
    if (!justOpened) return;
    setDraft(applied);
  }, [filterOpen, applied]);

  const draftDirty = useMemo(
    () => !advancedFiltersEqual(draft, applied),
    [draft, applied],
  );

  const setDraftDepartmentListFilter = useCallback((updater) => {
    setDraft((prev) => ({
      ...prev,
      departmentListFilter:
        typeof updater === "function"
          ? updater(prev.departmentListFilter)
          : updater,
    }));
  }, []);

  const setDraftLoaiPhepFilter = useCallback((updater) => {
    setDraft((prev) => ({
      ...prev,
      loaiPhepFilter:
        typeof updater === "function" ? updater(prev.loaiPhepFilter) : updater,
    }));
  }, []);

  const setDraftJoinDateYearFilter = useCallback((value) => {
    setDraft((prev) => ({
      ...prev,
      joinDateYearFilter: value,
      joinDateMonthFilter: value ? prev.joinDateMonthFilter : "",
    }));
  }, []);

  const setDraftJoinDateMonthFilter = useCallback((value) => {
    setDraft((prev) => ({
      ...prev,
      joinDateMonthFilter: value,
    }));
  }, []);

  const applyDraft = useCallback(() => {
    setDepartmentListFilter([...draft.departmentListFilter]);
    setLoaiPhepFilter([...draft.loaiPhepFilter]);
    setJoinDateYearFilter(draft.joinDateYearFilter);
    setJoinDateMonthFilter(draft.joinDateMonthFilter);
  }, [
    draft,
    setDepartmentListFilter,
    setLoaiPhepFilter,
    setJoinDateYearFilter,
    setJoinDateMonthFilter,
  ]);

  const clearDraftAndApplied = useCallback(() => {
    setDraft({ ...EMPTY_ADVANCED_FILTERS });
    setDepartmentListFilter([]);
    setLoaiPhepFilter([]);
    setJoinDateYearFilter("");
    setJoinDateMonthFilter("");
  }, [
    setDepartmentListFilter,
    setLoaiPhepFilter,
    setJoinDateYearFilter,
    setJoinDateMonthFilter,
  ]);

  return {
    draftDepartmentListFilter: draft.departmentListFilter,
    setDraftDepartmentListFilter,
    draftLoaiPhepFilter: draft.loaiPhepFilter,
    setDraftLoaiPhepFilter,
    draftJoinDateYearFilter: draft.joinDateYearFilter,
    setDraftJoinDateYearFilter,
    draftJoinDateMonthFilter: draft.joinDateMonthFilter,
    setDraftJoinDateMonthFilter,
    applyDraft,
    clearDraftAndApplied,
    draftDirty,
  };
}
