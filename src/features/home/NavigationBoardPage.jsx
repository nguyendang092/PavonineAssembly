import { memo, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { isAdminAccess } from "@/config/authRoles";
import { canViewKoreanTimesheet } from "@/config/featurePermissions";
import {
  NAVIGATION_BOARD_CATEGORIES,
  NAVIGATION_BOARD_TOOLS,
} from "@/config/navigationBoardTools";
import "./navigationBoard.css";

const STATUS_STYLE = {
  active: {
    dot: "bg-emerald-500",
    labelKey: "navigationBoard.statusActive",
  },
  maintenance: {
    dot: "bg-amber-500",
    labelKey: "navigationBoard.statusMaintenance",
  },
  new: {
    dot: "bg-sky-500",
    labelKey: "navigationBoard.statusNew",
  },
};

/** Màu card theo nhóm — dễ phân biệt khi lưới trộn nhiều loại. */
const CATEGORY_CARD_STYLE = {
  operations: {
    card:
      "border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-orange-50 hover:border-amber-300 hover:shadow-amber-100/80 dark:border-amber-800/70 dark:from-amber-950/50 dark:via-slate-900 dark:to-orange-950/40 dark:hover:border-amber-600 dark:hover:shadow-amber-950/30",
    accent: "bg-amber-500",
    idText: "text-amber-700/80 dark:text-amber-400/90",
    categoryChip:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200",
    title: "text-amber-950 dark:text-amber-50",
    desc: "text-amber-900/65 dark:text-amber-100/70",
    link: "text-amber-700 group-hover:text-amber-900 dark:text-amber-400 dark:group-hover:text-amber-300",
    statusBadge:
      "border-amber-200/80 bg-white/80 text-amber-900 dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-100",
    filterActive:
      "bg-amber-600 text-white shadow-sm dark:bg-amber-500 dark:text-amber-950",
    filterIdle:
      "border-amber-200 bg-amber-50/80 text-amber-800 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:border-amber-600",
  },
  hr: {
    card:
      "border-violet-200/90 bg-gradient-to-br from-violet-50 via-white to-indigo-50 hover:border-violet-300 hover:shadow-violet-100/80 dark:border-violet-800/70 dark:from-violet-950/50 dark:via-slate-900 dark:to-indigo-950/40 dark:hover:border-violet-600 dark:hover:shadow-violet-950/30",
    accent: "bg-violet-500",
    idText: "text-violet-700/80 dark:text-violet-400/90",
    categoryChip:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/70 dark:text-violet-200",
    title: "text-violet-950 dark:text-violet-50",
    desc: "text-violet-900/65 dark:text-violet-100/70",
    link: "text-violet-700 group-hover:text-violet-900 dark:text-violet-400 dark:group-hover:text-violet-300",
    statusBadge:
      "border-violet-200/80 bg-white/80 text-violet-900 dark:border-violet-700/80 dark:bg-violet-950/40 dark:text-violet-100",
    filterActive:
      "bg-violet-600 text-white shadow-sm dark:bg-violet-500 dark:text-violet-950",
    filterIdle:
      "border-violet-200 bg-violet-50/80 text-violet-800 hover:border-violet-300 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:border-violet-600",
  },
  finance: {
    card:
      "border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-teal-50 hover:border-emerald-300 hover:shadow-emerald-100/80 dark:border-emerald-800/70 dark:from-emerald-950/50 dark:via-slate-900 dark:to-teal-950/40 dark:hover:border-emerald-600 dark:hover:shadow-emerald-950/30",
    accent: "bg-emerald-500",
    idText: "text-emerald-700/80 dark:text-emerald-400/90",
    categoryChip:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200",
    title: "text-emerald-950 dark:text-emerald-50",
    desc: "text-emerald-900/65 dark:text-emerald-100/70",
    link: "text-emerald-700 group-hover:text-emerald-900 dark:text-emerald-400 dark:group-hover:text-emerald-300",
    statusBadge:
      "border-emerald-200/80 bg-white/80 text-emerald-900 dark:border-emerald-700/80 dark:bg-emerald-950/40 dark:text-emerald-100",
    filterActive:
      "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-emerald-950",
    filterIdle:
      "border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:border-emerald-600",
  },
  documents: {
    card:
      "border-sky-200/90 bg-gradient-to-br from-sky-50 via-white to-cyan-50 hover:border-sky-300 hover:shadow-sky-100/80 dark:border-sky-800/70 dark:from-sky-950/50 dark:via-slate-900 dark:to-cyan-950/40 dark:hover:border-sky-600 dark:hover:shadow-sky-950/30",
    accent: "bg-sky-500",
    idText: "text-sky-700/80 dark:text-sky-400/90",
    categoryChip:
      "bg-sky-100 text-sky-800 dark:bg-sky-900/70 dark:text-sky-200",
    title: "text-sky-950 dark:text-sky-50",
    desc: "text-sky-900/65 dark:text-sky-100/70",
    link: "text-sky-700 group-hover:text-sky-900 dark:text-sky-400 dark:group-hover:text-sky-300",
    statusBadge:
      "border-sky-200/80 bg-white/80 text-sky-900 dark:border-sky-700/80 dark:bg-sky-950/40 dark:text-sky-100",
    filterActive:
      "bg-sky-600 text-white shadow-sm dark:bg-sky-500 dark:text-sky-950",
    filterIdle:
      "border-sky-200 bg-sky-50/80 text-sky-800 hover:border-sky-300 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:border-sky-600",
  },
  system: {
    card:
      "border-rose-200/90 bg-gradient-to-br from-rose-50 via-white to-slate-100 hover:border-rose-300 hover:shadow-rose-100/80 dark:border-rose-800/70 dark:from-rose-950/50 dark:via-slate-900 dark:to-slate-800/40 dark:hover:border-rose-600 dark:hover:shadow-rose-950/30",
    accent: "bg-rose-500",
    idText: "text-rose-700/80 dark:text-rose-400/90",
    categoryChip:
      "bg-rose-100 text-rose-800 dark:bg-rose-900/70 dark:text-rose-200",
    title: "text-rose-950 dark:text-rose-50",
    desc: "text-rose-900/65 dark:text-rose-100/70",
    link: "text-rose-700 group-hover:text-rose-900 dark:text-rose-400 dark:group-hover:text-rose-300",
    statusBadge:
      "border-rose-200/80 bg-white/80 text-rose-900 dark:border-rose-700/80 dark:bg-rose-950/40 dark:text-rose-100",
    filterActive:
      "bg-rose-600 text-white shadow-sm dark:bg-rose-500 dark:text-rose-950",
    filterIdle:
      "border-rose-200 bg-rose-50/80 text-rose-800 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:border-rose-600",
  },
};

function getCategoryStyle(categoryId) {
  return CATEGORY_CARD_STYLE[categoryId] ?? CATEGORY_CARD_STYLE.operations;
}

const CATEGORY_ORDER = NAVIGATION_BOARD_CATEGORIES.filter(
  (c) => c.id !== "all",
).map((c) => c.id);

function groupToolsByCategory(tools) {
  const byCategory = new Map();
  for (const tool of tools) {
    const list = byCategory.get(tool.category) ?? [];
    list.push(tool);
    byCategory.set(tool.category, list);
  }
  return CATEGORY_ORDER.filter((id) => byCategory.has(id)).map((id) => ({
    categoryId: id,
    tools: byCategory.get(id) ?? [],
  }));
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const NavigationBoardToolCard = memo(function NavigationBoardToolCard({
  tool,
  title,
  description,
  statusLabel,
  openLabel,
  categoryLabel,
}) {
  const status = STATUS_STYLE[tool.status ?? "active"] ?? STATUS_STYLE.active;
  const cat = getCategoryStyle(tool.category);
  return (
    <Link
      to={tool.path}
      className={`group relative flex min-h-[148px] flex-col overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a73e8] ${cat.card}`}
    >
      <span
        className={`absolute inset-x-0 top-0 h-1 ${cat.accent}`}
        aria-hidden
      />
      <div className="mb-3 flex items-start justify-between gap-3 pt-1">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span
            className={`font-mono text-[11px] font-semibold uppercase tracking-wide ${cat.idText}`}
          >
            {tool.id}
          </span>
          <span
            className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cat.categoryChip}`}
          >
            {categoryLabel}
          </span>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cat.statusBadge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {statusLabel}
        </span>
      </div>
      <h2 className={`text-base font-bold leading-snug ${cat.title}`}>{title}</h2>
      <p className={`mt-1.5 flex-1 text-xs leading-relaxed ${cat.desc}`}>
        {description}
      </p>
      <span
        className={`mt-4 text-sm font-semibold transition ${cat.link}`}
      >
        {openLabel} →
      </span>
    </Link>
  );
});

export default function NavigationBoardPage() {
  const { t, i18n } = useTranslation();
  const { user, userRole } = useUser();
  const now = useLiveClock();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const showAdminTools = isAdminAccess(user, userRole);
  const showKoreanTimesheet = canViewKoreanTimesheet(user, userRole);

  const visibleTools = useMemo(() => {
    return NAVIGATION_BOARD_TOOLS.filter((tool) => {
      if (tool.adminOnly && !showAdminTools) return false;
      if (tool.koreanOnly && !showKoreanTimesheet) return false;
      return true;
    });
  }, [showAdminTools, showKoreanTimesheet]);

  const filteredTools = useMemo(() => {
    const q = normalizeSearchText(query);
    return visibleTools.filter((tool) => {
      if (category !== "all" && tool.category !== category) return false;
      if (!q) return true;
      const title = normalizeSearchText(t(tool.titleKey));
      const desc = normalizeSearchText(t(tool.descriptionKey));
      return title.includes(q) || desc.includes(q) || tool.id.toLowerCase().includes(q);
    });
  }, [visibleTools, category, query, t]);

  const toolGroups = useMemo(
    () => groupToolsByCategory(filteredTools),
    [filteredTools],
  );

  const locale = i18n.language?.startsWith("ko") ? "ko-KR" : "vi-VN";
  const timeText = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateText = now.toLocaleDateString(locale, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="navigation-board-page min-h-full w-full">
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
        <header className="navigation-board-top border-b border-slate-200/80 pb-3 dark:border-slate-700">
          <div className="navigation-board-top-main">
            <div className="navigation-board-brand">
              <span className="navigation-board-brand-mark" aria-hidden>
                P
              </span>
              <div className="navigation-board-title-block">
                <p className="navigation-board-kicker">
                  {t("navigationBoard.kicker")}
                </p>
                <h1 className="navigation-board-title">
                  {t("navigationBoard.title")}
                </h1>
              </div>
            </div>
            <div className="navigation-board-clock">
              <div className="navigation-board-clock-time">{timeText}</div>
              <div className="navigation-board-clock-date">{dateText}</div>
            </div>
          </div>
          <p className="navigation-board-subtitle">
            {t("navigationBoard.subtitle")}
          </p>
        </header>

        <section className="mb-5 mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full sm:max-w-md lg:max-w-xl">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("navigationBoard.searchPlaceholder")}
              className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-[#4b8df8] dark:focus:ring-[#4b8df8]/25"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {NAVIGATION_BOARD_CATEGORIES.map((cat) => {
              const active = category === cat.id;
              const catStyle =
                cat.id === "all" ? null : getCategoryStyle(cat.id);
              const btnClass =
                cat.id === "all"
                  ? active
                    ? "bg-[#1a73e8] text-white shadow-sm dark:bg-[#4b8df8] dark:text-slate-950"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-[#1a73e8]/35 hover:text-[#1558b0] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-[#4b8df8]/40"
                  : active
                    ? catStyle.filterActive
                    : catStyle.filterIdle;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${btnClass}`}
                >
                  {t(cat.labelKey)}
                </button>
              );
            })}
          </div>
        </section>

        {filteredTools.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center dark:border-slate-600 dark:bg-slate-900/50">
            <p className="text-base font-medium text-slate-700 dark:text-slate-300">
              {t("navigationBoard.emptyResults")}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {toolGroups.map((group) => {
              const catMeta = NAVIGATION_BOARD_CATEGORIES.find(
                (c) => c.id === group.categoryId,
              );
              const catStyle = getCategoryStyle(group.categoryId);
              return (
                <section key={group.categoryId} aria-label={t(catMeta?.labelKey ?? "")}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className={`h-8 w-1 rounded-full ${catStyle.accent}`} />
                    <h2 className={`text-xl font-bold ${catStyle.title}`}>
                      {t(catMeta?.labelKey ?? "")}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${catStyle.categoryChip}`}
                    >
                      {group.tools.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {group.tools.map((tool) => (
                      <NavigationBoardToolCard
                        key={tool.id}
                        tool={tool}
                        title={t(tool.titleKey)}
                        description={t(tool.descriptionKey)}
                        categoryLabel={t(catMeta?.labelKey ?? "")}
                        statusLabel={t(
                          (
                            STATUS_STYLE[tool.status ?? "active"] ??
                            STATUS_STYLE.active
                          ).labelKey,
                        )}
                        openLabel={t("navigationBoard.open")}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
