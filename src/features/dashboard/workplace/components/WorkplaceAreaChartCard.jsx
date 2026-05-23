import React, { memo } from "react";
import { Chart } from "react-chartjs-2";
import { CHART_DRAG_MIME } from "@/utils/chartOrderStorage";

function WorkplaceAreaChartCard({
  area,
  combo,
  comboChartOptions,
  workplaceDragOverArea,
  setWorkplaceDragOverArea,
  handleWorkplaceAreaReorder,
  panelLabel,
  chartDragHandleTitle,
  areaLabel,
}) {
  return (
    <div
      className={`dashboard-chart-panel flex flex-col rounded-xl border border-slate-300/85 bg-slate-50 p-2 transition dark:border-slate-700/90 dark:bg-slate-900/90 ${
        workplaceDragOverArea === area
          ? "ring-2 ring-sky-400 ring-offset-1 dark:ring-offset-slate-950"
          : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setWorkplaceDragOverArea(area);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setWorkplaceDragOverArea((d) => (d === area ? null : d));
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData(CHART_DRAG_MIME);
        setWorkplaceDragOverArea(null);
        if (from) handleWorkplaceAreaReorder(from, area);
      }}
    >
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(CHART_DRAG_MIME, area);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => setWorkplaceDragOverArea(null)}
        className="mb-1 flex cursor-grab items-center justify-between gap-2 border-b border-slate-200/90 pb-1.5 active:cursor-grabbing dark:border-slate-700/80"
      >
        <span
          className="shrink-0 select-none text-slate-400"
          aria-hidden
          title={chartDragHandleTitle}
        >
          ⋮⋮
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-50">
          {areaLabel}
        </h3>
        <span className="shrink-0 rounded bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {panelLabel}
        </span>
      </div>
      <div className="relative h-[200px] w-full sm:h-[200px] xl:h-[250px]">
        <Chart type="bar" data={combo} options={comboChartOptions} />
      </div>
    </div>
  );
}

export default memo(WorkplaceAreaChartCard);
