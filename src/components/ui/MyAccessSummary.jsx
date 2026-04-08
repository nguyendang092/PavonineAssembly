import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import {
  canManageUserDepartmentMappings,
  isAdminOrHR,
  normalizeRole,
  ROLES,
} from "@/config/authRoles";

const PANEL_STORAGE_KEY = "pavonine_myAccessPanelOpen";

/**
 * Tóm tắt quyền của user đang đăng nhập — dùng toàn app (compact) hoặc trang Phân quyền (full).
 */
function MyAccessSummary({ variant = "compact" }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { user, userRole, userDepartments: myScopeDepartments } = useUser();

  const [panelOpen, setPanelOpen] = useState(() => {
    try {
      const v = sessionStorage.getItem(PANEL_STORAGE_KEY);
      if (v === "0") return false;
      if (v === "1") return true;
    } catch {
      /* ignore */
    }
    return true;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(PANEL_STORAGE_KEY, panelOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [panelOpen]);

  const togglePanel = useCallback(() => {
    setPanelOpen((o) => !o);
  }, []);

  const canManageMappings = canManageUserDepartmentMappings(user, userRole);

  const roleShort =
    normalizeRole(userRole) === ROLES.ADMIN
      ? t("userDeptManager.roleAdmin")
      : normalizeRole(userRole) === ROLES.MANAGER
        ? t("userDeptManager.roleManager")
        : normalizeRole(userRole) === ROLES.STAFF
          ? t("userDeptManager.roleStaff")
          : "—";

  if (!user) return null;

  if (variant === "compact" && pathname === "/user-department") {
    return null;
  }

  if (variant === "compact") {
    const arenas =
      myScopeDepartments?.length > 0
        ? myScopeDepartments.join(", ")
        : t("userDeptManager.myAccessCompactNoArena");

    if (!panelOpen) {
      return (
        <button
          type="button"
          onClick={togglePanel}
          className="pointer-events-auto fixed right-3 top-16 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/90 bg-emerald-50/95 text-lg shadow-md backdrop-blur-sm transition hover:bg-emerald-100 hover:shadow sm:right-4"
          title={t("userDeptManager.myAccessToggleExpand")}
          aria-expanded="false"
          aria-label={t("userDeptManager.myAccessToggleExpand")}
        >
          🔐
        </button>
      );
    }

    return (
      <div
        className="pointer-events-auto fixed right-3 top-16 z-40 max-w-[min(17.5rem,calc(100vw-1.5rem))] rounded-lg border border-emerald-200/90 bg-emerald-50/95 px-2.5 pb-2 pt-1.5 text-[11px] leading-snug text-emerald-950 shadow-md backdrop-blur-sm sm:right-4 sm:px-3 sm:text-xs"
        role="region"
        aria-label={t("userDeptManager.myAccessTitle")}
      >
        <div className="mb-1 flex items-start justify-between gap-1 border-b border-emerald-200/70 pb-1">
          <p className="min-w-0 flex-1 font-bold leading-tight text-emerald-900">
            {t("userDeptManager.myAccessCompactPrefix")}
          </p>
          <button
            type="button"
            onClick={togglePanel}
            className="shrink-0 rounded p-0.5 text-emerald-800 transition hover:bg-emerald-200/60 hover:text-emerald-950"
            title={t("userDeptManager.myAccessToggleCollapse")}
            aria-expanded="true"
            aria-label={t("userDeptManager.myAccessToggleCollapse")}
          >
            <span className="block text-base leading-none" aria-hidden>
              −
            </span>
          </button>
        </div>
        <p
          className="mt-1 truncate font-mono text-emerald-800"
          title={user.email}
        >
          {user.email}
        </p>
        <p className="mt-0.5 font-semibold text-emerald-900">
          {roleShort}
          {isAdminOrHR(user) ? (
            <span className="font-normal text-emerald-700">
              {" "}
              ({t("userDeptManager.myAccessHrOrAdminBadge")})
            </span>
          ) : null}
        </p>
        <p className="mt-1 line-clamp-2 text-emerald-800" title={arenas}>
          <span className="font-semibold text-emerald-900">
            {t("userDeptManager.myAccessCompactArenas")}:
          </span>{" "}
          {arenas}
        </p>
        <Link
          to="/user-department"
          className="mt-1.5 inline-block font-semibold text-emerald-800 underline decoration-emerald-400 underline-offset-2 hover:text-emerald-950"
        >
          {t("userDeptManager.myAccessDetailLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50/90 px-5 py-4 shadow-sm">
      <h2 className="text-lg font-bold text-emerald-900">
        {t("userDeptManager.myAccessTitle")}
      </h2>
      <dl className="mt-3 grid gap-2 text-sm text-emerald-950 sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-emerald-800">
            {t("userDeptManager.myAccessEmail")}
          </dt>
          <dd className="break-all font-mono text-xs sm:text-sm">{user.email}</dd>
        </div>
        <div>
          <dt className="font-semibold text-emerald-800">
            {t("userDeptManager.myAccessRole")}
          </dt>
          <dd>
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="rounded bg-white/80 px-2 py-0.5 text-xs font-bold uppercase text-emerald-900 ring-1 ring-emerald-300">
                {roleShort}
              </span>
              {isAdminOrHR(user) ? (
                <span className="text-xs text-emerald-700">
                  ({t("userDeptManager.myAccessHrOrAdminBadge")})
                </span>
              ) : null}
            </span>
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-semibold text-emerald-800">
            {t("userDeptManager.myAccessArenas")}
          </dt>
          <dd className="text-emerald-900">
            {myScopeDepartments?.length
              ? myScopeDepartments.join(", ")
              : t("userDeptManager.myAccessArenasNone")}
          </dd>
        </div>
      </dl>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-emerald-900">
        {canManageMappings ? (
          <li>{t("userDeptManager.myAccessBulletManage")}</li>
        ) : null}
        {normalizeRole(userRole) === ROLES.MANAGER ? (
          <li>{t("userDeptManager.myAccessBulletManager")}</li>
        ) : null}
        {normalizeRole(userRole) === ROLES.STAFF ? (
          <li>{t("userDeptManager.myAccessBulletStaff")}</li>
        ) : null}
        {normalizeRole(userRole) === ROLES.ADMIN || isAdminOrHR(user) ? (
          <li>{t("userDeptManager.myAccessBulletAdminFull")}</li>
        ) : null}
      </ul>
    </div>
  );
}

export default MyAccessSummary;
