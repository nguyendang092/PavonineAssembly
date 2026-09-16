import { useEffect } from "react";
import { tryNavigateS90dInputCell } from "../lib/s90dInputCellNav";

export function useS90dInputCellNav(rootRef) {
  useEffect(() => {
    const root = rootRef?.current;
    if (!root) return undefined;

    const onKeyDown = (event) => {
      tryNavigateS90dInputCell(event, root);
    };

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [rootRef]);
}
