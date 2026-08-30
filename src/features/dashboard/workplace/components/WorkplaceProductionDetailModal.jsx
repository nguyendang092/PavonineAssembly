import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "@e965/xlsx";
import { FiAward, FiCalendar, FiDownload, FiLayers, FiMapPin, FiSearch, FiTrendingUp, FiX } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import LoadingBlock from "@/components/ui/LoadingBlock";
import { logUserAction } from "@/utils/userLog";
import { ref, get } from "firebase/database";
import { db } from "@/services/firebase";
import { useUserIdentity } from "@/contexts/UserContext";
import { resolveWorkplaceAreaTheme } from "../lib/workplaceAreaTheme";
import "../workplaceProductionModals.css";

const PAGE_SIZE = 15;

function parseYmdToLocalDate(dateStr) {
  const [year, month, day] = String(dateStr)
    .split("-")
    .map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatLocalYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getYesterdayLocalYmd() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return formatLocalYmd(date);
}

function getWeekNumber(dateStr) {
  const date = parseYmdToLocalDate(dateStr);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

function areaHasDetailForDate(areaData, targetDate) {
  if (!areaData || !targetDate) return false;
  for (const weekKey in areaData) {
    const models = areaData[weekKey];
    if (!models) continue;
    for (const model in models) {
      const qty = Number(models[model]?.[targetDate] ?? 0);
      if (Number.isFinite(qty) && qty > 0) return true;
    }
  }
  return false;
}

function buildModelRowsForArea(areaData, targetDate) {
  const modelMap = new Map();
  if (!areaData || !targetDate) return [];

  for (const weekKey in areaData) {
    const models = areaData[weekKey];
    for (const model in models) {
      const modelData = models[model];
      if (modelData?.[targetDate]) {
        const quantity = Number(modelData[targetDate]) || 0;
        if (quantity > 0) {
          modelMap.set(model, (modelMap.get(model) ?? 0) + quantity);
        }
      }
    }
  }

  return Array.from(modelMap, ([model, quantity]) => ({
    model,
    quantity,
    date: targetDate,
  }));
}

function resolveAreasWithDetailForDate(detailsByArea, targetDate) {
  if (!detailsByArea || !targetDate) return [];
  return Object.keys(detailsByArea)
    .filter((area) => areaHasDetailForDate(detailsByArea[area], targetDate))
    .sort((a, b) => a.localeCompare(b, "vi"));
}

export default function WorkplaceProductionDetailModal({
  isOpen,
  onClose,
  area,
  detailsRoot = "details",
  selectedYear: dashboardYear,
  selectedWeek: dashboardWeek,
}) {
  const { t } = useTranslation();
  const { user } = useUserIdentity();
  const [selectedArea, setSelectedArea] = useState(area || "Assembly");
  const [selectedModel, setSelectedModel] = useState("");
  const [detailsByArea, setDetailsByArea] = useState(null);
  const [allDetailData, setAllDetailData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [forceFetch, setForceFetch] = useState(0);
  const [selectedYear, setSelectedYear] = useState(
    dashboardYear ?? new Date().getFullYear(),
  );
  const [selectedDate, setSelectedDate] = useState(getYesterdayLocalYmd());

  const currentWeekNumber = getWeekNumber(selectedDate);
  const areaTheme = resolveWorkplaceAreaTheme(selectedArea);

  const areasForDate = useMemo(
    () => resolveAreasWithDetailForDate(detailsByArea, selectedDate),
    [detailsByArea, selectedDate],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;

    const loadDetails = async () => {
      setLoading(true);
      try {
        const snapshot = await get(ref(db, detailsRoot));
        if (cancelled) return;
        setDetailsByArea(snapshot.exists() ? snapshot.val() : {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [isOpen, forceFetch, detailsRoot]);

  useEffect(() => {
    if (!detailsByArea) return;

    if (!areasForDate.length) {
      setAllDetailData([]);
      return;
    }

    const nextArea = areasForDate.includes(selectedArea)
      ? selectedArea
      : areasForDate.includes(area)
        ? area
        : areasForDate[0];

    if (nextArea !== selectedArea) {
      setSelectedArea(nextArea);
      return;
    }

    setAllDetailData(
      buildModelRowsForArea(detailsByArea[nextArea], selectedDate),
    );
  }, [detailsByArea, areasForDate, selectedArea, selectedDate, area]);

  const filteredData = useMemo(
    () =>
      allDetailData
        .filter((item) =>
          item.model.toLowerCase().includes(selectedModel.toLowerCase()),
        )
        .sort((a, b) => b.quantity - a.quantity),
    [allDetailData, selectedModel],
  );

  const totalQty = useMemo(
    () => filteredData.reduce((sum, row) => sum + row.quantity, 0),
    [filteredData],
  );

  const topModel = filteredData[0]?.model ?? "—";
  const maxQty = filteredData[0]?.quantity ?? 0;

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const pageRows = filteredData.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const pageFrom = filteredData.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const pageTo = Math.min(page * PAGE_SIZE, filteredData.length);

  useEffect(() => {
    setPage(1);
  }, [selectedArea, selectedModel, selectedYear, selectedDate]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!isOpen) {
      setAllDetailData([]);
      setDetailsByArea(null);
      setSelectedModel("");
      setPage(1);
      setSelectedDate(getYesterdayLocalYmd());
      return;
    }

    setSelectedArea(area || "Assembly");
    if (dashboardYear) setSelectedYear(dashboardYear);
    setSelectedDate(getYesterdayLocalYmd());
    setForceFetch((f) => f + 1);

    if (user?.email) {
      logUserAction(
        user.email,
        "view_detail_output",
        `Xem chi tiết sản lượng khu vực: ${area || "Assembly"}, tuần ${currentWeekNumber}`,
      );
    }
  }, [isOpen, area, dashboardYear, user?.email, currentWeekNumber]);

  const handleExportExcel = () => {
    if (!filteredData.length) return;
    const ws = XLSX.utils.json_to_sheet(
      filteredData.map((item) => ({
        [t("detailedModal.area")]: selectedArea,
        [t("detailedModal.model")]: item.model,
        [t("detailedModal.date")]: item.date,
        [t("detailedModal.quantity")]: item.quantity,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Details");
    XLSX.writeFile(
      wb,
      `details_${selectedArea}_week${currentWeekNumber}.xlsx`,
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="wpm-backdrop wpm-backdrop--nested" role="dialog" aria-modal="true">
      <button
        type="button"
        className="wpm-backdrop__hit"
        onClick={onClose}
        aria-label={t("detailedModal.close")}
      />
      <div
        className="wpm-card wpm-card--detail"
        style={{ "--wpm-area-accent": areaTheme.accent }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="wpm-head">
          <div className="min-w-0">
            <h2 className="wpm-head__title">
              <span className="wpm-head__mark" aria-hidden />
              {t("detailedModal.title")}
            </h2>
            <p className="wpm-head__crumb">
              {t(`areas.${selectedArea}`, { defaultValue: selectedArea })} ·{" "}
              {t("workplaceChart.week")} {dashboardWeek ?? currentWeekNumber}
            </p>
          </div>
          <button
            type="button"
            className="wpm-close"
            onClick={onClose}
            aria-label={t("detailedModal.close")}
          >
            <FiX size={18} strokeWidth={2.2} />
          </button>
        </header>

        <div
          className="wpm-filter-panel"
          style={{ "--wpm-area-accent": areaTheme.accent }}
        >
          <div className="wpm-filter-panel__row">
            <div className="wpm-filter-group wpm-filter-group--time">
              <label
                className="wpm-field wpm-field--chip"
                style={{ "--wpm-field-accent": "#0EA5E9" }}
              >
                <span className="wpm-field__label">
                  <FiCalendar size={11} aria-hidden />
                  {t("workplaceChart.year")}
                </span>
                <select
                  className="wpm-field__input"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                >
                  {Array.from(
                    { length: 5 },
                    (_, i) => new Date().getFullYear() - i,
                  ).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              <label
                className="wpm-field wpm-field--chip"
                style={{ "--wpm-field-accent": "#6366F1" }}
              >
                <span className="wpm-field__label">
                  <FiCalendar size={11} aria-hidden />
                  {t("detailedModal.dateLabel", "Ngày")}
                </span>
                <input
                  type="date"
                  className="wpm-field__input"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </label>

              <div
                className="wpm-field wpm-field--chip wpm-field--static"
                style={{ "--wpm-field-accent": "#0891B2" }}
              >
                <span className="wpm-field__label">
                  <FiCalendar size={11} aria-hidden />
                  {t("workplaceChart.week")}
                </span>
                <div className="wpm-field__static">
                  {t("workplaceChart.week")} {currentWeekNumber}
                </div>
              </div>
            </div>

            <div className="wpm-filter-group wpm-filter-group--area">
              <label
                className="wpm-field wpm-field--chip wpm-field--area"
                style={{ "--wpm-field-accent": areaTheme.accent }}
              >
                <span className="wpm-field__label">
                  <FiMapPin size={11} aria-hidden />
                  {t("detailedModal.area")}
                </span>
                <select
                  className="wpm-field__input"
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  disabled={!areasForDate.length}
                >
                  {areasForDate.length ? (
                    areasForDate.map((a) => (
                      <option key={a} value={a}>
                        {t(`areas.${a}`, { defaultValue: a })}
                      </option>
                    ))
                  ) : (
                    <option value="">{t("detailedModal.noAreaForDate")}</option>
                  )}
                </select>
              </label>
            </div>

            <div className="wpm-filter-group wpm-filter-group--tools">
              <label
                className="wpm-field wpm-field--chip wpm-field--search"
                style={{ "--wpm-field-accent": "#64748B" }}
              >
                <span className="wpm-field__label">
                  <FiSearch size={11} aria-hidden />
                  {t("detailedModal.model")}
                </span>
                <input
                  type="text"
                  className="wpm-field__input"
                  placeholder={t("detailedModal.searchModel")}
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                />
              </label>

              <button
                type="button"
                className="wpm-btn wpm-btn--green wpm-btn--export"
                onClick={handleExportExcel}
              >
                <FiDownload size={14} aria-hidden />
                {t("detailedModal.exportExcel")}
              </button>
            </div>
          </div>
        </div>

        <div className="wpm-stats">
          <article
            className="wpm-stat wpm-stat--models"
            style={{ "--wpm-stat-accent": "#6366F1" }}
          >
            <div className="wpm-stat__head">
              <span className="wpm-stat__icon" aria-hidden>
                <FiLayers size={14} />
              </span>
              <p className="wpm-stat__label">
                {t("detailedModal.statTotalModels")}
              </p>
            </div>
            <p className="wpm-stat__value">{filteredData.length}</p>
          </article>
          <article
            className="wpm-stat wpm-stat--qty"
            style={{ "--wpm-stat-accent": areaTheme.accent }}
          >
            <div className="wpm-stat__head">
              <span className="wpm-stat__icon" aria-hidden>
                <FiTrendingUp size={14} />
              </span>
              <p className="wpm-stat__label">{t("detailedModal.statTotalQty")}</p>
            </div>
            <p className="wpm-stat__value">
              {totalQty.toLocaleString("vi-VN")}
            </p>
          </article>
          <article
            className="wpm-stat wpm-stat--top"
            style={{ "--wpm-stat-accent": "#E8871E" }}
          >
            <div className="wpm-stat__head">
              <span className="wpm-stat__icon" aria-hidden>
                <FiAward size={14} />
              </span>
              <p className="wpm-stat__label">{t("detailedModal.statTopModel")}</p>
            </div>
            <p className="wpm-stat__value" title={topModel}>
              {topModel}
            </p>
          </article>
        </div>

        <div className="wpm-detail-body">
          {loading ? (
            <div className="wpm-loading">
              <LoadingBlock
                size="sm"
                message={t("detailedModal.loadingData")}
                className="py-6"
              />
            </div>
          ) : (
            <>
              <div className="wpm-leaderboard-toolbar">
                <h3 className="wpm-leaderboard-toolbar__title">
                  <span className="wpm-leaderboard-toolbar__mark" aria-hidden />
                  {t("detailedModal.leaderboardTitle")}
                </h3>
                <div className="wpm-leaderboard-toolbar__pager">
                  <button
                    type="button"
                    className="wpm-btn wpm-btn--ghost"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t("detailedModal.prevPage")}
                  </button>
                  <span className="wpm-leaderboard-toolbar__info">
                    {t("detailedModal.pageRange", {
                      from: pageFrom,
                      to: pageTo,
                      total: filteredData.length,
                    })}
                  </span>
                  <button
                    type="button"
                    className="wpm-btn wpm-btn--ghost"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    {t("detailedModal.nextPage")}
                  </button>
                </div>
              </div>

              <div className="wpm-leaderboard">
                <div className="wpm-leaderboard__head">
                  <span>#</span>
                  <span>{t("detailedModal.model")}</span>
                  <span>{t("detailedModal.date")}</span>
                  <span>{t("detailedModal.quantity")}</span>
                </div>
                {pageRows.length ? (
                  pageRows.map((item, index) => {
                    const rank = (page - 1) * PAGE_SIZE + index + 1;
                    const pct =
                      totalQty > 0
                        ? ((item.quantity / totalQty) * 100).toFixed(1)
                        : "0.0";
                    const barPct =
                      maxQty > 0 ? (item.quantity / maxQty) * 100 : 0;
                    const rankClass =
                      rank <= 3 ? ` wpm-rank--${rank}` : "";

                    return (
                      <div key={`${item.model}-${rank}`} className="wpm-leaderboard__row">
                        <span className={`wpm-rank${rankClass}`}>{rank}</span>
                        <div className="wpm-model-block">
                          <div className="wpm-model-name" title={item.model}>
                            {item.model}
                          </div>
                          <div className="wpm-model-bar" aria-hidden>
                            <div
                              className="wpm-model-bar__fill"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                        <span className="wpm-leaderboard__date">{item.date}</span>
                        <div className="wpm-qty-block">
                          <div className="wpm-qty-main">
                            {item.quantity.toLocaleString("vi-VN")}
                          </div>
                          <div className="wpm-qty-sub">
                            {t("detailedModal.shareOfTotal", { pct })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="wpm-empty">{t("detailedModal.noChartData")}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
