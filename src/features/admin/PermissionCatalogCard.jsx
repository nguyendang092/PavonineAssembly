import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  PERMISSION_ROLE_META,
  splitModulePath,
} from "./permissionCatalogUtils";
function RoleBadge({ roleLevel }) {
  const meta = PERMISSION_ROLE_META[roleLevel];
  if (!meta) return null;
  return (
    <span
      className="pc-badge"
      style={{
        color: meta.color,
        background: meta.dim,
        borderColor: `${meta.color}55`,
      }}
    >
      {meta.labelVi}
    </span>
  );
}

function DetailRow({ label, title, children, variant = "default" }) {
  return (
    <div className={`pc-detail-row pc-detail-row--${variant}`}>
      <div className="pc-detail-row__label" title={title || label}>
        {label}
      </div>
      <div className="pc-detail-row__value">{children}</div>
    </div>
  );
}

function RouteLink({ route }) {
  const { t } = useTranslation();
  return (
    <Link
      to={route}
      className="pc-tag pc-tag--route pc-route-link pc-mono"
      title={t("permissionCatalog.openRoute", "Mở {{route}}", { route })}
    >
      {route}
    </Link>
  );
}

function ModuleChip({ path }) {
  const { dir, name } = splitModulePath(path);
  return (
    <code className="pc-mod-chip" title={path}>
      {dir ? <span className="pc-mod-chip__dir">{dir}</span> : null}
      <span className="pc-mod-chip__name">{name}</span>
    </code>
  );
}

function PermissionCatalogCard({
  entry,
  roleLevel,
  expanded,
  onToggle,
}) {
  const { t } = useTranslation();
  const meta = PERMISSION_ROLE_META[roleLevel];
  const panelId = `pc-panel-${entry.id}`;

  return (
    <article
      className={`pc-card${expanded ? " pc-card--open" : ""}`}
      style={{ "--pc-accent": meta.color, "--pc-accent-dim": meta.dim }}
    >
      <button
        type="button"
        className="pc-card__head"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <div className="pc-card__head-main">
          <div className="pc-card__id-line">
            <span className="pc-mono">{entry.id}</span>
            {entry.routes.length > 0 ? (
              <span className="pc-card__route-preview pc-mono">
                {entry.routes[0]}
                {entry.routes.length > 1 ? ` +${entry.routes.length - 1}` : ""}
              </span>
            ) : null}
          </div>
          <h2 className="pc-card__func">{entry.labelVi}</h2>
        </div>
        <div className="pc-card__head-side">
          <RoleBadge roleLevel={roleLevel} />
          <span className="pc-card__chevron" aria-hidden>
            {expanded ? "▴" : "▾"}
          </span>
        </div>
      </button>

      {expanded ? (
        <div id={panelId} className="pc-card__body">
          <div className="pc-rule-block">
            <span className="pc-rule-block__label">
              {t("permissionCatalog.colFeature", "Chức năng")}
            </span>
            <p className="pc-rule-block__text">{entry.quyTac}</p>
          </div>

          <div className="pc-detail-sheet">
            <DetailRow
              label={t("permissionCatalog.colModulesShort", "Module")}
              title={t("permissionCatalog.colModules", "File / module")}
              variant="modules"
            >
              <div className="pc-chip-grid">
                {entry.modules.map((mod) => (
                  <ModuleChip key={mod} path={mod} />
                ))}
              </div>
            </DetailRow>

            <DetailRow
              label={t("permissionCatalog.colHelpersShort", "Helpers")}
              title={t(
                "permissionCatalog.colHelpers",
                "authRoles / helpers",
              )}
              variant="helpers"
            >
              <div className="pc-chip-grid">
                {entry.authRolesHelpers.map((helper) => (
                  <span key={helper} className="pc-tag pc-tag--helper pc-mono">
                    {helper}
                  </span>
                ))}
              </div>
            </DetailRow>

            <DetailRow
              label={t("permissionCatalog.colRoutes", "Route")}
              variant="routes"
            >
              {entry.routes.length > 0 ? (
                <div className="pc-chip-grid">
                  {entry.routes.map((route) => (
                    <RouteLink key={route} route={route} />
                  ))}
                </div>
              ) : (
                <span className="pc-empty-value pc-mono">—</span>
              )}
            </DetailRow>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default memo(PermissionCatalogCard);
