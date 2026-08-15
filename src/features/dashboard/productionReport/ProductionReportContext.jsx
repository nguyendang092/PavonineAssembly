import React, { createContext, useContext, useMemo } from "react";

const defaultContextValue = Object.freeze({
  i18nPrefix: "s90dReport",
  defaultProductCode: "S90D",
});

const ProductionReportContext = createContext(defaultContextValue);

export function ProductionReportProvider({ config, children }) {
  const value = useMemo(
    () => ({
      ...defaultContextValue,
      ...config,
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
