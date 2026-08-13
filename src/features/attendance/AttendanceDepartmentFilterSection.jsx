import { memo, useCallback, useMemo } from "react";

function AttendanceDepartmentFilterSection({
  departments,
  departmentListFilter,
  setDepartmentListFilter,
  filterDepartmentSearch,
  setFilterDepartmentSearch,
  expandedSections,
  setExpandedSections,
  tl,
  t,
}) {
  const searchLower = filterDepartmentSearch.trim().toLowerCase();

  const visibleDepartments = useMemo(
    () =>
      departments.filter((dept) =>
        dept.toLowerCase().includes(searchLower),
      ),
    [departments, searchLower],
  );

  const selectedDepartmentSet = useMemo(
    () => new Set(departmentListFilter),
    [departmentListFilter],
  );

  const allVisibleSelected =
    visibleDepartments.length > 0 &&
    visibleDepartments.every((dept) => selectedDepartmentSet.has(dept));

  const toggleExpanded = useCallback(() => {
    setExpandedSections((prev) => ({
      ...prev,
      department: !prev.department,
    }));
  }, [setExpandedSections]);

  const toggleAllVisible = useCallback(
    (checked) => {
      setDepartmentListFilter((prev) => {
        if (checked) {
          const next = new Set(prev);
          for (const dept of visibleDepartments) next.add(dept);
          return [...next];
        }
        const hide = new Set(visibleDepartments);
        return prev.filter((dept) => !hide.has(dept));
      });
    },
    [setDepartmentListFilter, visibleDepartments],
  );

  const toggleDepartment = useCallback(
    (dept, checked) => {
      setDepartmentListFilter((prev) => {
        if (checked) {
          if (prev.includes(dept)) return prev;
          return [...prev, dept];
        }
        if (!prev.includes(dept)) return prev;
        return prev.filter((item) => item !== dept);
      });
    },
    [setDepartmentListFilter],
  );

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 rounded-lg font-semibold text-sm text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md border border-orange-200"
      >
        <span className="flex items-center gap-2">
          <span className="text-orange-500 text-base">🏢</span>
          <span>{tl("department", "Bộ phận")}</span>
        </span>
        <span className="text-orange-600 font-bold">
          {expandedSections.department ? "▼" : "▶"}
        </span>
      </button>
      {expandedSections.department ? (
        <div className="border-2 border-orange-100 rounded-lg mt-2 bg-gradient-to-b from-white to-orange-50/30 shadow-inner">
          <input
            type="text"
            value={filterDepartmentSearch}
            onChange={(e) => setFilterDepartmentSearch(e.target.value)}
            placeholder={t("attendanceList.searchDepartment")}
            className="w-full border-b border-orange-200 h-8 px-3 text-sm outline-none"
          />
          <div className="max-h-80 overflow-y-auto">
            {departments.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 italic">
                {tl("noData", "Không có dữ liệu")}
              </div>
            ) : (
              <>
                <label className="flex items-center px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm border-b-2 border-orange-200 bg-orange-50/50 font-semibold">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleAllVisible(e.target.checked)}
                    className="mr-2 w-4 h-4 cursor-pointer"
                  />
                  ✓ {tl("selectAll", "Chọn tất cả")}
                </label>
                {visibleDepartments.map((dept) => (
                  <label
                    key={dept}
                    className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDepartmentSet.has(dept)}
                      onChange={(e) =>
                        toggleDepartment(dept, e.target.checked)
                      }
                      className="mr-2 w-4 h-4 cursor-pointer"
                    />
                    {dept}
                  </label>
                ))}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default memo(AttendanceDepartmentFilterSection);
