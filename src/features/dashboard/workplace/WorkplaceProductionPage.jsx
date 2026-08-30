/**
 * Shell trang sản lượng workplace — hook + layout; JSX chi tiết trong components/.
 */
import React, { memo, useMemo } from "react";
import WorkplaceProductionDetailModal from "./components/WorkplaceProductionDetailModal";
import { useWorkplaceProductionDashboard } from "./hooks/useWorkplaceProductionDashboard";
import { useWorkplaceDetailModalLayoutGuard } from "./hooks/useWorkplaceDetailModalLayoutGuard";
import { DEFAULT_WORKPLACE_PRODUCTION_PATHS } from "./workplaceProductionPaths";
import WorkplaceProductionSidebar from "./components/WorkplaceProductionSidebar";
import WorkplaceProductionMainPanel from "./components/WorkplaceProductionMainPanel";

const WorkplaceProductionShell = memo(function WorkplaceProductionShell({
  sidebarProps,
  mainPanelProps,
}) {
  return (
    <div className="wpd-viewport workplace-production-viewport">
      <WorkplaceProductionSidebar {...sidebarProps} />
      <WorkplaceProductionMainPanel {...mainPanelProps} />
    </div>
  );
});

export default function WorkplaceProductionPage({
  pathsConfig = DEFAULT_WORKPLACE_PRODUCTION_PATHS,
}) {
  const {
    t,
    user,
    workplaceDragOverArea,
    setWorkplaceDragOverArea,
    isModalOpen,
    modalArea,
    closeDetailModal,
    weekData,
    selectedWeek,
    setSelectedWeek,
    selectedYear,
    setSelectedYear,
    chartData,
    isReadingTotalFile,
    isReadingDetailFile,
    isUploadingTotal,
    isUploadingDetail,
    isUploadingNgFaulty,
    totalFileInputRef,
    detailFileInputRef,
    ngFaultyFileInputRef,
    handleFileUpload,
    handleDetailUpload,
    handleNgFaultyFileUpload,
    openDetailModal,
    dashboardStats,
    weekMeta,
    areaComboDataByArea,
    areaMetricsByArea,
    comboChartOptions,
    chartAreasOrdered,
    handleWorkplaceAreaReorder,
  } = useWorkplaceProductionDashboard(pathsConfig);

  useWorkplaceDetailModalLayoutGuard(isModalOpen);

  const hasChartData = Boolean(chartData?.labels?.length);

  const sidebarProps = useMemo(
    () => ({
      t,
      user,
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
      totalFileInputRef,
      detailFileInputRef,
      ngFaultyFileInputRef,
      handleFileUpload,
      handleDetailUpload,
      handleNgFaultyFileUpload,
      hasChartData,
    }),
    [
      t,
      user,
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
      totalFileInputRef,
      detailFileInputRef,
      ngFaultyFileInputRef,
      handleFileUpload,
      handleDetailUpload,
      handleNgFaultyFileUpload,
      hasChartData,
    ],
  );

  const mainPanelProps = useMemo(
    () => ({
      t,
      weekMeta,
      dashboardStats,
      chartData,
      chartAreasOrdered,
      openDetailModal,
      areaComboDataByArea,
      areaMetricsByArea,
      comboChartOptions,
      workplaceDragOverArea,
      setWorkplaceDragOverArea,
      handleWorkplaceAreaReorder,
    }),
    [
      t,
      weekMeta,
      dashboardStats,
      chartData,
      chartAreasOrdered,
      openDetailModal,
      areaComboDataByArea,
      areaMetricsByArea,
      comboChartOptions,
      workplaceDragOverArea,
      setWorkplaceDragOverArea,
      handleWorkplaceAreaReorder,
    ],
  );

  return (
    <>
      <WorkplaceProductionShell
        sidebarProps={sidebarProps}
        mainPanelProps={mainPanelProps}
      />
      <WorkplaceProductionDetailModal
        isOpen={isModalOpen}
        onClose={closeDetailModal}
        area={modalArea}
        detailsRoot={pathsConfig.detailsRoot}
        selectedYear={selectedYear}
        selectedWeek={selectedWeek}
      />
    </>
  );
}
