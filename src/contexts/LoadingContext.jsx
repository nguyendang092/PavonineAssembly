import React, { createContext, useContext, useState } from "react";
import LoadingBlock from "@/components/ui/LoadingBlock";

const LoadingContext = createContext();

export const useLoading = () => useContext(LoadingContext);

export const LoadingProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  return (
    <LoadingContext.Provider value={{ loading, setLoading }}>
      {loading && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-[3px]"
          style={{ zIndex: "var(--z-loading, 1400)" }}
          aria-busy="true"
          aria-live="polite"
        >
          <LoadingBlock
            textClassName="text-sm font-medium text-slate-100 dark:text-slate-200"
          />
        </div>
      )}
      {children}
    </LoadingContext.Provider>
  );
};
