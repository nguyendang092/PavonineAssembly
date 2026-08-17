import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { countByField } from "../lib/moldMetrics";

export default function MoldSidebar({
  molds,
  activeNav,
  subsidiaryFilter,
  typeFilter,
  onNavSelect,
}) {
  const { t } = useTranslation();

  const subsidiaryCounts = useMemo(
    () => countByField(molds, "Subsidiary"),
    [molds],
  );
  const typeCounts = useMemo(() => countByField(molds, "Type"), [molds]);

  const overviewItems = [
    {
      id: "list",
      label: t("moldManager.moldList", "Danh sách khuôn"),
      count: molds.length,
    },
    {
      id: "maintenance",
      label: t("moldManager.maintenanceSchedule", "Lịch bảo trì"),
      count: null,
    },
    {
      id: "shot-history",
      label: t("moldManager.shotHistory", "Lịch sử SHOT"),
      count: null,
    },
  ];

  const systemItems = [
    {
      id: "vendors",
      label: t("moldManager.vendors", "Nhà cung cấp"),
      count: null,
    },
    {
      id: "audit",
      label: t("moldManager.auditLog", "Nhật ký thao tác"),
      count: null,
    },
  ];

  const renderItem = (item) => (
    <button
      key={item.id}
      type="button"
      className={`mold-sidebar-item${
        activeNav === item.id ? " mold-sidebar-item--active" : ""
      }`}
      onClick={() => onNavSelect(item.id)}
    >
      <span>{item.label}</span>
      {item.count != null ? (
        <span className="mold-sidebar-badge">{item.count}</span>
      ) : null}
    </button>
  );

  return (
    <aside className="mold-sidebar">
      <div className="mold-sidebar-plate">
        <div className="mold-sidebar-plate-brand">SEHC MES</div>
        <div className="mold-sidebar-plate-title">Mold Registry</div>
      </div>

      <nav className="mold-sidebar-nav" aria-label={t("moldManager.title")}>
        <div className="mold-sidebar-group">
          <div className="mold-sidebar-group-label">
            {t("moldManager.navOverview", "Tổng quan")}
          </div>
          {overviewItems.map(renderItem)}
        </div>

        <div className="mold-sidebar-group">
          <div className="mold-sidebar-group-label">
            {t("moldManager.navBranch", "Chi nhánh")}
          </div>
          {Object.entries(subsidiaryCounts).map(([name, count]) => (
            <button
              key={name}
              type="button"
              className={`mold-sidebar-item${
                activeNav === `branch:${name}` || subsidiaryFilter === name
                  ? " mold-sidebar-item--active"
                  : ""
              }`}
              onClick={() => onNavSelect(`branch:${name}`, { subsidiary: name })}
            >
              <span>{name}</span>
              <span className="mold-sidebar-badge">{count}</span>
            </button>
          ))}
        </div>

        <div className="mold-sidebar-group">
          <div className="mold-sidebar-group-label">
            {t("moldManager.navType", "Loại khuôn")}
          </div>
          {Object.entries(typeCounts).map(([name, count]) => (
            <button
              key={name}
              type="button"
              className={`mold-sidebar-item${
                activeNav === `type:${name}` || typeFilter === name
                  ? " mold-sidebar-item--active"
                  : ""
              }`}
              onClick={() => onNavSelect(`type:${name}`, { type: name })}
            >
              <span>{name}</span>
              <span className="mold-sidebar-badge">{count}</span>
            </button>
          ))}
        </div>

        <div className="mold-sidebar-group">
          <div className="mold-sidebar-group-label">
            {t("moldManager.navSystem", "Hệ thống")}
          </div>
          {systemItems.map(renderItem)}
        </div>
      </nav>

      <div className="mold-sidebar-foot">
        Pavonine Vina · Mold tooling registry
      </div>
    </aside>
  );
}
