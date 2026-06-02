/**
 * Shell trang sản lượng workplace — hook + layout; JSX chi tiết trong components/.
 */
import React, { memo, useMemo } from "react";
import DetailedModal from "@/components/modals/DetailedModal";
import { useWorkplaceProductionDashboard } from "./hooks/useWorkplaceProductionDashboard";
import WorkplaceProductionSidebar from "./components/WorkplaceProductionSidebar";
import WorkplaceProductionMainPanel from "./components/WorkplaceProductionMainPanel";
import WorkplaceProductionDataTableModal from "./components/WorkplaceProductionDataTableModal";

const WorkplaceProductionShell = memo(function WorkplaceProductionShell({
  sidebarProps,
  mainPanelProps,
  dataTableModalProps,
  isModalOpen,
  closeDetailModal,
  modalArea,
}) {
  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/60">
      <WorkplaceProductionSidebar {...sidebarProps} />
      <WorkplaceProductionMainPanel {...mainPanelProps} />
      <WorkplaceProductionDataTableModal {...dataTableModalProps} />
      <DetailedModal
        isOpen={isModalOpen}
        onClose={closeDetailModal}
        area={modalArea}
      />
    </div>
  );
});

export default function WorkplaceProductionPage() {
  const {
    t,
    user,
    workplaceDragOverArea,
    setWorkplaceDragOverArea,
    isModalOpen,
    modalArea,
    closeDetailModal,
    selectedArea,
    setSelectedArea,
    weekData,
    selectedWeek,
    setSelectedWeek,
    selectedYear,
    setSelectedYear,
    chartData,
    dataMap,
    tableView,
    setTableView,
    dataTableOpen,
    setDataTableOpen,
    sidebarOpen,
    setSidebarOpen,
    isReadingTotalFile,
    isReadingDetailFile,
    isUploadingTotal,
    isUploadingDetail,
    totalFileInputRef,
    detailFileInputRef,
    pendingNgFaultyFile,
    setPendingNgFaultyFile,
    isUploadingNgFaulty,
    handleFileUpload,
    handleDetailUpload,
    handleDetailUploadToFirebase,
    openDetailModal,
    exportToExcel,
    dashboardStats,
    weekMeta,
    areaComboDataByArea,
    comboChartOptions,
    chartAreasOrdered,
    handleWorkplaceAreaReorder,
    handleNgFaultyUpload,
    handleTotalUploadClick,
    getCurrentWeekNumber,
    detailData,
  } = useWorkplaceProductionDashboard();

  const sidebarProps = useMemo(
    () => ({
      t,
      user,
      sidebarOpen,
      setSidebarOpen,
      selectedYear,
      setSelectedYear,
      selectedWeek,
      setSelectedWeek,
      weekData,
      isReadingTotalFile,
      isUploadingTotal,
      isReadingDetailFile,
      isUploadingDetail,
      isUploadingNgFaulty,
      pendingNgFaultyFile,
      setPendingNgFaultyFile,
      totalFileInputRef,
      detailFileInputRef,
      handleFileUpload,
      handleDetailUpload,
      handleDetailUploadToFirebase,
      handleTotalUploadClick,
      handleNgFaultyUpload,
      detailData,
    }),
    [
      t,
      user,
      sidebarOpen,
      setSidebarOpen,
      selectedYear,
      setSelectedYear,
      selectedWeek,
      setSelectedWeek,
      weekData,
      isReadingTotalFile,
      isUploadingTotal,
      isReadingDetailFile,
      isUploadingDetail,
      isUploadingNgFaulty,
      pendingNgFaultyFile,
      setPendingNgFaultyFile,
      totalFileInputRef,
      detailFileInputRef,
      handleFileUpload,
      handleDetailUpload,
      handleDetailUploadToFirebase,
      handleTotalUploadClick,
      handleNgFaultyUpload,
      detailData,
    ],
  );

  const mainPanelProps = useMemo(
    () => ({
      t,
      sidebarOpen,
      weekMeta,
      dashboardStats,
      chartData,
      setDataTableOpen,
      chartAreasOrdered,
      areaComboDataByArea,
      comboChartOptions,
      workplaceDragOverArea,
      setWorkplaceDragOverArea,
      handleWorkplaceAreaReorder,
    }),
    [
      t,
      sidebarOpen,
      weekMeta,
      dashboardStats,
      chartData,
      setDataTableOpen,
      chartAreasOrdered,
      areaComboDataByArea,
      comboChartOptions,
      workplaceDragOverArea,
      setWorkplaceDragOverArea,
      handleWorkplaceAreaReorder,
    ],
  );

  const dataTableModalProps = useMemo(
    () => ({
      t,
      dataTableOpen,
      setDataTableOpen,
      tableView,
      setTableView,
      selectedArea,
      setSelectedArea,
      dataMap,
      chartData,
      openDetailModal,
      exportToExcel,
      getCurrentWeekNumber,
    }),
    [
      t,
      dataTableOpen,
      setDataTableOpen,
      tableView,
      setTableView,
      selectedArea,
      setSelectedArea,
      dataMap,
      chartData,
      openDetailModal,
      exportToExcel,
      getCurrentWeekNumber,
    ],
  );

                          return (
    <WorkplaceProductionShell
      sidebarProps={sidebarProps}
      mainPanelProps={mainPanelProps}
      dataTableModalProps={dataTableModalProps}
      isModalOpen={isModalOpen}
      closeDetailModal={closeDetailModal}
      modalArea={modalArea}
    />
  );
}
