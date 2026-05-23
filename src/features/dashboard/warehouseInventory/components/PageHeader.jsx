import React from "react";
import { FiUpload, FiRefreshCw } from "react-icons/fi";
export default function PageHeader({
  tl,
  rows,
  loading,
  error,
  handleFile,
  clearData,
}) {
  return (
    <>
<header className="dashboard-no-print mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
  <div>
    <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl uppercase">
      {tl("pageTitle", "창고 재고 보고서")}
    </h1>
  </div>
  <div className="flex flex-wrap items-center gap-2">
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-sky-500">
      <FiUpload className="text-lg" aria-hidden />
      {tl("uploadBtn", "엑셀 파일 선택")}
      <input
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFile}
        disabled={loading}
      />
    </label>
    {rows.length > 0 ? (
      <>
        <button
          type="button"
          onClick={clearData}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <FiRefreshCw /> {tl("clearBtn", "데이터 초기화")}
        </button>
      </>
    ) : null}
  </div>
</header>

{error ? (
  <div
    className="dashboard-no-print mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100"
    role="alert"
  >
    {error}
  </div>
) : null}

{loading ? (
  <p className="dashboard-no-print text-sm font-medium text-slate-600 dark:text-slate-400">
    {tl("loading", "파일을 읽는 중…")}
  </p>
) : null}

{rows.length === 0 && !loading ? (
  <div className="dashboard-no-print rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-10 text-center dark:border-slate-600 dark:bg-slate-900/40">
    <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
      {tl("emptyTitle", "Chưa có dữ liệu")}
    </p>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
      {tl(
        "emptyHint",
        "ERP/엑셀에서 재고 보고서를 내보낸 뒤 컬럼 헤더(THỰC TẾ, STATUS, 창고/창고코드, 재고금액…)를 유지하고 «엑셀 파일 선택»을 눌러주세요.",
      )}
    </p>
  </div>
) : null}
    </>
  );
}
