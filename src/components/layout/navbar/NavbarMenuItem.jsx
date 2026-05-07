import { memo } from "react";
import NavbarRouterLink from "./NavbarRouterLink";
import NavTopLabel from "./NavTopLabel";

function NavbarMenuItem({ item, t, onClick, topLevel }) {
  return (
    <NavbarRouterLink to={item.path} onClick={onClick}>
      {topLevel ? (
        <NavTopLabel itemKey={item.key}>{t(item.label)}</NavTopLabel>
      ) : (
        t(item.label)
      )}
    </NavbarRouterLink>
  );
}

export default memo(NavbarMenuItem);
