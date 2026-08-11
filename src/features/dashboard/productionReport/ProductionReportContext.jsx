import React, { createContext, useContext, useMemo } from "react";
import { buildS90dDefectImageUploadPrefix } from "../s90d/lib/s90dManualEntriesFirebase";

const defaultContextValue = Object.freeze({
  i18nPrefix: "s90dReport",
  defaultProductCode: "S90D",
  buildDefectImageUploadPrefix: buildS90dDefectImageUploadPrefix,
});

const ProductionReportContext = createContext(defaultContextValue);

export function ProductionReportProvider({ config, children }) {
  const value = useMemo(
    () => ({
      ...defaultContextValue,
      ...config,
      buildDefectImageUploadPrefix:
        config?.buildDefectImageUploadPrefix ??
        defaultContextValue.buildDefectImageUploadPrefix,
    }),
    [config],
  );

  return (
    <ProductionReportContext.Provider value={value}>
      {children}
    </ProductionReportContext.Provider>
  );
}

export function useProductionReportContext() {
  return useContext(ProductionReportContext);
}
