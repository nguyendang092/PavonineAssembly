import { memo } from "react";
import NavbarRouterLink from "./NavbarRouterLink";
import NavTopLabel from "./NavTopLabel";
import { isMenuLeaf, navTopItemLiClass } from "./menuUtils";

function MobileMenuBranch({ items, ctx }) {
  return items.map((item) => {
    if (!item?.key) return null;
    if (item.adminOnly && !ctx.showAdminOnlyMenu) return null;
    if (isMenuLeaf(item)) {
      return (
        <li key={item.key}>
          <NavbarRouterLink to={item.path} onClick={ctx.closeMobileMenu}>
            {ctx.t(item.label)}
          </NavbarRouterLink>
        </li>
      );
    }
    if (item.children?.length) {
      const expanded = ctx.mobileDropdowns[item.key];
      return (
        <li key={item.key} className="mobile-nested-dropdown">
          <button
            type="button"
            className="mobile-dropdown-toggle nested"
            onClick={() => ctx.toggleMobileDropdown(item.key)}
            aria-expanded={expanded}
          >
            <span>{ctx.t(item.label)}</span>
            <span className={`mobile-arrow ${expanded ? "open" : ""}`}>
              ▼
            </span>
          </button>
          <ul
            className={`mobile-dropdown-content ${expanded ? "open" : ""}`}
          >
            <MobileMenuBranch items={item.children} ctx={ctx} />
          </ul>
        </li>
      );
    }
    return null;
  });
}

function MobileRootDropdown({ item, ctx }) {
  const expanded = ctx.mobileDropdowns[item.key];
  return (
    <li className={navTopItemLiClass(item.key, "mobile-dropdown")}>
      <button
        type="button"
        className="mobile-dropdown-toggle"
        onClick={() => ctx.toggleMobileDropdown(item.key)}
        aria-expanded={expanded}
      >
        <span>
          <NavTopLabel itemKey={item.key}>{ctx.t(item.label)}</NavTopLabel>
        </span>
        <span className={`mobile-arrow ${expanded ? "open" : ""}`}>▼</span>
      </button>
      <ul className={`mobile-dropdown-content ${expanded ? "open" : ""}`}>
        <MobileMenuBranch items={item.children} ctx={ctx} />
      </ul>
    </li>
  );
}

function MobileMenuTop({ menuConfig, ctx }) {
  return (
    <ul>
      {menuConfig.map((item) => {
        if (item.type === "dropdown") {
          return <MobileRootDropdown key={item.key} item={item} ctx={ctx} />;
        }
        return (
          <li key={item.key} className={navTopItemLiClass(item.key)}>
            <NavbarRouterLink to={item.path} onClick={ctx.closeMobileMenu}>
              <NavTopLabel itemKey={item.key}>{ctx.t(item.label)}</NavTopLabel>
            </NavbarRouterLink>
          </li>
        );
      })}
    </ul>
  );
}

export default memo(MobileMenuTop);
