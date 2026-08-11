import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useProductionReportContext } from "./ProductionReportContext";

export function useReportT() {
  const { i18nPrefix } = useProductionReportContext();
  const { t } = useTranslation();

  return useCallback(
    (key, defaultValue, options) =>
      t(`${i18nPrefix}.${key}`, defaultValue, options),
    [i18nPrefix, t],
  );
}
