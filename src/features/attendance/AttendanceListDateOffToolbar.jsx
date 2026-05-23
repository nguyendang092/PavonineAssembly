import React, { memo } from "react";
import { createPortal } from "react-dom";
import { isAdminAccess } from "@/config/authRoles";

function AttendanceListDateOffToolbar({
  user,
  userRole,
  selectedDate,
  setSelectedDate,
  isOffDay,
  isHolidayDay,
  isCompensatoryDay,
  dayOffToolbarButtonTitle,
  offHolidayDropdownOpen,
  setOffHolidayDropdownOpen,
  offHolidayDropdownRef,
  offHolidayDropdownAnchorRef,
  offHolidayDropdownPanelRef,
  offHolidayDropdownPlacement,
  navbarMobileMenuOpen,
  monthOffAndHoliday,
  monthOffDaysLoading,
  setOffDaysModalOpen,
  tl,
}) {
  return (
      <div className="grid min-w-0 flex-1 grid-cols-2 items-center gap-2 px-1 sm:flex sm:flex-nowrap sm:items-center sm:gap-1.5 sm:px-0 sm:overflow-x-auto sm:whitespace-nowrap">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="h-8 w-full min-w-0 rounded-md border bg-white px-2.5 text-sm font-semibold text-blue-700 focus:ring-2 focus:ring-blue-300 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-300 sm:w-auto"
        />
        {user && isAdminAccess(user, userRole) ? (
          <div
            className="relative min-w-0 pl-1 sm:pl-0"
            ref={offHolidayDropdownRef}
          >
            <button
              ref={offHolidayDropdownAnchorRef}
              type="button"
              aria-expanded={offHolidayDropdownOpen}
              aria-haspopup="menu"
              onClick={() => setOffHolidayDropdownOpen((open) => !open)}
              className={`inline-flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-lg border-2 px-3 text-sm font-bold tracking-tight shadow-md transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-300/70 dark:focus-visible:ring-violet-600/50 sm:px-3 sm:max-w-[min(100vw-10rem,19rem)] ${
                offHolidayDropdownOpen
                  ? "border-violet-500 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/35 ring-2 ring-violet-400/90 ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
                  : "border-violet-400/90 bg-gradient-to-br from-white to-violet-50 text-violet-950 hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/20 dark:border-violet-500/70 dark:from-slate-900 dark:to-violet-950/80 dark:text-violet-50 dark:hover:border-violet-400 dark:hover:shadow-violet-900/40"
              }`}
              title={dayOffToolbarButtonTitle}
            >
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-sm ${
                  offHolidayDropdownOpen
                    ? "bg-white/25 text-lg leading-none"
                    : "bg-violet-600/15 dark:bg-white/10"
                }`}
              >
                📅
              </span>
              <span className="min-w-0 shrink truncate">
                {tl(
                  "dayOffHolidayDropdownTrigger",
                  "Ngày OFF / LỄ / NGHỈ BÙ",
                )}
              </span>
              {isHolidayDay ? (
                <span className="shrink-0 rounded-md border border-amber-300/80 bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wide text-white shadow-sm dark:border-amber-400/60">
                  Lễ
                </span>
              ) : isCompensatoryDay ? (
                <span className="shrink-0 rounded-md border border-teal-300/80 bg-teal-600 px-2 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wide text-white shadow-sm dark:border-teal-400/60">
                  NB
                </span>
              ) : isOffDay ? (
                <span className="shrink-0 rounded-md border border-rose-300/80 bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wide text-white shadow-sm dark:border-rose-400/60">
                  OFF
                </span>
              ) : null}
              <svg
                className={`h-4 w-4 shrink-0 transition-transform ${
                  offHolidayDropdownOpen
                    ? "rotate-180 text-white"
                    : "text-violet-700 dark:text-violet-200"
                }`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {!navbarMobileMenuOpen &&
              offHolidayDropdownOpen &&
              offHolidayDropdownPlacement &&
              createPortal(
                <div
                  ref={offHolidayDropdownPanelRef}
                  role="menu"
                  className="fixed flex max-w-[calc(100vw-1rem)] origin-top flex-col overflow-hidden rounded-2xl border-2 border-violet-400/70 bg-white text-left shadow-2xl shadow-violet-900/20 ring-4 ring-violet-500/15 backdrop-blur-sm animate-fadeIn dark:border-violet-500/50 dark:bg-slate-900 dark:shadow-black/50 dark:ring-violet-400/20"
                  style={{
                    zIndex: "var(--z-modal-backdrop, 1200)",
                    top: offHolidayDropdownPlacement.top,
                    left: offHolidayDropdownPlacement.left,
                    width: offHolidayDropdownPlacement.width,
                    maxHeight: offHolidayDropdownPlacement.maxHeight,
                  }}
                >
                  <div className="shrink-0 border-b border-violet-200/80 bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-700 px-4 py-3 dark:border-violet-500/40 dark:from-violet-700 dark:via-indigo-700 dark:to-violet-800">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/90">
                      {tl("dayOffDropdownSelectedLabel", "Ngày đang xem")}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm leading-snug text-white">
                      <span className="rounded-lg bg-black/20 px-2 py-1 font-mono text-sm font-bold tabular-nums tracking-tight">
                        {selectedDate}
                      </span>
                      <span className="text-white/70">—</span>
                      {isHolidayDay ? (
                        <span className="rounded-lg border border-amber-300/60 bg-amber-500/95 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-white shadow-inner">
                          HOLIDAY
                        </span>
                      ) : isCompensatoryDay ? (
                        <span className="rounded-lg border border-teal-300/60 bg-teal-600 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-white shadow-inner">
                          NB
                        </span>
                      ) : isOffDay ? (
                        <span className="rounded-lg border border-rose-300/60 bg-rose-600 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-white shadow-inner">
                          OFF
                        </span>
                      ) : (
                        <span className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold">
                          {tl("dayKindNormal", "Ngày bình thường")}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/90 px-4 py-3 dark:bg-slate-950/80">
                    {monthOffDaysLoading ? (
                      <p className="rounded-lg border border-violet-200/80 bg-white px-3 py-4 text-center text-xs font-medium text-violet-800 dark:border-violet-700/60 dark:bg-slate-900 dark:text-violet-200">
                        {tl(
                          "dayOffToolbarLoading",
                          "Đang tải danh sách ngày off trong tháng…",
                        )}
                      </p>
                    ) : (
                      <div className="space-y-4 text-xs">
                        <div className="rounded-xl border border-rose-200/90 bg-white p-3 shadow-sm dark:border-rose-900/60 dark:bg-slate-900">
                          <p className="flex items-center gap-2 border-l-4 border-rose-500 pl-2 text-[13px] font-extrabold uppercase tracking-wide text-rose-800 dark:border-rose-400 dark:text-rose-100">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-[11px] font-black text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                              O
                            </span>
                            {tl("dayOffDropdownSectionOff", "Ngày off")}
                          </p>
                          {monthOffAndHoliday.off.length === 0 ? (
                            <p className="mt-2 rounded-lg bg-rose-50/80 px-2 py-2 italic text-rose-700/90 dark:bg-rose-950/40 dark:text-rose-200/90">
                              {tl(
                                "dayOffDropdownEmptyOff",
                                "Chưa có ngày off trong tháng này.",
                              )}
                            </p>
                          ) : (
                            <ul className="mt-2.5 flex flex-wrap gap-1.5">
                              {monthOffAndHoliday.off.map((k) => (
                                <li key={k}>
                                  <span className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 font-mono text-[11px] font-bold tabular-nums text-rose-950 shadow-sm dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-50">
                                    {k}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="rounded-xl border border-amber-200/90 bg-white p-3 shadow-sm dark:border-amber-900/60 dark:bg-slate-900">
                          <p className="flex items-center gap-2 border-l-4 border-amber-500 pl-2 text-[13px] font-extrabold uppercase tracking-wide text-amber-950 dark:border-amber-400 dark:text-amber-50">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[11px] dark:bg-amber-950">
                              ★
                            </span>
                            {tl("dayOffDropdownSectionHoliday", "Ngày lễ")}
                          </p>
                          {monthOffAndHoliday.holiday.length === 0 ? (
                            <p className="mt-2 rounded-lg bg-amber-50/90 px-2 py-2 italic text-amber-900/90 dark:bg-amber-950/40 dark:text-amber-100/90">
                              {tl(
                                "dayOffDropdownEmptyHoliday",
                                "Chưa có ngày lễ trong tháng này.",
                              )}
                            </p>
                          ) : (
                            <ul className="mt-2.5 flex flex-wrap gap-1.5">
                              {monthOffAndHoliday.holiday.map((k) => (
                                <li key={k}>
                                  <span className="inline-flex items-center rounded-lg border border-amber-300/80 bg-amber-50 px-2 py-1 font-mono text-[11px] font-bold tabular-nums text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-50">
                                    {k}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="rounded-xl border border-teal-200/90 bg-white p-3 shadow-sm dark:border-teal-900/60 dark:bg-slate-900">
                          <p className="flex items-center gap-2 border-l-4 border-teal-500 pl-2 text-[13px] font-extrabold uppercase tracking-wide text-teal-900 dark:border-teal-400 dark:text-teal-50">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-[10px] font-black text-teal-800 dark:bg-teal-950 dark:text-teal-100">
                              B
                            </span>
                            {tl(
                              "dayOffDropdownSectionCompensatory",
                              "Nghỉ bù",
                            )}
                          </p>
                          {monthOffAndHoliday.compensatory.length === 0 ? (
                            <p className="mt-2 rounded-lg bg-teal-50/90 px-2 py-2 italic text-teal-900/90 dark:bg-teal-950/40 dark:text-teal-100/90">
                              {tl(
                                "dayOffDropdownEmptyCompensatory",
                                "Chưa có ngày nghỉ bù trong tháng này.",
                              )}
                            </p>
                          ) : (
                            <ul className="mt-2.5 flex flex-wrap gap-1.5">
                              {monthOffAndHoliday.compensatory.map((k) => (
                                <li key={k}>
                                  <span className="inline-flex items-center rounded-lg border border-teal-300/80 bg-teal-50 px-2 py-1 font-mono text-[11px] font-bold tabular-nums text-teal-950 shadow-sm dark:border-teal-700 dark:bg-teal-950/70 dark:text-teal-50">
                                    {k}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 border-t border-violet-200/80 bg-gradient-to-b from-violet-50/90 to-white px-3 py-3 dark:border-violet-800/80 dark:from-slate-900 dark:to-slate-950">
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full rounded-lg bg-gradient-to-r from-violet-600 via-violet-600 to-indigo-600 py-2.5 text-center text-xs font-extrabold uppercase tracking-wide text-white shadow-lg shadow-violet-600/40 transition hover:from-violet-500 hover:to-indigo-500 hover:shadow-xl hover:shadow-violet-500/45 active:scale-[0.99] dark:shadow-violet-900/50"
                      onClick={() => {
                        setOffHolidayDropdownOpen(false);
                        setOffDaysModalOpen(true);
                      }}
                    >
                      {tl(
                        "dayOffDropdownOpenModal",
                        "Chỉnh sửa ngày OFF / LỄ / NGHỈ BÙ",
                      )}
                    </button>
                  </div>
                </div>,
                document.body,
              )}
          </div>
        ) : null}
      </div>
  );
}

export default memo(AttendanceListDateOffToolbar);
