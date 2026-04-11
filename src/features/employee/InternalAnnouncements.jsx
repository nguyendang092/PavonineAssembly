import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import {
  ANNOUNCEMENT_VISIBILITY,
  canPostInternalAnnouncements,
  canViewAnnouncement,
  isAdminAccess,
} from "@/config/authRoles";
import { db, ref, onValue, push, remove, update } from "@/services/firebase";
import AlertMessage from "@/components/ui/AlertMessage";
import InternalAnnouncementsCompose from "./InternalAnnouncementsCompose";
import {
  getLatestAttachment,
  LatestAttachmentInlinePreview,
} from "./InternalAnnouncementLatestAttachmentPreview";

const ANNOUNCEMENTS_PATH = "internalAnnouncements";
const PAGE_SIZE = 15;
function readStorageKey(email) {
  const e = String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, "_");
  return `pavonine_internalAnnouncements_read_${e}`;
}

function loadReadSet(email) {
  try {
    const raw = localStorage.getItem(readStorageKey(email));
    if (!raw) return new Set();
    const o = JSON.parse(raw);
    if (o && typeof o === "object") return new Set(Object.keys(o));
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveReadId(email, id) {
  try {
    const key = readStorageKey(email);
    let o = {};
    const raw = localStorage.getItem(key);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === "object") o = p;
    }
    o[id] = Date.now();
    localStorage.setItem(key, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatTime(ts, locale) {
  if (!ts || !Number.isFinite(Number(ts))) return "—";
  try {
    return new Date(Number(ts)).toLocaleTimeString(
      locale?.startsWith("ko") ? "ko-KR" : "vi-VN",
      { hour: "2-digit", minute: "2-digit" },
    );
  } catch {
    return "—";
  }
}

function formatGroupHeader(ts, locale, t) {
  if (!ts || !Number.isFinite(Number(ts))) return "";
  const d = new Date(Number(ts));
  const now = new Date();
  const today0 = startOfDay(now.getTime());
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday0 = startOfDay(y.getTime());
  const day0 = startOfDay(Number(ts));

  const weekday = d.toLocaleDateString(
    locale?.startsWith("ko") ? "ko-KR" : "vi-VN",
    { weekday: "short" },
  );
  const dateStr = d.toLocaleDateString(
    locale?.startsWith("ko") ? "ko-KR" : "vi-VN",
    { year: "numeric", month: "2-digit", day: "2-digit" },
  );

  if (day0 === today0) return `${t("internalAnnouncements.groupToday")} ${dateStr} (${weekday})`;
  if (day0 === yesterday0)
    return `${t("internalAnnouncements.groupYesterday")} ${dateStr} (${weekday})`;
  return `${dateStr} (${weekday})`;
}

function groupKey(ts) {
  return startOfDay(Number(ts));
}

function stripHtml(html) {
  if (typeof document === "undefined") {
    return String(html || "").replace(/<[^>]*>/g, " ");
  }
  const d = document.createElement("div");
  d.innerHTML = html || "";
  return d.textContent || d.innerText || "";
}

function previewText(body, max = 120) {
  const s = stripHtml(body)
    .replace(/\s+/g, " ")
    .trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function isHtmlContent(body) {
  return /<[a-z][\s\S]*>/i.test(String(body || ""));
}

function AnnouncementBody({ body, className, onImageClick }) {
  const raw = String(body ?? "");
  if (isHtmlContent(raw)) {
    const handleRichContentClick = (e) => {
      const img = e.target?.closest?.("img");
      if (!img) return;

      const src = img.getAttribute("src");
      if (!src) return;
      onImageClick?.(src);
    };

    return (
      <div
        className={
          className ||
          "text-sm leading-relaxed text-slate-800 [&_a]:text-sky-600 [&_img]:max-h-96 [&_img]:max-w-full [&_img]:cursor-zoom-in [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        }
        onClick={handleRichContentClick}
        dangerouslySetInnerHTML={{ __html: raw }}
      />
    );
  }
  return (
    <div className={className || "whitespace-pre-wrap text-sm leading-relaxed text-slate-800"}>
      {raw}
    </div>
  );
}

function approxSizeKb(body) {
  const n = new Blob([String(body || "")]).size;
  return (n / 1024).toFixed(1);
}

function InternalAnnouncements() {
  const { t, i18n } = useTranslation();
  const { user, userRole } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [composeOpen, setComposeOpen] = useState(false);
  const [filter, setFilter] = useState("inbox");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [previewImageSrc, setPreviewImageSrc] = useState("");
  const [readSet, setReadSet] = useState(() => new Set());
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== "undefined" && window.innerWidth < 1024,
  );

  const canPost = useMemo(
    () => canPostInternalAnnouncements(user, userRole),
    [user, userRole],
  );

  const isAdmin = useMemo(
    () => isAdminAccess(user, userRole),
    [user, userRole],
  );

  /** Thông báo mà người xem hiện tại được phép đọc (theo visibility) */
  const visibleItems = useMemo(
    () =>
      items.filter((row) =>
        canViewAnnouncement(user, userRole, row.visibility),
      ),
    [items, user, userRole],
  );

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (user?.email) {
      setReadSet(loadReadSet(user.email));
    } else {
      setReadSet(new Set());
    }
  }, [user?.email]);

  useEffect(() => {
    const r = ref(db, ANNOUNCEMENTS_PATH);
    const unsub = onValue(
      r,
      (snapshot) => {
        const val = snapshot.val();
        if (!val || typeof val !== "object") {
          setItems([]);
        } else {
          const arr = Object.entries(val).map(([id, row]) => ({
            id,
            ...row,
          }));
          arr.sort(
            (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0),
          );
          setItems(arr);
        }
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!alert.show) return;
    const timer = setTimeout(
      () => setAlert((a) => ({ ...a, show: false })),
      3200,
    );
    return () => clearTimeout(timer);
  }, [alert.show]);

  const showErr = useCallback((message) => {
    setAlert({ show: true, type: "error", message });
  }, []);

  const showOk = useCallback((message) => {
    setAlert({ show: true, type: "success", message });
  }, []);

  const filtered = useMemo(() => {
    let list = visibleItems;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((row) => {
        const titleL = String(row.title || "").toLowerCase();
        const bodyL = String(row.body || "").toLowerCase();
        const bodyPlain = stripHtml(row.body).toLowerCase();
        const authorL = String(row.authorName || row.authorEmail || "").toLowerCase();
        return (
          titleL.includes(q) ||
          bodyL.includes(q) ||
          bodyPlain.includes(q) ||
          authorL.includes(q)
        );
      });
    }
    if (filter === "pinned") list = list.filter((r) => r.pinned);
    if (filter === "today") {
      const today0 = startOfDay(Date.now());
      list = list.filter(
        (r) => startOfDay(Number(r.createdAt || 0)) === today0,
      );
    }
    return list;
  }, [visibleItems, search, filter]);

  const unreadCount = useMemo(
    () => filtered.filter((r) => !readSet.has(r.id)).length,
    [filtered, readSet],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  const groupedRows = useMemo(() => {
    const groups = [];
    let lastKey = null;
    for (const row of pageItems) {
      const k = groupKey(row.createdAt);
      if (k !== lastKey) {
        lastKey = k;
        groups.push({ type: "header", key: `h-${k}`, ts: row.createdAt });
      }
      groups.push({ type: "row", key: row.id, row });
    }
    return groups;
  }, [pageItems]);

  const selected = useMemo(
    () => visibleItems.find((x) => x.id === selectedId) || null,
    [visibleItems, selectedId],
  );

  useEffect(() => {
    if (
      selectedId &&
      !visibleItems.some((x) => x.id === selectedId)
    ) {
      setSelectedId(null);
    }
  }, [visibleItems, selectedId]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const markAsRead = useCallback(
    (id) => {
      if (!id || !user?.email) return;
      saveReadId(user.email, id);
      setReadSet((prev) => new Set([...prev, id]));
    },
    [user?.email],
  );

  /** Desktop: sau F5 / chưa chọn mục → mở sẵn thông báo mới nhất trong danh sách đang lọc (mobile giữ danh sách). */
  useEffect(() => {
    if (loading || isNarrow) return;
    if (!filtered.length) {
      if (selectedId != null) setSelectedId(null);
      return;
    }
    if (selectedId != null) return;
    const first = filtered[0];
    setPage(1);
    setSelectedId(first.id);
    markAsRead(first.id);
  }, [loading, isNarrow, filtered, selectedId, markAsRead]);

  const handleOpenRow = (row) => {
    setSelectedId(row.id);
    markAsRead(row.id);
  };

  const handleCloseImagePreview = useCallback(() => {
    setPreviewImageSrc("");
  }, []);

  useEffect(() => {
    if (!previewImageSrc) return undefined;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [previewImageSrc]);

  const handleComposePublish = async (payload) => {
    if (!user?.email || !canPost) return;
    try {
      const now = Date.now();
      await push(ref(db, ANNOUNCEMENTS_PATH), {
        title: payload.title,
        body: payload.body,
        pinned: Boolean(payload.pinned),
        attachments: payload.attachments || [],
        cc: payload.cc || null,
        audience: payload.audience || "all",
        visibility: payload.visibility || ANNOUNCEMENT_VISIBILITY.ALL,
        authorEmail: user.email.trim(),
        authorName: user.name || "",
        createdAt: now,
      });
      showOk(t("internalAnnouncements.publishSuccess"));
    } catch (err) {
      console.error(err);
      showErr(t("internalAnnouncements.publishFail"));
      throw err;
    }
  };

  const handleDelete = async (row) => {
    if (!user?.email || !row?.id) return;
    const author =
      String(row.authorEmail || "")
        .trim()
        .toLowerCase() === String(user.email).trim().toLowerCase();
    if (!isAdmin && !author) return;
    if (!window.confirm(t("internalAnnouncements.deleteConfirm"))) return;
    try {
      await remove(ref(db, `${ANNOUNCEMENTS_PATH}/${row.id}`));
      if (selectedId === row.id) setSelectedId(null);
      showOk(t("internalAnnouncements.deleteSuccess"));
    } catch (err) {
      console.error(err);
      showErr(t("internalAnnouncements.deleteFail"));
    }
  };

  const togglePin = async (row, e) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!canPost || !row?.id) return;
    try {
      await update(ref(db, `${ANNOUNCEMENTS_PATH}/${row.id}`), {
        pinned: !row.pinned,
      });
    } catch (err) {
      console.error(err);
      showErr(t("internalAnnouncements.pinFail"));
    }
  };

  const sidebarLink = (key, labelKey, count, active) => (
    <button
      type="button"
      onClick={() => setFilter(key)}
      className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition ${
        active
          ? "bg-sky-50 font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      <span>{t(labelKey)}</span>
      {count != null && count > 0 ? (
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          {count}
        </span>
      ) : null}
    </button>
  );

  if (!user?.email) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f5f5f5] text-slate-800 dark:bg-slate-950 dark:text-slate-200 lg:flex-row">
      <AlertMessage alert={alert} />

      {/* Sidebar */}
      <aside
        className={`flex w-full flex-shrink-0 flex-col border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:w-[260px] lg:border-r ${
          isNarrow ? "border-b lg:border-b-0" : ""
        }`}
      >
        <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-700">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("internalAnnouncements.mailBrand")}
          </h1>
          {canPost ? (
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="mt-3 w-full rounded-md bg-sky-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
            >
              {t("internalAnnouncements.composeBtn")}
            </button>
          ) : (
            <p className="mt-2 text-xs leading-snug text-slate-500 dark:text-slate-400">
              {t("internalAnnouncements.readOnlyHint")}
            </p>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t("internalAnnouncements.sidebarMailboxes")}
          </p>
          {sidebarLink(
            "inbox",
            "internalAnnouncements.inbox",
            visibleItems.length,
            filter === "inbox",
          )}
          {sidebarLink(
            "pinned",
            "internalAnnouncements.pinned",
            visibleItems.filter((r) => r.pinned).length,
            filter === "pinned",
          )}
          {sidebarLink(
            "today",
            "internalAnnouncements.today",
            visibleItems.filter(
              (r) =>
                startOfDay(Number(r.createdAt || 0)) === startOfDay(Date.now()),
            ).length,
            filter === "today",
          )}
        </nav>

        <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-sky-500"
              style={{ width: "32%" }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            {t("internalAnnouncements.storageHint")}
          </p>
        </div>
      </aside>

      {/* Main + list + reading pane */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <header className="flex flex-shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {t("internalAnnouncements.inboxTitle")}
              </h2>
              <span className="text-sky-600 dark:text-sky-400">★</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t("internalAnnouncements.inboxStats", {
                total: filtered.length,
                unread: unreadCount,
              })}
            </p>
          </div>
          <div className="flex w-full max-w-md items-center gap-2 sm:w-auto">
            <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">
              {t("internalAnnouncements.searchIn")}
            </span>
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                🔍
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("internalAnnouncements.searchPlaceholder")}
                className="w-full rounded border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* List column */}
          <div
            className={`min-h-[50vh] min-w-0 flex-1 overflow-y-auto bg-white dark:bg-slate-900 lg:min-h-0 lg:basis-1/2 ${
              isNarrow && selectedId ? "hidden" : ""
            }`}
          >
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">
                {t("loading.loading")}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                {t("internalAnnouncements.empty")}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {groupedRows.map((g) => {
                  if (g.type === "header") {
                    return (
                      <div
                        key={g.key}
                        className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
                      >
                        {formatGroupHeader(g.ts, i18n.language, t)}
                      </div>
                    );
                  }
                  const row = g.row;
                  const unread = !readSet.has(row.id);
                  const author = row.authorName || row.authorEmail || "—";
                  const canDeleteRow =
                    Boolean(user?.email) &&
                    (isAdmin ||
                      String(row.authorEmail || "")
                        .trim()
                        .toLowerCase() ===
                        String(user.email).trim().toLowerCase());
                  return (
                    <div
                      key={g.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenRow(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleOpenRow(row);
                        }
                      }}
                      className={`flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 text-left transition hover:bg-sky-50/80 dark:hover:bg-sky-950/40 ${
                        selectedId === row.id ? "bg-sky-50 dark:bg-sky-950/50" : ""
                      }`}
                    >
                      {canPost ? (
                        <button
                          type="button"
                          className="mt-0.5 text-amber-500 hover:text-amber-600"
                          onClick={(e) => togglePin(row, e)}
                          title={t("internalAnnouncements.pinTitle")}
                        >
                          {row.pinned ? "★" : "☆"}
                        </button>
                      ) : (
                        <span
                          className={`mt-0.5 ${row.pinned ? "text-amber-500" : "text-slate-300"}`}
                          aria-hidden
                        >
                          {row.pinned ? "★" : "☆"}
                        </span>
                      )}
                      <span
                        className={`mt-0.5 ${unread ? "text-sky-600" : "text-slate-300"}`}
                        title={
                          unread
                            ? t("internalAnnouncements.unread")
                            : t("internalAnnouncements.read")
                        }
                        aria-hidden
                      >
                        ✉
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-bold text-slate-900 dark:text-slate-100">
                            {author}
                          </span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {formatTime(row.createdAt, i18n.language)}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-sm text-slate-800 dark:text-slate-200">
                          <span className={`font-bold text-red-600 dark:text-red-400 ${unread ? "font-extrabold" : ""}`}>
                            {row.title || "—"}
                          </span>
                          {row.visibility &&
                          row.visibility !== ANNOUNCEMENT_VISIBILITY.ALL ? (
                            <span
                              className="ml-1.5 inline-block rounded bg-amber-100 px-1.5 py-0 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-900"
                              title={t("internalAnnouncements.visibilityLabel")}
                            >
                              {row.visibility === ANNOUNCEMENT_VISIBILITY.AUTH
                                ? t("internalAnnouncements.visBadgeAuth")
                                : row.visibility ===
                                    ANNOUNCEMENT_VISIBILITY.MANAGERS
                                  ? t("internalAnnouncements.visBadgeManagers")
                                  : row.visibility ===
                                      ANNOUNCEMENT_VISIBILITY.ADMIN
                                    ? t("internalAnnouncements.visBadgeAdmin")
                                    : "·"}
                            </span>
                          ) : null}
                          <span className="font-normal text-slate-500">
                            {" "}
                            — {previewText(row.body)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {canDeleteRow ? (
                          <button
                            type="button"
                            className="rounded border border-red-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(row);
                            }}
                            title={t("internalAnnouncements.deleteMailHint")}
                          >
                            {t("internalAnnouncements.deleteMailBtn")}
                          </button>
                        ) : null}
                        <span className="text-[11px] text-slate-400">
                          {approxSizeKb(row.body)}KB
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && filtered.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 bg-slate-50 px-2 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <button
                  type="button"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded px-2 py-1 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700"
                >
                  ‹
                </button>
                <span>
                  {t("internalAnnouncements.pageOf", {
                    current: pageSafe,
                    total: totalPages,
                  })}
                </span>
                <button
                  type="button"
                  disabled={pageSafe >= totalPages}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="rounded px-2 py-1 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700"
                >
                  ›
                </button>
              </div>
            ) : null}
          </div>

          {/* Reading pane — desktop */}
          {!isNarrow && (
            <div className="hidden w-full flex-shrink-0 border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:flex lg:basis-1/2 lg:flex-col">
              {selected ? (
                <>
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {selected.title || "—"}
                    </h3>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatGroupHeader(selected.createdAt, i18n.language, t)}{" "}
                      · {formatTime(selected.createdAt, i18n.language)} ·{" "}
                      {selected.authorName || selected.authorEmail}
                    </p>
                    {user?.email &&
                      (isAdmin ||
                        String(selected.authorEmail || "")
                          .trim()
                          .toLowerCase() ===
                          String(user.email).trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => handleDelete(selected)}
                          className="mt-3 text-sm font-semibold text-red-600 hover:underline"
                        >
                          {t("internalAnnouncements.delete")}
                        </button>
                      )}
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    {selected.attachments?.length ? (
                      <>
                        {(() => {
                          const latest = getLatestAttachment(
                            selected.attachments,
                          );
                          return latest ? (
                            <LatestAttachmentInlinePreview
                              attachment={latest}
                              titleLabel={t(
                                "internalAnnouncements.latestAttachmentPreview",
                              )}
                              openInNewTabLabel={t(
                                "internalAnnouncements.openAttachmentNewTab",
                              )}
                            />
                          ) : null;
                        })()}
                        <ul className="mb-4 space-y-1 text-xs">
                          {selected.attachments.map((a, i) => (
                            <li key={`${a.url}-${i}`}>
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-600 hover:underline"
                              >
                                📎{" "}
                                {a.name || t("internalAnnouncements.attachment")}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    <AnnouncementBody
                      body={selected.body}
                      onImageClick={setPreviewImageSrc}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-400">
                  {t("internalAnnouncements.selectToRead")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reading — mobile full screen */}
      {isNarrow && selectedId && selected ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-slate-950">
          <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="rounded p-2 text-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="back"
            >
              ←
            </button>
            <span className="truncate text-sm font-semibold text-slate-800">
              {selected.title || "—"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <p className="text-xs text-slate-500">
              {formatGroupHeader(selected.createdAt, i18n.language, t)} ·{" "}
              {selected.authorName || selected.authorEmail}
            </p>
            <div className="mt-4">
              {selected.attachments?.length ? (
                <>
                  {(() => {
                    const latest = getLatestAttachment(selected.attachments);
                    return latest ? (
                      <LatestAttachmentInlinePreview
                        attachment={latest}
                        titleLabel={t(
                          "internalAnnouncements.latestAttachmentPreview",
                        )}
                        openInNewTabLabel={t(
                          "internalAnnouncements.openAttachmentNewTab",
                        )}
                      />
                    ) : null;
                  })()}
                  <ul className="mb-3 space-y-1 text-xs">
                    {selected.attachments.map((a, i) => (
                      <li key={`${a.url}-${i}`}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 hover:underline"
                        >
                          📎{" "}
                          {a.name || t("internalAnnouncements.attachment")}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <AnnouncementBody
                body={selected.body}
                onImageClick={setPreviewImageSrc}
              />
            </div>
            {user?.email &&
              (isAdmin ||
                String(selected.authorEmail || "")
                  .trim()
                  .toLowerCase() ===
                  String(user.email).trim().toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => handleDelete(selected)}
                  className="mt-6 text-sm font-semibold text-red-600"
                >
                  {t("internalAnnouncements.delete")}
                </button>
              )}
          </div>
        </div>
      ) : null}

      {previewImageSrc ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4"
          onClick={handleCloseImagePreview}
        >
          <button
            type="button"
            onClick={handleCloseImagePreview}
            className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xl font-bold text-slate-700 shadow hover:bg-white"
            aria-label="close image preview"
          >
            ×
          </button>
          <img
            src={previewImageSrc}
            alt="preview"
            className="max-h-[90vh] max-w-[92vw] rounded-md object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      {composeOpen && canPost && user ? (
        <InternalAnnouncementsCompose
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          user={user}
          onPublish={handleComposePublish}
          showErr={showErr}
          showOk={showOk}
        />
      ) : null}
    </div>
  );
}

export default InternalAnnouncements;
