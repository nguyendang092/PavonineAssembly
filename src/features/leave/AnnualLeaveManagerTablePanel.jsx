import { memo, useMemo } from "react";
import HrTablePagination from "@/components/ui/HrTablePagination";
import { useHrTablePagination } from "@/hooks/useHrTablePagination";
import AnnualLeaveManagerTableRow from "./AnnualLeaveManagerTableRow";
import {
  ANNUAL_LEAVE_TABLE_HEADER_GRADIENT,
  annualLeaveStickyColClass,
  annualLeaveTableThClass,
} from "./annualLeaveTableStyles";
import { filterAnnualLeaveManagerRows } from "./annualLeaveManagerFilter";

const EMPTY_MONTH_VALUES = Object.freeze(Array.from({ length: 12 }, () => 0));

function AnnualLeaveManagerTablePanel({
  rows,
  monthlyByEmpKey,
  search,
  deptFilter,
  year,
  monthColumnLabels,
  detailThroughDateKey,
  filterPending = false,
  t,
}) {
  const filteredRows = useMemo(
    () => filterAnnualLeaveManagerRows(rows, { search, deptFilter }),
    [rows, search, deptFilter],
  );

  const tablePagination = useHrTablePagination(filteredRows, {
    resetDeps: [year, search, deptFilter],
  });

  return (
    <>
      <div
        className={`annual-leave-table-compact min-h-0 w-full max-w-none flex-1 rounded-md bg-white shadow-sm transition-opacity duration-150 dark:bg-slate-900 dark:ring-1 dark:ring-slate-700${
          filterPending ? " opacity-80" : ""
        }`}
      >
        <div className="annual-leave-table-scroll w-full min-w-0 max-w-full">
          <table className="annual-leave-table w-max min-w-full max-w-none border-separate border-spacing-0">
            <colgroup>
              <col className="annual-leave-col-no annual-leave-sticky-col annual-leave-sticky-col-0" />
              <col className="annual-leave-col-code annual-leave-sticky-col annual-leave-sticky-col-1" />
              <col className="annual-leave-col-code annual-leave-sticky-col annual-leave-sticky-col-2" />
              <col className="annual-leave-name annual-leave-sticky-col annual-leave-sticky-col-3" />
              <col className="annual-leave-sticky-col annual-leave-sticky-col-4" />
              <col className="annual-leave-sticky-col annual-leave-sticky-col-5" />
              <col className="annual-leave-sticky-col annual-leave-sticky-col-6" />
              <col className="annual-leave-sticky-col annual-leave-sticky-col-7" />
              <col className="annual-leave-sticky-col annual-leave-sticky-col-8" />
              <col className="annual-leave-sticky-col annual-leave-sticky-col-9" />
              {monthColumnLabels.map((label) => (
                <col key={label} className="annual-leave-col-month" />
              ))}
              <col className="annual-leave-col-detail" />
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr style={{ background: ANNUAL_LEAVE_TABLE_HEADER_GRADIENT }}>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(0, { header: true })}`}
                >
                  No
                </th>
                <th colSpan={2} className={annualLeaveTableThClass}>
                  EMPL. CODE
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(3, { header: true })}`}
                >
                  Full Name
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(4, { header: true })}`}
                >
                  Date of Birth
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(5, { header: true })}`}
                >
                  SUB-DEPARTMENT
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(6, { header: true })}`}
                >
                  START WORKING DATE
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(7, { header: true })}`}
                >
                  ANNUAL LEAVE IN CURRENT YEAR
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(8, { header: true })}`}
                >
                  ANNUAL LEAVE USED
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(9, { header: true })}`}
                >
                  BALANCE
                </th>
                {monthColumnLabels.map((label) => (
                  <th
                    key={label}
                    rowSpan={2}
                    className={`${annualLeaveTableThClass} min-w-[4.25rem] whitespace-nowrap`}
                  >
                    {label}
                  </th>
                ))}
                <th rowSpan={2} className={annualLeaveTableThClass}>
                  {t("annualLeave.detailColumn", {
                    defaultValue: "DETAIL",
                  })}
                </th>
              </tr>
              <tr style={{ background: ANNUAL_LEAVE_TABLE_HEADER_GRADIENT }}>
                <th
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(1, { header: true })}`}
                >
                  MNV
                </th>
                <th
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(2, { header: true })}`}
                >
                  MVT
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={23}
                    className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    {t("annualLeave.noData")}
                  </td>
                </tr>
              ) : (
                tablePagination.pagedItems.map((row, localIdx) => (
                  <AnnualLeaveManagerTableRow
                    key={row.id}
                    row={row}
                    index={tablePagination.rowIndexOffset + localIdx}
                    year={year}
                    throughDateKey={detailThroughDateKey}
                    monthValues={monthlyByEmpKey[row.id] ?? EMPTY_MONTH_VALUES}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="annual-leave-pagination shrink-0">
        <HrTablePagination
          rangeStart={tablePagination.rangeStart}
          rangeEnd={tablePagination.rangeEnd}
          totalItems={tablePagination.totalItems}
          page={tablePagination.page}
          totalPages={tablePagination.totalPages}
          pageNumbers={tablePagination.pageNumbers}
          pageSize={tablePagination.pageSize}
          onPageChange={tablePagination.setPage}
          onPageSizeChange={tablePagination.setPageSize}
        />
      </div>
    </>
  );
}

function areTablePanelPropsEqual(prev, next) {
  return (
    prev.rows === next.rows &&
    prev.monthlyByEmpKey === next.monthlyByEmpKey &&
    prev.search === next.search &&
    prev.deptFilter === next.deptFilter &&
    prev.year === next.year &&
    prev.monthColumnLabels === next.monthColumnLabels &&
    prev.detailThroughDateKey === next.detailThroughDateKey &&
    prev.filterPending === next.filterPending &&
    prev.t === next.t
  );
}

export default memo(AnnualLeaveManagerTablePanel, areTablePanelPropsEqual);
