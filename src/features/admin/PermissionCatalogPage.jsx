import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useUserIdentity, useUserPermissions } from "@/contexts/UserContext";
import { isAdminAccess } from "@/config/authRoles";
import { PERMISSION_CATALOG } from "@/config/featurePermissions";
import PermissionCatalogCard from "./PermissionCatalogCard";
import {
  PERMISSION_ROLE_LEVELS,
  PERMISSION_ROLE_META,
  buildPermissionCatalogStats,
  enrichPermissionCatalogEntry,
  filterPermissionCatalog,
} from "./permissionCatalogUtils";
import "./permissionCatalog.css";

const ROLE_FILTER_ORDER = [
  PERMISSION_ROLE_LEVELS.ADMIN,
  PERMISSION_ROLE_LEVELS.MANAGER,
  PERMISSION_ROLE_LEVELS.STAFF,
  PERMISSION_ROLE_LEVELS.SYSTEM,
];

export default function PermissionCatalogPage() {
  const { t } = useTranslation();
  const { user } = useUserIdentity();
  const { userRole } = useUserPermissions();
  const [q, setQ] = useState("");
  const [roleFilters, setRoleFilters] = useState([]);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const stats = useMemo(
    () => buildPermissionCatalogStats(PERMISSION_CATALOG),
    [],
  );

  const rows = useMemo(
    () => filterPermissionCatalog(PERMISSION_CATALOG, { query: q, roleFilters }),
    [q, roleFilters],
  );

  const enrichedRows = useMemo(
    () => rows.map((row) => enrichPermissionCatalogEntry(row)),
    [rows],
  );

  const toggleRoleFilter = useCallback((role) => {
    setRoleFilters((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }, []);

  const toggleExpanded = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allowed = Boolean(user && isAdminAccess(user, userRole));

  if (!user) {
    return (
      <div className="permission-catalog-page pc-gate">
        <div className="pc-gate__card">
          <p>
            {t(
              "permissionCatalog.pleaseLogin",
              "Vui lòng đăng nhập để tiếp tục.",
            )}
          </p>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="permission-catalog-page pc-gate">
        <div className="pc-gate__card pc-gate__card--warn">
          <p>
            {t(
              "permissionCatalog.forbidden",
              "Chỉ tài khoản Admin hoặc HR mới xem được trang tra cứu phân quyền.",
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="permission-catalog-page">
      <div className="pc-shell">
        <header className="pc-header">
          <div>
            <p className="pc-eyebrow">
              <span className="pc-eyebrow__dot" aria-hidden />
              {t("permissionCatalog.eyebrow", "PERMISSION_CATALOG · nội bộ")}
            </p>
            <h1 className="pc-title">
              {t(
                "permissionCatalog.title",
                "Tra cứu phân quyền & chức năng",
              )}
            </h1>
            <p className="pc-subtitle">
              {t(
                "permissionCatalog.subtitle",
                "Dữ liệu lấy từ PERMISSION_CATALOG (src/config/featurePermissions.js). Cập nhật catalog khi thêm màn hoặc đổi quyền.",
              )}
            </p>
          </div>

          <div className="pc-stats" aria-label={t("permissionCatalog.statsAria", "Thống kê")}>
            <div className="pc-stat">
              <span className="pc-stat__value">{stats.entries}</span>
              <span className="pc-stat__label">
                {t("permissionCatalog.statEntries", "Mục")}
              </span>
            </div>
            <div className="pc-stat">
              <span className="pc-stat__value">{stats.routes}</span>
              <span className="pc-stat__label">
                {t("permissionCatalog.statRoutes", "Route")}
              </span>
            </div>
            <div className="pc-stat">
              <span className="pc-stat__value">{stats.modules}</span>
              <span className="pc-stat__label">
                {t("permissionCatalog.statModules", "File")}
              </span>
            </div>
          </div>
        </header>

        <section className="pc-controls" aria-label={t("permissionCatalog.filterLabel", "Lọc nhanh")}>
          <div className="pc-controls__row">
            <input
              type="search"
              className="pc-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t(
                "permissionCatalog.filterPlaceholder",
                "ID, đường dẫn, tên file, quy tắc…",
              )}
            />

            {ROLE_FILTER_ORDER.map((role) => {
              const meta = PERMISSION_ROLE_META[role];
              const active = roleFilters.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  className={`pc-chip pc-chip--${role}${active ? " pc-chip--active" : ""}`}
                  onClick={() => toggleRoleFilter(role)}
                  aria-pressed={active}
                >
                  {meta.labelVi}
                </button>
              );
            })}
          </div>

          <div className="pc-legend" aria-hidden>
            {ROLE_FILTER_ORDER.map((role) => {
              const meta = PERMISSION_ROLE_META[role];
              return (
                <span key={role} className="pc-legend__item">
                  <span
                    className="pc-legend__swatch"
                    style={{ background: meta.color }}
                  />
                  {meta.labelVi}
                </span>
              );
            })}
          </div>
        </section>

        {enrichedRows.length === 0 ? (
          <p className="pc-empty">
            {t("permissionCatalog.noResults", "Không có mục phù hợp bộ lọc.")}
          </p>
        ) : (
          <div className="pc-list">
            {enrichedRows.map((row) => (
              <PermissionCatalogCard
                key={row.id}
                entry={row}
                roleLevel={row.roleLevel}
                expanded={expandedIds.has(row.id)}
                onToggle={() => toggleExpanded(row.id)}
              />
            ))}
          </div>
        )}

        <p className="pc-footer">
          {t("permissionCatalog.footerCount", "{{shown}} / {{total}} mục", {
            shown: enrichedRows.length,
            total: PERMISSION_CATALOG.length,
          })}
        </p>
      </div>
    </div>
  );
}
