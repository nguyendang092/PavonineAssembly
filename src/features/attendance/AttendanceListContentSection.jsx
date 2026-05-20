import React, { memo, lazy, Suspense, useCallback } from "react";
import AttendanceEmployeeFormModal from "./AttendanceEmployeeFormModal";
import AttendanceOffDaysModal from "./AttendanceOffDaysModal";
import AttendanceListTableSection from "./AttendanceListTableSection";
import AttendanceListSummary from "./AttendanceListSummary";
import { useAttendanceListContentBranch } from "./attendanceListBranchContexts";

const AttendanceComboChartModal = lazy(
  () => import("./AttendanceComboChartModal"),
);

/**
 * Modals + biểu đồ combo + bảng + tóm tắt.
 * Dữ liệu từ context (value memo theo nhánh content) để đổi menu toolbar / filter dropdown không re-render subtree này khi identity context không đổi.
 */
function AttendanceListContentSection() {
  const {
    showEmployeeModal,
    setShowEmployeeModal,
    setEmployeeModalRecord,
    employeeModalRecord,
    selectedDate,
    setSelectedDate,
    employees,
    user,
    userRole,
    userDepartments,
    attendanceRootPath,
    setAlert,
    isCompensatoryDay,
    offDaysModalOpen,
    setOffDaysModalOpen,
    refreshMonthOffDays,
    tl,
    t,
    showComboChartModal,
    setShowComboChartModal,
    comboDashboardGroup,
    setComboDashboardGroup,
    comboProductionDeptCatalog,
    comboProductionDeptOrder,
    persistComboProductionDeptOrder,
    getComboProductionDeptChartRank,
    comboDashboardStats,
    comboChartData,
    comboChartBodyReady,
    comboChartRowsVisible,
    comboChartCardsVisibleCount,
    comboChartDataOrdered,
    comboStatDetailKey,
    setComboStatDetailKey,
    comboStatLabelByKey,
    comboStatEmployeesByKey,
    columnPlan,
    forceVirtualizedRows,
    deferredFilteredEmployees,
    attendanceGridTemplateColumns,
    showRowModalActions,
    canDeleteDayRecord,
    canEditEmployee,
    handleEdit,
    handleDelete,
    isOffDay,
    isHolidayDay,
    displayLocale,
  } = useAttendanceListContentBranch();

  const closeEmployeeModal = useCallback(() => {
    setShowEmployeeModal(false);
    setEmployeeModalRecord(null);
  }, [setShowEmployeeModal, setEmployeeModalRecord]);

  const closeOffDaysModal = useCallback(() => {
    setOffDaysModalOpen(false);
  }, [setOffDaysModalOpen]);

  const closeComboChartModal = useCallback(() => {
    setShowComboChartModal(false);
  }, [setShowComboChartModal]);

  return (
    <>
      <AttendanceEmployeeFormModal
        open={showEmployeeModal}
        onClose={closeEmployeeModal}
        initialRecord={employeeModalRecord}
        selectedDate={selectedDate}
        employees={employees}
        user={user}
        userRole={userRole}
        userDepartments={userDepartments}
        attendanceRootPath={attendanceRootPath}
        onAlert={setAlert}
        dayIsCompensatory={isCompensatoryDay}
      />

      <AttendanceOffDaysModal
        open={offDaysModalOpen}
        onClose={closeOffDaysModal}
        selectedDate={selectedDate}
        user={user}
        tl={tl}
        onSaved={refreshMonthOffDays}
        attendanceRootPath={attendanceRootPath}
      />

      {showComboChartModal ? (
        <Suspense
          fallback={
            <div
              className="fixed inset-0 flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4"
              style={{ zIndex: "var(--z-modal-backdrop, 1200)" }}
            >
              <p className="rounded-lg bg-slate-900/80 px-4 py-2 text-sm text-white">
                {tl("comboChartLoading", "Đang tải biểu đồ theo bộ phận…")}
              </p>
            </div>
          }
        >
          <AttendanceComboChartModal
            open
            onClose={closeComboChartModal}
            comboDashboardGroup={comboDashboardGroup}
            setComboDashboardGroup={setComboDashboardGroup}
            comboProductionDeptCatalog={comboProductionDeptCatalog}
            comboProductionDeptOrder={comboProductionDeptOrder}
            onPersistComboProductionDeptOrder={persistComboProductionDeptOrder}
            getComboProductionDeptChartRank={getComboProductionDeptChartRank}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            tl={tl}
            t={t}
            comboDashboardStats={comboDashboardStats}
            comboChartData={comboChartData}
            comboChartBodyReady={comboChartBodyReady}
            comboChartRowsVisible={comboChartRowsVisible}
            comboChartCardsVisibleCount={comboChartCardsVisibleCount}
            comboChartDataOrdered={comboChartDataOrdered}
            comboStatDetailKey={comboStatDetailKey}
            setComboStatDetailKey={setComboStatDetailKey}
            comboStatLabelByKey={comboStatLabelByKey}
            comboStatEmployeesByKey={comboStatEmployeesByKey}
          />
        </Suspense>
      ) : null}

      <AttendanceListTableSection
        columnPlan={columnPlan}
        forceVirtualizedRows={forceVirtualizedRows}
        deferredFilteredEmployees={deferredFilteredEmployees}
        attendanceGridTemplateColumns={attendanceGridTemplateColumns}
        showRowModalActions={showRowModalActions}
        canDeleteDayRecord={canDeleteDayRecord}
        tl={tl}
        user={user}
        canEditEmployee={canEditEmployee}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isOffDay={isOffDay}
        isHolidayDay={isHolidayDay}
        isCompensatoryDay={isCompensatoryDay}
        t={t}
      />

      <AttendanceListSummary
        deferredFilteredEmployees={deferredFilteredEmployees}
        displayLocale={displayLocale}
        selectedDate={selectedDate}
        tl={tl}
      />
    </>
  );
}

export default memo(AttendanceListContentSection);
