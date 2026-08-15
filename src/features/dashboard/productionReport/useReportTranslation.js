import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useProductionReportContext } from "./ProductionReportContext";

export function useReportT() {
  const { i18nPrefix } = useProductionReportContext();
  const { t, i18n } = useTranslation();

  return useCallback(
    (key, defaultValue, options) => {
      const primaryKey = `${i18nPrefix}.${key}`;
      if (i18n.exists(primaryKey)) {
        return t(primaryKey, defaultValue, options);
      }
      if (i18nPrefix !== "s90dReport") {
        const fallbackKey = `s90dReport.${key}`;
        if (i18n.exists(fallbackKey)) {
          return t(fallbackKey, defaultValue, options);
        }
      }
      return t(primaryKey, defaultValue, options);
    },
    [i18nPrefix, t, i18n],
  );
}
