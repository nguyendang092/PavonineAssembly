/** className cho <li> nav cấp 1 có pill */
export function navTopItemLiClass(itemKey, baseClass) {
  const pill =
    itemKey === "reports"
      ? "nav-item-top-pill nav-item-top-pill--reports"
      : "";
  return [baseClass, pill].filter(Boolean).join(" ");
}

export function isMenuLeaf(item) {
  return typeof item.path === "string" && item.path.length > 0;
}
