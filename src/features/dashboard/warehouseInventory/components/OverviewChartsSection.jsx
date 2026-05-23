import React, { memo } from "react";
import { Doughnut, Bar } from "react-chartjs-2";
import { useOverviewChartOptions } from "../hooks/useOverviewChartOptions";

function OverviewChartsSection(props) {
  const {
    tl,
    statusChart,
    whBar,
    whBarChartHeightPx,
    overviewTopCodeDiffChart,
    overviewTopCodeAmountChart,
    overviewTopCodeAmountChartHeightPx,
  } = props;

  const {
    statusDoughnutOptions,
    whBarOptions,
    topCodeDiffOptions,
    topCodeAmountOptions,
  } = useOverviewChartOptions({
    statusChart,
    whBar,
    overviewTopCodeDiffChart,
    overviewTopCodeAmountChart,
  });
  return (
    <>
      <div className="mt-6 space-y-4 border-t border-indigo-200/60 pt-5 dark:border-indigo-900/70">
        <div className="flex flex-col gap-2 border-l-4 border-indigo-500 pl-4 sm:flex-row sm:items-end sm:justify-between dark:border-indigo-400">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
              {tl("overviewVisualBadge", "Nhận định báo cáo")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-4">
            <div className="dashboard-chart-panel rounded-2xl border-2 border-indigo-300/55 bg-gradient-to-br from-white via-indigo-50/40 to-white p-4 dark:border-indigo-800 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900">
              <h4 className="text-xs font-black uppercase tracking-wide text-indigo-950 dark:text-indigo-100">
                {tl("chartStatusTitle", "STATUS별 (행 수)")}
              </h4>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-600 dark:text-slate-400">
                {tl(
                  "overviewStatusHint",
                  "Tỉ lệ hàng theo trạng thái ERP — trạng thái lệch thường nên giải thích trước khi kết luận tồn an toàn.",
                )}
              </p>
              <div className="mt-3">
                <div className="wah-inv-chart-inner h-[228px]">
                  {statusChart.labels.length > 0 ? (
                    <Doughnut
                      data={statusChart}
                      options={statusDoughnutOptions}
                    />
                  ) : (
                    <p className="flex h-full items-center justify-center text-center text-xs font-medium text-slate-500">
                      {tl(
                        "overviewChartEmpty",
                        "STATUS 데이터가 부족합니다.",
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="dashboard-chart-panel rounded-xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-600 dark:bg-slate-900/85">
              <h4 className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">
                {tl("chartWhTitle", "상위 창고 - 재고금액(실사)")}
              </h4>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                {tl(
                  "overviewWhHint",
                  "Kho nào đang «ôm» nhiều giá trị tồn thực tế — ưu tiên kiểm soát khi có chênh lệch.",
                )}
              </p>
              <div className="mt-3">
                <div
                  className="wah-inv-chart-inner wah-inv-wh-bar-minimal"
                  style={{ height: whBarChartHeightPx }}
                >
                  {whBar.labels.length > 0 ? (
                    <Bar data={whBar} options={whBarOptions} />
                  ) : (
                    <p className="flex h-full items-center justify-center text-center text-xs font-medium text-slate-500">
                      {tl(
                        "overviewWhChartEmpty",
                        "창고/금액 데이터가 부족합니다.",
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:col-span-8">
            <div className="dashboard-chart-panel rounded-2xl border-2 border-indigo-300/55 bg-gradient-to-br from-white via-rose-50/25 to-white p-4 dark:border-indigo-800 dark:from-slate-900 dark:via-rose-950/25 dark:to-slate-900">
              <h4 className="text-xs font-black uppercase tracking-wide text-indigo-950 dark:text-indigo-100">
                {tl(
                  "overviewTopCodeChartTitle",
                  "TOP MÃ CHÊNH LỆCH THEO GAP",
                )}
              </h4>
              <div className="mt-3">
                <div className="wah-inv-chart-inner h-[268px]">
                  <Bar
                    data={overviewTopCodeDiffChart}
                    options={topCodeDiffOptions}
                  />
                </div>
              </div>
            </div>
            <div className="dashboard-chart-panel relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/55 p-4 shadow-[0_18px_48px_-32px_rgba(76,29,149,0.4)] ring-1 ring-indigo-100/50 dark:border-indigo-800/60 dark:from-slate-900 dark:via-slate-900 dark:to-violet-950/30 dark:shadow-[0_18px_48px_-30px_rgba(124,58,237,0.55)] dark:ring-indigo-900/40">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br from-indigo-300/40 via-violet-300/30 to-transparent blur-3xl dark:from-indigo-500/30 dark:via-violet-500/20"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-gradient-to-br from-rose-200/35 via-rose-100/20 to-transparent blur-3xl dark:from-rose-500/25 dark:via-rose-500/10"
              />
              <h4 className="relative bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700 bg-clip-text text-xs font-black uppercase tracking-[0.14em] text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-fuchsia-300">
                {tl(
                  "overviewTopCodeAmountChartTitle",
                  "TOP MÃ CHÊNH LỆCH TIỀN THEO THÁNG",
                )}
              </h4>
              <div className="relative mt-3 rounded-xl border border-white/70 bg-white/70 p-3 shadow-inner backdrop-blur-[1px] dark:border-slate-800/80 dark:bg-slate-950/40">
                <div
                  className="wah-inv-chart-inner wah-inv-wh-bar-minimal"
                  style={{ height: overviewTopCodeAmountChartHeightPx }}
                >
                  {overviewTopCodeAmountChart.labels.length > 0 ? (
                    <Bar
                      data={overviewTopCodeAmountChart}
                      options={topCodeAmountOptions}
                    />
                  ) : (
                    <p className="flex h-full items-center justify-center text-center text-xs font-medium text-slate-500">
                      {tl(
                        "overviewTopCodeAmountChartEmpty",
                        "Chưa có dữ liệu tiền chênh lệch để hiển thị.",
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(OverviewChartsSection);
