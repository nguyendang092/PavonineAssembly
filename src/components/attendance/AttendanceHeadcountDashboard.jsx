import React, { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import * as XLSX from "xlsx";

const DEPARTMENT_CONFIG = [
  {
    key: "extrusion",
    label: "압출",
    aliases: ["extrusion factory", "압출"],
  },
  {
    key: "press",
    label: "PRESS",
    aliases: ["press"],
  },
  {
    key: "precision",
    label: "정밀가공",
    aliases: ["mc"],
  },
  {
    key: "hairline",
    label: "헤어라인",
    aliases: ["hairline", "hair line", "헤어라인"],
  },
  {
    key: "anodizing",
    label: "아노다이징",
    aliases: ["anodizing", "ano", "아노다이징"],
  },
  {
    key: "assembly",
    label: "조립 ASSY",
    aliases: ["tu", "pmf", "ohf", "komsa", "flip", "deco", "assy-1"],
  },
];

const ABSENT_CODES = new Set([
  "PN",
  "PN1/2",
  "1/2 PN",
  "KL",
  "KP",
  "TS",
  "PO",
  "TN",
  "PC",
  "PT",
  "DS",
]);

const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const isMaternityLeave = (emp) => {
  const gioVao = normalizeText(emp?.gioVao)
    .replace(/["'`’‘.,;:!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return gioVao === "thai sản" || gioVao === "thai san";
};

const isAbsentEmployee = (emp) => {
  const chamCong = normalizeText(emp?.chamCong).toUpperCase();
  const gioVao = String(emp?.gioVao || "").trim();

  if (ABSENT_CODES.has(chamCong)) return true;
  if (!gioVao) return true;
  if (ABSENT_CODES.has(gioVao.toUpperCase())) return true;
  if (!TIME_REGEX.test(gioVao)) return true;

  return false;
};

const isNightShift = (emp) => {
  const caLamViec = normalizeText(emp?.caLamViec);
  if (caLamViec.includes("đêm") || caLamViec.includes("dem")) return true;
  if (caLamViec.includes("night")) return true;

  return false;
};

const buildStats = (records) => {
  const total = records.length;
  const absent = records.filter(isAbsentEmployee).length;
  const present = total - absent;
  const absentRate = total > 0 ? `${Math.round((absent / total) * 100)}%` : "-";

  return {
    total,
    absent,
    present,
    absentRate,
  };
};

const splitShiftStats = (records) => {
  const day = records.filter((emp) => !isNightShift(emp));
  const night = records.filter((emp) => isNightShift(emp));

  return {
    day: buildStats(day),
    night: buildStats(night),
  };
};

const filterByAliases = (employees, aliases) => {
  const aliasSet = new Set(aliases.map((a) => normalizeText(a)));

  return employees.filter((emp) => aliasSet.has(normalizeText(emp?.boPhan)));
};

const SummaryRow = ({
  processLabel,
  required,
  current,
  shortage,
  category,
  dayStats,
  nightStats,
  isMuted,
  editableRequired,
  onRequiredCommit,
  editableNotes,
  dayNote,
  nightNote,
  onDayNoteCommit,
  onNightNoteCommit,
  editableHeadcount,
  overrideDayCount,
  overrideNightCount,
  onDayCountCommit,
  onNightCountCommit,
  processRowSpan,
  hideProcessCell,
}) => {
  const textClass = isMuted ? "text-slate-400" : "text-slate-800";
  const numberClass = isMuted ? "text-slate-400" : "text-slate-900";
  const [draftRequired, setDraftRequired] = useState(
    required === "" || required === null || required === undefined
      ? ""
      : String(required),
  );
  const [draftDayNote, setDraftDayNote] = useState(dayNote || "");
  const [draftNightNote, setDraftNightNote] = useState(nightNote || "");
  const [draftDayCount, setDraftDayCount] = useState(overrideDayCount ?? "");
  const [draftNightCount, setDraftNightCount] = useState(
    overrideNightCount ?? "",
  );

  useEffect(() => {
    setDraftRequired(
      required === "" || required === null || required === undefined
        ? ""
        : String(required),
    );
  }, [required]);

  useEffect(() => {
    setDraftDayNote(dayNote || "");
  }, [dayNote]);

  useEffect(() => {
    setDraftNightNote(nightNote || "");
  }, [nightNote]);

  useEffect(() => {
    setDraftDayCount(overrideDayCount ?? "");
  }, [overrideDayCount]);

  useEffect(() => {
    setDraftNightCount(overrideNightCount ?? "");
  }, [overrideNightCount]);

  const commitRequired = () => {
    if (!editableRequired || !onRequiredCommit) return;
    const parsed = Number(draftRequired);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraftRequired(String(required || 0));
      return;
    }
    onRequiredCommit(Math.round(parsed));
  };

  const commitDayNote = () => {
    if (!editableNotes || !onDayNoteCommit) return;
    onDayNoteCommit(draftDayNote);
  };

  const commitNightNote = () => {
    if (!editableNotes || !onNightNoteCommit) return;
    onNightNoteCommit(draftNightNote);
  };

  const commitDayCount = () => {
    if (!editableHeadcount || !onDayCountCommit) return;
    if (draftDayCount === "") {
      onDayCountCommit("");
      return;
    }
    const parsed = Number(draftDayCount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraftDayCount(overrideDayCount ?? "");
      return;
    }
    onDayCountCommit(Math.round(parsed));
  };

  const commitNightCount = () => {
    if (!editableHeadcount || !onNightCountCommit) return;
    if (draftNightCount === "") {
      onNightCountCommit("");
      return;
    }
    const parsed = Number(draftNightCount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraftNightCount(overrideNightCount ?? "");
      return;
    }
    onNightCountCommit(Math.round(parsed));
  };

  const renderNoteCell = (value, setValue, onCommit, fallbackNote) => {
    if (!editableNotes) {
      return fallbackNote || "-";
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        placeholder="비고를 입력하세요"
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
    );
  };

  return (
    <tr
      className={
        isMuted ? "bg-slate-50" : "bg-white hover:bg-slate-50 transition-colors"
      }
    >
      {!hideProcessCell && (
        <td
          rowSpan={processRowSpan || 1}
          className={`px-4 py-3 border border-slate-200 font-bold text-slate-900 ${processRowSpan > 1 ? "align-middle" : ""}`}
        >
          {processLabel}
        </td>
      )}
      <td className="px-4 py-3 border border-slate-200 text-center font-bold bg-blue-50 text-slate-900">
        {editableRequired ? (
          <input
            type="number"
            min="0"
            value={draftRequired}
            onChange={(e) => setDraftRequired(e.target.value)}
            onBlur={commitRequired}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="w-20 text-center rounded border border-blue-300 bg-white px-2 py-1"
          />
        ) : (
          required
        )}
      </td>
      <td
        className={`px-4 py-3 border border-slate-200 text-center font-bold ${numberClass}`}
      >
        {current}
      </td>
      <td
        className={`px-4 py-3 border border-slate-200 text-center font-bold ${
          shortage < 0
            ? "text-red-600 bg-red-50"
            : "text-emerald-600 bg-emerald-50"
        }`}
      >
        {shortage}
      </td>
      <td
        className={`px-4 py-3 border border-slate-200 font-bold text-slate-700`}
      >
        {category}
      </td>

      <td
        className={`px-4 py-3 border border-slate-200 text-center font-bold ${numberClass}`}
      >
        {editableHeadcount ? (
          <input
            type="number"
            min="0"
            value={draftDayCount}
            onChange={(e) => setDraftDayCount(e.target.value)}
            onBlur={commitDayCount}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder={String(dayStats.total)}
            className="w-16 text-center rounded border border-slate-300 bg-white px-2 py-1"
          />
        ) : overrideDayCount != null && overrideDayCount !== "" ? (
          Number(overrideDayCount)
        ) : (
          dayStats.total
        )}
      </td>
      <td className="px-4 py-3 border border-slate-200 text-center font-bold text-red-600">
        {dayStats.absent}
      </td>
      <td
        className={`px-4 py-3 border border-slate-200 text-center font-bold ${numberClass}`}
      >
        {dayStats.present}
      </td>
      <td className="px-4 py-3 border border-slate-200 text-center font-bold text-red-600">
        {dayStats.absentRate}
      </td>
      <td
        className={`px-4 py-3 border border-slate-200 text-left text-slate-700`}
      >
        {renderNoteCell(draftDayNote, setDraftDayNote, commitDayNote, dayNote)}
      </td>

      <td
        className={`px-4 py-3 border border-slate-200 text-center font-bold ${numberClass}`}
      >
        {editableHeadcount ? (
          <input
            type="number"
            min="0"
            value={draftNightCount}
            onChange={(e) => setDraftNightCount(e.target.value)}
            onBlur={commitNightCount}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder={String(nightStats.total)}
            className="w-16 text-center rounded border border-slate-300 bg-white px-2 py-1"
          />
        ) : overrideNightCount != null && overrideNightCount !== "" ? (
          Number(overrideNightCount)
        ) : (
          nightStats.total
        )}
      </td>
      <td className="px-4 py-3 border border-slate-200 text-center font-bold text-red-600">
        {nightStats.absent}
      </td>
      <td
        className={`px-4 py-3 border border-slate-200 text-center font-bold ${numberClass}`}
      >
        {nightStats.present}
      </td>
      <td className="px-4 py-3 border border-slate-200 text-center font-bold text-red-600">
        {nightStats.absentRate}
      </td>
      <td
        className={`px-4 py-3 border border-slate-200 text-left text-slate-700`}
      >
        {renderNoteCell(
          draftNightNote,
          setDraftNightNote,
          commitNightNote,
          nightNote,
        )}
      </td>
    </tr>
  );
};

function AttendanceHeadcountDashboard({
  employees,
  seasonalEmployees,
  requiredByDepartment,
  onRequiredChange,
  notesByKey,
  onNoteChange,
  canEditRequired,
  selectedDate,
  setSelectedDate,
  loading,
}) {
  const dashboardExportRef = useRef(null);

  const resolveDisplayCount = (overrideValue, fallbackValue) => {
    if (
      overrideValue === "" ||
      overrideValue === null ||
      overrideValue === undefined
    ) {
      return fallbackValue;
    }

    const parsed = Number(overrideValue);
    return Number.isFinite(parsed) ? parsed : fallbackValue;
  };

  const handleDownloadDashboardImage = () => {
    const node = dashboardExportRef.current;
    if (!node) return;

    toPng(node, {
      backgroundColor: "#ffffff",
      pixelRatio: Math.max(2, window.devicePixelRatio || 1),
      cacheBust: true,
    })
      .then((dataUrl) => {
        const a = document.createElement("a");
        const fallbackDate = new Date();
        const yyyy = fallbackDate.getFullYear();
        const mm = String(fallbackDate.getMonth() + 1).padStart(2, "0");
        const dd = String(fallbackDate.getDate()).padStart(2, "0");
        const fileDate = selectedDate || `${yyyy}-${mm}-${dd}`;
        a.download = `attendance-dashboard-${fileDate}.png`;
        a.href = dataUrl;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((error) => {
        console.error("Download dashboard image failed:", error);
      });
  };

  const handleExportExcel = () => {
    const wsData = [
      [
        "공정",
        "총 필요인원",
        "현재 인원",
        "부족 인원",
        "구분",
        "주간 근무",
        "",
        "",
        "",
        "",
        "야간 근무",
        "",
        "",
        "",
        "",
      ],
      [
        "",
        "",
        "",
        "",
        "",
        "인원",
        "결근/연차",
        "출근 인원",
        "결근율",
        "비고",
        "인원",
        "결근/연차",
        "출근 인원",
        "결근율",
        "비고",
      ],
    ];

    rows.forEach((row) => {
      wsData.push([
        row.label,
        row.required,
        row.current,
        row.shortage,
        "정규직",
        row.regularStats.day.total,
        row.regularStats.day.absent,
        row.regularStats.day.present,
        row.regularStats.day.absentRate,
        notesByKey?.[`${row.key}_regular_day`] || "-",
        row.regularStats.night.total,
        row.regularStats.night.absent,
        row.regularStats.night.present,
        row.regularStats.night.absentRate,
        notesByKey?.[`${row.key}_regular_night`] || "-",
      ]);

      wsData.push([
        "",
        "",
        "",
        "",
        "일용직",
        resolveDisplayCount(
          notesByKey?.[`${row.key}_seasonal_day_count`],
          row.seasonalStats.day.total,
        ),
        row.seasonalStats.day.absent,
        row.seasonalStats.day.present,
        row.seasonalStats.day.absentRate,
        notesByKey?.[`${row.key}_seasonal_day`] || "-",
        resolveDisplayCount(
          notesByKey?.[`${row.key}_seasonal_night_count`],
          row.seasonalStats.night.total,
        ),
        row.seasonalStats.night.absent,
        row.seasonalStats.night.present,
        row.seasonalStats.night.absentRate,
        notesByKey?.[`${row.key}_seasonal_night`] || "-",
      ]);
    });

    wsData.push([
      "TOTAL",
      totals.required,
      totals.current,
      totals.shortage,
      "정규직",
      totals.regular.day.total,
      totals.regular.day.absent,
      totals.regular.day.present,
      totals.regular.day.absentRate,
      "-",
      totals.regular.night.total,
      totals.regular.night.absent,
      totals.regular.night.present,
      totals.regular.night.absentRate,
      "-",
    ]);

    wsData.push([
      "",
      "",
      "",
      "",
      "일용직",
      totals.seasonal.day.total,
      totals.seasonal.day.absent,
      totals.seasonal.day.present,
      totals.seasonal.day.absentRate,
      "-",
      totals.seasonal.night.total,
      totals.seasonal.night.absent,
      totals.seasonal.night.present,
      totals.seasonal.night.absentRate,
      "-",
    ]);

    wsData.push([
      "TOTAL",
      totals.required,
      totals.current,
      totals.shortage,
      "합계",
      totals.grand.day.total,
      totals.grand.day.absent,
      totals.grand.day.present,
      totals.grand.day.absentRate,
      "-",
      totals.grand.night.total,
      totals.grand.night.absent,
      totals.grand.night.present,
      totals.grand.night.absentRate,
      "-",
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },
      { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },
      { s: { r: 0, c: 5 }, e: { r: 0, c: 9 } },
      { s: { r: 0, c: 10 }, e: { r: 0, c: 14 } },
    ];

    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 8 },
      { wch: 10 },
      { wch: 10 },
      { wch: 8 },
      { wch: 24 },
      { wch: 8 },
      { wch: 10 },
      { wch: 10 },
      { wch: 8 },
      { wch: 24 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AttendanceDashboard");

    const fallbackDate = new Date();
    const yyyy = fallbackDate.getFullYear();
    const mm = String(fallbackDate.getMonth() + 1).padStart(2, "0");
    const dd = String(fallbackDate.getDate()).padStart(2, "0");
    const fileDate = selectedDate || `${yyyy}-${mm}-${dd}`;

    XLSX.writeFile(workbook, `attendance-dashboard-${fileDate}.xlsx`);
  };

  const filteredRegular = useMemo(() => {
    return Array.isArray(employees) ? employees : [];
  }, [employees]);

  const filteredSeasonal = useMemo(() => {
    return Array.isArray(seasonalEmployees) ? seasonalEmployees : [];
  }, [seasonalEmployees]);

  const rows = useMemo(() => {
    return DEPARTMENT_CONFIG.map((dept) => {
      const regular = filterByAliases(filteredRegular, dept.aliases).filter(
        (emp) => !isMaternityLeave(emp),
      );
      const seasonal = filterByAliases(filteredSeasonal, dept.aliases).filter(
        (emp) => !isMaternityLeave(emp),
      );
      const current = regular.length + seasonal.length;
      const requiredInput = Number(requiredByDepartment?.[dept.key]);
      const required =
        Number.isFinite(requiredInput) && requiredInput >= 0
          ? requiredInput
          : current;

      const regularStats =
        dept.key === "extrusion"
          ? {
              day: buildStats(regular),
              night: buildStats([]),
            }
          : splitShiftStats(regular);

      const seasonalStats =
        dept.key === "extrusion"
          ? {
              day: buildStats(seasonal),
              night: buildStats([]),
            }
          : splitShiftStats(seasonal);

      return {
        ...dept,
        required,
        current,
        shortage: current - required,
        regularStats,
        seasonalStats,
      };
    });
  }, [filteredRegular, filteredSeasonal, requiredByDepartment]);

  const totals = useMemo(() => {
    const empty = {
      total: 0,
      absent: 0,
      present: 0,
      absentRate: "-",
    };

    const sumStats = (list, accessor) => {
      const merged = list.reduce(
        (acc, item) => {
          const stats = accessor(item);
          return {
            total: acc.total + stats.total,
            absent: acc.absent + stats.absent,
            present: acc.present + stats.present,
          };
        },
        { total: 0, absent: 0, present: 0 },
      );

      return {
        ...merged,
        absentRate:
          merged.total > 0
            ? `${Math.round((merged.absent / merged.total) * 100)}%`
            : "-",
      };
    };

    const required = rows.reduce((sum, item) => sum + item.required, 0);
    const current = rows.reduce((sum, item) => sum + item.current, 0);

    return {
      required,
      current,
      shortage: current - required,
      regular: {
        day: sumStats(rows, (r) => r.regularStats.day),
        night: sumStats(rows, (r) => r.regularStats.night),
      },
      seasonal: {
        day: sumStats(rows, (r) => r.seasonalStats.day),
        night: sumStats(rows, (r) => r.seasonalStats.night),
      },
      grand: {
        day: sumStats(rows, (r) => {
          const dayTotal = r.regularStats.day.total + r.seasonalStats.day.total;
          const absent = r.regularStats.day.absent + r.seasonalStats.day.absent;
          return {
            ...empty,
            total: dayTotal,
            absent,
            present: dayTotal - absent,
          };
        }),
        night: sumStats(rows, (r) => {
          const nightTotal =
            r.regularStats.night.total + r.seasonalStats.night.total;
          const absent =
            r.regularStats.night.absent + r.seasonalStats.night.absent;
          return {
            ...empty,
            total: nightTotal,
            absent,
            present: nightTotal - absent,
          };
        }),
      },
    };
  }, [rows]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div
        ref={dashboardExportRef}
        className="max-w-[1800px] mx-auto space-y-4"
      >
        <div className="bg-white rounded-lg shadow border border-slate-200 p-4 md:p-5">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
                근태현황
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                공정별 인력 현황을 추적하고 정규직과 일용직을 구분합니다
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Ngày
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-2 rounded-md text-sm font-semibold border bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 transition"
              >
                Xuất Excel
              </button>
              <button
                type="button"
                onClick={handleDownloadDashboardImage}
                className="px-3 py-2 rounded-md text-sm font-semibold border bg-slate-900 border-slate-900 text-white hover:bg-slate-700 transition"
              >
                Tải hình PNG
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-600">
              Đang tải dữ liệu...
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[1600px] w-full border-collapse text-sm bg-white">
                <thead>
                  <tr className="bg-slate-700 text-white">
                    <th
                      rowSpan={2}
                      className="px-4 py-3 border border-slate-600 min-w-[130px] font-bold text-sm"
                    >
                      공정
                    </th>
                    <th
                      rowSpan={2}
                      className="px-4 py-3 border border-slate-600 min-w-[95px] font-bold text-sm"
                    >
                      총 필요인원
                    </th>
                    <th
                      rowSpan={2}
                      className="px-4 py-3 border border-slate-600 min-w-[90px] font-bold text-sm"
                    >
                      현재 인원
                    </th>
                    <th
                      rowSpan={2}
                      className="px-4 py-3 border border-slate-600 min-w-[90px] font-bold text-sm"
                    >
                      부족 인원
                    </th>
                    <th
                      rowSpan={2}
                      className="px-4 py-3 border border-slate-600 min-w-[90px] font-bold text-sm"
                    >
                      구분
                    </th>
                    <th
                      colSpan={5}
                      className="px-4 py-3 border border-slate-600 min-w-[540px] font-bold text-sm"
                    >
                      주간 근무
                    </th>
                    <th
                      colSpan={5}
                      className="px-4 py-3 border border-slate-600 min-w-[540px] font-bold text-sm"
                    >
                      야간 근무
                    </th>
                  </tr>
                  <tr className="bg-slate-600 text-white">
                    <th className="px-4 py-2 border border-slate-600 min-w-[70px] font-bold text-xs">
                      인원
                    </th>
                    <th className="px-4 py-2 border border-slate-600 min-w-[80px] font-bold text-xs">
                      결근/연차
                    </th>
                    <th className="px-4 py-2 border border-slate-600 min-w-[80px] font-bold text-xs">
                      출근 인원
                    </th>
                    <th className="px-4 py-2 border border-slate-600 min-w-[80px] font-bold text-xs">
                      결근율
                    </th>
                    <th className="px-4 py-2 border border-slate-600 min-w-[200px] font-bold text-xs">
                      비고
                    </th>
                    <th className="px-4 py-2 border border-slate-600 min-w-[70px] font-bold text-xs">
                      인원
                    </th>
                    <th className="px-4 py-2 border border-slate-600 min-w-[80px] font-bold text-xs">
                      결근/연차
                    </th>
                    <th className="px-4 py-2 border border-slate-600 min-w-[80px] font-bold text-xs">
                      출근 인원
                    </th>
                    <th className="px-4 py-2 border border-slate-600 min-w-[80px] font-bold text-xs">
                      결근율
                    </th>
                    <th className="px-4 py-2 border border-slate-600 min-w-[200px] font-bold text-xs">
                      비고
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <React.Fragment key={row.key}>
                      <SummaryRow
                        processLabel={row.label}
                        processRowSpan={2}
                        required={row.required}
                        current={row.current}
                        shortage={row.shortage}
                        category="정규직"
                        dayStats={row.regularStats.day}
                        nightStats={row.regularStats.night}
                        isMuted={false}
                        editableRequired={canEditRequired}
                        onRequiredCommit={(value) =>
                          onRequiredChange?.(row.key, value)
                        }
                        editableNotes={canEditRequired}
                        dayNote={notesByKey?.[`${row.key}_regular_day`] || ""}
                        nightNote={
                          notesByKey?.[`${row.key}_regular_night`] || ""
                        }
                        onDayNoteCommit={(value) =>
                          onNoteChange?.(`${row.key}_regular_day`, value)
                        }
                        onNightNoteCommit={(value) =>
                          onNoteChange?.(`${row.key}_regular_night`, value)
                        }
                      />
                      <SummaryRow
                        processLabel=""
                        hideProcessCell={true}
                        required=""
                        current=""
                        shortage=""
                        category="일용직"
                        dayStats={row.seasonalStats.day}
                        nightStats={row.seasonalStats.night}
                        isMuted={true}
                        editableHeadcount={canEditRequired}
                        overrideDayCount={
                          notesByKey?.[`${row.key}_seasonal_day_count`] || ""
                        }
                        overrideNightCount={
                          notesByKey?.[`${row.key}_seasonal_night_count`] || ""
                        }
                        onDayCountCommit={(value) =>
                          onNoteChange?.(`${row.key}_seasonal_day_count`, value)
                        }
                        onNightCountCommit={(value) =>
                          onNoteChange?.(
                            `${row.key}_seasonal_night_count`,
                            value,
                          )
                        }
                        editableNotes={canEditRequired}
                        dayNote={notesByKey?.[`${row.key}_seasonal_day`] || ""}
                        nightNote={
                          notesByKey?.[`${row.key}_seasonal_night`] || ""
                        }
                        onDayNoteCommit={(value) =>
                          onNoteChange?.(`${row.key}_seasonal_day`, value)
                        }
                        onNightNoteCommit={(value) =>
                          onNoteChange?.(`${row.key}_seasonal_night`, value)
                        }
                      />
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <SummaryRow
                    processLabel="TOTAL"
                    required={totals.required}
                    current={totals.current}
                    shortage={totals.shortage}
                    category="정규직"
                    dayStats={totals.regular.day}
                    nightStats={totals.regular.night}
                    isMuted={false}
                  />
                  <SummaryRow
                    processLabel=""
                    required=""
                    current=""
                    shortage=""
                    category="일용직"
                    dayStats={totals.seasonal.day}
                    nightStats={totals.seasonal.night}
                    isMuted={true}
                  />
                  <tr className="bg-slate-800 text-white font-bold">
                    <td className="px-4 py-3 border border-slate-700">TOTAL</td>
                    <td className="px-4 py-3 border border-slate-700 text-center">
                      {totals.required}
                    </td>
                    <td className="px-4 py-3 border border-slate-700 text-center">
                      {totals.current}
                    </td>
                    <td className="px-4 py-3 border border-slate-700 text-center">
                      {totals.shortage}
                    </td>
                    <td className="px-4 py-3 border border-slate-700">합계</td>
                    <td className="px-4 py-3 border border-slate-700 text-center">
                      {totals.grand.day.total}
                    </td>
                    <td className="px-4 py-3 border border-slate-700 text-center text-orange-300">
                      {totals.grand.day.absent}
                    </td>
                    <td className="px-4 py-3 border border-slate-700 text-center">
                      {totals.grand.day.present}
                    </td>
                    <td className="px-4 py-3 border border-slate-700 text-center text-orange-300">
                      {totals.grand.day.absentRate}
                    </td>
                    <td className="px-4 py-3 border border-slate-700 text-center">
                      -
                    </td>
                    <td className="px-4 py-3 border border-slate-700 text-center">
                      {totals.grand.night.total}
                    </td>
                    <td className="px-4 py-3 border border-slate-700 text-center text-orange-300">
                      {totals.grand.night.absent}
                    </td>
                    <td className="px-4 py-3 border border-slate-700 text-center">
                      {totals.grand.night.present}
                    </td>
                    <td className="px-4 py-3 border border-slate-700 text-center text-orange-300">
                      {totals.grand.night.absentRate}
                    </td>
                    <td className="px-4 py-3 border border-slate-700 text-center">
                      -
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AttendanceHeadcountDashboard;
